import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripGoalModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripGoalModel;
assert.ok(model, "trip goal model registers its public API");
assert.deepEqual(Array.from(model.percentModes), ["trip", "total", "auto"],
    "goal scope modes are exported as a stable ordered list");

assert.equal(model.syncRuntimeState({connectionStatus: "offline", syncGoalsEnabled: true, tripLive: true}),
    "offline", "offline status takes precedence");
assert.equal(model.syncRuntimeState({connectionStatus: "online", syncGoalsEnabled: false, tripLive: true}),
    "off", "disabled sync goals are off");
assert.equal(model.syncRuntimeState({connectionStatus: "online", syncGoalsEnabled: true, tripLive: false}),
    "ready", "enabled sync goals wait until a trip is live");
assert.equal(model.syncRuntimeState({connectionStatus: "online", syncGoalsEnabled: true, tripLive: true,
    requirements: {tripGoal: 120, adjustedTimeElapsed: 30}}), "active",
    "positive finite goal requirements activate sync goals");
for (const requirements of [undefined, {}, {tripGoal: 0, adjustedTimeElapsed: 30},
    {tripGoal: 120, adjustedTimeElapsed: 0}, {tripGoal: "invalid", adjustedTimeElapsed: 30}]) {
    assert.equal(model.syncRuntimeState({connectionStatus: "online", syncGoalsEnabled: true,
        tripLive: true, requirements}), "time-blocked",
        "missing or invalid goal requirements block sync runtime");
}

for (const mode of ["trip", "total", "auto"]) {
    assert.equal(model.normalizePercentMode(mode), mode, `valid goal scope ${mode} is retained`);
    assert.equal(model.normalizePercentMode(` ${mode.toUpperCase()} `), mode,
        `goal scope ${mode} is case- and whitespace-insensitive`);
}
for (const invalid of [undefined, null, "", "unknown", 42]) {
    assert.equal(model.normalizePercentMode(invalid), "trip",
        "invalid goal scope falls back to trip");
}

const tripGoal = {percentGoal: 0.8};
const totalGoal = {percentGoal: 0.6};
let selection = model.selectGoal({summary:{scope:"trip",trip:tripGoal,total:totalGoal}});
assert.equal(selection.scope, "trip");
assert.equal(selection.selected, tripGoal, "trip scope selects trip goal");
selection = model.selectGoal({summary:{scope:"total",trip:tripGoal,total:totalGoal}});
assert.equal(selection.scope, "total");
assert.equal(selection.selected, totalGoal, "total scope selects total goal");
const explicitGoal = {percentGoal: 0.9};
selection = model.selectGoal({summary:{scope:"trip",selected:explicitGoal,trip:tripGoal}});
assert.equal(selection.selected, explicitGoal, "explicit selected goal takes precedence");
selection = model.selectGoal(null);
assert.equal(selection.scope, "");
assert.equal(selection.selected, undefined, "missing summary has a stable empty selection");

const detail = (scope, selected, extra = {}) => ({summary:{scope, selected, ...extra}});
assert.deepEqual(
    Object.assign({}, model.labelDescriptor(detail("standard", {percentGoal: 0.5}))),
    {kind:"standard",scope:"standard",percent:50},
    "standard scope uses the standard label");
assert.deepEqual(
    Object.assign({}, model.labelDescriptor(detail("trip", {percentGoal: 1}))),
    {kind:"standard",scope:"trip",percent:100},
    "100 percent uses the standard label");
assert.deepEqual(
    Object.assign({}, model.labelDescriptor(detail("total", {percentGoal: 0.75}))),
    {kind:"percent",scope:"total",percent:75},
    "non-standard total goal retains scope and rounded percentage");
assert.equal(model.labelDescriptor(detail("trip", {})).kind, "empty",
    "missing percentage produces no label");
