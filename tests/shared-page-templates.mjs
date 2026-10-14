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
 if(html!==staticPage){
  let difference=0;
  while(difference<html.length&&difference<staticPage.length&&html[difference]===staticPage[difference])difference++;
  console.error('Static preview mismatch for',page,'at',difference,'rendered length',html.length,'static length',staticPage.length,
   '\\nrendered:',JSON.stringify(html.slice(Math.max(0,difference-160),difference+240)),
   '\\nstatic:',JSON.stringify(staticPage.slice(Math.max(0,difference-160),difference+240)));
 }
 assert.equal(html,staticPage,'static preview must be regenerated from shared templates: '+page);
 assert(!/\{\{(?:page|include|text|locale|speech|options|language-pack):?/.test(html),'all placeholders resolve');
 const w=new Window();w.document.write(html);
 for(const id of ['userLookupDialog','appVersion','language-pack'])assert.equal(w.document.querySelectorAll('#'+id).length,1,page+' includes '+id+' once');
 assert.equal(w.document.getElementById('userLookupDialog').dataset.persistenceBehavior,'Wait Async',page+' uses the shared Account Lookup persistence policy');
 assert.equal(w.document.querySelector('#userLookupLiveStream'),null,page+' has no mounted Drop-In action in Account Lookup');
 assert.equal(w.document.querySelector('#userLookupCopySelected'),null,'Copy Identity is removed');
 assert.equal(w.document.querySelectorAll('#editProfilePermissions input[type=checkbox]').length,8,'permissions use named choices');
 assert.equal(Boolean(w.document.getElementById('dropInLookupActionTemplate')),page==='drop-in','only Drop-In owns its action template');
 assert.equal(w.document.querySelectorAll('link[href^="MenuIcons.css"]').length,1);
 const menu=page==='index'?'#homeMenu button:not(#homeMenuButton),#homeMenu a,#signedOutActions button,#signedOutActions a':page==='order-filler'?'#mainMenu button:not(#menuButton),#mainMenu a,#mainMenu summary':'#dropInMenu button:not(#dropInMenuButton),#dropInMenu a';
 for(const option of w.document.querySelectorAll(menu)){
  assert(option.dataset.menuIcon || option.querySelector('svg'),page+': missing icon for '+(option.id||option.textContent.trim()));
  if(option.dataset.menuIcon)assert(icons.includes('[data-menu-icon="'+option.dataset.menuIcon+'"]'),option.dataset.menuIcon+' must exist in the shared icon library');
 }
 if(page==='order-filler'){
  for(const id of ['settingsMenuButton','tripLogMenuParentButton','recognizerNameMenuButton']) {
   const button=w.document.getElementById(id),submenu=w.document.getElementById(button.getAttribute('aria-controls'));
   assert.equal(button.getAttribute('aria-expanded'),'false');assert(submenu.hidden,'Order Filler parent sub-items must start collapsed');
  }
  for(const id of ['tripListMenuButton','tripProductionFilter','tripLogRangeSelect','tripLogStartDate','tripLogEndDate'])assert(w.document.getElementById('tripLogSubmenu').contains(w.document.getElementById(id)),'Trip Log action and filters belong inside its collapsed submenu');
  assert.equal(w.document.querySelector('#mainMenu details'),null,'menu parents use shared animation, not native details');
  for(const id of ['adminMenuGroup','trainerMenuGroup'])assert.equal(w.document.getElementById(id),null,'landing page owns admin and trainer categories');
  assert.equal(w.document.getElementById('easterEggMenuButton').dataset.menuIcon,'music');
  assert.equal(w.document.getElementById('easterEggMenuButton').getAttribute('href'),'api/audio/easter-eggs/');
  assert.equal(w.document.getElementById('easterEggSongSelect'),null,'songs move to the native audio endpoint');
 }
 if(page !== 'index') {
  const body=fs.readFileSync(new URL('../templates/pages/'+page+'/body.html',import.meta.url),'utf8');
  assert(body.includes('{{include:shared/timer-view.html}}'),'timer pages must compose the actual shared display');
  const timerRoot=w.document.querySelector(page==='order-filler'?'#app':'.app.live-stream-mirror');
  assert.deepEqual([...timerRoot.children].slice(0,5).map(node=>node.className),
   ['app-header','trip-summary',page==='order-filler'?'trip-action-controls':'viewer-timer-controls','summary-spacer','clock-region']);
  assert.equal(timerRoot.querySelectorAll('.clock-region > clock-timer').length,1);
  assert.equal(timerRoot.querySelectorAll('.trip-summary .summary-cell').length,2);
  assert.equal(timerRoot.querySelectorAll('.trip-summary .percent-summary').length,1);
  if(page==='drop-in') {
   assert.equal(w.document.getElementById('scopeConnectionButton'),null,'no cloud control for observer');
   assert(w.document.getElementById('scopeToggle'));assert(w.document.getElementById('dropInMicrophoneButton'));
   assert.equal(w.document.getElementById('dropInDefaultsButton'),null,'one unified Settings group');
   assert.equal(w.document.getElementById('dropInAudioSettingsButton'),null,'audio belongs inside Settings');
   assert(w.document.querySelector('#dropInViewSettings #liveStreamVolumeControls'));
   assert(w.document.querySelector('#dropInViewSettings #dropInSaveDefault'));
   assert.equal(w.document.querySelectorAll('[data-settings-default]').length,3);
   assert(w.document.getElementById('dropInClockSettings'));
   assert(w.document.querySelector('script[src^="PanePage.js"]'),'viewer menu requires shared pane runtime');
   for(const id of ['newTripButton','endTripButton','breakButton','downButton','tripListButton','tripListMenuButton'])
    assert.equal(w.document.getElementById(id),null,'observer cannot expose publisher actions');
   for(const id of ['liveStreamViewMode','liveStreamViewPercent','liveStreamViewSync','liveStreamTrainerMessageSend','liveStreamUserSelect'])
    assert(w.document.getElementById(id),'retain viewer control '+id);
  }
 }
 if(page==='index')assert(!w.document.querySelector('script[src^="app.js"]'),'landing page must not start the timer or microphone');
 await w.happyDOM.close();
}
for(const source of ['{{page:unknown}}','{{include:../index.html}}','{{include:/index.html}}','{{include:../lang/en-US/ui-text.json}}'])assert.throws(()=>compose(root,source));
console.log('PASS shared page composition, static parity, single dialogs, menu icon coverage, unchanged Easter Egg songs and template path restrictions');
