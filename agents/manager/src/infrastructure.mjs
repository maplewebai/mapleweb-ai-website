// Owner-only infrastructure planning. Records are not live provider resources.
import {ROLES} from './roles.mjs';
import {requireDb} from './store.mjs';
import {bad} from './security.mjs';
const now=()=>new Date().toISOString();
function domainName(v){
 if(typeof v!=='string')throw bad('Enter a domain name');
 const d=v.trim().toLowerCase().replace(/\.$/,'');
 if(d.length>253||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)||/\.(?:local|internal|test|invalid|example|localhost)$/.test(d))throw bad('Enter a public domain name without https or a path');
 return d;
}
export async function infrastructure(env){
 const db=requireDb(env);
 const domains=(await db.prepare('SELECT domain,created_at FROM infrastructure_domains ORDER BY created_at DESC LIMIT 50').all()).results||[];
 const emails=(await db.prepare('SELECT id,agent_scope,domain,local_part,created_at FROM infrastructure_email_plans ORDER BY created_at DESC LIMIT 500').all()).results||[];
 return {domains:domains.map(d=>({...d,state:'UNVERIFIED'})),emails:emails.map(e=>({...e,address:e.local_part+'@'+e.domain,state:'PLANNED'})),provider:{domainOwnershipVerified:false,dnsWriteEnabled:false,emailRoutingEnabled:false,inboxEnabled:false,sendEnabled:false},paidServicesEnabled:false};
}
export async function addDomain(env,p){
 if(!p||Object.keys(p).length!==2||p.synthetic!==true)throw bad('Invalid domain plan');
 const domain=domainName(p.domain),db=requireDb(env);
 const w=await db.prepare('INSERT OR IGNORE INTO infrastructure_domains(domain,created_at) SELECT ?,? WHERE (SELECT COUNT(*) FROM infrastructure_domains)<50').bind(domain,now()).run();
 if(w.meta?.changes!==1)throw bad('Domain already saved or limit reached',409);
 return {domain,state:'UNVERIFIED',externalChange:false};
}
export async function planEmail(env,p){
 if(!p||Object.keys(p).length!==4||p.synthetic!==true||typeof p.agent!=='string'||typeof p.localPart!=='string')throw bad('Invalid address plan');
 const domain=domainName(p.domain),db=requireDb(env),agent=p.agent;
 let name=agent;
 if(agent!=='manager'&&!ROLES.includes(agent)){
   if(!/^[a-f0-9-]{36}$/.test(agent))throw bad('Unknown agent',404);
   const a=await db.prepare('SELECT name FROM manager_custom_agents WHERE id=?').bind(agent).first();if(!a)throw bad('Unknown agent',404);name=a.name;
 }
 const known=await db.prepare('SELECT domain FROM infrastructure_domains WHERE domain=?').bind(domain).first();if(!known)throw bad('Save the domain first');
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42);
 const local=p.localPart.trim().toLowerCase()||(ROLES.includes(agent)||agent==='manager'?agent:(slug||'agent')+'-'+agent.slice(0,8));
 if(!/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(local)||local.includes('..'))throw bad('Use 1–64 letters, digits, dots, hyphens or underscores');
 const id=crypto.randomUUID();
 const w=await db.prepare('INSERT OR IGNORE INTO infrastructure_email_plans(id,agent_scope,domain,local_part,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM infrastructure_email_plans)<500').bind(id,agent,domain,local,now()).run();
 if(w.meta?.changes!==1)throw bad('Address or agent already reserved for this domain, or limit reached',409);
 return {id,address:local+'@'+domain,state:'PLANNED',externalChange:false};
}
