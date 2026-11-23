import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle as managerHandle} from '../src/worker.mjs';
import {safeHandle as callingHandle} from '../../calling-sales/src/worker.mjs';

const ownerToken='o'.repeat(64);
const adminToken='s'.repeat(64);
const base='https://mapleweb-calling-sales-staging.example.workers.dev';
const to='+14165550123';
const sid='CA'+'b'.repeat(32);
const unix=()=>Math.floor(Date.now()/1000);
function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../calling-sales/migrations/0001_calling.sql',import.meta.url),'utf8'));
  const db={
    prepare(sql) {
      let args=[];
      return {
        bind(...values){args=values;return this;},
        first(){return sqlite.prepare(sql).get(...args)||null;},
        all(){return {results:sqlite.prepare(sql).all(...args)};},
        run(){return sqlite.prepare(sql).run(...args);}
      };
    }
  };
  const managerEnv={
    MANAGER_OWNER_TOKEN:ownerToken,
    CALLING_AGENT_URL:base,
    CALLING_AGENT_ADMIN_TOKEN:adminToken,
    CALLING_AGENT_INTEGRATION_ENABLED:'true',
    CALLING_MANAGER_CONTROLS_ENABLED:'true',
    CALLING_MANAGER_OUTBOUND_ENABLED:'false',
    CALLING_MANAGER_PAID_USAGE_APPROVED:'false'
  };
  const callerEnv={
    CALLING_ADMIN_TOKEN:adminToken,
    CALLING_DB:db,
    CALLING_HASH_SECRET:'h'.repeat(64),
    CALLING_PUBLIC_BASE_URL:base,
    TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),
    TWILIO_AUTH_TOKEN:'t'.repeat(32),
    TWILIO_FROM_NUMBER:'+14165550124',
    CALLING_INBOUND_ENABLED:'false',
    CALLING_OUTBOUND_ENABLED:'false',
    CALLING_AUTOMATED_OUTREACH_APPROVED:'false',
    CALLING_PAID_USAGE_APPROVED:'false',
    CALLING_OUTBOUND_TEST_ONLY:'true',
    CALLING_TEST_RECIPIENT_NUMBER:to
  };
  let twilioCalls=0,agentCalls=0;
  async function fakeProvider(url,options) {
    assert.match(url,/^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\//);
    assert.equal(options.method,'POST');
    twilioCalls++;
    return new Response(JSON.stringify({sid}),{status:201,
      headers:{'content-type':'application/json'}});
  }
  async function bridgeFetch(url,options) {
    agentCalls++;
    assert.equal(new URL(url).origin,base);
    return callingHandle(new Request(url,options),callerEnv,fakeProvider);
  }
  async function manager(path,method='GET',body,authenticated=true) {
    const headers={...(authenticated?{authorization:'Bearer '+ownerToken}:{}),
      ...(body?{'content-type':'application/json'}:{})};
    const req=new Request('https://manager-staging.example.workers.dev'+path,
      {method,headers,...(body?{body:JSON.stringify(body)}:{})});
    try {
      const r=await managerHandle(req,managerEnv,bridgeFetch);
      return {status:r.status,data:await r.json()};
    } catch(e) {
      return {status:e.status||500,error:String(e.message)};
    }
  }
  return {managerEnv,callerEnv,manager,bridgeFetch,sqlite,
    twilioCalls:()=>twilioCalls,agentCalls:()=>agentCalls,
    close(){sqlite.close();}};
}
const consent=()=>({
  to,source:'requested-callback',evidenceRef:'CRM_CASE_00058',
  grantedAt:unix(),expiresAt:unix()+3600,
  ownerReviewed:true,automatedVoiceConsent:true
});
const callback=()=>({
  to,evidenceRef:'CRM_CASE_00058',idempotencyKey:'CALLBACK_TEST_00058',
  approveSingleCharge:true
});

