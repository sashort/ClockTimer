import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripPreferencesModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTripPreferencesModel;

assert.ok(model, "model registers its public API");
assert.deepEqual(JSON.parse(JSON.stringify(model.defaults)), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.deepEqual(JSON.parse(JSON.stringify(model.normalize({
    lateBreakBehavior: "autoRestartTrip",
    syncGoals: 1,
    unrelated: "ignored"
}))), {
    lateBreakBehavior: "autoRestartTrip",
    syncGoals: true
});
assert.deepEqual(JSON.parse(JSON.stringify(model.normalize({
    lateBreakBehavior: "invalid",
    syncGoals: null
}))), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.deepEqual(JSON.parse(JSON.stringify(model.read(JSON.stringify({
    lateBreakBehavior: "autoRestartTrip",
    syncGoals: true
})))), {
    lateBreakBehavior: "autoRestartTrip",
    syncGoals: true
});
assert.deepEqual(JSON.parse(JSON.stringify(model.read("{broken"))), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.deepEqual(JSON.parse(JSON.stringify(model.read(null))), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.equal(model.serialize({ lateBreakBehavior: "autoRestartTrip", syncGoals: true }),
    '{"lateBreakBehavior":"autoRestartTrip","syncGoals":true}');
assert.equal(model.serialize({ lateBreakBehavior: "invalid", syncGoals: 0 }),
    '{"lateBreakBehavior":"showLateWindow","syncGoals":false}');
console.log("PASS trip preference model defaults, normalization, serialization, JSON parsing, and invalid storage recovery");
