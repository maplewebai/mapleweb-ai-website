// End-to-end browser QA against actual Manager and role source, with temporary SQLite.
// No external websites, Cloudflare calls, model inference, real customers or payments.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {chromium} from 'playwright';
import worker from '../../agents/manager/src/worker.mjs';
import roleWorker from '../../agents/roles/src/worker.mjs';
import {ROLES} from '../../agents/manager/src/roles.mjs';

const origin='https://hq-local.test';
const token='local-qa-owner-'.repeat(4),roleToken='local-qa-role-'.repeat(4);
const root=new URL('../../agents/manager/migrations/',import.meta.url);
function localEnv(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(root).filter(x=>/^\d+.*\.sql$/.test(x)).sort())
   db.exec(readFileSync(new URL(file,root),'utf8'));
 const env={MODE:'staging',MANAGER_OWNER_TOKEN:token,ROLE_INTERNAL_TOKEN:roleToken,
   BUSINESS_CASES_ENABLED:'true',MANAGER_COMMANDS_ENABLED:'true',
   MANAGER_THREADS_ENABLED:'true',MANAGER_STRICT_DELIVERY_ENABLED:'true',
   DB:{prepare(sql){let args=[];return {
     bind(...values){args=values;return this},
     first(){return db.prepare(sql).get(...args)||null},
     all(){return {results:db.prepare(sql).all(...args)}},
     run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
   }}}
 };
 env.AGENT_HEALTH_URLS=JSON.stringify(Object.fromEntries(ROLES.map(r=>[r,'https://'+r+'.workers.dev/health'])));
 env.AGENT_EXECUTION_URLS=JSON.stringify(Object.fromEntries(ROLES.map(r=>[r,'https://'+r+'.workers.dev/execute'])));
 for(const role of ROLES)env['ROLE_'+role.toUpperCase().replace(/-/g,'_')]={fetch:req=>roleWorker.fetch(req,{ROLE_NAME:role,ROLE_INTERNAL_TOKEN:roleToken})};
 return {env,close:()=>db.close()};
}
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,768,1440]){
  const local=localEnv();
  const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
    const request=route.request();
    if(!request.url().startsWith(origin+'/')){external.push(request.url());return route.abort()}
    try{
      const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:request.headers(),...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})}),local.env);
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    }catch(e){errors.push(e.message);await route.abort()}
  });
  const click=async selector=>page.locator(selector).click();
  const visible=async selector=>page.locator(selector).waitFor({state:'visible'});
  const text=async(selector,pattern)=>{await page.waitForFunction(({selector,pattern})=>new RegExp(pattern).test(document.querySelector(selector)?.textContent||''),{selector,pattern},{timeout:10000});};
  try{
    await page.goto(origin+'/control');
    await visible('#signin');
    const anon=await page.evaluate(async()=> (await fetch('/api/manager/chat')).status);
    assert.equal(anon,401);
    await page.locator('#secret').fill(token);
    await click('#connect');
    await visible('#manager');
    await text('#chatStatus','Private history loaded');
    await text('#threadStatus','Private conversations available');
    await page.locator('#chatMessage').fill('status');
    await click('#chatSend');
    await text('#chatTurns','authenticated staging Manager is responding');
    await text('#chatStatus','Response recorded');
    // GitHub task controls must not claim live execution without credentials.
    await click('[data-chat="github status"]');
    await text('#chatTurns','GitHub Manager credential is not configured');
    await text('#chatStatus','Response recorded');
    await page.locator('#chatMessage').fill('github task: Verify browser test configuration');
    await click('#chatSend');
    await text('#commandList','Verify browser test configuration');
    await text('#commandList','AWAITING_APPROVAL');
    page.once('dialog',d=>d.accept());
    await page.locator('#commandList .statusrow').filter({hasText:'Verify browser test configuration'}).getByRole('button',{name:'Reject',exact:true}).click();
    await text('#commandList','REJECTED');
    await page.locator('#chatMessage').fill('run finance for LOCALQA');
    await click('#chatSend');
    await text('#commandList','AWAITING_APPROVAL');
    page.once('dialog',d=>d.accept());
    await page.locator('#commandList .statusrow').filter({hasText:'finance / status'}).getByRole('button',{name:'Approve',exact:true}).click();
    await text('#commandList','COMPLETED');
    await text('#commandList','SETUP_NOT_CONNECTED');
    await page.locator('#roleControls .statusrow').filter({hasText:'finance'}).getByRole('button',{name:'Pause',exact:true}).click();
    await text('#roleControls','finance · Paused');
    await page.locator('#roleControls .statusrow').filter({hasText:'finance'}).getByRole('button',{name:'Resume',exact:true}).click();
    await text('#roleControls','finance · New tasks allowed');
    page.once('dialog',d=>d.accept('Local QA conversation'));
    await click('#newThread');
    await visible('#threadAttachments');
    await page.locator('#chatFile').setInputFiles({name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional test brief')});
    page.once('dialog',d=>d.accept());
    await click('#saveChatFile');
    await text('#fileList','brief.txt');
    await page.locator('#fileList').getByRole('button',{name:'Read',exact:true}).click();
    await text('#fileContent','Fictional test brief');
    await click('[data-tab="business"]');
    await text('#businessStatus','Actual private case records loaded');
    await page.locator('#businessId').fill('LOCALCASE');
    await click('#businessCreate');
    await text('#businessTitle','LOCALCASE');
    await click('#businessSave');
    await text('#businessStage','revision 2');
    await click('#businessReview');
    await text('#businessStage','QUOTE_PENDING');
    await page.locator('#bizQuote').fill('650');
    page.once('dialog',d=>d.accept());
    await click('#businessQuote');
    await text('#businessStage','unsent quote CAD 650');
    await click('[data-tab="manager"]');
    const d=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(d.scroll<=d.width+1,'Layout overflow '+JSON.stringify(d));
    await click('#logout');
    await visible('#signin');
    assert.equal(await page.locator('#chatTurns').textContent(),'');
    assert.equal(await page.locator('#fileContent').textContent(),'');
    assert.equal(await page.locator('#businessTitle').textContent(),'Select a case');
    assert.deepEqual(errors,[],'Browser runtime errors');
    assert.deepEqual(external,[],'No external traffic allowed');
    console.log('PASS local browser '+width+'px: owner auth, chat, agent job, pause/resume, files, quote, logout and layout');
  }finally{await context.close();local.close()}
 }
}finally{await browser.close()}
console.log('LOCAL BROWSER QA ONLY — Cloudflare and actual model inference remain unverified.');
