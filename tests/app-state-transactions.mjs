import {installAsyncStorage} from './async-storage-fixture.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {installEnglishPack} from './LanguageWindow.mjs';
const window=new Window({url:'https://clock.example/',settings:{disableJavaScriptEvaluation:true,disableCSSFileLoading:true}});
const storage=installAsyncStorage(window);
window.__testTime=Date.parse('2026-10-06T12:00:00Z');
window.eval(`const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
let recognition;
window.SpeechRecognition=class {start(){recognition=this;this.onstart?.();} abort(){this.onend?.();}};
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
const animationCalls=[];window.Element.prototype.animate=function(keyframes,options){animationCalls.push({target:this,keyframes,options});return{finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}}};
const consoleErrors=[];window.console.error=(...args)=>consoleErrors.push(args.map(a=>a?.stack||String(a)).join(' '));
const errors=[];window.addEventListener('error',e=>{errors.push(e.message);});
const rules={weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'};
let releaseCheck;let holdCheck=false;let eventId=1,tripId=41;const requests=[],stored=[];
window.fetch=async(url,options={})=>{
 const path=new URL(url,'https://clock.example/').pathname;requests.push({path,options});
 const input=options.body?JSON.parse(options.body):null;
 if(path.endsWith('/trip-events/')&&options.method==='POST') stored.push({...input,id:eventId++});
 if(path.endsWith('/trip-editor/')&&input) {
    if(input.operation==='entry') stored.find(e=>e.event==='interval.started'&&e.value.intervalKey===input.entry.intervalKey).timestamp=input.entry.start;
    if(input.operation==='settings') Object.assign(stored.find(e=>e.event==='trip.started').value,input.settings);
 }
 const duplicateBreak=path.endsWith('/command-check/')&&input.endpoint==='trip-events'&&input.command.event==='interval.started'&&stored.some(e=>e.event==='interval.started'&&!stored.some(end=>end.event==='interval.ended'&&end.value.intervalKey===e.value.intervalKey));
 if(duplicateBreak&&holdCheck)await new Promise(resolve=>releaseCheck=resolve);
 const data=path.endsWith('/command-check/')?{accepted:!duplicateBreak,reason:'A break is already active.'}:path.endsWith('/calendar/')?{calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
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
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
window.eval(speechSource+'\nwindow.SpeechMenu=SpeechMenu;');
window.eval(fs.readFileSync(new URL('../SpeechMicBar.js',import.meta.url),'utf8'));
window.SpeechMenu.testBegin();
window.eval(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'));

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
assert.match(window.document.querySelector('.persistence-status').textContent,/Reverted/);
storage.fail=false;
assert(await window.WMOFActions.toggleRenderedTime());
assert.notEqual(timer.renderedTimeMode,originalMode);
assert.equal(window.document.querySelector('.persistence-status').hidden,true);
assert.equal(requests.filter(r=>r.path.endsWith("/command-check/")).length,checksBefore,"local preference commands do not call server validation");
await timer.connect('test','test');
await window.WMOFActions.handleSpeechRuntimeStarted();await settle();
const readyAttempt=window.SpeechMenu.testBegin();
await window.SpeechMenu.testTranscript(readyAttempt,'ready',true);await readyAttempt.digestQueue;await settle();
assert(!readyAttempt.digestExecutionFailed,'ready starts its workflow');
assert(window.document.querySelector('dialog[open]'),'ready opens the start input');
await window.WMOFActions.closeActiveSurface();await settle();
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
const transcriptWork=window.SpeechMenu.testTranscript(attempt,'break start lunch ok');
await settle();
assert(releaseCheck,'persisted commands call the server check');
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
for(const phrase of ['down','downtime','down time']) {
    window.__testTime+=60000;
    await settle();
    const downAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(downAttempt,phrase,true);await downAttempt.digestQueue;await settle();
    assert.equal(timer.getActiveIntervalState()?.intervalType,'down',phrase+' starts Down time');
    assert.equal(window.SpeechMenu.started,true,phrase+' keeps recognition active');
    window.__testTime+=60000;await timer.endInterval(new window.Date());await settle();
}
assert.equal(errors.length,0,errors.join('\n'));
assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
console.log('PASS Ready, Down aliases, sync-off microphone visibility, optimistic UI and rollback');
window.happyDOM.abort();
