import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox={Object,Promise};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ConnectionCloudSettlement.js",import.meta.url),"utf8"),sandbox);
let phase="",timer="old",current=4,scheduled,updates=[],trip=[],scope=[],network=0,cleared=[];
const setTimer=x=>timer=x;
const id=sandbox.ClockTimerConnectionCloudSettlement.settle({
 status:"connected",token:"t",sequence:4,currentSequence:()=>current,previousTimer:timer,
 clearTimer:x=>cleared.push(x),schedule:(fn,ms)=>(scheduled={fn,ms}, "new"),
 duration:750,normalize:x=>x.toUpperCase(),setPhase:x=>phase=x,
 updateNumberPad:(...x)=>updates.push(x),getNumberPadState:()=>({connectionStatusToken:"t",connectionPresentation:"cloud-fade"}),
 syncTripSettings:x=>trip.push(x),syncScope:x=>scope.push(x),syncNetwork:()=>network++,setTimer
});
assert.equal(id,"new");assert.equal(timer,"new");assert.equal(phase,"settling");assert.equal(scheduled.ms,750);assert.deepEqual(cleared,["old"]);assert.equal(network,1);
scheduled.fn();assert.equal(phase,"settled");assert.deepEqual(updates,[["t","CONNECTED",{presentation:"cloud-fade"}],["t","CONNECTED",{presentation:"settled"}]]);assert.equal(timer,undefined);assert.equal(network,1);
console.log("PASS connection cloud settlement phases and stale timer cleanup");
