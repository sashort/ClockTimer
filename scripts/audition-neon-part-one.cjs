// First Part I experiment. Develop its own existing chorus hook into verse
// calls and picked-guitar answers; leave the approved later parts unchanged.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const out=process.argv[2];if(!out)throw Error('Pass an audition output directory');
const original=JSON.parse(fs.readFileSync(path.join(root,'api/audio/instruments/neon-countdown-score.json')));
const score=structuredClone(original),events=score.song.events;
const voice='neon-picked-answer';
score.instruments[voice]={...structuredClone(score.instruments['neon-picked-electric']),displayName:'Picked guitar melodic answer',volume:.36};
const additions=[];
for(let bar=4;bar<16;bar++) {
 const start=bar*4,end=start+4;
 const verseNotes=events.filter(e=>e.instrument==='neon-lead'&&Number(e.offset)>=start-.05-1e-8&&Number(e.offset)<end-.05-1e-8);
 if(bar%2) {
  const positions=[.25,1.25,2.5],lengths=[.7,.7,1.1];
  verseNotes.forEach((e,index)=>additions.push({offset:String(start+positions[index]),tone:e.tone.replace(/\d$/,o=>String(Number(o)-1)),length:String(lengths[index]),instrument:voice,dynamic:index===1?'mp':'mf'}));
 } else {
  // This is Part I's own chorus phrase, established before the finale existed.
  const sourceStart=(16+(bar-4)%8)*4;
  for(const e of events.filter(e=>e.instrument==='neon-lead'&&Number(e.offset)>=sourceStart-.05-1e-8&&Number(e.offset)<sourceStart+4-.05-1e-8))additions.push({...e,offset:String(Number((Number(e.offset)-sourceStart+start).toFixed(6))),dynamic:bar<8?'p':'mp'});
 }
}
score.song.events=events.filter(e=>{
 const at=Number(e.offset),bar=Math.floor((at+(e.instrument==='neon-lead'?.05:0)+1e-8)/4);
 if(bar<4||bar>=16)return true;
 if(e.instrument==='neon-lead')return false;
 if(bar%2&&e.instrument==='neon-picked-electric')return false;
 if(bar%2&&e.instrument==='neon-arp')return Math.round((at-bar*4)*2)%2===0;
 return true;
});score.song.events.push(...additions);score.song.events.sort((a,b)=>Number(a.offset)-Number(b.offset));
assert.deepEqual(score.song.events.filter(e=>Number(e.offset)/2>=116),original.song.events.filter(e=>Number(e.offset)/2>=116),'approved ending and later parts unchanged');
assert.deepEqual(score.song.events.filter(e=>e.instrument==='neon-bass'),original.song.events.filter(e=>e.instrument==='neon-bass'),'existing pulse rhythm retained');
if(process.argv[3]==='louder-pads') score.instruments['neon-backing-pad'].volume=.9;
if(process.argv[3]==='flute') {
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'api/audio/catalog.json')));
 score.instruments['neon-backing-pad']={...structuredClone(catalog.instruments['breathy-flute']),displayName:'Breathy flute harmony',volume:2.8,envelope:{attack:.12,decay:.24,sustain:.78,release:.45},reverb:{wet:.14,decay:1.5}};
}
score.audition={backingSound:process.argv[3]==='flute'?'breathy-flute':process.argv[3]==='louder-pads'?'louder-warm-pad':'warm-pad',checkpoint:'fde67340',part:1,themeSource:'existing Part I chorus hook',experiment:'fuller melodic calls, picked guitar answers, thinner answering arpeggio',changedSeconds:[8,32],laterPartsUnchanged:true};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'part-one-draft-full-score.json'),JSON.stringify(score,null,2));
const from=8,to=40;score.song.events=score.song.events.filter(e=>Number(e.offset)/2>=from-.025&&Number(e.offset)/2<to).map(e=>({...e,offset:String(Math.max(0,Number(e.offset)-from*2))}));
const used=new Set(score.song.events.map(e=>e.instrument));score.instruments=Object.fromEntries(Object.entries(score.instruments).filter(([id])=>used.has(id)));score.song.instrument='neon-bass';score.durationSeconds=36;score.render.seconds=36;score.render.preservePartOneLevel=false;score.partThree={ending:{startSeconds:32,holdSeconds:0}};score.sections=[];
fs.writeFileSync(path.join(out,'part-one-call-answer-score.json'),JSON.stringify(score,null,2));
console.log('PASS original Part I hook developed; approved later parts and pulse rhythm unchanged');
