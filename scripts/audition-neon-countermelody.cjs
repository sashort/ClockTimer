// Audition a new synth line over the existing Part I draft; no later-part edits.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const input=process.argv[2],out=process.argv[3];if(!input||!out)throw Error('Pass full draft score and output directory');
const original=JSON.parse(fs.readFileSync(input)),score=structuredClone(original),voice='neon-bright-counter';
score.instruments['neon-backing-pad'].volume=.9;
score.instruments[voice]={class:'expressive',type:'oscillator',displayName:'Bright glassy synth counter-melody',volume:.85,velocitySensitivity:.6,
 waveform:'triangle',partials:[{ratio:1,gain:.65,waveform:'triangle',detune:-3},{ratio:1,gain:.24,waveform:'square',detune:3},{ratio:2,gain:.18,waveform:'sine'},{ratio:3,gain:.045,waveform:'sine'}],
 envelope:{attack:.008,decay:.16,sustain:.42,release:.25},filter:{type:'lowpass',frequency:3800,Q:.65,envelopeAmount:1800},
 chorus:{rate:.55,delay:.016,depth:.0015,wet:.18},delay:{time:.25,feedback:.16,wet:.12},reverb:{wet:.1,decay:1.3}};
// These notes develop Part I's D/A/C/F hook over its original Dm/Bb/F/C harmony.
const figures=[['A5','D6','F5'],['F5','Bb5','A5'],['C6','A5','F5'],['Bb5','G5','E5']];
const added=[];for(let bar=4;bar<56;bar+=2){if(bar>=32&&bar<40)continue;const notes=figures[(bar/2)%4];for(const [index,[beat,length]] of [[2.75,.45],[4,.9],[6.125,.4]].entries()){
 if(index===2&&bar%4===0)continue;const event={offset:String(bar*4+beat),tone:notes[index],length:String(length),instrument:voice,dynamic:index===1?'mf':'mp'};score.song.events.push(event);added.push(event);
}}
score.song.events.sort((a,b)=>Number(a.offset)-Number(b.offset));assert.deepEqual(score.song.events.filter(e=>e.instrument!==voice),original.song.events,'only new melody events added');assert.deepEqual(score.song.events.filter(e=>Number(e.offset)/2>=116),original.song.events.filter(e=>Number(e.offset)/2>=116));
score.audition={...score.audition,backingSound:'louder-warm-pad',counterMelody:voice,themeSource:'Part I original hook and original chord sequence',counterNotes:added.length};fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'countermelody-full-score.json'),JSON.stringify(score,null,2));
const from=8,to=40;score.song.events=score.song.events.filter(e=>Number(e.offset)/2>=from-.025&&Number(e.offset)/2<to).map(e=>({...e,offset:String(Math.max(0,Number(e.offset)-from*2))}));const used=new Set(score.song.events.map(e=>e.instrument));score.instruments=Object.fromEntries(Object.entries(score.instruments).filter(([id])=>used.has(id)));score.song.instrument='neon-bass';score.durationSeconds=36;score.render.seconds=36;score.render.preservePartOneLevel=false;score.partThree={ending:{startSeconds:32,holdSeconds:0}};score.sections=[];fs.writeFileSync(path.join(out,'countermelody-score.json'),JSON.stringify(score,null,2));console.log('PASS new synth melody added; existing notes and approved later sections unchanged');
