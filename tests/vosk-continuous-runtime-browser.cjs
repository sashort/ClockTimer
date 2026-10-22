// Uses the pinned WASM decoder and model. Tests transport/lifecycle, not acoustic accuracy.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Vosk transport test</title>');return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for(const src of ['SpeechValueCollector.js','VoskRecognizer.js','speech/vosk/runtime/vosk-0.0.8.js'])await page.addScriptTag({url:src});
  const result=await page.evaluate(async()=>{
   const model=await Vosk.createModel('speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz');
   let allocations=0;const errors=[],finals=[];
   const adapter=new VoskRecognizer({model:{KaldiRecognizer:class {constructor(rate){allocations++;return new model.KaldiRecognizer(rate);}}}});
   adapter.addEventListener('error',e=>errors.push(e.detail.message));
   adapter.addEventListener('transcript',e=>{if(e.detail.isFinal)finals.push(e.detail.utteranceId);});
   try{
    await adapter.acceptAudio(new Float32Array(1600));
    for(let i=0;i<8;i++){
     await adapter.beginUtterance(i);
     await adapter.acceptAudio(new Float32Array(3200));
     const final=adapter.finishUtterance(i);
     // PCM arriving while finalization is in flight must wait in order.
     const audio=adapter.acceptAudio(new Float32Array(1600));
     await Promise.all([final,audio]);
    }
    // Drain the last idle block with a final logical boundary.
    await adapter.beginUtterance('last');await adapter.finishUtterance('last');
    return {allocations,finals,errors,delivery:adapter.audioDelivery};
   }finally{adapter.close();model.terminate();}
  });
  assert.equal(result.allocations,1);assert.equal(result.finals.length,9);
  assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
  assert.equal(result.delivery.receivedSamples,40000);
  assert.equal(result.delivery.submittedSamples,40000);assert.equal(result.delivery.queuedSamples,0);
  console.log('PASS pinned Vosk WASM: one decoder, nine boundaries, all 40000 samples delivered once, empty backlog');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
