// MapleWeb AI rebuilt Manager. Isolated staging; no production publication or payments.
import {ROLES,PRICES_CAD} from './roles.mjs';
import {runStagingRole,remoteRoleState} from './remote.mjs';
import {bad,readJson,requireOwner,validateSynthetic,idIsSafe} from './security.mjs';
import {project,saveProject,saveJob,fetchJob,listJobs,audit,requireDb} from './store.mjs';
import {diagnoseGitHub,createManagerIssue,upsertDevFile,githubConfig} from './github.mjs';
import {inspectCloudflare,checkRoleHealth} from './cloudflare.mjs';
import {rejectHeadquartersAvailabilityChange} from './site-protection.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json;charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-frame-options':'DENY',
  'referrer-policy':'no-referrer','content-security-policy':"default-src 'none';frame-ancestors 'none'"}});
const methodError=()=>json({error:'Not found or method not allowed'},404);
const projectView=p=>p?{id:p.id,version:p.version,qaPassed:p.qa_passed===1,
  revisionOpen:p.revision_open===1,ownerApprovedVersion:p.owner_approved||null,
  customerApprovedVersion:p.customer_approved||null,
  publication:'DISABLED'}:null;
export const defaultProject=(id,old=null)=>({id,version:old?.version||0,draft_html:old?.draft_html||'',
  qa_passed:0,revision_open:0,owner_approved:0,customer_approved:0});
