import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {console};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../SessionStartup.js", import.meta.url), "utf8"), sandbox);
const startup = sandbox.ClockTimerSessionStartup;
assert.ok(startup, "session startup registers its API");

const immediate = [];
assert.equal(await startup.start({
    pending: false,
    showInitialLoginDialog: () => immediate.push("login")
}), false);
assert.deepEqual(immediate, ["login"], "non-landing page opens login synchronously");

const calls = [];
let confirmed = false;
let pending = true;
const result = await startup.start({
    pending: true,
    clockTimer: {async resumeConnection() { calls.push("resume"); return true; }},
    isLoginConfirmed: () => confirmed,
    onLoginConfirmed: () => { confirmed = true; calls.push("confirmed"); },
    onDeliberatelyLoggedOut: () => calls.push("logout-reset"),
    onPendingComplete: () => { pending = false; calls.push("complete"); },
    persistDeliberatelyLoggedOut: () => calls.push("persist"),
    showInitialLoginDialog: () => calls.push("login"),
    syncNetworkStatusUI: () => calls.push("network-ui"),
    isSpeechTimingRequested: () => true,
    openSpeechTiming: async () => { calls.push("speech-timing"); },
    logger: {warn: (...args) => calls.push(["warn", ...args]), error: (...args) => calls.push(["error", ...args])}
});
await Promise.resolve();
assert.equal(result, true);
assert.equal(pending, false);
assert.deepEqual(calls, ["resume", "confirmed", "logout-reset", "persist", "complete", "network-ui", "speech-timing"]);

const failedCalls = [];
await startup.start({
    pending: true,
    clockTimer: {async resumeConnection() { throw new Error("offline"); }},
    onPendingComplete: () => failedCalls.push("complete"),
    showInitialLoginDialog: () => failedCalls.push("login"),
    logger: {warn: () => failedCalls.push("warn")}
});
assert.deepEqual(failedCalls, ["warn", "complete", "login"]);
console.log("PASS session startup orchestration");
