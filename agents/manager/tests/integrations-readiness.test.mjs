import test from 'node:test';
import assert from 'node:assert/strict';
import {runRole} from '../src/roles.mjs';
import {createKimiAdapter} from '../src/kimi-adapter.mjs';

const draft=(args={})=>runRole('sales','draft-email',{
  fictional:true,businessType:'fictional neighborhood cafe',
  websiteGoal:'a menu and an accessible booking page',...args
});

test('Sales email is a draft with no sending, unverified consent and clear unsubscribe requirement',()=>{
  const d=draft();
  assert.equal(d.status,'DRAFT_ONLY_NOT_READY_TO_SEND');
  assert.match(d.body,/MapleWeb AI/);
  assert.match(d.body,/unsubscribe method required/i);
  assert.match(d.body,/neighborhood cafe/);
  assert.equal(d.recipientEmail,null);
  for(const key of ['consentVerified','suppressionChecked','senderIdentityVerified',
    'unsubscribeOperational','emailServiceConfigured','deliveryEnabled','sendingAuthorized'])
    assert.equal(d[key],false,key);
  assert.equal(d.messagesSent,0);
});

test('Email opt-out and refusal preempt all drafting and follow-up',()=>{
  for(const field of ['doNotContact','optedOut','customerDeclined']){
    const d=draft({[field]:true});
    assert.equal(d.status,'BLOCKED_DO_NOT_CONTACT');
    assert.equal(d.body,null);
    assert.equal(d.subject,null);
    assert.equal(d.sendingAuthorized,false);
    assert.equal(d.requiresSuppressionRecord,true);
  }
});

test('Email drafting refuses real customer payload, markup and header injection',()=>{
  assert.throws(()=>draft({fictional:false}),/Fictional/);
  assert.throws(()=>draft({businessType:'cafe\nBCC: any'}),/plain-text/);
  assert.throws(()=>draft({websiteGoal:'<script>alert(1)</script>'}),/plain-text/);
  assert.throws(()=>draft({businessType:'x'.repeat(70)}),/fictional/);
});

test('Kimi adapter exposes requested contract but cannot claim connectivity',async()=>{
  const a=createKimiAdapter();
  const s=a.status();
  for(const key of ['connected','modelVerified','paidUsageAuthorized',
    'canCreateDraft','canRequestRevision','canExport',
    'customerDataTransferEnabled','publishingEnabled']) assert.equal(s[key],false,key);
  assert.equal(typeof a.createDraft,'function');
  assert.equal(typeof a.requestRevision,'function');
  assert.equal(typeof a.getExport,'function');
  assert.equal(typeof a.estimateCost,'function');
  await assert.rejects(a.createDraft({synthetic:true,goal:'Fictional cafe'}),/KIMI_NOT_CONNECTED/);
  await assert.rejects(a.requestRevision(1,'Change the layout'),/KIMI_NOT_CONNECTED/);
  await assert.rejects(a.getExport(1),/KIMI_NOT_CONNECTED/);
  assert.equal((await a.estimateCost()).amount,null);
});
test('Kimi adapter blocks malformed project requests before external activity',async()=>{
  const a=createKimiAdapter();
  await assert.rejects(a.createDraft({synthetic:false}),/Synthetic/);
  await assert.rejects(a.requestRevision(0,'revise'),/Valid draft/);
  await assert.rejects(a.getExport(-2),/Valid draft/);
});
