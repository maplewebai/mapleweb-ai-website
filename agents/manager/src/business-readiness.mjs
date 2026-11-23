// Owner-only, evidence-conscious readiness assessment. Never infer production
// activation, paid services, live telephone calls, or real customer processing
// from source code, environment flags, or successful unit tests alone.
import {callingSalesState} from './calling-sales.mjs';
import {createKimiModelApi} from './kimi-model-api.mjs';
import {stripeTestStatus} from './stripe-test.mjs';

const indicator=(id,label,codePrepared,configured,verifiedLive,ownerAction,technicalAction)=>({
  id,label,
  codePrepared,
  configured,
  verifiedLive,
  status:verifiedLive?'VERIFIED_LIVE':
    configured?'CONFIGURED_NOT_LIVE_VERIFIED':'NOT_CONNECTED',
  ownerAction,technicalAction
});

export function managerBusinessReadiness(env={}) {
  const calling=callingSalesState(env);
  const kimi=createKimiModelApi(env).status();
  const stripe=stripeTestStatus(env);
  const managerConfigured=!!env.DB &&
    typeof env.MANAGER_OWNER_TOKEN==='string' &&
    env.MANAGER_OWNER_TOKEN.length>=32;
  const casesConfigured=managerConfigured&&env.BUSINESS_CASES_ENABLED==='true';
  const modules=[
    indicator('manager','Website Manager',true,managerConfigured,false,
      'Approve isolated Cloudflare staging and secure account credentials',
      'Deploy and verify authorized staging health, storage, and owner authentication'),
    indicator('customer-intake','Real customer website orders',false,false,false,
      'Approve privacy notice and contact-data processing before real customer intake',
      'Build secure public intake, identity verification, rate limits, and private storage'),
    indicator('customer-planning','Website planning chat',true,casesConfigured,false,
      'Approve public use after privacy and product review',
      'Keep fixed-choice synthetic demo private until a secure public gateway exists'),
    indicator('case-tracking','Owner case dashboard',true,casesConfigured,false,
      'Confirm private data retention and CRM rules before real cases',
      'Verify case database and owner-only dashboard on isolated staging'),
    indicator('calling-sales','AI telephone sales',true,
      calling.configured&&calling.enabled,false,
      'Approve a Twilio number, charges, verified automated-call consent and compliance',
      'Deploy separate Calling Worker and D1, authenticate bridge, test one authorized call'),
    indicator('kimi','Kimi website code generation',true,
      kimi.readyForAuthorizedTest,false,
      'Authorize Kimi developer API access, usage cap and customer-data policy',
      'Run authorized connection test; verify exported code and independent QA'),
    indicator('publishing','Customer website publishing',false,false,false,
      'Approve domain/hosting rights and each customer site before publication',
      'Implement and test a separately authorized, current-version publish adapter'),
    indicator('customer-approval','Real customer acceptance',false,false,false,
      'Approve terms, consent and customer identity-verification method',
      'Implement signed current-version customer and owner approvals'),
    indicator('stripe-test','Stripe test payments',true,
      stripe.checkoutConfigured&&stripe.webhookConfigured&&stripe.databaseConfigured,false,
      'Authorize Stripe sandbox credentials and a no-real-charge end-to-end test',
      'Verify a complete signed test Checkout and webhook in isolated staging'),
    indicator('stripe-live','Real payments and payouts',false,false,false,
      'Approve real Stripe account, tax/compliance and banking configuration',
      'Do not enable live payments without a separate authorized deployment')
  ];
  return {
    scope:'MAPLEWEB_PRIVATE_OWNER_READINESS_ONLY',
    mode:'STAGING_OR_OFFLINE_TEST',
    timestampEvidence:'NOT_COLLECTED',
    note:'Successful local or CI tests and configured flags do not verify live services.',
    totalAreas:modules.length,
    areasVerifiedLive:modules.filter(x=>x.verifiedLive).length,
    canAcceptRealCustomers:false,
    canMakeOrReceiveLiveCallsVerified:false,
    canAutomaticallyBuildRealCustomerWebsites:false,
    canPublishRealCustomerWebsites:false,
    canChargeRealCustomers:false,
    productionLaunchAuthorized:false,
    allRequirementsMet:false,
    modules
  };
}
