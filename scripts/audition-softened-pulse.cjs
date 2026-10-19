const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'tests/artifacts/softened-pulse'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'api/audio/catalog.json'),'utf8'));
const bpm=114,beat=60/bpm,phrase=16*beat,events=[];
for(const [index,instrument] of ['cinematic-pulse-bass','cinematic-pulse-softened'].entries()){
 for(let bar=0;bar<4;bar++)for(const [position,note,length] of [[0,bar===1?'Bb1':'D2',.7],[1.25,'A2',.5],[2,'D2',.7],[3,'D3',.8]])
  events.push({offset:String((index*phrase+(bar*4+position)*beat)*2),tone:note,length:String(length*beat*2),instrument,dynamic:'mf'});
}
const seconds=Math.ceil(phrase*2+2),score={title:'Cinematic pulse / Original cinematic pulse with softened buzz',key:'D minor',revision:1,durationSeconds:seconds,
 instruments:Object.fromEntries(['cinematic-pulse-bass','cinematic-pulse-softened'].map(name=>[name,catalog.instruments[name]])),
 song:{bpm:120,instrument:'cinematic-pulse-bass',events},partTwo:{startSeconds:phrase},partThree:{startSeconds:phrase,bpm,ending:{startSeconds:phrase*2,holdSeconds:0}},
 sections:[['Original pulse',0,phrase],['Softened original pulse',phrase,seconds]],
 render:{seconds,sampleRate:48000,channels:2,fadeOutSeconds:.035,peakTarget:.85,preservePartOneLevel:false}};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'softened-pulse-score.json'),JSON.stringify(score,null,2)+'\n');console.log('Original then softened: switch at '+phrase+' seconds');
