// GitHub setup and dev-only write adapter. Can never authorize an account itself.
import {bad} from './security.mjs';
const REPO='maplewebai/mapleweb-ai-website';
const DEV='mapleweb-ai-agents';
const API='https://api.github.com';
const headers=(token)=>({'accept':'application/vnd.github+json','authorization':`Bearer ${token}`,
  'x-github-api-version':'2022-11-28','user-agent':'MapleWeb-AI-Manager-Staging'});
async function gh(env,path,opts={}){
  if(!env.GITHUB_TOKEN)throw bad('GITHUB_ACCESS_NOT_CONFIGURED: an authorized GitHub token is required',503);
  const r=await fetch(API+path,{...opts,headers:{...headers(env.GITHUB_TOKEN),...(opts.headers||{})}});
  const obj=await r.json().catch(()=>({}));
  if(!r.ok){const e=bad(`GitHub ${r.status}: ${String(obj.message||'API request failed').slice(0,170)}`,r.status===401||r.status===403?503:502);e.githubStatus=r.status;throw e;}
  return obj;
}
export async function diagnoseGitHub(env){
  if(!env.GITHUB_TOKEN)return {configured:false,repository:REPO,developmentBranch:DEV,writeVerified:false,reason:'Token missing'};
  const repo=await gh(env,`/repos/${REPO}`);
  const branch=await gh(env,`/repos/${REPO}/branches/${DEV}`);
  return {configured:true,repository:REPO,developmentBranch:DEV,branchFound:!!branch.name,
    authenticatedReadVerified:true,reportedPermissions:repo.permissions||null,writeVerified:false,
    note:'Read-only diagnostics do not prove write access; a successful dev-branch commit is required'};
}
export async function createManagerIssue(env,{title,body}){
  if(typeof title!=='string'||!/^MapleWeb Manager: /.test(title)||title.length>120)throw bad('Manager issue title must start with "MapleWeb Manager: "');
  if(typeof body!=='string'||body.length>8000||body.length<20)throw bad('Invalid issue body');
  const obj=await gh(env,`/repos/${REPO}/issues`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,body})});
  return {created:true,url:obj.html_url,number:obj.number};
}
function base64(text){const b=new TextEncoder().encode(text);let s='';for(const part of Array.from({length:Math.ceil(b.length/8192)},(_,i)=>b.slice(i*8192,(i+1)*8192)))s+=String.fromCharCode(...part);return btoa(s);}
export async function upsertDevFile(env,{path,content,message}){
  if(typeof path!=='string'||!/^agents\/(manager|developer)\/[A-Za-z0-9_./-]+\.(?:mjs|js|json|md|sql|txt)$/.test(path)||path.includes('..')||path.includes('//'))
    throw bad('Only safe files under agents/manager or agents/developer are allowed');
  if(typeof content!=='string'||content.length>60000||content.length<1)throw bad('Invalid file size');
  if(typeof message!=='string'||message.length<8||message.length>140)throw bad('Commit message length invalid');
  // The branch is fixed here. Neither caller nor env may change it to main.
  let sha;
  try{const current=await gh(env,`/repos/${REPO}/contents/${path}?ref=${DEV}`);sha=current.sha;}
  catch(e){if(e.githubStatus!==404)throw e;}
  const body={message,branch:DEV,content:base64(content)};
  if(sha)body.sha=sha;
  const changed=await gh(env,`/repos/${REPO}/contents/${path}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return {changed:true,path,branch:DEV,commitSha:changed.commit?.sha||null,mainChanged:false};
}
export const githubConfig={repository:REPO,devBranch:DEV};

/** Fixed-repository development coordination. No merges, deployment or source changes. */
export async function githubDevelopmentReport(env){
 if(!env.GITHUB_TOKEN)return {configured:false,repository:REPO,developmentBranch:DEV,runs:[],reason:'GitHub credential not configured in Manager'};
 const diagnostic=await diagnoseGitHub(env);
 const data=await gh(env,`/repos/${REPO}/actions/runs?branch=${DEV}&per_page=5`);
 return {...diagnostic,runs:(data.workflow_runs||[]).slice(0,5).map(r=>({
   id:r.id,name:String(r.name||'').slice(0,120),status:r.status,conclusion:r.conclusion||null,
   commit:String(r.head_sha||'').slice(0,12),updatedAt:r.updated_at
 }))};
}
export async function githubTaskStatus(env,number){
 if(!Number.isSafeInteger(number)||number<1||number>999999999)throw bad('Invalid development task number');
 const issue=await gh(env,`/repos/${REPO}/issues/${number}`);
 if(issue.pull_request)throw bad('Not a development issue',404);
 if(!String(issue.title||'').startsWith('MapleWeb Manager: '))throw bad('Not a Manager-created development task',404);
 return {number:issue.number,state:issue.state,title:String(issue.title).slice(0,120),updatedAt:issue.updated_at};
}
export async function assignGitHubDevelopmentTask(env,{id,instruction}){
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw bad('Invalid task ID');
 if(typeof instruction!=='string'||instruction.length<10||instruction.length>500)throw bad('Development instruction must be 10–500 characters');
 // Never send a private chat instruction to a public repository issue.
 const repo=await gh(env,`/repos/${REPO}`);
 if(repo.private!==true)return {created:false,blocked:true,reason:'PUBLIC_REPOSITORY_PRIVATE_INSTRUCTION_BLOCKED'};
 return createManagerIssue(env,{
  title:'MapleWeb Manager: development request '+id.slice(0,8),
  body:'Owner-approved development request.\n\nScope: mapleweb-ai-agents only. Do not modify main or public website, spend money, publish customer websites, enable payment or contact customers. Run tests and report results. This issue is a task record, not proof that a coding executor is running.\n\nInstruction:\n'+instruction+'\n\nManager task ID: '+id
 });
}
