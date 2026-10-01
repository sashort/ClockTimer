import { englishLanguage } from './announcement-language-fixture.mjs';
const language = await englishLanguage();
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ctx=vm.createContext({announcementLanguage:language, announcementText:language.text,AUDIO_ANNOUNCEMENTS:[['test']],AUDIO_LANGUAGE:'en-US',AUDIO_SPEECH_VELOCITY_MIN:0.5,AUDIO_SPEECH_VELOCITY_MAX:2.8,CHIME_VOLUME_RATIO:0.5,ANNOUNCEMENT_SPEECH_PAUSE_AT_1X:300});
vm.runInContext(source.slice(source.indexOf('    const CHIME_RATES'),source.indexOf('    function audioVelocityPercent'))+source.slice(source.indexOf('    function defaultAudioSettings'),source.indexOf('    function loadAudioSettings'))+'\nglobalThis.normalize=normalizeAudioSettings;',ctx);
for(const [input,expected] of [[{volume:0.4},0.4],[{speechVolume:0.3,toneVolume:0.9},0.3],[{toneVolume:0.2},0.2],[{volume:0,speechVolume:1},0],[{},1]]) {
 const settings=ctx.normalize(input); assert.equal(settings.volume,expected); assert.ok(!('speechVolume' in settings));assert.ok(!('toneVolume' in settings));
}
const settings=ctx.normalize({speechVolume:0.6,rows:{test:{custom:{speechVolume:0.4,toneVolume:0.8}}}});
assert.equal(settings.rows.test.custom.volume,0.4);assert.ok(!('toneVolume' in settings.rows.test.custom));
ctx.audioSettings=settings;
const start=source.indexOf('    function audioAnnouncementOutput(');
vm.runInContext(source.slice(start,source.indexOf('    function cloneAudioAnnouncementRow',start))+'\nglobalThis.output=audioAnnouncementOutput;',ctx);
assert.equal(ctx.output('test').speechVolume,0.4);assert.equal(ctx.output('test').toneVolume,0.2);
assert.equal(ctx.output('other').speechVolume,0.6);assert.equal(ctx.output('other').toneVolume,0.3);
settings.volume=0;assert.equal(ctx.output('other').toneVolume,0);assert.equal(ctx.output('other').speechVolume,0);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.includes('id="audioVolume"'));assert.ok(html.includes('data-audio-custom-setting="volume"'));assert.doesNotMatch(html,/id="audio(?:Speech|Tone)Volume"|data-audio-custom-setting="(?:speech|tone)Volume"/);
console.log('PASS shared volume, mute, legacy migration, announcement overrides, conservative chime gain and consolidated controls');
