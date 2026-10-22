// Integration contract only: native results are simulated, not acoustic evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.addInitScript(()=>{
   globalThis.nativeSpeechInstances=[];globalThis.captureCalls=0;globalThis.webSpeechAudioReady=true;
   globalThis.webSpeechShadows=new WeakMap();const attach=Element.prototype.attachShadow;
   Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);webSpeechShadows.set(this,shadow);return shadow;};
   if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{captureCalls++;throw Error('Web Speech must own capture');};
   globalThis.SpeechRecognition=class {
    constructor(){nativeSpeechInstances.push(this);this.results=[];}
    start(){queueMicrotask(()=>{this.onstart?.();if(webSpeechAudioReady)this.onaudiostart?.();});}
    stop(){queueMicrotask(()=>this.onend?.());}
    abort(){}
    emit(texts,final=true){
     const result=Object.assign(texts.map((transcript,i)=>({transcript,confidence:1-i*.1})),{isFinal:final});
     if(this.results.at(-1)?.isFinal===false)this.results[this.results.length-1]=result;else this.results.push(result);
     this.onresult?.({resultIndex:this.results.length-1,results:this.results});
    }
   };
  });
  await page.route('**/api/**',async route=>{
   if(new URL(route.request().url()).pathname.endsWith('.js'))return route.fallback();
   return route.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[]}});
  });
  await page.route('**/api/audio/AudioEngine.js*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:await response.text()+`\nWMOFAudio.speak=(text,options={})=>{queueMicrotask(()=>options.onEnd?.());return true;};WMOFAudio.startSong=async()=>({hasChime:true,finished:Promise.resolve()});`});
  });
  const base=process.env.ORDER_FILLER_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
  if(process.env.CLOCKTIMER_TEST_EXPECTED_COMMIT){
   const response=await page.request.get(new URL('build-version.json',base).href);
   assert(response.ok());assert.equal((await response.json()).commit,process.env.CLOCKTIMER_TEST_EXPECTED_COMMIT,'deployed commit matches checkout');
  }
  await page.goto(new URL('order-filler.php?speech-backend=web-speech',base).href);
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
  assert.equal(await page.evaluate(()=>WMOF_SPEECH_BACKEND),'web-speech');
  for(let i=0;i<4;i++)await page.locator(`[data-login-digit="id"][data-digit-index="${i}"]`).fill('0042'[i]);
  await page.locator('#loginButton').click();
  await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
  for(let i=0;i<4;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('1234'[i]);
  await page.locator('#loginButton').click();
  await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);

  assert(await page.evaluate(()=>SpeechMenu.start('en-US')),'browser speech starts');
  await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);
  assert.equal(await page.evaluate(()=>nativeSpeechInstances.at(-1).maxAlternatives),10);
  assert.equal(await page.evaluate(()=>captureCalls),0);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['ready'],true));
  await page.waitForFunction(()=>WMOFVoiceEntry.active);
  await page.evaluate(()=>{globalThis.valueDispatches=[];SpeechMenu.events.addEventListener('speechCommandDispatched',e=>valueDispatches.push({action:e.detail.commandElement?.getAttribute('speech-function'),text:e.detail.transcript}));});
  const scenarios=[
   {name:'cumulative duration interims',chunks:[['an hour',false],['an hour and',false],['an hour and five',false],['an hour and five',true]]},
   {name:'separate final duration slots',chunks:[['an hour',true],['and five',true]]},
   {name:'duration interim across capture restart',chunks:[['an hour',false,'restart'],['and five',true]]},
   {name:'duration across capture restart',chunks:[['an hour',true,'restart'],['and five',true]]}
  ];
  for(const scenario of scenarios){
   const before=await page.evaluate(()=>valueDispatches.filter(e=>e.action==='WMOFActions.handleVoiceEntrySpeech').length);
   for(const [text,final,restart] of scenario.chunks){
    await page.evaluate(({text,final})=>nativeSpeechInstances.at(-1).emit([text],final),{text,final});
    await page.waitForTimeout(80);
    if(text==='an hour')assert.notEqual(await page.locator('#voiceEntryValue').textContent(),'1:00:00',scenario.name+': parseable prefix stays uncommitted');
    if(restart){const count=await page.evaluate(()=>nativeSpeechInstances.length);await page.evaluate(()=>nativeSpeechInstances.at(-1).onend?.());await page.waitForFunction(count=>nativeSpeechInstances.length>count&&SpeechMenu.captureListening,count);}
   }
   await page.waitForFunction(before=>valueDispatches.filter(e=>e.action==='WMOFActions.handleVoiceEntrySpeech').length===before+1,before,{timeout:5000});
   assert.equal(await page.locator('#voiceEntryValue').textContent(),'1:05:00');
   console.log('PASS '+scenario.name);
  }
  await page.evaluate(()=>{globalThis.valueRejections=[];SpeechMenu.events.addEventListener('utteranceUnrecognized',e=>valueRejections.push(e.detail));});
  const acceptedBeforeInvalid=await page.evaluate(()=>valueDispatches.length);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['an hour and'],true));
  await page.waitForFunction(()=>valueRejections.length>0,null,{timeout:5000});
  assert.equal(await page.evaluate(()=>valueDispatches.length),acceptedBeforeInvalid,'unfinished value cannot apply its valid hour prefix');
  assert.equal(await page.locator('#voiceEntryValue').textContent(),'1:05:00');
  console.log('PASS incomplete duration is rejected as a whole');
  const beforeBoundary=await page.evaluate(()=>valueDispatches.filter(e=>e.action==='WMOFActions.handleVoiceEntrySpeech').length);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['an hour'],true));
  await page.waitForTimeout(80);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['and five log'],true));
  await page.waitForFunction(()=>document.querySelector('#tripLogDialog').open,null,{timeout:5000});
  assert.equal(await page.evaluate(()=>valueDispatches.filter(e=>e.action==='WMOFActions.handleVoiceEntrySpeech').length),beforeBoundary+1,'next command supplies one explicit value boundary');
  assert.equal(await page.locator('#voiceEntryValue').textContent(),'1:05:00');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['close'],true));
  await page.waitForFunction(()=>!document.querySelector('#tripLogDialog').open);
  console.log('PASS value defers to a following root command');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['cancel'],true));
  await page.waitForFunction(()=>!WMOFVoiceEntry.active);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['ready at five'],true));
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#scheduledStartDialog').evaluate(e=>e.open),false,'a finalized clock prefix stays collecting');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['thirty'],true));
  await page.waitForFunction(()=>document.querySelector('#scheduledStartDialog').open,null,{timeout:5000});
  const clock=await page.evaluate(()=>valueDispatches.filter(e=>e.action==='WMOFActions.scheduleStartAt'));
  assert.equal(clock.length,1,'clock collection dispatches once');
  assert.equal(clock[0].text,'ready at 5:30');
  console.log('PASS scheduled clock across final slots');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>SpeechMenu.stop());
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
