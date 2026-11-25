import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {WEBSITE_DELIVERY_POLICY,deliveryPolicyForProject} from '../src/website-delivery-policy.mjs';

test('website manager never permits website release on missing independent release evidence',()=>{
  assert.equal(WEBSITE_DELIVERY_POLICY.status,'BLOCKED_QA');
  assert.equal(WEBSITE_DELIVERY_POLICY.ownerPreviewAllowed,false);
  assert.equal(WEBSITE_DELIVERY_POLICY.customerPreviewAllowed,false);
  assert.equal(WEBSITE_DELIVERY_POLICY.customerPublishingAllowed,false);
  assert.equal(WEBSITE_DELIVERY_POLICY.deliveryAdapterReady,false);
  assert.equal(WEBSITE_DELIVERY_POLICY.anyRevisionInvalidatesQA,true);
});
test('all current staging projects are blocked even with local QA and fake approvals',()=>{
  for(const project of [null,{},{
    version:1,qa_passed:1,owner_approved:1,customer_approved:1
  },{
    version:2,qa_passed:1,owner_approved:2,customer_approved:2
  }]){
    const p=deliveryPolicyForProject(project);
    assert.equal(p.status,'BLOCKED_QA');
    assert.equal(p.ownerPreviewAllowed,false);
    assert.equal(p.customerPreviewAllowed,false);
    assert.equal(p.customerPublishingAllowed,false);
  }
});
test('owner-only Manager status clearly reports release blocked for owner AND customer',async()=>{
  const token='v'.repeat(64);
  const r=await worker.fetch(new Request('https://staging.test/api/status',{
    headers:{authorization:'Bearer '+token}
  }),{MANAGER_OWNER_TOKEN:token});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.websiteDelivery.status,'BLOCKED_QA');
  assert.equal(data.websiteDelivery.ownerPreviewAllowed,false);
  assert.equal(data.websiteDelivery.customerPreviewAllowed,false);
  assert.equal(data.websiteDelivery.deliveryAdapterReady,false);
  assert.equal(data.publishEnabled,false);
});
