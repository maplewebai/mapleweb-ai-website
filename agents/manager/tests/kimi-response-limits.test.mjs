import test from 'node:test';
import assert from 'node:assert/strict';
import {createKimiModelApi} from '../src/kimi-model-api.mjs';

const brief={synthetic:true,business:'Fictional Coffee Sample',
  goal:'A small static website for a fictional coffee shop'};
const env={KIMI_API_KEY:'mock-only-credential',
  KIMI_PAID_USAGE_APPROVED:'true',KIMI_MODEL_CALLS_ENABLED:'true'};
function adapterWithResponse(response) {
  let requests=0;
  const adapter=createKimiModelApi(env,async(url,opts)=>{
    requests++;
    assert.equal(url,'https://api.moonshot.ai/v1/chat/completions');
    assert.equal(opts.method,'POST');
    return response;
  });
  return {adapter,requests:()=>requests};
}
const makeJson=(source='<!doctype html><html><body>STAGING TEST</body></html>')=>
  JSON.stringify({choices:[{message:{content:source}}]});

test('Kimi mock rejects non-JSON replies rather than trying to parse them',async()=>{
  const {adapter,requests}=adapterWithResponse(new Response('<html>Not JSON</html>',{
    status:200,headers:{'content-type':'text/html'}
  }));
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),
    /unexpected content type/);
  assert.equal(requests(),1);
});
test('Kimi mock rejects oversized declared content length before buffering',async()=>{
  const {adapter}=adapterWithResponse(new Response(makeJson(),{
    status:200,headers:{'content-type':'application/json','content-length':'999999999'}
  }));
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),/oversized/);
});
test('Kimi mock rejects large streamed body even with no content length',async()=>{
  const huge=JSON.stringify({choices:[{message:{content:'x'.repeat(70000)}}]});
  const {adapter}=adapterWithResponse(new Response(huge,{
    status:200,headers:{'content-type':'application/json'}
  }));
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),/safety size limit/);
});
test('Kimi mock rejects malformed JSON and blank model content safely',async()=>{
  const badJson=adapterWithResponse(new Response('invalid JSON',{
    status:200,headers:{'content-type':'application/json'}
  }));
  await assert.rejects(badJson.adapter.createSyntheticCodeDraft(brief),/invalid JSON/);
  const noChoices=adapterWithResponse(new Response('{}',{
    status:200,headers:{'content-type':'application/json'}
  }));
  await assert.rejects(noChoices.adapter.createSyntheticCodeDraft(brief),/unusable draft/);
});
test('Kimi mock handles a bounded valid JSON reply but cannot claim preview or publication',async()=>{
  const {adapter}=adapterWithResponse(new Response(makeJson(),{
    status:200,headers:{'content-type':'application/json; charset=utf-8'}
  }));
  const result=await adapter.createSyntheticCodeDraft(brief);
  assert.equal(result.status,'UNTRUSTED_DRAFT_REQUIRES_QA');
  assert.equal(result.sourceReview.safeToPreview,false);
  assert.equal(result.sourceReview.safeToPublish,false);
  assert.equal(result.qaPassed,false);
  assert.equal(result.published,false);
  assert.equal(result.paidUsageMayHaveOccurred,true);
});
test('no server-side Kimi paid use approval means no mocked requests are made',async()=>{
  let requests=0;
  const adapter=createKimiModelApi({KIMI_API_KEY:'mock-only-credential'},async()=>{
    requests++;
    throw Error('Should not be invoked');
  });
  await assert.rejects(adapter.createSyntheticCodeDraft(brief),/KIMI_NOT_CONNECTED/);
  assert.equal(requests,0);
});
