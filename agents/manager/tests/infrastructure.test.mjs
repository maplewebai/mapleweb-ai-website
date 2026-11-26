import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {infrastructure,addDomain,planEmail} from '../src/infrastructure.mjs';
import worker from '../src/worker.mjs';
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());sql.exec('PRAGMA foreign_keys=ON');
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 return {MODE:'staging',MANAGER_OWNER_TOKEN:'qa-infrastructure-token-'.repeat(3),DB:{prepare(s){let a=[];return {bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}}};
}
test('owner-only domain and unique agent address plans remain unverified and inactive',async t=>{
 const env=setup(t);
 assert.equal((await worker.fetch(new Request('https://local.test/api/infrastructure'),env)).status,401);
 for(const domain of ['https://example.com','bad domain','a.local'])await assert.rejects(addDomain(env,{synthetic:true,domain}));
 assert.equal((await addDomain(env,{synthetic:true,domain:'Example.COM'})).state,'UNVERIFIED');
 await assert.rejects(addDomain(env,{synthetic:true,domain:'example.com'}),/already saved/);
 const p={synthetic:true,domain:'example.com',agent:'manager',localPart:''};
 assert.equal((await planEmail(env,p)).address,'manager@example.com');
 await assert.rejects(planEmail(env,p),/already reserved/);
 await assert.rejects(planEmail(env,{...p,agent:'sales',localPart:'manager'}),/already reserved/);
 await assert.rejects(planEmail(env,{...p,agent:'unknown'}),/Unknown agent/);
 assert.equal((await planEmail(env,{...p,agent:'sales'})).state,'PLANNED');
 const data=await infrastructure(env);
 assert.equal(data.domains.length,1);assert.equal(data.emails.length,2);assert.equal(data.provider.emailRoutingEnabled,false);assert.equal(data.provider.inboxEnabled,false);assert.equal(data.paidServicesEnabled,false);
});
