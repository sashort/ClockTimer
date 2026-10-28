const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{
 const p=f.page,operation=require('./retained-page-operation.cjs')(p);
 await p.evaluate(()=>{window.overtimeSetup=(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();const Real=Date;window.overtimeNow=Date.now();window.Date=class extends Real{constructor(...a){super(...(a.length?a:[overtimeNow]));}static now(){return overtimeNow;}static [Symbol.hasInstance](v){return v instanceof Real;}};})().then(()=>{window.overtimeSetupDone=true;},error=>{window.overtimeSetupError=String(error.stack||error);});});await p.waitForFunction(()=>window.overtimeSetupDone||window.overtimeSetupError);assert.equal(await p.evaluate(()=>window.overtimeSetupError),undefined);
 const step=async ms=>{await p.evaluate(ms=>overtimeNow+=ms,ms);await p.clock.runFor(1200);};
 const check=async label=>{const data=await p.evaluate(()=>{const ranges=[...clockTimer.querySelectorAll('time-range')].filter(e=>!e.timeRangeExiting);return{arcs:ranges.filter(e=>e.getAttribute('type')==='overtime'&&e.clockTimerOverwrite===undefined).map(e=>({start:Number(e.clockTimerStart),end:Number(e.clockTimerEnd),animations:e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length})),pauses:ranges.filter(e=>e.clockTimerInserted!==undefined||e.clockTimerOverwrite!==undefined).map(e=>({start:Number(e.clockTimerStart),end:Number(e.clockTimerEnd)}))};});assert(data.arcs.length,label+' retains earned overtime');for(const arc of data.arcs){for(const pause of data.pauses)assert(Math.min(arc.end,pause.end)<=Math.max(arc.start,pause.start),label+' overtime cannot consume pause/overwrite: '+JSON.stringify({arc,pause}));assert.equal(arc.animations,0,label+' has no per-tick grow tween');}};
 for(const type of ['radial-overflow','radial-fitted']){
  await operation(type=>{clockTimer.setAttribute('timer-type',type);return clockTimer.start({standardTime:'0:02:00'});},type);
  await step(180000);await operation(()=>clockTimer.startInterval('break',60000,{},15000,15000));
  await step(5000);await check(type+' start buffer');
  await step(20000);await check(type+' break');
  await operation(()=>clockTimer.endInterval());await step(1000);await check(type+' early end');
  await p.evaluate(()=>clockTimer.restoreState(clockTimer.captureState()));
  for(let i=0;i<3;i++){await step(1000);await check(type+' restored tick '+i);}
  await step(90000);await check(type+' after original buffered boundary');
  await operation(()=>clockTimer.stop());
 }
 for(const type of ['radial-overflow','radial-fitted']){
  await operation(type=>{clockTimer.setAttribute('timer-type',type);clockTimer.configure({goal_type:'auto',trip_goal:'100%',total_goal:'40%',auto_goal:false});return clockTimer.start({standardTime:'0:22:56'});},type);await step(28*60000);
  assert.equal(await p.evaluate(()=>clockTimer.getUIState().effective_goal_type),'total','Auto falls back to the lower aggregate goal');
  const ranges=await p.evaluate(()=>{return [...clockTimer.querySelectorAll('time-range')].filter(e=>e.timeRangeExiting!==true&&['overtime','remaining'].includes(e.getAttribute('type'))).map(e=>({type:e.getAttribute('type'),start:Number(e.clockTimerStart),end:Number(e.clockTimerEnd)}));});
  const horizon=await p.evaluate(()=>{const start=clockTimer.captureState().events.find(e=>e.event==='trip.started');return overtimeNow-Date.parse(start.value.creationAnchor);});
  assert(ranges.some(r=>r.type==='overtime'),type+' shows earned overtime');assert(ranges.every(r=>r.end<=horizon+1000),type+' cannot draw future aggregate overtime/remaining rings '+JSON.stringify({ranges,horizon}));
  await p.evaluate(()=>clockTimer.restoreState(clockTimer.captureState()));await step(1000);
  const future=await p.evaluate(horizon=>[...clockTimer.querySelectorAll('time-range[type=overtime],time-range[type=remaining]')].filter(e=>e.timeRangeExiting!==true&&Number(e.clockTimerEnd)>horizon+2000).length,horizon);assert.equal(future,0,type+' reload cannot recreate aggregate future rings');await operation(()=>clockTimer.stop());
 }
 assert.deepEqual(f.errors,[]);console.log('PASS overtime excludes break/buffers and early-start spans, including restored overflow/fitted tick geometry');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
