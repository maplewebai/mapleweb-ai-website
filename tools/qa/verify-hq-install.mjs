// Exact live build installability checks. Emulated devices, not physical phones.
// No owner secrets, screenshots, mutations or paid services.
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
const base='https://mapleweb-manager-v2-staging.reasdfghkj.workers.dev';
const expected=process.env.EXPECTED_HQ_BUILD;
assert.match(expected||'',/^[a-f0-9]{40}$/);
for(const [engine,device] of [[chromium,'Pixel 7'],[webkit,'iPhone 13']]){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({...devices[device],serviceWorkers:'allow'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'/control',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  assert.equal(response.headers()['x-mapleweb-build'],expected);
  assert.equal(await page.locator('#signin').isVisible(),true);
  assert.equal(await page.evaluate(()=>isSecureContext),true);
  const manifestURL=await page.locator('link[rel=manifest]').getAttribute('href');
  assert.equal(manifestURL,'/control.webmanifest');
  const manifestResponse=await context.request.get(base+manifestURL);
  assert.equal(manifestResponse.status(),200);
  assert.equal(manifestResponse.headers()['x-mapleweb-build'],expected);
  assert.match(manifestResponse.headers()['content-type'],/application\/manifest\+json/);
  const manifest=await manifestResponse.json();
  assert.equal(manifest.name,'MapleWeb AI Headquarters');
  assert.equal(manifest.start_url,'/control');
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.length>0);
  for(const icon of manifest.icons){
   const iconResponse=await context.request.get(new URL(icon.src,base).href);
   assert.equal(iconResponse.status(),200);
   assert.equal(iconResponse.headers()['x-mapleweb-build'],expected);
   assert.match(iconResponse.headers()['content-type'],/^image\//);
  }
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:15000});
  assert.equal(await page.evaluate(async()=> (await caches.keys()).length),0);
  const anon=await context.request.get(base+'/api/manager/chat');
  assert.equal(anon.status(),401);
  const width=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(width.scroll<=width.viewport+1,device+' layout overflow');
  if(engine===chromium){
   const cdp=await context.newCDPSession(page);
   const m=await cdp.send('Page.getAppManifest');
   assert.ok(m.url.endsWith('/control.webmanifest'));
   assert.deepEqual((m.errors||[]).filter(e=>e.critical),[]);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS '+device+' emulation: exact live build, manifest, icon, HTTPS service worker, owner gate and viewport. Physical installation not tested.');
 }finally{await browser.close()}
}
