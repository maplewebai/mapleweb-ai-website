// Read-only Cloudflare account discovery for MapleWeb AI staging.
// Makes GET requests only; it never creates, edits, deletes or deploys resources.
import {appendFileSync} from 'node:fs';

const ROOT = 'https://api.cloudflare.com/client/v4';
const EXPECTED_DB = 'mapleweb-manager-staging-db';
const TARGET_WORKER = 'mapleweb-manager-v2-staging';
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const ACCOUNTS_PER_PAGE = 50;

function ensure(condition, message) { if (!condition) throw Error(message); }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

async function api(token, suffix, label, fetchFn) {
  ensure(typeof token==='string' && token.length>0,'Missing secure Cloudflare API token');
  let response;
  try {
    response=await fetchFn(ROOT+suffix, {
      method:'GET',headers:{authorization:'Bearer '+token,accept:'application/json'},
      redirect:'error',signal:AbortSignal.timeout(20000),
    });
  } catch {
    throw Error('Cloudflare request failed when reading '+label);
  }
  ensure(response.ok, 'Cloudflare returned HTTP '+response.status+' when reading '+label);
  let body;
  try { body=await response.json(); } catch { throw Error('Cloudflare returned invalid JSON for '+label); }
  ensure(isObject(body) && body.success===true, 'Cloudflare API rejected read for '+label);
  return body;
}

function singlePage(response, label, pageSize) {
  ensure(Array.isArray(response.result),label+' returned an unexpected response');
  const {total_count, total_pages}=response.result_info ?? {};
  const complete=!(total_count>response.result.length || total_pages>1) &&
    (total_count!=null || total_pages!=null || response.result.length<pageSize);
  ensure(complete, label+' may span multiple pages; refusing incomplete verification');
  return response.result;
}

async function verifyAccount(token, expectedAccountId, fetchFn) {
  let accountId=expectedAccountId;
  if (!accountId) {
    const response=await api(token,'/accounts?per_page='+ACCOUNTS_PER_PAGE+'&page=1','the account list',fetchFn);
    const accounts=singlePage(response,'Account list',ACCOUNTS_PER_PAGE);
    ensure(accounts.length===1,'Cloudflare account list returned '+accounts.length+' accounts. Configure the expected account ID or use a token scoped to exactly one account');
    accountId=accounts[0]?.id ?? '';
  }
  ensure(typeof accountId==='string' && ACCOUNT_ID.test(accountId),'Cloudflare account ID is invalid');
  const info=await api(token,'/accounts/'+accountId,'the Cloudflare account',fetchFn);
  ensure(typeof info.result?.id==='string' && info.result.id.toLowerCase()===accountId.toLowerCase(),'Cloudflare account identity did not match');
  return info.result.id;
}

export async function inventory({token,expectedAccountId='',fetchFn=fetch,onAccountVerified}) {
  const accountId=await verifyAccount(token,expectedAccountId,fetchFn);
  onAccountVerified?.();

  const sub=await api(token,'/accounts/'+accountId+'/workers/subdomain','the Workers.dev subdomain',fetchFn);
  const subdomain=sub.result?.subdomain;
  ensure(typeof subdomain==='string' && /^[a-z0-9-]{2,40}$/i.test(subdomain),'Workers.dev subdomain missing or invalid');

  const dbResponse=await api(token,'/accounts/'+accountId+'/d1/database?per_page=100&page=1','the staging D1 database list',fetchFn);
  const dbs=singlePage(dbResponse,'Staging D1 databases',100).filter(db=>db?.name===EXPECTED_DB);
  ensure(dbs.length===1,'Exactly one isolated D1 database named '+EXPECTED_DB+' must exist. Found '+dbs.length);
  const databaseId=dbs[0].uuid;
  ensure(typeof databaseId==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId), 'Staging D1 database UUID missing or invalid');
  const check=await api(token,'/accounts/'+accountId+'/d1/database/'+databaseId,'the staging D1 database',fetchFn);
  ensure(check.result?.name===EXPECTED_DB && check.result?.uuid===databaseId, 'Staging D1 identity check failed');

  const workers=await api(token,'/accounts/'+accountId+'/workers/scripts','the existing Workers list',fetchFn);
  ensure(Array.isArray(workers.result),'Existing Workers returned an unexpected response');
  ensure(!workers.result.some(worker=>worker?.id===TARGET_WORKER),'The '+TARGET_WORKER+' Worker already exists; deployment could overwrite it');

  return {accountId, subdomain:subdomain+'.workers.dev', databaseId, targetCount:1,
    resourceCheck:'READ_ONLY_COMPLETE',noChargeVerified:false,deployAuthorized:false};
}

function summary(msg) { if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,msg+'\n'); }
if(process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split('/').pop())) {
  const token=process.env.CLOUDFLARE_API_TOKEN||'';
  if(!token) {
    console.error('BLOCKED: No supported Cloudflare token secret is available to this job.');
    summary('### MapleWeb AI automated inventory: BLOCKED — one-time Cloudflare authorization missing. **No deployment.**');
    process.exitCode=2;
  } else {
    try {
      await inventory({
        token,expectedAccountId:process.env.CLOUDFLARE_ACCOUNT_ID||'',
        onAccountVerified:()=>{
          console.log('Cloudflare connection passed. Account identity verified via GET.');
          summary('### Cloudflare connection: PASS\nVerified the account identity via GET.');
        },
      });
      console.log('Manager staging inventory passed. Verified the Workers.dev subdomain, isolated D1 database and unused Manager Worker name.');
      summary('### Manager staging inventory: PASS\nVerified the Workers.dev subdomain, isolated D1 database and unused Manager Worker name. **No deployment.**');
    } catch (e) {
      console.error('BLOCKED: '+e.message);
      summary('### Manager staging inventory: BLOCKED\n'+e.message+'\n\n**No deployment.**');
      process.exitCode=1;
    }
  }
}
