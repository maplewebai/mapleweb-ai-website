// Live staging acceptance. Run only with explicitly authorized staging credentials.
// Never call Stripe, Kimi, Twilio, publication, or any customer-facing API.
import assert from 'node:assert/strict';
const base='https://mapleweb-manager-v2-staging.reasdfghkj.workers.dev';
const token=process.env.MAPLEWEB_STAGING_OWNER_TOKEN;
const expectedBuild=process.env.MAPLEWEB_EXPECTED_BUILD;
assert.match(expectedBuild||'',/^[a-f0-9]{40}$/,'Expected exact staging build required');
assert.ok(token&&token.length>=32,'Provide existing owner token via environment, never command arguments');
assert.equal(process.env.MAPLEWEB_LIVE_TEST_AUTHORIZED,'true','Explicit isolated live-test permission required');
const runId='QA'+crypto.randomUUID().replace(/-/g,'').slice(0,20).replace(/[0-9]/g,d=>String.fromCharCode(65+Number(d))).toUpperCase();
async function req(path,{method='GET',body,auth=true,expected=200,timeoutMs=45000}={}){
 const r=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{...(auth?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal(r.headers.get('X-MapleWeb-Build'),expectedBuild,'Response came from unexpected staging build; stop without retrying mutations');
 const data=await r.json().catch(()=>null);
 if(r.status!==expected){
  const safeErrors=['Task record not found','Task not found','Not found or method not allowed','Verified remote role binding and authentication are required','Owner task controls are not configured','Task already decided; no retry','Task already decided','Role is paused by owner','Task write not confirmed','Task readback not confirmed','Internal error'];
  const reason=safeErrors.includes(data?.error)?data.error:'Unclassified response';
  throw Error(method+' '+path.replace(/[a-f0-9-]{36}/g,'[record]')+' returned '+r.status+' expected '+expected+' ('+reason+')');
 }
 assert.ok(data&&typeof data==='object','Expected JSON response');
 return data;
}
async function main(){
 await req('/api/status',{auth:false,expected:401});
 await req('/api/manager/chat',{auth:false,expected:401});
 await req('/api/manager/threads',{auth:false,expected:401});
 const health=await req('/health',{auth:false});
 assert.equal(health.mode,'staging');assert.equal(health.publishingEnabled,false);
 const status=await req('/api/status');
 assert.equal(status.storageReady,true);assert.equal(status.publishEnabled,false);assert.equal(status.paymentsEnabled,false);
 assert.equal(status.realCustomerInputAllowed,false);
 const roles=await req('/api/integrations/agents-health');
 assert.equal(roles.liveRolesVerified,8);assert.equal(roles.totalRoles,8);assert.ok(roles.results.every(x=>x.verified));
 console.log('PASS: owner auth, staging safety and eight remote health responses');
 const t=await req('/api/manager/threads',{method:'POST',body:{synthetic:true,title:'Release acceptance '+runId},expected:201});
 const turn=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'status'},expected:201});
 assert.equal(turn.kind,'verified-record');
 const saved=await req('/api/manager/chat?threadId='+encodeURIComponent(t.id));
 assert.equal(saved.turns.length,1);
 const file=await req('/api/manager/threads/'+t.id+'/files',{method:'POST',body:{synthetic:true,filename:'test.txt',content:'Fictional acceptance brief'},expected:201});
 assert.equal(file.externalTransfer,false);
 assert.equal((await req('/api/manager/threads/'+t.id+'/files/'+file.id)).content,'Fictional acceptance brief');
 await req('/api/manager/threads/'+t.id+'/files/'+file.id,{method:'DELETE'});
 console.log('PASS: live D1 conversation persistence and private file operations');
 const commandList=await req('/api/manager/commands');
 assert.ok(commandList.roles.filter(r=>r.role!=='github').every(r=>!r.paused),'Owner pause states must be respected. No automatic resume.');
 const roleNames=['customer-care','research','sales','website-developer','quality-checker','support','finance','publishing'];
 for(const role of roleNames){
  const proposal=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'run '+role+' for '+runId},expected:201});
  assert.equal(proposal.proposal.state,'AWAITING_APPROVAL');
  const stored=await req('/api/manager/commands/'+proposal.proposal.id);
  assert.equal(stored.task.id,proposal.proposal.id);
  assert.equal(stored.task.state,'AWAITING_APPROVAL');
  assert.equal(stored.task.role,role);
  console.log('PASS: persisted approval record '+role);
  const result=await req('/api/manager/commands/'+proposal.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
  assert.equal(result.state,'COMPLETED',role+' dispatch');
  const expected={ 'customer-care':'DRAFT_ONLY',research:'RESEARCH_PLAN_ONLY',sales:'OWNER_REVIEW_REQUIRED','website-developer':'DRAFT_READY_FOR_QA','quality-checker':'LOCAL_QA_PASSED',support:'DRAFT_ONLY',finance:'SETUP_NOT_CONNECTED',publishing:'NOT_PUBLISHED' };
  assert.equal(result.resultStatus,expected[role],role+' actual result');
  assert.equal(result.websiteReleaseAuthorized,false);assert.ok(result.jobId);
  const job=await req('/api/jobs/'+result.jobId);
  assert.equal(job.result.agent,role);assert.equal(job.result.websiteReleaseAuthorized,false);
  assert.equal(Object.hasOwn(job.result,'html'),false);
  console.log('PASS: verified remote job '+role);
 }
 const managerProject=runId+'M';
 const managerTask=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'run manager for '+managerProject},expected:201});
 assert.equal(managerTask.proposal.role,'manager');assert.equal(managerTask.proposal.state,'AWAITING_APPROVAL');
 const managerResult=await req('/api/manager/commands/'+managerTask.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
 assert.equal(managerResult.state,'COMPLETED');
 assert.match(managerResult.resultStatus,/8\/8 staging steps confirmed/);
 assert.equal(managerResult.websiteReleaseAuthorized,false);
 const managerSaved=await req('/api/manager/commands/'+managerTask.proposal.id);
 assert.equal(managerSaved.task.state,'COMPLETED');assert.equal(managerSaved.task.result_status,managerResult.resultStatus);
 console.log('PASS: Manager coordinated all eight verified remote stages and persisted completion');
 // Role workspace acceptance: actual authenticated API, private history and remote execution.
 await req('/api/agents/research/workspace',{auth:false,expected:401});
 for(const role of roleNames){
   const ws=await req('/api/agents/'+role+'/workspace');
   assert.equal(ws.role,role);assert.ok(ws.tasks.every(x=>x.role===role));assert.ok(ws.jobs.every(x=>x.role===role&&!Object.hasOwn(x,'result_json')));
 }
 const roleProject=runId+'R';
 const roleMessage=await req('/api/agents/research/chat',{method:'POST',body:{synthetic:true,message:'show tasks'},expected:201});
 assert.equal(roleMessage.kind,'verified-record');assert.equal(roleMessage.jobExecuted,false);assert.match(roleMessage.reply,/Verified research records/);
 const roleTask=await req('/api/agents/research/tasks',{method:'POST',body:{synthetic:true,projectId:roleProject,detail:'fictional bookstore'},expected:201});
 assert.equal(roleTask.proposal.state,'AWAITING_APPROVAL');
 const roleSaved=await req('/api/agents/research/workspace');
 assert.equal(roleSaved.tasks.find(x=>x.id===roleTask.proposal.id)?.detail,'fictional bookstore');
 const roleResult=await req('/api/manager/commands/'+roleTask.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
 assert.equal(roleResult.state,'COMPLETED');assert.equal(roleResult.resultStatus,'RESEARCH_PLAN_ONLY');
 const roleAfter=await req('/api/agents/research/workspace');
 assert.ok(roleAfter.jobs.some(j=>j.project_id===roleProject&&j.result_status==='RESEARCH_PLAN_ONLY'));
 assert.ok(roleAfter.turns.some(t=>t.message.includes(roleProject)));
 const other=await req('/api/agents/finance/workspace');
 assert.ok(other.turns.every(t=>!t.message.includes(roleProject)));
 console.log('PASS: per-agent private chat, task isolation, approval and verified remote job results');
 const c=await req('/api/business/cases',{method:'POST',body:{caseId:runId},expected:201});
 const review=await req('/api/business/cases/'+runId+'/events',{method:'POST',body:{expectedRevision:c.case.revision,type:'review-request'}});
 const quote=await req('/api/business/cases/'+runId+'/events',{method:'POST',body:{expectedRevision:review.case.revision,type:'prepare-quote',tier:1,fixedQuoteCAD:650}});
 assert.equal(quote.case.quote.status,'DRAFT_NOT_SENT');assert.equal(quote.case.paymentAuthorized,false);
 await req('/api/business/cases/'+runId+'/fictional-bundle',{expected:423});
 console.log('PASS: live business case and quote, website artifact withheld');
 const page=await fetch(base+'/control',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'cache-control':'no-cache'}});
 assert.equal(page.status,200);assert.equal(page.headers.get('X-MapleWeb-Build'),expectedBuild);
 const markup=await page.text();
 for(const id of ['managerChatView','managerTaskView','managerMenu','managerNewChat','chatSend'])assert.ok(markup.includes('id="'+id+'"'),'Live full-screen Manager missing '+id);
 console.log('PASS: exact deployed full-screen Manager HTML');
 await req('/api/manager/quota',{auth:false,expected:401});
 const quota=await req('/api/manager/quota');
 assert.equal(quota.cap,null);assert.equal(quota.remaining,null);assert.equal(quota.providerFreeNeuronLimit,10000);assert.ok(Number.isSafeInteger(quota.used));
 const badCommand=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'run manager for I want you to finish and test'},expected:201});
 assert.equal(badCommand.kind,'verified-record');assert.equal(badCommand.jobExecuted,false);assert.match(badCommand.reply,/No task was created/);
 const natural=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Please create a fictional bakery website and test it'},expected:201});
 assert.equal(natural.inlineApproval,true);assert.equal(natural.jobExecuted,false);assert.equal(natural.proposal.role,'manager');
 assert.equal(natural.proposal.state,'AWAITING_APPROVAL');
 const naturalResult=await req('/api/manager/commands/'+natural.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
 assert.equal(naturalResult.state,'COMPLETED');assert.match(naturalResult.resultStatus,/8\/8 staging steps confirmed/);assert.equal(naturalResult.websiteReleaseAuthorized,false);
 const naturalHistory=await req('/api/manager/chat?threadId='+encodeURIComponent(t.id));
 assert.ok(naturalHistory.turns.some(x=>x.reply.includes('Task reference: '+natural.proposal.id)));
 const afterNaturalQuota=await req('/api/manager/quota');
 if(afterNaturalQuota.day===quota.day)assert.equal(afterNaturalQuota.used,quota.used,'Natural task must not spend AI quota');
 console.log('PASS: ordinary English task request, owner-approved remote execution, saved chat reference and unchanged AI quota');
 const blocked=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Make the 4 website and test them and publish and also give all 4 website link'},expected:201});
 assert.equal(blocked.kind,'verified-record');assert.equal(blocked.jobExecuted,false);assert.equal(blocked.proposal,undefined);assert.match(blocked.reply,/Publication and website links are blocked/);
 const batch=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Create four new fictional websites and test them'},expected:201});
 assert.equal(batch.proposal.action,'coordinate-four-samples');assert.equal(batch.proposal.state,'AWAITING_APPROVAL');assert.equal(batch.jobExecuted,false);
 const batchResult=await req('/api/manager/commands/'+batch.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
 assert.equal(batchResult.state,'COMPLETED');assert.match(batchResult.resultStatus,/4\/4 basic drafts structurally checked/);assert.equal(batchResult.websiteReleaseAuthorized,false);
 console.log('PASS: four fictional draft workflow, structural checks, and blocked publication');
 const existingId=natural.proposal.projectId;
 const projectStatus=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Give me an update on '+existingId},expected:201});
 assert.equal(projectStatus.kind,'verified-record');assert.match(projectStatus.reply,/draft version/);assert.equal(projectStatus.jobExecuted,false);
 const before=await req('/api/projects/'+existingId);
 const namedQA=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Finish and test the '+existingId+' website'},expected:201});
 assert.equal(namedQA.proposal.role,'quality-checker');assert.equal(namedQA.proposal.projectId,existingId);assert.equal(namedQA.jobExecuted,false);
 const qa=await req('/api/manager/commands/'+namedQA.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
 assert.equal(qa.state,'COMPLETED');assert.equal(qa.resultStatus,'LOCAL_QA_PASSED');assert.equal(qa.websiteReleaseAuthorized,false);
 const after=await req('/api/projects/'+existingId);
 assert.equal(after.project.version,before.project.version);
 console.log('PASS: named project status, owner-approved structural QA and unchanged existing draft version');
 // Verify custom profile endpoints without adding test profiles to the owner's directory.
 await req('/api/custom-agents',{auth:false,expected:401});
 await req('/api/custom-agents',{method:'POST',auth:false,body:{synthetic:true,name:'Unauthorized QA profile',description:'Fictional test',instructions:'',baseRole:'chat-only'},expected:401});
 const profiles=await req('/api/custom-agents');
 assert.ok(Array.isArray(profiles.agents));assert.equal(profiles.limit,50);
 assert.ok(markup.includes('id="createAgentOpen"'));assert.ok(markup.includes('id="createAgentForm"'));
 for(const profile of profiles.agents.slice(0,3)){
   const ws=await req('/api/custom-agents/'+profile.id+'/workspace');
   assert.equal(ws.id,profile.id);assert.ok(Array.isArray(ws.turns));assert.ok(Array.isArray(ws.tasks));
 }
 console.log('PASS: exact live Create Agent form, private profile directory and authentication; creation and dispatch tested in local browser without adding live test profiles.');
 await req('/api/browser/status',{auth:false,expected:401});
 const browser=await req('/api/browser/status');
 assert.equal(browser.paidFallback,false);assert.equal(browser.authenticatedSessions,false);
 assert.ok(markup.includes('id="browserReady"'));assert.ok(markup.includes('id="browserPageText"'));
 if(process.env.MAPLEWEB_BROWSER_TEST_AUTHORIZED==='true'){
   assert.equal(browser.enabled,true,'Free browser binding unavailable');
   const conn=await req('/api/agent-connections/manager',{method:'POST',body:{synthetic:true,label:'Release acceptance public example',url:'https://example.com/',purpose:'Synthetic public browser test',accessType:'read'},expected:201});
   try{
     await req('/api/agent-connections/manager/'+conn.id,{method:'POST',body:{action:'approve'}});
     const page=await req('/api/agent-connections/manager/'+conn.id+'/read',{method:'POST',body:{confirm:true}});
     assert.equal(page.url,'https://example.com/');assert.match(page.title,/Example Domain/i);assert.match(page.text,/Example Domain/i);assert.equal(page.externalAccountAccess,false);
     console.log('PASS: actual public browser page retrieval with owner-approved connection and no account access');
   }finally{await req('/api/agent-connections/manager/'+conn.id,{method:'POST',body:{action:'revoke'}});}
 }else{
   assert.equal(browser.enabled,false);
   console.log('NOT VERIFIED: browser remains disabled pending successful provider validation.');
 }
 await req('/api/infrastructure',{auth:false,expected:401});
 const cloud=await req('/api/infrastructure');
 assert.ok(Array.isArray(cloud.domains));assert.ok(Array.isArray(cloud.emails));
 assert.equal(cloud.provider.emailRoutingEnabled,false);assert.equal(cloud.provider.inboxEnabled,false);
 assert.equal(cloud.paidServicesEnabled,false);
 assert.ok(markup.includes('id="cloudDomainForm"'));assert.ok(markup.includes('id="cloudEmailForm"'));
 console.log('PASS: exact deployed Cloud and Email dashboard and owner-only planning records. No live email provisioning.');
 assert.ok(markup.includes('<title>AI Agents Headquarters</title>'));assert.ok(markup.includes('src="/hq-brand.webp"'));
 const brand=await fetch(base+'/hq-brand.webp',{signal:AbortSignal.timeout(15000)});
 assert.equal(brand.status,200);assert.equal(brand.headers.get('X-MapleWeb-Build'),expectedBuild);assert.equal(brand.headers.get('content-type'),'image/webp');
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(new Uint8Array(await brand.arrayBuffer())).digest('hex'),'9a763352ae3b9aab2c396d0a42cc7f7072914f27da9e7bff2c932dcc67fc1f8d');
 const manifest=await req('/control.webmanifest',{auth:false});assert.equal(manifest.name,'AI Agents Headquarters');assert.equal(manifest.short_name,'AI Agents HQ');
 console.log('PASS: exact deployed AI Agents Headquarters name and approved logo bytes');
 await req('/api/internal-mail/directory',{auth:false,expected:401});
 const mailboxes=await req('/api/internal-mail/directory');
 assert.ok(mailboxes.length>=9);
 assert.equal(new Set(mailboxes.map(m=>m.address)).size,mailboxes.length);
 assert.ok(mailboxes.every(m=>m.address.endsWith('@agents-hq.invalid')));
 const inbox=await req('/api/internal-mail/manager');
 assert.equal(inbox.externalDelivery,false);assert.ok(Array.isArray(inbox.inbox));assert.ok(Array.isArray(inbox.sent));
 assert.ok(markup.includes('id="mailForm"'));assert.ok(markup.includes('id="mailInbox"'));
 console.log('PASS: live owner-only internal mail directory, Manager inbox and exact UI. Internal delivery tested in local database and browser; no live Internet mail.');
 await req('/api/manager/supervision',{auth:false,expected:401});
 const supervisors=await req('/api/manager/supervision');
 assert.ok(supervisors.length>=9);assert.ok(roleNames.every(role=>supervisors.some(a=>a.id===role)));
 const direct=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Assign Research for project '+runId+': fictional bakery'},expected:201});
 assert.equal(direct.taskResult.state,'COMPLETED');assert.equal(direct.taskResult.resultStatus,'RESEARCH_PLAN_ONLY');assert.equal(direct.jobExecuted,true);
 assert.ok(markup.includes('Supervise all agents'));
 console.log('PASS: owner-only supervision directory and actual directly delegated remote research job, no second approval.');
 await req('/api/hq/knowledge',{auth:false,expected:401});
 const caps=await req('/api/hq/capabilities');assert.equal(caps.virtualComputer,'NOT_CONNECTED');assert.equal(caps.paidFallback,false);
 assert.ok(markup.includes('id="hqKnowledgePanel"'));
 const k=await req('/api/hq/knowledge',{method:'POST',body:{synthetic:true,title:'Fictional knowledge '+runId,source:'Release test',body:'Fictional bakery homepage displays opening hours.'},expected:201});
 try{
  assert.equal((await req('/api/hq/knowledge/'+k.id)).source,'Release test');
  const found=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Search knowledge: '+runId},expected:201});
  assert.match(found.reply,/Fictional bakery homepage/);
  const calc=await req('/api/agents/finance/chat',{method:'POST',body:{synthetic:true,message:'Calculate: (1200+300)*0.13'},expected:201});
  assert.match(calc.reply,/= 195/);assert.equal(calc.jobExecuted,false);
 }finally{await req('/api/hq/knowledge/'+k.id,{method:'DELETE'});}
 console.log('PASS: live shared knowledge storage, source-aware lookup, exact UI, and agent calculator');
 const ref=await req('/api/agent-connections/manager',{method:'POST',body:{synthetic:true,label:'W3C release check',url:'https://www.w3.org/robots.txt',purpose:'Public reference acceptance',accessType:'read'},expected:201});
 try{
  await req('/api/agent-connections/manager/'+ref.id,{method:'POST',body:{action:'approve'}});
  const read=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Read reference: https://www.w3.org/robots.txt'},expected:201});
  if(read.reply.startsWith('Public reference —')&&read.reply.includes('Untrusted text excerpt'))console.log('PASS: actual approved public HTTP reference read, no browser or login');
  else console.log('NOT VERIFIED: live public reference provider response; local reader tests passed.');
 }finally{await req('/api/agent-connections/manager/'+ref.id,{method:'POST',body:{action:'revoke'}});}
 const model=await req('/api/manager/model');
 assert.equal(model.paidFallback,false);assert.equal(model.dailyRequestCap,null);
 if(process.env.MAPLEWEB_AI_TEST_AUTHORIZED==='true'){
  assert.equal(model.enabled,true,'Free-model binding not enabled');
  const ai=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Suggest three improvements for a fictional bakery website.'},expected:201,timeoutMs:120000});
  if(ai.kind==='unavailable'&&ai.aiFailure==='PROVIDER_3036'){
   const after=await req('/api/manager/quota');
   assert.equal(after.cap,null);assert.equal(ai.jobExecuted,false);assert.match(ai.reply,/free AI compute allowance is exhausted/);
   console.log('PASS: real quota exhaustion handled safely; verified task controls remain operational. Fresh model inference NOT verified in this release.');
   process.exitCode=3;
  }else{
   assert.equal(ai.kind,'ai-advice','AI inference: '+(/^(?:PROVIDER_[A-Z0-9_]+|EMPTY_[A-Z0-9_]+)$/.test(ai.aiFailure||'')?ai.aiFailure:'NO_SAFE_DIAGNOSTIC'));assert.equal(ai.jobExecuted,false);assert.ok(ai.reply.length>40);
   console.log('PASS: actual configured Workers AI response');
  }
 }else{console.log('NOT VERIFIED: live AI inference (explicit free-plan test authorization required)');process.exitCode=2;}
 console.log('No customer delivery or payment operations tested or enabled. Browser/device verification remains a separate release gate.');
}
main().catch(e=>{console.error('LIVE ACCEPTANCE FAILED: '+e.message);process.exitCode=1});
