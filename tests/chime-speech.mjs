import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bar=fs.readFileSync(new URL('../SpeechMicBar.js',import.meta.url),'utf8');
const pattern=bar.match(/"chime-rate",\s*"([^"]+)"/)[1];
const regex=new RegExp(pattern,'i');
const calls=[];
const settings={toneVelocity:1,speechVelocity:2,volume:0.6,masters:{chime:false}};
const ctx=vm.createContext({audioSettings:settings,renderAudioSettings:()=>calls.push('render'),applyAudioOutputSettings:()=>calls.push('apply'),saveAudioSettings:()=>calls.push('save'),confirmSettingChange:(text)=>{calls.push(text);return true;}});
vm.runInContext(app.slice(app.indexOf('    const CHIME_RATES'),app.indexOf('    function audioVelocityPercent'))+app.slice(app.indexOf('    const setChimeRate ='),app.indexOf('    const setMasterChime ='))+'\nglobalThis.setRate=setChimeRate;',ctx);
for(const [phrase,value] of [['chime fast',1.2],['chime medium',1],['chime slow',0.8]]) {
 const match=regex.exec(phrase);assert.ok(match);calls.length=0;
 assert.equal(ctx.setRate(match.groups.rate),true);assert.equal(settings.toneVelocity,value);
 assert.equal(settings.speechVelocity,2);assert.equal(settings.volume,0.6);assert.equal(settings.masters.chime,false);
 assert.deepEqual(calls.slice(0,3),['render','apply','save']);
}
calls.length=0;assert.equal(ctx.setRate('invalid'),false);assert.equal(calls.length,0);
assert.equal(regex.test('chime on'),false);assert.equal(regex.test('chime off'),false);
console.log('PASS chime preset phrases, actual action, persistence hooks, invalid input and independent speech/volume/enable state');
