import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox = { Object, Boolean, String, TypeError };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TripLogPinController.js", import.meta.url), "utf8"), sandbox);
const app = { dataset: {} }, attrs = {};
const pin = { setAttribute: (k,v) => attrs[k]=v, title: "" };
const log = { setAttribute: (k,v) => attrs["log:"+k]=v, removeAttribute: k => delete attrs["log:"+k] };
const saved = [];
const result = sandbox.ClockTimerTripLogPinController.setPinned(true, {
 appElement: app, pinButton: pin, tripLogButton: log, persist: true,
 storageKey: "pinned", writeStorage: (...v) => saved.push(v)
});
assert.equal(result, true);
assert.equal(app.dataset.tripLogPinned, "true");
assert.equal(attrs["aria-pressed"], "true");
assert.equal(attrs["aria-label"], "Unpin Trip Log");
assert.equal(log.inert, false);
assert.deepEqual(saved, [["pinned","true"]]);
sandbox.ClockTimerTripLogPinController.setPinned(false, {appElement: app, pinButton: pin, tripLogButton: log});
assert.equal(log.inert, true);
assert.equal(attrs["log:aria-hidden"], "true");
assert.throws(() => sandbox.ClockTimerTripLogPinController.setPinned(true), /app element is required/);
console.log("PASS trip log pin state, accessibility, and persistence");
