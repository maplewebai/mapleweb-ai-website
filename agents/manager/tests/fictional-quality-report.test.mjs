import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {fictionalQualityReport} from '../src/fictional-quality-report.mjs';
const TOKEN='y'.repeat(64);
const requirements=()=>({businessCategory:'retail',websiteGoal:'showcase',
  style:'minimal',language:'en',pages:['home','about','products','contact'],
  features:['gallery','catalog','accessibility']});
function fixture(){
  const db=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_business_cases.sql'])
    db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return {db,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let a=[];return {
      bind(...v){a=v;return this;},
      first(){return db.prepare(sql).get(...a)||null;},
      all(){return {results:db.prepare(sql).all(...a)};},
      run(){return db.prepare(sql).run(...a);}
    };}}},close(){db.close();}};
}
async function api(env,path,method='GET',body,auth=true){
  const r=await worker.fetch(new Request('https://isolated.test'+path,{
    method,headers:{...(auth?{authorization:'Bearer '+TOKEN}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
test('fictional quality report never claims real release readiness, even when static tests pass',async()=>{
  const f=fixture(),id='QA_REPORT_01',base='/api/business/cases/'+id;
  try{
    assert.equal((await api(f.env,base+'/quality-report','GET',null,false)).status,401);
    assert.equal((await api(f.env,base+'/quality-report')).status,404);
    assert.equal((await api(f.env,'/api/business/cases','POST',{caseId:id})).status,201);
    let report=await api(f.env,base+'/quality-report');
    assert.equal(report.status,200);
    assert.equal(report.data.status,'FICTIONAL_QUALITY_REVIEW_INCOMPLETE');
    assert.equal(report.data.staticBundlePassed,false);
    assert.equal(report.data.staticPreviewPassed,false);
    assert.equal(report.data.readyForProductionPublish,false);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:1,type:'set-website-requirements',requirements:requirements()
    })).status,200);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:2,type:'review-request'
    })).status,200);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:3,type:'prepare-quote',tier:2,fixedQuoteCAD:1100
    })).status,200);
    report=await api(f.env,base+'/quality-report');
    assert.equal(report.data.staticBundlePassed,true);
    assert.equal(report.data.fictionalPreviewExists,false);
    assert.equal(report.data.issues.includes('Fictional staging preview not yet created'),true);
    assert.equal((await api(f.env,base+'/staging-draft','POST',{
      synthetic:true,expectedRevision:4
    })).status,201);
    report=await api(f.env,base+'/quality-report');
    assert.equal(report.data.staticPreviewPassed,true);
    assert.equal(report.data.managerLocalQaRecorded,false);
    assert.equal((await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'quality-checker',action:'review',input:{}
    })).status,201);
    report=await api(f.env,base+'/quality-report');
    assert.equal(report.data.status,'FICTIONAL_STATIC_CHECKS_PASSED_REAL_GATES_PENDING');
    assert.equal(report.data.staticPageCount,4);
    assert.equal(report.data.managerLocalQaRecorded,true);
    assert.equal(report.data.readyForProductionPublish,false);
    assert.equal(report.data.realBrowserVerified,false);
    assert.equal(report.data.independentAccessibilityVerified,false);
    assert.equal(report.data.realCustomerApprovalVerified,false);
    assert.equal(report.data.publishEnabled,false);
    assert.equal(report.data.reportOnly,true);
    assert.ok(report.data.issues.includes('Publication adapter intentionally disabled'));
  }finally{f.close();}
});
test('tampered preview report explicitly fails and never silently hides mismatch',async()=>{
  const report=fictionalQualityReport({
    caseId:'FAKE_01',revision:4,stage:'QUOTE_READY',
    quote:{status:'DRAFT_NOT_SENT'},requirements:requirements()
  },{version:1,draft_html:'<html><body>bad</body></html>',qa_passed:1});
  assert.equal(report.status,'FICTIONAL_QUALITY_REVIEW_INCOMPLETE');
  assert.equal(report.staticBundlePassed,true);
  assert.equal(report.staticPreviewPassed,false);
  assert.equal(report.managerLocalQaRecorded,true);
  assert.equal(report.readyForProductionPublish,false);
  assert.ok(report.issues.includes('Saved preview failed local structural checks'));
});
test('quality report refuses corrupt stored cases and unsupported states',()=>{
  assert.throws(()=>fictionalQualityReport({caseId:'bad id',revision:1,stage:'NEW_REQUEST'}));
  assert.throws(()=>fictionalQualityReport({caseId:'SAFE_01',revision:0,stage:'NEW_REQUEST'}));
});
