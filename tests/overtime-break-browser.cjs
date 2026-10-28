const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{
 const p=f.page;
 await p.evaluate(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();const Real=Date;window.overtimeNow=Date.now();window.Date=class extends Real{constructor(...a){super(...(a.length?a:[overtimeNow]));}static now(){return overtimeNow;}static [Symbol.hasInstance](v){return v instanceof Real;}};});
 const step=async ms=>{await p.evaluate(ms=>overtimeNow+=ms,ms);await p.clock.runFor(1200);};
 const check=async label=>{const data=await p.evaluate(()=>{const ranges=[...clockTimer.querySelectorAll('time-range')].filter(e=>!e.timeRangeExiting);return{arcs:ranges.filter(e=>e.getAttribute('type')==='overtime'&&e.clockTimerOverwrite===undefined).map(e=>({start:Number(e.clockTimerStart),end:Number(e.clockTimerEnd),animations:e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length})),pauses:ranges.filter(e=>e.clockTimerInserted!==undefined||e.clockTimerOverwrite!==undefined).map(e=>({start:Number(e.clockTimerStart),end:Number(e.clockTimerEnd)}))};});assert(data.arcs.length,label+' retains earned overtime');for(const arc of data.arcs){for(const pause of data.pauses)assert(Math.min(arc.end,pause.end)<=Math.max(arc.start,pause.start),label+' overtime cannot consume pause/overwrite: '+JSON.stringify({arc,pause}));assert.equal(arc.animations,0,label+' has no per-tick grow tween');}};
 for(const type of ['radial-overflow','radial-fitted']){
  await p.evaluate(type=>{clockTimer.setAttribute('timer-type',type);return clockTimer.start({standardTime:'0:02:00'});},type);
  await step(180000);await p.evaluate(()=>clockTimer.startInterval('break',60000,{},15000,15000));
  await step(5000);await check(type+' start buffer');
  await step(20000);await check(type+' break');
  await p.evaluate(()=>clockTimer.endInterval());await step(1000);await check(type+' early end');
  await p.evaluate(()=>clockTimer.restoreState(clockTimer.captureState()));
  for(let i=0;i<3;i++){await step(1000);await check(type+' restored tick '+i);}
  await step(90000);await check(type+' after original buffered boundary');
  await p.evaluate(()=>clockTimer.stop());
 }
 assert.deepEqual(f.errors,[]);console.log('PASS overtime excludes break/buffers and early-start spans, including restored overflow/fitted tick geometry');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
