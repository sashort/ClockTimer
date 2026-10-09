import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripPreferencesModel.js", import.meta.url), "utf8"), sandbox);
vm.runInContext(readFileSync(new URL("../TripPreferencesStore.js", import.meta.url), "utf8"), sandbox);

let stored = JSON.stringify({ lateBreakBehavior: "autoRestartTrip", syncGoals: true });
let reads = 0;
let writes = 0;
const store = sandbox.ClockTimerTripPreferencesStore.create({
    key: "clocktimer.tripPreferences",
    getItem(key) {
        reads++;
        assert.equal(key, "clocktimer.tripPreferences");
        return stored;
    },
    setItem(key, value) {
        writes++;
        assert.equal(key, "clocktimer.tripPreferences");
        stored = value;
    }
});

assert.deepEqual(JSON.parse(JSON.stringify(store.read())), {
    lateBreakBehavior: "autoRestartTrip",
    syncGoals: true
});
assert.equal(reads, 1);

const saved = store.save({ lateBreakBehavior: "invalid", syncGoals: 0 });
assert.deepEqual(JSON.parse(JSON.stringify(saved)), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.deepEqual(JSON.parse(stored), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});
assert.equal(writes, 1);

stored = "{invalid";
assert.deepEqual(JSON.parse(JSON.stringify(store.read())), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});

const unavailable = sandbox.ClockTimerTripPreferencesStore.create({
    getItem() { throw new Error("storage unavailable"); },
    setItem() {}
});
assert.deepEqual(JSON.parse(JSON.stringify(unavailable.read())), {
    lateBreakBehavior: "showLateWindow",
    syncGoals: false
});

console.log("PASS trip preference store reads, normalizes, persists, and recovers from storage failures");
