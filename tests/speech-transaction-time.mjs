import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {Date};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../SpeechTransactionTime.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerSpeechTransactionTime;
assert.ok(model, "speech transaction time helper registers its API");
assert.equal(model.fromExecutionContext(null), undefined);
assert.equal(model.fromExecutionContext({}), undefined);
assert.equal(model.fromExecutionContext({utteranceStartedAt: 0}), undefined,
    "falsy timestamps retain the existing no-timestamp behavior");
assert.equal(model.fromExecutionContext({utteranceStartedAt: "not a date"}), undefined);
const date = model.fromExecutionContext({utteranceStartedAt: "2026-10-09T12:30:00Z"});
assert.ok(date instanceof Date);
assert.equal(date.toISOString(), "2026-10-09T12:30:00.000Z");
console.log("PASS speech transaction time");
