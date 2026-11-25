// Private staging threads and plain-text attachments. No external storage or AI transfer.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now=()=>new Date().toISOString();
function enabled(env){if(env.MANAGER_THREADS_ENABLED!=='true')throw bad('Private conversation threads are not enabled',503);return requireDb(env);}
export async function requireThread(env,id){
 const db=enabled(env);
 if(typeof id!=='string'||!uuid.test(id))throw bad('Invalid conversation ID');
 const row=await db.prepare('SELECT id,title,created_at FROM manager_threads WHERE id=?').bind(id).first();
 if(!row)throw bad('Conversation not found',404);
 return row;
}
export async function listThreads(env){
 const db=enabled(env);
 const result=await db.prepare('SELECT id,title,created_at FROM manager_threads ORDER BY created_at DESC LIMIT 100').all();
 return {threads:result.results||[]};
}
export async function createThread(env,payload){
 const db=enabled(env);
 if(!payload||Object.keys(payload).length!==2||payload.synthetic!==true||typeof payload.title!=='string')throw bad('Fictional title required');
 const title=payload.title.trim();
 if(!title||title.length>80)throw bad('Title must have 1–80 characters');
 validateSynthetic({synthetic:true,title});
 const id=crypto.randomUUID(),created_at=now();
 const result=await db.prepare('INSERT INTO manager_threads(id,title,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM manager_threads)<100').bind(id,title,created_at).run();
 if(result.meta?.changes!==1)throw bad('Conversation limit reached',409);
 return {id,title,created_at};
}
export function validateTextFile(payload){
 if(!payload||Object.keys(payload).length!==3||payload.synthetic!==true||
 typeof payload.filename!=='string'||typeof payload.content!=='string')throw bad('Plain-text fictional attachment required');
 const filename=payload.filename.trim(),content=payload.content;
 if(!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,70}\.(txt|md|csv)$/i.test(filename))throw bad('Use a safe .txt, .md or .csv file name');
 if(!content.trim()||new TextEncoder().encode(content).length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content))throw bad('Use readable text up to 6000 bytes');
 validateSynthetic({synthetic:true,filename,content});
 return {filename,content};
}
export async function addThreadFile(env,id,payload){
 await requireThread(env,id);
 const db=enabled(env),{filename,content}=validateTextFile(payload),fileId=crypto.randomUUID(),created_at=now();
 const r=await db.prepare('INSERT INTO manager_thread_files(id,thread_id,filename,content,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM manager_thread_files WHERE thread_id=?)<10').bind(fileId,id,filename,content,created_at,id).run();
 if(r.meta?.changes!==1)throw bad('Conversation attachment limit reached',409);
 return {id:fileId,filename,created_at,externalTransfer:false};
}
export async function listThreadFiles(env,id){
 await requireThread(env,id);
 const r=await enabled(env).prepare('SELECT id,filename,created_at FROM manager_thread_files WHERE thread_id=? ORDER BY created_at DESC LIMIT 10').bind(id).all();
 return {files:r.results||[],externalTransfer:false};
}
export async function readThreadFile(env,id,fileId){
 await requireThread(env,id);
 if(typeof fileId!=='string'||!uuid.test(fileId))throw bad('Invalid attachment ID');
 const row=await enabled(env).prepare('SELECT id,filename,content,created_at FROM manager_thread_files WHERE thread_id=? AND id=?').bind(id,fileId).first();
 if(!row)throw bad('Attachment not found',404);
 return row;
}
export async function deleteThreadFile(env,id,fileId){
 await requireThread(env,id);
 if(typeof fileId!=='string'||!uuid.test(fileId))throw bad('Invalid attachment ID');
 const r=await enabled(env).prepare('DELETE FROM manager_thread_files WHERE thread_id=? AND id=?').bind(id,fileId).run();
 if(r.meta?.changes!==1)throw bad('Attachment not found',404);
 return {deleted:true};
}
