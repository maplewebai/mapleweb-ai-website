import test from 'node:test';
import assert from 'node:assert/strict';
import {runStagingRole,remoteRoleState} from '../src/remote.mjs';
const T='role-internal-testing-secret-that-is-not-live';
const api='https://mapleweb-agent-sales-staging.example.workers.dev/execute';
const env={ROLE_INTERNAL_TOKEN:T,AGENT_EXECUTION_URLS:JSON.stringify({sales:api})};
test('remote dispatch uses local deterministic role only when remote is not configured',async()=>{
  const r=await runStagingRole({},'sales','quote',{tier:1},{});
  assert.equal(r.status,'OWNER_REVIEW_REQUIRED');assert.deepEqual(r.priceRangeCAD,[500,800]);
});
test('remote configuration reports mapped roles',()=>{
  assert.deepEqual(remoteRoleState({}),{configured:false,remoteRoles:0,enabled:false});
  assert.deepEqual(remoteRoleState(env),{configured:true,remoteRoles:1,enabled:true});
});
test('remote dispatch requires staging auth and matching agent identity',async()=>{
  let called=0;
  const fetchImpl=async(url,opts)=>{
    called++;
    assert.equal(url,api);assert.equal(opts.headers.authorization,'Bearer '+T);
    assert.equal(opts.method,'POST');
    const body=JSON.parse(opts.body);assert.equal(body.synthetic,true);
    assert.equal(body.action,'quote');assert.equal(body.input.tier,2);
    return new Response(JSON.stringify({agent:'sales',executed:true,
      result:{agent:'sales',status:'OWNER_REVIEW_REQUIRED',priceRangeCAD:[900,1500]}}),{status:200});
  };
  const r=await runStagingRole(env,'sales','quote',{tier:2},{},fetchImpl);
  assert.equal(called,1);assert.deepEqual(r.priceRangeCAD,[900,1500]);
});
test('remote missing endpoint fails rather than running local role',async()=>{
  await assert.rejects(runStagingRole(env,'finance','status'),/Remote role endpoint is not configured/);
});
test('remote endpoint is constrained to secure Cloudflare Workers URL',async()=>{
  const invalid=['http://example.workers.dev/execute','https://evil.com/execute',
    'https://safe.workers.dev/health','https://safe.workers.dev/execute?key=1',
    'https://username@safe.workers.dev/execute','https://evilworkers.dev/execute'];
  for(const url of invalid){
    await assert.rejects(runStagingRole({...env,AGENT_EXECUTION_URLS:JSON.stringify({sales:url})},
      'sales','quote',{tier:1}),/Only isolated Cloudflare role/);
  }
});
test('remote token is mandatory and cannot be short',async()=>{
  await assert.rejects(runStagingRole({...env,ROLE_INTERNAL_TOKEN:'abc'},'sales','quote',{tier:1}),
    /Remote role authentication is not configured/);
});
test('remote response identity mismatch fails closed',async()=>{
  await assert.rejects(runStagingRole(env,'sales','quote',{tier:1},{},async()=>
    new Response(JSON.stringify({agent:'finance',executed:true,result:{agent:'finance'}}),{status:200})),
    /identity mismatch/);
});
test('remote response error fails closed',async()=>{
  await assert.rejects(runStagingRole(env,'sales','quote',{tier:1},{},async()=>
    new Response(JSON.stringify({error:'failed'}),{status:403})),/rejected/);
});
test('network errors fail without local fallback',async()=>{
  await assert.rejects(runStagingRole(env,'sales','quote',{tier:1},{},async()=>{throw Error('offline')}),
    /not reachable/);
});
test('invalid remote map fails safely',async()=>{
  assert.throws(()=>remoteRoleState({AGENT_EXECUTION_URLS:'[not-json'}),/Invalid role execution/);
  await assert.rejects(runStagingRole({...env,AGENT_EXECUTION_URLS:'[]notjson'},
    'sales','quote',{tier:1}),/Invalid role execution/);
});
