const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{
 const p=f.page,operation=require('./retained-page-operation.cjs')(p);const logColors=()=>p.locator('#tripLogButton').evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundImage,color:s.color};});let fullLogColors;let settings={version:1};await p.route('**/api/settings/',async route=>{if(route.request().method()==='PATCH'){const body=route.request().postDataJSON();settings={...settings,[body.namespace]:{...settings[body.namespace],...body.changes}};}await route.fulfill({json:{userId:2,settings}});});await p.setViewportSize({width:390,height:844});
 await operation(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,20));globalThis.fullLogColors=(()=>{const s=getComputedStyle(document.querySelector('#tripLogButton'));return{background:s.backgroundImage,color:s.color};})();document.querySelector('#actionDisplayCompact').click();});
 await p.waitForTimeout(1300);
 async function state(name,left,right){
  await p.waitForTimeout(2300);
  const result=await p.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}};return{clock:rect(document.querySelector('#clockTimer')),app:rect(document.querySelector('#app')),left:[...document.querySelectorAll('.compact-action-left > [data-compact-visible=true]')].map(e=>({id:e.id,...rect(e)})),right:[...document.querySelectorAll('.compact-action-right > [data-compact-visible=true]')].map(e=>({id:e.id,...rect(e)})),timer:document.querySelector('.compact-interval-timer').textContent};});
  assert.deepEqual(result.left.map(e=>e.id).sort(),left.sort(),name+' left');assert.deepEqual(result.right.map(e=>e.id).sort(),right.sort(),name+' right');
  assert(Math.abs(result.clock.cx-result.app.cx)<1,name+' clock horizontal center '+JSON.stringify(result));
  for(const rail of [result.left,result.right])if(rail.length)assert(Math.abs(rail.reduce((n,r)=>n+r.cy,0)/rail.length-result.clock.cy)<2,name+' rail vertical center '+JSON.stringify(result));
  for(const r of [...result.left,...result.right]){assert(r.width>=42&&r.width===r.height,name+' square');assert(r.y>=0&&r.y+r.height<=result.app.height,name+' fits');}
  await p.screenshot({path:require('node:path').resolve('../outputs/compact-live-'+name+'.png')});
 }
 await state('idle',['newTripButton','idleBreakButton'],['tripLogButton']);fullLogColors=await p.evaluate(()=>globalThis.fullLogColors);assert.deepEqual(await logColors(),fullLogColors,'Compact Trip Log matches the Full button colors');
 await require('./break-only-entry-frames.cjs')(p,operation);
 for(const theme of ['default','halloween']){
  await operation(theme=>WMOFSeasonalTheme.setPreference(theme,{persist:false}),theme);
  for(const phase of ['opening','closing']){
   await p.evaluate(()=>{void WMOFActions.openTripLog('pointer');});
   await p.waitForFunction(()=>document.querySelector('#tripLogDialog').open);
   if(phase==='closing'){
    await p.waitForFunction(()=>document.querySelector('#app').dataset.tripListState==='open');
    await p.evaluate(()=>{void WMOFActions.closeTripLog();});
    await p.waitForFunction(()=>document.querySelector('#app').dataset.tripListState==='closing');
   }
   await p.evaluate(()=>document.querySelector('#tripLogDialog').close());
   await p.waitForFunction(()=>document.querySelector('#app').dataset.tripListState==='closed');
   await p.waitForTimeout(2600);
   const recovered=await p.locator('#tripLogButton').evaluate(e=>({floating:e.classList.contains('trip-log-floating'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,parent:e.parentElement.className,expanded:e.getAttribute('aria-expanded')}));
   assert.equal(recovered.floating,false,theme+' interrupted '+phase+' clears floating styles');
   assert.equal(recovered.width,recovered.height,JSON.stringify(recovered));assert.match(recovered.parent,/compact-action-right/);assert.equal(recovered.expanded,'false');
  }
 }
 await operation(()=>WMOFSeasonalTheme.setPreference('default',{persist:false}));
 const exiting=await p.evaluate(async()=>{const e=document.querySelector('#tripLogButton');getComputedStyle(e).opacity;document.querySelector('#tripLogPinButton').click();await new Promise(resolve=>requestAnimationFrame(resolve));getComputedStyle(e).opacity;const transitions=e.getAnimations().filter(a=>a.transitionProperty==='opacity'||a.transitionProperty==='visibility');if(!transitions.some(a=>a.transitionProperty==='opacity'))throw new Error('unpin did not create an opacity transition');for(const a of transitions){a.pause();a.currentTime=100;}const result={opacity:Number(getComputedStyle(e).opacity),visibility:getComputedStyle(e).visibility};for(const a of transitions)a.play();return result;});assert(exiting.opacity>0&&exiting.opacity<1&&exiting.visibility==='visible','unpin keeps painting during fade/scale exit '+JSON.stringify(exiting));await state('idle-unpinned',['newTripButton','idleBreakButton'],[]);await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());
 await operation(()=>document.querySelector('#clockTimer').start({standardTime:'0:30:00'}));
 await state('running',['endTripButton','breakButton','downButton'],['tripLogButton']);
 await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());await state('running-unpinned',['endTripButton','breakButton','downButton'],[]);await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());
 await operation(()=>document.querySelector('#clockTimer').startInterval('down'));
 await state('down',['downResumeButton','downBreakButton','downCancelButton'],['downDetailsButton','tripLogButton']);
 const held=await p.evaluate(()=>{
  WMOFCompactActions.render(document.querySelector('#app'),{controls:{busy:true,activeTripVisible:true,downVisiblePanel:false,breakLabel:null},clock:{},tripStatus:'running'});
  const visible=[...document.querySelectorAll('.compact-action-left > [data-compact-visible=true]')].map(e=>e.id).sort();
  const button=document.createElement('button');document.querySelector('.compact-action-left').append(button);const style=getComputedStyle(button),unconfigured={opacity:style.opacity,visibility:style.visibility};button.remove();return {visible,unconfigured};
 });
 assert.deepEqual(held.visible,['downResumeButton','downBreakButton','downCancelButton'].sort(),'intermediate Running must not expose unrelated handoff controls');
 assert.deepEqual(held.unconfigured,{opacity:'0',visibility:'hidden'},'unconfigured compact buttons never flash visible');
 await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());await state('down-unpinned',['downResumeButton','downBreakButton','downCancelButton'],['downDetailsButton']);await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());
 await operation(()=>WMOFActions.resumeTrip());
 await state('resumed-running',['endTripButton','breakButton','downButton'],['tripLogButton']);
 await operation(()=>WMOFActions.startDownTime());
 await operation(()=>WMOFActions.startBreak('lunch'));
 await state('lunch',['endTripButton'],['tripLogButton']);
 assert.match(await p.locator('.compact-interval-timer').textContent(),/Lunch Timer/);
 await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());
 await state('lunch-unpinned',['endTripButton'],[]);
 await p.evaluate(()=>document.querySelector('#tripLogPinButton').click());
 await p.locator('.compact-action-right #tripLogButton').click();await p.waitForFunction(()=>document.querySelector('#app').dataset.tripListState==='open');
 assert.equal(await p.locator('#tripLogDialog #tripLogButton').count(),1);assert.equal(await p.locator('#app').getAttribute('data-trip-log-pinned'),'true');
 await p.evaluate(()=>WMOFActions.closeTripLog());await p.waitForFunction(()=>document.querySelector('#app').dataset.tripListState==='closed');
 await state('lunch-closed',['endTripButton'],['tripLogButton']);
 await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:320,height:560});await state('short-break',['endTripButton'],['tripLogButton']);
 await p.evaluate(()=>document.querySelector('#actionDisplayFull').click());await p.waitForTimeout(2300);
 assert.equal(await p.locator('#breakEndRow #endTripButton').count(),1,'restores actual Full button');
 assert.equal(await operation(async()=>{await WMOFPersistence.flush();return WMOFPersistence.peek('wmof.clock.actionDisplay');}),'full');
 assert.deepEqual(f.errors,[]);console.log('PASS Compact real controls, independent centered columns, intervals, pin, log promotion/return, Full restoration and persisted preference');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
