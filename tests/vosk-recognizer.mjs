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
assert(!decoder.removed, "logical silence preserves the decoder");
const count=events.length;decoder.emit('idle noise');await turns();assert.equal(events.length,count);
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
// New speech queues behind the old final fence: neither tail nor next PCM is lost.
const overlapping=new context.VoskRecognizer({model:{KaldiRecognizer:Decoder},finalTimeoutMilliseconds:100});
const overlapEvents=[];overlapping.addEventListener('transcript',e=>overlapEvents.push(e.detail));
await overlapping.beginUtterance('A');const shared=decoders.at(-1);
await overlapping.accept('A',new Float32Array([0.1]));
const endA=overlapping.finishUtterance('A');
const beginB=overlapping.beginUtterance('B');
const audioB=overlapping.accept('B',new Float32Array([0.2]));
await turns();assert.equal(shared.audio.length,1,'B waits behind A final, without replay');
shared.emit('ready');await endA;await beginB;await audioB;
assert.equal(overlapEvents.find(e=>e.utteranceId==='A'&&e.isFinal).transcript,'ready');
assert.equal(shared.audio.length,2);assert.equal(shared.removed,undefined);
shared.emit('five minutes');await overlapping.finishUtterance('B');
assert.equal(overlapEvents.at(-1).utteranceId,'B');assert.equal(overlapEvents.at(-1).transcript,'five minutes');
await overlapping.acceptAudio(new Float32Array([0]));shared.emit('');await turns();
assert.equal(shared.audio.length,3,'idle PCM still reaches the same decoder');
assert.equal(overlapping.audioDelivery.receivedSamples,3);
assert.equal(overlapping.audioDelivery.submittedSamples,3);
assert.equal(overlapping.audioDelivery.queuedSamples,0);
overlapping.close();assert(shared.removed);
const bounded=new context.VoskRecognizer({model:{KaldiRecognizer:Decoder},maxQueuedAudioSeconds:.001});
const overload=[];bounded.addEventListener('error',e=>overload.push(e.detail));
assert.equal(await bounded.acceptAudio(new Float32Array(17)),false);
assert.equal(overload.length,1,'overload is explicit, never silently drops a frame');
assert.equal(await bounded.acceptAudio(new Float32Array(1)),false);
assert.equal(overload.length,1,'closed transport cannot grow an unbounded queue');
console.log('PASS Vosk single decoder: no grammar, no replay, endpoint continuations, revisions, repeated digits, final drain, stale callbacks and abort');

// Native N-best output remains observable, while only one selected span enters collection.
class AlternativeDecoder extends Decoder {
 setMaxAlternatives(value){this.maximum=value;}
 emitAlternatives(alternatives){this.listeners.result({result:{alternatives}});}
 retrieveFinalResult(){this.emitAlternatives([{text:'',confidence:0}]);}
}
const lists=[],multiEvents=[];let releaseSelection;
const multiple=new context.VoskRecognizer({model:{KaldiRecognizer:AlternativeDecoder},maxAlternatives:10,
 requireAlternatives:true,selectHypothesis:async(id,hypotheses)=>{
  if(hypotheses.some(h=>h.segmentText==='sync on'))await new Promise(resolve=>releaseSelection=resolve);
  return hypotheses.find(h=>h.segmentText==='sync on')||hypotheses[0];
 }});
multiple.addEventListener('alternatives',event=>lists.push(event.detail));
multiple.addEventListener('transcript',event=>multiEvents.push(event.detail));
await multiple.beginUtterance('ranked');const ranked=decoders.at(-1);assert.equal(ranked.maximum,10);
await multiple.acceptAudio(new Float32Array([.2]));
ranked.emitAlternatives([{text:'sink on',confidence:31},{text:'sync on',confidence:29,result:[{word:'sync',start:0,end:.4,conf:.8}]}]);
await turns();assert(releaseSelection);let settled=false;const endRanked=multiple.finishUtterance('ranked').then(()=>settled=true);
await turns();assert.equal(settled,false,'final fence waits for native reply selection');
releaseSelection();await endRanked;
assert.equal(multiEvents.at(-1).transcript,'sync on');assert.equal(multiEvents.at(-1).isFinal,true);
assert.equal(multiEvents.at(-1).segments.filter(segment=>segment.text).length,1);
assert.equal(lists[0].selectedIndex,1);assert.equal(lists[0].count,2);
assert.deepEqual(Array.from(lists[0].hypotheses,h=>[h.segmentText,h.confidence]),[['sink on',31],['sync on',29]]);
assert.equal(lists[0].hypotheses[1].words[0].word,'sync');
assert.equal(multiple.audioDelivery.queuedSamples,0);multiple.close();
const unsupported=new context.VoskRecognizer({model:{KaldiRecognizer:Decoder},requireAlternatives:true});
await assert.rejects(unsupported.beginUtterance('unsupported'),/does not support multiple hypotheses/);unsupported.close();
for(const count of [-1,31,1.5])assert.throws(()=>new context.VoskRecognizer({maxAlternatives:count}),/alternatives must/);
const closedWhileSelecting=new context.VoskRecognizer({model:{KaldiRecognizer:AlternativeDecoder},selectHypothesis:()=>new Promise(resolve=>releaseSelection=resolve)});
const stale=[];closedWhileSelecting.addEventListener('alternatives',event=>stale.push(event.detail));
await closedWhileSelecting.beginUtterance('close');decoders.at(-1).emitAlternatives([{text:'wake',confidence:1}]);await turns();closedWhileSelecting.close();releaseSelection({index:0});await turns();assert.equal(stale.length,0,'late selection cannot publish after close');
console.log('PASS native N-best API, original rankings/scores/timestamps, selected-only collection, async final fence, capability and stale-selection guards');
