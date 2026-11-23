// Honest, read-only quality report for private fictional website projects.
// "passed" below is static structural validation, not browser/performance,
// accessibility certification, customer consent, live domain or publication.
import {bad,idIsSafe} from './security.mjs';
import {buildFictionalSiteBundle,auditFictionalSiteBundle} from './fictional-site-bundle.mjs';
import {auditSyntheticSitePreview} from './synthetic-site-preview.mjs';

export function fictionalQualityReport(state,project=null) {
  if(!state||!idIsSafe(state.caseId)||
    !Number.isSafeInteger(state.revision)||state.revision<1)
    throw bad('Invalid private website case',500);
  const requirementsReady=state.requirements!==null&&
    state.requirements!==undefined;
  const quoteReady=state.stage==='QUOTE_READY'&&state.quote?.status==='DRAFT_NOT_SENT';
  const draftReady=project!==null&&project!==undefined&&project.version>0;
  const bundle=quoteReady&&requirementsReady?
    buildFictionalSiteBundle(state.requirements):null;
  const bundleAudit=bundle?auditFictionalSiteBundle(bundle,state.requirements):null;
  const previewAudit=draftReady&&requirementsReady?
    auditSyntheticSitePreview(project.draft_html,state.requirements):null;
  const previewStaticPass=previewAudit?.status==='LOCAL_STRUCTURE_CHECKS_PASSED';
  const bundleStaticPass=bundleAudit?.status==='LOCAL_STATIC_BUNDLE_CHECKS_PASSED';
  const localQaRecorded=project?.qa_passed===1;
  const reasons=[
    ...(!requirementsReady?['Website requirements not yet provided']:[]),
    ...(!quoteReady?['Reviewed fictional draft quote not ready']:[]),
    ...(!draftReady?['Fictional staging preview not yet created']:[]),
    ...(draftReady&&!previewStaticPass?['Saved preview failed local structural checks']:[]),
    ...(bundle&&!bundleStaticPass?['Static multi-page source check failed']:[]),
    ...(!localQaRecorded?['Manager local QA has not passed']:[]),
    'Real browser/device testing not completed',
    'Accessibility audit not completed',
    'Content, branding and domain ownership not verified',
    'Nonfunctional feature placeholders are not working integrations',
    'Verified real customer acceptance and owner authorization not connected',
    'Publication adapter intentionally disabled'
  ];
  return {
    caseId:state.caseId,caseRevision:state.revision,
    projectVersion:draftReady?project.version:null,
    status:bundleStaticPass&&previewStaticPass&&localQaRecorded?
      'FICTIONAL_STATIC_CHECKS_PASSED_REAL_GATES_PENDING':
      'FICTIONAL_QUALITY_REVIEW_INCOMPLETE',
    requirementsReady,quoteReady,fictionalPreviewExists:draftReady,
    multiPageSourceGenerated:!!bundle,
    staticBundlePassed:bundleStaticPass,
    staticPreviewPassed:previewStaticPass,
    managerLocalQaRecorded:localQaRecorded,
    staticPageCount:bundle?.selectedPages?.length??0,
    issues:reasons,
    realBrowserVerified:false,mobileDeviceVerified:false,
    independentAccessibilityVerified:false,
    realCustomerContentVerified:false,realCustomerApprovalVerified:false,
    realFeatureIntegrationsVerified:false,domainPermissionVerified:false,
    readyForProductionPublish:false,publishEnabled:false,
    reportOnly:true,
    note:'This report does not publish a website or attest to a real customer deliverable.'
  };
}
