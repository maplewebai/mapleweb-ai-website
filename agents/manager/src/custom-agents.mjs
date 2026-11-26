// Owner-created profiles use the shared model and explicitly selected existing worker.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
import {ROLES} from './roles.mjs';
import {chatHistory,saveChatTurn,managerChat,parseMessage} from './manager-chat.mjs';
import {buildAgentCommand} from './agent-workspace.mjs';
import {proposeCommand} from './manager-commands.mjs';
const actions={'website-developer':'build-draft','quality-checker':'review','customer-care':'intake','sales':'quote','research':'plan','support':'triage','finance':'status','publishing':'readiness'};
const now=()=>new Date().toISOString();
function dbFor(env){if(env.MANAGER_THREADS_ENABLED!=='true'||env.MANAGER_COMMANDS_ENABLED!=='true')throw bad('Custom agent workspaces unavailable',503);return requireDb(env);}
function view(a){return {id:a.id,name:a.name,description:a.description,baseRole:a.base_role,action:actions[a.base_role]||'chat-only',createdAt:a.created_at,custom:true};}
async function find(env,id){const a=await dbFor(env).prepare('SELECT * FROM manager_custom_agents WHERE id=?').bind(id).first();if(!a)throw bad('Custom agent not found',404);return a;}
export async function listCustomAgents(env){const r=await dbFor(env).prepare('SELECT * FROM manager_custom_agents ORDER BY created_at DESC LIMIT 50').all();return {agents:(r.results||[]).map(view),limit:50};}
export async function createCustomAgent(env,payload){
 validateSynthetic(payload);
 if(Object.keys(payload).some(k=>!['synthetic','name','description','instructions','baseRole'].includes(k))||['name','description','instructions','baseRole'].some(k=>typeof payload[k]!=='string'))throw bad('Invalid agent profile');
 const name=payload.name.trim(),description=payload.description.trim(),instructions=payload.instructions.trim(),baseRole=payload.baseRole;
 if(!/^[\p{L}\p{N}][\p{L}\p{N} .&_-]{1,49}$/u.test(name)||!description||description.length>200||instructions.length>1200||!['chat-only',...ROLES].includes(baseRole))throw bad('Enter a name (2–50 characters), responsibility (1–200), instructions (up to 1200) and supported task type');
 const db=dbFor(env),id=crypto.randomUUID(),created_at=now();
 // One atomic write reserves a unique name and caps the number of profiles.
 const r=await db.prepare('INSERT OR IGNORE INTO manager_custom_agents(id,name,description,instructions,base_role,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM manager_custom_agents)<50').bind(id,name,description,instructions,baseRole,created_at).run();
 if(r.meta?.changes!==1)throw bad('Name already used or 50 custom agents reached',409);
 return view({id,name,description,base_role:baseRole,created_at});
}
async function thread(env,a){const db=dbFor(env),title='Custom agent: '+a.name;await db.prepare('INSERT OR IGNORE INTO manager_threads(id,title,created_at) VALUES(?,?,?)').bind(a.id,title,a.created_at).run();const t=await db.prepare('SELECT title FROM manager_threads WHERE id=?').bind(a.id).first();if(t?.title!==title)throw bad('Conversation identity unavailable',503);}
export async function customWorkspace(env,id){
 const a=await find(env,id),db=dbFor(env);await thread(env,a);
 const rows=await db.prepare('SELECT c.id,c.role,c.action,c.project_id,c.state,c.job_id,c.result_status,c.created_at,c.updated_at,c.input_json FROM manager_custom_agent_tasks t JOIN manager_commands c ON c.id=t.command_id WHERE t.agent_id=? ORDER BY c.created_at DESC LIMIT 30').bind(id).all();
 const tasks=(rows.results||[]).map(({input_json,...t})=>{const i=JSON.parse(input_json);return {...t,detail:i.description||i.sector||i.category||(i.tier?'Tier '+i.tier:null)}});
 const jobRows=await db.prepare("SELECT j.id,j.project_id,j.role,j.action,j.created_at,json_extract(j.result_json,'$.status') AS result_status FROM manager_custom_agent_tasks t JOIN manager_commands c ON c.id=t.command_id JOIN jobs j ON j.id=c.job_id WHERE t.agent_id=? ORDER BY j.created_at DESC LIMIT 30").bind(id).all();
 const pause=await db.prepare('SELECT paused FROM manager_role_controls WHERE role=?').bind(a.base_role).first();
 return {...view(a),role:a.base_role,paused:pause?.paused===1,tasks,jobs:jobRows.results||[],turns:(await chatHistory(env,id)).turns,mode:'staging',historyLimit:30};
}
async function record(env,a,message,reply,extra={}){const createdAt=now(),kind='verified-record';await saveChatTurn(env,{message,reply,kind,createdAt,threadId:a.id});return {message,reply,kind,created_at:createdAt,jobExecuted:false,...extra};}
export async function customTask(env,id,payload){
 const a=await find(env,id);if(a.base_role==='chat-only')throw bad('This profile is chat-only; no executable task type selected');
 const {command,projectId,detail}=buildAgentCommand(a.base_role,payload);await thread(env,a);
 const proposal=await proposeCommand(env,command,{customAgentId:id});
 return record(env,a,'Assign '+command.action+' for '+projectId+(detail?' — '+detail:''),'Task saved for owner approval. The '+a.base_role+' worker will execute the supported staging action. Nothing has run yet.',{proposal});
}
export async function customMessage(env,id,payload){
 const a=await find(env,id);if(Object.hasOwn(payload||{},'threadId'))throw bad('Conversation is assigned by agent');
 const message=parseMessage(payload);await thread(env,a);
 if(/^(?:status|tasks|show tasks|what are you doing|what have you done|check status|recent jobs)[.!?]*$/i.test(message)){
 const ws=await customWorkspace(env,id);return record(env,a,message,a.name+' — '+(a.base_role==='chat-only'?'Chat-only profile.':'Uses '+a.base_role+' worker. New tasks '+(ws.paused?'paused':'allowed')+'.')+'\nSaved assignments:\n'+(ws.tasks.map(t=>t.project_id+' / '+t.state+(t.result_status?' — '+t.result_status:'')).join('\n')||'None')+'\nThese are saved records, not independent background activity.');
 }
 return managerChat(env,{synthetic:true,message,threadId:id},{agentRole:a.base_role,agentProfile:{name:a.name,description:a.description,instructions:a.instructions}});
}
