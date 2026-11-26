import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {supervisorInstruction,supervisionDirectory} from '../src/manager-supervision.mjs';
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());const dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 return {sql,env:{MODE:'staging',MANAGER_COMMANDS_ENABLED:'true',MANAGER_THREADS_ENABLED:'true',MANAGER_OWNER_TOKEN:'owner-'.repeat(8),ROLE_INTERNAL_TOKEN:'role-'.repeat(8),AGENT_EXECUTION_URLS:'{}',ROLE_RESEARCH:{fetch(){}},DB:{prepare(s){let a=[];return {bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}},async batch(stmts){return Promise.all(stmts.map(s=>s.run()))}}}};
}
test('Manager explicit direct assignments verify remote result and respect pause',async t=>{
 const {env,sql}=setup(t);let calls=0;
 const dispatch=async req=>{calls++;const task=await req.json();assert.equal(task.role,'research');assert.equal(task.input.sector,'fictional bakery');return Response.json({jobId:'test-job',result:{agent:'research',status:'RESEARCH_PLAN_ONLY'}},{status:201});};
 assert.equal((await supervisionDirectory(env)).length,9);
 assert.equal(await supervisorInstruction(env,'Do not assign research for project CASE001',{dispatch}),null);
 await supervisorInstruction(env,'Pause agent Research');
 await assert.rejects(supervisorInstruction(env,'Assign Research for project CASE001: fictional bakery',{dispatch}),/paused/);
 assert.equal(calls,0);
 await supervisorInstruction(env,'Resume agent Research');
 const result=await supervisorInstruction(env,'Assign Research for project CASE001: fictional bakery',{dispatch});
 assert.equal(result.taskResult.state,'COMPLETED');assert.equal(calls,1);
 const id='abcdefab-abcd-4abc-8abc-abcdefabcdef';
 sql.prepare('INSERT INTO manager_custom_agents(id,name,description,instructions,base_role,created_at) VALUES(?,?,?,?,?,?)').run(id,'Custom Research','Fictional research','','research',new Date().toISOString());
 await supervisorInstruction(env,'Pause agent Custom Research');
 await assert.rejects(supervisorInstruction(env,'Assign Custom Research for project CASE002: fictional bakery',{dispatch}),/paused/);
 await supervisorInstruction(env,'Resume agent Custom Research');
 const custom=await supervisorInstruction(env,'Assign Custom Research for project CASE002: fictional bakery',{dispatch});
 assert.equal(custom.taskResult.state,'COMPLETED');
 assert.equal(sql.prepare('SELECT agent_id FROM manager_custom_agent_tasks WHERE command_id=?').get(custom.taskResult.id).agent_id,id);
 assert.equal(calls,2);
 const chatId='fedcbafe-dcba-4abc-8abc-fedcbafedcba';
 sql.prepare('INSERT INTO manager_custom_agents(id,name,description,instructions,base_role,created_at) VALUES(?,?,?,?,?,?)').run(chatId,'Chat Helper','Fictional helper','','chat-only',new Date().toISOString());
 const chat=await supervisorInstruction(env,'Assign Chat Helper for project CASE003: Review the draft.',{dispatch});
 assert.match(chat.reply,/execution has not started/);
 assert.equal(sql.prepare('SELECT recipient FROM internal_mail').get().recipient,chatId);
 assert.equal(calls,2);
 assert.match((await supervisorInstruction(env,'Show all agents')).reply,/Chat Helper/);
});
