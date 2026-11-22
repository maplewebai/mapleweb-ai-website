// Smoke-test the actual stand-alone browser UI with installed Chrome/Chromium, if available.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');

function browserBinary(){
 for(const candidate of ['chromium','chromium-browser','google-chrome','google-chrome-stable']){
  if(spawnSync('which',[candidate],{encoding:'utf8'}).status===0)return candidate;
 }
 return null;
}
test('offline browser UI walks order, preview, QA, both approvals, publication simulation and support',t=>{
 const exe=browserBinary();
 if(!exe){t.skip('Chromium or Chrome is unavailable in runner; pure business tests still run');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mapleweb-smoke-'));
 try{
  const source=fs.readFileSync(path.join(__dirname,'MapleWeb_AI_Offline_Demo.html'),'utf8');
  const script='<script>\n' + [
   '(function(){',
   'try{',
   'const el=id=>document.getElementById(id);',
   'if(!window.MapleWebDemo)throw Error("Engine is missing");',
   'el("orderForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));',
   'if(el("buildBtn").disabled)throw Error("Order was not created");',
   'el("buildBtn").click();',
   'if(el("qaBtn").disabled)throw Error("Build did not create a draft");',
   'el("qaBtn").click();',
   'if(el("customerApproveBtn").disabled)throw Error("QA did not enable customer approval");',
   'el("customerApproveBtn").click();',
   'el("ownerApproveBtn").click();',
   'if(el("publishBtn").disabled)throw Error("Both approvals did not open demo publish gate");',
   'el("publishBtn").click();',
   'if(!el("managerState").textContent.includes("SIMULATED ONLY"))throw Error("Publish was not simulated");',
   'el("supportBtn").click();',
   'if(el("unresolvedBtn").disabled)throw Error("Troubleshooting was not started");',
   'el("unresolvedBtn").click();',
   'if(!el("supportState").textContent.includes("No real appointment"))throw Error("Support escalation claim is wrong");',
   'document.documentElement.setAttribute("data-smoke","PASS");',
   '}catch(e){document.documentElement.setAttribute("data-smoke-error",String(e.stack||e));}',
   '})();'
  ].join('\n')+'\n</script>';
  const injected=source.replace('</body></html>',script+'</body></html>');
  if(injected===source)throw Error('HTML body marker not found');
  const htmlFile=path.join(dir,'smoke.html');
  fs.writeFileSync(htmlFile,injected,'utf8');
  const args=['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-software-rasterizer','--virtual-time-budget=5000','--dump-dom','file://'+htmlFile];
  const proc=spawnSync(exe,args,{encoding:'utf8',timeout:30000,maxBuffer:5*1024*1024});
  assert.equal(proc.status,0,'Browser failed: '+(proc.stderr||'').slice(-400));
  assert.match(proc.stdout,/data-smoke="PASS"/,'UI browser smoke failed: '+(proc.stdout.match(/data-smoke-error="[^"]+/)||[]).join(''));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
