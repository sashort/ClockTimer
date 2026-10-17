const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'OwnedFeedbackScope.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'SpeechContinuationSession.js'),'utf8')});
  const result=await page.evaluate(async()=>{
   const session=new SpeechContinuationSession({id:'native-timers',surfaces:['voicepad']});
   let expired=0,feedback=0;
   session.observe('ready');session.deferFeedback('prompt',()=>feedback++);
   session.armSilence(5,()=>expired++);session.cancelSilence();
   session.armSilence(15,()=>{expired++;session.settle(true);});
   if(!session.transfer('duration','voicepad'))throw Error('transfer failed');
   await new Promise(resolve=>setTimeout(resolve,40));
   session.cancel();session.armSilence(0,()=>expired++);
   return {expired,feedback,phase:session.phase};
  });
  assert.deepEqual(result,{expired:1,feedback:1,phase:'cancelled'});assert.deepEqual(errors,[]);
  console.log('PASS actual browser timer receivers: silence arm/cancel/rearm, surface transfer, settlement and feedback');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
