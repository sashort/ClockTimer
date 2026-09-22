import fs from "node:fs";
import assert from "node:assert/strict";
import {Window} from "happy-dom";

const window = new Window({url:"https://clock.example/"});
Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    CustomEvent: window.CustomEvent,
    EventTarget: window.EventTarget,
    customElements: window.customElements
});
Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator
});

let rafId = 0;
window.requestAnimationFrame = globalThis.requestAnimationFrame = callback => ++rafId;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame = () => {};

window.SpeechRecognition = class {
    start() {}
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
};

const ParameterParser = Function(
    fs.readFileSync(new URL("../ParameterParser.js", import.meta.url), "utf8") +
    "\nreturn ParameterParser;"
)();
globalThis.ParameterParser = ParameterParser;
window.ParameterParser = ParameterParser;

const SpeechMenu = Function(
    fs.readFileSync(new URL("../SpeechMenu.js", import.meta.url), "utf8") +
    "\nreturn SpeechMenu;"
)();
globalThis.SpeechMenu = SpeechMenu;
window.SpeechMenu = SpeechMenu;

const SpeechMicBar = Function(
    fs.readFileSync(new URL("../SpeechMicBar.js", import.meta.url), "utf8") +
    "\nreturn SpeechMicBar;"
)();
globalThis.SpeechMicBar = SpeechMicBar;
window.SpeechMicBar = SpeechMicBar;

const bar = window.document.createElement("speech-mic-bar");
window.document.body.append(bar);

assert.equal(typeof bar.setResponse, "function");
assert.equal(typeof bar.clearResponse, "function");
assert.equal(typeof bar.clear, "function");

window.SpeechMenu.silenceTimeout = 5000;
assert.equal(window.SpeechMenu.silenceTimeout, 5000);
assert.throws(
    () => { window.SpeechMenu.silenceTimeout = 50; },
    error =>
        error?.name === "RangeError" &&
        /at least 100 milliseconds/.test(error.message)
);

let bubbledStarted = 0;
window.document.body.addEventListener("started", () => bubbledStarted++);

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("started", {detail:{deliberate:true}}));
assert.equal(bar.getAttribute("state"), "listening");
assert.equal(bubbledStarted, 1);

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceStarted", {detail:{id:7}}));
assert.equal(bar.getAttribute("state"), "utterance");

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceFinished", {detail:{id:7}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscribed", {detail:{id:7,transcript:"start at five"}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechPreprocessed", {detail:{utteranceId:7,originalText:"start at five",processedText:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "preprocessed");

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechMenuMatched", {detail:{utteranceId:7,transcript:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "matched");

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechArgumentsPrepared", {detail:{utteranceId:7,arguments:["5:00",30]}}));

bar.setResponse("Done");
bar.clear();
await bar.clearResponse();

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("muted", {detail:{utteranceId:8}}));
assert.equal(bar.getAttribute("state"), "muted");
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("unmuted", {detail:{utteranceId:9}}));
assert.equal(bar.getAttribute("state"), "listening");
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("stopped", {detail:{deliberate:true}}));
assert.equal(bar.getAttribute("state"), "stopped");

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /<speech-mic-bar id="speechMicBar"/);
assert.doesNotMatch(html, /<script src="SpeechMenu\.js"/);

const css = fs.readFileSync(new URL("../app.css", import.meta.url), "utf8");
assert.match(css, /--speech-mic-row-height:\s*0px/);
assert.match(css, /\.app\[data-speech-active="true"\]\s*\{[^}]*--speech-mic-row-height:\s*74px/s);

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /await SpeechMenu\.start/);
assert.match(app, /await SpeechMenu\.stop/);
assert.match(app, /ensureSpeechRuntime/);

console.log("PASS persistent speech pipeline and SpeechMicBar public API");
