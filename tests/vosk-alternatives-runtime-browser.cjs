const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),runtime=path.resolve(process.argv[2]||path.join(root,'speech/vosk/runtime/vosk-alternatives-607b5c3e.js'));
 const wave=path.resolve(process.argv[3]||'test.wav'),model=path.join(root,'speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz');
 const routes=new Map([['/runtime.js',runtime],['/model.tar.gz',model],['/sample.wav',wave],...['SpeechValueCollector.js','VoskRecognizer.js'].map(name=>['/'+name,path.join(root,name)])]);
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Native browser alternatives</title>');return;}
  const file=routes.get(pathname);if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage();page.setDefaultTimeout(120000);
  await page.goto('http://127.0.0.1:'+server.address().port);
  for(const file of ['runtime.js','SpeechValueCollector.js','VoskRecognizer.js'])await page.addScriptTag({url:'/'+file});
  const result=await page.evaluate(async()=>{
   const model=await Vosk.createModel('/model.tar.gz',-1),lists=[],transcripts=[],errors=[];
   const recognizer=new VoskRecognizer({model,maxAlternatives:10,requireAlternatives:true,finalTimeoutMilliseconds:30000});
   recognizer.addEventListener('alternatives',event=>lists.push(event.detail));recognizer.addEventListener('transcript',event=>transcripts.push(event.detail));recognizer.addEventListener('error',event=>errors.push(event.detail.message));
   const context=new AudioContext({sampleRate:16000});
   try{
    const bytes=await (await fetch('/sample.wav')).arrayBuffer(),audio=await context.decodeAudioData(bytes);
    if(audio.sampleRate!==16000)throw Error('Test requires 16 kHz decoder input');
    await recognizer.beginUtterance('real-wave');const samples=audio.getChannelData(0);
    for(let offset=0;offset<samples.length;offset+=640)await recognizer.accept('real-wave',samples.subarray(offset,offset+640));
    // Flush an endpoint through genuine PCM silence, then close only the logical utterance.
    for(let i=0;i<60;i++)await recognizer.accept('real-wave',new Float32Array(640));
    await recognizer.finishUtterance('real-wave');
    return {lists,transcripts,errors,delivery:recognizer.audioDelivery};
   }finally{recognizer.close();model.terminate();await context.close();}
  });
  assert.deepEqual(result.errors,[]);assert(result.lists.some(list=>list.count>1),'the actual rebuilt WASM must return more than one native hypothesis');
  assert(result.lists.every(list=>list.count<=10&&list.hypotheses.length===list.count));
  assert(result.transcripts.at(-1).isFinal);assert(result.transcripts.at(-1).transcript.trim());
  assert.equal(result.delivery.receivedSamples,result.delivery.submittedSamples,'one continuous decoder receives every sample exactly once');assert.equal(result.delivery.queuedSamples,0);
  console.log(JSON.stringify({status:'passed',nativeHypothesisCounts:result.lists.map(list=>list.count),final:result.transcripts.at(-1).transcript,receivedSamples:result.delivery.receivedSamples}));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
