// Release gate for fictional staging previews. Browser QA is mandatory; HTML-only QA is insufficient.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const src=process.argv[2];
if(!src||!src.endsWith('.html')||!fs.existsSync(src)){
 console.error('BLOCKED: no website preview supplied');process.exit(2);
}
const failures=[],testCases=[['small-mobile',320,740],['phone',390,844],['tablet',768,1024],['desktop',1440,900]];
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 for(const [name,width,height] of testCases){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(pathToFileURL(path.resolve(src)).href,{waitUntil:'load',timeout:45000});
   await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)))});
   await page.waitForTimeout(550);
   const s=await page.evaluate(()=>{
    const img=[...document.images],v=document.querySelector('video[autoplay]');
    return {count:img.length,broken:img.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt||i.src.slice(0,60)),
     brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),
     overflow:document.documentElement.scrollWidth-innerWidth,videoReady:!v||v.readyState>=2,playing:!v||!v.paused};
   });
   if(!s.count||s.broken.length)failures.push(name+': broken photos '+s.broken.join(','));
   if(s.brokenAnchors.length)failures.push(name+': invalid section links '+s.brokenAnchors.join(','));
   if(s.overflow>1)failures.push(name+': horizontal overflow '+s.overflow);
   if(!s.videoReady||!s.playing)failures.push(name+': video failed');
   if(errors.length)failures.push(name+': JavaScript errors '+errors.join(';'));
   const toggle=page.locator('.motion-toggle');
   if(await toggle.count()){await toggle.click();if(!await page.locator('body').evaluate(b=>b.classList.contains('motion-paused')))failures.push(name+': pause control failed')}
   if(width<=390){const menu=page.locator('.menu-toggle');if(await menu.count()){await menu.click();if((await menu.getAttribute('aria-expanded'))!=='true')failures.push(name+': mobile menu failed')}}
   console.log('Checked '+name+': '+s.count+' images, anchors, layout, video ready='+s.videoReady+' playing='+s.playing+', interactions');
  }catch(e){failures.push(name+': browser error '+String(e))}
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
 try{
  await page.goto(pathToFileURL(path.resolve(src)).href,{waitUntil:'load',timeout:45000});
  const ok=await page.evaluate(()=>{const v=document.querySelector('video'),i=document.querySelector('.menu-card img');return (!v||v.paused)&&(!i||getComputedStyle(i).animationName==='none')});
  if(!ok)failures.push('Reduced-motion preference ignored');
 }catch(e){failures.push('Reduced-motion check: '+String(e))}
 await context.close();
}catch(e){failures.push('Browser initialization: '+String(e))}
finally{await browser?.close()}
if(failures.length){for(const msg of failures)console.error('BLOCKED: '+msg);process.exit(1)}
console.log('PASS: preview browser QA. Manual real-device and business review still required.');
