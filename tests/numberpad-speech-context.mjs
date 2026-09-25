import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

// Unit regression tests use the production handlers, with DOM/persistence
// dependencies stubbed. No microphone, server, or browser is required.
const appSource = readFileSync(
    process.env.WMOF_APP_SOURCE || new URL("../app.js", import.meta.url),
    "utf8"
);
const languageSource = readFileSync(
    process.env.WMOF_LANGUAGE_SOURCE || new URL("../lang/en-US.js", import.meta.url),
    "utf8"
);
const parserSources = [
    "DurationParser", "SpokenTimeParser", "PercentParser", "SpeechValuePreprocessor"
].map(name => readFileSync(new URL(`../lang/en-US/${name}.js`, import.meta.url), "utf8"));

function section(start, end) {
    const first = appSource.indexOf(start);
    const last = appSource.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `Production section missing: ${start.trim()}`);
    return appSource.slice(first, last);
}

const normalizer = section(
    '    globalThis\n        .WMOFSpeechProcessingFunctions\n        .define(\n            "normalizeSpeechValue",',
    "    let pendingSpeechReady;"
);
const enter = section("            enterKeypadValue(", "            openStartMenu() {");
const confirm = section("            async confirmNumberPad() {", "            runNumberPadClear() {");
const dateText = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
].join("-");

function harness(mode, overrides = {}) {
    let normalize;
    const calls = { refresh: 0, commits: [], closes: [] };
    const context = vm.createContext({
        numberPadState: {
            mode, pending: "", initial: "", everEdited: false,
            replaceOnNextDigit: true, confirmTarget: "home", ...overrides
        },
        numberPadDialog: { open: true, allowOk: false },
        numberPadConfirm: { disabled: true, dataset: { action: "confirm" } },
        WMOFSpeechProcessingFunctions: { define(name, fn) {
            assert.equal(name, "normalizeSpeechValue");
            normalize = fn;
        } },
        formatDateInput: dateText,
        absoluteDigits: (h, m, s) => `${h}${String(m).padStart(2, "0")}${String(s).padStart(2, "0")}`,
        absoluteDigitsValid: (digits, meridiem) => {
            const h = Number(digits.slice(0, -4));
            return /^\d{5,6}$/.test(digits) && h >= (meridiem ? 1 : 0) &&
                h <= (meridiem ? 12 : 23) &&
                Number(digits.slice(-4, -2)) < 60 && Number(digits.slice(-2)) < 60;
        },
        timeDigitsValid: digits => /^\d+$/.test(digits) &&
            Number(digits.slice(-2)) < 60 && Number(digits.slice(-4, -2)) < 60,
        durationValueToRawDigits: value => value.replace(/:/g, ""),
        formatTimelineMilliseconds: value => context.EnglishDurationParser.format(value),
        refreshNumberPad: () => {
            calls.refresh++;
            context.numberPadConfirm.disabled = !/^\d+$/.test(context.numberPadState.pending);
            context.numberPadDialog.allowOk = !context.numberPadConfirm.disabled;
        },
        commitNumberPad: async () => {
            calls.commits.push({ ...context.numberPadState });
            return true;
        },
        closeNumberPad: async options => {
            calls.closes.push({ ...options });
            context.numberPadDialog.open = false;
            return true;
        }
    });
    for (const source of [languageSource, ...parserSources, normalizer]) {
        vm.runInContext(source, context);
    }
    vm.runInContext(`globalThis.actions = ({${enter}\n${confirm}});`, context);
    const commands = context.WMOFLanguages["en-US"].speech.commands;
    const valuePattern = new RegExp(commands.keypadValue, "i");

    // Deliberately consider the value command before OK to reproduce the
    // original catch-all collision regardless of menu ordering.
    async function speak(text) {
        const normalized = normalize(text, {
            field: "spokenValue", kind: "keypad", pattern: commands.keypadValue
        });
        const match = valuePattern.exec(normalized);
        if (match) return context.actions.enterKeypadValue(match.groups.spokenValue);
        if (new RegExp(commands.confirm, "i").test(text)) {
            return context.actions.confirmNumberPad();
        }
        return false;
    }
    return { context, commands, valuePattern, normalize, speak, calls };
}

const values = [
    ["percent", "one hundred ten percent", "110"],
    ["percent", "one hundred and twenty-five per cent", "125"],
    ["percent", "seventy-five", "75"],
    ["percent", "110%", "110"],
    ["percent", "110 %", "110"],
    ["percent", "125", "125"],
    ["time", "twenty minutes", "2000"],
    ["time", "an hour and five minutes", "10500"],
    ["time", "1:02:03", "10203"],
    ["time", "1030", "1030"],
    ["absolute", "five thirty pm", "53000", "PM"],
    ["absolute", "5:30 p.m.", "53000", "PM"],
    ["absolute", "5:30 p m", "53000", "PM"],
    ["absolute", "a quarter past five tomorrow", "51500"],
    ["absolute", "noon", "120000", "PM"],
    ["absolute", "midnight", "120000", "AM"],
    ["absolute", "17:30", "173000"]
];

