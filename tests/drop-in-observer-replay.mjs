import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installAsyncStorage} from './async-storage-fixture.mjs';
const window = new Window({url: 'https://clock.example/'});
installAsyncStorage(window);
const css = window.CSS; css.registerProperty = () => {}; Object.defineProperty(window, 'CSS', {value: css});
Object.defineProperty(window, 'AbortController', {value: globalThis.AbortController});
Object.defineProperty(window, 'AbortSignal', {value: globalThis.AbortSignal});
window.Element.prototype.animate = () => ({finished: Promise.resolve(), cancel(){}, finish(){}, play(){}, pause(){}, effect:{getComputedTiming(){return {progress:1};}}});
window.__testTime = Date.parse('2026-10-06T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
let serverCalls=0;let fail, eventId = 1, tripId = 100;
window.fetch = async (url, options={}) => {
    serverCalls++;await new Promise(setImmediate);
    const path = new URL(url, window.location.href).pathname;
    const body = options.body ? JSON.parse(options.body) : {};
    const rejected = options.method === 'POST' && (fail === 'trip' && path.endsWith('/trips/') || fail && fail === body.event);
    const data = path.endsWith('/command-check/') ? {accepted:true} : rejected ? {message:'Rejected'} : path.endsWith('/users/') ? {csrfToken:'a'.repeat(64),user:{id:2}} :
        path.endsWith('/trips/') && options.method === 'POST' ? {tripId:tripId++} :
        path.endsWith('/trip-events/') ? {eventId:eventId++} : {};
    return {ok:!rejected,status:rejected?500:200,json:async()=>data,clone(){return this;}};
};
for (const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer','StateTransactions','ActionFunctions']) {
    window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
}
// Native CSS style changes do not call a custom element's setAttribute override.
// HappyDOM does; keep geometry updates native while retaining data mutation guards.
const rangePrototype=window.customElements.get('time-range').prototype;
const setRangeAttribute=rangePrototype.setAttribute;
rangePrototype.setAttribute=function(name,value){
 return name==='style' ? window.HTMLElement.prototype.setAttribute.call(this,name,value)
  : setRangeAttribute.call(this,name,value);
};
const timer = window.document.createElement('clock-timer'); window.document.body.append(timer);
await timer.connect('test','test');


await timer.start({standardTimeMilliseconds:3600000});
window.__testTime+=60000;await timer.startInterval('down');
const observer=window.document.createElement('clock-timer');window.document.body.append(observer);observer.enableObserverMode();
let loaded=0;observer.addEventListener('tripLoaded',()=>loaded++);
const apply=(model,options={})=>observer.applyObserverSnapshot(model,{now:new window.Date(),...options});
const open=timer.exportObserverSnapshot();apply(open);
assert.equal(observer.getActiveIntervalState(new window.Date()).intervalType,'down');
assert.equal(loaded,1);
window.__testTime+=60000;await timer.endInterval(new window.Date());
window.__testTime+=1000;
const ended=timer.exportObserverSnapshot();const original=JSON.stringify(ended);
apply(ended);assert.equal(loaded,2,'ending Down Time applies the changed model once');
assert.notEqual(observer.getActiveIntervalState(new window.Date())?.intervalType,'down');
const elapsed=observer.getSummarySnapshot(new window.Date()).trip.countedTimeElapsedMilliseconds;
for(let i=0;i<5;i++){
 window.__testTime+=1000;apply(structuredClone(ended));
 assert.equal(loaded,2,'unchanged completed Down Time must not rebuild the dial');
 assert.equal(observer.getSummarySnapshot(new window.Date()).trip.countedTimeElapsedMilliseconds,elapsed+(i+1)*1000,'running trip continues after Down Time');
}
const calls=serverCalls;apply(ended,{mode:'total',goal:125,goalScope:'total',sync:false});
assert.equal(loaded,2,'local mode and goal adjustments preserve interval renderers');
assert.equal(observer.percentMode,'total');
assert.equal(serverCalls,calls,'observer snapshots and controls never persist');
assert.equal(JSON.stringify(ended),original,'observer never changes publisher events');
const checkpoint=observer.captureState();observer.restoreState(checkpoint);apply(ended);
assert.equal(loaded,3,'a separate restore invalidates the incoming model cache');
window.__testTime+=1000;await timer.startInterval('down');apply(timer.exportObserverSnapshot());
assert.equal(loaded,4,'a later Down Time still loads');
assert.equal(observer.getActiveIntervalState(new window.Date()).intervalType,'down');
window.__testTime+=1000;await timer.endInterval(new window.Date());const next=timer.exportObserverSnapshot();apply(next);apply(next);
assert.equal(loaded,5,'a later completed interval applies once');
const ranges=timer.querySelectorAll('time-range[type="down"]');
await timer.setIntervalApproval(ranges[ranges.length-1],'0:01:30');
const approved=timer.exportObserverSnapshot();apply(approved);apply(approved);
assert.equal(loaded,6,'approval changes replay once');
assert.equal(observer.getSummarySnapshot(new window.Date()).trip.countedTimeElapsedMilliseconds,
 timer.getSummarySnapshot(new window.Date()).trip.countedTimeElapsedMilliseconds,'mirror preserves surplus approval credit after a closed open interval');
await window.happyDOM.close();
console.log('PASS Drop-In completed Down Time preserves the dial across snapshots, time, local controls and later intervals');
