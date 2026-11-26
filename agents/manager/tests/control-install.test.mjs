import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {controlCenterHtml} from '../src/control-center.mjs';
test('mobile install metadata is first-party and never includes owner data',async()=>{
 const r=await worker.fetch(new Request('https://staging.test/control.webmanifest'),{});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const m=await r.json();assert.equal(m.name,'AI Agents Headquarters');assert.equal(m.short_name,'AI Agents HQ');assert.equal(m.start_url,'/control');assert.equal(m.display,'standalone');
 assert.equal(m.icons[0].src,'/control-icon.svg');
 const sw=await worker.fetch(new Request('https://staging.test/control-sw.js'),{});
 assert.equal(sw.status,200);assert.doesNotMatch(await sw.text(),/caches\.|respondWith/);
});
test('voice features are optional and on-device only; script compiles',()=>{
 assert.match(controlCenterHtml,/processLocally=true/);
 assert.match(controlCenterHtml,/v\.localService/);
 assert.doesNotThrow(()=>new Function(controlCenterHtml.split('<script>')[1].split('</script>')[0]));
});

test('approved brand asset is served intact',async()=>{const r=await worker.fetch(new Request('https://staging.test/hq-brand.webp'),{});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');const b=await r.arrayBuffer();assert.equal(b.byteLength,2450);const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(new Uint8Array(b)).digest('hex'),'9a763352ae3b9aab2c396d0a42cc7f7072914f27da9e7bff2c932dcc67fc1f8d')});
