// Bound incoming sizes even when Content-Length is missing or false.
const PRIVATE_KEY = /^(?:email|e-mail|phone|mobile|address|postalcode|zipcode|firstName|lastName|fullName|customerName|contactName|password|token|apiKey|secret)$/i;
const PII_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_VALUE = /(?:\+?\d[ .()-]*){10,}/;
export function validateSynthetic(payload) {
  if (!payload || typeof payload!=='object'||Array.isArray(payload)) throw bad('Expected JSON object');
  if (payload.synthetic!==true) throw bad('Synthetic test data required; real customers are blocked');
  const walk=(value,depth=0)=> {
    if(depth>8) throw bad('Nested payload too deep');
    if (typeof value==='string') {
      if(value.length>6500) throw bad('Text field too large');
      if(PII_VALUE.test(value)||PHONE_VALUE.test(value)) throw bad('Contact information is not accepted in staging');
    } else if (value && typeof value==='object') {
      for (const [key,v] of Object.entries(value)) {
        if(PRIVATE_KEY.test(key)) throw bad('Contact or credential fields are not accepted');
        walk(v,depth+1);
      }
    }
  };
  walk(payload);
  return payload;
}
export function bad(message,status=400){const e=new Error(message);e.status=status;return e;}
export async function readJson(request,maxBytes=12000){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) throw bad('application/json required',415);
  const declared=Number(request.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>maxBytes) throw bad('Request too large',413);
  const reader=request.body?.getReader(); if(!reader) throw bad('Missing JSON body');
  const chunks=[];let total=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
    if(total>maxBytes){await reader.cancel().catch(()=>{});throw bad('Request too large',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw bad('Invalid JSON',400);}
}
export async function requireOwner(request,env){
  if(!env.MANAGER_OWNER_TOKEN || String(env.MANAGER_OWNER_TOKEN).length<32) throw bad('Owner authentication not configured',503);
  const supplied=request.headers.get('authorization')||'';
  if(!supplied.startsWith('Bearer ')) throw bad('Owner token required',401);
  const enc=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(supplied.slice(7))),crypto.subtle.digest('SHA-256',enc.encode(env.MANAGER_OWNER_TOKEN))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;
  for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
  if(diff!==0)throw bad('Unauthorized',401);
}
export const idIsSafe = id=>typeof id==='string'&&/^[A-Z0-9_-]{3,30}$/.test(id);
