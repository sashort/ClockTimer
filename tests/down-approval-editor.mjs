import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from './LanguageWindow.mjs';
const w=new Window();try{
for(const name of ['TripAggregates','TripLog','TripEditor'])w.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
let pad;const events=[{id:1,event:'trip.started',timestamp:'2026-11-03T10:00:00Z',value:{}},{id:2,event:'interval.started',timestamp:'2026-11-03T10:01:00Z',value:{type:'down',intervalKey:'d',approvedTime:30000}},{id:3,event:'interval.ended',timestamp:'2026-11-03T10:02:00Z',value:{intervalKey:'d'}},{id:4,event:'trip.stopped',timestamp:'2026-11-03T10:03:00Z',value:{}}];
const trip={id:1,startTime:events[0].timestamp,endTime:events[3].timestamp,standardTimeMilliseconds:180000,countedTimeMilliseconds:150000,events};
const editor=new w.TripEditor(trip,{events,settings:{},revision:'test'},{numberPad:async options=>pad=options,request:async()=>({trip})},{timezone:'UTC'});editor.show();const down=editor.events[1];
await editor.editApproval(down,'approved');const pending=pad.onConfirm(undefined);[...w.document.querySelectorAll('.trip-editor-choice button')].find(b=>b.textContent==='Pending').click();await pending;
assert.equal(down.value.approvalState,'pending');assert.equal(down.value.approvedTime,null);
assert.deepEqual([...editor.body.querySelectorAll('[data-down-amount]')].map(e=>e.dataset.downAmount),['recorded','pending']);
await editor.editApproval(down,'pending');assert.equal(pad.initialValue,undefined);await pad.onConfirm(0);assert.equal(down.value.approvalState,'approved','zero approval is valid');
assert.deepEqual([...editor.body.querySelectorAll('[data-down-amount]')].map(e=>e.dataset.downAmount),['recorded','approved','unapproved','net']);assert.equal(editor.body.querySelector('[data-down-amount=net] strong').textContent,'−01:00.000');
await editor.editApproval(down,'approved');const unapproved=pad.onConfirm(undefined);[...w.document.querySelectorAll('.trip-editor-choice button')].find(b=>b.textContent==='Unapproved').click();await unapproved;assert.equal(down.value.approvalState,'unapproved');
assert.equal(events[1].value.approvedTime,30000,'source remains unchanged before Save');
editor.events.push({id:5,event:'interval.started',timestamp:'2026-11-03T10:02:00Z',value:{type:'down',intervalKey:'d2',approvalState:'pending'}},{id:6,event:'interval.ended',timestamp:'2026-11-03T10:02:30Z',value:{intervalKey:'d2'}});editor.changed();
let summary=editor.body.querySelector('.trip-editor-down-summary');assert(summary);assert.deepEqual([...summary.querySelectorAll('[data-down-amount]')].map(e=>e.dataset.downAmount),['recorded','pending','approved','unapproved','net']);assert.equal(summary.querySelector('[data-down-amount=recorded] strong').textContent,'01:30.000');
down.value.approvalState='pending';editor.changed();summary=editor.body.querySelector('.trip-editor-down-summary');assert.deepEqual([...summary.querySelectorAll('[data-down-amount]')].map(e=>e.dataset.downAmount),['recorded','pending'],'all-Pending summary hides Approved/Unapproved/Net');
down.value.approvalState='approved';down.value.approvedTime=90000;editor.changed();summary=editor.body.querySelector('.trip-editor-down-summary');assert.equal(summary.querySelector('[data-down-amount=net] strong').textContent,'00:00.000','Net remains visible after a review even at zero');
editor.events=editor.events.filter(e=>e.value.intervalKey!=='d2');editor.changed();assert.equal(editor.body.querySelector('.trip-editor-down-summary'),null,'one Down interval needs no bottom summary');
editor.dirty=false;editor.close();console.log('PASS approval states, explicit zero, conditional multi-Down summary and signed Net');
}finally{await w.happyDOM.close();}
