import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({url:'https://clock.example/'});
const epoch = Date.parse('2026-09-19T12:00:00Z');
window.__testTime = epoch;
window.eval(`const AccountingDate=Date; window.Date=class extends AccountingDate {
    constructor(...args){super(...(args.length?args:[window.__testTime]));}
    static now(){return window.__testTime;}
};`);
const css=window.CSS; css.registerProperty=()=>{}; Object.defineProperty(window,"CSS",{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.structuredClone=globalThis.structuredClone;
window.Element.prototype.animate = () => ({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
for (const name of ['TemporalFormat','RingContainer','TimeRangeModel', 'TimeRangeElement','ClockTimer']) {
    window.eval(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'));
}
const timers=[];
async function make(start,worked){window.__testTime=start;const c=window.document.createElement('clock-timer');window.document.body.append(c);c.configure({goal_type:'trip',trip_goal:'100%'});c.setAttribute('goal-bar','');await c.start({standardTimeMilliseconds:120000});window.__testTime+=worked;timers.push(c);return c;}
function read(c,mode){c.renderedTimeMode=mode;const state=c.getUIState();assert.equal(state.time_component.text,state.goal_bar.nodes.find(n=>n.current).time,'main and bar Current share the fractional correction');return state.time_component.text;}
try{
 for(const [worked,remaining,elapsed] of [[10250,'0:01:49⁺','0:00:11⁻'],[125250,'-0:00:05⁻','0:02:06⁻'],[10000,'0:01:50','0:00:10']]){
  const c=await make(epoch+(worked===10000?0:250),worked);
  const activeEnd=read(c,'calculated-end');assert.equal(/[⁺⁻]$/.test(activeEnd),worked!==10000,'End Time shows a fraction during active running');if(worked!==10000)assert(activeEnd.endsWith('⁺'),'floored clock time requires adding its omitted fraction');
  await c.startInterval('break',60000);assert.equal(read(c,'remaining'),remaining);assert.equal(read(c,'elapsed'),elapsed);assert.equal(read(c,'calculated-end'),activeEnd,'End Time marker is not break-dependent');await c.endInterval();
  await c.startInterval('down');const downEnd=read(c,'calculated-end');assert.equal(/[⁺⁻]$/.test(downEnd),worked!==10000,'Down also retains the End Time fraction marker');if(worked!==10000)assert(downEnd.endsWith('⁺'));
 }
 for(const worked of [0,1000,10250,11000,119000,119999,120000]){
  const c=await make(epoch,worked),next=c.getUIState().goal_bar.next_goal;
  assert(next,'target remains available through its exact deadline');
  const fractional=next.remaining_milliseconds%1000!==0;
  assert.equal(/[⁺⁻]$/.test(next.clock),fractional,'countdown sign only for omitted milliseconds at '+worked);
  if(fractional)assert(next.clock.endsWith('⁺'),'positive floored countdown has only a positive correction');
 }
 const negative=await make(epoch,10250);await negative.startInterval('break',60000);window.__testTime+=1000;await negative.endInterval();await negative.startInterval('break',60000);assert.equal(read(negative,'elapsed'),'-0:00:49⁺','negative elapsed magnitude rounds away from zero; its omitted correction is positive');
 console.log('PASS fractional correction signs, exact seconds, negative durations and End Time in active/Break/Down states');
}finally{for(const c of timers)c.remove();await window.happyDOM.close();}
