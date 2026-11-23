import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import agent,{safeHandle} from '../src/worker.mjs';
import {answerWithKimi} from '../src/voice.mjs';
import {numberHash} from '../src/security.mjs';

const A='AC'+'a'.repeat(32),C='CA'+'b'.repeat(32),D='CA'+'c'.repeat(32);
const from='+14165550123',to='+14165559876',base='https://voice-test.example.workers.dev',token='T'.repeat(48);
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_calling.sql',import.meta.url),'utf8'));
  const DB={prepare(sql){let args=[];return {
    bind(...v){args=v;return this;},
    first(){return sqlite.prepare(sql).get(...args)||null;},
    all(){return {results:sqlite.prepare(sql).all(...args)};},
    run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}
  };}};
  return {sqlite,env:{CALLING_DB:DB,TWILIO_ACCOUNT_SID:A,TWILIO_AUTH_TOKEN:token,
    TWILIO_FROM_NUMBER:to,CALLING_PUBLIC_BASE_URL:base,CALLING_HASH_SECRET:'H'.repeat(64),
    CALLING_ADMIN_TOKEN:'Z'.repeat(64),CALLING_INBOUND_ENABLED:'true',CALLING_PAID_USAGE_APPROVED:'true',
    CALLING_OUTBOUND_ENABLED:'false',CALLING_AUTOMATED_OUTREACH_APPROVED:'false',
    CALLING_AI_ENABLED:'false',CALLING_CUSTOMER_DATA_TRANSFER_APPROVED:'false'
  },close(){sqlite.close()}};
}
function twilioRequest(path,fields={},valid=true) {
  const form=new URLSearchParams({AccountSid:A,CallSid:C,From:from,To:to,...fields});
  const raw=base+path+[...form.keys()].sort().map(k=>k+form.get(k)).join('');
  const signature=createHmac('sha1',token).update(raw).digest('base64');
  return new Request(base+path,{method:'POST',headers:{
    'content-type':'application/x-www-form-urlencoded',
    'x-twilio-signature':valid?signature:'invalid'
  },body:form.toString()});
}
const tw=(env,path,fields={},fetchImpl=fetch,valid=true)=>safeHandle(twilioRequest(path,fields,valid),env,fetchImpl);
const admin=(env,path,body,fetchImpl=fetch,authorized=true)=>safeHandle(
  new Request(base+path,{method:'POST',headers:{'content-type':'application/json',
    ...(authorized?{authorization:'Bearer '+env.CALLING_ADMIN_TOKEN}:{})},
    body:JSON.stringify(body)}),env,fetchImpl);
const text=async r=>r.text();
const consent=(ref,phone=from)=>({to:phone,source:'requested-callback',evidenceRef:ref,
  grantedAt:Math.floor(Date.now()/1000),expiresAt:Math.floor(Date.now()/1000)+3600,
  ownerReviewed:true,automatedVoiceConsent:true});
