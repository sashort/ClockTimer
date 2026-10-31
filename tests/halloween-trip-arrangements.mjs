import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const source=read('api/audio/instruments/neon-countdown-score.json'),theme=read('api/audio/halloween.json');
const start=theme.songs['trip-started'],end=theme.songs['trip-ended'];
const strings=source.song.events.filter(e=>e.instrument==='finale-opening-horror-strings');
const first=Math.min(...strings.map(e=>Number(e.offset)));
const chord=strings.filter(e=>Number(e.offset)===first).map(e=>({...e,offset:'0',instrument:'halloween-score-'+e.instrument}));
assert.deepEqual(start.events,chord,'Start contains exactly the first original string chord, with original gates');
assert.equal(start.seasonalSpeechStartSeconds,1,'speech begins one second into the natural chord decay');
assert.equal(start.seasonalSpeechStartBeat,undefined);
const onsets=[...new Set(source.song.events.map(e=>Number(e.offset)))].sort((a,b)=>a-b).slice(-5),cut=onsets[0];
assert.deepEqual(end.events,source.song.events.filter(e=>Number(e.offset)>=cut).map(e=>({...e,offset:String(Number(e.offset)-cut),instrument:'halloween-score-'+e.instrument})),'End is exactly the former Start arrangement');
const plan=read('api/audio/wav/render-plan.json');
for(const job of plan.jobs.filter(j=>j.theme==='halloween'&&j.name==='trip-started')){
 assert.deepEqual(job.score.events,chord,'all speeds retain the same opening chord');
 assert.equal(job.score.seasonalSpeechStartSeconds,1,'speech delay remains one second at every speed');
 for(const e of job.score.events)assert.deepEqual(job.instruments[e.instrument],source.instruments['finale-opening-horror-strings'],'original string timbre and release preserved');
}
const bell=theme.songs['keypad-open'];assert.equal(bell.events.length,1);assert.equal(bell.events[0].tone,'D4');
assert.deepEqual(theme.instruments[bell.instrument],source.instruments['finale-bells'],'keypad opening uses the approved Part 2/3 bell voice');
assert(theme.instruments[bell.instrument].samples.every(s=>s.naturalDecay),'bell rings out without a written gate truncating it');
console.log('PASS single original opening chord, one-second speech marker, full string release, former-start End cue and natural keypad bell');

