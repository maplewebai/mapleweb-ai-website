// Private, owner-taught working knowledge. Cannot change execution permissions.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
export async function learningNotes(env,scope,limit=20){
 const r=await requireDb(env).prepare('SELECT id,note FROM agent_learning WHERE scope=? ORDER BY created_at DESC,id DESC LIMIT ?').bind(scope,limit).all();
 return r.results||[];
}
// Retrieve bounded verified past outcomes. No model-generated facts or permissions.
export async function learningWorkHistory(env,scope){
 if(env.MANAGER_COMMANDS_ENABLED!=='true')return [];
 const db=requireDb(env);
 const fields='c.role,c.action,c.state,c.result_status,c.updated_at';
 let statement;
 if(scope==='manager')statement=db.prepare('SELECT '+fields+' FROM manager_commands c WHERE c.state IN (\'COMPLETED\',\'FAILED_OR_UNCERTAIN\') ORDER BY c.updated_at DESC LIMIT 8');
 else if(scope.startsWith('role:'))statement=db.prepare('SELECT '+fields+' FROM manager_commands c WHERE c.role=? AND c.state IN (\'COMPLETED\',\'FAILED_OR_UNCERTAIN\') ORDER BY c.updated_at DESC LIMIT 8').bind(scope.slice(5));
 else if(scope.startsWith('custom:'))statement=db.prepare('SELECT '+fields+' FROM manager_custom_agent_tasks t JOIN manager_commands c ON c.id=t.command_id WHERE t.agent_id=? AND c.state IN (\'COMPLETED\',\'FAILED_OR_UNCERTAIN\') ORDER BY c.updated_at DESC LIMIT 8').bind(scope.slice(7));
 else return [];
 const r=await statement.all();return (r.results||[]).map(x=>({role:x.role,action:x.action,state:x.state,result:String(x.result_status||'No recorded outcome').slice(0,220),date:x.updated_at}));
}
export async function learningInstruction(env,scope,message){
 const review=/^(?:review (?:your )?(?:past work|work history)|learn from (?:your )?(?:past work|tasks|mistakes))[?.!]*$/i.test(message);
 if(review){const history=await learningWorkHistory(env,scope);return {reply:history.length?'Recorded work outcomes for learning (not model retraining):\n'+history.map(h=>h.role+' / '+h.action+' — '+h.state+' — '+h.result).join('\n')+'\nUse failures or uncertain outcomes to identify what needs verification; never assume successful delivery. You can teach me a specific improvement using Remember:.':'No completed or uncertain task records are available for this agent yet.',recordMessage:'Review past work'};}
 const add=message.match(/^(?:remember|learn|teach(?: you)?):\s*([\s\S]+)$/i);
 const list=/^(?:show (?:your )?(?:learning|memory|learned instructions)|what have you learned)[?.!]*$/i.test(message);
 const forget=message.match(/^forget (?:lesson )?([0-9a-f-]{36})[.!]?$/i);
 const account=/^(?:(?:please|can you|could you|i want you to|i need you to)\s+)*(?:create|make|open|register|sign up for|set up)\b.{0,200}\b(?:account|accounts|subscription)\b/i.test(message);
 if(!add&&!list&&!forget&&!account)return null;
 if(account)return {reply:'I understand you want an account created. External account creation is not connected to this app. Tell me the service and purpose so I can help prepare a setup plan. No account, charge or external action was made. Any future signup requires the owner’s permission and the service’s identity verification.'};
 const db=requireDb(env);
 if(add){
   const note=add[1].trim();
   if(!note||note.length>600)throw bad('Use a lesson of 1–600 characters');
   validateSynthetic({synthetic:true,note});
   if(/\b(?:password|api key|access token|secret|verification code|credit card|bank account)\b/i.test(note))throw bad('Never save credentials or payment details as learning notes');
   const id=crypto.randomUUID();
   const write=await db.prepare('INSERT OR IGNORE INTO agent_learning(id,scope,note,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM agent_learning WHERE scope=?)<50').bind(id,scope,note,new Date().toISOString(),scope).run();
   if(write.meta?.changes!==1)return {reply:'Lesson already saved or the 50-lesson limit is reached. Use “show learning” to review existing lessons.',recordMessage:'Save a learning note'};
   return {reply:'Lesson saved for this agent. I can refer to it in future AI conversations. This does not retrain the model or change task permissions. Lesson ID: '+id,recordMessage:'Save a learning note'};
 }
 if(forget){
   const write=await db.prepare('DELETE FROM agent_learning WHERE scope=? AND id=?').bind(scope,forget[1]).run();
   return {reply:write.meta?.changes===1?'Lesson removed from active learning notes. Any earlier chat copies may remain.':'No matching lesson in this agent’s learning notes.',recordMessage:'Remove a learning note'};
 }
 const notes=await learningNotes(env,scope,50);
 return {reply:notes.length?'Saved owner-taught lessons:\n'+notes.map(n=>n.id+' — '+n.note).join('\n'):'No saved lessons yet. Say “Remember: [your instruction]” to teach this agent.',recordMessage:'Show learning notes'};
}
