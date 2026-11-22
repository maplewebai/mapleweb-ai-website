import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {createStripeTestCheckout,receiveStripeTestWebhook,
  verifyStripeTestSignature,stripeTestStatus} from '../src/stripe-test.mjs';
import {newBusinessCase,applyOwnerCaseEvent} from '../src/business-cases.mjs';
import {addBusinessCase,updateBusinessCase} from '../src/business-cases-store.mjs';

const OWNER='s'.repeat(64);
const DB=()=>{
  const raw=new DatabaseSync(':memory:');
  for(const name of ['0001_init.sql','0002_business_cases.sql','0003_stripe_test.sql'])
    raw.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  return {db:{prepare(sql){
    let args=[];
    return {bind(...v){args=v;return this;},
      first(){return raw.prepare(sql).get(...args)||null;},
      all(){return {results:raw.prepare(sql).all(...args)};},
      run(){return raw.prepare(sql).run(...args)}};
  }},close(){raw.close()}};
};
const config=(db)=>({
  DB:db,MANAGER_OWNER_TOKEN:OWNER,BUSINESS_CASES_ENABLED:'true',
  STRIPE_TEST_CHECKOUT_ENABLED:'true',
  STRIPE_TEST_SECRET_KEY:'sk_test_'+'a'.repeat(25),
  STRIPE_TEST_WEBHOOK_SECRET:'whsec_'+'b'.repeat(32),
  STRIPE_TEST_RETURN_HOST:'preview.mapleweb.example',
  STRIPE_TEST_SUCCESS_URL:'https://preview.mapleweb.example/stripe/success?session_id={CHECKOUT_SESSION_ID}',
  STRIPE_TEST_CANCEL_URL:'https://preview.mapleweb.example/stripe/cancel'
});
async function caseWithQuote(env,caseId='TEST_CASE',tier=2,amount=1200){
  let record=newBusinessCase({caseId});
  await addBusinessCase(env,record);
  let updated=applyOwnerCaseEvent(record,{type:'review-request'});
  await updateBusinessCase(env,record,updated);
  record=updated;
  updated=applyOwnerCaseEvent(record,{type:'prepare-quote',tier,fixedQuoteCAD:amount});
  await updateBusinessCase(env,record,updated);
  return updated;
}
const fakeStripe=(handler)=>async(url,init)=>{
  assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
  assert.match(init.headers.Authorization,/^Bearer sk_test_/);
  assert.equal(init.method,'POST');
  assert.match(init.headers['Idempotency-Key'],/^mapleweb-test-/);
  const body=new URLSearchParams(init.body);
  if(handler)handler(body);
  return Response.json({
    id:'cs_test_EXAMPLE12345678',url:'https://checkout.stripe.com/c/pay/cs_test_EXAMPLE12345678',
    mode:'payment',livemode:false,currency:'cad',
    amount_total:Number(body.get('line_items[0][price_data][unit_amount]'))
  });
};
const event=(type='checkout.session.completed',status='paid',id='evt_TEST001')=>({
  id,type,livemode:false,data:{object:{
    id:'cs_test_EXAMPLE12345678',mode:'payment',livemode:false,
    payment_status:status,amount_total:120000,currency:'cad',
    client_reference_id:'TEST_CASE',metadata:{case_id:'TEST_CASE',quote_revision:'3'}
  }}
});
async function signedRequest(body,secret,epoch=Math.floor(Date.now()/1000)){
  const text=JSON.stringify(body);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(epoch+'.'+text));
  const header='t='+epoch+',v1='+Buffer.from(sig).toString('hex');
  return new Request('https://manager.test/api/payments/test-webhook',{
    method:'POST',headers:{'Stripe-Signature':header},body:text
  });
}
const api=async(env,path,method='GET',payload,authenticated=true)=>{
  const result=await worker.fetch(new Request('https://manager.test'+path,{
    method,headers:{...(authenticated?{authorization:'Bearer '+OWNER}:{}),
      ...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})
  }),env);
  return {status:result.status,data:await result.json()};
};

