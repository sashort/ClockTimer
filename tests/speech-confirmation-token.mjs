import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const pack=JSON.parse(fs.readFileSync(new URL('../lang/en-US/speech-patterns.json',import.meta.url),'utf8'));
for(const [id,record] of Object.entries(pack.patterns)){
 if(!record.pattern.includes('okay'))continue;
 assert(!record.pattern.includes('o\\s+k'),id+' cannot accept separated letters');
 assert(!record.pattern.includes('ok|'),id+' cannot accept the old spelling');
}
const command=name=>new RegExp(pack.patterns[pack.language.speech.commands[name]].pattern,'i');
for(const word of ['ok','o k','oh k'])assert(!command('confirm').test(word),word+' is not confirmation');
assert(command('confirm').test('okay'));
assert(command('loginDigits').test('oh oh four two okay'));
assert(!command('loginDigits').test('oh oh four two o k'));
assert(!command('loginDigits').test('oh oh four two ok'));
assert(command('loginCredentials').test('oh oh four two one two three four'));
assert(command('loginCredentials').test('oh oh four two one two three four okay'));
const context={};vm.runInNewContext(fs.readFileSync(new URL('../DigitSequence.js',import.meta.url),'utf8'),context);
assert.equal(context.DigitSequence.parse('oh oh four two',pack.language.speech.digits),'0042');
assert.equal(context.DigitSequence.parse('okay',pack.language.speech.digits),null,'confirmation never turns into a zero digit');
console.log('PASS production okay-only confirmation, rejected aliases, oh zero, four/eight login and optional confirmation');
