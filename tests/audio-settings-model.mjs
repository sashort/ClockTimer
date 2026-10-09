import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = { Object, Number, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioSettingsModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.WMOFAudioSettingsModel;
const plain = value => JSON.parse(JSON.stringify(value));

assert.equal(model.normalizeChimeRate("not a rate"), 1);
assert.equal(model.normalizeChimeRate(0.81), 0.8);
assert.equal(model.normalizeChimeRate(1.19), 1.2);
assert.equal(model.savedChimeRate(1.25, 1), 1);
assert.equal(model.savedChimeRate(1.5, 1), 1.2);
assert.equal(model.savedChimeRate(1.2, 2), 1.2);
assert.equal(model.formatChimeRate(0.8), "Slow");
assert.equal(model.audioVelocityPercent(1.4, 2.8), 50);
assert.equal(model.audioVelocityPercent(3, 0), 0);
assert.equal(model.formatAudioVelocityPercent(1.4, 2.8), "50%");
assert.equal(model.stepAudioVelocity(1.4, 0.5, 2.8, 5), 1.54);
assert.equal(model.stepAudioVelocity(0.5, 0.5, 2.8, -20), 0.5);
assert.equal(model.audioVelocityAtPercent(50, 0.5, 2.8), 1.4);
assert.equal(model.audioVelocityAtPercent(0, 0.5, 2.8), 0.5);
assert.equal(model.audioVolumeAtPercent(45), 0.45);
assert.equal(model.stepAudioVolume(0.5, 5), 0.55);
assert.equal(model.stepAudioVolume(0.02, -10), 0);
assert.equal(model.CHIME_VOLUME_RATIO, 0.5);
assert.equal(model.AUDIO_PERCENT_STEP, 5);
assert.equal(model.AUDIO_SPEECH_VELOCITY_MIN, 0.5);
assert.equal(model.AUDIO_SPEECH_VELOCITY_MAX, 2.8);
assert.deepEqual(Array.from(model.CHIME_RATES, rate => rate.label), ["Slow", "Medium", "Fast"]);
const audioSettings = model.create({
    announcements: [["trip.start", "Trip start"], ["break.start", "Break start"]],
    language: "fr-FR"
});
const defaults = audioSettings.defaultAudioSettings();
assert.deepEqual(plain(audioSettings.read(null)), plain(defaults));
assert.deepEqual(plain(audioSettings.read("{broken")), plain(defaults));
assert.deepEqual(plain(audioSettings.read(JSON.stringify({ volume: 0.4 }))).volume, 0.4);
assert.equal(audioSettings.serialize({ volume: 0.4 }), '{"volume":0.4}');
assert.deepEqual(Object.keys(defaults.rows), ["trip.start", "break.start"]);
assert.deepEqual(plain(defaults.voices["fr-FR"]), { provider: "system", voice: "" });
assert.equal(defaults.rows["trip.start"].enabled, true);

const normalized = audioSettings.normalizeAudioSettings({
    volume: 2,
    masterVelocity: 5,
    speechVelocity: 99,
    toneVelocity: 1.5,
    chimeRateVersion: 1,
    instrument: "  piano  ",
    voices: { "fr-FR": { provider: " custom ", voice: " Alice " } },
    formalTime: true,
    masters: { chime: false, summary: "false" },
    rows: {
        "trip.start": {
            enabled: false,
            chime: -1,
            summary: 1,
            details: 0,
            custom: { volume: 2, speechVelocity: 4, toneVelocity: 1.5 }
        },
        "unknown.event": { enabled: false }
    }
});
assert.equal(normalized.volume, 1);
assert.equal(normalized.masterVelocity, 4);
assert.equal(normalized.speechVelocity, 2.8);
assert.equal(normalized.toneVelocity, 1.2);
assert.equal(normalized.instrument, "piano");
assert.equal(normalized.formalTime, true);
assert.equal(normalized.masters.chime, false);
assert.equal(normalized.masters.summary, true);
assert.deepEqual(plain(normalized.voices["fr-FR"]), { provider: "custom", voice: "Alice" });
assert.equal(normalized.rows["trip.start"].enabled, false);
assert.equal(normalized.rows["trip.start"].chime, -1);
assert.equal(normalized.rows["trip.start"].summary, 0, "unsupported row layer values fall back to defaults");
assert.equal(normalized.rows["trip.start"].details, 0);
assert.deepEqual(plain(normalized.rows["trip.start"].custom), { volume: 1, speechVelocity: 2.8, toneVelocity: 1.2 });
assert.equal(normalized.rows["unknown.event"], undefined);

console.log("PASS audio settings normalization, legacy rate migration, defaults, and slider scaling");
