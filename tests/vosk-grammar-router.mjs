import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event { constructor(type, options) {super(type); this.detail = options?.detail;} }
const context = {EventTarget, Event, CustomEvent, Float32Array, setTimeout, clearTimeout};
for (const file of ['SpeechGrammarContext', 'VoskPhraseListCompiler', 'VoskGrammarRouter', 'VoskRecognizer'])
    vm.runInNewContext(fs.readFileSync(new URL(`../${file}.js`, import.meta.url), 'utf8'), context);
const {VoskGrammarRouter: Router, VoskPhraseListCompiler: Compiler, VoskRecognizer: Recognizer} = context;
const mixedRoot = new Router({records:[
    {pattern:'^trip(?: mode)?$'},
    {pattern:'^(?<percent>.+) (?<goalScope>trip|day)$'}
],valuePhrases:{number:['three','one hundred ten']}});
assert.equal((await mixedRoot.update('three')).grammar,'commands','a provisional value-first head must retain literal command competitors');
assert(mixedRoot.phrases.includes('trip mode'),'Trip mode remains available after an unstable numeric partial');
assert(mixedRoot.phrases.includes('hundred'),'value-first numeric words remain recognizable at root');
assert(!mixedRoot.phrases.includes('one hundred ten'),'root numeric words do not overweight command heads with repeated number phrases');
assert.equal((await mixedRoot.update('trip mode')).transcript,'trip mode','a corrected partial can resolve the literal command');
const numericRoot = new Router({records:[{pattern:'^trip(?: mode)?$'},
    {pattern:'^(?<percent>.+) (?<goalScope>trip|day)$'}],valuePhrases:{number:['three','one hundred ten']}});
assert.equal((await numericRoot.update('one hundred ten')).grammar,'commands');
assert.equal((await numericRoot.update('one hundred ten trip')).transcript,'one hundred ten trip','a value-first command still resolves when its required suffix arrives');
const optionalValue = new Router({records:[{pattern:'^trip goal(?: (?<percent>.+)(?: percent)?)?$'},
    {pattern:'^ready at (?<spokenTime>.+)$'}],valuePhrases:{number:['one hundred ten'],time:['four twelve']}});
await optionalValue.update('trip goal');
assert(optionalValue.phrases.includes('one hundred ten'),'the matched optional value continuation is available');
assert(!optionalValue.phrases.includes('four twelve'),'unrelated command captures cannot contaminate the selected continuation');
assert.equal((await optionalValue.update('one hundred ten')).grammar,'number');
const latePartial = new Router({records:[{pattern:'^trip goal(?: (?<percent>.+))?$'},
    {pattern:'^ready at (?<spokenTime>.+)$'}],valuePhrases:{number:['one hundred ten'],time:['four twelve']}});
assert.equal((await latePartial.update('trip goal one hundred ten')).grammar,'number','routing cannot require a separate head-only partial');
const projectedRecords=[{pattern:'^break start$'},{pattern:'^(?<percent>.+) trip$'}];
const projectedRoot=new Router({records:projectedRecords,nextRecords:async()=>projectedRecords,
    valuePhrases:{number:['one hundred ten']}});
await projectedRoot.update('break start');
assert(projectedRoot.phrases.includes('hundred'),'projected value-first commands retain their number vocabulary');
assert(!projectedRoot.phrases.includes('one hundred ten'),'projected root alternatives cannot reintroduce repeated numeric phrase weights');
const initial = [{pattern: '^ready$'}, {pattern: '^ready at (?<spokenTime>.+)$'}];
const scheduled = [{pattern: '^standard(?: time)? (?<timeValue>.+)$', expect: 'duration'}, {pattern: '^cancel$'}];
const values = {time: ['four twelve', 'four thirteen', 'four twenty two'], duration: ['twenty minutes', 'thirteen minutes']};
const nextRecords = async text => text.startsWith('ready at four') ? scheduled : [];
const router = new Router({records: initial, valuePhrases: values, nextRecords});
const noisyHead = new Router({records: initial, valuePhrases: values, nextRecords});
assert.equal((await noisyHead.update('background chatter ready')).grammar,'commands','discarding noise cannot force an ambiguous head to execute');
assert.equal(noisyHead.transcript,'ready');
assert.equal((await noisyHead.update('different chatter ready at')).grammar,'time','leading junk does not block the value grammar switch');
await noisyHead.update('four twelve standard time');
assert.equal((await noisyHead.update('twenty minutes')).transcript,'ready at four twelve standard time twenty minutes');
assert.deepEqual(Array.from(router.phrases), ['ready', 'ready at']);
assert.equal((await router.update('ready')).grammar, 'commands', 'ambiguous prefix stays in command grammar');
assert.equal((await router.update('ready at')).grammar, 'time');
assert.ok(router.phrases.includes('four thirteen'));
assert.ok(router.phrases.includes('standard time'), 'projected contextual command heads are available beside value words');
assert.ok(!router.phrases.includes('cancel trip'), 'unavailable commands omitted');
assert.equal((await router.update('four twelve standard time')).grammar, 'duration');
assert.equal((await router.update('twenty minutes')).transcript, 'ready at four twelve standard time twenty minutes');

