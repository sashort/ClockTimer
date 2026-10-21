const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const contract=require('../docs/order-filler-state-contract.json');
const reporter=require('./diagnostics-reporter.cjs').sharedReporter();
module.exports=async method=>{
 const plan=require('./order-filler-master-plan.cjs');
 const deliveries=method==='touch'?['press']:process.env.CLOCKTIMER_SPEECH_DELIVERY?[process.env.CLOCKTIMER_SPEECH_DELIVERY]:Object.keys(plan.rates);
 for(const delivery of deliveries){
  if(method==='voice'&&!plan.rates[delivery])throw Error('Unknown speech delivery rate');
  process.env.CLOCKTIMER_SPEECH_DELIVERY=delivery;
  process.env.CLOCKTIMER_SPEECH_RATE_WPM=String(plan.rates[delivery]||0);
  await require('./order-filler-master.cjs')(method);
 }
 if(process.argv.includes('--journey-only'))return;
 const commands=require('./order-filler-master-plan.cjs').commands(method);
 const results=[];
 for(const test of commands){
  await require('./diagnostics-reporter.cjs').checkpoint();
  console.log('RUN '+method+' FSM/support: '+test.id);
  const started=Date.now();let failureDetail='';
  const code=await new Promise(resolve=>{
   const env={...process.env};
   if(test.id==='speech-response-chain-browser')env.SPEECH_BROWSER ||= env.BROWSER_EXECUTABLE || require('playwright').chromium.executablePath();
   const child=spawn(process.execPath,test.args,{cwd:root,stdio:['inherit','inherit','pipe'],env});
   child.stderr.on('data',data=>{process.stderr.write(data);failureDetail=(failureDetail+data.toString()).slice(-6000);});
   let expired=false;
   const timeout=setTimeout(()=>{expired=true;child.kill();},120000);
   child.on('error',error=>{console.error(error);});
   child.on('close',code=>{clearTimeout(timeout);resolve(expired?'timeout':code);});
  });
  results.push({id:test.id,result:code===0?'passed':'failed',code});
  await reporter.tests([{label:method+' FSM/support: '+test.id,status:code===0?'passed':'failed',elapsedMs:Date.now()-started,...(code===0?{}:{message:Buffer.from(failureDetail||'Test exited with '+code).subarray(0,1800).toString()})}]);
 }
 const report={method,contractSchema:contract.schemaVersion,results,
  unreviewed:contract.backlog,
  limits:['Recognized text is injected; no acoustic recognition or physical microphone.','Local API fixture; production database/authentication are tested separately.','Time/duration value matrices have separate entry points.']};
 const out=path.join(__dirname,'artifacts/language-tests',(process.env.CLOCKTIMER_TEST_LOCALE||'en-US').toLowerCase(),'order-filler',method);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'fsm-report.json'),JSON.stringify(report,null,2));
 if(results.some(r=>r.result==='failed'))throw Error(method+' master failed: '+results.filter(r=>r.result==='failed').map(r=>r.id).join(', '));
 console.log('PASS '+method+' master: browser journey and '+results.length+' FSM/support cases');
};
