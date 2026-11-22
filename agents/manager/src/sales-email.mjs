// Draft-only sales email for synthetic testing. No contact list, no sender, no delivery.
const fail = (message) => { const err=new Error(message); err.status=400; throw err; };
const safe = (value,max) => {
  if(typeof value!=='string') fail('Expected short fictional text');
  const text=value.trim();
  if(text.length<3 || text.length>max || !/^[\p{L}\p{N} .,'&-]+$/u.test(text))
    fail('Only short fictional, plain-text descriptions are accepted');
  return text;
};

/**
 * Preparing a draft is NOT evidence of CASL consent or permission to send it.
 * The future sending service must independently verify consent/eligibility,
 * suppression, sender details, required unsubscribe link and audit records.
 */
export function draftSalesEmail(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))
    fail('Email draft input must be an object');
  if(input.fictional!==true) fail('Fictional demo required');
  if(input.doNotContact===true || input.optedOut===true ||
    input.customerDeclined===true) {
    return {status:'BLOCKED_DO_NOT_CONTACT',agent:'sales',subject:null,body:null,
      messagesSent:0,deliveryEnabled:false,sendingAuthorized:false,
      requiresSuppressionRecord:true,suppressionRecorded:false,
      nextStep:'Do not send or follow up; independently record the suppression before enabling outreach'};
  }
  const type=safe(input.businessType,60);
  const focus=safe(input.websiteGoal,100);
  return {
    status:'DRAFT_ONLY_NOT_READY_TO_SEND',agent:'sales',
    subject:'Website services for your business — MapleWeb AI',
    body:`Hello,\n\nMapleWeb AI helps ${type} businesses plan and build professional websites. We can discuss options for ${focus}, if website services are useful to you.\n\nWould you like information about our website packages? If not, we will respect your choice.\n\nMapleWeb AI\n[Verified business contact details required]\n[Working unsubscribe method required]`,
    recipientEmail:null,consentVerified:false,suppressionChecked:false,
    senderIdentityVerified:false,unsubscribeOperational:false,
    emailServiceConfigured:false,messagesSent:0,deliveryEnabled:false,
    sendingAuthorized:false,requiresManualComplianceReview:true,
    nextStep:'Verify CASL eligibility and suppression, set working sender/contact and unsubscribe controls, obtain owner authorization and separately connect a sending service'};
}
