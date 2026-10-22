const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 let wsPort,child,browser;let counter=0,authenticated=false;
 const host=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Server speech transport</title>');return;}
  if(url.pathname==='/fixture-login'){authenticated=url.searchParams.get('on')==='true';res.end('ok');return;}
  if(url.pathname==='/api/speech/session/'){
   res.setHeader('Content-Type','application/json');
   if(req.method==='GET'){res.end(JSON.stringify({csrfToken:'fixture-csrf'}));return;}
   let body='';req.on('data',data=>body+=data);req.on('end',()=>{
    assert.equal(req.headers['x-csrf-token'],'fixture-csrf');
    const {language}=JSON.parse(body);if(!['en-US','fr-FR'].includes(language)){res.writeHead(422);res.end(JSON.stringify({message:'Unsupported language'}));return;}
    const now=Math.floor(Date.now()/1000),origin=`http://127.0.0.1:${host.address().port}`;
    const encoded=Buffer.from(JSON.stringify({v:1,aud:'clocktimer-speech',origin,language,authenticated,sub:(authenticated?'c':'b').repeat(64),iat:now,exp:now+60,jti:(++counter).toString(16).padStart(32,'0')})).toString('base64url');
    res.end(JSON.stringify({language,authenticated,ticket:encoded+'.'+crypto.createHmac('sha256','a'.repeat(64)).update(encoded).digest('hex'),websocketPath:`ws://127.0.0.1:${wsPort}/speech-ws`}));
   });return;
  }
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>host.listen(0,'127.0.0.1',resolve));
 try{
  const origin=`http://127.0.0.1:${host.address().port}`;
  child=spawn(process.env.CLOCKTIMER_SPEECH_PYTHON||'python3',['tests/speech-server.py','--fixture',JSON.stringify([origin])],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const started=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Speech fixture startup timed out: '+stderr)),15000);
   let output='';child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){clearTimeout(timeout);resolve(JSON.parse(output.split('\n')[0]));}});
   child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);reject(Error('Speech fixture exited '+code+': '+stderr));});
  });wsPort=started.port;
  browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  for(const file of ['SpeechValueCollector.js','VoskRecognizer.js','VoskServerRecognizer.js'])await page.addScriptTag({url:file});
  const result=await page.evaluate(async()=>{
   const events=[],errors=[];const adapter=globalThis.testRemote=new VoskServerRecognizer({language:'en-US'});
   adapter.addEventListener('transcript',e=>events.push(e.detail));adapter.addEventListener('error',e=>errors.push(e.detail.message));
   globalThis.remoteStatuses=[];adapter.addEventListener('status',e=>remoteStatuses.push(e.detail));
   await adapter.ready;
   await adapter.beginUtterance('first');await adapter.acceptAudio(Float32Array.from([-1,-.5,0,.5,1]));await adapter.finishUtterance('first');
   await adapter.beginUtterance('second');await adapter.acceptAudio(new Float32Array(640));await adapter.acceptAudio(new Float32Array(640));await adapter.finishUtterance('second');
   return {events,errors,delivery:adapter.audioDelivery};
  });
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.events.filter(e=>e.isFinal).map(e=>[e.utteranceId,e.transcript]),[['first','wake'],['second','break start']]);
  assert.equal(result.delivery.receivedSamples,1285);assert.equal(result.delivery.queuedSamples,0);
  assert.deepEqual(await page.evaluate(async()=>{const french=new VoskServerRecognizer({language:'fr-FR'});await french.ready;await french.beginUtterance('fr');await french.acceptAudio(new Float32Array(640));await french.finishUtterance('fr');french.close();return french.continuousInput;}),true);
  assert.equal(await page.evaluate(async()=>{try{await new VoskServerRecognizer({language:'de-DE'}).ready;return false;}catch{return true;}}),true);
  const alternatives=await page.evaluate(async()=>{
   const selected=[],events=[];
   const adapter=new VoskServerRecognizer({selectHypothesis:async(id,candidates)=>{
    selected.push(candidates.map(candidate=>candidate.text));
    return candidates.find(candidate=>candidate.text==='sync on');
   }});
   adapter.addEventListener('transcript',event=>events.push(event.detail));
   await adapter.ready;await adapter.beginUtterance('alternatives');
   await adapter.acceptAudio(Float32Array.of(.25));await adapter.finishUtterance('alternatives');adapter.close();
   const rejected=new VoskServerRecognizer({selectHypothesis:()=>undefined});
   const invalid=[];rejected.addEventListener('transcript',event=>invalid.push(event.detail));
   await rejected.ready;await rejected.beginUtterance('invalid');await rejected.acceptAudio(Float32Array.of(.25));await rejected.finishUtterance('invalid');rejected.close();
   return {selected,events,invalid};
  });
  assert.deepEqual(alternatives.selected[0],['sink on','sync on']);
  assert.equal(alternatives.events.at(-1).transcript,'sync on');
  assert.equal(alternatives.events.at(-1).isFinal,true);
  assert.equal(alternatives.events.at(-1).segments.filter(segment=>segment.text).length,1,'final reconciliation preserves one selected span');
  assert.equal(alternatives.invalid.at(-1).transcript,'','unmatched alternatives do not reach collection as commands');
  await page.evaluate(()=>{globalThis.remoteErrors=[];testRemote.addEventListener('error',e=>remoteErrors.push(e.detail));});
  assert.equal(await page.evaluate(async()=>{

   await fetch('/fixture-login?on=true');
   const upgraded=await testRemote.setAuthenticated(true);
   await testRemote.beginUtterance('after-login');await testRemote.acceptAudio(new Float32Array(640));await testRemote.finishUtterance('after-login');
   return upgraded;
  }),true);
  await page.evaluate(async()=>{await fetch('/fixture-login?on=false');await testRemote.setAuthenticated(false);});
  // Exercise actual server expiry, not a synthetic client timer.
  const issuedBeforeExpiry=counter;
  await page.waitForTimeout(10100);
  assert.equal(counter,issuedBeforeExpiry,'expiry must not request another anonymous ticket');
  assert.equal(await page.evaluate(()=>remoteErrors.length),0);
  assert.equal(await page.evaluate(()=>remoteStatuses.filter(s=>s.status==='login-timeout').length),1);
  assert(await page.evaluate(()=>remoteStatuses.some(s=>s.status==='login-countdown'&&s.remaining===3)));
  assert.equal(await page.evaluate(async()=>{
   const remote=globalThis.testRemote=new VoskServerRecognizer({language:'en-US'});
   globalThis.remoteErrors=[];remote.addEventListener('error',e=>remoteErrors.push(e.detail));
   await remote.ready;return true;
  }),true);
  child.kill();await page.waitForFunction(()=>remoteErrors.some(error=>error.fatal));
  assert.deepEqual(errors,[]);
  console.log('PASS remote Vosk: browser ticket exchange, English/French routing, persistent socket, collectors/boundaries, exact audio accounting, unsupported language and explicit disconnect failure');
 }finally{if(browser)await browser.close();child?.kill();await new Promise(resolve=>host.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
