import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {createSyntheticSitePreview,auditSyntheticSitePreview,
  SYNTHETIC_PREVIEW_MAX_HTML} from '../src/synthetic-site-preview.mjs';
import {newBusinessCase,applyOwnerCaseEvent} from '../src/business-cases.mjs';
import {WEBSITE_REQUIREMENT_OPTIONS} from '../src/order-requirements.mjs';

const token='v'.repeat(64);
const requirements=()=>({
  businessCategory:'restaurant',websiteGoal:'booking-inquiry',
  style:'classic',language:'en-fr',
  pages:['home','about','menu','contact','booking','privacy'],
  features:['gallery','faq','menu','booking-inquiry','multilingual','accessibility']
});
function dbFixture() {
  const sql=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_business_cases.sql'])
    sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return {
    sql,DB:{prepare(stmt){let args=[];return {
      bind(...v){args=v;return this;},
      first(){return sql.prepare(stmt).get(...args)||null;},
      all(){return {results:sql.prepare(stmt).all(...args)};},
      run(){return sql.prepare(stmt).run(...args);}
    };}},close(){sql.close();}
  };
}
async function call(env,path,method='GET',body,authenticated=true){
  const r=await worker.fetch(new Request('https://staging.test'+path,{
    method,headers:{...(authenticated?{authorization:'Bearer '+token}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
test('fictional responsive preview displays real sections, anchors and honest feature placeholders',()=>{
  const req=requirements();
  const a=createSyntheticSitePreview(req),b=createSyntheticSitePreview(req);
  assert.deepEqual(a,b);
  assert.equal(a.realMultiPageSite,false);
  assert.equal(a.functionalIntegrations,false);
  assert.equal(a.liveBusinessContent,false);
  assert.ok(a.html.length<SYNTHETIC_PREVIEW_MAX_HTML);
  assert.match(a.html,/name="viewport"/);
  assert.match(a.html,/noindex,nofollow/);
  assert.match(a.html,/STAGING TEST/);
  assert.match(a.html,/@media/);
  assert.match(a.html,/<nav aria-label=/);
  assert.match(a.html,/lang="fr"/);
  for(const page of req.pages){
    assert.ok(a.html.includes('id="'+page+'" data-page="'+page+'"'));
    assert.ok(a.html.includes('href="#'+page+'"'));
  }
  for(const feature of req.features){
    assert.ok(a.html.includes('data-feature="'+feature+'"'));
  }
  assert.doesNotMatch(a.html,/<(?:script|form|iframe)\b/i);
  assert.doesNotMatch(a.html,/https?:\/\//);
  const audited=auditSyntheticSitePreview(a.html,req);
  assert.equal(audited.status,'LOCAL_STRUCTURE_CHECKS_PASSED');
  assert.equal(audited.requestedSections,6);
  assert.equal(audited.requestedFeaturePlaceholders,6);
  assert.equal(audited.actualSeparatePagesBuilt,false);
  assert.equal(audited.realFeatureFunctionalityVerified,false);
  assert.equal(audited.browserAccessibilityVerified,false);
  assert.equal(audited.browserResponsiveLayoutVerified,false);
  assert.equal(audited.readyForCustomerPublishing,false);
});
test('all eight static sections and features fit the HTML budget without pretending to be production',()=>{
  const req={
    businessCategory:'professional-services',websiteGoal:'information',
    style:'modern',language:'en-fr',
    pages:WEBSITE_REQUIREMENT_OPTIONS.pages.slice(0,8),
    features:WEBSITE_REQUIREMENT_OPTIONS.features
  };
  const result=createSyntheticSitePreview(req);
  assert.ok(result.html.length<=SYNTHETIC_PREVIEW_MAX_HTML,result.html.length+' > '+SYNTHETIC_PREVIEW_MAX_HTML);
  assert.equal(auditSyntheticSitePreview(result.html,req).status,'LOCAL_STRUCTURE_CHECKS_PASSED');
});
test('all supported style and language combinations render safely',()=>{
  for(const style of WEBSITE_REQUIREMENT_OPTIONS.style)
    for(const language of WEBSITE_REQUIREMENT_OPTIONS.language){
      const req={...requirements(),style,language,features:['gallery']};
      const p=createSyntheticSitePreview(req);
      const q=auditSyntheticSitePreview(p.html,req);
      assert.equal(q.status,'LOCAL_STRUCTURE_CHECKS_PASSED',style+' '+language);
      assert.equal(p.html.includes('<html lang="fr">'),language==='fr');
    }
});
test('structural audit rejects missing sections, malicious scripts and external links',()=>{
  const req=requirements();
  const html=createSyntheticSitePreview(req).html;
  const samples=[
    html.replace('id="booking" data-page="booking"','id="missing" data-page="booking"'),
    html.replace('href="#home"','href="https://unexpected.example"'),
    html.replace('</footer>','<script>alert(1)</script></footer>'),
    html.replace('</main>','<form action="https://unknown.example"></form></main>'),
    html.replace('STAGING TEST — NOT A CUSTOMER WEBSITE','UNMARKED CONTENT'),
    html.replace('data-feature="gallery"','data-feature="missing"')
  ];
  for(const sample of samples){
    const checked=auditSyntheticSitePreview(sample,req);
    assert.equal(checked.status,'LOCAL_STRUCTURE_CHECKS_FAILED');
    assert.equal(checked.readyForCustomerPublishing,false);
  }
  assert.throws(()=>createSyntheticSitePreview({...req,
    businessCategory:'<script>alert(1)</script>'}));
  assert.throws(()=>createSyntheticSitePreview({...req,
    pages:['home','home']}));
});
test('owner-only preview audit reads saved HTML and refuses uncreated or tampered previews',async()=>{
  const f=dbFixture();
  const env={DB:f.DB,MANAGER_OWNER_TOKEN:token,BUSINESS_CASES_ENABLED:'true'};
  const base='/api/business/cases/PREVIEW_001';
  try{
    assert.equal((await call(env,base+'/preview-audit','GET',null,false)).status,401);
    assert.equal((await call(env,base+'/preview-audit')).status,404);
    assert.equal((await call(env,'/api/business/cases','POST',{caseId:'PREVIEW_001'})).status,201);
    assert.equal((await call(env,base+'/preview-audit')).status,404);
    const saved=await call(env,base+'/events','POST',{
      type:'set-website-requirements',expectedRevision:1,requirements:requirements()
    });
    assert.equal(saved.status,200);
    assert.equal((await call(env,base+'/events','POST',
      {type:'review-request',expectedRevision:2})).status,200);
    assert.equal((await call(env,base+'/events','POST',
      {type:'prepare-quote',expectedRevision:3,tier:2,fixedQuoteCAD:1200})).status,200);
    const drafted=await call(env,base+'/staging-draft','POST',
      {synthetic:true,expectedRevision:4});
    assert.equal(drafted.status,201,JSON.stringify(drafted.data));
    const result=await call(env,base+'/preview-audit');
    assert.equal(result.status,200);
    assert.equal(result.data.status,'LOCAL_STRUCTURE_CHECKS_PASSED');
    assert.equal(result.data.caseId,'PREVIEW_001');
    assert.equal(result.data.projectVersion,1);
    assert.equal(result.data.localQaPreviouslyRecorded,false);
    assert.equal(result.data.readyForCustomerPublishing,false);
    const persisted=f.sql.prepare('SELECT draft_html FROM projects WHERE id=?')
      .get('PREVIEW_001').draft_html;
    f.sql.prepare('UPDATE projects SET draft_html=? WHERE id=?').run(
      persisted.replace('id="home" data-page="home"','id="broken" data-page="home"'),
      'PREVIEW_001'
    );
    const invalid=await call(env,base+'/preview-audit');
    assert.equal(invalid.status,200);
    assert.equal(invalid.data.status,'LOCAL_STRUCTURE_CHECKS_FAILED');
    assert.equal(invalid.data.checks.sectionCoverage,false);
    assert.equal(invalid.data.readyForCustomerPublishing,false);
  }finally{f.close();}
});
