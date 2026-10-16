import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const catalog=read('api/audio/catalog.json');
const preset=read('api/audio/instruments/cinematic-robot-pulse.json');
assert.deepEqual(catalog.instruments['cinematic-robot-pulse'],preset);
assert.deepEqual(preset.envelope,catalog.instruments['cinematic-pulse-bass'].envelope);
assert.equal(preset.samples.length,3);
for(const sample of preset.samples) {
 const wave=fs.readFileSync(new URL('../'+sample.url,import.meta.url));
 assert.equal(wave.toString('ascii',0,4),'RIFF');
 assert.equal(wave.readUInt32LE(24),48000);assert.equal(wave.readUInt16LE(22),1);
 const count=(wave.length-44)/2,at=index=>wave.readInt16LE(44+index*2)/32768;
 const start=Math.round(sample.loopStart*48000),end=Math.round(sample.loopEnd*48000);
 assert(end<count&&start>=0,'loop is inside the sample');
 assert(Math.abs(at(end-1)-at(start))<.08,'loop boundary does not introduce a large jump');
 let power=0,peak=0;
 for(let i=0;i<count;i++){power+=at(i)**2;peak=Math.max(peak,Math.abs(at(i)));}
 assert(power/count>.001&&peak<.73,'audible sample with headroom');
}
const demo=read('api/audio/instruments/cinematic-robot-demo.json');
assert(demo.song.events.filter(e=>Number(e.offset)<8).every(e=>e.instrument==='cinematic-pulse-bass'));
assert(demo.song.events.filter(e=>Number(e.offset)>=8).every(e=>e.instrument==='cinematic-robot-pulse'));
const score=read('api/audio/instruments/neon-countdown-score.json');
assert.equal(score.partOnePulse.source,'cinematic-robot-pulse');
assert(score.song.events.filter(e=>Number(e.offset)>=240).every(e=>!score.partOnePulse.instruments.includes(e.instrument)),'robot preset stays in Part I');
console.log('PASS robot preset identity, pulse envelope, multisample bounds/headroom, loop joins and isolated A/B audition');
