// End-to-end owner-only rehearsal of the entire non-paid, non-public business chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
const TOKEN='t'.repeat(64);
function fixture(){
  const raw=new DatabaseSync(':memory:');
  for(const name of ['0001_init.sql','0002_business_cases.sql','0003_stripe_test.sql'])
    raw.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  return {raw,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let a=[];return {
      bind(...v){a=v;return this;},
      first(){return raw.prepare(sql).get(...a)||null;},
      all(){return {results:raw.prepare(sql).all(...a)};},
      run(){return raw.prepare(sql).run(...a);}
    };}}},close(){raw.close();}};
}
async function api(env,path,method='GET',body){
  const res=await worker.fetch(new Request('https://mock-staging.test'+path,{
    method,headers:{authorization:'Bearer '+TOKEN,...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:res.status,data:await res.json()};
}
test('full fictional inquiry -> order intake -> CRM -> quote -> Kimi prompt -> multi-page -> QA -> simulated approval -> blocked publishing',async()=>{
  const f=fixture(),id='WHOLE_001';
  let externalCalls=0;
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>{externalCalls++;throw Error('No external service allowed');};
  try{
    const selections=[
      'restaurant','booking-inquiry','classic','en-fr',
      ['home','about','menu','booking','contact'],['menu','booking-inquiry','multilingual','accessibility']
    ];
    let chat=await api(f.env,'/api/business/planning-chat','POST',{
      synthetic:true,action:'start',answers:{}
    });
    assert.equal(chat.status,200);
    for(const value of selections){
      chat=await api(f.env,'/api/business/planning-chat','POST',{
        synthetic:true,action:'answer',answers:chat.data.answers,value
      });
      assert.equal(chat.status,200,JSON.stringify(chat.data));
    }
    assert.equal(chat.data.status,'FICTIONAL_BRIEF_READY_FOR_OWNER_REVIEW');
    assert.equal(chat.data.priceGuidance.finalPriceAgreed,false);
    const created=await api(f.env,'/api/business/orders/synthetic-intake','POST',{
      synthetic:true,caseId:id,requirements:chat.data.requirements
    });
    assert.equal(created.status,201,JSON.stringify(created.data));
    assert.equal(created.data.case.revision,2);
    assert.equal(created.data.intake.requestReceivedFromRealCustomer,false);
    const queue=await api(f.env,'/api/business/orders/queue?stage=ACTIVE');
    assert.equal(queue.data.total,1);
    assert.equal(queue.data.items[0].nextOwnerAction,'REVIEW_REQUEST');
    const base='/api/business/cases/'+id;
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:2,type:'review-request'
    })).status,200);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:3,type:'prepare-quote',tier:3,fixedQuoteCAD:1700
    })).status,200);
    const quote=await api(f.env,base);
    assert.equal(quote.data.case.quote.status,'DRAFT_NOT_SENT');
    assert.equal(quote.data.case.contactAllowed,false);
    assert.equal(quote.data.case.paymentAuthorized,false);
    const kimi=await api(f.env,base+'/kimi-brief');
    assert.equal(kimi.status,200);
    assert.equal(kimi.data.brief.synthetic,true);
    assert.equal(kimi.data.externalModelCalled,false);
    assert.equal(kimi.data.publicationAuthorized,false);
    const files=await api(f.env,base+'/fictional-bundle');
    assert.equal(files.status,200);
    assert.equal(files.data.audit.status,'LOCAL_STATIC_BUNDLE_CHECKS_PASSED');
    assert.ok(files.data.bundle.files['index.html']);
    assert.ok(files.data.bundle.files['menu.html']);
    assert.ok(files.data.bundle.files['booking.html']);
    assert.equal(files.data.bundle.published,false);
    assert.equal(files.data.audit.readyToPublish,false);
    const preview=await api(f.env,base+'/staging-draft','POST',{
      synthetic:true,expectedRevision:4
    });
    assert.equal(preview.status,201);
    assert.equal(preview.data.project.qaPassed,false);
    const qa=await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'quality-checker',action:'review',input:{}
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_PASSED');
    assert.equal(qa.data.result.casePreviewStructure.status,'LOCAL_STRUCTURE_CHECKS_PASSED');
    for(const role of ['owner','customer']){
      const approval=await api(f.env,'/api/projects/'+id+'/simulate-approval','POST',{
        synthetic:true,role,version:1
      });
      assert.equal(approval.status,200);
      assert.equal(approval.data.publishAuthorized,false);
    }
    const progress=await api(f.env,'/api/business/orders/'+id+'/progress');
    assert.equal(progress.data.syntheticOwnerApprovalRecorded,true);
    assert.equal(progress.data.syntheticCustomerApprovalRecorded,true);
    assert.equal(progress.data.realBuildAuthorized,false);
    const blocked=await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'publishing',action:'readiness',input:{}
    });
    assert.equal(blocked.status,201);
    assert.equal(blocked.data.result.status,'NOT_PUBLISHED');
    assert.equal(blocked.data.result.deploymentsPerformed,0);
    const payment=await api(f.env,'/api/payments/test-status');
    assert.equal(payment.data.livePaymentsEnabled,false);
    assert.equal(payment.data.realCustomerPaymentsEnabled,false);
    const call=await api(f.env,'/api/integrations/calling');
    assert.equal(call.data.enabled,false);
    const live=await api(f.env,'/api/business/readiness');
    assert.equal(live.data.areasVerifiedLive,0);
    assert.equal(live.data.allRequirementsMet,false);
    assert.equal(live.data.canAcceptRealCustomers,false);
    assert.equal(live.data.canPublishRealCustomerWebsites,false);
    assert.equal(externalCalls,0);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM business_cases').get().n,1);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM projects').get().n,1);
    assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM audit WHERE operation=?')
      .get('fictional-intake-created').n,1);
  }finally{globalThis.fetch=oldFetch;f.close();}
});
