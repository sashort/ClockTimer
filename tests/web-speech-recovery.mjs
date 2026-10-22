import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class CustomEvent extends Event{constructor(type,{detail}={}){super(type);this.detail=detail;}}
const source=fs.readFileSync(new URL('../WebSpeechRecognizer.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(select=async(_id,c)=>c[0]){
 let now=1,next=0;const timers=new Map(),instances=[],behaviors=[];
 const setTimeout=(fn,delay)=>{const id=++next;timers.set(id,{at:now+delay,fn});return id;},clearTimeout=id=>timers.delete(id);
 const document=new EventTarget();document.visibilityState='visible';const events=new EventTarget();
 class Native{
  constructor(){instances.push(this);}
  start(){const behavior=behaviors.shift();if(behavior)behavior(this);else{this.onstart?.();this.onaudiostart?.();}}
  abort(){this.aborted=true;}
  stop(){}
  result(text,final=true){this.onresult?.({results:[Object.assign([{transcript:text,confidence:1}],{isFinal:final})]});}
 }
 const context={EventTarget,CustomEvent,setTimeout,clearTimeout,Date:{now:()=>now},document,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
 vm.runInNewContext(source,context);
 const r=new context.WebSpeechRecognizer({Recognition:Native,selectHypothesis:select}),status=[],errors=[],transcripts=[];
 r.addEventListener('status',e=>status.push(e.detail));r.addEventListener('error',e=>errors.push(e.detail));
 r.addEventListener('speechStart',()=>r.beginUtterance(1));r.addEventListener('transcript',e=>transcripts.push(e.detail));
 const advance=async milliseconds=>{
  const end=now+milliseconds;let calls=0;
  while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;
   assert(++calls<100,'bounded timers');now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}
  now=end;await flush();
 };
 return {r,status,errors,transcripts,instances,behaviors,advance,document,events,timers};
}
{
 const f=fixture();await f.r.start();assert(f.r.listening);
 const old=f.instances.at(-1),staleEnd=old.onend,staleResult=old.onresult;
 old.onerror({error:'network'});assert.equal(f.r.listening,false);assert.equal(f.status.at(-1).status,'browser-reconnecting');
 assert.equal(f.errors.length,0,'transient network failure is recoverable');
 await f.advance(300);assert(f.r.listening);assert.equal(f.instances.length,2);
 staleEnd();staleResult({results:[]});await f.advance(300);assert.equal(f.instances.length,2,'stale callbacks cannot restart the new session');
 f.instances.at(-1).result('ready');await flush();assert.equal(f.transcripts.at(-1).transcript,'ready');f.r.close();
}
{
 const f=fixture();await f.r.start();f.instances.at(-1).onaudioend();assert.equal(f.r.listening,false);
 await f.advance(1000);await f.advance(300);assert(f.r.listening,'capture loss recovers even without end');f.r.close();
}
{
 const f=fixture();f.behaviors.push(n=>n.onstart?.());const started=f.r.start();let ready=false;started.then(()=>ready=true);
 await flush();assert(!ready);assert(!f.r.listening,'service start without capture cannot claim listening');
 await f.advance(10000);await f.advance(300);await started;assert(f.r.listening,'startup watchdog retries missing capture');
 f.behaviors.push(n=>n.onstart?.());f.instances.at(-1).onend();await f.advance(600);assert(!f.r.listening);
 await f.advance(10000);await f.advance(1200);assert(f.r.listening,'every restart has a startup watchdog');f.r.close();
}
{
 const f=fixture();await f.r.start();f.r.beginUtterance(8);const finish=f.r.finishUtterance(8);
 await f.advance(7000);await finish;await f.advance(300);assert(f.r.listening,'missing final result recovers');
 assert.equal(f.transcripts.filter(t=>t.isFinal).length,1);f.r.close();
}
{
 const f=fixture();await f.r.start();f.instances.at(-1).onerror({error:'not-allowed'});
 assert.equal(f.errors[0].fatal,true);await f.advance(60000);assert.equal(f.instances.length,1,'permission denial does not retry');
}
{
 const f=fixture();await f.r.start();
 for(let i=0;i<7;i++){f.instances.at(-1).onerror({error:'network'});await f.advance(Math.min(5000,300*2**i));}
 assert.equal(f.errors.at(-1).error,'recovery-exhausted');assert(!f.r.listening);f.r.close();
}
{
 const f=fixture();await f.r.start();f.instances.at(-1).onend();f.r.close();
 f.document.dispatchEvent(new Event('visibilitychange'));f.events.dispatchEvent(new Event('online'));
 await f.advance(60000);assert.equal(f.instances.length,1,'intentional off cancels timers and resume listeners');assert.equal(f.timers.size,0);
}
{
 const f=fixture();await f.r.start();f.document.dispatchEvent(new Event('visibilitychange'));await f.advance(300);
 assert(f.r.listening);assert.equal(f.instances.length,2,'foreground restores a potentially interrupted session');f.r.close();
}
{
 let blocked=true;const f=fixture(async(_id,c)=>blocked?new Promise(()=>{}):c[0]);await f.r.start();
 f.instances.at(-1).result('ready');await flush();await f.advance(10000);blocked=false;await f.advance(300);
 f.instances.at(-1).result('time');await flush();assert.equal(f.transcripts.at(-1).transcript,'time','stalled selection cannot strand the recognition queue');f.r.close();
}
console.log('PASS native capture evidence, transient recovery, missing end/final, every-start watchdogs, stale callbacks, bounded retries, permission failure, foreground restoration, intentional stop and stalled selection');
