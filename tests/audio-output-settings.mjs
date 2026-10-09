import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = { Object, TypeError };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioOutputSettings.js", import.meta.url), "utf8"), sandbox);
let configured, synced = 0;
sandbox.WMOFAudioOutputSettings.apply({
    settings: { volume: 0.8, speechVelocity: 1.4, toneVelocity: 1.2, instrument: "bell" },
    voiceSelection: { provider: "local", voice: "A" },
    language: "en-US",
    chimeVolumeRatio: 0.5,
    audio: { configureOutput: value => { configured = value; } },
    syncAdaptiveTimingRate: () => { synced++; }
});
assert.deepEqual(JSON.parse(JSON.stringify(configured)), {
    speechVolume: 0.8, toneVolume: 0.4, speechVelocity: 1.4, toneVelocity: 1.2,
    instrument: "bell", speechLanguage: "en-US", voiceProvider: "local", voice: "A"
});
assert.equal(synced, 1);
let noAudioSynced = 0;
sandbox.WMOFAudioOutputSettings.apply({
    settings: { volume: 1, speechVelocity: 1, toneVelocity: 1, instrument: "default" },
    audio: null,
    syncAdaptiveTimingRate: () => noAudioSynced++
});
assert.equal(noAudioSynced, 1);
assert.throws(() => sandbox.WMOFAudioOutputSettings.apply({}), /Audio settings are required/);
console.log("PASS audio output settings adapter configuration and optional runtime handling");
