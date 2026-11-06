import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-09-18T16:00:00Z');
window.eval(`const RealTestDate=Date;window.Date=class extends RealTestDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
let standard=2160000,counted=1600000,id=1;
const empty={tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0};
window.fetch=async(url,options={})=>{
 const path=new URL(url,'https://clock.example/').pathname;
 const data=path.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},calendars:[]}:path.endsWith('/trip-events/')?{eventId:id++}:{tripId:1,aggregateBreakdown:{production:{...empty,tripCount:1,standardTimeMilliseconds:standard,actualTimeMilliseconds:counted,countedTimeMilliseconds:counted},nonProduction:{trips:[]}}};
 return {ok:true,status:200,json:async()=>({...data,accepted:true}),clone(){return this;}};
};
for(const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const c=window.document.createElement('clock-timer');window.document.body.append(c);
try{
 await c.connect('test','test');c.configure({goal_type:'trip',trip_goal:'120%',total_goal:'110%',auto_goal:true});await c.calculateTripTotals('2026-09-01T00:00:00Z','2026-09-30T23:59:59Z');c.setAttribute('goal-bar','');await c.start({standardTime:'0:30:00'});
 for(const bounding of [false,true]){
  c.configure({goal_type:'trip',goal_bounding:bounding,auto_goal:true});
  assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='trip').percent,bounding?100:90,'Trip mode still honors Sync');
  c.configure({goal_type:'auto'});assert.equal(c.autoSyncTripGoal,true,'Auto retains Sync preference');
  assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='trip').percent,120,'Auto Trip candidate uses its independent configured goal');
  assert.equal(c.getGoalEditorSnapshot('trip').inferred_percent,120);
  const projection=()=>JSON.stringify({bar:c.getUIState().goal_bar,goal:c.getUIState().goal_component,effective:c.getUIState().effective_goal_type,time:c.getUIState().time_component});
  for(const lock of [null,'trip','total','standard']){
   c.configure({auto_goal_override:lock,auto_goal:true});const enabled=projection();c.configure({auto_goal:false});assert.equal(projection(),enabled,'Sync toggle has no effect on Auto goals, countdowns or time readouts');c.configure({auto_goal:true});assert.equal(projection(),enabled);
  }
  c.setTripGoalToTotalGoal();assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='trip').percent,120,'explicit Sync recalculation cannot leak into Auto');
  const saved=c.captureState();c.restoreState(saved);assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='trip').percent,120,'reload keeps Auto independent');
  c.configure({goal_type:'trip',auto_goal_override:null});assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='trip').percent,bounding?100:90,'returning to Trip reapplies retained Sync');
 }
 c.configure({goal_type:'auto',auto_goal:true,auto_goal_override:'trip'});
 const observer=window.document.createElement('clock-timer');window.document.body.append(observer);observer.enableObserverMode();
 try{const snapshot=c.exportObserverSnapshot();for(const sync of [true,false]){const result=observer.applyObserverSnapshot(snapshot,{mode:'auto',sync,goalBar:true,autoGoalOverride:'trip',now:new window.Date()});assert.equal(result.uiState.goal_bar.nodes.find(n=>n.id==='trip').percent,120);assert.equal(result.uiState.goal_bar.next_goal.ids.join(),'trip');}}finally{observer.remove();}
 console.log('PASS Auto ignores Sync across bounds, all locks, readouts, recalculation and restore; Trip retains Sync');
}finally{c.remove();await window.happyDOM.close();}
