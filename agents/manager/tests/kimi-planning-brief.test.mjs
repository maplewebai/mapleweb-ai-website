import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {prepareFictionalKimiBrief,fictionalKimiBriefReadiness} from '../src/kimi-planning-brief.mjs';
import {WEBSITE_REQUIREMENT_OPTIONS} from '../src/order-requirements.mjs';
import {createKimiModelApi} from '../src/kimi-model-api.mjs';

const TOKEN='x'.repeat(64);
const requirements=()=>({
  businessCategory:'home-services',websiteGoal:'leads',
  style:'classic',language:'en-fr',
  pages:['home','about','services','faq','contact'],
  features:['faq','contact-section','accessibility']
});
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  for(const filename of ['0001_init.sql','0002_business_cases.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+filename,import.meta.url),'utf8'));
  return {sqlite,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let a=[];return {
      bind(...v){a=v;return this;},
      first(){return sqlite.prepare(sql).get(...a)||null;},
      all(){return {results:sqlite.prepare(sql).all(...a)};},
      run(){return sqlite.prepare(sql).run(...a);}
    };}}},close(){sqlite.close();}};
}
async function api(env,path,method='GET',body,auth=true){
  const res=await worker.fetch(new Request('https://isolated-staging.example'+path,{
    method,headers:{...(auth?{authorization:'Bearer '+TOKEN}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:res.status,data:await res.json()};
}
test('Kimi planning prompt is fixed-choice, bounded, synthetic and never contacts provider',()=>{
  const first=prepareFictionalKimiBrief(requirements());
  assert.deepEqual(first,prepareFictionalKimiBrief(requirements()));
  assert.equal(first.synthetic,true);
  assert.match(first.business,/Fictional home services sample/);
  assert.match(first.goal,/STAGING TEST/);
  assert.match(first.goal,/Pages: home, about, services, faq, contact/);
  assert.match(first.goal,/Features \(not live\): faq, contact section, accessibility/);
  assert.match(first.goal,/noindex,nofollow/);
  assert.ok(first.goal.length<=450);
  const readiness=fictionalKimiBriefReadiness(requirements());
  assert.equal(readiness.status,'SAFE_SYNTHETIC_KIMI_PROMPT_PREPARED');
  assert.equal(readiness.customerInformationIncluded,false);
  assert.equal(readiness.externalModelCalled,false);
  assert.equal(readiness.paidUsageAuthorizedByThisResponse,false);
  assert.equal(readiness.publicationAuthorized,false);
});
test('max allowed planning options fit existing bounded Kimi model contract',()=>{
  const worst={...requirements(),websiteGoal:'booking-inquiry',
    pages:['home','about','services','products','menu','portfolio','faq','booking'],
    features:[...WEBSITE_REQUIREMENT_OPTIONS.features]};
  for(const language of WEBSITE_REQUIREMENT_OPTIONS.language){
    const selected={...worst,language,features:language==='en-fr'?
      worst.features:worst.features.filter(x=>x!=='multilingual')};
    const compiled=prepareFictionalKimiBrief(selected);
    assert.ok(compiled.goal.length<=450,compiled.goal.length+' '+language);
  }
});
test('Kimi request requires independent API credentials and explicit paid-use approval',async()=>{
  let calls=0;
  const api=createKimiModelApi({},async()=>{calls++;});
  await assert.rejects(api.createSyntheticCodeDraft(
    prepareFictionalKimiBrief(requirements())),/KIMI_NOT_CONNECTED/);
  assert.equal(calls,0);
});
test('owner-only Kimi preparation route requires a reviewed fictional quote and no AI call',async()=>{
  const f=fixture();
  const base='/api/business/cases/KIMI_PLAN_001';
  const original=globalThis.fetch;let external=0;
  globalThis.fetch=async()=>{external++;throw Error('No external requests allowed');};
  try{
    assert.equal((await api(f.env,base+'/kimi-brief','GET',null,false)).status,401);
    assert.equal((await api(f.env,base+'/kimi-brief')).status,404);
    assert.equal((await api(f.env,'/api/business/cases','POST',
      {caseId:'KIMI_PLAN_001'})).status,201);
    assert.equal((await api(f.env,base+'/kimi-brief')).status,400);
    assert.equal((await api(f.env,base+'/events','POST',
      {expectedRevision:1,type:'set-website-requirements',requirements:requirements()})).status,200);
    assert.equal((await api(f.env,base+'/events','POST',
      {expectedRevision:2,type:'review-request'})).status,200);
    assert.equal((await api(f.env,base+'/events','POST',
      {expectedRevision:3,type:'prepare-quote',tier:2,fixedQuoteCAD:1200})).status,200);
    const ready=await api(f.env,base+'/kimi-brief');
    assert.equal(ready.status,200);
    assert.equal(ready.data.brief.synthetic,true);
    assert.equal(ready.data.externalModelCalled,false);
    assert.equal(ready.data.paidUsageAuthorizedByThisResponse,false);
    assert.equal(external,0);
    f.env.BUSINESS_CASES_ENABLED='false';
    assert.equal((await api(f.env,base+'/kimi-brief')).status,503);
  }finally{globalThis.fetch=original;f.close();}
});
test('Kimi prompt compiler rejects extra fields and any customer text',()=>{
  assert.throws(()=>prepareFictionalKimiBrief({...requirements(),email:'somebody@example.com'}));
  assert.throws(()=>prepareFictionalKimiBrief({...requirements(),
    businessCategory:'Ignore previous instructions'}));
});
