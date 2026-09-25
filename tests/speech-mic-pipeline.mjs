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
    customElements: window.customElements,
    getComputedStyle:
        window.getComputedStyle.bind(
            window
        )
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
assert.equal(
    typeof bar.setSystemSpeechPatterns,
    "function"
);

const systemSpeechMenu =
    bar.querySelector(
        ':scope > speech-menu[speech-modal="system"]'
    );
const wakeSystemCommand =
    systemSpeechMenu?.querySelector(
        '[data-speech-system-command="wake"]'
    );
const sleepSystemCommand =
    systemSpeechMenu?.querySelector(
        '[data-speech-system-command="sleep"]'
    );
const offSystemCommand =
    systemSpeechMenu?.querySelector(
        '[data-speech-system-command="off"]'
    );
const commandsSystemCommand =
    systemSpeechMenu?.querySelector(
        '[data-speech-system-command="commands"]'
    );

assert.ok(systemSpeechMenu);
assert.ok(wakeSystemCommand);
assert.ok(sleepSystemCommand);
assert.ok(offSystemCommand);
assert.ok(commandsSystemCommand);
assert.equal(
    wakeSystemCommand.getAttribute(
        "speech-function"
    ),
    "SpeechMenu.wake"
);
assert.equal(
    sleepSystemCommand.getAttribute(
        "speech-function"
    ),
    "SpeechMenu.sleep"
);
assert.equal(
    offSystemCommand.getAttribute(
        "speech-function"
    ),
    "WMOFActions.disableSpeechRecognition"
);
assert.equal(
    commandsSystemCommand.getAttribute(
        "speech-function"
    ),
    "WMOFActions.toggleSpeechOptions"
);
assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                commandsSystemCommand
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ].sort(),
    [
        "commands",
        "speech commands"
    ]
);
assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                wakeSystemCommand
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ].sort(),
    [
        "wake"
    ]
);
assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                sleepSystemCommand
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ].sort(),
    [
        "sleep"
    ]
);
assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                offSystemCommand
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ],
    [
        "off"
    ]
);

bar.remove();

assert.equal(
    await SpeechMenu.sleep(),
    true
);
assert.equal(
    SpeechMenu.muted,
    true
);
assert.equal(
    await SpeechMenu.wake(),
    true
);
assert.equal(
    SpeechMenu.muted,
    false
);

window.document.body.append(
    bar
);

const trainingCommand =
    window.document.createElement(
        "div"
    );
trainingCommand.dataset
    .speechSystemCommand =
    "commands";
trainingCommand.setAttribute(
    "speech-pattern",
    "^(?:speech )?commands$"
);

const trainingRow =
    window.document.createElement(
        "div"
    );

let selectedTrainingTarget;
bar.addEventListener(
    "speech-training-target-selected",
    event => {
        selectedTrainingTarget =
            event.detail;
    },
    {
        once: true
    }
);

bar.trainingMode =
    true;

assert.equal(
    bar.selectTrainingTarget({
        source:
            "mic-bar",
        category:
            "system",
        card:
            "commands",
        phrase:
            "commands",
        display:
            "commands",
        element:
            trainingCommand,
        row:
            trainingRow
    }),
    true
);

assert.equal(
    selectedTrainingTarget?.phrase,
    "commands"
);
assert.equal(
    bar.trainingTarget?.commandKey,
    "commands"
);
assert.equal(
    trainingRow.classList.contains(
        "training-selected"
    ),
    true
);

const trainingTelemetry =
    [];

bar.addEventListener(
    "speech-training-telemetry",
    event => {
        trainingTelemetry.push(
            event.detail
        );
    }
);

window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "utteranceStarted",
        {
            detail: {
                id: 701
            }
        }
    )
);

window.SpeechMenu.events.dispatchEvent(
    new window.CustomEvent(
        "utteranceTranscribed",
        {
            detail: {
                id: 701,
                transcript:
                    "commands"
            }
        }
    )
);

const transcribedTrainingTelemetry =
    trainingTelemetry.find(
        event =>
            event.type ===
            "utteranceTranscribed"
    );

assert.ok(
    transcribedTrainingTelemetry
);
assert.equal(
    transcribedTrainingTelemetry
        .utteranceId,
    701
);
assert.equal(
    transcribedTrainingTelemetry
        .heard,
    "commands"
);
assert.equal(
    transcribedTrainingTelemetry
        .target
        ?.phrase,
    "commands"
);

bar.trainingLocked =
    true;

assert.equal(
    bar.selectTrainingTarget({
        source:
            "mic-bar",
        category:
            "system",
        card:
            "wake",
        phrase:
            "wake",
        display:
            "wake",
        element:
            trainingCommand,
        row:
            trainingRow
    }),
    false
);

assert.equal(
    bar.trainingTarget?.phrase,
    "commands"
);

bar.trainingMode =
    false;

assert.equal(
    bar.trainingTarget,
    undefined
);

assert.equal(
    SpeechMenu.synthesizedSpeechActive,
    false
);
const synthesizedSpeechToken =
    SpeechMenu.registerSynthesizedSpeech(
        "Trip started"
    );
