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
assert.doesNotMatch(html, /independentTimerValue|independentStart|independentStop|independentReset|independent-timer/);
assert.doesNotMatch(html, /<script src="SpeechMenu\\.js"/);

const primedSpeechIds = [
    "readyAt",
    "readyAtContinuation",
    "ready",
    "breakStart",
    "down",
    "breakEnd",
    "resume",
    "goal",
    "goalMode",
    "sync",
    "lockEndTime",
    "showTripLog",
    "hideTripLog",
    "deferTrip",
    "renderedTimeMode"
];

for (const id of primedSpeechIds) {
    assert.match(
        html,
        new RegExp(
            `data-speech-editor-id=["']builtin:${id}:page["']`
        ),
        `index.html should prime the ${id} speech command`
    );
}

assert.match(html, /builtin:breakChoice:breakDialog/);
assert.match(html, /builtin:confirm:breakDialog/);
assert.match(html, /builtin:confirm:speechBreakEndDialog/);
assert.match(html, /builtin:cancel:speechBreakEndDialog/);
assert.match(html, /builtin:standardTime:scheduledStartStandard/);
assert.match(html, /builtin:standardTime:trip-settings/);

const recognitionIndex = html.indexOf('id="speechRecognitionButton"');
const speechToolsIndex = html.indexOf('id="speechMenuButton"');
const trainingIndex = html.indexOf('id="speechTrainingButton"');
const editorIndex = html.indexOf('id="speechEditorButton"');

assert.ok(recognitionIndex >= 0 && speechToolsIndex > recognitionIndex);
assert.ok(trainingIndex > speechToolsIndex && editorIndex > trainingIndex);
assert.match(html, /id="speechToolsGroup"/);
assert.doesNotMatch(html, /id="speechAdminGroup"/);

const css = fs.readFileSync(new URL("../app.css", import.meta.url), "utf8");
assert.match(css, /--speech-mic-row-height:\s*0px/);
assert.doesNotMatch(css, /independent-timer|independent-timer-controls|independent-timer-value|play-icon|stop-icon/);
assert.match(css, /\.app\[data-speech-active="true"\]\s*\{[^}]*--speech-mic-row-height:\s*74px/s);

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /speechRecognitionButton\?\.addEventListener[\s\S]*setSpeechLayoutState\(true\);[\s\S]*ensureSpeechRuntime/);
assert.match(app, /setSpeechLayoutState\(false\);[\s\S]*ensureSpeechRuntime[\s\S]*SpeechMenu\?\.stop/);
assert.match(app, /ensureSpeechRuntime/);
assert.doesNotMatch(app, /startIndependentTimer|stopIndependentTimer|resetIndependentTimer|renderIndependentTimer|timerAccumulated|timerStartedAt/);
assert.match(app, /loadClassicScript\(\s*"SherpaRecognizer\.js"\s*\)/s);
assert.match(app, /speechDiagnosticsEnabled/);
assert.match(app, /speech-pipeline/);
assert.match(app, /speechPipeline\s*=\s*[\s\S]*"silero"[\s\S]*"raw"/);
assert.match(app, /loadClassicScript\(\s*"SileroVad\.js"\s*\)/s);
assert.match(app, /loadClassicScript\(\s*"SpeechDiagnostics\.js"\s*\)/s);
assert.match(app, /document\.createElement\(\s*"speech-diagnostics"\s*\)/s);
assert.match(app, /openSpeechTraining\(\)/);
assert.match(app, /api\/admin\/speech-editor\/\?training=1/);
assert.match(app, /speechToolsGroup[\s\S]*speechTrainingButton[\s\S]*speechEditorButton/);

console.log("PASS persistent speech pipeline and SpeechMicBar public API");

assert.match(css, /speech-mic-bar\s*\{[^}]*grid-row:\s*6;[^}]*display:\s*block;/s);
assert.match(css, /\.trip-log-button\s*\{[^}]*grid-row:\s*7;/s);
assert.match(css, /speech-mic-bar:not\(:defined\)/);

const speechMenuSource = fs.readFileSync(new URL("../SpeechMenu.js", import.meta.url), "utf8");
const sherpaRecognizerSource = fs.readFileSync(new URL("../SherpaRecognizer.js", import.meta.url), "utf8");
const sherpaWorkerSource = fs.readFileSync(new URL("../speech/SherpaWorker.js", import.meta.url), "utf8");
const audioWorkletSource = fs.readFileSync(new URL("../speech/SpeechAudioWorklet.js", import.meta.url), "utf8");

