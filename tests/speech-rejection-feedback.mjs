import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installSpeechLifecycle} from './speech-lifecycle-fixture.mjs';
installSpeechLifecycle();
class DetailEvent extends Event {constructor(type,detail){super(type);this.detail=detail;}}
const events=new EventTarget(),played=[],errors=[];let enabled=true;
const feedback=new SpeechRejectionFeedback({events,play:result=>played.push(result),enabled:()=>enabled,onError:error=>errors.push(error)});
const emit=(rootId,outcome,extra={})=>events.dispatchEvent(new DetailEvent('speechAttemptRejected',
 {rootId,outcome,source:'recognition',confirmed:true,...extra}));
for(const [index,outcome] of ['malformed','incomplete','invalid-value','unrecognized'].entries()) {
 emit('root-'+index,outcome);emit('root-'+index,outcome);
}
assert.equal(played.length,4,'one cue per confirmed rejected root, despite repeated final results');
for(const outcome of ['success','cancelled','waiting','network-error','permission-denied'])emit(outcome,outcome);
emit('partial','incomplete',{confirmed:false});emit('junk','unrecognized',{ignored:true});
emit('server','malformed',{source:'persistence'});
events.dispatchEvent(new DetailEvent('speechRecognitionFailed',{message:'microphone unavailable'}));
assert.equal(played.length,4,'continuations, ignored junk, cancellation and non-recognition failures stay silent');
enabled=false;emit('muted','malformed');enabled=true;emit('muted','malformed');
assert.equal(played.length,4,'late replay after reactivation cannot announce an old muted rejection');
feedback.dispose();emit('disposed','unrecognized');assert.equal(played.length,4);

const failed=new SpeechRejectionFeedback({events,play:()=>Promise.reject(Error('audio failed')),onError:error=>errors.push(error)});
emit('audio','malformed');await Promise.resolve();await Promise.resolve();
assert.equal(errors[0].message,'audio failed');failed.dispose();
const catalog=JSON.parse(fs.readFileSync(new URL('../api/audio/catalog.json',import.meta.url),'utf8'));
const song=catalog.songs['speech-rejected'];
assert.equal(song.instrument,'cinematic-pulse-bass');assert.equal(song.bpm,300);
assert.deepEqual(song.events.map(event=>[event.tone,event.length]),[['D#3\\A2','1/2'],['D#2','1/2']],
 'the approved short bend/supporting note is the production song');
assert(song.events.every(event=>!event.speech));
console.log('PASS confirmed rejection selection, deduplication, silent exclusions, mute/disposal, errors and approved cue');