assert.equal(
    SpeechMenu.synthesizedSpeechActive,
    true
);
assert.equal(
    SpeechMenu.unregisterSynthesizedSpeech(
        synthesizedSpeechToken,
        {
            graceMilliseconds: 0
        }
    ),
    true
);
assert.equal(
    SpeechMenu.synthesizedSpeechActive,
    false
);

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
assert.doesNotMatch(
    html,
    /speech-modal="default"[\s\S]*\^\(\?:speech \)\?commands\$[\s\S]*WMOFActions\.toggleSpeechOptions/
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
    "cancelDown",
    "tripGoal",
    "totalGoal",
    "setTripGoal",
    "setTotalGoal",
    "readGoalMode",
    "goalMode",
    "sync",
    "lockEndTime",
    "showTripLog",
    "hideTripLog",
    "deferTrip",
    "readRenderedTime",
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
assert.match(html, /builtin:yes:speechBreakConfirmDialog/);
assert.match(html, /builtin:no:speechBreakConfirmDialog/);
assert.match(html, /builtin:cancel:speechBreakConfirmDialog/);
assert.match(html, /id="cancelDownConfirmDialog"/);
assert.match(html, /Press\/Say OK to Cancel your down time/);
assert.match(html, /builtin:yes:cancelDownConfirmDialog/);
assert.match(html, /builtin:no:cancelDownConfirmDialog/);
assert.match(
    html,
    /builtin:cancelDown:page[\s\S]*speech-available="WMOFSpeechAvailability\.canCancelDownTime"[\s\S]*speech-pattern="\^cancel\$"[\s\S]*WMOFActions\.cancelDownTime/
);
assert.match(html, /builtin:standardTime:scheduledStartStandard/);
assert.match(html, /builtin:standardTime:trip-settings/);

const recognitionIndex = html.indexOf('id="speechRecognitionButton"');
const developerIndex = html.indexOf('id="developerMenuButton"');
const speechToolsIndex = html.indexOf('id="speechMenuButton"');
const trainingIndex = html.indexOf('id="speechTrainingButton"');
const editorIndex = html.indexOf('id="speechEditorButton"');
const databaseIndex = html.indexOf('id="sqlConsoleButton"');

assert.ok(recognitionIndex >= 0);
assert.ok(developerIndex > recognitionIndex);
assert.ok(speechToolsIndex > developerIndex);
assert.ok(trainingIndex > speechToolsIndex && editorIndex > trainingIndex);
assert.ok(databaseIndex > editorIndex);
assert.match(html, /id="developerMenuGroup"/);
assert.match(html, /id="speechToolsGroup"/);
assert.match(html, /id="sqlConsoleButton"[^>]*>Database Access</);
assert.match(html, /id="speechTrainingButton"[^>]*>Speech Training</);
assert.match(html, /id="speechEditorButton"[^>]*hidden/);
assert.match(html, /id="speechTrainingChoiceDialog"/);
assert.match(html, /id="speechTrainingPendingDialog"/);
assert.match(html, /id="speechTrainingPendingCommit"[^>]*>Commit</);
assert.match(html, /id="speechTrainingPendingDiscard"[^>]*>Discard</);
assert.match(html, /id="speechTrainingPendingCancel"[^>]*>Cancel</);
assert.match(html, /id="speechTrainingInAppChoice"/);
assert.match(html, /id="speechTrainingEditorChoice"/);
assert.match(html, /id="speechTrainingWidget"[^>]*popover="manual"[^>]*hidden/);
assert.match(html, /id="speechTrainingDragHandle"/);
assert.match(html, /id="speechTrainingStartStop"[^>]*disabled>Start</);
assert.match(html, /id="speechTrainingHeardStatus"/);
assert.match(html, /id="speechTrainingResults"/);
assert.match(html, /id="speechTrainingResultsCount"/);
assert.match(html, /id="speechTrainingResultsList"/);
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
const languageSource = fs.readFileSync(new URL("../lang/en-US.js", import.meta.url), "utf8");
assert.match(app, /speechRecognitionButton\?\.addEventListener[\s\S]*setSpeechLayoutState\(true\);[\s\S]*ensureSpeechRuntime/);
assert.match(
    app,
    /getSpeechMicTop\(\)[\s\S]*--speech-mic-row-height[\s\S]*paddingBottom/
);
assert.match(
    app,
    /getTripLogBottomRect\(\)[\s\S]*getSpeechMicTop\(\)\s*-\s*metrics\.height/
);
assert.match(
    app,
    /getTripLogBodyRect\(\)[\s\S]*const bottom =[\s\S]*getSpeechMicTop\(\)/
);
assert.match(
    app,
    /animateTripLogBody\([\s\S]*anchorBottom[\s\S]*height =[\s\S]*fullHeight[\s\S]*top:[\s\S]*anchorBottom -[\s\S]*height/
);
assert.match(
    app,
    /const sourceRect\s*=\s*tripLogButton\.getBoundingClientRect\(\)[\s\S]*animateTripLogButton\([\s\S]*topRect\.top - sourceRect\.top/
);
assert.match(
    app,
    /const destination =[\s\S]*getTripLogBottomRect\(\)[\s\S]*destination\.top - topRect\.top/
);

assert.match(
    app,
    /const disableSpeechRecognitionRuntime =[\s\S]*setSpeechButtonState\([\s\S]*false[\s\S]*setSpeechLayoutState\([\s\S]*false[\s\S]*suspendListening\?\.\([\s\S]*"speech-recognition-disabled"/
);
assert.match(
    app,
    /const enableSpeechRecognitionRuntime =[\s\S]*speechRecognitionSuspended[\s\S]*speechMenu\?\.started[\s\S]*resumeListening\?\.\([\s\S]*"speech-recognition-disabled"[\s\S]*return true/
);
assert.doesNotMatch(
    app,
    /const disableSpeechRecognitionRuntime =[\s\S]{0,1400}SpeechMenu[\s\S]{0,250}\.stop\?\.\(/
);
assert.match(
    app,
    /if \(enabled\) \{[\s\S]*await disableSpeechRecognitionRuntime\(\)[\s\S]*return;/
);
assert.match(
    app,
    /disableSpeechRecognition\(\) \{[\s\S]*return disableSpeechRecognitionRuntime\(\)/
);
assert.match(app, /ensureSpeechRuntime/);
assert.match(app, /speech-editor-preview/);
assert.match(app, /function showInitialLoginDialog\(\)[\s\S]*if \(speechEditorPreview\)[\s\S]*return false;/);
assert.match(app, /function showConnectionRetryLoginDialog\(\)[\s\S]*if \(speechEditorPreview\)[\s\S]*return false;/);
assert.doesNotMatch(app, /startIndependentTimer|stopIndependentTimer|resetIndependentTimer|renderIndependentTimer|timerAccumulated|timerStartedAt/);
assert.match(app, /loadClassicScript\(\s*"SherpaRecognizer\.js"\s*\)/s);
assert.match(app, /speechDiagnosticsEnabled/);
assert.match(
    app,
    /canCancelDownTime\(\)[\s\S]*downCancelButton[\s\S]*intervalType[\s\S]*"down"/
);
assert.match(
    app,
    /cancelDownTime\(\)[\s\S]*cancelDownConfirmDialog[\s\S]*Press\/Say OK to Cancel your down time[\s\S]*WMOFAudio[\s\S]*\.speak/
);
assert.match(
    app,
    /confirmCancelDownTime\(\)[\s\S]*clockTimer[\s\S]*\.cancelInterval\([\s\S]*renderTripActionState/
);
assert.match(
    app,
    /continueDownTime\(\)[\s\S]*cancel-down-declined/
);
assert.doesNotMatch(
    app,
    /async cancelDownTime\(\)[\s\S]{0,700}endCurrentIntervalOrTrip/
);
assert.match(app, /speech-pipeline/);
assert.match(app, /speechPipeline\s*=\s*[\s\S]*"silero"[\s\S]*"raw"/);
assert.match(app, /loadClassicScript\(\s*"SileroVad\.js"\s*\)/s);
assert.match(app, /loadClassicScript\(\s*"SpeechDiagnostics\.js"\s*\)/s);
assert.match(app, /document\.createElement\(\s*"speech-diagnostics"\s*\)/s);
assert.match(app, /openSpeechTraining\(\)/);
assert.match(app, /api\/admin\/speech-editor\/\?training=1/);
assert.match(app, /speechToolsGroup[\s\S]*speechTrainingButton[\s\S]*speechEditorButton/);
assert.match(app, /DEVELOPER_MENU_PERMISSION_MASK\s*=\s*[\s\S]*PERMISSION_DEVELOPER_PREVIEW[\s\S]*PERMISSION_DEVELOPER/);
assert.doesNotMatch(app, /DEVELOPER_MENU_PERMISSION_MASK\s*=\s*[\s\S]{0,120}PERMISSION_SUPERUSER/);
assert.match(
    html,
    /id="developerMenuButton"[^>]*aria-expanded="false"[^>]*aria-controls="developerSubmenu"/
);
assert.match(
    html,
    /id="developerSubmenu"[^>]*hidden/
);
assert.match(app, /menuLogoutSlot\?\.append\(authButton\)/);
assert.match(app, /menuAccountRow\?\.append\(authButton\)/);
assert.match(
    app,
    /prepareStartMenu\(\)[\s\S]*armSpeechReadyContinuation\(\)[\s\S]*openStartMenuWorkflow/
);

assert.match(
    app,
    /scheduleStartAt\([\s\S]*fromReadyContinuation[\s\S]*pendingSpeechReady[\s\S]*newTripButton[\s\S]*!continuingReady/
);
assert.match(
    app,
    /continuingReady[\s\S]*numberPadDialog[\s\S]*workflow ===[\s\S]*"new-trip"[\s\S]*closeNumberPad\([\s\S]*discardPrepared:[\s\S]*false/
);
assert.match(
    app,
    /canContinueStartAt\(\)[\s\S]*pendingSpeechReady\s*!==[\s\S]*undefined/
);

assert.match(
    app,
    /handleSpeechRuntimeStarted\(\)[\s\S]*setSpeechButtonState\([\s\S]*true,[\s\S]*false[\s\S]*setSpeechLayoutState\([\s\S]*true/
);
assert.match(
    app,
    /handleSpeechRuntimeStopped\(\)[\s\S]*cancelPendingSpeechReady\(\)[\s\S]*setSpeechButtonState\([\s\S]*false,[\s\S]*false[\s\S]*setSpeechLayoutState\([\s\S]*false/
);
assert.match(
    app,
    /speechMicBar\?\.addEventListener\([\s\S]*"stopped"[\s\S]*actions[\s\S]*\.handleSpeechRuntimeStopped\(\)/
);
assert.match(
    app,
    /speechMicBar\?\.addEventListener\([\s\S]*"speechCaptureEnded"[\s\S]*actions[\s\S]*\.handleSpeechRuntimeStopped\(\)/
);
assert.doesNotMatch(
    app,
    /addEventListener\("speechCaptureEnded"[\s\S]{0,500}setSpeechButtonState/
);
assert.match(
    app,
    /continueStartAt\([\s\S]*canContinueStartAt\(\)[\s\S]*scheduleStartAt\([\s\S]*fromReadyContinuation:[\s\S]*true/
);
assert.match(
    app,
    /readyAt:"#newTripButton", ready:"#newTripButton"/
);
assert.doesNotMatch(
    app,
    /readyAtContinuation:"#newTripButton"/
);

assert.match(
    actionFunctionsSource,
    /"handle"/
);
assert.match(
    app,
    /key ===[\s\S]*"readyAtContinuation"[\s\S]*speech-available[\s\S]*WMOFActions\.canContinueStartAt/
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
assert.match(
    app,
    /canCloseSurface\(\)[\s\S]*isInterruptGroupActive[\s\S]*primary-surface/
);
assert.match(
    app,
    /interruptGroup:\s*"primary-surface"/
);
assert.match(
    app,
    /openNumberPad\([\s\S]*signal[\s\S]*ensureNumberPadLoaded\(\)[\s\S]*signal\?\.aborted/
);
assert.match(
    app,
    /setCloudIconVisualState[\s\S]*rotateY\(90deg\)[\s\S]*applyState\([\s\S]*controller[\s\S]*targetState/
);
assert.match(app, /element:\s*\$\("#speechTrainingButton"\)[\s\S]*event:\s*"click"[\s\S]*action:\s*"openSpeechTraining"/);
assert.match(app, /speechTrainingButton\.disabled\s*=\s*[\s\S]*speechTrainingActive/);
assert.match(app, /speechRecognitionButton\.disabled\s*=\s*[\s\S]*speechTrainingActive/);
assert.match(app, /disableSpeechRecognitionRuntime[\s\S]*if \(speechTrainingActive\)[\s\S]*return false/);
assert.match(app, /startInAppSpeechTraining[\s\S]*speechMenu\.muted[\s\S]*speechMenu\.executionEnabled\s*=\s*false/);
assert.match(app, /stopInAppSpeechTraining[\s\S]*executionEnabled\s*=\s*speechTrainingExecutionBeforeStart/);
assert.match(
    app,
    /speech-training-telemetry[\s\S]*speechCommandMatched[\s\S]*utteranceTranscribed[\s\S]*return;[\s\S]*utteranceCommitted[\s\S]*utteranceUnrecognized[\s\S]*finalizeSpeechTrainingResult/
);
assert.match(
    app,
    /finalizeSpeechTrainingResult[\s\S]*"accepted"[\s\S]*"model-miss"[\s\S]*"divergence"[\s\S]*"discarded"[\s\S]*speechTrainingPendingSamples[\s\S]*\.push/
);
assert.match(
    app,
    /speechTrainingResultPresentation[\s\S]*symbol:[\s\S]*"✓"[\s\S]*"model-miss"[\s\S]*symbol:[\s\S]*"✓"[\s\S]*"divergence"[\s\S]*symbol:[\s\S]*"×"/
);
assert.match(
    app,
    /reviewSpeechTrainingDivergence[\s\S]*"divergence-review"[\s\S]*"approve"[\s\S]*"merge"[\s\S]*"purge"/
);
assert.match(
    app,
    /removeSpeechTrainingResult[\s\S]*method:[\s\S]*"DELETE"[\s\S]*action:[\s\S]*"contribution"/
);
assert.match(
    app,
    /commitPendingSpeechTrainingSamples[\s\S]*persistInAppSpeechTrainingSample[\s\S]*\.shift\([\s\S]*renderPendingSpeechTrainingMessage/
);
assert.match(
    app,
    /persistInAppSpeechTrainingSample[\s\S]*target\.source ===[\s\S]*"mic-bar"[\s\S]*"system:speech-controls"[\s\S]*commandId[\s\S]*commandKey/
);
assert.match(
    app,
    /persistInAppSpeechTrainingSample[\s\S]*action:[\s\S]*"sample"[\s\S]*componentKey[\s\S]*phraseKey[\s\S]*observed[\s\S]*trainingStyle:[\s\S]*"in-app"[\s\S]*pipeline[\s\S]*runtimeRevision/
);

assert.match(
    app,
    /pendingSpeechTrainingTargetLabel[\s\S]*speechTrainingPendingSamples[\s\S]*\[\s*0\s*\][\s\S]*\.target[\s\S]*speechTrainingTarget/
);
assert.match(
    app,
    /renderPendingSpeechTrainingMessage[\s\S]*speechTrainingPendingReason[\s\S]*pendingSpeechTrainingTargetLabel/
);
assert.match(
    app,
    /renderPendingSpeechTrainingMessage[\s\S]*"Commit or discard them before changing phrases\."[\s\S]*"Commit or discard them before leaving Speech Training\."/
);
assert.match(
    app,
    /promptPendingSpeechTrainingSamples[\s\S]*renderPendingSpeechTrainingMessage/
);
assert.match(
    app,
    /speech-training-target-requested[\s\S]*event\.preventDefault\(\)[\s\S]*promptPendingSpeechTrainingSamples[\s\S]*"switch"[\s\S]*selectTrainingTarget/
);
assert.match(
    app,
    /async function disableInAppSpeechTraining[\s\S]*promptPendingSpeechTrainingSamples[\s\S]*"exit"[\s\S]*decision === "cancel"/
);
assert.match(
    app,
    /async disconnectUser\(\)[\s\S]*speechTrainingActive[\s\S]*disableInAppSpeechTraining\(\)/
);
assert.match(
    app,
    /updateSpeechTrainingCount[\s\S]*speechTrainingResultsHistory[\s\S]*state !==[\s\S]*"discarded"/
);
assert.match(
    app,
    /trainingResultState:[\s\S]*sample\.state[\s\S]*modelAccepted:[\s\S]*sample\.modelAccepted[\s\S]*divergenceStatus/
);
assert.match(
    app,
    /normalizeSpeechTrainingObserved[\s\S]*lastLiveTranscript[\s\S]*live \+[\s\S]*" " \+[\s\S]*live[\s\S]*normalizedFinalArtifact/
);
assert.match(
    app,
    /speechTrainingEnglishSoftOmission[\s\S]*weakConsonants[\s\S]*"s"[\s\S]*"h"/
);
assert.match(
    app,
    /speechTrainingEnglishSoftOmission[\s\S]*softClusters[\s\S]*"sh"[\s\S]*"th"[\s\S]*"ph"[\s\S]*"wh"/
);
assert.match(
    app,
    /speechTrainingTokenBelongsToFamily[\s\S]*observed \+ "s"[\s\S]*expected[\s\S]*observed \+ "es"/
);
assert.match(
    app,
    /speechTrainingTokenBelongsToFamily[\s\S]*speechTrainingEnglishSoftOmission/
);
assert.match(
    app,
    /speechTrainingExpectedPhraseMatches[\s\S]*heardTokens[\s\S]*templateTokens[\s\S]*speechTrainingTokenBelongsToFamily/
);
assert.match(
    app,
    /placeholderSet[\s\S]*visit\([\s\S]*heardIndex/
);
assert.doesNotMatch(
    app,
    /overlap >=\s*\.66/
);
assert.match(
    app,
    /utteranceTranscriptChanged[\s\S]*isFinal !==[\s\S]*true[\s\S]*lastLiveTranscript/
);
assert.match(
    app,
    /rawObserved:[\s\S]*normalizedObserved[\s\S]*normalizedFinalArtifact/
);
assert.match(
    app,
    /rawObserved:[\s\S]*sample\.rawObserved[\s\S]*normalizedFinalArtifact:[\s\S]*sample\.normalizedFinalArtifact/
);
assert.match(app, /speechTrainingDragHandle[\s\S]*pointerdown[\s\S]*setPointerCapture/);
assert.match(app, /function showSpeechTrainingWidget[\s\S]*showPopover/);
assert.match(app, /speech-training-target-selected[\s\S]*showSpeechTrainingWidget\(\{[\s\S]*promote:\s*true/);
assert.match(app, /speech-options-opened[\s\S]*showSpeechTrainingWidget\(\{[\s\S]*promote:\s*true/);
assert.doesNotMatch(
    app,
    /enableInAppSpeechTraining[\s\S]{0,1800}speechTrainingWidget\.hidden\s*=\s*false/
);
assert.match(app, /element:\s*\$\("#speechEditorButton"\)[\s\S]*event:\s*"click"[\s\S]*action:\s*"openSpeechEditor"/);
assert.match(app, /speech-build-active/);
assert.match(app, /1050/);

console.log("PASS persistent speech pipeline and SpeechMicBar public API");

assert.match(css, /speech-mic-bar\s*\{[^}]*grid-row:\s*7;[^}]*display:\s*block;/s);
assert.match(css, /\.trip-log-button\s*\{[^}]*grid-row:\s*6;/s);
assert.match(
    css,
    /grid-template-rows:\s*52px 142px 62px 29px 1fr var\(--trip-log-row-height\) var\(--speech-mic-row-height\)/
);
assert.match(
    css,
    /speech-mic-bar\[popover\][\s\S]*--speech-mic-fixed-bottom[\s\S]*--speech-mic-fixed-left[\s\S]*--speech-mic-fixed-width/
);
assert.match(css, /speech-mic-bar:not\(:defined\)/);
assert.match(css, /#speechTrainingButton::before/);
assert.match(css, /\.speech-training-widget[\s\S]*height:\s*64px/);
assert.match(css, /\.speech-training-widget\[popover\]:popover-open[\s\S]*display:\s*grid/);
assert.match(css, /\.speech-training-copy[\s\S]*height:\s*56px[\s\S]*grid-template-rows:\s*1fr 1fr/);
assert.match(css, /\.speech-training-start-stop[\s\S]*height:\s*56px/);
assert.match(css, /speech-training-result-icon\[data-result="accepted"\][\s\S]*#7fe6a2/);
assert.match(css, /speech-training-result-icon\[data-result="model-miss"\][\s\S]*var\(--wm-red/);
assert.match(css, /speech-training-result-icon\[data-result="discarded"\][\s\S]*#f59e0b/);
assert.match(css, /speech-training-result-remove::before[\s\S]*mask:/);
assert.match(css, /\.main-menu button:disabled[\s\S]*cursor:\s*not-allowed/);
assert.match(css, /#speechEditorButton::before/);
assert.match(css, /#developerMenuButton::before/);
assert.match(css, /#accessTokensButton::before/);
assert.match(css, /#sqlConsoleButton::before/);
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

assert.match(
    speechMicBarSource,
    /#syncHostBounds\(\)[\s\S]*documentElement[\s\S]*document\.body[\s\S]*this\.parentElement[\s\S]*--speech-mic-fixed-left[\s\S]*--speech-mic-fixed-width[\s\S]*--speech-mic-fixed-bottom/
);
assert.match(
    speechMicBarSource,
    /#contentBounds\([\s\S]*paddingLeft[\s\S]*paddingRight[\s\S]*paddingBottom/
);
assert.match(
    speechMicBarSource,
    /#observeHostBounds\(\)[\s\S]*ResizeObserver[\s\S]*addEventListener\?\.\([\s\S]*"resize"/
);

assert.match(
    speechMicBarSource,
    /ensureCommand\(\s*"commands",[\s\S]*\^\(\?:speech \)\?commands\$[\s\S]*WMOFActions\.toggleSpeechOptions/
);
const presentationSource = fs.readFileSync(new URL("../PresentationSetters.js", import.meta.url), "utf8");
const speechEditorConfigSource = fs.readFileSync(new URL("../api/speech-editor-config/index.php", import.meta.url), "utf8");
const sherpaRecognizerSource = fs.readFileSync(new URL("../SherpaRecognizer.js", import.meta.url), "utf8");
const sherpaWorkerSource = fs.readFileSync(new URL("../speech/SherpaWorker.js", import.meta.url), "utf8");
const sherpaRuntimeHtaccessSource = fs.readFileSync(new URL("../speech/sherpa/runtime/.htaccess", import.meta.url), "utf8");
const speechAssetCacheWorkerSource = fs.readFileSync(new URL("../SpeechAssetCacheWorker.js", import.meta.url), "utf8");
const audioWorkletSource = fs.readFileSync(new URL("../speech/SpeechAudioWorklet.js", import.meta.url), "utf8");
const audioEngineSource = fs.readFileSync(new URL("../api/audio/AudioEngine.js", import.meta.url), "utf8");

assert.match(speechMenuSource, /static #silenceTimeout = 5000;/);
assert.match(speechMenuSource, /static #commitSilenceTimeout = 350;/);
assert.match(speechMenuSource, /new globalThis\.SherpaRecognizer/);
assert.match(
    speechMenuSource,
    /#hotwords\(\)[\s\S]*querySelectorAll\(\s*"\[speech-pattern\]"\s*\)[\s\S]*#expandRegexSource/
);
assert.match(
    speechMenuSource,
    /#recognizerHotwordKey\s*=\s*""[\s\S]*#refreshRecognizerHotwords\(\)[\s\S]*JSON\.stringify\([\s\S]*key ===[\s\S]*#recognizerHotwordKey[\s\S]*return false[\s\S]*setHotwords/
);
assert.match(
    speechMenuSource,
    /extrapolatePhrases\(\)[\s\S]*#refreshRecognizerHotwords\(\)[\s\S]*return SpeechMenu\.#phrases/
);
assert.match(speechMenuSource, /echoCancellation:\s*true/);
assert.match(speechMenuSource, /noiseSuppression:\s*false/);
assert.match(speechMenuSource, /autoGainControl:\s*false/);
assert.match(speechMenuSource, /static #executionEnabled = true;/);
assert.match(speechMenuSource, /registerSynthesizedSpeech/);
assert.match(speechMenuSource, /unregisterSynthesizedSpeech/);
assert.match(speechMenuSource, /#stripSynthesizedSpeech/);
assert.match(
    audioEngineSource,
    /startSong\([\s\S]*suspendListening\s*=\s*false/
);
assert.match(
    audioEngineSource,
    /registerSynthesizedSpeech/
);
assert.match(
    audioEngineSource,
    /unregisterSynthesizedSpeech/
);
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
    /#optionsGrid[\s\S]*display:\s*flex[\s\S]*flex-flow:\s*row nowrap/
);
assert.match(
    speechMicBarSource,
    /\.option-pane[\s\S]*flex:\s*1 1 0[\s\S]*align-self:\s*flex-start/
);
assert.match(
    speechMicBarSource,
    /\.option-category[\s\S]*grid-template-columns:[\s\S]*42px[\s\S]*minmax\(0, 1fr\)/
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
    /data-speech-options-group/
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
    /case "utteranceTranscriptChanged":[\s\S]*#showStreamingPhrase\(\s*this\.#currentTranscript\s*\)/
);
assert.doesNotMatch(
    speechMicBarSource,
    /case "utteranceTranscriptChanged":[\s\S]{0,500}if \(this\.#currentTranscriptFinal\)/
);
assert.match(
    speechMicBarSource,
    /case "speechPreprocessed":[\s\S]*detail\?\.contextChange[\s\S]*#showStreamingContext\(\s*detail\s*\)[\s\S]*break;/
);
assert.match(
    speechMicBarSource,
    /case "speechCommandExecuted":[\s\S]*#showPreprocessed\(\s*this\.#currentTranscript,\s*formatted\s*\)/
);
assert.match(
    speechMicBarSource,
    /showOptions\([\s\S]*getComputedStyle[\s\S]*#optionsPanel[\s\S]*currentClipPath/
);
assert.match(
    speechMicBarSource,
    /hideOptions\([\s\S]*getComputedStyle[\s\S]*#optionsPanel[\s\S]*currentClipPath/
);
assert.match(
    speechMicBarSource,
    /hideOptions\([\s\S]*removeAttribute\(\s*"options-open"\s*\)[\s\S]*aria-hidden[\s\S]*animation\.finished/
);
assert.match(
    app,
    /speechMicBar[\s\S]*\.optionsOpen[\s\S]*void speechMicBar[\s\S]*\.hideOptions\?\.\(\)[\s\S]*return true/
);
assert.match(
    speechMicBarSource,
    /get trainingMode\(\)[\s\S]*training-mode/
);
assert.match(
    speechMicBarSource,
    /get trainingLocked\(\)[\s\S]*training-locked/
);
assert.match(
    speechMicBarSource,
    /"speech-training-target-selected"/
);
assert.match(
    speechMicBarSource,
    /"speech-training-target-requested"[\s\S]*cancelable:\s*true/
);
assert.match(
    speechMicBarSource,
    /selectTrainingTarget\([\s\S]*#selectTrainingTarget/
);
assert.match(
    speechMicBarSource,
    /"speech-training-telemetry"/
);
assert.match(
    speechMicBarSource,
    /const utteranceId =[\s\S]*detail\?\.id[\s\S]*detail\?\.utteranceId[\s\S]*#currentUtteranceId/
);
assert.match(
    speechMicBarSource,
    /const heard =[\s\S]*detail\?\.transcript[\s\S]*originalTranscript[\s\S]*#currentTranscript[\s\S]*responseText/
);
assert.match(
    speechMicBarSource,
    /toggleTrainingMic[\s\S]*if \(this\.trainingLocked\)[\s\S]*SpeechMenu[\s\S]*\.wake\?\.|\.sleep\?\./
);
assert.match(
    speechMicBarSource,
    /data-speech-system-command="commands"/
);
assert.match(
    speechMicBarSource,
    /source:\s*"mic-bar"[\s\S]*phrase:\s*"commands"/
);
assert.match(
    speechMicBarSource,
    /source:\s*"command"[\s\S]*category:\s*categoryKey[\s\S]*card:\s*card\.key/
);
assert.match(
    speechMicBarSource,
    /\.option-phrase\.training-selected[\s\S]*--speech-training-category-color[\s\S]*--speech-training-contrast/
);
assert.match(
    speechMicBarSource,
    /\.option-phrase\.training-selected code[\s\S]*--speech-training-contrast[\s\S]*!important/
);
assert.match(
    speechMicBarSource,
    /"speech-options-opened"/
);
assert.match(
    speechMicBarSource,
    /blackContrast[\s\S]*whiteContrast[\s\S]*black[\s\S]*white/
);

bar.trainingMode = true;
assert.equal(
    bar.hasAttribute("training-mode"),
    true,
    "mic bar should expose training mode"
);
bar.trainingLocked = true;
assert.equal(
    bar.hasAttribute("training-locked"),
    true,
    "mic bar should lock phrase selection while listening"
);
bar.trainingMode = false;
assert.equal(
    bar.hasAttribute("training-mode"),
    false
);
assert.equal(
    bar.hasAttribute("training-locked"),
    false
);

assert.match(
    speechMicBarSource,
    /id="optionsHeader">Speech Commands<\/div>/
);
assert.match(
    speechMicBarSource,
    /option-phrase\.unimplemented[\s\S]*option-command-text[\s\S]*text-decoration-line:\s*line-through/
);
assert.match(
    speechMicBarSource,
    /option-unimplemented-label[\s\S]*text-overflow:\s*clip[\s\S]*font-size:\s*\.72em/
);
assert.match(
    speechMicBarSource,
    /\.option-optional[\s\S]*opacity:\s*\.42/
);
assert.match(
    speechMicBarSource,
    /#compactOptionGroup\([\s\S]*optionalPrefix[\s\S]*optionalSuffix/
);
assert.match(
    speechMicBarSource,
    /#optionsGroupKey\([\s\S]*data-speech-options-group/
);
assert.doesNotMatch(
    speechMicBarSource,
    /#optionsGroupKey\([\s\S]{0,900}data-speech-target/
);
assert.match(
    speechMicBarSource,
    /#compactOptionGroup\([\s\S]*familyPhrases[\s\S]*base\?\.phrase[\s\S]*item\.phrase/
);
assert.match(
    speechMicBarSource,
    /source:\s*"command"[\s\S]*expectedPhrases:[\s\S]*item\.familyPhrases[\s\S]*optionalPrefix[\s\S]*optionalSuffix/
);
assert.match(
    speechMicBarSource,
    /#optionsCategoryKey\([\s\S]*group\?\.modal[\s\S]*"system"[\s\S]*return "system"/
);
assert.doesNotMatch(
    speechMicBarSource,
    /key:\s*"speech"[\s\S]*label:\s*"Speech Commands"/
);
assert.match(
    speechMicBarSource,
    /#optionCategoryDefinitions\(\)[\s\S]*key:\s*"trip-actions"[\s\S]*key:\s*"goals"[\s\S]*key:\s*"settings"[\s\S]*key:\s*"system"/
);
assert.match(
    speechMicBarSource,
    /data-category="trip-actions"[\s\S]*--wm-blue-dark/
);
assert.match(
    speechMicBarSource,
    /data-category="goals"[\s\S]*--wm-yellow/
);
assert.match(
    speechMicBarSource,
    /data-category="settings"[\s\S]*--ui-gray-gradient/
);
assert.match(
    speechMicBarSource,
    /data-category="system"[\s\S]*--wm-blue/
);
assert.match(
    speechMicBarSource,
    /#ensureSystemSpeechMenu\(\)[\s\S]*speech-modal[\s\S]*system[\s\S]*speechOptionsCategory[\s\S]*system[\s\S]*SpeechMenu\.wake[\s\S]*SpeechMenu\.sleep[\s\S]*WMOFActions\.toggleSpeechOptions/
);
assert.match(
    speechMicBarSource,
    /setSystemSpeechPatterns\([\s\S]*speech-pattern[\s\S]*SpeechMenu[\s\S]*refresh/
);
assert.doesNotMatch(
    speechMicBarSource,
    /#speechControlItems\(/
);
assert.doesNotMatch(
    languageSource,
    /listen|mute/
);
assert.match(
    speechMicBarSource,
    /#text \{[\s\S]*display:\s*inline-flex[\s\S]*align-items:\s*center/
);
assert.match(
    speechMicBarSource,
    /code \{[\s\S]*display:\s*inline-flex[\s\S]*align-items:\s*center[\s\S]*vertical-align:\s*middle/
);
assert.match(
    speechMicBarSource,
    /if \(!cards\.length\) \{[\s\S]*continue;/
);
assert.match(
    speechMicBarSource,
    /#compareOptionItems\([\s\S]*localeCompare[\s\S]*a\.length\s*-\s*b\.length/
);
assert.match(
    speechMicBarSource,
    /#optionMutationDuration\(\)[\s\S]*\? 750\s*:\s*0/
);
assert.match(
    speechMicBarSource,
    /#measureOptionCategoryHeight\([\s\S]*#createOptionCategory\([\s\S]*getBoundingClientRect\(\)[\s\S]*section\.remove\(\)/
);
assert.match(
    speechMicBarSource,
    /#animateOptionContainerResize\([\s\S]*fromHeight[\s\S]*toHeight[\s\S]*container\.animate/
);
assert.match(
    speechMicBarSource,
    /#animateOptionCategoryResize\([\s\S]*#animateOptionContainerResize\([\s\S]*section[\s\S]*fromHeight[\s\S]*toHeight/
);
assert.match(
    speechMicBarSource,
    /const categoryResizePlan[\s\S]*#measureOptionCategoryHeight\([\s\S]*for \([\s\S]*existingCategories[\s\S]*#animateOptionExit/
);
assert.match(
    speechMicBarSource,
    /categoryResizePlan\.get\([\s\S]*#animateOptionCategoryResize\([\s\S]*#syncOptionCards\(/
);
assert.match(
    speechMicBarSource,
    /#animateOptionEnter\([\s\S]*height:[\s\S]*opacity:[\s\S]*scaleY/
);
assert.match(
    speechMicBarSource,
    /#animateOptionExit\([\s\S]*height:\s*"0px"[\s\S]*opacity:\s*0/
);
assert.match(
    speechMicBarSource,
    /#reviveOptionNode\([\s\S]*data-option-exiting[\s\S]*#animateOptionEnter/
);
assert.match(
    speechMicBarSource,
    /#animateOptionMove\([\s\S]*before\.left\s*-\s*after\.left[\s\S]*translate\(/
);
assert.match(
    speechMicBarSource,
    /#animateOptionEnter\([\s\S]*cubic-bezier\(\.42,0,\.58,1\)/
);
assert.match(
    speechMicBarSource,
    /#animateOptionExit\([\s\S]*cubic-bezier\(\.42,0,\.58,1\)/
);
assert.match(
    speechMicBarSource,
    /#animateOptionContainerResize\([\s\S]*cubic-bezier\(\.42,0,\.58,1\)[\s\S]*allSettled/
);
assert.match(
    speechMicBarSource,
    /const gridRect =[\s\S]*finalCategoryHeights[\s\S]*gridGap[\s\S]*finalGridHeight[\s\S]*#animateOptionContainerResize\([\s\S]*#optionsGrid/
);
assert.match(
    speechMicBarSource,
    /row\.style\.order\s*=\s*String\([\s\S]*index/
);
assert.match(
    speechMicBarSource,
    /box\.style\.order\s*=\s*String\([\s\S]*index/
);
assert.match(
    speechMicBarSource,
    /#optionItemKey\([\s\S]*optionItemText/
);
assert.match(
    speechMicBarSource,
    /insertBefore\([\s\S]*reference\s*\|\|\s*null[\s\S]*#animateOptionEnter/
);
assert.doesNotMatch(
    speechMicBarSource,
    /#renderOptions\([\s\S]{0,10000}#optionsGrid[\s\S]{0,120}\.replaceChildren\(\)/
);
assert.match(
    speechMicBarSource,
    /status\.textContent\s*=\s*" \(unimplemented\)"/
);
assert.match(
    speechMenuSource,
    /static isCommandImplemented\(element\)/
);
assert.doesNotMatch(
    speechMenuSource,
    /speech-implemented/
);
assert.doesNotMatch(
    app,
    /implemented:\s*(?:true|false)/
);
assert.doesNotMatch(
    html,
    /speech-implemented/
);

assert.match(
    languageSource,
    /tripGoal:\s*"\^trip goal\$"/
);
assert.match(
    languageSource,
    /setTripGoal:\s*"\^trip goal \(\?<percent>\.\+\)\$"/
);
assert.match(
    languageSource,
    /readGoalMode:\s*"\^mode\$"/
);
assert.match(
    languageSource,
    /goalMode:\s*"\^\(\?<goalMode>auto\|total\|trip\)\(\?: mode\)\?\$"/
);

assert.match(
    app,
    /canUseInformational\(\)[\s\S]*return tripIsLive\(\)/
);
assert.match(
    app,
    /speechOptionCategories[\s\S]*readGoalMode:\s*"informational"[\s\S]*readRenderedTime:\s*"informational"[\s\S]*syncStatus:\s*"informational"[\s\S]*howLong:\s*"informational"[\s\S]*when:\s*"informational"/
);
assert.match(
    app,
    /speechOptionCategories\[[\s\S]*key[\s\S]*\][\s\S]*===\s*"informational"[\s\S]*WMOFSpeechAvailability\.canUseInformational/
);
assert.match(
    html,
    /builtin:readGoalMode:page[^>]*data-speech-options-category="informational"[^>]*speech-available="WMOFSpeechAvailability\.canUseInformational"/
);
assert.match(
    html,
    /builtin:readRenderedTime:page[^>]*data-speech-options-category="informational"[^>]*speech-available="WMOFSpeechAvailability\.canUseInformational"/
);

assert.match(
    app,
    /changeGoalMode\([\s\S]*SpeechMenu[\s\S]*executionContext[\s\S]*transcript[\s\S]*\^\(auto\|total\|trip\) mode\$/
);
assert.doesNotMatch(
    app,
    /goalMode:"#scopeToggle"/
);
assert.doesNotMatch(
    html,
    /builtin:goalMode:page[^>]*data-speech-target="#scopeToggle"/
);
assert.match(
    languageSource,
    /readRenderedTime:\s*"\^\(\?<timeMode>time remaining\|time elapsed\|end time\)\$"/
);
assert.match(
    languageSource,
    /renderedTimeMode:\s*"\^show \(\?<timeMode>time remaining\|time elapsed\|end time\)\$"/
);
assert.match(
    html,
    /builtin:tripGoal:page[^>]*speech-function="WMOFActions\.readTripGoal"/
);
assert.match(
    html,
    /builtin:setTripGoal:page[^>]*speech-function="WMOFActions\.setTripGoal"/
);
assert.doesNotMatch(
    html,
    /builtin:tripGoal:page[^>]*data-speech-target=/
);
assert.doesNotMatch(
    html,
    /builtin:totalGoal:page[^>]*data-speech-target=/
);
assert.doesNotMatch(
    html,
    /builtin:readGoalMode:page[^>]*data-speech-target=/
);
assert.match(
    html,
    /builtin:readGoalMode:page[^>]*speech-function="WMOFActions\.readGoalMode"/
);
assert.match(
    html,
    /builtin:tripGoal:page[^>]*data-speech-options-group="goals"/
);
assert.match(
    html,
    /builtin:totalGoal:page[^>]*data-speech-options-group="goals"/
);
assert.match(
    html,
    /builtin:setTripGoal:page[^>]*data-speech-options-group="goals"/
);
assert.match(
    html,
    /builtin:setTotalGoal:page[^>]*data-speech-options-group="goals"/
);
assert.match(
    html,
    /builtin:readGoalMode:page[^>]*data-speech-options-group="mode"/
);
assert.match(
    html,
    /builtin:goalMode:page[^>]*data-speech-options-group="mode"/
);
assert.match(
    html,
    /builtin:ready:page[^>]*data-speech-options-category="trip-actions"/
);
assert.match(
    html,
    /builtin:tripGoal:page[^>]*data-speech-options-category="goals"/
);
assert.match(
    html,
    /builtin:goalMode:page[^>]*data-speech-options-category="settings"/
);
assert.match(
    app,
    /speechOptionGroups[\s\S]*tripGoal:\s*"goals"[\s\S]*goalMode:\s*"mode"/
);
assert.match(
    app,
    /speechOptionCategories[\s\S]*ready:\s*"trip-actions"[\s\S]*tripGoal:\s*"goals"[\s\S]*goalMode:\s*"settings"/
);
assert.match(
    app,
    /readTripGoal\(\)[\s\S]*dictateSpeechMetric\(\s*"Trip Goal"/
);
assert.match(
    app,
    /readTotalGoal\(\)[\s\S]*dictateSpeechMetric\(\s*"Total Goal"/
);
assert.match(
    app,
    /setTripGoal\([\s\S]*setGoalPercentValue\(\s*"trip"/
);
assert.match(
    app,
    /setTotalGoal\([\s\S]*setGoalPercentValue\(\s*"total"/
);
assert.match(
    app,
    /const dictateSpeechMetric\s*=[\s\S]*speechResponse:[\s\S]*type:\s*"dictation"/
);
assert.match(
    app,
    /readGoalMode\(\)[\s\S]*dictateSpeechMetric\(\s*label,\s*"Mode"/
);
assert.match(
    app,
    /readRenderedTime\([\s\S]*getRenderedTime\?\.\([\s\S]*dictateSpeechMetric\(/
);
assert.match(
    html,
    /builtin:readRenderedTime:page[^>]*speech-function="WMOFActions\.readRenderedTime"/
);
assert.doesNotMatch(
    html,
    /builtin:readRenderedTime:page[^>]*data-speech-target=/
);
assert.match(
    html,
    /builtin:renderedTimeMode:page[^>]*data-speech-target="#toggleRenderedTimeButton"/
);
assert.match(
    speechMenuSource,
    /#normalizeModal\([\s\S]*value === "system"[\s\S]*value === "top-level"/
);
assert.match(
    speechMenuSource,
    /append\(system\)[\s\S]*#sleeping[\s\S]*return result[\s\S]*append\(topLevel\)[\s\S]*dialog\[open\]/
);
assert.match(
    speechMenuSource,
    /!pool\.length[\s\S]*!utterance\.committing[\s\S]*!utterance\.lastExactCandidate[\s\S]*#finishUtterance/
);
assert.match(
    languageSource,
    /wakePhrase:\s*"\^wake\$"/
);
assert.match(
    languageSource,
    /sleepPhrase:\s*"\^sleep\$"/
);
assert.match(
    languageSource,
    /offPhrase:\s*"\^off\$"/
);
assert.doesNotMatch(
    speechMenuSource,
    /#wakePhrase|#sleepPhrase|#controlCandidatePool/
);
assert.match(
    app,
    /setSystemSpeechPatterns\?\.\([\s\S]*wake:[\s\S]*wakePhrase[\s\S]*sleep:[\s\S]*sleepPhrase[\s\S]*off:[\s\S]*offPhrase/
);
assert.match(
    speechMenuSource,
    /static async wake\([\s\S]*#sleeping\s*=\s*false[\s\S]*"unmuted"/
);
assert.match(
    speechMenuSource,
    /static async sleep\([\s\S]*#sleeping\s*=\s*true[\s\S]*"muted"/
);
assert.match(
    speechMenuSource,
    /#commitUtterance\([\s\S]*#processElement\([\s\S]*candidate[\s\S]*commandElement/
);
assert.match(
    audioEngineSource,
    /speak\([\s\S]*registerSynthesizedSpeech[\s\S]*synthesis\.speak/
);
assert.match(
    audioEngineSource,
    /const finished\s*=\s*new Promise[\s\S]*resolveFinished/
);
assert.match(
    audioEngineSource,
    /entry\.resolveFinished\?\.\([\s\S]*reason[\s\S]*entry\.resolveFinished\s*=\s*undefined/
);
assert.match(
    audioEngineSource,
    /return Object\.freeze\(\{[\s\S]*finished,[\s\S]*stop:/
);
assert.match(
    app,
    /confirmSettingChange\s*=\s*async[\s\S]*startSong\?\.\([\s\S]*"info-tone"[\s\S]*await cue[\s\S]*\.finished[\s\S]*\.speak\?\.\(/
);
assert.match(
    app,
    /" Goal Set to " \+[\s\S]*after/
);
assert.match(
    app,
    /"Showing " \+[\s\S]*label \+[\s\S]*" Mode"/
);
assert.match(
    app,
    /"Sync Goals Set to " \+/
);
assert.match(
    app,
    /"End Time Locked to " \+/
);
assert.match(
    app,
    /"Showing " \+[\s\S]*"Remaining Time"/
);
assert.match(
    speechMicBarSource,
    /#appendPhraseSeparator\([\s\S]*document\.createTextNode\(\s*" "\s*\)/
);
assert.match(
    speechMicBarSource,
    /if \(\s*parent\.lastChild[\s\S]*#appendPhraseSeparator\(\s*parent\s*\)[\s\S]*if \(optional\)/
);
assert.match(
    speechMenuSource,
    /speechResponse[\s\S]*type\s*===\s*"dictation"[\s\S]*presentSpeechDictation/
);
assert.match(
    presentationSource,
    /const presentSpeechDictation\s*=[\s\S]*bar\.setResponse[\s\S]*scheduleDismissal/
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

assert.doesNotMatch(
    speechMenuSource,
    /#controlCandidatePool|controlPool/
);
assert.match(
    speechMenuSource,
    /const pool =[\s\S]*#refreshCandidatePool\([\s\S]*utterance,[\s\S]*transcript/
);
assert.match(
    speechMenuSource,
    /!pool\.length[\s\S]*#finishUtterance\([\s\S]*"no-candidates"[\s\S]*false[\s\S]*"utteranceUnrecognized"/
);
assert.doesNotMatch(
    speechMenuSource,
    /#hasAvailableContinuation/
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

bar.showOptions();
assert.equal(
    bar.optionsOpen,
    true
);
await window.SpeechMenu.sleep();
assert.equal(
    bar.getAttribute("state"),
    "muted"
);
assert.equal(
    bar.optionsOpen,
    true,
    "sleep should not collapse the Speech Commands panel"
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
await window.SpeechMenu.wake();
assert.equal(
    bar.getAttribute("state"),
    "listening"
);

assert.match(
    speechMicBarSource,
    /#mic::after[\s\S]*to bottom left[\s\S]*#e32636/
);
assert.match(
    speechMicBarSource,
    /:host\(\[state="muted"\]\)[\s\S]*#mic::after[\s\S]*opacity:\s*1/
);
assert.doesNotMatch(
    speechMicBarSource,
    /#bar::after[\s\S]*#e32636/
);
assert.match(
    speechMicBarSource,
    /case "utteranceStarted":[\s\S]*SpeechMenu[\s\S]*\.muted[\s\S]*"state",[\s\S]*"muted"/
);
assert.match(
    speechMicBarSource,
    /case "utteranceTranscriptChanged":[\s\S]*!globalThis\.SpeechMenu[\s\S]*\.muted[\s\S]*#showStreamingPhrase/
);
assert.match(
    speechMicBarSource,
    /case "muted":[\s\S]*#showIdleText\(\)[\s\S]*case "listeningSuspended"/
);
assert.doesNotMatch(
    speechMicBarSource,
    /case "muted":[\s\S]{0,250}hideOptions/
);
assert.match(
    speechMicBarSource,
    /#wakeActivationPhrase\(\)[\s\S]*#wakeCommand[\s\S]*extrapolatePattern/
);
assert.match(
    speechMicBarSource,
    /"Say " \+[\s\S]*#wakeActivationPhrase\(\) \+[\s\S]*" to Activate"/
);
assert.doesNotMatch(
    speechMicBarSource,
    /#commandCatalogGroups/
);
assert.match(
    speechMicBarSource,
    /showOptions\([\s\S]*#renderOptions\(\s*phraseGroups\s*\)/
);
assert.match(
    speechMicBarSource,
    /case "phrasesChanged":[\s\S]*#renderOptions\([\s\S]*detail\?\.phraseGroups[\s\S]*SpeechMenu[\s\S]*phraseGroups/
);

assert.match(
    speechMicBarSource,
    /const toggleMic\s*=\s*event => \{[\s\S]*event\.stopPropagation\(\)[\s\S]*SpeechMenu[\s\S]*speechMenu\.muted[\s\S]*wake\?\.\(\)[\s\S]*sleep\?\.\(\)/
);

assert.match(
    speechMicBarSource,
    /#optionsGrid[\s\S]*display:\s*flex[\s\S]*flex-flow:\s*row nowrap[\s\S]*\.option-pane/
);
assert.match(
    speechMicBarSource,
    /:host\(\[options-collapsed\]\)[\s\S]*#optionsPanel[\s\S]*height:\s*42px[\s\S]*min-height:\s*42px[\s\S]*max-height:\s*42px/
);

assert.match(
    speechMicBarSource,
    /#optionsPanel[\s\S]*height:\s*auto[\s\S]*max-height:[\s\S]*--speech-options-max-height/
);

assert.match(
    speechMicBarSource,
    /#optionPanePartitions\([\s\S]*#layoutOptionPanes\([\s\S]*finalCategoryHeights|#optionPanePartitions\([\s\S]*#layoutOptionPanes\(/
);
assert.match(
    speechMicBarSource,
    /horizontalPreference\s*=\s*48[\s\S]*prefersMorePanes[\s\S]*paneCount\s*>[\s\S]*best\.paneCount[\s\S]*best\.tallest\s*\+[\s\S]*horizontalPreference/
);
assert.doesNotMatch(
    speechMicBarSource,
    /const toggleMic[\s\S]{0,500}!this\.trainingMode/
);
assert.doesNotMatch(
    speechMicBarSource,
    /const toggleMic[\s\S]{0,500}this\.trainingLocked/
);
assert.match(
    app,
    /toggleSpeechOptions\(\)[\s\S]*optionsOpen[\s\S]*collapseOptions[\s\S]*optionsCollapsed[\s\S]*expandOptions/
);

assert.match(
    speechMenuSource,
    /for \(const type of \["toggle", "close", "cancel", "okStatusChanged"\]\)[\s\S]*#schedulePhraseRefresh/
);
assert.match(
    speechMenuSource,
    /const okAllowed\s*=\s*context\?\.allowOk !==\s*false[\s\S]*if \(!okAllowed\)/
);
assert.match(
    app,
    /function setOkAllowed\([\s\S]*context\.allowOk\s*=\s*next[\s\S]*"okStatusChanged"[\s\S]*okAllowed:\s*next/
);
assert.match(
    app,
    /numberPadConfirm\.disabled\s*=\s*autocorrect[\s\S]*setOkAllowed\([\s\S]*numberPadDialog,[\s\S]*!numberPadConfirm\.disabled/
);

assert.match(
    app,
    /const breakDialog = \$\("#breakDialog"\);[\s\S]*setOkAllowed\([\s\S]*breakDialog,[\s\S]*false/
);
assert.match(
    app,
    /openBreakMenu\([\s\S]*setOkAllowed\([\s\S]*breakDialog,[\s\S]*false[\s\S]*openDialog\([\s\S]*"breakDialog"/
);
assert.match(
    app,
    /chooseBreakType\([\s\S]*button\.focus\(\);[\s\S]*setOkAllowed\([\s\S]*breakDialog,[\s\S]*true/
);
assert.match(
    app,
    /confirmBreakType\([\s\S]*setOkAllowed\([\s\S]*breakDialog,[\s\S]*false[\s\S]*closeDialog\([\s\S]*breakDialog/
);

assert.match(
    html,
    /builtin:yes:cancelDownConfirmDialog[^>]*data-speech-intent="confirm"[^>]*speech-pattern="\^\(\?:yes\|ok\(\?:ay\)\?\)\$"/
);
assert.match(
    app,
    /cancelDownTime\(\)[\s\S]*setOkAllowed\([\s\S]*dialog,[\s\S]*true[\s\S]*openDialog\([\s\S]*"cancelDownConfirmDialog"/
);
assert.match(
    app,
    /confirmCancelDownTime\(\)[\s\S]*setOkAllowed\([\s\S]*dialog,[\s\S]*false[\s\S]*closeDialog\([\s\S]*dialog/
);
assert.match(
    app,
    /continueDownTime\(\)[\s\S]*setOkAllowed\([\s\S]*dialog,[\s\S]*false[\s\S]*closeDialog\([\s\S]*dialog/
);
assert.doesNotMatch(
    speechMenuSource,
    /exactCandidate\.kind ===\s*"wake"/
);
assert.doesNotMatch(
    speechMenuSource,
    /#handleCompletedTranscript\([\s\S]{0,1800}#wakePhrase/
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
    /#maximumCandidateHoldTimeout\s*=\s*1200/
);
assert.match(
    speechMenuSource,
    /candidateHardCommitTimer:\s*undefined[\s\S]*lastExactCandidate:\s*undefined/
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
    /id="optionsClose"[\s\S]*aria-label="Collapse speech commands"[\s\S]*>▼<\/button>/
);
assert.match(
    speechMicBarSource,
    /get optionsCollapsed\(\)[\s\S]*options-collapsed/
);
assert.match(
    speechMicBarSource,
    /#syncOptionsToggle\(\)[\s\S]*collapsed[\s\S]*"▲"[\s\S]*"▼"[\s\S]*"Expand speech commands"[\s\S]*"Collapse speech commands"/
);
assert.match(
    speechMicBarSource,
    /collapseOptions\(\)[\s\S]*options-open[\s\S]*options-collapsed/
);
assert.match(
    speechMicBarSource,
    /expandOptions\(\)[\s\S]*showOptions/
);
assert.match(
    speechMicBarSource,
    /#optionsClose[\s\S]*position:\s*absolute[\s\S]*top:\s*7px[\s\S]*right:\s*9px/
);
assert.match(
    speechMicBarSource,
    /#optionsClose[\s\S]*addEventListener\([\s\S]*"click"[\s\S]*optionsCollapsed[\s\S]*expandOptions\(\)[\s\S]*collapseOptions\(\)/
);
assert.doesNotMatch(
    speechMicBarSource,
    /--speech-option-row-height/
);
assert.match(
    speechMicBarSource,
    /\.option-card[\s\S]*padding:\s*3px 0/
);

assert.match(
    speechMicBarSource,
    /id="optionsHeader">Speech Commands<\/div>/
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
    /SHERPA_ASSET_VERSION\s*=\s*"[^"]+"[\s\S]*speechRuntimeVersion[\s\S]*\?sherpa=/
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

assert.match(
    app,
    /serviceWorker[\s\S]*\.register\([\s\S]*SpeechAssetCacheWorker\.js[\s\S]*speechRuntimeVersion[\s\S]*updateViaCache:[\s\S]*"all"/
);
assert.match(
    app,
    /serviceWorker[\s\S]*\.ready[\s\S]*controllerchange/
);
assert.match(
    speechAssetCacheWorkerSource,
    /params\.get\("sherpa"\)[\s\S]*"wmof-sherpa-"[\s\S]*version/
);
assert.match(
    speechAssetCacheWorkerSource,
    /"activate"[\s\S]*caches\.keys\(\)[\s\S]*name\.startsWith\([\s\S]*"wmof-sherpa-"[\s\S]*caches\.delete/
);
assert.match(
    speechAssetCacheWorkerSource,
    /"fetch"[\s\S]*caches\.open\([\s\S]*cache\.match\([\s\S]*if \(cached\)[\s\S]*fetch\([\s\S]*cache\.put/
);

assert.match(
    speechMenuSource,
    /spokenIndex ===[\s\S]*spoken\.length -[\s\S]*1[\s\S]*token\.startsWith\([\s\S]*spokenToken/
);
assert.match(
    speechMenuSource,
    /"re" \/ "read" -> "ready"/
);

assert.match(
    speechMenuSource,
    /candidateHardCommitTimer !==[\s\S]*clearTimeout\([\s\S]*candidateHardCommitTimer[\s\S]*candidateHardCommitAt\s*=\s*performance\.now\(\)\s*\+/
);
assert.match(
    speechMenuSource,
    /if \(\s*exactCandidate\.continuation\s*\)[\s\S]*return true;[\s\S]*#commitUtterance\(\s*utterance\s*\)/
);

assert.match(
    speechMenuSource,
    /lastExactCandidate\s*=\s*\{[\s\S]*revision/
);
assert.match(
    speechMenuSource,
    /#armCandidateHardDeadline\([\s\S]*candidateHardCommitAt\s*=\s*performance\.now\(\)\s*\+/
);
assert.match(
    speechMenuSource,
    /pool\.length[\s\S]*lastExactCandidate[\s\S]*#armCandidateHardDeadline/
);
assert.match(
    speechMenuSource,
    /lastExactCandidate[\s\S]*\.revision !==[\s\S]*transcriptRevision[\s\S]*"candidate-silence"[\s\S]*true/
);
assert.doesNotMatch(
    speechMenuSource,
    /candidateHardCommitAt[\s\S]{0,700}#commitHeldCandidate/
);

assert.match(
    speechMenuSource,
    /exactCandidate[\s\S]*\.continuation[\s\S]*"candidate-silence"[\s\S]*true/
);
assert.match(
    speechMenuSource,
    /#hasOpenContinuation\(\s*utterance\s*\)[\s\S]*#finishUtterance\([\s\S]*"candidate-silence"[\s\S]*true/
);
assert.match(
    speechMenuSource,
    /reason ===[\s\S]*"candidate-silence"/
);

assert.match(
    speechMenuSource,
    /#continuationSilenceTimeout\s*=\s*900/
);
assert.match(
    speechMenuSource,
    /#maximumCandidateHoldTimeout\s*=\s*1200/
);
assert.match(
    speechMenuSource,
    /#hasOpenContinuation\([\s\S]*exactCandidate[\s\S]*\.continuation[\s\S]*lastExactCandidate/
);
assert.match(
    speechMenuSource,
    /silenceMilliseconds >=[\s\S]*#hasOpenContinuation[\s\S]*#continuationSilenceTimeout[\s\S]*#commitSilenceTimeout/
);
assert.match(
    speechMenuSource,
    /#onVadSpeechEnd[\s\S]*#hasOpenContinuation\([\s\S]*return;/
);
assert.match(
    speechMenuSource,
    /#onVadSpeechStart[\s\S]*#hasOpenContinuation[\s\S]*resumed:\s*true/
);

assert.match(
    speechMicBarSource,
    /"commands",[\s\S]*what[\s\S]*WMOFActions\.toggleSpeechOptions/
);
