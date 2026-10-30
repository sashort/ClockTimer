import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({url:'https://clock.example/'});
const epoch = Date.parse('2026-09-19T12:00:00Z');
window.__testTime = epoch;
window.eval(`const AccountingDate=Date; window.Date=class extends AccountingDate {
    constructor(...args){super(...(args.length?args:[window.__testTime]));}
    static now(){return window.__testTime;}
};`);
const css=window.CSS; css.registerProperty=()=>{}; Object.defineProperty(window,"CSS",{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.structuredClone=globalThis.structuredClone;
window.Element.prototype.animate = () => ({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
for (const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer']) {
    window.eval(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'));
}
const timers = [];
async function fresh({testEpoch=epoch,...options}={}) {
    window.__testTime = testEpoch;
    const timer = window.document.createElement('clock-timer');
    window.document.body.append(timer);
    timer.configure({goal_type:'trip',trip_goal:'125%',rendered_time_type:'time_remaining'});
    await timer.start({standardTime:'0:30:00',...options});
    timers.push(timer);
    return timer;
}
const advance = milliseconds => window.__testTime += milliseconds;
const counted = timer => timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds;
try {
    const normal = await fresh();
    advance(600000);
    assert.equal(counted(normal),600000,'a delayed tick accounts for the whole elapsed interval');
    assert.equal(counted(normal),600000,'repeated reads do not count time twice');
    const before = normal.getSummarySnapshot();
    for (const ring of normal.querySelectorAll('ring-container')) ring.remove();
    const after = normal.getSummarySnapshot();
    assert.equal(after.trip.countedTimeElapsedMilliseconds,before.trip.countedTimeElapsedMilliseconds);
    assert.equal(after.trip.renderedTime,before.trip.renderedTime,'remaining does not depend on visual ranges');
    assert.equal(normal.startTime,'12:00:00','actual start survives removal of visual ranges');
    advance(1500);
    assert.equal(counted(normal),601500,'accounting preserves milliseconds');
    normal.configure({rendered_time_type:'calculated_start_time'});
    assert.equal(normal.uiState.time_component.value,601500,'elapsed uses the same authoritative counted time');
    normal.remove();
    const autoStandard = await fresh();
    autoStandard.configure({goal_type:'auto',trip_goal:'80%'});
    assert.equal(autoStandard.getUIState().effective_goal_type,'trip');
    assert.equal(autoStandard.getUIState().goal_component.value,1,'bounded Trip retains priority over Standard at the same 100% target');
    autoStandard.remove();

    const down = await fresh();
    advance(10000);
    await down.startInterval('down');
    advance(60000);
    assert.equal(counted(down),10000,'open Down freezes counted time without waiting for a tick');
    await down.endInterval();
    advance(5000);
    assert.equal(counted(down),15000,'ending Down resumes immediately');
    const downRange = down.querySelector('time-range[type="down"]');
    await down.setIntervalApproval(downRange,'0:00:30');
    assert.equal(counted(down),45000,'approval edits rebuild prior accounting');
    await down.setIntervalApproval(downRange,'0:01:30');
    assert.equal(counted(down),10000,'approval surplus excludes its credited future interval');
    down.remove();

    const cancel = await fresh();
    advance(10000);
    await cancel.startInterval('down');
    advance(30000);
    assert.equal(counted(cancel),10000);
    await cancel.cancelInterval();
    assert.equal(counted(cancel),40000,'cancel removes the prior exclusion');
    cancel.remove();

    const early = await fresh({startTime:'11:59:00'});
    assert.equal(counted(early),0,'early work does not count before the scheduled boundary');
    advance(10000);
    early.startTime='12:00:00';
    assert.equal(counted(early),10000,'editing actual start rebuilds the accumulated value');
    early.remove();

    const scheduled=await fresh({scheduledStart:'12:10:00',startTime:'12:00:00'});
    assert.equal(counted(scheduled),0,'running trip counts nothing before scheduled start');
    scheduled.configure({rendered_time_type:'calculated_end_time'});
    const scheduledExpectedEnd=scheduled.getSummarySnapshot().trip.renderedTime;
    scheduled.configure({rendered_time_type:'calculated_start_time'});
    assert.equal(scheduled.uiState.time_component.value,0,'Time Elapsed is zero before scheduled start');
    assert.equal(scheduled.getSummarySnapshot().trip.renderedTime,'0:00:00');
    scheduled.configure({rendered_time_type:'time_remaining'});
    advance(5*60000);assert.equal(counted(scheduled),0);
    advance(5*60000);assert.equal(counted(scheduled),0,'scheduled start itself has zero elapsed counted time');
    advance(60000);assert.equal(counted(scheduled),60000,'only work after scheduled start is counted');
    scheduled.configure({rendered_time_type:'calculated_end_time'});
    assert.equal(scheduled.getSummarySnapshot().trip.renderedTime,scheduledExpectedEnd,'expected end stays unchanged as counted elapsed crosses scheduled start');
    scheduled.configure({rendered_time_type:'calculated_start_time'});
    assert.equal(scheduled.uiState.time_component.value,60000,'Time Elapsed counts only the minute after scheduled start');
    assert.equal(scheduled.getSummarySnapshot().trip.renderedTime,'0:01:00');
    scheduled.configure({rendered_time_type:'time_remaining'});
    assert.equal(scheduled.getSummarySnapshot().trip.actualTimeElapsedMilliseconds,11*60000,'actual elapsed still includes the early start');
    await scheduled.stop();assert.equal(counted(scheduled),60000,'completed trip crossing scheduled start excludes its early portion');
    const scheduledSnapshot=scheduled.captureState();scheduled.restoreState(scheduledSnapshot);
    assert.equal(counted(scheduled),60000,'scheduled boundary survives replay');scheduled.remove();

    const allEarly=await fresh({scheduledStart:'12:10:00',startTime:'12:00:00'});
    allEarly.configure({rendered_time_type:'calculated_start_time'});
    advance(5*60000);assert.equal(counted(allEarly),0,'running early trip remains uncounted');
    assert.equal(allEarly.getSummarySnapshot().trip.renderedTime,'0:00:00');
    await allEarly.stop();assert.equal(counted(allEarly),5*60000,'trip completed before scheduled start falls back to actual start');
    assert.equal(allEarly.getSummarySnapshot().trip.renderedTime,'0:05:00','completed-early Time Elapsed uses actual-start fallback');
    const earlySnapshot=allEarly.captureState();allEarly.restoreState(earlySnapshot);
    assert.equal(counted(allEarly),5*60000,'completed-early exception survives replay');allEarly.remove();

    const earlyWithExclusions=await fresh({scheduledStart:'12:30:00',startTime:'12:00:00'});
    advance(10*60000);await earlyWithExclusions.startInterval('break',15*60000,{breakType:'break'});
    advance(5*60000);await earlyWithExclusions.endInterval();advance(5*60000);await earlyWithExclusions.stop();
    assert.equal(counted(earlyWithExclusions),5*60000,'completed-early fallback still applies factual exclusions and full unused-break credit');
    earlyWithExclusions.remove();

    const boundary=await fresh({scheduledStart:'12:10:00',startTime:'12:00:00'});
    advance(10*60000);await boundary.stop();
    assert.equal(counted(boundary),0,'ending exactly at scheduled start does not use the before-start exception');boundary.remove();

    const late = await fresh({startTime:'12:01:00'});
    advance(90000);
    assert.equal(counted(late),90000,'late-start time remains counted');
    late.remove();

    const stopped = await fresh();
    advance(60000);
    await stopped.stop('12:01:00');
    advance(30000);
    assert.equal(counted(stopped),60000,'stopped trips do not keep accumulating');
    await stopped.clear();
    await stopped.start({standardTime:'0:10:00'});
    assert.equal(counted(stopped),0,'a new trip resets accounting');
    stopped.remove();

    const breakTimer = await fresh();
    breakTimer.configure({trip_goal:'100%'});
    await breakTimer.startInterval('break',600000,{breakType:'short'},150000,150000);
    advance(12000);
    await breakTimer.endInterval();
    assert.equal(counted(breakTimer),0,'early-ended break is not retroactively counted');
    const creditedRemaining=breakTimer.getSummarySnapshot().trip.renderedTime;
    advance(1000);
    assert.equal(counted(breakTimer),0,'unused credit carries forward until productive time consumes it');
    assert.notEqual(breakTimer.getSummarySnapshot().trip.renderedTime,creditedRemaining,'Time Remaining retains its independent existing countdown after early break');
    breakTimer.remove();

    const gained = await fresh();
    gained.configure({trip_goal:'100%'});
    advance(20*60000);
    await gained.startInterval('break',15*60000,{breakType:'break'});
    advance(5*60000);
    await gained.endInterval();
    const gainSummary=gained.getSummarySnapshot();
    assert.equal(gainSummary.trip.renderedTime,'0:20:00','unused ten minutes immediately extend remaining time');
    assert.equal(gainSummary.trip.countedTimeElapsedMilliseconds,10*60000,'full unused allowance reduces counted time immediately');
    assert.equal(gainSummary.trip.countedPercent,2,'(30 Standard + 10 earned credit) / 20 productive minutes');
    assert.equal(gainSummary.total.renderedTime,'0:20:00','Total receives the same early-break credit');
    assert.equal(gainSummary.trip.allowanceCreditMilliseconds,10*60000);
    gained.renderedTimeMode='elapsed';
    assert.equal(gained.getUIState().time_component.value,20*60000,'elapsed is productive time, not productive time minus credit');
    assert.equal(gained.getSummarySnapshot().trip.renderedTime,'0:20:00','summary elapsed agrees with live elapsed');
    assert.equal(gained.getGoalBarSnapshot().nodes.find(n=>n.id==='standard').time,'0:40:00','Standard elapsed target includes earned allowance');
    gained.renderedTimeMode='remaining';
    const snapshot=gained.captureState();const factualEvents=JSON.stringify(snapshot.events);
    gained.restoreState(snapshot);
    assert.equal(gained.getSummarySnapshot().trip.renderedTime,'0:20:00','restored event model retains full early-break credit');
    assert.equal(counted(gained),10*60000);
    assert.equal(JSON.stringify(gained.captureState().events),factualEvents,'accounting credit never rewrites factual break events');
    const activeLog=gained.getLocalTripLog().find(trip=>trip.running);
    assert.equal(activeLog.allowanceCreditMilliseconds,10*60000,'offline active Trip Log receives the credit');
    gained.renderedTimeMode='elapsed';
    advance(15*60000);await gained.stop();
    assert.equal(counted(gained),25*60000,'completed counted time retains the full unused allowance');
    assert.equal(gained.getSummarySnapshot().trip.countedPercent,40/35);
    assert.equal(gained.getSummarySnapshot().trip.renderedTime,'0:35:00','completed elapsed preserves productive time independently of credit');
    gained.remove();

    const creditFirst=await fresh();creditFirst.configure({trip_goal:'100%'});
    await creditFirst.startInterval('break',15*60000,{breakType:'break'});advance(5*60000);await creditFirst.endInterval();
    assert.equal(creditFirst.getSummarySnapshot().trip.renderedTime,'0:40:00','credit larger than prior productive time is carried without losing remaining time');
    assert.equal(counted(creditFirst),0,'persisted counted time remains nonnegative');
    assert.equal(creditFirst.getSummarySnapshot().total.renderedTime,'0:40:00');
    creditFirst.configure({external_standard_time:3600000,external_counted_time:3600000,total_goal:'100%'});
    assert.equal(creditFirst.getSummarySnapshot().total.countedTimeElapsedMilliseconds,60*60000,'Total keeps productive history separate from earned credit');
    assert.equal(creditFirst.getSummarySnapshot().total.countedPercent,100/60);
    assert.equal(creditFirst.getSummarySnapshot().total.renderedTime,'0:40:00');
    assert(creditFirst.getGoalBarSnapshot().nodes.find(n=>n.current).unbounded,'surplus credit retains Current at right edge');
    assert.equal(creditFirst.getUIState().time_component.text,'0:40:00','live remaining includes surplus credit');
    creditFirst.renderedTimeMode='elapsed';
    assert.equal(creditFirst.getUIState().time_component.value,0,'zero productive time displays zero, not a negative bank');
    advance(1000);
    assert.equal(creditFirst.getUIState().time_component.value,1000,'elapsed starts ticking immediately instead of clamping until credit is consumed');
    assert.equal(creditFirst.getSummarySnapshot().trip.renderedTime,'0:00:01');
    creditFirst.renderedTimeMode='remaining';
    advance(11*60000);
    assert(creditFirst.getGoalBarSnapshot().nodes.find(n=>n.current).percent>0,'Current returns to finite percentage after credit is consumed');
    creditFirst.remove();

    const bufferedCredit=await fresh();
    bufferedCredit.configure({trip_goal:'125%'});advance(20*60000);
    await bufferedCredit.startInterval('lunch',15*60000,{breakType:'lunch'},150000,150000);
    advance(5*60000);await bufferedCredit.endInterval();
    assert.equal(bufferedCredit.getSummarySnapshot().trip.allowanceCreditMilliseconds,15*60000,'unused scheduled buffers and lunch allowance are credited once');
    assert.equal(counted(bufferedCredit),5*60000);
    assert.equal(bufferedCredit.getSummarySnapshot().trip.renderedTime,'0:16:00','earned Standard plus credit is divided by the percentage goal');
    bufferedCredit.remove();

    const onTimeBreak=await fresh();onTimeBreak.configure({trip_goal:'100%'});advance(20*60000);
    await onTimeBreak.startInterval('break',15*60000,{breakType:'break'});advance(15*60000);await onTimeBreak.endInterval();
    assert.equal(onTimeBreak.getSummarySnapshot().trip.allowanceCreditMilliseconds,0);
    assert.equal(counted(onTimeBreak),20*60000,'full-length breaks do not receive an early-ending credit');
    onTimeBreak.remove();

    const overnight = await fresh({testEpoch:Date.parse('2026-09-19T23:59:00Z')});
    advance(10000);
    await overnight.startInterval('down');
    advance(120000);
    assert.equal(counted(overnight),10000,'midnight does not move interval accounting to a different day');
    await overnight.endInterval();
    advance(1000);
    assert.equal(counted(overnight),11000,'counting resumes on the following day');
    overnight.remove();

    const total = await fresh();
    window.fetch = async (url) => {
        const path = new URL(url,'https://clock.example/').pathname;
        const data = path.endsWith('/command-check/') ? {accepted:true} : path.endsWith('/users/')
            ? {csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}
            : {tripId:999,eventId:1,aggregateBreakdown:{production:{tripCount:2,
                standardTimeMilliseconds:5400000,
                actualTimeMilliseconds:4800000,
                countedTimeMilliseconds:4800000},nonProduction:{trips:[]}}};
        return {ok:true,status:200,json:async()=>data,clone(){return this;}};
    };
    await total.connect('test','test');
    await total.calculateTripTotals('2026-09-18T00:00:00Z','2026-09-20T00:00:00Z');
    total.configure({goal_type:'total',total_goal:'120%',external_standard_time:5400000,external_counted_time:4800000});
    advance(600000);
    const summary = total.getSummarySnapshot();
    assert.equal(summary.total.standardTimeMilliseconds,7200000);
    assert.equal(summary.total.countedTimeElapsedMilliseconds,5400000);
    assert.equal(summary.total.renderedTime,'0:10:00');
    assert.equal(summary.trip.allottedTimeMilliseconds,1200000,'Total derives a 20-minute current-trip budget');
    assert.equal(total.getUIState().goal_component.value,1.2,'manual aggregate mode keeps its aggregate target');
    total.configure({goal_type:'auto',trip_goal:'110%'});
    assert.equal(total.getUIState().goal_component.value,1.5,'Auto renders 150% trip requirement for the 120% aggregate target');
    assert.equal(total.getUIState().goal_component.text,'150%');
    assert.equal(total.getSummarySnapshot().scope,'total');
    total.configure({trip_goal:'125%'});
    assert.equal(total.getSummarySnapshot().scope,'total','20-minute Total budget precedes the 24-minute Trip budget despite its higher percentage');
    total.configure({trip_goal:'160%'});
    assert.equal(total.getSummarySnapshot().scope,'trip','18.75-minute Trip budget now precedes the 20-minute Total budget');
    assert.equal(total.getUIState().goal_component.value,1.6,'Auto Trip renders the selected trip target');
    assert.equal(counted(total),600000,'goal selection does not reset counted time');
    let latestGoalState;
    total.addEventListener('uiStateChanged',event=>{latestGoalState=event.detail;});
    for(const [type,expectedGoals,resumed] of [['down',[['125%',1.88,'188%'],['120%',1.5,'150%']],1.5],['break',[['125%',1.88,'188%'],['120%',1.5,'150%']],1.42],['lunch',[['125%',1.67,'167%'],['120%',1.42,'142%']],1.37]]) {
        await total.startInterval(type,type==='down'?undefined:600000,{breakType:type});
        for(const [target,required,text] of expectedGoals) {
            total.configure({trip_goal:'110%',total_goal:target});
            assert.equal(total.getUIState().effective_goal_type,'total',type+' retains aggregate Auto target');
            assert.equal(total.getUIState().goal_component.value,required,type+' recalculates trip requirement immediately');
            assert.equal(latestGoalState.goal_component.text,text,type+' publishes the recalculated display without waiting for time to resume');
            assert.equal(total.getUIState().total_goal_component.text,target,type+' keeps the overarching editor goal separate');
        }
        await total.endInterval();
        assert.equal(total.getUIState().goal_component.value,resumed,type+' resume credits unused allowance and recalculates the requirement');
    }
    total.remove();
    console.log('PASS goal changes refresh Auto requirement during Down, Break and Lunch and after resume');
    console.log('PASS counted accounting: delayed/repeated ticks, no visual rings, pauses, approvals, cancel, start edits, stop/reset, early break, and Total goal');
}
finally {
    for (const timer of timers) timer.remove();
    await window.happyDOM.close();
}
