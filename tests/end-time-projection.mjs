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
async function make({bar=true,goal='120%',mode='trip',history=false}={}){window.__testTime=epoch;const c=window.document.createElement('clock-timer');window.document.body.append(c);timers.push(c);if(history){await c.connect('test','test');await c.calculateTripTotals('2026-10-01T00:00:00Z','2026-10-31T23:59:59Z');}c.configure({goal_bounding:false,goal_type:mode,trip_goal:goal,total_goal:'110%',auto_goal:false,rendered_time_type:'calculated_end_time'});c.toggleAttribute('goal-bar',bar);await c.start({standardTime:'0:30:00'});return c;}
function read(c){c.testTick();const ui=c.getUIState();assert.equal(ui.time_header_text,'End Time');if(c.hasAttribute('goal-bar'))assert.equal(ui.time_component.text,ui.goal_bar.nodes.find(n=>n.current).time,'main and Current agree');return ui.time_component.value;}
try{
 for(const bar of [false,true])for(const mode of ['trip','auto']){
  const c=await make({bar,mode});assert.equal(read(c),epoch+1500000,'initial projection uses the goal even before work accrues');
  for(const elapsed of [1000,600000,1499000]){window.__testTime=epoch+elapsed;assert.equal(read(c),epoch+1500000,'running ticks preserve target deadline');}
  window.__testTime=epoch+1501000;assert.equal(read(c),epoch+1800000,'missed target falls back to Standard');
  window.__testTime=epoch+1801000;assert.equal(read(c),window.__testTime,'after all targets and Standard expire use current time');window.__testTime+=1000;assert.equal(read(c),window.__testTime,'overtime End Time ticks with current time');
 }
 for(const bar of [false,true]){
  const c=await make({bar,mode:'auto'});window.__testTime+=600000;const original=read(c);await c.startInterval('break',120000,{},15000,15000);const paused=read(c);assert(paused>original,'starting a break projects its duration and buffers');window.__testTime+=1000;assert.equal(read(c),paused,'break deadline does not drift while its known duration counts down');
  await c.endInterval();const resumed=read(c);window.__testTime+=1000;assert.equal(read(c),resumed,'early break completion recalculates, then freezes the running deadline');
  await c.startInterval('down');const down=read(c);assert(down>window.__testTime,'Down retains the future target');window.__testTime+=1000;assert.equal(read(c),down+1000,'Down moves the deadline one second per tick');window.__testTime+=4000;assert.equal(read(c),down+5000);await c.endInterval();const afterDown=read(c);window.__testTime+=1000;assert.equal(read(c),afterDown,'resuming freezes the newly projected end');
 }
 for(const bar of [false,true]){
  const c=await make({bar,history:true,goal:'110%',mode:'auto'});window.__testTime=epoch+1200000;assert.equal(read(c),epoch+1440000,'Auto projects inferred aggregate target');
  await c.startInterval('down');const down=read(c);window.__testTime+=1000;assert.equal(read(c),down+1000,'Down preserves aggregate target and pushes its deadline');await c.endInterval();
  const resumed=read(c);window.__testTime+=1000;assert.equal(read(c),resumed,'aggregate deadline freezes after Down');
 }
 const sequential=await make({history:true,goal:'110%',mode:'auto'});window.__testTime=epoch+1441000;assert(Math.abs(read(sequential)-(epoch+1800000/1.1))<1,'Auto moves from failed aggregate to Trip');window.__testTime=epoch+1637000;assert.equal(read(sequential),epoch+1800000,'Auto moves from failed Trip to Standard');window.__testTime=epoch+1801000;assert.equal(read(sequential),window.__testTime,'all applicable goals failed follows wall clock');window.__testTime+=1000;assert.equal(read(sequential),window.__testTime);
 const below=await make({goal:'80%'});window.__testTime=epoch+1860000;assert.equal(read(below),epoch+2250000,'a valid below-100 target remains authoritative after Standard');
 const edited=await make();window.__testTime+=600000;edited.configure({trip_goal:'150%'});assert.equal(read(edited),epoch+1200000,'goal edit updates the projected deadline');window.__testTime+=1000;assert.equal(read(edited),epoch+1200000);
 console.log('PASS target/Standard End Time, stable running/break ticks, early completion, moving Down, overtime, goal edits and below-100 targets in Classic/Bar');
}finally{for(const c of timers)c.remove();await window.happyDOM.close();}
