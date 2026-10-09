import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../TimerDisplayModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerTimerDisplayModel;

assert.ok(model, "timer display model registers its public API");
assert.deepEqual(Array.from(model.modes), ["remaining", "calculated-end", "elapsed"]);
for (const mode of model.modes) {
    assert.equal(model.normalize(mode), mode, `valid mode ${mode} is preserved`);
}
for (const invalid of [undefined, null, "", "Remaining", "unknown", 42]) {
    assert.equal(model.normalize(invalid), "remaining", "invalid mode falls back to remaining");
}
assert.equal(model.clockTimerAttribute("remaining"), "time_remaining");
assert.equal(model.clockTimerAttribute("calculated-end"), "calculated_end_time");
assert.equal(model.clockTimerAttribute("elapsed"), "calculated_start_time");
assert.equal(model.clockTimerAttribute("invalid"), "time_remaining",
    "invalid mode maps through the remaining fallback");
console.log("PASS rendered-time mode normalization and ClockTimer attribute mapping");
