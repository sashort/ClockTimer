import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../api/audio/catalog.json',import.meta.url),'utf8'));
const runtimeSong=catalog.songs['chime-easter-egg'];
const song={...runtimeSong,instrument:'cinematic-pulse-bass',events:runtimeSong.scoreEvents};
const beats=value=>{const parts=String(value).split('/');return Number(parts[0])/(parts.length===2?Number(parts[1]):1);};
const opening=song.events.filter(event=>beats(event.offset)<32 && event.instrument==='easter-egg-steady-beat' && !event.octaveCompanion);
assert(song.events.filter(event=>beats(event.offset)<24).every(event=>event.instrument==='easter-egg-steady-beat'),'First three groups are solo');
assert.equal(opening.length,32,'The opening has precisely 32 opening beat strikes');
assert(opening.every(event=>event.instrument==='easter-egg-steady-beat'));
for(let group=0;group<4;group++) {
 const notes=opening.slice(group*8,group*8+8);
 assert.equal(new Set(notes.map(note=>note.tone)).size,1,'Each group holds one pitch');
 assert.equal(notes[0].tone,['G2','Eb2','F2','G3'][group]);
 assert.deepEqual(notes.map(note=>beats(note.offset)),Array.from({length:8},(_,i)=>group*8+i),'Exact steady spacing');
 assert(notes.every(note=>note.dynamic===(group===0?'f':'p')),'Beat drops after first eight strikes');
}
for(const stage of song.arrangement.stages) {
 const first=Math.min(...song.events.filter(event=>(event.instrument||song.instrument)===stage.voice).map(event=>beats(event.offset)));
 assert.equal(first,stage.beat,'Layer entrance: '+stage.voice);
}
assert.equal(song.arrangement.mainStartsAtBeat,56);
assert(song.events.every(event=>!/(flute|tuba|steel)/.test(event.instrument||'')));
const final=song.events.filter(event=>beats(event.offset)===song.arrangement.endingStartsAtBeat);
assert(final.some(event=>event.tone==='C2' && event.instrument==='easter-egg-pulse-lead'));
assert(final.every(event=>beats(event.length)===8 && event.dynamic.endsWith('ppp')),'Resolution sustains and tapers');

