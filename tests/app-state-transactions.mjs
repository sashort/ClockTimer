import {installAsyncStorage} from './async-storage-fixture.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {installEnglishPack} from './LanguageWindow.mjs';
const window=new Window({url:'https://clock.example/',settings:{disableJavaScriptEvaluation:true,disableCSSFileLoading:true}});
const storage=installAsyncStorage(window);
window.__testTime=Date.parse('2026-10-06T12:00:00Z');
window.eval(`const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const spoken=[];
if(process.argv.includes('--voice-feedback')) window.WMOFAudio={speak(text,options={}){spoken.push(String(text));queueMicrotask(()=>options.onEnd?.());return true;},
    async startSong(){return {hasChime:true,finished:Promise.resolve()};}};
let recognition;
window.SpeechRecognition=class {start(){recognition=this;this.onstart?.();} abort(){this.onend?.();}};
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
const animationCalls=[];window.Element.prototype.animate=function(keyframes,options){animationCalls.push({target:this,keyframes,options});return{finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}}};
const consoleErrors=[];window.console.error=(...args)=>consoleErrors.push(args.map(a=>a?.stack||String(a)).join(' '));
const errors=[];window.addEventListener('error',e=>{errors.push(e.message);});
const rules={weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'};
let rejectTripStop=false;let holdTripCheck=false;let releaseTripCheck;let rejectTripStart=false;let releaseCheck;let holdCheck=false;let eventId=1,tripId=41;const requests=[],stored=[];
window.fetch=async(url,options={})=>{
 const path=new URL(url,'https://clock.example/').pathname;requests.push({path,options});
 const input=options.body?JSON.parse(options.body):null;
 if(path.endsWith('/trip-events/')&&options.method==='POST') stored.push({...input,id:eventId++});
 if(path.endsWith('/trip-editor/')&&input) {
    if(input.operation==='entry') stored.find(e=>e.event==='interval.started'&&e.value.intervalKey===input.entry.intervalKey).timestamp=input.entry.start;
    if(input.operation==='settings') Object.assign(stored.find(e=>e.event==='trip.started').value,input.settings);
 }
 if(holdTripCheck&&path.endsWith('/command-check/')&&input.endpoint==='trips')await new Promise(resolve=>releaseTripCheck=resolve);
 const tripStopRejected=rejectTripStop&&path.endsWith('/command-check/')&&input.endpoint==='trip-events'&&input.command.event==='trip.stopped';
 const tripStartRejected=rejectTripStart&&path.endsWith('/command-check/')&&input.endpoint==='trips';
 const duplicateBreak=path.endsWith('/command-check/')&&input.endpoint==='trip-events'&&input.command.event==='interval.started'&&stored.some(e=>e.event==='interval.started'&&!stored.some(end=>end.event==='interval.ended'&&end.value.intervalKey===e.value.intervalKey));
 if(duplicateBreak&&holdCheck)await new Promise(resolve=>releaseCheck=resolve);
 const data=path.endsWith('/command-check/')?{accepted:!duplicateBreak&&!tripStartRejected&&!tripStopRejected,reason:tripStartRejected?'Trip start rejected.':tripStopRejected?'Trip finish rejected.':'A break is already active.'}:path.endsWith('/calendar/')?{calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2,username:'test',first_name:'Alex',last_name:'Driver',preferred_name:'Al',permissions:4},calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/trip-events/')?(options.method==='POST'?{eventId:eventId-1}:{tripId,events:structuredClone(stored)}):
 path.endsWith('/trip-editor/')?{tripId,events:structuredClone(stored),settings:structuredClone(stored.find(e=>e.event==='trip.started')?.value||{}),revision:'test-revision'}:
 {tripId, trips:[],aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>data,text:async()=>path.endsWith('numberpad.html')?fs.readFileSync(new URL('../numberpad.html',import.meta.url),'utf8'):JSON.stringify(data),clone(){return this;}};
};
window.document.write(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,''));
installEnglishPack(window);
for(const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer','CalendarRange','TripLog','StateTransactions','SpeechFunctionRoles','SpeechFunctionRegistry','UtilityFunctions','SpeechProcessingFunctions','ActionFunctions','InteractionFunctions','PresentationSetters'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nwindow.ParameterParser=ParameterParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/DurationParser.js',import.meta.url),'utf8')+'\nwindow.EnglishDurationParser=EnglishDurationParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US/SpokenTimeParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/PercentParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/SpeechValuePreprocessor.js',import.meta.url),'utf8'));
let speechSource=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
speechSource=speechSource.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testBegin(){SpeechMenu.#executionEnabled=true;SpeechMenu.#sleeping=false;SpeechMenu.#stopped=false;SpeechMenu.#stream={getTracks(){return [];}};SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};SpeechMenu.#beginUtterance(window.__testTime-performance.timeOrigin);return SpeechMenu.#utterance;}
    static testTranscript(u,text,final=true){return SpeechMenu.#handleLiveTranscript(u,text,final);}
    static testFinish(){SpeechMenu.#finishUtterance("vad-silence",true);}
    static testFinal(u,text){return SpeechMenu.#handleCompletedTranscript(u,text);}
    static testAvailable(){return SpeechMenu.#availableCandidates();}
    static async testSilence(u,text){u.transcript=text;u.candidatePool=await SpeechMenu.#refreshCandidatePool(u,text);return SpeechMenu.#commitUtterance(u);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
window.eval(speechSource+'\nwindow.SpeechMenu=SpeechMenu;');
window.SpeechMenu.events.addEventListener('speechFeedbackError',e=>errors.push(e.detail.error?.stack||String(e.detail.error)));
window.eval(fs.readFileSync(new URL('../SpeechMicBar.js',import.meta.url),'utf8'));
window.SpeechMenu.testBegin();
if(process.argv.includes('--voice-feedback')) window.eval(fs.readFileSync(new URL('../AnnouncementCatalog.js',import.meta.url),'utf8'));
let appSource=fs.readFileSync(process.env.CLOCKTIMER_APP_SOURCE || new URL('../app.js',import.meta.url),'utf8');
// The fixture freezes Date.now for trip boundaries; eliminate audio pauses
// so its frozen wall clock cannot accumulate an artificial playback backlog.
if(process.argv.includes('--voice-feedback')) appSource=appSource.replace('const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;', 'const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 0;');
window.eval(appSource);

const settle=()=>new Promise(resolve=>setTimeout(resolve,150));await settle();
const timer=window.document.querySelector('#clockTimer');
const states=[];
window.WMOFStateTransactions.addEventListener('state',event=>states.push(event.detail.state));
const originalMode=timer.renderedTimeMode;
const checksBefore=requests.filter(r=>r.path.endsWith("/command-check/")).length;
storage.fail=true;
assert.equal(await window.WMOFActions.toggleRenderedTime(),false);
assert.equal(timer.renderedTimeMode,originalMode,'the UI restores the previous mode after a settings save fails');
assert.equal(window.document.querySelector('#app').dataset.persistenceState,'reverted');
assert.match(window.document.querySelector('.persistence-status').textContent,/Reverted.*Disk write failed/,'rollback shows the actual persistence failure');
storage.fail=false;
assert(await window.WMOFActions.toggleRenderedTime());
assert.notEqual(timer.renderedTimeMode,originalMode);
assert.equal(window.document.querySelector('.persistence-status').hidden,true);
assert.equal(requests.filter(r=>r.path.endsWith("/command-check/")).length,checksBefore,"local preference commands do not call server validation");
await timer.connect('test','test');
window.document.querySelector('#loginDialog').close();
await window.WMOFActions.handleSpeechRuntimeStarted();await settle();
if(process.argv.includes('--scheduled-cancel')) {
    const deadline=(work,label)=>Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' did not settle')),2000))]);
    for(const cancelBeforeFinal of [false,true]) {
        const scheduled=window.SpeechMenu.testBegin();
        await window.SpeechMenu.testTranscript(scheduled,'ready at eleven fifty nine pm',!cancelBeforeFinal);await deadline(scheduled.digestQueue,'Ready At');await settle();
        if(cancelBeforeFinal) {window.SpeechMenu.testFinish();await window.SpeechMenu.testFinal(scheduled,'ready at eleven fifty nine pm');await deadline(scheduled.digestQueue,'Ready At final');await settle();}
        assert(window.document.querySelector('#scheduledStartDialog').open,'Ready At opens the standard-time prompt');
        const cancel=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(cancel,'cancel',!cancelBeforeFinal);await deadline(cancel.digestQueue,'Cancel');
        if(cancelBeforeFinal) {window.SpeechMenu.testFinish();await window.SpeechMenu.testFinal(cancel,'cancel');await deadline(cancel.digestQueue,'Cancel final');}await settle();
        assert(!window.document.querySelector('#scheduledStartDialog').open,'Cancel closes scheduled start without entering a duration');
        assert.notEqual(window.document.querySelector('#app').dataset.persistenceState,'pending','Cancel clears Applying');
        const retry=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(retry,'ready',true);await deadline(retry.digestQueue,'Ready retry');await settle();
        assert(!retry.digestExecutionFailed && window.document.querySelector('#voiceEntrySurface').open,'new commands execute after Cancel');
        const close=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(close,'cancel',true);await deadline(close.digestQueue,'retry Cancel');await settle();
    }
    const silence=window.SpeechMenu.testBegin();
    assert(await deadline(window.SpeechMenu.testSilence(silence,'ready at eleven fifty nine pm'),'Ready At silence'),'silence commits Ready At');
    await settle();assert(window.document.querySelector('#scheduledStartDialog').open,'silence commitment opens scheduled start');
    assert.notEqual(window.document.querySelector('#app').dataset.persistenceState,'pending','silence commitment must settle its state transaction');
    const silenceCancel=window.SpeechMenu.testBegin();
    assert(await deadline(window.SpeechMenu.testSilence(silenceCancel,'cancel'),'Cancel silence'),'silence commits Cancel');
    await settle();assert(!window.document.querySelector('#scheduledStartDialog').open,'silence Cancel closes the scheduled dialog');
    assert.notEqual(window.document.querySelector('#app').dataset.persistenceState,'pending','silence Cancel clears Applying');
    assert(!window.SpeechMenu.testAvailable().some(e=>e.closest('dialog')?.id==='scheduledStartDialog'),'Cancel unloads scheduled-dialog commands');
    const next=window.SpeechMenu.testBegin();assert(await deadline(window.SpeechMenu.testSilence(next,'ready'),'Ready after silence Cancel'));
    assert(window.document.querySelector('#voiceEntrySurface').open,'Ready works after silence Cancel');
    const closeNext=window.SpeechMenu.testBegin();assert(await deadline(window.SpeechMenu.testSilence(closeNext,'cancel'),'Cancel next editor'));
    await settle();
    assert(!window.SpeechMenu.testAvailable().some(e=>e.closest('dialog')?.id==='voiceEntrySurface'),'Cancel unloads the voice editor commands');
    console.log('PASS Ready At → standard-time prompt → Cancel releases pending work and allows retry');
}
if(process.argv.includes('--scheduled-standard')) {
    const scheduled=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(scheduled,'ready at eleven fifty nine pm',true);await scheduled.digestQueue;await settle();
    assert(window.document.querySelector('#scheduledStartDialog').open,'scheduled start opens its workflow');
    for(const [phrase,expected] of [['standard time thirty minutes',1800000],['forty minutes',2400000]]) {
        const value=window.SpeechMenu.testBegin();
        await window.SpeechMenu.testTranscript(value,phrase,true);await value.digestQueue;await settle();
        assert(value.hadCommittedCommand && !value.digestExecutionFailed,phrase+' is accepted');
        assert.match(window.document.querySelector('#scheduledStartStandardValue').textContent,expected===1800000?/30/:/40/,'standard duration updates');
    }
    const cancel=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(cancel,'cancel',true);await cancel.digestQueue;await settle();
    assert(!window.document.querySelector('#scheduledStartDialog').open,'Cancel remains available after bare time input');
    console.log('PASS scheduled start accepts standard time prefix or duration alone');
}
const readyAttempt=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(readyAttempt,'ready',true);await readyAttempt.digestQueue;await settle();
assert(!readyAttempt.digestExecutionFailed,'ready starts its workflow');
assert(window.document.querySelector('dialog[open]'),'ready opens the start input');
const cancelAttempt=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(cancelAttempt,'castle',true);await cancelAttempt.digestQueue;await settle();
assert(cancelAttempt.hadCommittedCommand,'castle executes cancellation');
assert.equal(window.document.querySelector('#voiceEntrySurface').open,false,'castle closes the voice editor');
assert.equal(timer.status,'ready','cancellation does not start a trip');
const retryReady=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(retryReady,'rudd',true);await retryReady.digestQueue;await settle();
assert(retryReady.hadCommittedCommand,'rudd is a direct Ready variant');
assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'Ready works after cancellation');
const systemMenu=window.document.createElement('speech-menu');systemMenu.setAttribute('speech-modal','system');
const off=window.document.createElement('speech-command');off.setAttribute('speech-pattern','^off$');off.setAttribute('speech-function','WMOFActions.disableSpeechRecognition');systemMenu.append(off);window.document.body.append(systemMenu);
await window.WMOFActions.toggleSync(true);await settle();
const syncAttempt=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(syncAttempt,'sync',false);await syncAttempt.digestQueue;
await window.SpeechMenu.testTranscript(syncAttempt,'sync off',false);await syncAttempt.digestQueue;
await window.SpeechMenu.testTranscript(syncAttempt,'sync off',true);await syncAttempt.digestQueue;await settle();
assert.equal(window.SpeechMenu.started,true,'sync off must not stop speech recognition');
assert.equal(window.SpeechMenu.listeningSuspended,false,'sync off must not suspend recognition');
assert.equal(window.document.querySelector('#app').dataset.speechActive,'true','sync off must keep the mic bar visible');
assert.equal(syncAttempt.digestSteps.length,1,'sync off is one command');
assert.equal(syncAttempt.digestSteps[0].commandElement.getAttribute('speech-function'),'WMOFActions.toggleSync');
assert.equal(timer.autoSyncTripGoal,false,'sync off explicitly disables synchronization');
const repeatedOff=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(repeatedOff,'sync off',true);await repeatedOff.digestQueue;await settle();
assert.equal(timer.autoSyncTripGoal,false,'a repeated sync off must remain off');
assert.equal(window.SpeechMenu.started,true,'repeated sync off keeps recognition active');
systemMenu.remove();
if(process.argv.includes('--pointer-confirmation')) {
    window.document.querySelector('#voiceEntryTouch').click();await settle();
    assert(window.document.querySelector('#numberPadDialog')?.open,'touch opens the start numberpad');
    for(const digit of '3000') await window.WMOFActions.enterNumberPadDigit(digit);
    assert.equal(window.document.querySelector('#numberPadConfirm').disabled,false);
    assert.equal(await window.WMOFActions.confirmNumberPad(),true,'numberpad OK starts and persists the trip');
} else {
    const valueAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(valueAttempt,'thirty minutes',true);await valueAttempt.digestQueue;await settle();
    const okAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(okAttempt,'okay',true);await okAttempt.digestQueue;await settle();
    assert(!okAttempt.digestExecutionFailed,'voice OK accepts and persists the entered trip time');
}
assert.equal(timer.status,'running','confirmation starts the trip');
assert(stored.some(e=>e.event==='trip.started'),'the confirmed trip reaches persistence');
window.__testTime+=120000;
if(process.argv.includes('--ready-finish')) {
    const finishReady=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(finishReady,'ruddy',true);await finishReady.digestQueue;await settle();
    assert(!finishReady.digestExecutionFailed,'Ready finishes the active trip');
    assert(stored.some(e=>e.event==='trip.stopped'),'Ready persists the completed trip');
} else {
    await window.WMOFActions.endTrip();await settle();
}
assert.equal(window.document.querySelector('#app').dataset.persistenceState,'confirmed','finishing the trip settles its transaction');
const nextValue=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(nextValue,'twenty minutes',true);await nextValue.digestQueue;await settle();
assert(!nextValue.digestExecutionFailed,'the next trip time is recognized');
assert.equal(window.document.querySelector('#voiceEntryValue').textContent,'0:20:00','the valid time is acknowledged before OK');
assert.equal(window.document.querySelector('#voiceEntryValue').hidden,false,'the acknowledged time is visible');
window.document.querySelector('#numberPadDialog')?.dispatchEvent(new window.Event('close'));
assert.equal(window.document.querySelector('#voiceEntryValue').textContent,'0:20:00','a previous editor close preserves the acknowledged voice input');
const nextOk=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(nextOk,'o k',true);await nextOk.digestQueue;await settle();
assert(!nextOk.digestExecutionFailed,'the next trip confirmation succeeds after finishing a trip');
assert.equal(timer.status,'running','the second trip starts without restarting the app');
rejectTripStop=true;
window.__testTime+=60000;
const tripIdBeforeFailedStop=timer.currentTripId;
const writesBeforeFailedStop=stored.filter(e=>e.event==='trip.stopped').length;
assert.equal(await window.WMOFActions.endTrip(),false,'rejected trip finish reports failure');await settle();
assert.equal(timer.status,'running','failed finish restores the running trip');
assert.equal(timer.currentTripId,tripIdBeforeFailedStop,'failed finish preserves the same trip');
assert.equal(stored.filter(e=>e.event==='trip.stopped').length,writesBeforeFailedStop,'rejected finish does not write a stop event');
assert.equal(window.document.querySelector('#app').dataset.tripState,'running','the UI agrees with the restored trip');
assert.equal(window.document.querySelector('#voiceEntrySurface').open,false,'failed finish leaves the next editor closed');
assert.equal(window.document.querySelector('#newTripButton').disabled,true,'failed finish cannot start a second trip');
assert.equal(window.document.querySelector('#endTripButton').disabled,false,'failed finish can be retried');
assert.equal(window.WMOFStateTransactions.active,undefined,'failed finish leaves no unfinished transaction');
rejectTripStop=false;
const hear=async(text)=>{
    const utterance=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(utterance,text,true);await utterance.digestQueue;await settle();
    assert(utterance.hadCommittedCommand,text+' executes in the current UI state');
    assert(!utterance.digestExecutionFailed,text+' finishes successfully');
    assert.equal(window.WMOFStateTransactions.active,undefined,text+' leaves no unfinished transaction');
    return utterance;
};
for(const [value,confirmation] of [['tutu minutes','okay'],['ten minutes','o k'],['five minutes','ok']]) {
    window.__testTime+=60000;
    await window.WMOFActions.endTrip();await settle();
    assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'finishing opens the next input');
    assert.equal(window.document.querySelector('#voiceEntryValue').hidden,true,'new input cannot reuse the previous value');
    window.document.querySelector('#voiceEntryTouch').click();await settle();
    assert.equal(window.document.querySelector('#numberPadDialog').open,true,'next input switches to the number pad');
    await window.WMOFActions.switchNumberPadToVoice();await settle();
    assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'number pad returns to speech entry');
    window.document.querySelector('#numberPadDialog').dispatchEvent(new window.Event('close'));
    assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'delayed close leaves the current editor open');
    const confirmButton=window.document.querySelector('#numberPadConfirm');
    if(confirmButton)assert.equal(confirmButton.disabled,true,'new input cannot reuse the previous confirmation');
    await hear(value);
    assert.equal(window.document.querySelector('#voiceEntryValue').hidden,false,'the next value is acknowledged');
    await hear(confirmation);
    assert.equal(timer.status,'running','repeated confirmation starts the next trip');
    assert.equal(window.document.querySelector('#voiceEntrySurface').open,false,'confirmed input closes');
    assert(!window.document.querySelector('#numberPadDialog')?.open,'touch editor stays closed');
    assert.equal(window.SpeechMenu.started,true,'repeated confirmation keeps recognition active');
}
window.__testTime+=60000;
await window.WMOFActions.endTrip();await settle();
await hear('twenty minutes');
rejectTripStart=true;holdTripCheck=true;
const writesBeforeRejection=requests.filter(r=>r.options.method==='POST'&&r.path.endsWith('/trips/')).length;
const rejected=window.SpeechMenu.testBegin();
const rejectionWork=window.SpeechMenu.testTranscript(rejected,'ok',true);await settle();
assert(releaseTripCheck,'confirmation reaches server validation');
assert.equal(timer.status,'running','the start appears while validation is pending');
assert.equal(requests.filter(r=>r.options.method==='POST'&&r.path.endsWith('/trips/')).length,writesBeforeRejection,'pending validation does not write a trip');
releaseTripCheck();holdTripCheck=false;
await rejectionWork;await rejected.digestQueue;await settle();
assert(rejected.digestExecutionFailed,'server rejection fails the confirmation');
assert.notEqual(timer.status,'running','rejected start rolls back the optimistic trip');
assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'rejected confirmation restores the editor');
assert.equal(window.document.querySelector('#voiceEntryValue').textContent,'0:20:00','rollback keeps the acknowledged value');
assert.equal(window.document.querySelector('#voiceEntryValue').hidden,false,'rollback shows the acknowledged value');
assert.equal(window.WMOFStateTransactions.active,undefined,'rejection leaves no unfinished transaction');
rejectTripStart=false;
await hear('fifteen minutes');
await hear('okay');
assert.equal(timer.status,'running','a new value can be confirmed after rejection');
await timer.stop();await timer.clear();stored.length=0;
await timer.start({standardTimeMilliseconds:3600000});
window.__testTime+=60000;
await timer.startInterval('lunch',1800000,{breakType:'lunch'},150000,150000);
await settle();
window.__testTime+=180000;
const originalTrip=timer.currentTripId;
for(const dialog of window.document.querySelectorAll('dialog[open]'))dialog.close();
await settle();
const originalIntervalKey=timer.getActiveIntervalState().intervalKey;
const originalIntervalKeys=timer.captureState().events.filter(event=>event.event==='interval.started').map(event=>event.value.intervalKey);
const eventsBefore=stored.length;
holdCheck=true;
const attempt=window.SpeechMenu.testBegin();
const transcriptWork=window.SpeechMenu.testTranscript(attempt,'start lunch ok');
await settle();
assert(releaseCheck,'persisted commands call the server check: '+JSON.stringify({steps:attempt.digestSteps.map(s=>[s.commandElement.getAttribute('speech-function'),s.text]),failed:attempt.digestExecutionFailed,errors,consoleErrors,command:window.document.querySelector('[data-speech-editor-id="builtin:startLunch:page"]')?.outerHTML}));
assert(timer.captureState().events.some(event=>event.event==='interval.started'&&!originalIntervalKeys.includes(event.value.intervalKey)),'the attempted outcome appears before the server decides');
assert.equal(stored.length,eventsBefore,'no write occurs while server validation is pending');
releaseCheck();await transcriptWork;
await attempt.digestQueue;await settle();
assert(attempt.digestExecutionFailed,'the already-active break rejects the new break transaction');
assert.equal(timer.getActiveIntervalState(new window.Date())?.intervalType,'lunch');
assert.equal(timer.currentTripId,originalTrip);
assert.equal(window.document.querySelector('#breakDialog').open,false);
assert.equal(states.at(-1),'reverted');
window.__testTime+=60000;await timer.endInterval(new window.Date());await settle();
for(const [phrase,resume] of [['down','resumed'],['downtime','resume'],['down time','resumed']]) {
    window.__testTime+=60000;
    await settle();
    const downEventsBefore=stored.filter(e=>e.event==='interval.started'&&e.value.type?.toLowerCase()==='down').length;
    const downAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(downAttempt,phrase,true);await downAttempt.digestQueue;await settle();
    assert.equal(timer.getActiveIntervalState()?.intervalType,'down',phrase+' starts Down time');
    assert(!downAttempt.digestExecutionFailed,phrase+' completes its transaction');
    assert(downAttempt.digestSteps[0].commandElement.hasAttribute('speech-persist'),phrase+' is marked for persistence');
    assert.equal(stored.filter(e=>e.event==='interval.started'&&e.value.type?.toLowerCase()==='down').length,downEventsBefore+1,phrase+' persists the Down event');
    assert.equal(window.SpeechMenu.started,true,phrase+' keeps recognition active');
    window.__testTime+=60000;
    const resumeAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(resumeAttempt,resume,true);await resumeAttempt.digestQueue;await settle();
    assert(!timer.getActiveIntervalState(),resume+' ends Down time');
    assert(resumeAttempt.hadCommittedCommand,resume+' executes its command');
    assert(!resumeAttempt.digestExecutionFailed,resume+' persists successfully');
}
if(process.argv.includes('--voice-feedback')) {
    const speakCommand=async phrase=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,phrase,true);await u.digestQueue;await settle();return u;};
    const dialog=window.document.querySelector('#speechBreakConfirmDialog');
    const obsolete=await speakCommand('break start');
    assert(!obsolete.hadCommittedCommand && !dialog.open,'Break Start is removed');
    assert(!window.document.querySelector('#breakDialog speech-command'),'Break Selector has no voice commands');
    for(const [phrase,label,type,summary] of [
        ['start break','break','break','Break'],
        ['start short break','short break','break','Short Break'],
        ['start lunch','lunch','lunch','Lunch']]) {
        spoken.length=0;
        const selection=await speakCommand(phrase);
        assert(selection.hadCommittedCommand && !selection.digestExecutionFailed,phrase+' is accepted');
        assert(dialog.open,'voice opens the confirmation dialog');
        assert(!window.document.querySelector('#breakDialog').open,'voice never opens the pointer selector');
        assert.equal(window.document.querySelector('#speechBreakConfirmMessage').textContent,'Are you ready to start your '+label+'?');
        assert.equal(window.document.querySelector('#speechBreakConfirmYes').textContent,'OK');
        assert(window.document.querySelector('#speechBreakConfirmNo').hidden,'only OK and Cancel are offered');
        assert(!timer.getActiveIntervalState(),'without OK, no interval starts');
        assert(spoken.includes('Are you ready to start your '+label+'?'),'standalone start speaks its question');
        await speakCommand('cancel');assert(!timer.getActiveIntervalState(),'Cancel leaves the trip running');
        await speakCommand(phrase);await speakCommand('ok');
        assert.equal(timer.getActiveIntervalState()?.intervalType,type,'a separate OK starts the selected interval');
        assert(spoken.includes(summary+' Started. Say end '+label+' to end your '+label+'.'),'the final start announcement is preserved');
        const beforeWrongEnd=timer.getActiveIntervalState().intervalKey;
        const wrongEnd=await speakCommand(label==='break'?'end lunch ok':'end break ok');
        assert(!wrongEnd.hadCommittedCommand && timer.getActiveIntervalState()?.intervalKey===beforeWrongEnd,'a mismatched end command cannot end the active interval');
        await speakCommand('end '+label);
        assert(dialog.open && spoken.includes('Are you ready to end your '+label+'?'),'standalone Break end asks its question');
        const key=timer.getActiveIntervalState().intervalKey;
        await speakCommand('cancel');assert.equal(timer.getActiveIntervalState()?.intervalKey,key,'end Cancel retains the interval');
        await speakCommand('end '+label+' ok');assert(!timer.getActiveIntervalState(),'combined end ends it');
        for(const incremental of [false,true]) {
            spoken.length=0;
            const before=animationCalls.filter(c=>c.target?.id==='speechBreakConfirmDialog').length;
            const chain=window.SpeechMenu.testBegin();
            if(incremental) {
                await window.SpeechMenu.testTranscript(chain,phrase,false);await chain.digestQueue;await settle();
                assert(!dialog.open,'interim start defers confirmation');
            }
            await window.SpeechMenu.testTranscript(chain,phrase+' ok',true);await chain.digestQueue;await settle();
            assert(!chain.digestExecutionFailed && timer.getActiveIntervalState(),phrase+' OK starts the interval');
            assert(!dialog.open && !window.document.querySelector('#breakDialog').open,'combined start skips both dialogs');
            assert(!spoken.some(t=>t.startsWith('Are you ready')||t.includes('selected. Say OK')||t.includes('Choose Short Break')),'combined start skips intermediate feedback');
            assert(spoken.includes(summary+' Started. Say end '+label+' to end your '+label+'.'),'combined start retains outcome speech');
            const end=window.SpeechMenu.testBegin();
            if(incremental) {
                await window.SpeechMenu.testTranscript(end,'end '+label,false);await end.digestQueue;await settle();
                assert(!dialog.open,'interim end defers confirmation');
            }
            await window.SpeechMenu.testTranscript(end,'end '+label+' ok',true);await end.digestQueue;await settle();
            assert(!end.digestExecutionFailed && !timer.getActiveIntervalState(),'combined end completes');
            assert(!spoken.includes('Are you ready to end your '+label+'?'),'combined end skips its question');
            assert.equal(animationCalls.filter(c=>c.target?.id==='speechBreakConfirmDialog').length,before,'combined commands do not flash a dialog');
        }
    }
    const translatedStart=window.document.querySelector('[data-speech-editor-id="builtin:startLunch:page"]');
    const translatedEnd=window.document.querySelector('[data-speech-editor-id="builtin:endLunch:page"]');
    const translatedOK=window.document.querySelector('[data-speech-editor-id="builtin:confirm:speechBreakConfirmDialog"]');
    const endPattern=translatedEnd.getAttribute('speech-pattern'),startPattern=translatedStart.getAttribute('speech-pattern'),okPattern=translatedOK.getAttribute('speech-pattern');
    translatedEnd.setAttribute('speech-pattern','^terminer repas$');translatedStart.setAttribute('speech-pattern','^commencer repas$');translatedOK.setAttribute('speech-pattern','^daccord$');
    window.SpeechMenu.refresh();await settle();
    const translated=await speakCommand('commencer repas daccord');
    assert(!translated.digestExecutionFailed && timer.getActiveIntervalState()?.intervalType==='lunch','translated command phrases use the same neutral workflow');
    assert(!dialog.open,'translated confirmation chain suppresses its dialog');
    const translatedFinish=await speakCommand('terminer repas daccord');
    assert(!translatedFinish.digestExecutionFailed && !timer.getActiveIntervalState(),'translated end phrases use the same neutral workflow');
    translatedEnd.setAttribute('speech-pattern',endPattern);
    translatedStart.setAttribute('speech-pattern',startPattern);translatedOK.setAttribute('speech-pattern',okPattern);window.SpeechMenu.refresh();await settle();
    translatedStart.setAttribute('speech-skippable','false');spoken.length=0;
    await speakCommand('start lunch ok');
    assert(spoken.includes('Are you ready to start your lunch?'),'Skippable=false retains the localized question');
    assert(!dialog.open,'the combined utterance still skips the dialog');
    translatedStart.setAttribute('speech-skippable','');
    await speakCommand('end lunch ok');
    await speakCommand('sync off');await speakCommand('sync off');assert(spoken.includes('Sync already off.'));
    await speakCommand('sleep');assert(spoken.includes('Speech sleeping.'));
    await speakCommand('wake');assert(spoken.includes('Listening.'));
    await speakCommand('off');assert(spoken.includes('Speech off.'));
    console.log('PASS replacement start commands, pointer-only selector, OK/Cancel confirmation, and incremental start/end dialog and speech suppression for all interval types');
}
assert.equal(errors.length,0,errors.join('\n'));
assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
console.log('PASS repeated trip entry, touch/voice switching, delayed closes, Ready/Cancel/Resume variants, validation rejection and retry, Down persistence, sync-off visibility and rollback');
window.happyDOM.abort();
