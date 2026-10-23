import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class CustomEvent extends Event {constructor(type, options) {super(type); this.detail = options?.detail;}}
const context = {EventTarget, Event, CustomEvent, Float32Array, setTimeout, clearTimeout};
for (const file of ['SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter','VoskRecognizer'])
    vm.runInNewContext(fs.readFileSync(new URL(`../${file}.js`, import.meta.url), 'utf8'), context);
const Compiler = context.VoskPhraseListCompiler;
const values = {time: ['four twelve'], number: ['twenty'], digits: ['one one two three'], duration: ['ten minutes']};
const records = [
    {id:'schedule', pattern:'^ready at (?<spokenTime>.+)$'},
    {id:'volume', pattern:'^volume (?<percent>.+)$', expect:'number'},
    {id:'pin', pattern:'^login (?<pin>.+) ok$', expect:'digits'},
    {id:'multiple', pattern:'^from (?<time>.+) for (?<duration>.+)$'},
    {id:'log', pattern:'^show log$'}
];
const plan = Compiler.compileParallel(records, {valuePhrases: values});
assert.equal(plan.unsupported.length, 0);
assert.equal(plan.branches.length, records.length);
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(plan.branches.find(b=>b.record.id==='volume').stages), [
    {phrases:['volume'],literal:true}, {phrases:['twenty'],literal:false}
]);
assert.deepEqual(plain(plan.branches.find(b=>b.record.id==='pin').stages), [
    {phrases:['login'],literal:true}, {phrases:['one one two three'],literal:false}, {phrases:['ok'],literal:true}
]);
assert.equal(plan.branches.find(b=>b.record.id==='multiple').stages.length, 4);
const many=Compiler.compileParallel(Array.from({length:100},(_,i)=>({pattern:`^command ${i}$`})),{});
assert.equal(many.branches.length,1,'terminal commands share a search instead of duplicating decoder state');
assert.equal(many.branches[0].stages[0].phrases.length,100);
const prefixed = Compiler.compileParallel([{pattern:'^close$'}], {}, 'SHOW LOG');
assert.deepEqual(plain(prefixed.branches[0].stages), [
    {phrases:['show log'],literal:true}, {phrases:['close'],literal:true}
]);

class Backend {
    registrations = new Map(); audio = []; finalized = false; closed = false; reads = 0;
    addGrammar(id, stages, start) {assert.equal(start,0); this.registrations.set(id, stages);}
    removeGrammar(id) {this.registrations.delete(id);}
    accept(samples) {assert(!this.finalized); this.audio.push(Array.from(samples)); return this.snapshot(false);}
    snapshot(final) {
        this.reads++; this.finalized ||= final;
        return {final:this.finalized, branches:[...this.registrations].map(([id, stages])=>{
            const head=stages[0].phrases[0];
            const text=head==='volume' ? 'volume twenty' : head==='ready at' ? 'ready at four twelve' : head;
            return {id, text, enabled:head!=='ready at', precondition_met:head!=='login', ready:true,
                start_frame:0,end_frame:20,total_cost:head==='volume'?2:10};
        })};
    }
    close() {this.closed=true;}
}
const backends=[], events=[], hypotheses=[];
let release;
const gate = new Promise(resolve=>{release=resolve;});
const recognizer = new context.VoskRecognizer({
    valuePhrases:values,
    parallelFactory:async()=>{const backend=new Backend(); backends.push(backend); return backend;},
    contextProvider:async()=>({records, selectHypothesis:async candidates=>{
        assert(!candidates.some(b=>b.record.id==='schedule'), 'application-disabled branch cannot be selected');
        assert(!candidates.some(b=>b.record.id==='pin'), 'unmet spoken precondition cannot be selected');
        await gate;
        return candidates.sort((a,b)=>a.total_cost-b.total_cost)[0];
    }})
});
recognizer.addEventListener('transcript',event=>events.push(event.detail));
recognizer.addEventListener('hypotheses',event=>hypotheses.push(event.detail));
await recognizer.beginUtterance('first');
const samples = new Float32Array([0.25,0.5]);
const accepted=recognizer.accept('first',samples);
samples.fill(0); // Adapter must copy before it waits for the worker/selector.
const finished=recognizer.finishUtterance('first');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(backends[0].finalized,false,'finalization waits for queued audio and hypotheses');
release(); await accepted; await finished;
assert.deepEqual(backends[0].audio,[[0.25,0.5]],'one acoustic submission, no overlap replay');
assert.equal(events.at(-1).transcript,'volume twenty');
assert.equal(events.at(-1).isFinal,true);
assert.equal(backends[0].closed,true);
assert(hypotheses.every(event=>event.selectedId));
await recognizer.beginUtterance('second');
assert.equal(await recognizer.accept('first',new Float32Array([1])),false,'stale utterance rejected');
assert.equal(backends[1].audio.length,0);
await recognizer.abortUtterance('second');
assert(backends[1].closed);
recognizer.close();

