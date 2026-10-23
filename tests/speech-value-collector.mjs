import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installSpeechLifecycle} from './speech-lifecycle-fixture.mjs';
installSpeechLifecycle();
const source=['DurationParser','SpokenTimeParser','PercentParser','SpeechValuePreprocessor']
    .map(name=>fs.readFileSync(new URL(`../lang/en-US/${name}.js`,import.meta.url),'utf8')).join('\n');
const Values=Function(source+'\nreturn EnglishSpeechValuePreprocessor;')();
const make=kind=>new SpeechValueCollector({id:kind,classify:(text,options)=>Values.classify(text,kind,options)});
const duration=make('duration');
duration.update([{id:'capture-1:0',text:'an hour',final:false}]);
assert.equal(duration.evaluate().value,'1:00:00');
assert.equal(duration.evaluate().settled,false,'parseable does not mean complete');
duration.update([{id:'capture-1:0',text:'an hour and',final:false}]);
assert.equal(duration.evaluate().status,'incomplete');
duration.update([{id:'capture-1:0',text:'an hour',final:true}]);
duration.update([{id:'capture-2:0',text:'and five',final:false}]);
assert.equal(duration.evaluate().value,'1:05:00');
assert.deepEqual(duration.evaluate().components,{hours:1,minutes:5,seconds:0});
assert.deepEqual(duration.evaluate().inferred,{hours:false,minutes:false,seconds:true},'spoken five stays explicit; omitted seconds are defaulted');
assert.deepEqual(Values.classify('one hour five minutes zero seconds','duration').inferred,{hours:false,minutes:false,seconds:false},'spoken zero is explicit');
assert.deepEqual(Values.classify('four zero zero','duration').inferred,{hours:true,minutes:false,seconds:false},'keypad-style zero seconds are explicit');
assert.deepEqual(Values.classify('four twelve','clock').components,{hours:4,minutes:12,seconds:0});
assert.deepEqual(Values.classify('four twelve','clock').inferred,{hours:false,minutes:false,seconds:true});
assert.deepEqual(Values.classify('four','clock').inferred,{hours:false,minutes:true,seconds:true});
assert.equal(duration.project([{id:'capture-2:0',text:'and six',final:false}]),'an hour and six');
assert.equal(duration.transcript,'an hour and five','alternative probing is pure');
duration.update([{id:'capture-2:0',text:'and five',final:true}]);
duration.update([{id:'capture-2:0',text:'and five',final:true}]);
assert.equal(duration.transcript,'an hour and five','final replay has the same identity');
assert.equal(duration.complete().value,'1:05:00');
assert.equal(duration.complete(),undefined,'settlement is once only');
assert.equal(duration.update([{id:'late',text:'six',final:true}]),false);
const clock=make('clock');
clock.update([{id:1,text:'five',final:true}]);
clock.update([{id:2,text:'thirty',final:true}]);
assert.equal(clock.complete().value,'5:30');
const percent=make('percent');
percent.update([{id:1,text:'one hundred',final:false}]);
percent.update([{id:1,text:'one hundred five percent',final:true}]);
assert.equal(percent.complete().value,'105');
const same=new SpeechValueCollector();
same.update([{id:1,text:'one',final:true},{id:2,text:'one',final:true}]);
assert.equal(same.transcript,'one one','different spans may contain identical words');
const revised=new SpeechValueCollector();
revised.update([{id:1,text:'five',final:true},{id:2,text:'thirty',final:false},{id:3,text:'two',final:false}]);
revised.update([{id:2,text:'forty',final:false}]);
assert.equal(revised.transcript,'five forty','removed interim slots do not survive');
const invalid=make('duration');
invalid.update([{id:1,text:'hundred seven seconds',final:true}]);
assert.equal(invalid.complete().status,'malformed');
let sequence=0;const timers=new Map();
const owner=new SpeechContinuationSession({id:'owner',surfaces:['pad'],now:()=>0,
    schedule:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},unschedule:id=>timers.delete(id)});
