import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const w=new Window({url:'https://clock.example/'}),doc=w.document;
doc.body.innerHTML='<main id="app" data-trip-list-state="open"><button id="tripLogButton"></button><div id="tripLogBody"></div><button id="tripLogCloseButton"></button><button id="tripLogSettingsButton"></button></main>';
for(const file of ['CalendarRange.js','TripAggregates.js','TripLog.js'])w.eval(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const metrics=appSource.slice(appSource.indexOf('    function getAppContentMetrics()'),appSource.indexOf('    async function animateTripLogButton('));
const body=appSource.slice(appSource.indexOf('    function getTripLogBodyRect()'),appSource.indexOf('    speechMicBar\n        ?.addEventListener',appSource.indexOf('    function getTripLogBodyRect()')));
const render=appSource.slice(appSource.indexOf('    function renderTripLog(data, calendar)'),appSource.indexOf('    function setTripProductionFilter('));
w.eval(`
const app=document.getElementById('app'),tripLogButton=document.getElementById('tripLogButton'),tripLogBody=document.getElementById('tripLogBody'),tripLogCloseButton=document.getElementById('tripLogCloseButton'),tripLogSettingsButton=document.getElementById('tripLogSettingsButton');
app.getBoundingClientRect=()=>({left:0,top:0,right:360,bottom:640});
Object.defineProperty(tripLogButton,'offsetHeight',{value:74});
tripLogButton.getBoundingClientRect=()=>({left:0,top:500,right:360,bottom:574}); // Closed slot deliberately differs from the open header.
window.innerWidth=360;window.innerHeight=640;
window.getComputedStyle=()=>({paddingLeft:'0',paddingRight:'0',paddingTop:'0',paddingBottom:'0',getPropertyValue:()=>0,color:'#fff'});
let micTop=566;const speechMicBar={getSafeTop:()=>micTop,getBoundingClientRect:()=>({top:micTop})};
window.requestAnimationFrame=callback=>{queueMicrotask(()=>callback(0));return 1;};
let tripLogView,tripLogSettingsVisible=false,endTimeGoalOverride;
const getTripLogRange=()=> 'day',getTripLogIncludeCurrent=()=>false,tripIsLive=()=>false;
const setTripLogIncludeCurrent=()=>{},setTripLogRange=()=>{},setTripProductionFilter=()=>{},renderTripActionState=()=>{},renderSyncGoalsState=()=>{},updateSummaryValues=()=>{};
const calendar={startTime:'2026-10-06T00:00:00Z',endTime:'2026-10-07T00:00:00Z',cutoffTime:'00:00:00',weekStartDay:6};
let trips=[{id:1,startTime:'2026-10-06 12:00:00',standardTimeMilliseconds:600000,actualTimeMilliseconds:600000,events:[]},{id:2,startTime:'2026-10-06 13:00:00',standardTimeMilliseconds:600000,actualTimeMilliseconds:600000,events:[]}];
const clockTimer={productionFilter:'all',networkStatus:'online',async tripEditorRequest(id,change){if(change){trips=trips.filter(t=>t.id!==id);micTop=620;}return {revision:'r1'};}};
function dispatchTripListRequest(){renderTripLog({trips},calendar);}
${metrics}
${body}
${render}
window.fixture={app,tripLogButton,tripLogBody,dispatchTripListRequest,get view(){return tripLogView;},resetMic(){micTop=566;}};
`);
w.confirm=()=>true;const fixture=w.fixture;fixture.dispatchTripListRequest();
const bottom=()=>parseFloat(fixture.tripLogBody.style.top)+parseFloat(fixture.tripLogBody.style.height);
assert.equal(bottom(),566);assert.equal(fixture.tripLogButton.style.top,'0px');
await fixture.view.deleteTrip(fixture.view.trips[0]);await new Promise(r=>setTimeout(r,10));
assert.equal(fixture.view.trips.length,1);assert.equal(bottom(),620,'deletion must remeasure the current mic boundary');assert.equal(fixture.tripLogButton.style.top,'0px','open header must not use the closed button slot');assert.equal(fixture.app.dataset.tripListState,'open');
fixture.resetMic();await fixture.view.deleteTrip(fixture.view.trips[0]);await new Promise(r=>setTimeout(r,10));
assert(fixture.tripLogBody.classList.contains('trip-log-empty'));assert(fixture.view.settingsVisible);assert.equal(bottom(),620);assert.equal(fixture.tripLogButton.style.top,'0px');
console.log('PASS Trip Log deletion reconciles current open header/mic geometry, keeps the log open and preserves last-trip empty/settings layout');
await w.happyDOM.close();
