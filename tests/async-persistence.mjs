import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window = new Window({url: 'https://clock.example/'});
Object.assign(globalThis, {document: window.document, location: window.location, CustomEvent: window.CustomEvent, EventTarget: window.EventTarget, Event: window.Event});
const tick = () => new Promise(setImmediate);
class WorkerStub extends EventTarget {
    values = new Map(); messages = []; fail = false;
    postMessage(data) {
        this.messages.push(data);
        setImmediate(() => {
            let result, error;
            if (data.operation === 'entries') result = [...this.values];
            else if (data.operation === 'check') result = {accepted: !this.fail, reason: 'Storage check rejected'};
            else if (this.fail) error = 'Disk write failed';
            else if (data.operation === 'batch') for (const [key, value] of data.value) this.values.set(key, structuredClone(value));
            else if (data.operation === 'delete') this.values.delete(data.key);
            const event = new Event('message'); event.data = {id: data.id, result, error}; this.dispatchEvent(event);
        });
    }
}
globalThis.Worker = WorkerStub;
globalThis.localStorage = window.localStorage;
Function(fs.readFileSync(new URL('../StateTransactions.js', import.meta.url), 'utf8'))();
Function(fs.readFileSync(new URL('../AsyncPersistence.js', import.meta.url), 'utf8'))();
const transactions = globalThis.WMOFStateTransactions;
const worker = new WorkerStub(), store = new AsyncPersistence({worker});
await store.ready;
let state = {mode: 'trip', breakType: 'lunch'};
const states = [];
transactions.register('model', {capture: () => structuredClone(state), restore: saved => {state = saved;}});
transactions.addEventListener('state', event => states.push(event.detail.state));
await store.setItem('mode', 'trip');
let release;
const first = transactions.run('changeMode', async () => {
    state.mode = 'total'; await store.setItem('mode', 'total');
    await new Promise(resolve => release = resolve); return true;
}, {group: 'chain', chain: true});
assert.equal(states.at(-1), 'pending', 'acceptance is immediate');
await tick(); assert.equal(state.mode, 'total', 'the UI is tentative before confirmation');
assert.equal(worker.values.get('mode'), 'trip', 'tentative writes do not reach storage');
let responsive = false; setTimeout(() => responsive = true, 0);
await new Promise(resolve => setTimeout(resolve, 5)); assert(responsive, 'pending persistence leaves the event loop responsive');
release(); await first;
await transactions.run('chooseLunch', () => {state.breakType = 'new-lunch'; return true;}, {group: 'chain', chain: true});
worker.fail = true;
assert.equal(await transactions.complete('chain'), false);
assert.deepEqual(state, {mode: 'trip', breakType: 'lunch'}, 'failure rolls back the whole command chain');
assert.equal(store.peek('mode'), 'trip');
assert.equal(worker.values.get('mode'), 'trip');
assert.equal(states.at(-1), 'reverted');
worker.fail = false;
const rejected = transactions.run('startBreak', async () => {
    await tick(); return false;
}, {group: 'break', chain: true});
let dependentCalls = 0;
const lunch = transactions.run('lunch', () => {dependentCalls++; state.breakType = 'short'; return true;}, {group: 'break', chain: true});
const okay = transactions.run('okay', () => {dependentCalls++; return true;}, {group: 'break', chain: true});
assert.deepEqual(await Promise.all([rejected, lunch, okay]), [false, false, false]);
assert.equal(dependentCalls, 0, 'a rejected break cancels its dependent Lunch and OK');
assert.equal(state.breakType, 'lunch', 'the original break remains intact');
await transactions.run('saveMode', async () => {state.mode = 'total'; await store.setItem('mode', 'total'); return true;});
assert.equal(worker.values.get('mode'), 'total'); assert.equal(states.at(-1), 'confirmed');
// Preference changes made after an await still belong to the optimistic attempt.
const asyncMode=state.mode;
await transactions.run('asyncPreference',async()=>{await tick();state.mode='tentative-async';await store.setItem('mode','tentative-async');return true;},{group:'async-preference',chain:true});
assert.equal(worker.values.get('mode'),asyncMode,'async action does not save before acceptance');
await transactions.rollback('async-preference',new Error('Rejected'));
assert.equal(state.mode,asyncMode);
assert.equal(store.peek('mode'),asyncMode);
// A cancelled third-party callback cannot overwrite a later confirmed attempt.
let lateRelease;
const late = transactions.run('late', async () => {await new Promise(resolve => lateRelease = resolve); state.mode = 'late'; return true;}, {group: 'late', chain: true});
await tick();
const rollback = transactions.rollback('late', new Error('Cancelled'));
const newer = transactions.run('newer', () => {state.mode = 'newer'; return true;});
lateRelease(); await Promise.all([late, rollback, newer]);
assert.equal(state.mode, 'newer');
Function(fs.readFileSync(new URL('../ActionFunctions.js', import.meta.url), 'utf8'))();
globalThis.WMOFActionFunctions.define('setMode', async value => {await tick();state.mode=value;await store.setItem('mode',value);return true;});
globalThis.WMOFActionFunctions.define('setBreak', value => {state.breakType=value;return true;});
globalThis.WMOFActionFunctions.registerMacro({name:'applyStatePair',steps:[
    {action:'setMode',args:[{source:'literal',value:'macro'}]},
    {action:'setBreak',args:[{source:'literal',value:'macro-break'}]}
]});
assert.equal(await globalThis.WMOFActions.applyStatePair(),true,'async nested macro actions share a transaction without deadlocking');
assert.equal(state.mode,'macro'); assert.equal(state.breakType,'macro-break');
worker.fail=true;
assert.equal(await globalThis.WMOFActions.applyStatePair(),false);
assert.equal(state.mode,'macro'); assert.equal(state.breakType,'macro-break');
worker.fail=false;
// Exercise the actual worker: it must acknowledge transaction completion, not request success.
const replies = [], pending = [];
const context = vm.createContext({self: {postMessage: message => replies.push(message)},
    indexedDB: {open() {
        const request = {};
        queueMicrotask(() => {request.result = {transaction() {
            const tx = {writes: [], objectStore() {return {put(value, key) {tx.writes.push([key, value]);}};}};
            pending.push(tx); return tx;
        }}; request.onsuccess();}); return request;
    }}, queueMicrotask, Promise, Error});
vm.runInContext(fs.readFileSync(new URL('../PersistenceWorker.js', import.meta.url), 'utf8'), context);
context.self.onmessage({data: {id: 1, operation: 'batch', value: [['one', 1], ['two', 2]]}});
await tick(); assert.equal(replies.length, 0, 'worker waits for durable transaction completion');
assert.equal(pending[0].writes.length, 2, 'related writes share one transaction');
pending[0].oncomplete(); await tick(); assert.equal(replies[0].id, 1);
context.self.onmessage({data: {id: 2, operation: 'batch', value: [['three', 3]]}});
await tick(); pending[1].error = new Error('Quota exceeded'); pending[1].onabort(); await tick();
assert.match(replies[1].error, /Quota exceeded/);
console.log('PASS asynchronous persistence, atomic acknowledgements, optimistic acceptance, chain rollback, dependent cancellation and late callbacks');
await window.happyDOM.close();
