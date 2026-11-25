// Owner-confirmed staging commands. No model-generated tool calls or publication.
import {bad,validateSynthetic,idIsSafe} from './security.mjs';
import {requireDb} from './store.mjs';
import {ROLES} from './roles.mjs';
const now=()=>new Date().toISOString();
const TASKS={
 'website-developer':{action:'build-draft',input:{business:'Fictional Maple sample',description:'Private staging website draft for independent QA.'}},
 'customer-care':{action:'intake',input:{}},
 'sales':{action:'quote',input:{tier:1}},
 'research':{action:'plan',input:{sector:'fictional local business'}},
 'quality-checker':{action:'review',input:{}},
 'support':{action:'triage',input:{category:'general'}},
 'finance':{action:'status',input:{}},
 'publishing':{action:'readiness',input:{}}
};
export function parseCommand(message){
 const m=message.trim().match(/^run (website-developer|customer-care|sales|research|quality-checker|support|finance|publishing) for ([a-z0-9_-]{3,30})[.!]?$/i);
 if(!m)return null;
 const role=m[1].toLowerCase(),projectId=m[2].toUpperCase();
 if(!idIsSafe(projectId))throw bad('Invalid fictional project ID');
 return {role,projectId,action:TASKS[role].action,input:{...TASKS[role].input}};
}
function enabled(env){if(env.MANAGER_COMMANDS_ENABLED!=='true')throw bad('Owner task controls are not configured',503);return requireDb(env);}
export async function requireRoleRunning(env,role){
 if(env.MANAGER_COMMANDS_ENABLED!=='true')return;
 const db=requireDb(env);
 const record=await db.prepare('SELECT paused FROM manager_role_controls WHERE role=?').bind(role).first();
 if(record?.paused===1)throw bad('Role is paused by owner',409);
}
export async function listCommands(env){
 const db=enabled(env);
 const tasks=await db.prepare('SELECT id,role,action,project_id,state,job_id,result_status,created_at,updated_at FROM manager_commands ORDER BY created_at DESC LIMIT 30').all();
 const roles=await db.prepare('SELECT role,paused FROM manager_role_controls').all();
 return {tasks:tasks.results||[],roles:ROLES.map(role=>({role,paused:(roles.results||[]).some(r=>r.role===role&&r.paused===1)})),mode:'staging'};
}
export async function proposeCommand(env,command){
 const db=enabled(env);
 const id=crypto.randomUUID(),time=now();
 await db.prepare('INSERT INTO manager_commands(id,role,action,project_id,input_json,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,command.role,command.action,command.projectId,JSON.stringify(command.input),'AWAITING_APPROVAL',time,time).run();
 return {id,role:command.role,action:command.action,projectId:command.projectId,state:'AWAITING_APPROVAL'};
}
export async function setRoleControl(env,role,payload){
 const db=enabled(env);
 if(!ROLES.includes(role)||!payload||typeof payload.paused!=='boolean'||Object.keys(payload).length!==1)throw bad('Invalid role control');
 await db.prepare('INSERT INTO manager_role_controls(role,paused,updated_at) VALUES(?,?,?) ON CONFLICT(role) DO UPDATE SET paused=excluded.paused,updated_at=excluded.updated_at').bind(role,payload.paused?1:0,now()).run();
 return {role,paused:payload.paused,scope:'New Manager job dispatch only; already-running jobs are not cancelled'};
}
export async function decideCommand(env,id,payload,{dispatch}={}){
 const db=enabled(env);
 if(!payload||Object.keys(payload).length!==1||!['approve','reject'].includes(payload.decision))throw bad('Explicit approve or reject required');
 const item=await db.prepare('SELECT * FROM manager_commands WHERE id=?').bind(id).first();
 if(!item)throw bad('Task not found',404);
 if(item.state!=='AWAITING_APPROVAL')throw bad('Task already decided; no retry',409);
 const claim=async state=>db.prepare("UPDATE manager_commands SET state=?,updated_at=? WHERE id=? AND state='AWAITING_APPROVAL'").bind(state,now(),id).run();
 if(payload.decision==='reject'){
   if((await claim('REJECTED')).meta?.changes!==1)throw bad('Task already decided',409);
   return {id,state:'REJECTED'};
 }
 await requireRoleRunning(env,item.role);
 // No fallback to local deterministic role functions for chat-approved remote jobs.
 const remote=env['ROLE_'+item.role.toUpperCase().replace(/-/g,'_')];
 if(!env.AGENT_EXECUTION_URLS||!remote||typeof remote.fetch!=='function'||typeof env.ROLE_INTERNAL_TOKEN!=='string'||env.ROLE_INTERNAL_TOKEN.length<32)
   throw bad('Verified remote role binding and authentication are required',503);
 if(typeof dispatch!=='function')throw bad('Manager dispatch unavailable',503);
 const task=validateSynthetic({synthetic:true,projectId:item.project_id,role:item.role,action:item.action,input:JSON.parse(item.input_json)});
 if((await claim('RUNNING')).meta?.changes!==1)throw bad('Task already decided',409);
 let jobId=null,resultStatus=null,state='FAILED_OR_UNCERTAIN';
 try{
   const response=await dispatch(new Request('https://manager.internal/api/jobs',{method:'POST',headers:{authorization:'Bearer '+env.MANAGER_OWNER_TOKEN,'content-type':'application/json'},body:JSON.stringify(task)}),env);
   if(response.status!==201)throw Error('Dispatch not confirmed');
   const data=await response.json();
   if(typeof data.jobId!=='string'||data.result?.agent!==item.role||typeof data.result?.status!=='string')throw Error('Invalid job response');
   jobId=data.jobId;resultStatus=data.result.status.slice(0,100);state='COMPLETED';
 }catch{/* no automatic retry; the remote may have accepted the task */}
 await db.prepare('UPDATE manager_commands SET state=?,job_id=?,result_status=?,updated_at=? WHERE id=? AND state=\'RUNNING\'').bind(state,jobId,resultStatus,now(),id).run();
 // Only status metadata: never return generated HTML, assets or preview links.
 return {id,state,jobId,resultStatus,websiteReleaseAuthorized:false};
}
