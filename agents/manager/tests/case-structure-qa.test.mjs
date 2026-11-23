// Regression: a fictional case cannot pass local QA if required sections are missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
const token='k'.repeat(64);
function fixture(){
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0001_init.sql','0002_business_cases.sql'])
    sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  return {sql,env:{MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(statement){let args=[];return {
      bind(...values){args=values;return this;},
      first(){return sql.prepare(statement).get(...args)||null;},
      all(){return {results:sql.prepare(statement).all(...args)};},
      run(){return sql.prepare(statement).run(...args);}
    };}}},close(){sql.close();}};
}
async function api(env,path,method='GET',body) {
  const r=await worker.fetch(new Request('https://staging.test'+path,{
    method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
const req={
  businessCategory:'professional-services',websiteGoal:'leads',
  style:'modern',language:'en',
  pages:['home','about','services','contact'],features:['faq','accessibility']
};
async function prepare(env,id) {
  const cases='/api/business/cases',base=cases+'/'+id;
  assert.equal((await api(env,cases,'POST',{caseId:id})).status,201);
  assert.equal((await api(env,base+'/events','POST',{
    type:'set-website-requirements',expectedRevision:1,requirements:req})).status,200);
  assert.equal((await api(env,base+'/events','POST',{
    type:'review-request',expectedRevision:2})).status,200);
  assert.equal((await api(env,base+'/events','POST',{
    type:'prepare-quote',expectedRevision:3,tier:2,fixedQuoteCAD:1200})).status,200);
  assert.equal((await api(env,base+'/staging-draft','POST',{
    synthetic:true,expectedRevision:4})).status,201);
}
test('real saved fictional case preview passes both local structure and generic QA',async()=>{
  const f=fixture(),id='QA_SECTION_001';
  try {
    await prepare(f.env,id);
    const qa=await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'quality-checker',action:'review',input:{}
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_PASSED');
    assert.equal(qa.data.result.casePreviewStructure.status,'LOCAL_STRUCTURE_CHECKS_PASSED');
    assert.equal(qa.data.result.casePreviewStructure.readyForCustomerPublishing,false);
    assert.equal(qa.data.project.qaPassed,true);
    const audit=await api(f.env,'/api/business/cases/'+id+'/preview-audit');
    assert.equal(audit.status,200);
    assert.equal(audit.data.localQaPreviouslyRecorded,true);
  }finally{f.close();}
});
test('tampered case HTML cannot pass QA even if old generic HTML markers are present',async()=>{
  const f=fixture(),id='QA_SECTION_002';
  try {
    await prepare(f.env,id);
    const old=f.sql.prepare('SELECT draft_html FROM projects WHERE id=?').get(id).draft_html;
    assert.match(old,/id="contact" data-page="contact"/);
    const broken=old.replace('id="contact" data-page="contact"',
      'id="hidden" data-page="contact"');
    assert.match(broken,/STAGING TEST/);
    assert.match(broken,/noindex,nofollow/);
    f.sql.prepare('UPDATE projects SET draft_html=? WHERE id=?').run(broken,id);
    const qa=await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'quality-checker',action:'review',input:{
        html:'<html lang="en"><meta name="viewport"><p>FORGED CLIENT HTML</p></html>'
      }
    });
    assert.equal(qa.status,201);
    assert.equal(qa.data.result.status,'LOCAL_QA_FAILED');
    assert.equal(qa.data.result.casePreviewStructure.checks.sectionCoverage,false);
    assert.equal(qa.data.project.qaPassed,false);
    const approval=await api(f.env,'/api/projects/'+id+'/simulate-approval','POST',
      {synthetic:true,role:'owner',version:1});
    assert.equal(approval.status,400);
    const publishing=await api(f.env,'/api/jobs','POST',{
      synthetic:true,projectId:id,role:'publishing',action:'readiness',input:{}
    });
    assert.equal(publishing.data.result.status,'NOT_PUBLISHED');
    assert.equal(publishing.data.result.deploymentsPerformed,0);
  }finally{f.close();}
});
