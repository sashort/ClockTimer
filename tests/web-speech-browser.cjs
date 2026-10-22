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
  await page.goto(new URL('order-filler.php',base).href);
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
  await page.evaluate(()=>{
   globalThis.webSpeechTestCalls=0;globalThis.webSpeechTestTranscripts=[];globalThis.webSpeechTestEvents=[];
   for(const type of ["speechRecognitionAlternatives","utteranceStarted","utteranceUnrecognized","speechMenuCommandError","speechRecognitionFailed","speechTranscriptScoped"])SpeechMenu.events.addEventListener(type,e=>webSpeechTestEvents.push({type,...e.detail}));
   globalThis.WebSpeechTest={command(){webSpeechTestCalls++;return true;}};
   const command=document.createElement('speech-command');
   command.setAttribute('speech-pattern','^diagnostic command$');
   command.setAttribute('speech-function','WebSpeechTest.command');command.setAttribute('speech-modal','system');document.body.append(command);
   SpeechMenu.events.addEventListener('utteranceTranscriptChanged',event=>webSpeechTestTranscripts.push(event.detail.transcript));
   SpeechMenu.refresh();nativeSpeechInstances.at(-1).emit(['diagnostic demand','diagnostic command'],false);
  });
  try{await page.waitForFunction(()=>webSpeechTestCalls===1,null,{timeout:5000});}catch(error){console.error(errors,await page.evaluate(()=>({events:webSpeechTestEvents,enabled:SpeechMenu.executionEnabled,suspended:SpeechMenu.listeningSuspended,muted:SpeechMenu.muted})));throw error;}
  assert.equal(await page.evaluate(()=>nativeSpeechInstances.at(-1).results.at(-1).isFinal),false,'complete terminal command executes before final recognition');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['diagnostic demand','diagnostic command'],true));
  assert(await page.evaluate(()=>webSpeechTestTranscripts.includes('diagnostic command')),'Mic Bar transcript events use the selected API result');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).onresult?.({resultIndex:0,results:nativeSpeechInstances.at(-1).results}));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>webSpeechTestCalls),1,'final result not replayed');
  await page.evaluate(()=>{
   const command=document.createElement('speech-command');
   command.setAttribute('speech-pattern','^continuation command(?: details)?$');
   command.setAttribute('speech-function','WebSpeechTest.command');command.setAttribute('speech-modal','system');document.body.append(command);
   SpeechMenu.refresh();nativeSpeechInstances.at(-1).emit(['continuation command'],false);
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>webSpeechTestCalls),1,'a possible continuation keeps collecting');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['continuation command details'],false));
  await page.waitForFunction(()=>webSpeechTestCalls===2);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['continuation command details'],true));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>webSpeechTestCalls),2,'final confirmation cannot repeat interim execution');
  await page.evaluate(()=>SpeechMenu.sleep());
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['diagnostic command']));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>webSpeechTestCalls),2,'sleep blocks ordinary commands');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).onend?.());
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'muted','native restart preserves the sleeping indicator');
  assert.equal(await page.evaluate(()=>webSpeechShadows.get(document.querySelector('#speechMicBar')).textContent.includes('browser-listening')),false,'native status is not rendered as a transcript');
  await page.evaluate(()=>SpeechMenu.wake());
  await page.evaluate(()=>nativeSpeechInstances.at(-1).onend?.());
  await page.waitForFunction(()=>SpeechMenu.captureListening);
  assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'listening','native restart updates the listening indicator');
  const beforeRecovery=await page.evaluate(()=>nativeSpeechInstances.length);
  await page.evaluate(()=>{webSpeechAudioReady=false;nativeSpeechInstances.at(-1).onerror({error:'network'});});
  assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'reconnecting','capture loss clears the listening indicator immediately');
  await page.waitForFunction(count=>nativeSpeechInstances.length>count,beforeRecovery);
  assert.equal(await page.evaluate(()=>SpeechMenu.captureListening),false,'service start without audio is not listening');
  assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'reconnecting');
  await page.evaluate(()=>{webSpeechAudioReady=true;nativeSpeechInstances.at(-1).onaudiostart();});
  await page.waitForFunction(()=>SpeechMenu.captureListening);
  assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'listening');
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['diagnostic command'],true));
  await page.waitForFunction(()=>webSpeechTestCalls===3);
  await page.evaluate(()=>{
   WebSpeechTest.delayed=()=>new Promise(resolve=>{globalThis.finishDelayedCommand=resolve;});
   const command=document.createElement('speech-command');
   command.setAttribute('speech-pattern','^delayed command$');
   command.setAttribute('speech-function','WebSpeechTest.delayed');
   command.setAttribute('speech-modal','system');document.body.append(command);SpeechMenu.refresh();
   nativeSpeechInstances.at(-1).emit(['delayed command'],false);
  });
  await page.waitForFunction(()=>typeof finishDelayedCommand==='function');
  assert(await page.evaluate(()=>webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#activity').textContent.includes('delayed command')),'validated transcript remains visible while action completion is pending');
  const pendingSession=await page.evaluate(()=>nativeSpeechInstances.length);
  await page.evaluate(()=>{const native=nativeSpeechInstances.at(-1);native.emit(['delayed command'],true);native.onend?.();});
  await page.waitForFunction(count=>nativeSpeechInstances.length>count&&SpeechMenu.captureListening,pendingSession);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['diagnostic command'],true));
  try{await page.waitForFunction(()=>webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#activity').textContent.includes('delayed command diagnostic command'),null,{timeout:5000});}catch(error){console.error(await page.evaluate(()=>({events:webSpeechTestEvents.slice(-20),text:webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#activity').textContent,state:WMOFInteractionState.state,nativeId:SpeechMenu.started})));throw error;}
  assert.equal(await page.evaluate(()=>webSpeechTestCalls),3,'new capture can buffer a command without running ahead of pending work');
  await page.evaluate(()=>finishDelayedCommand(true));
  await page.waitForFunction(()=>webSpeechTestCalls===4);
  assert(await page.evaluate(()=>webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#activity').textContent.includes('delayed command diagnostic command')),'buffer text survives capture restart and pending execution');
  await page.evaluate(()=>SpeechMenu.stop());
  assert.equal(await page.evaluate(()=>SpeechMenu.started),false);
  assert.deepEqual(requests.filter(p=>/VoskRecognizer|VoskTestConfig|PocketSphinxRecognizer|SherpaRecognizer|SileroVad|SpeechAssetCacheWorker|\.wasm$|vosk-model/.test(p)),[],'no local recognition backend loads');
  assert.deepEqual(errors,[]);
  console.log('PASS browser-owned Web Speech startup, N-best command selection, Mic Bar transcript, final once, sleep boundary and zero local-model requests (simulated native results)');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
