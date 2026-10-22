const assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const previous=process.env.CLOCKTIMER_SPEECH_RATE_WPM;
 try{for(const wpm of [240,160,90]){
  process.env.CLOCKTIMER_SPEECH_RATE_WPM=String(wpm);
  const f=await fixture({input:'audio',beforeAudioStart:async page=>{
   for(const [kind,value] of [['id','0042'],['pin','1234']]){
    for(let i=0;i<4;i++)await page.locator(`[data-login-digit="${kind}"][data-digit-index="${i}"]`).fill(value[i]);
    await page.locator('#loginButton').tap();
    if(kind==='id')await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
   }
   await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
   await page.locator('#newTripButton').tap();
   await page.waitForFunction(()=>WMOFVoiceEntry.active||document.querySelector('#numberPadDialog')?.open);
   if(await page.evaluate(()=>WMOFVoiceEntry.active))await page.locator('#voiceEntryTouch').tap();
   for(const digit of '10000')await page.locator(`#numberPadGrid [data-number="${digit}"]`).tap();
   await page.locator('#numberPadConfirm').tap();
   await page.waitForFunction(()=>document.querySelector('#clockTimer').status==='running');
  }});
  try{
   assert(await f.say('break start short break okay'));
   const heard=f.audioCases.at(-1).recognized;
   const interval=await f.page.evaluate(()=>document.querySelector('#clockTimer').getActiveIntervalState());
   assert.equal(interval?.intervalType,'break',`${wpm} wpm; heard ${heard}`);
   assert.equal(interval?.breakType,'short',`${wpm} wpm; heard ${heard}`);
   assert.equal(await f.page.evaluate(()=>document.querySelector('#breakDialog').open),false);
   assert.equal(await f.page.evaluate(()=>WMOFCoordinator.lockCount),0);
   assert.deepEqual(f.errors,[]);
   console.log(`PASS ${wpm} wpm: short break selected and confirmed; heard ${heard}`);
  }finally{await f.close();}
 }}finally{if(previous===undefined)delete process.env.CLOCKTIMER_SPEECH_RATE_WPM;else process.env.CLOCKTIMER_SPEECH_RATE_WPM=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
