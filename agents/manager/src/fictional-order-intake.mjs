// One-step, owner-only handoff of a fully structured FICTIONAL website plan.
// Cannot accept real customers, free text, PII, identity, consent, or money.
// Inserts case metadata once; a human owner must review and quote separately.
import {bad,idIsSafe} from './security.mjs';
import {normalizeWebsiteRequirements} from './order-requirements.mjs';
import {newBusinessCase,applyOwnerCaseEvent,caseCapabilities} from './business-cases.mjs';
import {readBusinessCase,addBusinessCase} from './business-cases-store.mjs';
import {requireDb,audit} from './store.mjs';

const allowed=['synthetic','caseId','requirements'];
function plain(value) {
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
export function validateFictionalOrderIntake(input) {
  if(!plain(input)||Object.keys(input).length!==allowed.length||
    allowed.some(x=>!Object.hasOwn(input,x))||
    Object.keys(input).some(x=>!allowed.includes(x)))
    throw bad('Exactly synthetic, caseId and structured requirements are required');
  if(input.synthetic!==true)
    throw bad('Only fictional order-intake rehearsal is enabled',403);
  if(!idIsSafe(input.caseId))throw bad('Use a safe fictional order ID');
  return {caseId:input.caseId,requirements:normalizeWebsiteRequirements(input.requirements)};
}
export async function submitFictionalOrder(env,input) {
  if(env.BUSINESS_CASES_ENABLED!=='true')
    throw bad('Private fictional business-case tracking is disabled',503);
  requireDb(env);
  const {caseId,requirements}=validateFictionalOrderIntake(input);
  const old=await readBusinessCase(env,caseId);
  if(old)throw bad('Order ID already exists; no overwrite or automatic retry',409);
  const record=applyOwnerCaseEvent(newBusinessCase({caseId}),{
    type:'set-website-requirements',requirements
  });
  // Atomic insert is the authoritative uniqueness check for concurrent requests.
  await addBusinessCase(env,record);
  await audit(env.DB,'fictional-intake-created',caseId);
  return {status:'FICTIONAL_ORDER_WAITING_FOR_OWNER_REVIEW',
    case:caseCapabilities(record),
    intake:{synthetic:true,revision:record.revision,
      requirementsStored:true,customerIdentityCollected:false,
      contactDetailsStored:false,consentVerified:false,
      requestReceivedFromRealCustomer:false},
    nextOwnerAction:'REVIEW_REQUEST',
    communicationsSent:0,aiRequestsMade:0,phoneCallsPlaced:0,
    paymentsCharged:0,customerWebsitePublished:false};
}
export function ownerFictionalOrderProgress(state,project=null) {
  if(!plain(state)||!idIsSafe(state.caseId))
    throw bad('Invalid private case');
  const quoteReady=state.stage==='QUOTE_READY'&&state.quote?.status==='DRAFT_NOT_SENT';
  const stageActions={
    NEW_REQUEST:'REVIEW_REQUEST',
    QUOTE_PENDING:'PREPARE_DRAFT_QUOTE',
    QUOTE_READY:project?'REVIEW_PRIVATE_PREVIEW':'GENERATE_FICTIONAL_PREVIEW',
    AWAITING_ACCEPTANCE:'EXTERNAL_CUSTOMER_ACCEPTANCE_NOT_CONNECTED',
    BUILD_BLOCKED:'VERIFY_REAL_CUSTOMER_BUILD_AUTHORIZATION',
    CLOSED:'NONE',
    DO_NOT_CONTACT:'NONE'
  };
  if(!Object.hasOwn(stageActions,state.stage))throw bad('Invalid case stage',500);
  return {
    caseId:state.caseId,caseRevision:state.revision,
    stage:state.stage,requirementsReady:!!state.requirements,
    draftQuoteReady:quoteReady,
    fictionalPreviewGenerated:!!project,
    previewVersion:project?.version||null,
    localQaPassed:project?.qa_passed===1,
    syntheticOwnerApprovalRecorded:!!project?.owner_approved&&
      project.owner_approved===project.version,
    syntheticCustomerApprovalRecorded:!!project?.customer_approved&&
      project.customer_approved===project.version,
    nextOwnerAction:stageActions[state.stage],
    customerIdentityVerified:false,customerConsentVerified:false,
    realBuildAuthorized:false,paymentAuthorized:false,
    realCustomerDeliveryEnabled:false,realPublishingEnabled:false,
    note:'Fictional case status only; simulated approvals, draft quotes and local QA are not real customer consent or purchase.'
  };
}
