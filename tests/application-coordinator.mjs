import fs from 'node:fs';
import assert from 'node:assert/strict';
Function(fs.readFileSync(new URL('../StateTransactions.js',import.meta.url),'utf8'))();
assert.equal(WMOFCoordinator,WMOFStateTransactions,'compatibility facade is the same coordinator');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
{
 const c=new ApplicationCoordinator();let state='running';
 c.register('model',{capture:()=>state,restore:s=>state=s,reconcile:()=>state='ready'});
 assert.equal(await c.run('lost-response',tx=>{
    state='stopped';c.beginWrite(tx,{event:'trip.stopped'});
    throw new DOMException('Connection interrupted after sending the write','AbortError');
 }),false);
 assert.equal(state,'ready','an unknown remote outcome is reconciled rather than presumed uncommitted');
}
{
 const c=new ApplicationCoordinator();let state='running',rendered=false,last;
 c.addEventListener('state',e=>last=e.detail);
 c.register('model',{capture:()=>state,restore:s=>state=s,reconcile:()=>state='ready'});
 c.register('interface',{capture:()=>null,restore:()=>{},reconcile:()=>rendered=true});
 const store={commit:async()=>{throw new Error('local cache failed');}};
 assert.equal(await c.run('partial-save',tx=>{
    state='stopped';c.stage(store,'trip','ended',()=>state='running');
    c.acknowledge(tx,{event:'trip.stopped'});throw new Error('later action cancelled');
 }),false);
 assert.equal(state,'ready');assert.equal(rendered,true,'cache failure cannot prevent model and UI reconciliation');
 assert.equal(last.recoveryRequired,true,'partial recovery is reported rather than falsely confirmed');
}
{
 const c=new ApplicationCoordinator();let state='running';const calls=[];
 c.register('model',{capture:()=>state,restore:s=>{state=s;calls.push('restore');},reconcile:()=>{state='ready';calls.push('reconcile');}});
 const owner=c.createOperation({source:'voice',group:'trip-end'});
 const releaseFinal=owner.expect('recognition-final');
 await c.run('endTrip',tx=>{state='stopped';c.acknowledge(tx,{event:'trip.stopped'});return true;},{owner,chain:true});
 const queued=c.run('later',()=>{calls.push('late-action');return true;});
 await owner.cancel(new Error('context changed after remote acknowledgement'));
 releaseFinal();assert.equal(await queued,false);
 assert.equal(state,'ready','remote end cannot be rolled back into a running trip');
 assert.deepEqual(calls,['reconcile'],'late dependent never executes and browser snapshot is not restored');
 assert.equal(c.pending.length,0);
 assert.ok(c.trace.some(e=>e.kind==='persistence-acknowledged' && e.endedAt!==null));
}
{
 const c=new ApplicationCoordinator();let close=0,prompt=0;
 const owner=c.createOperation({group:'dialog',source:'voice'});
 const final=owner.expect('recognition-final');
 await c.run('open',()=>true,{owner,chain:true});
 c.defer('prompt',()=>prompt++,{owner,delay:1,afterCompletion:true});
 c.defer('close',()=>close++,{owner,delay:30});
 await sleep(10);assert.equal(prompt,0,'prompt waits for complete utterance and commit');
 await owner.cancel();final();await sleep(45);
 assert.equal(prompt,0);assert.equal(close,0,'cancelled owner cannot close a later dialog');
 assert.ok(c.trace.filter(e=>e.kind==='deferred-ui').every(e=>e.phase==='cancelled' && e.endedAt!==null));
}
{
 const c=new ApplicationCoordinator();let value='running';
 const previous=c.createOperation();await c.run('start',()=>true,{owner:previous});
 c.defer('old-ui',()=>value='running',{owner:previous,delay:30});
 await c.run('end',()=>{value='ready';return true;});
 await sleep(50);assert.equal(value,'ready','older confirmed operation cannot overwrite a newer state revision');
 let calls=0;c.defer('dialog',()=>calls+=100,{delay:10});c.defer('dialog',()=>calls++,{delay:10});await sleep(30);
 assert.equal(calls,1,'newest effect for the same resource owns its callback');
 assert.doesNotThrow(()=>JSON.stringify(c.trace));
 assert.ok(c.trace.filter(e=>e.endedAt!==null).every(e=>e.endedAt>=e.startedAt));
}
{
 const c=new ApplicationCoordinator();let tx;
 await c.run('complete',t=>{tx=t;return true;});
 assert.throws(()=>c.withTransaction(tx,()=>{}),/no longer active/,'late bound callbacks cannot reuse settled transactions');
 assert.equal(c.effect('gesture',()=>false,{transaction:null,source:'gesture'}),false,'synchronous input result stays synchronous');
 assert.equal(await c.effect('persistence',async()=>7),7);
 const failed=()=>{throw new Error('read failed');};
 assert.throws(()=>c.effect('read',failed),/read failed/);
 assert.equal(c.trace.at(-1).phase,'failed');
}
console.log('PASS single coordinator: timing, acknowledgements, dependent cancellation, state revisions and owned UI effects');
