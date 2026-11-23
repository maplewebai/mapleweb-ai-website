// Approved, predefined website planning options -> Kimi synthetic model contract.
// No prompts supplied by customers, personal data, API calls or paid usage.
// All content is assembled from allowlisted enum values validated server-side.
import {normalizeWebsiteRequirements} from './order-requirements.mjs';

const clean=x=>x.replaceAll('-',' ');
export function prepareFictionalKimiBrief(requirements) {
  const r=normalizeWebsiteRequirements(requirements);
  const business='Fictional '+clean(r.businessCategory)+' sample';
  const goal=[
    'Create a PRIVATE, clearly fictional and accessible HTML staging draft.',
    'Use only placeholder text. Do not invent real customer names, addresses, prices or contact details.',
    'Keep the draft free of scripts, forms, trackers, external assets, external links, data collection, checkout and real booking.',
    'Requested goal: '+clean(r.websiteGoal)+'.',
    'Visual style: '+clean(r.style)+'.',
    'Language plan: '+(r.language==='en'?'English only':
      r.language==='fr'?'French only':'English and French; translations still need human review')+'.',
    'Requested sections: '+r.pages.map(clean).join(', ')+'.',
    'Nonfunctional feature placeholders: '+
      (r.features.length?r.features.map(clean).join(', '):'none')+'.',
    'Include STAGING TEST and a noindex,nofollow robots meta tag.',
    'Return source for PRIVATE REVIEW ONLY. Do not publish or imply that the site is complete.'
  ].join(' ');
  if(business.length>80||goal.length>450)
    throw new Error('Synthetic Kimi brief exceeded existing bounded model contract');
  return {synthetic:true,business,goal};
}
export function fictionalKimiBriefReadiness(requirements) {
  const brief=prepareFictionalKimiBrief(requirements);
  return {status:'SAFE_SYNTHETIC_KIMI_PROMPT_PREPARED',
    brief,customerInformationIncluded:false,externalModelCalled:false,
    paidUsageAuthorizedByThisResponse:false,generatedWebsiteCreated:false,
    publicationAuthorized:false,
    note:'Prepares a bounded prompt from fixed choices only. Kimi model API requires separate server-side keys, cost authorization and verified connection.'};
}
