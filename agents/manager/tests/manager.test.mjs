import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {ROLES,PRICES_CAD,runRole} from '../src/roles.mjs';
import {upsertDevFile,diagnoseGitHub,createManagerIssue} from '../src/github.mjs';
import {inspectCloudflare,checkRoleHealth} from '../src/cloudflare.mjs';
const TOKEN='q'.repeat(64);
const schema=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8');
function DB(){const raw=new DatabaseSync(':memory:');raw.exec(schema);return {prepare(sql){let args=[];return {bind(...v){args=v;return this;},first(){return raw.prepare(sql).get(...args)||null;},run(){return raw.prepare(sql).run(...args);},all(){return {results:raw.prepare(sql).all(...args)};}}},close(){raw.close();}};}
function env(){return {MANAGER_OWNER_TOKEN:TOKEN,DB:DB()};}
const query=(env,url,method='GET',body,auth=true)=>worker.fetch(new Request(`https://example.workers.dev${url}`,{
  method,headers:{...(auth?{authorization:`Bearer ${TOKEN}`}:{}) ,...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})}),env);
const obj=r=>r.json();
const payload=(role,action,input={},projectId='FAKE001')=>({synthetic:true,projectId,role,action,input});

test('Eight distinct roles and six exact approved CAD price ranges',()=>{
  assert.equal(ROLES.length,8);assert.equal(new Set(ROLES).size,8);
  assert.deepEqual(PRICES_CAD,[[500,800],[900,1500],[1500,2200],[2300,3000],[3000,4500],[4500,7000]]);
});
test('Health does not claim eight live agents',async()=>{const r=await query({},'/health','GET',undefined,false);const j=await obj(r);assert.equal(r.status,200);assert.equal(j.roleWorkersVerified,0);assert.equal(j.managerReady,false);assert.equal(j.publishEnabled,undefined);});
test('Manager API requires configured owner token',async()=>{const r=await query({},'/api/status');assert.equal(r.status,503);});
test('Manager API rejects missing auth',async()=>{const e=env();const r=await query(e,'/api/status','GET',undefined,false);assert.equal(r.status,401);e.DB.close();});
test('Manager API rejects invalid bearer',async()=>{const e=env();const r=await worker.fetch(new Request('https://x.workers.dev/api/status',{headers:{authorization:'Bearer wrong'}}),e);assert.equal(r.status,401);e.DB.close();});
test('Status explains remote roles are not verified',async()=>{const e=env();const r=await query(e,'/api/status');const j=await obj(r);assert.equal(j.roles.length,8);assert.ok(j.roles.every(x=>x.remoteVerified===false));assert.equal(j.publishEnabled,false);e.DB.close();});
test('Owner can list defined roles',async()=>{const e=env();const r=await query(e,'/api/roles');assert.equal((await obj(r)).roles.length,8);e.DB.close();});
test('Build draft is escaped, staging-labelled, and saved in D1',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe <script>',description:'A & B'}));const j=await obj(r);assert.equal(r.status,201);assert.equal(j.result.version,1);assert.ok(j.result.html.includes('Cafe &lt;script&gt;'));assert.ok(j.result.html.includes('STAGING TEST'));assert.equal(j.project.qaPassed,false);assert.equal(j.result.externallyHosted,false);e.DB.close();});
test('QA reads saved HTML and passes, not caller supplied HTML',async()=>{const e=env();await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Demo Cafe',description:'Synthetic sample'}));const r=await query(e,'/api/jobs','POST',payload('quality-checker','review',{html:'evil'}));const j=await obj(r);assert.equal(j.result.status,'LOCAL_QA_PASSED');assert.equal(j.project.qaPassed,true);e.DB.close();});
test('QA requires existing draft',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('quality-checker','review'));assert.equal(r.status,400);e.DB.close();});
test('Simulated approvals require current QA and exact version',async()=>{const e=env();await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe',description:'Description'}));const blocked=await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role:'owner',version:1});assert.equal(blocked.status,400);await query(e,'/api/jobs','POST',payload('quality-checker','review'));const wrong=await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role:'owner',version:2});assert.equal(wrong.status,400);const good=await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role:'owner',version:1});assert.equal(good.status,200);assert.equal((await obj(good)).publishAuthorized,false);e.DB.close();});
test('Revisions invalidate QA and both approvals',async()=>{const e=env();await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe',description:'Description'}));await query(e,'/api/jobs','POST',payload('quality-checker','review'));for(const role of ['owner','customer'])await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role,version:1});const change=await query(e,'/api/jobs','POST',payload('website-developer','request-revision',{note:'Another font'}));const j=await obj(change);assert.equal(j.project.qaPassed,false);assert.equal(j.project.revisionOpen,true);assert.equal(j.project.customerApprovedVersion,null);assert.equal(j.project.ownerApprovedVersion,null);const blocked=await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role:'owner',version:1});assert.equal(blocked.status,400);e.DB.close();});
test('Subsequent build increments version and approvals stay invalid',async()=>{const e=env();await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe',description:'Description'}));await query(e,'/api/jobs','POST',payload('website-developer','request-revision',{note:'Changes'}));const r=await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe v2',description:'New'}));const j=await obj(r);assert.equal(j.result.version,2);assert.equal(j.project.customerApprovedVersion,null);e.DB.close();});
test('Publishing refuses even after simulated QA and both approvals',async()=>{const e=env();await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Cafe',description:'Description'}));await query(e,'/api/jobs','POST',payload('quality-checker','review'));for(const role of ['owner','customer'])await query(e,'/api/projects/FAKE001/simulate-approval','POST',{synthetic:true,role,version:1});const r=await query(e,'/api/jobs','POST',payload('publishing','readiness'));const j=await obj(r);assert.equal(j.result.status,'NOT_PUBLISHED');assert.equal(j.result.deploymentsPerformed,0);assert.equal(j.result.liveUrl,null);e.DB.close();});
test('Sales obeys exact approved tier range and no charge',()=>{const r=runRole('sales','quote',{tier:6});assert.deepEqual(r.priceRangeCAD,[4500,7000]);assert.equal(r.paymentCharged,false);});
test('Finance does not claim real payments or bank setup',()=>{const j=runRole('finance','status');assert.equal(j.stripeLive,false);assert.equal(j.paymentsCharged,0);});
test('Customer care does not contact customers',()=>assert.equal(runRole('customer-care','intake').sent,false));
test('Support escalates security issues',()=>assert.equal(runRole('support','triage',{category:'security'}).status,'OWNER_ESCALATION_REQUIRED'));
test('Research does not scrape data or contact anyone',()=>assert.equal(runRole('research','plan').scrapedContacts,0));
test('Invalid action and invalid tier are rejected',()=>{assert.throws(()=>runRole('sales','charge'),/Unsupported/);assert.throws(()=>runRole('sales','quote',{tier:7}),/tier/);});
test('Payload containing real email is rejected',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'test@example.com',description:'Demo'}));assert.equal(r.status,400);e.DB.close();});
test('Payload containing a phone is rejected',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Demo',description:'Call 416-555-1234'}));assert.equal(r.status,400);e.DB.close();});
test('Credential fields are rejected recursively',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('website-developer','build-draft',{business:'Demo',description:'Demo',deep:{token:'abc'}}));assert.equal(r.status,400);e.DB.close();});
test('Request without synthetic:true is rejected',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',{projectId:'FAKE001',role:'sales',action:'quote',input:{tier:1}});assert.equal(r.status,400);e.DB.close();});
test('Too-large body rejected without relying on Content-Length',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('research','plan',{sector:'x'.repeat(16000)}));assert.equal(r.status,413);e.DB.close();});
test('Malformed JSON and unsupported media type rejected',async()=>{const e=env();const base='https://example.workers.dev/api/jobs';let r=await worker.fetch(new Request(base,{method:'POST',headers:{authorization:`Bearer ${TOKEN}`,'content-type':'application/json'},body:'{'}),e);assert.equal(r.status,400);r=await worker.fetch(new Request(base,{method:'POST',headers:{authorization:`Bearer ${TOKEN}`,'content-type':'text/plain'},body:'hi'}),e);assert.equal(r.status,415);e.DB.close();});
test('Project IDs cannot contain slash/path traversal',async()=>{const e=env();const r=await query(e,'/api/jobs','POST',payload('sales','quote',{tier:1},'../../MAIN'));assert.equal(r.status,400);e.DB.close();});
test('Can retrieve job summary and audit through D1',async()=>{const e=env();const post=await query(e,'/api/jobs','POST',payload('sales','quote',{tier:1}));const j=await obj(post);const found=await query(e,`/api/jobs/${j.jobId}`);assert.equal((await obj(found)).result.agent,'sales');const all=await query(e,'/api/jobs');assert.equal((await obj(all)).jobs.length,1);e.DB.close();});
test('GitHub status is clear when token missing',async()=>{assert.equal((await diagnoseGitHub({})).writeVerified,false);assert.equal((await diagnoseGitHub({})).configured,false);});
test('Manager GitHub writes cannot touch main or arbitrary paths',async()=>{
  await assert.rejects(upsertDevFile({}, {path:'index.html',content:'x',message:'test dev write'}),/Only safe/);
  await assert.rejects(upsertDevFile({}, {path:'.github/workflows/danger.yml',content:'x',message:'test dev write'}),/Only safe/);
  await assert.rejects(upsertDevFile({}, {path:'agents/manager/../../index.html',content:'x',message:'test dev write'}),/Only safe/);
});
test('GitHub dev-only commit uses exact branch, never main',async()=>{
  const original=globalThis.fetch;const called=[];
  globalThis.fetch=async(url,init)=>{called.push({url,init});return new Response(init.method==='PUT'?JSON.stringify({commit:{sha:'deadbeef'}}):JSON.stringify({message:'Not Found'}),{status:init.method==='PUT'?201:404,headers:{'content-type':'application/json'}})};
  try{const r=await upsertDevFile({GITHUB_TOKEN:'mock'},{path:'agents/manager/README.md',content:'Demo staging',message:'Update staging Manager instructions'});assert.equal(r.mainChanged,false);const body=JSON.parse(called[1].init.body);assert.equal(body.branch,'mapleweb-ai-agents');assert.equal(called.some(x=>x.url.includes('/contents/index.html')),false);}
  finally{globalThis.fetch=original;}
});
test('GitHub issue task requires prefixed name and no missing token',async()=>{
  await assert.rejects(createManagerIssue({}, {title:'Other job',body:'This body is long enough to be tested.'}),/title/);
  await assert.rejects(createManagerIssue({}, {title:'MapleWeb Manager: Activate GitHub',body:'This body is long enough to be tested.'}),/GITHUB_ACCESS_NOT_CONFIGURED/);
});
test('Cloudflare inspector requires verified exact account',async()=>{
  const r=await inspectCloudflare({CLOUDFLARE_READ_TOKEN:'x',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),EXPECTED_CLOUDFLARE_ACCOUNT_ID:'b'.repeat(32)});
  assert.equal(r.accountVerified,false);
});
test('Role health does not invent live agent status',async()=>{
  const r=await checkRoleHealth({});assert.equal(r.liveRolesVerified,0);assert.equal(r.results.length,8);
});
test('Unconfigured GitHub write endpoint returns failure instead of pretending success',async()=>{
  const e=env();const r=await query(e,'/api/github/upload-dev-file','POST',{synthetic:true,confirmDevelopmentBranchOnly:true,
    path:'agents/manager/README.md',content:'test',message:'Change staging README'});
  assert.equal(r.status,503);e.DB.close();
});
test('GitHub write endpoint requires explicit branch-only confirmation',async()=>{
  const e=env();const r=await query(e,'/api/github/upload-dev-file','POST',{synthetic:true,
    path:'agents/manager/README.md',content:'test',message:'Change staging README'});
  assert.equal(r.status,400);e.DB.close();
});
test('No public access to manager endpoint',async()=>{const e=env();const r=await query(e,'/api/jobs','GET',undefined,false);assert.equal(r.status,401);e.DB.close();});
test('No deploy or payments route exists',async()=>{const e=env();for(const x of ['/api/publish','/api/stripe/charge','/api/deploy'])assert.equal((await query(e,x,'POST',{synthetic:true})).status,404);e.DB.close();});
