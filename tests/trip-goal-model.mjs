import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripGoalModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripGoalModel;
assert.ok(model, "trip goal model registers its public API");

const tripGoal = {percentGoal: 0.8};
const totalGoal = {percentGoal: 0.6};
assert.deepEqual(model.selectGoal({summary:{scope:"trip",trip:tripGoal,total:totalGoal}}),
    {scope:"trip",selected:tripGoal}, "trip scope selects trip goal");
assert.deepEqual(model.selectGoal({summary:{scope:"total",trip:tripGoal,total:totalGoal}}),
    {scope:"total",selected:totalGoal}, "total scope selects total goal");
const explicitGoal = {percentGoal: 0.9};
assert.deepEqual(model.selectGoal({summary:{scope:"trip",selected:explicitGoal,trip:tripGoal}}),
    {scope:"trip",selected:explicitGoal}, "explicit selected goal takes precedence");
assert.deepEqual(model.selectGoal(null), {scope:"",selected:undefined},
    "missing summary has a stable empty selection");

const detail = (scope, selected, extra = {}) => ({summary:{scope, selected, ...extra}});
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
console.log("PASS trip goal remaining-time calculation and invalid-state handling");
