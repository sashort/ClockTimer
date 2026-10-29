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
 await c.connect('test','test');c.configure({goal_type:'auto',trip_goal:'100%',total_goal:'110%',auto_goal:false});await c.calculateTripTotals('2026-09-01T00:00:00Z','2026-09-30T23:59:59Z');c.setAttribute('goal-bar','');assert.equal(c.goalBounding,true,'bounding defaults On');await c.start({standardTime:'0:30:00'});
 let ui=c.getUIState(),node=ui.goal_bar.nodes.find(n=>n.id==='total');assert.equal(node.percent,100);assert.equal(node.bounding.rawTripGoal,.9);assert.equal(node.bounding.adjusted,true);assert.equal(ui.effective_goal_type,'total','aggregate wins the bounded 100% tie');assert.equal(c.getGoalEditorSnapshot('total').actual_percent,110,'saved aggregate goal never changes');assert.equal(c.getGoalEditorSnapshot('total').raw_inferred_percent,90);assert.equal(c.getGoalEditorSnapshot('total').inferred_percent,100);
 c.configure({goal_bounding:false});assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='total').percent,90);c.configure({goal_bounding:true});assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='total').percent,100);
 window.__testTime+=31*60000;ui=c.getUIState();node=ui.goal_bar.nodes.find(n=>n.id==='total');assert.equal(node.percent,90,'after 100% fails, keep and recalculate the underlying goal');assert.equal(node.failed,false);assert.equal(node.bounding.released,true);assert.equal(ui.effective_goal_type,'total');const snapshot=c.captureState();c.restoreState(snapshot);node=c.getUIState().goal_bar.nodes.find(n=>n.id==='total');assert.equal(node.percent,90,'reload derives the same released state');assert.equal(node.bounding.released,true);window.__testTime+=3*60000;assert.equal(c.getUIState().goal_bar.nodes.find(n=>n.id==='total').failed,true,'only the raw goal crossing marks the aggregate failed');
 const direct=window.document.createElement('clock-timer');window.document.body.append(direct);try{direct.configure({goal_type:'trip',trip_goal:'80%'});await direct.start({standardTime:'0:30:00'});assert.equal(direct.getUIState().goal_component.value,1);assert.equal(direct.getGoalEditorSnapshot('trip').actual_percent,80);window.__testTime+=31*60000;assert.equal(direct.getUIState().goal_component.value,.8,'explicit lower Trip goal also survives a missed bound');}finally{direct.remove();}
 console.log('PASS default-On inferred-only bounding, toggles, raw-goal retention, explicit goals, raw failure and reload');
}finally{c.remove();await window.happyDOM.close();}
