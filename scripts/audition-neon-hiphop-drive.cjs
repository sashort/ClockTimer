// Borrow only the original Dark 80s kick/snare/hat; preserve melodic arrangement.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),input=process.argv[2],out=process.argv[3];if(!input||!out)throw Error('Pass input score and audition output');
const original=JSON.parse(fs.readFileSync(input)),score=structuredClone(original),kit=JSON.parse(fs.readFileSync(path.join(root,'api/audio/instruments/dark-eighties-hiphop-kit.json')));
const replaced=new Set(['neon-kick','neon-snare','neon-hat']);score.song.events=score.song.events.filter(e=>!replaced.has(e.instrument));
for(const [part,volume] of [['kick',2.6],['snare',2.2],['hat',1.4]]) {
 const sample=structuredClone(kit.samples[part]);sample.gain=.75/sample.peakAmplitude;
 score.instruments['neon-hiphop-'+part]={class:'expressive',type:'oscillator',displayName:'Dark 80s '+part,volume,velocitySensitivity:.5,envelope:{attack:0,decay:0,sustain:1,release:0},samples:[sample]};
}
const add=(beat,part,dynamic)=>score.song.events.push({offset:String(beat),tone:'C4',length:'.2',instrument:'neon-hiphop-'+part,dynamic});
for(let bar=0;bar<16;bar++){
 for(const beat of [0,1,2,3])add(bar*4+beat,'kick',beat===0?'f':'mf');
 if(bar%2)add(bar*4+3.5,'kick','mp');
 for(const beat of [1,3])add(bar*4+beat,'snare','f');
 for(let step=0;step<16;step++)add(bar*4+step*.25,'hat',['f','mp','mf','p'][step%4]);
}
score.song.events.sort((a,b)=>Number(a.offset)-Number(b.offset));assert.deepEqual(score.song.events.filter(e=>!e.instrument.startsWith('neon-hiphop-')),original.song.events.filter(e=>!replaced.has(e.instrument)),'melody/bass/guitar/pads and existing fills unchanged');
assert(!score.song.events.some(e=>e.instrument.includes('tambourine')));score.audition={...score.audition,percussion:{source:kit.source,parts:['kick','snare','hat'],steadyKick:true,backbeatSnare:true,sixteenthHats:true,existingClapsAndTomFillsPreserved:true}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'hiphop-drive-score.json'),JSON.stringify(score,null,2));console.log('PASS driving hip-hop kick/snare/hat; all melodic material and fills unchanged; no tambourine');
