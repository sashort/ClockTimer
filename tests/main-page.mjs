import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const w=new Window({url:'https://clock.example/index.php'});
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert(!html.includes('src="app.js'),'landing page excludes timer and recognition boot');
w.document.body.innerHTML=html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
w.eval(fs.readFileSync(new URL('../IdentityContext.js',import.meta.url),'utf8'));
w.WMOFUserLookup=class{sync(){}setMode(){}clearSearch(){}};
w.eval(fs.readFileSync(new URL('../PanePage.js',import.meta.url),'utf8'));
const pane=w.document.getElementById('homePane');
assert.equal(pane.tagName,'PANE-PAGE','landing uses the shared animated pane');
assert.equal(w.document.querySelector('hamburger-menu'),null);
for(const id of ['homeAdmin','homeTrainer','homeDev']) {
 const button=w.document.getElementById(id);
 assert(button.dataset.homePane,'category navigates to a pane');
 assert.equal(w.document.getElementById(button.getAttribute('aria-controls')).hidden,true);
}
let pendingLogin, failLogout=false;
w.fetch=async(url,options={})=>{
 const body=options.body&&JSON.parse(options.body);
 if(body?.action==='connect')return new Promise(resolve=>{pendingLogin=resolve;});
 if(body?.action==='disconnect')return {ok:!failLogout,status:failLogout?503:200,json:async()=>({message:'offline'})};
 return {ok:false,status:401,json:async()=>({message:'unauthorized'})};
};
w.matchMedia=()=>({matches:true}); // Keep this model test independent of animation time.
for(const name of ['MainText','main'])w.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};await tick();
const $=id=>w.document.getElementById(id);
assert.equal($('signedOutActions').hidden,false);
$('mainLoginButton').click();assert.equal($('mainLoginDialog').open,true);
$('mainUsername').value='bobby';$('mainPassword').value='secret';
$('mainLoginForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
assert.equal($('signedInActions').hidden,true,'login is never optimistic');
pendingLogin({ok:false,json:async()=>({message:'wrong password'})});await tick();
assert.equal($('mainLoginDialog').open,true);assert.equal($('mainLoginStatus').textContent,'wrong password');
$('mainLoginForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
pendingLogin({ok:true,json:async()=>({user:{id:2,username:'bobby',permissions:64},csrfToken:'x'.repeat(32)})});await tick();
assert.equal($('signedInActions').hidden,false);
assert.equal(pane.activeView.dataset.paneView,'home');
assert.equal($('homeTrainer').hidden,false);assert.equal($('homeAdmin').hidden,true);assert.equal($('homeDev').hidden,true);
assert.equal($('signedInActions').querySelector('a').getAttribute('href'),'order-filler.php?session=existing');
assert.equal($('mainPassword').value,'');
$('homeTrainer').click();await tick();
assert.equal(pane.activeView.dataset.paneView,'trainer');
assert.equal(pane.depth,1);
assert.equal(w.document.activeElement,pane.activeView.querySelector('[data-home-back]'));
pane.activeView.querySelector('[data-home-back]').click();await tick();
assert.equal(pane.activeView.dataset.paneView,'home');
assert.equal(w.document.activeElement,$('homeTrainer'),'Back restores the invoking button focus');

failLogout=true;$('homeLogoutButton').click();await tick();assert.equal($('signedInActions').hidden,false,'failed logout retains authenticated menu');
failLogout=false;$('homeLogoutButton').click();await tick();assert.equal($('signedOutActions').hidden,false);
assert.equal(pane.activeView.dataset.paneView,'home','logout resets navigation');
assert.equal(pane.depth,0);
await w.happyDOM.close();
console.log('PASS landing login rejection/acceptance, pane navigation, role categories, session handoff and confirmed logout');
