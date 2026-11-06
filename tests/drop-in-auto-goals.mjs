import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from './LanguageWindow.mjs';
const w = new Window({url:'https://clock.example/'});
w.__testTime = Date.parse('2026-10-07T12:00:00Z');
w.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css = w.CSS; css.registerProperty = () => {}; Object.defineProperty(w,'CSS',{value:css});
w.Element.prototype.animate = () => ({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1};}}});
for (const file of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer']) {
    w.eval(fs.readFileSync(new URL('../'+file+'.js',import.meta.url),'utf8'));
}
w.document.body.innerHTML = fs.readFileSync(new URL('../drop-in.html', import.meta.url),'utf8')
    .match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
for (const file of ['CalendarRange.js','TimerAppearance.js','DropInView.js']) w.eval(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const $ = id => w.document.getElementById(id);
const totals = value => {
    const production = {tripCount:1,actualTimeMilliseconds:value.countedTimeMilliseconds,...value};
    return {...production,aggregateBreakdown:{production,nonProduction:{trips:[]}}};
};
const requests = [];
const stream = {fetchViewerTotals(window,options) {
    return new Promise((resolve,reject) => requests.push({window,options,resolve: value=>resolve(totals(value)),reject}));
}};
const controller = new w.WMOFDropInView({root:$('liveStreamDialog'), stream, text:key=>key});
controller.setGraphicalSettings(w.WMOFTimerAppearance.normalizeGraphicalSettings({tripColor:'#abcdef'}));
const snapshot = {timestamp:'2026-10-07T12:00:00Z',userId:42,uiState:{state:'trip_running',effective_goal_type:'trip',sync_enabled:false,
    standard_time_component:{text:'USER STANDARD'},standard_time_header_text:'Standard Time',time_header_text:'Remaining',time_component:{text:'USER EXACT TIME'}, current_percent_component:{text:'200%'},goal_component:{text:'100%'},
    trip_goal_component:{text:'100%'},total_goal_component:{text:'110%'}},viewData:{
    mode:'trip',range:'week',active:true,tripId:19,tripStart:'2026-10-07T11:00:00Z',productionFilter:'all',
    summary:{trip:{available:true,standardTimeMilliseconds:600000,countedTimeElapsedMilliseconds:300000,percentGoal:1},
        total:{percentGoal:1.1,standardTimeMilliseconds:1200000,countedTimeElapsedMilliseconds:900000}},
    model:{events:[{event:'trip.started',timestamp:'2026-10-07T11:55:00Z',value:{standardTimeMilliseconds:600000,
        creationTime:'07:55:00',scheduledStart:'07:55:00',startTime:'07:55:00',creationAnchor:'2026-10-07T04:00:00Z',nonProduction:false}}],
        started:true,tripId:19,attributes:[['trip-goal','100%'],['total-goal','110%'],['percent-mode','trip']],
        sync:false,timeDisplay:'remaining',productionFilter:'all',addedToAggregate:false,
        totals:{tripCount:1,standardTimeMilliseconds:600000,actualTimeMilliseconds:600000,countedTimeMilliseconds:600000,
            startTime:'2026-10-04T04:00:00.000Z',endTime:'2026-10-11T03:59:59.999Z'}},
    calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',rules:{weekStartDay:0,cutoffTime:'00:00:00',effectiveFrom:'2026-01-01',recurring:true,payPeriodDays:14,payPeriodAnchorDate:'2026-01-04'}}]
}};
snapshot.viewData.model.totals = {...snapshot.viewData.model.totals,...totals(snapshot.viewData.model.totals)};
const original = JSON.stringify(snapshot);
let apiCalls = 0;
w.fetch = async () => { apiCalls++; throw new Error('Observer attempted an API request'); };
snapshot.viewData.percentageDisplay='bar';const unchanged=JSON.stringify(snapshot);controller.update(snapshot);
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
controller.applyPreference({mode:'auto',aggregateScope:'week',tripGoal:'125',aggregateGoals:{week:'110',day:'120'},autoGoalOverride:'standard',sync:'off'});
assert.equal(controller.displayState.auto_goal_override,'standard');
assert.equal(controller.displayState.effective_goal_type,'standard');assert.deepEqual([...controller.displayState.goal_bar.next_goal.ids],['standard']);assert.equal(controller.displayState.goal_bar.next_goal.remaining_milliseconds,controller.displayState.goal_bar.nodes.find(n=>n.id==='standard').remaining_milliseconds);
assert.equal(controller.timer.getAttribute('trip-goal'),'125%');
assert.equal(controller.timer.getAttribute('total-goal'),'110%');
controller.update(structuredClone(snapshot));
assert.equal(controller.displayState.auto_goal_override,'standard','publisher cadence does not clear observer lock');
controller.applyPreference({mode:'auto',aggregateScope:'week',tripGoal:'125',aggregateGoals:{week:'110',day:'120'},autoGoalOverride:'week',sync:'off'});
assert.equal(controller.displayState.auto_goal_override,'total');
controller.applyPreference({mode:'auto',aggregateScope:'day',tripGoal:'125',aggregateGoals:{week:'110',day:'120'},autoGoalOverride:'day',sync:'off'});
await tick();assert.equal(requests.length,1,'Auto resolves the selected aggregate independently of publisher range');
requests[0].resolve({standardTimeMilliseconds:600000,countedTimeMilliseconds:600000});await tick();
assert.equal(controller.timer.percentMode,'auto');
assert.equal(controller.timer.getAttribute('total-goal'),'120%');
assert.equal(controller.displayState.auto_goal_override,'total');
assert.equal(controller.displayState.effective_goal_type,'total');assert.deepEqual([...controller.displayState.goal_bar.next_goal.ids],['total']);
const readouts=JSON.stringify(controller.displayState);
controller.update(structuredClone(snapshot));await tick();
assert.equal(JSON.stringify(controller.displayState),readouts,'same snapshot keeps locked percentage and time readouts stable');
controller.applyPreference({mode:'day',aggregateGoals:{day:'120'}});await tick();requests.at(-1).resolve({standardTimeMilliseconds:600000,countedTimeMilliseconds:600000});await tick();
assert.equal(controller.timer.getAttribute('total-goal'),'120%','aggregate mode shares its goal with Auto');
controller.applyPreference({mode:'auto',aggregateScope:'week',autoGoalOverride:'trip'});
assert.equal(controller.displayState.auto_goal_override,'trip');
controller.applyPreference({mode:'auto',aggregateScope:'week',autoGoalOverride:null});
assert.equal(controller.displayState.auto_goal_override,null,'explicit clear removes the previous lock');
const publisherLocked=structuredClone(snapshot);publisherLocked.viewData.model.autoGoalOverride='standard';publisherLocked.viewData.mode='auto';
controller.update(publisherLocked);controller.applyPreference({mode:'user'});
assert.equal(controller.timer.captureState().autoGoalOverride,'standard','Mirror restores publisher lock');
controller.applyPreference({mode:'auto',aggregateScope:'week',autoGoalOverride:null});
assert.equal(controller.displayState.auto_goal_override,null,'local Auto does not inherit publisher lock');
assert.equal(JSON.stringify(snapshot),unchanged,'observer never changes publisher data');assert(controller.displayState.goal_bar,'local observer keeps Goal Bar model after restoring publisher attributes');assert.equal(apiCalls,0);
controller.setUser(42);controller.applyPreference({mode:'auto',aggregateScope:'day',aggregateGoals:{day:'120'},autoGoalOverride:'day'});controller.setUser(43);assert.equal(controller.autoGoalOverride,null,'another publisher starts without the previous observer lock');controller.setUser(42);assert.equal(controller.autoGoalOverride,'day');assert.equal(controller.aggregateGoals.day,'120');
controller.destroy();await w.happyDOM.close();
console.log('PASS observer Auto range, per-aggregate goals, exclusive Standard/Trip/aggregate locks, clear, mirror, cadence and publisher isolation');
