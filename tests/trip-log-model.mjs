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
console.log("PASS trip log range model supported values, normalization, and fallback");
