// MapleWeb AI: eight deterministic, staging-only roles. No paid model is called.
export const ROLES = Object.freeze([
  'website-developer','customer-care','sales','research',
  'quality-checker','support','finance','publishing',
]);
export const PRICES_CAD = Object.freeze([
  [500,800],[900,1500],[1500,2200],
  [2300,3000],[3000,4500],[4500,7000],
]);
const escape = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const val = (o,key,max=250) => typeof o[key]==='string' ? o[key].trim().slice(0,max) : '';
const error = message => { const e = new Error(message); e.status = 400; throw e; };

/** Outputs are drafts and readiness checks, not live AI or customer operations. */
export function runRole(role,action,input={},context={}) {
  if (!ROLES.includes(role)) error('Unknown agent role');
  if (!input || typeof input!=='object' || Array.isArray(input)) error('Input must be an object');
  switch(`${role}/${action}`) {
    case 'website-developer/build-draft': {
      const business = val(input,'business',80), description = val(input,'description',450);
      if (!business || !description) error('Fictional business and description are required');
      const version = Number.isSafeInteger(context.nextVersion) && context.nextVersion>0 ? context.nextVersion:1;
      return {status:'DRAFT_READY_FOR_QA',agent:role,version,externallyHosted:false,
        html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(business)} — STAGING</title><style>body{font-family:system-ui,sans-serif;max-width:65rem;margin:auto;padding:2rem;line-height:1.6}h1{font-size:clamp(2rem,5vw,4rem)}a:focus-visible{outline:3px solid blue}</style></head><body><header><strong>STAGING TEST — NOT A CUSTOMER WEBSITE</strong></header><main><h1>${escape(business)}</h1><p>${escape(description)}</p></main><footer>Preview only. Publication requires separate verified approvals.</footer></body></html>`};
    }
    case 'website-developer/request-revision':
      return {status:'REVISION_REQUESTED',agent:role,approvalInvalidated:true,note:val(input,'note',250)};
    case 'customer-care/intake':
      return {status:'DRAFT_ONLY',agent:role,message:'Thanks for contacting MapleWeb AI. What is the business type, website goal, and preferred features?',sent:false};
    case 'sales/quote': {
      const tier=Number(input.tier);
      if (!Number.isInteger(tier)||tier<1||tier>6) error('Choose an approved tier 1–6');
      return {status:'OWNER_REVIEW_REQUIRED',agent:role,tier,
        priceRangeCAD:PRICES_CAD[tier-1],tax:'NOT_CALCULATED',invoiceCreated:false,paymentCharged:false};
    }
    case 'research/plan':
      return {status:'RESEARCH_PLAN_ONLY',agent:role,sector:val(input,'sector',70)||'local business',
        area:val(input,'area',70)||'Toronto',scrapedContacts:0,messagesSent:0,
        nextStep:'Owner reviews market information; no scraping or outreach is authorized'};
    case 'quality-checker/review': {
      const html=val(input,'html',6000);
      const checks={hasLang:/<html\s+lang="[a-z-]+"/i.test(html),hasViewport:/name="viewport"/.test(html),
        noScript:!/<script\b/i.test(html),noForms:!/<form\b/i.test(html),
        markedStaging:html.includes('STAGING TEST'),noindex:html.includes('noindex,nofollow')};
      return {status:Object.values(checks).every(Boolean)?'LOCAL_QA_PASSED':'LOCAL_QA_FAILED',agent:role,
        checks,realBrowserTested:false,externalSecurityAudit:false};
    }
    case 'support/triage': {
      const category=(val(input,'category',50)||'general').toLowerCase();
      const escalate=['refund','payment','privacy','security','legal','tax','complaint','breach'].includes(category);
      return {status:escalate?'OWNER_ESCALATION_REQUIRED':'DRAFT_ONLY',agent:role,
        category,reply:escalate?'An authorized owner must review this request.':'A support reply is ready for owner review.',sent:false};
    }
    case 'finance/status':
      return {status:'SETUP_NOT_CONNECTED',agent:role,revenueCAD:null,stripeLive:false,
        bankConnected:false,paymentsCharged:0,taxVerified:false};
    case 'publishing/readiness': {
      const reasons=['Publishing adapter intentionally disabled in staging'];
      if (context.qaPassed!==true) reasons.push('No verified QA for current draft');
      if (context.revisionOpen===true) reasons.push('Open revision invalidates approvals');
      if (context.ownerApprovedVersion!==context.currentVersion || !context.currentVersion)
        reasons.push('Current-version owner approval missing');
      if (context.customerApprovedVersion!==context.currentVersion || !context.currentVersion)
        reasons.push('Current-version customer approval missing');
      return {status:'NOT_PUBLISHED',agent:role,reasons,liveUrl:null,deploymentsPerformed:0};
    }
    default: error('Unsupported action for this role');
  }
}
