import test from 'node:test';
import assert from 'node:assert/strict';
import {readStripeWebhookBody} from '../src/stripe-test.mjs';

const URL='https://private-staging.example/api/payments/test-webhook';
function incoming(text,headers={}) {
  return new Request(URL,{method:'POST',headers,body:text});
}
test('Stripe webhook buffer accepts a short valid event body',async()=>{
  const raw=JSON.stringify({id:'evt_TEST_1',livemode:false});
  assert.equal(await readStripeWebhookBody(incoming(raw)),raw);
});
test('Stripe webhook refuses oversized Content-Length before reading body',async()=>{
  await assert.rejects(readStripeWebhookBody(incoming('{}',{'content-length':'999999999'})),
    e=>e.status===413);
});
test('Stripe webhook refuses streamed oversized body when Content-Length is missing',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array(70000));},
    cancel(){cancelled=true;}
  });
  const request=new Request(URL,{method:'POST',body:stream,duplex:'half'});
  await assert.rejects(readStripeWebhookBody(request),e=>e.status===413);
  assert.equal(cancelled,true);
});
test('Stripe webhook rejects invalid UTF-8 before signature verification',async()=>{
  const req=new Request(URL,{method:'POST',
    body:new Uint8Array([0xc3,0x28])});
  await assert.rejects(readStripeWebhookBody(req),/Malformed Stripe test webhook text/);
});
test('Stripe webhook size check counts UTF-8 bytes, not JavaScript characters',async()=>{
  const body='é'.repeat(40000); // 80,000 bytes
  const req=incoming(body);
  await assert.rejects(readStripeWebhookBody(req),e=>e.status===413);
});
test('Stripe webhook cap permits exactly 64 KiB but refuses one byte more',async()=>{
  const ok='x'.repeat(65536);
  assert.equal((await readStripeWebhookBody(incoming(ok))).length,65536);
  await assert.rejects(readStripeWebhookBody(incoming(ok+'x')),e=>e.status===413);
});
