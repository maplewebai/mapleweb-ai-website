// Generate only isolated staging configs. No Cloudflare API calls or deploys.
import fs from 'node:fs';
import path from 'node:path';
import {ROLES} from './manager/src/roles.mjs';
const required=(name)=>{const s=String(process.env[name]||'').trim();
  if(!s)throw Error('Missing required deployment setting: '+name);return s;};
const subdomain=required('MAPLEWEB_STAGING_WORKERS_SUBDOMAIN');
const databaseId=required('MAPLEWEB_STAGING_D1_DATABASE_ID');
if(!/^[a-z0-9-]{2,40}\.workers\.dev$/i.test(subdomain))
  throw Error('Staging Workers subdomain must be an exact verified subdomain');
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId))
  throw Error('Invalid staging D1 database ID');
const ids=[];
const health={};const execute={};
for(const role of ROLES){
  const name='mapleweb-agent-'+role+'-staging';
  ids.push(name);
  health[role]='https://'+name+'.'+subdomain+'/health';
  execute[role]='https://'+name+'.'+subdomain+'/execute';
  const config={name,main:'./src/worker.mjs',compatibility_date:'2026-11-01',
    workers_dev:true,vars:{MODE:'staging',ROLE_NAME:role}};
  fs.writeFileSync(path.join('agents','roles',`.generated-${role}.json`),JSON.stringify(config,null,2)+'\n');
}
const managerName='mapleweb-manager-rebuilt-staging';
ids.push(managerName);
const manager={
 name:managerName,main:'./src/worker.mjs',compatibility_date:'2026-11-01',
 workers_dev:true,vars:{
  MODE:'staging',
  AGENT_HEALTH_URLS:JSON.stringify(health),
  AGENT_EXECUTION_URLS:JSON.stringify(execute)
 },
 d1_databases:[{binding:'DB',database_name:'mapleweb-manager-staging-db',
  database_id:databaseId,migrations_dir:'./migrations'}]
};
fs.writeFileSync('agents/manager/.generated-staging.json',JSON.stringify(manager,null,2)+'\n');
fs.writeFileSync('/tmp/mapleweb-staging-worker-names.txt',ids.join('\n')+'\n');
console.log('Generated nine isolated staging Worker configs; no cloud deployment performed.');
