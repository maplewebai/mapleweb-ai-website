import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGING_AUTOMATION_STEPS,dailyProjectId,runStagingAutomation} from '../src/staging-automation.mjs';

const env=()=>({MODE:'staging',SYNTHETIC_AUTOMATION_ENABLED:'true',DB:{},
  MANAGER_OWNER_TOKEN:'fictional-manager-only-token-length-okay',
  AGENT_EXECUTION_URLS:'{"website-developer":"https://fake.workers.dev/execute"}'});
test('daily demonstration covers exactly eight agents in safe dependency order',()=>{
  assert.equal(STAGING_AUTOMATION_STEPS.length,9);
  assert.equal(new Set(STAGING_AUTOMATION_STEPS.map(s=>s.role)).size,8);
  assert(STAGING_AUTOMATION_STEPS.findIndex(s=>s.role==='website-developer')<
    STAGING_AUTOMATION_STEPS.findIndex(s=>s.role==='quality-checker'));
  assert(STAGING_AUTOMATION_STEPS.findIndex(s=>s.role==='quality-checker')<
    STAGING_AUTOMATION_STEPS.findIndex(s=>s.role==='publishing'));
  assert.equal(dailyProjectId(Date.UTC(2026,10,24)),'AUTO20261124');
});
test('all eight roles automatically receive nine synthetic Manager jobs with no unsafe effects',async()=>{
  const calls=[];
  const result=await runStagingAutomation(env(),{
    scheduledTime:Date.UTC(2026,10,24),
    handleJob:async request=>{
      assert.equal(new URL(request.url).pathname,'/api/jobs');
      assert.equal(request.headers.get('authorization'),'Bearer '+env().MANAGER_OWNER_TOKEN);
      const p=await request.json();
      assert.equal(p.synthetic,true);
      assert.equal(p.projectId,'AUTO20261124');
      const step=STAGING_AUTOMATION_STEPS[calls.length];
      assert.equal(p.role,step.role);
      assert.equal(p.action,step.action);
      calls.push(p);
      const content={result:{agent:p.role,status:step.expected},
        project:{qaPassed:step.role==='quality-checker'}};
      if(p.role==='sales'){content.result.invoiceCreated=false;content.result.paymentCharged=false;}
      if(p.role==='website-developer')content.result.externallyHosted=false;
      if(p.role==='publishing'){content.result.deploymentsPerformed=0;content.result.liveUrl=null;}
      return Response.json(content,{status:201});
    }});
  assert.equal(calls.length,9);
  assert.equal(result.rolesCompleted,8);
  assert.equal(result.stepsCompleted,9);
  assert.equal(result.paidUsageEnabled,false);
  assert.equal(result.customerContactEnabled,false);
  assert.equal(result.published,false);
});
test('automation refuses unauthorized and non-staging contexts',async()=>{
  for(const changed of [
    {MODE:'production'},{SYNTHETIC_AUTOMATION_ENABLED:'false'},
    {MANAGER_OWNER_TOKEN:''},{AGENT_EXECUTION_URLS:''},{DB:null}
  ]){
    await assert.rejects(runStagingAutomation({...env(),...changed},{handleJob:async()=>Response.json({})}),
      /not authorized or configured/);
  }
});
test('automation stops immediately when a role returns an unexpected result',async()=>{
  let count=0;
  await assert.rejects(runStagingAutomation(env(),{handleJob:async()=>{
    count++;return Response.json({result:{agent:'customer-care',status:'WRONG'}},{status:201});
  }}),/unexpected result/);
  assert.equal(count,1);
});
test('automation refuses unsafe payment, hosting, or publishing result',async()=>{
  for(const failRole of ['sales','website-developer','publishing']){
    let count=0;
    await assert.rejects(runStagingAutomation(env(),{handleJob:async()=>{
      const step=STAGING_AUTOMATION_STEPS[count++];
      const result={agent:step.role,status:step.expected};
      if(step.role==='sales'){result.paymentCharged=failRole==='sales';result.invoiceCreated=false;}
      if(step.role==='website-developer')result.externallyHosted=failRole==='website-developer';
      if(step.role==='publishing'){result.liveUrl=null;result.deploymentsPerformed=failRole==='publishing'?1:0;}
      return Response.json({result,project:{qaPassed:true}},{status:201});
    }}),/safety result violated|private/);
    assert(count>0);
  }
});
