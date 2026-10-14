import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event { constructor(type, options) {super(type); this.detail = options?.detail;} }
const context = {EventTarget, Event, CustomEvent, Float32Array, setTimeout, clearTimeout};
for (const file of ['SpeechGrammarContext', 'VoskPhraseListCompiler', 'VoskGrammarRouter', 'VoskRecognizer'])
    vm.runInNewContext(fs.readFileSync(new URL(`../${file}.js`, import.meta.url), 'utf8'), context);
const {VoskGrammarRouter: Router, VoskPhraseListCompiler: Compiler, VoskRecognizer: Recognizer} = context;
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
assert.ok(defaults.digits.includes('one one two three'));
assert.ok(defaults.date.includes('october fourteen'));
assert.ok(defaults.number.includes('one hundred twenty three'));
for (const [capture, grammar, phrase] of [['percent','number','nineteen'], ['pin','digits','one one two three'], ['spokenDate','date','october fourteen']]) {
    const r = new Router({records: [{pattern: `^set (?<${capture}>.+)$`}], valuePhrases: defaults});
    assert.equal((await r.update('set')).grammar, grammar);
    assert.equal((await r.update(phrase)).transcript, `set ${phrase}`);
}

const decoders = [];
class Decoder {
    constructor(rate, grammar) {this.rate = rate; this.phrases = JSON.parse(grammar); this.listeners = {}; this.audio = []; decoders.push(this);}
    on(event, callback) {this.listeners[event] = callback;}
    setWords() {}
    acceptWaveformFloat(pcm, rate) {this.audio.push({pcm: Array.from(pcm), rate});}
    emit(text, final = false) {this.listeners[final ? 'result' : 'partialresult']({result: final ? {text} : {partial: text}});}
    retrieveFinalResult() {this.emit(this.finalText ?? 'twenty minutes', true);}
    remove() {this.removed = true;}
}
const recognizer = new Recognizer({model: {KaldiRecognizer: Decoder}, overlapMilliseconds: 1,
    valuePhrases: values, contextProvider: async (id, text) => ({records: text ? await nextRecords(text) : initial})});
const transcripts = [], switches = [], errors = [];
recognizer.addEventListener('transcript', event => transcripts.push(event.detail));
recognizer.addEventListener('status', event => switches.push(event.detail));
recognizer.addEventListener('error', event => errors.push(event.detail));
const flush = async () => {for (let i = 0; i < 12; i++) await new Promise(resolve => setTimeout(resolve, 0));};
await recognizer.beginUtterance(42);
await recognizer.accept(42, Float32Array.from({length: 32}, (_, i) => i / 100));
decoders.at(-1).emit('ready at');
await flush();
assert.equal(decoders.length, 2);
assert.equal(decoders[0].removed, true);
assert.deepEqual(decoders[1].audio[0].pcm, Array.from({length: 16}, (_, i) => (i + 16) / 100).map(Math.fround), 'only bounded rolling PCM tail is replayed');
decoders[0].emit('stale old result');
await flush();
assert.ok(!transcripts.some(event => event.transcript.includes('stale')));
decoders.at(-1).emit('four twelve standard time');
await flush();
assert.ok(decoders.at(-1).phrases.includes('twenty minutes'));
decoders.at(-1).emit('twenty minutes');
await flush();
await recognizer.finishUtterance(42);
assert.equal(transcripts.at(-1).isFinal, true);
assert.equal(transcripts.at(-1).transcript, 'ready at four twelve standard time twenty minutes');
assert.ok(transcripts.every(event => event.utteranceId === 42));
assert.ok(switches.every(event => event.utteranceId === 42));
assert.equal(errors.length, 0);
await recognizer.beginUtterance(43);
assert.deepEqual(decoders.at(-1).phrases, ['ready', 'ready at']);
assert.equal(decoders.at(-1).audio.length, 0, 'overlap never leaks between utterances');
await recognizer.abortUtterance(43);
await recognizer.beginUtterance(44);
await recognizer.accept(44, new Float32Array(32));
decoders.at(-1).emit('ready at four twelve standard time twenty');
await flush();
decoders.at(-1).emit('minutes');
await flush();
assert.equal(transcripts.at(-1).transcript, 'ready at four twelve standard time twenty minutes',
    'next-stage words decoded before the replay window are retained');
decoders.at(-1).finalText = 'minutes';
await recognizer.finishUtterance(44);
assert.equal(transcripts.at(-1).transcript, 'ready at four twelve standard time twenty minutes');

await recognizer.beginUtterance(45);
await recognizer.accept(45, new Float32Array(16));
await recognizer.accept(45, new Float32Array(16));
const decoder = decoders.at(-1);
decoder.retrieveFinalResult = () => {
    decoder.emit('ready', true); // first queued audio endpoint
    decoder.emit('', false);    // second audio response
    decoder.emit('', true);    // actual retrieveFinalResult response
};
await recognizer.finishUtterance(45);
assert.equal(transcripts.filter(event => event.utteranceId === 45 && event.isFinal).length, 1,
    'pending audio endpoints cannot prematurely finalize the utterance');
recognizer.close();

// An upstream worker model-load error must reject startup rather than leave
// the browser microphone UI indefinitely waiting for a "load" event.
let failedModelTerminated = false;
context.Vosk = {createModel() {}, Model: class {
    constructor() {this.listeners={}; setTimeout(()=>this.listeners.error({error:'test model unavailable'}),0);}
    on(event,callback) {this.listeners[event]=callback;}
    terminate() {failedModelTerminated=true;}
}};
const failedModel = new Recognizer({modelUrl:'/missing-model.tar.gz',contextProvider:async()=>({records:initial})});
await assert.rejects(failedModel.ready,/test model unavailable/);
assert.equal(failedModelTerminated,true);
failedModel.close();

let scriptsLoaded = 0;
context.Vosk = undefined;
context.document = {
    createElement() {return {remove(){}};},
    head: {append(script) {
        scriptsLoaded++;
        setTimeout(()=>{context.Vosk={createModel:async()=>({KaldiRecognizer:Decoder,terminate(){}})};script.onload();},0);
    }}
};
const lazyA = new Recognizer({runtimeUrl:'/vosk.js',modelUrl:'/model.tar.gz',contextProvider:async()=>({records:initial})});
const lazyB = new Recognizer({runtimeUrl:'/vosk.js',modelUrl:'/model.tar.gz',contextProvider:async()=>({records:initial})});
await Promise.all([lazyA.ready,lazyB.ready]);
assert.equal(scriptsLoaded,1,'concurrent startup shares the configured runtime download');
lazyA.close();lazyB.close();
console.log('Vosk grammar router/adapter tests passed.');
