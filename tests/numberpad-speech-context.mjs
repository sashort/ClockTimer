import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(
    process.env.WMOF_APP_SOURCE || new URL("../app.js", import.meta.url),
    "utf8"
);
const languageSource = readFileSync(
    process.env.WMOF_LANGUAGE_SOURCE || new URL("../lang/en-US.js", import.meta.url),
    "utf8"
);
const numberPadSource = readFileSync(
    new URL("../numberpad.html", import.meta.url),
    "utf8"
);
const indexSource = readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8"
);
const cssSource = readFileSync(
    new URL("../app.css", import.meta.url),
    "utf8"
);
const clockTimerSource = readFileSync(
    new URL("../ClockTimer.js", import.meta.url),
    "utf8"
);
const audioEngineSource = readFileSync(
    new URL("../api/audio/AudioEngine.js", import.meta.url),
    "utf8"
);
const speechMenuSource = readFileSync(
    new URL("../SpeechMenu.js", import.meta.url),
    "utf8"
);


test("value editor chooses voice for speech invocations and touch otherwise", () => {
    assert.match(
        appSource,
        /function resolveValueEditorInputMode\([\s\S]*?SpeechMenu[\s\S]*?executionContext[\s\S]*?\? "voice"[\s\S]*?: "touch"/
    );
    assert.match(
        appSource,
        /function openNumberPad\([\s\S]*?openValueEditor/
    );
});

test("touch keypad exposes only the voice-specific speech command", () => {
    const install = appSource.slice(
        appSource.indexOf("function installNumberPadSpeechCommands"),
        appSource.indexOf("async function ensureNumberPadLoaded")
    );
    assert.match(install, /"voice"[\s\S]*?"switchNumberPadToVoice"/);
    assert.doesNotMatch(install, /"confirm"/);
    assert.doesNotMatch(install, /"cancel"/);
    assert.doesNotMatch(appSource, /enterKeypadValue\s*\(/);
});

test("touch keypad has an explicit switch-to-voice button", () => {
    assert.match(numberPadSource, /id="numberPadVoice"/);
    assert.match(numberPadSource, />Switch to Voice<\/button>/);
    assert.match(
        appSource,
        /numberPadVoice[\s\S]*?action:\s*"switchNumberPadToVoice"/
    );
});

test("voice entry owns spoken value acceptance and navigation", () => {
    const parser = appSource.slice(
        appSource.indexOf("function parseVoiceEntryTranscript"),
        appSource.indexOf("async function openVoiceValueEditor")
    );
    assert.match(parser, /\^\(\?:ok\|okay\)\$/);
    assert.match(parser, /\^\(\?:cancel\|close\)\$/);
    assert.match(parser, /touch\|keypad\|number pad/);
    assert.match(parser, /commitNumberPad/);
    assert.doesNotMatch(parser, /setTimeout\s*\(/);
});

test("system speech commands stay available above number-pad and voice-pad input", () => {
    assert.match(
        speechMenuSource,
        /rightSystemExact[\s\S]*leftSystemExact[\s\S]*left\.depth/
    );
    assert.match(
        speechMenuSource,
        /exactIsSystem[\s\S]*candidate[\s\S]*\.continuation[\s\S]*#effectiveModal[\s\S]*"system"/
    );
    assert.match(
        speechMenuSource,
        /#shouldExecuteElement\([\s\S]*#systemExecutionPassthrough[\s\S]*#effectiveModal[\s\S]*"system"/
    );
});

test("voice pad suspends normal execution but passes system commands through", () => {
    const openVoice = appSource.slice(
        appSource.indexOf("async function openVoiceValueEditor"),
        appSource.indexOf("function openVoiceEntry")
    );
    const hideVoice = appSource.slice(
        appSource.indexOf("function hideVoiceEntrySurface"),
        appSource.indexOf("async function closeVoiceEntry")
    );
    const pipeVoice = appSource.slice(
        appSource.indexOf("function voiceEntryTranscriptIsSystemCommand"),
        appSource.indexOf("function bindVoiceEntryTranscriptPipe")
    );

    assert.match(
        openVoice,
        /systemExecutionPassthrough[\s\S]*true[\s\S]*executionEnabled[\s\S]*false/
    );
    assert.match(
        hideVoice,
        /systemExecutionPassthrough[\s\S]*voiceEntrySystemExecutionBeforeOpen/
    );
    assert.match(
        pipeVoice,
        /phraseGroups[\s\S]*group\.modal[\s\S]*"system"/
    );
    assert.match(
        pipeVoice,
        /voiceEntryTranscriptIsSystemCommand\([\s\S]*transcript[\s\S]*\)[\s\S]*return;/
    );
});

test("English speech vocabulary includes the touch-keypad voice command", () => {
    assert.match(languageSource, /voice:\s*"\^voice\$"/);
});

test("switch is an allowed action verb", () => {
    const actionSource = readFileSync(
        new URL("../ActionFunctions.js", import.meta.url),
        "utf8"
    );
    assert.match(actionSource, /"switch"/);
});


test("ready explicitly routes the asynchronous new-trip workflow to voice entry", () => {
    assert.match(
        appSource,
        /prepareStartMenu\(\)[\s\S]*?inputMode:\s*"voice"/
    );
    assert.match(
        appSource,
        /beginNewTripWorkflow\([\s\S]*?inputMode[\s\S]*?openValueEditor\([\s\S]*?inputMode/
    );
});

test("ready-at continuation lives in the voice editor instead of the touch keypad", () => {
    const parser = appSource.slice(
        appSource.indexOf("function parseVoiceEntryTranscript"),
        appSource.indexOf("async function openVoiceValueEditor")
    );
    assert.match(parser, /\^at\\s\+\(\.\+\)\$/);
    assert.match(parser, /scheduleStartAt/);
    assert.doesNotMatch(appSource, /readyAtNumberPadCommand/);
});

test("Trip Settings voice aliases cover standard, scheduled, actual, and creation time", () => {
    assert.match(
        languageSource,
        /standardTime:\s*"\^standard\(\?: time\)\? /
    );
    assert.match(
        languageSource,
        /scheduledStartEditor:\s*"\^\(\?:scheduled start\|scheduled time\)\$"/
    );
    assert.match(
        languageSource,
        /actualStartEditor:\s*"\^\(\?:actual start\|start time\)\$"/
    );
    assert.match(
        languageSource,
        /creationTimeEditor:\s*"\^\(\?:creation time\|created\(\?: at\)\?\)\$"/
    );
});

test("Early Start standard command keeps spoken duration and makes time optional", () => {
    const indexSource = readFileSync(
        new URL("../index.html", import.meta.url),
        "utf8"
    );
    const matches =
        indexSource.match(
            /speech-pattern="\^standard\(\?: time\)\? \(\?&lt;timeValue&gt;\.\+\)\$"/g
        ) || [];

    assert.equal(matches.length, 2);
});


test("Early Start bare standard command opens the shared voice editor", () => {
    const runtimeInstall = appSource.slice(
        appSource.indexOf("if (englishSpeech)"),
        appSource.indexOf("speechRecognitionLanguageAvailable")
    );

    assert.match(
        runtimeInstall,
        /standardTimeEditor[\s\S]*?openScheduledStandardTimeEditor[\s\S]*?scheduledStartDialog/
    );
    assert.match(
        runtimeInstall,
        /speechTarget[\s\S]*?#scheduledStartStandard/
    );
});


test("voice entry registers its own value and control speech candidates", () => {
    const installer = appSource.slice(
        appSource.indexOf("function installVoiceEntrySpeechCommands"),
        appSource.indexOf("async function ensureNumberPadLoaded")
    );

    assert.match(
        installer,
        /keypadValue/
    );
    assert.match(
        installer,
        /voiceEntryConfirm/
    );
    assert.match(
        installer,
        /voiceEntryCancel/
    );
    assert.match(
        installer,
        /voiceEntryTouch/
    );
    assert.match(
        installer,
        /voiceEntryDefer/
    );
    assert.match(
        installer,
        /handleVoiceEntrySpeech/
    );
});

test("voice-entry command grammar includes OK, cancel, touch, and defer", () => {
    assert.match(
        languageSource,
        /voiceEntryConfirm:\s*"\^ok\(\?:ay\)\?\$"/
    );
    assert.match(
        languageSource,
        /voiceEntryCancel:\s*"\^\(\?:cancel\|close\)\$"/
    );
    assert.match(
        languageSource,
        /voiceEntryTouch:\s*"\^\(\?:touch\|keypad\|number pad\)\$"/
    );
    assert.match(
        languageSource,
        /voiceEntryDefer:\s*"\^defer trip\$"/
    );
});

test("Trip Log uses the rendered speech surface safe top", () => {
    const speechTop = appSource.slice(
        appSource.indexOf("function getSpeechMicTop"),
        appSource.indexOf("function getTripLogBottomRect")
    );

    assert.match(
        speechTop,
        /getSafeTop/
    );
    assert.doesNotMatch(
        speechTop,
        /--speech-command-row-height/
    );
    assert.doesNotMatch(
        speechTop,
        /collapsedTop/
    );
});


test("touch-to-voice handoff preserves the shared numberpad session across dialog close", () => {
    assert.match(
        appSource,
        /let preserveNumberPadStateOnClose = false/
    );

    const switcher = appSource.slice(
        appSource.indexOf("async function switchNumberPadToVoice"),
        appSource.indexOf("async function switchVoiceEntryToTouch")
    );

    assert.match(
        switcher,
        /preserveNumberPadStateOnClose\s*=\s*true/
    );
    assert.match(
        switcher,
        /number-pad-switch-voice/
    );

    const closeListener = appSource.slice(
        appSource.indexOf('numberPadDialog.addEventListener("close"'),
        appSource.indexOf("tripSettingsDialog.addEventListener", appSource.indexOf('numberPadDialog.addEventListener("close"'))
    );

    assert.match(
        closeListener,
        /preserveNumberPadStateOnClose/
    );
    assert.match(
        closeListener,
        /return;[\s\S]*?resetNumberPad/
    );
});


test("voice value grammar restores keypad preprocessing and open-ended recognition", () => {
    const installer = appSource.slice(
        appSource.indexOf("function installVoiceEntrySpeechCommands"),
        appSource.indexOf("async function ensureNumberPadLoaded")
    );

    assert.match(
        installer,
        /"keypad"[\s\S]*?"spokenValue"/
    );
    assert.match(
        installer,
        /speech-open-ended/
    );
    assert.match(
        installer,
        /speechOptionsPhrase[\s\S]*?<spokenValue>/
    );

    const normalizer = appSource.slice(
        appSource.indexOf('"normalizeSpeechValue"'),
        appSource.indexOf("let pendingSpeechReady")
    );

    assert.match(
        normalizer,
        /!numberPadDialog[\s\S]*?\.open[\s\S]*?!voiceEntryState/
    );
});

test("voice absolute-time parsing uses the keypad clock-parts parser", () => {
    const parser = appSource.slice(
        appSource.indexOf("function parseVoiceEntryTranscript"),
        appSource.indexOf("async function openVoiceValueEditor")
    );

    assert.match(
        parser,
        /"clock-parts"/
    );
    assert.match(
        parser,
        /parts\.day/
    );
    assert.match(
        parser,
        /absoluteDigitsValid/
    );
});

test("voice keypad grammar still recognizes representative value phrases", () => {
    const match =
        languageSource.match(
            /const keypadValuePattern =\s*\n\s*"([^"]+)"\s*\+\s*\n\s*"([^"]+)"/
        );

    assert.ok(match);

    // Evaluate the production language file instead of reconstructing the
    // concatenated pattern from source fragments.
    const scope = {};
    Function(
        "globalThis",
        languageSource
    )(scope);

    const pattern =
        new RegExp(
            scope.WMOFLanguages["en-US"]
                .speech.commands
                .keypadValue,
            "i"
        );

    for (const phrase of [
        "one hundred ten percent",
        "one hundred and twenty-five per cent",
        "twenty minutes",
        "an hour and five minutes",
        "1:02:03",
        "five thirty pm",
        "5:30 p.m.",
        "5:30 p m",
        "a quarter past five tomorrow",
        "noon",
        "midnight",
        "17:30"
    ]) {
        assert.equal(
            pattern.test(phrase),
            true,
            phrase
        );
    }

    for (const phrase of [
        "ok",
        "okay",
        "cancel",
        "close",
        "ready",
        "defer trip",
        "banana"
    ]) {
        assert.equal(
            pattern.test(phrase),
            false,
            phrase
        );
    }
});


test("ready and ready-at lock New Trip until the workflow exits", () => {
    assert.match(
        appSource,
        /let newTripWorkflowLocked = false/
    );
    assert.match(
        appSource,
        /function lockNewTripWorkflow\(\)[\s\S]*?newTripWorkflowLocked[\s\S]*?true[\s\S]*?syncNewTripButtonAvailability/
    );
    assert.match(
        appSource,
        /function releaseNewTripWorkflow\(\)[\s\S]*?newTripWorkflowLocked[\s\S]*?false[\s\S]*?syncNewTripButtonAvailability/
    );

    const readyWorkflow = appSource.slice(
        appSource.indexOf("const openStartMenuWorkflow"),
        appSource.indexOf("const closeActiveSpeechSurface")
    );

    assert.match(
        readyWorkflow,
        /inputMode ===[\s\S]*?"voice"[\s\S]*?lockNewTripWorkflow/
    );
    assert.match(
        readyWorkflow,
        /result === false[\s\S]*?releaseNewTripWorkflow/
    );

    const scheduled = appSource.slice(
        appSource.indexOf("async scheduleStartAt"),
        appSource.indexOf("continueStartAt", appSource.indexOf("async scheduleStartAt"))
    );

    assert.match(
        scheduled,
        /newTripWorkflowLocked/
    );
    assert.match(
        scheduled,
        /lockNewTripWorkflow/
    );
    assert.match(
        scheduled,
        /finally[\s\S]*?releaseNewTripWorkflow/
    );
});

test("voice-pad at-time continuation is allowed while New Trip is locked", () => {
    const parser = appSource.slice(
        appSource.indexOf("function parseVoiceEntryTranscript"),
        appSource.indexOf("async function openVoiceValueEditor")
    );

    assert.match(
        parser,
        /scheduleStartAt\([\s\S]*?fromReadyContinuation:[\s\S]*?true/
    );
});

test("new-trip workflow lock releases on cancel, defer, schedule cancel, and successful start", () => {
    const closePad = appSource.slice(
        appSource.indexOf("async function closeNumberPad"),
        appSource.indexOf("async function cancelNumberPad")
    );
    assert.match(
        closePad,
        /discardPrepared[\s\S]*?workflow === "new-trip"[\s\S]*?releaseNewTripWorkflow/
    );

    const scheduleCancel = appSource.slice(
        appSource.indexOf("function cancelScheduledStartPrompt"),
        appSource.indexOf("scheduledStartAuto.addEventListener")
    );
    assert.match(
        scheduleCancel,
        /releaseNewTripWorkflow/
    );

    const startDraft = appSource.slice(
        appSource.indexOf("async function startTripDraft"),
        appSource.indexOf("function cloneTripSettingsValues")
    );
    assert.match(
        startDraft,
        /tripDraft = undefined;[\s\S]*?releaseNewTripWorkflow/
    );

    const deferAction = appSource.slice(
        appSource.indexOf("deferTrip()"),
        appSource.indexOf("readEndTime()", appSource.indexOf("deferTrip()"))
    );
    assert.match(
        deferAction,
        /tripDraft\.deferred[\s\S]*?releaseNewTripWorkflow/
    );
});


test("voice entry consumes final speech runtime transcripts directly", () => {
    const routing = appSource.slice(
        appSource.indexOf("function pipeVoiceEntryTranscript"),
        appSource.indexOf("globalThis.WMOFVoiceEntry")
    );

    assert.match(
        routing,
        /SpeechMenu[\s\S]*?events[\s\S]*?addEventListener\([\s\S]*?"utteranceTranscribed"[\s\S]*?pipeVoiceEntryTranscript/
    );

    assert.match(
        routing,
        /"utteranceCommitted"[\s\S]*?pipeVoiceEntryTranscript/
    );

    assert.match(
        routing,
        /parseVoiceEntryTranscript\([\s\S]*?transcript/
    );

    assert.doesNotMatch(
        routing,
        /speechMicBar[\s\S]*?addEventListener\([\s\S]*?"utteranceCommitted"/
    );
});

test("voice entry dedupes transcribed and committed events for the same utterance", () => {
    assert.match(
        appSource,
        /let voiceEntryHandledUtteranceId/
    );

    const routing = appSource.slice(
        appSource.indexOf("function pipeVoiceEntryTranscript"),
        appSource.indexOf("globalThis.WMOFVoiceEntry")
    );

    assert.match(
        routing,
        /utteranceId ===[\s\S]*?voiceEntryHandledUtteranceId/
    );

    assert.match(
        routing,
        /voiceEntryHandledUtteranceId =\s*utteranceId/
    );
});


test("voice entry binds transcript routing after the lazy speech runtime loads", () => {
    assert.match(
        appSource,
        /let voiceEntryTranscriptPipeBound = false/
    );

    const binding = appSource.slice(
        appSource.indexOf("function bindVoiceEntryTranscriptPipe"),
        appSource.indexOf("globalThis.WMOFVoiceEntry")
    );

    assert.match(
        binding,
        /SpeechMenu[\s\S]*?events/
    );
    assert.match(
        binding,
        /"utteranceTranscribed"[\s\S]*?pipeVoiceEntryTranscript/
    );
    assert.match(
        binding,
        /"utteranceCommitted"[\s\S]*?pipeVoiceEntryTranscript/
    );
    assert.match(
        binding,
        /"speech-runtime-ready"[\s\S]*?bindVoiceEntryTranscriptPipe/
    );

    assert.match(
        appSource,
        /await ensureSpeechRuntime\(\);[\s\S]*?bindVoiceEntryTranscriptPipe\(\);/
    );
});


test("voice entry shows descriptive context-aware guidance and accepted-value feedback", () => {
    assert.match(
        indexSource,
        /id="voiceEntryInstructions"[\s\S]*?<strong>Say OK<\/strong> to[\s\S]*?<strong>Cancel<\/strong> to/
    );
    assert.match(
        appSource,
        /function voiceEntryDescriptor\([\s\S]*?"Trip Percent Goal"[\s\S]*?totalScopeLabel\(\)[\s\S]*?" Percent Goal"[\s\S]*?"Standard Time"/
    );
    assert.match(
        appSource,
        /function voiceEntryPromptForState\([\s\S]*?"Say " \+ descriptor/
    );
    assert.match(
        appSource,
        /function announceVoiceEntryPrompt\([\s\S]*?WMOFAudio[\s\S]*?\.speak/
    );
    assert.match(
        appSource,
        /function speakVoiceEntryFeedback\([\s\S]*?onEnd[\s\S]*?220[\s\S]*?"OK to "/
    );
    assert.match(
        appSource,
        /prompt:[\s\S]*?display[\s\S]*?"OK to " \+[\s\S]*?actionCopy\.ok[\s\S]*?360/
    );
    assert.match(
        audioEngineSource,
        /speechVelocity,[\s\S]*?onEnd[\s\S]*?finish\([\s\S]*?true/
    );
    assert.match(
        cssSource,
        /\.voice-entry-instructions\.is-attention[\s\S]*?voice-entry-instructions-attention/
    );
});

test("trip summary and either editor appear together without overlap", () => {
    assert.match(
        indexSource,
        /id="tripTransitionOverlay"[\s\S]*?popover="manual"/
    );
    assert.match(
        appSource,
        /function syncTripTransitionEditorLayout\([\s\S]*?"number-pad"[\s\S]*?--trip-transition-summary-shift-y[\s\S]*?--number-pad-summary-scale/
    );
    assert.match(
        appSource,
        /function promoteTripTransitionOverlay\([\s\S]*?hidePopover[\s\S]*?showPopover/
    );
    assert.match(
        cssSource,
        /\.number-pad-dialog[\s\S]*?--number-pad-summary-shift-y[\s\S]*?--number-pad-summary-scale/
    );
    assert.match(
        cssSource,
        /\.trip-transition-overlay\.has-number-pad[\s\S]*?--trip-transition-summary-max-height/
    );
});

test("end-trip presentation does not wait for sync or reset", () => {
    const stopMethod = clockTimerSource.slice(
        clockTimerSource.indexOf("async stop(stopTime)"),
        clockTimerSource.indexOf("async resetCompletedTrip()")
    );
    assert.ok(
        stopMethod.indexOf('"tripEnded"') <
        stopMethod.indexOf("await this.#protectedSync")
    );

    const endFlow = appSource.slice(
        appSource.indexOf("async function endCurrentIntervalOrTrip"),
        appSource.indexOf("function openSpeechBreakPrompt")
    );
    assert.match(
        endFlow,
        /const stopPromise\s*=\s*[\s\S]*?clockTimer\.stop/
    );
    assert.match(
        endFlow,
        /completedTripResetPromise[\s\S]*?beginNewTripWorkflow/
    );

    const beginFlow = appSource.slice(
        appSource.indexOf("async function beginNewTripWorkflow"),
        appSource.indexOf("WMOFInteractionFunctions", appSource.indexOf("async function beginNewTripWorkflow"))
    );
    assert.match(
        beginFlow,
        /completedTripResetPromise/
    );
    assert.match(
        beginFlow,
        /duration:[\s\S]*?endStartTransition[\s\S]*?\? 0/
    );
});

test("summary disappearance animates voice and touch editors back to normal", () => {
    assert.match(
        appSource,
        /syncTripTransitionEditorLayout\([\s\S]*?false[\s\S]*?\)[\s\S]*?classList[\s\S]*?remove\([\s\S]*?"is-visible"/
    );
    assert.match(
        cssSource,
        /\.voice-entry-surface[\s\S]*?transition:[\s\S]*?transform 280ms ease/
    );
    assert.match(
        cssSource,
        /\.number-pad-dialog[\s\S]*?transition-duration:[\s\S]*?280ms/
    );
});
