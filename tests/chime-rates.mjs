import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('    const CHIME_RATES'), source.indexOf('    function audioVelocityPercent')) + '\nglobalThis.normalize = normalizeChimeRate; globalThis.format = formatChimeRate;', context);
for (const [value, expected] of [[0.7,0.7],[0.85,0.85],[1,1],[1.5,1],[0.5,0.7],[undefined,1]]) assert.equal(context.normalize(value), expected);
assert.equal(context.format(0.7), 'Slow (70%)');
assert.equal(context.format(0.85), 'Medium (85%)');
assert.equal(context.format(1), 'Fast (100%)');
const settings = {masterVelocity:1,speechVelocity:1,toneVelocity:0.85};
Object.assign(context,{audioSettings:settings,AUDIO_SPEECH_VELOCITY_MIN:0.5,AUDIO_SPEECH_VELOCITY_MAX:2.8});
vm.runInContext(source.slice(source.indexOf('    function shiftMasterVelocity'),source.indexOf('    buildAudioAnnouncementRows();'))+'\nshiftMasterVelocity(2);',context);
assert.equal(settings.toneVelocity,0.85);
assert.equal(settings.speechVelocity,2);
const speechActions = source.slice(source.indexOf('    const changeGlobalAudioRate'),source.indexOf('    const setMasterSpeech'));
assert.doesNotMatch(speechActions,/toneVelocity/);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const select of [html.match(/<select id="audioToneVelocity">([\s\S]*?)<\/select>/)?.[1],html.match(/<label data-audio-custom-setting="toneVelocity">[\s\S]*?<select data-audio-custom-value>([\s\S]*?)<\/select>/)?.[1]]) {
 assert.ok(select);
 for(const value of ['0.7','0.85','1']) assert.ok(select.includes(`value="${value}"`));
 assert.equal((select.match(/<option /g)||[]).length,3);
}
console.log('PASS chime presets, saved-rate normalization, independent master/speech changes and both rate controls');
