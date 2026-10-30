import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let requests=0,decodes=0,fail=false;
const scope=vm.createContext({console,document:{addEventListener(){}},fetch:async url=>{
 if(!['shared.wav','retry.wav'].includes(String(url)))return{ok:true,json:async()=>({instruments:{tone:{waveform:'sine'}},songs:{}})};
 requests++;return{ok:!fail,arrayBuffer:async()=>new ArrayBuffer(8)};
}});
vm.runInContext(fs.readFileSync(new URL('../api/audio/AudioEngine.js',import.meta.url),'utf8'),scope);
const {ExpressiveInstrument}=scope.WMOFInstrumentClasses,context={decodeAudioData:async()=>{decodes++;await Promise.resolve();return{duration:2};}},definition={samples:[{url:'shared.wav',rootFrequency:440}]};
const a=new ExpressiveInstrument(definition),b=new ExpressiveInstrument({...definition});
await Promise.all([a.prepare(context),a.prepare(context),b.prepare(context),scope.WMOFAudio.loadSample(context,'shared.wav')]);
assert.equal(requests,1);assert.equal(decodes,1,'warmup and concurrent instrument definitions share one decode');
await b.prepare(context);assert.equal(requests,1,'repeat playback is cached');
await new ExpressiveInstrument(definition).prepare({decodeAudioData:async()=>{decodes++;return{duration:2};}});assert.equal(decodes,2,'contexts own separate buffer pools');
fail=true;await assert.rejects(scope.WMOFAudio.loadSample(context,'retry.wav'));fail=false;await scope.WMOFAudio.loadSample(context,'retry.wav');assert.equal(decodes,3,'failed loads can retry');
console.log('PASS concurrent sample warmup/decode deduplication, repeat cache reuse, context isolation and failed-load retry');
