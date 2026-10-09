import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ConnectionStatusModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerConnectionStatusModel;
assert.ok(model, "connection status model registers its API");
assert.equal(model.normalize("online"), "online");
for (const status of ["offline", "pending", undefined, null, "unknown"]) {
    assert.equal(model.normalize(status), "offline");
}
assert.equal(model.visualStatus("online", "steady"), "online");
assert.equal(model.visualStatus("offline", "steady"), "offline");
assert.equal(model.visualStatus("pending", "steady"), "pending");
assert.equal(model.visualStatus("online", "retry"), "pending");
assert.equal(model.visualStatus("offline", "awaiting-login"), "pending");
assert.equal(model.visualStatus("pending", "retry"), "pending");
console.log("PASS connection status model");
