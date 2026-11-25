import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createThread,addThreadFile,listThreadFiles,readThreadFile,deleteThreadFile,validateTextFile} from '../src/manager-threads.mjs';
import {managerChat,chatHistory} from '../src/manager-chat.mjs';
import worker from '../src/worker.mjs';
const token='owner-test-token-'.repeat(4);
function setup(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 for(const name of ['0001_init.sql','0004_manager_chat.sql','0006_manager_threads.sql'])sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 return {MANAGER_THREADS_ENABLED:'true',MANAGER_OWNER_TOKEN:token,DB:{prepare(s){let a=[];return{bind(...values){a=values;return this},first(){return sql.prepare(s).get(...a)||null},all(){return{results:sql.prepare(s).all(...a)}},run(){return{meta:{changes:Number(sql.prepare(s).run(...a).changes)}}}}}}};
}
test('separate conversations and legacy history do not mix',async t=>{
 const env=setup(t);
 const a=await createThread(env,{synthetic:true,title:'Bakery'});
 const b=await createThread(env,{synthetic:true,title:'Restaurant'});
 await managerChat(env,{synthetic:true,message:'status',threadId:a.id});
 await managerChat(env,{synthetic:true,message:'recent jobs',threadId:b.id});
 await managerChat(env,{synthetic:true,message:'status'});
 assert.equal((await chatHistory(env,a.id)).turns[0].message,'status');
 assert.equal((await chatHistory(env,b.id)).turns[0].message,'recent jobs');
 assert.equal((await chatHistory(env)).turns.length,1);
 assert.equal((await chatHistory(env,a.id)).turns.length,1);
});
test('files are bounded, scoped and deleted privately',async t=>{
 const env=setup(t);
 const a=await createThread(env,{synthetic:true,title:'A'});
 const b=await createThread(env,{synthetic:true,title:'B'});
 const file=await addThreadFile(env,a.id,{synthetic:true,filename:'brief.txt',content:'Fictional bakery brief'});
 assert.equal(file.externalTransfer,false);
 assert.equal((await listThreadFiles(env,a.id)).files.length,1);
 assert.equal((await listThreadFiles(env,b.id)).files.length,0);
 assert.equal((await readThreadFile(env,a.id,file.id)).content,'Fictional bakery brief');
 await assert.rejects(readThreadFile(env,b.id,file.id),/not found/i);
 await deleteThreadFile(env,a.id,file.id);
 assert.equal((await listThreadFiles(env,a.id)).files.length,0);
});
test('attachment input restrictions',()=>{
 for(const [filename,content] of [['a.html','text'],['../brief.txt','text'],['brief.txt','x'.repeat(6001)],['brief.txt','test@example.com'],['brief.txt','\u0000'],['brief.txt','']]){
  assert.throws(()=>validateTextFile({synthetic:true,filename,content}));
 }
 assert.equal(validateTextFile({synthetic:true,filename:'brief.md',content:'Fictional project'}).content,'Fictional project');
});
test('owner authentication gates all thread and attachment routes',async t=>{
 const env=setup(t);
 for(const path of ['/api/manager/threads','/api/manager/threads/00000000-0000-4000-8000-000000000001/files','/api/manager/chat?threadId=00000000-0000-4000-8000-000000000001']){
  const r=await worker.fetch(new Request('https://staging.test'+path),env);assert.equal(r.status,401);
 }
});
