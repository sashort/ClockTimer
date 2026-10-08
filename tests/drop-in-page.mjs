import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from './LanguageWindow.mjs';
const html=fs.readFileSync(new URL('../drop-in.html',import.meta.url),'utf8');
assert(!/src="(?:app|SherpaRecognizer|SpeechMicBar)\.js/.test(html),'standalone viewer loads no main app or microphone engine');
assert(!html.includes('id="tripListButton"'),'viewer omits Trip Log');
assert(html.includes('src="api/audio/AudioEngine.js"'),'viewer retains remote speech playback');
const w=new Window({url:'https://clock.example/drop-in.php'});
w.document.body.innerHTML=html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
w.eval(fs.readFileSync(new URL('../IdentityContext.js',import.meta.url),'utf8'));
const events=[],errors=[];let rejectStart=false;
w.addEventListener("error",event=>errors.push(event.message));
w.WMOFLiveTripStream=class extends w.EventTarget {
 constructor(){super();w.testStream=this;this.viewing=false;}
 async stopViewing(){events.push('stop');this.viewing=false;this.dispatchEvent(new w.CustomEvent('viewerChanged'));}
 async startViewing(id){events.push('start:'+id);if(rejectStart)throw new Error('permission revoked');this.viewing=true;this.targetUserId=id;this.dispatchEvent(new w.CustomEvent('viewerChanged',{detail:{state:'connected'}}));}
 async sendToPublisher(type,payload){events.push({target:this.targetUserId,type,payload});}
 async close(){}
};
w.WMOFDropInView=class {
 constructor(){w.testView=this;}
 clear(){events.push('clear');}
 setUser(id){this.userId=id;events.push('user:'+id);}
 update(snapshot){events.push('snapshot:'+snapshot.userId);}
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
assert.equal(events.filter(value=>value==='snapshot:3').length,2);
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
await w.happyDOM.close();
console.log('PASS standalone Drop-In session, serialized switching, message targeting, stale snapshots and failed authorization');
