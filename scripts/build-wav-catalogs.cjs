// Plan immutable recordings. Instrument definitions are shared; themes own arrangements.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const base=read('api/audio/catalog.json'),halloween=read('api/audio/halloween.json');
const rates=[.8,1,1.2],jobs=new Map();
const clean=v=>JSON.parse(JSON.stringify(v,(k,v)=>['renderedVariants','seasonalPreRendered'].includes(k)?undefined:v));
const definitions={...base.instruments,...halloween.instruments};
for(const key of Object.keys(definitions))if(key.startsWith('halloween-rendered-'))delete definitions[key];
write('api/audio/instruments/library.json',{version:1,instruments:definitions});
const longSongs=new Set(['chime-easter-egg','dark-eighties','neon-countdown','neon-afterglow','chrome-velocity']);
const instruments=Object.entries(base.instruments).filter(([,d])=>d.selectable!==false).map(([id,d])=>({id,label:d.displayName||id}));
const rendererHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'api/audio/AudioEngine.js'),'utf8').replace(/\r\n/g,'\n')).digest('hex');
const sampleHashes=new Map();
function sampleHash(url){if(!sampleHashes.has(url))sampleHashes.set(url,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,url))).digest('hex'));return sampleHashes.get(url);}
for(const theme of ['default','halloween']){
 const scores=clean({...base.songs,...(theme==='halloween'?halloween.songs:{})}),profiles={};
 for(const profile of ['authored',...instruments.map(i=>i.id)]){
  const sounds={};
  for(const [name,score]of Object.entries(scores)){
   if(profile!=='authored'&&(longSongs.has(name)||theme==='halloween'&&(halloween.songs[name]||name==='keypad-open')))continue;
   const selected=profile==='authored'?null:profile;
   const events=score.events.filter(e=>e.tone).map(e=>({...e,...(selected?{instrument:selected}:{})}));
   const instrument=selected||score.instrument;
   const used=[...new Set([instrument,...events.map(e=>e.instrument||instrument)])];
   const defs=Object.fromEntries(used.map(id=>[id,selected?{...definitions[id],...(definitions[id].samples?{samples:definitions[id].samples.map(sample=>({...sample,...(/(?:neon-countdown|easter-egg-approved|dark-eighties-approved)/.test(sample.url)?{naturalDecay:false}:{})}))}:{})}:definitions[id]])),variants={};
   for(const speed of rates){
    let rateDefs=defs;
    if(score.releaseSync){
     const sync=score.releaseSync,seconds=60/score.bpm/speed;
     const referenceEnd=Math.max(...events.filter(e=>sync.referenceInstruments.includes(e.instrument)).map(e=>(Number(e.offset)+Number(e.length))*seconds+defs[e.instrument].envelope.release));
     const heldEnd=Math.max(...events.filter(e=>e.instrument===sync.instrument).map(e=>(Number(e.offset)+Number(e.length))*seconds));
     rateDefs={...defs,[sync.instrument]:{...defs[sync.instrument],envelope:{...defs[sync.instrument].envelope,release:Math.max(.16,referenceEnd-heldEnd)}}};
    }
    const sample=events.length===1&&defs[instrument]?.samples?.length===1&&defs[instrument].samples[0];
    if(profile==='authored'&&sample?.naturalDecay&&/\.wav$/i.test(sample.url)){variants[speed]={url:sample.url,existing:true};continue;}
    const samples=Object.fromEntries(Object.values(rateDefs).flatMap(d=>d.samples||[]).map(s=>[s.url,sampleHash(s.url)]));
    const payload={renderer:rendererHash,bpm:score.bpm,instrument,events,definitions:rateDefs,samples,speed,gain:score.seasonalGain??1};
    const key=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0,24);
    variants[speed]={url:'api/audio/wav/'+key+'.wav',key};
    if(!jobs.has(key))jobs.set(key,{key,theme,name,profile,speed,score:{...score,instrument,events},instruments:rateDefs});
   }
   sounds[name]={bpm:score.bpm,events,rates:variants,speechStartSeconds:score.seasonalSpeechStartSeconds??null,...(score.seasonalSpeechStartBeat!=null?{speechStartBeat:score.seasonalSpeechStartBeat}:{}),loop:!!score.loop};
  }
  const file='api/audio/themes/'+theme+'/profiles/'+profile+'.json';write(file,{version:1,theme,profile,sounds});profiles[profile]=file;
 }
 write('api/audio/themes/'+theme+'/catalog.json',{version:1,theme,format:'audio/wav',rates,instruments,profiles});
}
write('api/audio/wav/render-plan.json',{version:1,rates,jobs:[...jobs.values()]});
console.log(JSON.stringify({themes:2,instruments:instruments.length,uniqueRenders:jobs.size}));
