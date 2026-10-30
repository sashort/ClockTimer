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

context.WMOFHalloweenAudio={isActive:()=>true,catalogForSong:async base=>({...base,songs:{...base.songs,cue:{...base.songs.cue,seasonalGain:.9,seasonalSpeechStartSeconds:2}}})};
let song=await audio.startSong('cue',{useSelectedInstrument:true});
assert(song.hasChime);assert(Math.abs(song.speechStartsInMs-2015)<1e-6,'speech mark follows actual scheduled audio start');
audio.stopSeasonalSongs();assert.equal((await song.finished).reason,'stopped');
context.WMOFHalloweenAudio.isActive=()=>false;
song=await audio.startSong('cue');assert.equal(song.speechStartsInMs,null,'default songs have no seasonal speech override');
const scheduledStops=stops.length;audio.stopSeasonalSongs();assert.equal(stops.length,scheduledStops,'theme cancellation leaves ordinary playback alone');song.stop();
console.log('PASS real AudioEngine seasonal speech timing and isolated cancellation; ordinary audio unchanged');
