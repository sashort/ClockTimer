import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const name of ['SpeechDurationEstimator','ToneReferencedAnnouncement']) globalThis.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const estimator=new SpeechDurationEstimator(),text='twenty two fifty six';
const profile={voice:'test-voice',speechVelocity:1};
assert(estimator.estimate(text,{...profile,speechVelocity:2})<estimator.estimate(text,profile));
assert(Math.abs(SpeechDurationEstimator.rate({rate:.8,speechVelocity:1.5})-1.2)<1e-10);
const neutral=estimator.estimate(text,profile),fast=estimator.estimate(text,{...profile,speechVelocity:2});
estimator.observe(text,6000,profile);
assert(estimator.estimate(text,profile)>neutral,'slow actual playback updates that voice/rate profile');
assert.equal(estimator.estimate(text,{...profile,speechVelocity:2}),fast,'a different rate retains its own estimate');
assert.equal(estimator.estimate(text,{voice:'other',speechVelocity:1}),neutral,'a different voice retains its own estimate');
estimator.observe(text,NaN,profile);assert(Number.isFinite(estimator.estimate(text,profile)));

let now=0,activeSpeech=false,cues=[],plans=[],durations=[1100];
const timing=new ToneReferencedAnnouncement({now:()=>now,wait:async ms=>{now+=ms;}});
const valueAt=at=>1379250-at;
const format=value=>String(Math.round(value/1000));
const speak=async()=>{activeSpeech=true;now+=durations.shift()??1100;activeSpeech=false;return true;};
const play=async plan=>{
 assert(!activeSpeech);assert(now+180<=plan.at,'real speech end leaves the configured gap');
 assert(Math.abs(plan.value/1000-Math.round(plan.value/1000))<1e-6,'cue aligns with a whole remaining second');
 assert.equal(plan.value,valueAt(plan.at));cues.push(plan);now=plan.at;
 return {finished:Promise.resolve({reason:'completed'}),stop(){assert.fail('successful cue should not stop');}};
};
let result=await timing.run({valueAt,format,speak,play,profile,onPlan:p=>plans.push(p)});
assert(result.performed);assert.equal(cues.length,1);assert.equal(result.text,format(valueAt(result.at)));

// A first estimate can be wrong. The first deadline must be discarded, never cued late.
now=0;cues=[];plans=[];durations=[6500,1100];
result=await timing.run({valueAt,format,speak,play,profile,onPlan:p=>plans.push(p)});
assert(result.performed);assert.equal(cues.length,1);assert.equal(plans.length,2);
assert(result.at>plans[0].at,'overrun recalculates the future value and speaks it again');

// A rate change alters the available lead time without reusing the slower profile.
const scheduleAt=async velocity=>{
 let clock=0,deadline;
 const coordinator=new ToneReferencedAnnouncement({now:()=>clock,estimator:new SpeechDurationEstimator()});
 await coordinator.run({valueAt:at=>900000-at,format:()=>text,profile:{speechVelocity:velocity},
  speak:async()=>{clock+=100;return true;},play:async p=>{deadline=p.at;return {finished:Promise.resolve()};}});
 return deadline;
};
assert(await scheduleAt(.5)>await scheduleAt(2),'selected speech speed changes the predicted cue time');

now=0;cues=[];let allowed=true;
result=await timing.run({valueAt,format,profile,guard:()=>allowed,
 speak:async()=>{allowed=false;return true;},play});
assert(!result.performed);assert.equal(cues.length,0,'cancellation during speech never cues');
allowed=true;
result=await timing.run({valueAt,format,profile,speak:async()=>false,play});
assert(!result.performed);assert.equal(cues.length,0,'speech failure never cues');

now=0;let stops=0;
result=await timing.run({valueAt,format,profile,guard:()=>allowed,speak,
 play:async()=>{allowed=false;return {finished:new Promise(()=>{}),stop(){stops++;}};}});
assert(!result.performed);assert.equal(stops,1,'a pending scheduled song is stopped if ownership changes');

const catalog=JSON.parse(fs.readFileSync(new URL('../api/audio/catalog.json',import.meta.url),'utf8'));
assert.deepEqual(catalog.songs['time-reference'],{bpm:300,instrument:'cinematic-pulse-bass',events:[{offset:'0',tone:'D5',length:'1',dynamic:'mf'}]});
console.log('PASS voice/rate estimates, measured profiles, target alignment, overrun retry, speech separation, cancellation and approved time cue');
