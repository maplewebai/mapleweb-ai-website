// Read-only visibility. Worker existence is not equivalent to a working agent.
import {ROLES} from './roles.mjs';
import {bad} from './security.mjs';
export async function inspectCloudflare(env){
  if(!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_READ_TOKEN ||
     !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)||
     env.CLOUDFLARE_ACCOUNT_ID!==env.EXPECTED_CLOUDFLARE_ACCOUNT_ID)
    return {configured:false,accountVerified:false,workers:[],liveRolesVerified:0,
      reason:'Missing read-only Cloudflare token or exact account ID verification'};
  const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`,{
    headers:{authorization:`Bearer ${env.CLOUDFLARE_READ_TOKEN}`}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body.success!==true)throw bad(`Cloudflare inspector failed (${r.status})`,502);
  const scripts=Array.isArray(body.result)?body.result.map(x=>x.id).filter(x=>typeof x==='string'):[];
  return {configured:true,accountVerified:true,workers:scripts,liveRolesVerified:0,
    note:'Worker listing does not prove agents respond correctly; check separate health endpoints'};
}
export async function checkRoleHealth(env){
  let urls={};try{urls=JSON.parse(env.AGENT_HEALTH_URLS||'{}');}catch{throw bad('Invalid configured health URL map',503);}
  if(typeof urls!=='object'||!urls||Array.isArray(urls))throw bad('Invalid health map',503);
  const results=[];
  for(const agent of ROLES){
    const url=urls[agent];
    if(!url){results.push({agent,verified:false,reason:'No endpoint configured'});continue;}
    let u;try{u=new URL(url);}catch{results.push({agent,verified:false,reason:'Invalid endpoint'});continue;}
    if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.pathname!=='/health'||u.username||u.password){
      results.push({agent,verified:false,reason:'Health URL must be a configured HTTPS Workers health endpoint'});continue;
    }
    try{
      const service=env['ROLE_'+agent.toUpperCase().replace(/-/g,'_')];
      const options={method:'GET',headers:{accept:'application/json'},signal:AbortSignal.timeout(4000)};
      const reply=service&&typeof service.fetch==='function'
        ? await service.fetch(new Request(u.href,options))
        : await fetch(u.href,options);
      const j=reply.ok?await reply.json().catch(()=>({})):{};
      results.push({agent,verified:reply.ok&&j.agent===agent&&j.healthy===true&&j.mode==='staging',
        httpStatus:reply.status});
    }catch{results.push({agent,verified:false,reason:'Health request failed'});}
  }
  return {liveRolesVerified:results.filter(x=>x.verified).length,totalRoles:ROLES.length,results};
}
