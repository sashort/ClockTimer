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
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const report={note:'Desktop Chromium mobile emulation; no Android OS keyboard. Controlled visual-height changes are synthetic, not a reproduction on the affected device.',scenarios:[]};
 try {
  for(const fullscreen of [false,true]) {
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/**',route=>new URL(route.request().url()).pathname.endsWith('.js')?route.continue():route.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[]}}));
   await page.goto(`http://127.0.0.1:${server.address().port}/order-filler.php`);
   await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
   await page.addScriptTag({path:path.join(root,'scripts/login-viewport-diagnostics.js')});
   await page.evaluate(async()=>{SpeechMenu.testActivate();await WMOFActions.handleSpeechRuntimeStarted();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();});
   await page.waitForTimeout(1200);
   if(fullscreen){await page.locator('#loginButton').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.waitForTimeout(400);}
   await page.locator('[data-login-digit="id"]').first().focus();
   const duringLogin=[];
   for(const height of [600,844]){
    await page.setViewportSize({width:390,height});await page.waitForTimeout(350);
    duringLogin.push(await page.evaluate(()=>LoginViewportDiagnostics.capture('id-entry-real-window-resize')));
   }
   const say=text=>page.evaluate(text=>SpeechMenu.testSay(text),text);
   await say('zero zero four two okay');
   await page.locator('[data-login-digit="pin"]').first().focus();
   for(const height of [600,844]){
    await page.setViewportSize({width:390,height});await page.waitForTimeout(350);
    duringLogin.push(await page.evaluate(()=>LoginViewportDiagnostics.capture('pin-entry-real-window-resize')));
   }
   await say('one two three four okay');
   await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
   await page.waitForTimeout(1300);
   const baseline=await page.evaluate(()=>LoginViewportDiagnostics.capture('after-login-settled'));
   assert(baseline.belowMic>=0&&baseline.belowMic<=10,JSON.stringify(baseline));
   assert(Math.abs(baseline.belowApp)<2,JSON.stringify(baseline));
   const scenario={fullscreen,baseline,duringLogin};
   if(fullscreen){
    await page.evaluate(()=>{window.diagnosticVisualHeight=500;Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>diagnosticVisualHeight});visualViewport.dispatchEvent(new Event('resize'));});
    await page.waitForTimeout(250);
    scenario.syntheticReduced=await page.evaluate(()=>LoginViewportDiagnostics.capture('synthetic-visual-height-500'));
    // Restore the metric without a notification, to test the stale-measurement hypothesis.
    await page.evaluate(()=>{diagnosticVisualHeight=844;});
    await page.waitForTimeout(1200);
    scenario.syntheticMissingEvent=await page.evaluate(()=>LoginViewportDiagnostics.capture('synthetic-restore-without-resize'));
    assert(scenario.syntheticMissingEvent.belowMic>300,'Synthetic stale viewport must reproduce a gap');
    await page.evaluate(()=>visualViewport.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(250);
    scenario.syntheticRecovery=await page.evaluate(()=>LoginViewportDiagnostics.capture('synthetic-restored-resize'));
    assert(Math.abs(scenario.syntheticRecovery.belowMic-baseline.belowMic)<2,'Resize notification recovers');
    await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
    await page.waitForTimeout(250);
    // Separate a raised mic from a shortened app: vary each real container's
    // bounds independently while leaving viewport and app height intact.
    scenario.containerCaps=[];
    for(const selector of ['body','html']){
     await page.evaluate(selector=>{document.querySelector(selector).style.height='700px';document.querySelector('#speechMicBar').refreshLayout();},selector);
     await page.waitForTimeout(100);
     const snapshot=await page.evaluate(selector=>LoginViewportDiagnostics.capture('synthetic-'+selector+'-height-cap'),selector);
     assert.equal(snapshot.app.height,844,'Container cap leaves app full height');
     assert(snapshot.belowMic>140,'Container cap independently raises mic');
     scenario.containerCaps.push(snapshot);
     await page.evaluate(selector=>{document.querySelector(selector).style.removeProperty('height');document.querySelector('#speechMicBar').refreshLayout();},selector);
    }
    await page.waitForTimeout(250);
    scenario.finalRecovery=await page.evaluate(()=>LoginViewportDiagnostics.capture('all-controlled-overrides-removed'));
    assert(Math.abs(scenario.finalRecovery.belowMic-baseline.belowMic)<2);

   }
   scenario.timeline=await page.evaluate(()=>LoginViewportDiagnostics.report());
   assert.deepEqual(errors,[]);report.scenarios.push(scenario);await page.close();
  }
  const target=path.join(root,'tests/artifacts/login-viewport-diagnostics.json');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log('PASS login geometry baseline with/without real fullscreen; controlled stale-visual-height mechanism and event recovery. Report: '+target);
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
