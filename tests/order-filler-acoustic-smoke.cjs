const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const previousRate=process.env.CLOCKTIMER_SPEECH_RATE_WPM;
 try{for(const wpm of [240,160,90]){
  process.env.CLOCKTIMER_SPEECH_RATE_WPM=String(wpm);const f=await fixture({input:'audio'});
  try{
   assert.equal(await f.page.evaluate(()=>typeof SpeechMenu.testSay),'undefined','real recognizer has no transcript-injection hook');
   assert.equal(await f.page.evaluate(()=>typeof SpeechMenu.testActivate),'undefined','real capture lifecycle is intact');
   assert(await f.say('zero'),'speech samples are recognized');
   const heard=f.audioCases[0].recognized;assert.match(heard,/\bzero\b/,'actual Vosk output matches the spoken digit');
   const before=await f.page.evaluate(()=>acousticSpeechEvents.filter(e=>e.type==='speechTranscriptScoped'&&e.transcript).length);
   const silence=Buffer.from(f.audioCases[0]?require('node:fs').readFileSync(f.audioCases[0].file):'');silence.fill(0,44);
   await f.page.evaluate(base64=>diagnosticsAudioInput.play(base64),silence.toString('base64'));
   assert.equal(await f.page.evaluate(()=>acousticSpeechEvents.filter(e=>e.type==='speechTranscriptScoped'&&e.transcript).length),before,'silent waveform does not turn the expected text into recognition');
   console.log('PASS acoustic '+wpm+' wpm: WAV → MediaStream → AudioWorklet/VAD → Vosk → '+heard);
  }finally{await f.close();}
 }}finally{if(previousRate===undefined)delete process.env.CLOCKTIMER_SPEECH_RATE_WPM;else process.env.CLOCKTIMER_SPEECH_RATE_WPM=previousRate;}
})().catch(error=>{console.error(error);process.exitCode=1;});
