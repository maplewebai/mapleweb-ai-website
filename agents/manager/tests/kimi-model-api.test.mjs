import test from 'node:test';
import assert from 'node:assert/strict';
import {createKimiModelApi} from '../src/kimi-model-api.mjs';
import worker from '../src/worker.mjs';

const brief={synthetic:true,business:'Fictional Maple Cafe',goal:'A simple accessible sample cafe website'};
const TOKEN='z'.repeat(64);

test('Kimi model integration is disconnected and safe by default',async()=>{
  let calls=0;
  const adapter=createKimiModelApi({},async()=>{calls++;throw Error('should not call');});
  const status=adapter.status();
  assert.equal(status.credentialConfigured,false);
  assert.equal(status.readyForAuthorizedTest,false);
  assert.equal(status.liveConnectionVerified,false);
  assert.equal(status.kimiBuildAutomationVerified,false);
  assert.equal(status.publishingEnabled,false);
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),/KIMI_NOT_CONNECTED/);
  assert.equal(calls,0);
});

test('Kimi key by itself never authorizes paid usage',async()=>{
  let calls=0;
  const adapter=createKimiModelApi({KIMI_API_KEY:'test-secret'},async()=>{calls++;});
  assert.equal(adapter.status().readyForAuthorizedTest,false);
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),/KIMI_NOT_CONNECTED/);
  assert.equal(calls,0);
});

test('All server-side configuration flags required before any request',async()=>{
  for(const vars of [
    {KIMI_API_KEY:'test-secret',KIMI_PAID_USAGE_APPROVED:'true'},
    {KIMI_API_KEY:'test-secret',KIMI_MODEL_CALLS_ENABLED:'true'},
    {KIMI_PAID_USAGE_APPROVED:'true',KIMI_MODEL_CALLS_ENABLED:'true'}
  ]){
    let calls=0;
    const adapter=createKimiModelApi(vars,async()=>{calls++;});
    await assert.rejects(adapter.createSyntheticCodeDraft(brief),/KIMI_NOT_CONNECTED/);
    assert.equal(calls,0);
  }
});

test('Authorized synthetic mock uses only official model endpoint and returns untrusted draft',async()=>{
  const calls=[];
  const adapter=createKimiModelApi({
    KIMI_API_KEY:'mock-secret',KIMI_PAID_USAGE_APPROVED:'true',
    KIMI_MODEL_CALLS_ENABLED:'true'
  },async(url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify({choices:[{message:{content:'<html>STAGING TEST</html>'}}]}),{
      status:200,headers:{'content-type':'application/json'}
    });
  });
  const result=await adapter.createSyntheticCodeDraft(brief);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://api.moonshot.ai/v1/chat/completions');
  const sent=JSON.parse(calls[0].init.body);
  assert.equal(sent.model,'kimi-k2.6');
  assert.equal(sent.stream,false);
  assert.ok(sent.max_completion_tokens<=2400);
  assert.equal(result.status,'UNTRUSTED_DRAFT_REQUIRES_QA');
  assert.equal(result.qaPassed,false);
  assert.equal(result.published,false);
  assert.equal(result.isKimiBuildOutput,false);
});

test('Kimi adapter blocks real data and malformed briefs before any API call',async()=>{
  let calls=0;
  const adapter=createKimiModelApi({
    KIMI_API_KEY:'mock-secret',KIMI_PAID_USAGE_APPROVED:'true',
    KIMI_MODEL_CALLS_ENABLED:'true'
  },async()=>{calls++;});
  for (const unsafe of [
    {synthetic:false,business:'Cafe',goal:'An online menu for a customer'},
    {synthetic:true,business:'test@example.com',goal:'An online menu for the cafe'},
    {synthetic:true,business:'Fictional Cafe',goal:'Call +1 416 555 1234 for bookings'}
  ]) await assert.rejects(adapter.createSyntheticCodeDraft(unsafe));
  assert.equal(calls,0);
});

test('Manager status is owner-only and Kimi draft cannot run without approval flags',async()=>{
  const env={MANAGER_OWNER_TOKEN:TOKEN};
  const url='https://staging.example.workers.dev/api/integrations/kimi';
  const noAuth=await worker.fetch(new Request(url),env);
  assert.equal(noAuth.status,401);
  const req=new Request(url,{headers:{authorization:'Bearer '+TOKEN}});
  const status=await worker.fetch(req,env);
  assert.equal(status.status,200);
  assert.equal((await status.json()).readyForAuthorizedTest,false);
  const draft=await worker.fetch(new Request(url+'/synthetic-draft',{
    method:'POST',headers:{authorization:'Bearer '+TOKEN,'content-type':'application/json'},
    body:JSON.stringify(brief)
  }),env);
  assert.equal(draft.status,503);
  assert.match((await draft.json()).error,/KIMI_NOT_CONNECTED/);
});