test('Calling Sales remains disabled by default and Manager authentication protects it',async()=>{
  const f=fixture();
  try {
    f.managerEnv.CALLING_AGENT_INTEGRATION_ENABLED='false';
    assert.equal((await f.manager('/api/integrations/calling', 'GET',null,false)).status,401);
    const ready=await f.manager('/api/integrations/calling');
    assert.equal(ready.status,200);
    assert.equal(ready.data.enabled,false);
    assert.equal(ready.data.remote,null);
    assert.equal(f.agentCalls(),0);
    assert.equal((await f.manager('/api/integrations/calling/consent','POST',consent())).status,503);
    assert.equal(f.twilioCalls(),0);
  } finally {f.close();}
});
test('Manager verifies actual Calling Worker identity without leaking credentials',async()=>{
  const f=fixture();
  try {
    const res=await f.manager('/api/integrations/calling');
    assert.equal(res.status,200);
    assert.equal(res.data.remote.connected,true);
    assert.equal(res.data.remote.service,'mapleweb-calling-sales-agent');
    assert.equal(res.data.remote.phoneNumberVerified,false);
    assert.equal(res.data.remote.liveCallTested,false);
    assert.equal(res.data.remote.outboundEnabled,false);
    assert.ok(!JSON.stringify(res.data).includes(adminToken));
    const summary=await f.manager('/api/status');
    assert.equal(summary.status,200);
    assert.equal(summary.data.callingSales.liveAgentVerified,false);
  } finally {f.close();}
});
test('Manager refuses malicious URLs, missing credentials and unknown actions',async()=>{
  const f=fixture();
  try {
    for(const url of ['https://evil.example','http://mapleweb-calling-sales-staging.example.workers.dev',
      'https://mapleweb-calling-sales-staging.example.workers.dev.evil.example',
      'https://mapleweb-calling-sales-staging.example.workers.dev/voice/inbound',
      'https://username:password@mapleweb-calling-sales-staging.example.workers.dev']) {
      f.managerEnv.CALLING_AGENT_URL=url;
      assert.equal((await f.manager('/api/integrations/calling')).status,503);
    }
    f.managerEnv.CALLING_AGENT_URL=base;
    f.managerEnv.CALLING_AGENT_ADMIN_TOKEN='short';
    assert.equal((await f.manager('/api/integrations/calling/consent','POST',consent())).status,503);
    assert.equal(f.twilioCalls(),0);
  } finally {f.close();}
});
test('Owner can record reviewed callback permission through Manager; not an outgoing call',async()=>{
  const f=fixture();
  try {
    assert.equal((await f.manager('/api/integrations/calling/consent','POST',
      {...consent(),automatedVoiceConsent:false})).status,400);
    assert.equal((await f.manager('/api/integrations/calling/consent','POST',
      {...consent(),email:'not accepted'})).status,400);
    const res=await f.manager('/api/integrations/calling/consent','POST',consent());
    assert.equal(res.status,201);
    assert.equal(res.data.recorded,true);
    assert.equal(f.twilioCalls(),0);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM consents').get().n,1);
    const serialized=JSON.stringify(res.data);
    assert.ok(!serialized.includes(to));
    assert.ok(!serialized.includes(adminToken));
  } finally {f.close();}
});
test('Manager outbound requires independent approval gates before calling provider',async()=>{
  const f=fixture();
  try {
    await f.manager('/api/integrations/calling/consent','POST',consent());
    let res=await f.manager('/api/integrations/calling/outbound','POST',callback());
    assert.equal(res.status,403);
    f.managerEnv.CALLING_MANAGER_OUTBOUND_ENABLED='true';
    f.managerEnv.CALLING_MANAGER_PAID_USAGE_APPROVED='true';
    res=await f.manager('/api/integrations/calling/outbound','POST',callback());
    assert.equal(res.status,403); // Calling Worker also has independent approval gates.
    assert.equal(f.twilioCalls(),0);
    f.callerEnv.CALLING_OUTBOUND_ENABLED='true';
    f.callerEnv.CALLING_PAID_USAGE_APPROVED='true';
    f.callerEnv.CALLING_AUTOMATED_OUTREACH_APPROVED='true';
    res=await f.manager('/api/integrations/calling/outbound','POST',
      {...callback(),approveSingleCharge:false});
    assert.equal(res.status,400);
    assert.equal(f.twilioCalls(),0);
    res=await f.manager('/api/integrations/calling/outbound','POST',callback());
    assert.equal(res.status,201);
    assert.equal(res.data.queued,true);
    assert.equal(res.data.callSid,sid);
    assert.equal(res.data.neverRetryAutomatically,true);
    assert.equal(f.twilioCalls(),1); // Fake Twilio only; no real phone call.
    const again=await f.manager('/api/integrations/calling/outbound','POST',callback());
    assert.equal(again.status,409);
    assert.equal(f.twilioCalls(),1);
  } finally {f.close();}
});
test('Manager suppression takes effect in Calling Worker and blocks further callbacks',async()=>{
  const f=fixture();
  try {
    await f.manager('/api/integrations/calling/consent','POST',consent());
    const res=await f.manager('/api/integrations/calling/suppress','POST',{to});
    assert.equal(res.status,200);
    assert.equal(res.data.suppressed,true);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM consents').get().n,0);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM suppressions').get().n,1);
    assert.equal((await f.manager('/api/integrations/calling/consent','POST',consent())).status,403);
    f.managerEnv.CALLING_MANAGER_OUTBOUND_ENABLED='true';
    f.managerEnv.CALLING_MANAGER_PAID_USAGE_APPROVED='true';
    f.callerEnv.CALLING_OUTBOUND_ENABLED='true';
    f.callerEnv.CALLING_PAID_USAGE_APPROVED='true';
    f.callerEnv.CALLING_AUTOMATED_OUTREACH_APPROVED='true';
    assert.equal((await f.manager('/api/integrations/calling/outbound','POST',callback())).status,403);
    assert.equal(f.twilioCalls(),0);
  } finally {f.close();}
});
