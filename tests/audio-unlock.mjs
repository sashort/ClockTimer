import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const listeners = new Map();
const removals = [];
const document = {
    addEventListener(type, handler, capture) {
        const list = listeners.get(type) || [];
        list.push({ handler, capture });
        listeners.set(type, list);
    },
    removeEventListener(type, handler, capture) {
        removals.push({ type, handler, capture });
        listeners.set(type, (listeners.get(type) || []).filter(item =>
            item.handler !== handler || item.capture !== capture));
    }
};
let unlocks = 0;
const sandbox = { document, WMOFAudio: { unlock() { unlocks++; } }, Object, Map };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioUnlock.js", import.meta.url), "utf8"), sandbox, {
    filename: "AudioUnlock.js"
});

const cleanup = sandbox.ClockTimerAudioUnlock.install(document, sandbox.WMOFAudio);
assert.equal(listeners.get("pointerdown").length, 1);
assert.equal(listeners.get("keydown").length, 1);
assert.equal(listeners.get("pointerdown")[0].capture, true);
const activate = listeners.get("pointerdown")[0].handler;
activate();
activate();
assert.equal(unlocks, 1, "audio unlock is only invoked once per installation");
assert.equal(listeners.get("pointerdown").length, 0);
assert.equal(listeners.get("keydown").length, 0);
assert.equal(removals.length, 2);

const noDocumentCleanup = sandbox.ClockTimerAudioUnlock.install(null, sandbox.WMOFAudio);
assert.equal(typeof noDocumentCleanup, "function");
noDocumentCleanup();
cleanup();
console.log("PASS gesture-based audio activation is one-shot and cleans up listeners");
