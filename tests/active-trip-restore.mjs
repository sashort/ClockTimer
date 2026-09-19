import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-09-19T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
const events=[
 {id:1,event:'trip.started',timestamp:'2026-09-19T11:00:00Z',value:{standardTime:'1:00:00',creationTime:'11:00:00',scheduledStart:'11:00:00',startTime:'11:00:00',nonProduction:false}},
 {id:2,event:'interval.started',timestamp:'2026-09-19T11:45:00Z',value:{type:'down',intervalKey:'down-1'}}
];
let activeChecks=0;
window.fetch=async(url,options={})=>{
 const parsed=new URL(url,'https://clock.example/'),path=parsed.pathname;
 let data;
 if(path.endsWith('/users/'))data={csrfToken:'a'.repeat(64),user:{id:2},calendars:[]};
 else if(path.endsWith('/trip-events/'))data={tripId:77,events};
 else if(path.endsWith('/trips/')&&parsed.searchParams.get('result')==='active'){activeChecks++;data={activeTripId:77};}
 else data={aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>structuredClone(data),clone(){return this;}};
};
for(const name of ['TemporalFormat','RingContainer','TimeRange','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const timer=window.document.createElement('clock-timer');window.document.body.append(timer);
let restored;timer.addEventListener('activeTripRestored',event=>{restored=event.detail;});
await timer.connect('test','test');
assert.equal(activeChecks,1);assert.equal(restored.tripId,77);assert.equal(timer.uiState.state,'down');assert.equal(timer.uiState.active_interval_type,'down');assert.equal(timer.uiState.controls.primary_action.action,'resume_trip');assert.match(timer.uiState.controls.primary_action.text,/^Resume Trip/);assert.equal(timer.uiState.available_actions.resume_trip,true);assert.equal(timer.uiState.available_actions.start_down,false);assert.equal(timer.uiState.trip_active,true);
console.log('PASS login discovers and reconstructs the active trip, interval state, and available controls');
timer.remove();window.happyDOM.abort();
