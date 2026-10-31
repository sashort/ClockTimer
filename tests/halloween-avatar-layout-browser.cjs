const assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await op(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();await WMOFSeasonalTheme.setPreference('halloween',{persist:false});document.querySelector('#percentageDisplayBar').click();await clockTimer.start({standardTime:'0:30:00'});});
for(const height of [560,844])for(const layout of ['full','compact']){
 await p.setViewportSize({width:390,height});await op(async layout=>{document.querySelector(layout==='full'?'#actionDisplayFull':'#actionDisplayCompact').click();await WMOFLayoutMotion.whenSettled();},layout);
 for(const interval of [null,'break','down']){
  if(interval)await op(type=>clockTimer.startInterval(type,type==='break'?900000:undefined),interval);
  await p.waitForTimeout(1500);
  const bounds=await p.evaluate(()=>{const svg=document.querySelector('.goal-bar-svg'),box=svg.getBoundingClientRect(),row=document.querySelector('.percent-summary').getBoundingClientRect(),controls=document.querySelector('.trip-action-controls').getBoundingClientRect();return{height:box.height,bottom:box.top+Number(svg.dataset.visibleBottom),slotBottom:box.bottom,rowBottom:row.bottom,controlsTop:controls.top,scale:document.querySelector('.goal-bar-avatar-size').getAttribute('transform')};});
  assert.equal(bounds.scale,'scale(2)');assert(bounds.bottom<=bounds.slotBottom+1,JSON.stringify({height,layout,interval,bounds}));
  if(layout==='full')assert(bounds.bottom<=bounds.controlsTop-3,JSON.stringify({height,layout,interval,bounds}));
  if(interval)await op(()=>clockTimer.endInterval());
 }
}
assert.deepEqual(f.errors,[]);console.log('PASS doubled Halloween figure and labels fit Full/Compact Bar slots at short/tall heights during running, Break and Down');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
