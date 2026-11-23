import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {parsePrivateOrderQueueQuery} from '../src/private-order-queue.mjs';
const TOKEN='q'.repeat(64);
function fixture(){
  const raw=new DatabaseSync(':memory:');
  for(const file of ['0001_init.sql','0002_business_cases.sql'])
    raw.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  return {raw,env:{MANAGER_OWNER_TOKEN:TOKEN,BUSINESS_CASES_ENABLED:'true',
    DB:{prepare(sql){let args=[];return {
      bind(...v){args=v;return this;},
      first(){return raw.prepare(sql).get(...args)||null;},
      all(){return {results:raw.prepare(sql).all(...args)};},
      run(){return raw.prepare(sql).run(...args);}
    };}}},close(){raw.close();}};
}
async function api(env,path,method='GET',body,auth=true){
  const r=await worker.fetch(new Request('https://private-staging.example'+path,{
    method,headers:{...(auth?{authorization:'Bearer '+TOKEN}:{}),
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),env);
  return {status:r.status,data:await r.json()};
}
test('private queue query allows only bounded fixed filters',()=>{
  assert.deepEqual(parsePrivateOrderQueueQuery(''),{stage:'ACTIVE',offset:0,limit:20});
  assert.deepEqual(parsePrivateOrderQueueQuery('?stage=CLOSED&offset=3&limit=10'),
    {stage:'CLOSED',offset:3,limit:10});
  for(const bad of [
    '?stage=NEW_REQUEST%3BDELETE', '?stage=UNKNOWN', '?limit=999',
    '?offset=-1','?offset=10001','?limit=0','?offset=abc',
    '?stage=ALL&stage=ACTIVE','?limit=4&limit=2','?email=hello%40example.com'
  ])assert.throws(()=>parsePrivateOrderQueueQuery(bad),undefined,bad);
});
test('owner can page through active fictional orders and filter opt-outs without PII',async()=>{
  const f=fixture();
  try{
    const base='/api/business/cases';
    for(let i=1;i<=37;i++){
      const id='QUEUE_'+String(i).padStart(3,'0');
      const response=await api(f.env,base,'POST',{caseId:id});
      assert.equal(response.status,201);
    }
    await api(f.env,base+'/QUEUE_001/events','POST',{expectedRevision:1,type:'opt-out'});
    await api(f.env,base+'/QUEUE_002/events','POST',{expectedRevision:1,type:'archive'});
    await api(f.env,base+'/QUEUE_003/events','POST',{expectedRevision:1,type:'review-request'});
    let queue=await api(f.env,'/api/business/orders/queue?limit=10');
    assert.equal(queue.status,200);
    assert.equal(queue.data.total,35);
    assert.equal(queue.data.items.length,10);
    assert.equal(queue.data.nextOffset,10);
    assert.equal(queue.data.items.every(x=>x.stage!=='DO_NOT_CONTACT'&&x.stage!=='CLOSED'),true);
    const ids=new Set(queue.data.items.map(x=>x.caseId));
    queue=await api(f.env,'/api/business/orders/queue?limit=10&offset=10');
    assert.equal(queue.data.items.length,10);
    for(const id of queue.data.items.map(x=>x.caseId))assert.equal(ids.has(id),false);
    queue=await api(f.env,'/api/business/orders/queue?stage=DO_NOT_CONTACT');
    assert.equal(queue.data.total,1);
    assert.equal(queue.data.items[0].caseId,'QUEUE_001');
    queue=await api(f.env,'/api/business/orders/queue?stage=QUOTE_PENDING');
    assert.equal(queue.data.total,1);
    assert.equal(queue.data.items[0].caseId,'QUEUE_003');
    assert.equal(queue.data.items[0].nextOwnerAction,'PREPARE_DRAFT_QUOTE');
    queue=await api(f.env,'/api/business/orders/queue?stage=ALL&limit=30&offset=30');
    assert.equal(queue.data.total,37);
    assert.equal(queue.data.items.length,7);
    assert.equal(queue.data.nextOffset,null);
    assert.equal(queue.data.contactInfoIncluded,false);
    assert.equal(queue.data.realSalesIncluded,false);
    assert.equal(queue.data.externalActionsEnabled,false);
    assert.equal(JSON.stringify(queue.data).includes('email'),false);
    assert.equal((await api(f.env,'/api/business/orders/queue','GET',null,false)).status,401);
    assert.equal((await api(f.env,'/api/business/orders/queue?limit=999')).status,400);
    assert.equal((await api(f.env,'/api/business/orders/queue','POST',{synthetic:true})).status,404);
  }finally{f.close();}
});
test('queue is blocked without business-case feature flag',async()=>{
  const f=fixture();
  try{
    f.env.BUSINESS_CASES_ENABLED='false';
    assert.equal((await api(f.env,'/api/business/orders/queue')).status,503);
    f.env.BUSINESS_CASES_ENABLED='true';
    delete f.env.DB;
    assert.equal((await api(f.env,'/api/business/orders/queue')).status,503);
  }finally{f.close();}
});
test('corrupted case stage never silently appears in owner queue',async()=>{
  const f=fixture();
  try{
    await api(f.env,'/api/business/cases','POST',{caseId:'QUEUE_BAD'});
    const current=JSON.parse(f.raw.prepare('SELECT state_json FROM business_cases WHERE id=?')
      .get('QUEUE_BAD').state_json);
    current.stage='UNKNOWN';
    f.raw.prepare('UPDATE business_cases SET state_json=? WHERE id=?')
      .run(JSON.stringify(current),'QUEUE_BAD');
    const invalid=await api(f.env,'/api/business/orders/queue?stage=ALL');
    assert.equal(invalid.status,500);
    assert.equal(invalid.data.error,'Internal error');
  }finally{f.close();}
});
