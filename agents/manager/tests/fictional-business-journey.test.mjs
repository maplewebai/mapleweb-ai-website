import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';

const TOKEN='t'.repeat(64);
const schema=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8');
const db=()=>{
  const raw=new DatabaseSync(':memory:');
  raw.exec(schema);
  return {prepare(sql){
    let values=[];
    return {
      bind(...v){values=v;return this;},
      first(){return raw.prepare(sql).get(...values)||null;},
      run(){return raw.prepare(sql).run(...values);},
      all(){return {results:raw.prepare(sql).all(...values)};}
    };
  },close(){raw.close();}};
};
const send=async(env,path,method='GET',data)=>{
  const response=await worker.fetch(new Request('https://staging.example.workers.dev'+path,{
    method,headers:{authorization:'Bearer '+TOKEN,...(data?{'content-type':'application/json'}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
  }),env);
  return {status:response.status,body:await response.json()};
};
const job=(role,action,input={})=>({
  synthetic:true,projectId:'FAKE002',role,action,input
});
const simulate=(role,version)=>({
  synthetic:true,role,version
});

test('synthetic order-through-QA-and-revision journey never publishes, emails, bills or suspends',async()=>{
  const env={MANAGER_OWNER_TOKEN:TOKEN,DB:db()};
  try{
    const email=await send(env,'/api/jobs','POST',job('sales','draft-email',{
      fictional:true,businessType:'fictional neighborhood bakery',
      websiteGoal:'an accessible menu and photo gallery'
    }));
    assert.equal(email.status,201);
    assert.equal(email.body.result.sendingAuthorized,false);
    assert.equal(email.body.result.messagesSent,0);

    const order=await send(env,'/api/jobs','POST',job('sales','prepare-order',{
      fictional:true,tier:3,business:'Fictional Bakery',
      goal:'Provide a clear menu and photo gallery for customers',
      features:['Menu','Photo gallery']
    }));
    assert.equal(order.status,201);
    assert.equal(order.body.result.status,'DRAFT_ORDER_NOT_SUBMITTED');
    assert.equal(order.body.result.kimiBuildTriggered,false);
    assert.equal(order.body.result.paymentCharged,false);
    assert.deepEqual(order.body.result.priceRangeCAD,[1500,2200]);

    const build=await send(env,'/api/jobs','POST',job('website-developer','build-draft',{
      business:'Fictional Bakery',description:'A sample mobile friendly bakery menu'
    }));
    assert.equal(build.status,201);
    assert.equal(build.body.result.version,1);
    assert.equal(build.body.result.externallyHosted,false);

    const qa=await send(env,'/api/jobs','POST',job('quality-checker','review'));
    assert.equal(qa.body.result.status,'LOCAL_QA_PASSED');
    for(const role of ['owner','customer']){
      const response=await send(env,'/api/projects/FAKE002/simulate-approval','POST',simulate(role,1));
      assert.equal(response.status,200);
      assert.equal(response.body.publishAuthorized,false);
    }

    const firstPublish=await send(env,'/api/jobs','POST',job('publishing','readiness'));
    assert.equal(firstPublish.body.result.status,'NOT_PUBLISHED');
    assert.equal(firstPublish.body.result.deploymentsPerformed,0);

    const revision=await send(env,'/api/jobs','POST',job('website-developer','request-revision',{
      note:'Change the fictional site heading'
    }));
    assert.equal(revision.body.project.revisionOpen,true);
    assert.equal(revision.body.project.qaPassed,false);
    assert.equal(revision.body.project.ownerApprovedVersion,null);
    assert.equal(revision.body.project.customerApprovedVersion,null);
    const staleApproval=await send(env,'/api/projects/FAKE002/simulate-approval','POST',simulate('owner',1));
    assert.equal(staleApproval.status,400);

    const rebuild=await send(env,'/api/jobs','POST',job('website-developer','build-draft',{
      business:'Fictional Bakery Updated',description:'Updated fictional bakery menu for review'
    }));
    assert.equal(rebuild.body.project.version,2);
    const qa2=await send(env,'/api/jobs','POST',job('quality-checker','review'));
    assert.equal(qa2.body.result.status,'LOCAL_QA_PASSED');
    for(const role of ['owner','customer']){
      const response=await send(env,'/api/projects/FAKE002/simulate-approval','POST',simulate(role,2));
      assert.equal(response.status,200);
    }

    const unpaid=await send(env,'/api/sites/customers/FAKE002/operations','POST',{
      synthetic:true,action:'suspend',unpaidHours:24,ownerApproved:true
    });
    assert.equal(unpaid.status,403);
    const hq=await send(env,'/api/sites/headquarters/operations','POST',{
      synthetic:true,action:'take-offline',ownerApproved:true
    });
    assert.equal(hq.status,403);

    const publish=await send(env,'/api/jobs','POST',job('publishing','readiness'));
    assert.equal(publish.body.result.status,'NOT_PUBLISHED');
    assert.equal(publish.body.result.deploymentsPerformed,0);
    assert.equal(publish.body.result.liveUrl,null);

    const state=await send(env,'/api/status');
    assert.equal(state.body.paymentsEnabled,false);
    assert.equal(state.body.publishEnabled,false);
    assert.equal(state.body.customerSiteProtection.automaticSuspensionAllowed,false);
    const jobs=await send(env,'/api/jobs');
    assert.ok(jobs.body.jobs.length>=9);
  }finally{
    env.DB.close();
  }
});
