import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Window} from 'happy-dom';
const window=new Window();
Object.assign(globalThis,{window,document:window.document,Element:window.Element,HTMLElement:window.HTMLElement,
    EventTarget:window.EventTarget,CustomEvent:window.CustomEvent,getComputedStyle:window.getComputedStyle.bind(window),
    requestAnimationFrame:cb=>queueMicrotask(()=>cb(performance.now()))});
globalThis.ParameterParser=Function(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+';return ParameterParser;')();
globalThis.Bench=window.Bench={run(){return true;}};
let source=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8');
source=source.replace('        if (signal?.aborted) {\n            return undefined;\n        }\n\n        return SpeechMenu\n            .#processElement(',
    '        globalThis.probeCount++;\n        if (signal?.aborted) return undefined;\n        return SpeechMenu\n            .#processElement(');
source=source.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;',`
    static async bench(text,indexed) {
        SpeechMenu.#stopped=false;SpeechMenu.#indexedMatching=indexed;
        return SpeechMenu.#planCommandChain({id:1,digestIsFinal:true,valueCollectors:new Map()},text);
    }
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const result=[];
const decoder=document.createElement('textarea');
const appPatterns=[...fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').matchAll(/<[^>]+speech-pattern="([^"]+)"[^>]*>/g)].map(match=>{
    decoder.innerHTML=match[1];const pattern=decoder.value;
    const noun=match[0].match(/speech-noun="([^"]+)"/);
    return {pattern,nouns:noun?.[1]};
});
const workloads=[... [64,256,1024].map(count=>({name:'synthetic',patterns:Array.from({length:count},(_,i)=>`^command task${i} finish$`),text:`command task${count-1} finish`})),
    {name:'app-definitions-all-eligible',patterns:appPatterns,text:'log'}];
for(const workload of workloads) {
    const count=workload.patterns.length;
    document.body.replaceChildren();
    for(let i=0;i<count;i++) {
        const element=document.createElement('speech-command');
        const definition=typeof workload.patterns[i]==='string' ? {pattern:workload.patterns[i]} : workload.patterns[i];
        element.setAttribute('speech-pattern',definition.pattern);
        if(definition.nouns) element.setAttribute('speech-noun',definition.nouns);
        element.setAttribute('speech-function','Bench.run');document.body.append(element);
    }
    const text=workload.text;
    for(const indexed of [false,true]) for(let i=0;i<3;i++) await SpeechMenu.bench(text,indexed);
    const samples={baseline:[],indexed:[]},probes={baseline:0,indexed:0};
    for(let round=0;round<20;round++) {
        // Alternate order to reduce warmup/GC bias.
        for(const indexed of round%2 ? [true,false] : [false,true]) {
            globalThis.probeCount=0;
            const start=performance.now();const plan=await SpeechMenu.bench(text,indexed);const elapsed=performance.now()-start;
            assert.equal(plan.chain.length,1);assert.equal(plan.chain[0].segmentTranscript,text);
            const key=indexed?'indexed':'baseline';samples[key].push(elapsed);probes[key]+=globalThis.probeCount;
        }
    }
    const stats=values=>{values.sort((a,b)=>a-b);return {medianMs:+values[Math.floor(values.length/2)].toFixed(3),p95Ms:+values[Math.ceil(values.length*.95)-1].toFixed(3)};};
    const baseline=stats(samples.baseline),indexed=stats(samples.indexed);
    assert(probes.indexed<probes.baseline,'index must reduce regex/preprocessor probes');
    result.push({workload:workload.name,commands:count,baseline,indexed,speedup:+(baseline.medianMs/indexed.medianMs).toFixed(2),
        baselineProbes:probes.baseline/20,indexedProbes:probes.indexed/20});
}
console.log(JSON.stringify({environment:'Node '+process.version+' / happy-dom; 20 alternating measured plans after warmup',
    scope:'Full chain planning; baseline disables prefix filtering while retaining the same eligibility and collector logic. Recognition/model/audio latency excluded.',results:result},null,2));
