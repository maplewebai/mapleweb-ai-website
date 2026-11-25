// Live staging acceptance. Run only with explicitly authorized staging credentials.
// Never call Stripe, Kimi, Twilio, publication, or any customer-facing API.
import assert from 'node:assert/strict';
const base='https://mapleweb-manager-v2-staging.reasdfghkj.workers.dev';
const token=process.env.MAPLEWEB_STAGING_OWNER_TOKEN;
assert.ok(token&&token.length>=32,'Provide existing owner token via environment, never command arguments');
assert.equal(process.env.MAPLEWEB_LIVE_TEST_AUTHORIZED,'true','Explicit isolated live-test permission required');
const runId='QA'+Date.now();
async function req(path,{method='GET',body,auth=true,expected=200}={}){
 const r=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{...(auth?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal(r.status,expected,method+' '+path);
 return r.json();
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
 assert.ok(commandList.roles.every(r=>!r.paused),'Owner pause states must be respected. No automatic resume.');
 const roleNames=['customer-care','research','sales','website-developer','quality-checker','support','finance','publishing'];
 for(const role of roleNames){
  const proposal=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'run '+role+' for '+runId},expected:201});
  assert.equal(proposal.proposal.state,'AWAITING_APPROVAL');
  const result=await req('/api/manager/commands/'+proposal.proposal.id+'/decision',{method:'POST',body:{decision:'approve'}});
  assert.equal(result.state,'COMPLETED',role+' dispatch');
  assert.equal(result.websiteReleaseAuthorized,false);assert.ok(result.jobId);
  const job=await req('/api/jobs/'+result.jobId);
  assert.equal(job.result.agent,role);assert.equal(job.result.websiteReleaseAuthorized,false);
  assert.equal(Object.hasOwn(job.result,'html'),false);
  console.log('PASS: verified remote job '+role);
 }
 const c=await req('/api/business/cases',{method:'POST',body:{caseId:runId},expected:201});
 const review=await req('/api/business/cases/'+runId+'/events',{method:'POST',body:{expectedRevision:c.case.revision,type:'review-request'}});
 const quote=await req('/api/business/cases/'+runId+'/events',{method:'POST',body:{expectedRevision:review.case.revision,type:'prepare-quote',tier:1,fixedQuoteCAD:650}});
 assert.equal(quote.case.quote.status,'DRAFT_NOT_SENT');assert.equal(quote.case.paymentAuthorized,false);
 await req('/api/business/cases/'+runId+'/fictional-bundle',{expected:423});
 console.log('PASS: live business case and quote, website artifact withheld');
 const model=await req('/api/manager/model');
 assert.equal(model.paidFallback,false);
 if(process.env.MAPLEWEB_AI_TEST_AUTHORIZED==='true'){
  assert.equal(model.enabled,true,'Free-model binding not enabled');
  const ai=await req('/api/manager/chat',{method:'POST',body:{synthetic:true,threadId:t.id,message:'Suggest three improvements for a fictional bakery website.'},expected:201});
  assert.equal(ai.kind,'ai-advice');assert.equal(ai.jobExecuted,false);assert.ok(ai.reply.length>40);
  console.log('PASS: actual configured Workers AI response');
 }else{console.log('NOT VERIFIED: live AI inference (explicit free-plan test authorization required)');process.exitCode=2;}
 console.log('No customer delivery or payment operations tested or enabled. Browser/device verification remains a separate release gate.');
}
main().catch(e=>{console.error('LIVE ACCEPTANCE FAILED: '+e.message);process.exitCode=1});
