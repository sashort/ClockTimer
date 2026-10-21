// Dedicated daemon: never accepts a command, host, executable or filesystem path from HTTP.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {DiagnosticsClient}=require('../tests/diagnostics-reporter.cjs');
const directory=process.env.DIAGNOSTICS_JOB_DIRECTORY||'/var/lib/clocktimer/diagnostics/jobs';
const root=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function write(file,value){const temporary=file+'.worker';fs.writeFileSync(temporary,JSON.stringify(value),{mode:0o600});fs.renameSync(temporary,file);}
function killGroup(child,signal){try{process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}}
async function closeReports(request,aborted){
 const client=new DiagnosticsClient('https://wmof.sashort-apps.com/api/diagnostics/order-filler/',request.credentials);
 for(const suite of request.suite==='order-filler'?['order-filler','summary']:[request.suite]){
  try {
   const response=await client.request({suite,locale:request.locale},true),last=response.last;
   if(last?.runStatus==='running' && Date.parse(last.at)>=Date.parse(request.startedAt))await client.request({action:aborted?'abort':'end',suite,locale:request.locale,runId:last.runId,tripSummary:{failures:aborted?0:1}});
  }catch{console.error('Could not finalize '+suite+' report; it remains incomplete.');}
 }
}
async function execute(job){
 const prefix=path.join(directory,job.id),request=read(prefix+'.request');
 const commands={press:'order-filler-post-deploy.cjs',fast:'order-filler-post-deploy.cjs',medium:'order-filler-post-deploy.cjs',slow:'order-filler-post-deploy.cjs',time:'order-filler-time-exhaustive.mjs',duration:'order-filler-duration-exhaustive.mjs'};
 if(!commands[request.suite] || !/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(request.locale))throw Error('Invalid queued suite/locale');
 const env={...process.env,CLOCKTIMER_TEST_LOCALE:request.locale,CLOCKTIMER_DIAGNOSTICS_URL:'https://wmof.sashort-apps.com/api/diagnostics/order-filler/',CLOCKTIMER_DIAGNOSTICS_COOKIE:request.credentials.cookie,CLOCKTIMER_DIAGNOSTICS_CSRF:request.credentials.csrf,ORDER_FILLER_TEST_BASE_URL:'https://wmof.sashort-apps.com/'};
 delete env.CLOCKTIMER_DIAGNOSTICS_TOKEN;
 env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX=prefix;
 if(['press','fast','medium','slow'].includes(request.suite))env.CLOCKTIMER_DIAGNOSTICS_CATEGORY=request.suite;
 write(prefix+'.status',{status:'running',at:new Date().toISOString()});
 let child,aborted=fs.existsSync(prefix+'.abort'),expired=false,exitCode=null;
 try {
  if(!aborted){
   child=spawn(process.execPath,[path.join(root,'tests',commands[request.suite])],{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});
   const log=fs.createWriteStream(prefix+'.output',{mode:0o600});let bytes=0;
   for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{if(bytes<1048576){log.write(data.subarray(0,1048576-bytes));bytes+=data.length;}});
   let elapsed=0,lastTick=Date.now(),killAt=0,lastStatus='running';
   const monitor=setInterval(()=>{
    const now=Date.now(),paused=fs.existsSync(prefix+'.paused');if(!paused)elapsed+=now-lastTick;lastTick=now;
    aborted ||= fs.existsSync(prefix+'.abort');expired ||= elapsed>7200000;
    const status=aborted?'aborting':paused?'stopped':fs.existsSync(prefix+'.pause')?'stopping':'running';
    if(status!==lastStatus){write(prefix+'.status',{status,at:new Date().toISOString()});lastStatus=status;}
    if((aborted||expired)&&!killAt){write(prefix+'.status',{status:aborted?'aborting':'running',at:new Date().toISOString()});killGroup(child,'SIGTERM');killAt=Date.now();}
    if(killAt&&Date.now()-killAt>4000)killGroup(child,'SIGKILL');
   },250);
   try{exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});}
   finally{clearInterval(monitor);killGroup(child,'SIGKILL');log.end();}
  }
  await closeReports(request,aborted);
  write(prefix+'.status',{status:aborted?'aborted':expired?'incomplete':exitCode===0?'passed':'failed',exitCode,at:new Date().toISOString()});
 }finally{fs.rmSync(prefix+'.request',{force:true});}
}
async function main(){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const heartbeat=()=>{const file=path.join(directory,'heartbeat');fs.closeSync(fs.openSync(file,'a',0o600));const now=new Date();fs.utimesSync(file,now,now);};
 heartbeat();setInterval(heartbeat,2000);
 // systemd kills the entire old process group on restart. Mark its unfinished job explicitly.
 const active=path.join(directory,'active.json');
 if(fs.existsSync(active)){
  const old=read(active),prefix=path.join(directory,old.id),state=fs.existsSync(prefix+'.status')?read(prefix+'.status'):old;
  if(['running','stopping','stopped','aborting'].includes(state.status)){
   if(fs.existsSync(prefix+'.request')){await closeReports(read(prefix+'.request'),false);fs.rmSync(prefix+'.request',{force:true});}
   write(prefix+'.status',{status:'incomplete',at:new Date().toISOString()});
  }
 }
 while(true){
  if(fs.existsSync(active)){
   const job=read(active),prefix=path.join(directory,job.id);
   if(/^[a-f0-9]{32}$/.test(job.id)&&!fs.existsSync(prefix+'.status')&&fs.existsSync(prefix+'.request')){
    try{await execute(job);}catch{write(prefix+'.status',{status:'failed',at:new Date().toISOString()});fs.rmSync(prefix+'.request',{force:true});console.error('Diagnostics job failed; consult its bounded private output.');}
   }
  }
  await sleep(500);
 }
}
if(require.main===module)main().catch(()=>{console.error('Diagnostics worker stopped.');process.exitCode=1;});
module.exports={killGroup};
