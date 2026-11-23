import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {buildFictionalSiteBundle,auditFictionalSiteBundle} from '../src/fictional-site-bundle.mjs';
import {WEBSITE_REQUIREMENT_OPTIONS} from '../src/order-requirements.mjs';

const TOKEN='u'.repeat(64);
const requirements=()=>({
  businessCategory:'professional-services',websiteGoal:'leads',style:'classic',
  language:'en-fr',pages:['home','about','services','portfolio','contact','privacy'],
  features:['gallery','faq','multilingual','accessibility']
});
function fixture() {
  const raw=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_business_cases.sql'])
    raw.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return {raw,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let args=[];return {
      bind(...a){args=a;return this;},
      first(){return raw.prepare(sql).get(...args)||null;},
      all(){return {results:raw.prepare(sql).all(...args)};},
      run(){return raw.prepare(sql).run(...args);}
    };}}},close(){raw.close();}};
}
async function api(env,path,method='GET',body,authorized=true){
  const r=await worker.fetch(new Request('https://staging.test'+path,{
    method,headers:{...(authorized?{authorization:'Bearer '+TOKEN}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
test('deterministic fictional bundle has real local page files and nav but never working integrations',()=>{
  const first=buildFictionalSiteBundle(requirements());
  assert.deepEqual(first,buildFictionalSiteBundle(requirements()));
  assert.equal(first.totalFiles,8);
  assert.deepEqual(Object.keys(first.files),[
    'styles.css','index.html','about.html','services.html','portfolio.html',
    'contact.html','privacy.html','robots.txt']);
  assert.match(first.files['styles.css'],/@media/);
  assert.match(first.files['index.html'],/<main id="content">/);
  assert.match(first.files['index.html'],/href="portfolio.html"/);
  assert.match(first.files['portfolio.html'],/href="index.html"/);
  assert.match(first.files['portfolio.html'],/aria-current="page"/);
  assert.match(first.files['index.html'],/data-feature="multilingual"/);
  assert.match(first.files['index.html'],/lang="fr"/);
  assert.doesNotMatch(first.files['index.html'],/<form\b|<script\b/i);
  assert.equal(first.liveCustomerContent,false);
  assert.equal(first.liveBookingsEnabled,false);
  assert.equal(first.hosted,false);
  assert.equal(first.published,false);
  const audit=auditFictionalSiteBundle(first,requirements());
  assert.equal(audit.status,'LOCAL_STATIC_BUNDLE_CHECKS_PASSED',JSON.stringify(audit.checks));
  assert.equal(audit.readyToPublish,false);
  assert.equal(audit.realBrowserTested,false);
});
test('all allowed pages and features fit the bounded multi-page bundle',()=>{
  const r={...requirements(),style:'modern',language:'en-fr',
    pages:['home','about','services','products','menu','portfolio','faq','contact'],
    features:[...WEBSITE_REQUIREMENT_OPTIONS.features]};
  const bundle=buildFictionalSiteBundle(r);
  assert.equal(bundle.totalFiles,10);
  assert.ok(bundle.totalCharacters<=55000);
  assert.equal(auditFictionalSiteBundle(bundle,r).status,'LOCAL_STATIC_BUNDLE_CHECKS_PASSED');
  for(const page of r.pages) {
    const path=page==='home'?'index.html':page+'.html';
    assert.ok(Object.hasOwn(bundle.files,path));
  }
});
test('all language and visual styles generate a valid deterministic package',()=>{
  for(const style of WEBSITE_REQUIREMENT_OPTIONS.style)
    for(const language of WEBSITE_REQUIREMENT_OPTIONS.language){
      const r={...requirements(),style,language,features:['gallery']};
      const result=buildFictionalSiteBundle(r);
      assert.equal(auditFictionalSiteBundle(result,r).status,
        'LOCAL_STATIC_BUNDLE_CHECKS_PASSED',style+'/'+language);
      assert.equal(result.files['index.html'].includes('<html lang="fr">'),language==='fr');
    }
});
test('bundle audit detects missing pages, broken nav, scripts and search indexing',()=>{
  for(const change of [
    b=>{delete b.files['about.html'];},
    b=>{b.files['about.html']=b.files['about.html'].replace('href="index.html"','href="missing.html"');},
    b=>{b.files['index.html']+='<script>alert(1)</script>';},
    b=>{b.files['index.html']=b.files['index.html'].replace('noindex,nofollow','index,follow');},
    b=>{b.files['styles.css']='@import url(https://example.org/unsafe.css)';},
    b=>{b.files['index.html']=b.files['index.html'].replace('data-feature="gallery"','data-feature="missing"');}
  ]) {
    const b=buildFictionalSiteBundle(requirements());
    change(b);
    const result=auditFictionalSiteBundle(b,requirements());
    assert.equal(result.status,'LOCAL_STATIC_BUNDLE_CHECKS_FAILED',JSON.stringify(result.checks));
    assert.equal(result.readyToPublish,false);
  }
});
test('rejects arbitrary HTML and contact info rather than building untrusted sites',()=>{
  assert.throws(()=>buildFictionalSiteBundle({...requirements(),script:'alert(1)'}));
  assert.throws(()=>buildFictionalSiteBundle({...requirements(),
    businessCategory:'someone@example.com'}));
  assert.throws(()=>buildFictionalSiteBundle({...requirements(),pages:['home','home']}));
});
test('owner-only fictional site download requires a prepared quote and returns no live authorization',async()=>{
  const f=fixture();
  try {
    const base='/api/business/cases/BUNDLE_001';
    assert.equal((await api(f.env,base+'/fictional-bundle','GET',null,false)).status,401);
    assert.equal((await api(f.env,base+'/fictional-bundle')).status,404);
    assert.equal((await api(f.env,'/api/business/cases','POST',{caseId:'BUNDLE_001'})).status,201);
    assert.equal((await api(f.env,base+'/fictional-bundle')).status,400);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:1,type:'set-website-requirements',requirements:requirements()
    })).status,200);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:2,type:'review-request'
    })).status,200);
    assert.equal((await api(f.env,base+'/events','POST',{
      expectedRevision:3,type:'prepare-quote',tier:2,fixedQuoteCAD:1200
    })).status,200);
    const result=await api(f.env,base+'/fictional-bundle');
    assert.equal(result.status,200);
    assert.equal(result.data.caseRevision,4);
    assert.equal(result.data.bundle.totalFiles,8);
    assert.equal(result.data.audit.status,'LOCAL_STATIC_BUNDLE_CHECKS_PASSED');
    assert.equal(result.data.bundle.published,false);
    assert.equal(result.data.audit.readyToPublish,false);
    assert.equal((await api(f.env,'/api/status')).data.publishEnabled,false);
    f.env.BUSINESS_CASES_ENABLED='false';
    assert.equal((await api(f.env,base+'/fictional-bundle')).status,503);
  }finally{f.close();}
});
