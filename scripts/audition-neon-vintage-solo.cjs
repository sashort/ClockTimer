// Audition only: five existing upper held chords, contours and sparse bells.
// Backing drops out for the solo and returns afterward; harmony is unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'tests/artifacts/neon-vintage-chords'));
const source=JSON.parse(fs.readFileSync(path.join(root,'api/audio/instruments/neon-countdown-score.json'),'utf8'));
const softened=JSON.parse(fs.readFileSync(path.join(root,'api/audio/instruments/cinematic-pulse-softened.json'),'utf8'));
const bpm=source.partThree.bpm,bar=4*60/bpm,beat=60/bpm,start=source.partThree.startSeconds+12*bar,end=start+18*bar;
const focusStart=4*bar-beat,focusEnd=14*bar;
const selected=source.song.events.filter(e=>Number(e.offset)/2>=start-1e-8&&Number(e.offset)/2<end-1e-8);
const definitions=structuredClone(source.instruments);
definitions['finale-pulse']={...softened,volume:source.instruments['finale-pulse'].volume,envelope:source.instruments['finale-pulse'].envelope};
const soloVoice='vintage-upper-held-strings';
definitions[soloVoice]={...structuredClone(source.instruments['finale-horror-strings']),
 displayName:'Vintage upper held string chords',volume:3.5,
 filter:{type:'lowpass',frequency:6000,Q:.5},
 envelope:{attack:.12,decay:.15,sustain:.95,release:.65},reverb:{wet:.12,decay:1.4}};
const events=[];
for(const original of selected){
 const at=Number(original.offset)/2-start,inside=at>=focusStart-1e-8&&at<focusEnd-1e-8;
 const held=original.instrument==='finale-horror-strings'&&Number(original.length)/2>=1.5;
 const contour=['finale-string-runs','finale-quarter-string-lead'].includes(original.instrument);
 const bell=original.instrument==='finale-bells';
 if(inside&&!held&&!contour&&!bell)continue;
 const event={...original,offset:String(at*2)};
 if(inside&&held){event.instrument=soloVoice;event.length=String((2*bar-.2)*2);}
 // Fade backing notes that could otherwise ring across the first contour.
 if(!inside&&at<focusStart&&!held&&!contour){
  const definition=definitions[event.instrument];
  if(at+Number(event.length)/2+(definition.envelope?.release||0)>focusStart-.18 ||
    definition.samples?.some(sample=>sample.naturalDecay)&&at>focusStart-2){
   const voice='solo-entry-cut-'+event.instrument;
   definitions[voice]??={...structuredClone(definition),envelope:{...definition.envelope,release:.18},
    ...(definition.samples?{samples:definition.samples.map(sample=>({...sample,naturalDecay:false}))}:{}),
    reverb:{...definition.reverb,wet:0},delay:{...definition.delay,wet:0}};
   event.instrument=voice;event.length=String(Math.max(.015,Math.min(Number(event.length)/2,focusStart-at-.18))*2);
  }
 }
 events.push(event);
}
const featured=events.filter(e=>e.instrument===soloVoice);
assert.equal(new Set(featured.map(e=>e.offset)).size,5,'five original upper held chords');
assert(events.filter(e=>Number(e.offset)/2>=focusStart-1e-8&&Number(e.offset)/2<focusEnd-1e-8)
 .every(e=>[soloVoice,'finale-string-runs','finale-quarter-string-lead','finale-bells'].includes(e.instrument)),
 'solo contains only upper held chords, contours and original sparse bells');
assert(featured.every(e=>selected.some(original=>original.tone===e.tone&&Math.abs(Number(original.offset)/2-start-Number(e.offset)/2)<1e-8)),
 'solo preserves existing chord pitches, inversions and onsets');
assert(featured.every(e=>Number(e.length)/2>3.9),'held chords sustain nearly to the next arrival');
const used=new Set(events.map(e=>e.instrument)),instruments=Object.fromEntries(Object.entries(definitions).filter(([name])=>used.has(name)));
const durationSeconds=Math.ceil(18*bar+4),score={title:'Neon Countdown — upper chord solo / original pulse with softened buzz',key:source.key,revision:source.revision,
 durationSeconds,instruments,song:{bpm:120,instrument:events[0].instrument,events},partThree:{startSeconds:0,bpm,ending:{startSeconds:18*bar,holdSeconds:0}},
 sections:[['Existing string chords in vintage focus',0,durationSeconds]],render:{...source.render,seconds:durationSeconds,preservePartOneLevel:false,fadeOutSeconds:.035},
 audition:{bpm,focusBars:10,chordCount:5,chords:['Dm','Bb','F','E diminished','Dm'],sourceStartSeconds:start,entrySeconds:[2*bar,4*bar],focusSeconds:[focusStart,focusEnd],exitSeconds:[14*bar,16*bar],originalEvents:selected.length,soloVoices:[soloVoice,'finale-string-runs','finale-quarter-string-lead','finale-bells'],originalBellAccentsRetained:true,chordGateSeconds:2*bar-.2,chordAttackSeconds:.12,chordReleaseSeconds:.65,processing:'natural recorded strings with mild high-frequency rolloff',heldChordNotes:featured.length,percussionInSolo:false,lowerStringsInSolo:false,harmonyUnchanged:true,newMelody:false,pulseInstrument:'cinematic-pulse-softened'}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'vintage-chords-score.json'),JSON.stringify(score,null,2)+'\n');console.log(JSON.stringify(score.audition));
