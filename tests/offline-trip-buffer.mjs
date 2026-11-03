import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installAsyncStorage} from './async-storage-fixture.mjs';

const window=new Window({url:'https://clock.example/',settings:{disableJavaScriptEvaluation:true}});
const storage=installAsyncStorage(window);
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
    if(path.endsWith('/command-check/'))data={accepted:true};
    else if(path.endsWith('/users/'))data={csrfToken:'a'.repeat(64),user:{id:userId,username:'test'},tripStorageVersion:2};
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
    }else if(path.endsWith('/trip-editor/')&&options.method==='POST'){
        assert.equal(body.operation,'delete-trip');trips.delete(body.tripId);data={tripId:body.tripId,deleted:true};
    }else if(path.endsWith('/trip-editor/')){
        data={tripId:Number(new URL(url,'https://clock.example/').searchParams.get('tripId')),revision:'test-revision'};
    }else if(path.endsWith('/trips/'))data={trips:[...trips.values()]};
    return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data),clone(){return this;}};
};
for(const name of ['TemporalFormat','TripAggregates','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const storageKey='test.completedTrips';
function clock(){const c=window.document.createElement('clock-timer');c.setAttribute('offline-trip-storage-key',storageKey);window.document.body.append(c);return c;}
let c=clock();await c.connect('test','test');
async function complete(standard,minutes){
    const prepared=await c.prepareTrip();
    await c.start({standardTimeMilliseconds:standard});
    window.__testTime+=minutes*60000;
    await c.stop();
    const result=await c.resetCompletedTrip();
    assert.equal(result.synced,false);
    assert.equal(c.status,'ready');
    assert.equal(c.currentTripId,undefined);
}
offline=true;
await complete(1200000,8);
await complete(1800000,12);
let queue=await storage.getItem(storageKey);
assert.equal(queue.length,2);
assert.equal(c.getLocalTripLog().length,2);
const localTotals=c.calculateOfflineTripTotals(c.getLocalTripLog(),'2026-09-18T00:00:00Z','2026-09-19T00:00:00Z');
assert.equal(localTotals.standardTimeMilliseconds,3000000);
assert.equal(localTotals.actualTimeMilliseconds,1200000);
assert.equal(localTotals.tripCount,2);
assert.notEqual(queue[0].payload.clientToken,queue[1].payload.clientToken);
assert.deepEqual(queue.map(t=>t.events.map(e=>e.event)),[['trip.started','trip.stopped'],['trip.started','trip.stopped']]);
console.log('PASS two trips complete offline, clear independently, and buffer separate identities and events');

const editable=c.getLocalTripLog()[0];
const editorState=await c.tripEditorRequest(editable.id);
await c.tripEditorRequest(editable.id,{operation:'settings',revision:editorState.revision,
    settings:{...editorState.settings,standardTimeMilliseconds:1500000,nonProduction:true}});
await c.tripEditorRequest(editable.id,{operation:'entries',revision:editorState.revision,changes:[
    {operation:'add-entry',entry:{start:'2026-09-18T12:02:00.000Z',end:'2026-09-18T12:03:00.000Z',type:'break',length:60000}}
]});
const edited=c.getLocalTripLog().find(t=>String(t.id)===String(editable.id));
assert.equal(edited.standardTimeMilliseconds,1500000);
assert.equal(edited.nonProduction,true);
assert(edited.events.some(event=>event.event==='interval.started'));
assert.equal((await storage.getItem(storageKey))[0].payload.standardTimeMilliseconds,1500000);
console.log('PASS buffered trips retain settings and entry edits while offline');
const offlineBefore=JSON.stringify(await storage.getItem(storageKey)),batchSettings=(await c.tripEditorRequest(editable.id)).settings;
const batch={operation:'editor',settings:{...batchSettings,standardTimeMilliseconds:1800000},changes:[]};
const preview=await c.tripEditorRequest(editable.id,{...batch,operation:'editor-preview'});
assert.equal(preview.trip.standardTimeMilliseconds,1800000);assert.equal(JSON.stringify(await storage.getItem(storageKey)),offlineBefore,'preview never writes buffered storage');
assert.equal(c.getLocalTripLog().find(t=>String(t.id)===String(editable.id)).standardTimeMilliseconds,1500000,'preview does not alter live buffered rows');
await c.tripEditorRequest(editable.id,batch);assert.equal(c.getLocalTripLog().find(t=>String(t.id)===String(editable.id)).standardTimeMilliseconds,1800000);
const validOffline=JSON.stringify(await storage.getItem(storageKey));
await assert.rejects(()=>c.tripEditorRequest(editable.id,{...batch,changes:[{operation:'add-entry',entry:{type:'down',start:'2026-09-18T12:02:10Z',end:'2026-09-18T12:02:20Z'}}]}),/overlap/);
assert.equal(JSON.stringify(await storage.getItem(storageKey)),validOffline,'rejected batch leaves stored queue unchanged');
console.log('PASS atomic offline editor Save, read-only preview and invalid-batch rollback');

const beforeRebase=(await storage.getItem(storageKey))[0],startedBefore=beforeRebase.events.find(e=>e.event==='trip.started'),stoppedBefore=beforeRebase.events.find(e=>e.event==='trip.stopped');
const originalSchedule=beforeRebase.payload.scheduledStartTime,creationInstant=new Date(Date.parse(startedBefore.scheduledStartTime||originalSchedule)+startedBefore.value.creationOffsetMilliseconds).toISOString();
const adjustedSchedule=new Date(Date.parse(originalSchedule)+3600000).toISOString();
const shiftSettings=(await c.tripEditorRequest(editable.id)).settings;
await c.tripEditorRequest(editable.id,{operation:'settings',settings:{...shiftSettings,instants:{creationTime:creationInstant,startTime:startedBefore.timestamp,scheduledStart:adjustedSchedule}}});
const rebased=(await storage.getItem(storageKey))[0];assert.equal(rebased.payload.scheduledStartTime,adjustedSchedule);assert.equal(rebased.payload.startTime,startedBefore.timestamp);assert.equal(rebased.events.find(e=>e.event==='trip.stopped').timestamp,stoppedBefore.timestamp);assert.equal(rebased.events.find(e=>e.event==='trip.started').value.startOffsetMilliseconds,Date.parse(startedBefore.timestamp)-Date.parse(adjustedSchedule));
await c.tripEditorRequest(editable.id,{operation:'settings',settings:{...shiftSettings,instants:{creationTime:creationInstant,startTime:startedBefore.timestamp,scheduledStart:originalSchedule}}});
console.log('PASS offline scheduled-start rebase preserves actual event instants and exact canonical offsets');

const removed=c.getLocalTripLog()[1];
await c.tripEditorRequest(removed.id,{operation:'delete-trip',revision:'offline'});
assert.equal(c.getLocalTripLog().length,1);
assert.equal((await storage.getItem(storageKey)).length,2);
assert.equal((await storage.getItem(storageKey))[1].deleted,true);
console.log('PASS deleting an offline trip keeps a hidden tombstone transaction');

// Simulate the pre-offset local queue before reconnecting to the new API.
const legacyQueue=await storage.getItem(storageKey);
for(const trip of legacyQueue){delete trip.payload.scheduledStartTime;for(const event of trip.events){delete event.scheduledStartTime;if(event.event==='trip.started'){delete event.value.timelineVersion;for(const key of Object.keys(event.value))if(key.endsWith('OffsetMilliseconds'))delete event.value[key];}}}
await storage.setItem(storageKey,legacyQueue);
c.remove();c=clock();
assert.equal(c.status,'ready');
await storage.flush();
assert.equal(c.getLocalTripLog().length,1);
offline=false;userId=3;await c.connect('other','test');
assert.equal(trips.size,0);
assert.equal((await storage.getItem(storageKey)).length,2);
console.log('PASS refreshed clock restores the queue and never uploads it to a different account');

userId=2;interruptStop=true;
await assert.rejects(()=>c.connect('test','test'));
assert.equal(events.size,2);
assert.equal((await storage.getItem(storageKey)).length,2);
// Refresh again after the stop event was accepted but the timing PATCH failed.
c.remove();c=clock();await c.connect('test','test');
assert.equal(trips.size,1);
assert.equal(events.size,6);
assert.equal((await storage.getItem(storageKey)).length,0);
assert.deepEqual([...trips.values()].map(t=>[t.standardTimeMilliseconds,t.countedTimeMilliseconds]),[[1800000,420000]]);
for(const trip of trips.values()){
    const tripEvents=[...events.values()].filter(e=>e.tripId===trip.id);
    assert.equal(tripEvents.filter(e=>e.event==='trip.started').length,1);
    assert.equal(tripEvents.filter(e=>e.event==='trip.stopped').length,1);
}
await c.connect('test','test');
assert.equal(events.size,6);
assert.equal(trips.size,1);
assert.equal(requests.filter(r=>r.options.method==='DELETE').length,0);
assert(requests.filter(r=>r.path.endsWith('/trip-events/')&&r.options.method==='POST').every(r=>Number.isSafeInteger(r.body.offsetMilliseconds)&&!('timestamp' in r.body)),'legacy queues upgrade to exact canonical transport');
console.log('PASS reconnect after interrupted completion uploads both trips once with original timing and no DELETE');

// A new active trip must not acquire any events from the completed queue.
offline=true;await complete(2400000,16);
const prepared=await c.prepareTrip();
await c.start({standardTimeMilliseconds:3000000});
assert.notEqual(c.status,'ready');
offline=false;await c.connect('test','test');
assert.equal(trips.size,3);
assert.equal(events.size,9);
const activeId=c.currentTripId;
assert.equal([...events.values()].filter(e=>e.tripId===activeId).length,1);
assert.equal([...events.values()].filter(e=>e.tripId===activeId)[0].event,'trip.started');
assert.equal((await storage.getItem(storageKey)).length,0);
console.log('PASS reconnect drains completed trips while preserving a separate running trip');
window.happyDOM.abort();
