import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-09-19T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
const startedDate=new window.Date('2026-09-19T11:00:00Z');
const startedClock=`${startedDate.getHours()}:00:00`;
const creationAnchor=new window.Date(startedDate.getFullYear(),startedDate.getMonth(),startedDate.getDate()).toISOString();
const events=[
 {id:1,event:'trip.started',timestamp:'2026-09-19T11:00:00Z',value:{standardTime:'1:00:00',creationTime:startedClock,scheduledStart:startedClock,startTime:startedClock,creationAnchor,nonProduction:false}},
 {id:2,event:'interval.started',timestamp:'2026-09-19T11:45:00Z',value:{type:'down',intervalKey:'down-1',attributes:[]}}
];
let activeChecks=0;
const postedEvents=[];
window.fetch=async(url,options={})=>{
 const parsed=new URL(url,'https://clock.example/'),path=parsed.pathname;
 let data;
 if(path.endsWith('/users/'))data={csrfToken:'a'.repeat(64),user:{id:2},calendars:[]};
 else if(path.endsWith('/trip-events/')&&options.method==='POST'){
  const body=JSON.parse(options.body);
  let stored=postedEvents.find(event=>event.clientToken===body.clientToken);
  if(!stored){stored={...body,id:events.length+1};postedEvents.push(stored);events.push(stored);}
  data={tripId:77,eventId:stored.id};
 }
 else if(path.endsWith('/trip-events/'))data={tripId:77,events};
 else if(path.endsWith('/trips/')&&parsed.searchParams.get('result')==='active'){activeChecks++;data={activeTripId:77};}
 else data={aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>structuredClone(data),clone(){return this;}};
};
for(const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const timer=window.document.createElement('clock-timer');window.document.body.append(timer);
let restored;let renderedState;timer.addEventListener('activeTripRestored',event=>{restored=event.detail;});timer.addEventListener('uiStateChanged',event=>{renderedState=event.detail;});
await timer.connect('test','test');
assert.equal(activeChecks,1);assert.equal(restored.tripId,77);assert.equal(timer.uiState.state,'down');assert.equal(timer.uiState.active_interval_type,'down');assert.equal(timer.uiState.trip_start_component.date.toISOString(),'2026-09-19T11:00:00.000Z');assert.equal(timer.uiState.controls.primary_action.action,'resume_trip');assert.match(timer.uiState.controls.primary_action.text,/^Resume Trip/);assert.equal(timer.uiState.controls.trip_action_row_visible,false);assert.equal(timer.uiState.controls.break_visible,false);assert.equal(timer.uiState.controls.down_visible,false);assert.equal(timer.uiState.available_actions.resume_trip,true);assert.equal(timer.uiState.available_actions.start_down,false);assert.equal(timer.uiState.trip_active,true);assert.equal(renderedState.state,'down');assert.equal(renderedState.active_interval_type,'down');
assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,2700000,'replay counts 45 productive minutes before open Down');
assert.equal(postedEvents.length,0,'restoring Down must not rewrite persisted trip events');
assert.equal(timer.getActiveIntervalState().intervalKey,'down-1');

// Empty PHP associative arrays, object attributes, and older omitted/null
// attributes must all reconstruct the same active Down state.
for(const attributes of [{},null,undefined,[],{title:'Machine stopped'}]){
 events[1].value.attributes=attributes;
 const storedBefore=JSON.stringify(events);
 await timer.loadTrip(77);
 assert.equal(timer.uiState.state,'down');
 assert.equal(timer.uiState.available_actions.resume_trip,true);
 assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,2700000);
 assert.equal(JSON.stringify(events),storedBefore,'replay preserves the stored event payload');
}
events[1].value.attributes=[];
await timer.loadTrip(77);
window.__testTime+=30000;
assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,2700000,
 'counted time stays paused after restoring Down');

// Resume with a manually supplied past time, then replay the saved ending.
const resumedAt='2026-09-19T11:55:00.000Z';
const result=await timer.endInterval(new window.Date(resumedAt));
await timer.persistCurrentTrip();
assert.equal(result.tripId,77);
assert.equal(result.intervalId,2);
assert.equal(timer.uiState.state,'running');
assert.equal(timer.getActiveIntervalState(),undefined);
assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,3030000,
 'manual resume time excludes only the actual ten-minute Down interval');
const ended=postedEvents.filter(event=>event.event==='interval.ended');
assert.equal(ended.length,1,'manual resume persists exactly one interval ending');
assert.equal(ended[0].timestamp,resumedAt);
assert.equal(ended[0].value.intervalKey,'down-1');
assert.equal(postedEvents.some(event=>event.event==='interval.started'),false);
await timer.loadTrip(77);
assert.equal(timer.uiState.state,'running');
assert.equal(timer.getSummarySnapshot().trip.countedTimeElapsedMilliseconds,3030000,
 'a subsequent login preserves the supplied resume time');
console.log('PASS login restores Down with PHP empty attributes, pauses counting, and persists/replays an explicit resume time');
timer.remove();window.happyDOM.abort();
