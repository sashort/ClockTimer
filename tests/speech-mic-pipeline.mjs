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
assert.equal(typeof bar.showOptions, "function");
assert.equal(typeof bar.hideOptions, "function");
assert.equal(typeof bar.promoteTopLayer, "function");

const optionCommand =
    window.document
        .createElement(
            "speech-command"
        );
optionCommand.setAttribute(
    "data-speech-target",
    "#newTripButton"
);
optionCommand.setAttribute(
    "speech-preproc-field",
    "spokenTime"
);
optionCommand.setAttribute(
    "speech-preproc-context",
    "clock"
);

assert.equal(
    bar.showOptions([
        {
            element:
                optionCommand,
            phrases: [
                "ready",
                "ready at <spokenTime>"
            ]
        }
    ]),
    true
);
assert.equal(bar.optionsOpen, true);
await bar.hideOptions({
    duration: 0
});
assert.equal(bar.optionsOpen, false);

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

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscriptChanged", {detail:{id:7,transcript:"start at",isFinal:false}}));
assert.equal(bar.getAttribute("phase"), null);
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscriptChanged", {detail:{id:7,transcript:"start at five",isFinal:false}}));
assert.equal(bar.getAttribute("phase"), null);
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("utteranceTranscribed", {detail:{id:7,transcript:"start at five",live:true}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechPreprocessed", {detail:{utteranceId:7,originalText:"start at five",processedText:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), null);

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechMenuMatched", {detail:{utteranceId:7,transcript:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "matched");

window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechArgumentsPrepared", {detail:{utteranceId:7,arguments:["5:00",30]}}));
window.SpeechMenu.events.dispatchEvent(new window.CustomEvent("speechCommandExecuted", {detail:{utteranceId:7,transcript:"start at 5:00"}}));
assert.equal(bar.getAttribute("phase"), "preprocessed");

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
assert.match(
    html,
    /<speech-mic-bar id="speechMicBar" popover="manual"/
);
assert.match(
    html,
    /speech-modal="default"[\s\S]*\^\(\?:speech \)\?options\$[\s\S]*WMOFActions\.toggleSpeechOptions/
);
assert.match(
    html,
    /speech-modal="default"[\s\S]*\^\(\?:cancel\|close\)\$[\s\S]*WMOFActions\.closeActiveSurface/
);
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
assert.match(
    css,
    /speech-mic-bar\[popover\][\s\S]*position:\s*fixed;[\s\S]*overflow:\s*visible/
);
assert.match(
    css,
    /speech-mic-bar\[popover\]:popover-open/
);

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /speechRecognitionButton\?\.addEventListener[\s\S]*setSpeechLayoutState\(true\);[\s\S]*ensureSpeechRuntime/);
assert.match(app, /setSpeechLayoutState\(false\);[\s\S]*ensureSpeechRuntime[\s\S]*SpeechMenu\?\.stop/);
assert.match(app, /ensureSpeechRuntime/);
assert.match(app, /speech-editor-preview/);
assert.match(app, /function showInitialLoginDialog\(\)[\s\S]*if \(speechEditorPreview\)[\s\S]*return false;/);
assert.match(app, /function showConnectionRetryLoginDialog\(\)[\s\S]*if \(speechEditorPreview\)[\s\S]*return false;/);
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
assert.match(
    app,
    /prepareStartMenu\(\)[\s\S]*armSpeechReadyContinuation\(\)[\s\S]*openStartMenuWorkflow/
);
assert.doesNotMatch(
    app,
    /prepareStartMenu\(\)[\s\S]{0,700}1100/
);
assert.match(
    app,
    /SPEECH_READY_CONTINUATION_WINDOW\s*=\s*1800/
);
assert.match(
    app,
    /dialog\.showModal\(\);[\s\S]*promoteTopLayer/
);
assert.match(
    app,
    /"toggle"[\s\S]*event\.newState\s*===\s*"open"[\s\S]*promoteTopLayer/
);
assert.match(
    app,
    /toggleSpeechOptions\(\)[\s\S]*optionsOpen[\s\S]*hideOptions[\s\S]*showOptions/
);
assert.match(
    app,
    /closeActiveSurface\(\)[\s\S]*closeActiveSpeechSurface/
);
assert.match(app, /element:\s*\$\("#speechTrainingButton"\)[\s\S]*event:\s*"click"[\s\S]*action:\s*"openSpeechTraining"/);
assert.match(app, /element:\s*\$\("#speechEditorButton"\)[\s\S]*event:\s*"click"[\s\S]*action:\s*"openSpeechEditor"/);
assert.match(app, /speech-build-active/);
assert.match(app, /1050/);

console.log("PASS persistent speech pipeline and SpeechMicBar public API");

assert.match(css, /speech-mic-bar\s*\{[^}]*grid-row:\s*6;[^}]*display:\s*block;/s);
assert.match(css, /\.trip-log-button\s*\{[^}]*grid-row:\s*7;/s);
assert.match(css, /speech-mic-bar:not\(:defined\)/);
assert.match(css, /#speechTrainingButton::before/);
assert.match(css, /#speechEditorButton::before/);
assert.match(css, /stroke-dasharray:100;stroke-dashoffset:100/);
assert.match(css, /@keyframes speech-mic-build/);
assert.match(css, /from\{clip-path:inset\(100% 0 0 0\);\}/);
assert.match(css, /#speechMenuButton\.speech-build-active \.speech-build-mic/);
assert.match(html, /class="speech-build-crane"/);
assert.match(css, /\.speech-build-crane\{opacity:0/);
assert.match(css, /stroke:#003b73/);
assert.match(css, /#speechMenuButton\.speech-build-active \.speech-build-crane\{opacity:1/);

const speechMenuSource = fs.readFileSync(new URL("../SpeechMenu.js", import.meta.url), "utf8");
const speechMicBarSource = fs.readFileSync(new URL("../SpeechMicBar.js", import.meta.url), "utf8");
const presentationSource = fs.readFileSync(new URL("../PresentationSetters.js", import.meta.url), "utf8");
const speechEditorConfigSource = fs.readFileSync(new URL("../api/speech-editor-config/index.php", import.meta.url), "utf8");
const sherpaRecognizerSource = fs.readFileSync(new URL("../SherpaRecognizer.js", import.meta.url), "utf8");
const sherpaWorkerSource = fs.readFileSync(new URL("../speech/SherpaWorker.js", import.meta.url), "utf8");
const sherpaRuntimeHtaccessSource = fs.readFileSync(new URL("../speech/sherpa/runtime/.htaccess", import.meta.url), "utf8");
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
assert.match(speechMenuSource, /#refreshCandidatePool\(\s*utterance,\s*transcript,\s*controller\.signal\s*\)/s);
assert.match(speechMenuSource, /candidatePool:\s*\[\]/);
assert.match(speechMenuSource, /new AbortController\(\)/);
assert.match(
    speechMenuSource,
    /#cancelPendingRecognitionForBargeIn[\s\S]*#finishedUtterances[\s\S]*#stopLiveRecognition\([\s\S]*false[\s\S]*\.delete\(id\)/
);
assert.match(
    speechMenuSource,
    /#beginUtterance\(now\)[\s\S]*#cancelPendingRecognitionForBargeIn\(\)/
);
assert.match(speechMenuSource, /#cancelCandidateWork[\s\S]*controller\.abort\(\)/);
assert.match(speechMenuSource, /while\s*\([\s\S]*next\.shift\(\)/);
assert.match(speechMenuSource, /await Promise\.resolve\([\s\S]*speechPreprocFunc[\s\S]*signal/s);
assert.doesNotMatch(speechMenuSource, /SpeechRecognition|webkitSpeechRecognition|createScriptProcessor/);
assert.match(speechMenuSource, /#compactTranscript/);
assert.match(speechMenuSource, /speechCompactPattern/);
assert.match(speechMenuSource, /speechCorrectionApplied/);
assert.match(speechMenuSource, /provisional:\s*!execute/);
assert.match(speechMenuSource, /"utteranceUnrecognized"[\s\S]*transcript/);
assert.match(
    speechMicBarSource,
    /--speech-load-clip-right[\s\S]*#003b73[\s\S]*#a9ddf7/
);
assert.match(
    speechMicBarSource,
    /clip-path:[\s\S]*var\(--speech-load-clip-right\)/
);
assert.match(
    speechMicBarSource,
    /@keyframes speech-load-wave[\s\S]*background-position/
);
assert.match(
    speechMicBarSource,
    /background-size:[\s\S]*300% 100%/
);
assert.match(
    speechMicBarSource,
    /#animateLoadingProgress[\s\S]*requestAnimationFrame/
);
assert.match(
    speechMicBarSource,
    /displayed\s*\+\s*" \/ "\s*\+\s*total/
);
assert.doesNotMatch(
    speechMicBarSource,
    /width 160ms linear/
);
assert.match(
    speechMicBarSource,
    /#scheduleRejectedClear[\s\S]*2000/
);
assert.match(
    speechMicBarSource,
    /#optionsPanel[\s\S]*grid-template-columns:[\s\S]*max-content/
);
assert.match(
    speechMicBarSource,
    /#optionsGrid[\s\S]*grid-template-columns:[\s\S]*subgrid/
);
assert.match(
    speechMicBarSource,
    /\.option-card[\s\S]*grid-template-columns:[\s\S]*subgrid/
);
assert.match(
    speechMicBarSource,
    /\.option-phrase code/
);
assert.match(
    speechMicBarSource,
    /duration:\s*750/
);
assert.match(
    speechMicBarSource,
    /data-speech-target/
);
assert.match(
    speechMicBarSource,
    /context === "clock"[\s\S]*return "time"/
);
assert.match(
    speechMicBarSource,
    /presentResponseTransition[\s\S]*sharedStart/
);
assert.doesNotMatch(
    speechMicBarSource,
    /case "speechArgumentsPrepared"[\s\S]{0,500}setResponse\(/
);
assert.match(
    speechMenuSource,
    /beginSpeechResponse[\s\S]*finishSpeechResponse/
);
assert.match(
    speechMenuSource,
    /targetElements:\s*target\.elements\.slice\(\)/
);
assert.match(
    presentationSource,
    /chooseRepresentative[\s\S]*beginSpeechResponse[\s\S]*finishSpeechResponse/
);
assert.match(
    presentationSource,
    /speech-response-timeout/
);
assert.match(
    presentationSource,
    /return 2000;/
);
assert.match(
    presentationSource,
    /"persistent"[\s\S]*"none"[\s\S]*"manual"/
);
assert.match(
    presentationSource,
    /speech-response-button-facsimile/
);
assert.match(
    presentationSource,
    /data-speech-response-snapshot/
);
assert.match(
    app,
    /"utteranceStarted"[\s\S]*dismissSpeechResponse[\s\S]*fast:\s*true/
);

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
assert.match(speechEditorHtml, /index\.html\?speech-editor-preview=1/);
assert.match(speechEditorHtml, /data-training-requested=/);
assert.match(speechEditorHtml, /<option value="training">Training<\/option>/);
assert.match(speechEditorHtml, /Scratch That/);
assert.match(speechEditorHtml, /Repeat prompt/);
assert.match(speechEditorHtml, /name="speech-response-timeout"/);
assert.match(speechEditorJs, /"speech-response-timeout"/);
assert.match(speechEditorConfigSource, /speech-response-timeout/);
assert.match(speechEditorConfigSource, /invalid_speech_response_timeout/);
assert.match(speechEditorJs, /initialMobileTraining/);
assert.match(speechEditorJs, /trainingRequested/);
assert.match(speechEditorJs, /training:\s*\{[\s\S]*right:\s*\[[\s\S]*"phrases"/);
assert.match(speechEditorJs, /trainingWorkspaceRestore/);
assert.match(speechEditorJs, /applyWorkspacePreset\(\s*"training"[\s\S]*persist:\s*false/);
assert.match(speechEditorJs, /workspacePreset"\)\.disabled/);
assert.match(speechEditorJs, /Training-only access is locked to the Training workspace/);
assert.match(speechEditorJs, /trainingOnly/);
assert.match(speechEditorJs, /utteranceTranscriptChanged/);
assert.match(speechEditorJs, /control ===\s*"scratch that"/s);
assert.match(speechEditorCss, /body\.training-mode\.training-mobile/);
assert.match(speechEditorCss, /speech-training-prompt\{text-align:right\}/);

console.log("PASS Sherpa client ASR baseline architecture");

assert.match(
    presentationSource,
    /shouldCompactButton[\s\S]*width > 280[\s\S]*height > 48/
);
assert.match(
    presentationSource,
    /speech-response-button-facsimile[\s\S]*background[\s\S]*color[\s\S]*border/
);

assert.match(
    speechMenuSource,
    /#terminalCommitSilenceTimeout\s*=\s*120/
);
assert.match(
    speechMenuSource,
    /#elementContinuationDepth[\s\S]*#phraseCanContinue/
);
assert.match(
    speechMenuSource,
    /#candidateCommitTimeout[\s\S]*candidatePool[\s\S]*continuation/
);
assert.match(
    speechMenuSource,
    /#clearCandidatePool\([\s\S]*candidatePool\s*=\s*\[\]/
);

assert.match(
    speechMicBarSource,
    /case "utteranceTranscriptChanged":[\s\S]*#showText\(\s*this\.#currentTranscript\s*\)/
);
assert.doesNotMatch(
    speechMicBarSource,
    /case "utteranceTranscriptChanged":[\s\S]{0,500}if \(this\.#currentTranscriptFinal\)/
);
assert.match(
    speechMicBarSource,
    /case "speechPreprocessed":[\s\S]*Keep the raw recognizer transcript[\s\S]*break;/
);
assert.match(
    speechMicBarSource,
    /case "speechCommandExecuted":[\s\S]*#showPreprocessed\(\s*this\.#currentTranscript,\s*formatted\s*\)/
);

assert.match(
    speechMenuSource,
    /#commitUtterance\([\s\S]*#stopLiveRecognition\(\s*utterance,\s*false\s*\)[\s\S]*let committed/
);

assert.match(
    speechMenuSource,
    /#candidateStateAvailable[\s\S]*speech-available/
);
assert.match(
    speechMenuSource,
    /#targetIsAvailable[\s\S]*getComputedStyle/
);
assert.match(
    speechMenuSource,
    /#availableCandidates\(\)[\s\S]*#candidateStateAvailable/
);
assert.match(
    app,
    /WMOFSpeechAvailability[\s\S]*canOpenTripLog[\s\S]*canCloseTripLog[\s\S]*canCloseSurface/
);
assert.match(
    html,
    /builtin:ready:page" speech-available="WMOFSpeechAvailability\.canStartTrip"/
);
assert.match(
    html,
    /builtin:hideTripLog:page" speech-available="WMOFSpeechAvailability\.canCloseTripLog"/
);
assert.match(
    html,
    /builtin:closeSurface:default" speech-available="WMOFSpeechAvailability\.canCloseSurface"/
);

assert.match(
    speechMenuSource,
    /candidateCommitTimer:\s*undefined/
);
assert.match(
    speechMenuSource,
    /#scheduleCandidateCommit\([\s\S]*setTimeout\([\s\S]*#commitUtterance/
);
assert.match(
    speechMenuSource,
    /#cancelCandidateWork\([\s\S]*candidateCommitTimer[\s\S]*clearTimeout/
);
assert.doesNotMatch(
    speechMenuSource,
    /silenceMilliseconds\s*>=\s*SpeechMenu[\s\S]{0,220}#candidateCommitTimeout/
);

const actionFunctionsSource = fs.readFileSync(
    new URL(
        "../ActionFunctions.js",
        import.meta.url
    ),
    "utf8"
);

assert.match(
    actionFunctionsSource,
    /getImplementation\(name\)[\s\S]*implementations\.get/
);
assert.match(
    speechMenuSource,
    /speechParameterFunc[\s\S]*WMOFActionFunctions[\s\S]*getImplementation/
);
assert.match(
    speechMenuSource,
    /new ParameterParser\(\s*element\.speechParameterFunc\s*\|\|\s*element\.speechFunc\s*\)/
);

assert.match(
    speechMenuSource,
    /!pool\.length[\s\S]*"no-candidates"[\s\S]*#finishUtterance\([\s\S]*false[\s\S]*"utteranceUnrecognized"/
);
assert.match(
    speechMenuSource,
    /reason:\s*"no-candidates"[\s\S]*fast:\s*true/
);
assert.match(
    speechMicBarSource,
    /detail\?\.reason !==\s*"no-candidates"/
);
assert.match(
    speechMicBarSource,
    /detail\?\.fast[\s\S]*250[\s\S]*2000/
);
assert.match(
    speechMicBarSource,
    /#scheduleRejectedClear\(\s*utteranceId,\s*delay = 2000\s*\)/
);

window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "muted",
        {
            detail: {
                utteranceId: 20
            }
        }
    )
);
assert.equal(
    bar.getAttribute("state"),
    "muted"
);
window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "utteranceStarted",
        {
            detail: {
                id: 21
            }
        }
    )
);
assert.equal(
    bar.getAttribute("state"),
    "muted"
);
window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "utteranceTranscriptChanged",
        {
            detail: {
                id: 21,
                transcript: "listen",
                isFinal: false
            }
        }
    )
);
assert.equal(
    bar.getAttribute("state"),
    "muted"
);
window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "unmuted",
        {
            detail: {
                utteranceId: 21,
                transcript: "listen"
            }
        }
    )
);
assert.equal(
    bar.getAttribute("state"),
    "listening"
);

assert.match(
    speechMicBarSource,
    /:host\(\[state="muted"\]\)[\s\S]*#bar::after[\s\S]*opacity:\s*1/
);
assert.match(
    speechMicBarSource,
    /to bottom left[\s\S]*#e32636/
);
assert.match(
    speechMicBarSource,
    /case "utteranceStarted":[\s\S]*SpeechMenu[\s\S]*\.muted[\s\S]*"state",[\s\S]*"muted"/
);
assert.match(
    speechMicBarSource,
    /case "utteranceTranscriptChanged":[\s\S]*!globalThis\.SpeechMenu[\s\S]*\.muted[\s\S]*#showText/
);
assert.match(
    speechMenuSource,
    /exactCandidate\.kind ===\s*"wake"[\s\S]*return false/
);
assert.match(
    speechMenuSource,
    /#sleeping[\s\S]*#exactCandidate[\s\S]*kind === "wake"[\s\S]*#commitSilenceTimeout[\s\S]*#commitUtterance/
);


assert.match(
    speechMenuSource,
    /#handleLiveTranscript\([\s\S]*utterance\.committed\s*\|\|[\s\S]*utterance\.committing\s*\|\|/
);
assert.match(
    speechMenuSource,
    /#commitUtterance\([\s\S]*#cancelCandidateWork\(\s*utterance\s*\)[\s\S]*let committed/
);
assert.doesNotMatch(
    speechMenuSource,
    /#commitUtterance\([\s\S]{0,900}#clearCandidatePool\(\s*utterance\s*\)[\s\S]{0,250}let committed/
);
assert.match(
    speechMenuSource,
    /if \(committed\)[\s\S]*#clearCandidatePool\(\s*utterance\s*\)/
);
assert.match(
    speechMenuSource,
    /!pool\.length[\s\S]*!utterance\.committing[\s\S]*!SpeechMenu\.#sleeping/
);

assert.match(
    speechMenuSource,
    /#maximumCandidateHoldTimeout\s*=\s*1000/
);
assert.match(
    speechMenuSource,
    /candidateHardCommitTimer:\s*undefined[\s\S]*lastExactCandidate:\s*undefined/
);
assert.match(
    speechMenuSource,
    /!pool\.length[\s\S]*!utterance\.lastExactCandidate[\s\S]*!SpeechMenu\.#sleeping/
);
assert.match(
    speechMenuSource,
    /lastExactCandidate\s*=\s*\{[\s\S]*\.\.\.exactCandidate[\s\S]*transcript:\s*utterance\.transcript/
);
assert.match(
    speechMenuSource,
    /candidateHardCommitTimer\s*=\s*setTimeout[\s\S]*#maximumCandidateHoldTimeout/
);
assert.match(
    speechMenuSource,
    /#exactCandidate\([\s\S]*\|\|[\s\S]*lastExactCandidate[\s\S]*#commitUtterance/
);
assert.match(
    speechMenuSource,
    /#clearCandidatePool\([\s\S]*candidateHardCommitTimer[\s\S]*clearTimeout[\s\S]*lastExactCandidate\s*=\s*undefined/
);

assert.match(
    speechMicBarSource,
    /id="optionsClose"[\s\S]*aria-label="Close speech options"[\s\S]*>×<\/button>/
);
assert.match(
    speechMicBarSource,
    /#optionsClose[\s\S]*position:\s*absolute[\s\S]*top:\s*7px[\s\S]*right:\s*9px/
);
assert.match(
    speechMicBarSource,
    /#optionsClose[\s\S]*addEventListener\([\s\S]*"click"[\s\S]*hideOptions/
);
assert.doesNotMatch(
    speechMicBarSource,
    /--speech-option-row-height/
);
assert.match(
    speechMicBarSource,
    /\.option-card[\s\S]*padding:\s*8px 0/
);

assert.match(
    speechMicBarSource,
    /id="optionsHeader">Speech Options<\/div>/
);
assert.match(
    speechMicBarSource,
    /#optionsHeader[\s\S]*position:\s*absolute[\s\S]*line-height:\s*28px/
);

assert.match(
    speechMenuSource,
    /#utterance\.committed\s*\|\|[\s\S]*#utterance[\s\S]*\.recognitionStopped[\s\S]*level >= SpeechMenu\.#speechThreshold/
);
assert.match(
    speechMenuSource,
    /silenceMilliseconds >=[\s\S]*#commitSilenceTimeout[\s\S]*#commitUtterance/
);
assert.match(
    speechMenuSource,
    /#onVadSpeechStart[\s\S]*recognitionStopped[\s\S]*"recognition-committed"/
);
assert.match(
    speechMenuSource,
    /#onVadSpeechEnd[\s\S]*#exactCandidate[\s\S]*#commitUtterance/
);
assert.match(
    speechMenuSource,
    /#commitUtterance\([\s\S]*#cancelCandidateWork\([\s\S]*#stopLiveRecognition\([\s\S]*false[\s\S]*let committed/
);

assert.match(
    speechMenuSource,
    /#hasCompetingContinuation\([\s\S]*candidate !==[\s\S]*exactCandidate[\s\S]*candidate[\s\S]*\.continuation/
);
assert.match(
    speechMenuSource,
    /#scheduleCandidateCommit\([\s\S]*#hasCompetingContinuation\([\s\S]*return false/
);

assert.match(
    speechMenuSource,
    /candidateHardCommitAt:\s*undefined/
);
assert.match(
    speechMenuSource,
    /now >=[\s\S]*candidateHardCommitAt[\s\S]*#commitHeldCandidate/
);
assert.match(
    speechMenuSource,
    /#commitHeldCandidate\([\s\S]*lastExactCandidate[\s\S]*candidatePool = \[[\s\S]*#commitUtterance/
);
assert.match(
    speechMenuSource,
    /candidateHardCommitAt\s*=\s*performance\.now\(\)\s*\+[\s\S]*#maximumCandidateHoldTimeout/
);

assert.match(
    sherpaRecognizerSource,
    /runtimeVersion:\s*version/
);
assert.match(
    sherpaWorkerSource,
    /function runtimeUrl\(path\)[\s\S]*runtimeVersion[\s\S]*url\.search/
);
assert.match(
    sherpaWorkerSource,
    /importScripts\([\s\S]*runtimeUrl\([\s\S]*sherpa-onnx-asr\.js/
);
assert.match(
    sherpaRuntimeHtaccessSource,
    /max-age=31536000, immutable/
);
assert.match(
    sherpaRuntimeHtaccessSource,
    /wasm\|data\|onnx\|js\|txt/
);

assert.match(
    app,
    /SHERPA_ASSET_VERSION\s*=\s*"2026-09-23-1"[\s\S]*speechRuntimeVersion[\s\S]*\?sherpa=/
);

assert.match(
    fs.readFileSync(
        new URL(
            "../SpeechEditorRuntime.js",
            import.meta.url
        ),
        "utf8"
    ),
    /response\.status === 401[\s\S]*response\.status === 403[\s\S]*return undefined/
);
assert.match(
    fs.readFileSync(
        new URL(
            "../SpeechEditorRuntime.js",
            import.meta.url
        ),
        "utf8"
    ),
    /if \(!config\)[\s\S]*return;[\s\S]*registerMacros/
);

assert.doesNotMatch(
    app,
    /serviceWorker\s*\.register\([\s\S]*SpeechAssetCacheWorker\.js/
);
assert.match(
    app,
    /clearLegacySpeechAssetCache[\s\S]*getRegistrations[\s\S]*SpeechAssetCacheWorker\.js[\s\S]*unregister/
);
assert.match(
    app,
    /clearLegacySpeechAssetCache[\s\S]*wmof-sherpa-[\s\S]*caches\.delete/
);
