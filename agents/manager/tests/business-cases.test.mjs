import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {newBusinessCase,applyOwnerCaseEvent,caseCapabilities} from '../src/business-cases.mjs';

const token='p'.repeat(64);
const setup=()=>{
  const sqlite=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_business_cases.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return {DB:{prepare(sql){
    let args=[];
    return {bind(...value){args=value;return this;},
      first(){return sqlite.prepare(sql).get(...args)||null;},
      all(){return {results:sqlite.prepare(sql).all(...args)};},
      run(){return sqlite.prepare(sql).run(...args)}};
  }},close(){sqlite.close()}};
};
const query=async(env,path,method='GET',body,auth=true)=>{
  const res=await worker.fetch(new Request('https://staging.test'+path,{
    method,headers:{...(auth?{authorization:'Bearer '+token}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {code:res.status,value:await res.json()};
};
test('real case domain validates approved CAD quotes without pretending to send proposals',()=>{
  let c=newBusinessCase({caseId:'CASE_001'});
  assert.equal(c.stage,'NEW_REQUEST');
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'prepare-quote',tier:1,fixedQuoteCAD:600}),/review/);
  c=applyOwnerCaseEvent(c,{type:'review-request'});
  c=applyOwnerCaseEvent(c,{type:'prepare-quote',tier:2,fixedQuoteCAD:1200});
  assert.equal(c.quote.status,'DRAFT_NOT_SENT');
  assert.equal(c.quote.currency,'CAD');
  assert.equal(caseCapabilities(c).publicationAuthorized,false);
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'charge'}),/External integration/);
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'publish'}),/External integration/);
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'send-proposal'}),/External integration/);
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'prepare-quote',tier:6,fixedQuoteCAD:200}),/range/);
});
test('case domain rejects contact information and unexpected metadata',()=>{
  assert.throws(()=>newBusinessCase({caseId:'CASE_002',email:'sample@example.com'}),/Unexpected/);
  assert.throws(()=>newBusinessCase({caseId:'joe@example.com'}),/contact details/);
  assert.throws(()=>newBusinessCase({caseId:'bad id'}),/safe case ID/);
});
test('opt-out closes a business case and stops further changes',()=>{
  let c=newBusinessCase({caseId:'CASE_003'});
  c=applyOwnerCaseEvent(c,{type:'opt-out'});
  assert.equal(c.stage,'DO_NOT_CONTACT');
  assert.throws(()=>applyOwnerCaseEvent(c,{type:'review-request'}),/Closed/);
});
test('real database-backed case route fails closed when feature is disabled',async()=>{
  const db=setup(),env={DB:db.DB,MANAGER_OWNER_TOKEN:token};
  try{
    const result=await query(env,'/api/business/cases','POST',{caseId:'CASE_004'});
    assert.equal(result.code,503);
    assert.equal((await query(env,'/api/business/cases')).code,503);
  }finally{db.close()}
});
test('owner-authenticated case routes persist metadata and enforce revision guards',async()=>{
  const db=setup(),env={DB:db.DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'};
  try{
    assert.equal((await query(env,'/api/business/cases','POST',{caseId:'CASE_005'},false)).code,401);
    assert.equal((await query(env,'/api/business/cases','POST',{caseId:'CASE_005',email:'somebody@example.com'})).code,400);
    const created=await query(env,'/api/business/cases','POST',{caseId:'CASE_005'});
    assert.equal(created.code,201);
    assert.equal(created.value.case.stage,'NEW_REQUEST');
    assert.equal((await query(env,'/api/business/cases','POST',{caseId:'CASE_005'})).code,409);
    const reviewed=await query(env,'/api/business/cases/CASE_005/events','POST',{type:'review-request',expectedRevision:1});
    assert.equal(reviewed.code,200);
    const stale=await query(env,'/api/business/cases/CASE_005/events','POST',{type:'prepare-quote',tier:1,fixedQuoteCAD:700,expectedRevision:1});
    assert.equal(stale.code,409);
    const quoted=await query(env,'/api/business/cases/CASE_005/events','POST',{type:'prepare-quote',tier:1,fixedQuoteCAD:700,expectedRevision:2});
    assert.equal(quoted.code,200);
    assert.equal(quoted.value.case.quote.fixedQuoteCAD,700);
    assert.equal((await query(env,'/api/business/cases/CASE_005/events','POST',{type:'publish',expectedRevision:3})).code,403);
    assert.equal((await query(env,'/api/business/cases/CASE_005')).value.case.stage,'QUOTE_READY');
    assert.equal((await query(env,'/api/business/cases')).value.cases.length,1);
  }finally{db.close()}
});
