import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class FakeWorker extends EventTarget {
    sent = [];
    terminated = false;
    postMessage(message) { this.sent.push(message); }
    terminate() { this.terminated = true; }
    emit(data) { this.dispatchEvent(new MessageEvent("message", { data })); }
}
const workers = [];
const context = {
    EventTarget,
    Event,
    CustomEvent,
    MessageEvent,
    Worker: class extends FakeWorker {
        constructor(url) { super(); this.url = url; workers.push(this); }
    },
    console
};
context.globalThis = context;
vm.runInNewContext(
    await readFile(new URL("../PocketSphinxRecognizer.js", import.meta.url), "utf8"),
    context,
    { filename: "PocketSphinxRecognizer.js" }
);

const Recognizer = context.PocketSphinxRecognizer;
assert.equal(typeof Recognizer, "function");
assert.throws(() => new Recognizer(), /requires workerUrl/);

const recognizer = new Recognizer({
    workerUrl: "/vendor/pocketsphinx/recognizer.js",
    runtimeUrls: {
        pocketsphinxJs: "/vendor/pocketsphinx/pocketsphinx.js",
        pocketsphinxWasm: "/vendor/pocketsphinx/pocketsphinx.wasm"
    },
    runtimeFiles: [
        ["/", "cmudict.dict", "/vendor/pocketsphinx/cmudict.dict"]
    ]
});
const worker = workers[0];
assert.equal(worker.url, "/vendor/pocketsphinx/recognizer.js");
assert.equal(worker.sent.length, 1);
assert.equal(worker.sent[0]["pocketsphinx.js"], "/vendor/pocketsphinx/pocketsphinx.js");

worker.emit({});
assert.equal(worker.sent[1].command, "lazyLoad");
assert.deepEqual(worker.sent[1].data.files, [
    ["/", "cmudict.dict", "/vendor/pocketsphinx/cmudict.dict"]
]);
worker.emit({ id: worker.sent[1].callbackId, status: "done", command: "lazyLoad" });
assert.equal(worker.sent[2].command, "initialize");
worker.emit({ id: worker.sent[2].callbackId, status: "done", command: "initialize" });
await recognizer.ready;

const wordsPromise = recognizer.registerWords({ READY: "R EH D IY" });
const addWords = worker.sent.at(-1);
assert.equal(addWords.command, "addWords");
worker.emit({ id: addWords.callbackId });
await wordsPromise;

const grammarPromise = recognizer.addGrammar("commands", {
    start: 0, end: 1, numStates: 2,
    transitions: [{ from: 0, to: 1, word: "READY" }]
});
const addGrammar = worker.sent.at(-1);
assert.equal(addGrammar.command, "addGrammar");
worker.emit({ id: addGrammar.callbackId, data: 7, status: "done", command: "addGrammar" });
assert.equal(await grammarPromise, 7);

await recognizer.start("commands");
assert.equal(worker.sent.at(-1).command, "start");
assert.equal(worker.sent.at(-1).data, 7);

assert.equal(recognizer.acceptAudioFrame(new Float32Array([0, 0.5, -0.5]), 16000), true);
assert.equal(worker.sent.at(-1).command, "process");
assert.deepEqual(worker.sent.at(-1).data, [0, 16384, -16384]);
assert.throws(() => recognizer.acceptAudioFrame([0, 1], 16000), /Float32Array/);
assert.throws(() => recognizer.acceptAudioFrame(new Float32Array([0]), 0), /sample rate/);

let transcript;
recognizer.addEventListener("transcript", event => { transcript = event.detail; });
worker.emit({ hyp: "READY", hypseg: [], final: false });
assert.equal(transcript.transcript, "ready");
assert.equal(transcript.isFinal, false);

await recognizer.close();
assert.equal(worker.terminated, true);
console.log("PocketSphinx recognizer adapter tests passed.");
