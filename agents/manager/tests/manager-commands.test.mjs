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
 const listed=(await listCommands(env)).tasks[0];
 const path='/api/manager/commands/'+listed.id;
 assert.equal((await worker.fetch(req(path,'GET',null,false),env)).status,401);
 const readback=await worker.fetch(req(path,'GET'),env);
 assert.equal(readback.status,200);
 assert.equal((await readback.json()).task.id,listed.id);
 assert.equal((await worker.fetch(req('/api/manager/commands/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','GET'),env)).status,404);
 const denied=await worker.fetch(req(path+'/decision','POST',{decision:'reject'},false),env);
 assert.equal(denied.status,401);
 const rejected=await worker.fetch(req(path+'/decision','POST',{decision:'reject'}),env);
 assert.equal(rejected.status,200);
 assert.equal((await rejected.json()).state,'REJECTED');
});

test('GitHub issue task requires approval and credentials, records assignment only',async t=>{
 const env=setup(t),command=parseCommand('github task: Fix browser test configuration');
 assert.equal(command.role,'github');
 const task=await proposeCommand(env,command);
 let calls=0;
 const assignGitHub=async(e,p)=>{calls++;assert.equal(p.instruction,'Fix browser test configuration');return {created:true,number:42}};
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'},{assignGitHub}),/credential not configured/);
 assert.equal(calls,0);
 env.GITHUB_TOKEN='mock-test-only';
 await setRoleControl(env,'github',{paused:true});
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'},{assignGitHub}),/paused/);
 await setRoleControl(env,'github',{paused:false});
 const result=await decideCommand(env,task.id,{decision:'approve'},{assignGitHub});
 assert.equal(result.resultStatus,'ISSUE_CREATED_NOT_EXECUTION: #42');
 assert.equal(result.jobId,'github-issue-42');
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'},{assignGitHub}),/already decided/);
 assert.equal(calls,1);
});
test('GitHub task rejects contact information and cannot approve itself',async t=>{
 const env=setup(t);
 assert.throws(()=>parseCommand('github task: Contact test@example.com'));
 const task=await proposeCommand(env,parseCommand('github task: Check existing unit tests'));
 await decideCommand(env,task.id,{decision:'reject'});
 assert.equal((await listCommands(env)).tasks[0].state,'REJECTED');
});

test('exact build identity is attached to health and unauthorized responses',async()=>{
 const build='a'.repeat(40);
 const env={HQ_BUILD_ID:build,MANAGER_OWNER_TOKEN:'test-owner-'.repeat(5)};
 const health=await worker.fetch(new Request('https://staging.test/health'),env);
 assert.equal(health.headers.get('X-MapleWeb-Build'),build);
 assert.equal((await health.json()).buildId,build);
 const denied=await worker.fetch(new Request('https://staging.test/api/status'),env);
 assert.equal(denied.status,401);
 assert.equal(denied.headers.get('X-MapleWeb-Build'),build);
});

test('Manager coordinates eight remote steps and records verified progress only',async t=>{
 const env=setup(t);
 env.AGENT_EXECUTION_URLS='{}';env.ROLE_INTERNAL_TOKEN='x'.repeat(32);
 const order=['customer-care','research','sales','website-developer','quality-checker','support','finance','publishing'];
 const expected=['DRAFT_ONLY','RESEARCH_PLAN_ONLY','OWNER_REVIEW_REQUIRED','DRAFT_READY_FOR_QA','LOCAL_QA_PASSED','DRAFT_ONLY','SETUP_NOT_CONNECTED','NOT_PUBLISHED'];
 for(const role of order)env['ROLE_'+role.toUpperCase().replace(/-/g,'_')]={fetch(){}};
 const task=await proposeCommand(env,parseCommand('run manager for CASEABC'));
 let calls=0;
 const dispatch=async req=>{
  const body=await req.json();
  assert.equal(body.role,order[calls]);
  const record=(await listCommands(env)).tasks.find(t=>t.id===task.id);
  assert.equal(record.state,'RUNNING');
  assert.match(record.result_status,new RegExp('^'+calls+'/8 confirmed'));
  assert.equal(body.projectId,'CASEABC');
  const status=expected[calls++];
  return new Response(JSON.stringify({jobId:'job-'+calls,result:{agent:body.role,status}}),{status:201});
 };
 const result=await decideCommand(env,task.id,{decision:'approve'},{dispatch});
 assert.equal(calls,8);assert.equal(result.state,'COMPLETED');
 assert.match(result.resultStatus,/8\/8 staging steps confirmed/);
 assert.equal(result.websiteReleaseAuthorized,false);
 await assert.rejects(decideCommand(env,task.id,{decision:'approve'},{dispatch}),/already decided/);
});
test('Manager stops at failed step without retry and preserves partial progress',async t=>{
 const env=setup(t);
 env.AGENT_EXECUTION_URLS='{}';env.ROLE_INTERNAL_TOKEN='x'.repeat(32);
 for(const role of ['customer-care','research','sales','website-developer','quality-checker','support','finance','publishing'])env['ROLE_'+role.toUpperCase().replace(/-/g,'_')]={fetch(){}};
 const task=await proposeCommand(env,parseCommand('run manager for FAILCASE'));
 let calls=0;
 const result=await decideCommand(env,task.id,{decision:'approve'},{dispatch:async req=>{
  const body=await req.json();calls++;
  return calls===1?new Response(JSON.stringify({jobId:'job-first',result:{agent:body.role,status:'DRAFT_ONLY'}}),{status:201}):new Response('{}',{status:502});
 }});
 assert.equal(calls,2);assert.equal(result.state,'FAILED_OR_UNCERTAIN');
 assert.match(result.resultStatus,/1\/8 confirmed; stopped at research/);
});