test('owner status hides credentials and public health does not claim provider success',async()=>{
  const f=fixture();try{
    assert.equal((await agent.fetch(new Request(base+'/admin/status'),f.env)).status,401);
    const r=await agent.fetch(new Request(base+'/admin/status',{headers:{authorization:'Bearer '+f.env.CALLING_ADMIN_TOKEN}}),f.env);
    const value=await r.json();
    assert.equal(value.outboundEnabled,false);
    assert.equal(value.recordingsEnabled,false);
    assert.equal(value.unsolicitedCallingEnabled,false);
    assert.ok(!JSON.stringify(value).includes(token));
    const health=await (await agent.fetch(new Request(base+'/health'),f.env)).json();
    assert.equal(health.liveProviderVerified,false);
  }finally{f.close()}
});
test('inbound Twilio webhook requires valid signature, starts with consent and no recording',async()=>{
  const f=fixture();try{
    assert.equal((await tw(f.env,'/voice/inbound',{},fetch,false)).status,403);
    assert.equal((await tw(f.env,'/voice/inbound',{AccountSid:'AC'+'0'.repeat(32)})).status,403);
    const r=await tw(f.env,'/voice/inbound');
    assert.equal(r.status,200);
    assert.match(await text(r),/automated assistant/);
    f.env.CALLING_PAID_USAGE_APPROVED='false';
    assert.match(await text(await tw(f.env,'/voice/inbound')),/not available/);
  }finally{f.close()}
});
test('caller can decline AI consent; accepted caller can ask up to four questions',async()=>{
  const f=fixture();try{
    assert.match(await text(await tw(f.env,'/voice/consent?direction=inbound',{SpeechResult:'no'})),/Goodbye/);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM voice_sessions').get().n,0);
    assert.match(await text(await tw(f.env,'/voice/consent?direction=inbound',{SpeechResult:'yes, I agree'})),/voice\/turn/);
    assert.match(await text(await tw(f.env,'/voice/turn?turn=1',{SpeechResult:'How much is a website?'})),/five hundred Canadian dollars/);
    assert.match(await text(await tw(f.env,'/voice/turn?turn=1',{SpeechResult:'repeat'})),/already been processed/);
    for(let i=2;i<=4;i++){
      const r=await tw(f.env,'/voice/turn?turn='+i,{SpeechResult:'What website services?'});
      assert.equal(r.status,200);
      if(i===4)assert.match(await text(r),/<Hangup\/>/);
    }
    assert.equal(f.sqlite.prepare('SELECT turns FROM voice_sessions').get().turns,4);
  }finally{f.close()}
});
test('spoken opt-out blocks any further outgoing calls without blocking voluntary incoming calls',async()=>{
  const f=fixture();try{
    assert.match(await text(await tw(f.env,'/voice/consent?direction=inbound',{SpeechResult:'stop calling me'})),/not call this number again/);
    assert.equal(f.sqlite.prepare('SELECT number_hash FROM suppressions').get().number_hash,await numberHash(from,f.env));
    assert.match(await text(await tw(f.env,'/voice/inbound')),/automated assistant/);
    assert.equal((await admin(f.env,'/admin/consent',consent('CRM-CASE-00017'))).status,403);
    assert.equal((await admin(f.env,'/admin/outbound',{to:from,evidenceRef:'CRM-CASE-00017',
      idempotencyKey:'callback-id-00017',approveSingleCharge:true})).status,403);
  }finally{f.close()}
});
test('outbound remains off without current documented voice permission and paid-use gates',async()=>{
  const f=fixture();try{
    const ok=await admin(f.env,'/admin/consent',consent('CRM-CASE-00018'));
    assert.equal(ok.status,201);
    assert.equal((await admin(f.env,'/admin/outbound',{to:from,evidenceRef:'CRM-CASE-00018',
      idempotencyKey:'callback-id-00018',approveSingleCharge:true})).status,403);
    assert.equal((await admin(f.env,'/admin/consent',{...consent('CRM-CASE-00019'),ownerReviewed:false})).status,400);
    assert.equal((await admin(f.env,'/admin/consent',consent('CRM-CASE-00020'),fetch,false)).status,401);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM outbound_requests').get().n,0);
  }finally{f.close()}
});
test('authorized callback calls Twilio once with no duplicate charge and checks recipient',async()=>{
  const f=fixture();try{
    const ref='CRM-CASE-00021',id='callback-id-00021';
    assert.equal((await admin(f.env,'/admin/consent',consent(ref))).status,201);
    Object.assign(f.env,{CALLING_OUTBOUND_ENABLED:'true',CALLING_AUTOMATED_OUTREACH_APPROVED:'true',
      CALLING_OUTBOUND_TEST_ONLY:'true',CALLING_TEST_RECIPIENT_NUMBER:from});
    let calls=0;
    const mock=async(url,init)=>{calls++;
      assert.match(url,/api.twilio.com\/2010-04-01\/Accounts/);
      assert.equal(new URLSearchParams(init.body).get('To'),from);
      return new Response(JSON.stringify({sid:D}),{status:201});
    };
    const payload={to:from,evidenceRef:ref,idempotencyKey:id,approveSingleCharge:true};
    assert.equal((await admin(f.env,'/admin/outbound',payload,mock)).status,201);
    assert.equal((await admin(f.env,'/admin/outbound',payload,mock)).status,409);
    assert.equal(calls,1);
    assert.match(await text(await tw(f.env,'/voice/outbound?requestId='+id,{To:from,From:to,CallSid:D})),/returning a callback/);
    assert.match(await text(await tw(f.env,'/voice/consent?direction=outbound',
      {To:from,From:to,CallSid:D,SpeechResult:'yes'})),/voice\/turn/);
    assert.match(await text(await tw(f.env,'/voice/turn?turn=1',
      {To:from,From:to,CallSid:D,SpeechResult:'do not call'})),/not call this number again/);
    assert.equal((await admin(f.env,'/admin/outbound',{...payload,idempotencyKey:'callback-id-00022'},mock)).status,403);
    assert.equal(calls,1);
  }finally{f.close()}
});
test('Kimi is only used when paid usage and customer data transfer approved',async()=>{
  const f=fixture();try{
    f.env.KIMI_API_KEY='TEST_MODEL_PRIVATE_KEY';
    f.env.CALLING_AI_ENABLED='true';
    let calls=0;
    const mock=async(url,init)=>{calls++;
      const prompt=JSON.parse(init.body).messages[1].content;
      assert.ok(!prompt.includes('+14165550123'));
      return new Response(JSON.stringify({choices:[{message:{content:'We can discuss the website options.'}}]}),{status:200});
    };
    assert.equal((await answerWithKimi(f.env,'call me +14165550123',mock)).aiUsed,false);
    assert.equal(calls,0);
    f.env.CALLING_CUSTOMER_DATA_TRANSFER_APPROVED='true';
    assert.equal((await answerWithKimi(f.env,'call me +14165550123',mock)).aiUsed,true);
    assert.equal(calls,1);
  }finally{f.close()}
});
