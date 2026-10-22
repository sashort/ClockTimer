const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {encode}=require('../speech/RecordingWave.js'),{loadHumanClip}=require('./human-speech-audio.cjs'),{DiagnosticSpeechAudio}=require('./diagnostic-speech-audio.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'human-fixture-')),folder=path.join(directory,'en-us/fast');fs.mkdirSync(folder,{recursive:true});
 try{
  const text='ready',id=crypto.createHash('sha256').update('en-us\n'+text).digest('hex');
  const samples=Float32Array.from({length:8000},(_,i)=>Math.sin(i*.08)*.2),wav=Buffer.from(encode(samples));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt32LE(40),wav.length-44);assert.equal((wav.length-44)/32000,2.68,'capture padding is explicit');
  assert.throws(()=>encode(new Float32Array(10)),/Record between/);assert.throws(()=>encode(Float32Array.from({length:4000},()=>NaN)),/Record between/);
  const sha256=crypto.createHash('sha256').update(wav).digest('hex');const metadata={source:'human',locale:'en-us',delivery:'fast',phraseId:id,text,sha256};
  fs.writeFileSync(path.join(folder,sha256+'.wav'),wav);fs.writeFileSync(path.join(folder,id+'.json'),JSON.stringify(metadata));
  assert.deepEqual(loadHumanClip({directory,locale:'en-US',delivery:'fast',text}).wav,wav);
  const generator=new DiagnosticSpeechAudio({wpm:240,directory:path.join(directory,'cache'),recordingsDirectory:directory});
  const clip=await generator.render(text);assert.equal(clip.source,'human');assert.equal(clip.sha256,sha256);assert.deepEqual(clip.wav,wav,'the audio fixture uses the exact approved recording');
  assert.equal(generator.synth,undefined,'human mode never starts speech synthesis');
  await assert.rejects(generator.render('cancel'),/Missing human recording/,'missing human takes never fall back to synthetic speech');
  fs.writeFileSync(path.join(folder,sha256+'.wav'),Buffer.from('corrupt'));
  assert.throws(()=>loadHumanClip({directory,locale:'en-US',delivery:'fast',text}),/checksum/);
  const script=JSON.parse(fs.readFileSync(path.join(__dirname,'recording-scripts/en-us.json'),'utf8')),workflow=require('./languages/en-US/workflows.cjs');assert.deepEqual(script.phrases,[...new Set(Object.values(workflow.phrases))],'prompts stay aligned with the actual workflow corpus');
  console.log('PASS WAV capture encoding, exact human fixture replay, source reporting, missing/corrupt rejection and script coverage');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
