// Owner-authenticated, role-scoped workspaces. One shared capped AI model, not independent autonomous agents.
import {ROLES} from './roles.mjs';
import {bad,validateSynthetic,idIsSafe} from './security.mjs';
import {requireDb} from './store.mjs';
import {chatHistory,saveChatTurn,managerChat,parseMessage} from './manager-chat.mjs';
import {parseCommand,interpretOwnerTask,resolveProjectRequest,proposeCommand} from './manager-commands.mjs';

function context(env,role){
 if(!ROLES.includes(role))throw bad('Unknown agent role',404);
 if(env.MANAGER_THREADS_ENABLED!=='true'||env.MANAGER_COMMANDS_ENABLED!=='true')throw bad('Agent workspace not configured',503);
 return {db:requireDb(env),id:'a9e17000-0000-4000-8000-'+String(ROLES.indexOf(role)+1).padStart(12,'0'),title:'Agent workspace: '+role};
}
async function ensureThread(env,role){
 const c=context(env,role);
 await c.db.prepare('INSERT OR IGNORE INTO manager_threads(id,title,created_at) VALUES(?,?,?)').bind(c.id,c.title,new Date().toISOString()).run();
 const row=await c.db.prepare('SELECT title FROM manager_threads WHERE id=?').bind(c.id).first();
 if(row?.title!==c.title)throw bad('Agent conversation identity unavailable',503);
 return c;
}
export async function agentWorkspace(env,role){
 const {db,id,title}=context(env,role);
 const thread=await db.prepare('SELECT title FROM manager_threads WHERE id=?').bind(id).first();
 if(thread&&thread.title!==title)throw bad('Agent conversation identity unavailable',503);
 const tasks=await db.prepare('SELECT id,role,action,project_id,state,job_id,result_status,created_at,updated_at,input_json FROM manager_commands WHERE role=? ORDER BY created_at DESC LIMIT 30').bind(role).all();
 const jobs=await db.prepare("SELECT id,project_id,role,action,created_at,json_extract(result_json,'$.status') AS result_status FROM jobs WHERE role=? ORDER BY created_at DESC LIMIT 30").bind(role).all();
 const pause=await db.prepare('SELECT paused FROM manager_role_controls WHERE role=?').bind(role).first();
 return {role,paused:pause?.paused===1,tasks:(tasks.results||[]).map(({input_json,...t})=>{const i=JSON.parse(input_json);return {...t,detail:role==='website-developer'?i.description:role==='research'?i.sector:role==='sales'?'Tier '+i.tier:role==='support'?i.category:null}}),jobs:jobs.results||[],turns:thread?(await chatHistory(env,id)).turns:[],mode:'staging',historyLimit:30};
}
async function record(env,id,message,reply,extra={}){
 const createdAt=new Date().toISOString(),kind='verified-record';
 await saveChatTurn(env,{message,reply,kind,createdAt,threadId:id});
 return {message,reply,kind,created_at:createdAt,jobExecuted:false,...extra};
}
export async function agentMessage(env,role,payload){
 context(env,role);
 if(Object.hasOwn(payload||{},'threadId'))throw bad('Agent conversation is assigned by role');
 const message=parseMessage(payload);
 const {id}=await ensureThread(env,role);
 const normalized=message.toLowerCase().trim().replace(/[?.!]+$/,'');
 const exact=parseCommand(message),natural=exact?null:(await resolveProjectRequest(env,message)||interpretOwnerTask(message));
 const command=exact||natural?.command;
 if(natural?.reply)return record(env,id,message,natural.reply);
 if(command){
   if(command.role!==role)return record(env,id,message,'This agent cannot execute that task type. Ask the Manager or appropriate agent. No task was started.');
   const proposal=await proposeCommand(env,command);
   return record(env,id,message,'Task saved for owner approval. Nothing has been executed. Review the task below.',{proposal});
 }
 if(/^(status|tasks|recent jobs|show tasks|what are you doing|what have you done|check status)$/.test(normalized)){
   const data=await agentWorkspace(env,role);
   const lines=data.tasks.slice(0,5).map(t=>t.project_id+' / '+t.action+' — '+t.state+(t.result_status?' — '+t.result_status:''));
   const jobs=data.jobs.slice(0,5).map(j=>j.project_id+' / '+j.action+' — '+(j.result_status||'recorded'));
   return record(env,id,message,'Verified '+role+' records. New dispatch '+(data.paused?'paused':'allowed')+'.\nRecent assignments:\n'+(lines.join('\n')||'None')+'\nRecent job results:\n'+(jobs.join('\n')||'None')+'\nThese are stored records, not a live activity timer.');
 }
 // Advice uses the existing shared quota and isolated role history. No tools.
 return managerChat(env,{synthetic:true,message,threadId:id},{agentRole:role,learningScope:'role:'+role});
}
export function buildAgentCommand(role,payload){
 validateSynthetic(payload);
 if(Object.keys(payload).some(k=>!['synthetic','projectId','detail'].includes(k))||typeof payload.projectId!=='string'||typeof (payload.detail??'')!=='string')throw bad('Invalid task');
 const projectId=payload.projectId.trim().toUpperCase();
 if(!idIsSafe(projectId))throw bad('Use a fictional project ID of 3–30 letters, digits, underscore or dash');
 const detail=(payload.detail||'').trim();
 if(detail.length>400)throw bad('Task detail is limited to 400 characters');
 const command=parseCommand('run '+role+' for '+projectId);
 if(detail){
   if(role==='website-developer')command.input={...command.input,description:detail};
   else if(role==='research'){if(detail.length>70)throw bad('Research sector is limited to 70 characters');command.input={...command.input,sector:detail};}
   else if(role==='sales'){if(!/^[1-6]$/.test(detail))throw bad('Enter a price tier from 1 to 6');command.input={tier:Number(detail)};}
   else if(role==='support'){if(detail.length>50)throw bad('Support category is limited to 50 characters');command.input={category:detail};}
   else throw bad('This action uses the saved project or fixed staging inputs; leave details empty');
 }
 validateSynthetic({synthetic:true,input:command.input});
 return {command,projectId,detail};
}
export async function agentTask(env,role,payload){
 context(env,role);
 const {command,projectId,detail}=buildAgentCommand(role,payload);
 const {id}=await ensureThread(env,role);
 const proposal=await proposeCommand(env,command);
 return record(env,id,'Assign '+command.action+' for '+projectId+(detail?' — '+detail:''),'Task saved for owner approval. Nothing has been executed.',{proposal});
}
