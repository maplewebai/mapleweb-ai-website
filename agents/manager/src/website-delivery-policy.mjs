// Permanent owner instruction: no customer OR owner website previews until audited.
// All results are fail-closed until the Manager can verify an independent signed
// release attestation bound to the exact final website bytes and delivery mode.
// A LOCAL_QA_PASSED smoke test or a simulated approval does not satisfy this.
export const WEBSITE_DELIVERY_POLICY = Object.freeze({
  status:'BLOCKED_QA',
  ownerPreviewAllowed:false,
  customerPreviewAllowed:false,
  customerPublishingAllowed:false,
  deliveryAdapterReady:false,
  approvalMode:'REQUIRE_EXACT_FINAL_BUILD_INDEPENDENT_QA',
  independentBrowserQARequired:true,
  actualDeviceOrDeliveryModeCheckRequired:true,
  allImagesAndMediaMustLoad:true,
  noKnownBlockingDefectsRequired:true,
  exactArtifactDigestRequired:true,
  ownerReviewRequiredForCustomer:true,
  anyRevisionInvalidatesQA:true,
  reason:'Full exact-build QA, delivery-mode verification and safe authorization are not integrated into the live Manager. No website may be shown to owner or customer.'
});
export function deliveryPolicyForProject(project){
  const exists=!!project&&Number.isSafeInteger(project.version)&&project.version>0;
  return {
    ...WEBSITE_DELIVERY_POLICY,
    candidateVersion:exists?project.version:null,
    structuralQaPassed:exists&&project.qa_passed===1,
    note:'Structural QA is an internal staging check, never permission to show, send, or publish a website.'
  };
}
