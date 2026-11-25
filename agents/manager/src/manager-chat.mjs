// Owner-only Manager conversation. Real D1 records, no invented execution.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb,listJobs} from './store.mjs';
import {checkRoleHealth} from './cloudflare.mjs';

export function parseMessage(payload) {
  if (!payload || typeof payload!=='object' || Array.isArray(payload) ||
      Object.keys(payload).length!==2 || payload.synthetic!==true ||
      typeof payload.message!=='string') throw bad('Send a synthetic owner instruction');
  const message=payload.message.trim();
  if(!message || message.length>800) throw bad('Enter 1–800 characters');
  validateSynthetic({synthetic:true,message});
  return message;
}
export function classifyMessage(message) {
  const normalized=message.trim().toLowerCase().replace(/[?.!]+$/,'');
  if(/^(?:status|manager status|what is the status|how is the manager doing)$/.test(normalized))return 'status';
  if(/^(?:jobs|recent jobs|show recent jobs|what are the agents doing|show tasks|what have you done)$/.test(normalized))return 'jobs';
  if(/^(?:agents|agent health|check agents|are the agents active|check agent health)$/.test(normalized))return 'agents';
  return 'advice';
}
export async function chatHistory(env) {
  const db=requireDb(env);
  const r=await db.prepare('SELECT id,message,reply,kind,created_at FROM manager_chat ORDER BY id DESC LIMIT 30').all();
  return {turns:(r.results||[]).reverse(),mode:'private-staging'};
}
export async function managerChat(env,payload,{health=checkRoleHealth}={}) {
  const message=parseMessage(payload);
  const db=requireDb(env);
  const intent=classifyMessage(message);
  let reply,kind='verified-record';
  if(intent==='status'){
    reply='The authenticated staging Manager is responding. Its D1 database is available. Live customer operations, publication and payments are disabled. Ask "check agents" for verified role health or "recent jobs" for recorded activity.';
  }else if(intent==='jobs'){
    const jobs=await listJobs(db);
    reply=jobs.length?'Recent recorded staging jobs (not proof of ongoing activity):\n'+jobs.slice(0,10).map(j=>[j.created_at,j.role+'/'+j.action,j.project_id].join(' — ')).join('\n'):'No staging job records found.';
  }else if(intent==='agents'){
    const result=await health(env);
    reply=result.liveRolesVerified+' of '+result.totalRoles+' role health endpoints verified. Health alone does not prove AI inference or task execution.\n'+result.results.map(x=>x.agent+': '+(x.verified?'health verified':'not verified')).join('\n');
  }else{
    kind='unavailable';
    reply='Natural-language AI is not connected yet. I have not assigned or executed your instruction. You can use the agent controls for supported staging jobs, or ask "status", "recent jobs" or "check agents". No website is released without independent final-build QA.';
    // Opt-in only. Provider account free-tier confirmation is a separate
    // hosting-side gate. This app cap is not a guarantee of account-wide quota.
    if(env.MANAGER_CHAT_AI_ENABLED==='true' && env.MANAGER_CHAT_FREE_CONFIRMED==='true' &&
       env.AI && typeof env.AI.run==='function' && typeof env.MANAGER_CHAT_MODEL==='string' &&
       /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(env.MANAGER_CHAT_MODEL)){
      const day=new Date().toISOString().slice(0,10);
      const reservation=await db.prepare('INSERT INTO manager_chat_quota(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<10').bind(day).run();
      if(reservation.meta?.changes===1){
        try{
          const result=await env.AI.run(env.MANAGER_CHAT_MODEL,{messages:[
            {role:'system',content:'You are MapleWeb AI Manager in private staging. Give concise planning advice only. You have no tools and cannot execute jobs, confirm live agent status, publish, contact customers or process payments. Never claim completion or request credentials. For actual status, direct the owner to status, recent jobs or check agents. Website delivery requires independent exact-build QA.'},
            {role:'user',content:message}],max_tokens:384});
          if(typeof result?.response!=='string'||!result.response.trim())throw Error('No supported model text');
          reply='AI planning advice — no job executed:\n'+result.response.trim().slice(0,2400);
          kind='ai-advice';
        }catch{
          reply='The configured AI model did not return a usable response. No job was executed. The reserved request remains counted against the daily limit.';
          kind='unavailable';
        }
      }else reply='The Manager chat daily allowance is exhausted or cannot be confirmed. No AI request or job was executed.';
    }
  }
  const createdAt=new Date().toISOString();
  await db.prepare('INSERT INTO manager_chat(message,reply,kind,created_at) VALUES(?,?,?,?)').bind(message,reply,kind,createdAt).run();
  return {message,reply,kind,created_at:createdAt,jobExecuted:false};
}
