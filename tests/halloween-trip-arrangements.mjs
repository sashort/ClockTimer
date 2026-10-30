import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const source=read('api/audio/instruments/neon-countdown-score.json'),theme=read('api/audio/halloween.json');
const start=theme.songs['trip-started'],end=theme.songs['trip-ended'];
const pulse=start.events.filter(e=>e.instrument==='halloween-score-finale-pulse'||e.instrument==='halloween-start-held-pulse');
assert.deepEqual(pulse.map(e=>e.tone),['D2','D2','A2','D2']);
assert.equal(Number(pulse[3].offset),start.seasonalSpeechStartBeat,'speech marker is exactly the fourth attack');
const onsets=[...new Set(source.song.events.map(e=>Number(e.offset)))].sort((a,b)=>a-b).slice(-5),cut=onsets[0];
assert.deepEqual(end.events,source.song.events.filter(e=>Number(e.offset)>=cut).map(e=>({...e,offset:String(Number(e.offset)-cut),instrument:'halloween-score-'+e.instrument})),'End is exactly the former Start arrangement');
const plan=read('api/audio/wav/render-plan.json');
for(const job of plan.jobs.filter(j=>j.theme==='halloween'&&j.name==='trip-started')){
 const seconds=60/job.score.bpm/job.speed,sync=job.score.releaseSync;
 const strings=Math.max(...job.score.events.filter(e=>sync.referenceInstruments.includes(e.instrument)).map(e=>(Number(e.offset)+Number(e.length))*seconds+job.instruments[e.instrument].envelope.release));
 const last=job.score.events.find(e=>e.instrument===sync.instrument);
 const pulseEnd=(Number(last.offset)+Number(last.length))*seconds+job.instruments[sync.instrument].envelope.release;
 assert(Math.abs(strings-pulseEnd)<1e-8,'final pulse and strings finish release together at '+job.speed);
 assert(job.instruments[sync.instrument].envelope.release>0.16,'final pulse has an extended release');
}
const bell=theme.songs['keypad-open'];assert.equal(bell.events.length,1);assert.equal(bell.events[0].tone,'D4');
assert.deepEqual(theme.instruments[bell.instrument],source.instruments['finale-bells'],'keypad opening uses the approved Part 2/3 bell voice');
assert(theme.instruments[bell.instrument].samples.every(s=>s.naturalDecay),'bell rings out without a written gate truncating it');
console.log('PASS four-note entry, exact fourth-attack marker, speed-aligned final release, former-start End cue and natural keypad bell');

