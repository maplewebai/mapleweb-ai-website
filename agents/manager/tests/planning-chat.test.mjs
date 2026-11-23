import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {planningChat,planningBriefForCase,PLANNING_FAQ_TOPICS} from '../src/planning-chat.mjs';

const ownerToken='m'.repeat(64);
const baseAnswers=()=>({
  businessCategory:'professional-services',
  websiteGoal:'leads',
  style:'classic',
  language:'en',
  pages:['home','about','services','contact'],
  features:['faq','accessibility']
});
function runConversation(answers=baseAnswers()) {
  let last=planningChat({synthetic:true,answers:{},action:'start'});
  for(const [field,value] of Object.entries(answers)) {
    assert.equal(last.nextQuestion.field,field);
    last=planningChat({synthetic:true,answers:last.answers,action:'answer',value});
  }
  return last;
}
function dbFixture(){
  const sqlite=new DatabaseSync(':memory:');
  for(const f of ['0001_init.sql','0002_business_cases.sql'])
    sqlite.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
  return {sqlite,DB:{prepare(sql){
    let args=[];
    return {
      bind(...values){args=values;return this;},
      first(){return sqlite.prepare(sql).get(...args)||null;},
      all(){return {results:sqlite.prepare(sql).all(...args)};},
      run(){return sqlite.prepare(sql).run(...args);}
    };
  }},close(){sqlite.close();}};
}
async function query(env,path,method='GET',body,auth=true) {
  const response=await worker.fetch(new Request('https://staging.example'+path,{
    method,
    headers:{...(auth?{authorization:'Bearer '+ownerToken}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:response.status,data:await response.json()};
}
test('planning chat asks all six questions, produces a fictional quote guide, never a real order',()=>{
  const start=planningChat({synthetic:true,action:'start',answers:{}});
  assert.match(start.reply,/predefined choices/);
  assert.equal(start.nextQuestion.field,'businessCategory');
  const done=runConversation();
  assert.equal(done.status,'FICTIONAL_BRIEF_READY_FOR_OWNER_REVIEW');
  assert.equal(done.completedFields,6);
  assert.equal(done.totalFields,6);
  assert.equal(done.nextQuestion,null);
  assert.deepEqual(done.requirements,baseAnswers());
  assert.equal(done.priceGuidance.suggestedStartingTier,2);
  assert.deepEqual(done.priceGuidance.rangeCAD,[900,1500]);
  assert.equal(done.priceGuidance.finalPriceAgreed,false);
  for(const key of ['realCustomerInputAllowed','conversationPersisted',
    'messageSent','kimiCalled','callPlaced','paymentCharged',
    'sitePublished','customerAcceptanceVerified'])assert.equal(done[key],false);
  assert.throws(()=>planningChat({synthetic:true,action:'answer',
    answers:done.answers,value:'anything'}),/already complete/);
});
test('FAQ answers are deterministic, do not change answers, and avoid live promises',()=>{
  const answers={businessCategory:'retail',websiteGoal:'catalog'};
  for(const topic of PLANNING_FAQ_TOPICS){
    const result=planningChat({synthetic:true,answers,action:'faq',topic});
    assert.equal(result.nextQuestion.field,'style');
    assert.deepEqual(result.answers,answers);
    assert.equal(typeof result.reply,'string');
    assert.ok(result.reply.length>30);
  }
  const price=planningChat({synthetic:true,answers,action:'faq',topic:'price'});
  assert.match(price.reply,/\$500 CAD/);
  assert.match(price.reply,/owner review/);
  const payments=planningChat({synthetic:true,answers,action:'faq',topic:'payments'});
  assert.match(payments.reply,/not active/);
  const reset=planningChat({synthetic:true,answers,action:'reset'});
  assert.deepEqual(reset.answers,{});
});
test('rejects real customer information, free text, nested payloads and invalid choices',()=>{
  const invalid=[
    {action:'start',synthetic:false,answers:{}},
    {action:'start',synthetic:true,answers:{email:'p@example.com'}},
    {action:'answer',synthetic:true,answers:{},value:'john@example.com'},
    {action:'answer',synthetic:true,answers:{},value:'<script>bad</script>'},
    {action:'answer',synthetic:true,answers:{},value:'hello'},
    {action:'answer',synthetic:true,answers:{},value:{customerName:'x'}},
    {action:'faq',synthetic:true,answers:{},topic:'open-chat'},
    {action:'answer',synthetic:true,answers:{websiteGoal:'leads'},value:'classic'},
    {action:'start',synthetic:true,answers:{},secret:'no'},
    {action:'start',synthetic:true,answers:[],value:'no'},
    {action:'answer',synthetic:true,answers:{businessCategory:'restaurant'},
      value:'information',topic:'price'},
    {action:'answer',synthetic:true,
      answers:{businessCategory:'restaurant',websiteGoal:'information',
        style:'modern',language:'en',pages:['home']},
      value:['faq','faq']}
  ];
  for(const item of invalid) assert.throws(()=>planningChat(item),undefined,
    'invalid input was mistakenly accepted');
});
test('booking, required Home page, multilingual consistency and duplicate selections',()=>{
  const base={
    businessCategory:'restaurant',websiteGoal:'booking-inquiry',
    style:'modern',language:'en'
  };
  assert.throws(()=>planningChat({synthetic:true,action:'answer',answers:base,
    value:['home','contact']}),/booking page/);
  assert.throws(()=>planningChat({synthetic:true,action:'answer',answers:base,
    value:['booking','contact']}),/Home page/);
  const pages=planningChat({synthetic:true,action:'answer',answers:base,
    value:['home','booking','contact']});
  assert.equal(pages.nextQuestion.field,'features');
  assert.throws(()=>planningChat({synthetic:true,action:'answer',
    answers:pages.answers,value:['multilingual']}),/en-fr/);
  const bilingual=runConversation({...baseAnswers(),
    language:'en-fr',features:['multilingual','accessibility']});
  assert.equal(bilingual.priceGuidance.complexityWarning,true);
  assert.equal(bilingual.requirements.language,'en-fr');
});
test('price guide is an estimate, never a fixed quote; pages scale starting tier',()=>{
  for(const [pages,tier] of [
    [['home'],1],
    [['home','about'],1],
    [['home','about','contact'],2],
    [['home','about','services','contact','faq'],2],
    [['home','about','services','contact','faq','portfolio'],3]
  ]){
    const r=runConversation({...baseAnswers(),pages});
    assert.equal(r.priceGuidance.suggestedStartingTier,tier);
    assert.equal(r.priceGuidance.manualReviewRequired,true);
    assert.equal(r.priceGuidance.finalPriceAgreed,false);
  }
});
test('owner review is required to import a fully answered fictional brief',()=>{
  assert.throws(()=>planningBriefForCase({synthetic:true,answers:baseAnswers(),
    expectedRevision:1,ownerReviewed:false}),/Owner review/);
  assert.throws(()=>planningBriefForCase({synthetic:true,
    answers:{businessCategory:'restaurant'},expectedRevision:1,ownerReviewed:true}),
    /Complete all six/);
  assert.throws(()=>planningBriefForCase({synthetic:true,answers:baseAnswers(),
    expectedRevision:0,ownerReviewed:true}),/revision/);
  const result=planningBriefForCase({synthetic:true,answers:baseAnswers(),
    expectedRevision:2,ownerReviewed:true});
  assert.equal(result.expectedRevision,2);
  assert.deepEqual(result.requirements,baseAnswers());
});
test('Manager requires owner authentication even for fictional planning chat',async()=>{
  const env={MANAGER_OWNER_TOKEN:ownerToken};
  const body={synthetic:true,action:'start',answers:{}};
  assert.equal((await query(env,'/api/business/planning-chat','POST',body,false)).status,401);
  const ok=await query(env,'/api/business/planning-chat','POST',body);
  assert.equal(ok.status,200);
  assert.equal(ok.data.nextQuestion.field,'businessCategory');
  assert.equal((await query(env,'/api/business/planning-chat','POST',
    {synthetic:false,action:'start',answers:{}})).status,403);
  assert.equal((await query(env,'/api/business/planning-chat','GET')).status,404);
});
test('private case import uses revision guard, stores only choices and cannot approve, call or publish',async()=>{
  const db=dbFixture();
  const env={DB:db.DB,MANAGER_OWNER_TOKEN:ownerToken,BUSINESS_CASES_ENABLED:'true'};
  try{
    const answers=runConversation().answers;
    const payload={synthetic:true,answers,ownerReviewed:true,expectedRevision:1};
    assert.equal((await query(env,'/api/business/cases/PLAN_001/import-fictional-plan',
      'POST',payload,false)).status,401);
    assert.equal((await query(env,'/api/business/cases/PLAN_001/import-fictional-plan',
      'POST',payload)).status,404);
    const created=await query(env,'/api/business/cases','POST',{caseId:'PLAN_001'});
    assert.equal(created.status,201);
    const imported=await query(env,'/api/business/cases/PLAN_001/import-fictional-plan',
      'POST',payload);
    assert.equal(imported.status,200);
    assert.deepEqual(imported.data.case.requirements,answers);
    assert.equal(imported.data.case.stage,'NEW_REQUEST');
    assert.equal(imported.data.case.revision,2);
    assert.equal(imported.data.case.clientAcceptanceVerified,false);
    assert.equal(imported.data.case.buildAuthorized,false);
    assert.equal(imported.data.case.publicationAuthorized,false);
    assert.equal(imported.data.case.paymentAuthorized,false);
    assert.equal((await query(env,'/api/business/cases/PLAN_001/import-fictional-plan',
      'POST',payload)).status,409);
    assert.equal((await query(env,'/api/business/cases/PLAN_001/import-fictional-plan',
      'POST',{...payload,expectedRevision:2,ownerReviewed:false})).status,403);
    const stored=db.sqlite.prepare('SELECT state_json FROM business_cases WHERE id=?')
      .get('PLAN_001').state_json;
    assert.ok(stored.includes('"businessCategory":"professional-services"'));
    assert.ok(!stored.includes('example.com'));
    assert.ok(!stored.includes('ownerReviewed'));
    const status=await query(env,'/api/status');
    assert.equal(status.data.publishEnabled,false);
    assert.equal(status.data.paymentsEnabled,false);
    assert.equal(status.data.realCustomerInputAllowed,false);
  }finally{db.close();}
});
test('private case import refuses disabled storage and closed cases',async()=>{
  const db=dbFixture();
  const payload={synthetic:true,answers:baseAnswers(),
    expectedRevision:1,ownerReviewed:true};
  try{
    const env={DB:db.DB,MANAGER_OWNER_TOKEN:ownerToken};
    assert.equal((await query(env,'/api/business/cases/PLAN_002/import-fictional-plan',
      'POST',payload)).status,503);
    env.BUSINESS_CASES_ENABLED='true';
    await query(env,'/api/business/cases','POST',{caseId:'PLAN_002'});
    await query(env,'/api/business/cases/PLAN_002/events','POST',
      {type:'opt-out',expectedRevision:1});
    assert.equal((await query(env,'/api/business/cases/PLAN_002/import-fictional-plan',
      'POST',{...payload,expectedRevision:2})).status,400);
  }finally{db.close();}
});
