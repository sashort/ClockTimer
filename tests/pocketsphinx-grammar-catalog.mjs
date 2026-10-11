import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = {};
context.globalThis = context;
const contextSource = await readFile(new URL("../SpeechGrammarContext.js", import.meta.url), "utf8");
const source = await readFile(new URL("../PocketSphinxGrammarCatalog.js", import.meta.url), "utf8");
vm.runInNewContext(contextSource, context, { filename: "SpeechGrammarContext.js" });
vm.runInNewContext(source, context, { filename: "PocketSphinxGrammarCatalog.js" });

const Catalog = context.PocketSphinxGrammarCatalog;
assert.ok(Catalog, "grammar catalog is registered globally");

const commands = Catalog.compilePhrases(["ready at", "ready", "standard time", "cancel"]);
assert.equal(commands.start, 0);
assert.ok(commands.end < commands.numStates);
assert.ok(commands.transitions.some(t => t.word === "READY"));
assert.ok(commands.transitions.some(t => t.word === "STANDARD"));
assert.ok(commands.transitions.some(t => t.word === "CANCEL"));
assert.ok(commands.transitions.every(t => Number.isInteger(t.from) && Number.isInteger(t.to)));
assert.equal(Catalog.normalize("Ready—at  FOUR!"), "READY AT FOUR");

for (const type of ["digits", "number", "duration", "time", "date"]) {
    const grammar = Catalog.compileValue(type);
    assert.equal(grammar.valueType, type);
    assert.equal(grammar.start, 0);
    assert.equal(grammar.end, 1);
    assert.equal(grammar.numStates, 2);
    assert.ok(grammar.transitions.some(t => t.from === 0 && t.to === 0 && t.word));
    assert.ok(grammar.transitions.some(t => t.from === 0 && t.to === 1 && t.word === ""));
}
assert.throws(() => Catalog.compileValue("unknown"), /Unknown speech value grammar/);

const commandPatterns = Catalog.compileCommandPatterns([
    { pattern: "^(?:ready|ruddy|rudd) at (?<spokenTime>.+)$" },
    { pattern: "^standard(?: time)? (?<timeValue>.+)$" },
    { pattern: "^at (?<spokenTime>.+)$" },
    { pattern: "^ready$" }
]);
assert.ok(commandPatterns.prefixes.includes("READY AT"));
assert.ok(commandPatterns.prefixes.includes("RUDDY AT"));
assert.ok(commandPatterns.prefixes.includes("RUDD AT"));
assert.ok(commandPatterns.prefixes.includes("STANDARD"));
assert.ok(commandPatterns.prefixes.includes("STANDARD TIME"));
assert.ok(commandPatterns.prefixes.includes("AT"));
assert.equal(commandPatterns.byPrefix["READY AT"].grammar, "time");
assert.equal(commandPatterns.byPrefix["STANDARD TIME"].capture, "timeValue");

const speechPatternData = JSON.parse(
    await readFile(new URL("../lang/en-US/speech-patterns.json", import.meta.url), "utf8")
);
const realPatterns = Object.values(speechPatternData.patterns || {});
const derived = Catalog.compileCommandPatterns(realPatterns);
assert.ok(derived.prefixes.length > 0, "real command patterns produce a prefix grammar");
assert.ok(derived.prefixes.includes("READY AT"), "real ready-at pattern is discovered");
assert.equal(derived.byPrefix["READY AT"].grammar, "time");

console.log("PocketSphinx grammar catalog tests passed.");
