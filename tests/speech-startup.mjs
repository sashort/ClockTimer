import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function runtime() {
    const appended = [];
    const sandbox = {
        console,
        Promise,
        JSON,
        Error,
        Object,
        URL,
        document: {
            createElement: () => ({ dataset: {}, addEventListener() {} }),
            head: { append: node => appended.push(node) }
        },
        navigator: { userAgent: "test" },
        isSecureContext: true
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../SpeechStartup.js", import.meta.url), "utf8"), sandbox);
    return { sandbox, appended };
}

{
    const { sandbox } = runtime();
    const settings = sandbox.ClockTimerSpeechStartup.create({
        context: { host: "settings-frame", capabilities: { speechRecognition: false } },
        enabled: false
    });
    assert.equal(await settings.assetCacheReady, false);
    assert.equal(await settings.ensureRuntime(), false, "settings context cannot start speech runtime");
}

{
    const { sandbox } = runtime();
    const calls = { registered: [], created: [], ensure: 0 };
    sandbox.ClockTimerSpeechAssetCache = {
        async register(options) {
            calls.registered.push(options);
            return true;
        }
    };
    sandbox.ClockTimerClassicScriptLoader = {
        create(options) {
            calls.created.push(options);
            return { load: async source => ({ source }) };
        }
    };
    sandbox.ClockTimerSpeechRuntimeLoader = {
        create(options) {
            calls.loaderOptions = options;
            return { ensure: async () => { calls.ensure++; return "runtime-ready"; } };
        }
    };
    const context = {
        host: "order-filler",
        surface: "application",
        presentation: "application",
        features: ["application"],
        capabilities: { speechRecognition: true },
        options: {}
    };
    const startup = sandbox.ClockTimerSpeechStartup.create({
        context,
        enabled: true,
        version: "?runtime=test",
        apiBase: "https://example.test/",
        getPipeline: () => "silero",
        getDiagnosticsEnabled: () => true
    });
    assert.equal(await startup.assetCacheReady, true);
    assert.equal(calls.registered[0].scriptUrl, "SpeechAssetCacheWorker.js?runtime=test");
    assert.equal(calls.registered[0].navigatorRef.userAgent, "test");
    assert.equal(calls.registered[0].secureContext, true);
    assert.equal(calls.created[0].context, context);
    assert.equal(await startup.ensureRuntime(), "runtime-ready");
    assert.equal(await startup.ensureRuntime(), "runtime-ready");
    assert.equal(calls.ensure, 2, "loader ensure is idempotent and can be called repeatedly");
    assert.equal(await calls.loaderOptions.assetCacheReady, true);
    assert.equal(calls.loaderOptions.getPipeline(), "silero");
    assert.equal(calls.loaderOptions.getDiagnosticsEnabled(), true);
}
console.log("PASS speech startup context gating, asset-cache registration, and runtime loader composition");
