import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-10-11T18:00:54.504Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});

// Timing of the October 11 failure, with synthetic identities and no account data.
const startedAt=new window.Date('2026-10-11T17:29:43.748Z');
const clock=[startedAt.getHours(),startedAt.getMinutes(),startedAt.getSeconds()+.748].join(':');
const anchor=new window.Date(startedAt.getFullYear(),startedAt.getMonth(),startedAt.getDate()).toISOString();
const savedEvents=[
 {id:1,event:'trip.started',timestamp:startedAt.toISOString(),value:{standardTimeMilliseconds:2758000,
  creationTime:clock,scheduledStart:clock,startTime:clock,creationAnchor:anchor,
  nonProduction:false,intervalElapsedBehavior:'startLatency',autoRestartTripAfterLateBreak:false}},
 {id:2,event:'interval.started',timestamp:'2026-10-11T17:30:27.847Z',value:{intervalKey:'break-1',type:'break',length:600000,startBuffer:150000,endBuffer:150000,attributes:{breakType:'short'}}},
 {id:3,event:'interval.elapsed',timestamp:'2026-10-11T17:49:19.847Z',value:{intervalKey:'break-1',boundaryType:'end-buffer',boundaryTime:'2026-10-11T17:45:27.847Z',defaultBehavior:'startLatency',behavior:'startLatency',overridden:false}},
 {id:4,event:'interval.ended',timestamp:'2026-10-11T17:51:20.850Z',value:{intervalKey:'break-1',reason:'manual'}},
 {id:5,event:'interval.started',timestamp:'2026-10-11T17:51:22.845Z',value:{intervalKey:'down-1',type:'down',length:null,startBuffer:null,endBuffer:null,attributes:[]}}
];
let events=structuredClone(savedEvents);
const writes=[];
window.fetch=async(url,options={})=>{
 const parsed=new URL(url,window.location.href),path=parsed.pathname;
 const body=options.body?JSON.parse(options.body):undefined;
 if(options.method&&!/^(GET|HEAD)$/.test(options.method)&&!path.endsWith('/users/'))writes.push({path,body});
 let data={};
 if(path.endsWith('/users/'))data={csrfToken:'a'.repeat(64),user:{id:2},calendars:[]};
 else if(path.endsWith('/command-check/'))data={accepted:true};
 else if(path.endsWith('/trip-events/'))data={tripId:77,events};
 else if(parsed.searchParams.get('result')==='active')data={activeTripId:77};
 else if(options.method==='POST')data={tripId:78};
 else data={aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return{ok:true,status:200,json:async()=>structuredClone(data),clone(){return this}};
};

try{
 for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'));
 const timer=window.document.createElement('clock-timer');window.document.body.append(timer);
 let renderedState;
 timer.addEventListener('uiStateChanged',event=>{renderedState=event.detail;});
 await timer.connect('test','test');
 assert.equal(timer.currentTripId,77);
 assert.equal(timer.getActiveIntervalState().intervalKey,'down-1');
 assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,399097,'restoration includes Down instead of counting the partial break-only model');
 await timer.resumeConnection();await timer.resumeConnection();
 assert.equal(timer.currentTripId,77,'reconnect retains the original identity');
 assert.deepEqual(writes,[],'restore and reconnect neither insert a duplicate nor rewrite events');

 events=structuredClone(savedEvents.slice(0,3));
 await timer.loadTrip(77);
 assert.equal(timer.currentTripId,77);
 assert.equal(timer.getActiveIntervalState().phase,'latency','an overdue break can remain active after replay');
 await timer.resumeConnection();
 assert.deepEqual(writes,[],'restoring an active elapsed break does not emit its elapsed event again');

 // An unrelated corrupt event must also be unable to turn a partial replay
 // into a newly persisted trip. Retry the authoritative load after repair.
 events=structuredClone(savedEvents);
 events[2].value.intervalKey='missing-interval';
 await assert.rejects(timer.loadTrip(77),/unknown interval/);
 assert.equal(timer.status,'ready','failed replay stops and clears its partial running model');
 assert.equal(timer.currentTripId,undefined);
 assert.equal(timer.getSummarySnapshot().trip.available,false);
 assert.equal(timer.uiState.trip_active,false);
 assert.equal(renderedState.trip_active,false,'the UI receives the cleared replay state');
 await assert.rejects(timer.resumeConnection(),/unknown interval/);
 assert.deepEqual(writes,[],'retrying a failed replay never POSTs the partial model');
 events=structuredClone(savedEvents);
 await timer.resumeConnection();
 assert.equal(timer.currentTripId,77);
 assert.equal(timer.getActiveIntervalState().intervalKey,'down-1');

 events.push({id:6,event:'interval.ended',timestamp:'2026-10-11T18:07:28.019Z',value:{intervalKey:'down-1',reason:'manual'}},
  {id:7,event:'trip.stopped',timestamp:'2026-10-11T19:05:52.566Z',value:{standardTimeMilliseconds:2758000,countedTimeMilliseconds:4868818}});
 window.__testTime=Date.parse('2026-10-11T20:00:00Z');
 await timer.loadTrip(77);await timer.resumeConnection();
 assert.equal(timer.status,'stopped');
 assert.equal(timer.currentTripId,77);
 assert.deepEqual(writes,[],'completed break/Down trips replay without persistence');
 console.log('PASS overdue break/Down replay preserves trip identity; failed replay cannot create a duplicate on reconnect');
}finally{await window.happyDOM.close()}
