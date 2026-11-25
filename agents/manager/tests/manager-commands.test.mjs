import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {parseCommand,proposeCommand,decideCommand,listCommands,setRoleControl,requireRoleRunning} from '../src/manager-commands.mjs';
import worker from '../src/worker.mjs';
const token='test-owner-'.repeat(5);
function setup(t){
 const sql=new DatabaseSync(':memory:');
 t.after(()=>sql.close());
 for(const name of ['0001_init.sql','0004_manager_chat.sql','0005_manager_commands.sql'])sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 return {MANAGER_COMMANDS_ENABLED:'true',MANAGER_OWNER_TOKEN:token,DB:{prepare(s){let args=[];return{
 bind(...a){args=a;return this},first(){return sql.prepare(s).get(...args)||null},
 all(){return {results:sql.prepare(s).all(...args)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...args).changes)}}}
 }}}};
}
const finance=()=>parseCommand('run finance for case001');
test('all eight roles have fixed safe actions, no arbitrary input or publish command',()=>{
 for(const role of ['website-developer','customer-care','sales','research','quality-checker','support','finance','publishing'])assert.equal(parseCommand('run '+role+' for sample001').role,role);
 assert.equal(parseCommand('publish customer site'),null);
 assert.equal(parseCommand('run finance for x'),null);
 assert.equal(parseCommand('run publishing for CASE001').action,'readiness');
});
test('owner approval and pause persist; disconnected remote cannot run',async t=>{
 const env=setup(t);
 const task=await proposeCommand(env,finance());
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'}),/remote role binding/);
 await setRoleControl(env,'finance',{paused:true});
 await assert.rejects(requireRoleRunning(env,'finance'),/paused/);
 assert.equal((await listCommands(env)).roles.find(r=>r.role==='finance').paused,true);
 await setRoleControl(env,'finance',{paused:false});
 await requireRoleRunning(env,'finance');
 await decideCommand(env,task.id,{decision:'reject'});
 assert.equal((await listCommands(env)).tasks[0].state,'REJECTED');
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'}),/already decided/);
});
test('claim once, record actual job metadata, hide raw draft content',async t=>{
 const env=setup(t);
 env.AGENT_EXECUTION_URLS='{}';env.ROLE_FINANCE={fetch(){}};
 env.ROLE_INTERNAL_TOKEN='x'.repeat(32);
 const task=await proposeCommand(env,finance());
 let calls=0;
 const dispatch=async(req)=>{
   calls++;
   const body=await req.json();
   assert.equal(body.role,'finance');assert.equal(body.synthetic,true);
   return new Response(JSON.stringify({jobId:'recorded-job',result:{agent:'finance',status:'SETUP_NOT_CONNECTED',html:'NEVER_SHOW'}}),{status:201});
 };
 const result=await decideCommand(env,task.id,{decision:'approve'},{dispatch});
 assert.equal(result.state,'COMPLETED');assert.equal(result.jobId,'recorded-job');
 assert.equal(result.websiteReleaseAuthorized,false);assert.equal(JSON.stringify(result).includes('NEVER_SHOW'),false);
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'},{dispatch}),/already decided/);
 assert.equal(calls,1);
});
test('failed or uncertain dispatch never retries automatically',async t=>{
 const env=setup(t);
 env.AGENT_EXECUTION_URLS='{}';env.ROLE_FINANCE={fetch(){}};
 env.ROLE_INTERNAL_TOKEN='x'.repeat(32);
 const task=await proposeCommand(env,finance());
 const result=await decideCommand(env,task.id,{decision:'approve'},{dispatch:async()=>{throw Error('lost response')}});
 assert.equal(result.state,'FAILED_OR_UNCERTAIN');
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'}),/already decided/);
});
test('authenticated chat command creates task; no unauthenticated access',async t=>{
 const env=setup(t);
 const req=(path,method,body,auth=true)=>new Request('https://staging.test'+path,{method,headers:{...(auth?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const msg={synthetic:true,message:'run finance for CASE001'};
 assert.equal((await worker.fetch(req('/api/manager/chat','POST',msg,false),env)).status,401);
 const res=await worker.fetch(req('/api/manager/chat','POST',msg),env);
 assert.equal(res.status,201);assert.equal((await res.json()).proposal.state,'AWAITING_APPROVAL');
 assert.equal((await worker.fetch(req('/api/manager/commands','GET',null,false),env)).status,401);
 assert.equal((await listCommands(env)).tasks.length,1);
});
