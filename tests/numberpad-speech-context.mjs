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
