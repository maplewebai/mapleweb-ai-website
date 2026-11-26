import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {connections,requestConnection,connectionAction} from '../src/agent-connections.mjs';
import worker from '../src/worker.mjs';
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());const dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 return {MODE:'staging',MANAGER_OWNER_TOKEN:'test-owner-'.repeat(5),DB:{prepare(s){let a=[];return{bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}}};
}
const payload={synthetic:true,label:'GitHub',url:'https://github.com',purpose:'Read development status',accessType:'existing-account'};
test('connections require explicit approval, verify only configured read adapter, isolate agent records',async t=>{
 const env=setup(t);let calls=0;
 assert.equal((await worker.fetch(new Request('https://local.test/api/agent-connections/manager'),env)).status,401);
 const a=await requestConnection(env,'manager',payload);
 assert.equal(a.state,'REQUESTED');assert.equal(a.externalAction,false);
 const diagnose=async()=>{calls++;return {configured:true,authenticatedReadVerified:true,branchFound:true}};
 await assert.rejects(connectionAction(env,'manager',a.id,{action:'verify'},{diagnose}),/Approve/);
 await connectionAction(env,'manager',a.id,{action:'approve'});
 assert.equal(calls,0);
 assert.equal((await connectionAction(env,'manager',a.id,{action:'verify'},{diagnose})).state,'VERIFIED_READ');
 assert.equal(calls,1);
 assert.equal((await connections(env,'research')).connections.length,0);
 await assert.rejects(connectionAction(env,'research',a.id,{action:'revoke'}),/not found/);
 await connectionAction(env,'manager',a.id,{action:'revoke'});
 await assert.rejects(connectionAction(env,'manager',a.id,{action:'verify'},{diagnose}),/Approve/);
});
test('new accounts and unsupported apps remain unconnected; reject unsafe URLs and secrets',async t=>{
 const env=setup(t);
 for(const url of ['http://github.com','https://user:pass@github.com','https://127.0.0.1','https://github.com?token=bad','javascript:alert(1)'])await assert.rejects(requestConnection(env,'manager',{...payload,url}));
 await assert.rejects(requestConnection(env,'manager',{...payload,purpose:'save access token'}));
 for(const p of [{...payload,accessType:'new-account'},{...payload,label:'Other',url:'https://example.com'},{...payload,url:'https://github.com/other/repo'}]){
   const a=await requestConnection(env,'manager',p);
   await connectionAction(env,'manager',a.id,{action:'approve'});
   const r=await connectionAction(env,'manager',a.id,{action:'verify'},{diagnose:async()=>{throw Error('Must not call')}});
   assert.equal(r.state,'APPROVED');assert.equal(r.accountCreated,false);
 }
});

test('approved public reference verifies only permitted host with no credentials',async t=>{const env=setup(t);const a=await requestConnection(env,'manager',{...payload,url:'https://docs.github.com/en',accessType:'read'});await connectionAction(env,'manager',a.id,{action:'approve'});let calls=0;const result=await connectionAction(env,'manager',a.id,{action:'verify'},{fetcher:async(url,opts)=>{calls++;assert.equal(url,'https://docs.github.com/en');assert.equal(opts.redirect,'error');assert.equal(opts.headers.authorization,undefined);return new Response('Public reference',{headers:{'content-type':'text/html'}})}});assert.equal(calls,1);assert.equal(result.state,'VERIFIED_READ');});
