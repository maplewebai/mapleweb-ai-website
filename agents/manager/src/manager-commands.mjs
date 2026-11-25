// Owner-confirmed staging commands. No model-generated tool calls or publication.
import {bad,validateSynthetic,idIsSafe} from './security.mjs';
import {requireDb} from './store.mjs';
import {ROLES} from './roles.mjs';
import {assignGitHubDevelopmentTask} from './github.mjs';
const now=()=>new Date().toISOString();
const TASKS={
 'manager':{action:'coordinate-project',input:{}},
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
 const github=message.trim().match(/^github task: (.{10,500})$/i);
 if(github){
   const instruction=github[1].trim();
   if(instruction.length<10)return null;
   validateSynthetic({synthetic:true,instruction});
   return {role:'github',projectId:'MAPLEWEB',action:'create-development-task',input:{instruction}};
 }
 const m=message.trim().match(/^run (manager|website-developer|customer-care|sales|research|quality-checker|support|finance|publishing) for ([a-z0-9_-]{3,30})[.!]?$/i);
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
// Owner app must not silently fall back to a local role.
export function requireRemoteRole(env,role){
 if(!ROLES.includes(role))throw bad('Unknown agent role');
 const remote=env['ROLE_'+role.toUpperCase().replace(/-/g,'_')];
 if(!env.AGENT_EXECUTION_URLS||!remote||typeof remote.fetch!=='function'||typeof env.ROLE_INTERNAL_TOKEN!=='string'||env.ROLE_INTERNAL_TOKEN.length<32)
   throw bad('Verified remote role binding and authentication are required',503);
}
export async function listCommands(env){
 const db=enabled(env);
 const tasks=await db.prepare('SELECT id,role,action,project_id,input_json,state,job_id,result_status,created_at,updated_at FROM manager_commands ORDER BY created_at DESC LIMIT 30').all();
 const roles=await db.prepare('SELECT role,paused FROM manager_role_controls').all();
 return {tasks:(tasks.results||[]).map(({input_json,...task})=>({...task,...(task.role==='github'?{instruction:JSON.parse(input_json).instruction}:{})})),roles:['manager',...ROLES,'github'].map(role=>({role,paused:(roles.results||[]).some(r=>r.role===role&&r.paused===1)})),mode:'staging'};
}
export async function proposeCommand(env,command){
 const db=enabled(env);
 const id=crypto.randomUUID(),time=now();
 const write=await db.prepare('INSERT INTO manager_commands(id,role,action,project_id,input_json,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,command.role,command.action,command.projectId,JSON.stringify(command.input),'AWAITING_APPROVAL',time,time).run();
 if(write.meta?.changes!==1)throw bad('Task write not confirmed',503);
 const saved=await db.prepare('SELECT id,state FROM manager_commands WHERE id=?').bind(id).first();
 if(saved?.id!==id||saved.state!=='AWAITING_APPROVAL')throw bad('Task readback not confirmed',503);
 return {id,role:command.role,action:command.action,projectId:command.projectId,state:'AWAITING_APPROVAL'};
}
export async function readCommand(env,id){
 const db=enabled(env);
 const task=await db.prepare('SELECT id,role,action,project_id,state,job_id,result_status FROM manager_commands WHERE id=?').bind(id).first();
 if(!task)throw bad('Task record not found',404);
 return {task};
}
export async function setRoleControl(env,role,payload){
 const db=enabled(env);
 if(!['manager',...ROLES,'github'].includes(role)||!payload||typeof payload.paused!=='boolean'||Object.keys(payload).length!==1)throw bad('Invalid role control');
 await db.prepare('INSERT INTO manager_role_controls(role,paused,updated_at) VALUES(?,?,?) ON CONFLICT(role) DO UPDATE SET paused=excluded.paused,updated_at=excluded.updated_at').bind(role,payload.paused?1:0,now()).run();
 return {role,paused:payload.paused,scope:'New Manager job dispatch only; already-running jobs are not cancelled'};
}
export async function decideCommand(env,id,payload,{dispatch,assignGitHub=assignGitHubDevelopmentTask}={}){
 const db=enabled(env);
 if(!payload||Object.keys(payload).length!==1||!['approve','reject'].includes(payload.decision))throw bad('Explicit approve or reject required');
 const item=await db.prepare('SELECT * FROM manager_commands WHERE id=?').bind(id).first();
 if(!item)throw bad('Task record not found',404);
 if(item.state!=='AWAITING_APPROVAL')throw bad('Task already decided; no retry',409);
 const claim=async state=>db.prepare("UPDATE manager_commands SET state=?,updated_at=? WHERE id=? AND state='AWAITING_APPROVAL'").bind(state,now(),id).run();
 if(payload.decision==='reject'){
   if((await claim('REJECTED')).meta?.changes!==1)throw bad('Task already decided',409);
   return {id,state:'REJECTED'};
 }
 await requireRoleRunning(env,item.role);
 if(item.role==='github'){
   if(item.action!=='create-development-task')throw bad('Unsupported GitHub task');
   if(!env.GITHUB_TOKEN)throw bad('GitHub credential not configured in Manager',503);
   const input=validateSynthetic({synthetic:true,instruction:JSON.parse(item.input_json).instruction});
   if((await claim('RUNNING')).meta?.changes!==1)throw bad('Task already decided',409);
   let jobId=null,resultStatus='GITHUB_REQUEST_NOT_CONFIRMED',state='FAILED_OR_UNCERTAIN';
   try{
     const result=await assignGitHub(env,{id,instruction:input.instruction});
     if(result.created!==true||!Number.isSafeInteger(result.number)||result.number<1)throw Error('Issue creation not confirmed');
     jobId='github-issue-'+result.number;resultStatus='ISSUE_CREATED_NOT_EXECUTION: #'+result.number;state='COMPLETED';
   }catch{/* do not retry an ambiguous issue creation */}
   await db.prepare("UPDATE manager_commands SET state=?,job_id=?,result_status=?,updated_at=? WHERE id=? AND state='RUNNING'").bind(state,jobId,resultStatus,now(),id).run();
   return {id,state,jobId,resultStatus,websiteReleaseAuthorized:false};
 }
 if(item.role==='manager'){
   if(item.action!=='coordinate-project'||typeof dispatch!=='function')throw bad('Unsupported Manager workflow',503);
   const order=['customer-care','research','sales','website-developer','quality-checker','support','finance','publishing'];
   const expected=['DRAFT_ONLY','RESEARCH_PLAN_ONLY','OWNER_REVIEW_REQUIRED','DRAFT_READY_FOR_QA','LOCAL_QA_PASSED','DRAFT_ONLY','SETUP_NOT_CONNECTED','NOT_PUBLISHED'];
   for(const role of order){await requireRoleRunning(env,role);requireRemoteRole(env,role);}
   if((await claim('RUNNING')).meta?.changes!==1)throw bad('Task already decided',409);
   let count=0,jobId=null,state='FAILED_OR_UNCERTAIN',resultStatus='0/8 confirmed';
   const progress=async()=>db.prepare("UPDATE manager_commands SET state=?,job_id=?,result_status=?,updated_at=? WHERE id=? AND state='RUNNING'").bind(state,jobId,resultStatus,now(),id).run();
   try{
     for(let i=0;i<order.length;i++){
       const role=order[i];
       await requireRoleRunning(env,'manager');await requireRoleRunning(env,role);requireRemoteRole(env,role);
       const task=validateSynthetic({synthetic:true,projectId:item.project_id,role,action:TASKS[role].action,input:{...TASKS[role].input}});
       state='RUNNING';resultStatus=count+'/8 confirmed; dispatching '+role;await progress();
       const response=await dispatch(new Request('https://manager.internal/api/jobs',{method:'POST',headers:{authorization:'Bearer '+env.MANAGER_OWNER_TOKEN,'content-type':'application/json'},body:JSON.stringify(task)}),env);
       if(response.status!==201)throw Error('Dispatch not confirmed');
       const data=await response.json();
       if(typeof data.jobId!=='string'||data.result?.agent!==role||data.result?.status!==expected[i])throw Error('Unexpected result');
       count++;jobId=data.jobId;resultStatus=count+'/8 confirmed; '+role+': '+expected[i];await progress();
     }
     state='COMPLETED';resultStatus='8/8 staging steps confirmed; publication blocked';
   }catch{state='FAILED_OR_UNCERTAIN';resultStatus=count+'/8 confirmed; stopped at '+(order[count]||'final verification')+'; no automatic retry';}
   await progress();
   return {id,state,jobId,resultStatus,websiteReleaseAuthorized:false};
 }
 // No fallback to local deterministic role functions for chat-approved remote jobs.
 requireRemoteRole(env,item.role);
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
