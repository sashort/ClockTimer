import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../PocketSphinxGrammarCatalog.js", import.meta.url), "utf8");
const context = {};
context.globalThis = context;
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

console.log("PocketSphinx grammar catalog tests passed.");
