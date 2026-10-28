const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  for(const scenario of (process.argv.length>2?process.argv.slice(2):['overtime','down','down-after-overtime'])){
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.clock.install({time:new Date('2026-10-15T16:00:00Z')});
    await page.setContent('<!doctype html><style>clock-timer{display:block;width:400px;height:400px}</style><clock-timer id="clock" timer-type="radial-fitted"></clock-timer>');
    await page.evaluate(()=>{window.fetch=async()=>new Response('{}',{status:401});});
    for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])await page.addScriptTag({content:fs.readFileSync(path.join(root,`${name}.js`),'utf8')});
    await page.evaluate(async()=>{
     const apply=RingContainer.prototype.applyRangeLayout;
     RingContainer.prototype.applyRangeLayout=function(range,layout,...rest){range.testLayout=layout;return apply.call(this,range,layout,...rest)};
     await clock.start({standardTimeMilliseconds:40000});
    });
    await page.clock.runFor(scenario==='down'?20000:43000);
    if(scenario!=='overtime')await page.evaluate(()=>clock.startInterval('down'));
    await page.clock.runFor(1200);
    await page.evaluate(()=>{
     window.mismatches=[];window.sampleCount=0;
     window.sampleTimer=setInterval(()=>{
      const ranges=[...clock.querySelectorAll('time-range')].filter(r=>!r.timeRangeExiting&&Number.isFinite(Number(r.clockTimerEnd)));
      const fitted=ranges.filter(r=>!['elapsed','remaining','wave'].includes(r.getAttribute('type')));
      // Down extends the calculated trip end beyond the currently rendered
      // base segments. The trip arc exposes that authoritative fitted scale.
      const bounds=fitted.find(r=>r.getAttribute('type')==='trip')?.testLayout?.fittedBounds;
      const {start,end}=bounds||{};
      if(!(end>start))return;
      for(const r of fitted){
       if(!r.testLayout)continue;
       const expectedStart=Math.max(0,Math.min(360,360*(Number(r.clockTimerStart)-start)/(end-start)));
       const expectedEnd=Math.max(0,Math.min(360,360*(Number(r.clockTimerEnd)-start)/(end-start)));
       const error=Math.max(Math.abs(r.testLayout.startAngle-expectedStart),Math.abs(r.testLayout.endAngle-expectedEnd));
       if(error>.01&&window.mismatches.length<20)window.mismatches.push({type:r.getAttribute('type'),error,actual:[r.testLayout.startAngle,r.testLayout.endAngle],expected:[expectedStart,expectedEnd]});
      }
      window.sampleCount++;
     },16);
    });
    await page.clock.runFor(3200);
    const result=await page.evaluate(()=>{clearInterval(window.sampleTimer);return{mismatches:window.mismatches,samples:window.sampleCount,state:clock.uiState.state}});
    assert(result.samples>100,'sample multiple animation frames across successive ticks');
    assert.deepEqual(result.mismatches,[],`${scenario}: every arc must share the fitted projection throughout each tick`);
    if(scenario==='overtime'){
     await page.evaluate(()=>{
      window.editAngles=[];
      const apply=RingContainer.prototype.applyRangeLayout;
      RingContainer.prototype.applyRangeLayout=function(range,layout,...rest){
       if(range.getAttribute('type')==='trip'&&!range.timeRangeExiting)window.editAngles.push(layout.endAngle);
       return apply.call(this,range,layout,...rest);
      };
      clock.setAttribute('trip-goal','80%');
     });
     await page.clock.runFor(160);
     const lowerGoal=await page.evaluate(()=>{const anchor=Date.parse(clock.captureState().events.find(e=>e.event==='trip.started').value.creationAnchor),now=Date.now()-anchor;return{now,ranges:[...clock.querySelectorAll('time-range[type=overtime],time-range[type=remaining]')].filter(r=>!r.timeRangeExiting).map(r=>Number(r.clockTimerEnd))};});
     assert(lowerGoal.ranges.every(end=>end<=lowerGoal.now+1000),'a lower goal cannot animate future aggregate time into the fitted clock');
     // Test a genuine upcoming goal edit on a fresh running trip. A goal
     // already missed during overtime does not create a new future arc.
     await page.evaluate(async()=>{await clock.stop();clock.configure({goal_type:'trip',trip_goal:'100%',auto_goal:false});await clock.start({standardTimeMilliseconds:40000});});
     await page.clock.runFor(1200);
     await page.evaluate(()=>{window.editAngles=[];clock.setAttribute('trip-goal','120%');});
     await page.clock.runFor(160);
     const angles=await page.evaluate(()=>window.editAngles);
     assert(new Set(angles.map(a=>a.toFixed(3))).size>2,'goal changes that alter trip/tolerance geometry still animate through intermediate arc sizes');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS fitted ${scenario} keeps all arcs on one scale without per-tick regrowth`);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
