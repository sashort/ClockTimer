import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),context={setTimeout,clearTimeout,structuredClone};
for(const name of ['SpeechContextSnapshotCache','VoskDecoderPool'])vm.runInNewContext(fs.readFileSync(new URL(name+'.js',root),'utf8'),context);
let version=1,calls=0,release;
const cache=new context.SpeechContextSnapshotCache(async()=>{calls++;await new Promise(r=>release=r);return {records:[{pattern:'^wake$'}]};},()=>version,{limit:2});
const a=cache.get(1,'ready'),b=cache.get(1,'ready');await Promise.resolve();assert.equal(calls,1);release();await Promise.all([a,b]);assert.equal(cache.hits,1);
version++;const c=cache.get(1,'ready');await Promise.resolve();assert.equal(calls,2);version++;release();await c;
const d=cache.get(1,'ready');await Promise.resolve();assert.equal(calls,3,'a state change invalidates the context snapshot');release();await d;
cache.clear();let failedCalls=0;
const failures=new context.SpeechContextSnapshotCache(async()=>{failedCalls++;throw Error('retry');},()=>0);
await assert.rejects(failures.get(1,''));await assert.rejects(failures.get(1,''));assert.equal(failedCalls,2);
let created=0,prepared=0,closed=0;
const pool=new context.VoskDecoderPool({limit:2});
const factory=()=>({prepare:async()=>{prepared++;},close:()=>closed++,accept(){throw Error('Idle pool must not submit microphone audio');}});
const p1=pool.prepare('time',()=>{created++;return factory();}),p2=pool.prepare('time',()=>{created++;return factory();});
assert.equal(await p1,await p2);assert.equal(created,1);assert.equal(prepared,1);assert.equal(pool.size,1);
const leased=await pool.take('time');assert(leased);assert.equal(pool.size,0);assert.equal(await pool.take('time'),undefined);
await pool.prepare('duration',factory);await pool.prepare('number',factory);await pool.prepare('digits',factory);await Promise.resolve();assert.equal(pool.size,2);assert.equal(closed,1,'idle decoder cache is bounded');
pool.close();await Promise.resolve();assert.equal(closed,3);leased.close();
// Execute the actual worker message handler in an isolated worker-like realm.
class Worker {
 constructor(){this.realm={self:{},postMessage:data=>queueMicrotask(()=>this.onmessage?.({data:structuredClone(data)}))};
  this.realm.self=this.realm;this.realm.importScripts=(...files)=>{for(const file of files)vm.runInNewContext(fs.readFileSync(new URL(file.replace('../',''),root),'utf8'),this.realm);};
  vm.runInNewContext(fs.readFileSync(new URL('speech/SpeechGrammarWorker.js',root),'utf8'),this.realm);}
 postMessage(data){queueMicrotask(()=>this.realm.onmessage({data:structuredClone(data)}));}
 terminate(){this.terminated=true;}
}
context.Worker=Worker;
vm.runInNewContext(fs.readFileSync(new URL('SpeechGrammarCompiler.js',root),'utf8'),context);
const compilerValues={time:['four twelve']};const compiler=new context.SpeechGrammarCompiler({workerUrl:'worker.js',valuePhrases:compilerValues});
const result=await compiler.compile([{id:'ready',pattern:'^ready at (?<spokenTime>.+)$'}]);
assert.equal(compiler.execution,'worker');assert.equal(result.unsupported.length,0);assert.equal(result.paths[0].stages[1].grammar,'time');
assert.deepEqual(Array.from(result.paths[0].stages[0].phrases),['ready at']);assert.equal(result.paths[0].stages[1].phrases,compilerValues.time,'worker binds the existing local vocabulary without cloning it per path');
compiler.close();await assert.rejects(compiler.compile([]),/closed/);
console.log('PASS versioned/in-flight context snapshots, failure retries, bounded warm idle decoders, no audio fanout and actual worker grammar messages');
