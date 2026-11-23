import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewUntrustedKimiSource} from '../src/kimi-source-review.mjs';
import {createKimiModelApi} from '../src/kimi-model-api.mjs';

const safe='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="robots" content="noindex,nofollow"></head>'+
  '<body><header>STAGING TEST</header><main><h1>Fictional website</h1>'+
  '<p>No real customers, products or bookings.</p></main></body></html>';

test('model HTML is screened, but even clean text never gains preview or publishing approval',()=>{
  const review=reviewUntrustedKimiSource(safe);
  assert.equal(review.status,'STATIC_SCREENING_PASSED_REVIEW_REQUIRED');
  assert.deepEqual(review.violations,[]);
  assert.equal(review.sourceCharacters,safe.length);
  assert.equal(review.executed,false);
  assert.equal(review.rendered,false);
  assert.equal(review.sourceValidatedByHtmlParser,false);
  assert.equal(review.independentSecurityAudit,false);
  assert.equal(review.realBrowserTested,false);
  assert.equal(review.safeToPreview,false);
  assert.equal(review.safeToPublish,false);
});
test('unsafe tags, handlers, web links, CSS loading, PII and missing staging disclosures are flagged',()=>{
  const cases=[
    ['</main><script>alert(1)</script><main>','noScriptElements'],
    ['<iframe src="https://evil.example"></iframe>','noScriptElements'],
    ['<form action="/submit"><input name="email"></form>','noForms'],
    ['<img src="https://tracker.example/a.png">','noExternalReferences'],
    ['<a href="//outside.example">click</a>','noExternalReferences'],
    ['<img src="data:image/png;base64,x">','noDynamicSchemes'],
    ['<span onclick="bad()">hi</span>','noInlineHandlers'],
    ['<style>@import "remote.css";</style>','noCssImports'],
    ['<style>body{background:url(foo.png)}</style>','noCssUrlFunctions'],
    ['hello@example.com','noSensitiveContactData'],
    ['Call +1 416 555 1212','noSensitiveContactData'],
    ['\x00','noControlCharacters'],
    ['<svg onload="bad()"></svg>','noScriptElements']
  ];
  for(const [snippet,check] of cases){
    const review=reviewUntrustedKimiSource(safe.replace('</body>',snippet+'</body>'));
    assert.equal(review.status,'BLOCKED_NEEDS_REVIEW',snippet);
    assert.equal(review.checks[check],false,snippet);
    assert.ok(review.violations.includes(check));
    assert.equal(review.safeToPublish,false);
  }
  const noStaging=reviewUntrustedKimiSource(safe.replace('STAGING TEST','regular header'));
  assert.equal(noStaging.checks.hasStagingNotice,false);
  assert.equal(noStaging.status,'BLOCKED_NEEDS_REVIEW');
});
test('reject malformed model source and strict size bounds before analysis',()=>{
  assert.throws(()=>reviewUntrustedKimiSource(''));
  assert.throws(()=>reviewUntrustedKimiSource(null));
  assert.throws(()=>reviewUntrustedKimiSource('x'.repeat(25001)));
});
test('Kimi adapter mock returns source audit but cannot call without all deployment-side approvals',async()=>{
  const brief={synthetic:true,business:'Fictional cafe',
    goal:'Make a sample website with information only'};
  let calls=0;
  const disabled=createKimiModelApi({KIMI_API_KEY:'mock-key'},async()=>{calls++;});
  await assert.rejects(disabled.createSyntheticCodeDraft(brief),/KIMI_NOT_CONNECTED/);
  assert.equal(calls,0);
  const enabled=createKimiModelApi({
    KIMI_API_KEY:'mock-key',KIMI_PAID_USAGE_APPROVED:'true',
    KIMI_MODEL_CALLS_ENABLED:'true'
  },async()=>{
    calls++;
    return new Response(JSON.stringify({choices:[{message:{content:safe}}]}),
      {status:200,headers:{'content-type':'application/json'}});
  });
  const result=await enabled.createSyntheticCodeDraft(brief);
  assert.equal(calls,1); // Mock transport; no paid Kimi service invoked.
  assert.equal(result.source,safe);
  assert.equal(result.sourceReview.status,'STATIC_SCREENING_PASSED_REVIEW_REQUIRED');
  assert.equal(result.browserPreviewAuthorized,false);
  assert.equal(result.customerPublishAuthorized,false);
  assert.equal(result.qaPassed,false);
  assert.equal(result.published,false);
});
