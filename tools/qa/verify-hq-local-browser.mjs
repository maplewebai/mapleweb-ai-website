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
   DB:{batch(statements){db.exec('BEGIN');try{const results=statements.map(st=>st.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}},prepare(sql){let args=[];return {
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
    assert.equal(await page.title(),'AI Agents Headquarters');
    await page.waitForFunction(()=>document.querySelector('.hqSigninBrand')?.naturalWidth===192);

    const anon=await page.evaluate(async()=> (await fetch('/api/manager/chat')).status);
    assert.equal(anon,401);
    await page.locator('#secret').fill(token);
    await click('#connect');
    await visible('#manager');
    await visible('#manager .composer');
    await text('#chatStatus','Private history loaded');
    await text('#threadStatus','Private conversations available');
    await visible('.managerChatHeader');
    assert.equal(await page.locator('#taskDesk').isVisible(),false);
    assert.equal(await page.locator('#banner').isVisible(),false);
    const initialComposer=await page.locator('#manager .composer').boundingBox();
    assert.ok(initialComposer&&initialComposer.y+initialComposer.height<=844,'Composer must be in viewport');
    await page.locator('#chatMessage').fill('status');
    await click('#chatSend');
    await text('#chatTurns','authenticated staging Manager is responding');
    await visible('#chatTurns .userMessage');
    await visible('#chatTurns .assistantBody');
    await visible('#chatTurns .replyActions button');
    assert.equal(await page.locator('#chatTurns .pendingMessage').count(),0);
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
    await click('#managerBackChat');
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
    await page.locator('#chatRole').selectOption('manager');
    await page.locator('#chatProject').fill('MANAGERQA');
    await click('#proposeTask');
    await text('#commandList','manager / coordinate-project');
    await text('#commandList','AWAITING_APPROVAL');
    page.once('dialog',d=>d.accept());
    await page.locator('#commandList .statusrow').filter({hasText:'MANAGERQA'}).getByRole('button',{name:'Approve',exact:true}).click();
    await text('#commandList','8/8 staging steps confirmed');
    await text('#countDone','2');
    await page.locator('#taskFilter').selectOption('AWAITING_APPROVAL');
    await text('#commandList','No matching saved tasks');
    await page.locator('#taskFilter').selectOption('all');
    await text('#commandList','8/8 staging steps confirmed');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(17, 17, 17)');
    await click('#managerBackChat');
    await page.locator('#chatMessage').fill('Please create a fictional bakery website and test it');
    await click('#chatSend');
    await text('#chatTurns','Task prepared');
    await visible('#chatTurns .inlineTask');
    await text('#chatTurns .inlineTask','AWAITING APPROVAL');
    assert.equal(await page.locator('#managerChatView').isVisible(),true);
    await page.locator('#chatTurns .inlineTask').getByRole('button',{name:'Approve & run',exact:true}).click();
    await text('#chatTurns .inlineTask','8/8 staging steps confirmed');
    await text('#chatTurns .inlineTask','COMPLETED');
    assert.equal(await page.locator('#managerChatView').isVisible(),true);
    await page.locator('#chatMessage').fill('Finish and test it');
    await click('#chatSend');
    await text('#chatTurns','Which fictional project should I finish and test');


    if(width<=900)await click('#managerMenu');
    await click('[data-tab="agents"]');
    await page.locator('#agentGrid .agent').filter({hasText:'Website Developer'}).click();
    await visible('#agentWorkspace');
    assert.equal(await page.locator('#agents').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator('[data-tab="agents"]').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator('#agentWorkspace').evaluate(el=>el.closest('#agents')!==null),true);
    if(width<1100)assert.equal(await page.locator('#agentDirectory').isVisible(),false);
    else assert.equal(await page.locator('#agentDirectory').isVisible(),true);
    await visible('#agentConversation .composer');

    await text('#workspaceName','Website Developer');
    await text('#workspaceStatus','Records checked');
    await click('#agentAskStatus');
    await text('#agentTurns','Verified website-developer records');
    await visible('#agentTurns .userMessage');
    await visible('#agentTurns .assistantBody');
    await visible('#agentTurns .replyActions button');
    assert.equal(await page.locator('#agentTurns .pendingMessage').count(),0);
    await click('[data-agent-pane="agentAssignPane"]');
    await page.locator('#agentProject').fill('AGENTQA');
    await page.locator('#agentDetail').fill('Fictional bookstore with a reading area');
    await click('#agentPrepare');
    await visible('#agentTasksPane');
    await text('#agentAssignments','AGENTQA');
    await text('#agentAssignments','AWAITING APPROVAL');
    page.once('dialog',d=>d.accept());
    await page.locator('#agentAssignments .workspaceJob').filter({hasText:'AGENTQA'}).getByRole('button',{name:'Approve',exact:true}).click();
    await text('#agentAssignments','DRAFT READY FOR QA');
    await text('#agentJobs','AGENTQA');
    const workspaceResult=await page.evaluate(async tok=>(await fetch('/api/agents/website-developer/workspace',{headers:{authorization:'Bearer '+tok}})).json(),token);
    assert.ok(workspaceResult.jobs.every(j=>j.role==='website-developer'&&!Object.hasOwn(j,'result_json')));
    assert.ok(workspaceResult.turns.some(t=>t.message.includes('Fictional bookstore')));
    await click('#agentBack');
    await click('#createAgentOpen');
    await page.locator('#newAgentName').fill('QA Research Assistant');
    await page.locator('#newAgentDescription').fill('Prepare fictional research plans');
    await page.locator('#newAgentInstructions').fill('Use concise bullet points');
    await page.locator('#newAgentRole').selectOption('research');
    await click('#createAgentSubmit');
    await text('#workspaceName','QA Research Assistant');
    await text('#workspaceStatus','Records checked');
    await click('#agentAskStatus');
    await text('#agentTurns','Uses research worker');
    await click('[data-agent-pane="agentAssignPane"]');
    await page.locator('#agentProject').fill('CUSTOMQA');
    await page.locator('#agentDetail').fill('fictional bakery');
    await click('#agentPrepare');
    await text('#agentAssignments','AWAITING APPROVAL');
    page.once('dialog',d=>d.accept());
    await page.locator('#agentAssignments .workspaceJob').filter({hasText:'CUSTOMQA'}).getByRole('button',{name:'Approve',exact:true}).click();
    await text('#agentAssignments','RESEARCH PLAN ONLY');
    await text('#agentJobs','CUSTOMQA');
    await click('#agentBack');
    await text('#customAgentCount','1 custom profiles');
    await page.locator('#agentGrid .agent').filter({hasText:'QA Research Assistant'}).click();
    await text('#agentTurns','Assign plan for CUSTOMQA');
    await click('#agentReviewWork');
    await text('#agentTurns','Recorded work outcomes for learning');
    await click('#agentConnections');
    await visible('#connections');
    await text('#connectionStatus','No saved connections for this agent');
    await page.locator('#connectionLabel').fill('Fictional service');
    await page.locator('#connectionUrl').fill('https://example.com');
    await page.locator('#connectionPurpose').fill('Request a fictional business account');
    await page.locator('#connectionType').selectOption('new-account');
    await click('#connectionSubmit');
    await text('#connectionList','REQUESTED');
    page.once('dialog',d=>d.accept());
    await page.locator('#connectionList').getByRole('button',{name:'Approve request',exact:true}).click();
    await text('#connectionList','APPROVED');
    await page.locator('#connectionList').getByRole('button',{name:'Verify read access',exact:true}).click();
    await text('#connectionList','No external account created');
    await page.locator('#connectionList').getByRole('button',{name:'Revoke request',exact:true}).click();
    await text('#connectionList','REVOKED');
    await click('[data-tab="agents"]');
    await page.locator('#agentGrid .agent').filter({hasText:'Quality Checker'}).click();
    await text('#workspaceName','Quality Checker');
    await text('#workspaceStatus','Records checked');
    assert.ok(!(await page.locator('#agentTurns').textContent()).includes('Fictional bookstore'));
    await click('#agentBack');
    await page.locator('#agentGrid .agent').filter({hasText:'Website Developer'}).click();
    await text('#agentTurns','Fictional bookstore');
    const workspaceLayout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(workspaceLayout.scroll<=workspaceLayout.width+1,'Workspace layout overflow '+JSON.stringify(workspaceLayout));
    await click('[data-tab="manager"]');

    assert.equal(await page.locator('#agents').isVisible(),false);
    await click('#managerMore');
    await click('.chatHistoryPanel summary');
    await visible('#newThread');
    page.once('dialog',d=>d.accept('Local QA conversation'));
    await click('#newThread');
    await visible('#threadAttachments');
    await page.locator('#chatFile').setInputFiles({name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional test brief')});
    page.once('dialog',d=>d.accept());
    await click('#saveChatFile');
    await text('#fileList','brief.txt');
    await page.locator('#fileList').getByRole('button',{name:'Read',exact:true}).click();
    await text('#fileContent','Fictional test brief');
    if(width<=900)await click('#managerMenu');
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
    await click('[data-tab="infrastructure"]');
    await text('#cloudStatus','Private configuration records loaded');
    await page.locator('#cloudDomain').fill('example.com');
    await click('#cloudAddDomain');
    await text('#cloudDomains','example.com');
    await page.locator('#cloudAgent').selectOption('manager');
    await click('#cloudPlanEmail');
    await text('#cloudEmails','manager@example.com');
    await text('#cloudEmails','not an active email address');
    const cloudLayout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(cloudLayout.scroll<=cloudLayout.width+1,'Cloud layout overflow '+JSON.stringify(cloudLayout));
    await click('[data-tab="manager"]');
    const d=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(d.scroll<=d.width+1,'Layout overflow '+JSON.stringify(d));
    await click('#managerMore');
    await click('#managerSignout');
    await visible('#signin');
    assert.equal(await page.locator('#chatTurns').textContent(),'');
    assert.equal(await page.locator('#agentTurns').textContent(),'');
    assert.equal(await page.locator('#agentAssignments').textContent(),'');
    assert.equal(await page.locator('#fileContent').textContent(),'');
    assert.equal(await page.locator('#businessTitle').textContent(),'Select a case');
    assert.deepEqual(errors,[],'Browser runtime errors');
    assert.deepEqual(external,[],'No external traffic allowed');
    console.log('PASS local browser '+width+'px: owner auth, chat, agent job, pause/resume, files, quote, logout and layout');
  }finally{await context.close();local.close()}
 }
}finally{await browser.close()}
console.log('LOCAL BROWSER QA ONLY — Cloudflare and actual model inference remain unverified.');
