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
 window.fetch=async(url)=>{const path=new URL(url,'https://clock.example/').pathname;const data=path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}:path.endsWith('/command-check/')?{accepted:true}:{tripId:999,eventId:1,aggregateBreakdown:{production:{tripCount:1,standardTimeMilliseconds:176000,actualTimeMilliseconds:528695,countedTimeMilliseconds:0,productiveTimeMilliseconds:289957,allowanceCreditMilliseconds:1013189,bankCreditCarryMilliseconds:723232},nonProduction:{trips:[]}}};return{ok:true,status:200,json:async()=>data,clone(){return this}};};
 const timer=await fresh({standardTime:'0:10:00'});await timer.connect('test','test');await timer.calculateTripTotals('2026-09-18T00:00:00Z','2026-09-20T00:00:00Z');timer.configure({goal_type:'total',total_goal:'100%',goal_bounding:false});
 const snapshot=timer.getSummarySnapshot();assert.equal(snapshot.trip.allottedTimeMilliseconds,1463415,'next trip budget uses the rounded-up inferred 41% goal after applying bank surplus');assert.equal(snapshot.total.remainingTimeMilliseconds,1499232,'remaining budget includes prior credit exactly once');assert.equal(timer.getGoalEditorSnapshot('total').inferred_percent,41,'inferred goal rounds up conservatively after adding bank credit');
 console.log('PASS restored aggregate bank surplus extends the next trip budget once and updates inferred goal');
} finally {for(const timer of timers)timer.remove();await window.happyDOM.close();}
