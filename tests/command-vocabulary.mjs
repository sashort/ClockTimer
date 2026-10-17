import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pack=JSON.parse(fs.readFileSync(new URL('../lang/en-US/speech-patterns.json',import.meta.url)));
const patterns=Object.values(pack.patterns);
const removed=['rudy','rudd','rudd at five','ruddy','ruddy at five','sin status','sink status','sync status','sin on','sin off','sink on','sink off','castle','start break','start lunch','start short break'];
// Only command heads count here: an unrestricted value collector deliberately
// accepts arbitrary text for later validation and is not a command alias.
const heads=patterns.filter(p=>!p.pattern.includes('(?<')||['readyAt','sync'].includes(p.command));
for(const phrase of removed)assert(!heads.some(p=>new RegExp(p.pattern).test(phrase)),phrase+' is not a command');
for(const phrase of ['ready','ready at five','sync','sync on','sync off','cancel','break start'])assert(heads.some(p=>new RegExp(p.pattern).test(phrase)),phrase+' remains supported');
const context={};vm.runInNewContext(fs.readFileSync(new URL('../VoskPhraseListCompiler.js',import.meta.url),'utf8'),context);
const grammar=context.VoskPhraseListCompiler.compile(heads,{capturePhrases:{spokenTime:['five'],syncAction:['on','off']}});
for(const phrase of removed)assert(!grammar.phrases.includes(phrase),phrase+' is absent from decoder phrases and the phrase-derived Commands list');
assert(!patterns.some(p=>['syncStatus','startLunch','startShortBreak'].includes(p.command)),'removed commands have no runtime registration source');
console.log('PASS requested vocabulary removals, retained commands and compiled decoder phrases');
