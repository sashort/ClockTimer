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
