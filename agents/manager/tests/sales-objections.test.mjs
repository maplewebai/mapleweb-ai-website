import test from 'node:test';
import assert from 'node:assert/strict';
import {runRole} from '../src/roles.mjs';

const ask=(reason,other={})=>runRole('sales','handle-objection',{reason,...other});

test('hesitant customer gets a respectful value explanation and one optional question',()=>{
  const r=ask('hesitant');
  assert.equal(r.status,'DRAFT_REPLY_ONLY');
  assert.match(r.reply,/website may help/i);
  assert.match(r.reply,/stop if you prefer/i);
  assert.equal(r.followUpAllowed,true);
  assert.equal(r.maxOptionalFollowUpsPerConversation,1);
  assert.equal(r.messageSent,false);
  assert.equal(r.callPlaced,false);
});

test('price objection does not guarantee results, fixed quotes, or fake discounts',()=>{
  const r=ask('price');
  assert.match(r.reply,/written quote/i);
  assert.match(r.reply,/smaller option/i);
  assert.doesNotMatch(r.reply,/guarantee|free forever|discount/i);
});

test('trust objection accurately distinguishes proposed trial from live functionality',()=>{
  const r=ask('trust');
  assert.match(r.reply,/24-hour trial/i);
  assert.match(r.reply,/not live/i);
  assert.equal(r.offerIsLive,false);
});

test('existing website and timing objections respect no purchase as a valid choice',()=>{
  assert.match(ask('already_has_site').reply,/may not need a replacement/i);
  assert.match(ask('timing').reply,/no rush/i);
});

test('explicit not interested closes conversation, no persuasion or later follow-up',()=>{
  const r=ask('not_interested');
  assert.equal(r.status,'CLOSE_CONVERSATION_NO_FOLLOWUP');
  assert.equal(r.followUpAllowed,false);
  assert.equal(r.requiresSuppressionRecord,true);
  assert.equal(r.suppressionRecorded,false);
  assert.equal(r.messageSent,false);
  assert.equal(r.callPlaced,false);
});

test('opt-out, declined, or do-not-contact always wins even over a price objection',()=>{
  for(const input of [
    {reason:'opt_out'},
    {reason:'price',customerDeclined:true},
    {reason:'trust',doNotContact:true}
  ]){
    const r=runRole('sales','handle-objection',input);
    assert.equal(r.status,'CLOSE_CONVERSATION_NO_FOLLOWUP');
    assert.equal(r.followUpAllowed,false);
    assert.equal(r.requiresSuppressionRecord,true);
  }
});

test('only one optional response is permitted before closing the conversation',()=>{
  const r=ask('hesitant',{followUpsThisConversation:1});
  assert.equal(r.status,'CLOSE_CONVERSATION_NO_FOLLOWUP');
  assert.equal(r.followUpAllowed,false);
  assert.equal(r.callPlaced,false);
});

test('invalid inputs do not create follow-up permissions',()=>{
  assert.throws(()=>ask('unknown'),/supported objection reason/i);
  assert.throws(()=>ask('price',{followUpsThisConversation:-1}),/follow-up count/i);
  assert.throws(()=>ask('price',{followUpsThisConversation:1.5}),/follow-up count/i);
});

test('all objection handling remains offline, with no payment or contact actions',()=>{
  for(const reason of ['hesitant','price','timing','trust','already_has_site','not_interested','opt_out','other']){
    const r=ask(reason);
    assert.equal(r.messageSent,false);
    assert.equal(r.callPlaced,false);
    assert.equal(r.paymentCharged,false);
  }
});
