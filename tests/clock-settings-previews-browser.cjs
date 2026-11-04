const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const relative=pathname.slice(1).replace(/\.php$/,'.html');
 const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'application/octet-stream');
 res.end(fs.readFileSync(file));
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:411,height:914}});const errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.stack));
 await page.clock.install({time:new Date('2026-11-04T18:15:00Z')});
 await page.route('**/api/**',route=>{if(new URL(route.request().url()).pathname.endsWith('.js'))return route.continue();if(route.request().method()!=='GET')writes.push(route.request().url());return route.fulfill({status:401,json:{message:'Not signed in'}});});
 await page.goto(`http://127.0.0.1:${server.address().port}/graphical-settings.html`);
 await page.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
 assert.equal(await page.locator('[role=tab]').count(),5);
 await page.clock.pauseAt(new Date('2026-11-04T18:15:10Z'));
 const metrics=id=>page.evaluate(id=>{const timer=document.getElementById(id);return {types:[...timer.querySelectorAll('time-range')].map(e=>e.getAttribute('type')),active:[...timer.querySelectorAll('ring-container[active]')].filter(e=>e.clockTimerExitingRing!==true).map(e=>Number(e.clockTimerRingIndex)),base:[...timer.querySelectorAll('ring-container')].filter(r=>'clockTimerRing' in r&&!r.clockTimerExitingRing).map(r=>Number(r.clockTimerRingIndex)),elapsed:Number(timer.dataset.sampleElapsed),height:timer.getBoundingClientRect().height,width:timer.getBoundingClientRect().width};},id);
 const visible=()=>page.locator('[role=tabpanel]:visible').count();
 for(const type of ['radial-overflow','radial-fitted']){
  await page.getByRole('tab',{name:'Timer',exact:true}).click();
  await page.locator('[name=timerType]').selectOption(type);
  assert.equal(await page.locator('#clockPreview').getAttribute('timer-type'),type);
  assert.equal(await page.locator('#clockPreview2').getAttribute('timer-type'),type,'both previews share draft type');
  for(const index of [1,2]){
   const id=index===1?'clockPreview':'clockPreview2';
   await page.getByRole('tab',{name:'Preview '+index,exact:true}).click();
   assert.equal(await visible(),1);
   await page.clock.runFor(300);
   const before=await metrics(id);assert(before.elapsed>=7195000&&before.elapsed<7196000);
   assert(before.height>200&&before.width>200,'preview fills the constrained pane');
   const expected=index===1?['earlystart','lunch','buffer','latency','down','tolerance']:['down','approval-surplus','approval-deficit','tolerance','overtime'];
   for(const range of expected)assert(before.types.includes(range),type+' preview '+index+' missing '+range);
   if(type==='radial-overflow')assert.deepEqual(before.active,[1]);else assert.deepEqual(before.base,[0],'fitted uses one base ring');
   await page.clock.runFor(4400);if(type==='radial-overflow')assert.deepEqual((await metrics(id)).active,before.active,'no premature ring switch');else assert.deepEqual((await metrics(id)).base,[0]);
   await page.clock.runFor(800);const after=await metrics(id);
   assert(after.elapsed>=7200000,'sample crossed two hours');
   if(type==='radial-overflow')assert.deepEqual(after.active,[2],'overflow changes rings');else assert.deepEqual(after.base,[0],'fitted keeps one projected ring');
   await page.locator('[data-preview-legend="'+index+'"]').click();
   assert(await page.locator('#graphicalPreviewLegend').isVisible());
   assert.equal(await page.locator('#graphicalPreviewLegend').evaluate(e=>getComputedStyle(e).opacity),'1');
   assert.match(await page.locator('#graphicalPreviewLegend').innerText(),index===1?/Early Start/:/Approval Surplus/);
   await page.locator('[data-close-preview-legend]').click();
  }
 }
 await page.getByRole('tab',{name:'Style',exact:true}).click();
 await page.locator('[name=hourColor]').evaluate(e=>{e.value='#abcdef';e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#clockPreview2').evaluate(e=>e.style.getPropertyValue('--clock-timer-tick-color')),'#abcdef');
 await page.setViewportSize({width:390,height:600});
 for(const theme of ['default','halloween']){
  await page.evaluate(theme=>document.documentElement.dataset.seasonalTheme=theme,theme);
  await page.getByRole('tab',{name:'Timer',exact:true}).click();
  const tabsBefore=await page.locator('.graphical-tabs').boundingBox();
  await page.locator('#graphical-pane-timer').evaluate(e=>e.scrollTop=e.scrollHeight);
  assert.deepEqual(await page.locator('.graphical-tabs').boundingBox(),tabsBefore,'both tab rows stay fixed while pane scrolls');
  assert.equal(await visible(),1);
  await page.getByRole('tab',{name:'Preview 1',exact:true}).click();
  assert((await metrics('clockPreview')).height>100);
 }
 await page.setViewportSize({width:411,height:914});
 await page.evaluate(()=>document.documentElement.dataset.seasonalTheme='default');
 await page.getByRole('tab',{name:'Timer',exact:true}).click();
 await page.getByRole('tab',{name:'Timer',exact:true}).press('End');
 assert.equal(await page.getByRole('tab',{name:'Preview 2',exact:true}).getAttribute('aria-selected'),'true','keyboard navigation selects a single pane');
 const target=path.resolve(root,'../outputs/clock-settings-implemented');fs.mkdirSync(target,{recursive:true});
 await page.screenshot({path:path.join(target,'preview2.png')});
 await page.getByRole('tab',{name:'Preview 1',exact:true}).click();await page.clock.runFor(350);
 await page.screenshot({path:path.join(target,'preview1.png')});
 await page.locator('[data-close-dialog]').first().click();
 const stopped=(await metrics('clockPreview')).elapsed;await page.clock.runFor(1500);assert.equal((await metrics('clockPreview')).elapsed,stopped,'closing stops sample updates');
 assert.deepEqual(writes,[],'sample replay cannot write any trips');assert.deepEqual(errors,[]);
 console.log('PASS five isolated panes, native sample ranges, five-second overflow transitions, fitted projection, shared draft, legends, keyboard navigation, phone themes and fixed tabs');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