const pulse=song.events.filter(event=>event.instrument==='easter-egg-steady-beat');
const primary=pulse.filter(event=>!event.octaveCompanion && beats(event.offset)>=24);
assert.equal(pulse.filter(event=>event.octaveCompanion).length,primary.length,'One companion for every pulse after group four');
for(const event of primary) {
 const partner=pulse.find(other=>other.octaveCompanion && other.offset===event.offset);
 assert(partner,'Octave companion follows pulse');
 const pitch=event.tone.match(/^([A-G][b#]?)(\d)$/),other=partner.tone.match(/^([A-G][b#]?)(\d)$/);
 assert.equal(pitch[1],other[1],'Both notes rise and fall together');
 assert.equal(Math.abs(Number(pitch[2])-Number(other[2])),1,'Exactly one octave apart');
 assert.equal(partner.length,event.length);assert.equal(partner.dynamic,event.dynamic);
}
assert(!pulse.some(event=>event.octaveCompanion && beats(event.offset)<24),'First three groups remain solo');

console.log('PASS octave-paired pulse,  four repeated-pitch groups, exact steady spacing, drop after beat eight, staged entrances, driving-beat melody and resolving outro');

// Only the final pitch slide remains.
const slides=song.events.filter(event=>event.instrument==='easter-egg-featured-slides');
assert.equal(slides.length,1);assert.equal(beats(slides[0].offset),208);
assert.equal(slides[0].tone,'G3\\C3...');
console.log('PASS only the final slide remains');

// Melody now uses the driving beat timbre.
const pulseLead={...catalog.instruments['easter-egg-pulse-lead']};const beatSound={...catalog.instruments['easter-egg-steady-beat']};delete pulseLead.displayName;delete beatSound.displayName;const leadEnvelope=pulseLead.envelope;delete pulseLead.envelope;delete beatSound.envelope;assert(pulseLead.volume>beatSound.volume);delete pulseLead.volume;delete beatSound.volume;assert.deepEqual(pulseLead,beatSound);assert(leadEnvelope.release>=0.9);assert.equal(catalog.instruments['easter-egg-steady-beat'].envelope.release,0.28);assert(song.events.filter(event=>event.instrument==='easter-egg-pulse-lead').length>0);assert(!song.events.some(event=>event.instrument==='jx3p-inspired-trumpet'||event.instrument==='easter-egg-lead-shawm'));console.log('PASS melody uses driving-beat sound');

assert(song.events.filter(event=>event.instrument==='easter-egg-pulse-lead').every(event=>/[A-G][b#]?2$/.test(event.tone)||(['157/2','189/2','285/2','317/2'].includes(event.offset)&&event.tone==='C1')),'Melody is in the main driving beat octave');

// Longer gates and release retain the second part's offbeat rhythm.
const groove=song.events.filter(event=>event.instrument==='easter-egg-pulse-lead' && beats(event.offset)<song.arrangement.endingStartsAtBeat);assert(groove.every(event=>event.length==='3/4'));assert(groove.some(event=>beats(event.offset)%1===0.5));assert(groove.filter(event=>beats(event.offset)%1===0.5).every(event=>event.dynamic==='mf'));assert(groove.every(event=>!('noteDelayMs' in event)));console.log('PASS sustained offbeat groove in octave two');

assert.equal(song.arrangement.stages.find(stage=>stage.voice==='cinematic-pulse-bass').beat,32,'Next synth enters exactly eight beats after the fourth group starts');

const enteringSynth=song.events.filter(event=>(event.instrument||song.instrument)==='cinematic-pulse-bass' && beats(event.offset)>=32 && beats(event.offset)<48);
assert.equal(enteringSynth.length,7);assert(enteringSynth.every(event=>event.length===(event.offset==='44'?'4':'3/2')));
assert.deepEqual(enteringSynth.map(event=>beats(event.offset)),[32,34,36,38,40,42,44]);
const busySynth=song.events.filter(event=>(event.instrument||song.instrument)==='cinematic-pulse-bass' && beats(event.offset)>=48 && beats(event.offset)<56);
assert.equal(busySynth.length,12);assert(busySynth.every(event=>event.length==='1/2'));assert(busySynth.some(event=>beats(event.offset)%1===0.5));
console.log('PASS second intro group holds third G through removed final Eb slot, then busy rhythm');

const phrase=song.arrangement.recordedPhrase;
assert.deepEqual(phrase.starts,['151/2','183/2','279/2','311/2']);
for(const start of phrase.starts) {
 const notes=song.events.filter(event=>phrase.profiles.includes(event.instrument)&&beats(event.offset)>=beats(start)&&beats(event.offset)<=beats(start)+3);
 assert.equal(notes.length,4);assert.deepEqual(notes.map(event=>event.tone),['G2','F2','Eb2','C2']);
 assert.deepEqual(notes.map(event=>beats(event.offset)-beats(start)),[0,1.5,2.5,3]);
 assert.deepEqual(notes.map(event=>event.length),['5/4','1/3','1/3','1']);
 for(let i=0;i<notes.length;i++) {
  const profile=catalog.instruments[notes[i].instrument];assert.equal(profile.envelope.attack,0.012);assert(!profile.delay&&!profile.reverb);
  assert.deepEqual(profile.partials,catalog.instruments['easter-egg-pulse-lead'].partials);
  if(i<3)assert((beats(notes[i].offset)+beats(notes[i].length))*60/song.bpm+profile.envelope.release<beats(notes[i+1].offset)*60/song.bpm,'Clean releases preserve the next attack');
 }
}
console.log('PASS accepted recorded rhythm and clean articulation across four repetitions');

assert.equal(song.arrangement.percussionLayerStartsAtBeat,song.arrangement.stages.find(stage=>stage.voice==='easter-egg-pulse-lead').beat);const hiphop=song.events.filter(event=>/^easter-egg-hiphop-/.test(event.instrument||''));assert(hiphop.length>0);assert(hiphop.every(event=>beats(event.offset)>=48 && beats(event.offset)<song.arrangement.endingStartsAtBeat));assert(hiphop.some(event=>event.noteDelayMs===22));console.log('PASS percussion joins second pulse voice and leaves the ending clear');

const lowerDrive=song.events.filter(event=>event.instrument==='easter-egg-low-driving-beat');assert.equal(lowerDrive.length,primary.length);for(const event of primary){const lower=lowerDrive.find(note=>note.offset===event.offset);const fundamental=pulse.find(note=>note.offset===event.offset && /2$/.test(note.tone));assert(lower);assert.equal(lower.tone,fundamental.tone.slice(0,-1)+'1');assert.equal(lower.length,event.length);}console.log('PASS lower octave follows every driving-beat strike');

const render=catalog.instruments[runtimeSong.instrument];assert.equal(runtimeSong.events.length,1);assert.equal(runtimeSong.events[0].tone,'C4');assert.equal(render.samples[0].naturalDecay,true);assert.equal(render.samples[0].rootFrequency,261.6255653005986);
const wav=fs.readFileSync(new URL('../'+render.samples[0].url,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),48000);assert.equal((wav.length-44)/96000,66);
assert.equal((await import('node:crypto')).createHash('sha256').update(wav).digest('hex'),runtimeSong.approvedMix.sha256,'Deploy the exact approved WAV');console.log('PASS exact approved mix, natural-decay sample, full duration and preserved editable score');

const songOptions=JSON.parse(fs.readFileSync(new URL('../lang/en-US/associations.json',import.meta.url),'utf8')).selects['af44f0e0-01a0-57a7-9b13-d56b283ac0b8'];
assert(songOptions.some(option=>option.value==='chime-easter-egg'),'The approved song must be selectable in the generated main page');
assert.match(fs.readFileSync(new URL('../order-filler.html',import.meta.url),'utf8'), /id="easterEggMenuButton" href="api\/audio\/easter-eggs\/"/,'Easter Eggs links directly to native playback');
