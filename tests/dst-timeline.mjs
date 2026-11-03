import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
process.env.TZ='America/New_York';
const w=new Window({url:'https://clock.example/'});
w.__now=Date.parse('2026-11-01T15:00:00Z');
w.eval(`const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[window.__now]));}static now(){return window.__now;}};`);
const css=w.CSS;css.registerProperty=()=>{};Object.defineProperty(w,'CSS',{value:css});
Object.defineProperty(w,'AbortController',{value:globalThis.AbortController});Object.defineProperty(w,'AbortSignal',{value:globalThis.AbortSignal});
Object.defineProperty(w,'structuredClone',{value:globalThis.structuredClone});
w.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return{progress:1}}}});
for(const file of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])w.eval(fs.readFileSync(new URL('../'+file+'.js',import.meta.url),'utf8').replace('        #tick(now = new Date()) {','        testTick(){this.#tick();}\n        #tick(now = new Date()) {'));
let id=1,replayEvents=[],writes=[];
w.fetch=async (url,options={})=>{if(options.method==='POST'&&options.body)writes.push({url,body:JSON.parse(options.body)});const p=new URL(url,'https://clock.example/').pathname,d=p.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},calendars:[],tripStorageVersion:2}:p.endsWith('/trip-events/')?{eventId:id++,events:replayEvents}:{tripId:99};return{ok:true,status:200,json:async()=>({...d,accepted:true}),clone(){return this;}};};
const timers=[];
async function make(at){w.__now=Date.parse(at);const c=w.document.createElement('clock-timer');w.document.body.append(c);timers.push(c);c.configure({goal_type:'trip',trip_goal:'100%',goal_bounding:false,rendered_time_type:'calculated_start_time'});await c.connect('test','test');await c.start({standardTime:'0:30:00'});await c.persistCurrentTrip();return c;}
const elapsed=c=>{c.testTick();return c.getUIState().time_component.value;};
try{
 for(const at of ['2026-11-01T04:10:00Z','2026-11-01T15:00:00Z','2026-11-01T06:10:00Z','2026-11-01T05:59:00Z','2027-03-14T06:59:00Z']){
  const c=await make(at),start=w.__now;assert.equal(c.captureState().events[0].timestamp,new Date(start).toISOString(),'start persists the exact instant, including the second repeated hour');
  w.__now=start+120000;assert.equal(elapsed(c),120000,'two real minutes count as two minutes across a clock change');
  c.renderedTimeMode='calculated-end';c.testTick();assert.equal(c.getUIState().time_component.value,start+1800000,'deadline uses physical elapsed duration');
  const snapshot=c.captureState(),restored=w.document.createElement('clock-timer');w.document.body.append(restored);timers.push(restored);restored.restoreState(snapshot);restored.renderedTimeMode='elapsed';assert.equal(elapsed(restored),120000,'snapshot replay preserves the precise instant and duration');
  c.remove();restored.remove();
 }
 const paused=await make('2026-11-01T05:58:00Z');w.__now+=30000;await paused.startInterval('down');const before=elapsed(paused);w.__now+=180000;assert.equal(elapsed(paused),before,'Down does not count the repeated hour as work');await paused.endInterval();w.__now+=1000;assert.equal(elapsed(paused),before+1000,'resumed work advances normally');paused.remove();
 replayEvents=[{id:1,event:'trip.started',timestamp:'2026-11-01T13:00:00Z',value:{standardTimeMilliseconds:7200000,creationTime:'9:00:00',startTime:'9:00:00',scheduledStart:'9:00:00',creationAnchor:'2026-11-01T04:00:00Z'}},{id:2,event:'interval.started',timestamp:'2026-11-01T14:00:00Z',value:{type:'lunch',intervalKey:'legacy-lunch',length:1800000,startBuffer:150000,endBuffer:150000}},{id:3,event:'interval.elapsed',timestamp:'2026-11-01T14:10:00Z',value:{intervalKey:'legacy-lunch',boundaryTime:'2026-11-01T13:35:00Z',behavior:'startLatency'}}];
 w.__now=Date.parse('2026-11-01T16:00:00Z');const legacy=w.document.createElement('clock-timer');w.document.body.append(legacy);timers.push(legacy);await legacy.connect('test','test');await legacy.loadTrip(99);assert(legacy.uiState.trip_active,'a malformed historical elapsed boundary cannot strand login');assert.equal(legacy.getActiveIntervalState().intervalType,'lunch');
 replayEvents=[{id:1,event:'trip.started',timestamp:'2026-11-01T05:59:30.125Z',scheduledStartTime:'2026-11-01T06:00:00.000Z',offsetMilliseconds:-29875,value:{timelineVersion:2,creationOffsetMilliseconds:-60000,startOffsetMilliseconds:-29875,scheduledStartOffsetMilliseconds:0,standardTimeMilliseconds:7200000}}];
 w.__now=Date.parse('2026-11-01T06:01:30.125Z');await legacy.loadTrip(99);legacy.renderedTimeMode='elapsed';assert.equal(elapsed(legacy),90125,'canonical early start replays across the fold and counts from scheduled start');
 const transport=writes.filter(x=>new URL(x.url,'https://clock.example/').pathname.endsWith('/trip-events/')).map(x=>x.body);
 assert(transport.length>0);assert(transport.every(x=>Number.isSafeInteger(x.offsetMilliseconds)&&!('timestamp' in x)),'canonical event writes use signed offsets rather than independent datetimes');
 assert(transport.filter(x=>x.event==='trip.started').every(x=>!('creationAnchor' in x.value)&&!('startTime' in x.value)),'new start payloads do not duplicate absolute clocks');
 replayEvents[0].value.startOffsetMilliseconds='invalid';await assert.rejects(legacy.loadTrip(99),/invalid millisecond offsets/);
 // The SQL read adapter includes UTC compatibility clock labels alongside v2
 // offsets. Reload must never apply those legacy labels as a second anchor.
 for(const {type,advance} of [{type:null,advance:300000},... [30000,300000,1380000,1560000].map(advance=>({type:'break',advance})),{type:'down',advance:300000}]){
  const live=await make('2026-11-02T23:00:00Z');
  w.__now+=300000;
  if(type)await live.startInterval(type,type==='break'?1200000:undefined,{},type==='break'?150000:undefined,type==='break'?150000:undefined);
  w.__now+=advance;live.renderedTimeMode='elapsed';
  const beforeReload=elapsed(live),snapshot=live.captureState();
  replayEvents=structuredClone(snapshot.events).map((e,i)=>({...e,id:i+1}));
  const start=replayEvents.find(e=>e.event==='trip.started');
  start.value.creationAnchor='2026-11-02T00:00:00.000Z';
  start.value.creationTime=start.value.startTime=start.value.scheduledStart='23:00:00.000';
  await legacy.loadTrip(99);legacy.renderedTimeMode='elapsed';
  assert.equal(elapsed(legacy),beforeReload,`${type||'running'} API replay preserves counted elapsed despite UTC compatibility labels`);
  if(type){assert.equal(legacy.getActiveIntervalState().intervalType,type,'reload preserves the active interval');assert.equal(legacy.getActiveIntervalState().phase,live.getActiveIntervalState().phase,'reload preserves the buffer/break phase');}
  for(const mode of ['remaining','calculated-end']){
   live.renderedTimeMode=legacy.renderedTimeMode=mode;live.testTick();legacy.testTick();
   assert.equal(legacy.getUIState().time_component.value,live.getUIState().time_component.value,`${mode} is unchanged by ${type||'running'} reload at ${advance}ms`);
  }
  for(const key of ['creationAnchor','creationTime','scheduledStart','startTime'])delete start.value[key];
  await legacy.loadTrip(99);legacy.renderedTimeMode='elapsed';
  assert.equal(elapsed(legacy),beforeReload,'canonical API reload needs no legacy anchor or clock aliases');
  live.remove();
 }
 console.log('PASS exact DST timeline and API-shaped running/Break/Down reload with UTC compatibility labels');
}finally{for(const c of timers)c.remove();await w.happyDOM.close();}
