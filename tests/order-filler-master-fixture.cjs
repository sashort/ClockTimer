const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
function instrument(pathname,source,acoustic=false){
 if(pathname==='/api/audio/AudioEngine.js')source=source.toString()+`\nWMOFAudio.speak=(text,options={})=>{(globalThis.handoffAudio ||= []).push('speech:'+text);queueMicrotask(()=>options.onEnd?.());return true;};WMOFAudio.startSong=async name=>{(globalThis.handoffAudio ||= []).push('chime:'+name);return {hasChime:true,finished:Promise.resolve()};};`;
 if(pathname==='/app.js')source=source.toString().replace('const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;','const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 0;').replace('    document.dispatchEvent(new Event("clocktimer-app-ready"));','    globalThis.testWaitForFeedback=async()=>{await microphoneFeedbackCompletion;while(semanticAnnouncementDraining || semanticAnnouncementQueue.pointer<semanticAnnouncementQueue.length)await new Promise(resolve=>setTimeout(resolve,10));};\n    document.dispatchEvent(new Event("clocktimer-app-ready"));');
 if(pathname==='/SharedModal.js'&&process.env.DISABLE_SHARED_MODAL)source='';
 if(pathname==='/SpeechMenu.js'&&!acoustic)source=source.toString().replace(/\r\n/g,'\n').replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;',()=>`\nstatic testActivate(){SpeechMenu.#modelReady=true;SpeechMenu.#executionEnabled=true;SpeechMenu.#sleeping=false;SpeechMenu.#stopped=false;SpeechMenu.#stream={getTracks(){return [];}};SpeechMenu.#recognizer={beginUtterance(){},abortUtterance(){},finishUtterance(id){const u=SpeechMenu.#utterance?.id===id?SpeechMenu.#utterance:SpeechMenu.#finishedUtterances.get(id);setTimeout(()=>SpeechMenu.#onSherpaTranscript({detail:{utteranceId:id,transcript:u?.transcript||"",isFinal:true}}),10);}};}\nstatic async testSayAfterSilence(text){SpeechMenu.#beginUtterance(performance.now());const u=SpeechMenu.#utterance;await SpeechMenu.#handleLiveTranscript(u,text,false);await u.digestQueue;u.continuationPauseStartedAt=performance.now()-SpeechMenu.#continuationGraceMilliseconds();SpeechMenu.#armContinuationPauseDeadline(u);await new Promise(resolve=>setTimeout(resolve,250));await u.digestQueue;await u.segmentBarrier;return !u.digestExecutionFailed&&!u.digestFailed;}\nstatic async testSay(text,wpm=0){SpeechMenu.#beginUtterance(performance.now());const u=SpeechMenu.#utterance;const words=text.split(/\\s+/);const trace={text,wpm,partials:[]};(globalThis.masterSpeechInputs ||= []).push(trace);for(let i=0;i<(wpm?words.length:1);i++){const partial=wpm?words.slice(0,i+1).join(" "):text;trace.partials.push({text:partial,at:performance.now()});await SpeechMenu.#handleLiveTranscript(u,partial,!wpm||i===words.length-1);await u.digestQueue;if(wpm&&i<words.length-1)await new Promise(resolve=>setTimeout(resolve,60000/wpm));}await u.segmentBarrier;return !u.digestExecutionFailed;}\n}\n\nglobalThis.SpeechMenu = SpeechMenu;\nSpeechMenu.start=async()=>{SpeechMenu.testActivate();SpeechMenu.events.dispatchEvent(new Event('started'));return true;};`);
 return source;
}
function createServer(acoustic){return http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
 let source=fs.readFileSync(file);
 res.end(instrument(pathname,source,acoustic));
});}

