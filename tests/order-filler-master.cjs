const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./order-filler-master-fixture.cjs');
const reporter = require('./diagnostics-reporter.cjs').sharedReporter();

module.exports = async function runMaster(method) {
 const f = await fixture({input:method==='voice'?(process.env.CLOCKTIMER_VOICE_INPUT||'audio'):'transcript'}), {page} = f;
 const diagnostics=require('./diagnostics-reporter.cjs');
 diagnostics.setCheckpointHooks(new (require('./browser-test-pause.cjs'))(page));
 const steps = [];
 let currentStep='initialization';
 let audioStart=0;
 let failure=null;
 const evidence=()=>({inputLayer:method==='touch'?'press':f.input,recognizer:f.recognizer||undefined,audioClips:f.audioCases.slice(audioStart).map(({key,text,wpm,recognized,source})=>({key,text,wpm,recognized,source}))});
 const delivery=process.env.CLOCKTIMER_SPEECH_DELIVERY||'press';
 const requestedLocale=process.env.CLOCKTIMER_TEST_LOCALE||'en-US';
 const profile=require(path.join(__dirname,'languages',requestedLocale,'profile.cjs'));
 const corpus=require(path.resolve(__dirname,'languages',requestedLocale,profile.workflowCorpus));
 const phrase=text=>{assert.equal(typeof corpus.phrases[text],'string','locale corpus phrase: '+text);return corpus.phrases[text];};
 const locale=(process.env.CLOCKTIMER_TEST_LOCALE||'en-US').toLowerCase();
 const out = path.join(__dirname, 'artifacts', 'language-tests',locale,'order-filler', method,delivery,...(method==='voice'?[f.input]:[]));
 fs.mkdirSync(out, {recursive:true});
 const tap = selector => page.locator(selector).tap();
 const wait = predicate => page.waitForFunction(predicate);
 const state = expression => page.evaluate(expression);
 const check = async (label, operation) => {
  await require('./diagnostics-reporter.cjs').checkpoint();
  currentStep=label;audioStart=f.audioCases.length;const started=Date.now();
  console.log('RUN '+method+': '+label);
  await operation();
  await page.waitForFunction(() => WMOFCoordinator.lockCount === 0 && WMOFStateTransactions.pending.length === 0);
  assert.deepEqual(f.errors, [], label+': browser errors');
  steps.push(label);
  await reporter.tests([{label:method+': '+label,status:'passed',elapsedMs:Date.now()-started,...evidence()}]);
 };
 const say = async text => assert(await f.say(phrase(text)), 'speech failed: '+text);
 const touchPad = async () => {
  await wait(()=>WMOFVoiceEntry.active || document.querySelector('#numberPadDialog')?.open);
  if(await state(()=>WMOFVoiceEntry.active))await tap('#voiceEntryTouch');
 };
 const action = async (selector, phrase) => method === 'voice' ? say(phrase) : tap(selector);
 try {
  await check('ID and PIN login', async () => {
   if (method === 'voice') {await say('zero zero four two okay');await wait(()=>!document.querySelector('#loginPinRow').hidden);await say('one two three four okay');}
   else {
    for (const [kind,value] of [['id','0042'],['pin','1234']]) {
     for (let i=0;i<4;i++) await page.locator(`[data-login-digit="${kind}"][data-digit-index="${i}"]`).fill(value[i]);
     await tap('#loginButton');
    }
   }
   await wait(()=>!document.querySelector('#loginDialog').open);
  });
  for (const mode of ['day','week','pay-period','month','year','trip','auto']) {
   await check('goal mode '+mode, async () => {
    if (method==='voice') await say((mode==='pay-period'?'money':mode)+' mode');
    else {await tap('#scopeToggle');await tap(`#scopeToggleDropdown [data-mode="${mode}"]`);}
    const expected = ['trip','auto'].includes(mode)?mode:'total';
    await page.waitForFunction(expected=>document.querySelector('#clockTimer').percentMode===expected,expected);
   });
  }
  await check('cancel trip entry', async () => {
   if(method==='voice'){await say('ready');await wait(()=>WMOFVoiceEntry.active);await say('cancel');}
   else {await tap('#newTripButton');await touchPad();await tap('#numberPadCancel');}
   await wait(()=>!WMOFVoiceEntry.active && !document.querySelector('#numberPadDialog')?.open);
   assert.equal(await state(()=>document.querySelector('#clockTimer').uiState.trip_active),false);
  });
  await check('idle rejects downtime',async()=>{
   if(method==='voice')await f.say(phrase('down time'));
   else assert(!(await page.locator('#downButton').isVisible()),'idle Down control is unavailable');
   assert.equal(await state(()=>document.querySelector('#clockTimer').uiState.trip_active),false);
   assert.equal(await state(()=>Boolean(document.querySelector('#clockTimer').getActiveIntervalState())),false);
  });
  await check('start trip using fixed standard', async () => {
   if(method==='voice'){await say('ready');await say('forty seconds');await say('okay');}
   else {
    await tap('#newTripButton');await touchPad();
    for(const digit of '40')await tap(`#numberPadGrid [data-number="${digit}"]`);
    await tap('#numberPadConfirm');
   }
   await wait(()=>document.querySelector('#clockTimer').status==='running');
  });
  await check('set and read trip goal',async()=>{
   if(method==='voice'){await say('trip mode');await say('trip goal one hundred ten percent');await say('trip goal');}
   else {
    await tap('#scopeToggle');await tap('#scopeToggleDropdown [data-mode="trip"]');
    await tap('#goalPercentValue');await touchPad();await page.locator('#numberPadClear').tap({position:{x:12,y:12}});assert.equal(await page.locator('#numberPadDisplay').textContent(),'---');
    for(const digit of '110')await tap(`#numberPadGrid [data-number="${digit}"]`);
    await tap('#numberPadConfirm');
   }
   assert.equal(await state(()=>document.querySelector('#clockTimer').uiState.trip_goal_component.value),1.1);
  });
  await check('sync on and off',async()=>{
   for(const enabled of [true,false]) {
    if(method==='voice')await say('sync '+(enabled?'on':'off'));
    else {await tap('#menuButton');await tap('#toggleSyncMenuButton');await tap('#menuButton');}
    assert.equal(await state(()=>document.querySelector('#clockTimer').autoSyncTripGoal),enabled);
   }
  });
  for (const kind of ['break','short-break','lunch']) {
   await check('start '+kind,async()=>{
    if(method==='voice')await say('break start '+kind.replace('-',' ')+' okay');
    else {await tap('#breakButton');await tap(`#breakDialog [data-break-type="${kind}"]`);await tap('#breakTypeOK');}
    await page.waitForFunction(kind=>document.querySelector('#clockTimer').getActiveIntervalState()?.intervalType===(kind==='short-break'?'break':kind),kind);
   });
   await check('end '+kind,async()=>{
    await action('#endTripButton','break end');
    await action('#speechBreakConfirmYes','okay');
    await wait(()=>!document.querySelector('#clockTimer').getActiveIntervalState());
   });
  }
  await check('start downtime',async()=>{
   await action('#downButton','down');
   await wait(()=>document.querySelector('#clockTimer').getActiveIntervalState()?.intervalType==='down');
  });
  await check('resume from downtime',async()=>{
   await action('#downResumeButton','resume');
   await wait(()=>!document.querySelector('#clockTimer').getActiveIntervalState());
  });
  await check('open and close trip log',async()=>{
   await action('#tripLogButton','log');await wait(()=>document.querySelector('#tripLogDialog').open);
   // The managed modal must keep the microphone usable in its top layer.
   const mic=await page.evaluateHandle(()=>testShadows.get(document.querySelector('#speechMicBar')).querySelector('#mic'));
   if(method==='voice')await say('sleep');else await mic.asElement().tap();
   await wait(()=>SpeechMenu.muted);
   for(const text of ['commands','log','who do you love']) {
    if(method==='voice')await f.say(phrase(text));
    assert(await state(()=>SpeechMenu.muted));
   }
   if(method==='voice')await say('wake');else await mic.asElement().tap();
   await wait(()=>!SpeechMenu.muted);await mic.dispose();
   await action('#tripLogCloseButton','close');await wait(()=>!document.querySelector('#tripLogDialog').open);
  });
  await check('end trip and dismiss summary',async()=>{
   await action('#endTripButton','ready');await wait(()=>document.querySelector('#tripTransitionOverlay').open);
   assert.equal(await page.locator('[data-trip-summary-row="active"]').count(),0);
   if(method==='voice')await say('cancel');else await tap('#tripTransitionSummaryOk');
   if(method==='touch'){await touchPad();await tap('#numberPadCancel');}
   await wait(()=>!document.querySelector('#tripTransitionOverlay').open);
  });
  for(const kind of ['break','short-break','lunch'])await check('standalone '+kind,async()=>{
   if(method==='voice')await say('break start '+kind.replace('-',' ')+' okay');
   else {await tap('#idleBreakButton');await tap(`#breakDialog [data-break-type="${kind}"]`);await tap('#breakTypeOK');}
   await wait(()=>document.querySelector('#clockTimer').breakOnly && document.querySelector('#clockTimer').getActiveIntervalState() && WMOFCoordinator.lockCount===0 && !WMOFInteractionState.state.controls.transient);
   assert.equal(await state(()=>document.querySelector('#clockTimer').getBreakTransitionState().canStartDown),false);
   if(method==='voice'){
    await f.say(phrase('down'));
    assert.equal(await state(()=>document.querySelector('#clockTimer').breakOnly),true);
    assert.notEqual(await state(()=>document.querySelector('#clockTimer').getActiveIntervalState()?.intervalType),'down');
   } else assert(!(await page.locator('#downButton').isVisible()),'standalone break cannot expose Down');
   await action('#endTripButton','break end');await action('#speechBreakConfirmYes','okay');
   await wait(()=>!document.querySelector('#clockTimer').uiState.trip_active);
   assert.equal(await state(()=>document.querySelector('#tripTransitionOverlay').open),false);
  });
  await check('hour boundary switches the active overflow ring',async()=>{
   if(method==='voice'){await say('ready');await say('one hour and five minutes');await say('okay');}
   else {await tap('#newTripButton');await touchPad();for(const digit of '10500')await tap(`#numberPadGrid [data-number="${digit}"]`);await tap('#numberPadConfirm');}
   await wait(()=>document.querySelector('#clockTimer').status==='running');
   assert.equal(await state(()=>document.querySelector('#clockTimer').standardTimeMilliseconds),3900000);
   const active=()=>state(()=>[...document.querySelector('#clockTimer').querySelectorAll('ring-container[active]')].filter(r=>r.clockTimerRingIndex!==undefined).map(r=>Number(r.clockTimerRingIndex)));
   // Leave five minutes after the hour boundary for the handoff animation.
   const before=await active();assert.deepEqual(before,[0],'initial hour ring');
   await page.clock.fastForward(3600000);
   await page.clock.runFor(1200);
   const after=await active();assert.deepEqual(after,[1],'hour handoff changes to the second ring');
   assert.equal(await state(()=>document.querySelector('#clockTimer').uiState.trip_active),true);
   await page.clock.resume();
   const speech=await state(()=>globalThis.masterSpeechInputs||[]);
   if(method==='voice'&&f.input==='transcript')for(const input of speech){assert.equal(input.partials.length,input.text.trim().split(/\s+/).length,'every word is delivered as a growing partial');for(let i=1;i<input.partials.length;i++)assert(input.partials[i].at-input.partials[i-1].at >= 60000/input.wpm*.8,'delivery follows configured speech pace');}
  });
  assert.equal(steps.length,require('./order-filler-master-plan.cjs').journeyCheckpoints,'planned and executed checkpoint counts agree');
  await page.screenshot({path:path.join(out,'complete.png')});
  console.log(`PASS ${method} master (${steps.length} checkpoints)`);
 } catch(error) {
  const heard=f.audioCases.slice(audioStart).map(clip=>'Expected: '+clip.text+'; heard: '+(clip.recognized||'[no transcript]')).join('\n');
  failure={step:currentStep,message:[String(error.message),heard].filter(Boolean).join('\n')};
  console.error('FAIL '+currentStep+': '+failure.message);
  await reporter.tests([{label:method+': '+currentStep,status:'failed',message:Buffer.from([String(error.message),heard].filter(Boolean).join('\n')).subarray(0,1800).toString(),...evidence()}]).catch(()=>{});
  await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  throw error;
 } finally {
  diagnostics.setCheckpointHooks();
  const speech=await page.evaluate(()=>globalThis.masterSpeechInputs||[]).catch(()=>[]);

  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({method,delivery,input:f.input,status:failure?'failed':'passed',failure,passed:steps,errors:f.errors,speech,audioCases:f.audioCases},null,2));
  await f.close();
 }
};
