import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {validateFictionalOrderIntake} from '../src/fictional-order-intake.mjs';

const TOKEN='f'.repeat(64);
const r=()=>({
  businessCategory:'restaurant',websiteGoal:'booking-inquiry',
  style:'classic',language:'en-fr',
  pages:['home','about','menu','booking','contact'],
  features:['menu','booking-inquiry','multilingual','accessibility']
});
const payload=(id='FAKE_ORDER_001')=>({synthetic:true,caseId:id,requirements:r()});
function fixture(){
  const db=new DatabaseSync(':memory:');
  for(const name of ['0001_init.sql','0002_business_cases.sql'])
    db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const DB={prepare(sql){let args=[];return {
    bind(...a){args=a;return this;},
    first(){return db.prepare(sql).get(...args)||null;},
    all(){return {results:db.prepare(sql).all(...args)};},
    run(){return db.prepare(sql).run(...args);}
  };}};
  return {db,env:{MANAGER_OWNER_TOKEN:TOKEN,DB,BUSINESS_CASES_ENABLED:'true'},
    close(){db.close();}};
}
async function request(env,path,method='GET',body,authenticated=true){
  const res=await worker.fetch(new Request('https://private-staging.example'+path,{
    method,headers:{...(authenticated?{authorization:'Bearer '+TOKEN}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:res.status,data:await res.json()};
}
test('fictional order intake validates shape without names or contact data',()=>{
  assert.deepEqual(validateFictionalOrderIntake(payload()),{
    caseId:'FAKE_ORDER_001',requirements:r()
  });
  for(const broken of [
    {...payload(),synthetic:false},
    {...payload(),caseId:'customer@example.org'},
    {...payload(),customerName:'A customer'},
    {...payload(),requirements:{...r(),email:'test@example.org'}},
    {...payload(),requirements:{...r(),pages:['home','home']}},
    {...payload(),requirements:{...r(),language:'en'}},
    {...payload(),requirements:{...r(),pages:['home','menu']}}
  ])assert.throws(()=>validateFictionalOrderIntake(broken));
});
test('private intake instantly saves fictional allowed selections as a new owner-review case',async()=>{
  const f=fixture();
  try{
    const path='/api/business/orders/synthetic-intake';
    assert.equal((await request(f.env,path,'POST',payload(),false)).status,401);
    const result=await request(f.env,path,'POST',payload());
    assert.equal(result.status,201,JSON.stringify(result.data));
    assert.equal(result.data.status,'FICTIONAL_ORDER_WAITING_FOR_OWNER_REVIEW');
    assert.equal(result.data.case.revision,2);
    assert.equal(result.data.case.stage,'NEW_REQUEST');
    assert.deepEqual(result.data.case.requirements,r());
    assert.equal(result.data.intake.requestReceivedFromRealCustomer,false);
    assert.equal(result.data.customerWebsitePublished,false);
    assert.equal(result.data.phoneCallsPlaced,0);
    assert.equal(result.data.aiRequestsMade,0);
    assert.equal(result.data.paymentsCharged,0);
    assert.equal((await request(f.env,path,'POST',payload())).status,409);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM business_cases').get().n,1);
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM audit WHERE operation=?')
      .get('fictional-intake-created').n,1);
    const dashboard=await request(f.env,'/api/business/dashboard');
    assert.equal(dashboard.data.reviewQueue[0].nextAction,'REVIEW_REQUEST');
    const progress=await request(f.env,'/api/business/orders/FAKE_ORDER_001/progress');
    assert.equal(progress.status,200);
    assert.equal(progress.data.nextOwnerAction,'REVIEW_REQUEST');
    assert.equal(progress.data.realBuildAuthorized,false);
    assert.equal(progress.data.realPublishingEnabled,false);
    assert.equal(progress.data.customerIdentityVerified,false);
    assert.equal(progress.data.previewVersion,null);
  }finally{f.close();}
});
test('case preparation moves fictional intake through quote, site bundle, local QA and tracking',async()=>{
  const f=fixture();
  try{
    const path='/api/business/cases/FAKE_ORDER_001';
    await request(f.env,'/api/business/orders/synthetic-intake','POST',payload());
    assert.equal((await request(f.env,path+'/events','POST',{
      expectedRevision:2,type:'review-request'
    })).status,200);
    let stage=await request(f.env,'/api/business/orders/FAKE_ORDER_001/progress');
    assert.equal(stage.data.nextOwnerAction,'PREPARE_DRAFT_QUOTE');
    assert.equal((await request(f.env,path+'/events','POST',{
      expectedRevision:3,type:'prepare-quote',tier:3,fixedQuoteCAD:1700
    })).status,200);
    stage=await request(f.env,'/api/business/orders/FAKE_ORDER_001/progress');
    assert.equal(stage.data.draftQuoteReady,true);
    assert.equal(stage.data.nextOwnerAction,'GENERATE_FICTIONAL_PREVIEW');
    const bundle=await request(f.env,path+'/fictional-bundle');
    assert.equal(bundle.status,200);
    assert.equal(bundle.data.audit.status,'LOCAL_STATIC_BUNDLE_CHECKS_PASSED');
    const preview=await request(f.env,path+'/staging-draft','POST',{
      synthetic:true,expectedRevision:4
    });
    assert.equal(preview.status,201);
    const qa=await request(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:'FAKE_ORDER_001',role:'quality-checker',action:'review',input:{}
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_PASSED');
    stage=await request(f.env,'/api/business/orders/FAKE_ORDER_001/progress');
    assert.equal(stage.data.nextOwnerAction,'REVIEW_PRIVATE_PREVIEW');
    assert.equal(stage.data.localQaPassed,true);
    assert.equal(stage.data.realCustomerDeliveryEnabled,false);
    assert.equal(stage.data.customerConsentVerified,false);
    assert.equal((await request(f.env,'/api/status')).data.paymentsEnabled,false);
  }finally{f.close();}
});
test('intake disabled, missing D1, unauthenticated progress and closed cases fail closed',async()=>{
  const f=fixture();
  try{
    const env=f.env;
    assert.equal((await request(env,'/api/business/orders/UNKNOWN/progress')).status,404);
    assert.equal((await request(env,'/api/business/orders/UNKNOWN/progress','GET',null,false)).status,401);
    env.BUSINESS_CASES_ENABLED='false';
    assert.equal((await request(env,'/api/business/orders/synthetic-intake','POST',payload())).status,503);
    assert.equal((await request(env,'/api/business/orders/UNKNOWN/progress')).status,503);
    env.BUSINESS_CASES_ENABLED='true';
    delete env.DB;
    assert.equal((await request(env,'/api/business/orders/synthetic-intake','POST',payload())).status,503);
    assert.equal((await request(env,'/api/business/orders/UNKNOWN/progress')).status,503);
  }finally{f.close();}
});
