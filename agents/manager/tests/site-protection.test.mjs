import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {HQ_DISRUPTIVE_ACTIONS,rejectHeadquartersAvailabilityChange} from '../src/site-protection.mjs';

const TOKEN='q'.repeat(64);
const send=(action,authorized=true)=>worker.fetch(new Request('https://staging.example/api/sites/headquarters/operations',{
  method:'POST',
  headers:{'content-type':'application/json',...(authorized?{authorization:`Bearer ${TOKEN}`}:{})},
  body:JSON.stringify({synthetic:true,action,ownerApproved:true,customerFailedToPay:true})
}),{MANAGER_OWNER_TOKEN:TOKEN});

test('All disruptive HQ actions require separate verified owner authorization',()=>{
  for(const action of HQ_DISRUPTIVE_ACTIONS){
    assert.throws(()=>rejectHeadquartersAvailabilityChange(action),e=>e.status===403);
  }
});

test('Unknown action cannot sidestep the HQ protection gate',()=>{
  assert.throws(()=>rejectHeadquartersAvailabilityChange(''),e=>e.status===400);
});

test('Even authenticated Manager with unverified approval flag cannot unpublish HQ',async()=>{
  for(const action of ['unpublish','suspend','remove-dns','disconnect-domain']){
    const r=await send(action);
    assert.equal(r.status,403,action);
    assert.match((await r.json()).error,/owner approval is required/i);
  }
});

test('Unauthenticated HQ offline attempt is denied',async()=>{
  const r=await send('unpublish',false);
  assert.equal(r.status,401);
});

test('Manager reports HQ protection and unavailable site operations',async()=>{
  const r=await worker.fetch(new Request('https://staging.example/api/status',{
    headers:{authorization:`Bearer ${TOKEN}`}
  }),{MANAGER_OWNER_TOKEN:TOKEN});
  const j=await r.json();
  assert.equal(j.headquartersProtection.automaticShutdownAllowed,false);
  assert.equal(j.headquartersProtection.ownerApprovalRequired,true);
  assert.equal(j.headquartersProtection.ownerApprovalVerifierConnected,false);
  assert.equal(j.headquartersProtection.siteOperationsAvailable,false);
});
