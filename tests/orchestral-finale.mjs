import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const score=read('api/audio/instruments/neon-countdown-score.json');
const manifest=read('api/audio/instruments/neon-orchestra-samples.json');
assert.equal(manifest.license,'CC0-1.0');
for(const samples of Object.values(manifest.groups))for(const sample of samples) {
 const bytes=fs.readFileSync(new URL('../'+sample.url,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sample.sha256,'intact recording '+sample.url);
 assert(sample.rootFrequency>0&&sample.durationSeconds>0);
}
assert.equal(score.partThree.bpm,score.song.bpm,'Part III matches Part I');
assert.deepEqual(score.partTwo.tempoChange,{atSeconds:score.partThree.startSeconds,fromBpm:64,toBpm:120,mode:'immediate',sustainedHandoff:true});
assert(!score.partTwo.tempoRamp,'there is no gradual acceleration');
const at=score.partThree.startSeconds,finalAt=score.partThree.ending.startSeconds;
const third=score.song.events.filter(e=>Number(e.offset)/2>=at);
const pulseNames=new Set(['finale-pulse','finale-last-pulse']);
for(const event of third) {
 const voice=score.instruments[event.instrument];
 assert(voice,'known finale voice');
 if(!pulseNames.has(event.instrument)) {
  assert(voice.samples?.length,'everything except cinematic pulse is sampled: '+event.instrument);
  assert(/^[A-G](#|b)?\d$/.test(event.tone),'sample notes use supported ordinary pitches');
 }
 if(voice.orchestraGroup==='pipe-organ')assert.equal(Number(event.offset)/2,finalAt,'organ plays only the final chord');
}
assert(third.filter(e=>e.instrument==='finale-horror-strings').length>30);
assert.equal(score.instruments['finale-horror-strings'].orchestraGroup,'violin-tremolo');
assert(third.some(e=>e.instrument==='finale-horror-strings'&&e.tone==='F6'));
assert.equal(third.filter(e=>e.instrument==='finale-bells').length,score.partThree.bells.strikeCount,'independent authored bell phrases');
assert(score.durationSeconds>=score.partThree.naturalTailEndSeconds,'recorded percussion and bell tails fit');
assert(third.filter(e=>e.instrument==='finale-last-organ').every(e=>Number(e.length)/2===2));
const bridge=score.song.events.filter(e=>score.partTwo.ending.instruments.includes(e.instrument));
assert(bridge.length>0&&bridge.every(e=>Number(e.offset)/2<at&&Number(e.offset)/2+Number(e.length)/2+score.instruments[e.instrument].envelope.release>at),'transition release carries into the tempo switch');
console.log('PASS recorded orchestral assets, cinematic-pulse exception, 120 BPM direct handoff, sustained bridge, audible string arrangement, contour bells and final organ');

assert.equal(score.partThree.percussion.steady,true);
assert.equal(third.filter(e=>e.instrument==='finale-hiphop-hat').length,48*16,'steady sixteenth-note percussion throughout');
for(let bar=0;bar<48;bar++)for(const position of [0,1,2,3])assert(third.some(e=>e.instrument==='finale-hiphop-kick'&&Number(e.offset)/2===at+bar*2+position*.5),'bass drum on each beat');
const pulse=third.filter(e=>e.instrument==='finale-pulse');
for(let bar=0;bar<48;bar++) {
 const notes=pulse.filter(e=>Number(e.offset)/2>=at+bar*2&&Number(e.offset)/2<at+(bar+1)*2);
 const original=bar%2?[.8,.5,.75,.8]:[.65,.45,.65,.75,.38];
 assert.deepEqual(notes.map(e=>Number(e.length)/.5/2),original,'original short pulse rhythm is restored');
}

for(const e of third.filter(e=>Number(e.offset)/2===finalAt&&!['finale-last-organ','finale-hiphop-kick','finale-hiphop-snare','finale-hiphop-clap','finale-bells'].includes(e.instrument)))assert.equal(Number(e.length)/2,1.5,'pitched ensemble holds longer');
console.log('PASS raised orchestra, original short pulse, steady quarter/sixteenth percussion and extended ensemble cadence with unchanged organ gate');

assert.equal(score.partThree.balance.pulseArticulation,'original short pattern');
assert(score.partThree.stringRuns.length>22/2,'most held tremolo chords receive a lead-in');
assert.equal(third.filter(e=>e.instrument==='finale-string-runs').length,score.partThree.stringRuns.length*4,'four-note approaches into held strings');

for(const name of ['finale-hiphop-kick','finale-hiphop-snare','finale-hiphop-hat'])for(const sample of score.instruments[name].samples)assert(Math.abs(sample.gain*sample.peakAmplitude-.75)<1e-9,'quiet percussion recordings receive source level compensation');

assert.equal(score.instruments['finale-bells'].volume,5.2);
assert(third.filter(e=>e.instrument==='finale-bells').every(e=>e.dynamic==='ff'),'foreground bell strikes');

assert.equal(score.partThree.percussion.subdivisionBeats,.25);
assert.deepEqual(third.filter(e=>e.instrument==='finale-hiphop-hat').slice(0,4).map(e=>e.dynamic),['f','mp','mf','p'],'sixteenths have alternating accents');

assert(!score.song.events.some(e=>e.instrument==='finale-tambourine'),'tambourine removed from the arrangement');
assert(!score.song.events.some(e=>e.instrument==='finale-maracas'),'maracas removed');
const kit=read('api/audio/instruments/dark-eighties-hiphop-kit.json');
for(const sample of Object.values(kit.samples))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+sample.url,import.meta.url))).digest('hex'),sample.sha256,'original Dark 80s one-shot retained');
for(const run of score.partThree.stringRuns)assert.equal(run.notes.length,4);
const {midi}=await import('../scripts/string-chord-approach.cjs');
for(const run of score.partThree.stringRuns)for(let i=1;i<4;i++)assert(run.direction==='rise'?midi(run.notes[i])>midi(run.notes[i-1]):midi(run.notes[i])<midi(run.notes[i-1]),'four-note contour agrees with the incoming pitch');
assert(new Set(score.partThree.stringRuns.map(run=>run.direction)).size===2,'both rising and falling chord approaches occur');

