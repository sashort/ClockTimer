import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.doesNotMatch(app,/\bbpm:\s*\d/,'Announcement calls must use song tempo');
const engine=fs.readFileSync(new URL('../api/audio/AudioEngine.js',import.meta.url),'utf8');
const expression=engine.match(/const tempo =\s*([\s\S]*?);/)[1];
const catalog=JSON.parse(fs.readFileSync(new URL('../api/audio/catalog.json',import.meta.url),'utf8'));
for(const name of ['trip-started','trip-ended','trip-transition','lunch-clock-in','goal-failed']) {
 const song=catalog.songs[name];
 for(const rate of [0.8,1,1.2]) {
  const actual=vm.runInNewContext(expression,{bpm:undefined,song,effectiveToneVelocity:rate});
  assert.equal(actual,song.bpm*rate);
 }
}
console.log('PASS chimes use each song BPM at 80/100/120%, without app tempo overrides');

assert.equal(catalog.songs["trip-started"].bpm,225);
assert.equal(catalog.songs["trip-started"].bpm*0.8,180);
assert.equal(catalog.songs["trip-started"].bpm*1.2,270);
