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

/** Owner app delivery is deliberately fail-closed. Keep only safe job metadata.
 * Legacy offline tests may exercise synthetic artifact generation with the
 * app feature gates off; the deployment gate must enable this policy.
 */
export function strictOwnerDelivery(env){
  return env.MANAGER_STRICT_DELIVERY_ENABLED==='true' ||
    env.MANAGER_COMMANDS_ENABLED==='true' || env.MANAGER_THREADS_ENABLED==='true';
}
export function ownerJobResult(env,result){
  if(!strictOwnerDelivery(env))return result;
  const safe={};
  for(const key of ['agent','status']){
    if(typeof result?.[key]==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(result[key]))safe[key]=result[key];
  }
  for(const key of ['version','tier','deploymentsPerformed']){
    if(Number.isSafeInteger(result?.[key])&&result[key]>=0)safe[key]=result[key];
  }
  for(const key of ['paymentCharged','invoiceCreated','externallyHosted','sent','realBrowserTested','externalSecurityAudit','approvalInvalidated']){
    if(typeof result?.[key]==='boolean')safe[key]=result[key];
  }
  if(result?.liveUrl===null)safe.liveUrl=null;
  if(Array.isArray(result?.priceRangeCAD)&&result.priceRangeCAD.length===2&&result.priceRangeCAD.every(Number.isFinite))safe.priceRangeCAD=result.priceRangeCAD;
  safe.websiteReleaseAuthorized=false;
  safe.deliveryStatus='BLOCKED_QA';
  return safe;
}
