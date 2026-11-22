// Persistent business-case domain logic. Real structure; no fake authorizations.
// Owner authentication and private DB are enforced by the Worker routes.
// Customer PII, credentials, communication, AI spend, and publishing are excluded.
import {PRICES_CAD} from './roles.mjs';
import {bad,idIsSafe} from './security.mjs';

export const CASE_STAGES = Object.freeze([
  'NEW_REQUEST','QUOTE_PENDING','QUOTE_READY','AWAITING_ACCEPTANCE',
  'BUILD_BLOCKED','CLOSED','DO_NOT_CONTACT'
]);
const forbidden = /@|(?:\+?\d[\d .()-]{8,}\d)/;
export function requireCaseInput(value,keys){
  if(!value || typeof value!=='object'||Array.isArray(value))throw bad('Expected case object');
  for(const key of Object.keys(value))if(!keys.includes(key))throw bad('Unexpected case field: '+key);
  for(const v of Object.values(value))if(typeof v==='string' && (v.length>100||forbidden.test(v)))
    throw bad('No contact details or long text in business-case metadata');
  return value;
}
export function newBusinessCase(input){
  requireCaseInput(input,['caseId']);
  if(!idIsSafe(input.caseId))throw bad('A safe case ID is required');
  return {caseId:input.caseId,revision:1,stage:'NEW_REQUEST',
    quote:null,contactAllowed:false,clientAcceptanceVerified:false,
    buildAuthorized:false,publicationAuthorized:false,paymentAuthorized:false,
    eventCount:0};
}
export function applyOwnerCaseEvent(state,event){
  if(!state || !idIsSafe(state.caseId) || !CASE_STAGES.includes(state.stage) ||
    !Number.isSafeInteger(state.revision)||state.revision<1)throw bad('Invalid stored case');
  requireCaseInput(event,['type','tier','fixedQuoteCAD']);
  const next={...state};
  if(['CLOSED','DO_NOT_CONTACT'].includes(state.stage))throw bad('Closed case cannot be advanced');
  switch(event.type){
    case 'review-request':
      if(state.stage!=='NEW_REQUEST')throw bad('Request already reviewed');
      next.stage='QUOTE_PENDING';
      break;
    case 'prepare-quote':{
      if(!['QUOTE_PENDING','QUOTE_READY'].includes(state.stage))throw bad('Request review required');
      const {tier,fixedQuoteCAD}=event;
      if(!Number.isInteger(tier)||tier<1||tier>PRICES_CAD.length||
        !Number.isSafeInteger(fixedQuoteCAD)||
        fixedQuoteCAD<PRICES_CAD[tier-1][0]||
        fixedQuoteCAD>PRICES_CAD[tier-1][1])throw bad('Quote outside approved CAD range');
      next.quote={tier,fixedQuoteCAD,currency:'CAD',status:'DRAFT_NOT_SENT'};
      next.stage='QUOTE_READY';
      break;
    }
    case 'archive':
      next.stage='CLOSED';break;
    case 'opt-out':
      next.stage='DO_NOT_CONTACT';break;
    case 'send-proposal':
    case 'record-customer-acceptance':
    case 'start-build':
    case 'publish':
    case 'charge':
    case 'call':
      throw bad('External integration or verified customer consent required',403);
    default:throw bad('Unsupported business-case event');
  }
  next.revision=state.revision+1;
  next.eventCount=state.eventCount+1;
  return next;
}
export function caseCapabilities(state){
  return {caseId:state.caseId,stage:state.stage,revision:state.revision,
    quote:state.quote,contactAllowed:false,
    clientAcceptanceVerified:false,buildAuthorized:false,
    publicationAuthorized:false,paymentAuthorized:false,
    note:'Real case metadata tracking; customer intake, communications, Kimi build, and publishing are not connected'};
}
