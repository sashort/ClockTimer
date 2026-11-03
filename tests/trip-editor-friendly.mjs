import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from './LanguageWindow.mjs';
const w=new Window();try{
for(const name of ['CalendarRange','TripAggregates','TripLog'])w.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const trip={id:1,startTime:'2026-11-03T10:00:00Z',endTime:'2026-11-03T10:27:00Z',standardTimeMilliseconds:1800000,countedTimeMilliseconds:1620000,events:[{id:1,event:'trip.started',timestamp:'2026-11-03T10:00:00Z',value:{}},{id:2,event:'trip.stopped',timestamp:'2026-11-03T10:27:00Z',value:{}},{id:3,event:'trip.official-percent-set',timestamp:'2026-11-03T10:28:00Z',value:{percentTenths:1125,showOfficialStart:true}}]};
const root=w.document.createElement('div');w.document.body.append(root);let pad;
const view=new w.TripLog(root,{range:()=> 'day',filter:()=> 'all',numberPad:async options=>{pad=options;}}),calendar={range:'day',timezone:'UTC',startTime:'2026-11-03T00:00:00Z',endTime:'2026-11-04T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}};
view.render({trips:[trip]},calendar);assert(root.querySelector('.is-official-start').textContent.includes('10:00'));
view.editing.add(1);view.entrySessions.set('1',{original:structuredClone(trip.events),settings:{},revision:'test'});view.rerender();
root.querySelector('.is-official-start .trip-log-entry-time').click();await pad.onConfirm('2026-11-03T10:00:30.123Z');
assert.equal(w.TripTimeBank.project(trip).officialCorrection.startTime,'2026-11-03T10:00:30.123Z');assert.equal(view.entryChanges(trip).at(-1).operation,'official-start-time');assert.equal(trip.events[0].timestamp,'2026-11-03T10:00:00Z');
root.querySelector('.is-official-start .trip-log-entry-remove').click();assert(!root.querySelector('.is-official-start'));assert(!root.querySelector('.is-official-percent'));assert.equal(view.entryChanges(trip).at(-1).operation,'official-start-delete');
trip.events.splice(2);trip.events.push({id:4,event:'interval.started',timestamp:'2026-11-03T10:10:00Z',value:{type:'break',intervalKey:'existing'}},{id:5,event:'interval.ended',timestamp:'2026-11-03T10:15:00Z',value:{intervalKey:'existing'}});
const draft={start:'2026-11-03T10:05:00Z'};view.newEntries.set('1',draft);view.placeNewEntry(trip,draft);assert.equal(view.addBefore.get('1'),'4');view.rerender();assert(root.querySelector('.trip-log-new-entry-pair'));
draft.start='2026-11-03T10:12:00Z';view.placeNewEntry(trip,draft);view.rerender();assert.equal(root.querySelector('.trip-log-new-entry-pair .trip-log-entry-time').getAttribute('aria-invalid'),'true');assert.equal(view.addBefore.get('1'),'4','invalid time does not move the draft');
draft.start='2026-11-03T10:00:00Z';draft.end='2026-11-03T10:05:00Z';assert.deepEqual(Object.values(view.validateNewEntry(trip,draft)),[false,false],'Down can be the first entry');
draft.start='2026-11-03T10:05:00Z';draft.end='2026-11-03T10:20:00Z';assert.equal(view.validateNewEntry(trip,draft).endInvalid,true,'an enclosing overlap is invalid');
console.log('PASS derived Official Start edits/deletion, factual-start preservation, highlighted drafts, valid ordering and invalid red time fields');
}finally{await w.happyDOM.close();}
