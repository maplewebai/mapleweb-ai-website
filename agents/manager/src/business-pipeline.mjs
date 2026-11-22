// MapleWeb AI business-flow prototype. SYNTHETIC DATA ONLY.
// No Kimi requests, telephone calls, emails, invoices, payments or deployments occur.
// Event 'evidence' is fictional test input, NOT authorization for real operations.
import {validateSynthetic} from './security.mjs';
import {PRICES_CAD} from './roles.mjs';

const stages = [
  'LEAD_FOUND', 'QUALIFIED', 'CALL_AUTHORIZED', 'CALL_READY',
  'PROPOSAL_PENDING', 'BUILD_REQUESTED', 'PREVIEW_READY', 'QA_PASSED',
  'CUSTOMER_APPROVED', 'PUBLISH_READY', 'SIMULATED_PUBLISHED',
  'SIMULATED_DELIVERED', 'DECLINED', 'BLOCKED', 'NEEDS_HUMAN'
];
export const PIPELINE_STAGES = Object.freeze(stages);
const terminal = new Set(['SIMULATED_DELIVERED', 'DECLINED', 'BLOCKED', 'NEEDS_HUMAN']);
const invalid = message => {const e = new Error(message);e.status = 400;throw e;};
function at(record, ...allowed) {
  if (!allowed.includes(record.stage)) invalid('Transition not allowed from ' + record.stage);
}
function evidence(event, ...checks) {
  for (const key of checks) if (event[key] !== true) invalid('Missing fictional evidence: ' + key);
}
function checkRecord(record) {
  if (!record || typeof record !== 'object' || record.synthetic !== true ||
      !/^[A-Z0-9_-]{3,30}$/.test(record.projectId || '') ||
      !stages.includes(record.stage) || !Number.isSafeInteger(record.version) ||
      record.version < 0 || !Array.isArray(record.history) || record.history.length > 49)
    invalid('Invalid fictional pipeline record');
}
function invalidateVersion(record) {
  record.qaVersion = null;
  record.customerApprovedVersion = null;
  record.ownerApprovedVersion = null;
  record.simulatedPublicationReceipt = false;
  record.simulatedDeliveryReceipt = false;
}
export function createSyntheticPipeline(input) {
  validateSynthetic(input);
  if (typeof input.projectId !== 'string' || !/^[A-Z0-9_-]{3,30}$/.test(input.projectId))
    invalid('Safe fictional project ID required');
  return {
    synthetic: true, projectId: input.projectId, stage: 'LEAD_FOUND',
    version: 0, quote: null, qaVersion: null,
    customerApprovedVersion: null, ownerApprovedVersion: null,
    doNotContact: false, simulatedPublicationReceipt: false,
    simulatedDeliveryReceipt: false,
    history: [{event: 'created', stage: 'LEAD_FOUND', version: 0}]
  };
}
export function advanceSyntheticPipeline(record, event) {
  checkRecord(record);
  validateSynthetic(event);
  if (typeof event.type !== 'string') invalid('Event type required');
  if (terminal.has(record.stage)) invalid('Terminal case cannot be advanced');
  const next = {...record, history: [...record.history]};
  switch (event.type) {
    case 'qualify':
      at(next, 'LEAD_FOUND');
      evidence(event, 'publicBusinessSourceVerified');
      next.stage = 'QUALIFIED';
      break;
    case 'authorize-call':
      at(next, 'QUALIFIED');
      evidence(event, 'priorExpressConsentVerified', 'complianceReviewed', 'suppressionChecked');
      if (next.doNotContact) invalid('Opt-out prohibits calling');
      next.stage = 'CALL_AUTHORIZED';
      break;
    case 'prepare-synthetic-call':
      at(next, 'CALL_AUTHORIZED');
      evidence(event, 'fictionalProvider');
      next.stage = 'CALL_READY';
      break;
    case 'record-synthetic-call-outcome':
      at(next, 'CALL_READY');
      if (event.outcome === 'interested') next.stage = 'PROPOSAL_PENDING';
      else if (event.outcome === 'declined') {
        next.stage = 'DECLINED'; next.doNotContact = true;
      } else if (['no_answer', 'human_requested'].includes(event.outcome))
        next.stage = 'NEEDS_HUMAN';
      else invalid('Unsupported fictional call outcome');
      break;
    case 'record-inbound-inquiry':
      at(next, 'LEAD_FOUND', 'QUALIFIED');
      evidence(event, 'inboundInquiryConfirmed', 'privacyNoticeProvided');
      next.stage = 'PROPOSAL_PENDING';
      break;
    case 'accept-synthetic-proposal': {
      at(next, 'PROPOSAL_PENDING');
      evidence(event, 'scopeAccepted', 'privacyNoticeAccepted',
        'customerBuildConsentVerified', 'ownerFixedQuoteReviewed');
      const {tier, fixedQuoteCAD} = event;
      if (!Number.isInteger(tier) || tier < 1 || tier > PRICES_CAD.length ||
          !Number.isSafeInteger(fixedQuoteCAD) ||
          fixedQuoteCAD < (PRICES_CAD[tier - 1]?.[0] ?? Infinity) ||
          fixedQuoteCAD > (PRICES_CAD[tier - 1]?.[1] ?? -Infinity))
        invalid('Fixed CAD quote must fit an approved package range');
      next.quote = {tier, fixedQuoteCAD, fictional: true};
      next.version = 1;
      invalidateVersion(next);
      next.stage = 'BUILD_REQUESTED';
      break;
    }
    case 'record-synthetic-preview':
      at(next, 'BUILD_REQUESTED');
      evidence(event, 'privatePreviewChecked', 'sourceExportChecked');
      next.stage = 'PREVIEW_READY';
      break;
    case 'pass-synthetic-qa':
      at(next, 'PREVIEW_READY');
      evidence(event, 'requirementsChecked', 'securityChecked',
        'accessibilityChecked', 'mobileChecked');
      next.qaVersion = next.version;
      next.stage = 'QA_PASSED';
      break;
    case 'approve-synthetic-customer':
      at(next, 'QA_PASSED');
      evidence(event, 'simulatedIdentityChecked');
      if (event.version !== next.version || next.qaVersion !== next.version)
        invalid('Customer approval must match current QA-checked version');
      next.customerApprovedVersion = next.version;
      next.stage = 'CUSTOMER_APPROVED';
      break;
    case 'approve-synthetic-owner':
      at(next, 'CUSTOMER_APPROVED');
      evidence(event, 'simulatedIdentityChecked');
      if (event.version !== next.version || next.qaVersion !== next.version ||
          next.customerApprovedVersion !== next.version)
        invalid('Owner and customer approval must match current version');
      next.ownerApprovedVersion = next.version;
      next.stage = 'PUBLISH_READY';
      break;
    case 'simulate-publication':
      at(next, 'PUBLISH_READY');
      evidence(event, 'fictionalHostingConfirmed', 'fictionalDomainPermissionConfirmed',
        'fictionalCostApprovalConfirmed');
      if (next.qaVersion !== next.version ||
          next.customerApprovedVersion !== next.version ||
          next.ownerApprovedVersion !== next.version)
        invalid('Both current-version approvals and QA are required');
      next.simulatedPublicationReceipt = true;
      next.stage = 'SIMULATED_PUBLISHED';
      break;
    case 'simulate-delivery':
      at(next, 'SIMULATED_PUBLISHED');
      evidence(event, 'fictionalDeliveryReceiptConfirmed');
      if (!next.simulatedPublicationReceipt) invalid('Fictional publication receipt required');
      next.simulatedDeliveryReceipt = true;
      next.stage = 'SIMULATED_DELIVERED';
      break;
    case 'request-revision':
      at(next, 'PREVIEW_READY', 'QA_PASSED', 'CUSTOMER_APPROVED', 'PUBLISH_READY');
      if (next.version >= 99) invalid('Fictional version limit reached');
      next.version += 1;
      invalidateVersion(next);
      next.stage = 'BUILD_REQUESTED';
      break;
    case 'opt-out':
      next.doNotContact = true;
      next.stage = 'DECLINED';
      break;
    case 'block':
      next.stage = 'BLOCKED';
      break;
    default:
      invalid('Unsupported fictional pipeline event');
  }
  next.history.push({event: event.type, stage: next.stage, version: next.version});
  return next;
}
export function syntheticPipelineReadiness(record) {
  checkRecord(record);
  return {
    projectId: record.projectId, stage: record.stage, version: record.version,
    quote: record.quote, doNotContact: record.doNotContact,
    customerApprovalSimulated: record.customerApprovedVersion === record.version && record.version > 0,
    ownerApprovalSimulated: record.ownerApprovedVersion === record.version && record.version > 0,
    simulatedPublicationReceipt: record.simulatedPublicationReceipt,
    simulatedDeliveryReceipt: record.simulatedDeliveryReceipt,
    realCustomerProcessingEnabled: false, realCallsEnabled: false,
    realEmailEnabled: false, realKimiBuildConnected: false,
    livePublishingEnabled: false, realPaymentsEnabled: false
  };
}
