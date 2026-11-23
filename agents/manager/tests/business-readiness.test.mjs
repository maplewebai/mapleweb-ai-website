import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {managerBusinessReadiness} from '../src/business-readiness.mjs';

const OWNER='owner'.repeat(16);
const ready=()=>({
  MANAGER_OWNER_TOKEN:OWNER,
  DB:{prepare(){throw Error('Never query DB for readiness status');}},
  BUSINESS_CASES_ENABLED:'true',
  CALLING_AGENT_URL:'https://mapleweb-calling-sales-staging.test.workers.dev',
  CALLING_AGENT_ADMIN_TOKEN:'secret'.repeat(8),
  CALLING_AGENT_INTEGRATION_ENABLED:'true',
  CALLING_MANAGER_CONTROLS_ENABLED:'true',
  CALLING_MANAGER_OUTBOUND_ENABLED:'true',
  CALLING_MANAGER_PAID_USAGE_APPROVED:'true',
  KIMI_API_KEY:'test-only',
  KIMI_MODEL_CALLS_ENABLED:'true',
  KIMI_PAID_USAGE_APPROVED:'true',
  STRIPE_TEST_SECRET_KEY:'sk_test_'+'a'.repeat(32),
  STRIPE_TEST_CHECKOUT_ENABLED:'true',
  STRIPE_TEST_WEBHOOK_SECRET:'whsec_fake',
  CLOUDFLARE_READ_TOKEN:'dummy',
  GITHUB_TOKEN:'dummy'
});
test('without credentials business readiness is conservative and no business is live',()=>{
  const r=managerBusinessReadiness({});
  assert.equal(r.totalAreas,10);
  assert.equal(r.areasVerifiedLive,0);
  assert.ok(r.modules.every(x=>x.verifiedLive===false));
  assert.ok(r.modules.every(x=>x.status==='NOT_CONNECTED'));
  assert.equal(r.canAcceptRealCustomers,false);
  assert.equal(r.canMakeOrReceiveLiveCallsVerified,false);
  assert.equal(r.canChargeRealCustomers,false);
  assert.equal(r.productionLaunchAuthorized,false);
  assert.equal(r.allRequirementsMet,false);
  assert.equal(r.modules.find(x=>x.id==='calling-sales').codePrepared,true);
  assert.equal(r.modules.find(x=>x.id==='customer-intake').codePrepared,false);
});
test('configured credentials and flags alone never become verified live connections',()=>{
  const r=managerBusinessReadiness(ready());
  assert.equal(r.areasVerifiedLive,0);
  assert.equal(r.modules.find(x=>x.id==='manager').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  assert.equal(r.modules.find(x=>x.id==='calling-sales').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  assert.equal(r.modules.find(x=>x.id==='kimi').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  assert.equal(r.modules.find(x=>x.id==='customer-planning').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  assert.equal(r.modules.find(x=>x.id==='case-tracking').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  assert.equal(r.modules.find(x=>x.id==='stripe-test').status,'CONFIGURED_NOT_LIVE_VERIFIED');
  for(const id of ['customer-intake','publishing','customer-approval','stripe-live'])
    assert.equal(r.modules.find(x=>x.id===id).status,'NOT_CONNECTED');
  assert.equal(r.canAutomaticallyBuildRealCustomerWebsites,false);
  assert.equal(r.canPublishRealCustomerWebsites,false);
  assert.equal(r.canMakeOrReceiveLiveCallsVerified,false);
  assert.equal(r.allRequirementsMet,false);
  assert.ok(!JSON.stringify(r).includes('sk_test_'));
  assert.ok(!JSON.stringify(r).includes(ready().CALLING_AGENT_ADMIN_TOKEN));
});
test('owner-only readiness endpoint never contacts paid services',async()=>{
  let networkCalls=0;
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{networkCalls++;throw Error('No network allowed');};
  try{
    const env=ready(),url='https://manager-staging.test/api/business/readiness';
    let res=await worker.fetch(new Request(url),env);
    assert.equal(res.status,401);
    res=await worker.fetch(new Request(url,{
      headers:{authorization:'Bearer '+OWNER}
    }),env);
    assert.equal(res.status,200);
    const j=await res.json();
    assert.equal(j.scope,'MAPLEWEB_PRIVATE_OWNER_READINESS_ONLY');
    assert.equal(j.totalAreas,10);
    assert.equal(j.areasVerifiedLive,0);
    assert.equal(j.allRequirementsMet,false);
    assert.equal(networkCalls,0);
  }finally{globalThis.fetch=original;}
});
test('wrong methods and absent owner token are denied',async()=>{
  const env=ready(),url='https://manager-staging.test/api/business/readiness';
  const res=await worker.fetch(new Request(url,{method:'POST',
    headers:{authorization:'Bearer '+OWNER,'content-type':'application/json'},
    body:'{"attempt":"fake activation"}'}),env);
  assert.equal(res.status,404);
  const missing=await worker.fetch(new Request(url),{});
  assert.equal(missing.status,503);
});
