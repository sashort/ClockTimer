// Integration contract only: native results are simulated, not acoustic evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  let loginPosts=0,failLogin=false;
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.addInitScript(()=>{
   globalThis.nativeSpeechInstances=[];globalThis.captureCalls=0;
   globalThis.webSpeechShadows=new WeakMap();const attach=Element.prototype.attachShadow;
   Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);webSpeechShadows.set(this,shadow);return shadow;};
   if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{captureCalls++;throw Error('Web Speech must own capture');};
   globalThis.SpeechRecognition=class {
    constructor(){nativeSpeechInstances.push(this);this.results=[];}
    start(){queueMicrotask(()=>{this.onstart?.();this.onaudiostart?.();});}
    stop(){queueMicrotask(()=>this.onend?.());}
    abort(){}
    emit(texts,final=true){
     const result=Object.assign(texts.map((transcript,i)=>({transcript,confidence:1-i*.1})),{isFinal:final});
     if(this.results.at(-1)?.isFinal===false)this.results[this.results.length-1]=result;else this.results.push(result);
     this.onresult?.({resultIndex:this.results.length-1,results:this.results});
    }
   };
  });
  await page.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname.endsWith('.js'))return route.fallback();
   if(pathname==='/api/users/'&&route.request().method()==='POST'){loginPosts++;await new Promise(resolve=>setTimeout(resolve,30));if(failLogin)return route.fulfill({status:401,json:{error:'Invalid credentials'}});}
   return route.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[],trips:[],instruments:[],voices:[],accepted:true,tripId:41,eventId:1,events:[]}});
  });
  await page.route('**/api/audio/AudioEngine.js*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:await response.text()+`\nWMOFAudio.speak=(text,options={})=>{queueMicrotask(()=>options.onEnd?.());return true;};WMOFAudio.startSong=async()=>({hasChime:true,finished:Promise.resolve()});`});
  });
  const {assertState,assertFamily}=await import('./state-contract-fixture.mjs');
 const base=process.env.ORDER_FILLER_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
  if(process.env.CLOCKTIMER_TEST_EXPECTED_COMMIT){
   const response=await page.request.get(new URL('build-version.json',base).href);
   assert(response.ok());assert.equal((await response.json()).commit,process.env.CLOCKTIMER_TEST_EXPECTED_COMMIT,'deployed commit matches checkout');
  }


  await page.goto(new URL('order-filler.php',base).href);
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu);
  await page.evaluate(async()=>{
   globalThis.breakEvents=[];
   for(const type of ['speechCommandDigested','speechCommandDispatched','speechCommandExecuted','speechCommandRejected','speechCommandSkipped','speechTranscriptScoped','utteranceUnrecognized'])SpeechMenu.events.addEventListener(type,e=>breakEvents.push({type,transcript:e.detail?.transcript,reason:e.detail?.reason,commandId:e.detail?.commandId}));
   await SpeechMenu.start('en-US');await WMOFActions.handleSpeechRuntimeStarted();
   await WMOFActions.connectUser('0042','1234',{credentialType:'pin'});
   const c=document.querySelector('#clockTimer');await WMOFCoordinator.run('test-start',()=>c.start({standardTimeMilliseconds:3600000}));
  });
  await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);

  for(const standalone of [false,true]){
   if(standalone)await page.evaluate(async()=>{const c=document.querySelector('#clockTimer');await c.stop(new Date());await c.resetCompletedTrip();});
   for(const kind of ['break','short-break','lunch'])for(const delivery of ['separate','combined','revised']){
    await page.evaluate(async kind=>{await WMOFActions.startBreak(kind);breakEvents=[];},kind);
    await page.waitForFunction(()=>Boolean(document.querySelector('#clockTimer').getActiveIntervalState()));
    if(delivery==='combined')await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['break end okay'],true));
    else{
     await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['break end'],false));
     try{await page.waitForFunction(()=>document.querySelector('#speechBreakConfirmDialog').open,null,{timeout:5000});}
     catch(error){console.log(await page.evaluate(async()=>({kind:document.querySelector('#clockTimer').getActiveIntervalState(),state:WMOFInteractionState.state,events:breakEvents,plan:await SpeechMenu.planCommandChain('break end')})));throw error;}
     if(delivery==='separate'){
      await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['break end'],true));
      await page.waitForFunction(()=>WMOFCoordinator.lockCount===0);
      await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['okay'],true));
     }else{
      await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['break end okay'],false));
      await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['break end okay'],true));
     }
    }
    try{await page.waitForFunction(()=>!document.querySelector('#clockTimer').getActiveIntervalState(),null,{timeout:5000});}
    catch(error){console.log({standalone,kind,delivery},await page.evaluate(()=>({events:breakEvents,state:WMOFInteractionState.state})));throw error;}
    await page.waitForFunction(()=>WMOFCoordinator.lockCount===0&&!document.querySelector('#speechBreakConfirmDialog').open);
    console.log('PASS Web Speech end '+kind+' '+delivery+' standalone='+standalone);
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
