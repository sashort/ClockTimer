import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event{constructor(type,options){super(type);this.detail=options?.detail;}}
const context={EventTarget,Event,CustomEvent,Float32Array,setTimeout,clearTimeout,performance,structuredClone};
for(const name of ['PcmSampleBuffer','SpeechBoundaryAnalyzer','SpeechRecognitionLedger'])vm.runInNewContext(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'),context);
const ring=new context.PcmSampleBuffer(8),source=new Float32Array([1,2,3,4]);
ring.append(source);source.fill(99);ring.append(new Float32Array([5,6,7,8,9,10]));
assert.equal(ring.start,2);assert.equal(ring.end,10);assert.deepEqual([...ring.read(2,10)],[3,4,5,6,7,8,9,10]);
assert.throws(()=>ring.read(1),/no longer retained/);
const voiced=new context.PcmSampleBuffer(16000);voiced.append(new Float32Array(16000).fill(.5));
const analyzer=new context.SpeechBoundaryAnalyzer();
const conservative=analyzer.locate(voiced,8000);assert.equal(conservative.replayStartSample,6080);
const quiet=new context.PcmSampleBuffer(16000),pcm=new Float32Array(16000).fill(.5);pcm.fill(0,4000,5900);quiet.append(pcm);
const positioned=analyzer.locate(quiet,8000);assert.equal(positioned.reason,'quiet-context');assert(positioned.replayStartSample<6080);
assert.equal(positioned.boundarySample,8000,'analysis never moves the semantic commit point');
assert.throws(()=>analyzer.locate(quiet,16001),/outside retained/);
let transferred=0,release;
analyzer.setDestination({context:'time'});
const transfer=analyzer.handoff(quiet,8000,async(destination)=>{assert.equal(destination.context,'time');transferred++;await new Promise(r=>release=r);});
assert.equal(analyzer.hasDestination,false,'destination is claimed before asynchronous routing');
assert.equal(await analyzer.handoff(quiet,8000,()=>transferred++),undefined);release();await transfer;
assert.equal(transferred,1,'one destination transfers exactly once');
analyzer.setDestination({context:'digits'});analyzer.cancel();assert.equal(analyzer.hasDestination,false);
analyzer.setDestination({context:'duration'});await assert.rejects(analyzer.handoff(quiet,8000,()=>{throw Error('transfer failed');}),/transfer failed/);assert.equal(analyzer.hasDestination,false);
analyzer.setDestination({context:'digits'});await assert.rejects(analyzer.handoff(quiet,8000,null),/transfer callback/);assert.equal(analyzer.hasDestination,false,'invalid transfer cannot retain a destination');

const instances=[];
class FakeRecognizer extends EventTarget{
 constructor(options){super();this.options=options;this.model=options.model||{};this.ready=Promise.resolve(this);this.audio=[];this.words=[];instances.push(this);}
 beginUtterance(id){this.id=id;return Promise.resolve();}
 accept(id,pcm){this.audio.push([...pcm]);return Promise.resolve(true);}
 emit(text,{words,final=false}={}){if(words)this.words=words;this.last=text;this.dispatchEvent(new CustomEvent('transcript',{detail:{utteranceId:this.id,transcript:text,isFinal:final,segmentFinal:final,words:final?this.words:undefined,segments:[{id:'0',text,final}]}}));}
 finishUtterance(){if(!this.last&&this.options.grammar?.includes('sync off')){this.last='sync off';this.words=[{word:'sync',start:.12,end:.22},{word:'off',start:.22,end:.32}];}this.emit(this.last||'',{words:this.words,final:true});return Promise.resolve();}
 close(){this.closed=true;}
}
context.VoskRecognizer=FakeRecognizer;
vm.runInNewContext(fs.readFileSync(new URL('../VoskContextRecognizer.js',import.meta.url),'utf8'),context);
class Router{
 grammar='commands';prefix='';phrases=['ready at'];
 get paths(){return [{record:{id:'ready',slotContext:'scheduled-start-time'},stages:this.grammar==='time'
  ?[{grammar:'time',phrases:['four twelve']},{grammar:'commands',phrases:['sync off']}]
  :this.prefix?[{grammar:'commands',phrases:['sync off']}]
  :[{grammar:'commands',phrases:['ready at']},{grammar:'time',phrases:['four twelve']}]}];}
 async update(text){
  if(this.grammar==='commands'&&text.startsWith('ready at')){this.prefix='ready at';this.grammar='time';this.phrases=['four twelve','sync off'];}
  else if(this.grammar==='time'&&text.includes('sync off')){this.prefix='ready at four twelve';this.grammar='commands';this.phrases=['sync off'];}
  return {grammar:this.grammar};
 }
}
const adapter=new context.VoskContextRecognizer({contextProvider:async()=>({records:[]}),routerFactory:()=>new Router(),overlapMilliseconds:120});
const transcripts=[],handoffs=[],errors=[];
adapter.addEventListener('transcript',e=>transcripts.push(e.detail));adapter.addEventListener('handoff',e=>handoffs.push(e.detail));adapter.addEventListener('error',e=>errors.push(e.detail));
await adapter.beginUtterance('chain');assert.equal(instances.length,2,'loader creates no microphone or decoding stream');
const first=instances.at(-1);await adapter.accept('chain',new Float32Array(16000).fill(.5));
first.words=[{word:'ready',start:0,end:.2},{word:'at',start:.2,end:.4},{word:'four',start:.4,end:.6}];first.emit('ready at four');
const turn=()=>new Promise(r=>setTimeout(r,0));for(let i=0;i<12&&!handoffs.length;i++)await turn();
assert.deepEqual(errors,[]);assert.equal(handoffs.length,1);assert(first.closed);assert.equal(handoffs[0].boundarySample,6400);
const time=instances.at(-1);assert.notEqual(time,first);assert.equal(time.options.model,instances[0].model,'decoders share one loaded model');
assert.equal(handoffs[0].replayStartSample,4480);assert.equal(time.audio.reduce((n,x)=>n+x.length,0),11520,'buffered continuation survives switching');
const before=transcripts.length;first.emit('wake');await turn();assert.equal(transcripts.length,before,'late callbacks from the retired decoder are fenced');
// A re-decoded word from committed context is suppressed by SAMPLE position.
time.words=[{word:'at',start:0,end:.1},{word:'four',start:.12,end:.32},{word:'twelve',start:.32,end:.52},{word:'sync',start:.52,end:.62},{word:'off',start:.62,end:.72}];
time.emit('at four twelve sync off');
await adapter.finishUtterance('chain');
assert.deepEqual(errors,[]);assert.equal(transcripts.at(-1).isFinal,true);assert.equal(transcripts.at(-1).utteranceId,'chain');
assert.equal(transcripts.at(-1).transcript,'ready at four twelve sync off','every command survives the timed handoffs once');
assert.equal(adapter.slots[0].text,'ready at','incomplete command heads lock without requiring executable full commands');
assert.equal(adapter.slots[0].forecast.kind,'time');
assert.equal(adapter.slots[1].text,'four twelve');
assert.equal(adapter.slots[1].position.streamId,adapter.slots[0].position.streamId);
assert.equal(adapter.audioDelivery.receivedSamples,16000);assert(adapter.audioDelivery.replayedSamples>0);assert(adapter.audioDelivery.retainedSamples<=adapter.audioDelivery.capacitySamples);
adapter.close();assert(instances[0].closed);
console.log('PASS bounded PCM copy/wrap/expiry; conservative audio analysis; one model and decoder; timed replay; stale result fencing; utterance identity; final settlement');
vm.runInNewContext(fs.readFileSync(new URL('../DigitSequence.js',import.meta.url),'utf8'),context);
const digitWords=['zero','zero','four','two','one','two','three','four'];
const digitRecord={id:'credentials',digitContext:'credentials',digitCounts:[8],digitVocabulary:{zero:'0',one:'1',two:'2',three:'3',four:'4'},pattern:'^(?<credentials>.+)$'};
const digitRouter={grammar:'commands',prefix:'',phrases:digitWords,paths:[],digitRecords:[digitRecord],async update(){return {grammar:this.grammar};}};
const digitAdapter=new context.VoskContextRecognizer({contextProvider:async()=>({records:[]}),routerFactory:()=>Object.assign({},digitRouter)});
await digitAdapter.beginUtterance('bounded-digits');await digitAdapter.accept('bounded-digits',new Float32Array(16000));
const digitDecoder=instances.at(-1);
digitDecoder.emit(digitWords.join(' '),{words:digitWords.map((word,index)=>({word,start:index/10,end:(index+1)/10})),final:true});
await digitAdapter.finishUtterance('bounded-digits');
assert.equal(digitAdapter.slots.length,1);assert.equal(digitAdapter.slots[0].value,'00421234');
assert.equal(digitAdapter.slots[0].context,'credentials');assert.equal(digitAdapter.slots[0].kind,'digits');
digitAdapter.close();
console.log('PASS bounded digit collectors record semantic slots without expanding every digit sequence');

for(const name of ['SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter'])vm.runInNewContext(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'),context);
context.SpeechLanguageController={vocabulary:()=>Object.freeze({})};
const rootRecord={pattern:'^break start$',nextContext:'choice'},installed=[rootRecord,{pattern:'^lunch$',contexts:['choice'],nextContext:'confirm'},{pattern:'^okay$',contexts:['confirm']}];
let providerCalls=0;const declarative=new context.VoskContextRecognizer({warmDecoders:false,vocabularyProvider:()=>installed,contextProvider:async()=>{providerCalls++;return {records:[rootRecord]};}});
const phases=[];declarative.addEventListener('status',e=>phases.push(e.detail.status));
await declarative.beginUtterance('declared-contexts');
assert.equal(providerCalls,1,'future grammar heads must not invoke the full application planner');
assert(instances.at(-1).options.grammar.includes('break start lunch okay'),'declared continuations remain audible');
assert.equal(declarative.processing,false);assert.equal(declarative.listening,true);assert(phases.includes('recognition-processing'));assert(phases.includes('recognition-listening'));declarative.close();
console.log('PASS declarative lookahead retains multi-command context chains without speculative planner calls and reports decoder readiness');

vm.runInNewContext(fs.readFileSync(new URL('../SpeechValueCollector.js',import.meta.url),'utf8'),context);
const credentials={id:'credentials',atomic:'credentials',digitCounts:[8],digitField:'credentials',digitVocabulary:{zero:'0',one:'1',two:'2',three:'3',four:'4'},pattern:'^(?<credentials>.+)$'};
const credentialText='zero zero four two one two three four';
const noisyAdapter=new context.VoskContextRecognizer({warmDecoders:false,
 valuePhrases:{digits:['zero','one','two','three','four']},
 contextProvider:async(id,text)=>({records:text.endsWith('sync off')?[]:text.endsWith(credentialText)?[{pattern:'^sync off$'}]:[credentials,{pattern:'^cancel$'}]})});
const noisyErrors=[],noisyResults=[],noisyHandoffs=[];
noisyAdapter.addEventListener('error',e=>noisyErrors.push(e.detail));
noisyAdapter.addEventListener('transcript',e=>noisyResults.push(e.detail));
noisyAdapter.addEventListener('handoff',e=>noisyHandoffs.push(e.detail));
await noisyAdapter.beginUtterance('noisy-credentials');await noisyAdapter.acceptAudio(new Float32Array(32000));
const noisyWords=('background chatter '+credentialText+' sync off').split(' ');
instances.at(-1).emit(noisyWords.join(' '),{words:noisyWords.map((word,i)=>({word,start:i/10,end:(i+1)/10})),final:true});
await noisyAdapter.finishUtterance('noisy-credentials');
assert.deepEqual(noisyErrors,[],'leading speech must not kill the sequential decoder');
assert.equal(noisyResults.at(-1).transcript,credentialText+' sync off','credentials and the following command survive exactly once');
assert.equal(noisyHandoffs[0].boundarySample,16000,'credential boundary includes the two discarded audio words');
assert.equal(noisyHandoffs[0].discardedPrefix.endSample,3200);
assert.equal(noisyAdapter.slots[0].value,'00421234');
assert.equal(noisyAdapter.slots[0].startSample,3200,'junk never becomes part of the credential slot');
noisyAdapter.close();
console.log('PASS timed leading-noise discard preserves credential ownership and subsequent commands');
