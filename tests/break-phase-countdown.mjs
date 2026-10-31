import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'https://clock.example/'}),epoch=Date.parse('2026-10-30T12:00:00Z');
window.__testTime=epoch;
window.eval(`const RealTestDate=Date;window.Date=class extends RealTestDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return{progress:1}}}});
for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8').replace('        #tick(now = new Date()) {','        testTick(now = new Date()){this.#tick(now); }\n        #tick(now = new Date()) {'));
let eventId=1;
window.fetch=async url=>{const path=new URL(url,'https://clock.example/').pathname;const data=path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}:path.endsWith('/trip-events/')?{eventId:eventId++}:{tripId:1,aggregateBreakdown:{production:{tripCount:1,standardTimeMilliseconds:2160000,actualTimeMilliseconds:2160000,countedTimeMilliseconds:2160000},nonProduction:{trips:[]}}};return{ok:true,status:200,json:async()=>({...data,accepted:true}),clone(){return this;}};};
const timers=[];
try{
 for(const standalone of [false,true])for(const kind of ['break','lunch','short-break']){
  window.__testTime=epoch;const c=window.document.createElement('clock-timer');window.document.body.append(c);timers.push(c);c.configure({goal_type:'trip',trip_goal:'100%'});await c.connect('test','test');
  const type=kind==='lunch'?'lunch':'break',attributes={breakType:kind==='short-break'?'short':kind};
  if(standalone)await c.startBreakSession(type,60000,attributes,15000,15000);else{await c.start({standardTime:'0:30:00'});await c.startInterval(type,60000,attributes,15000,15000);}
  const start=window.__testTime;
  for(const [elapsed,phase,countdown]of [[3000,'start-buffer',12000],[15000,type,60000],[45000,type,30000],[75000,'end-buffer',15000],[80000,'end-buffer',10000]]){
   window.__testTime=start+elapsed;c.testTick();const s=c.getUIState(),i=s.interval_state;assert.equal(i.phase,phase,kind+' '+standalone+' phase');assert.equal(i.countdownMilliseconds,countdown,'countdown contains only the active phase');assert.equal(i.endBufferMilliseconds,15000);
   if(i.buffer)assert.equal(i.countdownMilliseconds,i.buffer.remainingMilliseconds);else assert.equal(i.remainingMilliseconds-i.countdownMilliseconds,15000,'break-only time excludes end buffer');
   const seconds=Math.floor(Math.abs(countdown)/1000),clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');assert.equal(s.controls.primary_action.clock,clock);
  }
  window.__testTime=start+95000;c.testTick();const after=c.getUIState().interval_state;assert.equal(after.buffer,null);assert.equal(after.endBufferMilliseconds,15000,'past-end state retains evidence of the elapsed wings');assert.equal(after.countdownMilliseconds,-5000,'post-buffer overtime excludes both buffers');c.remove();
 }
 console.log('PASS single phase countdown for Break/Lunch/Short Break in active and standalone sessions, buffer-free break time and retained elapsed end-buffer metadata');
}finally{for(const c of timers)c.remove();await window.happyDOM.close();}
