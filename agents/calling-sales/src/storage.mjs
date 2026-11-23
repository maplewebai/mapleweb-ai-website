import {httpError,numberHash} from './security.mjs';
const now=()=>Math.floor(Date.now()/1000);
const affected = res => res?.meta?.changes ?? res?.changes ?? 0;
export function dbOf(env){if(!env.CALLING_DB)throw httpError('Calling database not configured',503);return env.CALLING_DB;}
export async function isSuppressed(env,number) {
  const hash=await numberHash(number,env);
  return !!(await dbOf(env).prepare('SELECT number_hash FROM suppressions WHERE number_hash=?').bind(hash).first());
}
export async function suppress(env,number,reason='opt-out') {
  const hash=await numberHash(number,env);
  await dbOf(env).prepare('INSERT OR IGNORE INTO suppressions(number_hash,reason,created_at) VALUES(?,?,?)').bind(hash,reason,now()).run();
  await dbOf(env).prepare('DELETE FROM consents WHERE number_hash=?').bind(hash).run();
}
export async function grantConsent(env,number,source,evidenceRef,grantedAt,expiresAt) {
  const hash=await numberHash(number,env);
  if(await isSuppressed(env,number)) throw httpError('Number is on the do-not-call list',403);
  if(!['requested-callback','explicit-request'].includes(source) ||
     typeof evidenceRef!=='string' || !/^[a-zA-Z0-9_-]{6,64}$/.test(evidenceRef) ||
     !Number.isSafeInteger(grantedAt) || !Number.isSafeInteger(expiresAt) ||
     grantedAt>now()+60 || grantedAt<now()-30*86400 ||
     expiresAt<now()+60 || expiresAt>now()+30*86400 || expiresAt<=grantedAt)
     throw httpError('Current documented automated-call consent is required');
  await dbOf(env).prepare('INSERT INTO consents(number_hash,source,evidence_ref,automation_consent,granted_at,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(number_hash) DO UPDATE SET source=excluded.source,evidence_ref=excluded.evidence_ref,automation_consent=excluded.automation_consent,granted_at=excluded.granted_at,expires_at=excluded.expires_at')
    .bind(hash,source,evidenceRef,1,grantedAt,expiresAt).run();
  return {recorded:true,consentExpiresAt:expiresAt,externalProofMustBeRetained:true};
}
export async function verifyConsent(env,number,ref) {
  if(await isSuppressed(env,number)) throw httpError('Do not call this number',403);
  const hash=await numberHash(number,env);
  const consent=await dbOf(env).prepare('SELECT evidence_ref,expires_at,automation_consent FROM consents WHERE number_hash=?').bind(hash).first();
  if(!consent || consent.automation_consent!==1 || consent.expires_at<=now() || consent.evidence_ref!==ref)
    throw httpError('No current verified callback consent record',403);
  return hash;
}
export async function createOutboundReservation(env,id,hash,ref) {
  const db=dbOf(env);
  const dayStart=Math.floor(now()/86400)*86400;
  // One atomic SQL statement applies the cap even under concurrent requests.
  const result=await db.prepare('INSERT OR IGNORE INTO outbound_requests(request_id,number_hash,consent_ref,status,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM outbound_requests WHERE created_at>=?)<3')
    .bind(id,hash,ref,'RESERVED',now(),dayStart).run();
  if(affected(result)!==1){
    const existing=await outboundRecord(env,id);
    if(existing)throw httpError('Repeated outbound request; not calling again',409);
    throw httpError('Daily outbound safety limit reached',429);
  }
}
export async function markOutbound(env,id,status,sid=null){
  await dbOf(env).prepare('UPDATE outbound_requests SET status=?,call_sid=COALESCE(?,call_sid) WHERE request_id=?').bind(status,sid,id).run();
}
export async function outboundRecord(env,id){
  return await dbOf(env).prepare('SELECT request_id,number_hash,call_sid,status FROM outbound_requests WHERE request_id=?').bind(id).first();
}
export async function startSession(env,sid,direction) {
  const db=dbOf(env);
  await db.prepare('DELETE FROM voice_sessions WHERE created_at<?').bind(now()-7*86400).run();
  await db.prepare('INSERT OR IGNORE INTO voice_sessions(call_sid,direction,consented_at,created_at,turns) VALUES(?,?,?,?,0)')
    .bind(sid,direction,now(),now()).run();
}
export async function takeTurn(env,sid,turn) {
  const result=await dbOf(env).prepare('UPDATE voice_sessions SET turns=? WHERE call_sid=? AND turns=?')
    .bind(turn,sid,turn-1).run();
  return affected(result)===1;
}
export async function session(env,sid){return await dbOf(env).prepare('SELECT direction,turns FROM voice_sessions WHERE call_sid=? AND created_at>?').bind(sid,now()-3600).first();}
