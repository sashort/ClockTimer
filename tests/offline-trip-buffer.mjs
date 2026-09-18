import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/',settings:{disableJavaScriptEvaluation:true}});
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
window.__testTime=Date.parse('2026-09-18T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
let offline=false, userId=2, nextTripId=100, interruptStop=false;
const trips=new Map(), events=new Map(), tokens=new Map(), requests=[];
window.fetch=async(url,options={})=>{
    if(offline)throw new TypeError('Offline');
    const path=new URL(url,'https://clock.example/').pathname;
    const body=options.body?JSON.parse(options.body):{};
    requests.push({path,options,body});
    let data={};
    if(path.endsWith('/users/'))data={csrfToken:'a'.repeat(64),user:{id:userId,username:'test'}};
    else if(path.endsWith('/trips/')&&options.method==='POST'){
        const id=tokens.get(body.clientToken)||nextTripId++;
        tokens.set(body.clientToken,id);
        if(!trips.has(id))trips.set(id,{...body,id,userId});
        data={tripId:id};
    }else if(path.endsWith('/trips/')&&options.method==='PATCH'){
        if(body.action==='stop'&&interruptStop){interruptStop=false;throw new TypeError('Lost stop response');}
        Object.assign(trips.get(body.tripId),body);
        data={tripId:body.tripId};
    }else if(path.endsWith('/trip-events/')&&options.method==='POST'){
        if(!events.has(body.clientToken))events.set(body.clientToken,{...body,id:events.size+1});
        data={eventId:events.get(body.clientToken).id};
    }else if(path.endsWith('/trips/'))data={trips:[...trips.values()]};
    return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data),clone(){return this;}};
};
for(const name of ['TemporalFormat','RingContainer','TimeRange','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const storageKey='test.completedTrips';
function clock(){const c=window.document.createElement('clock-timer');c.setAttribute('offline-trip-storage-key',storageKey);window.document.body.append(c);return c;}
let c=clock();await c.connect('test','test');
async function complete(standard,minutes){
    const prepared=await c.prepareTrip();
    await c.start({standardTime:standard});
    window.__testTime+=minutes*60000;
    await c.stop();
    const result=await c.resetCompletedTrip();
    assert.equal(result.synced,false);
    assert.equal(c.status,'ready');
    assert.equal(c.currentTripId,undefined);
}
offline=true;
await complete('20:00',8);
await complete('30:00',12);
let queue=JSON.parse(window.localStorage.getItem(storageKey));
assert.equal(queue.length,2);
assert.equal(c.getLocalTripLog().length,2);
const localTotals=c.calculateOfflineTripTotals(c.getLocalTripLog(),'2026-09-18T00:00:00Z','2026-09-19T00:00:00Z');
assert.equal(localTotals.standardTimeMilliseconds,3000000);
assert.equal(localTotals.actualTimeMilliseconds,1200000);
assert.equal(localTotals.tripCount,2);
assert.notEqual(queue[0].payload.clientToken,queue[1].payload.clientToken);
assert.deepEqual(queue.map(t=>t.events.map(e=>e.event)),[['trip.started','trip.stopped'],['trip.started','trip.stopped']]);
console.log('PASS two trips complete offline, clear independently, and buffer separate identities and events');

c.remove();c=clock();
assert.equal(c.status,'ready');
assert.equal(c.getLocalTripLog().length,2);
offline=false;userId=3;await c.connect('other','test');
assert.equal(trips.size,0);
assert.equal(JSON.parse(window.localStorage.getItem(storageKey)).length,2);
console.log('PASS refreshed clock restores the queue and never uploads it to a different account');

userId=2;interruptStop=true;
await assert.rejects(()=>c.connect('test','test'));
assert.equal(events.size,2);
assert.equal(JSON.parse(window.localStorage.getItem(storageKey)).length,2);
// Refresh again after the stop event was accepted but the timing PATCH failed.
c.remove();c=clock();await c.connect('test','test');
assert.equal(trips.size,2);
assert.equal(events.size,4);
assert.equal(JSON.parse(window.localStorage.getItem(storageKey)).length,0);
assert.deepEqual([...trips.values()].map(t=>[t.standardTimeMilliseconds,t.countedTimeMilliseconds]),[[1200000,480000],[1800000,720000]]);
for(const trip of trips.values()){
    const tripEvents=[...events.values()].filter(e=>e.tripId===trip.id);
    assert.equal(tripEvents.filter(e=>e.event==='trip.started').length,1);
    assert.equal(tripEvents.filter(e=>e.event==='trip.stopped').length,1);
}
await c.connect('test','test');
assert.equal(events.size,4);
assert.equal(trips.size,2);
assert.equal(requests.filter(r=>r.options.method==='DELETE').length,0);
console.log('PASS reconnect after interrupted completion uploads both trips once with original timing and no DELETE');

// A new active trip must not acquire any events from the completed queue.
offline=true;await complete('40:00',16);
const prepared=await c.prepareTrip();
await c.start({standardTime:'50:00'});
assert.notEqual(c.status,'ready');
offline=false;await c.connect('test','test');
assert.equal(trips.size,4);
assert.equal(events.size,7);
const activeId=c.currentTripId;
assert.equal([...events.values()].filter(e=>e.tripId===activeId).length,1);
assert.equal([...events.values()].filter(e=>e.tripId===activeId)[0].event,'trip.started');
assert.equal(JSON.parse(window.localStorage.getItem(storageKey)).length,0);
console.log('PASS reconnect drains completed trips while preserving a separate running trip');
window.happyDOM.abort();
