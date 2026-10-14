// Run with Node and a local Edge browser; EDGE_PATH can override its location.
const fs=require('fs'),assert=require('assert/strict'),{spawn}=require('child_process'),path=require('path'),os=require('os');
(async()=>{
const repo=require('path').resolve(__dirname,'..'),read=n=>fs.readFileSync(repo+'/'+n,'utf8');
const markup=read('drop-in.html').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'clocktimer-menu-edge-'));
const child=spawn(process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=readPort();break;}catch{}await new Promise(r=>setTimeout(r,100));}function readPort(){return fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];}
 assert(port);const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};


 await call('Emulation.setDeviceMetricsOverride',{width:360,height:420,deviceScaleFactor:1,mobile:false});
 const frame=await call('Page.getFrameTree');await call('Page.setDocumentContent',{frameId:frame.frameTree.frame.id,html:'<style>'+read('app.css')+read('MenuIcons.css')+read('drop-in.css')+'</style>'+markup});
 await ev('globalThis.WMOFLanguagePack={text:id=>id}');await ev(read('PanePage.js'));await ev(read('HamburgerMenu.js'));
 await ev('document.getElementById("dropInMenu").showPopover()');await new Promise(r=>setTimeout(r,700));
 const state=()=>ev('(()=>{const m=document.getElementById("dropInMenu");return {count:m.pageCount,index:m.page,panels:[...m.querySelectorAll(".hamburger-menu-panel")].map(p=>({height:p.getBoundingClientRect().height,rows:[...p.children].map(x=>({text:x.textContent,height:x.getBoundingClientRect().height,style:x.getAttribute("style")}))}))};})()');
 const before=await state();assert(before.count>1);
 await ev('(()=>{const m=document.getElementById("dropInMenu"),p=document.getElementById("dropInViewSettingsButton").closest(".hamburger-menu-panel");m.goToPage([...m.querySelectorAll(".hamburger-menu-panel")].indexOf(p),{smooth:false});})()');await new Promise(r=>setTimeout(r,600));assert.equal(await ev('document.getElementById("dropInMenu").page'),2);
 for(let i=0;i<3;i++){await ev('document.getElementById("dropInViewSettingsButton").click()');await new Promise(r=>setTimeout(r,1800));await ev('document.getElementById("dropInViewSettingsButton").click()');await new Promise(r=>setTimeout(r,1800));const after=await state();assert.equal(after.count,before.count);assert.equal(after.index,2);}

 await ev('document.getElementById("dropInMenu").goToPage(0,{smooth:false})');await new Promise(r=>setTimeout(r,600));
 const samples=await ev(`(async()=>{const m=document.getElementById('dropInMenu'),v=m.querySelector('.hamburger-menu-viewport'),t=m.querySelector('.hamburger-menu-indicator-thumb');m.goToPage(1);const values=[];for(let i=0;i<35;i++){await new Promise(requestAnimationFrame);const progress=v.scrollLeft/v.clientWidth,transform=new DOMMatrixReadOnly(getComputedStyle(t).transform);values.push({progress,thumb:transform.m41/t.getBoundingClientRect().width});}return values;})()`);
 const moving=samples.filter(s=>s.progress>.02&&s.progress<.98);assert(moving.length>2,'sample intermediate animation positions');
 for(const s of moving)assert(Math.abs(s.progress-s.thumb)<.025,JSON.stringify(s));

 for(const [page,menuId,parents] of [['order-filler','mainMenu',['settingsMenuButton','tripLogMenuParentButton','recognizerNameMenuButton']],['index','homeMenu',['homeAdmin','homeTrainer','homeDev']]]){
  await call('Page.navigate',{url:'about:blank'});await new Promise(r=>setTimeout(r,100));
  const body=read(page+'.html').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
  await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:false});
  const pageFrame=await call('Page.getFrameTree');
  await call('Page.setDocumentContent',{frameId:pageFrame.frameTree.frame.id,html:'<style>'+read('app.css')+read('MenuIcons.css')+(page==='index'?read('main.css'):'')+'</style>'+body});
  await ev('globalThis.WMOFLanguagePack={text:id=>id}');await ev(read('PanePage.js'));await ev(read('HamburgerMenu.js'));
  if(page==='index')await ev('document.getElementById("signedInActions").hidden=false;'+parents.map(id=>'document.getElementById('+JSON.stringify(id)+').hidden=false;').join(''));
  await ev('document.getElementById('+JSON.stringify(menuId)+').showPopover()');await new Promise(r=>setTimeout(r,650));
  for(const id of parents){
   const buttonExpression=page==='index'?'document.getElementById('+JSON.stringify(id)+').querySelector("button[aria-controls]")':'document.getElementById('+JSON.stringify(id)+')';
   assert(await ev('(()=>{const b='+buttonExpression+',s=document.getElementById(b.getAttribute("aria-controls"));return b.getAttribute("aria-expanded")==="false"&&s.hidden&&getComputedStyle(s).display==="none";})()'),'initially collapsed '+id);
   await ev(buttonExpression+'.click()');await new Promise(r=>setTimeout(r,1800));
   assert(await ev(buttonExpression+'.getAttribute("aria-expanded")==="true"'),'opens '+id);
   await ev(buttonExpression+'.click()');await new Promise(r=>setTimeout(r,1800));
   assert(await ev(buttonExpression+'.getAttribute("aria-expanded")==="false"'),'collapses '+id);
  }
 }
 console.log('PASS later-panel restoration, continuous swipe tracking, and initially collapsed animated parents on Order Filler and landing');
}finally{ws?.close();child.kill();}
})().catch(e=>{console.error(e);process.exit(1);});


