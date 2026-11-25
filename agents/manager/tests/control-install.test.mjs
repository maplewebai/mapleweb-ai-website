import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {controlCenterHtml} from '../src/control-center.mjs';
test('mobile install metadata is first-party and never includes owner data',async()=>{
 const r=await worker.fetch(new Request('https://staging.test/control.webmanifest'),{});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const m=await r.json();assert.equal(m.start_url,'/control');assert.equal(m.display,'standalone');
 assert.equal(m.icons[0].src,'/control-icon.svg');
 const sw=await worker.fetch(new Request('https://staging.test/control-sw.js'),{});
 assert.equal(sw.status,200);assert.doesNotMatch(await sw.text(),/caches\.|respondWith/);
});
test('voice features are optional and on-device only; script compiles',()=>{
 assert.match(controlCenterHtml,/processLocally=true/);
 assert.match(controlCenterHtml,/v\.localService/);
 assert.doesNotThrow(()=>new Function(controlCenterHtml.split('<script>')[1].split('</script>')[0]));
});
