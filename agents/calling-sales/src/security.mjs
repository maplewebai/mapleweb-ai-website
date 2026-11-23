// Cloudflare Web Crypto primitives; no third-party dependencies.
const enc = new TextEncoder();
export function httpError(message, status=400) { const e=new Error(message); e.status=status; return e; }
export function xmlEscape(value) {return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
export const validPhone = v => typeof v==='string' && /^\+[1-9][0-9]{7,14}$/.test(v);
export const validCallSid = v => typeof v==='string' && /^CA[a-fA-F0-9]{32}$/.test(v);
export function publicBase(env) {
  const s=env.CALLING_PUBLIC_BASE_URL;
  if(typeof s!=='string' || !/^https:\/\/[a-z0-9.-]+(?::443)?\/?$/i.test(s)) throw httpError('Public HTTPS calling address not configured',503);
  return s.replace(/\/$/,'');
}
export function strictJson(value, allowed) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) throw httpError('Invalid request fields');
  return value;
}
export async function readJson(req, max=2000) {
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw httpError('Expected JSON');
  const raw=await req.text();
  if(raw.length>max) throw httpError('Body too large',413);
  try {return JSON.parse(raw);} catch {throw httpError('Invalid JSON');}
}
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string') return false; let x=a.length^b.length;const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)x|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return x===0;};
export function requireAdmin(req,env) {
  if(typeof env.CALLING_ADMIN_TOKEN!=='string' || env.CALLING_ADMIN_TOKEN.length<32 ||
     !equal(req.headers.get('authorization')||'', 'Bearer '+env.CALLING_ADMIN_TOKEN))
    throw httpError('Unauthorized',401);
}
export async function hmac(secret,algorithm,message) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:algorithm},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
export async function numberHash(number,env) {
  if(!validPhone(number)) throw httpError('Invalid E.164 telephone number');
  const secret=env.CALLING_HASH_SECRET;
  if(typeof secret!=='string'||secret.length<32) throw httpError('Private phone number hash key missing',503);
  return Array.from(await hmac(secret,'SHA-256',number),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyTwilio(req,env) {
  if(req.method!=='POST') throw httpError('Method not allowed',405);
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) throw httpError('Invalid Twilio content type',415);
  const token=env.TWILIO_AUTH_TOKEN;
  if(typeof token!=='string'||token.length<16) throw httpError('Twilio webhook not configured',503);
  const raw=await req.text();
  if(raw.length>10000) throw httpError('Twilio webhook too large',413);
  const form=new URLSearchParams(raw);
  const keys=[...form.keys()];
  if(new Set(keys).size!==keys.length) throw httpError('Repeated Twilio form parameter',400);
  if(!/^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID||'') || form.get('AccountSid')!==env.TWILIO_ACCOUNT_SID)
    throw httpError('Wrong Twilio account',403);
  if(!validCallSid(form.get('CallSid'))) throw httpError('Invalid Twilio call',403);
  const u=new URL(req.url);
  const canonical=publicBase(env)+u.pathname+u.search;
  const signed=canonical+[...new Set(keys)].sort().map(k=>k+form.get(k)).join('');
  const actual=btoa(String.fromCharCode(...await hmac(token,'SHA-1',signed)));
  if(!equal(actual,req.headers.get('x-twilio-signature')||'')) throw httpError('Invalid Twilio signature',403);
  return form;
}
export function response(body,status=200,type='application/json; charset=utf-8') {
  return new Response(type.startsWith('application/json')?JSON.stringify(body):body,{status,headers:{
    'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer','content-security-policy':"default-src 'none';frame-ancestors 'none'"}});
}
export const twiml = body => response('<?xml version="1.0" encoding="UTF-8"?><Response>'+body+'</Response>',200,'text/xml; charset=utf-8');
export const say = text => '<Say language="en-US" voice="alice">'+xmlEscape(text)+'</Say>';
export const hangup = text => twiml(say(text)+'<Hangup/>');
