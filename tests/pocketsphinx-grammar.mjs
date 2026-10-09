import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
    fileURLToPath(new URL("../PocketSphinxGrammar.js", import.meta.url)),
    "utf8"
);
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox);

const compile = sandbox.PocketSphinxGrammar.compile;

const result = compile([
    { phrases: ["Wake", "wake", "sync", "sync on"] },
    { phrases: ["trip goal <percent>", "set timer for <duration>"] }
]);

assert.deepEqual(Array.from(result.phrases), ["sync", "sync on", "wake"]);
assert.match(result.grammar, /^#JSGF V1\.0;\ngrammar clocktimer;/);
assert.match(result.grammar, /public <command> =/);
assert.match(result.grammar, /sync on/);
assert.equal(result.unsupported.length, 2);
assert.equal(result.complete, false);
assert.ok(result.unsupported.every(item => item.reason === "variable-slot"));

const empty = compile([]);
assert.equal(empty.phrases.length, 0);
assert.equal(empty.complete, true);
assert.doesNotMatch(empty.grammar, /public <command>/);

assert.throws(() => compile([], { grammarName: "bad grammar" }), /Invalid JSGF grammar name/);

const unsafe = compile([{ phrases: ["hello; exit", "hello, world", "hello there"] }]);
assert.deepEqual(Array.from(unsafe.phrases), ["hello there"]);
assert.equal(unsafe.unsupported.length, 2);
assert.ok(unsafe.unsupported.every(item => item.reason === "unsupported-token"));

console.log("PocketSphinx grammar compiler tests passed.");
