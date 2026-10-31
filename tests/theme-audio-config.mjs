import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),listeners={},calls=[];
const defaultWindows=JSON.parse(read('api/audio/themes/default/windows.json'));
defaultWindows.windows.example={opening:{cue:'setting-on'},sustained:{instrument:'keypad-dial-tone'},closing:{cue:'setting-off'},controls:{buttons:{apply:{click:{cue:'setting-unchanged'}}}}};
const scope=vm.createContext({console,AbortController,document:{currentScript:{src:'https://test/SoundCatalog.js?build=TEST'},addEventListener:(name,fn)=>listeners[name]=fn},addEventListener:(name,fn)=>listeners[name]=fn,WMOFSeasonalTheme:{active:false},WMOFAnnouncementLanguage:{text:(key,values)=>({key,values})},fetch:async url=>({ok:true,json:async()=>String(url).includes('default/windows.json')?defaultWindows:JSON.parse(read(String(url).split('?')[0]))}),WMOFAudio:{playSound:async(name,options)=>{calls.push(['cue',name]);return{finished:Promise.resolve(),stop(){calls.push(['stop',name]);}};},startFrequencies:async frequencies=>{calls.push(['held',...frequencies]);return{stop(){calls.push(['release',...frequencies]);}};}}});
for(const file of ['SoundCatalog.js','WindowAudio.js'])vm.runInContext(read('api/audio/'+file),scope);
await scope.WMOFSoundCatalog.prepareEvents();assert.equal(scope.WMOFSoundCatalog.eventSound('trip-started'),'trip-started');
assert.equal(scope.WMOFSoundCatalog.speech('announcements.trip-started.summary').key,'announcements.trip-started.summary');
await scope.WMOFWindowAudio.open('example');assert.deepEqual(calls.slice(0,2),[['cue','setting-on'],['held',350,440]]);
await scope.WMOFWindowAudio.open('example');assert.equal(calls.length,2,'duplicate opens do not replay');
await scope.WMOFWindowAudio.close('example');assert(calls.some(c=>c[0]==='release'));assert(calls.some(c=>c[0]==='cue'&&c[1]==='setting-off'));
const before=calls.length;await scope.WMOFWindowAudio.open('silent-window');await scope.WMOFWindowAudio.close('silent-window');assert.equal(calls.length,before,'omitted definitions are silent');
scope.WMOFSeasonalTheme.active=true;await scope.WMOFWindowAudio.open('numberpad');assert.deepEqual(calls.at(-1),['cue','keypad-open']);await scope.WMOFWindowAudio.close('numberpad');
const profile=await scope.WMOFSoundCatalog.resolve('trip-started',{},{});assert(profile.clip.url.endsWith('.wav'));assert.equal(profile.speechStartSeconds,1);assert.equal(scope.WMOFSoundCatalog.eventSpeechStart('trip-started').anchor,'cue');for(const rate of [.8,1.2]){const variant=await scope.WMOFSoundCatalog.resolve('trip-started',{toneVelocity:rate},{});assert.equal(variant.speechStartSeconds,1);}
scope.WMOFSeasonalTheme.active=false;const button={id:'apply',dataset:{},getAttribute:()=>null,closest:()=>({id:'example',dataset:{}})};
await listeners.click({target:{closest:()=>button}});await new Promise(r=>setImmediate(r));assert(calls.some(c=>c[1]==='setting-unchanged'),'button click sound is configurable');
const count=calls.length;
listeners.click({target:{closest:()=>button}});
await scope.WMOFWindowAudio.close('example');
await new Promise(r=>setImmediate(r));
assert.equal(calls.length,count,'a pending button sound cannot start after its window closes');
console.log('PASS theme WAV resolution, event/template references, opening/sustain/closing, duplicate opens, silent omissions, button cues and live Default dial tone');

// A ringing bell outlives its window, but delayed preparation and global owners do not.
scope.WMOFSeasonalTheme.active=true;
const tick=()=>new Promise(r=>setImmediate(r));
const voices=[];
scope.WMOFAudio.playSound=async(name,options)=>{
 let finish;
 const voice={name,signal:options.signal,stops:0,finish:()=>finish({reason:'ended'})};
 const handle={finished:new Promise(r=>finish=r),stop(){voice.stops++;finish({reason:'stopped'});}};
 voices.push(voice);return handle;
};
const ringing=scope.WMOFWindowAudio.open('numberpad');await tick();
await scope.WMOFWindowAudio.close('numberpad');
assert.equal(voices[0].signal.aborted,false,'closing the numberpad preserves an already-ringing bell');
assert.equal(voices[0].stops,0);
const reopened=scope.WMOFWindowAudio.open('numberpad');await tick();
assert.equal(voices[0].stops,0,'reopening does not truncate the previous bell');
await scope.WMOFWindowAudio.close('numberpad');
voices[0].finish();await ringing;
scope.WMOFWindowAudio.cancelAll();await reopened;
assert(voices[1].signal.aborted,'global cancellation still stops detached tails');
assert(voices[1].stops>0);

let prepare,preparedSignal,lateStops=0;
scope.WMOFAudio.playSound=(name,options)=>{preparedSignal=options.signal;return new Promise(r=>prepare=r);};
const pending=scope.WMOFWindowAudio.open('numberpad');await tick();
await scope.WMOFWindowAudio.close('numberpad');
assert(preparedSignal.aborted,'a bell that has not started is canceled on close');
prepare({finished:Promise.resolve(),stop(){lateStops++;}});await pending;
assert.equal(lateStops,1,'a late handle cannot start an orphaned bell');

scope.WMOFSeasonalTheme.active=false;
let defaultStops=0,finishDefault;
scope.WMOFAudio.playSound=async()=>({finished:new Promise(r=>finishDefault=r),stop(){defaultStops++;finishDefault({reason:'stopped'});}});
const normal=scope.WMOFWindowAudio.open('example');await tick();
await scope.WMOFWindowAudio.close('example',{silent:true});await normal;
assert(defaultStops>0,'openings without finishOnClose retain their original close behavior');
console.log('PASS natural bell tails after close/reopen, pending cancellation, global tail cleanup and unchanged Default close behavior');
