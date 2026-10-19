// Revoice the held strings without changing their timing; keep the original
// four-sixteenth phrase entrances, filling the others with a legato quarter pickup.
const {midi,approach}=require('./string-chord-approach.cjs');
const up=note=>note.replace(/\d$/,octave=>String(Number(octave)+1));
const voicings=[
 [['D4','F4','A4'],['F4','A4','D5'],['A4','D5','F5']],
 [['Bb3','D4','F4'],['D4','F4','Bb4'],['F4','Bb4','D5']],
 [['C4','F4','A4'],['F4','A4','C5'],['A4','C5','F5']],
 [['E4','G4','Bb4'],['G4','Bb4','E5'],['Bb4','E5','G5']]
];
function arrangeFinale({events,instruments,start,stringRuns,violins,strings,runStrings,bells}) {
 const atSeconds=e=>Number(e.offset)/2;
 for(let bar=0;bar<46;bar++) {
  const at=start+bar*2,lower=voicings[Math.floor(bar/2)%4][(Math.floor(bar/8)+bar%2)%3];
  for(const [voice,notes,gate] of [[violins,lower,1.6],[strings,lower.map(up),bar>=40?1.75:2.75]]) {
   const held=events.filter(e=>e.instrument===voice&&atSeconds(e)===at&&Number(e.length)/2===gate);
   held.forEach((event,index)=>{event.tone=notes[index];});
  }
 }
 for(const run of stringRuns.filter(run=>run.bar<46)) {
  const at=start+run.bar*2,previousHeldNotes=[];
  for(const voice of [violins,strings]) {
   const held=events.filter(e=>e.instrument===voice&&Number(e.length)/2>=1.5&&atSeconds(e)<at);
   const last=Math.max(...held.map(e=>Number(e.offset)));
   previousHeldNotes.push(...held.filter(e=>Number(e.offset)===last).map(e=>e.tone));
  }
  const targets=events.filter(e=>[violins,strings].includes(e.instrument)&&atSeconds(e)===at&&Number(e.length)/2>=1.5).map(e=>e.tone).filter(n=>!previousHeldNotes.includes(n));
  const target=targets.reduce((a,b)=>Math.abs(midi(b)-midi(run.previous))<Math.abs(midi(a)-midi(run.previous))?b:a,targets[0]);
  const changed=approach(run.previous,target,{previousDirection:run.direction==='rise'?1:-1});
  for(let i=0;i<4;i++)events.find(e=>e.instrument===runStrings&&atSeconds(e)===run.startSeconds+i*.125).tone=changed.notes[i];
  Object.assign(run,changed,{previousHeldNotes});
 }
 // Bell phrases are independently selected, with explicit auditioned exceptions.
 for(let i=events.length-1;i>=0;i--)if(events[i].instrument===bells)events.splice(i,1);
 const add=(at,tone,length,instrument,dynamic='mf')=>{const e={offset:String(at*2),tone,length:String(length*2),instrument,dynamic};events.push(e);return e;};
 const quarterVoice='finale-quarter-string-lead';
 instruments[quarterVoice]={...structuredClone(instruments[violins]),displayName:'Sustained violin quarter-note lead-in',envelope:{attack:.035,decay:.08,sustain:.95,release:.08},reverb:{wet:.08,decay:1.2}};
 const quarterLeadIns=[],bellPhrases=[];
 for(let bar=4;bar<=48;bar+=2) {
  const at=start+bar*2,lead=at-.5,run=stringRuns.find(r=>r.bar===bar);
  const chord=events.filter(e=>e.instrument===strings&&atSeconds(e)===at&&Number(e.length)/2>=1.5).map(e=>e.tone);
  let pickup,target;
  if(run){pickup=run.notes[0];target=run.target;}
  else {
   target=chord.reduce((a,b)=>midi(a)>midi(b)?a:b);
   const melody=events.filter(e=>[violins,'finale-flute','finale-horns'].includes(e.instrument)&&atSeconds(e)<lead&&Number(e.length)/2!==1.6).sort((a,b)=>Number(a.offset)-Number(b.offset));
   const previous=melody.at(-1)?.tone||'A4';
   pickup=approach(previous,target,{harmonicMinor:bar>=46}).notes.at(-1);
   add(lead,pickup,.455,quarterVoice);
   quarterLeadIns.push({bar,startSeconds:lead,target,pickup});
  }
 }
 // Sparse punctuation at section arrivals, independent of the string melody.
 // Two quarter-note hits form a double accent: lead-in beat, then arrival.
 const accents=[{bar:8,tones:['C5','F4']},{bar:20,tones:['F4']},
  {bar:32,tones:['A4','D4']},{bar:40,tones:['A4']},{bar:48,tones:['D5']}];
 for(const {bar,tones} of accents) {
  const at=start+bar*2;
  if(tones.length===2)add(at-.5,tones[0],.5,bells,'ff');
  add(at,tones.at(-1),.5,bells,'ff');
  bellPhrases.push({bar,atSeconds:at,count:tones.length,role:'section-accent'});
 }
 events.sort((a,b)=>Number(a.offset)-Number(b.offset));
 return {quarterLeadIns,bellPhrases,heldVoicings:voicings};
}
module.exports={arrangeFinale};
