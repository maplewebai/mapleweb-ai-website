// Dedicated Twilio voice Worker; not attached to MapleWeb's public site or Manager.
import {httpError,publicBase,response,readJson,strictJson,requireAdmin,verifyTwilio,validPhone,validCallSid} from './security.mjs';
import {dbOf,grantConsent,suppress,verifyConsent,createOutboundReservation,markOutbound,outboundRecord} from './storage.mjs';
import {voiceStart,voiceConsent,voiceTurn} from './voice.mjs';
const sidPattern=/^AC[a-fA-F0-9]{32}$/;
const idPattern=/^[a-zA-Z0-9_-]{12,64}$/;
function readiness(env){return {
  service:'mapleweb-calling-sales-agent',staging:true,twilioConfigured:!!(sidPattern.test(env.TWILIO_ACCOUNT_SID||'')&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM_NUMBER),
  databaseConfigured:!!env.CALLING_DB,publicUrlConfigured:!!env.CALLING_PUBLIC_BASE_URL,
  inboundEnabled:env.CALLING_INBOUND_ENABLED==='true',
  outboundEnabled:env.CALLING_OUTBOUND_ENABLED==='true',
  paidUsageApproved:env.CALLING_PAID_USAGE_APPROVED==='true',
  aiEnabled:env.CALLING_AI_ENABLED==='true'&&env.CALLING_CUSTOMER_DATA_TRANSFER_APPROVED==='true'&&!!env.KIMI_API_KEY,
  recordingsEnabled:false,unsolicitedCallingEnabled:false
};}
export async function handle(req,env,fetchImpl=fetch){
  const u=new URL(req.url);const path=u.pathname;
  if(path==='/health'&&req.method==='GET')return response({service:'mapleweb-calling-sales-agent',status:'code-present',liveProviderVerified:false});
  if(path==='/admin/status'&&req.method==='GET'){
    requireAdmin(req,env);return response(readiness(env));
  }
  if(path.startsWith('/admin/')) {
    requireAdmin(req,env);
    if(req.method!=='POST')throw httpError('Method not allowed',405);
    const input=await readJson(req);
    if(path==='/admin/consent'){
      strictJson(input,['to','source','evidenceRef','grantedAt','expiresAt','ownerReviewed','automatedVoiceConsent']);
      if(input.ownerReviewed!==true || input.automatedVoiceConsent!==true)
        throw httpError('Owner review and explicit automated voice consent are required');
      const saved=await grantConsent(env,input.to,input.source,input.evidenceRef,input.grantedAt,input.expiresAt);
      return response(saved,201);
    }
    if(path==='/admin/suppress'){
      strictJson(input,['to']);await suppress(env,input.to,'owner-requested');
      return response({suppressed:true,externalProviderContactListsMustBeUpdated:true});
    }
    if(path==='/admin/outbound'){
      strictJson(input,['to','evidenceRef','idempotencyKey','approveSingleCharge']);
      if(input.approveSingleCharge!==true ||
         env.CALLING_OUTBOUND_ENABLED!=='true'||
         env.CALLING_PAID_USAGE_APPROVED!=='true'||
         env.CALLING_AUTOMATED_OUTREACH_APPROVED!=='true')
         throw httpError('Outbound calling requires approved charges and explicit enablement',403);
      const {to,evidenceRef,idempotencyKey}=input;
      if(!validPhone(to)||!idPattern.test(idempotencyKey||'') ||
         typeof evidenceRef!=='string'||!idPattern.test(evidenceRef))
         throw httpError('Invalid callback request');
      const hash=await verifyConsent(env,to,evidenceRef);
      const base=publicBase(env);
      if(!sidPattern.test(env.TWILIO_ACCOUNT_SID||'') ||
         typeof env.TWILIO_AUTH_TOKEN!=='string'||env.TWILIO_AUTH_TOKEN.length<16 ||
         !validPhone(env.TWILIO_FROM_NUMBER))
        throw httpError('Twilio credentials or calling number missing',503);
      if(env.CALLING_OUTBOUND_TEST_ONLY==='true') {
        if(to!==env.CALLING_TEST_RECIPIENT_NUMBER) throw httpError('Only the authorized test recipient may be called',403);
      } else if(env.CALLING_OUTBOUND_TEST_ONLY!=='false'||env.CALLING_REAL_CUSTOMER_OUTREACH_APPROVED!=='true') {
        throw httpError('Real customer outreach requires separate explicit approval',403);
      }
      await createOutboundReservation(env,idempotencyKey,hash,evidenceRef);
      const body=new URLSearchParams({To:to,From:env.TWILIO_FROM_NUMBER,
        Url:base+'/voice/outbound?requestId='+encodeURIComponent(idempotencyKey),Method:'POST',
        StatusCallback:base+'/voice/status?requestId='+encodeURIComponent(idempotencyKey),
        StatusCallbackMethod:'POST',StatusCallbackEvent:'completed'});
      let result;
      try {result=await fetchImpl('https://api.twilio.com/2010-04-01/Accounts/'+env.TWILIO_ACCOUNT_SID+'/Calls.json',{
        method:'POST',headers:{authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),
          'content-type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.timeout(10000)
      });} catch {await markOutbound(env,idempotencyKey,'PROVIDER_UNCERTAIN');
        throw httpError('Provider did not confirm the call; do not retry without review',502);}
      if(!result.ok){await markOutbound(env,idempotencyKey,'PROVIDER_REJECTED');
        throw httpError('Twilio rejected call request: '+result.status,502);}
      let data;
      try{data=await result.json();}catch {await markOutbound(env,idempotencyKey,'PROVIDER_UNCERTAIN');
        throw httpError('Uncertain call status; do not retry without review',502);}
      if(!validCallSid(data?.sid)) {await markOutbound(env,idempotencyKey,'PROVIDER_UNCERTAIN');
        throw httpError('Provider did not return a valid call ID',502);}
      await markOutbound(env,idempotencyKey,'REQUESTED',data.sid);
      return response({queued:true,callSid:data.sid,realChargeMayOccur:true},201);
    }
    throw httpError('Unknown admin action',404);
  }
  if(path.startsWith('/voice/')){
    const form=await verifyTwilio(req,env);
    dbOf(env);
    if(path==='/voice/inbound')return await voiceStart(env,form,'inbound',null);
    if(path==='/voice/outbound'){
      const id=u.searchParams.get('requestId');
      if(!idPattern.test(id||''))throw httpError('Unknown callback',403);
      return await voiceStart(env,form,'outbound',id);
    }
    if(path==='/voice/consent'){
      const direction=u.searchParams.get('direction');
      if(!['inbound','outbound'].includes(direction))throw httpError('Invalid call direction');
      return await voiceConsent(env,form,direction);
    }
    if(path==='/voice/turn'){
      const n=Number(u.searchParams.get('turn'));
      return await voiceTurn(env,form,n,fetchImpl);
    }
    if(path==='/voice/status'){
      const id=u.searchParams.get('requestId');
      if(!idPattern.test(id||''))throw httpError('Invalid status ID');
      const record=await outboundRecord(env,id);
      const status=form.get('CallStatus')||'';
      const allowed=['queued','initiated','ringing','in-progress','completed','busy','failed','no-answer','canceled'];
      if(record && allowed.includes(status) && (!record.call_sid||record.call_sid===form.get('CallSid')))
        await markOutbound(env,id,status,form.get('CallSid'));
      return response({received:true});
    }
    throw httpError('Unknown voice webhook',404);
  }
  throw httpError('Not found',404);
}
export async function safeHandle(req,env,fetchImpl=fetch){
  try{return await handle(req,env||{},fetchImpl);}catch(e){
    const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:500;
    return response({error:status===500?'Internal error':e.message},status);
  }
}
export default {fetch(req,env){return safeHandle(req,env);}};
