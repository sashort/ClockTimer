import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {console};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../LiveStreamPublisher.js", import.meta.url), "utf8"), sandbox);
const factory = sandbox.ClockTimerLiveStreamPublisher;
assert.ok(factory, "live-stream publisher registers its factory");

const calls = [];
const warnings = [];
let speechStarted = true;
let desired = true;
const stream = {
    publishing: false,
    async startPublishing(options) { calls.push(["start", options]); this.publishing = true; },
    async refreshPublisherMicrophone() { calls.push(["refresh-microphone"]); },
    async stopPublishing() { calls.push(["stop"]); this.publishing = false; }
};
const controller = factory.create({
    getStream: () => stream,
    getProfile: () => ({id: 5}),
    getNetworkStatus: () => "online",
    isSpeechStarted: () => speechStarted,
    shouldPublish: () => desired,
    logger: {warn: (...args) => warnings.push(args)}
});
assert.equal(await controller.sync(), true);
assert.deepEqual(JSON.parse(JSON.stringify(calls)),
    [["start", {requestMicrophone: false}], ["refresh-microphone"]]);
assert.equal(await controller.sync(), true, "already-publishing stream is left alone");
assert.equal(calls.length, 2);
desired = false;
assert.equal(await controller.sync(), false);
assert.deepEqual(calls[2], ["stop"]);

const missing = factory.create({
    getStream: () => undefined,
    getProfile: () => null,
    getNetworkStatus: () => "offline",
    shouldPublish: () => false
});
assert.equal(await missing.sync(), false, "missing stream is a no-op");

const broken = factory.create({
    getStream: () => ({publishing: false, async startPublishing() { throw new Error("network"); }}),
    getProfile: () => ({id: 5}),
    getNetworkStatus: () => "online",
    shouldPublish: () => true,
    logger: {warn: (...args) => warnings.push(args)}
});
assert.equal(await broken.sync(), false, "publish failure is converted to false");
assert.equal(warnings.length, 1);
console.log("PASS live-stream publisher controller");