export async function handle(request,env){
  const u=new URL(request.url);const path=u.pathname;
  if(path==='/health'&&request.method==='GET')return json({service:'mapleweb-manager-rebuilt',
    mode:'staging',deployedWorkerResponding:true,managerReady:!!env.DB&&!!env.MANAGER_OWNER_TOKEN,
    roleDefinitions:8,roleWorkersVerified:0,publishingEnabled:false,paymentsEnabled:false,
    note:'Staging endpoint health is not proof that eight remote agents are running'});
  if(path==='/health')return methodError();
  await requireOwner(request,env);
  if(path==='/api/status'&&request.method==='GET')return json({manager:'website-manager',mode:'staging',
    storageReady:!!env.DB,roles:ROLES.map(id=>({id,defined:true,remoteVerified:false})),
    remoteDispatch:remoteRoleState(env),
    github:{...githubConfig,credentialConfigured:!!env.GITHUB_TOKEN,writeVerified:false},
    cloudflare:{inspectorConfigured:!!env.CLOUDFLARE_READ_TOKEN},
    paymentsEnabled:false,publishEnabled:false,realCustomerInputAllowed:false,
    headquartersProtection:{automaticShutdownAllowed:false,ownerApprovalRequired:true,
      ownerApprovalVerifierConnected:false,siteOperationsAvailable:false}});
  // Explicit headquarters operation endpoint: fail closed. Even an authenticated
  // Manager user cannot use a client-supplied approval flag to take HQ offline.
  if(path==='/api/sites/headquarters/operations'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    rejectHeadquartersAvailabilityChange(p.action);
  }
  if(path==='/api/roles'&&request.method==='GET')return json({roles:ROLES,pricesCAD:PRICES_CAD});
  if(path==='/api/integrations/github'&&request.method==='GET')return json(await diagnoseGitHub(env));
  if(path==='/api/integrations/cloudflare'&&request.method==='GET')return json(await inspectCloudflare(env));
  if(path==='/api/integrations/agents-health'&&request.method==='GET')return json(await checkRoleHealth(env));
  if(path==='/api/github/create-manager-task'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    const created=await createManagerIssue(env,{title:p.title,body:p.body});
    if(env.DB)await audit(env.DB,'github-issue-created',String(created.number));
    return json(created,201);
  }
  if(path==='/api/github/upload-dev-file'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request,65000));
    if(p.confirmDevelopmentBranchOnly!==true)throw bad('Explicit development-only confirmation required');
    const changed=await upsertDevFile(env,p);
    if(env.DB)await audit(env.DB,'github-dev-file',changed.path);
    return json(changed,200);
  }
  if(path==='/api/jobs'&&request.method==='GET')return json({jobs:await listJobs(requireDb(env))});
  if(path==='/api/jobs'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    if(!idIsSafe(p.projectId))throw bad('Project ID must be 3–30 uppercase characters, digits, - or _');
    const db=requireDb(env);
    const prev=await project(db,p.projectId);
    const current=prev||defaultProject(p.projectId);
    let input=p.input||{};
    // QA always checks the Manager's saved preview, not untrusted QA-passed claims.
    if(p.role==='quality-checker'&&p.action==='review'){
      if(!current.version)throw bad('Build a staging draft first');
      input={html:current.draft_html};
    }
    const ctx={nextVersion:current.version+1,currentVersion:current.version,
      qaPassed:current.qa_passed===1,revisionOpen:current.revision_open===1,
      ownerApprovedVersion:current.owner_approved,customerApprovedVersion:current.customer_approved};
    if(p.role==='website-developer'&&p.action==='request-revision'&&!current.version)throw bad('No existing draft to revise');
    const result=await runStagingRole(env,p.role,p.action,input,ctx);
    if(p.role==='website-developer'&&p.action==='build-draft'){
      current.version=result.version;current.draft_html=result.html;
      current.qa_passed=0;current.revision_open=0;current.owner_approved=0;current.customer_approved=0;
      await saveProject(db,current);
    }else if(p.role==='website-developer'&&p.action==='request-revision'){
      current.revision_open=1;current.qa_passed=0;current.owner_approved=0;current.customer_approved=0;
      await saveProject(db,current);
    }else if(p.role==='quality-checker'&&p.action==='review'){
      current.qa_passed=result.status==='LOCAL_QA_PASSED'&&current.revision_open===0?1:0;
      await saveProject(db,current);
    }
    const id=crypto.randomUUID();
    await saveJob(db,{id,projectId:p.projectId,role:p.role,action:p.action,input,result});
    await audit(db,'synthetic-job',`${p.role}/${p.action} on ${p.projectId}`);
    return json({jobId:id,project:projectView(await project(db,p.projectId)),result},201);
  }
  const matchJob=path.match(/^\/api\/jobs\/([0-9a-f-]{36})$/);
  if(matchJob&&request.method==='GET'){
    const item=await fetchJob(requireDb(env),matchJob[1]);
    if(!item)return json({error:'Not found'},404);
    return json({id:item.id,projectId:item.project_id,role:item.role,action:item.action,
      result:JSON.parse(item.result_json),createdAt:item.created_at});
  }
  const matchProject=path.match(/^\/api\/projects\/([A-Z0-9_-]{3,30})$/);
  if(matchProject&&request.method==='GET'){
    const p=await project(requireDb(env),matchProject[1]);
    if(!p)return json({error:'Unknown project'},404);
    return json({project:projectView(p)});
  }
  const matchApproval=path.match(/^\/api\/projects\/([A-Z0-9_-]{3,30})\/simulate-approval$/);
  if(matchApproval&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    if(!['owner','customer'].includes(p.role))throw bad('Unknown approval role');
    const db=requireDb(env);const item=await project(db,matchApproval[1]);
    if(!item)throw bad('Unknown project');
    if(p.version!==item.version || item.qa_passed!==1 || item.revision_open!==0)
      throw bad('Current-version QA required, no open revisions');
    // Tests only: owner/customer identity is not verified here. No publish adapter exists.
    if(p.role==='owner')item.owner_approved=item.version;
    else item.customer_approved=item.version;
    await saveProject(db,item);
    await audit(db,'synthetic-approval',`${p.role} for ${item.id} v${item.version}`);
    return json({status:'SIMULATED_APPROVAL_ONLY',project:projectView(item),publishAuthorized:false});
  }
  return methodError();
}
export default {async fetch(request,env){
  try{return await handle(request,env||{});}catch(e){
    const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:500;
    return json({error:status===500?'Internal error':String(e.message).slice(0,220)},status);
  }
}};
