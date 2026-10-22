const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const previous=process.env.CLOCKTIMER_SPEECH_RATE_WPM;
 try{for(const wpm of [240,160,90]){
  process.env.CLOCKTIMER_SPEECH_RATE_WPM=String(wpm);
  const f=await fixture({input:'audio',beforeAudioStart:async page=>{
   // Touch login isolates root-command recognition from the separate PIN workflow.
   for(const [kind,value] of [['id','0042'],['pin','1234']]){
    for(let i=0;i<4;i++)await page.locator(`[data-login-digit="${kind}"][data-digit-index="${i}"]`).fill(value[i]);
    await page.locator('#loginButton').tap();
    if(kind==='id')await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
   }
   await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
  }});
  try{
   await f.page.locator('#scopeToggle').tap();
   await f.page.locator('#scopeToggleDropdown [data-mode="year"]').tap();
   assert.equal(await f.page.evaluate(()=>document.querySelector('#clockTimer').percentMode),'total');
   assert(await f.say('trip mode'));
   const heard=f.audioCases.at(-1).recognized;
   assert.equal(await f.page.evaluate(()=>document.querySelector('#clockTimer').percentMode),'trip',`${wpm} wpm: trip mode; heard ${heard}`);
   assert(await f.say('trip goal one hundred ten percent'));
   assert.equal(await f.page.evaluate(()=>document.querySelector('#clockTimer').uiState.trip_goal_component.value),1.1,
    `${wpm} wpm: 110 percent; heard ${f.audioCases.at(-1).recognized}`);
   assert(await f.say('trip goal'));
   assert.equal(await f.page.evaluate(()=>document.querySelector('#clockTimer').uiState.trip_goal_component.value),1.1,'goal readback does not change the value');
   assert.equal(await f.page.evaluate(()=>WMOFCoordinator.lockCount),0);
   assert.deepEqual(f.errors,[]);
   console.log(`PASS ${wpm} wpm: trip mode; heard ${heard}`);
  }catch(error){require('node:fs').writeFileSync(require('node:path').join(__dirname,'artifacts/command-head-failure.json'),JSON.stringify({wpm,audioCases:f.audioCases},null,2));throw error;}finally{await f.close();}
 }}finally{if(previous===undefined)delete process.env.CLOCKTIMER_SPEECH_RATE_WPM;else process.env.CLOCKTIMER_SPEECH_RATE_WPM=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
