const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const out=process.argv[2]||path.join(root,'api/audio/samples');
const score=JSON.parse(fs.readFileSync(process.argv[3]||path.join(root,'api/audio/instruments/neon-countdown-score.json'),'utf8'));
const outputName=process.argv[4]||'neon-countdown';
const seconds=score.render.seconds,renderSeconds=seconds+4,fadeSeconds=score.render.fadeOutSeconds;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'api/audio/catalog.json'),'utf8'));
Object.assign(catalog.instruments,score.instruments);
catalog.songs['neon-countdown-score']=score.song;
const sampleFiles=Object.fromEntries(Object.values(score.instruments).flatMap(i=>i.samples||[]).map(sample=>[sample.url,fs.readFileSync(path.join(root,sample.url)).toString('base64')]));
const source=fs.readFileSync(path.join(root,'api/audio/AudioEngine.js'),'utf8');
fs.mkdirSync(out,{recursive:true});
const scratch=path.join(out,'neon-render-profile-'+Date.now());
const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-pipe','--user-data-dir='+scratch,'about:blank'],
 {windowsHide:true,stdio:['ignore','ignore','ignore','pipe','pipe']});
let sessionId,nextId=0,buffer='';const pending=new Map();
child.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\0'))>=0){const m=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(m.id){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out '+method));},600000);pending.set(id,{resolve,reject,timer});child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId&&!method.startsWith('Target.')&&!method.startsWith('Browser.')?{sessionId}:{})})+'\0');});
(async()=>{try{
 const targets=await call('Target.getTargets');sessionId=(await call('Target.attachToTarget',{targetId:targets.targetInfos.find(t=>t.type==='page').targetId,flatten:true})).sessionId;
 // Transfer recordings individually to keep each DevTools message bounded.
 await call('Runtime.evaluate',{expression:'globalThis.neonSampleFiles={};'});
 for(const [url,data] of Object.entries(sampleFiles)){
  const result=await call('Runtime.evaluate',{expression:`globalThis.neonSampleFiles[${JSON.stringify(url)}]=${JSON.stringify(data)};void 0;`});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 }
 const expression=`(async()=>{
 const catalog=${JSON.stringify(catalog)},sampleFiles=globalThis.neonSampleFiles;
 globalThis.fetch=async url=>sampleFiles[url]?({ok:true,arrayBuffer:async()=>Uint8Array.from(atob(sampleFiles[url]),c=>c.charCodeAt(0)).buffer}):({ok:true,json:async()=>catalog});
 let context;const timers=new Map();let timerId=0;
 globalThis.setTimeout=(callback,ms=0)=>{const id=++timerId;timers.set(id,{at:(context?.currentTime||0)+ms/1000,callback});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.AudioContext=class extends OfflineAudioContext{constructor(){super(2,48000*${renderSeconds},48000);context=this;}resume(){return Promise.resolve();}};
 ${source}\n
 await WMOFAudio.startSong('neon-countdown-score',{toneVolume:.15,useSelectedInstrument:false,includeSpeech:false,normalizeLoudness:false});
 // Drive scheduling and cleanup from offline audio time. Otherwise thousands of expired
 // effects remain connected until the end of a long render.
 for(let at=.25;at<${renderSeconds};at+=.25){context.suspend(at).then(()=>{
  const due=Array.from(timers).filter(([,timer])=>timer.at<=context.currentTime+.003);
  for(const [id,timer] of due){if(timers.delete(id))timer.callback();}
  OfflineAudioContext.prototype.resume.call(context);
 });}
 globalThis.renderedNeon=await context.startRendering();
 return {channels:renderedNeon.numberOfChannels,frames:renderedNeon.length};})()`;
 const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 const channels=[];
 for(let channel=0;channel<2;channel++){
  const parts=[];
  for(let offset=0;offset<48000*seconds;offset+=48000*10){
   const expression=`(()=>{const samples=renderedNeon.getChannelData(${channel}).subarray(${offset+720},${Math.min(offset+48000*10,48000*seconds)+720});const bytes=new Uint8Array(samples.buffer,samples.byteOffset,samples.byteLength);let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(data);})()`;
   const result=await call('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));parts.push(Buffer.from(result.result.value,'base64'));
  }
  const bytes=Buffer.concat(parts);channels.push(new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
 }
 assert(channels.every(c=>c.length===48000*seconds&&c.every(Number.isFinite)),'finite stereo full-length render');
 let rawPeak=0;for(const channel of channels)for(const sample of channel)rawPeak=Math.max(rawPeak,Math.abs(sample));assert(rawPeak>.001,'audible output');
 const gain=(score.render.peakTarget??.85)/rawPeak,frames=channels[0].length;
 const boundaries=score.render.preservePartOneLevel?[0,score.partTwo?.startSeconds??120,...(score.partThree?[score.partThree.startSeconds]:[]),seconds]:[0,seconds];
 const sectionGains=boundaries.slice(0,-1).map((start,index)=>{
  let peak=0;for(const channel of channels)for(let i=Math.round(start*48000);i<Math.round(boundaries[index+1]*48000);i++)peak=Math.max(peak,Math.abs(channel[i]));
  return {startSeconds:start,endSeconds:boundaries[index+1],gain:(score.render.peakTarget??.85)/peak};
 });
 const partOneGain=sectionGains[0].gain;
 const wav=Buffer.alloc(44+frames*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(192000,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*4,40);
 let peak=0,sum=0;const secondRms=[];
 for(let i=0;i<frames;i++){
  const fade=Math.min(1,i/(48000*.015),(frames-1-i)/(48000*fadeSeconds));
  // Master each musical part independently. A dramatic finale must not reduce
  // earlier parts; smooth gain changes within the quieter side of a boundary.
  const at=i/48000;

  let frameGain=sectionGains.find(section=>at<section.endSeconds)?.gain??gain;
  for(let boundary=1;boundary<sectionGains.length;boundary++) {
   const previous=sectionGains[boundary-1].gain,next=sectionGains[boundary].gain,time=sectionGains[boundary].startSeconds;
   const from=next<previous?time-.04:time,to=next<previous?time:time+.04;
   if(at>=from&&at<to)frameGain=previous+(next-previous)*(at-from)/(to-from);
  }
  let framePower=0;
  for(let c=0;c<2;c++){const sample=channels[c][i]*frameGain*fade;peak=Math.max(peak,Math.abs(sample));framePower+=sample*sample;wav.writeInt16LE(Math.round(sample*32767),44+(i*2+c)*2);}
  sum+=framePower/2;
  if((i+1)%48000===0){secondRms.push(Math.sqrt(sum/48000));sum=0;}
 }
 assert(peak<1,'unclipped');
 fs.writeFileSync(path.join(out,outputName+'.wav'),wav);
 const notes={title:score.title,key:score.key,durationSeconds:seconds,sampleRate:48000,channels:2,peak,rawPeak,gain,partOneGain,sectionGains,secondRms,sections:score.sections,revision:score.revision||1,partTwo:score.partTwo,partThree:score.partThree};
 fs.writeFileSync(path.join(out,outputName+'-render.json'),JSON.stringify(notes,null,2)+'\n');
 const unexpectedQuietSeconds=secondRms.flatMap((x,index)=>{const ending=score.partThree?.ending;return x>.0001||(ending&&index+1>ending.startSeconds+ending.holdSeconds)?[]:[index];});
 assert.deepEqual(unexpectedQuietSeconds,[],'no unintended quiet seconds before the final release');
 console.log(JSON.stringify({...notes,secondRms:undefined}));
 }finally{try{await call('Browser.close');}catch{}child.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
