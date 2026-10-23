const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const {DiagnosticsClient}=require('./diagnostics-reporter.cjs');
const plan=require('./order-filler-master-plan.cjs');
(async()=>{
 const base=new URL(process.env.ORDER_FILLER_TEST_BASE_URL||'https://wmof.sashort-apps.com/');
 if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Deployed tests require HTTPS');
 const available=fs.readdirSync(path.join(__dirname,'languages'));
 const languages=(process.env.CLOCKTIMER_TEST_LOCALES||process.env.CLOCKTIMER_TEST_LOCALE||'en-US').split(',').map(s=>s.trim()).map(s=>available.find(locale=>locale.toLowerCase()===s.toLowerCase())||s);
 if(new Set(languages.map(s=>s.toLowerCase())).size!==languages.length)throw Error('Duplicate tested locales');
 for(const locale of languages){if(!/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(locale))throw Error('Invalid locale');if(!fs.existsSync(path.join(__dirname,'languages',locale,'profile.cjs')))throw Error('No test corpus for '+locale);}
 const response=await fetch(new URL('build-version.json',base),{cache:'no-store',redirect:'error'});
 if(!response.ok)throw Error('Cannot verify deployed build');
 const build=await response.json();
 const expectedCommit=process.env.CLOCKTIMER_TEST_EXPECTED_COMMIT||process.env.GITHUB_SHA;
 if(expectedCommit&&build.commit!==expectedCommit)throw Error('Deployment commit does not match test checkout');
 const env={...process.env,ORDER_FILLER_TEST_BASE_URL:base.href};
 const category=env.CLOCKTIMER_DIAGNOSTICS_CATEGORY;
 if(category&&!['press','fast','medium'].includes(category))throw Error('Invalid workflow category');
 const deliveries=category?[category]:['press',...Object.keys(plan.rates)];
 let client,summaryId;const failures=[],results=[];const started=Date.now();
 if(env.CLOCKTIMER_DIAGNOSTICS_TOKEN||env.CLOCKTIMER_DIAGNOSTICS_COOKIE){
  env.CLOCKTIMER_DIAGNOSTICS_URL ||= new URL('api/diagnostics/order-filler/',base).href;
  client=new DiagnosticsClient(env.CLOCKTIMER_DIAGNOSTICS_URL,{token:env.CLOCKTIMER_DIAGNOSTICS_TOKEN,cookie:env.CLOCKTIMER_DIAGNOSTICS_COOKIE,csrf:env.CLOCKTIMER_DIAGNOSTICS_CSRF});
  await client.request({suite:'summary',locale:languages[0]},true);
  if(!category){const result=await client.request({action:'start',suite:'summary',locale:languages[0],languages,totalTests:languages.length*deliveries.length});summaryId=result.state.runId;}
  Object.assign(env,{CLOCKTIMER_DIAGNOSTICS_COOKIE:client.cookie,CLOCKTIMER_DIAGNOSTICS_CSRF:client.csrf});delete env.CLOCKTIMER_DIAGNOSTICS_TOKEN;
 }else console.log('No diagnostics credential configured; reports remain in CI artifacts.');
 try{
  for(const locale of languages){
   env.CLOCKTIMER_TEST_LOCALE=locale;
   const totalTests=deliveries.reduce((n,d)=>n+plan.journeyCheckpoints+plan.commands(d==='press'?'touch':'voice').length,0);
   let runId;
   const reportSuite=category||'order-filler';env.CLOCKTIMER_DIAGNOSTICS_SUITE=reportSuite;
   if(client){const deliveryTotals=Object.fromEntries(deliveries.map(d=>[d,plan.journeyCheckpoints+plan.commands(d==='press'?'touch':'voice').length]));const r=await client.request({action:'start',suite:reportSuite,locale,totalTests,deliveryTotals});runId=r.state.runId;env.CLOCKTIMER_DIAGNOSTICS_RUN_ID=runId;}
   let languageFailures=0;
   for(const delivery of deliveries){
    const method=delivery==='press'?'touch':'voice';env.CLOCKTIMER_SPEECH_DELIVERY=delivery;
    if(client&&summaryId)await client.request({action:'progress',suite:'summary',locale:languages[0],runId:summaryId,language:locale,delivery});
    const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tests/order-filler-master-'+method+'.cjs'],{cwd:path.resolve(__dirname,'..'),env,stdio:'inherit'});child.on('error',reject);child.on('close',resolve);});
    const result={language:locale,delivery,label:locale+' '+delivery,status:code===0?'passed':'failed'};results.push(result);
    if(code!==0){failures.push(locale+' '+delivery);languageFailures++;}
    if(client&&summaryId)await client.request({action:'append',suite:'summary',locale:languages[0],runId:summaryId,tests:[result]});
   }
   if(client)await client.request({action:'end',suite:reportSuite,locale,runId,tripSummary:{failures:languageFailures,...(languageFailures?{}:{trips:deliveries.length*2,standaloneBreaks:deliveries.length*3,hourRingSwitches:deliveries.length}),wallMilliseconds:Date.now()-started}});
  }
 }finally{
  if(client&&summaryId)await client.request({action:'end',suite:'summary',locale:languages[0],runId:summaryId,tripSummary:{failures:failures.length,wallMilliseconds:Date.now()-started}});
  const folder=path.join(__dirname,'artifacts/language-tests');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'summary.log'),JSON.stringify({type:'summary',languages,results,build,status:results.length<languages.length*deliveries.length?'incomplete':failures.length?'failed':'passed',completed:results.length,total:languages.length*deliveries.length})+'\n');
 }
 if(failures.length)throw Error('Post-deployment masters failed: '+failures.join(', '));
 console.log('PASS deployed Order Filler masters; build '+build.version);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