for (const value of ['four thirteen', 'four twenty two']) {
    const r = new Router({records: initial, valuePhrases: values, nextRecords});
    await r.update('ready at');
    assert.equal((await r.update(value)).transcript, `ready at ${value}`);
    assert.equal(r.grammar, 'time', 'a completed finite value alone is not a command boundary');
    assert.equal((await r.update(`${value} standard time`)).grammar, 'duration');
}
const alternatives = new Router({records: [
    {pattern: '^set (?<time>.+)$'}, {pattern: '^set (?<duration>.+)$'}], valuePhrases: values});
assert.equal((await alternatives.update('set')).grammar, 'commands', 'conflicting capture types cannot switch');
const unanimous = new Router({records: [
    {pattern: '^set (?<time>.+)$'}, {pattern: '^set (?<spokenTime>.+)$'}], valuePhrases: values});
assert.equal((await unanimous.update('set')).grammar, 'time', 'all candidates agree on next value grammar');
const compiled = Compiler.compileStages([
    {pattern: '^break (?<kind>lunch|short)$'},
    {pattern: '^bad [a-z]+$'}, {pattern: '^any .*$'},
    {pattern: '^speech (?!off)(?<percent>.+)$'},
    {pattern: '^empty (?<unknown>.+)$'}], {valuePhrases: {number: ['twenty']}});
assert.equal(compiled.unsupported.length, 4);
assert.deepEqual(Array.from(compiled.paths, path => path.stages[0].phrases[0]), ['break lunch', 'break short']);
const multiple = new Router({records: [{pattern: '^from (?<time>.+) for (?<duration>.+)$'}], valuePhrases: values});
await multiple.update('from');
assert.equal((await multiple.update('four twelve for')).grammar, 'duration');
assert.equal((await multiple.update('twenty minutes')).transcript, 'from four twelve for twenty minutes');
const terminal = new Router({records: [{pattern: '^open$'}], nextRecords: async () => scheduled, valuePhrases: values});
await terminal.update('open');
assert.equal((await terminal.update('open standard time')).grammar, 'duration');

const defaults = Router.valuePhrases();
assert.ok(defaults.time.includes('four thirteen'));
assert.ok(defaults.number.includes('nineteen'));
assert.ok(defaults.duration.includes('thirteen minutes'));
assert.ok(defaults.duration.includes('an hour and five'));
for(const phrase of ['an hours','a minutes','an seconds']) assert(!defaults.duration.includes(phrase),'articles use singular units: '+phrase);
for (const phrase of ['twenty two seventeen', 'twenty two fifty six', 'twenty two oh six', 'fifty nine fifty nine'])
    assert.ok(defaults.duration.includes(phrase), 'duration decoder must include positional phrase: '+phrase);

assert.ok(defaults.digits.includes('one one two three'));
assert.ok(defaults.date.includes('october fourteen'));
assert.ok(defaults.number.includes('one hundred twenty three'));
for (const [capture, grammar, phrase] of [['percent','number','nineteen'], ['pin','digits','one one two three'], ['spokenDate','date','october fourteen']]) {
    const r = new Router({records: [{pattern: `^set (?<${capture}>.+)$`}], valuePhrases: defaults});
    assert.equal((await r.update('set')).grammar, grammar);
    assert.equal((await r.update(phrase)).transcript, `set ${phrase}`);
}

console.log('PASS legacy grammar compiler/router utilities (not used by the single-decoder Vosk adapter)');
