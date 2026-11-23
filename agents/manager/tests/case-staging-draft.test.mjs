import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {fictionalDraftFromCase} from '../src/case-staging-draft.mjs';
import {newBusinessCase,applyOwnerCaseEvent} from '../src/business-cases.mjs';

const token='p'.repeat(64);
const requirements=()=>({
  businessCategory:'professional-services',websiteGoal:'leads',style:'modern',
  language:'en',pages:['home','about','services','contact'],
  features:['gallery','accessibility']
});
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  for (const name of ['0001_init.sql','0002_business_cases.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const DB={prepare(sql){
    let args=[];
    return {bind(...values){args=values;return this;},
      first(){return sqlite.prepare(sql).get(...args)||null;},
      all(){return {results:sqlite.prepare(sql).all(...args)};},
      run(){return sqlite.prepare(sql).run(...args)}};
  }};
  return {sqlite,env:{DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'},
    close(){sqlite.close()}};
}
async function call(env,path,method='GET',body,authorized=true){
  const request=new Request('https://staging.test'+path,{
    method,
    headers:{...(authorized?{authorization:'Bearer '+token}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const response=await worker.fetch(request,env);
  return {status:response.status,data:await response.json()};
}
async function readyCase(env,id='CASE_DRAFT_01'){
  const base='/api/business/cases';
  assert.equal((await call(env,base,'POST',{caseId:id})).status,201);
  assert.equal((await call(env,base+'/'+id+'/events','POST',
    {type:'set-website-requirements',expectedRevision:1,requirements:requirements()})).status,200);
  assert.equal((await call(env,base+'/'+id+'/events','POST',
    {type:'review-request',expectedRevision:2})).status,200);
  assert.equal((await call(env,base+'/'+id+'/events','POST',
    {type:'prepare-quote',expectedRevision:3,tier:2,fixedQuoteCAD:1200})).status,200);
}
test('fictional case draft is deterministic, safe, and never a real approval',()=>{
  let state=newBusinessCase({caseId:'CASE_DRAFT_02'});
  state=applyOwnerCaseEvent(state,{type:'set-website-requirements',requirements:requirements()});
  state=applyOwnerCaseEvent(state,{type:'review-request'});
  state=applyOwnerCaseEvent(state,{type:'prepare-quote',tier:2,fixedQuoteCAD:1200});
  const first=fictionalDraftFromCase(state), second=fictionalDraftFromCase(state);
  assert.deepEqual(first,second);
  assert.match(first.html,/STAGING TEST/);
  assert.match(first.html,/Requested pages: home, about, services, contact/);
  assert.match(first.html,/noindex,nofollow/);
  assert.equal(first.kimiCalled,false);
  assert.equal(first.paymentCharged,false);
  assert.equal(first.published,false);
  assert.equal(first.customerSiteCreated,false);
  assert.throws(()=>fictionalDraftFromCase(newBusinessCase({caseId:'TEST_003'})),/quote/);
});
test('owner-reviewed case creates one private QA-pending staging project',async()=>{
  const f=fixture();
  try{
    await readyCase(f.env);
    const route='/api/business/cases/CASE_DRAFT_01/staging-draft';
    assert.equal((await call(f.env,route,'POST',{synthetic:true,expectedRevision:4},false)).status,401);
    const created=await call(f.env,route,'POST',{synthetic:true,expectedRevision:4});
    assert.equal(created.status,201);
    assert.equal(created.data.status,'STAGING_DRAFT_READY_FOR_QA');
    assert.equal(created.data.project.id,'CASE_DRAFT_01');
    assert.equal(created.data.project.version,1);
    assert.equal(created.data.project.qaPassed,false);
    assert.equal(created.data.project.ownerApprovedVersion,null);
    assert.equal(created.data.project.customerApprovedVersion,null);
    assert.equal(created.data.draft.kimiCalled,false);
    assert.equal(created.data.draft.paymentCharged,false);
    assert.equal(created.data.draft.published,false);
    assert.match(created.data.draft.html,/Fictional/);
    const project=await call(f.env,'/api/projects/CASE_DRAFT_01');
    assert.equal(project.data.project.qaPassed,false);
    assert.equal(project.data.project.publication,'DISABLED');
    const caseResult=await call(f.env,'/api/business/cases/CASE_DRAFT_01');
    assert.equal(caseResult.data.case.revision,4);
    assert.equal(caseResult.data.case.buildAuthorized,false);
    assert.equal(caseResult.data.case.clientAcceptanceVerified,false);
    const second=await call(f.env,route,'POST',{synthetic:true,expectedRevision:4});
    assert.equal(second.status,409);
    const after=await call(f.env,'/api/projects/CASE_DRAFT_01');
    assert.equal(after.data.project.version,1);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM projects').get().n,1);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM audit WHERE operation=?').get('fictional-case-draft-created').n,1);
  }finally{f.close()}
});
test('case handoff rejects forged approval, stale revisions and non-fictional input',async()=>{
  const f=fixture();
  try{
    await readyCase(f.env);
    const path='/api/business/cases/CASE_DRAFT_01/staging-draft';
    for(const body of [
      {synthetic:false,expectedRevision:4},
      {synthetic:true,expectedRevision:3},
      {synthetic:true,expectedRevision:4,email:'someone@example.com'},
      {synthetic:true,expectedRevision:4,approved:true},
      {synthetic:true,expectedRevision:'4'}
    ]){
      const result=await call(f.env,path,'POST',body);
      assert.ok([400,409].includes(result.status),JSON.stringify(result));
    }
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM projects').get().n,0);
    assert.equal((await call(f.env,'/api/business/cases/UNKNOWN/staging-draft',
      'POST',{synthetic:true,expectedRevision:1})).status,404);
  }finally{f.close()}
});
test('unquoted case cannot create a staging draft; disabled cases stay inaccessible',async()=>{
  const f=fixture();
  try{
    assert.equal((await call(f.env,'/api/business/cases','POST',{caseId:'TEST_NOQUOTE'})).status,201);
    const noQuote=await call(f.env,'/api/business/cases/TEST_NOQUOTE/staging-draft',
      'POST',{synthetic:true,expectedRevision:1});
    assert.equal(noQuote.status,400);
    f.env.BUSINESS_CASES_ENABLED='false';
    assert.equal((await call(f.env,'/api/business/cases/TEST_NOQUOTE/staging-draft',
      'POST',{synthetic:true,expectedRevision:1})).status,503);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM projects').get().n,0);
  }finally{f.close()}
});

test('staging preview supports QA without authorizing publishing',async()=>{
  const f=fixture();
  try{
    await readyCase(f.env);
    assert.equal((await call(f.env,'/api/business/cases/CASE_DRAFT_01/staging-draft',
      'POST',{synthetic:true,expectedRevision:4})).status,201);
    const qa=await call(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:'CASE_DRAFT_01',role:'quality-checker',action:'review',
      input:{html:'<script>untrusted client QA input must be ignored</script>'}
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_PASSED');
    assert.equal(qa.data.project.qaPassed,true);
    assert.equal(qa.data.project.ownerApprovedVersion,null);
    assert.equal(qa.data.project.customerApprovedVersion,null);
    const publication=await call(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:'CASE_DRAFT_01',role:'publishing',action:'readiness',input:{}
    });
    assert.equal(publication.status,201);
    assert.equal(publication.data.result.status,'NOT_PUBLISHED');
    assert.equal(publication.data.result.deploymentsPerformed,0);
    assert.equal(publication.data.result.liveUrl,null);
    assert.equal(publication.data.project.publication,'DISABLED');
  }finally{f.close()}
});
