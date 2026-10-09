import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../DropInViewModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerDropInViewModel;
assert.ok(model, "Drop-In view model registers its public API");
assert.equal(model.volumePercent(0), 0);
assert.equal(model.volumePercent(0.456), 46, "volume values are rounded to whole percentages");
assert.equal(model.volumePercent(1), 100);
assert.equal(model.volumePercent(-0.5), 0, "volume values clamp at zero");
assert.equal(model.volumePercent(1.5), 100, "volume values clamp at one");
assert.equal(model.volumePercent("invalid"), 0, "invalid volume values normalize to zero");

const rules = {weekStartDay: 6, cutoffTime: "00:00:00", irrelevant: "omit"};
const result = model.create({
    summary: {
        trip: {available: true, standardTimeMilliseconds: 100, countedTimeElapsedMilliseconds: 40, percentGoal: 0.8, ignored: true},
        total: {percentGoal: 0.7, standardTimeMilliseconds: 500, countedTimeElapsedMilliseconds: 200, allowanceCreditMilliseconds: 10, ignored: true}
    },
    microphone: {muted: false},
    timeDisplay: "elapsed",
    model: {state: "running"},
    appearance: {timerMode: "elapsed"},
    mode: "total",
    range: "custom",
    customDates: {start: "2026-10-01", end: "2026-10-09"},
    active: true,
    tripId: 12,
    tripStart: "2026-10-09T12:00:00.000Z",
    nonProduction: false,
    productionFilter: "all",
    calendars: [{profile: "walmart-us", searchedYear: 2026, timezone: "America/New_York", rules}]
});
assert.deepEqual(JSON.parse(JSON.stringify(result.summary)), {
    trip: {available: true, standardTimeMilliseconds: 100, countedTimeElapsedMilliseconds: 40, percentGoal: 0.8},
    total: {percentGoal: 0.7, standardTimeMilliseconds: 500, countedTimeElapsedMilliseconds: 200, allowanceCreditMilliseconds: 10}
});
assert.deepEqual(JSON.parse(JSON.stringify(result.customDates)), {start: "2026-10-01", end: "2026-10-09"});
assert.deepEqual(JSON.parse(JSON.stringify(result.calendars[0])), {
    profile: "walmart-us",
    searchedYear: 2026,
    timezone: "America/New_York",
    rules: {weekStartDay: 6, cutoffTime: "00:00:00"}
});
assert.equal(result.microphone.muted, false);
assert.equal(result.active, true);
assert.equal(result.tripId, 12);
assert.equal(result.summary.trip.ignored, undefined, "projection omits unneeded trip fields");

const noCustomRange = model.create({range: "week", customDates: {start: "a", end: "b"}});
assert.equal(noCustomRange.customDates, null, "custom dates are hidden outside custom range");
assert.equal(noCustomRange.summary.total, null, "missing total summary is represented as null");
assert.equal(noCustomRange.active, false, "missing active state normalizes to false");
console.log("PASS Drop-In view snapshot projection and field filtering");
