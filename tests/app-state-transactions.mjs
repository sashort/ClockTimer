import {installAsyncStorage} from './async-storage-fixture.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {installEnglishPack} from './LanguageWindow.mjs';
const window=new Window({url:process.argv.includes('--landing-session')?'https://clock.example/order-filler.php?session=existing':'https://clock.example/',settings:{disableJavaScriptEvaluation:true,disableCSSFileLoading:true}});
const storage=installAsyncStorage(window);
window.__testTime=Date.parse('2026-10-06T12:00:00Z');
window.eval(`const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const spoken=[],chimes=[],startupAudioCalls=[];let finishStartup;
if(process.argv.includes('--voice-feedback') || process.argv.includes('--interval-actions')) window.WMOFAudio={unlock(){startupAudioCalls.push('unlock');return new Promise(()=>{});},speak(text,options={}){startupAudioCalls.push('speak');spoken.push(String(text));if(process.argv.includes("--startup-speech") && text === "Application is loading") finishStartup=options.onEnd;else queueMicrotask(()=>options.onEnd?.());return true;},
    async startSong(name){chimes.push(name);return {hasChime:true,finished:Promise.resolve()};}};
let recognition;
window.SpeechRecognition=class {start(){recognition=this;this.onstart?.();} abort(){this.onend?.();}};
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
const capturedShadows=new WeakMap();
if(process.argv.includes('--commands-close')) {const attach=window.Element.prototype.attachShadow;window.Element.prototype.attachShadow=function(...args){const root=attach.apply(this,args);capturedShadows.set(this,root);return root;};}
const animationCalls=[];window.Element.prototype.animate=function(keyframes,options){animationCalls.push({target:this,keyframes,options});return{finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}}};
const consoleErrors=[];window.console.error=(...args)=>consoleErrors.push(args.map(a=>a?.stack||String(a)).join(' '));
const errors=[];window.addEventListener('error',e=>{errors.push(e.message);});
const rules={weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'};
let summaryTrips=[];let holdStopResponse=false,releaseStopResponse;let rejectTripStop=false;let holdTripCheck=false;let releaseTripCheck;let rejectTripStart=false;let releaseCheck;let holdCheck=false;let eventId=1,tripId=41;const requests=[],stored=[];let holdLogin=false,releaseLogin,rejectLogin=false;
const accountBlob={version:1,orderFiller:{'wmof.clock.graphicalSettings':JSON.stringify({tripColor:'#123456'}),'wmof.clock.percentMode':'auto'}};
window.fetch=async(url,options={})=>{
 const path=new URL(url,'https://clock.example/').pathname;requests.push({path,options});
 const input=options.body?JSON.parse(options.body):null;
 if(rejectLogin&&path.endsWith('/users/')&&input?.action==='connect-pin'){const data={error:'invalid_credentials',message:'Incorrect credentials.'};return {ok:false,status:401,json:async()=>data,text:async()=>JSON.stringify(data),clone(){return this;}};}
 if(holdLogin&&path.endsWith('/users/')&&options.method==='POST')await new Promise(resolve=>releaseLogin=resolve);
 if(path.endsWith('/trip-events/')&&options.method==='POST') stored.push({...input,id:eventId++});
 if(holdStopResponse&&path.endsWith('/trip-events/')&&input?.event==='trip.stopped')await new Promise(resolve=>releaseStopResponse=resolve);
 if(path.endsWith('/trip-editor/')&&input) {
    if(input.operation==='entry') stored.find(e=>e.event==='interval.started'&&e.value.intervalKey===input.entry.intervalKey).timestamp=input.entry.start;
    if(input.operation==='settings') Object.assign(stored.find(e=>e.event==='trip.started').value,input.settings);
 }
 if(holdTripCheck&&path.endsWith('/command-check/')&&input.endpoint==='trips')await new Promise(resolve=>releaseTripCheck=resolve);
 const tripStopRejected=rejectTripStop&&path.endsWith('/command-check/')&&input.endpoint==='trip-events'&&input.command.event==='trip.stopped';
 const tripStartRejected=rejectTripStart&&path.endsWith('/command-check/')&&input.endpoint==='trips';
 const duplicateBreak=path.endsWith('/command-check/')&&input.endpoint==='trip-events'&&input.command.event==='interval.started'&&stored.some(e=>e.event==='interval.started'&&!stored.some(end=>end.event==='interval.ended'&&end.value.intervalKey===e.value.intervalKey));
 if(duplicateBreak&&holdCheck)await new Promise(resolve=>releaseCheck=resolve);
 if(path.endsWith('/settings/')&&input)Object.assign(accountBlob[input.namespace]||={},input.changes);
 const data=path.endsWith('/settings/')?{userId:2,settings:structuredClone(accountBlob)}:path.endsWith('/command-check/')?{accepted:!duplicateBreak&&!tripStartRejected&&!tripStopRejected,reason:tripStartRejected?'Trip start rejected.':tripStopRejected?'Trip finish rejected.':'A break is already active.'}:path.endsWith('/calendar/')?{calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2,username:'test',first_name:'Alex',last_name:'Driver',preferred_name:'Al',permissions:4},calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/trip-events/')?(options.method==='POST'?{eventId:eventId-1}:{tripId,events:structuredClone(stored)}):
 path.endsWith('/trip-editor/')?{tripId,events:structuredClone(stored),settings:structuredClone(stored.find(e=>e.event==='trip.started')?.value||{}),revision:'test-revision'}:
 path.endsWith('/trips/')&&new URL(url,'https://clock.example/').searchParams.get('result')==='active'
    ? {activeTripId: stored.findLast(e=>['trip.started','trip.stopped'].includes(e.event))?.event==='trip.started' ? tripId : null} :
 {tripId, trips:summaryTrips,aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>data,text:async()=>path.endsWith('numberpad.html')?fs.readFileSync(new URL('../numberpad.html',import.meta.url),'utf8'):JSON.stringify(data),clone(){return this;}};
};
window.document.write(fs.readFileSync(new URL('../order-filler.html',import.meta.url),'utf8').replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,''));
if(process.argv.includes('--range-permissions')) {
 // Check shipped markup before the legacy installer can repair its attributes.
 for(const action of ['changeGoalMode','changeGoal']) {
  const commands=[...window.document.querySelectorAll('[speech-function="WMOFActions.'+action+'"]')];
  assert(commands.length&&commands.every(command=>command.hasAttribute('speech-persist')),action+' ships with explicit server permission');
 }
}
// PHP embeds the current resources; discard the static HTML export's snapshot.
window.document.querySelector('#language-pack')?.remove();
installEnglishPack(window);
if(process.argv.includes('--account-settings')){
 window.WMOFPersistence={ready:Promise.resolve(),initializeLegacy:async()=>{},peek:()=>null,getItem:async()=>null,setItem:async()=>{},commit:async()=>{},flush:async()=>{}};
 window.eval(fs.readFileSync(new URL('../AccountSettings.js',import.meta.url),'utf8'));
}
for(const name of ['TemporalFormat','TimerAppearance','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer','CalendarRange','DigitSequence','TripAggregates','TripLog','StateTransactions','SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter','SpeechFunctionRoles','SpeechFunctionRegistry','UtilityFunctions','SpeechProcessingFunctions','ActionFunctions','InteractionFunctions','PresentationSetters'])window.eval(fs.readFileSync(name==='StateTransactions' && process.env.CLOCKTIMER_STATE_SOURCE || name==='ActionFunctions' && process.env.CLOCKTIMER_ACTION_SOURCE || new URL('../'+name+'.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nwindow.ParameterParser=ParameterParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/DurationParser.js',import.meta.url),'utf8')+'\nwindow.EnglishDurationParser=EnglishDurationParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US/SpokenTimeParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/PercentParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/SpeechValuePreprocessor.js',import.meta.url),'utf8'));
let speechSource=fs.readFileSync(process.env.CLOCKTIMER_SPEECH_SOURCE || new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
if(process.argv.includes('--break-end-stream'))speechSource=speechSource.replace('static #pipeline = "raw";', 'static #pipeline = "silero";');
speechSource=speechSource.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testPause(u){u.continuationPauseStartedAt=performance.now()-(SpeechMenu.#continuationGraceMilliseconds()-150);SpeechMenu.#armContinuationPauseDeadline(u);}
    static testResume(){const pipeline=SpeechMenu.#pipeline;SpeechMenu.#pipeline="silero";try{SpeechMenu.#onVadSpeechStart({detail:{}});}finally{SpeechMenu.#pipeline=pipeline;}}
    static testBackend(name){SpeechMenu.#recognizerBackend=name;}
    static testModelReady(ready){SpeechMenu.#modelReady=ready;}
    static testBegin(){SpeechMenu.#modelReady=true;SpeechMenu.#executionEnabled=true;SpeechMenu.#sleeping=false;SpeechMenu.#stopped=false;SpeechMenu.#stream={getTracks(){return [];}};SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};SpeechMenu.#beginUtterance(window.__testTime-performance.timeOrigin);return SpeechMenu.#utterance;}
    static testTranscript(u,text,final=true){return SpeechMenu.#handleLiveTranscript(u,text,final);}
    static testFinish(){SpeechMenu.#finishUtterance("vad-silence",true);}
    static testDeliverFinal(u,text){SpeechMenu.#onSherpaTranscript({detail:{utteranceId:u.id,transcript:text,isFinal:true}});}
    static testFinal(u,text){return SpeechMenu.#handleCompletedTranscript(u,text);}
    static testAvailable(){return SpeechMenu.#availableCandidates();}
    static testVoskContext(id,text){return SpeechMenu.#voskContext(id,text);}
    static testUseRecognizer(recognizer){SpeechMenu.#recognizerBackend='vosk';SpeechMenu.#recognizer=recognizer;}
    static testResult(u,text,final=false){SpeechMenu.#onSherpaTranscript({detail:{utteranceId:u.id,transcript:text,isFinal:final}});}
    static async testSilence(u,text){await SpeechMenu.#handleLiveTranscript(u,text,true);await u.digestQueue;await u.segmentBarrier;return u.hadCommittedCommand && !u.digestFailed && !u.digestExecutionFailed;}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
window.eval(speechSource+'\nwindow.SpeechMenu=SpeechMenu;');
window.SpeechMenu.events.addEventListener('speechFeedbackError',e=>errors.push(e.detail.error?.stack||String(e.detail.error)));
window.eval(fs.readFileSync(new URL('../SpeechMicBar.js',import.meta.url),'utf8'));
window.SpeechMenu.testBegin();
if(process.argv.includes('--voice-feedback') || process.argv.includes('--interval-actions')) window.eval(fs.readFileSync(new URL('../AnnouncementCatalog.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../GraphicalSettings.js',import.meta.url),'utf8'));
let appSource=fs.readFileSync(process.env.CLOCKTIMER_APP_SOURCE || new URL('../app.js',import.meta.url),'utf8');
// The fixture freezes Date.now for trip boundaries; eliminate audio pauses
// so its frozen wall clock cannot accumulate an artificial playback backlog.
if(process.argv.includes('--voice-feedback') || process.argv.includes('--interval-actions')) appSource=appSource.replace('const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;', 'const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 0;');
if(process.argv.includes('--pointer-mode') || process.argv.includes('--range-permissions'))window.eval(fs.readFileSync(new URL('../ModeMenu.js',import.meta.url),'utf8'));
window.eval(appSource);

const settle=()=>new Promise(resolve=>setTimeout(resolve,150));await settle();
const timer=window.document.querySelector('#clockTimer');
if(process.argv.includes('--range-permissions')) {
 await timer.connect('test','password');await settle();
 window.document.querySelector('#loginDialog').close();await settle();
 const rangeErrors=[];
 window.addEventListener('wmof:trip-log-error',event=>rangeErrors.push(event.detail));
 const reads=()=>requests.filter(r=>r.path.endsWith('/trips/')&&(!r.options.method||r.options.method==='GET')).length;
 const say=async(phrase,range)=>{
  const before=reads(),u=window.SpeechMenu.testBegin();
  await window.SpeechMenu.testTranscript(u,phrase,true);await u.digestQueue;await settle();
  assert(u.hadCommittedCommand&&!u.digestExecutionFailed,phrase+' executes: '+JSON.stringify({rangeErrors,login:window.document.querySelector('#loginDialog').open,mode:timer.percentMode,digest:u.digestSteps?.map(step=>step.commandElement?.getAttribute('speech-function')),status:window.document.querySelector('.persistence-status')?.textContent}));
  assert.deepEqual(rangeErrors,[],phrase+' refreshes server data without a client-only permission error');
  assert.equal(window.WMOFInteractionState.state.tripLogRange,range);
  assert.equal(window.document.querySelector('#tripLogRangeError').hidden,true);
  assert(reads()>before,phrase+' fetches totals for the selected range');
  assert.equal(window.WMOFCoordinator.lockCount,0,phrase+' releases its UI locks');
 };
 for(const [phrase,range] of [['week','week'],['month','month'],['money','pay-period'],['year','year'],['day','day']])await say(phrase,range);
 await window.WMOFActions.openTripLog('button');await settle();
 for(const [phrase,range] of [['week','week'],['month','month'],['money','pay-period'],['year','year'],['day','day']])await say(phrase,range);
 const select=window.document.querySelector('#tripLogRangeSelect');
 for(const range of ['week','pay-period','month','year','custom','day']){
  if(range==='custom'){
   window.document.querySelector('#tripLogStartDate').value='2026-10-01';
   window.document.querySelector('#tripLogEndDate').value='2026-10-06';
  }
  const before=reads();select.value=range;select.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();
  assert.equal(window.WMOFInteractionState.state.tripLogRange,range);
  assert(reads()>before,range+' pointer selection fetches its totals');
  assert.deepEqual(rangeErrors,[]);
 }
 for(const action of ['changeGoalMode','changeGoal']){
  const command=window.document.querySelector('[speech-function="WMOFActions.'+action+'"]');
  assert(command?.hasAttribute('speech-persist'),action+' declares its server access');
 }
 assert.equal(window.document.querySelector('[speech-function="WMOFActions.readGoalMode"]').hasAttribute('speech-persist'),false,'local mode readback stays client-only');
 assert.equal(stored.length,0,'view changes do not write trip events');
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS voice and pointer Trip Log ranges refresh server data with explicit permissions, no trip writes, and no stranded locks');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--pointer-mode')){
 const button=window.document.querySelector('#scopeToggle');
 button.click();window.document.querySelector('#scopeToggleDropdown [data-mode=week]').click();await settle();
 assert.equal(button.textContent,'Week');
 button.click();window.document.querySelector('#scopeToggleDropdown [data-mode=day]').click();
 assert.equal(timer.percentMode,'total','first Day selection switches timer scope immediately');
 assert.equal(button.textContent,'Day','first selection updates mode label immediately');
 await settle();
 assert.equal(timer.percentMode,'total','range loading retains the selected scope');
 assert.equal(button.textContent,'Day','range loading retains the selected label');
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);window.happyDOM.abort();console.log('PASS first pointer Day selection applies immediately and survives range loading');process.exit(0);
}
if(process.argv.includes('--account-settings')){
 await timer.connect('test','password');await settle();
 assert.equal(window.WMOFAccountSettings.owner,2);assert.equal(window.WMOFAccountSettings.loaded,true);
 assert.equal(timer.style.getPropertyValue('--clock-timer-trip-color'),'#123456');assert.equal(timer.percentMode,'auto','login applies saved account mode');
 await window.WMOFUtilities.safeStorageSet('wmof.clock.percentMode','trip');assert.equal(accountBlob.orderFiller['wmof.clock.percentMode'],'trip');
 window.WMOFAccountSettings.clear();assert.equal(window.WMOFUtilities.safeStorageGet('wmof.clock.graphicalSettings'),null);
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);window.happyDOM.abort();console.log('PASS main app account login hydration, graphical settings, mode and server-only saves');process.exit(0);
}
if(process.argv.includes('--landing-session')) {
 assert.equal(timer.networkStatus,'online','landing handoff validates and resumes the server session');
 assert.equal(window.document.querySelector('#loginDialog').open,false,'existing authenticated session bypasses PIN login');
 assert.equal(window.document.querySelector('#legacyLoginDialog').open,false,'existing authenticated session bypasses username login');
 assert(!requests.some(request=>request.path.endsWith('/users/') && request.options.method==='POST'),'session handoff sends no credentials');
 await window.WMOFActions.disconnectUser();
 assert.equal(window.location.pathname,'/index.php','confirmed Order Filler logout returns to landing page');
 window.happyDOM.abort();
 console.log('PASS existing landing session bypasses login and confirmed Order Filler logout returns to index');
 process.exit(0);
}
// Happy DOM can retain parsed attributes without initial upgrade callbacks.
// Align this fixture's mode attribute with the initialized model before exercising setters.
if(process.argv.includes('--setting-chimes')) timer.configure({goal_type:timer.percentMode});
const states=[];
window.WMOFStateTransactions.addEventListener('state',event=>states.push(event.detail.state));
if(process.argv.includes('--setting-chimes')) {
 const hear=async(transcript,action,...args)=>{const start=chimes.length;await window.SpeechMenu.withExecutionContext({transcript},()=>window.WMOFActions[action](...args));await settle();return chimes.slice(start);};
 assert.deepEqual(await hear('speech off','setSpeechMaster'),['setting-off']);
 assert.deepEqual(await hear('speech on','setSpeechMaster'),['setting-on']);
 assert.deepEqual(await hear('speech on','setSpeechMaster'),['setting-unchanged']);
 assert.deepEqual(await hear('chime off','setChimeMaster'),['setting-off'],'final off cue remains audible before chime master is disabled');
 const before=chimes.length;await window.WMOFActions.readGoalMode();await settle();assert.equal(chimes.length,before,'chime master suppresses readback chime');
 assert.deepEqual(await hear('chime on','setChimeMaster'),['setting-on']);
 const start=chimes.length;await window.WMOFActions.readGoalMode();await settle();assert.deepEqual(chimes.slice(start),['setting-unchanged'],'informational command uses unchanged chime');
 const rateStart=chimes.length;await window.WMOFActions.setChimeRate('Medium');await settle();assert.deepEqual(chimes.slice(rateStart),['setting-unchanged'],'same value pointer setting uses unchanged chime');
 console.log('PASS setting on/off/unchanged, final chime-off cue, disabled master, readback and unchanged rate');
}
if(!process.argv.includes('--startup-speech')) {
 await settle();
}
if(process.argv.includes('--startup-speech')) {
 assert.equal(spoken.filter(t=>t==='Application is loading').length,1,'page loading announces startup once');
 assert.equal(window.document.querySelector('#startupAudioDialog'),null,'startup has no blocking dialog');
 window.document.dispatchEvent(new window.Event('pointerdown'));
 window.document.dispatchEvent(new window.Event('pointerdown'));
 assert.deepEqual(startupAudioCalls,['speak','unlock'],'startup speaks while loading; first interaction unlocks audio exactly once');
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();
 await window.WMOFActions.switchToVoiceLogin();await window.WMOFActions.handleSpeechRuntimeStarted();await settle();
 assert.equal(spoken.filter(t=>t==='Please login via voice').length,0,'ready model must not overtake startup announcement');
 assert(window.WMOFInteractionState.state,'UI initialized while startup audio is pending');
 finishStartup();await settle();assert.equal(spoken.filter(t=>t==='Please login via voice').length,1,'release latest prompt after startup speech completes');
 console.log('PASS startup speech completion barrier without blocking UI/model initialization');
 if(!process.argv.includes('--voice-login')){window.happyDOM.abort();process.exit(0);}
}
if(process.argv.includes('--voice-code-adapter')) {
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 window.eval(fs.readFileSync(new URL('../VoskRecognizer.js',import.meta.url),'utf8'));
 const decoders=[];class Decoder {constructor(rate,grammar){this.listeners={};this.phrases=JSON.parse(grammar);decoders.push(this);}on(event,fn){this.listeners[event]=fn;}setWords(){}acceptWaveformFloat(){}remove(){}emit(text){this.listeners.partialresult({result:{partial:text}});}}
 const u=window.SpeechMenu.testBegin();const recognizer=new window.VoskRecognizer({model:{KaldiRecognizer:Decoder},contextProvider:(id,text)=>window.SpeechMenu.testVoskContext(id,text)});
 const observed=[];window.SpeechMenu.testUseRecognizer(recognizer);recognizer.addEventListener('transcript',event=>{observed.push(event.detail.transcript);window.SpeechMenu.testResult(u,event.detail.transcript,event.detail.isFinal);});
 const adapterErrors=[];recognizer.addEventListener('error',event=>adapterErrors.push(event.detail.message));
 await recognizer.beginUtterance(u.id);
 const emit=async text=>{decoders.at(-1).emit(text);for(let i=0;i<20;i++)await new Promise(resolve=>setTimeout(resolve,10));await u.digestQueue;await u.segmentBarrier;await settle();};
 await emit('zero zero four two');
 assert.deepEqual(decoders.at(-1).phrases,['cancel','castle','o k','okay','ok'].sort(),'ID confirmation decoder contains only OK and Cancel');
 await emit('okay');
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin','adapter confirms ID');
 await emit('one two three four day');
 assert.deepEqual(decoders.at(-1).phrases,['cancel','castle','o k','okay','ok'].sort(),'PIN confirmation decoder excludes day and new digit runs');
 assert(!observed.at(-1).endsWith('day'),'unsupported pre-switch confirmation is re-decoded rather than carried into the narrow grammar');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,0,'day is never accepted as OK');
 await emit('okay');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,0,'adapter reviews PIN before final OK');
 await emit('okay');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,0,'duplicate partial confirmation cannot submit login');
 await emit('okay okay');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,1,'adapter submits only after final OK: '+JSON.stringify({observed,phrases:decoders.at(-1).phrases,state:window.WMOFInteractionState.state.login,failed:u.digestFailed,steps:u.digestSteps?.map(step=>step.commandElement.getAttribute('speech-function'))}));
 assert.deepEqual(adapterErrors,[]);assert(!u.digestFailed);recognizer.close();
 console.log('PASS Vosk adapter consecutive ID and PIN confirmation');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--voice-code-router')) {
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 const u=window.SpeechMenu.testBegin();const initial=await window.SpeechMenu.testVoskContext(u.id);
 const router=new window.VoskGrammarRouter({...initial,valuePhrases:window.VoskGrammarRouter.valuePhrases(),nextRecords:async text=>(await window.SpeechMenu.testVoskContext(u.id,text)).records});
 const route=async text=>{const result=await router.update(text);await window.SpeechMenu.testTranscript(u,result.transcript,false);await u.digestQueue;await u.segmentBarrier;await settle();return result;};
 await route('zero zero four two');await route('okay');
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin','routed ID confirms');
 await route('okay one two three four');await route('okay');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,0,'routed PIN is reviewed first');
 await route('okay okay');
 assert.equal(requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length,1,'final routed OK submits after PIN review');
 assert.equal(u.digestExecutionFailed,undefined);assert(!u.digestFailed);
 console.log('PASS Vosk routing of consecutive ID and PIN confirmations');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--pin-review')) {
 const reference=JSON.parse(fs.readFileSync(new URL('../docs/mainline-fsm-draft.json',import.meta.url),'utf8'));
 const assertPhase=id=>{
  const binding=reference.states[id].binding;
  for(const key of ['phase','pending','reviewReady'])if(binding['login.'+key]!==undefined)assert.equal(window.WMOFInteractionState.state.login[key],binding['login.'+key],id+' runtime satisfies the version 2 FSM binding for '+key);
 };
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();await settle();
 const slot=(stage,index)=>dialog.querySelector('[data-login-digit="'+stage+'"][data-digit-index="'+index+'"]');
 const posts=()=>requests.filter(request=>request.path.endsWith('/users/')&&request.options.method==='POST').length;
 const say=async text=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,text,true);await u.digestQueue;await u.segmentBarrier;await settle();assert(!u.digestExecutionFailed,text+' executes');return u;};
 slot('id',0).blur();spoken.length=0;slot('id',0).focus();await settle();
 assert.deepEqual(spoken,['Please login via voice'],'empty first ID focus speaks while recognition is on');
 assertPhase('LOGIN-ID');
 const before=posts();await say('zero zero four two okay');
 assert.equal(window.document.activeElement,slot('pin',0));assert(spoken.includes('zero zero four two. Password'),'ID readback precedes Password with a sentence pause');
 assertPhase('LOGIN-PIN');
 await say('cancel');assert.equal(window.WMOFInteractionState.state.login.stage,'id','Cancel before PIN entry returns to ID');assert.equal(window.document.querySelector('#loginUsername').value,'');
 await say('zero zero four two okay');
 spoken.length=0;await say('one two three four okay');
 assert.equal(posts(),before,'first PIN OK reads back without authenticating');
 assert.equal(window.WMOFInteractionState.state.login.reviewReady,true);assert(spoken.includes('one two three four'));
 assertPhase('LOGIN-REVIEW');
 assert(window.WMOFSpeechAvailability.canConfirmLoginReview());assert(!window.WMOFSpeechAvailability.canUseLogin(),'review grammar no longer accepts digit groups');
 await say('cancel');assert.equal(window.WMOFInteractionState.state.login.reviewReady,false);assert.equal(window.document.querySelector('#loginPassword').value,'');
 await say('cancel');assert.equal(window.WMOFInteractionState.state.login.stage,'id','two Cancels clear PIN and then ID');
 await say('zero zero four two okay');
 await say('five six seven eight okay');assert.equal(posts(),before);assert.equal(window.WMOFInteractionState.state.login.reviewReady,true);
 slot('pin',3).dispatchEvent(new window.KeyboardEvent('keydown',{key:'9',bubbles:true,cancelable:true}));
 assert.equal(window.WMOFInteractionState.state.login.reviewReady,false,'editing revokes the previous readback confirmation');
 await window.WMOFActions.confirmLoginDigits();assert.equal(posts(),before);assert(spoken.includes('five six seven nine'));
 rejectLogin=true;await say('okay');rejectLogin=false;assert.equal(posts(),before+1,'only the separate final OK submits login');
 assert.equal(window.document.querySelector('#loginPassword').value,'');assert.equal(window.document.activeElement,slot('pin',0),'failed login focuses the first empty PIN digit');
 assert.equal(window.document.querySelector('#loginUsername').value,'0042');assert.equal(window.WMOFInteractionState.state.login.reviewReady,false);
 assertPhase('LOGIN-PIN');
 await say('one two three four okay');assert.equal(posts(),before+1);await say('okay');assert.equal(posts(),before+2,'retry requires PIN OK followed by final OK');
 assert.equal(window.document.querySelector('#loginPassword').value,'');
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS focus announcements, spoken ID/Password, PIN readback before final OK, cancellation, edits and review-only speech grammar');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--pin-return')) {
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 const slot=(stage,index)=>dialog.querySelector('[data-login-digit="'+stage+'"][data-digit-index="'+index+'"]');
 const press=(stage,index,key,extra={})=>slot(stage,index).dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
 const newline=(stage,index)=>slot(stage,index).dispatchEvent(new window.InputEvent('beforeinput',{inputType:'insertLineBreak',bubbles:true,cancelable:true}));
 const posts=()=>requests.filter(request=>request.path.endsWith('/users/')&&request.options.method==='POST').length;
 for(const path of ['keyboard','mobile']) {
  await window.WMOFActions.cancelLoginDigits();await window.WMOFActions.cancelLoginDigits();
  const before=posts(),confirm=(stage,index)=>path==='keyboard'?press(stage,index,'Enter'):newline(stage,index);
  for(const [index,digit] of [...'123'].entries())press('id',index,digit);
  confirm('id',2);await settle();assert.equal(window.WMOFInteractionState.state.login.stage,'id');assert.equal(posts(),before);
  press('id',3,'4');confirm('id',3);await settle();
  assert.equal(window.WMOFInteractionState.state.login.stage,'pin');assert.equal(window.document.activeElement,slot('pin',0));assert.equal(posts(),before);
  for(const [index,digit] of [...'567'].entries())press('pin',index,digit);
  confirm('pin',2);await settle();assert.equal(posts(),before,'incomplete PIN is not submitted');
  press('pin',3,'8');confirm('pin',3);await settle();assert.equal(posts(),before,'first PIN Return requests readback only');
  assert.equal(window.WMOFInteractionState.state.login.reviewReady,true,JSON.stringify({path,login:window.WMOFInteractionState.state.login,id:window.document.querySelector('#loginUsername').value,pin:window.document.querySelector('#loginPassword').value,error:window.document.querySelector('#loginError').textContent,consoleErrors}));
  holdLogin=true;confirm('pin',3);await settle();
  assert.equal(posts(),before+1,'four digits plus Return uses the OK login path');
  assert(slot('pin',3).disabled,'input is disabled while the login is pending');
  press('pin',3,'Enter',{repeat:true});newline('pin',3);await settle();assert.equal(posts(),before+1,'repeated Return cannot submit twice');
  holdLogin=false;releaseLogin();await settle();await settle();await new Promise(resolve=>setTimeout(resolve,1100));
  if(!dialog.open)dialog.showModal();
 }
 assert.equal(slot('id',0).getAttribute('enterkeyhint'),'next');assert.equal(slot('pin',0).getAttribute('enterkeyhint'),'go');
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS keyboard/mobile Return advances ID, reviews PIN, then submits once on final confirmation; incomplete input is rejected');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--pin-editing')) {
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 const slot=(stage,index)=>dialog.querySelector('[data-login-digit="'+stage+'"][data-digit-index="'+index+'"]');
 const press=(element,key)=>element.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 press(slot('id',0),'1');press(slot('id',1),'2');slot('id',2).focus();press(slot('id',2),'Backspace');
 assert.equal(window.document.querySelector('#loginUsername').value,'1','Backspace on an empty slot deletes the previous digit');
 assert.equal(window.document.activeElement,slot('id',1));
 press(slot('id',1),'2');slot('id',2).focus();
 slot('id',2).dispatchEvent(new window.InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
 assert.equal(window.document.querySelector('#loginUsername').value,'1','mobile backward deletion follows the same rule');
 assert.equal(window.document.activeElement,slot('id',1));
 press(slot('id',0),'Delete');assert.equal(window.document.querySelector('#loginUsername').value,'');
 for(const stage of ['id','pin']) {
  if(stage==='pin') {await window.WMOFActions.enterLoginDigits('1234');await window.WMOFActions.confirmLoginDigits();}
  const value=()=>window.document.querySelector(stage==='id'?'#loginUsername':'#loginPassword').value;
  press(slot(stage,0),'1');press(slot(stage,1),'2');
  slot(stage,2).focus();press(slot(stage,2),'Delete');assert.equal(value(),'12','Delete in an empty slot leaves previous digits alone');
  press(slot(stage,2),'3');press(slot(stage,2),'Backspace');
  assert.equal(value(),'12','Backspace in a filled slot deletes only its own digit');assert.equal(window.document.activeElement,slot(stage,1));
  slot(stage,2).focus();slot(stage,2).dispatchEvent(new window.InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
  assert.equal(value(),'1');assert.equal(window.document.activeElement,slot(stage,1));
  press(slot(stage,0),'Backspace');assert.equal(value(),'');assert.equal(window.document.activeElement,slot(stage,0));
  if(stage==='id') {press(slot(stage,0),'Backspace');assert.equal(value(),'','Backspace at the first empty ID slot is safe');}
  if(stage==='pin') {
   press(slot(stage,0),'5');press(slot(stage,1),'6');assert.equal(slot(stage,0).value,'*','PIN editing remains masked');
   press(slot('id',0),'Backspace');assert.equal(window.document.querySelector('#loginUsername').value,'1234','inactive credential cannot be deleted');
  }
 }
 for(const method of ['keyboard','mobile']) {
  await window.WMOFActions.cancelLoginDigits();await window.WMOFActions.cancelLoginDigits();
  await window.WMOFActions.enterLoginDigits('1234');await window.WMOFActions.confirmLoginDigits();
  press(slot('pin',0),'Delete');assert.equal(window.WMOFInteractionState.state.login.stage,'pin','forward Delete cannot restart ID entry');
  press(slot('pin',1),'9');slot('pin',0).focus();
  if(method==='keyboard')press(slot('pin',0),'Backspace');
  else slot('pin',0).dispatchEvent(new window.InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
  assert.equal(window.WMOFInteractionState.state.login.stage,'id',method+' Backspace on empty first PIN returns to ID');
  assert.equal(window.document.querySelector('#loginUsername').value,'','previous four-digit ID is cleared');
  assert.equal(window.document.querySelector('#loginPassword').value,'','partial PIN is discarded');
  assert.equal(window.document.activeElement,slot('id',0));
  assert.equal(slot('id',0).disabled,false);assert.equal(slot('pin',0).disabled,true);
 }
 assert.equal(requests.filter(request=>request.path.endsWith('/users/')&&request.options.method==='POST').length,0,'editing and confirming ID never submits credentials');
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS empty login slot Backspace deletes the previous digit for keyboard and mobile input');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--voice-code')) {
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 const say=async(text,final=true,u=window.SpeechMenu.testBegin())=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();return u;};
 const posts=()=>requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length;
 const before=posts();
 for(const text of ['one two three four','okay','one two three okay','one two three four five okay']) {
   await say(text);assert.equal(window.WMOFInteractionState.state.login.stage,'id',text+' cannot advance ID');
   assert.equal(window.document.querySelector('#loginUsername').value,'',text+' cannot edit ID');assert.equal(posts(),before);
 }
 const collecting=await say('zero zero four two',false);assert.equal(window.document.querySelector('#loginUsername').value,'','digits stay pending until OK');
 await say('zero zero four two okay',false,collecting);
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin','four digits plus OK executes before final recognition');
 assert.equal(window.document.querySelector('#loginUsername').value,'0042');assert.equal(window.WMOFCoordinator.pending.length,0);
 await say('okay');await say('one two three four five okay');assert.equal(posts(),before,'standalone OK and five digits cannot authenticate');
 await say('cancel');assert.equal(window.WMOFInteractionState.state.login.stage,'id');
 await say('zero zero four two okay');
 await say('background chatter one two three four okay');assert.equal(posts(),before,'valid PIN head requests review');
 await say('okay');assert.equal(posts(),before+1,'final OK authenticates exactly once');
 assert.equal(window.document.querySelector('#loginPassword').value,'','confirmed PIN is cleared');
 assert.equal(errors.length,0,errors.join('\n'));assert.deepEqual(consoleErrors,[]);
 console.log('PASS atomic four-digit voice codes plus OK, early confirmation, Cancel and malformed-code rejection');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--voice-login')) {
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const legacyDialog=window.document.querySelector('#legacyLoginDialog');
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 assert.equal(window.WMOFInteractionState.state.login.stage,'id');
 assert(spoken.includes('Application is loading'),'startup announces Application is loading');
 window.SpeechMenu.testModelReady(false);const promptsBefore=spoken.filter(t=>t==='Please login via voice').length;
 await window.WMOFActions.switchToVoiceLogin();assert.equal(spoken.filter(t=>t==='Please login via voice').length,promptsBefore,'login prompt waits for model readiness');assert(!window.WMOFSpeechAvailability.canUseLogin());
 window.SpeechMenu.testModelReady(true);await window.WMOFActions.handleSpeechRuntimeStarted();await settle();assert.equal(spoken.filter(t=>t==='Please login via voice').length,promptsBefore+1,'model-ready event releases the pending login prompt');
 const speak=async text=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,text,true);await u.digestQueue;await settle();return u;};
 const id=await speak('zero zero four two okay');assert(!id.digestExecutionFailed,'ID sequence plus OK must execute: '+JSON.stringify({errors,consoleErrors,stage:window.WMOFInteractionState.state.login,value:window.document.querySelector('#loginUsername').value}));
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin');assert.equal(window.document.querySelector('#loginUsername').value,'0042');
 assert(spoken.includes('Password'),'ID confirmation announces PIN prompt');
 await window.WMOFActions.enterLoginDigits('zero zero seven three');
 assert.deepEqual([...dialog.querySelectorAll('[data-login-digit="pin"]')].map(e=>e.value),['*','*','*','*']);
 assert(!spoken.includes('0073'),'PIN must not be spoken back');
 await speak('one two three four');assert.equal(window.document.querySelector('#loginPassword').value,'1234','fresh four-digit PIN replaces previous value');
 await speak('five six seven eight zero zero seven three');assert.equal(window.document.querySelector('#loginPassword').value,'0073','two consecutive groups retain the newest four digits');

 const preserveRecognition=async()=>{
  const snapshot=JSON.stringify(window.WMOFInteractionState.state.login),idValue=window.document.querySelector('#loginUsername').value,pinValue=window.document.querySelector('#loginPassword').value;
  const username=window.document.querySelector('#loginLegacyUsername').value,password=window.document.querySelector('#loginLegacyPassword').value;
  await window.SpeechMenu.sleep();await settle();assert.equal(window.WMOFInteractionState.state.speechRecognition,'sleeping');
  assert.equal(JSON.stringify(window.WMOFInteractionState.state.login),snapshot,'sleep preserves login state');assert(!window.WMOFSpeechAvailability.canSwitchToVoiceLogin());
  assert(!window.SpeechMenu.testAvailable().some(e=>e.closest('dialog')===dialog),'sleep unloads login speech commands');
  assert.equal(window.document.querySelector(window.WMOFInteractionState.state.login.method==='password'?'#legacyLoginEnableRecognition':'#loginEnableRecognition').hidden,false);
  await window.SpeechMenu.wake();await window.WMOFActions.handleSpeechRuntimeMuted(false);await settle();
  assert.equal(window.WMOFInteractionState.state.speechRecognition,'listening');assert.equal(JSON.stringify(window.WMOFInteractionState.state.login),snapshot);
  await window.WMOFActions.handleSpeechRuntimeStopped();await settle();assert.equal(window.WMOFInteractionState.state.speechRecognition,'off');
  assert.equal(JSON.stringify(window.WMOFInteractionState.state.login),snapshot,'off preserves login state');assert(!window.WMOFSpeechAvailability.canUseLogin());
  assert.equal(window.document.querySelector(window.WMOFInteractionState.state.login.method==='password'?'#legacyLoginEnableRecognition':'#loginEnableRecognition').hidden,false,'enable recognition available in either login mode');
  assert.equal(window.document.querySelector('#loginButton').disabled,window.WMOFInteractionState.state.login.pending,'pointer availability follows login pending state, not recognition');
  window.SpeechMenu.testBegin();await window.WMOFActions.handleSpeechRuntimeStarted();await settle();assert.equal(window.WMOFInteractionState.state.speechRecognition,'listening');
  assert.equal(window.document.querySelector('#loginUsername').value,idValue);assert.equal(window.document.querySelector('#loginPassword').value,pinValue);
  assert.equal(window.document.querySelector('#loginLegacyUsername').value,username);assert.equal(window.document.querySelector('#loginLegacyPassword').value,password);
 };
 await preserveRecognition();

 const loginPosts=()=>requests.filter(r=>r.path.endsWith('/users/')&&r.options.method==='POST').length;
 const beforeSwitch=loginPosts();await speak('user');
 assert.equal(window.WMOFInteractionState.state.login.method,'password');assert(legacyDialog.open && !dialog.open,'username/password opens a separate modal');
 const originalStart=window.SpeechMenu.start;window.SpeechMenu.testModelReady(false);let finishModel;
 window.SpeechMenu.start=()=>new Promise(resolve=>finishModel=resolve);
 window.document.querySelector('#loginVoiceSwitch').click();await settle();assert(legacyDialog.open&&!dialog.open,'Login via voice waits in the legacy modal until the model is ready');assert.equal(window.document.querySelector('#loginVoiceSwitch').disabled,true);
 window.SpeechMenu.testModelReady(true);finishModel(true);await window.WMOFActions.handleSpeechRuntimeStarted();await settle();assert(dialog.open&&!legacyDialog.open,'ready model completes the pending modal handoff');window.SpeechMenu.start=originalStart;
 await speak('user');

 assert.equal(window.document.querySelector('#loginPassword').value,'','switch clears PIN');
 assert.equal(window.document.querySelector('#loginLegacyFields').hidden,false);
 assert.equal(window.document.querySelector('#loginVoiceSwitch').hidden,false);
 assert(spoken.includes('Login with username and password.'));
 assert.equal(window.WMOFSpeechAvailability.canUseLogin(),false);
 await speak('one two three four okay');assert.equal(loginPosts(),beforeSwitch,'digit commands cannot submit the password form');
 window.document.querySelector('#loginLegacyPassword').value='fixture-secret';await preserveRecognition();await speak('voice');
 assert.equal(window.WMOFInteractionState.state.login.method,'pin');assert(dialog.open && !legacyDialog.open,'Voice returns to the separate numeric modal');
 assert.equal(window.document.querySelector('#loginLegacyPassword').value,'','switch clears password');
 assert(!legacyDialog.open,'voice switch belongs to the closed password modal');
 assert(spoken.includes('Please login via voice'));
 await speak('username');assert.equal(window.WMOFInteractionState.state.login.method,'password');
 window.document.querySelector('#loginVoiceSwitch').click();await settle();assert.equal(window.WMOFInteractionState.state.login.method,'pin');
 const spacedUser=await speak('user name');assert.equal(window.WMOFInteractionState.state.login.method,'password',JSON.stringify({failed:spacedUser.digestFailed,canceled:spacedUser.chainCanceled,pending:spacedUser.digestPending,errors,consoleErrors,available:window.SpeechMenu.testAvailable().map(e=>e.dataset.speechEditorId)}));await speak('voice');

 await window.WMOFActions.enterLoginDigits('one two');const voiceAnnouncements=spoken.filter(t=>t==='Please login via voice').length;await speak('voice');
 assert.equal(window.document.querySelector('#loginUsername').value,'');assert.equal(spoken.filter(t=>t==='Please login via voice').length,voiceAnnouncements+1,'Voice loop repeats its prompt');
 await speak('user');window.document.querySelector('#loginLegacyUsername').value='stale-user';window.document.querySelector('#loginLegacyPassword').value='stale-password';
 const passwordAnnouncements=spoken.filter(t=>t==='Login with username and password.').length;await speak('username');
 assert.equal(window.document.querySelector('#loginLegacyUsername').value,'');assert.equal(window.document.querySelector('#loginLegacyPassword').value,'');
 assert.equal(spoken.filter(t=>t==='Login with username and password.').length,passwordAnnouncements+1,'Username loop repeats its prompt');await speak('voice');
 assert.equal(loginPosts(),beforeSwitch,'method switches stay client-side');

 await speak('zero zero four two okay');await window.WMOFActions.enterLoginDigits('one two');
 const pinPrompts=spoken.filter(t=>t==='Password').length;await speak('cancel');
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin');assert.equal(window.document.querySelector('#loginPassword').value,'');
 assert.equal(window.document.querySelector('#loginUsername').value,'0042','first PIN Cancel preserves confirmed ID');assert.equal(spoken.filter(t=>t==='Password').length,pinPrompts+1);
 await speak('cancel');assert.equal(window.document.querySelector('#loginUsername').value,'','second consecutive Cancel also clears ID');assert.equal(window.WMOFInteractionState.state.login.stage,'id');await speak('voice');
 await speak('zero zero four two okay');await window.WMOFActions.enterLoginDigits('one two');await speak('cancel cancel');assert.equal(window.WMOFInteractionState.state.login.stage,'id','Cancel Cancel in one utterance resets ID');assert.equal(window.document.querySelector('#loginUsername').value,'');

 for(const phrase of ['one two three four','zero zero four two','okay','one two three okay','one two three four five okay']) {
    const stage=window.WMOFInteractionState.state.login.stage;const value=window.document.querySelector('#loginUsername').value;
    await speak(phrase);assert.equal(window.WMOFInteractionState.state.login.stage,stage,phrase+' cannot advance login');
    assert.equal(window.document.querySelector('#loginUsername').value,value,phrase+' cannot edit credentials');
 }
 await speak('voice');


 const cells=[...dialog.querySelectorAll('[data-login-digit="id"]')];for(let i=0;i<4;i++)cells[i].dispatchEvent(new window.KeyboardEvent('keydown',{key:'0042'[i],bubbles:true,cancelable:true}));
 assert.equal(window.document.querySelector('#loginUsername').value,'0042');await window.WMOFActions.confirmLoginDigits();


 const successesBefore=spoken.filter(t=>t==='Login successful, say standard time or ready at').length;
 await window.WMOFActions.enterLoginDigits('nine nine nine nine');rejectLogin=true;await window.WMOFActions.confirmLoginDigits();rejectLogin=false;await settle();
 assert.equal(window.WMOFInteractionState.state.login.stage,'pin');assert.equal(window.document.querySelector('#loginUsername').value,'0042');assert.equal(window.document.querySelector('#loginPassword').value,'');
 assert(spoken.includes('Login failed. Password'));assert.equal(spoken.filter(t=>t==='Login successful, say standard time or ready at').length,successesBefore,'rejection must not announce success');assert.equal(window.document.querySelector('#loginButton').disabled,false,'failure permits immediate PIN retry');
 await window.WMOFActions.enterLoginDigits('zero zero seven three');holdLogin=true;
 const pendingLogin=window.WMOFActions.confirmLoginDigits();await settle();assert.equal(window.WMOFInteractionState.state.login.pending,true);
 assert(dialog.open && !dialog.classList.contains('dialog-closing'),'authentication remains open before server acceptance');assert.equal(spoken.filter(t=>t==='Login successful, say standard time or ready at').length,successesBefore,'pending authentication must not announce success');
 assert(!window.WMOFStateTransactions.pending.some(t=>['confirmLoginDigits','connectUser'].includes(t.action)),'authentication does not enter optimistic persistence transactions');
 for(const id of ['loginButton','loginDigitsCancel','loginLegacySwitch','loginVoiceSwitch'])assert.equal(window.document.querySelector('#'+id).disabled,true,id+' disabled while pending');
 assert.equal(window.WMOFSpeechAvailability.canSwitchToPasswordLogin(),false,'pending login unloads method switch');
 assert.equal(await window.WMOFActions.switchToPasswordLogin(),false);assert.equal(await window.WMOFActions.cancelLoginDigits(),false);
 await preserveRecognition();holdLogin=false;releaseLogin();await pendingLogin;

 const login=requests.find(r=>r.path.endsWith('/users/')&&r.options.method==='POST'&&JSON.parse(r.options.body).action==='connect-pin'&&JSON.parse(r.options.body).pin==='0073');assert(login,'PIN confirmation must reach the PIN login endpoint');
 assert.deepEqual(JSON.parse(login.options.body),{action:'connect-pin',loginId:'0042',pin:'0073'});
 assert(spoken.includes('Login successful, say standard time or ready at'));
 assert.equal(window.document.querySelector('#loginPassword').value,'');await new Promise(r=>setTimeout(r,1000));assert(!dialog.open,'successful authentication closes the modal');

 dialog.showModal();await window.WMOFActions.cancelLoginDigits();window.document.querySelector('#loginLegacySwitch').click();
 window.document.querySelector('#loginLegacyUsername').value='fixture-user';window.document.querySelector('#loginLegacyPassword').value='fixture-password';
 window.document.querySelector('#legacyLoginForm').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle();
 const legacy=requests.find(r=>r.path.endsWith('/users/')&&r.options.method==='POST'&&JSON.parse(r.options.body).action==='connect');
 assert(legacy,'legacy form uses the original connect endpoint');assert.deepEqual(JSON.parse(legacy.options.body),{action:'connect',username:'fixture-user',password:'fixture-password'});
 assert.equal(window.document.querySelector('#loginLegacyPassword').value,'');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS login switches/loopbacks, scoped commands, cleared credentials, recognition preservation and responsive pending authentication');

 await storage.flush();window.happyDOM.abort();process.exit(0);
}
const originalMode=timer.renderedTimeMode;
const checkInteractionState = () => {
    const state = window.WMOFInteractionState.state;
    assert(Object.isFrozen(state) && Object.isFrozen(state.actions), 'shared interaction state is immutable');
    const pairs = {canStartTrip:'startTrip',canUseReady:'ready',canOpenBreakMenu:'startBreak',canStartDownTime:'startDown',
        canResumeTrip:'resume',canCancelDownTime:'cancelDown',canEndBreak:'endBreak',canEndShortBreak:'endShortBreak',canEndLunch:'endLunch'};
    for (const [predicate, action] of Object.entries(pairs)) assert.equal(window.WMOFSpeechAvailability[predicate](),state.actions[action], predicate+' uses the shared snapshot');
    assert.equal(window.document.querySelector('#newTripButton').disabled, !state.actions.startTrip,'New Trip agrees with state');
    assert.equal(window.document.querySelector('#endTripButton').disabled, !state.actions[state.controls.primaryAction],'primary action agrees with state');
    const ready = window.document.querySelector('[data-speech-editor-id="builtin:ready:page"]');
    assert.equal(window.SpeechMenu.testAvailable().includes(ready), state.actions.ready, 'Ready selection agrees with state');
    const expectedOrder = [...state.goals.autoOrder].sort();
    assert.deepEqual(expectedOrder, ['standard','total','trip'], 'Auto order contains each goal once');
    return state;
};
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
await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true; // Happy DOM does not implement the Popover API.
await settle();
if(process.argv.includes('--break-end-stream')) {
 window.SpeechMenu.testBackend('vosk');
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 const tripId=timer.currentTripId;
 const say=async text=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,text,true);await u.digestQueue;await u.segmentBarrier;await settle();assert(!u.digestExecutionFailed,text);};
 for(const [kind,label] of [['break','break'],['short-break','short break'],['lunch','lunch']]) {
  window.__testTime+=60000;await window.WMOFActions.startBreak(kind);await settle();spoken.length=0;
  const intervalKey=timer.getActiveIntervalState().intervalKey,u=window.SpeechMenu.testBegin();
  const question='Are you ready to end your '+label+'?';
  await window.SpeechMenu.testTranscript(u,'break end',false);await u.digestQueue;await u.segmentBarrier;await settle();
  assert(window.document.querySelector('#speechBreakConfirmDialog').open,'recognized '+kind+' End opens its confirmation without waiting for final feedback');
  assert.equal(spoken.filter(text=>text===question).length,1,'question is announced immediately');
  assert.equal(timer.getActiveIntervalState().intervalKey,intervalKey,'confirmation waits for OK');
  window.SpeechMenu.testFinish();await settle();
  window.SpeechMenu.testDeliverFinal(u,'break end');await u.digestQueue;await u.segmentBarrier;await settle();
  assert.equal(spoken.filter(text=>text===question).length,1,'late final feedback cannot repeat the question');
  assert.equal(window.WMOFCoordinator.lockCount,0);
  if(kind==='lunch') {
   await window.WMOFActions.cancelBreakPrompt();await settle();
   window.SpeechMenu.testDeliverFinal(u,'break end');await settle();
   assert(!window.document.querySelector('#speechBreakConfirmDialog').open,'late feedback cannot reopen a canceled dialog');
   assert.equal(timer.getActiveIntervalState().intervalKey,intervalKey,'cancel preserves the break');
   await say('break end');
  } else assert(window.document.querySelector('#speechBreakConfirmDialog').open,'confirmation remains open after the final transcript');
  await say('ok');assert(!timer.getActiveIntervalState());
  assert.equal(timer.uiState.trip_active,true);assert.equal(timer.currentTripId,tripId);
  assert(!window.document.querySelector('#tripTransitionOverlay').open);
  window.__testTime+=60000;await window.WMOFActions.startBreak(kind);await settle();spoken.length=0;
  await say('break end ok');assert(!timer.getActiveIntervalState());
  assert(!spoken.includes(question),'a known OK chain skips the intermediate question');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS interim Vosk Break End opens and announces all break confirmations immediately; final feedback, cancellation and direct OK chains remain safe');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--break-boundaries')) {
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 const tripId=timer.currentTripId,tripEnds=[];
 timer.addEventListener('tripEnded',event=>tripEnds.push(event.detail));
 const say=async text=>{
   const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,text,true);
   await u.digestQueue;await u.segmentBarrier;await settle();assert(!u.digestExecutionFailed,text+' executes');
 };
 const assertResumed=()=>{
   assert.equal(timer.uiState.trip_active,true,'the original trip stays active');
   assert(['running','open'].includes(timer.status),'trip is running or in its open Down interval');
   assert.equal(timer.currentTripId,tripId);
   assert.deepEqual(tripEnds,[],'ending a break never emits Trip Ended');
   assert.equal(stored.filter(event=>event.event==='trip.stopped').length,0);
   assert.equal(window.document.querySelector('#tripTransitionOverlay').open,false,'no trip summary');
   assert.equal(window.WMOFCoordinator.lockCount,0);
 };
 for(const kind of ['break','short-break','lunch']) {
   for(const path of ['separate','chained','pointer']) {
     window.__testTime+=60000;assert.equal(await window.WMOFActions.startBreak(kind),true);await settle();
     const interval=timer.getActiveIntervalState();
     if(path==='chained')await say('break end ok');
     else {
       spoken.length=0;await say('break end');
       assert(window.document.querySelector('#speechBreakConfirmDialog').open);
       assert.equal(timer.getActiveIntervalState().intervalKey,interval.intervalKey,'break end waits for OK');
       if(process.argv.includes('--voice-feedback'))assert(spoken.some(text=>text.startsWith('Are you ready to end your ')),JSON.stringify(spoken));
       if(path==='pointer') {window.document.querySelector('#speechBreakConfirmYes').click();await settle();}
       else await say('ok');
     }
     assert(!timer.getActiveIntervalState(),kind+' ends through '+path);assertResumed();
     assert.equal(stored.filter(event=>event.event==='interval.ended'&&event.value.intervalKey===interval.intervalKey).length,1);
   }
   for(const replacement of [undefined,kind,'down']) {
     window.__testTime+=60000;assert.equal(await window.WMOFActions.startBreak(kind),true);await settle();
     assert.equal(await window.WMOFActions.openBreakEndMenu(),true);await settle();
     await timer.endInterval(new window.Date());await settle();
     if(replacement) {
       window.__testTime+=1000;
       assert.equal(await (replacement==='down'?window.WMOFActions.startDownTime():window.WMOFActions.startBreak(replacement)),true);await settle();
     }
     const active=timer.getActiveIntervalState();
     assert.equal(await window.WMOFActions.confirmBreakPromptYes(),false,'stale '+kind+' confirmation is rejected after '+(replacement||'resume'));await settle();
     assert.equal(timer.getActiveIntervalState()?.intervalKey,active?.intervalKey,'replacement interval is untouched');assertResumed();
     await window.WMOFActions.cancelBreakPrompt();await settle();
     if(active) {await timer.endInterval(new window.Date());await settle();}
   }
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS spoken and pointer break endings preserve the trip without a summary; stale prompts cannot end a trip or replacement interval');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--commands-close')) {
 const bar=window.document.querySelector('#speechMicBar');
 const assertUsable=label=>{
   assert.equal(window.WMOFCoordinator.lockCount,0,label+' releases all owned locks');
   assert.equal(window.WMOFCoordinator.pending.length,0,label+' leaves no pending operation: '+JSON.stringify(window.WMOFCoordinator.pending));
   assert.equal(window.document.querySelector('#newTripButton').disabled,false,label+' releases New Trip');
   assert.equal(window.document.querySelector('#app').dataset.operationPending,'false',label+' releases the UI');
 };
 const bounded=async promise=>{let timeout;try{return await Promise.race([promise,new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('commands action never settled')),2000))]);}finally{clearTimeout(timeout);}};
 await bounded(window.WMOFActions.openSpeechOptions());await settle();assert(bar.optionsOpen);assertUsable('pointer open');
 capturedShadows.get(bar).querySelector('#optionsClose').click();await settle();assert(bar.optionsCollapsed);assertUsable('pointer collapse');
 for(const finalize of [false,true]) {
   const opening=window.SpeechMenu.testBegin();
   await window.SpeechMenu.testTranscript(opening,'commands',false);
   await bounded(opening.digestQueue);await settle();
   if(finalize) window.SpeechMenu.testFinish();
   capturedShadows.get(bar).querySelector('#optionsClose').click();await settle();
   assertUsable('close before final '+finalize);
 }
 for(const close of ['close','cancel']) {
   const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,'commands',true);await bounded(u.digestQueue);await settle();assert(bar.optionsOpen,'voice Commands opens list');assertUsable('voice open');
   const c=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(c,close,true);await bounded(c.digestQueue);await settle();assert(bar.optionsCollapsed,close+' collapses list');assertUsable('voice '+close);
 }
 const coordinator=window.WMOFCoordinator, edges=[], mutations=[];
 const button=window.document.querySelector('#newTripButton');
 const observer=new window.MutationObserver(records=>mutations.push(...records));observer.observe(button,{attributes:true,attributeFilter:['disabled']});
 coordinator.addEventListener('lockStateChanged',e=>edges.push(e.detail.locked));
 let failCleanup=true;
 const unregister=coordinator.register('test-cleanup',{capture:()=>null,restore:()=>{},end(){if(failCleanup){failCleanup=false;throw Error('fixture cleanup failure');}}});
 const first=coordinator.createOperation();await coordinator.run('first-save',()=>true,{owner:first,chain:true});await settle();
 const second=coordinator.createOperation();const secondWork=coordinator.run('second-save',()=>true,{owner:second,chain:true});
 assert.equal(coordinator.lockCount,2);assert(button.disabled,'two operations keep the UI locked');
 await bounded(window.WMOFActions.openSpeechOptions());assert(bar.optionsOpen,'Commands opens while a save is pending');
 const closing=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(closing,'close',true);await bounded(closing.digestQueue);await settle();
 assert(bar.optionsCollapsed);assert.equal(coordinator.lockCount,2,'presentation does not acquire another state lock: '+JSON.stringify(coordinator.locks));
 await first.complete();await secondWork;await settle();assert.equal(coordinator.lockCount,1);assert(button.disabled,'first completion cannot unlock the second operation');
 unregister();await second.complete();await settle();assertUsable('last save completion');
 observer.disconnect();assert.deepEqual(edges,[true,false],'overlapping operations produce one lock and one unlock');
 assert.equal(mutations.length,2,'the actual button is disabled once and enabled once');
 assert(coordinator.trace.some(e=>e.kind==='cleanup'&&e.phase==='failed'),'cleanup failure is recorded without stranding the UI');
 button.dispatchEvent(new window.Event('pointerup',{bubbles:true}));await settle();
 assert(window.document.querySelector('#numberPadDialog').open,'New Trip remains functional after Commands closes and the last save settles');
 for(const digit of '2000') await window.WMOFActions.enterNumberPadDigit(digit);
 assert.equal(await window.WMOFActions.confirmNumberPad(),true);await settle();assert.equal(timer.status,'running','trip can still start');
 assert.equal(coordinator.lockCount,0);
 assert.equal(window.SpeechMenu.started,true,'closing Commands keeps recognition active');
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS Commands open/close settles orchestration and re-enables controls');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--sync-voice')) {
 const system=window.document.createElement('speech-menu');system.setAttribute('speech-modal','system');
 const off=window.document.createElement('speech-command');off.setAttribute('speech-pattern','^off$');off.setAttribute('speech-function','WMOFActions.disableSpeechRecognition');system.append(off);window.document.body.append(system);
 const menu=window.document.querySelector('#toggleSyncMenuButton');const goal=window.document.querySelector('#toggleSyncGoalButton');
 const dispatched=[];window.SpeechMenu.events.addEventListener('speechCommandDispatched',e=>dispatched.push(e.detail.commandElement.getAttribute('speech-function')));
 const receive=async(u,text,final=false)=>{window.SpeechMenu.testResult(u,text,final);await settle();await u.digestQueue;await u.segmentBarrier;await settle();};
 for(const backend of ['sherpa','vosk']) {
   window.SpeechMenu.testBackend(backend);
   for(const voicepad of [false,true]) {
     if(voicepad) {const ready=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(ready,'ready',true);await ready.digestQueue;await settle();assert(window.WMOFVoiceEntry.active);}
     await window.WMOFActions.toggleSync('on');await settle();
     menu.hidden=true;goal.hidden=true;window.SpeechMenu.refresh();await settle();dispatched.length=0;
     const u=window.SpeechMenu.testBegin();
     assert((await window.SpeechMenu.testVoskContext(u.id)).records.some(r=>r.action==='WMOFActions.toggleSync'),'hidden pointers cannot remove Sync from the active Vosk grammar');
     await receive(u,'sync');assert.equal(menu.getAttribute('aria-pressed'),'true','bare Sync awaits optional On/Off');
     await receive(u,'sync off');await receive(u,'sync off',true);
     assert.equal(window.SpeechMenu.started,true,backend+' Sync Off must keep recognition on');
     assert.equal(window.document.querySelector('#speechMicBar').hidden,false,'mic bar stays visible');
     assert.equal(menu.getAttribute('aria-pressed'),'false',backend+' hidden hamburger toggle updates');
     assert.equal(menu.querySelector('.sync-goals-menu-icon').dataset.syncState,'disabled');
     assert.deepEqual(dispatched,['WMOFActions.toggleSync'],'Sync Off is one setting command');
     assert.equal(timer.autoSyncTripGoal,false,'timer Sync state is off');
     assert.equal(JSON.parse(await storage.getItem('wmof.clock.tripPreferences')).syncGoals,false,'Sync preference is persisted');
     dispatched.length=0;const repeated=window.SpeechMenu.testBegin();await receive(repeated,'sync off',true);
     assert.equal(window.SpeechMenu.started,true,'repeated Sync Off keeps the mic on');assert.equal(menu.getAttribute('aria-pressed'),'false');
     assert.deepEqual(dispatched,['WMOFActions.toggleSync'],'repeated Sync Off remains a setting command');
     if(voicepad) {const cancel=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(cancel,'cancel',true);await cancel.digestQueue;await settle();}
     menu.hidden=false;goal.hidden=false;
   }
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 await window.WMOFActions.toggleSync('on');await settle();
 const standaloneOff=window.SpeechMenu.testBegin();await receive(standaloneOff,'off',true);
 assert.equal(window.SpeechMenu.started,false,'standalone Off still stops recognition');
 assert.equal(timer.autoSyncTripGoal,true,'standalone Off leaves Sync unchanged');
 console.log('PASS Sync Off changes and persists the hidden menu setting without stopping Sherpa/Vosk; standalone Off still works');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--speech-boundaries')) {
 const say=async(u,text,final=false)=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();};
 const before=stored.length;
 const bad=window.SpeechMenu.testBegin();await say(bad,'ready hundred');
 assert(bad.chainInvalidated,'malformed context invalidates the actual Ready chain');
 await say(bad,'ready hundred seven seconds');
 assert.equal(window.WMOFInteractionState.state.editor.open,false,'a valid suffix cannot reopen the rejected Ready editor');
 assert.equal(timer.status,'ready');assert.equal(stored.length,before,'malformed Ready cannot write trip events');
 await say(bad,'ready hundred seven seconds sync on',true);
 assert.equal(timer.autoSyncTripGoal,true,'an independent command head can follow the discarded section');
 assert.equal(window.WMOFCoordinator.lockCount,0,'discarded chain releases its owned locks');
 const ready=window.SpeechMenu.testBegin();await say(ready,'ready four twelve sync on',true);
 assert(!ready.digestExecutionFailed && !ready.chainInvalidated,'root accepts duration followed by Sync');
 assert(window.document.querySelector('#voiceEntrySurface').open,'valid Ready opens its editor');
 assert.equal(window.WMOFInteractionState.state.editor.value,'412','deferred duration retains both number groups');
 assert.equal(timer.autoSyncTripGoal,true);
 assert.equal(window.WMOFCoordinator.lockCount,0);
 assert.equal(stored.length,before,'Ready without OK does not start a trip');
 const cancel=window.SpeechMenu.testBegin();await say(cancel,'cancel',true);
 const provisional=window.SpeechMenu.testBegin();await say(provisional,'ready four twelve sync o');
 assert(window.document.querySelector('#voiceEntrySurface').open,'the root may hold provisional Ready effects while its command continuation grows');
 await say(provisional,'ready four twelve sync bananas',true);
 assert.equal(window.WMOFInteractionState.state.editor.open,false,'malformed command continuation rolls back the entire provisional Ready root');
 assert.equal(window.WMOFCoordinator.lockCount,0,'root rollback releases pending ownership');
 assert.equal(stored.length,before,'failed dependent root cannot persist trip events');
 const time=window.SpeechMenu.testBegin();
 for(const text of ['ready at four','ready at four twenty','ready at four twenty t']) {
   await say(time,text);assert(!window.document.querySelector('#scheduledStartDialog').open,text+' remains incomplete');
 }
 await say(time,'ready at four twenty two',true);
 assert(window.document.querySelector('#scheduledStartDialog').open);
 assert.equal(window.WMOFCoordinator.lockCount,0);
 const cancelTime=window.SpeechMenu.testBegin();await say(cancelTime,'cancel',true);
 await window.WMOFVoiceEntry.open({mode:'absolute',source:'test-prior-clock',initialValue:new window.Date(),confirmTarget:'home',cancelTarget:'home',onConfirm:()=>true});await settle();
 const closeClock=window.SpeechMenu.testBegin();await say(closeClock,'cancel',true);
 const afterClock=window.SpeechMenu.testBegin();await say(afterClock,'ready one hour sync on',true);
 assert(!afterClock.chainInvalidated && !afterClock.digestFailed,'Ready projects a duration after a previous clock editor');
 assert.equal(window.WMOFInteractionState.state.editor.value,'10000');
 assert.equal(stored.length,before);
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 console.log('PASS real Ready malformed-tail discard, root deferral to Sync, growing time capture, zero trip writes and released locks');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--mic-feedback')) {
 spoken.length=0;chimes.length=0;
 await window.SpeechMenu.sleep();await settle();
 assert.deepEqual(spoken,['Microphone deactivated.']);assert.deepEqual(chimes,['microphone-deactivated']);
 await window.SpeechMenu.sleep();await settle();assert.equal(spoken.length,1,'duplicate mute is silent');
 await window.SpeechMenu.wake();await settle();
 assert.deepEqual(spoken,['Microphone deactivated.','Microphone activated.']);
 assert.deepEqual(chimes,['microphone-deactivated','microphone-activated']);
 await window.SpeechMenu.wake();await settle();assert.equal(spoken.length,2,'duplicate wake is silent');
 const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,'sleep',true);await u.digestQueue;await settle();
 assert.equal(spoken.filter(s=>s==='Microphone deactivated.').length,2,'voice sleep announces once through the same runtime path');
 assert.equal(chimes.filter(s=>s==='microphone-deactivated').length,2,'voice feedback cannot duplicate the runtime chime');
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS local and voice mic feedback: dedicated activation/deactivation chimes, announcements and duplicate suppression');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--ready-handoff')) {
 const say=async(u,text,final=false)=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();};
 const before=stored.length;
 const u=window.SpeechMenu.testBegin();
 await say(u,'ready');
 for(const text of ['ready twenty','ready twenty two','ready twenty two fifty','ready twenty two fifty six']) {
  await say(u,text);
  const grammar=await window.SpeechMenu.testVoskContext(u.id,text);
  assert(grammar.records.some(r=>r.expect==='duration'),'open duration stays in the decoder grammar after Ready changes state: '+JSON.stringify({text,grammar,consumed:u.digestTranscript,context:u.digestContext}));
 }
 await say(u,'ready twenty two fifty six',true);
 assert(!u.digestExecutionFailed&&!u.digestFailed,'Ready retains duration collection after opening its surface: '+JSON.stringify({failed:u.digestFailed,execution:u.digestExecutionFailed,pending:u.digestPending,consumed:u.digestTranscript}));
 assert.equal(window.WMOFInteractionState.state.editor.value,'2256','duration carries into the Ready voice pad');
 assert.equal(stored.length,before,'duration alone never starts the trip');
 assert.equal(window.WMOFCoordinator.lockCount,0);
 const cancel=window.SpeechMenu.testBegin();await say(cancel,'cancel',true);
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 const b=window.SpeechMenu.testBegin();await say(b,'break start');
 const choices=await window.SpeechMenu.testVoskContext(b.id,'break start');
 assert(choices.records.some(r=>r.pattern.includes('breakChoice')),'consumed break opener hands grammar ownership to its choices: '+JSON.stringify(choices));
 await say(b,'break start lunch');
 const confirmation=await window.SpeechMenu.testVoskContext(b.id,'break start lunch');
 assert(confirmation.records.some(r=>/ok/.test(r.pattern)),'consumed break choice hands grammar ownership to confirmation');
 assert(!timer.getActiveIntervalState(),'handoff does not manufacture confirmation');
 await say(b,'break start lunch ok',true);
 assert.equal(timer.getActiveIntervalState()?.intervalType,'lunch');
 assert.equal(window.WMOFCoordinator.lockCount,0);
 console.log('PASS shared Ready value and Break choice/confirmation grammar handoffs through state changes');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--decoder-final-boundaries')) {
 const say=async(u,text,final=false)=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();};
 const ready=window.SpeechMenu.testBegin();await say(ready,'ready',true);
 let accepted;
 await window.WMOFVoiceEntry.open({mode:'duration',source:'test-final-duration',confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{accepted=value;return true;}});await settle();
 const duration=window.SpeechMenu.testBegin();
 let finalRequests=0;
 window.SpeechMenu.testUseRecognizer({finishUtterance(){finalRequests++;setTimeout(()=>window.SpeechMenu.testDeliverFinal(duration,'twenty two fifty six'),20);},abortUtterance(){},setHotwords(){}});
 await say(duration,'twenty two fifty');
 window.SpeechMenu.testPause(duration);await new Promise(resolve=>setTimeout(resolve,450));await duration.digestQueue;await settle();
 assert.equal(finalRequests,1,'silence requests the decoder final before committing a partial duration');
 const ok=window.SpeechMenu.testBegin();await say(ok,'ok',true);
 assert.equal(accepted,1376000,'the final word six survives silence settlement');
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 for(const choice of ['break','short break','lunch']) {
  const u=window.SpeechMenu.testBegin();let finishes=0;
  window.SpeechMenu.testUseRecognizer({finishUtterance(){finishes++;setTimeout(()=>window.SpeechMenu.testDeliverFinal(u,'break start '+choice+' ok'),20);},abortUtterance(){},setHotwords(){}});
  await say(u,'break start');await say(u,'break start '+choice);
  window.SpeechMenu.testPause(u);await new Promise(resolve=>setTimeout(resolve,450));await u.digestQueue;await u.segmentBarrier;await settle();
  assert.equal(finishes,1,'break confirmation waits for the decoder final: '+choice);
  assert.equal(timer.getActiveIntervalState()?.intervalType,choice==='lunch'?'lunch':'break','the final OK starts '+choice);
  assert.equal(window.WMOFCoordinator.lockCount,0,'confirmed break releases locks');
  await timer.endInterval(new window.Date());await settle();window.__testTime+=60000;
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS decoder finals retain duration suffixes and break confirmations across silence');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--voicepad-continuation')) {
 const say=async(u,text,final=false)=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();};
 const scheduled=window.SpeechMenu.testBegin();await say(scheduled,'ready at eleven fifty nine pm',true);
 assert(window.document.querySelector('#scheduledStartDialog').open,'scheduled control opens');
 const standard=window.SpeechMenu.testBegin();
 for(const phrase of ['standard time twenty five','standard time twenty five minutes','standard time twenty five minutes thirty seconds']) {
   await say(standard,phrase);assert.equal(standard.digestSteps.length,0,'scheduled standard-time collector still waits for continuations');
 }
 await say(standard,'standard time twenty five minutes thirty seconds',true);
 assert(!standard.digestExecutionFailed);assert.equal(standard.digestSteps.length,1);
 assert.match(window.document.querySelector('#scheduledStartStandardValue').textContent,/25.*30/,'scheduled control retains the complete duration');
 const cancelScheduled=window.SpeechMenu.testBegin();await say(cancelScheduled,'cancel',true);
 const ready=window.SpeechMenu.testBegin();await say(ready,'ready',true);
 assert(window.document.querySelector('#voiceEntrySurface').open,'Ready opens duration voicepad');
 const u=window.SpeechMenu.testBegin();
 const durationGrammar=await window.SpeechMenu.testVoskContext(u.id);
 const durationRecord=durationGrammar.records.find(r=>r.id?.includes('keypadValue:voiceEntrySurface'));
 assert.equal(durationRecord?.expect,'duration','voicepad advertises its duration context to Vosk');
 const compiled=window.VoskPhraseListCompiler.compileStages([durationRecord],{valuePhrases:window.VoskGrammarRouter.valuePhrases()});
 assert.equal(compiled.unsupported.length,0);
 assert(compiled.paths.some(p=>p.stages.some(stage=>stage.grammar==='duration'&&stage.phrases.includes('twenty five minutes'))),'decoder grammar includes duration units');
 for(const phrase of ['twenty five','twenty five minutes','twenty five minutes thirty','twenty five minutes thirty seconds']) {
   await say(u,phrase);
   assert.equal(u.digestSteps.length,0,phrase+' remains extendable until a speech boundary');
   assert.equal(u.completedStreams,undefined,'continuing value keeps the same command stream');
   assert(window.document.querySelector('#voiceEntrySurface').open,'continuing speech leaves voicepad open');
   window.SpeechMenu.testPause(u);await new Promise(resolve=>setTimeout(resolve,60));window.SpeechMenu.testResume();
   await new Promise(resolve=>setTimeout(resolve,180));
   assert.equal(u.completedStreams,undefined,'speech resumption cancels pending silence commitment');
 }
 await say(u,'twenty five minutes thirty seconds',true);
 assert(!u.digestExecutionFailed,'full compound duration is accepted');
 assert.equal(u.digestSteps.length,1,'value executes once');
 const ok=window.SpeechMenu.testBegin();await say(ok,'ok',true);
 assert.equal(timer.standardTimeMilliseconds,1530000,'OK commits the whole duration including seconds');
 assert.equal(timer.status,'running');
 let absolute;
 await window.WMOFVoiceEntry.open({mode:'absolute',source:'test-clock',initialValue:new window.Date(),confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{absolute=value;return true;}});await settle();
 const clock=window.SpeechMenu.testBegin();
 const clockGrammar=await window.SpeechMenu.testVoskContext(clock.id);
 assert.equal(clockGrammar.records.find(r=>r.id?.includes('keypadValue:voiceEntrySurface'))?.expect,'time','clock voicepad changes the decoder context');
 for(const phrase of ['four','four twenty','four twenty two','four twenty two pm']) {
   await say(clock,phrase);assert.equal(clock.completedStreams,undefined,phrase+' remains extendable');assert.equal(absolute,undefined);
 }
 await say(clock,'four twenty two pm',true);
 const clockOK=window.SpeechMenu.testBegin();await say(clockOK,'okay',true);
 assert.equal(new window.Date(absolute).getHours(),16);assert.equal(new window.Date(absolute).getMinutes(),22);
 for(const [phrase,hour,minute] of [['quarter to six pm',17,45],['half past five',5,30],['thirteen forty five',13,45],['five naught five',5,5]]) {
   let acceptedClock;
   await window.WMOFVoiceEntry.open({mode:'absolute',source:'test-legacy-clock',initialValue:new window.Date(),confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{acceptedClock=value;return true;}});await settle();
   const legacyClock=window.SpeechMenu.testBegin();await say(legacyClock,phrase);assert.equal(legacyClock.completedStreams,undefined);
   await say(legacyClock,phrase+' okay',true);assert(!legacyClock.digestExecutionFailed,phrase);
   assert.equal(new window.Date(acceptedClock).getHours(),hour,phrase);assert.equal(new window.Date(acceptedClock).getMinutes(),minute,phrase);
 }

 let percentage;
 await window.WMOFVoiceEntry.open({mode:'percent',source:'test-percent',confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{percentage=value;return true;}});await settle();
 const percent=window.SpeechMenu.testBegin();
 assert.equal((await window.SpeechMenu.testVoskContext(percent.id)).records.find(r=>r.id?.includes('keypadValue:voiceEntrySurface'))?.expect,'number','percentage context replaces clock grammar');
 await say(percent,'seventy');await say(percent,'seventy five percent');
 assert.equal(percent.completedStreams,undefined,'percent collector also waits for a speech boundary');
 window.SpeechMenu.testUseRecognizer({finishUtterance(){setTimeout(()=>window.SpeechMenu.testDeliverFinal(percent,'seventy five percent'),0);},abortUtterance(){},setHotwords(){}});
 window.SpeechMenu.testPause(percent);await new Promise(resolve=>setTimeout(resolve,250));await percent.digestQueue;await settle();
 assert(percent.hadCommittedCommand,'actual silence completes a valid value');
 assert.equal(percentage,undefined,'silence alone cannot press OK');
 const percentOK=window.SpeechMenu.testBegin();await say(percentOK,'ok',true);assert.equal(percentage,75);
 let combinedDuration;
 await window.WMOFVoiceEntry.open({mode:'duration',source:'test-duration',confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{combinedDuration=value;return true;}});await settle();
 const combined=window.SpeechMenu.testBegin();await say(combined,'thirty five minutes seventeen seconds okay',true);
 assert(!combined.digestExecutionFailed);assert.equal(combinedDuration,2117000,'complete duration plus OK preserves both units and commits once');
 for(const [phrase,expected] of [['an hour and five',3900000],['an hour one and twelve',3672000],['two hours thirty five and forty five',9345000],['twenty three minutes and twenty four',1404000],['one seventeen oh nine',4629000],['a minute and five',65000]]) {
   let accepted;
   await window.WMOFVoiceEntry.open({mode:'duration',source:'test-legacy-duration',confirmTarget:'home',cancelTarget:'home',onConfirm:value=>{accepted=value;return true;}});await settle();
   const legacy=window.SpeechMenu.testBegin();
   await say(legacy,phrase);assert.equal(accepted,undefined);assert.equal(legacy.completedStreams,undefined,'legacy value remains extendable: '+phrase);
   await say(legacy,phrase+' okay',true);
   assert(!legacy.digestExecutionFailed,'legacy phrase executes: '+phrase);assert.equal(accepted,expected,phrase);
 }

 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS contextual voicepad duration, clock and percent continuation, resumed speech, silence and scheduled-time control');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--down-timing')) {
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 for(const phrase of ['down time','down','down time','down']) {
  window.__testTime+=60000;
  const spokenAt=window.__testTime;
  const u=window.SpeechMenu.testBegin();
  window.__testTime+=2500;await new Promise(resolve=>setTimeout(resolve,1100));
  await window.SpeechMenu.testTranscript(u,phrase,true);await u.digestQueue;await u.segmentBarrier;await settle();
  assert(!u.digestExecutionFailed,phrase+' executes after cadence ticks: '+JSON.stringify({consoleErrors,errors,status:window.document.querySelector('.persistence-status')?.textContent}));
  assert.equal(timer.getActiveIntervalState()?.intervalType,'down');
  assert.equal(Date.parse(stored.findLast(event=>event.event==='interval.started').timestamp),spokenAt,'cadence correction preserves the spoken event time');
  assert.equal(window.WMOFCoordinator.lockCount,0);
  await window.WMOFActions.resumeTrip();await settle();
  assert(!timer.getActiveIntervalState(),'resume ends Down without ending the trip');
  assert.equal(timer.status,'running');
 }
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS spoken Down commands tolerate cadence ticks during recognition');await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--down-break')) {
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 const say=async(text,final=true,u=window.SpeechMenu.testBegin())=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();assert(!u.digestExecutionFailed,text+' executes');return u;};
 for(const [choice,type] of [['break','break'],['short break','break'],['lunch','lunch']]) {
   for(const mode of ['pointer','separate','chained','incremental']) {
     window.__testTime+=60000;
     assert.equal(await window.WMOFActions.startDownTime(),true);await settle();
     const down=timer.getActiveIntervalState();assert.equal(down.intervalType,'down');
     window.__testTime+=30000;
     const starts=stored.filter(e=>e.event==='interval.started').length;
     assert.equal(window.WMOFInteractionState.state.actions.openBreakSelector,true,'Down permits the break selector');
     assert.equal(window.document.querySelector('#downBreakButton').disabled,false,'Down Break control is available');
     if(mode==='pointer') {
       window.document.querySelector('#downBreakButton').dispatchEvent(new window.Event('pointerup',{bubbles:true}));await settle();
       assert(window.document.querySelector('#breakDialog').open,'Down Break pointer opens selector');
       window.document.querySelector('#breakDialog [data-break-type="'+choice.replace(' ','-')+'"]').click();await settle();
       assert.equal(timer.getActiveIntervalState().intervalKey,down.intervalKey,'choosing a type keeps Down until OK');
       window.document.querySelector('#breakTypeOK').click();await settle();
     } else if(mode==='separate') {
       await say('break start');assert(window.document.querySelector('#breakDialog').open);
       await say(choice);assert.equal(timer.getActiveIntervalState().intervalKey,down.intervalKey,'spoken type waits for OK');
       await say('ok');
     } else {
       const u=window.SpeechMenu.testBegin();
       const grammar=await window.SpeechMenu.testVoskContext(u.id,'break start');
       assert(grammar.records.some(r=>r.pattern==='^(?<breakChoice>break|lunch|short break)$'),'Down projects the finite break choices');
       if(mode==='incremental') {
         await say('break start',false,u);await say('break start '+choice,false,u);
         assert.equal(timer.getActiveIntervalState().intervalKey,down.intervalKey,'unfinished chain keeps Down');
       }
       await say('break start '+choice+' ok',true,u);
     }
     assert.equal(timer.getActiveIntervalState()?.intervalType,type,choice+' starts from Down via '+mode);
     assert.equal(stored.filter(e=>e.event==='interval.started').length,starts+1,'break starts exactly once: '+JSON.stringify(stored));
     assert.equal(stored.filter(e=>e.event==='interval.ended'&&e.value.intervalKey===down.intervalKey).length,1,'Down ends exactly once');
     assert.equal(window.WMOFCoordinator.lockCount,0);
     await say('break end ok');assert(!timer.getActiveIntervalState(),'ending the break resumes the trip');
   }
 }
 await window.WMOFActions.startDownTime();await settle();const down=timer.getActiveIntervalState();
 await say('break start');await say('cancel');
 assert.equal(timer.getActiveIntervalState().intervalKey,down.intervalKey,'canceling the chooser preserves Down');
 assert.equal(window.WMOFCoordinator.lockCount,0);assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS Down to Break/Short Break/Lunch via pointer, separate, chained and incremental commands; cancel preserves Down');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--interval-actions')) {
 await window.WMOFCoordinator.run('test-start',()=>timer.start({standardTimeMilliseconds:3600000}));await settle();
 window.__testTime+=60000;
 assert.equal(await window.WMOFActions.startDownTime(),true,'Down action accepts its own pending state');await settle();
 assert.equal(timer.getActiveIntervalState()?.intervalType,'down');
 await window.WMOFActions.resumeTrip();await settle();assert(!timer.getActiveIntervalState());
 window.__testTime+=60000;
 assert.equal(await window.WMOFActions.startBreak('break'),true,'Break action starts an interval');await settle();
 assert.equal(timer.getActiveIntervalState()?.intervalType,'break');
 await timer.endInterval(new window.Date());await settle();window.__testTime+=60000;
 for(const kind of ['break','short-break','lunch']) {
   window.document.querySelector('#breakButton').dispatchEvent(new window.Event('pointerup',{bubbles:true}));await settle();
   assert(window.document.querySelector('#breakDialog').open,'Break pointer opens selector');
   window.document.querySelector('#breakDialog [data-break-type="'+kind+'"]').click();await settle();
   assert(!timer.getActiveIntervalState(),kind+' selection waits for OK');
   assert.equal(window.document.querySelector('#breakTypeOK').disabled,false,'selected type enables OK');
   window.document.querySelector('#breakTypeOK').click();await settle();
   assert.equal(timer.getActiveIntervalState()?.intervalType,kind==='lunch'?'lunch':'break',kind+' pointer OK starts');
   await timer.endInterval(new window.Date());await settle();window.__testTime+=60000;
 }
 const grammarUtterance=window.SpeechMenu.testBegin();
 const initialGrammar=await window.SpeechMenu.testVoskContext(grammarUtterance.id);
 assert(!initialGrammar.records.some(r=>r.id?.includes('breakChoice:breakDialog')),'closed type selector stays out of initial grammar');
 assert(!initialGrammar.records.some(r=>r.id?.includes('endLunch:')||r.id?.includes('endShortBreak:')),'removed end aliases are not in Vosk grammar');
 const projectedGrammar=await window.SpeechMenu.testVoskContext(grammarUtterance.id,'break start');
 assert(projectedGrammar.records.some(r=>r.pattern==='^(?<breakChoice>break|lunch|short break)$'),'Break Start projects finite type choices into Vosk');
 assert(!window.document.querySelector('#breakDialog').open,'grammar projection does not open the UI');
 const say=async(text,final=true,u=window.SpeechMenu.testBegin())=>{await window.SpeechMenu.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await settle();assert(!u.digestExecutionFailed,text+' executes');return u;};
 await say('down');assert.equal(timer.getActiveIntervalState()?.intervalType,'down');
 await say('resume');assert(!timer.getActiveIntervalState());window.__testTime+=60000;
 for(const [choice,type,label] of [['break','break','Break'],['short break','break','Short break'],['lunch','lunch','Lunch']]) {
   for(const incremental of [false,true]) {
     const before=stored.filter(e=>e.event==='interval.started').length;
     const u=window.SpeechMenu.testBegin();
     if(incremental) {
       await say('break start',false,u);
       assert(!window.document.querySelector('#breakDialog').open,'interim chain does not flash selector');
       await say('break start '+choice,false,u);
       assert(!timer.getActiveIntervalState(),'type without OK waits');
     }
     spoken.length=0;
     await say('break start '+choice+' ok',true,u);
     assert.equal(timer.getActiveIntervalState()?.intervalType,type,choice+' chained OK starts');
     assert.equal(stored.filter(e=>e.event==='interval.started').length,before+1,'persists once');
     assert(!window.document.querySelector('#breakDialog').open,'complete chain skips selector');
     assert(spoken.includes(label+' started. Say break end to end your '+choice+'.'),'selected type announcement '+JSON.stringify({choice,spoken,chimes,consoleErrors,errors}));
     const key=timer.getActiveIntervalState().intervalKey;
     for(const invalidEnd of (incremental ? [] : ['lunch end','short break end','end lunch','end short break','end break'])) {
       const rejected=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(rejected,invalidEnd+' ok',true);await rejected.digestQueue;await settle();assert.equal(timer.getActiveIntervalState()?.intervalKey,key,invalidEnd+' is not an end command');
     }
     await say('break end ok');assert(!timer.getActiveIntervalState(),'Break End ends '+choice);
     window.__testTime+=60000;
   }
   await say('break start');assert(window.document.querySelector('#breakDialog').open,'standalone root opens type selector');
   assert.equal(window.document.querySelector('#breakTypeOK').disabled,true,'OK requires type');
   assert(spoken.includes('Say/press break type then OK.'),'standalone prompt');
   await say(choice);assert(!timer.getActiveIntervalState(),'separate choice waits');
   await say('ok');assert.equal(timer.getActiveIntervalState()?.intervalType,type,'separate OK starts');
   await say('break end ok');assert(!timer.getActiveIntervalState());window.__testTime+=60000;
 }
 const invalid=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(invalid,'break start ok',true);await invalid.digestQueue;await settle();
 assert(!timer.getActiveIntervalState(),'missing type cannot start a break');
 if(window.document.querySelector('#breakDialog').open) await say('cancel');
 await say('break start cancel');assert(!window.document.querySelector('#breakDialog').open,'canceled chain cannot reopen deferred selector');
 assert.deepEqual(consoleErrors,[]);assert.deepEqual(errors,[]);
 console.log('PASS Down/resume and direct, chained and separately confirmed Break/Short Break/Lunch actions');
 await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--coordinator-end-trip')) {
    const newTrip=window.document.querySelector('#newTripButton');
    assert.equal(newTrip.disabled,false,'New Trip is available before input');
    newTrip.dispatchEvent(new window.Event('pointerup',{bubbles:true}));await settle();
    assert(window.document.querySelector('#numberPadDialog').open,'real New Trip input opens the standard-time editor despite its own pending state');
    for(const digit of '2000') await window.WMOFActions.enterNumberPadDigit(digit);
    assert.equal(await window.WMOFActions.confirmNumberPad(),true,'standard-time confirmation starts the trip through application actions');await settle();
    assert.equal(timer.status,'running');
    holdStopResponse=true;
    const ending=window.WMOFActions.endTrip();await settle();
    assert.equal(timer.status,'stopped','local End Trip happens while the server response is delayed');
    assert.equal(timer.uiState.trip_active,false,'ended trip is not active while persistence is pending');
    assert.equal(window.WMOFInteractionState.state.actions.endTrip,false);
    assert.equal(window.document.querySelector('#activeTripControls').hidden,false,'transient controls remain visible');
    for(const id of ['endTripButton','breakButton','downButton','tripTransitionSummaryOk','tripTransitionSummaryCancel'])
        assert.equal(window.document.querySelector('#'+id).disabled,true,id+' is disabled while the save is pending');
    const stopsBefore=stored.filter(e=>e.event==='trip.stopped').length;
    for(const id of ['endTripButton','breakButton','downButton','tripTransitionSummaryCancel'])window.document.querySelector('#'+id).click();
    await settle();assert.equal(stored.filter(e=>e.event==='trip.stopped').length,stopsBefore,'transient controls cannot dispatch another command');
    assert(window.document.querySelector('#tripTransitionOverlay').open,'summary is visible during the delayed save');
    releaseStopResponse();await ending;await settle();holdStopResponse=false;
    await window.WMOFActions.cancelTripSummary();await settle();
    assert.equal(timer.status,'ready');assert.equal(window.WMOFInteractionState.state.tripActive,false);
    assert.equal(window.document.querySelector('#activeTripControls').hidden,true,'summary cancellation cannot revive running controls');
    const trace=window.WMOFCoordinator.trace;
    assert(trace.some(e=>e.kind==='persistence-acknowledged'&&e.event==='trip.stopped'));
    assert(trace.some(e=>e.kind==='operation'&&e.source==='gesture'&&e.endedAt!==null));
    await window.WMOFCoordinator.run('test-restart',()=>timer.start({standardTimeMilliseconds:1200000}));await settle();
    const owner=window.WMOFCoordinator.createOperation({source:'voice',group:'late-final'});
    const releaseFinal=owner.expect('recognition-final');
    await window.WMOFCoordinator.run('endTrip',()=>window.WMOFActions.endTrip(),{owner,chain:true});
    await owner.cancel(new Error('late utterance context change'));releaseFinal();await settle();
    assert.equal(timer.status,'ready','acknowledged trip end is reconciled after late cancellation');
    assert.equal(window.WMOFInteractionState.state.tripActive,false);
    assert.equal(window.document.querySelector('#activeTripControls').hidden,true,'late rollback cannot revive End Trip/Break/Down');
    assert(window.WMOFCoordinator.trace.some(e=>e.reconciled&&e.source==='voice'));
    await window.WMOFActions.cancelTripSummary();await settle();
    await window.WMOFCoordinator.run('test-voice-restart',()=>timer.start({standardTimeMilliseconds:1200000}));await settle();
    const spokenEnd=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(spokenEnd,'ready',true);await spokenEnd.digestQueue;await settle();
    assert(spokenEnd.hadCommittedCommand && !spokenEnd.digestExecutionFailed,'voice End Trip completion survives its own availability change');
    assert.equal(timer.status,'ready');assert.equal(window.WMOFInteractionState.state.tripActive,false);
    await window.WMOFActions.cancelTripSummary();await settle();
    const say=async text=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,text,true);await u.digestQueue;await settle();assert(u.hadCommittedCommand&&!u.digestExecutionFailed,text+' executes');return u;};
    const interruptedChain=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(interruptedChain,'background noise ready at eleven fifty nine pm sync on',false);
    await interruptedChain.digestQueue;await interruptedChain.segmentBarrier;await settle();
    assert(!interruptedChain.digestExecutionFailed,'Ready At and intervening Sync execute without waiting for final recognition');
    assert.equal(window.WMOFCoordinator.pending.length,0,'intervening terminal command settles the current operation');
    assert(window.document.querySelector('#scheduledStartDialog').open,'Ready At opens despite its own pending disabled button');
    await window.SpeechMenu.testTranscript(interruptedChain,'revised background noise ready at eleven fifty nine pm sync on standard time seventeen minutes',true);
    await interruptedChain.digestQueue;await settle();
    assert(!interruptedChain.digestExecutionFailed,'Standard Time retains chain context across Sync and revised leading noise');
    assert.match(window.document.querySelector('#scheduledStartStandardValue').textContent,/17/,'the interrupted chain applies its duration');
    await say('cancel');
    await say('ready');
    assert(window.document.querySelector('#voiceEntrySurface').open,'Ready opens the standard-time voice editor');
    await say('twenty minutes');await say('okay');
    assert.equal(timer.status,'running','voice starts another trip after ending the previous one');
    console.log('PASS delayed End Trip save and summary cancellation keep model and UI ended');
    await window.happyDOM.close();process.exit(0);
}
if(process.argv.includes('--voicepad-gate')) {
    const button=window.document.querySelector('#speechRecognitionButton');
    await window.WMOFActions.handleSpeechRuntimeStopped();await settle();
    const beforeRequests=requests.length;
    await window.WMOFVoiceEntry.open({mode:'time', source:'test-voice-gate', confirmTarget:'home', cancelTarget:'home'});await settle();
    const gate=window.document.querySelector('#voicePadRecognitionDialog');
    assert(gate.open, 'recognition off shows the requirement prompt');
    assert.equal(window.WMOFInteractionState.state.speechRecognition,'off');
    assert.equal(window.WMOFInteractionState.state.actions.openVoicePad,false);
    assert(!window.WMOFVoiceEntry.active, 'recognition off cannot open a voicepad');
    assert(gate.textContent.includes('Voice Pad requires speech recognition enabled. Say OK to turn on speech recognition'));
    window.document.querySelector('#voicePadRecognitionCancel').click();await settle();
    assert(!gate.open && !window.WMOFVoiceEntry.active, 'Cancel preserves current screen');
    assert.equal(requests.length,beforeRequests, 'requirement prompt and Cancel do not persist');
    const startRecognition=window.SpeechMenu.start;
    window.SpeechMenu.start=async()=>{window.SpeechMenu.testBegin();window.document.querySelector('#speechMicBar').isOpen=true;return true;};
    await window.WMOFVoiceEntry.open({mode:'time',source:'test-voice-gate',confirmTarget:'home',cancelTarget:'home'});await settle();
    window.document.querySelector('#voicePadRecognitionOk').click();await settle();
    assert(!gate.open && window.WMOFVoiceEntry.active,'OK enables recognition before opening requested voicepad');
    assert.equal(window.WMOFInteractionState.state.speechRecognition,'listening');
    const value=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(value,'ten minutes',true);await value.digestQueue;await settle();
    const entryValue=window.WMOFInteractionState.state.editor.value;
    await window.SpeechMenu.sleep();await settle();
    assert(!window.WMOFVoiceEntry.active && window.document.querySelector('#numberPadDialog').open,'sleep automatically opens keypad');
    assert.equal(window.WMOFInteractionState.state.speechRecognition,'sleeping');
    assert.equal(window.WMOFInteractionState.state.editor.value,entryValue,'sleep preserves entered value');
    if(process.argv.includes('--voice-feedback'))assert(spoken.includes('Voice recognition off. Switched to number pad.'));
    window.SpeechMenu.testBegin();await window.WMOFActions.handleSpeechRuntimeStarted();await settle();
    await window.WMOFActions.switchNumberPadToVoice();await settle();
    assert(window.WMOFVoiceEntry.active,'enabled recognition permits keypad to voice switching');
    await window.WMOFActions.handleSpeechRuntimeStopped();await settle();
    assert(!window.WMOFVoiceEntry.active && window.document.querySelector('#numberPadDialog').open,'off automatically opens keypad');
    assert.equal(window.WMOFInteractionState.state.editor.value,entryValue,'off preserves entered value');
    if(process.argv.includes('--voice-feedback'))assert(spoken.includes('Microphone deactivated. Switched to number pad.'));
    await window.WMOFActions.closeActiveSurface();await settle();
    window.SpeechMenu.start=startRecognition;
    window.SpeechMenu.testBegin();
    await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true; // Happy DOM does not implement the Popover API.
await settle();
    assert(window.WMOFInteractionState.state.actions.openVoicePad, 'active visible recognition allows voicepad: '+JSON.stringify({speech:window.WMOFInteractionState.state.speechRecognition,started:window.SpeechMenu.started,hidden:window.document.querySelector('#speechMicBar').hidden,popover:window.document.querySelector('#speechMicBar').matches(':popover-open'),state:window.document.querySelector('#speechMicBar').getAttribute('state')}));
}
if(process.argv.includes('--trip-summary')) {
    const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,'trip summary',true);await u.digestQueue;await settle();
    assert(u.hadCommittedCommand && !u.digestExecutionFailed,'Trip Summary is available with no active trip');
    const dialog=window.document.querySelector('#tripTransitionOverlay');
    assert(dialog.open && dialog.textContent.includes('No trip data available.'),'empty selected range renders no data');
    assert.equal(window.document.querySelector('#tripTransitionOverlayTitle').textContent,'Trip Summary');
    assert.equal(window.WMOFInteractionState.state.tripSummary.invocation.reason,'requested');
    assert.equal(window.WMOFInteractionState.state.tripSummary.invocation.method,'voice');
    assert(!spoken.includes('Say OK to start a new trip.'),'requested summary suppresses new-trip prompt');
    if(process.argv.includes('--voice-feedback'))assert(spoken.includes('No trip data available.'));
    window.document.querySelector('#tripTransitionSummaryOk').click();await settle();
    assert(!dialog.open && !window.WMOFVoiceEntry.active,'requested summary OK only dismisses');
}
if(process.argv.includes('--range-voice')) {
    for(const [phrase,range,label] of [['year','year','Year'],['money','pay-period','Money'],['money mode','pay-period','Money'],['week','week','Week'],['day','day','Day']]) {
        spoken.length=0;
        const utterance=window.SpeechMenu.testBegin();
        await window.SpeechMenu.testTranscript(utterance,phrase,true);await utterance.digestQueue;await settle();
        assert(utterance.hadCommittedCommand && !utterance.digestExecutionFailed,phrase+' selects range');
        assert.equal(window.WMOFInteractionState.state.tripLogRange,range,phrase+' retains canonical range identifier');
        assert.equal(timer.percentMode,'total');
        assert.equal(window.document.querySelector('#tripLogRangeSelect').value,range);
        const expected=window.WMOFAnnouncementLanguage.text('messages.settings.viewing',{scope:label});
        assert.deepEqual(spoken,[expected],phrase+' has exactly one final range announcement');
    }
    await window.WMOFActions.changeGoalMode('trip');await settle();
    console.log('PASS English year/money/week/day, canonical tripLogRange and exactly one announcement');
}
if(process.argv.includes('--voice-feedback')) {
    for (const silence of [false, true]) for (const validValue of [false, true]) {
        const say = async phrase => {
            const u = window.SpeechMenu.testBegin();
            if (silence) assert(await window.SpeechMenu.testSilence(u, phrase));
            else {await window.SpeechMenu.testTranscript(u, phrase, true);await u.digestQueue;}
            await settle();
        };
        await say('ready');
        if (validValue) await say('ten minutes');
        spoken.length = 0;
        const writesBefore = stored.length;
        await say('cancel');
        assert(!window.document.querySelector('#voiceEntrySurface').open, 'voice Cancel returns to main');
        assert.equal(timer.status, 'ready', 'voice Cancel leaves no active trip');
        assert.equal(stored.length, writesBefore, 'voice Cancel does not persist a trip');
        assert.equal(spoken.filter(text => text === 'Trip entry cancelled.').length, 1,
            `voice Cancel announces once: ${validValue ? 'valid value' : 'empty value'}, ${silence ? 'silence' : 'final decode'}`);
    }
    console.log('PASS E05/E06 voicepad Cancel announces once for empty/valid values through final and silence paths');
}
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
    const growing=window.SpeechMenu.testBegin();
    const beforeDuration=window.document.querySelector('#scheduledStartStandardValue').textContent;
    for(const phrase of ['standard time ten','standard time ten minutes','standard time ten minutes thirty','standard time ten minutes thirty seconds']) {
        const plan=await window.SpeechMenu.planCommandChain(phrase);
        assert(plan?.continuation && !plan?.terminal,phrase+' remains extendable for every recognition path');
        await window.SpeechMenu.testTranscript(growing,phrase,false);await growing.digestQueue;await settle();
        assert.equal(growing.digestSteps.length,0,phrase+' must remain uncommitted while collecting');
        assert.equal(window.document.querySelector('#scheduledStartStandardValue').textContent,beforeDuration,'an interim duration cannot arm scheduled-start acceptance');
    }
    await window.SpeechMenu.testTranscript(growing,'standard time ten minutes thirty seconds',true);await growing.digestQueue;await settle();
    assert.equal(growing.digestSteps.length,1,'one final duration action');
    assert.equal(growing.digestSteps[0].transcript,'standard time 0:10:30','commit the complete continued duration');
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
const syncDigested=[];const recordSync=event=>{if(event.detail.utteranceId===syncAttempt.id)syncDigested.push(event.detail.commandElement.getAttribute('speech-function'));};
window.SpeechMenu.events.addEventListener('speechCommandDigested',recordSync);
await window.SpeechMenu.testTranscript(syncAttempt,'sync',false);await syncAttempt.digestQueue;
await window.SpeechMenu.testTranscript(syncAttempt,'sync off',false);await syncAttempt.digestQueue;
await window.SpeechMenu.testTranscript(syncAttempt,'sync off',true);await syncAttempt.digestQueue;await settle();
assert.equal(window.SpeechMenu.started,true,'sync off must not stop speech recognition');
assert.equal(window.SpeechMenu.listeningSuspended,false,'sync off must not suspend recognition');
assert.equal(window.document.querySelector('#app').dataset.speechActive,'true','sync off must keep the mic bar visible');
window.SpeechMenu.events.removeEventListener('speechCommandDigested',recordSync);
assert.deepEqual(syncDigested,['WMOFActions.toggleSync'],'sync off digests once even after its completed stream is pruned');
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
    await window.SpeechMenu.testTranscript(okAttempt,'okay',!process.argv.includes('--post-start-interrupted-final'));await okAttempt.digestQueue;await settle();
    if(process.argv.includes('--post-start-interrupted-final')) {
        assert.equal(timer.status,'running','interim OK optimistically starts the trip');
        window.SpeechMenu.testFinish();
        const sync=window.SpeechMenu.testBegin();
        await window.SpeechMenu.testTranscript(sync,'sync on',true);
        window.SpeechMenu.testDeliverFinal(okAttempt,'okay');
        let timeout;
        try {await Promise.race([sync.digestQueue,new Promise((_,reject)=>timeout=setTimeout(()=>reject(new Error('Sync stalled behind a discarded final decode')),1500))]);}
        finally {clearTimeout(timeout);}
        await settle();
        assert(sync.hadCommittedCommand&&!sync.digestExecutionFailed,'state-changing speech works after voice trip start');
        assert.equal(window.WMOFStateTransactions.pending.length,0,'no orphaned command transaction blocks later commands');
        assert(stored.some(e=>e.event==='trip.started'),'accepted terminal OK is persisted');
        const say=async phrase=>{
            const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,phrase,true);
            let timeout;
            try {await Promise.race([u.digestQueue,new Promise((_,reject)=>timeout=setTimeout(()=>reject(new Error(phrase+' stalled')),1500))]);}
            finally {clearTimeout(timeout);}
            await settle();assert(u.hadCommittedCommand&&!u.digestExecutionFailed,phrase+' executes');return u;
        };
        await say('down time');assert.equal(window.WMOFInteractionState.state.interval,'down');
        await say('resume');
        await say('start break okay');assert.equal(window.WMOFInteractionState.state.tripStatus,'break');
        await say('end break okay');
        await say('ready');assert.equal(timer.status,'ready');
        await say('cancel');
        await say('ready');
        assert(window.document.querySelector('#voiceEntrySurface').open,'Ready after trip completion opens voice entry');
        await say('twenty minutes');
        assert.equal(window.document.querySelector('#voiceEntryValue').textContent,'0:20:00');
        assert.equal(window.WMOFStateTransactions.pending.length,0,'Ready after returning to no trip does not leave Applying stuck');
        console.log('PASS late voice-start/Ready final decodes, Sync, Down/Resume, Break/End Break and trip finish');
        window.happyDOM.abort();process.exit(0);
    }
    assert(!okAttempt.digestExecutionFailed,'voice OK accepts and persists the entered trip time');
}
assert.equal(timer.status,'running','confirmation starts the trip');
checkInteractionState();
const beforeStaleButton=window.WMOFInteractionState.state;
window.document.querySelector('#endTripButton').disabled=true;
assert.equal(window.WMOFSpeechAvailability.canUseReady(),beforeStaleButton.actions.ready,'a stale button flag cannot disable a valid command');
window.WMOFInteractionState.refresh();
checkInteractionState();
assert(stored.some(e=>e.event==='trip.started'),'the confirmed trip reaches persistence');
if(process.argv.includes('--loopback-only')) {
    const say=async phrase=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,phrase,true);await u.digestQueue;await settle();assert(u.hadCommittedCommand&&!u.digestExecutionFailed,phrase+' is accepted');};
    for(const mode of ['trip','auto','total','year','money','week','day']) {
        await say(mode+' mode');spoken.length=0;const start=chimes.length;
        await say(mode+' mode');
        assert.deepEqual(chimes.slice(start),['setting-unchanged'],mode+' repeated mode cue');
        assert.equal(spoken.length,1,mode+' speaks once');
    }
    await say('sync off');
    for(const [phrase,cue] of [['sync off','setting-unchanged'],['sync on','setting-on'],['sync on','setting-unchanged'],['sync off','setting-off'],['sync off','setting-unchanged'],['sync status','setting-unchanged'],['mode','setting-unchanged']]) {
        spoken.length=0;const start=chimes.length;await say(phrase);
        assert.deepEqual(chimes.slice(start),[cue],phrase+' emits exactly one expected cue');
        assert.equal(spoken.length,1,phrase+' speaks once');
    }
    assert.equal(errors.length,0,errors.join('\n'));assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
    console.log('PASS FSM mode/range and sync loopbacks: one unchanged chime and one response; real sync changes use on/off cues');
    window.happyDOM.abort();process.exit(0);
}
window.__testTime+=120000;
if(process.argv.includes('--trip-summary')) {
    const activeId=timer.currentTripId;
    const at=new window.Date(window.__testTime-3600000).toISOString();
    summaryTrips=[{id:901,startTime:at,standardTimeMilliseconds:600000,actualTimeMilliseconds:500000,countedTimeMilliseconds:400000},
        {id:902,startTime:at,standardTimeMilliseconds:300000,actualTimeMilliseconds:250000,countedTimeMilliseconds:200000,nonProduction:true},
        {id:activeId,startTime:at,standardTimeMilliseconds:999999,actualTimeMilliseconds:999999,countedTimeMilliseconds:999999}];
    spoken.length=0;
    const writes=requests.filter(r=>['POST','PATCH','DELETE'].includes(r.options.method)).length;
    const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,'trip summary',true);await u.digestQueue;await settle();
    assert(u.hadCommittedCommand && !u.digestExecutionFailed,'Trip Summary is available during a trip');
    const result=window.WMOFInteractionState.state.tripAggregates.tripSummary;
    assert(Object.isFrozen(window.WMOFInteractionState.state.tripAggregates));
    assert.equal(result.includeActiveTrip,false);
    assert(!('calculation' in window.WMOFInteractionState.state.tripSummary),'derived data belongs only in tripAggregates');
    assert.equal(result.tripCount,2,'summary excludes current trip even when server reports a completed-looking record');
    assert.equal(result.standardTimeMilliseconds,900000);assert.equal(result.countedTimeMilliseconds,600000);
    assert.equal(result.percent,1.5);assert.equal(result.actualTimeMilliseconds,750000);
    assert.equal(timer.currentTripId,activeId);assert.equal(timer.status,'running','requested summary does not stop current trip');
    assert.equal(requests.filter(r=>['POST','PATCH','DELETE'].includes(r.options.method)).length,writes,'summary performs no writes');
    assert(!spoken.includes('Say OK to start a new trip.'));
    const cancel=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(cancel,'cancel',true);await cancel.digestQueue;await settle();
    assert(!window.document.querySelector('#tripTransitionOverlay').open && timer.status==='running','summary Cancel preserves running trip');
    summaryTrips=[];
    console.log('PASS Trip Summary command, no-data announcement, all-range totals excluding active trip, no mutations and no new-trip prompt');
}
if(process.argv.includes('--saved-ready')) {
    window.eval(fs.readFileSync(new URL('../SpeechEditorRuntime.js',import.meta.url),'utf8'));
    await settle();
    const ready = window.document.querySelector('[data-speech-editor-id="builtin:ready:page"]');
    const attrs = Object.fromEntries([...ready.attributes].filter(a=>a.name.startsWith('speech-')).map(a=>[a.name,a.value]));
    attrs['speech-function'] = 'WMOFActions.prepareStartMenu';
    window.WMOFSpeechEditorRuntime.apply([{kind:'existing',id:'builtin:ready:page',attrs}]);
    await settle();
    assert(window.SpeechMenu.testAvailable().includes(ready),'Ready remains selected while End Trip is shown');
}
if(process.argv.includes('--pointer-confirmation')) {
    // Retain the old keypad's closing frame to reproduce the fast CI finish race.
    const oldPad=window.document.querySelector('#numberPadDialog');
    if(!oldPad.open) oldPad.showModal();
    oldPad.classList.add('dialog-closing');
}
if(process.argv.includes('--ready-finish')) {
    const finishReady=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(finishReady,'ruddy',true);await finishReady.digestQueue;await settle();
    assert(!finishReady.digestExecutionFailed,'Ready finishes the active trip');
    assert(stored.some(e=>e.event==='trip.stopped'),'Ready persists the completed trip');
} else {
    await window.WMOFActions.endTrip();await settle();
}
assert.equal(window.document.querySelector('#app').dataset.persistenceState,'confirmed','finishing the trip settles its transaction');
checkInteractionState();
const summary = window.document.querySelector('#tripTransitionOverlay');
assert(summary.open, 'finishing keeps the last-trip summary open');
assert(!window.document.querySelector('#voiceEntrySurface').open, 'finishing does not open voice entry before OK');
assert(!window.document.querySelector('#numberPadDialog')?.open, 'finishing does not open the keypad before OK');
assert.equal(window.WMOFInteractionState.state.actions.confirmSummary,true);
assert.equal(window.WMOFInteractionState.state.tripSummary.invocation.reason,'trip-ended');
assert.equal(window.WMOFInteractionState.state.tripSummary.invocation.method,'system');
if(process.argv.includes('--summary-state')) {
    await new Promise(resolve=>setTimeout(resolve,7500));
    assert(summary.open, 'the summary stays open beyond the former timeout');
}
const acceptSummary = async () => {
    const utterance=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(utterance,'okay',true);await utterance.digestQueue;await settle();
    assert(utterance.hadCommittedCommand && !utterance.digestExecutionFailed, 'spoken summary OK executes');
    assert(!summary.open, 'summary OK dismisses summary');
    assert(window.document.querySelector('#voiceEntrySurface').open, 'spoken summary OK opens voicepad when mic is active');
};
if(process.argv.includes('--voice-feedback')) {
    assert.equal(spoken.at(-1),'Say OK to start a new trip.','summary prompt is spoken last');
}
await acceptSummary();
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
checkInteractionState();
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
for(const [cycle,[value,confirmation]] of [['tutu minutes','okay'],['ten minutes','o k'],['five minutes','ok']].entries()) {
    window.__testTime+=60000;
    await window.WMOFActions.endTrip();await settle();
    if(cycle===0) {
        await hear('cancel');
        assert(!summary.open && !window.WMOFVoiceEntry.active && !window.document.querySelector('#numberPadDialog')?.open,'spoken summary Cancel returns to no-trip state');
        assert.equal(timer.status,'ready');
        assert(!window.WMOFInteractionState.state.actions.confirmSummary);
        await hear('ready');
        window.document.querySelector('#voiceEntryTouch').click();await settle();
    } else if(cycle===1) {
        window.document.querySelector('#tripTransitionSummaryCancel').click();await settle();
        assert(!summary.open && timer.status==='ready','pointer summary Cancel returns to no-trip state');
        await hear('ready');
        window.document.querySelector('#voiceEntryTouch').click();await settle();
    } else {
        window.document.querySelector('#tripTransitionSummaryOk').click();await settle();
    }
    assert(window.document.querySelector('#numberPadDialog').open && !window.WMOFVoiceEntry.active,'pointer summary OK opens keypad even when speech is enabled');
    await window.WMOFActions.switchNumberPadToVoice();await settle();
    assert.equal(window.document.querySelector('#voiceEntrySurface').open,true,'explicit voice switch opens the next input');
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
await acceptSummary();
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
await timer.stop();await window.WMOFActions.cancelTripSummary();await timer.clear();stored.length=0;
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
    assert.equal(checkInteractionState().tripStatus,'down');
    assert(!downAttempt.digestExecutionFailed,phrase+' completes its transaction');
    assert(downAttempt.digestSteps[0].commandElement.hasAttribute('speech-persist'),phrase+' is marked for persistence');
    assert.equal(stored.filter(e=>e.event==='interval.started'&&e.value.type?.toLowerCase()==='down').length,downEventsBefore+1,phrase+' persists the Down event');
    assert.equal(window.SpeechMenu.started,true,phrase+' keeps recognition active');
    window.__testTime+=60000;
    const resumeAttempt=window.SpeechMenu.testBegin();
    await window.SpeechMenu.testTranscript(resumeAttempt,resume,true);await resumeAttempt.digestQueue;await settle();
    assert(!timer.getActiveIntervalState(),resume+' ends Down time');
    assert.equal(checkInteractionState().tripStatus,'running');
    assert(resumeAttempt.hadCommittedCommand,resume+' executes its command');
    assert(!resumeAttempt.digestExecutionFailed,resume+' persists successfully');
}
if(process.argv.includes('--voice-feedback')) {
    const speakCommand=async phrase=>{const u=window.SpeechMenu.testBegin();await window.SpeechMenu.testTranscript(u,phrase,true);await u.digestQueue;await settle();return u;};
    const dialog=window.document.querySelector('#speechBreakConfirmDialog');
    const restored=await speakCommand('break start');
    assert(restored.hadCommittedCommand && window.document.querySelector('#breakDialog').open,'Break Start opens the type selector');
    await speakCommand('cancel');
    assert(window.document.querySelector('#breakDialog speech-command'),'Break Selector supports voice choices');
    for(const [phrase,label,type,summary] of [
        ['start short break','short break','break','Short break'],
        ['start lunch','lunch','lunch','Lunch']]) {
        spoken.length=0;
        const selection=await speakCommand(phrase);
        assert(selection.hadCommittedCommand && !selection.digestExecutionFailed,phrase+' is accepted');
        assert(dialog.open,'voice opens the confirmation dialog');
        assert.equal(checkInteractionState().focus,'speechBreakConfirmDialog');
        assert(!window.document.querySelector('#breakDialog').open,'voice never opens the pointer selector');
        assert.equal(window.document.querySelector('#speechBreakConfirmMessage').textContent,'Are you ready to start your '+label+'?');
        assert.equal(window.document.querySelector('#speechBreakConfirmYes').textContent,'OK');
        assert(window.document.querySelector('#speechBreakConfirmNo').hidden,'only OK and Cancel are offered');
        assert(!timer.getActiveIntervalState(),'without OK, no interval starts');
        assert(spoken.includes('Are you ready to start your '+label+'?'),'standalone start speaks its question');
        await speakCommand('cancel');assert(!timer.getActiveIntervalState(),'Cancel leaves the trip running');
        await speakCommand(phrase);await speakCommand('ok');
        assert.equal(timer.getActiveIntervalState()?.intervalType,type,'a separate OK starts the selected interval');
        assert(spoken.includes(summary+' started. Say break end to end your '+label+'.'),'the final start announcement is preserved');
        const beforeWrongEnd=timer.getActiveIntervalState().intervalKey;
        const wrongEnd=await speakCommand(label==='break'?'end lunch ok':'end break ok');
        assert(!wrongEnd.hadCommittedCommand && timer.getActiveIntervalState()?.intervalKey===beforeWrongEnd,'a mismatched end command cannot end the active interval');
        await speakCommand('break end');
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
            assert(spoken.includes(summary+' started. Say break end to end your '+label+'.'),'combined start retains outcome speech');
            const end=window.SpeechMenu.testBegin();
            if(incremental) {
                await window.SpeechMenu.testTranscript(end,'break end',false);await end.digestQueue;await settle();
                assert(!dialog.open,'interim end defers confirmation');
            }
            await window.SpeechMenu.testTranscript(end,'break end ok',true);await end.digestQueue;await settle();
            assert(!end.digestExecutionFailed && !timer.getActiveIntervalState(),'combined end completes');
            assert(!spoken.includes('Are you ready to end your '+label+'?'),'combined end skips its question');
            assert.equal(animationCalls.filter(c=>c.target?.id==='speechBreakConfirmDialog').length,before,'combined commands do not flash a dialog');
        }
    }
    const translatedStart=window.document.querySelector('[data-speech-editor-id="builtin:startLunch:page"]');
    const translatedEnd=window.document.querySelector('[data-speech-editor-id="builtin:endBreak:page"]');
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
    await speakCommand('break end ok');
    await speakCommand('sync off');const beforeSyncLoop=chimes.length;await speakCommand('sync off');assert(spoken.includes('Sync already off.'));if(process.argv.includes('--setting-chimes'))assert.deepEqual(chimes.slice(beforeSyncLoop),['setting-unchanged'],'unchanged sync loopback gets exactly one neutral chime');
    if(process.argv.includes('--setting-chimes')) {
        for(const mode of ['trip','auto','total','year','money','week','day']) {
            await speakCommand(mode+' mode');spoken.length=0;const start=chimes.length;
            const repeatedMode=await speakCommand(mode+' mode');
            assert(repeatedMode.hadCommittedCommand && !repeatedMode.digestExecutionFailed,JSON.stringify({mode,focus:window.WMOFInteractionState.state.focus,steps:repeatedMode.digestSteps.map(s=>s.commandElement.getAttribute('speech-function')),failed:repeatedMode.digestExecutionFailed}));
            assert.deepEqual(chimes.slice(start),['setting-unchanged'],mode+' voice loopback plays one unchanged chime '+JSON.stringify({spoken,steps:repeatedMode.digestSteps.map(s=>s.commandElement.getAttribute('speech-function')),mode:timer.percentMode}));
            assert.equal(spoken.length,1,mode+' voice loopback speaks once');
        }
        const readStart=chimes.length;await speakCommand('sync status');
        assert.deepEqual(chimes.slice(readStart),['setting-unchanged'],'sync status is informational');
        for(const enabled of ['on','off']) {
            await speakCommand('sync '+enabled);spoken.length=0;const start=chimes.length;
            await speakCommand('sync '+enabled);
            assert.deepEqual(chimes.slice(start),['setting-unchanged'],'sync '+enabled+' voice loopback');
            assert.equal(spoken.length,1,'sync '+enabled+' speaks once');
        }
    }
    await speakCommand('sleep');assert(spoken.includes('Microphone deactivated.'));
    await speakCommand('wake');assert(spoken.includes('Microphone activated.'));
    await speakCommand('off');assert(spoken.includes('Microphone deactivated.'));
    console.log('PASS replacement start commands, pointer-only selector, OK/Cancel confirmation, and incremental start/end dialog and speech suppression for all interval types');
}
assert.equal(errors.length,0,errors.join('\n'));
assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
console.log('PASS repeated trip entry, touch/voice switching, delayed closes, Ready/Cancel/Resume variants, validation rejection and retry, Down persistence, sync-off visibility and rollback');
window.happyDOM.abort();
