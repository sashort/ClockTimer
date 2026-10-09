import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from './LanguageWindow.mjs';
const html=fs.readFileSync(new URL('../drop-in.html',import.meta.url),'utf8');
assert(!/src="(?:app|SherpaRecognizer|SpeechMicBar)\.js/.test(html),'standalone viewer loads no main app or microphone engine');
assert(!html.includes('id="tripListButton"'),'viewer omits Trip Log');
assert(html.includes('src="api/audio/AudioEngine.js"'),'viewer retains remote speech playback');
const w=new Window({url:'https://clock.example/drop-in.php'});w.structuredClone=structuredClone;
w.document.body.innerHTML=html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
w.eval(fs.readFileSync(new URL('../DropInPreferences.js',import.meta.url),'utf8'));
w.eval(fs.readFileSync(new URL('../IdentityContext.js',import.meta.url),'utf8'));
w.eval(fs.readFileSync(new URL('../ObserverSettingBadge.js',import.meta.url),'utf8'));
w.eval(fs.readFileSync(new URL('../ModeMenu.js',import.meta.url),'utf8'));
w.eval(fs.readFileSync(new URL('../TimerAppearance.js',import.meta.url),'utf8'));
const events=[],errors=[],stored=new Map();let rejectStart=false;
w.WMOFPersistence={async getItem(key){return stored.get(key);},async setItem(key,value){stored.set(key,value);}};
w.WMOFAccountSettings={async load(){},peek:()=>stored.get('settings'),async write(namespace,changes){stored.set('settings',changes.preferences);}};
w.addEventListener("error",event=>errors.push(event.message));
w.WMOFLiveTripStream=class extends w.EventTarget {
 constructor(){super();w.testStream=this;this.viewing=false;}
 async stopViewing(){events.push('stop');this.viewing=false;this.dispatchEvent(new w.CustomEvent('viewerChanged'));}
 async startViewing(id){events.push('start:'+id);if(rejectStart)throw new Error('permission revoked');this.viewing=true;this.targetUserId=id;this.dispatchEvent(new w.CustomEvent('viewerChanged',{detail:{state:'connected'}}));}
 async sendToPublisher(type,payload){events.push({target:this.targetUserId,type,payload});}
 async close(){events.push('close');this.viewing=false;}
 async fetchViewerTrips(window,options){events.push({logTarget:this.targetUserId,window,options});return {trips:[{startTime:'2026-10-08 12:00:00',endTime:'2026-10-08 12:10:00',standardTimeMilliseconds:600000,actualTimeMilliseconds:600000}]};}
};
w.WMOFDropInView=class {
 constructor(){w.testView=this;}
 clear(){events.push('clear');}
 setUser(id){this.userId=id;events.push('user:'+id);}
 update(snapshot){this.snapshot=snapshot;events.push('snapshot:'+snapshot.userId);}
 duration(ms){return String(ms);}
 destroy(){events.push('destroy');}
};
w.WMOFUserLookup=class {constructor(options){w.testLookup=options;}setMode(){}sync(){}};
w.WMOFDropInText=key=>key;
w.fetch=async()=>({ok:true,json:async()=>({user:{id:1,permissions:192}})});
w.eval(fs.readFileSync(new URL('../drop-in.js',import.meta.url),'utf8'));
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};await tick();
const identity=id=>({userId:id,firstName:'Test',lastName:String(id),username:'test'+id});
w.testLookup.onLiveStream(identity(2));await tick();
assert.equal(w.testStream.targetUserId,2);
assert.equal(w.document.getElementById('liveStreamWatchedName').textContent,'Test 2');
w.document.getElementById('liveStreamTrainerMessageText').value='hello';
w.document.getElementById('liveStreamTrainerMessageSend').click();await tick();
assert.deepEqual(JSON.parse(JSON.stringify(events.find(e=>e?.type==='trainer.tts'))),{target:2,type:'trainer.tts',payload:{text:'hello'}});
w.document.getElementById('liveStreamTrainerMessageText').value='unsent';
w.testLookup.onLiveStream(identity(3));await tick();
assert.equal(w.document.getElementById('liveStreamTrainerMessageText').value,'');
assert(events.indexOf('stop',events.indexOf('start:2'))<events.indexOf('start:3'),'stop old peer before starting new target');
const $=id=>w.document.getElementById(id),change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change'));};
change('liveStreamViewMode','user');assert.equal($('dropInTargetChoice').textContent,'Mirror — -');assert.equal($('dropInTargetChoice').dataset.menuIcon,'mirror');assert($('dropInTargetChoice').classList.contains('mirror-option'));$('dropInTargetCancel').click();
change('liveStreamViewMode','year');assert.equal($('dropInTargetDialog').open,true);$('dropInTargetCancel').click();assert.equal($('liveStreamViewMode').value,'user');
change('liveStreamViewMode','day');$('dropInTargetApply').click();await tick();assert.equal($('dropInMirrorSettings').checked,false);
$('dropInMirrorSettings').checked=true;$('dropInMirrorSettings').dispatchEvent(new w.Event('change'));$('dropInApplySelected').click();await tick();assert.equal($('liveStreamViewMode').value,'user');
$('dropInMirrorSettings').checked=false;$('dropInMirrorSettings').dispatchEvent(new w.Event('change'));$('dropInApplySelected').click();await tick();assert.equal($('liveStreamViewMode').value,'day','Mirror off restores custom mode');
$('toggleSyncMenuButton').click();assert.equal($('dropInSyncPopover').hidden,false);$('dropInSyncPopover').querySelector('[data-sync=off]').click();assert.equal($('dropInTargetDialog').open,true);$('dropInTargetDefault').checked=true;$('dropInTargetUser').checked=true;$('dropInTargetApply').click();await tick();
change('liveStreamViewMode','year');$('dropInTargetDefault').checked=false;$('dropInTargetUser').checked=false;$('dropInTargetUser').dispatchEvent(new w.Event('change'));assert.equal($('dropInTargetApply').disabled,true);$('dropInTargetCancel').click();
assert.equal($('dropInSyncPopover').querySelector('[data-sync=user]').dataset.menuIcon,'mirror');
const state=JSON.parse([...stored.values()][0]);assert.equal(state.defaults.view.sync,'off');assert.equal(state.users['2'],undefined,'Default/User targeting does not customize another person');assert.equal(state.users['3'].sources.view.sync,'default');assert(!Object.hasOwn(state.users['3'].custom.view,'sync'),'matching Sync override is cleared');
w.eval(fs.readFileSync(new URL('../CalendarRange.js',import.meta.url),'utf8'));w.testView.snapshot={timestamp:'2026-10-08T12:00:00Z',viewData:{range:'week',calendars:[{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',rules:{weekStartDay:0,cutoffTime:'00:00:00',effectiveFrom:'2026-01-01',recurring:true}}]}};
const sourceChoice=$('dropInSettingsSource');
const chooseSource=async value=>{sourceChoice.value=value;sourceChoice.dispatchEvent(new w.Event('change'));$('dropInApplySelected').click();await tick();};
const retainedMode=$('liveStreamViewMode').value;
await chooseSource('default');assert.equal($('liveStreamViewMode').value,'trip','Default uses saved baseline');
assert.match($('dropInSettingsApplied').textContent,/Default/);
await chooseSource('custom');assert.equal($('liveStreamViewMode').value,retainedMode,'Custom restores per-user choices');
await chooseSource('user');assert.equal($('liveStreamViewMode').value,'user');assert.match($('dropInSettingsApplied').textContent,/User/);
await chooseSource('custom');
const live={userId:3,timestamp:'2026-10-08T12:00:00Z',viewData:{...w.testView.snapshot.viewData,mode:'total',range:'week',appearance:{attributes:{'timer-type':'radial-fitted'},variables:{'--clock-timer-trip-color':'#123456'}}},uiState:{sync_enabled:true,trip_goal_component:{value:1.2,text:'120%'},total_goal_component:{value:1.1,text:'110%'}}};
w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:3,snapshot:live}}));
$('scopeToggle').click();assert.equal($('scopeToggleDropdown').querySelector('[data-mode=user] .mode-option-label').textContent,'Mirror — Week');assert.equal($('scopeToggleDropdown').querySelector('[data-mode=week] .observer-source-badge').dataset.source,'user');
live.viewData.range='year';w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:3,snapshot:live}}));assert.equal($('scopeToggleDropdown').querySelector('[data-mode=user] .mode-option-label').textContent,'Mirror — Year','open mode menu follows live user');
$('scopeToggle').click();$('toggleSyncMenuButton').click();assert.equal($('dropInSyncPopover').querySelector('[data-sync=user] .mode-option-label').textContent,'Mirror — On');assert.equal($('dropInSyncPopover').querySelector('[data-sync=off] .observer-source-badge').dataset.source,'default');
live.uiState.sync_enabled=false;w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:3,snapshot:live}}));assert.equal($('dropInSyncPopover').querySelector('[data-sync=user] .mode-option-label').textContent,'Mirror — Off');assert.equal($('dropInSyncPopover').querySelector('[data-sync=off] .observer-source-badge').dataset.source,'default-user');
assert.match($('dropInClockSettings').textContent,/Timer layout/);assert.match($('dropInClockSettings').textContent,/#123456/);$('toggleSyncMenuButton').click();
$('dropInTripLogButton').click();await tick();assert.equal(events.find(e=>e?.logTarget).logTarget,3,'log targets observed user rather than observer');assert.equal($('dropInTripLogRows').children.length,1);$('dropInTripLogCancel').click();
w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:2,snapshot:{userId:2}}}));
assert(!events.includes('snapshot:2'),'old target snapshot ignored');
w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:3,snapshot:{userId:3}}}));
assert(events.includes('snapshot:3'));
// A temporary media transport interruption retains the last snapshot. A new
// target-specific snapshot updates it after reconnection without changing users.
w.testStream.dispatchEvent(new w.CustomEvent('viewerChanged',{detail:{state:'disconnected'}}));
assert.equal(w.document.getElementById('liveStreamViewerStatus').textContent,'disconnected');
w.testStream.dispatchEvent(new w.CustomEvent('viewerChanged',{detail:{state:'connected'}}));
w.testStream.dispatchEvent(new w.CustomEvent('snapshot',{detail:{targetUserId:3,snapshot:{userId:3}}}));
assert.equal(events.filter(value=>value==='snapshot:3').length,5);
// Full peer loss clears the mirror and disables messaging, then Watch reauthorizes.
await w.testStream.stopViewing();await tick();
assert.equal(w.document.getElementById('liveStreamViewerStatus').textContent,'Not viewing.');
assert.equal(w.document.getElementById('liveStreamTrainerMessage').disabled,true);
w.document.getElementById('liveStreamWatchButton').click();await tick();
assert.equal(w.testStream.targetUserId,3);
assert.equal(w.testStream.viewing,true);
assert.deepEqual(errors,[],'disconnection and recovery must resolve real language resources');
rejectStart=true;w.document.getElementById('liveStreamPreviousUser').click();await tick();
assert.equal(w.document.getElementById('liveStreamViewerStatus').textContent,'permission revoked','failure remains visible after controls refresh');
assert.equal(w.document.getElementById('liveStreamTrainerMessage').disabled,true);
assert.equal(w.testStream.viewing,false,'failed authorization does not optimistically connect');
rejectStart=false;$('dropInRemoveUser').click();await tick();assert.equal(w.testView.userId,3);assert.equal($('liveStreamViewMode').value,'day','switch after removal restores remaining user custom preferences');$('dropInRemoveUser').click();await tick();assert.match($('liveStreamWatchedName').textContent,/^[—-]$/);assert.equal($('liveStreamTrainerMessage').disabled,true);
assert.equal($('liveStreamViewTime').closest('.live-stream-view-controls').hidden,true,'Settings cannot edit time display');
assert.equal($('dropInSettingsMode'),null,'Mode comparison belongs in its popover');
assert($('dropInClockSettings'),'Settings retains live read-only ClockTimer settings');
assert.equal($('dropInDefaultMode'),null,'default display information is read-only');
// Defaults remain editable without a selected user and do not rewrite saved user profiles.
const previousUsers=JSON.stringify(JSON.parse([...stored.values()][0]).users);
const defaultAudio=w.document.querySelector('[data-default-audio="master"]');defaultAudio.value='75';defaultAudio.dispatchEvent(new w.Event('change'));await tick();
assert.equal(JSON.parse([...stored.values()][0]).defaults.audio.master,75);
assert.equal(w.document.querySelector('[data-settings-default="audio.master"]').textContent,'Default: 75%');
const destinations=[];w.location.assign=value=>destinations.push(String(value));$('dropInExitButton').click();await tick();assert(events.includes('close'));assert(events.includes('destroy'));assert.deepEqual(destinations,['https://clock.example/index.php']);
await w.happyDOM.close();
console.log('PASS standalone Drop-In session, serialized switching, message targeting, stale snapshots and failed authorization');
