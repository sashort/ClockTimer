import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now=1000;
const starts=[],stops=[];
const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const node=()=>({gain:param(),frequency:param(),detune:param(),connect(){},disconnect(){},addEventListener(){}});
class AudioContext {
 currentTime=10;state='running';sampleRate=8000;destination=node();
 getOutputTimestamp(){return {contextTime:9.8,performanceTime:900};}
 createGain(){return node();}
 createBuffer(channels,length){return {getChannelData(){return new Float32Array(length);}};}
 createOscillator(){return {...node(),start(at){starts.push(at);},stop(at){stops.push(at);}};}
}
const catalog={instruments:{tone:{type:'oscillator',waveform:'sine',envelope:{attack:0,decay:0,sustain:1,release:0}}},
 songs:{cue:{bpm:300,instrument:'tone',events:[{offset:'0',tone:'D5',length:'1'}]}}};
const context=vm.createContext({AudioContext,performance:{now:()=>now},document:{addEventListener(){}},console,
 fetch:async()=>({ok:true,json:async()=>catalog}),setTimeout:()=>1,clearTimeout(){}});
vm.runInContext(fs.readFileSync(new URL('../api/audio/AudioEngine.js',import.meta.url),'utf8'),context);
const audio=context.WMOFAudio;
let song=await audio.startSong('cue',{startAtPerformanceMs:2000});
assert.equal(starts.length,1);
assert(Math.abs(starts[0]-10.9)<1e-9,'performance deadline maps through the output timestamp into Web Audio time');
song.stop();assert.equal((await song.finished).reason,'stopped','the future note remains cancellable');
now=1980;
assert.equal(await audio.startSong('cue',{startAtPerformanceMs:2000}),null,'late audio setup refuses to sound a stale cue');
assert.equal(starts.length,1,'a missed deadline schedules no oscillator');
await assert.rejects(audio.startSong('cue',{startAtPerformanceMs:NaN}),/performance timestamp/);
now=1000;AudioContext.prototype.getOutputTimestamp=undefined;
song=await audio.startSong('cue',{startAtPerformanceMs:2000});
assert(Math.abs(starts.at(-1)-11)<1e-9,'unsupported output timestamps use current audio/performance clocks');song.stop();
song=await audio.startSong('cue');
assert(Math.abs(starts.at(-1)-10.015)<1e-9,'ordinary songs retain their existing immediate-start behavior');song.stop();
console.log('PASS scheduled output-clock attack, fallback mapping, missed-deadline silence, cancellation and unchanged ordinary playback');
