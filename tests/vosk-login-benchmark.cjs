// Replay a private human eight-digit login recording against isolated mocked APIs.
// Usage: node tests/vosk-login-benchmark.cjs recording.wav [report.json] [sequential|parallel] [warm|cold] [expected-eight-digits]
const fs=require('node:fs'),assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const [wavPath,output,mode='sequential',temperature='warm',expectedDigits='00421234']=process.argv.slice(2);
 if(!wavPath)throw Error('Supply an eight-digit human login WAV; audio stays local.');
 if(!['warm','cold'].includes(temperature))throw Error('Choose warm or cold.');
 if(!/^\d{8}$/.test(expectedDigits))throw Error('Expected login must contain exactly eight digits.');
 const wav=fs.readFileSync(wavPath),started=Date.now();
 const f=await fixture({input:'audio',recognitionMode:mode,speechOptions:{'speech-warm':temperature==='cold'?'off':'on'},beforeAudioStart:page=>page.evaluate(()=>{
  globalThis.benchmarkEvents=[];
  for(const name of ['speechRecognitionSlots','speechRecognitionMetrics','speechRecognitionHandoff','speechRecognitionFailed','speechCommandDispatched'])
   SpeechMenu.events.addEventListener(name,e=>benchmarkEvents.push({name,at:performance.now(),...e.detail}));
 })});
 try{
  assert.equal(await f.page.evaluate(()=>SpeechMenu.recognitionDiagnostics.mode),mode,'benchmark must run the requested adapter');
  const playbackStarted=Date.now();
  await f.page.evaluate(base64=>diagnosticsAudioInput.play(base64),wav.toString('base64'));
  let timedOut=false;
  try{await f.page.waitForFunction(()=>!document.querySelector('#loginDialog').open,null,{timeout:20000});}catch{timedOut=true;}
  const result=await f.page.evaluate(()=>({loginOpen:document.querySelector('#loginDialog').open,stage:WMOFInteractionState.state.login.stage,
   locks:WMOFCoordinator.lockCount,diagnostics:SpeechMenu.recognitionDiagnostics,events:benchmarkEvents,
   contexts:globalThis.handoffContexts}));
  const slots=result.events.filter(e=>e.name==='speechRecognitionSlots').flatMap(e=>e.slots||[]);
  const credentialsSlot=slots.find(slot=>slot.kind==='digits'&&slot.context==='credentials'&&slot.value===expectedDigits);
  const dispatches=result.events.filter(e=>e.name==='speechCommandDispatched'&&e.executionContext==='credentials');
  const report={mode,temperature,passed:!timedOut&&!result.loginOpen&&!f.errors.length&&Boolean(credentialsSlot)&&dispatches.length===1,elapsedMilliseconds:Date.now()-started,
   playbackToObservationMilliseconds:Date.now()-playbackStarted,result,errors:f.errors};
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode,temperature,passed:report.passed,elapsedMilliseconds:report.elapsedMilliseconds,
   audioDelivery:result.diagnostics.audioDelivery,preparation:result.diagnostics.preparation,slots:result.diagnostics.slots.length,credentialDispatches:dispatches.length,errors:f.errors}));
  if(!report.passed)process.exitCode=1;
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
