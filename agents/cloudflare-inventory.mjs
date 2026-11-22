// Read-only Cloudflare account discovery for MapleWeb AI staging.
// Makes GET requests only; it never creates, edits, deletes or deploys resources.
import {appendFileSync} from 'node:fs';

const ROOT = 'https://api.cloudflare.com/client/v4';
const ROLES = ['website-developer','customer-care','sales','research','quality-checker','support','finance','publishing'];
const EXPECTED_DB = 'mapleweb-manager-staging-db';
const TARGET_NAMES = [...ROLES.map(r=>'mapleweb-agent-'+r+'-staging'),'mapleweb-manager-rebuilt-staging'];

function ensure(condition, message) { if (!condition) throw Error(message); }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

async function api(token, suffix, fetchFn=fetch) {
  ensure(typeof token==='string' && token.length>0,'Missing secure Cloudflare API token');
  const response=await fetchFn(ROOT+suffix, {
    method:'GET',headers:{authorization:'Bearer '+token,accept:'application/json'},
    signal:AbortSignal.timeout(20000),
  });
  ensure(response.ok, 'Cloudflare returned HTTP '+response.status+' when reading '+suffix.split('?')[0]);
  let body;
  try { body=await response.json(); } catch { throw Error('Cloudflare returned invalid JSON'); }
  ensure(isObject(body) && body.success===true, 'Cloudflare API rejected read for '+suffix.split('?')[0]);
  return body;
}

function singlePage(response, label) {
  const count=response.result_info?.total_pages;
  ensure(count===undefined || count===null || count<=1, label+' spans multiple pages; refusing incomplete verification');
  ensure(Array.isArray(response.result),label+' returned an unexpected response');
  return response.result;
}

export function chooseAccount(accounts, explicitId='') {
  ensure(Array.isArray(accounts),'Account list is invalid');
  const valid=accounts.filter(a=>isObject(a) && /^[a-f0-9]{32}$/i.test(a.id||''));
  if (explicitId) {
    ensure(/^[a-f0-9]{32}$/i.test(explicitId),'Configured Cloudflare account ID is invalid');
    ensure(valid.some(a=>a.id.toLowerCase()===explicitId.toLowerCase()),'Token cannot list the explicitly expected Cloudflare account');
    return valid.find(a=>a.id.toLowerCase()===explicitId.toLowerCase()).id;
  }
  ensure(valid.length===1,'Cloudflare token can access '+valid.length+' accounts. Limit its scope to exactly one account before proceeding');
  return valid[0].id;
}

export async function inventory({token,expectedAccountId='',fetchFn=fetch}) {
  const accounts=singlePage(await api(token,'/accounts?per_page=100&page=1',fetchFn),'Account list');
  const accountId=chooseAccount(accounts,expectedAccountId);
  const info=await api(token,'/accounts/'+accountId,fetchFn);
  ensure(info.result?.id===accountId,'Cloudflare account identity did not match');

  const sub=await api(token,'/accounts/'+accountId+'/workers/subdomain',fetchFn);
  const subdomain=sub.result?.subdomain;
  ensure(typeof subdomain==='string' && /^[a-z0-9-]{2,40}$/i.test(subdomain),'Workers.dev subdomain missing or invalid');

  const dbResponse=await api(token,'/accounts/'+accountId+'/d1/database?name='+EXPECTED_DB+'&per_page=100&page=1',fetchFn);
  const dbs=singlePage(dbResponse,'Staging D1 databases').filter(db=>db.name===EXPECTED_DB);
  ensure(dbs.length===1,'Exactly one isolated D1 database named '+EXPECTED_DB+' must exist. Found '+dbs.length);
  const databaseId=dbs[0].uuid;
  ensure(typeof databaseId==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId), 'Staging D1 database UUID missing or invalid');
  const check=await api(token,'/accounts/'+accountId+'/d1/database/'+databaseId,fetchFn);
  ensure(check.result?.name===EXPECTED_DB && check.result?.uuid===databaseId, 'Staging D1 identity check failed');

  const workers=singlePage(await api(token,'/accounts/'+accountId+'/workers/scripts?per_page=100&page=1',fetchFn),'Existing Workers');
  const existing=new Set(workers.map(x=>x.id));
  const collisions=TARGET_NAMES.filter(name=>existing.has(name));
  ensure(collisions.length===0,'These staging Worker names already exist; deployment could overwrite them: '+collisions.join(', '));

  return {accountId, subdomain:subdomain+'.workers.dev', databaseId, targetCount:TARGET_NAMES.length,
    resourceCheck:'READ_ONLY_COMPLETE',noChargeVerified:false,deployAuthorized:false};
}

function summary(msg) { if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,msg+'\n'); }
if(process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split('/').pop())) {
  const token=process.env.CLOUDFLARE_API_TOKEN||'';
  if(!token) {
    console.error('BLOCKED: GitHub Actions secret CLOUDFLARE_API_TOKEN has not been saved. No deployment attempted.');
    summary('### MapleWeb AI automated inventory: BLOCKED — one-time Cloudflare authorization missing. **No deployment.**');
    process.exitCode=2;
  } else {
    try {
      const result=await inventory({token,expectedAccountId:process.env.CLOUDFLARE_ACCOUNT_ID||''});
      console.log('Read-only inventory passed for one Cloudflare account, staging D1, Workers.dev subdomain, and nine unused Worker names.');
      summary('### MapleWeb AI read-only inventory: PASS\nCorrect account, staging D1, subdomain and nine unoccupied Worker names verified. **No deployment.**\n\n**Not yet verified:** free/no-charge eligibility, staging owner/role authentication secrets, and deployment approval.');
      // Intentionally do not save deployment settings, credentials or secrets to output artifacts.
      void result;
    } catch (e) {
      console.error('BLOCKED: '+e.message+' No deployment attempted.');
      summary('### MapleWeb AI read-only inventory: BLOCKED\n'+e.message+'\n\n**No deployment.**');
      process.exitCode=1;
    }
  }
}
