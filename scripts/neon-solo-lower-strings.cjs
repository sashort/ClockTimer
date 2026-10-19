// Repeated lower-string groups follow the existing five solo chords.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tests/artifacts/neon-chord-transitions');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const score=read(path.join(dir,'transition-score.json'));
const source=read(path.join(root,'api/audio/instruments/neon-countdown-score.json'));
const beat=60/score.audition.bpm,starts=[...new Set(score.song.events.filter(e=>e.instrument==='vintage-upper-held-strings').map(e=>Number(e.offset)/2))].sort((a,b)=>a-b);
if(process.argv[2]!=='mix'){
 const roots=['D2','Bb1','F2','C2','D2'],events=[];
 const existingRun=score.song.events.filter(e=>e.instrument==='finale-string-runs').slice(0,4);
 const runStep=(Number(existingRun[1].offset)-Number(existingRun[0].offset))/2;
 starts.forEach((at,chord)=>{for(let i=0;i<(chord===4?14:16);i++)events.push({instrument:'solo-low-cello',tone:roots[chord],offset:String((at+i*beat/2)*2),length:String(beat*.42*2),dynamic:i%4===0?'f':'mf'});});
 ['E2','F2','G2','A2'].forEach((tone,i)=>events.push({instrument:'solo-cello-contour',tone,
  offset:String((score.audition.exitSeconds[1]-(4-i)*runStep)*2),length:existingRun[i].length,dynamic:'mf',sampleStartSeconds:.12}));
 const cello={...structuredClone(source.instruments['finale-cellos']),displayName:'Low Bowed Cello Pulse',volume:4.8,
  samples:source.instruments['finale-cellos'].samples.map(s=>({...s,naturalDecay:true})),
  envelope:{attack:.012,decay:.05,sustain:.9,release:.065},reverb:{wet:.07,decay:.6}};
 const contour={...structuredClone(cello),samples:cello.samples.map(s=>({...s,naturalDecay:false})),envelope:{attack:.003,decay:.02,sustain:.96,release:.012},reverb:{wet:.025,decay:.35}};
 const stem={...score,render:{...score.render,firstNoteSeconds:starts[0]},instruments:{'solo-low-cello':cello,'solo-cello-contour':contour},song:{...score.song,instrument:'solo-low-cello',events},ending:{startSeconds:starts.at(-1)+8*beat,holdSeconds:0}};
 fs.writeFileSync(path.join(dir,'lower-strings-score.json'),JSON.stringify(stem,null,2)+'\n');
 const layered=structuredClone(score);layered.audition.lowerStringsInSolo=true;
 layered.audition.lowerStringPulse={roots,mixBoostDb:5,naturalRecordedDecay:true,timbre:'recorded bowed cello, low natural register',octaveReinforcement:false,fourthGroupSource:'original finale-pulse C2 / finale-cellos C3',eighthNoteSeconds:beat/2,notesPerOrdinaryChord:16,finalChordRepeatedNotes:14,changesOnlyWithChord:true,finalFourException:{notes:['E2','F2','G2','A2'],direction:'rising',resolvesTo:'Bb2',purpose:'lead into normal accompaniment',subdivision:'sixteenth',stepSeconds:runStep,gateSeconds:Number(existingRun[0].length)/2}};
 layered.instruments['solo-low-cello']=cello;layered.instruments['solo-cello-contour']=contour;layered.song.events.push(...events);
 layered.audition.lowerStringPulse.fadeInSeconds=score.audition.backingFadeSeconds;
 layered.song.events.sort((a,b)=>Number(a.offset)-Number(b.offset));
 fs.writeFileSync(path.join(dir,'lower-transition-score.json'),JSON.stringify(layered,null,2)+'\n');
 console.log({notes:events.length,eighthNoteSeconds:beat/2,groupRoots:roots});
}else{
 const dry=fs.readFileSync(path.join(dir,'chord-transitions-filter.wav')),stem=fs.readFileSync(path.join(dir,'sixteenth-contour-cello.wav'));
 const stemGain=read(path.join(dir,'sixteenth-contour-cello-render.json')).gain;
 const gain=read(path.join(root,'tests/artifacts/neon-legato-chord-solo/legato-chords-bell-114-render.json')).gain;
 const result=Buffer.from(dry);let peak=0;
 const [fadeStart,fadeEnd]=score.audition.backingFadeSeconds;
 const rate=dry.readUInt32LE(24);
 const fadeAt=time=>{const x=Math.min(1,Math.max(0,(time-fadeStart)/(fadeEnd-fadeStart)));return x*x*(3-2*x);};
 assert.equal(dry.length,stem.length);
 for(let at=44;at<dry.length;at+=2){const time=Math.floor((at-44)/4)/rate;
  const value=dry.readInt16LE(at)/32768+stem.readInt16LE(at)/32768/stemGain*gain*10**(5/20)*fadeAt(time);
  assert(Math.abs(value)<1,'lower-string mix retains headroom');peak=Math.max(peak,Math.abs(value));result.writeInt16LE(Math.round(value*32768),at);}
 fs.writeFileSync(path.join(dir,'sixteenth-contour-cello-mix.wav'),result);console.log({peak,fadeInSeconds:[fadeStart,fadeEnd]});
}
