import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = {};
context.globalThis = context;
const source = await readFile(new URL("../VoskPhraseListCompiler.js", import.meta.url), "utf8");
vm.runInNewContext(source, context, { filename: "VoskPhraseListCompiler.js" });
const Compiler = context.VoskPhraseListCompiler;
assert.ok(Compiler, "Vosk phrase compiler is registered globally");

const result = Compiler.compile([
    { id: "ready-at", pattern: "^(?:ready|ruddy) at (?<spokenTime>.+)$" },
    { id: "standard", pattern: "^standard(?: time)? (?<timeValue>.+)$" },
    { id: "confirm", pattern: "^(?:ok(?:ay)?|o\\s+k)$" },
    { id: "resume", pattern: "^resumed?$" },
    { id: "unsupported", pattern: "^speech (?!on$|off$)(?<percent>.+?)(?: percent|%)?$" }
], {
    capturePhrases: {
        spokenTime: ["five pm", "five thirty", "17:30"],
        percent: ["twenty"],
        timeValue: ["one hour", "thirty minutes"]
    }
});

assert.ok(result.phrases.includes("ready at five pm"));
assert.ok(result.phrases.includes("ruddy at five thirty"));
assert.ok(result.phrases.includes("standard one hour"));
assert.ok(result.phrases.includes("standard time thirty minutes"));
assert.ok(result.phrases.includes("ok"));
assert.ok(result.phrases.includes("okay"));
assert.ok(result.phrases.includes("o k"));
assert.ok(result.phrases.includes("resume"));
assert.ok(result.phrases.includes("resumed"));
assert.ok(!result.phrases.includes("ready at"));
assert.equal(result.recordsSeen, 5);
assert.equal(result.supportedPatterns, 5);
assert.equal(result.unsupported.length, 0);
assert.ok(result.phrases.includes('speech twenty'),'assertion-bearing finite patterns compile');
const excluded=Compiler.compile([{pattern:'^speech (?!on$|off$)(?<percent>.+)$'}],{capturePhrases:{percent:['on','off','twenty']}});
assert.deepEqual(Array.from(excluded.phrases),['speech twenty'],'lookahead still excludes reserved control words');

const missingCapture = Compiler.compile([
    { pattern: "^ready at (?<spokenTime>.+)$" }
]);
assert.equal(missingCapture.phraseCount, 0);
assert.match(missingCapture.unsupported[0].reason, /no finite phrase vocabulary/);

const capped = Compiler.compile([
    { pattern: "^(?:ready|ruddy|rudd)$" }
], { maxPhrasesPerPattern: 2 });
assert.equal(capped.phraseCount, 0);
assert.match(capped.unsupported[0].reason, /exceeds limit/);

console.log("Vosk phrase-list compiler tests passed.");

// Reusing syntax must never retain a previous live action or stale vocabulary.
context.SpeechGrammarContext={VALUE_CAPTURE_TYPES:{percent:'number'}};
const vocabulary=Object.freeze({number:Object.freeze(['one ten','one twelve'])});
const firstRecord={id:'first',pattern:'^day goal (?<percent>.+)$',action:'old'};
const secondRecord={...firstRecord,id:'second',action:'new'};
const initial=Compiler.compileStages([firstRecord],{valuePhrases:vocabulary});
const reused=Compiler.compileStages([secondRecord],{valuePhrases:vocabulary});
assert.equal(reused.paths[0].record,secondRecord,'cached syntax uses the current live command record');
assert.deepEqual(JSON.parse(JSON.stringify(reused.paths[0].stages)),JSON.parse(JSON.stringify(initial.paths[0].stages)));
assert.throws(()=>reused.paths[0].stages[1].phrases.push('bad'),'cached vocabulary cannot be changed by a consumer');
const mutable={number:['one ten']};
Compiler.compileStages([firstRecord],{valuePhrases:mutable});mutable.number.push('one twelve');
assert(Compiler.compileStages([firstRecord],{valuePhrases:mutable}).paths[0].stages[1].phrases.includes('one twelve'),'mutable vocabularies bypass caching');
const changed=Object.freeze({number:Object.freeze(['two fifteen'])});
assert.deepEqual(Array.from(Compiler.compileStages([firstRecord],{valuePhrases:changed}).paths[0].stages[1].phrases),['two fifteen'],'new locale vocabulary has an independent cache');
assert.equal(Compiler.compileStages([],{valuePhrases:vocabulary}).paths.length,0,'cached commands cannot leak into an empty context');
console.log('PASS bounded immutable syntax caching preserves live actions, changed vocabularies and empty contexts');
