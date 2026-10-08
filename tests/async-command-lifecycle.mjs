import fs from 'node:fs';
import assert from 'node:assert/strict';
Function(fs.readFileSync(new URL('../StateTransactions.js',import.meta.url),'utf8'))();
const create=()=>{const m=new StateTransactions();let value=0,writes=0,restores=0;const states=[];
 m.register('ui',{capture:()=>value,restore:async snapshot=>{restores++;value=snapshot;}});
 m.addEventListener('state',e=>states.push(e.detail.state));
 const store={commit:async()=>{writes++;}};
 const change=(tx,n)=>{const before=value;value=n;m.stage(store,'value',n,()=>value=before);return true;};
 return {m,change,read:()=>({value,writes,restores,states})};};
{
 const {m,change,read}=create();const owner=m.createOperation({group:'voice:1',source:'voice'});
 const final=owner.expect('recognition-final');await m.run('first',t=>change(t,1),{owner,chain:true});
 assert.equal(read().value,1);assert.equal(read().writes,0,'optimistic changes cannot write before final validation');
 const dependent=m.run('second',t=>change(t,2));assert.equal(read().value,1);
 final();assert(await owner.complete());assert(await dependent);assert.equal(read().value,2);assert.equal(read().writes,2);
 assert.equal(m.pending.length,0);
 assert.equal(await m.run('late',t=>change(t,3),{owner,chain:true}),false,'settled owners cannot run late actions');
 assert.equal(read().value,2);
}
{
 const {m,change,read}=create();const owner=m.createOperation({group:'voice:2'});
 owner.expect('recognition-final',{timeoutMilliseconds:15});await m.run('first',t=>change(t,1),{owner,chain:true});
 const dependent=m.run('second',t=>change(t,2));assert.equal(await owner.completion,false);assert.equal(await dependent,false);
 assert.equal(read().value,0);assert.equal(read().writes,0);assert.equal(m.pending.length,0);
 assert.equal(read().states.filter(s=>s==='reverted').length,2,'owner and dependent each settle exactly once');
}
{
 const {m,change,read}=create();const owner=m.createOperation({group:'voice:3'});
 await m.run('first',t=>change(t,1),{owner,chain:true});
 await Promise.all([owner.cancel(),owner.cancel(),m.rollback(owner.group,new Error('stop'))]);
 assert.equal(read().value,0);assert.equal(read().restores,1);assert.equal(read().states.filter(s=>s==='reverted').length,1);
}
{
 const {m,change,read}=create();const owner=m.createOperation({group:'voice:4'});let release;
 const action=m.run('delayed',async t=>{await new Promise(resolve=>release=resolve);return change(t,1);},{owner,chain:true});
 await new Promise(setImmediate);const cancellation=owner.cancel();await new Promise(setImmediate);
 assert.equal(owner.settled,false,'cancellation waits for an uncooperative callback before restoring');
 release();await action;await cancellation;assert.equal(read().value,0);assert.equal(read().writes,0);assert.equal(m.pending.length,0);
}
{
 const {m,change,read}=create();let attempts=0;
 assert(await m.run('retry',async t=>{change(t,1);return m.retry(async()=>{if(++attempts<3)throw Object.assign(new Error('temporary'),{retryable:true});return true;},{transaction:t,delay:()=>1});}));
 assert.equal(attempts,3);assert.equal(read().value,1);assert.equal(read().writes,1);assert.equal(m.pending.length,0);
}
{
 const m=new StateTransactions();let value=0,release,ran=false;
 m.register('slow-snapshot',{capture:()=>new Promise(resolve=>release=()=>resolve(value)),restore:snapshot=>{value=snapshot;}});
 const owner=m.createOperation({group:'voice:slow-capture'});
 const work=m.run('change',()=>{ran=true;value=1;return true;},{owner,chain:true});
 await new Promise(setImmediate);const cancellation=owner.cancel();await new Promise(setImmediate);
 release();await work;await cancellation;
 assert.equal(ran,false,'cancellation while capturing state must never run the action afterward');
 assert.equal(value,0);assert.equal(m.pending.length,0);
}
console.log('PASS shared lifecycle integration: staged writes, dependency order, missing results, late callbacks, idempotent rollback, rollback of dependents, and valid retries');
