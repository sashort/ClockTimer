import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installSpeechLanguage} from './speech-language-fixture.mjs';
const context={};const evaluate=source=>vm.runInNewContext(source,context);
const Controller=installSpeechLanguage(context,evaluate);
assert.equal(Controller.locale,'en-US');
assert.equal(Controller.normalize('one ten','percent'),'110');
assert.equal(Controller.format(65000,'duration'),'1:05');
assert.equal(Controller.format(65000,'duration',{canonical:true}),'0:01:05');
assert.deepEqual(Array.from(Controller.constraints('clock').digitRange),[1,4]);
assert.deepEqual(Array.from(Controller.constraints('duration').digitRange),[1,6]);
assert.throws(()=>Controller.activate('fr-FR'),/No speech language contract/);
const english=Controller.vocabulary();
assert(Object.isFrozen(english)&&Object.isFrozen(english.number),'shared vocabulary is immutable');
assert.equal(Controller.vocabulary(),english,'one vocabulary per contract');
const results=Controller.checkParity();
assert(results.total>7000,'generated parity covers complete numeric forms, every clock minute, and duration combinations');
assert.equal(results.failures.length,0,JSON.stringify(results.failures.slice(0,8)));
const registrations=new Map();
Controller.bindCollectors({registerValueContext:(kind,classify,constraints)=>registrations.set(kind,{classify,constraints})},{resolveKind:kind=>kind==='keypad'?'duration':kind});
assert.equal(registrations.get('keypad').classify('an hour and five').value,'1:05:00');
assert.equal(registrations.get('clock').classify('four twelve').value,'4:12');
const late=new Map();
const unbind=Controller.bindCollectors(undefined);
context.SpeechMenu={registerValueContext:(kind,...args)=>late.set(kind,args)};
Controller.refreshCollectors();
assert.equal(late.get('duration')[0]('an hour and five').value,'1:05:00','lazy SpeechMenu receives pending collectors');
unbind();delete context.SpeechMenu;
// A second synthetic locale verifies that the controller neither interprets
// nor replaces language-specific words with English rules.
Controller.register({version:1,locale:'zz-ZZ',contexts:{number:{}},
 vocabulary:()=>({time:['temporal'],duration:['interval'],number:['centum'],digits:['digit'],date:['date']}),
 normalize:(value,kind)=>kind==='percent'&&value==='centum'?'100':undefined,
 parse:(value,kind)=>kind==='percent'&&value==='centum'?100:undefined,
 classify:(value,kind)=>kind==='percent'&&value==='centum'?{status:'valid',value:'100'}:{status:'malformed'},
 examples:[{kind:'percent',phrase:'centum',value:'100',recognition:'phrase'}]});
context.SpeechMenu={started:true};
assert.throws(()=>Controller.activate('zz-ZZ'),/Stop speech recognition/);
context.SpeechMenu.started=false;const revision=Controller.revision;
Controller.activate('zz-ZZ');
assert(Controller.revision>revision);
assert.equal(Controller.parse('centum','percent'),100);
assert.equal(registrations.get('percent').classify('centum').value,'100','bound collectors follow the active contract');
assert.equal(Controller.normalize('one ten','percent'),undefined,'no English fallback');
assert.equal(Controller.checkParity().failures.length,0);
Controller.activate('en-US');
assert.equal(Controller.vocabulary(),english);
// Contract mismatches must fail parity rather than quietly dropping a form.
Controller.register({version:1,locale:'zz-AA',contexts:{},vocabulary:()=>({time:['x'],duration:['x'],number:['x'],digits:['x'],date:['x']}),
 normalize:()=>undefined,parse:()=>undefined,classify:()=>({status:'valid',value:'100'}),
 examples:[{kind:'percent',phrase:'missing',value:'100',recognition:'phrase'}]});
assert.equal(Controller.checkParity('zz-AA').failures.length,1);
console.log(`PASS language-neutral controller: ${results.total} generated en-US parity cases, bounds, locale isolation, activation guard and shared collectors`);
