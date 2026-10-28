const assert = require('node:assert/strict');
const fixture = require('./order-filler-master-fixture.cjs');
(async () => {
 const f = await fixture({input:'transcript'});
 try {
  const p=f.page;
  await p.evaluate(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();document.querySelector('#percentageDisplayBar').click();});
  const snapshot=()=>p.evaluate(()=>{const s=clockTimer.uiState,current=s.goal_bar.nodes.find(n=>n.current),marker=document.querySelector('.goal-bar-node.is-current:not([aria-hidden=true])');return{trip:s.trip_active,paused:s.paused,time:s.time_component,bar:current,rendered:document.querySelector('#renderedTimeValue').textContent,marker:marker?.querySelector('path')?.getAttribute('d'),percent:marker?.querySelector('.goal-bar-percent')?.textContent,runner:document.querySelector('.goal-bar-avatar')?.dataset.mode,summary:clockTimer.getSummarySnapshot().trip};});
  for(const type of ['break','lunch','short break']){
   await p.evaluate(()=>clockTimer.start({standardTime:'0:02:00'}));
   await p.clock.runFor(10000);
   await p.evaluate(type=>clockTimer.startInterval(type==='lunch'?'lunch':'break',900000,{breakType:type==='short break'?'short':'break'},15000,15000),type);
   await p.clock.runFor(3000);
   assert.equal(await p.evaluate(()=>clockTimer.getUIState().interval_state.phase),'start-buffer');
   await p.evaluate(()=>clockTimer.endInterval());
   await p.clock.runFor(1500);
   let s=await snapshot();
   assert(s.trip&&!s.paused,type+' resumes the active trip');
   assert(s.bar.unbounded&&s.bar.counted_position<0,type+' retains signed credit');
   assert.equal(s.summary.countedTimeElapsedMilliseconds,0,'persisted counted duration remains nonnegative');
   assert.equal(s.percent,'\u2014','undefined percentage does not become a fabricated finite value');
   assert.match(s.marker,/M -3.*M 3/,'Current double line remains visible');
   assert.equal(s.runner,'running','runner returns after standing up');
   for(const mode of ['remaining','elapsed','calculated-end']){
    await p.evaluate(mode=>clockTimer.renderedTimeMode=mode,mode);
    await p.clock.runFor(1200);const before=await snapshot();
    await p.clock.runFor(3000);const after=await snapshot();
    assert.notEqual(after.time.text,before.time.text,type+' '+mode+' continues ticking');
    assert.equal(after.rendered,after.bar.time,'top readout and Current agree');
    assert.equal(after.rendered,after.time.text,'DOM reflects current state');
    if(mode==='remaining')assert(after.time.value>120000,'remaining includes unused credit');
    if(mode==='elapsed')assert(after.time.value<0&&after.time.text.startsWith('-'),'elapsed exposes the signed balance');
   }
   await p.evaluate(()=>{const state=clockTimer.captureState();clockTimer.restoreState(state);clockTimer.renderedTimeMode='remaining';});
   await p.clock.runFor(1500);s=await snapshot();assert(s.bar.unbounded&&s.marker,'reload/replay preserves credited Current');
   await p.evaluate(()=>clockTimer.stop());await p.clock.runFor(2500);
  }
  assert.deepEqual(f.errors,[]);
  console.log('PASS early break completion inside start buffer: Current, runner, signed tick readouts, and replay');
 } finally {await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
