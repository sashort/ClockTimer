const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const mutations=[];const server=http.createServer((req,res)=>{
  if(req.method!=='GET'){mutations.push(req.url);res.writeHead(500);res.end();return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const previous=process.env.ORDER_FILLER_TEST_BASE_URL;process.env.ORDER_FILLER_TEST_BASE_URL='http://127.0.0.1:'+server.address().port+'/';
 let fixture;
 try{
  fixture=await require('./order-filler-master-fixture.cjs')();
  assert(await fixture.say('zero zero four two okay'));await fixture.page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
  assert(await fixture.say('one two three four okay'));await fixture.page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
  assert(await fixture.say('ready'));await fixture.page.waitForFunction(()=>WMOFVoiceEntry.active);
  assert(await fixture.say('forty seconds'));await fixture.page.waitForFunction(()=>Number(WMOFInteractionState.state.editor.value)===40);
  assert(await fixture.say('okay'));
  await fixture.page.waitForFunction(()=>document.querySelector('#clockTimer').status==='running');
  assert.equal(await fixture.page.evaluate(()=>document.querySelector('#clockTimer').standardTimeMilliseconds),40000);
  assert(await fixture.say('ready'));await fixture.page.waitForFunction(()=>document.querySelector('#tripTransitionOverlay').open);
  assert.deepEqual(mutations,[],'deployed browser never writes trips/auth/settings to the target server');
  assert.deepEqual(fixture.errors,[]);
  console.log('PASS deployed-asset instrumentation, transcript workflow and isolation of all backend writes');
 }finally{if(fixture)await fixture.close();if(previous===undefined)delete process.env.ORDER_FILLER_TEST_BASE_URL;else process.env.ORDER_FILLER_TEST_BASE_URL=previous;await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
