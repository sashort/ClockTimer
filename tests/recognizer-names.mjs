import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Window} from 'happy-dom';
const source=fs.readFileSync(new URL('../RecognizerNames.js',import.meta.url),'utf8');
let reject=false;const stored=new Map();
const context={document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},
 WMOFLanguagePack:{locale:'en-US',resources:{'speech-patterns':{recognizerNames:{default:'Beatrice',presets:['Beatrice','Octavia']}}}},
 SpeechMenu:{refresh(){}},WMOFPersistence:{async getItem(key){return stored.get(key);},async setItem(key,value){if(reject)throw Error('storage failed');stored.set(key,value);}}};
vm.createContext(context);vm.runInContext(source,context);await new Promise(setImmediate);
const names=context.WMOFRecognizerNames;
assert.equal(names.split('ready at four twenty two Beatrice sync off').before,'ready at four twenty two');
assert.equal(names.split('ready at four twenty two Beatrice sync off').after,'sync off');
assert.equal(names.split('beatrices sync off'),null);
assert.equal(names.split('BEATRICE, sync off').after,'sync off');
assert.equal(names.split('Beatrice sync off Beatrice time').after,'sync off Beatrice time','first boundary preserves intermediate commands');
await names.save('Octavia');assert.equal(names.name,'Octavia');
context.WMOFLanguagePack.locale='fr-FR';assert.equal(names.name,'Beatrice');
await names.save('Élodie');assert.equal(names.split('ÉLODIE temps').after,'temps');
context.WMOFLanguagePack.locale='en-US';assert.equal(names.name,'Octavia','custom names are locale scoped');
reject=true;await assert.rejects(names.save('Theodore'));assert.equal(names.name,'Octavia','failed saving restores the previous name');
reject=false;await names.save('');assert.equal(names.split('Octavia sync off'),null,'Off disables named boundaries');
await assert.rejects(names.save('sync off 3'));
console.log('PASS recognizer names, word boundaries, locale persistence, Off, and failed-save rollback');

const ui=new Window({url:'https://clock.example/'});
ui.document.body.innerHTML='<select id="recognizerNamePreset"><option value="">Off</option><option value="custom">Custom name</option></select><input id="recognizerNameCustom" hidden><button id="recognizerNameSave">Save</button><output id="recognizerNameStatus"></output>';
const uiContext={...context,document:ui.document,WMOFLanguagePack:{...context.WMOFLanguagePack,text:id=>id},WMOFPersistence:{async getItem(){return JSON.stringify({'en-US':{name:'Octavia'}});},async setItem(){}}};
vm.createContext(uiContext);vm.runInContext(source,uiContext);
ui.document.dispatchEvent(new ui.Event('DOMContentLoaded'));await new Promise(setImmediate);
const preset=ui.document.getElementById('recognizerNamePreset');
assert.equal(preset.querySelectorAll('option[value="custom"]').length,1,'async load and dialog binding preserve Custom option');
assert.equal(preset.querySelectorAll('option[value="Beatrice"]').length,1,'async render does not duplicate presets');
assert.equal(preset.value,'Octavia');preset.value='custom';preset.dispatchEvent(new ui.Event('change'));
assert.equal(ui.document.getElementById('recognizerNameCustom').hidden,false);
await ui.happyDOM.close();console.log('PASS settings options survive asynchronous initialization and custom input opens');
