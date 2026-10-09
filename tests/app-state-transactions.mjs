import {installAsyncStorage} from './async-storage-fixture.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {installEnglishPack} from './LanguageWindow.mjs';
const window=new Window({url:process.argv.includes('--landing-session')?'https://clock.example/order-filler.php?session=existing':'https://clock.example/',settings:{disableJavaScriptEvaluation:true,disableCSSFileLoading:true}});
const storage=installAsyncStorage(window);
window.__testTime=Date.parse('2026-10-06T12:00:00Z');
window.eval(`const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const spoken=[],chimes=[],startupAudioCalls=[];let finishStartup;
if(process.argv.includes('--voice-feedback')) window.WMOFAudio={unlock(){startupAudioCalls.push('unlock');return new Promise(()=>{});},speak(text,options={}){startupAudioCalls.push('speak');spoken.push(String(text));if(process.argv.includes("--startup-speech") && text === "Application is loading") finishStartup=options.onEnd;else queueMicrotask(()=>options.onEnd?.());return true;},
    async startSong(name){chimes.push(name);return {hasChime:true,finished:Promise.resolve()};}};
let recognition;
window.SpeechRecognition=class {start(){recognition=this;this.onstart?.();} abort(){this.onend?.();}};
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
const animationCalls=[];window.Element.prototype.animate=function(keyframes,options){animationCalls.push({target:this,keyframes,options});return{finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}}};
const consoleErrors=[];window.console.error=(...args)=>consoleErrors.push(args.map(a=>a?.stack||String(a)).join(' '));
const errors=[];window.addEventListener('error',e=>{errors.push(e.message);});
const rules={weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31'};
let summaryTrips=[];let rejectTripStop=false;let holdTripCheck=false;let releaseTripCheck;let rejectTripStart=false;let releaseCheck;let holdCheck=false;let eventId=1,tripId=41;const requests=[],stored=[];let holdLogin=false,releaseLogin,rejectLogin=false;
const accountBlob={version:1,orderFiller:{'wmof.clock.graphicalSettings':JSON.stringify({tripColor:'#123456'}),'wmof.clock.percentMode':'auto'}};
window.fetch=async(url,options={})=>{
 const path=new URL(url,'https://clock.example/').pathname;requests.push({path,options});
 const input=options.body?JSON.parse(options.body):null;
 if(rejectLogin&&path.endsWith('/users/')&&input?.action==='connect-pin'){const data={error:'invalid_credentials',message:'Incorrect credentials.'};return {ok:false,status:401,json:async()=>data,text:async()=>JSON.stringify(data),clone(){return this;}};}
 if(holdLogin&&path.endsWith('/users/')&&options.method==='POST')await new Promise(resolve=>releaseLogin=resolve);
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
 if(path.endsWith('/settings/')&&input)Object.assign(accountBlob[input.namespace]||={},input.changes);
 const data=path.endsWith('/settings/')?{userId:2,settings:structuredClone(accountBlob)}:path.endsWith('/command-check/')?{accepted:!duplicateBreak&&!tripStartRejected&&!tripStopRejected,reason:tripStartRejected?'Trip start rejected.':tripStopRejected?'Trip finish rejected.':'A break is already active.'}:path.endsWith('/calendar/')?{calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2,username:'test',first_name:'Alex',last_name:'Driver',preferred_name:'Al',permissions:4},calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',provenance:'manual',rules}]}:
 path.endsWith('/trip-events/')?(options.method==='POST'?{eventId:eventId-1}:{tripId,events:structuredClone(stored)}):
 path.endsWith('/trip-editor/')?{tripId,events:structuredClone(stored),settings:structuredClone(stored.find(e=>e.event==='trip.started')?.value||{}),revision:'test-revision'}:
 {tripId, trips:summaryTrips,aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>data,text:async()=>path.endsWith('numberpad.html')?fs.readFileSync(new URL('../numberpad.html',import.meta.url),'utf8'):JSON.stringify(data),clone(){return this;}};
};
window.document.write(fs.readFileSync(new URL('../order-filler.html',import.meta.url),'utf8').replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,''));
installEnglishPack(window);
if(process.argv.includes('--account-settings')){
 window.WMOFPersistence={ready:Promise.resolve(),initializeLegacy:async()=>{},peek:()=>null,getItem:async()=>null,setItem:async()=>{},commit:async()=>{},flush:async()=>{}};
 window.eval(fs.readFileSync(new URL('../AccountSettings.js',import.meta.url),'utf8'));
}
for(const name of ['AudioSettingsModel','TimerAppearance','TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer','CalendarRange','DigitSequence','IdentityContext','TripLogModel','TripGoalModel','TimerDisplayModel','DropInViewModel','TripDraftModel','AccessPolicyModel','LiveStreamViewModel','LiveStreamPublisher','SessionStartup','TripAggregates','TripLog','StateTransactions','SpeechFunctionRoles','SpeechFunctionRegistry','UtilityFunctions','SpeechProcessingFunctions','ActionFunctions','InteractionFunctions','PresentationSetters'])window.eval(fs.readFileSync(name==='StateTransactions' && process.env.CLOCKTIMER_STATE_SOURCE || name==='ActionFunctions' && process.env.CLOCKTIMER_ACTION_SOURCE || new URL('../'+name+'.js',import.meta.url),'utf8'));
// Happy DOM's eval realm can differ from the app's globalThis; keep the model API visible in both.
if(window.WMOFTimerAppearance)globalThis.WMOFTimerAppearance=window.WMOFTimerAppearance;
else if(globalThis.WMOFTimerAppearance)window.WMOFTimerAppearance=globalThis.WMOFTimerAppearance;
window.eval(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nwindow.ParameterParser=ParameterParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/DurationParser.js',import.meta.url),'utf8')+'\nwindow.EnglishDurationParser=EnglishDurationParser;');
window.eval(fs.readFileSync(new URL('../lang/en-US/SpokenTimeParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/PercentParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../lang/en-US/SpeechValuePreprocessor.js',import.meta.url),'utf8'));
let speechSource=fs.readFileSync(process.env.CLOCKTIMER_SPEECH_SOURCE || new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
speechSource=speechSource.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testModelReady(ready){SpeechMenu.#modelReady=ready;}
    static testBegin(){SpeechMenu.#modelReady=true;SpeechMenu.#executionEnabled=true;SpeechMenu.#sleeping=false;SpeechMenu.#stopped=false;SpeechMenu.#stream={getTracks(){return [];}};SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};SpeechMenu.#beginUtterance(window.__testTime-performance.timeOrigin);return SpeechMenu.#utterance;}
    static testTranscript(u,text,final=true){return SpeechMenu.#handleLiveTranscript(u,text,final);}
    static testFinish(){SpeechMenu.#finishUtterance("vad-silence",true);}
    static testDeliverFinal(u,text){SpeechMenu.#onSherpaTranscript({detail:{utteranceId:u.id,transcript:text,isFinal:true}});}
    static testFinal(u,text){return SpeechMenu.#handleCompletedTranscript(u,text);}
    static testAvailable(){return SpeechMenu.#availableCandidates();}
    static async testSilence(u,text){u.transcript=text;u.candidatePool=await SpeechMenu.#refreshCandidatePool(u,text);return SpeechMenu.#commitUtterance(u);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
window.eval(speechSource+'\nwindow.SpeechMenu=SpeechMenu;');
window.SpeechMenu.events.addEventListener('speechFeedbackError',e=>errors.push(e.detail.error?.stack||String(e.detail.error)));
window.eval(fs.readFileSync(new URL('../SpeechMicBar.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../SpeechRuntimeLoader.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../SpeechStartup.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../StartupAnnouncement.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../PersistenceStartup.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../ApplicationStartup.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../AudioUnlock.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../AudioSettingsStartup.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../PersistenceStartup.js',import.meta.url),'utf8'));
window.SpeechMenu.testBegin();
if(process.argv.includes('--voice-feedback')) window.eval(fs.readFileSync(new URL('../AnnouncementCatalog.js',import.meta.url),'utf8'));
let appSource=fs.readFileSync(process.env.CLOCKTIMER_APP_SOURCE || new URL('../app.js',import.meta.url),'utf8');
// The fixture freezes Date.now for trip boundaries; eliminate audio pauses
// so its frozen wall clock cannot accumulate an artificial playback backlog.
if(process.argv.includes('--voice-feedback')) appSource=appSource.replace('const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;', 'const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 0;');
if(process.argv.includes('--pointer-mode'))window.eval(fs.readFileSync(new URL('../ModeMenu.js',import.meta.url),'utf8'));
window.eval(appSource);

const settle=()=>new Promise(resolve=>setTimeout(resolve,150));await settle();
const timer=window.document.querySelector('#clockTimer');
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
 assert.equal(spoken.filter(t=>t==='Please login using voice').length,0,'ready model must not overtake startup announcement');
 assert(window.WMOFInteractionState.state,'UI initialized while startup audio is pending');
 finishStartup();await settle();assert.equal(spoken.filter(t=>t==='Please login using voice').length,1,'release latest prompt after startup speech completes');
 console.log('PASS startup speech completion barrier without blocking UI/model initialization');
 if(!process.argv.includes('--voice-login')){window.happyDOM.abort();process.exit(0);}
}
if(process.argv.includes('--voice-login')) {
 await window.WMOFActions.handleSpeechRuntimeStarted();window.document.querySelector('#speechMicBar').isOpen=true;await settle();
 const legacyDialog=window.document.querySelector('#legacyLoginDialog');
 const dialog=window.document.querySelector('#loginDialog');if(!dialog.open)dialog.showModal();await window.WMOFActions.cancelLoginDigits();
 assert.equal(window.WMOFInteractionState.state.login.stage,'id');
 assert(spoken.includes('Application is loading'),'startup announces Application is loading');
 window.SpeechMenu.testModelReady(false);const promptsBefore=spoken.filter(t=>t==='Please login using voice').length;
 await window.WMOFActions.switchToVoiceLogin();assert.equal(spoken.filter(t=>t==='Please login using voice').length,promptsBefore,'login prompt waits for model readiness');assert(!window.WMOFSpeechAvailability.canUseLogin());
 window.SpeechMenu.testModelReady(true);await window.WMOFActions.handleSpeechRuntimeStarted();await settle();assert.equal(spoken.filter(t=>t==='Please login using voice').length,promptsBefore+1,'model-ready event releases the pending login prompt');
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
 assert(spoken.includes('Please login using voice'));
 await speak('username');assert.equal(window.WMOFInteractionState.state.login.method,'password');
 window.document.querySelector('#loginVoiceSwitch').click();await settle();assert.equal(window.WMOFInteractionState.state.login.method,'pin');
 const spacedUser=await speak('user name');assert.equal(window.WMOFInteractionState.state.login.method,'password',JSON.stringify({failed:spacedUser.digestFailed,canceled:spacedUser.chainCanceled,pending:spacedUser.digestPending,errors,consoleErrors,available:window.SpeechMenu.testAvailable().map(e=>e.dataset.speechEditorId)}));await speak('voice');

 await window.WMOFActions.enterLoginDigits('one two');const voiceAnnouncements=spoken.filter(t=>t==='Please login using voice').length;await speak('voice');
 assert.equal(window.document.querySelector('#loginUsername').value,'');assert.equal(spoken.filter(t=>t==='Please login using voice').length,voiceAnnouncements+1,'Voice loop repeats its prompt');
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

 await speak('one two three four');await speak('zero zero four two');assert.equal(window.document.querySelector('#loginUsername').value,'0042','fresh User ID replaces previous entry');await speak('voice');


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
    await speakCommand('sleep');assert(spoken.includes('Voice recognition off.'));
    await speakCommand('wake');assert(spoken.includes('Voice recognition on.'));
    await speakCommand('off');assert(spoken.includes('Microphone deactivated.'));
    console.log('PASS replacement start commands, pointer-only selector, OK/Cancel confirmation, and incremental start/end dialog and speech suppression for all interval types');
}
assert.equal(errors.length,0,errors.join('\n'));
assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));
console.log('PASS repeated trip entry, touch/voice switching, delayed closes, Ready/Cancel/Resume variants, validation rejection and retry, Down persistence, sync-off visibility and rollback');
window.happyDOM.abort();
