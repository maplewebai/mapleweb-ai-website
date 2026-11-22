// MapleWeb AI: server-only Stripe Checkout test-mode adapter.
// No live keys, no customer contact data, no customer delivery, no publishing.
// The test Checkout URL is available only to the authenticated owner.
import {bad,idIsSafe,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
import {readBusinessCase} from './business-cases-store.mjs';

const testKey = env => typeof env.STRIPE_TEST_SECRET_KEY==='string' &&
  /^sk_test_[A-Za-z0-9]{10,}$/.test(env.STRIPE_TEST_SECRET_KEY);
const testEnabled = env => env.STRIPE_TEST_CHECKOUT_ENABLED==='true' &&
  env.BUSINESS_CASES_ENABLED==='true' && testKey(env);
const fail = () => {throw bad('Stripe sandbox Checkout not configured (test mode only)',503);};
const httpsReturnUrl = (value,host) => {
  if(typeof value!=='string'||typeof host!=='string')throw bad('Stripe test redirect not configured',503);
  let url;
  try{url=new URL(value);}catch{throw bad('Invalid test return URL',503);}
  if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port)
    throw bad('Unsafe Stripe test return URL',503);
  return url.href;
};
const changeCount = r => Number(r?.meta?.changes ?? r?.changes ?? 0);
export function stripeTestStatus(env) {
  return {mode:'test-only',connectedToStripe:false,
    checkoutConfigured:testEnabled(env),
    databaseConfigured:!!env.DB,
    webhookConfigured:typeof env.STRIPE_TEST_WEBHOOK_SECRET==='string' &&
      env.STRIPE_TEST_WEBHOOK_SECRET.startsWith('whsec_'),
    livePaymentsEnabled:false,realCustomerPaymentsEnabled:false,
    automaticDeliveryEnabled:false,bankPayoutsEnabled:false};
}
export async function createStripeTestCheckout(env,payload,fetcher=fetch) {
  validateSynthetic(payload);
  if(Object.keys(payload).sort().join(',')!=='caseId,synthetic'||!idIsSafe(payload.caseId))
    throw bad('Only a fictional caseId is allowed');
  if(!testEnabled(env))fail();
  const db=requireDb(env);
  const stored=await readBusinessCase(env,payload.caseId);
  if(!stored||stored.stage!=='QUOTE_READY'||!stored.quote ||
     stored.quote.currency!=='CAD'||stored.quote.status!=='DRAFT_NOT_SENT')
    throw bad('An owner-reviewed fictional fixed quote is required',403);
  const amount=stored.quote.fixedQuoteCAD;
  if(!Number.isSafeInteger(amount)||amount<500||amount>7000)
    throw bad('Invalid stored quote',403);
  const revision=stored.revision;
  const existing=await db.prepare('SELECT session_id,checkout_url,state FROM stripe_test_sessions WHERE case_id=? AND quote_revision=?')
    .bind(stored.caseId,revision).first();
  if(existing)return {mode:'test',sessionId:existing.session_id,url:existing.checkout_url,
    state:existing.state,reused:true,realPayment:false};
  const host=env.STRIPE_TEST_RETURN_HOST;
  const success=httpsReturnUrl(env.STRIPE_TEST_SUCCESS_URL,host);
  const cancel=httpsReturnUrl(env.STRIPE_TEST_CANCEL_URL,host);
  const body=new URLSearchParams({
    mode:'payment',success_url:success,cancel_url:cancel,
    client_reference_id:stored.caseId,
    'payment_method_types[0]':'card',
    'line_items[0][price_data][currency]':'cad',
    'line_items[0][price_data][unit_amount]':String(amount*100),
    'line_items[0][price_data][product_data][name]':'MapleWeb AI website design — TEST ONLY',
    'line_items[0][quantity]':'1',
    'metadata[case_id]':stored.caseId,
    'metadata[quote_revision]':String(revision)
  });
  // Stable idempotency key prevents duplicate Stripe test sessions for same quote revision.
  const idem='mapleweb-test-'+stored.caseId+'-r'+revision;
  const response=await fetcher('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',headers:{
      Authorization:'Bearer '+env.STRIPE_TEST_SECRET_KEY,
      'Content-Type':'application/x-www-form-urlencoded',
      'Idempotency-Key':idem
    },body:body.toString()
  });
  if(!response?.ok)throw bad('Stripe sandbox Checkout request failed',502);
  const session=await response.json();
  let checkoutUrl;
  try{checkoutUrl=new URL(session.url);}catch{throw bad('Stripe returned no Checkout URL',502);}
  if(session.livemode!==false||typeof session.id!=='string'||
     !session.id.startsWith('cs_test_')||session.mode!=='payment'||
     session.currency!=='cad'||session.amount_total!==amount*100||
     checkoutUrl.protocol!=='https:'||checkoutUrl.hostname!=='checkout.stripe.com')
    throw bad('Stripe response was not a matching test-mode Checkout Session',502);
  const inserted=await db.prepare(
    'INSERT OR IGNORE INTO stripe_test_sessions(session_id,case_id,quote_revision,amount_cents,checkout_url,state,updated_at) VALUES(?,?,?,?,?,?,?)'
  ).bind(session.id,stored.caseId,revision,amount*100,checkoutUrl.href,'OPEN_TEST',new Date().toISOString()).run();
  if(changeCount(inserted)!==1)throw bad('Quote already has another test session; reload',409);
  return {mode:'test',sessionId:session.id,url:checkoutUrl.href,
    state:'OPEN_TEST',reused:false,realPayment:false};
}
const bytesFromHex = hex => {
  if(!/^[a-f0-9]{64}$/i.test(hex))return null;
  return Uint8Array.from(hex.match(/.{2}/g),x=>parseInt(x,16));
};
export async function verifyStripeTestSignature(raw,signature,secret,now=Math.floor(Date.now()/1000)) {
  if(typeof raw!=='string'||typeof signature!=='string'||typeof secret!=='string'||
     !secret.startsWith('whsec_'))return false;
  const fields=signature.split(',').map(x=>x.trim());
  const t=fields.find(x=>x.startsWith('t='))?.slice(2);
  if(!/^[0-9]{9,12}$/.test(t||''))return false;
  const stamp=Number(t);
  if(Math.abs(now-stamp)>300)return false;
  const signed=new TextEncoder().encode(t+'.'+raw);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const field of fields.filter(x=>x.startsWith('v1='))){
    const sig=bytesFromHex(field.slice(3));
    if(sig&&await crypto.subtle.verify('HMAC',key,sig,signed))return true;
  }
  return false;
}
export async function receiveStripeTestWebhook(env,request) {
  if(env.STRIPE_TEST_CHECKOUT_ENABLED!=='true'||
     !testKey(env)||env.BUSINESS_CASES_ENABLED!=='true'||
     typeof env.STRIPE_TEST_WEBHOOK_SECRET!=='string')fail();
  const db=requireDb(env);
  if(Number(request.headers.get('content-length'))>65536)throw bad('Webhook too large',413);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>65536)throw bad('Webhook too large',413);
  if(!await verifyStripeTestSignature(raw,request.headers.get('stripe-signature'),
      env.STRIPE_TEST_WEBHOOK_SECRET))
    throw bad('Invalid Stripe test webhook signature',401);
  let event;
  try{event=JSON.parse(raw);}catch{throw bad('Invalid webhook JSON');}
  if(event.livemode!==false||!/^evt_[A-Za-z0-9_]+$/.test(event.id||''))
    throw bad('Only signed Stripe test-mode events are accepted',403);
  const accepted=['checkout.session.completed','checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed','checkout.session.expired'];
  if(!accepted.includes(event.type))return {received:true,processed:false,reason:'ignored-type'};
  const s=event.data?.object;
  if(!s||s.livemode!==false||!/^cs_test_[A-Za-z0-9_]+$/.test(s.id||'')||
     s.mode!=='payment')throw bad('Invalid test Checkout Session event',400);
  const already=await db.prepare('SELECT event_id FROM stripe_test_events WHERE event_id=?')
    .bind(event.id).first();
  if(already)return {received:true,processed:false,reason:'duplicate'};
  const row=await db.prepare('SELECT * FROM stripe_test_sessions WHERE session_id=?')
    .bind(s.id).first();
  if(!row)return {received:true,processed:false,reason:'unknown-session'};
  const current=await readBusinessCase(env,row.case_id);
  // A changed quote or wrong amount must not be marked paid.
  if(!current||current.revision!==row.quote_revision||
     s.client_reference_id!==row.case_id||
     s.metadata?.case_id!==row.case_id||
     s.metadata?.quote_revision!==String(row.quote_revision)||
     s.currency!=='cad'||s.amount_total!==row.amount_cents)
    throw bad('Webhook does not match current test quote',409);
  let state=row.state;
  if((event.type==='checkout.session.completed'&&s.payment_status==='paid')||
     (event.type==='checkout.session.async_payment_succeeded'&&s.payment_status==='paid'))
    state='PAID_TEST';
  else if(row.state!=='PAID_TEST'){
    if(event.type==='checkout.session.expired')state='EXPIRED_TEST';
    if(event.type==='checkout.session.async_payment_failed')state='FAILED_TEST';
  }
  await db.prepare('UPDATE stripe_test_sessions SET state=?,updated_at=? WHERE session_id=?')
    .bind(state,new Date().toISOString(),row.session_id).run();
  await db.prepare('INSERT OR IGNORE INTO stripe_test_events(event_id,session_id,event_type,processed_at) VALUES(?,?,?,?)')
    .bind(event.id,row.session_id,event.type,new Date().toISOString()).run();
  return {received:true,processed:true,mode:'test',state,
    deliveryEnabled:false,realPaymentsEnabled:false};
}
