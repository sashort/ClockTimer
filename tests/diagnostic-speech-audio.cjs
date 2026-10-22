const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

/** Deterministic, audible input corpus; the recognizer never receives expected text. */
class DiagnosticSpeechAudio {
 constructor({locale='en-US',voice=locale.toLowerCase(),wpm=160,directory}={}){
  if(![90,160,240].includes(wpm))throw Error('Choose a reviewed speech delivery rate');
  this.locale=locale;this.voice=voice;this.wpm=wpm;
  this.directory=directory||path.join(__dirname,'artifacts/language-tests',locale.toLowerCase(),'audio');
  this.ready=(async()=>{const {default:initialize}=await import('@echogarden/espeak-ng-emscripten');this.module=await initialize();this.synth=new this.module.eSpeakNGWorker();})();
 }
 async render(text){
  if(typeof text!=='string'||!text.trim()||text.length>512)throw Error('Invalid speech fixture text');
  await this.ready;
  const identity={format:2,engine:'espeak-ng-emscripten',revision:'7ab07eba2d966ce45040c88d9be953e1d68640e7',locale:this.locale,voice:this.voice,wpm:this.wpm,text};
  const key=crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  fs.mkdirSync(this.directory,{recursive:true});const file=path.join(this.directory,key+'.wav');
  if(!fs.existsSync(file)){
   this.synth.set_voice(this.voice);this.synth.set_rate(this.wpm);
   const chunks=[];this.synth.synthesize(text,samples=>{if(samples?.length)chunks.push(Buffer.from(new Int16Array(samples).buffer));});
   const pcm=Buffer.concat([Buffer.alloc(Math.round(22050*.18)*2),...chunks,Buffer.alloc(22050*2*2)]);
   if(!chunks.length)throw Error('Speech synthesizer produced no audio');
   const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(22050,24);header.writeUInt32LE(44100,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
   fs.writeFileSync(file,Buffer.concat([header,pcm]));fs.writeFileSync(path.join(this.directory,key+'.json'),JSON.stringify({...identity,key,sampleRate:22050,paddingMilliseconds:{leading:180,trailing:2000}},null,2));
  }
  const wav=fs.readFileSync(file);return {...identity,key,file,wav,durationMilliseconds:(wav.length-44)/44100*1000,sha256:crypto.createHash('sha256').update(wav).digest('hex')};
 }
 static async install(page){
  await page.addInitScript(()=>{
   // Keep real Web Audio processing, with no dependency on a physical output
   // device in headless/CI sessions. Input is supplied by the WAV MediaStream.
   const NativeAudioContext=globalThis.AudioContext;
   const contexts=globalThis.diagnosticAudioContexts=[];
   globalThis.AudioContext=class extends NativeAudioContext{
    constructor(options={}){
     super({...options,sinkId:{type:'none'}});
     // Keep the silent rendering graph alive while addModule initializes its
     // worklet thread, before SpeechMenu connects the microphone graph.
     const keepAlive=this.createConstantSource();keepAlive.offset.value=0;
     keepAlive.connect(this.destination);keepAlive.start();
     contexts.push({context:this,worklet:this.audioWorklet,keepAlive});
    }
   };
   let context,destination,silence;
   async function ensure(){
    if(!context){context=new AudioContext();destination=context.createMediaStreamDestination();silence=context.createConstantSource();silence.offset.value=0;silence.connect(destination);silence.start();}
    if(context.state!=='running')await context.resume();
   }
   // Only the audio source is substituted. SpeechMenu, its worklet, VAD and decoder are real.
   const nativeGetUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{
    if(!constraints.audio||constraints.video)return nativeGetUserMedia(constraints);
    await ensure();return destination.stream.clone();
   };
   globalThis.diagnosticsAudioInput={
    get state(){return context?.state||'not-created';},
    async play(base64){
     await ensure();const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const buffer=await context.decodeAudioData(bytes.buffer);
     const source=context.createBufferSource();source.buffer=buffer;source.connect(destination);
     await new Promise((resolve,reject)=>{source.onended=resolve;try{source.start();}catch(error){reject(error);}});source.disconnect();
    }
   };
  });
 }
}
module.exports={DiagnosticSpeechAudio};
