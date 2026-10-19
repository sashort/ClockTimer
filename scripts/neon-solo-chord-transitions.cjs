// Keep the original backing under the first/last solo chords, then fade its bus.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tests/artifacts/neon-chord-transitions');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const solo=read('tests/artifacts/neon-legato-chord-solo/vintage-chords-score.json');
const source=read('api/audio/instruments/neon-countdown-score.json');
const upper=new Set([...solo.audition.soloVoices,'finale-horror-strings']);
const held=solo.song.events.filter(e=>e.instrument==='vintage-upper-held-strings');
const arrivals=[...new Set(held.map(e=>Number(e.offset)/2))].sort((a,b)=>a-b);
const entry=[arrivals[0],arrivals[1]],exit=[arrivals.at(-1),solo.audition.focusSeconds[1]];
fs.mkdirSync(out,{recursive:true});
if(process.argv[2]!=='mix'){
 const soloEvents=solo.song.events.filter(e=>upper.has(e.instrument));
 const backing=source.song.events.filter(e=>Number(e.offset)/2>=solo.audition.sourceStartSeconds-1e-8&&
  Number(e.offset)/2<solo.audition.sourceStartSeconds+18*4*60/solo.audition.bpm-1e-8&&!upper.has(e.instrument))
  .map(e=>({...e,offset:String(Number(e.offset)-solo.audition.sourceStartSeconds*2)}));
 for(const [name,events,definitions] of [['upper',soloEvents,solo.instruments],['backing',backing,source.instruments]]){
  const used=new Set(events.map(e=>e.instrument));
  const score={...solo,instruments:Object.fromEntries(Object.entries(definitions).filter(([k])=>used.has(k))),
   song:{...solo.song,instrument:events[0].instrument,events},
   ending:{startSeconds:0,holdSeconds:0}};
  fs.writeFileSync(path.join(out,name+'-score.json'),JSON.stringify(score,null,2)+'\n');
 }
 const score=structuredClone(solo);score.audition.entrySeconds=entry;score.audition.exitSeconds=exit;
 score.audition.backingFadeSeconds=entry;score.audition.backingReturnSeconds=exit;
 fs.writeFileSync(path.join(out,'transition-score.json'),JSON.stringify(score,null,2)+'\n');
 console.log({entry,exit});
}else{
 const upperAudio=fs.readFileSync(path.join(out,'upper.wav')),backing=fs.readFileSync(path.join(out,'backing.wav'));
 const upperGain=read('tests/artifacts/neon-chord-transitions/upper-render.json').gain;
 const backingGain=read('tests/artifacts/neon-chord-transitions/backing-render.json').gain;
 const referenceGain=read('tests/artifacts/neon-legato-chord-solo/legato-chords-bell-114-render.json').gain;
 assert.equal(upperAudio.length,backing.length);
 const output=Buffer.from(upperAudio),rate=output.readUInt32LE(24),frames=(output.length-44)/4;
 const ease=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
 const samples=new Float64Array(frames*2);let peak=0;
 for(let i=0;i<frames;i++){
  const t=i/rate,backingLevel=1-ease((t-entry[0])/(entry[1]-entry[0]))+ease((t-exit[0])/(exit[1]-exit[0]));
  for(let c=0;c<2;c++){
   const at=44+i*4+c*2,value=(upperAudio.readInt16LE(at)/upperGain+backing.readInt16LE(at)/backingGain*backingLevel)/32768*referenceGain;
   assert(Number.isFinite(value));samples[i*2+c]=value;peak=Math.max(peak,Math.abs(value));
  }
 }
 const headroom=Math.min(1,.85/peak);
 for(let i=0;i<samples.length;i++)output.writeInt16LE(Math.round(samples[i]*headroom*32767),44+i*2);
 fs.writeFileSync(path.join(out,'chord-transitions-dry.wav'),output);
 console.log({entry,exit,peakBeforeHeadroom:peak,headroomGain:headroom});
}
