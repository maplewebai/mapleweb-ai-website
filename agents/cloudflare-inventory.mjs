// Read-only Cloudflare account discovery for MapleWeb AI staging.
// Makes GET requests only; it never creates, edits, deletes or deploys resources.
import {appendFileSync} from 'node:fs';

const ROOT = 'https://api.cloudflare.com/client/v4';
const STAGING_SERVICES = [
  {key:'manager', label:'Website Manager', database:'mapleweb-manager-staging-db', worker:'mapleweb-manager-v2-staging'},
  {key:'calling', label:'Calling Sales', database:'mapleweb-calling-sales-staging-db', worker:'mapleweb-calling-sales-staging'},
];
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

async function verifySubdomain(token, accountPath, fetchFn, report) {
  const sub=await api(token,accountPath+'/workers/subdomain','the Workers.dev subdomain',fetchFn);
  const subdomain=sub.result?.subdomain;
  ensure(typeof subdomain==='string' && /^[a-z0-9-]{2,40}$/i.test(subdomain),'Workers.dev subdomain missing or invalid');
  report('Workers.dev subdomain verified.');
}

async function verifyDatabase({token, accountPath, service, databaseId, databases, fetchFn, report}) {
  const label=service.label+' staging D1 database';
  if (!databaseId) {
    const matches=(await databases).filter(db=>db?.name===service.database);
    ensure(matches.length===1,'Exactly one isolated D1 database named '+service.database+' must exist. Found '+matches.length);
    databaseId=matches[0].uuid;
  }
  ensure(typeof databaseId==='string' && DATABASE_ID.test(databaseId), label+' UUID missing or invalid');
  const check=await api(token,accountPath+'/d1/database/'+databaseId,'the '+label,fetchFn);
  ensure(check.result?.name===service.database && check.result?.uuid===databaseId, label+' identity check failed');
  report(label+' verified.');
}

async function verifyWorkerNames(token, accountPath, fetchFn, report) {
  const workers=await api(token,accountPath+'/workers/scripts','the existing Workers list',fetchFn);
  ensure(Array.isArray(workers.result) && workers.result.every(worker=>typeof worker?.id==='string'),
    'Existing Workers returned an unexpected response');
  const existingNames=new Set(workers.result.map(worker=>worker.id));
  const collisions=[];
  for (const {worker} of STAGING_SERVICES) {
    if (existingNames.has(worker)) collisions.push(worker);
    else report('Worker name '+worker+' is unused.');
  }
  ensure(collisions.length===0,'Staging Worker names already in use: '+collisions.join(', ')+'. Deployment could overwrite them.');
}

export async function inventory({token,expectedAccountId='',expectedDatabaseIds={},fetchFn=fetch,report=()=>{}}) {
  const accountId=await verifyAccount(token,expectedAccountId,fetchFn);
  report('Cloudflare connection passed. Account identity verified via GET.');
  const accountPath='/accounts/'+accountId;
  const listNeeded=STAGING_SERVICES.some(({key})=>!expectedDatabaseIds[key]);
  const databases=listNeeded
    ? api(token,accountPath+'/d1/database?per_page=100&page=1','the staging D1 database list',fetchFn)
      .then(response=>singlePage(response,'Staging D1 databases',100))
    : undefined;
  const checks=await Promise.allSettled([
    verifySubdomain(token,accountPath,fetchFn,report),
    verifyWorkerNames(token,accountPath,fetchFn,report),
    ...STAGING_SERVICES.map(service=>verifyDatabase({
      token,accountPath,service,databaseId:expectedDatabaseIds[service.key],databases,fetchFn,report,
    })),
  ]);
  const failures=new Set(checks.filter(check=>check.status==='rejected').map(check=>check.reason.message));
  ensure(failures.size===0,[...failures].join(' '));

  return {accountId, targetCount:STAGING_SERVICES.length,
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
        expectedDatabaseIds:{manager:process.env.MANAGER_D1_ID,calling:process.env.CALLING_D1_ID},
        report:message=>{
          console.log(message);
          summary('- '+message);
        },
      });
      console.log('Website Manager and Calling Sales staging inventory passed.');
      summary('### Staging inventory: PASS\nWebsite Manager and Calling Sales resources verified. **No deployment.**');
    } catch (e) {
      console.error('BLOCKED: '+e.message);
      summary('### Staging inventory: BLOCKED\n'+e.message+'\n\n**No deployment.**');
      process.exitCode=1;
    }
  }
}
