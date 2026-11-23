// Server-side pagination for private owner-only fictional order tracking.
// Queries only safe case IDs, stage, revision and non-contact metadata.
// No customer contact details, quote sum, personal information or paid actions.
import {bad,idIsSafe} from './security.mjs';
import {requireDb} from './store.mjs';
import {CASE_STAGES} from './business-cases.mjs';
const ACTIVE=Object.freeze(CASE_STAGES.filter(x=>!['CLOSED','DO_NOT_CONTACT'].includes(x)));
const MAX_PAGE=30;
function integerParam(raw,min,max,field) {
  if(typeof raw!=='string'||!/^(?:0|[1-9][0-9]*)$/.test(raw))
    throw bad('Invalid '+field+' query parameter');
  const num=Number(raw);
  if(!Number.isSafeInteger(num)||num<min||num>max)
    throw bad('Invalid '+field+' query parameter');
  return num;
}
export function parsePrivateOrderQueueQuery(search) {
  const params=new URLSearchParams(search);
  for(const key of params.keys())
    if(!['stage','offset','limit'].includes(key))throw bad('Unexpected queue filter');
  for(const field of ['stage','offset','limit'])
    if(params.getAll(field).length>1)throw bad('Duplicate queue filter');
  const stage=params.get('stage')||'ACTIVE';
  if(stage!=='ACTIVE'&&stage!=='ALL'&&!CASE_STAGES.includes(stage))
    throw bad('Unsupported queue stage');
  const offset=integerParam(params.get('offset')??'0',0,10000,'offset');
  const limit=integerParam(params.get('limit')??'20',1,MAX_PAGE,'limit');
  return {stage,offset,limit};
}
function nextAction(record) {
  if(record.stage==='NEW_REQUEST')
    return record.requirements?'REVIEW_REQUEST':'REQUEST_WEBSITE_REQUIREMENTS';
  if(record.stage==='QUOTE_PENDING')return 'PREPARE_DRAFT_QUOTE';
  if(record.stage==='QUOTE_READY')return 'REVIEW_UNSENT_DRAFT_QUOTE';
  if(record.stage==='AWAITING_ACCEPTANCE')return 'REAL_CUSTOMER_ACCEPTANCE_NOT_CONNECTED';
  if(record.stage==='BUILD_BLOCKED')return 'VERIFY_REAL_BUILD_PERMISSION';
  return 'NONE';
}
export async function listPrivateFictionalOrders(env,params) {
  const db=requireDb(env);
  const {stage,offset,limit}=params;
  let rows,summary;
  if(stage==='ACTIVE'){
    const marks=ACTIVE.map(()=>'?').join(',');
    const select="json_extract(state_json,'$.stage') IN ("+marks+")";
    summary=await db.prepare('SELECT COUNT(*) n FROM business_cases WHERE '+select).bind(...ACTIVE).first();
    rows=await db.prepare('SELECT id,revision,state_json,updated_at FROM business_cases WHERE '+
      select+' ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?')
      .bind(...ACTIVE,limit,offset).all();
  }else if(stage==='ALL'){
    summary=await db.prepare('SELECT COUNT(*) n FROM business_cases').first();
    rows=await db.prepare('SELECT id,revision,state_json,updated_at FROM business_cases '+
      'ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?').bind(limit,offset).all();
  }else{
    summary=await db.prepare("SELECT COUNT(*) n FROM business_cases WHERE json_extract(state_json,'$.stage')=?")
      .bind(stage).first();
    rows=await db.prepare("SELECT id,revision,state_json,updated_at FROM business_cases WHERE json_extract(state_json,'$.stage')=? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?")
      .bind(stage,limit,offset).all();
  }
  const total=Number(summary?.n);
  if(!Number.isSafeInteger(total)||total<0)throw bad('Invalid case count',500);
  const items=(rows.results||[]).map(row=>{
    let obj;
    try{obj=JSON.parse(row.state_json)}catch{throw bad('Corrupted stored case',500);}
    if(!idIsSafe(row.id)||obj.caseId!==row.id||
       obj.revision!==row.revision||!CASE_STAGES.includes(obj.stage))
      throw bad('Corrupted stored case',500);
    return {caseId:row.id,revision:row.revision,stage:obj.stage,
      updatedAt:row.updated_at,nextOwnerAction:nextAction(obj),
      requirementsReady:obj.requirements!==null,
      draftQuoteNotSent:obj.quote?.status==='DRAFT_NOT_SENT',
      customerAcceptedVerified:false};
  });
  return {scope:'OWNER_ONLY_FICTIONAL_ORDER_QUEUE',filter:stage,
    offset,limit,total,items,
    nextOffset:offset+items.length<total?offset+items.length:null,
    contactInfoIncluded:false,realSalesIncluded:false,
    realCustomerOrdersEnabled:false,externalActionsEnabled:false,
    note:'Metadata only. Unsent quotes, fictional plans and simulated approvals do not mean actual orders or income.'};
}
