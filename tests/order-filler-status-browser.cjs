const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:1180}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));let finished=false,documentLoads=0,pauseNumeric=false,releaseNumeric,notifyBlocked;const blocked=new Promise(resolve=>{notifyBlocked=resolve;});
  const php=fs.readFileSync(path.join(root,'diagnostics/order-filler/index.php'),'utf8');
  const html=php.slice(php.indexOf('<!doctype')).replace(/<\?=[\s\S]*?\?>/g,'en-US');
  await page.route('http://diagnostics.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/diagnostics/order-filler/'){documentLoads++;return route.fulfill({contentType:'text/html',body:html});}
   if(url.pathname.endsWith('/status.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'diagnostics/order-filler/status.js'),'utf8')});
   if(url.pathname==='/api/diagnostics/order-filler/'){
    calls.push(url.href);assert.equal(url.searchParams.get('status'),'1','poll only final-line status');
    const suite=url.searchParams.get('suite'),locale=url.searchParams.get('locale');
    if(suite==='duration'&&pauseNumeric){pauseNumeric=false;await new Promise(resolve=>{releaseNumeric=resolve;notifyBlocked();});}
    const row={press:'passed',fast:'passed',medium:finished?'passed':'running',slow:finished?'passed':'queued'};
    const last=suite==='summary'?{languages:['en-us','en-gb'],results:{'en-us':row,'en-gb':{press:'queued',fast:'queued',medium:'queued',slow:'queued'}},runStatus:'running',build:{version:'TEST01'}}:
     {locale,delivery:'medium',type:finished?'test-end':'test',label:'<img src=x onerror=alert(1)>',completed:finished?62:39,total:62,deliveryNumber:finished?62:39,deliveryTotal:62,progress:'test '+(finished?62:39)+'/62',runStatus:finished?'passed':'running',at:new Date().toISOString()};
    return route.fulfill({json:{last}});
   }
   return route.fulfill({status:404,body:''});
  });
  await page.goto('http://diagnostics.test/diagnostics/order-filler/');await page.waitForFunction(()=>document.querySelectorAll('#summary-rows tr').length===2);
  assert.deepEqual(await page.locator('thead th').allTextContents(),['Language / region','Press','Fast · 240 wpm','Medium · 160 wpm','Slow · 90 wpm']);
  assert.match(await page.locator('#live-progress').innerText(),/test 39\/62/);
  assert.equal(await page.locator('#live-progress img').count(),0,'log labels remain inert text');
  const out=path.join(root,'tests/artifacts/language-tests/status-page');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'status page fits mobile');
  await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  await page.waitForFunction(()=>document.querySelectorAll('#numeric-rows tr').length===2);
  await page.evaluate(()=>{
   window.statusNodes={summary:document.querySelector('#summary-rows tr'),numeric:document.querySelector('#numeric-rows tr'),progress:document.querySelector('#live-progress progress')};
   document.querySelector('#folders').style.minWidth='900px';
   document.querySelector('#folders').closest('.panel').scrollLeft=120;
   window.scrollTo(0,document.documentElement.scrollHeight-innerHeight-64);
  });
  pauseNumeric=true;finished=true;
  await blocked;
  // The user moves again during an in-flight request. Preserve this newer position.
  await page.evaluate(()=>{window.scrollBy(0,-90);document.querySelector('#locale').focus({preventScroll:true});});
  const before=await page.evaluate(()=>({y:scrollY,x:document.querySelector('#folders').closest('.panel').scrollLeft}));
  assert(before.y>100,'exercise a genuinely scrolled page');assert(before.x>0,'exercise a horizontally scrolled panel');
  releaseNumeric();await page.waitForFunction(()=>document.querySelector('#live-progress').textContent.includes('test 62/62'));
  assert.equal(documentLoads,1,'polling must use fetch without reloading the document');
  const after=await page.evaluate(()=>({y:scrollY,x:document.querySelector('#folders').closest('.panel').scrollLeft,
   stable:statusNodes.summary===document.querySelector('#summary-rows tr')&&statusNodes.numeric===document.querySelector('#numeric-rows tr')&&statusNodes.progress===document.querySelector('#live-progress progress'),focus:document.activeElement.id}));
  assert(Math.abs(after.y-before.y)<1,'retain the latest vertical position across refresh');
  assert.equal(after.x,before.x,'retain panel horizontal scrolling');assert(after.stable,'patch existing rows and progress in place');assert.equal(after.focus,'locale','polling does not steal input focus');
  assert(calls.filter(url=>new URL(url).searchParams.get('suite')==='summary').length>=2,'status polling refreshes the page');assert.deepEqual(errors,[]);
  console.log('PASS status matrix, fast-first order, fetch-only polling, stable nodes, retained page/panel scroll and focus, inert labels and mobile layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
