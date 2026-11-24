// Safe daily staging-only orchestration. No customers, contact details, calls, AI spend or publication.
// Every role is reached through the already owner-authenticated Manager /api/jobs route.
export const STAGING_AUTOMATION_STEPS=Object.freeze([
  {role:'customer-care',action:'intake',input:{},expected:'DRAFT_ONLY'},
  {role:'research',action:'plan',input:{sector:'fictional bakery',area:'fictional Toronto neighborhood'},expected:'RESEARCH_PLAN_ONLY'},
  {role:'sales',action:'quote',input:{tier:1},expected:'OWNER_REVIEW_REQUIRED'},
  {role:'sales',action:'prepare-order',input:{fictional:true,tier:1,business:'Fictional Maple Bakery',
    goal:'Create a simple fictional bakery website for staging QA only',features:['Menu','Hours']},expected:'DRAFT_ORDER_NOT_SUBMITTED'},
  {role:'website-developer',action:'build-draft',input:{business:'Fictional Maple Bakery',
    description:'Staging-only bakery example with a fictional menu and opening hours.'},expected:'DRAFT_READY_FOR_QA'},
  {role:'quality-checker',action:'review',input:{},expected:'LOCAL_QA_PASSED'},
  {role:'support',action:'triage',input:{category:'general'},expected:'DRAFT_ONLY'},
  {role:'finance',action:'status',input:{},expected:'SETUP_NOT_CONNECTED'},
  {role:'publishing',action:'readiness',input:{},expected:'NOT_PUBLISHED'},
]);
const today=timestamp=>{
  const d=new Date(timestamp);
  if(!Number.isFinite(d.getTime()))throw Error('Invalid scheduled time');
  return d.toISOString().slice(0,10).replaceAll('-','');
};
export const dailyProjectId=timestamp=>'AUTO'+today(timestamp);
export async function runStagingAutomation(env,{scheduledTime=Date.now(),handleJob,report=()=>{}}={}){
  if(env.MODE!=='staging'||env.SYNTHETIC_AUTOMATION_ENABLED!=='true'||
     !env.DB||typeof env.MANAGER_OWNER_TOKEN!=='string'||
     env.MANAGER_OWNER_TOKEN.length<32||!env.AGENT_EXECUTION_URLS)
    throw Error('Synthetic staging automation is not authorized or configured');
  if(typeof handleJob!=='function')throw Error('Manager job handler is required');
  const projectId=dailyProjectId(scheduledTime);
  const results=[];
  for(const step of STAGING_AUTOMATION_STEPS){
    const payload={synthetic:true,projectId,role:step.role,action:step.action,input:step.input};
    const response=await handleJob(new Request('https://manager.internal/api/jobs',{
      method:'POST',headers:{'authorization':'Bearer '+env.MANAGER_OWNER_TOKEN,'content-type':'application/json'},
      body:JSON.stringify(payload)
    }),env);
    if(response.status!==201)throw Error('Automated demo step '+step.role+'/'+step.action+' failed with HTTP '+response.status);
    const body=await response.json();
    if(body?.result?.agent!==step.role||body?.result?.status!==step.expected)
      throw Error('Automated demo step '+step.role+'/'+step.action+' returned an unexpected result');
    if(step.role==='sales' && (body.result.paymentCharged!==false||body.result.invoiceCreated!==false))
      throw Error('Sales automation safety result violated');
    if(step.role==='website-developer' && body.result.externallyHosted!==false)
      throw Error('Website draft must remain private');
    if(step.role==='publishing' && (body.result.deploymentsPerformed!==0||body.result.liveUrl!==null))
      throw Error('Publishing automation safety result violated');
    if(step.role==='quality-checker'&&body.project?.qaPassed!==true)
      throw Error('QA result not persisted on staging project');
    const result={role:step.role,action:step.action,status:body.result.status};
    results.push(result);
    report(result);
  }
  if(results.length!==9||new Set(results.map(r=>r.role)).size!==8)
    throw Error('Not all eight agent roles ran');
  return {projectId,stepsCompleted:results.length,rolesCompleted:8,syntheticOnly:true,
    paidUsageEnabled:false,customerContactEnabled:false,published:false,results};
}
