import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function runtime() {
    const appended = [];
    const sandbox = {
        Promise, JSON, Error, Object,
        document: {
            createElement: () => ({ dataset: {}, src: "", onload: null, onerror: null }),
            head: { append: script => appended.push(script) }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../AudioSettingsStartup.js", import.meta.url), "utf8"), sandbox);
    return { sandbox, appended };
}

{
    const { sandbox, appended } = runtime();
    sandbox.WMOFAudioSettingsModel = { ready: true };
    assert.equal(await sandbox.ClockTimerAudioSettingsStartup.ensureModel(), sandbox.WMOFAudioSettingsModel);
    assert.equal(appended.length, 0, "already loaded model is reused");
}

{
    const { sandbox } = runtime();
    const context = {
        host: "settings-frame",
        surface: "audioSettingsDialog",
        presentation: "graphical-settings",
        features: ["settings"],
        capabilities: { speechMenu: false },
        options: {}
    };
    const calls = [];
    const resources = {
        async loadScript(url, passedContext, options) {
            calls.push({ url, passedContext, options });
            sandbox.WMOFAudioSettingsModel = { loaded: true };
        }
    };
    const model = await sandbox.ClockTimerAudioSettingsStartup.ensureModel({ context, resources });
    assert.equal(model.loaded, true);
    assert.equal(calls[0].url, "AudioSettingsModel.js?build=audio-settings-model-3");
    assert.equal(calls[0].passedContext, context);
    assert.equal(calls[0].options.async, true);
}

{
    const { sandbox, appended } = runtime();
    const context = { host: "drop-in", features: ["settings"], capabilities: { speechMenu: false } };
    const pending = sandbox.ClockTimerAudioSettingsStartup.ensureModel({ context });
    assert.equal(appended.length, 1);
    const script = appended[0];
    assert.equal(script.dataset.clocktimerContext, "drop-in");
    assert.equal(JSON.parse(script.dataset.clocktimerContextData).capabilities.speechMenu, false);
    sandbox.WMOFAudioSettingsModel = { loaded: true };
    script.onload();
    assert.equal((await pending).loaded, true);
}
console.log("PASS audio settings model loading, context propagation, and duplicate-load avoidance");
