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
 const page=await browser.newPage({viewport:{width:411,height:914}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-04T18:15:00Z')});
 await page.route('**/api/**',r=>new URL(r.request().url()).pathname.endsWith('.js')?r.continue():r.fulfill({status:401,json:{message:'Not signed in'}}));
 await page.goto(`http://127.0.0.1:${server.address().port}/graphical-settings.html`);
 await page.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
 await page.clock.pauseAt(new Date('2026-11-04T18:15:10Z'));
 await page.evaluate(()=>{
  const R=customElements.get('ring-container'),apply=R.prototype.applyRangeLayout;
  R.prototype.applyRangeLayout=function(range,layout,...args){range.testObserverLayout=layout;return apply.call(this,range,layout,...args);};
 });
 await page.locator('[name=timerType]').selectOption('radial-fitted');
 for(const index of [1,2]){
  const id=index===1?'clockPreview':'clockPreview2';
  await page.getByRole('tab',{name:'Preview '+index,exact:true}).click();
  await page.clock.runFor(1500);
  await page.evaluate(id=>{
   const timer=document.getElementById(id);window.observerProjectionErrors=[];window.observerProjectionFrames=0;
   window.observerProjectionProbe=setInterval(()=>{
    const ranges=[...timer.querySelectorAll('time-range')].filter(r=>!r.timeRangeExiting&&!['elapsed','remaining','wave'].includes(r.getAttribute('type')));
    const bounds=ranges.find(r=>r.getAttribute('type')==='trip')?.testObserverLayout?.fittedBounds;
    if(!bounds)return;
    for(const r of ranges){
     const layout=r.testObserverLayout;if(!layout)continue;
     const project=t=>Math.max(0,Math.min(360,360*(t-bounds.start)/bounds.duration));
     const error=Math.max(Math.abs(layout.startAngle-project(Number(r.clockTimerStart))),Math.abs(layout.endAngle-project(Number(r.clockTimerEnd))));
     if(error>.02&&observerProjectionErrors.length<12)observerProjectionErrors.push({type:r.getAttribute('type'),error,actual:[layout.startAngle,layout.endAngle],expected:[project(Number(r.clockTimerStart)),project(Number(r.clockTimerEnd))]});
    }
    observerProjectionFrames++;
   },16);
  },id);
  await page.clock.runFor(3200);
  const result=await page.evaluate(()=>{clearInterval(observerProjectionProbe);return {frames:observerProjectionFrames,errors:observerProjectionErrors};});
  assert(result.frames>100,'sample geometry between ticks, not just at settled endpoints');
  assert.deepEqual(result.errors,[],'unchanged observer snapshots must not replay interval shifts or animate fitted ranges: preview '+index);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS both fitted previews keep every range on one projection throughout repeated observer refreshes');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