assert.match(speechMenuSource, /static #silenceTimeout = 5000;/);
assert.match(speechMenuSource, /static #commitSilenceTimeout = 350;/);
assert.match(speechMenuSource, /new globalThis\.SherpaRecognizer/);
assert.match(speechMenuSource, /echoCancellation:\s*false/);
assert.match(speechMenuSource, /noiseSuppression:\s*false/);
assert.match(speechMenuSource, /autoGainControl:\s*false/);
assert.match(speechMenuSource, /static #executionEnabled = true;/);
assert.match(speechMenuSource, /static #pipeline = "raw";/);
assert.match(speechMenuSource, /SpeechMenu\.pipeline must be "raw" or "silero"/);
assert.match(speechMenuSource, /new globalThis\.SileroVad/);
assert.match(speechMenuSource, /minSilenceDuration:\s*SpeechMenu[\s\S]*#commitSilenceTimeout\s*\/\s*1000/s);
assert.match(speechMenuSource, /"vad-silence"/);
assert.match(speechMenuSource, /speechVadChanged/);
assert.match(speechMenuSource, /speechRecognitionTiming/);
assert.match(speechMenuSource, /captureSettings:/);
assert.match(speechMenuSource, /context\.audioWorklet\.addModule/);
assert.match(speechMenuSource, /new AudioWorkletNodeCtor\(\s*context,\s*"wmof-speech-capture"/s);
assert.match(speechMenuSource, /#processTranscript\(\s*transcript,\s*utterance\.id,\s*false\s*\)/s);
assert.match(speechMenuSource, /silenceMilliseconds\s*>=\s*SpeechMenu\.#commitSilenceTimeout/s);
assert.doesNotMatch(speechMenuSource, /SpeechRecognition|webkitSpeechRecognition|createScriptProcessor/);
assert.match(speechMenuSource, /#compactTranscript/);
assert.match(speechMenuSource, /speechCompactPattern/);
assert.match(speechMenuSource, /speechCorrectionApplied/);

assert.match(sherpaRecognizerSource, /static sampleRate = 16000;/);
assert.match(sherpaRecognizerSource, /new Worker\(workerUrl\)/);
assert.match(sherpaRecognizerSource, /speech\/SherpaWorker\.js/);

assert.match(audioWorkletSource, /targetSampleRate = 16000;/);
assert.match(audioWorkletSource, /registerProcessor\(\s*"wmof-speech-capture"/s);
assert.match(audioWorkletSource, /this\.port\.postMessage/);

assert.match(sherpaWorkerSource, /decodingMethod:\s*"modified_beam_search"/);
assert.match(sherpaWorkerSource, /createOnlineRecognizer\(/);
assert.match(sherpaWorkerSource, /stream\.acceptWaveform\(\s*16000/s);
assert.match(sherpaWorkerSource, /stream\.inputFinished\(\)/);
assert.match(sherpaWorkerSource, /new Float32Array\(\s*6400\s*\)/s);
assert.match(sherpaWorkerSource, /hotwordsBuf/);
assert.doesNotMatch(sherpaWorkerSource, /WebSocket|fetch\([^)]*speech/i);

const sileroSource = fs.readFileSync(
    new URL("../SileroVad.js", import.meta.url),
    "utf8"
);
const sileroWorkerSource = fs.readFileSync(
    new URL("../speech/SileroVadWorker.js", import.meta.url),
    "utf8"
);
assert.match(sileroSource, /static sampleRate = 16000;/);
assert.match(sileroSource, /static windowSize = 512;/);
assert.match(sileroSource, /speech\/SileroVadWorker\.js/);
assert.match(sileroWorkerSource, /silero_vad\.onnx/);
assert.match(sileroWorkerSource, /minSilenceDuration/);
assert.match(sileroWorkerSource, /vad\.isDetected\(\)/);
assert.match(sileroWorkerSource, /"speechStart"/);
assert.match(sileroWorkerSource, /"speechEnd"/);

const diagnosticsSource = fs.readFileSync(
    new URL("../SpeechDiagnostics.js", import.meta.url),
    "utf8"
);
assert.match(diagnosticsSource, /Raw Sherpa Diagnostics/);
assert.match(diagnosticsSource, /Execute matched commands/);
assert.match(diagnosticsSource, /SpeechMenu\.executionEnabled\s*=\s*false/);
assert.match(diagnosticsSource, /Copy JSON/);
assert.match(diagnosticsSource, /firstTranscriptMilliseconds/);

const speechEditorHtml = fs.readFileSync(
    new URL("../api/admin/speech-editor/index.php", import.meta.url),
    "utf8"
);
const speechEditorJs = fs.readFileSync(
    new URL("../api/admin/speech-editor/editor.js", import.meta.url),
    "utf8"
);
const speechEditorCss = fs.readFileSync(
    new URL("../api/admin/speech-editor/editor.css", import.meta.url),
    "utf8"
);

assert.match(speechEditorHtml, /speechTrainingControlsPopup/);
assert.match(speechEditorHtml, /Scratch That/);
assert.match(speechEditorHtml, /Repeat prompt/);
assert.match(speechEditorJs, /initialMobileTraining/);
assert.match(speechEditorJs, /trainingOnly/);
assert.match(speechEditorJs, /utteranceTranscriptChanged/);
assert.match(speechEditorJs, /control ===\s*"scratch that"/s);
assert.match(speechEditorCss, /body\.training-mode\.training-mobile/);
assert.match(speechEditorCss, /speech-training-prompt\{text-align:right\}/);

console.log("PASS Sherpa client ASR baseline architecture");
