// Owner-only bridge from sanitized case requirements to a fictional local draft.
// Does not call AI, contact customers, publish sites, approve work or charge money.
import {bad} from './security.mjs';
import {normalizeWebsiteRequirements} from './order-requirements.mjs';
import {createSyntheticSitePreview} from './synthetic-site-preview.mjs';
import {requireDb,audit} from './store.mjs';

export function fictionalDraftFromCase(state) {
  if (!state || state.stage!=='QUOTE_READY' ||
      state.quote?.status!=='DRAFT_NOT_SENT') {
    throw bad('A prepared owner-reviewed draft quote is required');
  }
  const requirements=normalizeWebsiteRequirements(state.requirements);
  const preview=createSyntheticSitePreview(requirements);
  const draft={status:'DRAFT_READY_FOR_QA',agent:'website-developer',
    version:1,externallyHosted:false,html:preview.html,
    pageSections:preview.pageSections,
    featurePlaceholders:preview.featurePlaceholders,
    realMultiPageSite:false,functionalIntegrations:false};
  return {...draft,synthetic:true,customerSiteCreated:false,
    kimiCalled:false,published:false,paymentCharged:false,
    note:'Fictional local staging preview; QA and verified approvals are still required'};
}

export async function createCaseStagingDraft(env,state) {
  const draft=fictionalDraftFromCase(state);
  const db=requireDb(env);
  // Atomic insert prevents overwriting an existing project or an approved preview.
  const result=await db.prepare(
    'INSERT OR IGNORE INTO projects(id,version,draft_html,qa_passed,revision_open,owner_approved,customer_approved,updated_at) VALUES(?,?,?,?,?,?,?,?)'
  ).bind(state.caseId,1,draft.html,0,0,0,0,new Date().toISOString()).run();
  if (result.meta?.changes!==1 && result.changes!==1)
    throw bad('Staging project already exists; existing draft was not changed',409);
  await audit(db,'fictional-case-draft-created',state.caseId);
  return {projectId:state.caseId,projectVersion:1,draft};
}
