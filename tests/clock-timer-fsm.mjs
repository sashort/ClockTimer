import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const epoch = Date.parse('2026-09-19T12:00:00Z');
const orderings = [
    [1.4,1.2,'trip_total_standard'], [1.2,.8,'trip_standard_total'],
    [1.2,1.4,'total_trip_standard'], [.8,1.2,'total_standard_trip'],
    [.9,.8,'standard_trip_total'], [.8,.9,'standard_total_trip'],
    [1,1,'trip_total_standard'], [1.2,1.2,'trip_total_standard'],
    [.8,1,'total_standard_trip']
];

async function exercise(core, checkFSM) {
    const window = new Window({url:'https://clock.example/'});
    window.__testTime = epoch;
    window.eval(`const FSMDate=Date; window.Date=class extends FSMDate {
        constructor(...args){super(...(args.length?args:[window.__testTime]));}
        static now(){return window.__testTime;}
    };`);
    const css=window.CSS; css.registerProperty=()=>{};
    Object.defineProperty(window,'CSS',{value:css});
    Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
    Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
    window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
    let eventId=1;
    window.fetch=async(url)=>{
        const path=new URL(url,'https://clock.example/').pathname;
        const data=path.endsWith('/users/')
            ? {csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}
            : {tripId:999,eventId:eventId++,trips:[],aggregateBreakdown:{production:{tripCount:2,
                standardTimeMilliseconds:5400000,actualTimeMilliseconds:4800000,
                countedTimeMilliseconds:4800000},nonProduction:{trips:[]}}};
        return {ok:true,status:200,json:async()=>data,clone(){return this;}};
    };
    for (const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement']) {
        window.eval(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'));
    }
    window.eval(core);
    const results=[];
    const timers=[];
    const capture=(timer,label)=>{
        const summary=timer.getSummarySnapshot();
        results.push({label,scope:summary.scope,goal:timer.renderedPercentGoal,
            calculated:timer.calculatedTripGoal??null,
            trip:summary.trip,total:summary.total,
            time:['elapsed','remaining','calculated-end'].map(mode=>timer.getRenderedTime(mode,new window.Date())),
            ranges:[...timer.querySelectorAll('time-range')].map(range=>({
                type:range.getAttribute('type'),start:range.clockTimerStart,end:range.clockTimerEnd,
                planned:range.clockTimerPlanned??null
            }))});
    };
    try {
        for (const [trip,total,order] of orderings) for (const sync of [false,true]) {
            window.__testTime=epoch;
            const timer=window.document.createElement('clock-timer');
            window.document.body.append(timer); timers.push(timer);
            await timer.connect('test','test');
            await timer.calculateTripTotals('2026-09-18T00:00:00Z','2026-09-20T00:00:00Z');
            timer.configure({goal_type:'auto',trip_goal:`${trip*100}%`,total_goal:`${total*100}%`});
            timer.autoSyncTripGoal=sync;
            await timer.start({standardTime:'0:30:00'});
            const activeTrip=sync?timer.calculatedTripGoal:trip;
            const expectedOrder=['trip','total','standard'].sort((a,b)=>
                ({trip:activeTrip,total,standard:1})[b]-({trip:activeTrip,total,standard:1})[a]).join('_');
            assert.equal(timer.getSummarySnapshot().scope,expectedOrder.split('_')[0]);
            if (checkFSM) {
                const flags=timer.getDispatchState(new window.Date());
                assert(Object.isFrozen(flags));
                assert.equal(flags.percentageOrder,sync?expectedOrder:order);
                assert.equal(flags.state,'running');
                assert.equal(flags.sync,sync?'on':'off');
                assert.equal(flags.startRelation,'on_time');
                assert.equal(flags.goalProgress,'before');
            }
            capture(timer,`${order}/${sync}/start`);
            window.__testTime+=60000;
            for (const mode of ['trip','total','auto']) {
                timer.configure({goal_type:mode});
                assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,60000);
                capture(timer,`${order}/${sync}/${mode}`);
            }
            timer.setAttribute('timer-type','radial-fitted');
            if(checkFSM) assert.equal(timer.getDispatchState(new window.Date()).ringLayout,'fit');
            capture(timer,`${order}/${sync}/fit`);
            timer.setAttribute('timer-type','radial-overflow');
            capture(timer,`${order}/${sync}/overflow`);
            await timer.startInterval('down');
            window.__testTime+=30000;
            if(checkFSM) {
                assert.equal(timer.getDispatchState(new window.Date()).state,'down');
                assert.equal(timer.getDispatchState(new window.Date()).intervalStatus,'open');
            }
            assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,60000);
            capture(timer,`${order}/${sync}/down`);
            await timer.cancelInterval();
            assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,90000);
            if(checkFSM) assert.equal(timer.getDispatchState(new window.Date()).state,'running');
            capture(timer,`${order}/${sync}/cancel`);
            await timer.stop();
            if(checkFSM) assert.equal(timer.getDispatchState(new window.Date()).state,'stopped');
            await timer.clear();
            if(checkFSM) assert.equal(timer.getDispatchState(new window.Date()).state,'ready');
            timer.remove();
        }
        // A Total goal with a negative current-trip budget cannot win Auto.
        window.__testTime=epoch;
        const unavailable=window.document.createElement('clock-timer');
        timers.push(unavailable); window.document.body.append(unavailable);
        await unavailable.connect('test','test');
        await unavailable.calculateTripTotals('2026-09-18T00:00:00Z','2026-09-20T00:00:00Z');
        unavailable.configure({goal_type:'auto',trip_goal:'110%',total_goal:'200%'});
        await unavailable.start({standardTime:'0:30:00'});
        assert.equal(unavailable.getSummarySnapshot().scope,'trip');
        capture(unavailable,'unattainable-total');
        unavailable.remove();
        if (checkFSM) {
            window.__testTime=epoch;
            const phases=window.document.createElement('clock-timer');
            timers.push(phases);window.document.body.append(phases);
            assert.equal(phases.getDispatchState(new window.Date()).state,'ready');
            phases.configure({goal_type:'trip',trip_goal:'100%'});
            await phases.start({standardTime:'0:30:00',startTime:'11:59:00'});
            assert.equal(phases.getDispatchState(new window.Date()).startRelation,'early');
            phases.startTime='12:01:00';
            assert.equal(phases.getDispatchState(new window.Date()).startRelation,'late');
            phases.startTime='12:00:00';
            await phases.startInterval('break',60000,{breakType:'short'},15000,15000);
            assert.equal(phases.getDispatchState(new window.Date()).state,'buffer');
            window.__testTime+=20000;
            assert.equal(phases.getDispatchState(new window.Date()).state,'break');
            await phases.endInterval();
            assert.equal(phases.getDispatchState(new window.Date()).state,'running');
            await phases.stop();
            await phases.clear();
            window.__testTime=epoch;
            await phases.start({standardTime:'0:30:00'});
            for (const [type,display] of [['time_remaining','remaining'],['calculated_start_time','elapsed'],['calculated_end_time','end']]) {
                phases.configure({rendered_time_type:type});
                assert.equal(phases.getDispatchState(new window.Date()).timeDisplay,display);
            }
            window.__testTime=epoch+1800000;
            assert.equal(phases.getDispatchState(new window.Date()).goalProgress,'at');
            window.__testTime++;
            assert.equal(phases.getDispatchState(new window.Date()).goalProgress,'past');
            await phases.stop();
            await phases.clear();
            assert.equal(phases.getDispatchState(new window.Date()).state,'ready');
            phases.remove();
        }
        return results;
    } finally {
        for(const timer of timers) timer.remove();
        await window.happyDOM.close();
    }
}

const results=await exercise(fs.readFileSync(new URL('../ClockTimer.js',import.meta.url),'utf8'),true);
if(process.env.CLOCK_TIMER_BASELINE) {
    const baseline=await exercise(fs.readFileSync(process.env.CLOCK_TIMER_BASELINE,'utf8'),false);
    const normalize = value => JSON.parse(JSON.stringify(value));
    for (let index=0; index<results.length; index++) {
        assert.deepEqual(normalize(results[index]),normalize(baseline[index]),`FSM snapshot ${results[index].label}`);
    }
    console.log(`PASS ${results.length} FSM snapshots match the previous implementation`);
}
console.log('PASS all six percentage orders, ties, Sync on/off, Trip/Total/Auto, unavailable candidates, fit/overflow, Down and reset');
