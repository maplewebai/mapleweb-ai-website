// Node.js built-in test runner; no packages, secrets, paid services or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('./engine.js');
const a = globalThis.MapleWebDemo;
const sample = () => a.newOrder({name:'Fictional Maple Café',brief:'Sample bakery website with menu and photo gallery',type:'Professional',fictional:true});
const ready = () => {const o=sample();a.build(o);a.qualityCheck(o);a.approve(o,'customer');a.approve(o,'owner');return o;};

test('six approved CAD price bands and three website categories',()=>{
 assert.equal(a.priceBands.length,6);assert.deepEqual([...new Set(a.priceBands.map(p=>p.kind))],['Simple','Professional','Advanced']);
 assert.deepEqual(a.priceBands.map(x=>[x.min,x.max]),[[500,800],[900,1500],[1500,2200],[2300,3000],[3000,4500],[4500,7000]]);
});
test('sales assistant tells prices without calling them fixed quotes',()=>{const ans=a.answer('How much does a website cost?');assert.match(ans,/500/);assert.match(ans,/7,000/);assert.match(ans,/not fixed quotes/i);});
test('sales assistant handles website types',()=>{assert.match(a.answer('What is an advanced website?'),/advanced/i);});
test('sales assistant explains previews and approval',()=>{assert.match(a.answer('Can I preview it?'),/private website preview/i);});
test('sales assistant correctly says payments disabled',()=>{assert.match(a.answer('Can I pay by credit card?'),/disabled/i);});
test('sales assistant does not promise live calls',()=>{assert.match(a.answer('Can you call customers?'),/not connected/i);});
test('only fictional test orders are allowed',()=>{assert.throws(()=>a.newOrder({name:'A Store',brief:'Just a sample shop',type:'Simple',fictional:false}),/Fictional/);});
test('reject real email addresses in orders',()=>{assert.throws(()=>a.newOrder({name:'Demo Shop',brief:'Please email test@example.com for the order',type:'Simple',fictional:true}),/Do not enter/);});
test('reject telephone numbers in orders',()=>{assert.throws(()=>a.newOrder({name:'Demo Shop',brief:'Contact us at 416-555-0134 for details',type:'Simple',fictional:true}),/Do not enter/);});
test('require valid website type and brief',()=>{assert.throws(()=>a.newOrder({name:'Demo',brief:'short brief',type:'Unapproved',fictional:true}),/valid website type/);});
test('an order starts without a generated website',()=>{const o=sample();assert.equal(o.currentVersion,0);assert.equal(o.draft,'');assert.equal(a.publishReady(o),false);});
test('locally generated preview is escaped',()=>{const o=a.newOrder({name:'Fiction <script>alert(1)',brief:'A fictional example with <img src=x onerror=alert(1)> and plenty of text.',type:'Simple',fictional:true});a.build(o);assert.doesNotMatch(o.draft,/<script>|<img/);assert.match(o.draft,/&lt;script&gt;/);});
test('build increments version and resets approvals',()=>{const o=sample();a.build(o);assert.equal(o.currentVersion,1);assert.equal(o.qaPassed,false);assert.equal(o.customerApprovedVersion,0);});
test('approvals blocked before QA',()=>{const o=sample();a.build(o);assert.throws(()=>a.approve(o,'customer'),/must pass QA/);assert.throws(()=>a.approve(o,'owner'),/must pass QA/);});
test('publishing blocked without QA and approvals',()=>{const o=sample();a.build(o);assert.throws(()=>a.simulatePublish(o),/Publishing blocked/);a.qualityCheck(o);assert.throws(()=>a.simulatePublish(o),/Publishing blocked/);});
test('publishing blocked with customer approval alone',()=>{const o=sample();a.build(o);a.qualityCheck(o);a.approve(o,'customer');assert.equal(a.publishReady(o),false);});
test('publishing blocked with owner approval alone',()=>{const o=sample();a.build(o);a.qualityCheck(o);a.approve(o,'owner');assert.equal(a.publishReady(o),false);});
test('both approvals for checked version allow SIMULATION only',()=>{const o=ready();assert.equal(a.publishReady(o),true);a.simulatePublish(o);assert.equal(o.simulatedPublished,true);assert.match(o.events[0],/SIMULATED ONLY/);});
test('new draft invalidates all prior approvals',()=>{const o=ready();a.build(o);assert.equal(o.currentVersion,2);assert.equal(a.publishReady(o),false);assert.equal(o.customerApprovedVersion,0);assert.equal(o.ownerApprovedVersion,0);});
test('revisions invalidate all prior approvals and QA',()=>{const o=ready();a.requestRevision(o,'Add a weekend specials section');assert.equal(o.currentVersion,2);assert.equal(o.revisionOpen,true);assert.equal(o.qaPassed,false);assert.equal(o.customerApprovedVersion,0);assert.equal(o.ownerApprovedVersion,0);assert.equal(a.publishReady(o),false);});
test('open revision blocks QA and approvals',()=>{const o=ready();a.requestRevision(o,'Add a new home section');assert.equal(a.qualityCheck(o),false);assert.throws(()=>a.approve(o,'customer'),/must pass QA/);});
test('resolved revision still needs a new QA check',()=>{const o=ready();a.requestRevision(o,'Use a larger heading');a.finishRevision(o);assert.equal(o.qaPassed,false);assert.equal(a.publishReady(o),false);a.qualityCheck(o);a.approve(o,'customer');a.approve(o,'owner');assert.equal(a.publishReady(o),true);});
test('unknown approval role blocked',()=>{const o=sample();a.build(o);a.qualityCheck(o);assert.throws(()=>a.approve(o,'salesperson'),/Unknown approval/);});
test('human support escalation is blocked before troubleshooting',()=>{const o=sample();assert.throws(()=>a.support(o,'result',false),/Try basic troubleshooting/);});
test('resolved support issue needs no human call',()=>{const o=sample();a.support(o,'start');a.support(o,'result',true);assert.equal(o.supportStatus,'RESOLVED');});
test('unresolved support issue receives demonstration-only call state',()=>{const o=sample();a.support(o,'start');const reply=a.support(o,'result',false);assert.equal(o.supportStatus,'ARRANGING_HUMAN_CALL_DEMO');assert.match(reply,/No real booking/);});
test('web demo exposes previews and the required safety wording',()=>{const html=fs.readFileSync(__dirname+'/index.html','utf8');assert.match(html,/id="preview"/);assert.match(html,/id="publishBtn"/);assert.match(html,/id="customerApproveBtn"/);assert.match(html,/id="ownerApproveBtn"/);assert.match(html,/Payments are disabled/i);assert.match(html,/engine\.js/);assert.doesNotMatch(html,/<script[^>]+src="https?:/);});

test('standalone demo has exactly one app and two intact inline script blocks',()=>{
 const html=fs.readFileSync(__dirname+'/MapleWeb_AI_Offline_Demo.html','utf8');
 assert.equal((html.match(/<script\b/g)||[]).length,2);
 assert.equal((html.match(/<\/script>/g)||[]).length,2);
 assert.equal((html.match(/<main class="container">/g)||[]).length,1);
 assert.match(html,/root\.MapleWebDemo/);
 assert.match(html,/<\/body><\/html>$/);
 assert.doesNotMatch(html,/<script[^>]+src=/);
});
