import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {createCustomAgent,customWorkspace,customTask,customMessage,listCustomAgents} from '../src/custom-agents.mjs';
import {decideCommand} from '../src/manager-commands.mjs';
const token='qa-owner-custom-profile-'.repeat(3);
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec('PRAGMA foreign_keys=ON');
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 return {MODE:'staging',MANAGER_OWNER_TOKEN:token,MANAGER_COMMANDS_ENABLED:'true',MANAGER_THREADS_ENABLED:'true',DB:{
  batch(stmts){sql.exec('BEGIN');try{const result=stmts.map(x=>x.run());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}},
  prepare(s){let a=[];return {bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}
 }};
}
const payload=(name,baseRole='research')=>({synthetic:true,name,description:'Research fictional businesses',instructions:'Keep responses concise.',baseRole});
test('private profile creation, unique names, separate history and task mapping',async t=>{
 const env=setup(t);
 assert.equal((await worker.fetch(new Request('https://local.test/api/custom-agents'),env)).status,401);
 const a=await createCustomAgent(env,payload('Research A')),b=await createCustomAgent(env,payload('Research B'));
 assert.notEqual(a.id,b.id);assert.equal((await listCustomAgents(env)).agents.length,2);
 await assert.rejects(createCustomAgent(env,payload('research a')),/Name already used/);
 await customMessage(env,a.id,{synthetic:true,message:'status'});
 assert.equal((await customWorkspace(env,a.id)).turns.length,1);assert.equal((await customWorkspace(env,b.id)).turns.length,0);
 const turn=await customTask(env,a.id,{synthetic:true,projectId:'FICTIONALQA',detail:'fictional bakery'});
 assert.equal(turn.proposal.state,'AWAITING_APPROVAL');assert.equal((await customWorkspace(env,b.id)).tasks.length,0);
 env.AGENT_EXECUTION_URLS='{}';env.ROLE_RESEARCH={fetch(){}};env.ROLE_INTERNAL_TOKEN='x'.repeat(32);
 await decideCommand(env,turn.proposal.id,{decision:'approve'},{dispatch:async req=>{const p=await req.json();assert.equal(p.role,'research');return new Response(JSON.stringify({jobId:'custom-job',result:{agent:'research',status:'RESEARCH_PLAN_ONLY'}}),{status:201})}});
 assert.equal((await customWorkspace(env,a.id)).tasks[0].state,'COMPLETED');
 const chat=await customMessage(env,a.id,{synthetic:true,message:'Research a fictional bakery'});
 assert.equal(chat.proposal.role,'research');assert.equal((await customWorkspace(env,a.id)).tasks.length,2);
});
test('chat-only profiles cannot execute tasks; no external account creation',async t=>{
 const env=setup(t),a=await createCustomAgent(env,payload('Planning A','chat-only'));
 await assert.rejects(customTask(env,a.id,{synthetic:true,projectId:'CASE123',detail:''}),/chat-only/);
 const turn=await customMessage(env,a.id,{synthetic:true,message:'Research a fictional bakery'});
 assert.equal(turn.proposal,undefined);assert.match(turn.reply,/does not have/);
 await assert.rejects(createCustomAgent(env,payload('Invalid role','unrestricted')),/supported task type/);
});

test('learning persists across chats, stays isolated, informs advice and never creates accounts',async t=>{
 const env=setup(t),a=await createCustomAgent(env,payload('Learning A','chat-only')),b=await createCustomAgent(env,payload('Learning B','chat-only'));
 const say=(id,message)=>customMessage(env,id,{synthetic:true,message});
 const saved=await say(a.id,'Remember: Prefer concise fictional design reports.');
 assert.match(saved.reply,/Lesson saved/);assert.equal(saved.jobExecuted,false);
 assert.match((await say(a.id,'Show learning')).reply,/Prefer concise fictional design reports/);
 assert.match((await say(b.id,'Show learning')).reply,/No saved lessons/);
 const {learningNotes,learningInstruction}=await import('../src/agent-learning.mjs');
 const notes=await learningNotes(env,'custom:'+a.id);assert.equal(notes.length,1);
 let prompts=[];
 env.MANAGER_CHAT_MODEL='@cf/google/gemma-4-26b-a4b-it';env.MANAGER_CHAT_AI_ENABLED='true';env.MANAGER_CHAT_FREE_CONFIRMED='true';
 env.AI={run:async(model,body)=>{prompts.push(body.messages);return {response:'A concise plan.'}}};
 await say(a.id,'Suggest a fictional business layout');
 await say(b.id,'Suggest a fictional business layout');
 assert.match(JSON.stringify(prompts[0]),/Prefer concise fictional design reports/);
 assert.doesNotMatch(JSON.stringify(prompts[1]),/Prefer concise fictional design reports/);
 await learningInstruction(env,'custom:'+a.id,'forget '+notes[0].id);
 assert.equal((await learningNotes(env,'custom:'+a.id)).length,0);
 const account=await say(a.id,'Create an account for fictional research');
 assert.match(account.reply,/External account creation is not connected/);assert.equal(account.jobExecuted,false);assert.equal(prompts.length,2);
 assert.equal((await customWorkspace(env,a.id)).tasks.length,0);
});
