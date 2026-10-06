import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-09-29T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);

const css=window.CSS;
css.registerProperty=()=>{};
Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});

let eventId=1;
const aggregate={
  tripCount:2,
  standardTimeMilliseconds:7200000,
  actualTimeMilliseconds:6000000,
  countedTimeMilliseconds:6000000
};

window.fetch=async(url,options={})=>{
  const path=new URL(url,'https://clock.example/').pathname;
  const method=options.method||'GET';

  let data;
  if(path.endsWith('/users/')){
    data={
      csrfToken:'a'.repeat(64),
      user:{id:2,username:'test',permissions:0},
      calendars:[]
    };
  }
  else if(path.endsWith('/trips/') && method==='GET'){
    data={
      trips:[],
      aggregateBreakdown:{
        production:{...aggregate},
        nonProduction:{trips:[]}
      }
    };
  }
  else if(path.endsWith('/trip-events/') && method==='POST'){
    data={eventId:eventId++};
  }
  else{
    data={tripId:41,eventId:eventId++};
  }

  return {
    ok:true,
    status:200,
    async json(){return data;},
    async text(){return JSON.stringify(data);},
    clone(){return this;}
  };
};

for(const name of ['TemporalFormat','RingContainer','TimeRange','TimeRangeGroup','ClockTimer']){
  window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
}

const timer=window.document.createElement('clock-timer');
window.document.body.append(timer);

await timer.connect('test','test');
await timer.calculateTripTotals(
  '2026-09-28T00:00:00Z',
  '2026-09-30T00:00:00Z'
);

timer.setAttribute('trip-goal','111%');
timer.setAttribute('total-goal','110%');
timer.autoSyncTripGoal=true;

await timer.start({standardTime:'1:00:00'});

const calculatedBeforeDown=timer.calculatedTripGoal;
const renderedBeforeDown=timer.renderedPercentGoal;
const uiGoalBeforeDown=timer.getUIState(new window.Date()).goal_component.value;

assert(Number.isFinite(calculatedBeforeDown) && calculatedBeforeDown>0);
assert.notEqual(calculatedBeforeDown,1.11,'fixture must distinguish the Sync goal from the stored Trip Goal');

await timer.startInterval('down');

assert.equal(
  timer.calculatedTripGoal,
  calculatedBeforeDown,
  'starting Down Time preserves the calculated Sync goal'
);
assert.equal(
  timer.renderedPercentGoal,
  renderedBeforeDown,
  'starting Down Time does not snap the rendered goal back to the stored Trip Goal'
);
assert.equal(
  timer.getUIState(new window.Date()).goal_component.value,
  uiGoalBeforeDown,
  'the visible goal remains the calculated Sync value while Down Time is active'
);

await timer.cancelInterval();

assert.equal(
  timer.calculatedTripGoal,
  calculatedBeforeDown,
  'canceling Down Time keeps the same calculated Sync goal'
);
assert.equal(
  timer.getUIState(new window.Date()).goal_component.value,
  uiGoalBeforeDown,
  'canceling Down Time does not need a presentation correction back to the Sync value'
);

console.log('PASS Down Time preserves the calculated Auto-Sync goal before, during, and after cancel');
await window.happyDOM.close();
