import test from 'node:test';
import assert from 'node:assert/strict';
import {runRole} from '../src/roles.mjs';

const sample=()=>({
  fictional:true,tier:4,business:'Fictional Maple Cafe',
  goal:'Create a sample cafe site with menu and business hours',
  features:['Menu','Photo gallery','Contact page']
});

test('Sales Agent drafts a structured synthetic handoff, not a real customer order',()=>{
  const r=runRole('sales','prepare-order',sample());
  assert.equal(r.agent,'sales');
  assert.equal(r.status,'DRAFT_ORDER_NOT_SUBMITTED');
  assert.equal(r.package,'Professional');
  assert.deepEqual(r.priceRangeCAD,[2300,3000]);
  assert.deepEqual(r.scope.features,['Menu','Photo gallery','Contact page']);
  for(const key of ['exactQuoteAgreed','consentVerified','customerAccountCreated',
    'kimiBuildTriggered','realOrderCreated','invoiceCreated','paymentCharged',
    'publicationAuthorized'])assert.equal(r[key],false,key);
});

test('Every approved price band maps to the correct package',()=>{
  const kinds=['Simple','Simple','Professional','Professional','Advanced','Advanced'];
  for(let tier=1;tier<=6;tier++){
    const r=runRole('sales','prepare-order',{...sample(),tier});
    assert.equal(r.package,kinds[tier-1]);
  }
});

test('Real or incomplete orders are rejected before any handoff',()=>{
  assert.throws(()=>runRole('sales','prepare-order',{...sample(),fictional:false}),/Fictional/);
  assert.throws(()=>runRole('sales','prepare-order',{...sample(),tier:0}),/tier/);
  assert.throws(()=>runRole('sales','prepare-order',{...sample(),goal:'short'}),/goal/);
});

test('Direct Sales Agent invocation also rejects contact information',()=>{
  assert.throws(()=>runRole('sales','prepare-order',
    {...sample(),goal:'Email sample@example.com about the website project'}),/Contact/);
  assert.throws(()=>runRole('sales','prepare-order',
    {...sample(),features:['Call 416-555-0199 to discuss booking']}),/Contact/);
});

test('Fictional features are bounded and markup escaped',()=>{
  assert.throws(()=>runRole('sales','prepare-order',
    {...sample(),features:Array(9).fill('Feature')}),/eight/);
  assert.throws(()=>runRole('sales','prepare-order',
    {...sample(),features:['']}),/short fictional/);
  const r=runRole('sales','prepare-order',
    {...sample(),business:'Fictional <script> Cafe'});
  assert.match(r.scope.business,/&lt;script&gt;/);
});

test('24-hour trial is informational and does not activate publication or payment',()=>{
  const r=runRole('sales','trial-terms');
  assert.equal(r.standardTrialHours,24);
  assert.equal(r.optionalExpressTrialHours,4);
  assert.equal(r.paymentDeadlineHoursAfterVerifiedGoLive,24);
  assert.equal(r.suspensionRequiresSeparateVerifiedOwnerApproval,true);
  assert.equal(r.autoSuspendOnNonpayment,false);
  assert.equal(r.trialPublicationEnabled,false);
  assert.equal(r.realInvoicesEnabled,false);
  assert.equal(r.paymentsEnabled,false);
  assert.equal(r.headquartersMayBeTakenOfflineAutomatically,false);
});
