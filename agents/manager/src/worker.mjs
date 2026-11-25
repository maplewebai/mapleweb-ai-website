// MapleWeb AI rebuilt Manager. Isolated staging; no production publication or payments.
import {ROLES,PRICES_CAD} from './roles.mjs';
import {runStagingAutomation} from './staging-automation.mjs';
import {runStagingRole,remoteRoleState} from './remote.mjs';
import {bad,readJson,requireOwner,validateSynthetic,idIsSafe} from './security.mjs';
import {project,saveProject,saveJob,fetchJob,listJobs,audit,requireDb} from './store.mjs';
import {diagnoseGitHub,createManagerIssue,upsertDevFile,githubConfig} from './github.mjs';
import {inspectCloudflare,checkRoleHealth} from './cloudflare.mjs';
import {createKimiModelApi} from './kimi-model-api.mjs';
import {stripeTestStatus,createStripeTestCheckout,receiveStripeTestWebhook} from './stripe-test.mjs';
import {newBusinessCase,applyOwnerCaseEvent,caseCapabilities} from './business-cases.mjs';
import {createCaseStagingDraft} from './case-staging-draft.mjs';
import {auditSyntheticSitePreview} from './synthetic-site-preview.mjs';
import {readBusinessCase,addBusinessCase,updateBusinessCase,listBusinessCases} from './business-cases-store.mjs';
import {rejectHeadquartersAvailabilityChange,rejectUnapprovedCustomerSuspension} from './site-protection.mjs';
import {callingSalesState,callingSalesStatus,callingSalesAction} from './calling-sales.mjs';
import {planningChat,planningBriefForCase} from './planning-chat.mjs';
import {privateBusinessDashboard} from './business-dashboard.mjs';
import {managerBusinessReadiness} from './business-readiness.mjs';
import {buildFictionalSiteBundle,auditFictionalSiteBundle} from './fictional-site-bundle.mjs';
import {submitFictionalOrder,ownerFictionalOrderProgress} from './fictional-order-intake.mjs';
import {parsePrivateOrderQueueQuery,listPrivateFictionalOrders} from './private-order-queue.mjs';
import {fictionalKimiBriefReadiness} from './kimi-planning-brief.mjs';
import {fictionalQualityReport} from './fictional-quality-report.mjs';
import {WEBSITE_DELIVERY_POLICY,deliveryPolicyForProject} from './website-delivery-policy.mjs';
import {serveControlCenter} from './control-center.mjs';
import {controlAsset} from './control-install.mjs';
import {managerChat,chatHistory,parseMessage} from './manager-chat.mjs';
import {parseCommand,proposeCommand,listCommands,decideCommand,setRoleControl,requireRoleRunning} from './manager-commands.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json;charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-frame-options':'DENY',
  'referrer-policy':'no-referrer','content-security-policy':"default-src 'none';frame-ancestors 'none'"}});
const methodError=()=>json({error:'Not found or method not allowed'},404);
const projectView=p=>p?{id:p.id,version:p.version,qaPassed:p.qa_passed===1,
  revisionOpen:p.revision_open===1,ownerApprovedVersion:p.owner_approved||null,
  customerApprovedVersion:p.customer_approved||null,
  publication:'DISABLED',delivery:deliveryPolicyForProject(p)}:null;
export const defaultProject=(id,old=null)=>({id,version:old?.version||0,draft_html:old?.draft_html||'',
  qa_passed:0,revision_open:0,owner_approved:0,customer_approved:0});
