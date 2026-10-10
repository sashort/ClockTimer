import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const window=new Window({settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
const html=fs.readFileSync(new URL('../order-filler.html',import.meta.url),'utf8');
window.document.body.innerHTML=html.slice(html.indexOf('<main'),html.indexOf('<script src='));
const document=window.document;
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const field=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const app=document.querySelector('#app'),tripLogButton=document.querySelector('#tripLogButton'),
    tripLogBody=document.querySelector('#tripLogBody'),tripLogDialog=document.querySelector('#tripLogDialog'),
    tripLogPlaceholder=document.querySelector('#tripLogPlaceholder'),voice=document.querySelector('#voiceEntrySurface');
assert.equal(tripLogDialog.tagName,'DIALOG');assert.equal(voice.tagName,'DIALOG');assert(!voice.hasAttribute('popover'));
const home=tripLogButton.parentElement;app.dataset.tripListState='closed';
const scheduled=document.querySelector('#scheduledStartDialog');scheduled.showModal();
voice.hidden=false;voice.showModal();voice.querySelector('#voiceEntryValue').textContent='22:56';
tripLogButton.getBoundingClientRect=()=>({left:12,top:590,width:340,height:74});
let pinned=true;
const top={left:12,top:80,width:340,height:74},body={left:12,top:154,width:340,height:430};
const bindings={window,document,CustomEvent:window.CustomEvent,app,tripLogButton,tripLogBody,tripLogDialog,tripLogPlaceholder,
    tripLogSettingsButton:document.querySelector('#tripLogSettingsButton'),tripLogView:undefined,
    getTripListState:()=>app.dataset.tripListState,tripLogIsPinned:()=>pinned,getTripLogTopRect:()=>top,
    getTripLogBodyRect:()=>body,getTripLogBottomRect:()=>({left:12,top:590,width:340,height:74}),
    getTripLogRange:()=> 'day',setTripLogPinned(){},dispatchTripListRequest(){},
    wait:async()=>{},animateTripLogButton:async()=>{},showTripLogMerge:async()=>{},hideTripLogMerge:async()=>{},
    animateTripLogBody:async(rect,opening)=>{if(opening) Object.assign(tripLogBody.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});},
    TRIP_LIST_BODY_DELAY:0,TRIP_LIST_MERGE_DURATION:0,TRIP_LIST_BODY_DURATION:0,TRIP_LIST_BUTTON_TRANSITION_DURATION:0};
const code=field('    function setFloatingTripLogRect(', '    async function animateTripLogButton(')+
    field('    function setFloatingTripLogBodyRect(', '    function positionTripLogCloseButton(')+
    field('    async function openTripList(', '    function getStoredJSON(');
const workflow=new Function(...Object.keys(bindings),`let tripLogSettingsVisible;${code};return {openTripList,closeTripList};`)(...Object.values(bindings));
Object.assign(globalThis,{WMOFLanguagePack:window.WMOFLanguagePack,window,document,Element:window.Element,HTMLElement:window.HTMLElement,EventTarget:window.EventTarget,
    CustomEvent:window.CustomEvent,getComputedStyle:window.getComputedStyle.bind(window),requestAnimationFrame:cb=>queueMicrotask(()=>cb(performance.now()))});
Function(fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8'))();
const Speech=globalThis.SpeechMenu;
Speech.registerSurface(scheduled,{priority:100,isOpen:()=>scheduled.open,close:()=>{scheduled.close();return true;}});
Speech.registerSurface(voice,{priority:100,isOpen:()=>voice.open,close:()=>{voice.close();return true;},cancel:()=>{voice.close();return true;}});
Speech.registerSurface(tripLogDialog,{priority:100,isOpen:()=>tripLogDialog.open,close:()=>workflow.closeTripList(),cancel:()=>workflow.closeTripList()});
Speech.surfaceOpened(scheduled);Speech.surfaceOpened(voice);
assert.equal(Speech.activeSurface,voice);
assert.equal(await workflow.openTripList('speech'),true);
assert(tripLogDialog.open);assert(voice.open);assert(scheduled.open,'underlying dialogs remain open');
assert.equal(tripLogButton.parentElement,tripLogDialog);assert.equal(tripLogPlaceholder.hidden,false);
assert.equal(tripLogPlaceholder.style.height,'74px');assert.equal(tripLogButton.style.left,'12px');
assert.equal(tripLogButton.style.width,'340px');assert.equal(tripLogBody.style.height,'430px');
assert.equal(Speech.activeSurface,tripLogDialog,'top follows activation order, not document order');
assert.equal(await Speech.close(),true);
assert(!tripLogDialog.open);assert(voice.open);assert(scheduled.open);
assert.equal(voice.querySelector('#voiceEntryValue').textContent,'22:56','speech pad value survives log dismissal');
assert.equal(tripLogButton.parentElement,home);assert(tripLogPlaceholder.hidden);assert(tripLogBody.hidden);
assert.equal(tripLogButton.style.position,'');assert(!tripLogButton.classList.contains('trip-log-floating'));
assert.equal(Speech.activeSurface,voice);
pinned=false;assert.equal(await workflow.openTripList('speech'),true);assert(tripLogPlaceholder.hidden);
assert.equal(await Speech.cancel(),true);assert.equal(Speech.activeSurface,voice);
assert.equal(await Speech.cancel(),true);assert(!voice.open);assert.equal(Speech.activeSurface,scheduled);
assert.equal(await Speech.close(),true);assert.equal(await Speech.close(),false,'no open surface can be dismissed');
const refused=document.createElement('dialog');document.body.append(refused);refused.showModal();
Speech.registerSurface(refused,{priority:100,isOpen:()=>refused.open,close:()=>false});
Speech.surfaceOpened(refused);assert.equal(await Speech.close(),false);assert(refused.open,'failed close leaves the surface open');
assert.equal(await workflow.closeTripList(),false,'closing an already closed log fails');
console.log('PASS native dialog structure, production log open/close, fixed geometry styles, pinned/unpinned restoration, preserved speech-pad state, actual top ordering and dismissal failure');
