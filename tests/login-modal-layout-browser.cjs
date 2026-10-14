const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),assert=require('assert/strict'),WS=require('ws');
(async()=>{
 const repo=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync('D:/Temp/clocktimer-login-layout-'),profile=path.join(scratch,'edge');
 const source=fs.readFileSync(path.join(repo,'app.js'),'utf8');
 const boundary=source.slice(source.indexOf('    function refreshLoginBoundary()'),source.indexOf('    function voiceLoginText('));
 const index=fs.readFileSync(path.join(repo,'order-filler.html'),'utf8');
 const dialogs=['loginDialog','legacyLoginDialog','liveStreamDialog','userLookupDialog'].map(id=>index.match(new RegExp('<dialog id="'+id+'"[\\s\\S]*?</dialog>'))[0]).join('\n');
 const html=`<!doctype html><meta charset="utf-8"><style>${fs.readFileSync(path.join(repo,'app.css'),'utf8')}</style><style>.app-dialog{transition:none!important;opacity:1!important}#mic{position:fixed;bottom:0;left:0;width:100%;height:74px;background:#303a44}#micOptions{position:absolute;bottom:100%;height:0;width:100%}[hidden]{display:none!important}</style>${dialogs}<div id="mic"><div id="micOptions"></div></div><script>
 const loginDialog=document.getElementById('loginDialog'),legacyLoginDialog=document.getElementById('legacyLoginDialog'),speechMicBar=document.getElementById('mic');
 const $=selector=>document.querySelector(selector);
 const speechRecognitionEnabled=()=>!speechMicBar.hidden,popoverIsOpen=()=>!speechMicBar.hidden;
 speechMicBar.getSafeTop=()=>Math.min(speechMicBar.getBoundingClientRect().top,document.getElementById('micOptions').getBoundingClientRect().top);
 ${boundary}
 speechMicBar.addEventListener('speech-surface-boundary-change',refreshLoginBoundary);window.addEventListener('resize',refreshLoginBoundary);visualViewport.addEventListener('resize',refreshLoginBoundary);
 for(const id of ['loginLegacySwitch','loginVoiceSwitch'])document.getElementById(id).textContent=id==='loginVoiceSwitch'?'Login via voice':'Login with username and password';
 for(const id of ['loginButton','legacyLoginButton'])document.getElementById(id).textContent='OK';for(const id of ['loginDigitsCancel','legacyLoginCancel'])document.getElementById(id).textContent='Cancel';
 document.getElementById('voiceLoginPrompt').textContent='Please login using voice';document.getElementById('loginIdLabel').textContent='User ID';document.getElementById('loginPinLabel').textContent='PIN';
 document.getElementById('legacyLoginTitle').textContent='Login';document.getElementById('loginLegacyUsernameLabel').textContent='Username';document.getElementById('loginLegacyPasswordLabel').textContent='Password';
 for(const id of ['loginRecognitionStatus','legacyLoginRecognitionStatus'])document.getElementById(id).textContent='Voice recognition is on.';
 document.getElementById('liveStreamViewerSection').hidden=false;document.getElementById('profileEditor').hidden=false;document.getElementById('profileEditorFields').disabled=false;
 refreshLoginBoundary();</script>`;
 const pagePath=path.join(scratch,'layout.html');fs.writeFileSync(pagePath,html);
 const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore',env:{...process.env,TEMP:'D:/Temp',TMP:'D:/Temp'}});let ws;
 try{
  let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{}await new Promise(r=>setTimeout(r,100));}
  assert(port,'browser started');const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WS(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));let id=0;const pending=new Map();
  ws.on('message',data=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const frame=await call('Page.getFrameTree');await call('Page.setDocumentContent',{frameId:frame.frameTree.frame.id,html});await new Promise(r=>setTimeout(r,500));let checks=0;
  for(const [width,height] of [[1280,900],[360,640],[360,320],[320,240]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   for(const optionsHeight of [0,86])for(const dialogId of ['loginDialog','legacyLoginDialog','liveStreamDialog','userLookupDialog']){
    const result=await ev(`(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.getElementById('micOptions').style.height='${optionsHeight}px';speechMicBar.dispatchEvent(new Event('speech-surface-boundary-change'));const d=document.getElementById('${dialogId}');d.showModal();refreshLoginBoundary();const rect=d.getBoundingClientRect();const buttons=[...d.querySelectorAll('button')].filter(e=>!e.hidden && e.getClientRects().length);const clipped=[];for(const b of buttons){b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();if(r.bottom>rect.bottom+1||r.top<rect.top-1)clipped.push(b.id);}return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,safe:speechMicBar.getSafeTop(),width:innerWidth,scrollable:getComputedStyle(d).overflowY,clipped};})()`);
    assert(result.top>=-1 && result.bottom<=result.safe-7,JSON.stringify({width,height,optionsHeight,dialogId,result}));assert(result.left>=0&&result.right<=width);assert.equal(result.scrollable,'auto');assert.deepEqual(result.clipped,[],JSON.stringify({width,height,optionsHeight,dialogId,result}));checks++;
   }
  }
  await ev('speechMicBar.hidden=true;refreshLoginBoundary()');assert.equal(await ev('legacyLoginDialog.style.getPropertyValue("--login-safe-height")'),'240px');
  console.log(`PASS ${checks} login, Drop-In and profile modal layouts: desktop/mobile, short viewport, mic/options boundaries, reachable buttons, and recognition off`);
 }finally{ws?.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
