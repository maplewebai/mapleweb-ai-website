// Shared curated knowledge and bounded deterministic tools. No arbitrary execution.
import {bad,validateSynthetic} from './security.mjs';
import {requireDb} from './store.mjs';
const terms=s=>new Set(String(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
const stop=new Set('the and for with from this that what how can you your about are was were will would should could have has had please help me tell use using'.split(' '));
const safeText=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
export async function knowledgeList(env){
 const rows=await requireDb(env).prepare('SELECT id,title,source,created_at FROM hq_knowledge ORDER BY created_at DESC,id DESC LIMIT 100').all();
 return {items:rows.results||[],limit:100,scope:'shared by all agents; owner-curated, not verified external facts'};
}
export async function addKnowledge(env,p){
 validateSynthetic(p);
 if(Object.keys(p).sort().join(',')!=='body,source,synthetic,title'||!safeText(p.title,100)||!safeText(p.body,4000)||!safeText(p.source,200))throw bad('Enter a title (1–100), knowledge (1–4000) and source (1–200)');
 const title=p.title.trim(),body=p.body.trim(),source=p.source.trim();
 if(/\b(?:password|api key|access token|secret|verification code|credit card|bank account)\b/i.test(title+' '+body+' '+source))throw bad('Never store credentials or payment details');
 const id=crypto.randomUUID();
 const w=await requireDb(env).prepare('INSERT OR IGNORE INTO hq_knowledge(id,title,body,source,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM hq_knowledge)<100').bind(id,title,body,source,new Date().toISOString()).run();
 if(w.meta?.changes!==1)throw bad('Title already exists or library limit reached',409);
 return {id,title,source,stored:true};
}
export async function readKnowledge(env,id){
 const row=await requireDb(env).prepare('SELECT id,title,body,source,created_at FROM hq_knowledge WHERE id=?').bind(id).first();
 if(!row)throw bad('Knowledge entry not found',404);
 return row;
}
export async function deleteKnowledge(env,id){
 const w=await requireDb(env).prepare('DELETE FROM hq_knowledge WHERE id=?').bind(id).run();
 if(w.meta?.changes!==1)throw bad('Knowledge entry not found',404);
 return {deleted:true,note:'Earlier chat copies may remain'};
}
export async function searchKnowledge(env,query,limit=3){
 const q=[...terms(query)].filter(x=>!stop.has(x));
 if(!q.length)return [];
 const rows=(await requireDb(env).prepare('SELECT id,title,body,source FROM hq_knowledge ORDER BY created_at DESC,id DESC LIMIT 100').all()).results||[];
 return rows.map(r=>{const title=terms(r.title),body=terms(r.body);const score=q.reduce((n,k)=>n+(title.has(k)?4:0)+(body.has(k)?1:0),0);return {...r,score}}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(({score,...r})=>({...r,body:r.body.slice(0,1000)}));
}
// Recursive descent, not eval/Function. Only decimal arithmetic and parentheses.
export function calculate(expression){
 if(typeof expression!=='string'||expression.length>160||!/^[\d\s.+*/()%-]+$/.test(expression))throw bad('Calculator accepts numbers, parentheses and + - * / % only');
 const s=expression.replace(/\s+/g,''),tokens=s.match(/\d+(?:\.\d+)?|\.\d+|[+*/()%\-]/g)||[];
 if(!tokens.length||tokens.join('')!==s||tokens.length>100)throw bad('Invalid calculation');
 let i=0;
 function atom(depth){
  if(depth>20)throw bad('Calculation too deeply nested');
  const t=tokens[i++];
  if(t==='+'||t==='-')return (t==='-'?-1:1)*atom(depth+1);
  if(t==='('){const n=sum(depth+1);if(tokens[i++]!==')')throw bad('Missing closing parenthesis');return n;}
  if(!t||!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(t))throw bad('Expected a number');
  return Number(t);
 }
 function product(depth){let n=atom(depth);while(['*','/','%'].includes(tokens[i])){const op=tokens[i++],r=atom(depth);if((op==='/'||op==='%')&&r===0)throw bad('Division by zero');n=op==='*'?n*r:op==='/'?n/r:n%r;}return n;}
 function sum(depth){let n=product(depth);while(['+','-'].includes(tokens[i])){const op=tokens[i++],r=product(depth);n=op==='+'?n+r:n-r;}return n;}
 const result=sum(0);
 if(i!==tokens.length||!Number.isFinite(result)||Math.abs(result)>1e15)throw bad('Calculation invalid or outside safe numeric range');
 return Number(result.toPrecision(14));
}
export function capabilityReport(env){
 return {model:env.MANAGER_CHAT_MODEL||null,modelConfigured:typeof env.AI?.run==='function'&&env.MANAGER_CHAT_FREE_CONFIRMED==='true'&&env.MANAGER_CHAT_AI_ENABLED==='true',knowledge:'OWNER_CURATED_RETRIEVAL',memory:'PERSISTENT_AGENT_NOTES_AND_WORK_OUTCOMES',tools:['calculator','knowledge lookup','agent status','internal mail','approved staging jobs'],taskExecution:'ALLOWLISTED_REMOTE_STAGING',browser:'NOT_VERIFIED',virtualComputer:'NOT_CONNECTED',externalEmail:'NOT_CONNECTED',modelTraining:'NOT_PERFORMED',paidFallback:false,publishing:false};
}
export async function intelligenceInstruction(env,message){
 const m=message.trim();
 if(/^(?:show (?:hq |system )?capabilities|what tools are available)[?.!]*$/i.test(m)){
  const c=capabilityReport(env);
  return {reply:'HQ intelligence and tools:\nModel: '+(c.modelConfigured?c.model+' (configured; actual inference subject to provider quota)':'not configured')+'\nShared knowledge library, persistent agent notes, work outcomes, calculator, internal mail and supported remote staging jobs.\nGeneral web browser, virtual computer and external email are not verified or connected. No model retraining, paid fallback or publication.'};
 }
 const calc=m.match(/^calculate:\s*(.+)$/i);
 if(calc)return {reply:'Calculator result: '+calc[1]+' = '+calculate(calc[1])};
 const find=m.match(/^search knowledge:\s*(.{1,200})$/i);
 if(find){
  const rows=await searchKnowledge(env,find[1]);
  return {reply:rows.length?'Matching owner-provided knowledge (not independently verified):\n'+rows.map(r=>r.title+' — Source: '+r.source+'\n'+r.body).join('\n\n'):'No matching shared knowledge was found.'};
 }
 return null;
}
