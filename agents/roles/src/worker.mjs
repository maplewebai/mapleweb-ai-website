// One isolated staging service per role. No real customers, payments, or publishing.
import {ROLES,runRole} from '../../manager/src/roles.mjs';
import {requireOwner,readJson,validateSynthetic,bad} from '../../manager/src/security.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json;charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none';frame-ancestors 'none'"}});
export async function handleRoleRequest(request,env={}){
  const path=new URL(request.url).pathname;
  const role=String(env.ROLE_NAME||'');
  if(!ROLES.includes(role))return json({error:'Staging agent role not configured'},503);
  if(path==='/health'&&request.method==='GET')return json({
    service:'mapleweb-agent-role',agent:role,mode:'staging',healthy:true,
    deterministic:true,internalAuthReady:typeof env.ROLE_INTERNAL_TOKEN==='string'&&env.ROLE_INTERNAL_TOKEN.length>=32,
    paymentsEnabled:false,publishingEnabled:false,realCustomersEnabled:false,
    note:'Role worker is online; deterministic staging tasks are not generative AI'});
  if(path==='/execute'&&request.method==='POST'){
    await requireOwner(request,{MANAGER_OWNER_TOKEN:env.ROLE_INTERNAL_TOKEN});
    const p=validateSynthetic(await readJson(request,12000));
    if(typeof p.action!=='string'||p.action.length>64)throw bad('Invalid staging action');
    const result=runRole(role,p.action,p.input||{},p.context||{});
    return json({agent:role,mode:'staging',executed:true,result});
  }
  return json({error:'Not found'},404);
}
export default {async fetch(request,env){
  try{return await handleRoleRequest(request,env||{});}
  catch(e){const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:500;
    return json({error:status===500?'Internal error':String(e.message).slice(0,180)},status);}
}};
