// Integration contract: actual Vosk adapter, simulated decoder words; not an acoustic accuracy test.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
  let body=fs.readFileSync(file);
  // Decoder words and silence boundaries are injected explicitly. Chromium's
  // unrelated periodic fake-microphone beeps must not end those scripted words.
  if(pathname==='/SpeechMenu.js')body=body.toString().replace(/\r\n/g,'\n')
   .replace('        const samples =\n            data.samples;', '        const samples =\n            data.samples;\n        void SpeechMenu.#recognizer?.acceptAudio(samples).catch(()=>{}); return;')
   .replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
  static testVoskBegin(){SpeechMenu.#beginUtterance(performance.now());}
  static testVoskFinish(){SpeechMenu.#finishUtterance('silence',true);}
  static testVoskSilence(){const u=SpeechMenu.#utterance;u.continuationPauseStartedAt=performance.now()-10000;SpeechMenu.#armContinuationPauseDeadline(u);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
  res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  page.on('console',message=>{if(message.type()==='error')console.error('BROWSER:',message.text());});
  const errors=[],requests=[];page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE:',error.message);});page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.addInitScript(()=>{
   // Exercise the continuous-adapter collector contract; context routing has its own tests.
   globalThis.WMOF_VOSK_CONFIG={contextHandoff:false};
   globalThis.voskDecoders=[];globalThis.captureCalls=0;
   if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>{throw Error('Asset cache disabled in deterministic fixture');};
   globalThis.voskShadows=new WeakMap();const attach=Element.prototype.attachShadow;
   Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);voskShadows.set(this,shadow);return shadow;};
   const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{captureCalls++;return getUserMedia(constraints);};
   globalThis.Vosk={createModel:async()=>({terminate(){},KaldiRecognizer:class {
    constructor(...args){if(args.length!==1)throw Error('Unexpected grammar');this.listeners={};this.tail='';voskDecoders.push(this);}
    on(event,fn){this.listeners[event]=fn;}
    setWords(){}
    setMaxAlternatives(){}
    acceptWaveformFloat(){this.listeners.partialresult?.({result:{partial:this.tail}});}
    emit(text,endpoint=false){this.tail=endpoint?'':text;this.listeners[endpoint?'result':'partialresult']({result:endpoint?{text}:{partial:text}});}
    retrieveFinalResult(){this.emit(this.tail,true);}
    remove(){}
   }})};
  });
  await page.route('**/api/**',async route=>{
   if(new URL(route.request().url()).pathname.endsWith('.js'))return route.fallback();
   return route.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[],aggregateBreakdown:{production:{tripCount:1,standardTimeMilliseconds:600000,actualTimeMilliseconds:300000,countedTimeMilliseconds:300000},nonProduction:{trips:[]}}}});
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
  await page.goto(new URL('order-filler.php?speech-backend=vosk',base).href);
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
  assert.equal(await page.evaluate(()=>WMOF_SPEECH_BACKEND),'vosk');
  for(let i=0;i<4;i++)await page.locator(`[data-login-digit="id"][data-digit-index="${i}"]`).fill('0042'[i]);
  await page.locator('#loginButton').click();
  await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
  for(let i=0;i<4;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('1234'[i]);
  await page.locator('#loginButton').click();
  await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);

  assert(await page.evaluate(()=>SpeechMenu.start('en-US')));
  await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);
  const tracks=await page.evaluate(()=>captureCalls);
  const begin=async()=>{await page.evaluate(()=>SpeechMenu.testVoskBegin());await page.waitForTimeout(100);};
  const speak=async(text,endpoint=false)=>{await page.evaluate(({text,endpoint})=>voskDecoders.at(-1).emit(text,endpoint),{text,endpoint});await page.waitForTimeout(80);};
  await page.evaluate(()=>SpeechMenu.sleep());
  await begin();await speak('wake');
  assert.equal(await page.evaluate(()=>SpeechMenu.muted),true,'Wake partial cannot enable unrelated commands');
  await speak('wake',true);await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>!SpeechMenu.muted);
  await begin();await speak('ready');await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>WMOFVoiceEntry.active);
  await page.evaluate(()=>{globalThis.valueDispatches=[];SpeechMenu.events.addEventListener('speechCommandDispatched',e=>valueDispatches.push(e.detail.transcript));});
  await begin();const count=await page.evaluate(()=>voskDecoders.length);
  await speak('an hour',true);
  assert.notEqual(await page.locator('#voiceEntryValue').textContent(),'1:00:00','endpoint is not a value boundary');
  await speak('and five');
  assert.equal(await page.evaluate(()=>voskDecoders.length),count,'same decoder across duration continuation');
  await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>document.querySelector('#voiceEntryValue').textContent==='1:05:00');
  assert.equal(await page.evaluate(()=>valueDispatches.length),1,'duration dispatches once');
  assert.equal(await page.evaluate(()=>captureCalls),tracks,'capture stays open across utterances');
  await begin();await speak('cancel');await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>!WMOFVoiceEntry.active);
  const beforeGoalDispatches=await page.evaluate(()=>valueDispatches.length);
  await begin();await speak('day goal one',true);await speak('twelve');
  assert.notEqual(await page.locator('#clockTimer').getAttribute('total-goal'),'112%','endpoint does not commit a partial percentage');
  await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>document.querySelector('#clockTimer').getAttribute('total-goal')==='112%');
  assert.equal(await page.evaluate(()=>valueDispatches.length)-beforeGoalDispatches,1,'native endpoint keeps leading one and dispatches once');
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').syncOverride),false,'override defaults off');
  for (const [words,expected] of [['sync override on',true],['sync override',true],['sync override off',false]]) {
   await begin();await speak(words);
   if(words==='sync override') {await page.evaluate(()=>SpeechMenu.testVoskSilence());await page.waitForFunction(()=>valueDispatches.includes('sync override'));}
   else await page.evaluate(()=>SpeechMenu.testVoskFinish());
   await page.waitForFunction(expected=>document.querySelector('#clockTimer').syncOverride===expected,expected);
   assert.equal(await page.locator('#syncOverrideButton').getAttribute('aria-checked'),String(expected));
  }
  await begin();await speak('sync on');
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').autoSyncTripGoal),false,'Sync On holds its possible Override continuation');
  await speak('sync on override');await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>document.querySelector('#clockTimer').syncOverride&&document.querySelector('#clockTimer').autoSyncTripGoal);
  assert.equal(await page.locator('#syncOverrideButton').getAttribute('aria-checked'),'true');
  assert(await page.locator('#syncOverrideButton').isDisabled(),'unavailable Sync leaves override visibly disabled');
  await page.waitForFunction(()=>!SpeechMenu.commandBufferSnapshot.some(e=>['queued','executing'].includes(e.status))&&WMOFCoordinator.pending.length===0&&WMOFCoordinator.lockCount===0);
  await page.evaluate(async()=>{
   const timer=document.querySelector('#clockTimer');
   timer.configure({trip_goal:'100%',total_goal:'100%'});
   globalThis.testStartPhase='totals';await timer.calculateTripTotals('2026-01-01T00:00:00Z','2027-01-01T00:00:00Z');
   globalThis.testStartPhase='start';await timer.start({standardTime:'0:20:00'});
   globalThis.testStartPhase='started';
   timer.configure({auto_goal:true,sync_override:true});
  }).catch(async error=>{console.error(await page.evaluate(()=>({phase:testStartPhase,status:document.querySelector('#clockTimer').status,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.id),locks:WMOFCoordinator.lockCount,pending:WMOFCoordinator.pending.map(e=>({action:e.action,name:e.name,status:e.status})),buffer:SpeechMenu.commandBufferSnapshot.map(e=>({text:e.transcript,status:e.status}))})));throw error;});
  await page.waitForFunction(()=>!document.querySelector('#syncOverrideButton').disabled);
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').syncBelowFloor),true);
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').calculatedTripGoal),.8);
  await page.locator('#syncOverrideButton').evaluate(button=>button.click());
  await page.waitForFunction(()=>!document.querySelector('#clockTimer').syncOverride);
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').calculatedTripGoal),1,'touch restores goal floor');
  await page.locator('#syncOverrideButton').evaluate(button=>button.click());
  await page.waitForFunction(()=>document.querySelector('#clockTimer').syncOverride);
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').calculatedTripGoal),.8,'touch override recalculates');
  await begin();await speak('break start');
  await page.evaluate(()=>SpeechMenu.testVoskSilence());
  await page.waitForFunction(()=>document.querySelector('#breakDialog').open);
  await begin();await speak('cancel');await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>!document.querySelector('#breakDialog').open);
  await page.evaluate(async()=>{const timer=document.querySelector('#clockTimer');await timer.stop();await timer.clear();});
  await begin();await speak('break start');
  assert.equal(await page.locator('#breakDialog').evaluate(e=>e.open),false,'chain opener remains pending');
  await speak('break start lunch');
  assert.equal(await page.locator('#breakDialog').evaluate(e=>e.open),false,'selector presentation stays deferred during the related chain');
  assert.equal(await page.evaluate(()=>document.querySelector('#clockTimer').breakOnly),false,'break choice waits for confirmation');
  await speak('break start lunch okay');await page.evaluate(()=>SpeechMenu.testVoskFinish());
  await page.waitForFunction(()=>document.querySelector('#clockTimer').breakOnly);
  assert.equal(await page.evaluate(()=>captureCalls),tracks,'capture survives break chain UI transitions');
  assert(!requests.some(path=>/VoskGrammarRouter|VoskPhraseListCompiler/.test(path)),'no grammar router loads');
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>SpeechMenu.stop());
  console.log('PASS Vosk in current UI: persistent capture, Ready handoff, endpoint continuation, shared duration collector and single dispatch, adaptive silence and Sync Override voice/touch recalculation');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
