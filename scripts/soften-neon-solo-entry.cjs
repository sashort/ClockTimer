// A separately rendered backing stem lets the entrance fade down without
// ducking the held chords, contours or bell. Preserve the approved exit audio.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'tests/artifacts/neon-legato-chord-solo');
const score=JSON.parse(fs.readFileSync(path.join(base,'vintage-chords-score.json'),'utf8'));
const target=path.join(root,'tests/artifacts/neon-smooth-entry');fs.mkdirSync(target,{recursive:true});
const focusStart=score.audition.focusSeconds[0],entryStart=focusStart-8*60/score.audition.bpm;
if(process.argv[2]!=='mix'){
 const allowed=new Set(score.audition.soloVoices);
 const events=score.song.events.filter(e=>!allowed.has(e.instrument)&&Number(e.offset)/2<focusStart);
 const used=new Set(events.map(e=>e.instrument)),stem={...score,title:'Backing entrance stem',
  instruments:Object.fromEntries(Object.entries(score.instruments).filter(([name])=>used.has(name))),
  song:{...score.song,instrument:events[0].instrument,events},
  partThree:{...score.partThree,ending:{startSeconds:focusStart,holdSeconds:0}}};
 fs.writeFileSync(path.join(target,'backing-score.json'),JSON.stringify(stem,null,2)+'\n');
 const processedScore=structuredClone(score);processedScore.audition.entrySeconds=[entryStart,focusStart];
 processedScore.audition.backingFadeSeconds=[entryStart,focusStart];
 fs.writeFileSync(path.join(target,'smooth-entry-score.json'),JSON.stringify(processedScore,null,2)+'\n');
 console.log('Backing entrance fade: '+entryStart+' to '+focusStart+' seconds');
}else{
 const dry=fs.readFileSync(path.join(base,'legato-chords-bell-114.wav')),
  backing=fs.readFileSync(path.join(target,'backing.wav')),
  dryInfo=JSON.parse(fs.readFileSync(path.join(base,'legato-chords-bell-114-render.json'),'utf8')),
  stemInfo=JSON.parse(fs.readFileSync(path.join(target,'backing-render.json'),'utf8'));
 assert.equal(dry.length,backing.length);
 const output=Buffer.from(dry),rate=dry.readUInt32LE(24),ratio=dryInfo.gain/stemInfo.gain;
 const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 let peak=0;
 for(let frame=0;frame<(dry.length-44)/4;frame++){
  const t=frame/rate;
  // Remove progressively more backing. Its stem naturally finishes after entry.
  const removed=ease((t-entryStart)/(focusStart-entryStart));
  if(!removed)continue;
  for(let channel=0;channel<2;channel++){
   const at=44+frame*4+channel*2,value=dry.readInt16LE(at)/32768-backing.readInt16LE(at)/32768*ratio*removed;
   assert(Number.isFinite(value)&&Math.abs(value)<1,'smooth-entry headroom');peak=Math.max(peak,Math.abs(value));
   output.writeInt16LE(Math.round(value*32768),at);
  }
 }
 fs.writeFileSync(path.join(target,'smooth-entry-dry.wav'),output);
 console.log(JSON.stringify({entrySeconds:[entryStart,focusStart],peak,stemGainRatio:ratio}));
}
