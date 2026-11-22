// Private D1-only business-case storage. No customer PII is accepted.
import {bad} from './security.mjs';
import {requireDb} from './store.mjs';

export async function readBusinessCase(env,caseId){
  const row=await requireDb(env).prepare('SELECT state_json, revision FROM business_cases WHERE id=?').bind(caseId).first();
  if(!row)return null;
  const state=JSON.parse(row.state_json);
  if(state.revision!==row.revision)throw bad('Case revision mismatch',500);
  return state;
}
export async function addBusinessCase(env,state){
  const result=await requireDb(env).prepare(
    'INSERT OR IGNORE INTO business_cases(id,revision,state_json,updated_at) VALUES(?,?,?,?)'
  ).bind(state.caseId,state.revision,JSON.stringify(state),new Date().toISOString()).run();
  if(result.meta?.changes!==1 && result.changes!==1)throw bad('Case already exists',409);
}
export async function updateBusinessCase(env,oldState,newState){
  const result=await requireDb(env).prepare(
    'UPDATE business_cases SET revision=?,state_json=?,updated_at=? WHERE id=? AND revision=?'
  ).bind(newState.revision,JSON.stringify(newState),new Date().toISOString(),oldState.caseId,oldState.revision).run();
  if(result.meta?.changes!==1 && result.changes!==1)throw bad('Case changed; reload before editing',409);
}
export async function listBusinessCases(env){
  const response=await requireDb(env).prepare(
    'SELECT id,revision,updated_at FROM business_cases ORDER BY updated_at DESC LIMIT 50'
  ).all();
  return response.results||[];
}
