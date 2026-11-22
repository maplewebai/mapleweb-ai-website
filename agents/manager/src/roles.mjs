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
    case 'sales/prepare-order': {
      // Synthetic sales handoff only. This cannot accept contact details, create
      // a customer account, publish a site, issue an invoice or trigger Kimi.
      if (input.fictional !== true) error('Fictional test order required');
      const tier=Number(input.tier);
      if (!Number.isInteger(tier)||tier<1||tier>6) error('Choose an approved tier 1–6');
      const business=val(input,'business',80),goal=val(input,'goal',450);
      if (business.length<3 || goal.length<10) error('Fictional business and website goal required');
      const features=input.features===undefined?[]:input.features;
      if (!Array.isArray(features)||features.length>8||
        features.some(x=>typeof x!=='string'||x.trim().length<2||x.length>100))
        error('Provide up to eight short fictional website features');
      const combined=[business,goal,...features].join(' ');
      if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(combined) ||
        /(?:\+?\d[ .()-]*){10,}/.test(combined))
        error('Contact details are prohibited in staging');
      return {status:'DRAFT_ORDER_NOT_SUBMITTED',agent:role,
        package:['Simple','Simple','Professional','Professional','Advanced','Advanced'][tier-1],
        tier,priceRangeCAD:PRICES_CAD[tier-1],
        scope:{business:escape(business),goal:escape(goal),features:features.map(x=>escape(x.trim()))},
        exactQuoteAgreed:false,consentVerified:false,customerAccountCreated:false,
        kimiBuildTriggered:false,realOrderCreated:false,invoiceCreated:false,
        paymentCharged:false,publicationAuthorized:false,
        nextStep:'Owner must review scope and fixed quote; no customer transaction or live action'};
    }
    case 'sales/trial-terms':
      // Informational policy proposal, never a permission to deploy or suspend.
      return {status:'PROPOSED_TERMS_ONLY',agent:role,
        standardTrialHours:24,optionalExpressTrialHours:4,
        paymentDeadlineHoursAfterVerifiedGoLive:24,
        deadlineStartsAt:'successful trial publication, not draft creation',
        customerAndOwnerApprovalRequired:true,writtenCustomerConsentRequired:true,
        nonpaymentReminderSuggestedAtHour:20,
        suspensionRequiresSeparateVerifiedOwnerApproval:true,
        autoSuspendOnNonpayment:false,trialPublicationEnabled:false,
        realInvoicesEnabled:false,paymentsEnabled:false,
        headquartersMayBeTakenOfflineAutomatically:false,
        note:'No site may be published or suspended by this response. Real actions need separate authorization and verified integrations'};
    case 'sales/handle-objection': {
      // One respectful answer in an ongoing, permission-based conversation.
      // A clear refusal or opt-out ALWAYS takes priority over persuasion.
      // No message or telephone call is sent by this staging function.
      const reason=val(input,'reason',32).toLowerCase();
      const reasons=['hesitant','price','timing','trust','already_has_site',
        'not_interested','opt_out','other'];
      if(!reasons.includes(reason)) error('Choose a supported objection reason');
      const followUps=Number(input.followUpsThisConversation ?? 0);
      if(!Number.isInteger(followUps)||followUps<0||followUps>20)
        error('Invalid follow-up count');
      if(input.customerDeclined===true || input.doNotContact===true ||
        reason==='not_interested' || reason==='opt_out'){
        return {status:'CLOSE_CONVERSATION_NO_FOLLOWUP',agent:role,
          reply:reason==='opt_out'||input.doNotContact===true
            ? 'Understood. We will not contact you again about this.'
            : 'Thank you for letting us know. We respect your decision and will not follow up.',
          reason,followUpAllowed:false,requiresSuppressionRecord:true,
          suppressionRecorded:false,messageSent:false,callPlaced:false,
          paymentCharged:false,offerIsLive:false};
      }
      if(followUps>=1){
        return {status:'CLOSE_CONVERSATION_NO_FOLLOWUP',agent:role,
          reply:'Thank you for considering MapleWeb AI. No pressure to decide now.',
          reason,followUpAllowed:false,requiresSuppressionRecord:false,
          suppressionRecorded:false,messageSent:false,callPlaced:false,
          paymentCharged:false,offerIsLive:false};
      }
      const replies={
        hesitant:'A website may help customers understand your services and find ways to contact you. What would be most helpful for your business? We can stop if you prefer.',
        price:'Budget matters. We can compare our Simple, Professional and Advanced planning ranges and prepare a written quote for only the features you need. Would a smaller option be useful?',
        timing:'There is no rush. If the timing is not right, we can end here. Would you prefer a brief overview for when you are ready?',
        trust:'It makes sense to want to see the result before deciding. We are planning private previews and a clearly agreed 24-hour trial before payment, but these are not live services yet. Would you like an explanation of that proposed process?',
        already_has_site:'If your current website meets your needs, you may not need a replacement. If you want, we can discuss one specific improvement instead. Is there something you wish worked better?',
        other:'Is there one question or concern I could help answer? If you would rather stop, that is completely fine.'
      };
      return {status:'DRAFT_REPLY_ONLY',agent:role,reason,reply:replies[reason],
        followUpAllowed:true,maxOptionalFollowUpsPerConversation:1,
        requiresCustomerPermission:true,requiresSuppressionRecord:false,
        suppressionRecorded:false,messageSent:false,callPlaced:false,
        paymentCharged:false,offerIsLive:false,
        nextStep:'Use only while the customer is willing to continue; no unsolicited later follow-up'};
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
