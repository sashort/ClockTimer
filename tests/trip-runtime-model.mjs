import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripRuntimeModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripRuntimeModel;
assert.ok(model, "trip runtime model registers its API");
assert.equal(model.isLive({timerState:{trip_active:true},status:"stopped",appTripState:"stopped"}), true,
    "explicit active timer state is authoritative");
assert.equal(model.isLive({timerState:{trip_active:false},status:"running",appTripState:"running"}), false,
    "explicit inactive timer state suppresses fallbacks");
assert.equal(model.isLive({timerState:{},status:"running"}), true);
assert.equal(model.isLive({timerState:null,appTripState:"running"}), true);
assert.equal(model.isLive({timerState:null,status:"stopped",appTripState:"stopped"}), false);
assert.equal(model.isLive(null), false);
console.log("PASS trip runtime model");
