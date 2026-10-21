const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:1180}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));let finished=false,documentLoads=0,pauseNumeric=false,releaseNumeric,notifyBlocked,job=null;
  const blocked=new Promise(resolve=>{notifyBlocked=resolve;});
  const php=fs.readFileSync(path.join(root,'diagnostics/order-filler/index.php'),'utf8');
  const html=php.slice(php.indexOf('<!doctype')).replace(/<\?=[\s\S]*?\?>/g,'en-US');
  await page.route('http://diagnostics.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/diagnostics/order-filler/'){documentLoads++;return route.fulfill({contentType:'text/html',body:html});}
   if(url.pathname.endsWith('/status.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'diagnostics/order-filler/status.js'),'utf8')});
   if(url.pathname==='/api/diagnostics/order-filler/'){
    const suite=url.searchParams.get('suite'),locale=url.searchParams.get('locale');calls.push(url.href);
    if(route.request().method()==='POST'){
     assert.equal(route.request().headers()['x-csrf-token'],'fixture-csrf');const body=route.request().postDataJSON();
     if(body.action==='job-start')job={id:'fixture-job',suite:body.suite,locale:body.locale,status:'running'};
     if(body.action==='job-stop')job.status='stopped';if(body.action==='job-resume')job.status='running';if(body.action==='job-abort')job.status='aborted';
     return route.fulfill({json:{job,ready:true,busy:job?.status!=='aborted',canAbort:job?.status!=='aborted',csrfToken:'fixture-csrf'}});
    }
    if(url.searchParams.has('job'))return route.fulfill({json:{job,ready:true,busy:job&&job.status!=='aborted',canAbort:job&&job.status!=='aborted',csrfToken:'fixture-csrf'}});
    if(url.searchParams.has('results')){
     const failed=url.searchParams.get('failures')==='1';return route.fulfill({json:{runId:'run-'+suite,cursor:0,nextCursor:100,hasMore:false,completed:finished?62:39,total:62,rows:[{number:1,total:62,locale,delivery:url.searchParams.get('delivery')||suite,label:'<img src=x onerror=alert(1)>',status:failed?'failed':'passed',message:failed?'Expected entry; received rejection':'',elapsedMs:184}]}});
    }
    if(suite==='duration'&&pauseNumeric){pauseNumeric=false;await new Promise(resolve=>{releaseNumeric=resolve;notifyBlocked();});}
    if(['press','fast','medium','slow'].includes(suite))return route.fulfill({json:{last:null,statistics:null}});
    const row={press:'passed',fast:'passed',medium:finished?'passed':'running',slow:finished?'passed':'queued'};
    const last=suite==='summary'?{languages:['en-us'],results:{'en-us':row},runStatus:'running',build:{version:'TEST01'}}:
     {runId:'run-'+suite,locale,delivery:'medium',type:finished?'test-end':'test',label:'<img src=x onerror=alert(1)>',completed:finished?62:39,total:62,progress:'test '+(finished?62:39)+'/62',runStatus:finished?'passed':'running',at:new Date().toISOString()};
    const statistics={startedAt:new Date().toISOString(),tests:finished?62:39,totalTests:62,passed:finished?62:39,failed:0,deliveryTotals:{press:52,fast:63,medium:63,slow:63},deliveryCounts:{press:52,fast:63,medium:finished?63:18,slow:finished?63:0},deliveryStats:{press:{passed:52,failed:0},fast:{passed:62,failed:1},medium:{passed:finished?63:18,failed:0},slow:{passed:finished?63:0,failed:0}}};
    return route.fulfill({json:{last,statistics,csrfToken:'fixture-csrf'}});
   }
   return route.fulfill({status:404,body:''});
  });
  await page.goto('http://diagnostics.test/diagnostics/order-filler/');await page.waitForFunction(()=>document.querySelectorAll('#summary-rows tr').length===1);
  assert.equal(await page.locator('.category').count(),6,'six clickable category areas');
  assert.match(await page.locator('#live-progress').innerText(),/test 39\/62/,'initial selection resolves mixed-case locale');
  await page.locator('#run-category').selectOption('fast');await page.waitForFunction(()=>document.querySelector('#live-label').textContent.includes('Fast'));assert.match(await page.locator('#live-progress').innerText(),/test 39\/62/,'dropdown selection resolves mixed-case locale');
  await page.locator('#numeric-rows tr').first().locator('td').first().click();await page.waitForFunction(()=>document.querySelector('#live-label').textContent.includes('Clock times'));
  const press=page.locator('[data-category=press]'),medium=page.locator('[data-category=medium]');
  assert.match(await press.innerText(),/Remaining\s+---\s+Passed\s+52\s+Failed\s+---/,'completed remaining and zero failures use dashes');
  assert.match(await medium.innerText(),/Running\s+Remaining\s+45\s+Passed\s+18\s+Failed\s+---/,'active category exposes accurate counts');
  assert.equal(await medium.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(56, 45, 22)','running is amber');
  for(const category of ['press','fast','medium','slow','time','duration']){
   await page.locator(`[data-category=${category}]`).click();await page.waitForFunction(c=>document.querySelector('#live-label').textContent.includes(c),({press:'Press',fast:'Fast',medium:'Medium',slow:'Slow',time:'Clock times',duration:'Durations'})[category]);
   assert.equal(await page.locator(`[data-category=${category}]`).getAttribute('aria-pressed'),'true');
  }
  assert.equal(await page.locator('#result-rows img').count(),0,'labels are inert text');
  await page.locator('#result-filter').selectOption('failed');await page.waitForFunction(()=>document.querySelector('#result-rows').textContent.includes('Expected entry'));
  await page.locator('[data-category=press]').click();await page.locator('#start-tests').click();await page.waitForFunction(()=>!document.querySelector('#stop-tests').disabled);
  await page.locator('#stop-tests').click();await page.waitForFunction(()=>!document.querySelector('#resume-tests').disabled);
  await page.locator('#resume-tests').click();await page.waitForFunction(()=>!document.querySelector('#stop-tests').disabled);
  await page.locator('#abort-tests').click();await page.waitForFunction(()=>!document.querySelector('#start-tests').disabled);
  assert.equal(job.status,'aborted','all four controls use protected API actions');
  const out=path.join(root,'tests/artifacts/language-tests/status-page');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fits mobile');await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  await page.evaluate(()=>{window.statusNodes={summary:document.querySelector('#summary-rows tr'),numeric:document.querySelector('#numeric-rows tr'),progress:document.querySelector('#live-progress progress')};document.querySelector('#folders').style.minWidth='900px';document.querySelector('#folders').closest('.panel').scrollLeft=120;window.scrollTo(0,document.documentElement.scrollHeight-innerHeight-64);});
  pauseNumeric=true;finished=true;await blocked;
  await page.evaluate(()=>{window.scrollBy(0,-90);document.querySelector('#locale').focus({preventScroll:true});});
  const before=await page.evaluate(()=>({y:scrollY,x:document.querySelector('#folders').closest('.panel').scrollLeft}));assert(before.y>100);assert(before.x>0);
  releaseNumeric();await page.waitForFunction(()=>document.querySelector('#live-progress').textContent.includes('test 62/62'));
  const after=await page.evaluate(()=>({y:scrollY,x:document.querySelector('#folders').closest('.panel').scrollLeft,stable:statusNodes.summary===document.querySelector('#summary-rows tr')&&statusNodes.numeric===document.querySelector('#numeric-rows tr')&&statusNodes.progress===document.querySelector('#live-progress progress'),focus:document.activeElement.id}));
  assert.equal(documentLoads,1);assert(Math.abs(after.y-before.y)<1,'retain scroll during fetch');assert.equal(after.x,before.x);assert(after.stable);assert.equal(after.focus,'locale');assert.deepEqual(errors,[]);
  const pausePage=await browser.newPage();await pausePage.clock.install();await pausePage.setContent('<script>window.ticks=0;setInterval(()=>ticks++,50);</script>');
  const diagnostics=require('./diagnostics-reporter.cjs'),pauseFolder=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'diagnostics-browser-pause-')),prefix=path.join(pauseFolder,'job'),previousPrefix=process.env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX;
  try{
   process.env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX=prefix;diagnostics.setCheckpointHooks(new (require('./browser-test-pause.cjs'))(pausePage));fs.writeFileSync(prefix+'.pause','pause');
   const gate=diagnostics.checkpoint();for(let i=0;i<100&&!fs.existsSync(prefix+'.paused');i++)await new Promise(resolve=>setTimeout(resolve,50));
   assert(fs.existsSync(prefix+'.paused'),'browser acknowledges stopped only after freezing');
   const frozen=await pausePage.evaluate(()=>({now:Date.now(),ticks}));await new Promise(resolve=>setTimeout(resolve,400));assert.deepEqual(await pausePage.evaluate(()=>({now:Date.now(),ticks})),frozen,'stopped workflow timers do not advance');
   fs.unlinkSync(prefix+'.pause');await gate;await new Promise(resolve=>setTimeout(resolve,200));assert((await pausePage.evaluate(()=>ticks))>frozen.ticks,'resume continues the same browser timers');
  }finally{diagnostics.setCheckpointHooks();if(previousPrefix===undefined)delete process.env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX;else process.env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX=previousPrefix;await pausePage.close();fs.rmSync(pauseFolder,{recursive:true,force:true});}
  console.log('PASS six selectors, counts, amber states, filtering, all controls, mobile, retained scroll/focus and frozen/resumed workflow timers');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
