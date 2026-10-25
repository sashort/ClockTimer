import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const window=new Window({url:'https://clock.example/'});
const tracks=[],contexts=[],recognizers=[],ports=[],events=[];
let visibility='visible',holdCapture=false,releaseCapture,denyCapture=false,deliverFrames=true;
Object.defineProperty(window.document,'visibilityState',{configurable:true,get:()=>visibility});
const frame=port=>port.dispatchEvent(new window.MessageEvent('message',{data:{type:'audio',samples:new window.Float32Array(640),sampleRate:16000,level:0}}));
const node=()=>({gain:{value:1},connect(target){if(target?.port&&deliverFrames)setTimeout(()=>frame(target.port),0);},disconnect(){}});
class CaptureContext {
 constructor(){this.state='running';this.destination={};this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
 createMediaStreamSource(){return node();}createGain(){return node();}
 async resume(){this.state='running';if(deliverFrames&&ports.length)setTimeout(()=>frame(ports.at(-1)),0);}
 async close(){this.state='closed';}
}
class Recognizer extends window.EventTarget {
 static sampleRate=16000;static assetUrl(path){return path;}
 constructor(){super();this.ready=Promise.resolve(true);recognizers.push(this);}
 setHotwords(){}close(){this.closed=true;}
}
window.AudioContext=CaptureContext;
window.AudioWorkletNode=class {constructor(){const value=node();value.port=new window.EventTarget();value.port.start=()=>{};ports.push(value.port);return value;}};
window.SherpaRecognizer=Recognizer;
window.navigator.mediaDevices={getUserMedia:async()=>{
 if(holdCapture)await new Promise(resolve=>releaseCapture=resolve);
 if(denyCapture)throw new window.DOMException('Microphone permission denied.','NotAllowedError');
 const track=new window.EventTarget();track.readyState='live';track.stop=()=>{track.readyState='ended';};track.getSettings=()=>({});tracks.push(track);
 return {getTracks:()=>[track],getAudioTracks:()=>[track]};
}};
for(const name of ['ParameterParser','SpeechMenu','SpeechMicBar'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const speech=window.SpeechMenu,bar=window.document.createElement('speech-mic-bar');window.document.body.append(bar);bar.hidden=false;
for(const type of ['speechCaptureInterrupted','speechCaptureRecovered','speechCaptureRecoveryFailed','speechCaptureEnded','stopped'])speech.events.addEventListener(type,e=>events.push({type,...e.detail}));
const until=async check=>{for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}assert(check(),'capture recovery settled');};
const background=()=>{visibility='hidden';window.document.dispatchEvent(new window.Event('visibilitychange'));};
const foreground=()=>{visibility='visible';window.document.dispatchEvent(new window.Event('visibilitychange'));window.dispatchEvent(new window.Event('pageshow'));window.dispatchEvent(new window.Event('focus'));};
const endTrack=()=>{tracks.at(-1).readyState='ended';tracks.at(-1).dispatchEvent(new window.Event('ended'));};
try {
 assert(await speech.start());
 background();endTrack();
 assert.equal(speech.started,true,'interruption keeps enabled intent');assert.equal(speech.captureListening,false);
 assert.equal(bar.state,'reconnecting');assert.equal(bar.hidden,false);assert.equal(tracks.length,1,'no capture request while backgrounded');
 foreground();await until(()=>events.filter(e=>e.type==='speechCaptureRecovered').length===1);
 assert.equal(tracks.length,2,'foreground event burst requests one replacement');assert.equal(recognizers.length,1,'recovery keeps the model and command decoder');
 assert.equal(recognizers[0].closed,undefined);assert.equal(contexts[0].state,'closed');assert.equal(bar.state,'listening');assert.equal(bar.hidden,false);
 assert.equal(events.filter(e=>e.type==='speechCaptureEnded'||e.type==='stopped').length,0,'interruption never closes the Mic Bar');
 await speech.sleep();background();endTrack();foreground();
 await until(()=>events.filter(e=>e.type==='speechCaptureRecovered').length===2);
 assert.equal(speech.muted,true);assert.equal(bar.state,'muted','Sleep survives recovery');assert.equal(events.at(-1).muted,true);
 await speech.wake();
 // A suspended context resumes without reopening the microphone, and Listening waits for PCM.
 background();contexts.at(-1).state='suspended';deliverFrames=false;foreground();
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(bar.state,'reconnecting');assert.equal(speech.captureListening,false);
 frame(ports.at(-1));await until(()=>events.filter(e=>e.type==='speechCaptureRecovered').length===3);
 assert.equal(tracks.length,3,'live track reuses its existing capture');assert.equal(bar.state,'listening');deliverFrames=true;
 // Permission loss is recoverable UI, never a false Listening state or closed bar.
 background();endTrack();denyCapture=true;foreground();
 await until(()=>events.some(e=>e.type==='speechCaptureRecoveryFailed'));
 assert.equal(bar.state,'reconnecting');assert.equal(bar.hidden,false);assert.equal(speech.captureListening,false);
 denyCapture=false;assert(await speech.start(),'explicit retry can recover the enabled microphone');assert.equal(bar.state,'listening');
 // An explicit Off during getUserMedia wins against the late recovery result.
 holdCapture=true;background();endTrack();foreground();await until(()=>Boolean(releaseCapture));
 const recovered=events.filter(e=>e.type==='speechCaptureRecovered').length;
 await speech.stop();releaseCapture();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(speech.started,false);assert.equal(bar.state,'stopped');assert(tracks.every(t=>t.readyState==='ended'));
 assert.equal(events.filter(e=>e.type==='speechCaptureRecovered').length,recovered,'late permission result cannot reactivate an explicitly stopped mic');
 console.log('PASS foreground capture recovery, retained decoder/Sleep, frame-backed readiness, permission retry, event coalescing and Off fencing');
} finally {await speech.stop();await window.happyDOM.close();}
