const fs=require('node:fs'),path=require('node:path');
function identity(suite,locale){
 if(!['order-filler','time','duration'].includes(suite)||!/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(locale))throw Error('Invalid diagnostics suite/locale');
 return suite+'-'+locale.toLowerCase()+'.log';
}
class DiagnosticsClient {
 constructor(url,{token,cookie='',csrf=''}={}){
  const target=new URL(url);
  if(target.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Diagnostics requires HTTPS');
  this.url=target;this.token=token;this.cookie=cookie;this.csrf=csrf;
 }
 async request(input,authenticate=false){
  const url=new URL(this.url),headers={'Content-Type':'application/json'};
  if(authenticate&&this.token)headers.Authorization='Bearer '+this.token;
  else {if(this.cookie)headers.Cookie=this.cookie;if(this.csrf)headers['X-CSRF-Token']=this.csrf;}
  if(authenticate){url.searchParams.set('suite',input.suite);url.searchParams.set('locale',input.locale);}
  const response=await fetch(url,{method:authenticate?'GET':'POST',headers,body:authenticate?undefined:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(30000)});
  const cookies=response.headers.getSetCookie?.()||[];
  if(cookies.length)this.cookie=cookies.map(c=>c.split(';')[0]).join('; ');
  const data=await response.json();
  if(!response.ok)throw Error('Diagnostics HTTP '+response.status+': '+(data.error||'request failed'));
  if(data.csrfToken)this.csrf=data.csrfToken;
  if(authenticate)this.token=undefined;
  return data;
 }
}
function sharedReporter(){
 if(!process.env.CLOCKTIMER_DIAGNOSTICS_RUN_ID)return {tests:async()=>{}};
 const client=new DiagnosticsClient(process.env.CLOCKTIMER_DIAGNOSTICS_URL,{cookie:process.env.CLOCKTIMER_DIAGNOSTICS_COOKIE,csrf:process.env.CLOCKTIMER_DIAGNOSTICS_CSRF});
 return {tests:tests=>client.request({action:'append',suite:'order-filler',locale:process.env.CLOCKTIMER_TEST_LOCALE||'en-US',runId:process.env.CLOCKTIMER_DIAGNOSTICS_RUN_ID,tests:tests.map(t=>({...t,delivery:process.env.CLOCKTIMER_SPEECH_DELIVERY||'press'}))})};
}
async function beginValueRun({suite,locale,totalTests}){
 const file=identity(suite,locale),out=path.join(__dirname,'artifacts/language-tests',locale.toLowerCase());fs.mkdirSync(out,{recursive:true});
 const log=path.join(out,file),counts={completed:0,passed:0,failed:0,skipped:0};let pending=[],local=[];
 const record=(type,fields={})=>({type,suite,locale,...fields,completed:counts.completed,total:totalTests,progress:'test '+counts.completed+'/'+totalTests,runStatus:'running',at:new Date().toISOString()});
 fs.writeFileSync(log,JSON.stringify(record('test-start'))+'\n');
 let client,runId;
 if(process.env.CLOCKTIMER_DIAGNOSTICS_URL){client=new DiagnosticsClient(process.env.CLOCKTIMER_DIAGNOSTICS_URL,{token:process.env.CLOCKTIMER_DIAGNOSTICS_TOKEN});await client.request({suite,locale},true);const r=await client.request({action:'start',suite,locale,totalTests});runId=r.state.runId;}
 const flush=async()=>{
  if(local.length){fs.appendFileSync(log,local.map(r=>JSON.stringify(r)).join('\n')+'\n');local=[];}
  if(client)for(let i=0;i<pending.length;i+=500)await client.request({action:'append',suite,locale,runId,tests:pending.slice(i,i+500)});
  pending=[];
 };
 return {
  record(test){counts.completed++;counts[test.status]++;pending.push(test);local.push(record('test',{number:counts.completed,...test}));},
  flush,
  async end(tripSummary={}){
   await flush();const status=counts.completed<totalTests?'incomplete':counts.failed||tripSummary.failures?'failed':'passed';
   fs.appendFileSync(log,[record('summary',{...counts,tripRun:tripSummary}),{...record('test-end'),runStatus:status,status}].map(r=>JSON.stringify(r)).join('\n')+'\n');
   if(client)await client.request({action:'end',suite,locale,runId,tripSummary});
  }
 };
}
module.exports={identity,DiagnosticsClient,sharedReporter,beginValueRun};
