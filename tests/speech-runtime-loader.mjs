import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const loaded = [];
const events = [];
const corrections = [];
const appended = [];
const elements = new Set();
const customElements = { get: name => elements.has(name) ? {} : undefined };
const document = {
    body: { append: node => appended.push(node) },
    querySelector: () => null,
    createElement: name => ({ tagName: name }),
    dispatchEvent: event => { events.push(event); return true; }
};
class CustomEvent {
    constructor(type) { this.type = type; }
}
const sandbox = { document, customElements, CustomEvent, URL, Promise, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../SpeechRuntimeLoader.js", import.meta.url), "utf8"), sandbox);

let pipeline = "silero";
let diagnostics = true;
let assetCacheResolved = false;
const loader = sandbox.ClockTimerSpeechRuntimeLoader.create({
    documentRef: document,
    customElementsRef: customElements,
    assetCacheReady: Promise.resolve().then(() => { assetCacheResolved = true; }),
    getPipeline: () => pipeline,
    getDiagnosticsEnabled: () => diagnostics,
    apiBase: "https://example.test/",
    loadScript: async source => {
        loaded.push(source);
        if (source === "AdaptiveSpeechTiming.js") sandbox.AdaptiveSpeechTiming = {};
        if (source === "SherpaRecognizer.js") sandbox.SherpaRecognizer = {};
        if (source === "SileroVad.js") sandbox.SileroVad = {};
        if (source === "SpeechMenu.js") {
            sandbox.SpeechMenu = {
                pipeline: "sherpa",
                started: false,
                loadCorrections: async url => { corrections.push(url); }
            };
        }
        if (source.startsWith("SpeechMicBar.js")) elements.add("speech-mic-bar");
        if (source.startsWith("SpeechDiagnostics.js")) elements.add("speech-diagnostics");
    }
});

const first = loader.ensure();
const second = loader.ensure();
assert.equal(first, second, "concurrent callers share one initialization promise");
await Promise.all([first, second]);
assert.equal(assetCacheResolved, true);
assert.deepEqual(loaded, [
    "AdaptiveSpeechTiming.js",
    "SherpaRecognizer.js",
    "SileroVad.js",
    "SpeechMenu.js",
    "SpeechMicBar.js?v=language-pack-20261001",
    "SpeechDiagnostics.js?v=language-pack-20261001"
]);
assert.equal(sandbox.SpeechMenu.pipeline, "silero");
assert.deepEqual(corrections, ["https://example.test/api/speech-corrections/?language=en-US"]);
assert.equal(appended.length, 1);
assert.equal(appended[0].tagName, "speech-diagnostics");
assert.deepEqual(events.map(event => event.type), ["speech-runtime-ready"]);
await loader.ensure();
assert.equal(loaded.length, 6, "subsequent calls do not reload an initialized runtime");
{
    const fastEvents = [];
    const fastDocument = {
        dispatchEvent: event => { fastEvents.push(event.type); return true; },
        querySelector: () => null,
        body: { append() {} },
        createElement: name => ({ tagName: name })
    };
    const fastElements = { get: name => name === "speech-mic-bar" ? {} : undefined };
    const fastSandbox = {
        document: fastDocument,
        customElements: fastElements,
        SpeechMenu: {},
        CustomEvent,
        URL,
        Promise,
        console
    };
    fastSandbox.globalThis = fastSandbox;
    vm.createContext(fastSandbox);
    vm.runInContext(readFileSync(new URL("../SpeechRuntimeLoader.js", import.meta.url), "utf8"), fastSandbox);
    const fastLoader = fastSandbox.ClockTimerSpeechRuntimeLoader.create({
        documentRef: fastDocument,
        customElementsRef: fastElements,
        apiBase: "https://example.test/",
        loadScript: async () => { throw new Error("preloaded runtime should not fetch scripts"); }
    });
    await fastLoader.ensure();
    await fastLoader.ensure();
    assert.deepEqual(fastEvents, ["speech-runtime-ready"], "preloaded runtime emits one readiness event");
}
console.log("PASS extracted speech runtime loader ordering, configuration, deduplication, and readiness event");
