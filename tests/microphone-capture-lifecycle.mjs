import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const window=new Window({url:'https://clock.example/'});
const requests=[],tracks=[],contexts=[];
const node=()=>({connect(){},disconnect(){},gain:{value:1},port:{addEventListener(){},removeEventListener(){},start(){}}});
class CaptureContext {
 constructor(){this.state='running';this.destination={};this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
 createMediaStreamSource(){return node();}createGain(){return node();}async resume(){this.state='running';}async close(){this.state='closed';}
}
class Recognizer extends window.EventTarget {
 static sampleRate=16000;static assetUrl(path){return path;}
 ready=Promise.resolve(true);setHotwords(){}close(){this.closed=true;}
}
class Vad extends window.EventTarget{ready=Promise.resolve(true);close(){this.closed=true;}}
window.AudioContext=CaptureContext;window.AudioWorkletNode=class{constructor(){return node();}};
window.SherpaRecognizer=Recognizer;window.SileroVad=Vad;
window.navigator.mediaDevices={getUserMedia:async request=>{
 requests.push(request);const track=new window.EventTarget();track.readyState='live';track.stops=0;
 track.stop=()=>{track.readyState='ended';track.stops++;};track.getSettings=()=>request.audio;tracks.push(track);
 return {getTracks:()=>[track],getAudioTracks:()=>[track]};
}};
window.eval(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8'));
window.eval(fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8'));
const speech=window.SpeechMenu;
assert.equal(await speech.start(),true);
assert.equal(requests[0].audio.echoCancellation,false);
assert.equal(requests[0].audio.noiseSuppression,false);
assert.equal(requests[0].audio.autoGainControl,false);
await speech.sleep();assert.equal(tracks[0].readyState,'live','sleep retains capture for voice wake');
await speech.wake();assert.equal(tracks[0].readyState,'live');assert.equal(requests.length,1,'wake reuses live capture');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const disable=app.slice(app.indexOf('    const disableSpeechRecognitionRuntime ='),app.indexOf('    const enableSpeechRecognitionRuntime ='));
const state={button:true,layout:true};
const context=vm.createContext({speechTrainingActive:false,speechRecognitionSuspended:false,ensureSpeechRuntime:async()=>{},SpeechMenu:speech,
 setSpeechButtonState(value){state.button=value;},setSpeechLayoutState(value){state.layout=value;},console});
vm.runInContext(disable+'\nglobalThis.disableRuntime=disableSpeechRecognitionRuntime;',context);
assert.equal(await context.disableRuntime(),true);
assert.equal(tracks[0].readyState,'ended','app recognition-off stops the real speech stream');
assert.equal(tracks[0].stops,1);assert.equal(contexts[0].state,'closed');assert.equal(speech.started,false);
assert.deepEqual(state,{button:false,layout:false});
assert.equal(await context.disableRuntime(),true,'repeated off stays safe');assert.equal(tracks[0].stops,1);
assert.equal(await speech.start(),true,'recognition restarts after releasing capture');assert.equal(tracks[1].readyState,'live');
await speech.stop();assert.equal(tracks[1].readyState,'ended');
const live=fs.readFileSync(new URL('../LiveTripStream.js',import.meta.url),'utf8');
assert.match(live,/getUserMedia\(\{\s*audio:\s*\{\s*echoCancellation:\s*false/,'Drop-In fallback also avoids echo cancellation');
let releasePeer;
const clone={readyState:'live',stop(){this.readyState='ended';}};
const peer={microphoneSender:{replaceTrack:()=>new Promise(resolve=>{releasePeer=resolve;})}};
window.eval(live.replace('        async clearPublisherMicrophone() {', '        testPublisher(stream,peer){this.#publisherMicrophoneStream=stream;this.#publisherPeers.set("test",peer);}\n        async clearPublisherMicrophone() {'));
const publisher=new window.WMOFLiveTripStream();publisher.testPublisher({getTracks:()=>[clone]},peer);
const clearing=publisher.clearPublisherMicrophone();
assert.equal(clone.readyState,'ended','Drop-In clone stops before a slow peer finishes detaching');
releasePeer();await clearing;
console.log('PASS raw recognition capture, sleep/wake retention, app off releases stream/context, repeated off, restart and Drop-In capture policy');
window.happyDOM.abort();
