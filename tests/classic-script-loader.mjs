import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function runtime() {
    const scripts = [];
    const document = {
        querySelectorAll(selector) {
            assert.equal(selector, "script[data-runtime-source]");
            return scripts;
        },
        createElement(tag) {
            assert.equal(tag, "script");
            return {
                dataset: {},
                handlers: {},
                addEventListener(type, callback) { this.handlers[type] = callback; }
            };
        },
        head: { append(script) { scripts.push(script); } }
    };
    const sandbox = {
        document,
        URL,
        Promise,
        Map,
        Object,
        Array,
        JSON,
        TypeError,
        Error
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../ClassicScriptLoader.js", import.meta.url), "utf8"), sandbox);
    const loader = sandbox.ClockTimerClassicScriptLoader.create({
        documentRef: document,
        context: {
            host: "settings-frame",
            surface: "audioSettingsDialog",
            presentation: "graphical-settings",
            features: ["settings"],
            capabilities: { speechMenu: false, calendarStartup: false },
            options: { parentHost: "drop-in" }
        },
        version: "?runtime=test"
    });
    return { loader, scripts };
}

{
    const { loader, scripts } = runtime();
    const first = loader.load("SpeechRuntimeLoader.js");
    const duplicate = loader.load("SpeechRuntimeLoader.js");
    assert.equal(first, duplicate, "duplicate requests share one pending load");
    assert.equal(scripts.length, 1);
    const script = scripts[0];
    assert.equal(script.src, "SpeechRuntimeLoader.js?runtime=test");
    assert.equal(script.dataset.runtimeSource, "SpeechRuntimeLoader.js");
    const context = JSON.parse(script.dataset.clocktimerContextData);
    assert.equal(context.host, "settings-frame");
    assert.equal(context.surface, "audioSettingsDialog");
    assert.equal(context.capabilities.speechMenu, false);
    assert.equal(context.capabilities.calendarStartup, false);
    script.handlers.load();
    assert.equal(await first, script);
    assert.equal(script.dataset.loaded, "true");
    assert.equal(await loader.load("SpeechRuntimeLoader.js"), script);
    assert.equal(scripts.length, 1, "loaded scripts are not appended again");
}

{
    const { loader, scripts } = runtime();
    const failed = loader.load("missing-runtime.js");
    scripts[0].handlers.error();
    await assert.rejects(failed, /Unable to load missing-runtime.js/);
    const retry = loader.load("missing-runtime.js");
    assert.equal(scripts.length, 2, "failed loads can be retried");
    scripts[1].handlers.load();
    await retry;
}
console.log("PASS classic script loading, context propagation, deduplication, and retry after failure");
