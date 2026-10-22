import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event {constructor(type, options){super(type);this.detail=options?.detail;}}
const context={EventTarget,Event,CustomEvent,Float32Array,setTimeout,clearTimeout};
for(const name of ['SpeechValueCollector','VoskRecognizer'])
 vm.runInNewContext(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'),context);
const decoders=[];
class Decoder {
 constructor(...args){assert.equal(args.length,1,'full vocabulary, no grammar argument');this.listeners={};this.audio=[];this.tail='';decoders.push(this);}
 on(event,callback){this.listeners[event]=callback;}
 setWords(value){assert.equal(value,true);}
 acceptWaveformFloat(pcm){this.audio.push([...pcm]);}
 emit(text,endpoint=false){this.tail=endpoint?'':text;this.listeners[endpoint?'result':'partialresult']({result:endpoint?{text}:{partial:text}});}
 retrieveFinalResult(){this.emit(this.tail,true);}
 remove(){this.removed=true;}
}
const turns=()=>new Promise(resolve=>setTimeout(resolve,0));
const recognizer=new context.VoskRecognizer({model:{KaldiRecognizer:Decoder},
 contextProvider(){throw Error('Grammar routing must never be consulted');},
 parallelFactory(){throw Error('Parallel recognition must never start');}});
const events=[],errors=[];
recognizer.addEventListener('transcript',e=>events.push(e.detail));
recognizer.addEventListener('error',e=>errors.push(e.detail));
await recognizer.beginUtterance('duration');
const decoder=decoders.at(-1);
const pcm=new Float32Array([0.25,0.5]);
const pending=recognizer.accept('duration',pcm);pcm.fill(0);await pending;
decoder.emit('an hour',true);await turns();
assert.equal(events.at(-1).transcript,'an hour');
assert.equal(events.at(-1).isFinal,false,'decoder endpoint does not complete an application value');
assert.equal(events.at(-1).segmentFinal,true);
decoder.emit('and');await turns();decoder.emit('and five');await turns();
assert.equal(events.at(-1).transcript,'an hour and five');
assert.equal(decoders.length,1,'context/value changes never replace the decoder');
assert.deepEqual(decoder.audio,[[0.25,0.5]],'each PCM block submitted once, no replay');
await recognizer.finishUtterance('duration');
assert.equal(events.at(-1).transcript,'an hour and five');assert(events.at(-1).isFinal);
assert(decoder.removed);
const count=events.length;decoder.emit('stale ready');await turns();assert.equal(events.length,count);
await recognizer.beginUtterance('digits');const digits=decoders.at(-1);
digits.emit('one one two three',true);await turns();
digits.emit('one one two three');await turns();
assert.equal(events.at(-1).transcript,'one one two three one one two three','genuine repeated spans are preserved');
digits.emit('five six seven eight');await turns();
assert.equal(events.at(-1).transcript,'one one two three five six seven eight','interim revision replaces only the mutable span');
await recognizer.finishUtterance('digits');
await recognizer.beginUtterance('idle');
const before=events.length;decoders.at(-1).emit('who do you love');await turns();
assert.equal(events.at(-1).transcript,'who do you love','unrelated speech remains literal for shared validation');
await recognizer.abortUtterance('idle');decoders.at(-1).emit('wake');await turns();
assert.equal(events.length,before+1,'aborted decoder cannot publish');
assert.equal(await recognizer.accept('idle',new Float32Array([1])),false);
recognizer.close();assert.deepEqual(errors,[]);
// A final result waits for outstanding worker responses without losing tail audio.
const delayed=new context.VoskRecognizer({model:{KaldiRecognizer:Decoder},finalTimeoutMilliseconds:100});
const delayedEvents=[];delayed.addEventListener('transcript',e=>delayedEvents.push(e.detail));
await delayed.beginUtterance('drain');await delayed.accept('drain',new Float32Array([1]));
const finish=delayed.finishUtterance('drain');await turns();
assert(!decoders.at(-1).removed);
decoders.at(-1).emit('twenty two seventeen');await finish;
assert.equal(delayedEvents.at(-1).transcript,'twenty two seventeen');assert(delayedEvents.at(-1).isFinal);delayed.close();
console.log('PASS Vosk single decoder: no grammar, no replay, endpoint continuations, revisions, repeated digits, final drain, stale callbacks and abort');
