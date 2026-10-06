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
    assert.equal(counted(early),60000,'early start is counted from actual start');
    advance(10000);
    early.startTime='12:00:00';
    assert.equal(counted(early),10000,'editing actual start rebuilds the accumulated value');
    early.remove();

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
    advance(1000);
    assert.equal(counted(breakTimer),1000,'Early Start overwrite counts productive time after the break ends');
    breakTimer.remove();

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
        const data = path.endsWith('/users/')
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
    total.configure({goal_type:'auto',trip_goal:'110%'});
    assert.equal(total.getSummarySnapshot().scope,'total');
    total.configure({trip_goal:'125%'});
    assert.equal(total.getSummarySnapshot().scope,'trip');
    assert.equal(counted(total),600000,'goal selection does not reset counted time');
    total.remove();
    console.log('PASS counted accounting: delayed/repeated ticks, no visual rings, pauses, approvals, cancel, start edits, stop/reset, early break, and Total goal');
}
finally {
    for (const timer of timers) timer.remove();
    await window.happyDOM.close();
}
