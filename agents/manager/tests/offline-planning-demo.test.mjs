import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {WEBSITE_REQUIREMENT_OPTIONS} from '../src/order-requirements.mjs';

const html=readFileSync(new URL('../demo/customer-planning.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('offline demo has valid JavaScript and clear no-service disclosures',()=>{
  assert.ok(script,'Demo script missing');
  assert.doesNotThrow(()=>new vm.Script(script,{filename:'customer-planning.html'}));
  assert.match(html,/PRIVATE OFFLINE DEMO/);
  assert.match(html,/does not contact MapleWeb AI/);
  assert.match(html,/No data was sent or saved/);
  assert.match(html,/Not a fixed quote or customer order/);
  assert.match(html,/noindex,nofollow/);
});
test('demo input choices exactly match Manager approved fields and options',()=>{
  const found=Array.from(script.matchAll(/\{field:'([^']+)',prompt:'[^']+',values:\[([^\]]*)\](?:,multi:true)?\}/g));
  assert.equal(found.length,6);
  assert.deepEqual(found.map(x=>x[1]),Object.keys(WEBSITE_REQUIREMENT_OPTIONS));
  for(const [whole,field,values] of found) {
    const options=Array.from(values.matchAll(/'([^']+)'/g),x=>x[1]);
    assert.deepEqual(options,WEBSITE_REQUIREMENT_OPTIONS[field],'Mismatched options for '+field);
    assert.ok(whole.includes('field:'));
  }
  assert.match(script,/selected\.length>8/);
  assert.match(script,/!selected\.includes\('home'\)/);
  assert.match(script,/selected\.includes\('multilingual'\)/);
  assert.match(script,/answers\.websiteGoal==='booking-inquiry'/);
});
test('demo has no server calls, storage, payment, phone or external dependencies',()=>{
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/default-src 'none'/);
  assert.doesNotMatch(html,/<script\s+src\s*=/i);
  assert.doesNotMatch(html,/<form\b/i);
  assert.doesNotMatch(html,/<iframe\b/i);
  assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage)\b/);
  assert.doesNotMatch(html,/https?:\/\//i);
  assert.doesNotMatch(html,/\b(?:sk_test_|sk_live_|api_key|auth_token|secret_key)\b/i);
});
test('accessible choices and fictional-only report are present',()=>{
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/role="log"/);
  assert.match(html,/role="alert"/);
  assert.match(html,/label\.append\(input,span\)/);
  assert.match(html,/textContent=JSON\.stringify\(\{synthetic:true,requirements:answers\}/);
  assert.match(html,/final fixed quote, taxes and external fees require owner review/i);
  assert.match(html,/Restart/);
});
