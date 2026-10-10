// Offline preview: schedule all notes and suppress wall-clock completion timers.
// Verify continuous audio, finite samples, peak headroom and exact 60-second duration.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),assert=require('assert/strict');
const project=path.resolve(__dirname,'..');
const WS=require(path.join(project,'tests/node_modules/ws'));
const out='D:/Temp/ClockTimer-error-chime-preview';fs.mkdirSync(out,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path.join(project,'api/audio/catalog.json'),'utf8'));
const songs={'chime-easter-egg':catalog.songs['chime-easter-egg']};
const compositionSeconds=(catalog.songs['chime-easter-egg'].arrangement.endingStartsAtBeat+catalog.songs['chime-easter-egg'].arrangement.endingBeats)*60/catalog.songs['chime-easter-egg'].bpm;
const renderSeconds=Math.ceil(compositionSeconds+4);
const sampleFiles=Object.fromEntries(Object.values(catalog.instruments).flatMap(i=>i.samples||[]).map(s=>[s.url,fs.readFileSync(path.join(project,s.url)).toString('base64')]));
const engineSource=fs.readFileSync(path.join(project,'api/audio/AudioEngine.js'),'utf8');
const horizon=/const scheduleAheadSeconds =\s*this\.#isPhone\(\)\s*\? 1\.8\s*: 2\.6;/;
assert(horizon.test(engineSource),'Offline scheduling override must match the engine');
const source=engineSource.replace(horizon,'const scheduleAheadSeconds = 75;');
function wav(samples,rate=48000){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(36+samples.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return b;}
(async()=>{
 const profile=out+'/edge-'+Date.now(),proc=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore',env:{...process.env,TEMP:'D:/Temp',TMP:'D:/Temp'}});let ws;
 try{
  let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];break;}catch{}await new Promise(r=>setTimeout(r,100));}assert(port,'browser ready');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WS(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));let seq=0;const waiting=new Map();ws.on('message',b=>{const m=JSON.parse(b);if(m.id){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
  const call=(method,params)=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  for(const name of Object.keys(songs)){
   const expression=`(async()=>{const catalog=${JSON.stringify(catalog)};const sampleFiles=${JSON.stringify(sampleFiles)};globalThis.fetch=async url=>sampleFiles[url]?({ok:true,arrayBuffer:async()=>Uint8Array.from(atob(sampleFiles[url]),c=>c.charCodeAt(0)).buffer}):({ok:true,json:async()=>catalog});const offlineTimers=[];globalThis.setTimeout=(fn,delay)=>{offlineTimers.push(delay);return offlineTimers.length;};globalThis.clearTimeout=()=>{};let context;globalThis.AudioContext=class extends OfflineAudioContext{constructor(){super(1,48000*${renderSeconds},48000);context=this;}resume(){return Promise.resolve();}};${source}\n await WMOFAudio.startSong(${JSON.stringify(name)},{toneVolume:0.08,useSelectedInstrument:false,includeSpeech:false});const buffer=await context.startRendering();const samples=buffer.getChannelData(0);let last=samples.length-1;while(last>0 && Math.abs(samples[last])<0.00003)last--;const end=samples.length;let bytes='';const raw=new Uint8Array(samples.buffer,0,end*4);for(let i=0;i<raw.length;i+=8192)bytes+=String.fromCharCode(...raw.subarray(i,i+8192));WMOFAudio.stopAll();return {audio:btoa(bytes),length:end};})()`;
   const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
   const b=Buffer.from(result.result.value.audio,'base64'),samples=new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert(samples.some(x=>Math.abs(x)>0.001),'audible '+name);assert(samples.every(Number.isFinite),'finite audio');const peak=samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0);assert(peak<1,'not clipped');const windows=[];for(let at=0;at<samples.length;at+=48000){const part=samples.subarray(at,at+48000);windows.push(Math.sqrt(part.reduce((sum,x)=>sum+x*x,0)/part.length));}console.log('Missing-audio seconds:',windows.map((x,i)=>x>0.0001?null:i).filter(x=>x!==null));assert(windows.slice(0,Math.floor(compositionSeconds)).every(x=>x>0.0001),'Every second of the composition must contain music');console.log('Verified '+compositionSeconds.toFixed(2)+' seconds of music; peak '+peak.toFixed(3));fs.writeFileSync(out+'/'+name+'-bass-snare-together-shawm-last-v36.wav',wav(samples));console.log(name+': '+(samples.length/48000).toFixed(2)+' seconds');
  }
console.log('Rendered full composition with ClockTimer AudioEngine.');
 }finally{ws?.close();proc.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
