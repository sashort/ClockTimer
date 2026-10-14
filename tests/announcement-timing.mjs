import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const catalog=JSON.parse(fs.readFileSync(new URL('../api/audio/catalog.json',import.meta.url),'utf8'));
const engineContext=vm.createContext({document:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>catalog}),console});
vm.runInContext(fs.readFileSync(new URL('../api/audio/AudioEngine.js',import.meta.url),'utf8'),engineContext);
const engine=engineContext.WMOFAudio;
const close=(actual,expected)=>assert(Math.abs(actual-expected)<0.000001,`${actual} ≈ ${expected}`);
for(const rate of [0.8,1,1.2]) {
 const timing=engine.songTiming(catalog.songs['goal-failed'],{toneVelocity:rate});
 assert.equal(timing.noteCount,4);
 close(timing.sustainStartMs,4*60000/(225*rate));
 close(timing.durationMs,8.5*60000/(225*rate));
 close(timing.notes[0].durationMs-timing.notes[0].sustainStartMs,4.5*60000/(225*rate));
}
const parallel=engine.songTiming({bpm:120,events:[{offset:'0',tone:'C2',length:'2'},{offset:'0',tone:'G2',length:'1'},{offset:'3',tone:'C3',length:'1/3'}]});
close(parallel.durationMs,(3+1/3)*500);
assert.equal(parallel.sustainStartMs,null);
for(const song of Object.values(catalog.songs)) {
 const gain=engine.loudnessGain(song);assert(gain>0 && gain<=1);
 if(song.loudness) {
  assert.equal(engine.loudnessGain(song,'other-instrument'),1,'Do not use another instrument’s measurement');
  assert(Math.pow(10,song.loudness.peakDbFS/20)*gain/song.loudness.referenceToneVolume<=0.850001);
 }
 assert.equal(Object.hasOwn(song,'speechStart'),false,'Speech policy must stay outside music');
}
const delayed=engine.songTiming({bpm:120,events:[{offset:"1",tone:"G2\\C2...",length:"1, 2",noteDelayMs:23}]});
assert.equal(delayed.notes[0].offsetMs,523);
assert.equal(delayed.sustainStartMs,1023);
assert.equal(delayed.durationMs,2023);
assert.throws(()=>engine.songTiming({events:[{offset:"0",tone:"C2",noteDelayMs:-1}]}),/Note delay/);
const roll={offset:"3",tone:"[C4 Eb4] ~ [G4 Bb4]",length:"2",rollStep:"1/2",noteDelayMs:17};
const strikes=engine.rollStrikes(roll);
assert.deepEqual(Array.from(strikes,event=>event.tone),["C4","Eb4","G4","Bb4","C4","Eb4","G4","Bb4"]);
assert.deepEqual(Array.from(strikes,event=>event.offset),["3","3","3.5","3.5","4","4","4.5","4.5"]);
assert.equal(engine.songTiming({bpm:120,events:[roll]}).durationMs,2517);
assert.equal(engine.songTiming({bpm:120,events:[roll]}).noteCount,8);
for (const step of ["1/4", "1/8", "1/12"]) {
 const fast=engine.songTiming({bpm:225,events:[{offset:"0",tone:"[G4] ~ [C5]",length:"1",rollStep:step}]});
 const divisor=Number(step.split('/')[1]);
 assert.equal(fast.noteCount,divisor);
 close(fast.notes[1].offsetMs-fast.notes[0].offsetMs,60000/225/divisor);
 close(fast.durationMs,60000/225);
}
assert.throws(()=>engine.rollStrikes({...roll,rollStep:"0"}),/Roll step/);
assert.throws(()=>engine.rollStrikes({...roll,tone:"[] ~ [G4]"}),/Roll notation/);
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
let now=0;const log=[];
const ctx=vm.createContext({queueMicrotask,console,Date:{now:()=>now},ANNOUNCEMENT_SPEECH_PAUSE_AT_1X:300,
 audioAnnouncementOutput:()=>({speechDelayMs:150}),
 waitForAnnouncementDelay:async ms=>{if(ms>0){log.push(['wait',ms]);now+=ms;}}});
vm.runInContext(source.slice(source.indexOf('    const semanticAnnouncementQueue'),source.indexOf('    function waitForAnnouncementDelay'))+
 source.slice(source.indexOf('    function speakSemanticAndWait('),source.indexOf('    function playSemanticSong('))+
 '\nglobalThis.enqueue=runSemanticAnnouncement;globalThis.components=announcementComponents;',ctx);
const audio={startSong:async()=>({hasChime:true,chimeEndsInMs:2282,audibleChimeEndsInMs:9999,sustainStartsInMs:1082,finished:new Promise(()=>{})}),
 speak(text,options){log.push(['speech',text]);options.onEnd();return true;}};
await ctx.enqueue('normal',ctx.components(audio,'song',true,'Normal',{speechDelayMs:150,speechStart:{anchor:'end',paddingMs:20}}));
assert.deepEqual(log,[['wait',2302],['wait',150],['speech','Normal']],'Natural ringing must not postpone speech beyond its musical end and padding');
log.length=0;now+=1000;
await ctx.enqueue('error',ctx.components(audio,'song',true,['Failure','Details'],{speechDelayMs:150,speechStart:{anchor:'sustain'}}));
assert.deepEqual(log,[['wait',1082],['speech','Failure'],['wait',150],['speech','Details']],'Speech starts at sustain; ordinary padding still separates spoken parts');
log.length=0;now+=1000;
await ctx.enqueue('silent-chime',ctx.components(audio,'song',false,'Speech only',{speechDelayMs:150,speechStart:{anchor:'sustain'}}));
assert.deepEqual(log,[['speech','Speech only']],'Muted chimes do not delay speech');
console.log('PASS tempo-scaled timing, parallel notes/rests, tripled sustain, announcement-owned anchors/padding, sustained overlap, muted chimes and bounded loudness balance');
