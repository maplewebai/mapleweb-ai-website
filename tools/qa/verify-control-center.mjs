// Browser-only visual and interaction QA for the owner-only staging Control Center.
// No owner token, no third-party billing, no real job submissions.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
const URL='https://mapleweb-manager-v2-staging.reasdfghkj.workers.dev/control';
const browser=await chromium.launch({headless:true});
let failures=0;
try{
  for(const width of [320,390,768,1440]){
    const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
    const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(response?.status(),200,'HTTPS shell must load');
    await assert.doesNotReject(page.locator('#signin').waitFor({state:'visible'}));
    assert.match(await page.title(),/MapleWeb AI/);
    const unauth=await page.request.get('https://mapleweb-manager-v2-staging.reasdfghkj.workers.dev/api/status',{failOnStatusCode:false});
    assert.equal(unauth.status(),401,'Manager API requires authentication');
    await page.locator('#demo').click();
    assert.equal(await page.locator('#shell').isVisible(),true);
    assert.equal(await page.locator('#statusText').innerText(),'DEMO MODE');
    assert.equal(await page.locator('#runAll').isDisabled(),true);
    await page.locator('[data-tab="agents"]').click();
    assert.equal(await page.locator('.agent').count(),8);
    await page.locator('.agent').filter({hasText:'Finance'}).click();
    assert.equal(await page.locator('#selectedAgentName').innerText(),'Finance');
    assert.equal(await page.locator('#runAgent').isDisabled(),true);
    await page.locator('[data-tab="quality"]').click();
    assert.match(await page.locator('#quality').innerText(),/Website previews are blocked/);
    await page.locator('[data-tab="activity"]').click();
    assert.equal(await page.locator('#activity').isVisible(),true);
    await page.locator('[data-tab="manager"]').click();
    assert.equal(await page.locator('#runAll').isDisabled(),true);
    const d=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(d.scroll<=d.width+1, 'mobile overflow '+JSON.stringify(d));
    assert.deepEqual(errors,[],'JavaScript runtime errors: '+errors.join('; '));
    fs.mkdirSync('qa-artifacts',{recursive:true});
    await page.screenshot({path:'qa-artifacts/control-center-'+width+'.png',fullPage:true});
    console.log('PASS width '+width+': HTTPS, owner protection, demo, 8 agents, QA, no overflow, zero JS exceptions');
    await page.close();
  }
}finally{await browser.close()}
console.log('PASS: Control Center real HTTPS browser and 4 viewport test complete (no live customer operations)');
