// MapleWeb AI: fail-closed bridge to separate Cloudflare role Workers.
import {ROLES,runRole} from './roles.mjs';
import {bad} from './security.mjs';
export function remoteRoleState(env={}){
  if(!env.AGENT_EXECUTION_URLS)return {configured:false,remoteRoles:0,enabled:false};
  let urls;
  try{urls=JSON.parse(env.AGENT_EXECUTION_URLS);}catch{throw bad('Invalid role execution URL map',503);}
  if(!urls||typeof urls!=='object'||Array.isArray(urls))throw bad('Invalid role execution URL map',503);
  return {configured:true,remoteRoles:ROLES.filter(role=>typeof urls[role]==='string').length,
    enabled:true};
}
export async function runStagingRole(env,role,action,input={},context={},fetchImpl=fetch){
  if(!ROLES.includes(role))throw bad('Unknown role');
  if(!env.AGENT_EXECUTION_URLS)return runRole(role,action,input,context);
  let urls;try{urls=JSON.parse(env.AGENT_EXECUTION_URLS);}
  catch{throw bad('Invalid role execution map',503);}
  const location=urls?.[role];
  if(typeof location!=='string')throw bad('Remote role endpoint is not configured',503);
  let u;try{u=new URL(location);}catch{throw bad('Invalid remote role endpoint',503);}
  if(u.protocol!=='https:' || !u.hostname.endsWith('.workers.dev') ||
    u.pathname!=='/execute'||u.search||u.hash||u.username||u.password)
    throw bad('Only isolated Cloudflare role worker endpoints are allowed',503);
  const token=env.ROLE_INTERNAL_TOKEN;
  if(typeof token!=='string'||token.length<32)throw bad('Remote role authentication is not configured',503);
  let res;
  try{
    res=await fetchImpl(u.href,{method:'POST',headers:{
      'authorization':'Bearer '+token,'content-type':'application/json','accept':'application/json'
    },body:JSON.stringify({synthetic:true,action,input,context}),signal:AbortSignal.timeout(7000)});
  }catch{throw bad('Remote role Worker not reachable',502);}
  if(!res.ok)throw bad('Remote role Worker rejected the staging job',502);
  let obj;try{obj=await res.json();}catch{throw bad('Remote role Worker returned invalid JSON',502);}
  if(!obj||obj.agent!==role||obj.executed!==true||!obj.result||
    obj.result.agent!==role)throw bad('Remote role Worker identity mismatch',502);
  return obj.result;
}
