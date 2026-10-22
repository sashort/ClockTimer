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

  const id='zero zero four two okay',full=id+' one two three four okay';
  const cases=[
   {name:'distinct numeric ID and PIN repeated interims',chunks:[['1234 okay',false,true],['1234 okay',false],['1234 okay 5678 okay',false],['1234 okay 5678 okay',false],['1234 okay 5678 okay',true]]},
   {name:'identical ID and PIN interims',chunks:[['1234 okay',false,true],['1234 okay 1234 okay',false],['1234 okay 1234 okay',false],['1234 okay 1234 okay',true]]},
   {name:'identical ID and PIN separate slots',chunks:[['1234 okay',true,true],['1234 okay',true]]},
   {name:'delayed final after audio capture ends',audioEndDelay:1500,chunks:[[full,true]]},
   {name:'final result immediately followed by native end',endAfterResult:true,chunks:[[full,true]]},
   {name:'automatic login startup',activate:true,chunks:[[id,false,true],[full,false],[full,true]]},
   {name:'cumulative interims',chunks:[[id,false,true],[full,false],[full,false],[full,true]]},
   {name:'login prompt interrupted capture',interruptLogin:true,chunks:[[id,false],[full,false],[full,true]]},
   {name:'back-to-back interims',chunks:[[id,false],[full,false],[full,true]]},
   {name:'single final',chunks:[[full,true]]},
   {name:'separate final slots',chunks:[[id,true,true],['one two three four okay',true]]},
   {name:'formatted numeric codes',chunks:[['0042 okay',false],['0042 okay 1234 okay',false],['0042 okay 1234 okay',true]]},
   {name:'eight spoken digits',contexts:['credentials'],chunks:[['zero zero four two one two three four',true]]},
   {name:'eight digits optional OK',contexts:['credentials'],chunks:[['zero zero four two one two three four okay',true]]},
   {name:'eight compact digits',contexts:['credentials'],chunks:[['00421234',true]]},
   {name:'eight digits then settings',contexts:['credentials',null,null],chunks:[['5 5 5 5 5 5 5 5 sync on trip goal 100%',true]],tail:'settings'},
   {name:'eight digits then interim settings',contexts:['credentials',null,null],chunks:[['5 5 5 5 5 5 5 5',false],['5 5 5 5 5 5 5 5 sync on trip goal 100%',false],['5 5 5 5 5 5 5 5 sync on trip goal 100%',true]],tail:'settings'},
   {name:'eight digits then scheduled start',contexts:['credentials',null],chunks:[['5 5 5 5 5 5 5 5 ready at 4:12',true]],tail:'scheduled'}
  ];
  for(const scenario of cases.filter(c=>!process.env.LOGIN_TEST_CASE||c.name.includes(process.env.LOGIN_TEST_CASE))){
   const postsBefore=loginPosts;
   await page.goto(new URL('order-filler.php',base).href);
   await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu&&customElements.get('speech-mic-bar'));
   assert.equal(await page.evaluate(()=>WMOF_SPEECH_BACKEND),'web-speech');
   await page.evaluate(async()=>{
    globalThis.loginSpeechEvents=[];globalThis.loginDisplaySnapshots=[];
    const activity=webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#activity');
    new MutationObserver(()=>loginDisplaySnapshots.push(activity.textContent)).observe(activity,{childList:true,subtree:true,characterData:true});
    SpeechMenu.events.addEventListener('speechCommandBufferChanged',e=>loginSpeechEvents.push({type:'buffer',entries:e.detail.entries.map(x=>({ownerId:x.ownerId,id:x.id,text:x.transcript})),text:e.detail.text}));
    for(const type of ['speechCommandDigested','speechCommandSkipped','speechStreamCommitted','speechCommandDispatched','speechCommandExecuted','speechTranscriptScoped','utteranceUnrecognized'])SpeechMenu.events.addEventListener(type,e=>loginSpeechEvents.push({type,utteranceId:e.detail?.utteranceId,reason:e.detail?.reason,commandId:e.detail?.commandId,executionContext:e.detail?.executionContext,transcript:e.detail?.transcript}));
   });
   if(scenario.activate)await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);
   else await page.evaluate(async()=>{await SpeechMenu.start('en-US');await WMOFActions.handleSpeechRuntimeStarted();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();});
   await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);
   assertFamily(await page.evaluate(()=>WMOFInteractionState.state),'LOGIN-ID',scenario.name+' starts at ID entry');
   if(scenario.interruptLogin){
    const before=await page.evaluate(()=>nativeSpeechInstances.length);
    await page.evaluate(()=>{globalThis.loginPromptToken=SpeechMenu.registerSynthesizedSpeech('Please login via voice.');nativeSpeechInstances.at(-1).onerror({error:'audio-capture'});});
    await page.waitForFunction(count=>nativeSpeechInstances.length>count&&SpeechMenu.captureListening,before);
    await page.evaluate(()=>SpeechMenu.unregisterSynthesizedSpeech(loginPromptToken,{graceMilliseconds:0}));
   }
   for(const [text,final,waitPin] of scenario.chunks){
    if(scenario.audioEndDelay){
     await page.evaluate(()=>{const native=nativeSpeechInstances.at(-1);native.onspeechstart?.();native.onaudioend?.();});
     await page.waitForTimeout(scenario.audioEndDelay);
     assert.equal(await page.locator('#speechMicBar').getAttribute('state'),'processing','audio completion waits for the delayed result instead of reconnecting');
    }
    await page.evaluate(({text,final,endAfterResult})=>{const native=nativeSpeechInstances.at(-1);native.emit([text],final);if(endAfterResult)native.onend?.();},{text,final,endAfterResult:scenario.endAfterResult});
    if(scenario.audioEndDelay)await page.evaluate(()=>nativeSpeechInstances.at(-1).onend?.());
    if(waitPin)await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden,null,{timeout:5000});
   }
   try{await page.waitForFunction(()=>!document.querySelector('#loginDialog').open,null,{timeout:5000});}
   catch(error){console.error(scenario.name,await page.evaluate(()=>({events:loginSpeechEvents,state:WMOFInteractionState.state,phrases:SpeechMenu.phraseGroups})));throw error;}
   assert.equal(loginPosts-postsBefore,1,scenario.name+': authenticates once');
   assertState(await page.evaluate(()=>WMOFInteractionState.state),{'login.phase':'closed'},scenario.name+' authentication closes the login state');
   const expectedContexts=scenario.contexts||['id','pin'];
   try{await page.waitForFunction(count=>loginSpeechEvents.filter(e=>e.type==='speechCommandDispatched').length===count,expectedContexts.length,{timeout:5000});}catch(error){console.error(scenario.name,await page.evaluate(async()=>({events:loginSpeechEvents,state:WMOFInteractionState.state,plan:await SpeechMenu.planCommandChain('sync on trip goal 100')})));throw error;}
   assert.deepEqual(await page.evaluate(()=>loginSpeechEvents.filter(e=>e.type==='speechCommandDispatched').map(e=>e.executionContext)),expectedContexts,scenario.name+': resolved execution contexts');
   await page.waitForFunction(()=>WMOFCoordinator.lockCount===0&&WMOFStateTransactions.pending.length===0);
   await page.waitForFunction(count=>loginSpeechEvents.filter(e=>e.type==='speechCommandExecuted').length===count,expectedContexts.length);
   assert.deepEqual(await page.evaluate(()=>loginSpeechEvents.filter(e=>e.type==='speechCommandExecuted').map(e=>e.executionContext)),expectedContexts,scenario.name+': completion retains the captured contexts');
   assert.equal(await page.evaluate(()=>/one two three four|1234|okay/.test(webSpeechShadows.get(document.querySelector('#speechMicBar')).querySelector('#codes').textContent)),false,scenario.name+': no unprocessed PIN/OK text in Mic Bar');
   if(scenario.tail==='scheduled')assert(await page.locator('#scheduledStartDialog').evaluate(e=>e.open),'scheduled start follows authentication');
   if(scenario.tail==='settings')assert.equal(await page.locator('#clockTimer').evaluate(e=>e.getSummarySnapshot().trip.percentGoal),1,'goal follows authentication and sync');
   assert.deepEqual(errors,[]);
   if(scenario.name.startsWith('identical')||scenario.name.startsWith('distinct numeric')){
    const displays=await page.evaluate(()=>loginDisplaySnapshots);
    const limit=scenario.name.startsWith('identical')?2:1;
    for(const text of displays)assert((text.match(/1234 okay/g)||[]).length<=limit,scenario.name+': ID text must not multiply: '+text);
   }
   console.log('PASS rapid ID/OK/PIN/OK: '+scenario.name);
  }
  failLogin=true;
  await page.goto(new URL('order-filler.php',base).href);
  await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true'&&globalThis.SpeechMenu);
  await page.evaluate(async()=>{
   globalThis.failedLoginCommands=[];globalThis.failedLoginFinished=false;
   SpeechMenu.events.addEventListener('speechCommandDispatched',e=>failedLoginCommands.push(e.detail.commandElement?.getAttribute('speech-function')));
   SpeechMenu.events.addEventListener('utteranceUnrecognized',()=>failedLoginFinished=true);
   await SpeechMenu.start('en-US');await WMOFActions.handleSpeechRuntimeStarted();
  });
  await page.waitForFunction(()=>SpeechMenu.started&&!SpeechMenu.listeningSuspended);
  await page.evaluate(()=>nativeSpeechInstances.at(-1).emit(['5 5 5 5 5 5 5 5 sync on'],true));
  await page.waitForFunction(()=>failedLoginFinished&&WMOFCoordinator.lockCount===0&&WMOFStateTransactions.pending.length===0);
  assertFamily(await page.evaluate(()=>WMOFInteractionState.state),'LOGIN-PIN','failed authentication returns to PIN entry');
  assert.deepEqual(await page.evaluate(()=>failedLoginCommands),['WMOFActions.enterLoginCredentials'],'failed authentication cannot dispatch its suffix');
  console.log('PASS failed authentication blocks continuation and releases locks');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
