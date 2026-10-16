import assert from 'node:assert/strict';
import {installSpeechLifecycle} from './speech-lifecycle-fixture.mjs';
installSpeechLifecycle();
const Scope = globalThis.OwnedFeedbackScope;

const scope = new Scope(), calls = [];
const staleCancel = scope.defer('prompt', () => calls.push('old'));
scope.defer('prompt', () => calls.push('current'));
staleCancel();
assert.deepEqual(calls, [], 'feedback stays pending until its workflow settles');
scope.release();scope.release();
assert.deepEqual(calls, ['current'], 'old cancellation cannot remove a replacement; release is once-only');
assert.equal(scope.playingCount, 0, 'fire-and-forget callbacks leave no playback lease');

let signal, stops = 0;
const cancelPlayback = scope.defer('owned', next => {signal = next;return () => stops++;});
scope.release();
scope.interrupt('resumed', {discardPending:false});cancelPlayback();scope.cancel();
assert(signal.aborted);assert.equal(signal.reason, 'resumed');assert.equal(stops, 1, 'stop only this scope playback, exactly once');

const ordered = new Scope();
let cancelSecond;
ordered.defer('first', () => cancelSecond());
cancelSecond = ordered.defer('second', () => assert.fail('cancelled sibling cannot start during release'));
ordered.release();

const reentrant = new Scope();let reentrantStops = 0;
reentrant.defer('prompt', signal => {reentrant.cancel();assert(signal.aborted);return () => reentrantStops++;});
reentrant.release();assert.equal(reentrantStops, 1, 'cancellation inside start also stops a handle returned afterward');
reentrant.defer('late', () => assert.fail('cancelled scopes cannot accept late feedback'));
reentrant.release();assert.equal(reentrant.pendingCount, 0);

const asyncScope = new Scope();let finishOld;
asyncScope.defer('prompt', () => ({finished:new Promise(resolve => finishOld=resolve),stop(){}}));
asyncScope.release();
let newStops=0;
asyncScope.defer('prompt', () => ({stop(){newStops++;}}));asyncScope.release();
finishOld();await Promise.resolve();await Promise.resolve();
assert.equal(asyncScope.playingCount, 1, 'a stale completion cannot remove the replacement playback');
asyncScope.cancel();assert.equal(newStops, 1);

const errors=[], isolated = new Scope({onError:error=>errors.push(error.message)});
isolated.defer('broken', () => {throw Error('playback failed');});
isolated.defer('good', () => calls.push('good'));isolated.release();
assert.deepEqual(errors,['playback failed']);assert.equal(calls.at(-1),'good');
const independent = new Scope();independent.defer('other',()=>calls.push('independent'));
isolated.cancel();independent.release();assert.equal(calls.at(-1),'independent');
console.log('PASS deferred feedback, replacement identity, cancellation, reentrancy, stale completions and owner isolation');
