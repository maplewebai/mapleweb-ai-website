// Approved, predefined website planning options -> Kimi synthetic model contract.
// No prompts supplied by customers, personal data, API calls or paid usage.
// All content is assembled from allowlisted enum values validated server-side.
import {normalizeWebsiteRequirements} from './order-requirements.mjs';

const clean=x=>x.replaceAll('-',' ');
export function prepareFictionalKimiBrief(requirements) {
  const r=normalizeWebsiteRequirements(requirements);
  const business='Fictional '+clean(r.businessCategory)+' sample';
  const goal=[
    'STAGING TEST; noindex,nofollow. Fictional private HTML only; never publish.',
    'No real names, contacts, prices, scripts, forms, tracking, links, assets, checkout or booking.',
    'Accessible layout. Goal: '+clean(r.websiteGoal)+'; style: '+clean(r.style)+
      '; language: '+(r.language==='en'?'English':
        r.language==='fr'?'French':'English and French')+'.',
    'Pages: '+r.pages.map(clean).join(', ')+
      '. Features (not live): '+(r.features.length?r.features.map(clean).join(', '):'none')+'.'
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
