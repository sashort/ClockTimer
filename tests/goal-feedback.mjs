import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {englishLanguage} from './announcement-language-fixture.mjs';
const language=await englishLanguage(),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
let range='day',mode='auto',goals={trip:'110%',total:'100%'};
const clockTimer={currentTripId:1,percentMode:'auto',calculatedTripGoal:1.12,calculatedGoalSource:'sync'};
const spoken=[],songs=[],pending=[];let releaseChime,releaseSpeech;
const chimeGate=new Promise(resolve=>releaseChime=resolve);
const context=vm.createContext({console,clockTimer,
 announcementText:language.text,normalizePercentMode:value=>value,getTripLogRange:()=>range,
 goalPercentForScope:scope=>goals[scope],totalScopeLabel:()=>range[0].toUpperCase()+range.slice(1),
 consumeAnnouncementAction:()=>({perform:true}),goalFailureNumberWords:String,formatGoalFailureDuration:String,
 reserveSemanticEvent(){},audioAnnouncementOutput:()=>({speechDelayMs:0}),nextSemanticAnnouncementId:1000,
 WMOFAudio:{},announcementComponents:(_audio,song,chime)=>chime?[{phase:'chime',play:async()=>{songs.push(song);await chimeGate;}}]:[],
 speakSemanticAndWait:async(_audio,text,_output,valid)=>{if(valid()&&text){spoken.push(text);if(releaseSpeech===null)await new Promise(resolve=>releaseSpeech=resolve);}return true;},
 runSemanticAnnouncement:(_name,components)=>{const task=Promise.resolve().then(async()=>{for(const component of components)await component.play();});pending.push(task);return task;}
});
vm.runInContext(app.slice(app.indexOf('    class GoalChangeAnnouncement'),app.indexOf('    const setGoalPercentValue'))+
 app.slice(app.indexOf('    function buildGoalFailureSpeech('),app.indexOf('    function onPercentModeChanged'))+
 '\nglobalThis.Change=GoalChangeAnnouncement;globalThis.fail=onGoalFail;',context);
const auto=new context.Change();range='week';goals={trip:'112%',total:'105%'};
assert.equal(auto.message('total','105%'),'Week goal set to 105 percent. Auto goal recalculated. New trip goal 112 percent.');
clockTimer.percentMode='trip';const sync=new context.Change();goals={trip:'115%',total:'106%'};
assert.equal(sync.message('total','106%'),'Week goal set to 106 percent. Sync value changed. New trip goal 115 percent.');
const unchanged=new context.Change();assert.equal(unchanged.message('total','106%'),'');
const direct=new context.Change();goals.trip='120%';assert.equal(direct.message('trip','120%'),'Trip goal set to 120 percent.');
clockTimer.percentMode='auto';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
context.fail({detail:{goals:[{type:'trip',percent:1.1}]}});await flush();
context.fail({detail:{goals:[{type:'total',percent:1.05}]}});
context.fail({detail:{goals:[{type:'trip',percent:1.1}]}});
releaseChime();await flush();await Promise.all(pending);await flush();
assert.deepEqual(songs,['goal-failed']);assert.deepEqual(spoken,['Trip and total goal failed.']);
// A later goal during speech is retained, with no repeated goal or second chime.
spoken.length=0;songs.length=0;releaseSpeech=null;
context.fail({detail:{goals:[{type:'trip',percent:1.1}]}});await flush();
context.fail({detail:{goals:[{type:'trip',percent:1.1},{type:'total',percent:1.05}]}});
releaseSpeech();releaseSpeech=undefined;await flush();await Promise.all(pending);await flush();
assert.deepEqual(songs,['goal-failed']);assert.deepEqual(spoken,['Trip Goal Failed.','Week Goal Failed.']);
spoken.length=0;songs.length=0;
context.fail({detail:{goals:[{type:'trip',percent:1.1}]}});
clockTimer.currentTripId=2;
await flush();await Promise.all(pending);await flush();
assert.deepEqual(spoken,[]);assert.deepEqual(songs,[],'replacement trips fence stale chimes as well as speech');
context.runSemanticAnnouncement=()=>Promise.resolve(false);
context.fail({detail:{goals:[{type:'trip',percent:1.1}]}});await flush();
assert.deepEqual(spoken,[],'canceled queue output settles without retry loops');
console.log('PASS final Auto/Sync goal feedback, direct/unchanged goals, merged queued failures, duplicate suppression and late failure without a second chime');

const automatic=[];
const syncScope=vm.createContext({clockTimer:{breakOnly:false,syncBelowFloor:true,goalBounding:true},
 goalChangeFeedbackDepth:0,syncAnnouncementState:'ready',syncAnnouncementGoal:undefined,
 runtime:'active',getSyncRuntimeState:()=>syncScope.runtime,currentCalculatedSyncGoal:()=>1.2,
 syncGoalMatches:(a,b)=>a===b,getSyncGoalsState:()=>true,
 announcementText:language.text,formatSummaryPercent:goal=>(goal*100)+'%',
 confirmInformationalChange:(name,text)=>{automatic.push({name,text});return true;}});
vm.runInContext(app.slice(app.indexOf('    function setSyncAnnouncementBaseline('),app.indexOf('    function renderSyncGoalsState(')),syncScope);
for(const runtime of ['active','time-blocked','ready']){
 syncScope.clockTimer.breakOnly=true;syncScope.runtime=runtime;
 syncScope.announceSyncRuntimeState({force:true,preferCalculatedGoal:true,forceCalculatedGoal:true});
 syncScope.announceCalculatedSyncGoal({force:true});
 assert.equal(automatic.length,0,'standalone break transitions suppress Sync and appended Bounding feedback');
 assert.equal(syncScope.syncAnnouncementState,runtime,'silent transitions still update the baseline');
}
syncScope.clockTimer.breakOnly=false;syncScope.announceSyncRuntimeState();
assert.equal(automatic.length,0,'ending the standalone break does not replay its silent state changes');
syncScope.runtime='active';syncScope.announceSyncRuntimeState({force:true,preferCalculatedGoal:true,forceCalculatedGoal:true});
assert.equal(automatic.length,1,'real-trip Sync feedback remains enabled');assert.match(automatic[0].text,/goal bounding on/i);
console.log('PASS standalone-break Sync/Bounding suppression, baseline advancement and unchanged active-trip feedback');