assert.equal(score.partThree.stringRuns.find(run=>run.bar===28).previous,'D4','approach follows the horn answer, not the earlier flute call');
for(const run of score.partThree.stringRuns)assert(!run.previousHeldNotes.includes(run.target),'repeated sustained notes have no lead-in');
assert(score.partThree.skippedRepeatedStringChords.length>0,'repeated chords skip the lead-in');
assert.equal(score.instruments['finale-string-runs'].orchestraGroup,'violin-short');
assert.equal(score.instruments['finale-string-runs'].volume,4.8);
assert.equal(score.instruments['finale-hiphop-hat'].volume,1.6);

for(const event of third.filter(e=>e.instrument==='finale-string-runs')){assert.equal(event.sampleStartSeconds,.12,'fast strings begin at the audible bow attack');assert(Number(event.length)/2+score.instruments[event.instrument].envelope.release<.125,'lead-in releases clear before the next sixteenth');}

const openingStrings=third.filter(e=>e.instrument==='finale-opening-horror-strings'&&Number(e.offset)/2===at+.25);
assert.equal(openingStrings.length,2);
assert(openingStrings.every(e=>Number(e.length)/2===.75),'opening strings begin releasing at the original note end');
assert.equal(score.instruments['finale-opening-horror-strings'].envelope.release,1.75,'the extension decays rather than sustaining');
for(const phrase of score.partThree.bellPhrases){const at=phrase.atSeconds;assert(third.some(e=>e.instrument==='finale-bells'&&Number(e.offset)/2===at));if(phrase.count===2)assert(third.some(e=>e.instrument==='finale-bells'&&Number(e.offset)/2===at-.5&&Number(e.length)/2===.5));}
assert.equal(score.partTwo.ending.holdSeconds,5.625,'the sustained handoff has room under the longer opening');

// Audition approved before integration: exact musical events, except the next phrase pickup beyond35.5s.
const fixture=read('tests/fixtures/neon-approved-phrasing.json');
const canonical=es=>es.map(e=>JSON.stringify(e,Object.keys(e).sort())).sort();
const auditionEvents=third.filter(e=>Number(e.offset)/2<at+35.5).map(e=>({...e,offset:String(Number(e.offset)-at*2)}));
assert.deepEqual(canonical(auditionEvents),canonical(fixture),'approved audition retained exactly at the new entrance');
for(const pickup of score.partThree.quarterLeadIns)assert(third.some(e=>e.instrument==='finale-quarter-string-lead'&&Number(e.offset)/2===pickup.startSeconds),'legato quarter pickups fill the original contour gaps');

const slowBeat=60/64,slowGrid=slowBeat/4;
const slowBass=score.song.events.filter(e=>e.instrument==='midnight-pulse').map(e=>Number(e.offset)/2);
const chordStarts=[...new Set(score.song.events.filter(e=>e.instrument==='midnight-pulse-chord'&&Number(e.offset)/2<255).map(e=>Number(e.offset)/2))];
assert.equal(chordStarts.length,8);
for(const t of chordStarts)assert(slowBass.includes(t),'upper pulse chord lands with bass');
for(const e of score.song.events.filter(e=>['midnight-organ','midnight-tubular-bells','midnight-pulse-chord'].includes(e.instrument))){const t=Number(e.offset)/2;assert(Math.abs((t-120)/slowGrid-Math.round((t-120)/slowGrid))<1e-7,'slow-part notes align to grid');if(e.instrument==='midnight-tubular-bells'){const distance=Math.min(...slowBass.map(b=>Math.abs(t-b)));assert(distance<1e-7||distance>slowGrid+1e-7,'no one-sixteenth bell/pulse mismatch');}}
assert.equal(score.partThree.startSeconds,275);
assert.equal(score.partTwo.ending.startSeconds,269.0625);
console.log('PASS approved Part II alignment and weighted handoff');
