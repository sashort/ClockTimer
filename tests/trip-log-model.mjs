import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripLogModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripLogModel;

assert.ok(model, "trip log model registers its public API");
assert.deepEqual(Array.from(model.ranges), ["day", "week", "pay-period", "month", "year", "custom"]);
for (const range of model.ranges) {
    assert.equal(model.normalizeRange(range), range);
    assert.equal(model.normalizeRange("  " + range.toUpperCase() + "  "), range);
}
for (const invalid of [undefined, null, "", "unknown", "today", 42]) {
    assert.equal(model.normalizeRange(invalid), "day");
}

const trip = (countedTimeElapsedMilliseconds, allottedTimeMilliseconds, available = true) => ({
    trip: { countedTimeElapsedMilliseconds, allottedTimeMilliseconds, available }
});
assert.equal(model.liveEffectiveMilliseconds(trip(10_000, 15_000), true), 15_000,
    "live projection uses allotted time when greater than counted time");
assert.equal(model.liveEffectiveMilliseconds(trip(20_000, 15_000), true), 20_000,
    "live projection never falls below counted time");
assert.equal(model.liveEffectiveMilliseconds(trip(20_000, undefined), true), 20_000,
    "missing allotted time falls back to counted time");
assert.equal(model.liveEffectiveMilliseconds(trip(20_000, -1), true), 20_000,
    "invalid allotted time falls back to counted time");
assert.equal(model.liveEffectiveMilliseconds(trip(-1, 15_000), true), undefined,
    "negative counted time is rejected");
assert.equal(model.liveEffectiveMilliseconds(trip(Number.MAX_SAFE_INTEGER + 1, 15_000), true), undefined,
    "unsafe counted time is rejected");
assert.equal(model.liveEffectiveMilliseconds(trip(10_000, 15_000, false), true), undefined,
    "unavailable trip data is rejected");
assert.equal(model.liveEffectiveMilliseconds(trip(10_000, 15_000), false), undefined,
    "projection is only calculated for a live trip");
assert.equal(model.liveEffectiveMilliseconds(null, true), undefined,
    "missing summary is rejected");
console.log("PASS trip log range and live projection model");