assert.equal(model.remainingMilliseconds(detail("trip", {
    standardTimeMilliseconds: 60_000,
    countedTimeElapsedMilliseconds: 20_000,
    percentGoal: 1
})), 40_000, "standard trip goal remaining time");
assert.equal(model.remainingMilliseconds(detail("total", undefined, {
    total: {standardTimeMilliseconds: 120_000, countedTimeElapsedMilliseconds: 50_000, percentGoal: 0.5}
})), 190_000, "total scope selects total goal and applies its percent");
assert.equal(model.remainingMilliseconds(detail("trip", {
    standardTimeMilliseconds: 60_000,
    countedTimeElapsedMilliseconds: 20_000,
    percentGoal: 1,
    allowanceCreditMilliseconds: 5_000
})), 45_000, "allowance credit is included");
assert.equal(model.remainingMilliseconds(detail("trip", {
    standardTimeMilliseconds: 60_000,
    countedTimeElapsedMilliseconds: 20_000,
    percentGoal: 0
})), undefined, "non-positive goal percentages are rejected");
assert.equal(model.remainingMilliseconds(null), undefined, "missing goal state is rejected");

assert.equal(model.remainingOutcome(1), "banked", "positive remaining time is banked");
assert.equal(model.remainingOutcome(-1), "over", "negative remaining time is over goal");
assert.equal(model.remainingOutcome(0), "on-target", "zero remaining time is exactly on target");
assert.equal(model.remainingOutcome(undefined), "unknown", "missing remaining time is unknown");
assert.equal(model.remainingOutcome(NaN), "unknown", "non-finite remaining time is unknown");
assert.deepEqual(
    Object.assign({}, model.remainingDescriptor(detail("trip", {
        standardTimeMilliseconds: 60_000,
        countedTimeElapsedMilliseconds: 20_000,
        percentGoal: 1
    }))),
    {remaining:40_000,outcome:"banked",magnitude:40_000},
    "remaining descriptor reports positive time as banked");
assert.deepEqual(
    Object.assign({}, model.remainingDescriptor(detail("trip", {
        standardTimeMilliseconds: 60_000,
        countedTimeElapsedMilliseconds: 80_000,
        percentGoal: 1
    }))),
    {remaining:-20_000,outcome:"over",magnitude:20_000},
    "remaining descriptor reports absolute overage magnitude");
assert.deepEqual(
    Object.assign({}, model.remainingDescriptor(null)),
    {remaining:undefined,outcome:"unknown",magnitude:undefined},
    "remaining descriptor preserves unavailable calculations");

assert.equal(model.countedPercent({summary:{total:{countedPercent:82.5}}}), 82.5,
    "total counted percentage is preserved");
assert.equal(model.countedPercent({summary:{total:{countedPercent:"42"}}}), 42,
    "numeric percentage strings retain Number conversion semantics");
assert.equal(Number.isNaN(model.countedPercent({summary:{total:{}}})), true,
    "missing counted percentage remains non-finite");
assert.equal(Number.isNaN(model.countedPercent(null)), true,
    "missing total summary remains non-finite");

assert.equal(model.formatSummaryPercent(0.823), "82%",
    "summary percentages round to whole percent");
assert.equal(model.formatSummaryPercent(1), "100%",
    "summary percentages preserve exact whole values");
assert.equal(model.formatSummaryPercent("not-a-number"), "---",
    "invalid summary percentages use the fallback");
assert.equal(model.formatSummaryPercent(undefined, "n/a"), "n/a",
    "summary percentage fallback is configurable");
assert.equal(model.formatActualPercent(0.8236), "82.36%",
    "actual percentages display two decimal places");
assert.equal(model.formatActualPercent(1), "100.00%",
    "actual percentages retain two decimal places for whole values");
assert.equal(model.formatActualPercent("invalid"), "---",
    "invalid actual percentages use the fallback");
assert.equal(model.formatActualPercent(undefined, "n/a"), "n/a",
    "actual percentage fallback is configurable");
console.log("PASS trip goal calculations, outcome classification, total percentage extraction, and percentage formatting");