const unsupported = new context.VoskRecognizer({parallelFactory:async()=>new Backend(),
    contextProvider:async()=>({records})});
await assert.rejects(unsupported.beginUtterance('missing-selector'),/hypothesis selection/);
unsupported.close();

// A close outside the serialized queue must fence an in-flight selector.
let releaseSelection;
const selectionGate=new Promise(resolve=>{releaseSelection=resolve;});
const closing=new context.VoskRecognizer({valuePhrases:values,
    parallelFactory:async()=>new Backend(),contextProvider:async()=>({records,
        selectHypothesis:async candidates=>{await selectionGate;return candidates[0];}})});
const staleEvents=[];
closing.addEventListener('transcript',event=>staleEvents.push(event.detail));
await closing.beginUtterance('closing');
const inflight=closing.accept('closing',new Float32Array([0.1]));
await new Promise(resolve=>setTimeout(resolve,0));
closing.close();releaseSelection();await inflight;
assert.equal(staleEvents.length,0,'closed generation cannot emit a delayed hypothesis');

// begin/audio/final calls can be queued without awaiting begin's model setup.
const immediate=new context.VoskRecognizer({valuePhrases:values,
    parallelFactory:async()=>new Backend(),contextProvider:async()=>({records,
        selectHypothesis:async candidates=>candidates[0]})});
const immediateEvents=[];
immediate.addEventListener('transcript',event=>immediateEvents.push(event.detail));
const start=immediate.beginUtterance('queued');
const audio=immediate.accept('queued',new Float32Array([0.1]));
const end=immediate.finishUtterance('queued');
await Promise.all([start,audio,end]);
assert.equal(immediateEvents.at(-1).isFinal,true,'backend choice happens inside the serialized queue');
immediate.close();

class ProjectedBackend extends Backend {
    snapshot(final) {
        this.finalized ||= final;
        return {final:this.finalized,branches:[...this.registrations].map(([id,stages])=>({
            id,text:stages.map(stage=>stage.phrases[0]).join(' '),enabled:true,precondition_met:true,
            ready:true,start_frame:0,end_frame:20,total_cost:stages.length===1?10:1
        }))};
    }
}
const projectedBackend=new ProjectedBackend();
const projectedEvents=[];
const projected=new context.VoskRecognizer({valuePhrases:values,
    parallelFactory:async()=>projectedBackend,contextProvider:async(id,text)=>({
        records:text==='show log close'?[]:[{pattern:text?'^close$':'^show log$'}],
        parallelPrefix:text==='show log'?'show log':'',
        selectHypothesis:async candidates=>candidates.sort((a,b)=>a.total_cost-b.total_cost)[0]
    })});
projected.addEventListener('transcript',event=>projectedEvents.push(event.detail));
await projected.beginUtterance('projected');
await projected.accept('projected',new Float32Array([0.1]));
assert.deepEqual(projectedEvents.map(event=>event.transcript),['show log','show log close'],
    'newly available context supplies its existing suffix result immediately');
assert.equal(projectedBackend.audio.length,1,'projected successor catches up without waveform resubmission');
await projected.finishUtterance('projected');
assert.equal(projectedEvents.at(-1).transcript,'show log close');
assert(projectedEvents.at(-1).isFinal);
projected.close();
console.log('PASS generic parallel grammar stages, preconditions, selection, audio ordering, finality and stale utterances');
