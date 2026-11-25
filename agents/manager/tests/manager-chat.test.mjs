import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {managerChat,chatHistory,parseMessage,managerModelReadiness} from '../src/manager-chat.mjs';
const TOKEN='owner-test-token-'.repeat(4);
function setup(t){
 const sql=new DatabaseSync(':memory:');
 t.after(()=>sql.close());
 for(const file of ['0001_init.sql','0004_manager_chat.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 return {sql,env:{MANAGER_OWNER_TOKEN:TOKEN,DB:{prepare(statement){let args=[];return {
   bind(...values){args=values;return this},
   all(){return {results:sql.prepare(statement).all(...args)}},
   run(){return {meta:{changes:Number(sql.prepare(statement).run(...args).changes)}}}
 }}}}};
}
function request(method,body,token=TOKEN){
 return new Request('https://staging.test/api/manager/chat',{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
test('chat rejects unauthenticated history and writes',async t=>{
 const {env,sql}=setup(t);
 for(const method of ['GET','POST']){
  const response=await worker.fetch(request(method,method==='POST'?{synthetic:true,message:'status'}:undefined,'wrong-token'),env);
  assert.equal(response.status,401);
 }
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM manager_chat').get().n,0);
});
test('chat persists real job records and does not execute a job',async t=>{
 const {env,sql}=setup(t);
 sql.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)').run('job1','CASE_001','finance','status','{}','{}','2026-11-25T12:00:00Z');
 const response=await worker.fetch(request('POST',{synthetic:true,message:'recent jobs'}),env);
 assert.equal(response.status,201);
 const turn=await response.json();
 assert.match(turn.reply,/finance\/status/);
 assert.equal(turn.jobExecuted,false);
 const history=await worker.fetch(request('GET'),env);
 assert.equal(history.status,200);
 assert.equal((await history.json()).turns.length,1);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,1);
});
test('reject customer contact, extra fields and nonsynthetic input',()=>{
 for(const input of [{synthetic:false,message:'status'},{synthetic:true,message:'hello',extra:1},{synthetic:true,message:'test@example.com'},{synthetic:true,message:' '.repeat(10)},{synthetic:true,message:'x'.repeat(801)}])assert.throws(()=>parseMessage(input));
});
test('agent report uses actual health response, not assumed active agents',async t=>{
 const {env}=setup(t);
 const turn=await managerChat(env,{synthetic:true,message:'check agents'},{health:async()=>({liveRolesVerified:1,totalRoles:8,results:[{agent:'finance',verified:true},{agent:'sales',verified:false}]})});
 assert.match(turn.reply,/1 of 8/);
 assert.match(turn.reply,/sales: not verified/);
});
test('AI opt-in and atomic daily cap, no automatic actions',async t=>{
 const {env,sql}=setup(t);let calls=0;
 env.AI={run:async()=>{calls++;return {choices:[{message:{content:'Planning only.'}}]}}};
 env.MANAGER_CHAT_MODEL='@cf/google/gemma-4-26b-a4b-it';
 env.MANAGER_CHAT_AI_ENABLED='true';
 const input={synthetic:true,message:'Build a website'};
 assert.equal((await managerChat(env,input)).kind,'unavailable');
 assert.equal(calls,0);
 env.MANAGER_CHAT_FREE_CONFIRMED='true';
 for(let i=0;i<10;i++)assert.equal((await managerChat(env,input)).kind,'ai-advice');
 assert.match((await managerChat(env,input)).reply,/allowance/);
 assert.equal(calls,10);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,0);
 assert.equal((await chatHistory(env)).turns.length,12);
});

test('paid-only and unreviewed models cannot enable chat',()=>{
 const env={AI:{run(){}},MANAGER_CHAT_AI_ENABLED:'true',MANAGER_CHAT_FREE_CONFIRMED:'true',MANAGER_CHAT_MODEL:'@cf/moonshotai/kimi-k2.7-code'};
 assert.equal(managerModelReadiness(env).enabled,false);
 env.MANAGER_CHAT_MODEL='@cf/google/gemma-4-26b-a4b-it';
 assert.equal(managerModelReadiness(env).enabled,true);
 assert.equal(managerModelReadiness(env).liveInferenceVerified,false);
});

test('retired models stay disabled',()=>{
 for(const model of ['@cf/meta/llama-3.2-3b-instruct','@cf/meta/llama-3.2-1b-instruct'])assert.equal(managerModelReadiness({AI:{run(){}},MANAGER_CHAT_MODEL:model,MANAGER_CHAT_AI_ENABLED:'true',MANAGER_CHAT_FREE_CONFIRMED:'true'}).enabled,false);
});
