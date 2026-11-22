import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {ROLES} from '../../manager/src/roles.mjs';
const TOKEN='staging-demo-token-which-is-not-a-real-secret';
const base='https://example.workers.dev';
const env=role=>({ROLE_NAME:role,ROLE_INTERNAL_TOKEN:TOKEN});
const request=(path,role,body,token=TOKEN)=>worker.fetch(new Request(base+path,{
  method:'POST',headers:{'authorization':'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({synthetic:true,...body})
}),env(role));
const cases={
 'website-developer':{action:'build-draft',input:{business:'Fictional Bakery',description:'Demo website for a fictional bakery'}},
 'customer-care':{action:'intake'},
 'sales':{action:'quote',input:{tier:1}},
 'research':{action:'plan',input:{sector:'fictional retail'}},
 'quality-checker':{action:'review',input:{html:'<html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">STAGING TEST noindex,nofollow</html>'}},
 'support':{action:'triage',input:{category:'general'}},
 'finance':{action:'status'},
 'publishing':{action:'readiness'},
};
for(const role of ROLES){
 test(role+' health is only a staging role response',async()=>{
   const res=await worker.fetch(new Request(base+'/health'),env(role));
   assert.equal(res.status,200);
   const j=await res.json();
   assert.equal(j.agent,role);assert.equal(j.healthy,true);assert.equal(j.mode,'staging');
   assert.equal(j.deterministic,true);
   assert.equal(j.paymentsEnabled,false);assert.equal(j.publishingEnabled,false);
 });
 test(role+' accepts a synthetic authorized job',async()=>{
   const res=await request('/execute',role,cases[role]);
   assert.equal(res.status,200);const j=await res.json();
   assert.equal(j.agent,role);assert.equal(j.executed,true);assert.equal(j.result.agent,role);
 });
}
test('wrong internal bearer token rejected',async()=>{
  const res=await request('/execute','sales',cases.sales,'wrong');
  assert.equal(res.status,401);
});
test('missing internal token fails closed',async()=>{
  const res=await worker.fetch(new Request(base+'/execute',{method:'POST',
    headers:{'authorization':'Bearer '+TOKEN,'content-type':'application/json'},
    body:JSON.stringify({synthetic:true,action:'status'})}),{ROLE_NAME:'finance'});
  assert.equal(res.status,503);
});
test('real customer requests are rejected',async()=>{
  const res=await worker.fetch(new Request(base+'/execute',{method:'POST',
    headers:{'authorization':'Bearer '+TOKEN,'content-type':'application/json'},
    body:JSON.stringify({synthetic:false,action:'quote',input:{tier:1}})}),env('sales'));
  assert.equal(res.status,400);
});
test('contact information is rejected even when synthetic is true',async()=>{
  const res=await request('/execute','customer-care',{action:'intake',input:{email:'someone@example.com'}});
  assert.equal(res.status,400);
});
test('unauthorized action and unknown role fail closed',async()=>{
  const x=await request('/execute','sales',{action:'charge-card'});
  assert.equal(x.status,400);
  const y=await worker.fetch(new Request(base+'/health'),env('not-an-agent'));
  assert.equal(y.status,503);
});
test('publishing cannot publish even with approvals',async()=>{
  const res=await request('/execute','publishing',{action:'readiness',context:{
    currentVersion:1,qaPassed:true,ownerApprovedVersion:1,customerApprovedVersion:1,revisionOpen:false
  }});
  assert.equal(res.status,200);
  const j=await res.json();
  assert.equal(j.result.status,'NOT_PUBLISHED');assert.equal(j.result.deploymentsPerformed,0);
});
