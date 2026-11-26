// Explicit owner delegation in Manager chat. Never execute model-generated instructions.
import {ROLES} from './roles.mjs';
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
import {buildAgentCommand} from './agent-workspace.mjs';
import {parseCommand,interpretOwnerTask,proposeCommand,decideCommand,requireRoleRunning,requireRemoteRole} from './manager-commands.mjs';
import {sendInternalMail} from './internal-mail.mjs';
const labels={'website-developer':'Website Developer','customer-care':'Customer Care','quality-checker':'Quality Checker','sales':'Sales','research':'Research','support':'Support','finance':'Finance','publishing':'Publishing'};
const norm=s=>s.toLowerCase().trim().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
export async function supervisionDirectory(env){
 if(env.MANAGER_COMMANDS_ENABLED!=='true'||env.MANAGER_THREADS_ENABLED!=='true')throw bad('Manager supervision unavailable',503);
 const db=requireDb(env);
 const custom=(await db.prepare('SELECT id,name,base_role FROM manager_custom_agents ORDER BY created_at DESC LIMIT 50').all()).results||[];
 const controls=(await db.prepare('SELECT role,paused FROM manager_role_controls').all()).results||[];
 const paused=id=>controls.some(r=>r.role===id&&r.paused===1);
 return [{id:'manager',name:'Manager',role:'manager',custom:false},...ROLES.map(id=>({id,name:labels[id]||id,role:id,custom:false})),...custom.map(a=>({id:a.id,name:a.name,role:a.base_role,custom:true}))].map(a=>({...a,paused:paused(a.id)||(a.custom&&paused(a.role)),execution:a.role==='chat-only'?'INTERNAL_ASSIGNMENT_ONLY':'SUPPORTED_STAGING_ACTIONS'}));
}
async function target(env,name){
 const agents=await supervisionDirectory(env),matches=agents.filter(a=>a.id===name||norm(a.name)===norm(name)||norm(a.id)===norm(name));
 if(matches.length!==1)throw bad(matches.length?'Ambiguous agent name; use its exact ID':'Agent not found; say Show all agents',404);
 return matches[0];
}
export async function supervisorInstruction(env,message,{dispatch}={}){
 const t=message.trim().replace(/[.!?]+$/,'').replace(/^(?:(?:manager[, :]+|please\s+|i want you to\s+))+/i,'');
 if(/^(?:show|list) (?:me )?(?:all )?agents$/i.test(t)){
   const agents=await supervisionDirectory(env);
   return {reply:'Manager supervision — '+(agents.length-1)+' agents plus Manager:\n'+agents.map(a=>a.name+' — '+(a.paused?'Paused':'Available')+' — '+(a.execution==='INTERNAL_ASSIGNMENT_ONLY'?'internal assignments only':a.role)).join('\n')+'\nUse Assign <agent name> for project <ID> or Pause agent <name> / Resume agent <name>. Owner commands only.'};
 }
 const control=t.match(/^(pause|resume) agent (.{1,80})$/i);
 if(control){
   const a=await target(env,control[2]),paused=control[1].toLowerCase()==='pause';
   await requireDb(env).prepare('INSERT INTO manager_role_controls(role,paused,updated_at) VALUES(?,?,?) ON CONFLICT(role) DO UPDATE SET paused=excluded.paused,updated_at=excluded.updated_at').bind(a.id,paused?1:0,new Date().toISOString()).run();
   return {reply:a.name+' '+(paused?'paused for new assignments':'resumed')+'. Already running tasks are not cancelled.'+(a.custom&&a.role!=='chat-only'?' Shared worker permissions still apply.':'')};
 }
 const assign=t.match(/^assign (?:agent )?(.{1,80}?) (?:for|to) project ([a-z0-9_-]{3,30})(?:\s*:\s*(.{1,400}))?$/i);
 const delegate=t.match(/^delegate now:\s*(.{1,800})$/i);
 if(!assign&&!delegate)return null;
 await supervisionDirectory(env);
 await requireRoleRunning(env,'manager');
 let command,customAgentId=null,name,scope='';
 if(assign){
   const a=await target(env,assign[1]),projectId=assign[2].toUpperCase(),detail=assign[3]||'';
   if(a.paused)throw bad('Agent is paused',409);
   name=a.name;
   if(a.role==='chat-only'){
     const mail=await sendInternalMail(env,{synthetic:true,sender:'manager',recipient:a.id,subject:'Assignment: '+projectId,body:detail||'Review fictional project '+projectId+' and prepare an internal response.'});
     return {reply:'Assignment delivered to '+name+' in its internal inbox. Reference: '+mail.id+'. This is a chat-only agent; execution has not started and no independent worker is connected.'};
   }
   if(a.id==='manager'){
      if(detail)throw bad('Manager coordination uses fixed staging inputs; leave detail empty');
      command=parseCommand('run manager for '+projectId);
   }else{
      command=buildAgentCommand(a.role,{synthetic:true,projectId,detail}).command;
      if(a.custom)customAgentId=a.id;
   }
 }else{
   const natural=interpretOwnerTask(delegate[1]);command=natural?.command;scope=natural?.scope||'';
   if(!command)return {reply:'No supported staging task was identified. Nothing was assigned. Try Delegate now: Create a fictional bakery website and test it.'};
   name=labels[command.role]||command.role;
 }
 if(!command||command.role==='github')throw bad('Only supported internal staging tasks can be delegated');
 validateSynthetic({synthetic:true,projectId:command.projectId,input:command.input});
 await requireRoleRunning(env,command.role);
 if(customAgentId)await requireRoleRunning(env,customAgentId);
 if(command.role!=='manager')requireRemoteRole(env,command.role);
 const proposal=await proposeCommand(env,command,{customAgentId});
 // The explicit owner chat command is the authorization. Existing decision
 // engine claims the task once, enforces safety and checks real job results.
 const result=await decideCommand(env,proposal.id,{decision:'approve'},{dispatch});
 return {reply:'Manager assigned '+name+' — '+command.action+' for '+command.projectId+'.\n'+(scope?scope+'\n':'')+'Result: '+result.state+' — '+(result.resultStatus||'No result confirmed')+'.\nTask reference: '+proposal.id+'. Publication remains blocked.',jobExecuted:result.state==='COMPLETED',taskResult:result};
}
