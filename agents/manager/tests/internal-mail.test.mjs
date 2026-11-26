import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {mailDirectory,internalMail,sendInternalMail,markInternalRead,mailInstruction} from '../src/internal-mail.mjs';
import worker from '../src/worker.mjs';
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());const dir=new URL('../migrations/',import.meta.url);
 for(const file of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 return {sql,env:{MODE:'staging',MANAGER_OWNER_TOKEN:'mail-owner-'.repeat(6),DB:{prepare(s){let a=[];return {bind(...v){a=v;return this},first(){return sql.prepare(s).get(...a)||null},all(){return {results:sql.prepare(s).all(...a)}},run(){return {meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}}}};
}
test('all existing and future agents have unique internal mailboxes and owner-only access',async t=>{
 const {env,sql}=setup(t);
 assert.equal((await worker.fetch(new Request('https://local.test/api/internal-mail/directory'),env)).status,401);
 assert.equal((await mailDirectory(env)).length,9);
 const id=crypto.randomUUID();
 sql.prepare('INSERT INTO manager_custom_agents(id,name,description,instructions,base_role,created_at) VALUES(?,?,?,?,?,?)').run(id,'Fictional Agent','Example duties','','chat-only',new Date().toISOString());
 const directory=await mailDirectory(env);assert.equal(directory.length,10);assert.equal(new Set(directory.map(a=>a.address)).size,10);
 const sent=await sendInternalMail(env,{synthetic:true,sender:'manager',recipient:id,subject:'Fictional work update',body:'Please review the draft.'});
 assert.equal(sent.delivery,'INTERNAL_DELIVERED');assert.equal(sent.externalDelivery,false);
 assert.equal((await internalMail(env,id)).inbox[0].id,sent.id);
 assert.equal((await internalMail(env,'manager')).sent[0].id,sent.id);
 assert.equal((await internalMail(env,'research')).inbox.length,0);
 await assert.rejects(markInternalRead(env,'research',sent.id),/not found/);
 await markInternalRead(env,id,sent.id);assert.ok((await internalMail(env,id)).inbox[0].read_at);
 assert.match((await mailInstruction(env,'custom:'+id,'check my inbox')).reply,/Please review the draft/);
 await assert.rejects(sendInternalMail(env,{synthetic:true,sender:'manager',recipient:'unknown',subject:'Example',body:'Example'}),/Unknown/);
});
