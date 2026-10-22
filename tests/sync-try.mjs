import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../ClockTimer.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('        #syncGoal_on('),source.indexOf('        #handleTripGoalChange(',source.indexOf('        #syncGoal_on('))).replace('#syncGoal_on','syncGoal_on').replaceAll('.#','.');
const ctx=vm.createContext({});vm.runInContext('globalThis.SyncHarness=class {'+method+'}',ctx);
for(const valid of [true,false]){
 const timer=new ctx.SyncHarness();const events=[];
 timer.calculateTotalGoalRequirements=()=>({tripGoal:valid?1.2:undefined,adjustedTimeElapsed:valid?1000:0,adjustedEndTime:valid?'12:00':''});
 timer.getTotalGoalRequirementFailureReason=()=> 'insufficient-time';timer.getUserTripGoal=()=>1;timer.getTripGoal=()=>1;timer.getTotalGoal=()=>1.2;
 timer.emitClockTimerEvent=(type,detail)=>events.push({type,detail});
 timer.syncGoal_on({source:'test',forceEvent:true});
 assert.deepEqual(events.map(e=>e.type),['syncTry','syncGoalRecalculated']);
 assert.equal(events[0].detail.valid,valid);assert.equal(events[0].detail.reason,valid?null:'insufficient-time');
 assert.equal(events[0].detail.operation,'sync');assert.equal(events[0].detail.source,'test');
 assert.equal(events[0].detail,events[1].detail);
}
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/"syncTry",\s*event =>/);
assert.match(app,/eventName: "syncTry"/);
console.log('PASS syncTry reports successful and blocked outcomes and preserves the legacy event');

for (const [raw,floor,override,expected] of [[.8,1,false,1],[.8,1,true,.8],[1.3,1.1,false,1.3],[1,1,false,1]]) {
 const timer=new ctx.SyncHarness();timer.getUserTripGoal=()=>floor;timer.syncOverride=override;
 timer.calculateTotalGoalRequirements=()=>({tripGoal:raw,adjustedTimeElapsed:1000,adjustedEndTime:'12:00'});
 timer.getTotalGoalRequirementFailureReason=()=>null;timer.getTripGoal=()=>timer.calculatedTripGoal;
 timer.getTotalGoal=()=>1;timer.emitClockTimerEvent=()=>{};
 timer.syncGoal_on({source:'test',forceEvent:true});
 assert.equal(timer.calculatedTripGoal,expected);assert.equal(timer.rawSyncTripGoal,raw);
}
console.log('PASS sync floor protects manual/default goal unless override is enabled');
