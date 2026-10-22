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
  if(pathname==='/SpeechMenu.js')body=body.toString().replace(/\r\n/g,'\n').replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
  static testVoskBegin(){SpeechMenu.#beginUtterance(performance.now());}
  static testVoskFinish(){SpeechMenu.#finishUtterance('silence',true);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
  res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  page.on('console',message=>{if(message.type()==='error')console.error('BROWSER:',message.text());});
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.addInitScript(()=>{
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
    acceptWaveformFloat(){this.listeners.partialresult?.({result:{partial:this.tail}});}
    emit(text,endpoint=false){this.tail=endpoint?'':text;this.listeners[endpoint?'result':'partialresult']({result:endpoint?{text}:{partial:text}});}
    retrieveFinalResult(){this.emit(this.tail,true);}
    remove(){}
   }})};
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
  const begin=async()=>{const count=await page.evaluate(()=>voskDecoders.length);await page.evaluate(()=>SpeechMenu.testVoskBegin());await page.waitForFunction(count=>voskDecoders.length>count,count);};
  const speak=async(text,endpoint=false)=>{await page.evaluate(({text,endpoint})=>voskDecoders.at(-1).emit(text,endpoint),{text,endpoint});await page.waitForTimeout(80);};
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
  console.log('PASS Vosk in current UI: persistent capture, Ready handoff, endpoint continuation, shared duration collector and single dispatch');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
