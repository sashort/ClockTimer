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
assert.deepEqual(Array.from(model.productionFilters), ["all", "productive", "non-productive"]);
for (const filter of model.productionFilters) {
    assert.equal(model.normalizeProductionFilter(filter), filter);
}
for (const invalid of [undefined, null, "", "productive-only", 42]) {
    assert.equal(model.normalizeProductionFilter(invalid), "all",
        "invalid production filter falls back to all");
}
for (const range of model.ranges) {
    assert.equal(model.normalizeRange(range), range);
    assert.equal(model.normalizeRange("  " + range.toUpperCase() + "  "), range);
}
for (const invalid of [undefined, null, "", "unknown", "today", 42]) {
    assert.equal(model.normalizeRange(invalid), "day");
}
let storedRangeReads = 0;
assert.equal(model.resolveRange("month", () => { storedRangeReads++; return "week"; }), "month");
assert.equal(storedRangeReads, 0, "selected range takes precedence without reading storage");
assert.equal(model.resolveRange(undefined, () => { storedRangeReads++; return "week"; }), "week");
assert.equal(storedRangeReads, 1, "storage is consulted only when selection is nullish");
assert.equal(model.resolveRange(null, () => undefined), "day");


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

assert.equal(model.userFacingTotalText("Total counted: 82%", "Total"), "Total counted: 82%",
    "default Total label leaves text unchanged");
assert.equal(model.userFacingTotalText("Total counted; Total elapsed", "Week"), "Week counted; Week elapsed",
    "localized scope labels replace each whole-word Total");
assert.equal(model.userFacingTotalText("Totality is unrelated to Total", "Month"), "Totality is unrelated to Month",
    "scope replacement does not alter words containing Total");
assert.equal(model.userFacingTotalText(null, "Year"), "",
    "missing display text normalizes to an empty string");
assert.equal(model.includeCurrent("true"), true);
assert.equal(model.includeCurrent(true), false, "storage values are compared as the literal string true");
assert.equal(model.includeCurrent("false"), false);
assert.equal(model.pinned("false"), false);
assert.equal(model.pinned(undefined), true, "pinning defaults on when no stored value exists");
assert.equal(model.pinnedInput(false), false);
assert.equal(model.pinnedInput("false"), true, "setter preserves strict boolean-false semantics");


const offlineWindow = {startTime: "2026-10-01T00:00:00Z", endTime: "2026-11-01T00:00:00Z"};
const offlineResult = model.offlineTrips({
    cachedTrips: [
        {id: 1, startTime: "2026-10-02T08:00:00Z", nonProduction: false, source: "cache"},
        {id: 2, startTime: "2026-10-03T08:00:00Z", nonProduction: true},
        {id: 3, startTime: "2026-11-01T00:00:00Z", nonProduction: false}
    ],
    localTrips: [
        {id: 1, startTime: "2026-10-02T09:00:00Z", nonProduction: false, source: "local"},
        {id: 4, startTime: "2026-10-04T08:00:00Z", nonProduction: false}
    ],
    window: offlineWindow,
    productionFilter: "productive"
});
assert.deepEqual(JSON.parse(JSON.stringify(offlineResult.allTrips.map(trip => trip.id))), [1, 2, 3, 4]);
assert.equal(offlineResult.allTrips.find(trip => String(trip.id) === "1").source, "local",
    "local trip data overrides the cached record with the same ID");
assert.deepEqual(JSON.parse(JSON.stringify(offlineResult.trips.map(trip => String(trip.id)))), ["1", "4"],
    "offline trip projection filters by date window and production status");
assert.equal(offlineResult.offline, true);
assert.equal(offlineResult.incomplete, true);
assert.equal(offlineResult.loginRequired, false);
const noLogin = model.offlineTrips({localTrips: [], window: offlineWindow, loginRequired: true});
assert.deepEqual(JSON.parse(JSON.stringify(noLogin.allTrips)), [],
    "login-required projection suppresses cached and local records");

console.log("PASS trip log range, live projection, and scope text model");
