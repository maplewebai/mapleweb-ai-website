import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import worker from '../src/worker.mjs';
import {controlCenterHtml,serveControlCenter} from '../src/control-center.mjs';

test('private first-party Control Center shell is served only at /control',async()=>{
  const response=await worker.fetch(new Request('https://staging.test/control'),{});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.equal(html,controlCenterHtml);
  assert.match(html,/MapleWeb AI — Control Center/);
  assert.match(html,/Website Manager/);
  assert.match(html,/Run safe eight-agent demo/);
  assert.match(html,/DEMO MODE/);
  assert.match(html,/No website may be shown/);
  assert.match(html,/No customer operations|No real customer operations/i);
  assert.equal(response.headers.get('cache-control'),'no-store, private');
  const policy=response.headers.get('content-security-policy');
  assert.match(policy,/connect-src 'self'/);
  assert.match(policy,/frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal((await worker.fetch(new Request('https://staging.test/control',{method:'POST'}),{})).status,404);
});
test('Control Center script compiles; credentials are not embedded in UI and no third-party assets are needed',()=>{
  const scripts=[...controlCenterHtml.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.equal(scripts.length,1);
  assert.doesNotThrow(()=>new Script(scripts[0][1],{filename:'control-center-inline.js'}));
  for (const role of ['website-developer','quality-checker','customer-care','sales','research','support','finance','publishing'])
    assert.ok(controlCenterHtml.includes(role),'missing role '+role);
  assert.match(controlCenterHtml,/ownerToken=""/);
  assert.match(controlCenterHtml,/credentials:"omit"/);
  assert.doesNotMatch(controlCenterHtml,/localStorage|sessionStorage|<script\\s+src=|<link\\s+href=/i);
  assert.doesNotMatch(controlCenterHtml,/github\\.com|dash\\.cloudflare\\.com|replit\\.com/);
});
test('Control Center does not change Manager authentication or allow owner API access without token',async()=>{
  const env={MANAGER_OWNER_TOKEN:'x'.repeat(64)};
  const result=await worker.fetch(new Request('https://staging.test/api/status'),env);
  assert.equal(result.status,401);
  assert.equal((await result.json()).error,'Owner token required');
  assert.equal(serveControlCenter().status,200);
});
