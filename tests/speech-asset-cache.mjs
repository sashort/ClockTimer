import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load() {
    const sandbox = { Object, Promise, Boolean, Error, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../SpeechAssetCache.js", import.meta.url), "utf8"), sandbox);
    return sandbox.ClockTimerSpeechAssetCache;
}

{
    const cache = load();
    let registrations = 0;
    const result = await cache.register({
        scriptUrl: "SpeechAssetCacheWorker.js?test",
        enabled: false,
        secureContext: true,
        navigatorRef: { serviceWorker: { async register() { registrations++; } } }
    });
    assert.equal(result, false);
    assert.equal(registrations, 0, "disabled contexts do not register the worker");
}

{
    const cache = load();
    const registrations = [];
    const serviceWorker = {
        controller: {},
        async register(url, options) { registrations.push({ url, options }); },
        ready: Promise.resolve(),
        addEventListener() {}
    };
    const result = await cache.register({
        scriptUrl: "SpeechAssetCacheWorker.js?runtime=test",
        navigatorRef: { serviceWorker },
        secureContext: true
    });
    assert.equal(result, true);
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].url, "SpeechAssetCacheWorker.js?runtime=test");
    assert.equal(registrations[0].options.scope, "./");
}

{
    const cache = load();
    let change;
    let timeoutCallback;
    let cleared = false;
    const serviceWorker = {
        controller: null,
        async register() {},
        ready: Promise.resolve(),
        addEventListener(name, callback) { assert.equal(name, "controllerchange"); change = callback; },
        removeEventListener(name, callback) { assert.equal(name, "controllerchange"); assert.equal(callback, change); }
    };
    const pending = cache.register({
        scriptUrl: "SpeechAssetCacheWorker.js",
        navigatorRef: { serviceWorker },
        secureContext: true,
        timeoutMs: 10,
        setTimeoutRef(callback) { timeoutCallback = callback; return 7; },
        clearTimeoutRef(id) { assert.equal(id, 7); cleared = true; }
    });
    await new Promise(resolve => setImmediate(resolve));
    serviceWorker.controller = {};
    change();
    assert.equal(await pending, true);
    assert.equal(cleared, true);
    assert.equal(typeof timeoutCallback, "function");
}

{
    const cache = load();
    const warnings = [];
    const result = await cache.register({
        scriptUrl: "SpeechAssetCacheWorker.js",
        secureContext: true,
        navigatorRef: { serviceWorker: { async register() { throw new Error("unavailable"); } } },
        logger: { warn(...args) { warnings.push(args); } }
    });
    assert.equal(result, false);
    assert.equal(warnings.length, 1);
}
console.log("PASS speech asset cache capability gating, registration, controller readiness, and failure fallback");
