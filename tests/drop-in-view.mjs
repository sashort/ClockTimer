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
for (const file of ['CalendarRange.js','DropInView.js']) w.eval(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
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
const snapshot = {timestamp:'2026-10-07T12:00:00Z',userId:42,uiState:{state:'trip_running',effective_goal_type:'trip',sync_enabled:false,
    time_component:{text:'USER EXACT TIME'}, current_percent_component:{text:'200%'},goal_component:{text:'100%'},
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
controller.update(snapshot);
assert.equal($('liveStreamRemoteTime').textContent,'USER EXACT TIME','default view mirrors the user component verbatim');
assert.equal($('liveStreamViewingMode').textContent,'User view (mirror)');
assert.equal($('liveStreamPublisherMode').textContent,'Trip');
assert.equal($('liveStreamUserTripGoal').textContent,'100%');
assert.equal($('liveStreamUserModeGoal').textContent,'110%');
assert.equal($('liveStreamUserSync').textContent,'off');
$('liveStreamViewPercent').value='150';$('liveStreamViewPercent').dispatchEvent(new w.Event('input'));
assert.match($('liveStreamRemoteTime').textContent,/1:40/,'local goal changes remaining time');
assert.equal($('liveStreamUserTripGoal').textContent,'100%','user goal remains intact');
$('liveStreamViewSync').value='on';$('liveStreamViewSync').dispatchEvent(new w.Event('change'));
assert.match($('liveStreamRemainingTime').textContent,/3:07/,'local Sync uses ClockTimer’s rounded Trip goal for the total target');
assert.equal($('liveStreamUserSync').textContent,'off','local Sync never changes user Sync');
$('liveStreamResetPercent').click();
assert.equal($('liveStreamRemoteTime').textContent,'USER EXACT TIME','reset restores exact mirror');
// Aggregation assertions use elapsed display independently of the remaining-time control.
$('liveStreamViewTime').value='elapsed';$('liveStreamViewTime').dispatchEvent(new w.Event('change'));
const tick=async()=>{for(let i=0;i<5;i++) await Promise.resolve();};
const select=async(mode)=>{$('liveStreamViewMode').value=mode;$('liveStreamViewMode').dispatchEvent(new w.Event('change'));await tick();};
await select('day'); assert.equal(requests.length,1);
assert.equal(requests[0].options.excludeTripId,19,'active trip excluded from persisted totals');
requests[0].resolve({standardTimeMilliseconds:600000,countedTimeMilliseconds:600000});await tick();
assert.match($('liveStreamRemoteTime').textContent,/15:00/,'active trip included exactly once');
assert.match($('liveStreamViewingMode').textContent,/Day.*2026-10-07/);
await select('week'); const old=requests.at(-1);
await select('year'); const recent=requests.at(-1);
old.resolve({standardTimeMilliseconds:1,countedTimeMilliseconds:9999999});await tick();
assert.equal($('liveStreamRemoteTime').textContent,'—','stale range request never updates current readout');
recent.resolve({standardTimeMilliseconds:600000,countedTimeMilliseconds:1200000});await tick();
assert.match($('liveStreamRemoteTime').textContent,/25:00/);
await select('custom'); assert.equal($('liveStreamViewStatus').textContent,'invalidRange');
$('liveStreamViewStart').value='2026-10-01'; $('liveStreamViewEnd').value='2026-10-02'; controller.select();await tick();
assert.equal(requests.at(-1).window.startTime,'2026-10-01T04:00:00.000Z');
assert.equal(requests.at(-1).window.endTime,'2026-10-03T03:59:59.999Z','custom end day is included');
requests.at(-1).resolve({standardTimeMilliseconds:120000,countedTimeMilliseconds:60000});await tick();
assert.match($('liveStreamRemoteTime').textContent,/1:00/,'active trip outside dates is excluded');
await select('month');requests.at(-1).reject(new Error('denied'));await tick();
assert.equal($('liveStreamRemoteTime').textContent,'—');assert.equal($('liveStreamViewStatus').textContent,'failed');
await select('week'); const leaving=requests.at(-1);controller.clear();leaving.resolve({standardTimeMilliseconds:1,countedTimeMilliseconds:99999});await tick();
assert.equal($('liveStreamRemoteTime').textContent,'—','closed or changed target cannot show late response');
assert.equal(JSON.stringify(snapshot),original,'viewer never mutates publisher mode or trip');
// Interval readouts follow the publisher, not the observer's goal/display choice.
controller.setUser(42);
const lunch = structuredClone(snapshot);
lunch.uiState.interval_state={intervalType:'lunch',breakType:'lunch',open:false,elapsedMilliseconds:300000,remainingMilliseconds:900000};
controller.update(lunch);
assert.equal($('liveStreamInterval').hidden,false,'timed intervals have open:false and must remain visible');
assert.equal($('liveStreamIntervalTime').textContent,'00:15:00');
controller.now=()=>Date.parse(lunch.timestamp)+901000;controller.renderInterval();
assert.equal($('liveStreamIntervalTime').textContent,'00:00:01');
assert.match($('liveStreamIntervalLabel').textContent,/overtime/,'late Lunch counts upward');
const down=structuredClone(snapshot);
down.uiState.interval_state={intervalType:'down',open:true,elapsedMilliseconds:120000};
controller.now=()=>Date.parse(down.timestamp)+3000;controller.update(down);
assert.equal($('liveStreamIntervalTime').textContent,'00:02:03');
$('liveStreamViewMode').value='trip';$('liveStreamViewPercent').value='120';$('liveStreamViewSync').value='off';
controller.setUser(43);
assert.equal($('liveStreamViewMode').value,'user');assert.equal($('liveStreamViewPercent').value,'');
controller.setUser(42);
assert.equal($('liveStreamViewMode').value,'trip');assert.equal($('liveStreamViewPercent').value,'120');
assert.equal($('liveStreamViewSync').value,'off','preferences are isolated by user');
assert.equal($('liveStreamInterval').hidden,true,'switching clears the previous interval');
await assert.rejects($('liveStreamClockTimer').persistCurrentTrip(),/Connect before saving/);
assert.equal(apiCalls,0,'observer controls and attempted persistence never access the API');
assert.equal(w.document.querySelectorAll('.live-stream-mirror clock-timer').length,1,'switching reuses one ClockTimer');
assert.equal(w.document.querySelector('.live-stream-mirror #tripListButton'),null,'mirror has no Trip Log button');
await w.happyDOM.close();
console.log('PASS independent Drop-In modes, custom dates, active trip deduplication, stale requests, errors and target cleanup');
