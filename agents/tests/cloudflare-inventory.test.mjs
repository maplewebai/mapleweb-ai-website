import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAccount,inventory} from '../cloudflare-inventory.mjs';

const ACCOUNT='b'.repeat(32);
const DB='12345678-1234-1234-1234-123456789abc';
function fakeCloudflare({dbName='mapleweb-manager-staging-db',workers=[{id:'existing-public-site'}],accounts=[{id:ACCOUNT}]}={}) {
  return async function fakeFetch(url, options) {
    assert.equal(options.method,'GET','inventory must never modify Cloudflare');
    assert.equal(options.headers.authorization,'Bearer synthetic-token');
    const path=new URL(url).pathname;
    let result;
    if(path==='/client/v4/accounts')result=accounts;
    else if(path.endsWith('/accounts/'+ACCOUNT))result={id:ACCOUNT};
    else if(path.endsWith('/workers/subdomain'))result={subdomain:'staging-example'};
    else if(path.endsWith('/d1/database'))result=[{name:dbName,uuid:DB}];
    else if(path.endsWith('/d1/database/'+DB))result={name:dbName,uuid:DB};
    else if(path.endsWith('/workers/scripts'))result=workers;
    else throw Error('Unexpected Cloudflare GET '+path);
    return {ok:true,status:200,json:async()=>({success:true,result,result_info:{total_pages:1}})};
  };
}

test('automatic inventory verifies nine UNUSED staging names without a Cloudflare write',async()=>{
  const result=await inventory({token:'synthetic-token',fetchFn:fakeCloudflare()});
  assert.equal(result.targetCount,9);
  assert.equal(result.resourceCheck,'READ_ONLY_COMPLETE');
  assert.equal(result.noChargeVerified,false);
  assert.equal(result.deployAuthorized,false);
});
test('rejects ambiguous account access instead of choosing for owner',async()=>{
  assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({accounts:[{id:ACCOUNT},{id:'a'.repeat(32)}]})}),/exactly one account/);
});
test('rejects unknown staging database',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({dbName:'production-db'})}),/Exactly one isolated/);
});
test('rejects existing staging Worker to avoid overwrite',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({workers:[{id:'mapleweb-agent-sales-staging'}]})}),/could overwrite/);
});
test('refuses invalid account IDs',()=>{
  assert.throws(()=>chooseAccount([{id:ACCOUNT}], 'not-an-id'),/invalid/);
});
