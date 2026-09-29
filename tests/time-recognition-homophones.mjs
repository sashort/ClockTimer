import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../lang/en-US.js',import.meta.url),'utf8');
const durationSource=fs.readFileSync(new URL('../lang/en-US/DurationParser.js',import.meta.url),'utf8');
const clockSource=fs.readFileSync(new URL('../lang/en-US/SpokenTimeParser.js',import.meta.url),'utf8');
const preprocessorSource=fs.readFileSync(new URL('../lang/en-US/SpeechValuePreprocessor.js',import.meta.url),'utf8');

globalThis.WMOFLanguages=Object.create(null);
eval(source);
eval(durationSource);
eval(clockSource);
eval(preprocessorSource);

const language=globalThis.WMOFLanguages['en-US'];
const keypad=new RegExp(language.speech.commands.keypadValue,'i');

for(const transcript of [
  'twenty two sixteen',
  'twenty to sixteen',
  'twenty too sixteen',
  'to too',
  'too to'
]){
  assert(
    keypad.test(transcript),
    `keypad candidate grammar must retain ASR revision: ${transcript}`
  );
}

for(const transcript of [
  'twenty two sixteen',
  'twenty to sixteen',
  'twenty too sixteen'
]){
  assert.equal(
    globalThis.EnglishDurationParser.parse(transcript),
    1336000,
    `${transcript} should parse as 0:22:16`
  );
  assert.equal(
    globalThis.EnglishSpeechValuePreprocessor.normalize(transcript,'duration'),
    '0:22:16'
  );
}

assert.equal(
  globalThis.EnglishDurationParser.parse('to too'),
  22000,
  'homophone-only two-digit interim remains a valid raw digit sequence'
);
assert.equal(
  globalThis.EnglishDurationParser.parse('too to'),
  22000,
  'reversed two homophones remain a valid raw digit sequence'
);

// Clock grammar semantics stay separate from duration homophone recovery.
assert.equal(
  globalThis.EnglishSpeechValuePreprocessor.normalize('quarter to five','clock'),
  '4:45'
);

console.log('PASS duration speech survives two/to/too ASR homophones without changing clock "to" semantics');
