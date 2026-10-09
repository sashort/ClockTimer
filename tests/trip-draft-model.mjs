import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripDraftModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripDraftModel;
assert.ok(model, "trip draft model registers its public API");

const valid = {
    creationDateValid: true,
    deferred: false,
    standardTimeMilliseconds: 60_000,
    creationTime: 0,
    scheduledStart: 1,
    actualStart: 2
};
assert.equal(model.canStart(valid), true, "valid immediate trip draft can start");
assert.equal(model.canStart({...valid, creationDateValid: false}), false, "creation date is required");
assert.equal(model.canStart({...valid, standardTimeMilliseconds: 0}), false, "immediate trip needs positive standard time");
assert.equal(model.canStart({...valid, standardTimeMilliseconds: Number.MAX_SAFE_INTEGER + 1}), false,
    "standard time must be a safe integer");
assert.equal(model.canStart({...valid, creationTime: 86_400_000}), false, "creation time must be within its day");
assert.equal(model.canStart({...valid, scheduledStart: undefined}), false, "scheduled start is required for immediate trips");
assert.equal(model.canStart({...valid, deferred: true, standardTimeMilliseconds: undefined,
    scheduledStart: undefined, actualStart: undefined}), true,
    "deferred trip does not require standard, scheduled, or actual start times");
assert.equal(model.canStart({...valid, deferred: true, creationTime: -1}), false,
    "deferred trip still requires a valid creation time");

assert.equal(model.canRequestStart({...valid, canStartNow: true}), true,
    "a currently startable draft can request start");
assert.equal(model.canRequestStart({...valid, canStartNow: false, hasFutureStart: true}), true,
    "valid future-start draft can request start even if not startable now");
assert.equal(model.canRequestStart({...valid, canStartNow: false, hasFutureStart: false}), false,
    "draft without future start cannot request start");
assert.equal(model.canRequestStart({...valid, canStartNow: false, hasFutureStart: true, deferred: true}), false,
    "deferred draft cannot request scheduled start");
assert.equal(model.canRequestStart({...valid, canStartNow: false, hasFutureStart: true, creationTime: 86_400_000}), false,
    "future-start request validates creation time");
assert.equal(model.canRequestStart({...valid, canStartNow: false, hasFutureStart: true, actualStart: undefined}), false,
    "future-start request requires actual start");
console.log("PASS trip draft start readiness rules");
