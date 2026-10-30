const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let clips=new Set();
for(const theme of ['default','halloween']){
 const base='api/audio/themes/'+theme+'/';
 const index=JSON.parse(fs.readFileSync(path.join(root,base+'catalog.json'),'utf8'));
 for(const file of Object.values(index.profiles)){
  const profile=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  for(const sound of Object.values(profile.sounds))for(const clip of Object.values(sound.rates)){
   assert(/\.wav$/i.test(clip.url),'Every complete cue uses WAV');
   const file=path.join(root,clip.url);assert(fs.existsSync(file),'Missing WAV: '+clip.url);
   if(clips.has(file))continue;clips.add(file);
   const handle=fs.openSync(file,'r'),header=Buffer.alloc(12);fs.readSync(handle,header);fs.closeSync(handle);
   assert.equal(header.toString('ascii',0,4),'RIFF');assert.equal(header.toString('ascii',8,12),'WAVE');
   assert(fs.statSync(file).size>44,'Empty WAV: '+clip.url);
  }
 }
}
console.log('PASS '+clips.size+' unique WAV files cover both themes, every instrument profile and every supported speed');
