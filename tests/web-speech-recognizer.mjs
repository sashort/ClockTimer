import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event{constructor(type,{detail}={}){super(type);this.detail=detail;}}
class Native{
 static instances=[];
 constructor(){Native.instances.push(this);this.starts=0;}
 start(){this.starts++;queueMicrotask(()=>{this.onstart?.();this.onaudiostart?.();});}
 stop(){this.stopped=true;}
 abort(){this.aborted=true;}
 result(values){this.onresult?.({resultIndex:0,results:values.map(({final,texts})=>Object.assign(texts.map((transcript,i)=>({transcript,confidence:1-i*.1})),{isFinal:final}))});}
}
const context={EventTarget,CustomEvent,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(new URL('../SpeechValueCollector.js',import.meta.url),'utf8'),context);
vm.runInNewContext(fs.readFileSync(new URL('../WebSpeechRecognizer.js',import.meta.url),'utf8'),context);
const Recognizer=context.WebSpeechRecognizer,flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
assert.throws(()=>new Recognizer({Recognition:undefined,selectHypothesis(){}}),/does not expose/);
assert.throws(()=>new Recognizer({Recognition:Native,maxAlternatives:0,selectHypothesis(){}}),/alternatives/);
assert.throws(()=>new Recognizer({Recognition:Native,processLocally:true,selectHypothesis(){}}),/cannot require local/);
let nextId=0;const transcripts=[],evidence=[];
const recognizer=new Recognizer({Recognition:Native,maxAlternatives:10,
 selectHypothesis:async(id,candidates)=>candidates.find(c=>c.text==='sync on')||candidates[0]});
recognizer.addEventListener('speechStart',()=>recognizer.beginUtterance(++nextId));
recognizer.addEventListener('transcript',event=>transcripts.push(event.detail));
recognizer.addEventListener('alternatives',event=>evidence.push(event.detail));
await recognizer.start();const native=Native.instances.at(-1);
assert.equal(native.maxAlternatives,10);assert.equal(native.continuous,true);assert.equal(native.interimResults,true);
native.result([{final:true,texts:['sink on','sync on']}]);await flush();
assert.equal(transcripts.at(-1).transcript,'sync on','selection uses an actual returned secondary alternative');
assert.equal(evidence.at(-1).returned[0],2,'requested ten does not claim ten were returned');
native.result([{final:true,texts:['sink on','sync on']},{final:false,texts:['twenty two']}]);await flush();
native.result([{final:true,texts:['sink on','sync on']},{final:false,texts:['twenty two seventeen']}]);await flush();
assert.equal(transcripts.at(-1).transcript,'twenty two seventeen','revised interim text replaces earlier words');
native.result([{final:true,texts:['sink on','sync on']},{final:true,texts:['twenty two seventeen']}]);await flush();
assert.equal(transcripts.at(-1).transcript,'twenty two seventeen');assert(transcripts.at(-1).isFinal);
assert.equal(transcripts.filter(t=>t.isFinal).length,2,'previous final slots are not executed twice');
recognizer.close();assert(native.aborted);assert.equal(native.onresult,null);

const rejected=new Recognizer({Recognition:Native,selectHypothesis:async()=>undefined});
const rejectedFinals=[];rejected.addEventListener('speechStart',()=>rejected.beginUtterance(10));rejected.addEventListener('transcript',e=>rejectedFinals.push(e.detail));
await rejected.start();Native.instances.at(-1).result([{final:true,texts:['who do you love']}]);await flush();
assert.equal(rejectedFinals[0].transcript,'');assert.equal(rejectedFinals[0].rejected,true,'an invalid guess is never promoted to a command');rejected.close();

const ignored=new Recognizer({Recognition:Native,selectHypothesis:async(id,c)=>c[0]});let ignore=true;
const accepted=[];ignored.addEventListener('speechStart',()=>ignore?ignored.ignoreUtterance():ignored.beginUtterance(11));ignored.addEventListener('transcript',e=>accepted.push(e.detail));
await ignored.start();const ignoreNative=Native.instances.at(-1);
ignoreNative.result([{final:true,texts:['ignored audio']}]);await flush();ignore=false;
ignoreNative.result([{final:true,texts:['ignored audio']},{final:true,texts:['ready']}]);await flush();
assert.equal(accepted.length,1);assert.equal(accepted[0].transcript,'ready','suspended results cannot leak into the next command');ignored.close();

class PendingNative extends Native{start(){}}
const pending=new Recognizer({Recognition:PendingNative,selectHypothesis:async()=>undefined});const starting=pending.start();pending.close();await assert.rejects(starting,/canceled/);
console.log('PASS browser alternatives, revisions, once-only finals, rejection, suspended audio, bounded options and startup cancellation');
