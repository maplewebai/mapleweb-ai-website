// Owner-only CRM readiness summary from private, non-personal business case metadata.
// No external CRM, AI, contacts, emails, calls, charges or publishing actions.
// SQL counts are full-table; the review queue is deliberately capped at 20 safe case IDs.
import {bad,idIsSafe} from './security.mjs';
import {requireDb} from './store.mjs';
import {CASE_STAGES} from './business-cases.mjs';

const NEXT_ACTION=Object.freeze({
  NEW_REQUEST:'REVIEW_REQUIREMENTS',
  QUOTE_PENDING:'PREPARE_DRAFT_QUOTE',
  QUOTE_READY:'REVIEW_UNSENT_DRAFT_QUOTE',
  AWAITING_ACCEPTANCE:'CUSTOMER_VERIFICATION_NOT_CONNECTED',
  BUILD_BLOCKED:'VERIFY_BUILD_AUTHORIZATION',
  CLOSED:'NONE',
  DO_NOT_CONTACT:'NONE'
});
function count(value) {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw bad('Invalid case count in database',500);
  return n;
}
export async function privateBusinessDashboard(env) {
  const db=requireDb(env);
  const groups=await db.prepare(
    "SELECT json_extract(state_json,'$.stage') AS stage, COUNT(*) AS total FROM business_cases GROUP BY json_extract(state_json,'$.stage')"
  ).all();
  const stages=Object.fromEntries(CASE_STAGES.map(x=>[x,0]));
  for(const row of groups.results||[]) {
    if(!Object.hasOwn(stages,row.stage))throw bad('Unexpected case stage in private database',500);
    stages[row.stage]=count(row.total);
  }
  const totalCases=Object.values(stages).reduce((x,y)=>x+y,0);
  if(!Number.isSafeInteger(totalCases))throw bad('Invalid total case count',500);
  const recent=await db.prepare(
    'SELECT id,revision,state_json FROM business_cases ORDER BY updated_at DESC LIMIT 20'
  ).all();
  const reviewQueue=[];
  for(const row of recent.results||[]){
    let state;
    try {state=JSON.parse(row.state_json)} catch {throw bad('Invalid stored case',500)}
    if(!idIsSafe(row.id)||state.caseId!==row.id||state.revision!==row.revision||
       !Object.hasOwn(stages,state.stage))throw bad('Invalid stored case',500);
    if(state.stage==='CLOSED'||state.stage==='DO_NOT_CONTACT')continue;
    reviewQueue.push({
      caseId:row.id,
      revision:row.revision,
      stage:state.stage,
      nextAction:state.stage==='NEW_REQUEST'&&state.requirements?
        'REVIEW_REQUEST':NEXT_ACTION[state.stage],
      requirementsPresent:state.requirements!==null&&state.requirements!==undefined,
      unsentQuotePrepared:state.stage==='QUOTE_READY'&&state.quote?.status==='DRAFT_NOT_SENT'
    });
  }
  return {
    status:'PRIVATE_CASE_TRACKING_ONLY',
    scope:'Non-personal owner-controlled website requirements and draft quotes',
    totalCases,stages,reviewQueue,reviewQueueLimit:20,
    quoteDraftsNotSent:stages.QUOTE_READY,
    realCustomerCommunicationsConnected:false,
    contactDataStoredByDashboard:false,
    customerAcceptanceConnected:false,
    realSiteGenerationConnected:false,
    realPublicationConnected:false,
    stripePaymentsConnected:false,
    amountCollectedCAD:null,
    note:'Counts are private case metadata, NOT sales, accepted orders, invoices, revenue, verified clients or real calling leads.'
  };
}
