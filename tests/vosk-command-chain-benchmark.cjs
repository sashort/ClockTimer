// Local human-audio benchmark. Usage: node tests/vosk-command-chain-benchmark.cjs take.wav speech-end-sample [report.json]
// speech-end-sample is a reviewed boundary in the WAV's decoded sample rate, excluding trailing recorder padding.
const fs=require('node:fs'),assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const [file,end,output]=process.argv.slice(2),speechEndSample=Number(end);
 if(!file||!Number.isInteger(speechEndSample)||speechEndSample<=0)throw Error('Supply a human WAV and reviewed final speech sample index.');
 const wav=fs.readFileSync(file);
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
 let sourceSampleRate;
 for(let offset=12;offset+8<=wav.length;){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='fmt '){assert(size>=16);sourceSampleRate=wav.readUInt32LE(offset+12);break;}offset+=8+size+(size%2);}
 assert(sourceSampleRate>0,'WAV must declare a sample rate');
 const f=await fixture({input:'audio',recognitionMode:'sequential',beforeAudioStart:page=>page.evaluate(()=>{
  globalThis.chainBenchmark=[];
  for(const name of ['speechValueValidated','speechCommandDispatched','speechRecognitionHandoff','speechRecognitionFailed'])
   SpeechMenu.events.addEventListener(name,e=>{const d=e.detail||{};chainBenchmark.push({name,at:performance.now(),kind:d.kind,value:d.value,commandId:d.commandId,executionContext:d.executionContext,handoffMilliseconds:d.handoffMilliseconds});});
 })});
 try{
  const playback=await f.page.evaluate(base64=>diagnosticsAudioInput.play(base64),wav.toString('base64'));
  assert(speechEndSample/sourceSampleRate<=playback.samples/playback.sampleRate,'speech-end sample must lie within the recording');
  let timedOut=false;
  try{await f.page.waitForFunction(()=>chainBenchmark.some(e=>e.name==='speechValueValidated'&&e.kind==='clock'&&e.value==='4:12')&&chainBenchmark.filter(e=>e.name==='speechCommandDispatched').length>=4,null,{timeout:20000});}catch{timedOut=true;}
  const events=await f.page.evaluate(()=>chainBenchmark);
  const time=events.find(e=>e.name==='speechValueValidated'&&e.kind==='clock'&&e.value==='4:12');
  const counts=Object.fromEntries(['loginCredentials','tripGoal','sync','readyAt'].map(name=>[name,events.filter(e=>e.name==='speechCommandDispatched'&&e.commandId?.startsWith('builtin:'+name+':')).length]));
  const speechEndedAt=playback.startedAt+speechEndSample/sourceSampleRate*1000;
  const report={passed:!timedOut&&Boolean(time)&&Object.values(counts).every(count=>count===1)&&!f.errors.length,speechEndSample,sourceSampleRate,playback,
   plannerLatencyMilliseconds:time?time.at-speechEndedAt:null,dispatchCounts:counts,events,errors:f.errors};
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
