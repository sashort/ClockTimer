const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DiagnosticSpeechAudio}=require('./diagnostic-speech-audio.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'diagnostic-speech-'));
 assert.throws(()=>new DiagnosticSpeechAudio({wpm:90,directory}),/reviewed speech delivery rate/,'retired Slow delivery cannot generate a new test clip');
 try{
  const durations=[];
  for(const wpm of Object.values(require('./order-filler-master-plan.cjs').rates)){
   const generator=new DiagnosticSpeechAudio({wpm,directory}),clip=await generator.render('one hour and five minutes'),cached=await generator.render('one hour and five minutes');
   assert.equal(clip.sha256,cached.sha256,'replay uses the exact cached samples');assert.equal(clip.wav.toString('ascii',0,4),'RIFF');assert.equal(clip.wav.readUInt32LE(24),22050);assert.equal(clip.wav.readUInt16LE(22),1);assert.equal(clip.wav.readUInt16LE(34),16);
   let energy=0;for(let i=44;i<clip.wav.length;i+=2)energy+=clip.wav.readInt16LE(i)**2;assert(energy>1e8,'generated fixture contains sound');durations.push(clip.durationMilliseconds);
  }
  assert(durations.length===2&&durations[0]<durations[1],'Fast/Medium change actual sound duration');
  console.log('PASS audible WAV generation, voice/rate cache keys, real delivery-rate differences and exact sample replay');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
