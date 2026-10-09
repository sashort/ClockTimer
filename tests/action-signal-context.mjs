import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ActionSignalContext.js", import.meta.url), "utf8"), sandbox);
const context = sandbox.ClockTimerActionSignalContext;
assert.ok(context, "action signal context registers its API");
const actionSignal = {name: "action"};
const stateSignal = {name: "state"};
assert.equal(context.currentSignal({invocationContext: {signal: actionSignal}},
    {current: {signal: stateSignal}}), actionSignal, "action invocation signal takes precedence");
assert.equal(context.currentSignal({}, {current: {signal: stateSignal}}), stateSignal,
    "state transaction signal is the fallback");
assert.equal(context.currentSignal({}, {}), undefined);
assert.equal(context.currentSignal(null, null), undefined);
console.log("PASS action signal context");