const owned=owner.valueCollector('value',{classify:(text,o)=>Values.classify(text,'duration',o)});
owned.update([{id:1,text:'an hour',final:true}]);
let settled=0;owned.continuation.armSilence(400,()=>{owned.complete();settled++;});
owner.cancelSilence();
assert.equal(timers.size,1,'command probe cancellation cannot erase the value deadline');
assert(owner.transfer('duration','pad'));
assert.equal(owner.valueCollector('value'),owned,'context transfer preserves the collector');
const pending=[...timers.values()][0];
owner.cancel();pending.fn();
assert.equal(settled,0,'stale deadlines cannot complete cancelled values');
assert.equal(owned.status,'cancelled');
assert.throws(()=>owner.valueCollector('other'),/cancelled/);
console.log('PASS shared values: duration, clock, percent, identity, revisions, pure alternatives, settlement, transfer and owned cancellation');

for (const range of [[4,4],[8,8],[1,6],[1,4]]) {
 const collector=new SpeechValueCollector({digitRange:range});
 collector.update([{id:1,text:'0'.repeat(range[0]),final:false}]);
 assert.equal(collector.evaluate().status,'valid','zero digits are structurally valid');
 assert.equal(collector.evaluate().settled,range[0]===range[1]);
 collector.update([{id:1,text:'0'.repeat(range[1]+1),final:false}]);
 assert.equal(collector.evaluate().status,'malformed','overflow rejected');
}
const pin=new SpeechValueCollector({digitRange:[4,4]});
pin.update([{id:1,text:'123',final:false}]);
assert.equal(pin.evaluate().status,'incomplete');
assert.equal(pin.evaluate({boundary:true}).status,'malformed');
pin.update([{id:1,text:'0000',final:false}]);
assert.equal(pin.evaluate().value,'0000','leading zeroes preserved');
pin.update([{id:1,text:'hello',final:false}]);
assert.equal(pin.evaluate().status,'malformed','non-digit input is not valid with undefined value');
console.log('PASS explicit digit lengths: ID/PIN, credentials, durations, clock values, zeroes and overflow');

const discrete=new SpeechValueCollector({digitCounts:[8,4,4]});
assert.deepEqual(discrete.digitCounts,[4,8]);
for(let count=1;count<=9;count++){
 discrete.update([{id:'digits',text:'0'.repeat(count),final:false}]);
 assert.equal(discrete.evaluate().status,count>8?'malformed':[4,8].includes(count)?'valid':'incomplete');
 if(count===4)assert.equal(discrete.evaluate().settled,false,'four remains open for an eight-digit continuation');
 if(count===8)assert.equal(discrete.evaluate().settled,true);
 if(count===6)assert.equal(discrete.evaluate({boundary:true}).status,'malformed','silence cannot accept a forbidden length');
}
assert.throws(()=>new SpeechValueCollector({digitCounts:[]}),/Digit counts/);
assert.throws(()=>new SpeechValueCollector({digitCounts:[4,0]}),/Digit counts/);
assert.throws(()=>new SpeechValueCollector({digitCounts:[4,8],digitRange:[4,8]}),/Choose/);
console.log('PASS discrete digit counts: four/eight valid, gaps incomplete, boundary rejection, overflow and continuation');

const contextualDigits=new SpeechValueCollector({digitCounts:[4,8],digitContexts:{4:'id',8:'credentials'}});
for(const [digits,context] of [['0042','id'],['004212','undefined'],['00421234','credentials']]){
 contextualDigits.update([{id:'stream',text:digits,final:false}]);
 assert.equal(String(contextualDigits.evaluate().digitContext),context);
}
assert.equal(contextualDigits.evaluate().value,'00421234','the collector retains leading zeroes and every digit');
assert.throws(()=>new SpeechValueCollector({digitCounts:[4,8],digitContexts:{6:'other'}}),/declared/);
console.log('PASS context descriptors selected by accepted digit count without dispatch side effects');