export async function handle(request,env,callingFetchImpl=fetch){
  const u=new URL(request.url);const path=u.pathname;
  const asset=controlAsset(path,request.method);if(asset)return asset;
  if(path==='/control'&&request.method==='GET')return serveControlCenter();
  if(path==='/control')return methodError();
  if(path==='/health'&&request.method==='GET')return json({service:'mapleweb-manager-rebuilt',
    mode:'staging',deployedWorkerResponding:true,managerReady:!!env.DB&&!!env.MANAGER_OWNER_TOKEN,
    roleDefinitions:8,roleWorkersVerified:0,publishingEnabled:false,paymentsEnabled:false,
    note:'Staging endpoint health is not proof that eight remote agents are running'});
  if(path==='/health')return methodError();
  // Stripe signs webhook requests: verify raw signed payload before any update.
  // It is the only unauthenticated API route, and is TEST-ONLY.
  if(path==='/api/payments/test-webhook'&&request.method==='POST')
    return json(await receiveStripeTestWebhook(env,request));
  await requireOwner(request,env);
  if(path==='/api/manager/chat'&&request.method==='GET')return json(await chatHistory(env));
  if(path==='/api/manager/chat'&&request.method==='POST'){
    const payload=await readJson(request,3800);
    const message=parseMessage(payload);
    const command=parseCommand(message);
    if(command){
      const proposal=await proposeCommand(env,command);
      const reply='Task saved for owner approval: '+proposal.role+'/'+proposal.action+' on '+proposal.projectId+'. Nothing has been executed. Approve or reject it in Pending tasks.';
      const createdAt=new Date().toISOString();
      await requireDb(env).prepare('INSERT INTO manager_chat(message,reply,kind,created_at) VALUES(?,?,?,?)').bind(message,reply,'verified-record',createdAt).run();
      return json({message,reply,kind:'verified-record',created_at:createdAt,jobExecuted:false,proposal},201);
    }
    return json(await managerChat(env,payload),201);
  }
  if(path==='/api/manager/commands'&&request.method==='GET')return json(await listCommands(env));
  const commandDecision=path.match(/^\/api\/manager\/commands\/([0-9a-f-]{36})\/decision$/);
  if(commandDecision&&request.method==='POST')return json(await decideCommand(env,commandDecision[1],await readJson(request,300),{dispatch:handle}));
  const roleControl=path.match(/^\/api\/manager\/roles\/([a-z-]+)\/control$/);
  if(roleControl&&request.method==='POST')return json(await setRoleControl(env,roleControl[1],await readJson(request,300)));
  if(path==='/api/manager/chat')return methodError();
  if(path==='/api/automation/status'&&request.method==='GET')
    return json({mode:'staging',syntheticOnly:true,enabled:env.SYNTHETIC_AUTOMATION_ENABLED==='true',
      cronUTC:'0 14 * * *',roles:8,customerContactEnabled:false,
      paidAIEnabled:false,paymentsEnabled:false,realPublishingEnabled:false});
  if(path==='/api/automation/run'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request,600));
    if(p.action!=='daily-demo')throw bad('Only the safe daily staging demo is available');
    return json(await runStagingAutomation(env,{scheduledTime:Date.now(),handleJob:handle}),201);
  }
  if(path==='/api/business/readiness'&&request.method==='GET')
    return json(managerBusinessReadiness(env));
  if(path==='/api/payments/test-status'&&request.method==='GET')
    return json(stripeTestStatus(env));
  if(path==='/api/payments/test-checkout'&&request.method==='POST'){
    const payload=await readJson(request,2000);
    return json(await createStripeTestCheckout(env,payload),201);
  }
  if(path==='/api/status'&&request.method==='GET')return json({manager:'website-manager',mode:'staging',
    storageReady:!!env.DB,roles:ROLES.map(id=>({id,defined:true,remoteVerified:false})),
    remoteDispatch:remoteRoleState(env),
    github:{...githubConfig,credentialConfigured:!!env.GITHUB_TOKEN,writeVerified:false},
    cloudflare:{inspectorConfigured:!!env.CLOUDFLARE_READ_TOKEN},
    callingSales:callingSalesState(env),
    paymentsEnabled:false,publishEnabled:false,realCustomerInputAllowed:false,
    websiteDelivery:WEBSITE_DELIVERY_POLICY,
    headquartersProtection:{automaticShutdownAllowed:false,ownerApprovalRequired:true,
      ownerApprovalVerifierConnected:false,siteOperationsAvailable:false},
    customerSiteProtection:{automaticSuspensionAllowed:false,ownerApprovalRequired:true,
      ownerApprovalVerifierConnected:false,siteOperationsAvailable:false}});
  // All calling controls are owner-authenticated. The Manager never stores
  // telephone numbers, and explicit hosting-side approval gates every outbound call.
  if(path==='/api/integrations/calling'&&request.method==='GET'){
    const state=callingSalesState(env);
    return json({...state,remote:state.enabled&&state.configured?
      await callingSalesStatus(env,callingFetchImpl):null});
  }
  const callingAction=path.match(/^\/api\/integrations\/calling\/(consent|suppress|outbound)$/);
  if(callingAction&&request.method==='POST'){
    const input=await readJson(request,1200);
    return json(await callingSalesAction(env,callingAction[1],input,callingFetchImpl),
      callingAction[1]==='suppress'?200:201);
  }
  // Explicit headquarters operation endpoint: fail closed. Even an authenticated
  // Manager user cannot use a client-supplied approval flag to take HQ offline.
  if(path==='/api/sites/headquarters/operations'&&request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    rejectHeadquartersAvailabilityChange(p.action);
  }
  // Customer nonpayment and a forged boolean approval never permit a takedown.
  // Real owner authorization and site-specific hosting controls are not built.
  const customerAvailability=path.match(/^\/api\/sites\/customers\/([A-Z0-9_-]{3,30})\/operations$/);
  if(customerAvailability && request.method==='POST'){
    const p=validateSynthetic(await readJson(request));
    rejectUnapprovedCustomerSuspension(p.action);
  }
  // Owner-only fictional planning chat. Predefined selections only, no free text,
  // customer contact information, AI spend, or persistence of conversations.
  if(path==='/api/business/planning-chat'&&request.method==='POST')
    return json(planningChat(await readJson(request,1800)));
  if(path==='/api/business/dashboard'&&request.method==='GET'){
    if(env.BUSINESS_CASES_ENABLED!=='true')
      throw bad('Private business-case operations are not enabled',503);
    return json(await privateBusinessDashboard(env));
  }
  if(path==='/api/business/orders/queue'&&request.method==='GET'){
    if(env.BUSINESS_CASES_ENABLED!=='true')throw bad('Private case tracking disabled',503);
    const filters=parsePrivateOrderQueueQuery(u.search);
    return json(await listPrivateFictionalOrders(env,filters));
  }
  if(path==='/api/business/orders/synthetic-intake'&&request.method==='POST'){
    return json(await submitFictionalOrder(env,await readJson(request,2000)),201);
  }
  const ownerOrderPath=path.match(/^\/api\/business\/orders\/([A-Z0-9_-]{3,30})\/progress$/);
  if(ownerOrderPath&&request.method==='GET'){
    if(env.BUSINESS_CASES_ENABLED!=='true')throw bad('Private case tracking disabled',503);
    requireDb(env);
    const item=await readBusinessCase(env,ownerOrderPath[1]);
    if(!item)return json({error:'Fictional case not found'},404);
    const saved=await project(env.DB,ownerOrderPath[1]);
    return json(ownerFictionalOrderProgress(item,saved));
  }
  // Business-case API stores non-personal metadata in a private D1 only.
  // Explicit opt-in is required even on staging; no customer communications,
  // Kimi calls, payments, or publishing can be triggered by these routes.
  if(path==='/api/business/cases'||path.startsWith('/api/business/cases/')){
    if(env.BUSINESS_CASES_ENABLED!=='true')
      throw bad('Private business-case operations are not enabled',503);
    requireDb(env);
    if(path==='/api/business/cases'&&request.method==='GET')
      return json({cases:await listBusinessCases(env),externalActionsEnabled:false});
    if(path==='/api/business/cases'&&request.method==='POST'){
      const record=newBusinessCase(await readJson(request,2000));
      await addBusinessCase(env,record);
      await audit(env.DB,'business-case-created',record.caseId);
      return json({case:caseCapabilities(record)},201);
    }
    const casePath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})$/);
    if(casePath&&request.method==='GET'){
      const record=await readBusinessCase(env,casePath[1]);
      return record?json({case:caseCapabilities(record)}):json({error:'Case not found'},404);
    }
    const eventPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/events$/);
    if(eventPath&&request.method==='POST'){
      const payload=await readJson(request,2000);
      if(!Number.isSafeInteger(payload.expectedRevision)||payload.expectedRevision<1)
        throw bad('Current case revision is required');
      const existing=await readBusinessCase(env,eventPath[1]);
      if(!existing)return json({error:'Case not found'},404);
      if(existing.revision!==payload.expectedRevision)
        throw bad('Case changed; reload before editing',409);
      const {expectedRevision,...event}=payload;
      const updated=applyOwnerCaseEvent(existing,event);
      await updateBusinessCase(env,existing,updated);
      await audit(env.DB,'business-case-event',event.type+' on '+existing.caseId);
      return json({case:caseCapabilities(updated)});
    }
    const importPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/import-fictional-plan$/);
    if(importPath&&request.method==='POST'){
      const brief=planningBriefForCase(await readJson(request,1800));
      const existing=await readBusinessCase(env,importPath[1]);
      if(!existing)return json({error:'Case not found'},404);
      if(existing.revision!==brief.expectedRevision)
        throw bad('Case changed; reload before editing',409);
      const updated=applyOwnerCaseEvent(existing,
        {type:'set-website-requirements',requirements:brief.requirements});
      await updateBusinessCase(env,existing,updated);
      await audit(env.DB,'fictional-planning-brief-imported',existing.caseId);
      return json({case:caseCapabilities(updated),
        note:'Only predefined fictional website choices were stored. No customer acceptance, build authorization or payment.'});
    }
    // Read-only structural coverage audit against the saved fictional preview.
    // This is not browser QA, real feature verification, approval or publication.
    const previewAuditPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/preview-audit$/);
    if(previewAuditPath&&request.method==='GET'){
      const existing=await readBusinessCase(env,previewAuditPath[1]);
      if(!existing)return json({error:'Case not found'},404);
      const saved=await project(env.DB,existing.caseId);
      if(!saved)return json({error:'Fictional preview not found'},404);
      const check=auditSyntheticSitePreview(saved.draft_html,existing.requirements);
      return json({caseId:existing.caseId,projectVersion:saved.version,
        localQaPreviouslyRecorded:saved.qa_passed===1,
        ...check});
    }
    const qualityPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/quality-report$/);
    if(qualityPath&&request.method==='GET'){
      const record=await readBusinessCase(env,qualityPath[1]);
      if(!record)return json({error:'Case not found'},404);
      const saved=await project(env.DB,record.caseId);
      return json(fictionalQualityReport(record,saved));
    }
    const kimiBriefPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/kimi-brief$/);
    if(kimiBriefPath&&request.method==='GET'){
      const existing=await readBusinessCase(env,kimiBriefPath[1]);
      if(!existing)return json({error:'Case not found'},404);
      if(existing.stage!=='QUOTE_READY'||existing.quote?.status!=='DRAFT_NOT_SENT')
        throw bad('Owner-reviewed draft quote required before preparing a Kimi brief');
      return json({caseId:existing.caseId,
        ...fictionalKimiBriefReadiness(existing.requirements)});
    }
    const bundlePath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/fictional-bundle$/);
    if(bundlePath&&request.method==='GET'){
      const existing=await readBusinessCase(env,bundlePath[1]);
      if(!existing)return json({error:'Case not found'},404);
      if(existing.stage!=='QUOTE_READY'||existing.quote?.status!=='DRAFT_NOT_SENT')
        throw bad('Owner-reviewed draft quote required before a fictional site bundle');
      const bundle=buildFictionalSiteBundle(existing.requirements);
      return json({caseId:existing.caseId,caseRevision:existing.revision,
        bundle,audit:auditFictionalSiteBundle(bundle,existing.requirements)});
    }
    const draftPath=path.match(/^\/api\/business\/cases\/([A-Z0-9_-]{3,30})\/staging-draft$/);
    if(draftPath&&request.method==='POST'){
      const payload=await readJson(request,1000);
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||
        Object.keys(payload).length!==2||
        !Object.hasOwn(payload,'synthetic')||!Object.hasOwn(payload,'expectedRevision')||
        payload.synthetic!==true||!Number.isSafeInteger(payload.expectedRevision)||
        payload.expectedRevision<1)
        throw bad('Fictional staging draft requires synthetic:true and current expectedRevision');
      const existing=await readBusinessCase(env,draftPath[1]);
      if(!existing)return json({error:'Case not found'},404);
      if(existing.revision!==payload.expectedRevision)
        throw bad('Case changed; reload before creating a draft',409);
      const result=await createCaseStagingDraft(env,existing);
      return json({status:'STAGING_DRAFT_READY_FOR_QA',
        project:projectView(await project(env.DB,result.projectId)),
        draft:result.draft},201);
    }
    return methodError();
  }
  if(path==='/api/roles'&&request.method==='GET')return json({roles:ROLES,pricesCAD:PRICES_CAD});
  if(path==='/api/integrations/github'&&request.method==='GET')return json(await diagnoseGitHub(env));
  if(path==='/api/integrations/cloudflare'&&request.method==='GET')return json(await inspectCloudflare(env));
  if(path==='/api/integrations/kimi'&&request.method==='GET')
    return json(createKimiModelApi(env).status());
  if(path==='/api/integrations/kimi/synthetic-draft'&&request.method==='POST'){
    const brief=validateSynthetic(await readJson(request));
    return json(await createKimiModelApi(env).createSyntheticCodeDraft(brief));
  }
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
    let savedCaseAudit=null;
    // QA always checks the Manager's saved preview, never untrusted client HTML.
    // For quoted fictional cases, missing requested sections or unsafe navigation
    // must block local QA regardless of the generic HTML quality-checker result.
    if(p.role==='quality-checker'&&p.action==='review'){
      if(!current.version)throw bad('Build a staging draft first');
      input={html:current.draft_html};
      if(env.BUSINESS_CASES_ENABLED==='true'){
        const relatedCase=await readBusinessCase(env,p.projectId);
        if(relatedCase?.requirements)
          savedCaseAudit=auditSyntheticSitePreview(current.draft_html,relatedCase.requirements);
      }
    }
    const ctx={nextVersion:current.version+1,currentVersion:current.version,
      qaPassed:current.qa_passed===1,revisionOpen:current.revision_open===1,
      ownerApprovedVersion:current.owner_approved,customerApprovedVersion:current.customer_approved};
    if(p.role==='website-developer'&&p.action==='request-revision'&&!current.version)throw bad('No existing draft to revise');
    await requireRoleRunning(env,p.role);
    const result=await runStagingRole(env,p.role,p.action,input,ctx);
    if(savedCaseAudit){
      result.casePreviewStructure=savedCaseAudit;
      if(savedCaseAudit.status!=='LOCAL_STRUCTURE_CHECKS_PASSED')
        result.status='LOCAL_QA_FAILED';
    }
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
export default {
  async fetch(request,env){
    try{return await handle(request,env||{});}catch(e){
      const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<=599?e.status:500;
      return json({error:status===500?'Internal error':String(e.message).slice(0,220)},status);
    }
  },
  async scheduled(event,env,ctx){
    // Only Cloudflare's preapproved daily cron can invoke this handler.
    // All actions remain synthetic and pass through Manager security checks.
    const work=runStagingAutomation(env,{
      scheduledTime:event.scheduledTime,
      handleJob:handle,
      report:r=>console.log('Staging automation:',r.role,r.action,r.status)
    }).then(summary=>{
      console.log('Staging automation complete:',summary.projectId,
        summary.rolesCompleted,'roles,',summary.stepsCompleted,'safe steps');
    });
    ctx.waitUntil(work);
  }
};