module.exports=async function createMasterFixture({input='transcript'}={}){
 if(!['audio','transcript'].includes(input))throw Error('Choose audio or explicitly select transcript simulation');
 const acoustic=input==='audio';
 const locale=process.env.CLOCKTIMER_TEST_LOCALE||'en-US',profile=require('./languages/'+locale+'/profile.cjs');
 if(acoustic&&!profile.acoustic)throw Error('No reviewed acoustic test profile for '+locale);
 const {DiagnosticSpeechAudio}=require('./diagnostic-speech-audio.cjs');
 const server=createServer(acoustic);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required'],...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});

 try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});const errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('browser error:',m.text());});
  // Install before app timers are registered so virtual advancement controls every tick.
  await page.clock.install();
  if(acoustic)await DiagnosticSpeechAudio.install(page);
  await page.addInitScript(()=>{if('serviceWorker' in navigator)Object.defineProperty(navigator.serviceWorker,'register',{value:async()=>{throw new Error('Service worker disabled in isolated regression fixture');}});window.testShadows=new WeakMap();const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const result=attach.call(this,options);testShadows.set(this,result);return result;};});
  if(process.env.ORDER_FILLER_TEST_BASE_URL)await page.route('**/*',async route=>{const pathname=new URL(route.request().url()).pathname;if(!pathname.endsWith('.js'))return route.fallback();const response=await route.fetch();const body=instrument(pathname,await response.text(),acoustic);if(pathname==='/SpeechMenu.js'&&!acoustic)assert(body.includes('static testActivate()'),'Remote SpeechMenu hook boundary is missing');await route.fulfill({response,body});});
  await page.route('**/api/**',r=>new URL(r.request().url()).pathname.endsWith('.js')?r.fallback():r.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules:{weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'}}],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[]}}));
  const base=process.env.ORDER_FILLER_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
  const url=new URL('order-filler.php',base);if(process.env.CLOCKTIMER_TEST_LOCALE)url.searchParams.set('lang',process.env.CLOCKTIMER_TEST_LOCALE);
  await page.goto(url.href);
  if(process.env.CLOCKTIMER_TEST_LOCALE)assert.equal((await page.locator('html').getAttribute('lang')).toLowerCase(),process.env.CLOCKTIMER_TEST_LOCALE.toLowerCase(),'server must render the requested locale');
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
  await page.waitForTimeout(1000);
  if(!acoustic){
  assert(await page.evaluate(()=>typeof SpeechMenu.testActivate==='function'),'SpeechMenu test hook must attach to the served runtime');
  await page.evaluate(async()=>{SpeechMenu.testActivate();await WMOFActions.handleSpeechRuntimeStarted();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();});
  }else{
   await page.evaluate(async()=>{
    globalThis.acousticSpeechEvents=[];globalThis.acousticRuntime=null;
    SpeechMenu.events.addEventListener('started',event=>{acousticRuntime=event.detail;});
    for(const type of ['speechTranscriptScoped','utteranceStarted','utteranceFinished','utteranceCommitted','speechRecognitionFailed'])SpeechMenu.events.addEventListener(type,event=>acousticSpeechEvents.push({type,...event.detail}));
    if(!await SpeechMenu.start(document.documentElement.lang||'en-US'))throw Error('Real speech runtime did not start');
    await WMOFActions.handleSpeechRuntimeStarted();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();
   });
  }
  await page.waitForTimeout(1100);
  if(acoustic)assert.equal(await page.evaluate(()=>WMOF_SPEECH_BACKEND),profile.acoustic.backend,'audio diagnostics use the configured recognizer');
  if(acoustic&&profile.acoustic.backend==='vosk')assert(await page.evaluate(archive=>new URL(WMOF_VOSK_CONFIG.modelUrl).pathname.endsWith('/'+archive),profile.acoustic.modelArchive),'audio diagnostics use the reviewed model');
  const wpm=Number(process.env.CLOCKTIMER_SPEECH_RATE_WPM)||0;
  const textSay=text=>page.evaluate(({text,wpm})=>Promise.race([SpeechMenu.testSay(text,wpm),new Promise((_,reject)=>setTimeout(()=>reject(new Error('speech stalled: '+text)),20000))]),{text,wpm});


 const audioCases=[];
 const audio=acoustic?new DiagnosticSpeechAudio({locale,voice:profile.acoustic.voice,wpm:wpm||160}):null;
 if(audio)await audio.ready;
 const say=acoustic?async text=>{
  const clip=await audio.render(text),start=await page.evaluate(()=>acousticSpeechEvents.length);
  const entry={key:clip.key,text,wpm:clip.wpm,file:clip.file,sha256:clip.sha256,durationMilliseconds:clip.durationMilliseconds,events:[],recognized:''};audioCases.push(entry);
  try{
   await page.evaluate(base64=>diagnosticsAudioInput.play(base64),clip.wav.toString('base64'));
   await page.waitForFunction(start=>acousticSpeechEvents.slice(start).some(e=>(e.type==='speechTranscriptScoped'&&e.isFinal)||(e.type==='utteranceFinished'&&e.committed)||e.type==='speechRecognitionFailed'),start,{timeout:15000});
   await page.waitForFunction(()=>WMOFCoordinator.lockCount===0&&WMOFStateTransactions.pending.length===0,null,{timeout:15000});
  }finally{
   entry.events=await page.evaluate(start=>acousticSpeechEvents.slice(start),start).catch(()=>[]);
   const transcripts=entry.events.filter(e=>e.type==='speechTranscriptScoped');
   entry.recognized=transcripts.filter(e=>e.isFinal).map(e=>e.transcript).join(' | ')||transcripts.at(-1)?.transcript||'';
  }
  return entry.events.some(e=>e.type==='speechTranscriptScoped'&&e.transcript?.trim())&&!entry.events.some(e=>e.type==='speechRecognitionFailed');
 }:textSay;
 return {page,browser,errors,say,audioCases,input,recognizer:acoustic?profile.acoustic.backend:null,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
 }catch(error){await browser.close();await new Promise(resolve=>server.close(resolve));throw error;}
};
