import test from 'node:test';
import assert from 'node:assert/strict';
import {inventory} from '../cloudflare-inventory.mjs';

const ACCOUNT='b'.repeat(32);
const DB='12345678-1234-1234-1234-123456789abc';
function fakeCloudflare({dbName='mapleweb-manager-staging-db',workers=[{id:'existing-public-site'}],accounts=[{id:ACCOUNT}],accountTotal=accounts.length,accountStatus=200}={}) {
  return async function fakeFetch(url, options) {
    assert.equal(options.method,'GET','inventory must never modify Cloudflare');
    assert.equal(options.headers.authorization,'Bearer synthetic-token');
    assert.equal(options.redirect,'error');
    const {pathname:path,searchParams}=new URL(url);
    let result;
    const resultInfo={total_pages:1};
    if(path==='/client/v4/accounts') {
      assert.equal(searchParams.get('per_page'),'50');
      result=accounts;
      Object.assign(resultInfo,{total_count:accountTotal});
    }
    else if(path.endsWith('/accounts/'+ACCOUNT)) {
      if(accountStatus!==200) return {ok:false,status:accountStatus};
      result={id:ACCOUNT};
    }
    else if(path.endsWith('/workers/subdomain'))result={subdomain:'staging-example'};
    else if(path.endsWith('/d1/database'))result=[{name:dbName,uuid:DB}];
    else if(path.endsWith('/d1/database/'+DB))result={name:dbName,uuid:DB};
    else if(path.endsWith('/workers/scripts'))result=workers;
    else throw Error('Unexpected Cloudflare GET '+path);
    return {ok:true,status:200,json:async()=>({success:true,result,result_info:resultInfo})};
  };
}

test('automatic inventory verifies the unused Manager staging name using GET only',async()=>{
  const result=await inventory({token:'synthetic-token',fetchFn:fakeCloudflare()});
  assert.equal(result.accountId,ACCOUNT);
  assert.equal(result.targetCount,1);
  assert.equal(result.resourceCheck,'READ_ONLY_COMPLETE');
  assert.equal(result.noChargeVerified,false);
  assert.equal(result.deployAuthorized,false);
});
test('rejects ambiguous account access instead of choosing for owner',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({accounts:[{id:ACCOUNT},{id:'a'.repeat(32)}]})}),/exactly one account/);
});
test('rejects a partial account listing even when only one account was returned',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({accountTotal:51})}),/incomplete verification/);
});
test('verifies a configured account without listing accounts',async()=>{
  const request=fakeCloudflare();
  const result=await inventory({
    token:'synthetic-token',expectedAccountId:ACCOUNT,
    fetchFn:(url,options)=>{
      assert.notEqual(new URL(url).pathname,'/client/v4/accounts');
      return request(url,options);
    },
  });
  assert.equal(result.accountId,ACCOUNT);
});
test('rejects unknown staging database',async()=>{
  let verified=false;
  await assert.rejects(inventory({
    token:'synthetic-token',fetchFn:fakeCloudflare({dbName:'production-db'}),
    onAccountVerified:()=>{ verified=true; },
  }),/Exactly one isolated/);
  assert.equal(verified,true);
});
test('rejects existing staging Worker to avoid overwrite',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({workers:[{id:'mapleweb-manager-v2-staging'}]})}),/could overwrite/);
});
test('refuses invalid configured account IDs',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',expectedAccountId:'not-an-id',fetchFn:fakeCloudflare()}),/account ID is invalid/);
});
test('reports an account API error without including the account ID',async()=>{
  await assert.rejects(inventory({token:'synthetic-token',fetchFn:fakeCloudflare({accountStatus:403})}),{
    message:'Cloudflare returned HTTP 403 when reading the Cloudflare account',
  });
});
