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
globalThis.SpeechRecognition =
    window.SpeechRecognition;

Function(
    fs.readFileSync(
        new URL(
            "../SpeechRecognitionProviders.js",
            import.meta.url
        ),
        "utf8"
    )
)();

assert.equal(
    typeof globalThis.BrowserSpeechProvider,
    "function"
);
assert.equal(
    typeof globalThis.StreamingSpeechProvider,
    "function"
);

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

if (!window.customElements.get("speech-mic-bar")) {
    window.customElements.define("speech-mic-bar", SpeechMicBar);
}
const bar = window.document.createElement("speech-mic-bar");
window.document.body.append(bar);

assert.equal(typeof bar.setResponse, "function");
assert.equal(typeof bar.clearResponse, "function");
assert.equal(typeof bar.clear, "function");

assert.equal(window.SpeechMenu.silenceTimeout, 5000);
window.SpeechMenu.silenceTimeout = 6000;
assert.equal(window.SpeechMenu.silenceTimeout, 6000);

assert.equal(window.SpeechMenu.commitSilenceTimeout, 350);
assert.deepEqual(
    window.SpeechMenu.recognitionContext,
    {
        vocabulary: [],
        options: {},
        phrases: [],
        numbers: {output: "digits"}
    }
);
window.SpeechMenu.setRecognitionContext({
    vocabulary: ["start", "stop"],
    options: {
        mode: ["elapsed", "remaining"]
    },
    phrases: ["start at <time>"],
    numbers: {output: "digits"}
});
assert.deepEqual(
    window.SpeechMenu.recognitionContext,
    {
        vocabulary: ["start", "stop"],
        options: {
            mode: ["elapsed", "remaining"]
        },
        phrases: ["start at <time>"],
        numbers: {output: "digits"}
    }
);
assert.throws(
    () =>
        window.SpeechMenu.setRecognitionContext({
            numbers: {output: "roman"}
        }),
    TypeError
);
window.SpeechMenu.clearRecognitionContext();

assert.equal(window.SpeechMenu.recognitionProvider, "browser");
window.SpeechMenu.recognitionProvider = "streaming";
assert.equal(window.SpeechMenu.recognitionProvider, "streaming");
window.SpeechMenu.recognitionProvider = "browser";
window.SpeechMenu.commitSilenceTimeout = 425;
assert.equal(window.SpeechMenu.commitSilenceTimeout, 425);
assert.throws(
    () => { window.SpeechMenu.silenceTimeout = 50; },
    error =>
        error?.name === "RangeError" &&
        /at least 100 milliseconds/.test(error.message)
);
assert.throws(
    () => { window.SpeechMenu.commitSilenceTimeout = 50; },
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

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscriptChanged", {detail:{id:7,transcript:"start at"}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscriptChanged", {detail:{id:7,transcript:"start at five"}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscribed", {detail:{id:7,transcript:"start at five",live:true}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechPreprocessed", {detail:{utteranceId:7,originalText:"start at five",processedText:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "preprocessed");

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechMenuMatched", {detail:{utteranceId:7,transcript:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "preprocessed");

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
assert.match(app, /speechRecognitionButton\?\.addEventListener[\s\S]*setSpeechLayoutState\(true\);[\s\S]*ensureSpeechRuntime/);
assert.match(app, /setSpeechLayoutState\(false\);[\s\S]*ensureSpeechRuntime[\s\S]*SpeechMenu\?\.stop/);
assert.match(app, /ensureSpeechRuntime/);
assert.match(app, /preferredSpeechProvider/);
assert.match(app, /Android\|iPhone\|iPad\|iPod/);
assert.match(
    app,
    /recognitionProvider\s*=\s*preferredSpeechProvider\(\)/
);

console.log("PASS persistent speech pipeline and SpeechMicBar public API");

assert.match(css, /speech-mic-bar\s*\{[^}]*grid-row:\s*7;[^}]*display:\s*block;/s);
assert.match(css, /\.trip-log-button\s*\{[^}]*grid-row:\s*8;/s);
assert.match(css, /speech-mic-bar:not\(:defined\)/);

const speechMenuSource = fs.readFileSync(new URL("../SpeechMenu.js", import.meta.url), "utf8");
const providerSource = fs.readFileSync(new URL("../SpeechRecognitionProviders.js", import.meta.url), "utf8");
const workletSource = fs.readFileSync(new URL("../SpeechAudioWorklet.js", import.meta.url), "utf8");
assert.match(speechMenuSource, /static #silenceTimeout = 5000;/);
assert.match(speechMenuSource, /static #commitSilenceTimeout = 350;/);
assert.match(speechMenuSource, /static #streamingSilenceTimeout = 650;/);
assert.match(speechMenuSource, /static #speechThreshold = 0\.01;/);
assert.match(speechMenuSource, /#createRecognitionProvider/);
assert.match(speechMenuSource, /provider\.startUtterance/);
assert.match(speechMenuSource, /SpeechAudioWorklet\.js/);
assert.match(providerSource, /interimResults\s*=\s*true/);
assert.match(providerSource, /recognition\.start\(this\.#micTrack\)/);
assert.match(providerSource, /class StreamingSpeechProvider/);
assert.match(providerSource, /\/api\/speech\/stream/);
assert.match(workletSource, /#targetRate = 16000/);
assert.match(workletSource, /pcm:\s*packet\.buffer/);
assert.match(speechMenuSource, /#processTranscript\(\s*transcript,\s*utterance\.id,\s*false\s*\)/s);
assert.match(speechMenuSource, /silenceMilliseconds\s*>=\s*SpeechMenu\.#commitSilenceTimeout/s);
assert.match(
    speechMenuSource,
    /#appendUtteranceFrame\(\s*frame\s*\);/s
);

const speechServerSource =
    fs.readFileSync(
        new URL("../speech/server.js", import.meta.url),
        "utf8"
    );
const speechServiceSource =
    fs.readFileSync(
        new URL(
            "../speech/clocktimer-speech.service",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    speechServerSource,
    /SPEECH_PARTIAL_MIN_AUDIO_MS[\s\S]*2200/
);
assert.match(
    speechServerSource,
    /SPEECH_MAX_PARTIAL_PASSES[\s\S]*1/
);
assert.match(
    speechServiceSource,
    /ggml-tiny\.en\.bin/
);
assert.match(
    speechServiceSource,
    /WHISPER_THREADS=2/
);
