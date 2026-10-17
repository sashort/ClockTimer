// Develop Part I's own hook, leaving the approved later sections untouched.
function arrangePartOne(score,catalog) {
 const {instruments}=score;let events=score.song.events;
 const add=[];
 for(let bar=4;bar<16;bar++) {
  const start=bar*4,end=start+4;
  const verse=events.filter(e=>e.instrument==='neon-lead'&&Number(e.offset)>=start-.05-1e-8&&Number(e.offset)<end-.05-1e-8);
  if(bar%2)verse.forEach((e,i)=>add.push({offset:String(start+[.25,1.25,2.5][i]),tone:e.tone.replace(/\d$/,o=>String(Number(o)-1)),length:String([.7,.7,1.1][i]),instrument:'neon-picked-answer',dynamic:i===1?'mp':'mf'}));
  else {
   const from=(16+(bar-4)%8)*4;
   for(const e of events.filter(e=>e.instrument==='neon-lead'&&Number(e.offset)>=from-.05-1e-8&&Number(e.offset)<from+4-.05-1e-8))add.push({...e,offset:String(Number((Number(e.offset)-from+start).toFixed(6))),dynamic:bar<8?'p':'mp'});
  }
 }
 events=events.filter(e=>{const at=Number(e.offset),bar=Math.floor((at+(e.instrument==='neon-lead'?.05:0)+1e-8)/4);if(bar<4||bar>=16)return true;if(e.instrument==='neon-lead')return false;if(bar%2&&e.instrument==='neon-picked-electric')return false;if(bar%2&&e.instrument==='neon-arp')return Math.round((at-bar*4)*2)%2===0;return true;});events.push(...add);
 instruments['neon-bass']={...structuredClone(catalog.instruments['cinematic-pulse-bass']),volume:.6,envelope:{...catalog.instruments['cinematic-pulse-bass'].envelope,decay:.3,sustain:.8,release:.18}};
 instruments['neon-backing-pad'].volume=.9;
 const guitar={...structuredClone(instruments['neon-picked-electric']),displayName:'Sustained Electric Guitar',samples:[{url:'api/audio/samples/neon-electric-amp-d3.wav',rootFrequency:146.8323839587038},{url:'api/audio/samples/neon-electric-amp-d4.wav',rootFrequency:293.6647679174076}],envelope:{attack:.012,decay:.18,sustain:.82,release:.35},filter:{type:'lowpass',frequency:3300,Q:.5}};
 instruments['neon-picked-electric']=guitar;instruments['neon-picked-answer']={...structuredClone(guitar),volume:.36};
 const keys=require('../api/audio/instruments/neon-approved-part-one-sounds.json');
 instruments['neon-heavy-keys']=structuredClone(keys.keyboard);
 const figures=[['A4','D5','F4'],['F4','Bb4','A4'],['C5','A4','F4'],['Bb4','G4','E4']];
 for(let bar=4;bar<56;bar+=2){if(bar>=32&&bar<40)continue;const notes=figures[(bar/2)%4];for(const [i,[beat,length]] of [[2.75,.45],[4,.9],[6.125,.4]].entries()){if(i===2&&bar%4===0)continue;events.push({offset:String(bar*4+beat),tone:notes[i],length:String(length),instrument:'neon-heavy-keys',dynamic:i===1?'mf':'mp'});}}
 const bass=events.filter(e=>e.instrument==='neon-bass'),bars=[...new Set(bass.map(e=>Math.floor(Number(e.offset)/4)))].sort((a,b)=>a-b),roots=new Map(bars.map(bar=>[bar,bass.filter(e=>Math.floor(Number(e.offset)/4)===bar).sort((a,b)=>Number(a.offset)-Number(b.offset))[0].tone]));
 events=events.filter(e=>e.instrument!=='neon-bass');
 for(let i=0;i<bars.length;i++){const bar=bars[i],held=bar%4===0&&bars[i+1]===bar+1&&roots.get(bar)===roots.get(bar+1);events.push({offset:String(bar*4),tone:roots.get(bar),length:held?'8':'4',instrument:'neon-bass',dynamic:'mf'});if(held)i++;}
 const kit=require('../api/audio/instruments/dark-eighties-hiphop-kit.json');
 events=events.filter(e=>!['neon-kick','neon-snare','neon-hat'].includes(e.instrument));
 for(const [part,volume] of [['kick',2.6],['snare',2.2],['hat',1.4]]){const sample=structuredClone(kit.samples[part]);sample.gain=.75/sample.peakAmplitude;instruments['neon-hiphop-'+part]={class:'expressive',type:'oscillator',displayName:'Dark 80s '+part,volume,velocitySensitivity:.5,envelope:{attack:0,decay:0,sustain:1,release:0},samples:[sample]};}
 const drum=(beat,part,dynamic)=>events.push({offset:String(beat),tone:'C4',length:'.2',instrument:'neon-hiphop-'+part,dynamic});
 for(let bar=2;bar<56;bar++){for(const beat of [0,1,2,3])drum(bar*4+beat,'kick',beat===0?'f':'mf');if(bar%2)drum(bar*4+3.5,'kick','mp');for(const beat of [1,3])drum(bar*4+beat,'snare','f');for(let step=0;step<16;step++)drum(bar*4+step*.25,'hat',['f','mp','mf','p'][step%4]);}
 events.sort((a,b)=>Number(a.offset)-Number(b.offset));
 return {...score,revision:53,song:{...score.song,events},partOnePulse:{...score.partOnePulse,source:'cinematic-pulse-bass',wholeNoteBeats:4,twoBarBeats:8},partOneBalance:{pulseGain:.6,pickedElectricGain:.25,warmPadGain:.9,originalLayersPreserved:true},partOneInstrumentation:'Original cinematic pulse in whole/two-bar holds, louder warm pads, sustained electric guitar, FM/analogue keys, original hook and Dark 80s kick/snare/sixteenth hats',pickedElectricGuitar:{...score.pickedElectricGuitar,sourceScript:'scripts/synthesize-neon-electric-guitar.cjs',tone:'sustained electric'},partOnePercussion:{source:kit.source,parts:['kick','snare','hat'],beats:'steady kick, backbeat snare, accented sixteenth hat',tambourine:false}};
}
module.exports={arrangePartOne};
