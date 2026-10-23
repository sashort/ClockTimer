const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),script=JSON.parse(fs.readFileSync(path.join(__dirname,'recording-scripts/en-us.json'),'utf8'));
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);if(pathname.endsWith('.php'))body=body.toString().slice(body.toString().indexOf('<!doctype'));
  res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'text/html');res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),saved=[],errors=[];let gets=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{globalThis.capturedTracks=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await get(options);capturedTracks.push(...stream.getTracks());return stream;};});
  await page.route(origin+'/api/diagnostics/recordings/**',async route=>{
   const url=new URL(route.request().url()),delivery=url.searchParams.get('delivery')||'fast';
   if(route.request().method()==='POST'){
    const input=route.request().postDataJSON();assert.equal(route.request().headers()['x-csrf-token'],'recording-csrf');
    const wav=Buffer.from(input.wav,'base64');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt16LE(34),16);assert(wav.length>8000);saved.push(input);
    return route.fulfill({json:{recording:{source:'human'},csrfToken:'recording-csrf'}});
   }
   gets++;
   const prompts=script.phrases.map(text=>{const id=crypto.createHash('sha256').update('en-us\n'+text).digest('hex');return {id,text,recorded:saved.some(record=>record.delivery===delivery&&record.phraseId===id)};});
   return route.fulfill({json:{locale:'en-US',delivery,targetWpm:delivery==='fast'?240:160,prompts,recorded:prompts.filter(p=>p.recorded).length,csrfToken:'recording-csrf'}});
  });
  await page.goto(origin+'/diagnostics/order-filler/recordings.php');await page.waitForFunction(()=>!document.querySelector('#record').disabled);
  assert.match(await page.locator('#position').innerText(),/Phrase 1 \/ 32/);
  assert.equal(await page.locator('#delivery option').count(),2);
  assert.equal(await page.locator('#playback').isVisible(),false,'no empty playback control before a take exists');
  await page.locator('#record').click();await page.waitForFunction(()=>!document.querySelector('#stop').disabled);await page.waitForTimeout(800);await page.locator('#stop').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled);
  assert.equal(saved.length,0,'stopping and previewing never upload a recording');
  assert.match(await page.locator('#playback').getAttribute('src'),/^blob:/);
  assert(await page.evaluate(()=>capturedTracks.every(track=>track.readyState==='ended')),'microphone is released after Stop');
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#coverage').textContent.startsWith('1 / 32'));
  assert.equal(saved.length,1);assert.equal(saved[0].phraseId,crypto.createHash('sha256').update('en-us\n'+script.phrases[0]).digest('hex'));assert.match(await page.locator('#position').innerText(),/Phrase 2 \/ 32/);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#record').disabled);assert.match(await page.locator('#position').innerText(),/Phrase 2 \/ 32/,'resume starts at the first missing take');
  await page.locator('#delivery').selectOption('medium');await page.waitForFunction(()=>document.querySelector('#coverage').textContent.includes('0 / 32')&&document.querySelector('#coverage').textContent.includes('medium'));
  assert(gets>=3);assert.equal(saved.length,1);assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'recorder fits mobile width');
  const artifacts=path.join(__dirname,'artifacts/speech-recordings');fs.mkdirSync(artifacts,{recursive:true});await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
  console.log('PASS real browser PCM capture, local preview, explicit CSRF save, released microphone, resumed script and mobile layout');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
