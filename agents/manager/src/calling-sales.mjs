// Private Manager -> Calling Sales Agent bridge. No public phone actions, no AI calls.
// All requests require the Manager owner token at the Manager's API boundary.
import {bad} from './security.mjs';

const E164 = /^\+[1-9][0-9]{7,14}$/;
const EVIDENCE = /^[A-Za-z0-9_-]{6,64}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{12,64}$/;
const CALL_SID = /^CA[a-fA-F0-9]{32}$/;
const BASE_HOST = /^mapleweb-calling-sales-staging\.[a-z0-9-]+\.workers\.dev$/;
const SUCCESS_FIELDS = new Set(['consent','suppress','outbound']);

export function callingSalesState(env={}) {
  const tokenReady=typeof env.CALLING_AGENT_ADMIN_TOKEN==='string' &&
    env.CALLING_AGENT_ADMIN_TOKEN.length>=32;
  return {
    configured: Boolean(env.CALLING_AGENT_URL && tokenReady),
    enabled: env.CALLING_AGENT_INTEGRATION_ENABLED==='true',
    controlsEnabled: env.CALLING_MANAGER_CONTROLS_ENABLED==='true',
    outboundEnabled: env.CALLING_MANAGER_OUTBOUND_ENABLED==='true',
    paidUsageApproved: env.CALLING_MANAGER_PAID_USAGE_APPROVED==='true',
    liveAgentVerified:false,
    realCallsMadeByManager:0,
    note:'Server-to-server integration; does not verify a Twilio number or activate calling'
  };
}
function endpoint(env,path) {
  if(env.CALLING_AGENT_INTEGRATION_ENABLED!=='true')
    throw bad('Calling Sales Agent integration is disabled',503);
  if(typeof env.CALLING_AGENT_ADMIN_TOKEN!=='string' ||
     env.CALLING_AGENT_ADMIN_TOKEN.length<32)
    throw bad('Calling Sales Agent private token is not configured',503);
  let url;
  try {url=new URL(env.CALLING_AGENT_URL);} catch {
    throw bad('Calling Sales Agent HTTPS URL is not configured',503);
  }
  if(url.protocol!=='https:' || !BASE_HOST.test(url.hostname) || url.port ||
     url.username || url.password || (url.pathname!=='' && url.pathname!=='/') ||
     url.search || url.hash)
    throw bad('Only the isolated Calling Sales staging Worker is allowed',503);
  return url.origin+path;
}
function strict(input,keys) {
  if(!input || typeof input!=='object' || Array.isArray(input) ||
     Object.keys(input).some(key=>!keys.includes(key)) ||
     keys.some(key=>!Object.hasOwn(input,key)))
    throw bad('Unexpected or missing calling request field');
  return input;
}
function phone(v) {if(!E164.test(v||'')) throw bad('E.164 phone number required');}
function consent(input) {
  strict(input,['to','source','evidenceRef','grantedAt','expiresAt','ownerReviewed','automatedVoiceConsent']);
  phone(input.to);
  if(!['requested-callback','explicit-request'].includes(input.source) ||
     !EVIDENCE.test(input.evidenceRef||'') ||
     !Number.isSafeInteger(input.grantedAt) || !Number.isSafeInteger(input.expiresAt) ||
     input.ownerReviewed!==true || input.automatedVoiceConsent!==true)
    throw bad('Verified, owner-reviewed automated-calling consent is required');
}
function outbound(input) {
  strict(input,['to','evidenceRef','idempotencyKey','approveSingleCharge']);
  phone(input.to);
  if(!EVIDENCE.test(input.evidenceRef||'') ||
     !REQUEST_ID.test(input.idempotencyKey||'') ||
     input.approveSingleCharge!==true)
    throw bad('A unique callback ID and per-call owner charge approval are required');
}
function suppression(input) {strict(input,['to']);phone(input.to);}

async function forward(env,method,path,payload,fetchImpl) {
  const url=endpoint(env,path);
  let response;
  try {
    response=await fetchImpl(url,{
      method,
      headers:{
        authorization:'Bearer '+env.CALLING_AGENT_ADMIN_TOKEN,
        accept:'application/json',
        ...(payload ? {'content-type':'application/json'} : {})
      },
      ...(payload ? {body:JSON.stringify(payload)} : {}),
      signal:AbortSignal.timeout(7000)
    });
  } catch {
    // Could have reached Twilio on outbound; never retry automatically.
    throw bad('Calling Sales Agent response uncertain; do not retry automatically',502);
  }
  if(!response.ok) {
    const status=[403,409,429].includes(response.status)?response.status:502;
    throw bad('Calling Sales Agent rejected the operation; review before retrying',status);
  }
  if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))
    throw bad('Unexpected Calling Sales Agent response',502);
  let text;
  try {text=await response.text();} catch {throw bad('Calling Sales Agent response was interrupted',502);}
  if(text.length>2500) throw bad('Oversized Calling Sales Agent response',502);
  let result;
  try {result=JSON.parse(text);} catch {throw bad('Invalid Calling Sales Agent response',502);}
  if(!result || typeof result!=='object' || Array.isArray(result))
    throw bad('Invalid Calling Sales Agent response',502);
  return result;
}
export async function callingSalesStatus(env,fetchImpl=fetch) {
  const result=await forward(env,'GET','/admin/status',null,fetchImpl);
  if(result.service!=='mapleweb-calling-sales-agent' || result.staging!==true)
    throw bad('Calling Sales Agent identity or staging mode mismatch',502);
  return {
    connected:true,service:'mapleweb-calling-sales-agent',
    isolatedStaging:true,twilioConfigured:result.twilioConfigured===true,
    databaseConfigured:result.databaseConfigured===true,
    publicUrlConfigured:result.publicUrlConfigured===true,
    inboundEnabled:result.inboundEnabled===true,
    outboundEnabled:result.outboundEnabled===true,
    paidUsageApproved:result.paidUsageApproved===true,
    aiEnabled:result.aiEnabled===true,
    phoneNumberVerified:false,liveCallTested:false
  };
}
export async function callingSalesAction(env,action,input,fetchImpl=fetch) {
  if(!SUCCESS_FIELDS.has(action)) throw bad('Unsupported calling action',404);
  if(env.CALLING_MANAGER_CONTROLS_ENABLED!=='true')
    throw bad('Calling Sales Agent controls are disabled in Manager',403);
  if(action==='consent') consent(input);
  if(action==='outbound') {
    outbound(input);
    if(env.CALLING_MANAGER_OUTBOUND_ENABLED!=='true' ||
       env.CALLING_MANAGER_PAID_USAGE_APPROVED!=='true')
      throw bad('Manager outbound calling or paid usage is not authorized',403);
  }
  if(action==='suppress') suppression(input);
  const result=await forward(env,'POST','/admin/'+action,input,fetchImpl);
  if(action==='consent') {
    if(result.recorded!==true || !Number.isSafeInteger(result.consentExpiresAt))
      throw bad('Calling Sales Agent did not confirm consent record',502);
    return {recorded:true,consentExpiresAt:result.consentExpiresAt,
      verifiedConsentEvidenceExternallyRequired:true};
  }
  if(action==='suppress') {
    if(result.suppressed!==true) throw bad('Calling Sales Agent did not confirm suppression',502);
    return {suppressed:true,externalSuppressionSyncRequired:true};
  }
  if(result.queued!==true || !CALL_SID.test(result.callSid||''))
    throw bad('Calling Sales Agent did not confirm callback',502);
  return {queued:true,callSid:result.callSid,
    realChargeMayOccur:true,neverRetryAutomatically:true};
}
