import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {addKnowledge,searchKnowledge,knowledgeList,readKnowledge,deleteKnowledge,calculate,intelligenceInstruction} from '../src/hq-intelligence.mjs';
import {requestConnection,connectionAction,readApprovedReference} from '../src/agent-connections.mjs';
import worker from '../src/worker.mjs';
function setup(t){const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());const dir=new URL('../migrations/',import.meta.url);for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));return {MODE:'staging',MANAGER_OWNER_TOKEN:'owner-'.repeat(8),DB:{prepare(s){let a=[];return {bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}}};}
test('shared knowledge requires owner authentication, records provenance, retrieves relevant entries, supports removal',async t=>{
 const env=setup(t);
 assert.equal((await worker.fetch(new Request('https://local.test/api/hq/knowledge'),env)).status,401);
 const a=await addKnowledge(env,{synthetic:true,title:'Fictional bakery design',source:'Owner example',body:'Bakery homepage should show opening hours.'});
 await addKnowledge(env,{synthetic:true,title:'Garden studio',source:'Owner example',body:'Display fictional flower inventory.'});
 assert.equal((await knowledgeList(env)).items.length,2);
 assert.equal((await searchKnowledge(env,'What should the bakery homepage contain?'))[0].id,a.id);
 assert.equal((await searchKnowledge(env,'unrelated astronomy')).length,0);
 assert.match((await intelligenceInstruction(env,'Search knowledge: bakery')).reply,/Owner example/);
 assert.match((await readKnowledge(env,a.id)).body,/opening hours/);
 await assert.rejects(addKnowledge(env,{synthetic:true,title:'Credentials',source:'Owner',body:'password example'}),/credentials/);
 await deleteKnowledge(env,a.id);assert.equal((await searchKnowledge(env,'bakery')).length,0);
});
test('bounded calculator has precedence and rejects executable syntax',()=>{
 assert.equal(calculate('(1200 + 300)*0.13'),195);
 assert.equal(calculate('2+3*4'),14);assert.equal(calculate('-3*(2+1)'),-9);
 for(const x of ['1/0','1+','2**3','globalThis','(2+3','1;2','2(3)'])assert.throws(()=>calculate(x));
});
test('reference reader requires exact agent approval, fixed host, strips active HTML and never uses auth',async t=>{
 const env=setup(t),url='https://www.w3.org/';
 let calls=0;
 const fetcher=async(u,o)=>{calls++;assert.equal(u,url);assert.equal(o.redirect,'error');assert.equal(o.headers.authorization,undefined);return new Response('<html><head><title>Standards</title></head><body>Public standards<script>bad()</script></body></html>',{headers:{'content-type':'text/html'}})};
 await assert.rejects(readApprovedReference(env,'research',url,fetcher),/Approve/);
 const r=await requestConnection(env,'research',{synthetic:true,label:'W3C',url,purpose:'Read public standards',accessType:'read'});
 await connectionAction(env,'research',r.id,{action:'approve'});
 await assert.rejects(readApprovedReference(env,'manager',url,fetcher),/Approve/);
 const result=await readApprovedReference(env,'research',url,fetcher);
 assert.equal(result.text,'Public standards');assert.equal(result.method,'PUBLIC_HTTP');assert.equal(calls,1);
 await connectionAction(env,'research',r.id,{action:'revoke'});
 await assert.rejects(readApprovedReference(env,'research',url,fetcher),/Approve/);
 await assert.rejects(readApprovedReference(env,'research','https://example.com/',fetcher),/supported/);
 assert.equal(calls,1);
});
