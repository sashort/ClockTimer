const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
 let source=fs.readFileSync(file);
 if(pathname==='/api/audio/AudioEngine.js')source=source.toString()+`\nWMOFAudio.speak=(text,options={})=>{(globalThis.handoffAudio ||= []).push('speech:'+text);queueMicrotask(()=>options.onEnd?.());return true;};WMOFAudio.startSong=async name=>{(globalThis.handoffAudio ||= []).push('chime:'+name);return {hasChime:true,finished:Promise.resolve()};};`;
 if(pathname==='/app.js')source=source.toString().replace('const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;','const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 0;').replace('    document.dispatchEvent(new Event("clocktimer-app-ready"));','    globalThis.testWaitForFeedback=async()=>{await microphoneFeedbackCompletion;while(semanticAnnouncementDraining || semanticAnnouncementQueue.pointer<semanticAnnouncementQueue.length)await new Promise(resolve=>setTimeout(resolve,10));};\n    document.dispatchEvent(new Event("clocktimer-app-ready"));');
 if(pathname==='/SharedModal.js'&&process.env.DISABLE_SHARED_MODAL)source='';
 if(pathname==='/SpeechMenu.js')source=source.toString().replace(/\r\n/g,'\n').replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;',()=>`\nstatic testActivate(){SpeechMenu.#modelReady=true;SpeechMenu.#executionEnabled=true;SpeechMenu.#sleeping=false;SpeechMenu.#stopped=false;SpeechMenu.#stream={getTracks(){return [];}};SpeechMenu.#recognizer={beginUtterance(){},abortUtterance(){},finishUtterance(id){const u=SpeechMenu.#utterance?.id===id?SpeechMenu.#utterance:SpeechMenu.#finishedUtterances.get(id);setTimeout(()=>SpeechMenu.#onSherpaTranscript({detail:{utteranceId:id,transcript:u?.transcript||"",isFinal:true}}),10);}};}\nstatic async testSayAfterSilence(text){SpeechMenu.#beginUtterance(performance.now());const u=SpeechMenu.#utterance;await SpeechMenu.#handleLiveTranscript(u,text,false);await u.digestQueue;u.continuationPauseStartedAt=performance.now()-SpeechMenu.#continuationGraceMilliseconds();SpeechMenu.#armContinuationPauseDeadline(u);await new Promise(resolve=>setTimeout(resolve,250));await u.digestQueue;await u.segmentBarrier;return !u.digestExecutionFailed&&!u.digestFailed;}\nstatic async testSay(text){SpeechMenu.#beginUtterance(performance.now());const u=SpeechMenu.#utterance;await SpeechMenu.#handleLiveTranscript(u,text,true);await u.digestQueue;await u.segmentBarrier;return !u.digestExecutionFailed;}\n}\n\nglobalThis.SpeechMenu = SpeechMenu;\nSpeechMenu.start=async()=>{SpeechMenu.testActivate();SpeechMenu.events.dispatchEvent(new Event('started'));return true;};`);
 res.end(source);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.testShadows=new WeakMap();const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const result=attach.call(this,options);testShadows.set(this,result);return result;};});
  await page.route('**/api/**',r=>new URL(r.request().url()).pathname.endsWith('.js')?r.continue():r.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules:{weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'}}],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[]}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/order-filler.php`);
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
  await page.waitForTimeout(1000);
  await page.evaluate(async()=>{SpeechMenu.testActivate();await WMOFActions.handleSpeechRuntimeStarted();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();});
  await page.waitForTimeout(1100);
  const say=text=>page.evaluate(text=>Promise.race([SpeechMenu.testSay(text),new Promise((_,reject)=>setTimeout(()=>reject(new Error('speech stalled: '+JSON.stringify({text,pending:WMOFStateTransactions.pending,locks:WMOFCoordinator.lockCount,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}))),5000))]),text);
  await say('zero zero four two okay');await say('one two three four okay');
  await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
  assert(await page.evaluate(()=>SpeechMenu.testSayAfterSilence('ready')));assert(await page.evaluate(()=>WMOFVoiceEntry.active&&WMOFCoordinator.lockCount===0&&WMOFStateTransactions.pending.length===0),'first Ready after login opens and settles');
  await say('twenty two fifty six');assert.equal(await page.evaluate(()=>WMOFInteractionState.state.editor.value),'2256');
  assert(await page.evaluate(()=>WMOFVoiceEntry.active&&WMOFCoordinator.lockCount===0),'separate duration remains accepted without a lock');
  await say('okay');
  await page.waitForFunction(()=>document.querySelector('#clockTimer').status==='running');
  assert(await page.evaluate(()=>SpeechMenu.testSayAfterSilence('ready')),'Ready after silence ends the running trip');
  await page.waitForFunction(()=>document.querySelector('#tripTransitionOverlay').open);
  assert(await page.evaluate(()=>document.querySelector('#clockTimer').status==='ready'&&WMOFCoordinator.lockCount===0&&WMOFStateTransactions.pending.length===0),'trip summary is an owned Ready transition with no cancellation or stranded locks');
  await page.waitForFunction(()=>document.querySelector('#tripTransitionOverlay .trip-summary-table'));
  assert.equal(await page.locator('#tripTransitionOverlay [data-trip-summary-row="active"]').count(),0);
  assert(await page.locator('#tripTransitionSummaryOk').isVisible());
  assert(!await page.locator('#tripTransitionSummaryCancel').isVisible());
  const summaryBounds=await page.evaluate(()=>{const panel=document.querySelector('.trip-transition-overlay-panel');return {inner:panel.clientWidth,scroll:panel.scrollWidth};});
  assert(summaryBounds.scroll<=summaryBounds.inner+1,'summary table fits mobile panel '+JSON.stringify(summaryBounds));
  if(process.env.SUMMARY_SCREENSHOT_DIR){fs.mkdirSync(process.env.SUMMARY_SCREENSHOT_DIR,{recursive:true});await page.locator('.trip-transition-overlay-panel').screenshot({path:path.join(process.env.SUMMARY_SCREENSHOT_DIR,'trip-summary-mobile.png'),animations:'disabled'});}
  await say('cancel');

  for(const id of ['tripTransitionOverlay','loginDialog','voiceEntrySurface','tripLogDialog']){
   await page.evaluate(id=>{for(const d of document.querySelectorAll('dialog[open]'))if(d.id!==id)d.close();const d=document.getElementById(id);d.hidden=false;if(!d.open)d.showModal();},id);
   await page.waitForTimeout(300);
   for(const expected of [true,false]){
    const point=await page.evaluate(()=>{const bar=document.querySelector('#speechMicBar'),r=testShadows.get(bar).querySelector('#mic').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>SpeechMenu.muted),expected,id+' microphone responds to a real tap through the managed dialog '+JSON.stringify(await page.evaluate(({x,y})=>{const b=document.querySelector('#speechMicBar');return {parent:b.parentElement.id,started:SpeechMenu.started,state:b.state,active:b.dataset.speechActive,hidden:b.hidden,opacity:getComputedStyle(b).opacity,point:[x,y],hit:document.elementFromPoint(x,y)?.id,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)};},point)));
   }
  }
  await page.evaluate(()=>document.querySelector('#tripLogDialog').close());await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.querySelector('#speechMicBar').parentElement.id),'app');
  assert(await page.evaluate(()=>document.querySelector('#speechMicBar') instanceof SharedModal),'mic inherits the shared UI base');
  assert(await page.evaluate(()=>document.querySelector('trip-log-modal') instanceof SharedModal),'Trip Log UI inherits the shared base');
  await page.evaluate(async()=>{window.sleepCommandActions=[];SpeechMenu.events.addEventListener('speechCommandDispatched',event=>sleepCommandActions.push(event.detail.commandElement.getAttribute('speech-function')));document.querySelector('#speechMicBar').collapseOptions();await SpeechMenu.sleep();});
  await say('commands');assert.equal(await page.evaluate(()=>document.querySelector('#speechMicBar').optionsOpen),false,'spoken Commands cannot open a closed list while sleeping');
  assert.deepEqual(await page.evaluate(()=>sleepCommandActions),[],'sleeping speech does not dispatch Commands');
  const optionsToggle=await page.evaluateHandle(()=>testShadows.get(document.querySelector('#speechMicBar')).querySelector('#optionsClose'));
  await optionsToggle.asElement().tap();await page.waitForTimeout(800);
  assert(await page.evaluate(()=>SpeechMenu.muted&&document.querySelector('#speechMicBar').optionsOpen),'a real touch may open Commands without waking recognition');
  await optionsToggle.asElement().tap();await optionsToggle.dispose();
  await say('wake');assert.equal(await page.evaluate(()=>SpeechMenu.muted),false,'spoken Wake is still accepted');
  await say('commands');assert(await page.evaluate(()=>document.querySelector('#speechMicBar').optionsOpen),'spoken Commands returns after Wake');
  await page.evaluate(()=>document.querySelector('#speechMicBar').collapseOptions());
  await page.evaluate(()=>testWaitForFeedback());
  await page.evaluate(async()=>{
   window.handoffAudio=[];window.handoffConfirmed=[];
   window.WMOFAudio={speak(text,options={}){handoffAudio.push('speech:'+text);if(window.holdMicFeedback&&text==='Microphone activated.')window.finishMicSpeech=()=>options.onEnd?.();else queueMicrotask(()=>options.onEnd?.());return true;},async startSong(name){handoffAudio.push('chime:'+name);return {hasChime:true,finished:window.holdMicFeedback&&name==='microphone-activated'?new Promise(resolve=>window.finishMicChime=resolve):Promise.resolve()};}};
   await WMOFVoiceEntry.open({mode:'duration',source:'handoff-test',initialValue:600000,confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{handoffConfirmed.push(value);return true;}});
   await WMOFActions.handleVoiceEntrySpeech('00:22:56');
  });
  // Use a real touch action after layout settles; wake may await AudioContext.resume().
  const tapMic=async()=>{const handle=await page.evaluateHandle(()=>testShadows.get(document.querySelector('#speechMicBar')).querySelector('#mic'));try{await handle.asElement().tap();}finally{await handle.dispose();}};
  await tapMic();await page.waitForFunction(()=>document.querySelector('#numberPadDialog')?.open&&!WMOFVoiceEntry.active);
  assert.deepEqual(await page.evaluate(()=>({value:WMOFInteractionState.state.editor.value,source:WMOFInteractionState.state.editor.source,mode:WMOFInteractionState.state.editor.mode})),{value:'2256',source:'handoff-test',mode:'duration'});
  await page.waitForFunction(()=>handoffAudio.some(s=>s==='speech:Switched to number pad.'));
  const off=await page.evaluate(()=>handoffAudio.slice());assert(off.indexOf('chime:microphone-deactivated')<off.indexOf('speech:Microphone deactivated.'),JSON.stringify(off));assert(off.indexOf('speech:Microphone deactivated.')<off.indexOf('speech:Switched to number pad.'));
  const reset=await page.locator('#numberPadReset').boundingBox();await page.touchscreen.tap(reset.x+reset.width*.75,reset.y+reset.height*.75);assert.equal(await page.evaluate(()=>WMOFInteractionState.state.editor.value),'1000','original value survives the switch');
  await page.evaluate(()=>{handoffAudio.length=0;window.holdMicFeedback=true;});await tapMic();await page.waitForFunction(()=>document.querySelector('#voiceInputSwitchDialog').open);
  await page.waitForFunction(()=>typeof finishMicChime==='function');
  assert(!await page.evaluate(()=>handoffAudio.includes('speech:Switch to voice input?')),'question waits for mic chime completion');
  await page.evaluate(()=>finishMicChime());await page.waitForFunction(()=>typeof finishMicSpeech==='function');
  assert(!await page.evaluate(()=>handoffAudio.includes('speech:Switch to voice input?')),'question also waits for mic speech completion');
  await page.evaluate(()=>{window.holdMicFeedback=false;finishMicSpeech();});
  await page.waitForFunction(()=>handoffAudio.includes('speech:Switch to voice input?'));
  const on=await page.evaluate(()=>handoffAudio.slice());assert(on.indexOf('chime:microphone-activated')<on.indexOf('speech:Microphone activated.'));assert(on.indexOf('speech:Microphone activated.')<on.indexOf('speech:Switch to voice input?'));
  await page.locator('#voiceInputSwitchCancel').click();assert(await page.evaluate(()=>document.querySelector('#numberPadDialog').open&&!WMOFVoiceEntry.active));
  await tapMic();await tapMic();await page.waitForFunction(()=>document.querySelector('#voiceInputSwitchDialog').open);
  assert(await say('cancel'),'spoken Cancel dismisses only the switch prompt');
  assert(await page.evaluate(()=>document.querySelector('#numberPadDialog').open&&!WMOFVoiceEntry.active));
  await tapMic();await tapMic();await page.waitForFunction(()=>document.querySelector('#voiceInputSwitchDialog').open);
  assert(await say('okay'),'spoken OK transfers to voice');
  await page.waitForFunction(()=>WMOFVoiceEntry.active&&!document.querySelector('#numberPadDialog').open);
  assert.equal(await page.evaluate(()=>WMOFInteractionState.state.editor.value),'1000');
  await say('eleven minutes');
  await tapMic();await page.waitForFunction(()=>document.querySelector('#numberPadDialog').open&&!WMOFVoiceEntry.active);
  await page.locator('#numberPadConfirm').click();await page.waitForFunction(()=>handoffConfirmed.length===1);
  assert.deepEqual(await page.evaluate(()=>handoffConfirmed),[660000],'confirmation callback survives both input modes');
  assert.equal(await page.evaluate(()=>WMOFCoordinator.lockCount),0);
  await page.evaluate(()=>document.querySelector('#loginDialog').showModal());await page.waitForTimeout(100);
  await page.locator('#loginButton').click();await page.waitForTimeout(300);
  assert(await page.evaluate(()=>Boolean(document.fullscreenElement)),'login activation enters real browser fullscreen');
  if(await page.evaluate(()=>SpeechMenu.muted))await tapMic();
  const viewportSession=await page.context().newCDPSession(page);
  for(const height of [600,844,720,844]){
   // Simulate mobile viewport changes without resizing a fullscreen desktop window.
   await viewportSession.send("Emulation.setDeviceMetricsOverride",{width:390,height,deviceScaleFactor:1,mobile:true});await page.waitForTimeout(200);
   const m=await page.evaluate(()=>{const app=document.querySelector('#app'),d=document.querySelector('#loginDialog'),bar=document.querySelector('#speechMicBar');return {height:app.getBoundingClientRect().height,viewport:visualViewport.height,bottom:d.getBoundingClientRect().bottom,safe:bar.getSafeTop(),micWidth:bar.getBoundingClientRect().width,width:visualViewport.width};});
   assert(Math.abs(m.height-m.viewport)<1,JSON.stringify(m));
   assert(m.bottom<=m.safe-7,JSON.stringify(m));
   assert(m.micWidth>=m.width-24,JSON.stringify(m));
   await tapMic();await page.waitForFunction(()=>SpeechMenu.muted,{},{timeout:5000});await tapMic();await page.waitForFunction(()=>!SpeechMenu.muted,{},{timeout:5000});
  }
  await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(100);
  assert.deepEqual(errors,[]);console.log('PASS first Ready after login, separate duration, mobile modal mic taps, preserved editor session, spoken/button choices, feedback completion barriers and fullscreen resizing');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
