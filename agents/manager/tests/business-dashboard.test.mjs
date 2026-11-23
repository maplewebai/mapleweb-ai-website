import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';

const token='r'.repeat(64);
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  for(const f of ['0001_init.sql','0002_business_cases.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
  return {sqlite,DB:{prepare(sql){
    let args=[];return {
      bind(...values){args=values;return this;},
      first(){return sqlite.prepare(sql).get(...args)||null;},
      all(){return {results:sqlite.prepare(sql).all(...args)};},
      run(){return sqlite.prepare(sql).run(...args)}
    };
  }},close(){sqlite.close();}};
}
async function query(env,path,method='GET',body,authorized=true){
  const r=await worker.fetch(new Request('https://manager-staging.test'+path,{
    method,headers:{...(authorized?{authorization:'Bearer '+token}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
test('private dashboard rejects unauthenticated access and disabled cases',async()=>{
  const f=fixture();
  const env={DB:f.DB,MANAGER_OWNER_TOKEN:token};
  try{
    assert.equal((await query(env,'/api/business/dashboard','GET',null,false)).status,401);
    assert.equal((await query(env,'/api/business/dashboard')).status,503);
    env.BUSINESS_CASES_ENABLED='true';
    const r=await query(env,'/api/business/dashboard');
    assert.equal(r.status,200);
    assert.equal(r.data.totalCases,0);
    assert.deepEqual(r.data.reviewQueue,[]);
    assert.equal(r.data.amountCollectedCAD,null);
    assert.equal(r.data.realCustomerCommunicationsConnected,false);
    assert.equal((await query(env,'/api/business/dashboard','POST',{})).status,404);
  }finally{f.close();}
});
test('owner dashboard shows verified case-stage counts, safe next actions and no fake revenue',async()=>{
  const f=fixture();
  const env={DB:f.DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'};
  try{
    for(const id of ['CRM_001','CRM_002','CRM_003','CRM_004']){
      const created=await query(env,'/api/business/cases','POST',{caseId:id});
      assert.equal(created.status,201);
    }
    const prepared=await query(env,'/api/business/cases/CRM_001/events','POST',
      {type:'review-request',expectedRevision:1});
    assert.equal(prepared.status,200);
    const quoted=await query(env,'/api/business/cases/CRM_001/events','POST',
      {type:'prepare-quote',expectedRevision:2,tier:2,fixedQuoteCAD:1200});
    assert.equal(quoted.status,200);
    assert.equal((await query(env,'/api/business/cases/CRM_002/events','POST',
      {type:'review-request',expectedRevision:1})).status,200);
    assert.equal((await query(env,'/api/business/cases/CRM_004/events','POST',
      {type:'opt-out',expectedRevision:1})).status,200);
    const r=await query(env,'/api/business/dashboard');
    assert.equal(r.status,200);
    const result=r.data;
    assert.equal(result.status,'PRIVATE_CASE_TRACKING_ONLY');
    assert.equal(result.totalCases,4);
    assert.equal(result.stages.NEW_REQUEST,1);
    assert.equal(result.stages.QUOTE_PENDING,1);
    assert.equal(result.stages.QUOTE_READY,1);
    assert.equal(result.stages.DO_NOT_CONTACT,1);
    assert.equal(result.quoteDraftsNotSent,1);
    const q=Object.fromEntries(result.reviewQueue.map(x=>[x.caseId,x]));
    assert.equal(result.reviewQueue.length,3);
    assert.equal(q.CRM_001.nextAction,'REVIEW_UNSENT_DRAFT_QUOTE');
    assert.equal(q.CRM_001.unsentQuotePrepared,true);
    assert.equal(q.CRM_002.nextAction,'PREPARE_DRAFT_QUOTE');
    assert.equal(q.CRM_003.nextAction,'REVIEW_REQUIREMENTS');
    assert.equal(q.CRM_004,undefined);
    assert.equal(result.amountCollectedCAD,null);
    assert.equal(result.realSiteGenerationConnected,false);
    assert.equal(result.customerAcceptanceConnected,false);
    assert.equal(result.realPublicationConnected,false);
    assert.equal(result.stripePaymentsConnected,false);
    assert.ok(!JSON.stringify(result).includes('1200'),
      'Quote sums must not be presented as actual revenue');
  }finally{f.close();}
});
test('importing an owner-reviewed fictional plan changes next action but not consent',async()=>{
  const f=fixture();
  const env={DB:f.DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'};
  try{
    await query(env,'/api/business/cases','POST',{caseId:'CRM_005'});
    const answers={
      businessCategory:'restaurant',
      websiteGoal:'information',
      style:'classic',
      language:'en',
      pages:['home','menu','contact'],
      features:['menu']
    };
    const imported=await query(env,'/api/business/cases/CRM_005/import-fictional-plan','POST',
      {synthetic:true,answers,expectedRevision:1,ownerReviewed:true});
    assert.equal(imported.status,200);
    const r=await query(env,'/api/business/dashboard');
    assert.equal(r.status,200);
    assert.equal(r.data.reviewQueue[0].nextAction,'REVIEW_REQUEST');
    assert.equal(r.data.reviewQueue[0].requirementsPresent,true);
    assert.equal(r.data.realCustomerCommunicationsConnected,false);
  }finally{f.close();}
});
test('corrupted case stage fails closed and never silently reports a clean dashboard',async()=>{
  const f=fixture();
  const env={DB:f.DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'};
  try{
    await query(env,'/api/business/cases','POST',{caseId:'CRM_006'});
    const state=JSON.parse(f.sqlite.prepare('SELECT state_json FROM business_cases WHERE id=?')
      .get('CRM_006').state_json);
    state.stage='UNEXPECTED';
    f.sqlite.prepare('UPDATE business_cases SET state_json=? WHERE id=?')
      .run(JSON.stringify(state),'CRM_006');
    const r=await query(env,'/api/business/dashboard');
    assert.equal(r.status,500);
    assert.equal(r.data.error,'Internal error');
  }finally{f.close();}
});
