const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const previous=process.env.CLOCKTIMER_SPEECH_RATE_WPM;
 try{for(const wpm of Object.values(require('./order-filler-master-plan.cjs').rates)){
  process.env.CLOCKTIMER_SPEECH_RATE_WPM=String(wpm);
  const f=await fixture({input:'audio',beforeAudioStart:async page=>{
   for(const [kind,value] of [['id','0042'],['pin','1234']]){
    for(let i=0;i<4;i++)await page.locator(`[data-login-digit="${kind}"][data-digit-index="${i}"]`).fill(value[i]);
    await page.locator('#loginButton').tap();if(kind==='id')await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
   }
   await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
  }});
  let failure;
  try{
   assert(await f.say('break start lunch okay'));
   await f.page.waitForFunction(()=>{
    const clock=document.querySelector('#clockTimer');return clock.breakOnly&&clock.getActiveIntervalState()?.intervalType==='lunch'&&!document.querySelector('#breakDialog').open;
   });
   assert.equal(await f.page.evaluate(()=>WMOFCoordinator.lockCount),0);
   assert.deepEqual(f.errors,[]);
   console.log(`PASS ${wpm} wpm: standalone lunch selected and confirmed; heard ${f.audioCases.at(-1).recognized}`);
  }catch(error){failure=error.message;throw error;}
  finally{
   const directory=path.join(__dirname,'artifacts/standalone-lunch');fs.mkdirSync(directory,{recursive:true});
   fs.writeFileSync(path.join(directory,wpm+'.json'),JSON.stringify({wpm,status:failure?'failed':'passed',failure,audioCases:f.audioCases},null,2));
   await f.close();
  }
 }}finally{if(previous===undefined)delete process.env.CLOCKTIMER_SPEECH_RATE_WPM;else process.env.CLOCKTIMER_SPEECH_RATE_WPM=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
