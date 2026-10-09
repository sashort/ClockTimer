import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../LiveStreamViewModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerLiveStreamViewModel;
assert.ok(model, "live-stream view model registers its API");

assert.deepEqual(JSON.parse(JSON.stringify(model.project({
    uiState: {
        state: "trip_in_progress",
        time_component: {text: "12:34"},
        current_percent_component: {text: "82%"},
        goal_component: {text: "90%"}
    }
})), {state: "trip in progress", time: "12:34", goal: "82% / 90%"});
assert.deepEqual(JSON.parse(JSON.stringify(model.project({
    state: "break_active",
    timeComponent: {text: "04:00"},
    currentPercentComponent: {text: "45%"}
})), {state: "break active", time: "04:00", goal: "45%"});
assert.deepEqual(JSON.parse(JSON.stringify(model.project({
    goalComponent: {text: "100%"}
})), {state: "—", time: "—", goal: "100%"});
assert.deepEqual(JSON.parse(JSON.stringify(model.project(null)),
    {state: "—", time: "—", goal: "—"});
console.log("PASS live-stream snapshot view model");
