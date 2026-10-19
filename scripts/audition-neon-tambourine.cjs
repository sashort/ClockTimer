// Light Part I tambourine audition using retained CC0 VCSL shake recordings.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),input=process.argv[2],out=process.argv[3];if(!input||!out)throw Error('Pass input score and audition directory');
const original=JSON.parse(fs.readFileSync(input)),score=structuredClone(original);
const library=JSON.parse(fs.readFileSync(path.join(root,'api/audio/instruments/neon-orchestra-samples.json')));
const voice='neon-tambourine';score.instruments[voice]={class:'expressive',type:'oscillator',displayName:'Light tambourine',volume:.26,velocitySensitivity:.5,
 envelope:{attack:0,decay:0,sustain:1,release:0},samples:library.groups.tambourine.map(sample=>({...structuredClone(sample),naturalDecay:true,gain:.5/sample.peakAmplitude})),reverb:{wet:.045,decay:.55}};
let hits=0;for(let bar=0;bar<16;bar++){
 const fuller=bar>=12,positions=fuller?Array.from({length:8},(_,i)=>i*.5):[1,3];
 for(const position of positions){score.song.events.push({offset:String(bar*4+position),tone:'C4',length:'.12',instrument:voice,dynamic:fuller?([1,3].includes(position)?'mf':Number.isInteger(position)?'mp':'p'):'mp'});hits++;}
}
score.song.events.sort((a,b)=>Number(a.offset)-Number(b.offset));assert.deepEqual(score.song.events.filter(e=>e.instrument!==voice),original.song.events);for(const [id,i] of Object.entries(original.instruments))assert.deepEqual(score.instruments[id],i);
score.audition={...score.audition,tambourine:{instrument:voice,hits,verseBeats:[1,3],fullerEighthShakes:true,fullerAtClipSeconds:24,partThreeUnchanged:true}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'tambourine-score.json'),JSON.stringify(score,null,2));console.log('PASS tambourine added only; existing arrangement and instrument levels unchanged');
