import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load() {
    const events = [];
    const document = { documentElement: { dataset: {} } };
    const sandbox = {
        document,
        CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
        dispatchEvent(event) { events.push(event); return true; },
        Promise,
        Object,
        Error
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../PersistenceStartup.js", import.meta.url), "utf8"), sandbox);
    return { startup: sandbox.ClockTimerPersistenceStartup, document, events };
}

{
    const { startup } = load();
    let legacyStorage;
    let initialized = 0;
    const result = await startup.initialize({
        persistence: {
            ready: Promise.resolve(),
            async initializeLegacy(storage) { legacyStorage = storage; initialized++; }
        },
        storageProvider: () => ({ marker: "legacy" })
    });
    assert.equal(result.ok, true);
    assert.equal(initialized, 1);
    assert.equal(legacyStorage.marker, "legacy");
}

{
    const { startup, document, events } = load();
    const failure = new Error("persistence unavailable");
    const result = await startup.initialize({
        persistence: {
            ready: Promise.resolve(),
            async initializeLegacy() { throw failure; }
        },
        storageProvider: () => ({})
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, failure);
    assert.equal(document.documentElement.dataset.persistenceState, "reverted");
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "wmof:persistence-error");
    assert.equal(events[0].detail.error, failure);
}
console.log("PASS persistence startup ordering, legacy storage injection, and failure reporting");
