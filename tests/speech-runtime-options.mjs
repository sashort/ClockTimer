import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {URLSearchParams};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../SpeechRuntimeOptions.js", import.meta.url), "utf8"), sandbox);
const options = sandbox.ClockTimerSpeechRuntimeOptions;
assert.ok(options, "speech runtime options register their API");
assert.deepEqual(JSON.parse(JSON.stringify(options.read("", "asset 1", "rev/2"))), {
    version: "?sherpa=asset%201&runtime=rev%2F2",
    diagnosticsEnabled: false,
    pipeline: "raw"
});
assert.deepEqual(JSON.parse(JSON.stringify(options.read("?speech-diagnostics&speech-pipeline=silero", "x", "y"))), {
    version: "?sherpa=x&runtime=y",
    diagnosticsEnabled: true,
    pipeline: "silero"
});
assert.equal(options.read("?speech-pipeline=unknown", "x", "y").pipeline, "raw");
assert.equal(options.read("?speech-diagnostics=false", "x", "y").diagnosticsEnabled, true,
    "diagnostics flag is enabled by presence, regardless of value");
console.log("PASS speech runtime options");
