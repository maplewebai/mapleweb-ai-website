// Full in-memory fictional order journey. No provider accounts or customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';

const TOKEN='j'.repeat(64);
function fixture(){
  const raw=new DatabaseSync(':memory:');
  for(const name of ['0001_init.sql','0002_business_cases.sql'])
    raw.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  return {raw,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let a=[];return {
      bind(...args){a=args;return this;},
      first(){return raw.prepare(sql).get(...a)||null;},
      all(){return {results:raw.prepare(sql).all(...a)};},
      run(){return raw.prepare(sql).run(...a);}
    };}}},
    close(){raw.close();}};
}
async function api(env,path,method='GET',body){
  const result=await worker.fetch(new Request('https://isolated-staging.example'+path,{
    method,headers:{authorization:'Bearer '+TOKEN,
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:result.status,data:await result.json()};
}
test('six-question planning -> owner-reviewed brief -> draft quote -> preview -> QA -> simulated approvals; never publish',async()=>{
  const f=fixture();
  try{
    const steps=[
      'restaurant','information','classic','en',
      ['home','about','menu','contact'],['menu','accessibility']
    ];
    let chat=await api(f.env,'/api/business/planning-chat','POST',
      {synthetic:true,action:'start',answers:{}});
    assert.equal(chat.status,200);
    let state=chat.data.answers;
    for(let i=0;i<steps.length;i++){
      chat=await api(f.env,'/api/business/planning-chat','POST',
        {synthetic:true,action:'answer',answers:state,value:steps[i]});
      assert.equal(chat.status,200,JSON.stringify(chat.data));
      state=chat.data.answers;
    }
    assert.equal(chat.data.status,'FICTIONAL_BRIEF_READY_FOR_OWNER_REVIEW');
    assert.equal(chat.data.priceGuidance.finalPriceAgreed,false);
    assert.equal(chat.data.kimiCalled,false);

    const id='JOURNEY_001',base='/api/business/cases/'+id;
    assert.equal((await api(f.env,'/api/business/cases','POST',{caseId:id})).status,201);
    const imported=await api(f.env,base+'/import-fictional-plan','POST',{
      synthetic:true,answers:state,expectedRevision:1,ownerReviewed:true
    });
    assert.equal(imported.status,200);
    assert.equal(imported.data.case.revision,2);
    assert.equal(imported.data.case.clientAcceptanceVerified,false);

    const before=await api(f.env,'/api/business/dashboard');
    assert.equal(before.status,200);
    assert.equal(before.data.reviewQueue[0].nextAction,'REVIEW_REQUEST');
    assert.equal(before.data.amountCollectedCAD,null);
    assert.equal((await api(f.env,base+'/events','POST',
      {type:'review-request',expectedRevision:2})).status,200);
    const quote=await api(f.env,base+'/events','POST',{
      type:'prepare-quote',tier:2,fixedQuoteCAD:1200,expectedRevision:3
    });
    assert.equal(quote.status,200);
    assert.equal(quote.data.case.quote.status,'DRAFT_NOT_SENT');
    assert.equal(quote.data.case.contactAllowed,false);
    assert.equal(quote.data.case.paymentAuthorized,false);
    const dash=await api(f.env,'/api/business/dashboard');
    assert.equal(dash.data.quoteDraftsNotSent,1);
    assert.equal(dash.data.reviewQueue[0].nextAction,'REVIEW_UNSENT_DRAFT_QUOTE');

    const created=await api(f.env,base+'/staging-draft','POST',
      {synthetic:true,expectedRevision:4});
    assert.equal(created.status,201,JSON.stringify(created.data));
    assert.equal(created.data.draft.published,false);
    assert.equal(created.data.draft.kimiCalled,false);
    assert.equal(created.data.draft.paymentCharged,false);
    assert.equal(created.data.project.qaPassed,false);
    assert.match(created.data.draft.html,/STAGING TEST/);
    assert.match(created.data.draft.html,/noindex,nofollow/);

    const jobInput={synthetic:true,projectId:id,input:{}};
    const qa=await api(f.env,'/api/jobs','POST',{
      ...jobInput,role:'quality-checker',action:'review'
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_PASSED');
    assert.equal(qa.data.project.qaPassed,true);

    for(const role of ['customer','owner']){
      const approval=await api(f.env,'/api/projects/'+id+'/simulate-approval','POST',
        {synthetic:true,role,version:1});
      assert.equal(approval.status,200);
      assert.equal(approval.data.publishAuthorized,false);
    }
    const publishCheck=await api(f.env,'/api/jobs','POST',{
      ...jobInput,role:'publishing',action:'readiness'
    });
    assert.equal(publishCheck.status,201);
    assert.equal(publishCheck.data.result.status,'NOT_PUBLISHED');
    assert.equal(publishCheck.data.result.liveUrl,null);
    assert.equal(publishCheck.data.result.deploymentsPerformed,0);
    assert.equal(publishCheck.data.project.publication,'DISABLED');

    // A revision must cancel all previous synthetic QA/approvals.
    const revised=await api(f.env,'/api/jobs','POST',{
      ...jobInput,role:'website-developer',action:'request-revision',
      input:{note:'Please update the fictional design'}
    });
    assert.equal(revised.status,201);
    assert.equal(revised.data.project.qaPassed,false);
    assert.equal(revised.data.project.ownerApprovedVersion,null);
    assert.equal(revised.data.project.customerApprovedVersion,null);
    const unsafeApproval=await api(f.env,'/api/projects/'+id+'/simulate-approval','POST',
      {synthetic:true,role:'owner',version:1});
    assert.equal(unsafeApproval.status,400);
    const finalStatus=await api(f.env,'/api/status');
    assert.equal(finalStatus.data.paymentsEnabled,false);
    assert.equal(finalStatus.data.publishEnabled,false);
    assert.equal(finalStatus.data.realCustomerInputAllowed,false);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM business_cases').get().n,1);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM projects').get().n,1);
  }finally{f.close();}
});
