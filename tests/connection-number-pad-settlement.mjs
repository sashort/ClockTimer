import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox={Object,Number,Promise};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ConnectionNumberPadSettlement.js",import.meta.url),"utf8"),sandbox);
let now=500, waited=0, updated;
await sandbox.ClockTimerConnectionNumberPadSettlement.settle({connectionAnimationStartedAt:100,connectionStatusToken:"abc"},Promise.reject(new Error("ignored")),{
 minimumDuration:1000,now:()=>now,wait:async n=>{waited=n;now+=n;},normalizedStatus:()=>"online",updateStatus:(...args)=>updated=args
});
assert.equal(waited,600);
assert.deepEqual(updated,["abc","online",{presentation:"initial-cloud"}]);
let secondWait=0;
await sandbox.ClockTimerConnectionNumberPadSettlement.settle({connectionAnimationStartedAt:0},Promise.resolve(),{
 minimumDuration:100,now:()=>500,wait:async n=>secondWait=n,updateStatus:()=>{}
});
assert.equal(secondWait,0);
console.log("PASS minimum initial connection indicator duration and settlement");