for (const [mode, phrase, digits, meridiem] of values) {
    test(`${mode}: ${phrase} -> raw digits -> spoken OK`, async () => {
        const h = harness(mode, { confirmTarget: "trip-settings" });
        assert.equal(h.valuePattern.test(phrase), true, "Context phrase must be recognized");
        assert.equal(await h.speak(phrase), true);
        assert.equal(h.context.numberPadState.pending, digits);
        assert.equal(h.context.numberPadState.meridiem, meridiem);
        assert.equal(h.context.numberPadState.everEdited, true);
        assert.equal(h.context.numberPadState.replaceOnNextDigit, false);
        assert.equal(h.calls.refresh, 1);
        assert.equal(h.context.numberPadDialog.allowOk, true);
        if (phrase.includes("tomorrow")) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            assert.equal(h.context.numberPadState.pendingDate, dateText(tomorrow));
        }
        assert.equal(await h.speak("OK"), true);
        assert.equal(h.calls.commits.length, 1);
        assert.equal(h.calls.commits[0].pending, digits);
        assert.deepEqual(h.calls.closes, [{
            discardPrepared: false, allowChanged: true, destination: "trip-settings"
        }]);
        assert.equal(h.calls.refresh, 1, "OK must not enter a second value");
    });
}

for (const phrase of [
    "ok", "okay", "cancel", "close", "yes", "no", "ready", "ready at five thirty pm",
    "trip goal", "trip goal one hundred ten percent", "total goal 120 percent",
    "trip", "total mode", "auto mode", "sync on", "show trip log", "time", "when",
    "one hundred percent okay", "banana"
]) {
    test(`Value matcher does not intercept: ${phrase}`, () => {
        assert.equal(harness("percent").valuePattern.test(phrase), false);
    });
}

for (const [command, phrase, percent] of [
    ["setTripGoal", "trip goal one hundred ten percent", "110"],
    ["setTotalGoal", "total goal one hundred and twenty-five percent", "125"]
]) {
    test(`Named goal retains percent preprocessing: ${phrase}`, () => {
        const h = harness("absolute");
        const normalized = h.normalize(phrase, {
            field: "percent", kind: "percent", pattern: h.commands[command]
        });
        const match = new RegExp(h.commands[command], "i").exec(normalized);
        assert.equal(match?.groups.percent, percent);
        assert.equal(h.valuePattern.test(normalized), false);
        assert.equal(h.context.EnglishSpeechValuePreprocessor.parse(match.groups.percent, "percent"), Number(percent));
    });
}

test("A second percentage replaces the complete draft rather than appending digits", async () => {
    const h = harness("percent", { pending: "100", initial: "100" });
    assert.equal(await h.speak("one hundred ten percent"), true);
    assert.equal(await h.speak("one hundred twenty percent"), true);
    assert.equal(h.context.numberPadState.pending, "120");
    assert.equal(await h.speak("okay"), true);
    assert.equal(h.calls.commits[0].pending, "120");
});

test("24-hour speech clears a previous AM/PM selection", async () => {
    const h = harness("absolute", { meridiem: "AM" });
    assert.equal(await h.speak("17:30"), true);
    assert.equal(h.context.numberPadState.meridiem, undefined);
});

for (const [mode, phrase] of [
    ["percent", "zero percent"], ["percent", "five thirty pm"],
    ["time", "one hundred percent"], ["absolute", "twenty five pm"]
]) {
    test(`Invalid ${mode} input leaves the draft unchanged: ${phrase}`, async () => {
        const h = harness(mode, { pending: "100" });
        const before = { ...h.context.numberPadState };
        assert.equal(await h.speak(phrase), false);
        assert.deepEqual({ ...h.context.numberPadState }, before);
        assert.equal(h.calls.refresh, 0);
        assert.equal(h.calls.commits.length, 0);
    });
}

test("Closed keypad does not consume a contextual value", () => {
    const h = harness("percent");
    h.context.numberPadDialog.open = false;
    assert.equal(h.context.actions.enterKeypadValue("110 percent"), false);
    assert.equal(h.calls.refresh, 0);
});

test("OK does not commit an untouched, disabled draft", async () => {
    const h = harness("percent");
    assert.equal(await h.speak("ok"), false);
    assert.equal(h.calls.commits.length, 0);
});
