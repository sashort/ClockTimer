import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
const {compose,render,pages}=createRequire(import.meta.url)('../scripts/build-pages.cjs');
const root=fileURLToPath(new URL('..',import.meta.url));
const icons=fs.readFileSync(new URL('../MenuIcons.css',import.meta.url),'utf8');
for(const page of pages){
 const source=fs.readFileSync(new URL('../templates/'+page+'.html',import.meta.url),'utf8');
 assert.equal(source.trim(),'{{page:'+page+'}}','each page delegates to the shared document');
 const html=render(root,source),staticPage=fs.readFileSync(new URL('../'+page+'.html',import.meta.url),'utf8');
 assert.equal(html,staticPage,'static preview must be regenerated from shared templates');
 assert(!/\{\{(?:page|include|text|locale|speech|options|language-pack):?/.test(html),'all placeholders resolve');
 const w=new Window();w.document.write(html);
 for(const id of ['userLookupDialog','appVersion','language-pack'])assert.equal(w.document.querySelectorAll('#'+id).length,1,page+' includes '+id+' once');
 assert.equal(w.document.querySelectorAll('link[href^="MenuIcons.css"]').length,1);
 const menu=page==='index'?'#homeMenu button,#homeMenu a,#homeMenu summary,#signedOutActions button,#signedOutActions a':page==='order-filler'?'#mainMenu button:not(#menuButton),#mainMenu a,#mainMenu summary':'.drop-in-page-header a';
 for(const option of w.document.querySelectorAll(menu)){
  assert(option.dataset.menuIcon || option.querySelector('svg'),page+': missing icon for '+(option.id||option.textContent.trim()));
  if(option.dataset.menuIcon)assert(icons.includes('[data-menu-icon="'+option.dataset.menuIcon+'"]'),option.dataset.menuIcon+' must exist in the shared icon library');
 }
 if(page==='order-filler'){
  assert.equal(w.document.getElementById('easterEggMenuButton').dataset.menuIcon,'music');
  const play=w.document.getElementById('easterEggPlayButton');play.textContent='Resume';assert.equal(play.dataset.menuIcon,'play','icon survives playback label updates');
  assert(w.document.getElementById('easterEggSongSelect').options.length>=2,'keep all existing songs');
 }
 if(page==='index')assert(!w.document.querySelector('script[src^="app.js"]'),'landing page must not start the timer or microphone');
 await w.happyDOM.close();
}
for(const source of ['{{page:unknown}}','{{include:../index.html}}','{{include:/index.html}}','{{include:../lang/en-US/ui-text.json}}'])assert.throws(()=>compose(root,source));
console.log('PASS shared page composition, static parity, single dialogs, menu icon coverage, unchanged Easter Egg songs and template path restrictions');