test('Stripe is disabled unless explicitly configured; no live payments enabled',async()=>{
  assert.equal(stripeTestStatus({}).checkoutConfigured,false);
  assert.equal(stripeTestStatus({}).livePaymentsEnabled,false);
  const x=DB();
  try{
    const disabled=await api({DB:x.db,MANAGER_OWNER_TOKEN:OWNER},
      '/api/payments/test-checkout','POST',{synthetic:true,caseId:'TEST_CASE'});
    assert.equal(disabled.status,503);
    assert.equal((await api({DB:x.db,MANAGER_OWNER_TOKEN:OWNER},
      '/api/payments/test-status','GET',undefined,false)).status,401);
    assert.equal((await api(config(x.db),'/api/payments/test-status')).data.mode,'test-only');
    const denied=await api(config(x.db),'/api/payments/test-checkout','POST',
      {synthetic:true,caseId:'TEST_CASE',price:1});
    assert.equal(denied.status,400);
  }finally{x.close();}
});
test('live keys are never allowed on sandbox Checkout',async()=>{
  const x=DB();
  try{
    const env={...config(x.db),STRIPE_TEST_SECRET_KEY:'sk_live_'+'a'.repeat(25)};
    await assert.rejects(createStripeTestCheckout(env,{synthetic:true,caseId:'TEST_CASE'},
      ()=>{throw Error('Must not call Stripe');}),/test mode only/);
  }finally{x.close();}
});
test('server enforces stored CAD amount and reuses only one test Checkout session',async()=>{
  const x=DB();
  try{
    const env=config(x.db);
    const c=await caseWithQuote(env);
    let calls=0;
    const fake=fakeStripe(body=>{
      calls++;
      assert.equal(body.get('line_items[0][price_data][currency]'),'cad');
      assert.equal(body.get('line_items[0][price_data][unit_amount]'),'120000');
      assert.equal(body.get('client_reference_id'),'TEST_CASE');
      assert.equal(body.get('metadata[quote_revision]'),String(c.revision));
      assert.equal(body.get('mode'),'payment');
      assert.equal(body.get('payment_method_types[0]'),'card');
    });
    const first=await createStripeTestCheckout(env,{synthetic:true,caseId:'TEST_CASE'},fake);
    assert.equal(first.mode,'test');
    assert.equal(first.realPayment,false);
    assert.equal(first.reused,false);
    const second=await createStripeTestCheckout(env,{synthetic:true,caseId:'TEST_CASE'},fake);
    assert.equal(second.reused,true);
    assert.equal(second.sessionId,first.sessionId);
    assert.equal(calls,1);
  }finally{x.close();}
});
test('Stripe test webhook validates signature, matching quote and amount, ignores replay',async()=>{
  const x=DB();
  try{
    const env=config(x.db);
    await caseWithQuote(env);
    await createStripeTestCheckout(env,{synthetic:true,caseId:'TEST_CASE'},fakeStripe());
    const payload=event();
    const req=await signedRequest(payload,env.STRIPE_TEST_WEBHOOK_SECRET);
    const res=await receiveStripeTestWebhook(env,req);
    assert.equal(res.state,'PAID_TEST');
    assert.equal(res.realPaymentsEnabled,false);
    assert.equal(res.deliveryEnabled,false);
    const row=await x.db.prepare('SELECT state FROM stripe_test_sessions WHERE case_id=?')
      .bind('TEST_CASE').first();
    assert.equal(row.state,'PAID_TEST');
    const again=await receiveStripeTestWebhook(env,
      await signedRequest(payload,env.STRIPE_TEST_WEBHOOK_SECRET));
    assert.equal(again.reason,'duplicate');
    const expired=await receiveStripeTestWebhook(env,
      await signedRequest(event('checkout.session.expired','unpaid','evt_TEST002'),
        env.STRIPE_TEST_WEBHOOK_SECRET));
    assert.equal(expired.state,'PAID_TEST'); // never downgrade successful test payment
    const signatureFail=await api(env,'/api/payments/test-webhook','POST',payload,false);
    assert.equal(signatureFail.status,401);
  }finally{x.close();}
});
test('webhook rejects forged, stale and live-mode events',async()=>{
  const x=DB();
  try{
    const env=config(x.db);
    let c=await caseWithQuote(env);
    await createStripeTestCheckout(env,{synthetic:true,caseId:'TEST_CASE'},fakeStripe());
    const bogus=await signedRequest(event(),env.STRIPE_TEST_WEBHOOK_SECRET);
    assert.equal(await verifyStripeTestSignature(await bogus.text(),'t=1,v1='+'a'.repeat(64),
      env.STRIPE_TEST_WEBHOOK_SECRET),false);
    const live=event('checkout.session.completed','paid','evt_TEST004');
    live.livemode=true;
    await assert.rejects(receiveStripeTestWebhook(env,
      await signedRequest(live,env.STRIPE_TEST_WEBHOOK_SECRET)),/Only signed Stripe test-mode/);
    let next=applyOwnerCaseEvent(c,{type:'prepare-quote',tier:2,fixedQuoteCAD:1300});
    await updateBusinessCase(env,c,next);
    await assert.rejects(receiveStripeTestWebhook(env,
      await signedRequest(event('checkout.session.completed','paid','evt_TEST005'),
        env.STRIPE_TEST_WEBHOOK_SECRET)),/does not match current test quote/);
  }finally{x.close();}
});
test('no production payment or customer delivery route exists',async()=>{
  const x=DB();
  try{
    const env=config(x.db);
    for(const path of ['/api/payments/live-checkout','/api/payments/charge',
      '/api/payments/refund','/api/deploy'])
      assert.equal((await api(env,path,'POST',{})).status,404);
  }finally{x.close();}
});
