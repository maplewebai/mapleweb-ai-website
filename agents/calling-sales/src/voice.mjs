import {publicBase,xmlEscape,validPhone,hangup,twiml,say,httpError,numberHash} from './security.mjs';
import {dbOf,isSuppressed,suppress,startSession,takeTurn,session,outboundRecord} from './storage.mjs';

const MAX_TURNS=4;
const optOut=text=>/\b(stop calling|do not call|don't call|remove me|take me off|unsubscribe|opt out|never call|stop|leave me alone)\b/i.test(text);
const affirmative=text=>/\b(yes|i agree|agree|okay|ok|sure|go ahead|please do|that's fine)\b/i.test(text) && !/\b(no|not|don't|stop)\b/i.test(text);
const cleanSpeech=raw => typeof raw==='string' ? raw.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,450):'';
const withoutPersonals=text => text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]')
  .replace(/\+?\d[\d().\s-]{8,}\d/g,'[number removed]');
export function safeSpoken(text){return withoutPersonals(cleanSpeech(String(text)).replace(/<[^>]*>/g,'')).slice(0,440);}
export function scriptedSalesReply(text) {
  const s=text.toLowerCase();
  if(/\b(price|cost|charge|budget|how much|package)\b/.test(s))
    return 'Our website packages have planning ranges starting at five hundred Canadian dollars. The exact price depends on your pages and features, and we give a written quote for review. Would you like to hear about the packages?';
  if(/\b(what|services|build|website|do you)\b/.test(s))
    return 'MapleWeb AI helps businesses plan and build websites, including pages for services, products, and contact information. What kind of website are you interested in?';
  if(/\b(human|person|representative|owner|callback|meeting|talk)\b/.test(s))
    return 'You can contact the MapleWeb AI team through our official website. I cannot schedule a callback or take personal details on this call yet.';
  if(/\b(pay|card|invoice|checkout)\b/.test(s))
    return 'I cannot take payments or collect card information over the phone. Any payment information would be provided securely after a written agreement.';
  return 'I can explain our website packages and what a professional business website may include. Would you like information about prices or features?';
}
export async function answerWithKimi(env,utterance,fetchImpl=fetch) {
  if(env.CALLING_AI_ENABLED!=='true'||env.CALLING_PAID_USAGE_APPROVED!=='true'||
     env.CALLING_CUSTOMER_DATA_TRANSFER_APPROVED!=='true'||
     typeof env.KIMI_API_KEY!=='string'||env.KIMI_API_KEY.length<10)
     return {reply:scriptedSalesReply(utterance),aiUsed:false};
  try {
    const result=await fetchImpl('https://api.moonshot.ai/v1/chat/completions',{
      method:'POST',headers:{authorization:'Bearer '+env.KIMI_API_KEY,'content-type':'application/json'},
      body:JSON.stringify({model:'kimi-k2.6',stream:false,max_completion_tokens:160,temperature:0.2,
        messages:[
          {role:'system',content:"You are MapleWeb AI's disclosed automated telephone assistant. Answer the caller's latest question in friendly, plain English. Maximum 65 words. Explain website design services and approximate CAD package ranges only; prices are not binding. Do not promise published websites, free trials, guarantees, specific timelines, or operational payments. Do not ask for or repeat personal information, phone numbers, email addresses, addresses, payment details or credentials. Do not claim to transfer calls, schedule appointments, or contact people. Respect refusal immediately. Never use markup or links."},
          {role:'user',content:safeSpoken(utterance)}
        ]}),signal:AbortSignal.timeout(7000)
    });
    if(!result.ok)throw new Error('Model service unavailable');
    const data=await result.json();
    const text=data?.choices?.[0]?.message?.content;
    if(typeof text!=='string'||text.length<2)throw new Error('Empty answer');
    return {reply:safeSpoken(text)||scriptedSalesReply(utterance),aiUsed:true};
  }catch {return {reply:scriptedSalesReply(utterance),aiUsed:false};}
}
function gather(env,path,prompt) {
  const base=publicBase(env);
  const action=xmlEscape(base+path);
  return '<Gather input="speech" language="en-US" speechTimeout="2" timeout="6" method="POST" actionOnEmptyResult="true" action="'+action+'">'+say(prompt)+'</Gather>';
}
function askConsent(env,direction) {
  const hello=direction==='outbound'
    ? 'Hello. This is MapleWeb AI automated assistant returning a callback that was requested. Is now a good time?'
    : 'Hello. You reached MapleWeb AI. I am an automated assistant for website services.';
  const privacy=' Speech recognition will process your reply. If you agree to use the assistant, say yes. To end this call, say no or stop. We do not record calls.';
  return twiml(gather(env,'/voice/consent?direction='+direction,hello+privacy)+say('I did not hear yes. Goodbye.')+'<Hangup/>');
}
export async function voiceStart(env,form,direction,requestId){
  if((env.CALLING_INBOUND_ENABLED!=='true'||env.CALLING_PAID_USAGE_APPROVED!=='true') && direction==='inbound')
    return hangup('MapleWeb AI phone assistant is not available. Goodbye.');
  if(env.CALLING_OUTBOUND_ENABLED!=='true' && direction==='outbound')
    return hangup('This callback service is currently unavailable. Goodbye.');
  const from=form.get('From'); const to=form.get('To');
  if(!validPhone(from)||!validPhone(to))throw httpError('Invalid caller or destination',400);
  if(direction==='inbound') {
    if(env.TWILIO_FROM_NUMBER && to!==env.TWILIO_FROM_NUMBER)throw httpError('Wrong inbound phone number',403);
  } else {
    const record=await outboundRecord(env,requestId);
    if(!record||!['RESERVED','REQUESTED','queued','initiated','ringing','in-progress'].includes(record.status))
      throw httpError('Unknown outbound callback',403);
    if(record.number_hash!==await numberHash(to,env))throw httpError('Callback destination mismatch',403);
    if(await isSuppressed(env,to))return hangup('This callback is no longer permitted. Goodbye.');
  }
  return askConsent(env,direction);
}
export async function voiceConsent(env,form,direction) {
  const sid=form.get('CallSid');
  const from=form.get('From');
  const caller=direction==='outbound'?form.get('To'):from;
  if(!validPhone(caller))throw httpError('Invalid phone number');
  const spoken=cleanSpeech(form.get('SpeechResult'));
  if(optOut(spoken)){
    await suppress(env,caller,'spoken-opt-out');
    return hangup('Understood. We will not call this number again. Goodbye.');
  }
  if(!affirmative(spoken))return hangup('No problem. Thank you for calling. Goodbye.');
  if(direction==='outbound' && await isSuppressed(env,caller))return hangup('This number is on our do not call list. Goodbye.');
  await startSession(env,sid,direction);
  return twiml(gather(env,'/voice/turn?turn=1',
    'Thank you. I can explain MapleWeb AI website packages and answer questions. What would you like to know?')+
    say('No question heard. Thanks for calling. Goodbye.')+'<Hangup/>');
}
export async function voiceTurn(env,form,turn,fetchImpl=fetch) {
  const sid=form.get('CallSid');
  if(!Number.isInteger(turn)||turn<1||turn>MAX_TURNS)throw httpError('Conversation limit exceeded',400);
  const active=await session(env,sid);
  if(!active)return hangup('The conversation has ended. Goodbye.');
  const caller=active.direction==='outbound'?form.get('To'):form.get('From');
  if(!validPhone(caller))throw httpError('Missing caller number');
  if(active.direction==='outbound' && await isSuppressed(env,caller))return hangup('This conversation has ended. Goodbye.');
  if(!(await takeTurn(env,sid,turn)))return hangup('This conversation has already been processed. Goodbye.');
  const spoken=cleanSpeech(form.get('SpeechResult'));
  if(optOut(spoken)){
    await suppress(env,caller,'spoken-opt-out');
    return hangup('Understood. We will not call this number again. Goodbye.');
  }
  if(!spoken)return hangup('I could not hear a question. Thank you for calling. Goodbye.');
  const answer=await answerWithKimi(env,spoken,fetchImpl);
  if(turn===MAX_TURNS)return hangup(answer.reply+' Thank you for your time. Goodbye.');
  return twiml(gather(env,'/voice/turn?turn='+(turn+1),answer.reply+' Do you have another question?')+
    say('Thank you for your time. Goodbye.')+'<Hangup/>');
}
