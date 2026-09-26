import fs from "node:fs";
import assert from "node:assert/strict";

const source = ["DurationParser", "SpokenTimeParser", "PercentParser", "SpeechValuePreprocessor"]
    .map(name => fs.readFileSync(new URL(`../lang/en-US/${name}.js`, import.meta.url), "utf8"))
    .join("\n");
const Preprocessor = Function(`${source}; return EnglishSpeechValuePreprocessor;`)();
assert.equal(Preprocessor.parse("forty five minutes", "duration"), 45 * 60000);
assert.equal(Preprocessor.normalize("forty five minutes", "duration"), "0:45:00");
assert.equal(Preprocessor.normalize("an hour", "duration"), "1:00:00");
assert.equal(Preprocessor.normalize("a hour", "duration"), "1:00:00");
assert.equal(Preprocessor.normalize("1 hour and a minute", "duration"), "1:01:00");
assert.equal(Preprocessor.normalize("one hour and an minute", "duration"), "1:01:00");
assert.equal(Preprocessor.parse("one hundred and five percent", "percent"), 105);
assert.equal(Preprocessor.normalize("one hundred and five percent", "percent"), "105");
assert.deepEqual(Preprocessor.parse("five thirty pm", "clock-parts"), {hour:5, minute:30, meridiem:"pm", day:undefined});
assert.equal(Preprocessor.normalize("five thirty pm", "clock"), "5:30 pm");
assert.equal(Preprocessor.normalize("a quarter to six pm", "clock"), "5:45 pm");
assert.equal(Preprocessor.normalize("a half past five", "clock"), "5:30");
const baseDate = new Date(2026, 8, 21, 14, 0, 0);
assert.equal(Preprocessor.parse("five thirty pm", "clock", {baseDate}).getHours(), 17);
assert.equal(Preprocessor.parse("five thirty pm", "duration"), undefined);
const DurationParser = Function(`${source}; return EnglishDurationParser;`)();
assert.equal(DurationParser.describe(5 * 60000), "5 minutes");
assert.equal(DurationParser.describe(28 * 60000), "28 minutes");
assert.equal(DurationParser.describe((60 + 5) * 60000), "1 hour 5 minutes");
assert.equal(DurationParser.describe(3661000), "1 hour 1 minute 1 second");
console.log("PASS context-aware speech value preprocessing");
