// Owner-only Manager conversation. Real D1 records, no invented execution.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb,listJobs} from './store.mjs';
import {checkRoleHealth} from './cloudflare.mjs';
import {requireThread} from './manager-threads.mjs';
import {githubDevelopmentReport,githubTaskStatus} from './github.mjs';

// Explicit low-cost model selection; no paid-tier or arbitrary model fallback.
export const MANAGER_FREE_MODELS=Object.freeze(["@cf/google/gemma-4-26b-a4b-it"]);
export function managerModelReadiness(env={}){
  const model=MANAGER_FREE_MODELS.includes(env.MANAGER_CHAT_MODEL)?env.MANAGER_CHAT_MODEL:null;
  const bindingConfigured=typeof env.AI?.run==='function';
  const freePlanConfirmed=env.MANAGER_CHAT_FREE_CONFIRMED==='true';
  const enabled=env.MANAGER_CHAT_AI_ENABLED==='true'&&freePlanConfirmed&&bindingConfigured&&!!model;
  return {enabled,bindingConfigured,freePlanConfirmed,model,liveInferenceVerified:false,dailyRequestCap:10,paidFallback:false};
}
export function parseMessage(payload) {
  if (!payload || typeof payload!=='object' || Array.isArray(payload) ||
      Object.keys(payload).some(k=>!['synthetic','message','threadId'].includes(k)) || payload.synthetic!==true ||
      (Object.hasOwn(payload,'threadId')&&typeof payload.threadId!=='string') ||
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
  if(/^(github status|check github|github agent status|check github agent)$/.test(normalized))return 'github-status';
  if(/^github task status #?[1-9][0-9]{0,8}$/.test(normalized))return 'github-task-status';
  return 'advice';
}
function scopedChat(db,env,threadId,sql){
  if(env.MANAGER_THREADS_ENABLED!=='true')return db.prepare(sql.replace('/*scope*/',''));
  return threadId?db.prepare(sql.replace('/*scope*/','AND thread_id=?')).bind(threadId):db.prepare(sql.replace('/*scope*/','AND thread_id IS NULL'));
}
export async function chatHistory(env,threadId=null) {
  if(threadId!==null)await requireThread(env,threadId);
  const db=requireDb(env);
  const r=await scopedChat(db,env,threadId,'SELECT id,message,reply,kind,created_at FROM manager_chat WHERE 1=1 /*scope*/ ORDER BY id DESC LIMIT 30').all();
  return {turns:(r.results||[]).reverse(),mode:'private-staging'};
}
export async function saveChatTurn(env,{message,reply,kind,createdAt,threadId=null}){
  if(threadId!==null)await requireThread(env,threadId);
  const db=requireDb(env);
  if(threadId!==null)await db.prepare('INSERT INTO manager_chat(message,reply,kind,created_at,thread_id) VALUES(?,?,?,?,?)').bind(message,reply,kind,createdAt,threadId).run();
  else await db.prepare('INSERT INTO manager_chat(message,reply,kind,created_at) VALUES(?,?,?,?)').bind(message,reply,kind,createdAt).run();
}
// Accept documented chat completions and legacy Workers binding response shapes.
export function modelText(result){
 const content=result?.choices?.[0]?.message?.content;
 const text=typeof content==='string'?content:typeof result?.response==='string'?result.response:null;
 return text?.trim()||null;
}
export function safeModelFailure(error){
 const code=String(error?.code??'');
 const message=String(error?.message??'');
 for(const known of ['5035','5028','3040','3036','4001','4002','4003','429','401','403','503'])if(code===known||new RegExp('(?:^|[^0-9])'+known+'(?:[^0-9]|$)').test(message))return 'PROVIDER_'+known;
 return 'PROVIDER_REQUEST_FAILED';
}
export async function managerChat(env,payload,{health=checkRoleHealth}={}) {
  const message=parseMessage(payload),threadId=payload.threadId??null;
  if(threadId!==null)await requireThread(env,threadId);
  const db=requireDb(env);
  const intent=classifyMessage(message);
  let reply,kind='verified-record',aiFailure=null;
  if(intent==='status'){
    reply='The authenticated staging Manager is responding. Its D1 database is available. Live customer operations, publication and payments are disabled. Ask "check agents" for verified role health or "recent jobs" for recorded activity.';
  }else if(intent==='jobs'){
    const jobs=await listJobs(db);
    reply=jobs.length?'Recent recorded staging jobs (not proof of ongoing activity):\n'+jobs.slice(0,10).map(j=>[j.created_at,j.role+'/'+j.action,j.project_id].join(' — ')).join('\n'):'No staging job records found.';
  }else if(intent==='agents'){
    const result=await health(env);
    reply=result.liveRolesVerified+' of '+result.totalRoles+' role health endpoints verified. Health alone does not prove AI inference or task execution.\n'+result.results.map(x=>x.agent+': '+(x.verified?'health verified':'not verified')).join('\n');
  }else if(intent==='github-status'||intent==='github-task-status'){
    try{
      if(intent==='github-status'){
        const report=await githubDevelopmentReport(env);
        reply=report.configured?'GitHub development branch read verified. Latest workflow records (not coding-agent execution):\n'+(report.runs.map(r=>r.name+' — '+r.status+' / '+(r.conclusion||'pending')).join('\n')||'No workflow runs returned.'): 'GitHub Manager credential is not configured. No live GitHub Agent connection verified.';
      }else{
        const task=await githubTaskStatus(env,Number(message.match(/[0-9]+/)[0]));
        reply='GitHub development issue #'+task.number+' — '+task.state+'. Issue state alone does not prove code changes or completed tests.';
      }
    }catch{kind='unavailable';reply='GitHub could not be verified. No task execution or status is claimed.';}
  }else{
    kind='unavailable';
    reply='Natural-language AI is not connected yet. I have not assigned or executed your instruction. You can use the agent controls for supported staging jobs, or ask "status", "recent jobs" or "check agents". No website is released without independent final-build QA.';
    // Opt-in only. Provider account free-tier confirmation is a separate
    // hosting-side gate. This app cap is not a guarantee of account-wide quota.
    if(managerModelReadiness(env).enabled){
      const day=new Date().toISOString().slice(0,10);
      const reservation=await db.prepare('INSERT INTO manager_chat_quota(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<10').bind(day).run();
      if(reservation.meta?.changes===1){
        try{
          // Only the last three advice exchanges are sent, each bounded. Stored
          // status/command records are never supplied as model instructions.
          const prior=await scopedChat(db,env,threadId,"SELECT message,reply FROM manager_chat WHERE kind='ai-advice' /*scope*/ ORDER BY id DESC LIMIT 3").all();
          const conversation=(prior.results||[]).reverse().flatMap(t=>[
            {role:'user',content:String(t.message).slice(0,800)},
            {role:'assistant',content:String(t.reply).slice(0,1000)}
          ]);
          const result=await env.AI.run(env.MANAGER_CHAT_MODEL,{messages:[
            {role:'system',content:'You are MapleWeb AI Manager in private staging. Give concise planning advice only. You have no tools and cannot execute jobs, confirm live agent status, publish, contact customers or process payments. Never claim completion or request credentials. For actual status, direct the owner to status, recent jobs or check agents. Website delivery requires independent exact-build QA.'},
            ...conversation,{role:'user',content:message}],max_completion_tokens:512,stream:false,store:false,temperature:0.3,chat_template_kwargs:{enable_thinking:false}});
          const output=modelText(result);
          if(!output){aiFailure=result?.choices?.[0]?.finish_reason==='length'?'EMPTY_LENGTH_LIMIT':'EMPTY_MODEL_TEXT';throw Error('No supported model text');}
          reply='AI planning advice — no job executed:\n'+output.trim().slice(0,2400);
          kind='ai-advice';
        }catch(error){
          aiFailure=aiFailure||safeModelFailure(error);
          reply='The configured AI model did not return a usable response ('+aiFailure+'). No job was executed. The reserved request remains counted against the daily limit.';
          kind='unavailable';
        }
      }else reply='The Manager chat daily allowance is exhausted or cannot be confirmed. No AI request or job was executed.';
    }
  }
  const createdAt=new Date().toISOString();
  await saveChatTurn(env,{message,reply,kind,createdAt,threadId});
  return {message,reply,kind,created_at:createdAt,jobExecuted:false,...(aiFailure?{aiFailure}:{})};
}
