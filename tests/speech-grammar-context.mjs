import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../SpeechGrammarContext.js", import.meta.url), "utf8");
const context = { console };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "SpeechGrammarContext.js" });

const GrammarContext = context.SpeechGrammarContext;
assert.ok(GrammarContext, "grammar context helper is registered globally");

assert.deepEqual(
    JSON.parse(JSON.stringify(GrammarContext.fromPattern("^(?:ready|ruddy) at (?<spokenTime>.+)$"))),
    { grammar: "time", capture: "spokenTime", reason: "named-capture" }
);
assert.equal(GrammarContext.fromPattern("^standard time (?<timeValue>.+)$").grammar, "time");
assert.equal(GrammarContext.fromPattern("^ready at (?<time>.+)$").grammar, "time");
assert.equal(GrammarContext.fromPattern("^(?<date>.+)$").grammar, "date");
assert.equal(GrammarContext.fromPattern("^(?<dateValue>.+)$").grammar, "date");
assert.equal(GrammarContext.fromPattern("^(?<pin>.+)$").grammar, "digits");
assert.equal(GrammarContext.fromPattern("^(?<percent>.+) percent$").grammar, "number");
assert.equal(GrammarContext.fromPattern("^ready$").grammar, "commands");
assert.equal(GrammarContext.fromPattern("^anything$", { expect: "duration" }).grammar, "duration");

assert.equal(GrammarContext.fromUIContext({ pinEntry: true }).grammar, "digits");
assert.equal(GrammarContext.fromUIContext({ mode: "time entry" }).grammar, "time");
assert.equal(GrammarContext.fromUIContext({ mode: "date picker" }).grammar, "date");
assert.equal(GrammarContext.resolve({
    pattern: "^ready at (?<spokenTime>.+)$",
    uiContext: {}
}).grammar, "time");
assert.equal(GrammarContext.resolve({
    pattern: "^ready at (?<spokenTime>.+)$",
    uiContext: { pinEntry: true }
}).grammar, "digits");
assert.equal(GrammarContext.normalize("  Réady—AT  "), "ready at");

console.log("Speech grammar context tests passed.");
