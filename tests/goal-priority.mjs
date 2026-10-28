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
 window.fetch=async(url)=>{const path=new URL(url,'https://clock.example/').pathname,data=path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}:path.endsWith('/command-check/')?{accepted:true}:{tripId:999,eventId:1,aggregateBreakdown:{production:{tripCount:1,standardTimeMilliseconds:1800000,actualTimeMilliseconds:1800000,countedTimeMilliseconds:1800000},nonProduction:{trips:[]}}};return{ok:true,status:200,json:async()=>data,clone(){return this}};};
 const timer=await fresh();await timer.connect('test','test');await timer.calculateTripTotals('2026-09-18T00:00:00Z','2026-09-20T00:00:00Z');timer.configure({goal_type:'auto',trip_goal:'100%',total_goal:'100%'});
 assert.equal(timer.getUIState().effective_goal_type,'total');assert.equal(timer.getUIState().auto_goal_order.join('_'),'total_trip_standard');assert.equal(timer.getSummarySnapshot().scope,'total','aggregate wins the three-way 100% tie');
 timer.setAttribute('end-time','12:30:00');assert.equal(timer.getUIState().effective_goal_type,'total','aggregate also wins an equal explicit end-time target');
 timer.configure({goal_type:'trip'});assert.equal(timer.getSummarySnapshot().scope,'trip','manual Trip keeps its identity at 100%');
 console.log('PASS aggregate > Trip > Standard equal-budget priority, including 100% and explicit-end ties');
}finally{for(const timer of timers)timer.remove();await window.happyDOM.close();}
