// First-party internal mail. No SMTP, DNS, third-party signup, or external delivery.
import {ROLES} from './roles.mjs';
import {requireDb} from './store.mjs';
import {bad,validateSynthetic} from './security.mjs';
const domain='agents-hq.invalid';
const address=id=>id+'@'+domain;
export async function mailDirectory(env){
 const rows=(await requireDb(env).prepare('SELECT id,name FROM manager_custom_agents ORDER BY created_at DESC LIMIT 50').all()).results||[];
 return [{id:'manager',name:'Manager'},...ROLES.map(id=>({id,name:id})),...rows].map(a=>({...a,address:address(a.id)}));
}
async function member(env,id){
 const a=(await mailDirectory(env)).find(a=>a.id===id);
 if(!a)throw bad('Unknown internal mailbox',404);
 return a;
}
export async function internalMail(env,id){
 const a=await member(env,id),db=requireDb(env);
 const inbox=(await db.prepare('SELECT * FROM internal_mail WHERE recipient=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(id).all()).results||[];
 const sent=(await db.prepare('SELECT * FROM internal_mail WHERE sender=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(id).all()).results||[];
 return {mailbox:a,inbox,sent,externalDelivery:false};
}
export async function sendInternalMail(env,p){
 validateSynthetic(p);
 if(Object.keys(p).sort().join(',')!=='body,recipient,sender,subject,synthetic'||['sender','recipient','subject','body'].some(k=>typeof p[k]!=='string'))throw bad('Invalid internal message');
 const from=await member(env,p.sender),to=await member(env,p.recipient),subject=p.subject.trim(),body=p.body.trim();
 if(!subject||subject.length>120||!body||body.length>2000)throw bad('Enter a subject (1–120 characters) and message (1–2000 characters)');
 if(/\b(?:password|verification code|access token|api key|credit card)\b/i.test(subject+' '+body))throw bad('Do not put credentials or verification codes in internal mail');
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const w=await requireDb(env).prepare('INSERT INTO internal_mail(id,sender,recipient,subject,body,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM internal_mail)<10000').bind(id,from.id,to.id,subject,body,created).run();
 if(w.meta?.changes!==1)throw bad('Internal mailbox storage limit reached',409);
 return {id,sender:from.address,recipient:to.address,delivery:'INTERNAL_DELIVERED',externalDelivery:false,ownerAuthorized:true};
}
export async function markInternalRead(env,id,messageId){
 await member(env,id);
 const w=await requireDb(env).prepare('UPDATE internal_mail SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient=?').bind(new Date().toISOString(),messageId,id).run();
 if(w.meta?.changes!==1)throw bad('Message not found in this inbox',404);
 return {read:true};
}
export async function mailInstruction(env,scope,message){
 const id=scope==='manager'?'manager':scope.replace(/^(role|custom):/,'');
 if(/^(?:my (?:internal )?email(?: address)?|what is my email(?: address)?|create my internal email(?: address)?)[?.!]*$/i.test(message)){
  const a=await member(env,id);
  return {reply:'My internal mailbox is '+a.address+'. It works only inside AI Agents Headquarters; it cannot receive Internet email or external verification codes.'};
 }
 if(/^(?:check (?:my )?inbox|show (?:my )?inbox|read (?:my )?internal mail)[?.!]*$/i.test(message)){
  const mail=await internalMail(env,id);
  return {reply:mail.inbox.length?'Internal inbox (latest '+Math.min(5,mail.inbox.length)+'):\n'+mail.inbox.slice(0,5).map(m=>address(m.sender)+' — '+m.subject+'\n'+m.body.slice(0,300)).join('\n\n'):'My internal inbox is empty. No external email access.'};
 }
 return null;
}
