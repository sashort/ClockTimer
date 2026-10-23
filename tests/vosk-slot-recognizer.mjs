import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event{constructor(type,options){super(type);this.detail=options?.detail;}}
const instances=[];
class Decoder extends EventTarget{
 constructor(options){super();this.options=options;this.model=options.model||{};this.ready=Promise.resolve();this.audio=[];instances.push(this);}
 beginUtterance(id){this.id=id;return Promise.resolve();}
 accept(id,audio){this.audio.push([...audio]);return Promise.resolve(true);}
 emit(text,words,final=true){this.dispatchEvent(new CustomEvent('transcript',{detail:{transcript:text,words,segments:[{id:'segment',text,final}]}}));}
 finishUtterance(){return Promise.resolve();}
 close(){this.closed=true;}
}
const context={EventTarget,Event,CustomEvent,structuredClone,performance,Float32Array,VoskRecognizer:Decoder};
for(const name of ['SpeechGrammarContext','VoskPhraseListCompiler','SpeechRecognitionLedger','VoskSlotRecognizer'])
 vm.runInNewContext(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'),context);
context.SpeechLanguageController={classify:(text,kind)=>kind==='time'&&text==='four twelve'?{status:'valid',value:'4:12'}:{status:'invalid'}};
const record={id:'ready-time',pattern:'^ready at (?<spokenTime>.+)$',expect:'time',capture:'spokenTime',executionContext:'scheduled-start-time'};
const adapter=new context.VoskSlotRecognizer({contextProvider:async(id,text)=>({records:text==='ready at four twelve'?[]:[record]}),
 selectHypothesis:async(id,list)=>list.find(h=>['ready at','ready at four twelve'].includes(h.text)),
 valuePhrases:{time:['four twelve'],duration:['an hour'],number:['one ten'],digits:['one'],date:['today']}});
const transcripts=[],slots=[],errors=[];
adapter.addEventListener('transcript',e=>transcripts.push(e.detail));adapter.addEventListener('slots',e=>slots.push(e.detail));adapter.addEventListener('error',e=>errors.push(e.detail));
await adapter.beginUtterance('u1');assert.equal(instances.length,7,'one model loader and six concurrent context decoders');
const byKind=kind=>instances.find(d=>d.options.grammar?.includes(kind));
const commands=byKind('ready at'),time=byKind('four twelve');
const input=new Float32Array(16000).fill(.5);await adapter.accept('u1',input);input.fill(0);
for(const d of instances.slice(1)){assert.equal(d.audio.length,1);assert.equal(d.audio[0][0],.5);assert.equal(d.options.model,instances[0].model);}
time.emit('four twelve',[{word:'four',start:.4,end:.6},{word:'twelve',start:.6,end:.8}]);
await new Promise(r=>setTimeout(r,0));assert.equal(transcripts.length,0,'an unbound time cannot dispatch a command');
commands.emit('ready at',[{word:'ready',start:0,end:.2},{word:'at',start:.2,end:.4}]);
await new Promise(r=>setTimeout(r,0));
assert.equal(transcripts.at(-1).transcript,'ready at four twelve','already decoded time fills its contextual slot without audio replay');
assert.equal(slots.at(-1).slots.length,2);assert.equal(slots.at(-1).slots[1].context,'scheduled-start-time');
assert.equal(slots.at(-1).slots[1].position.startSample,6400);
await adapter.finishUtterance('u1');assert(transcripts.at(-1).isFinal);assert.equal(adapter.audioDelivery.replayedSamples,0);
assert.equal(adapter.audioDelivery.receivedSamples,16000);assert.equal(adapter.audioDelivery.submittedSamples,16000);
const count=transcripts.length;commands.emit('wake',[{word:'wake',start:0,end:.1}]);await new Promise(r=>setTimeout(r,0));assert.equal(transcripts.length,count);
assert.deepEqual(errors,[]);adapter.close();assert(instances.every(d=>d.closed));
console.log('PASS parallel sample fanout, shared model, two contextual slots, asynchronous candidate order, no replay, finality and stale decoder fencing');
