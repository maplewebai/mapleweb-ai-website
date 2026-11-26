// No credential collection, arbitrary fetches, signup or payment automation.
import {ROLES} from './roles.mjs';
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
import {diagnoseGitHub} from './github.mjs';
const now=()=>new Date().toISOString();
async function scope(env,id){
 if(id==='manager'||ROLES.includes(id))return id;
 if(!/^[a-f0-9-]{36}$/.test(id)||!await requireDb(env).prepare('SELECT id FROM manager_custom_agents WHERE id=?').bind(id).first())throw bad('Unknown agent',404);
 return id;
}
function website(value){
 let u;try{u=new URL(value)}catch{throw bad('Enter a public HTTPS website address')}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(u.hostname)||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.pathname.length>300)throw bad('Use a public HTTPS address without credentials, query or fragment');
 return u.href;
}
export async function connections(env,id){
 const key=await scope(env,id);const r=await requireDb(env).prepare('SELECT * FROM agent_connections WHERE agent_scope=? ORDER BY created_at DESC LIMIT 50').bind(key).all();return {connections:r.results||[]};
}
export async function requestConnection(env,id,p){
 const key=await scope(env,id);validateSynthetic(p);
 if(Object.keys(p).some(k=>!['synthetic','label','url','purpose','accessType'].includes(k))||['label','url','purpose','accessType'].some(k=>typeof p[k]!=='string'))throw bad('Invalid connection request');
 const label=p.label.trim(),purpose=p.purpose.trim(),url=website(p.url.trim()),access=p.accessType;
 if(!label||label.length>60||!purpose||purpose.length>300||!['read','existing-account','new-account'].includes(access))throw bad('Enter a service, purpose and access type');
 if(/\b(?:password|api key|access token|secret|verification code|credit card)\b/i.test(purpose))throw bad('Do not include credentials in connection requests');
 const db=requireDb(env),cid=crypto.randomUUID(),time=now();
 const w=await db.prepare("INSERT INTO agent_connections(id,agent_scope,label,url,purpose,access_type,state,created_at,updated_at) SELECT ?,?,?,?,?,?,'REQUESTED',?,? WHERE (SELECT COUNT(*) FROM agent_connections WHERE agent_scope=? AND state!='REVOKED')<50").bind(cid,key,label,url,purpose,access,time,time,key).run();
 if(w.meta?.changes!==1)throw bad('Connection request limit reached',409);
 return {id:cid,state:'REQUESTED',externalAction:false};
}
export async function connectionAction(env,id,cid,p,{diagnose=diagnoseGitHub}={}){
 const key=await scope(env,id),db=requireDb(env);
 if(!p||Object.keys(p).length!==1||!['approve','revoke','verify'].includes(p.action))throw bad('Invalid connection action');
 const row=await db.prepare('SELECT * FROM agent_connections WHERE id=? AND agent_scope=?').bind(cid,key).first();if(!row)throw bad('Connection not found',404);
 let state=row.state,result=null;
 if(p.action==='revoke'){state='REVOKED';result='Local permission revoked. Revoke provider credentials separately if configured.';}
 else if(p.action==='approve'){if(state!=='REQUESTED')throw bad('Request is not awaiting approval',409);state='APPROVED';result='Owner approved the access request. No external sign-in, account or permission granted.';}
 else{
   if(!['APPROVED','VERIFIED_READ'].includes(state))throw bad('Approve the request first',409);
   // Only the fixed existing GitHub adapter can make authenticated requests.
   if(new URL(row.url).hostname==='github.com'&&row.access_type!=='new-account'){
     try{const g=await diagnose(env);if(g.configured&&g.authenticatedReadVerified&&g.branchFound){state='VERIFIED_READ';result='Manager GitHub adapter verified read access to its fixed development repository. No independent account or write access granted.';}else{state='APPROVED';result='GitHub Manager credential is not connected or read access was not verified.';}}catch{state='APPROVED';result='GitHub read verification failed. No connection claimed.';}
   }else{state='APPROVED';result='This service has no live adapter in MapleWeb. Owner may open the site to sign in or register. No external account created.';}
 }
 const w=await db.prepare('UPDATE agent_connections SET state=?,result=?,updated_at=? WHERE id=? AND agent_scope=? AND state=? AND updated_at=?').bind(state,result,now(),cid,key,row.state,row.updated_at).run();
 if(w.meta?.changes!==1)throw bad('Connection changed; reload before retrying',409);
 return {id:cid,state,result,accountCreated:false};
}
