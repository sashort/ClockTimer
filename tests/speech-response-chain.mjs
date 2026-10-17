import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';

const window = new Window({url: 'https://clock.example/'});
const shadows = new WeakMap(), animations = [];
const attach = window.Element.prototype.attachShadow;
window.Element.prototype.attachShadow = function(options) {
    const shadow = attach.call(this, options); shadows.set(this, shadow); return shadow;
};
let hold = false;
window.Element.prototype.animate = function(frames, options) {
    let finish;
    const finished = hold ? new Promise(resolve => finish = resolve) : Promise.resolve();
    const animation = {target: this, frames, options, finished, cancel() {finish?.();}, finish() {finish?.();}};
    animations.push(animation); return animation;
};
window.SpeechMenu = {events: new window.EventTarget(), phraseGroups: [], started: true, muted: false};
for (const name of ['SpeechMicBar', 'PresentationSetters'])
    window.eval(fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));
const bar = window.document.createElement('speech-mic-bar'); window.document.body.append(bar);
const shadow = shadows.get(bar), content = shadow.querySelector('#responseContent');
const items = () => [...content.children];
const texts = () => items().map(item => item.textContent);
const settle = async () => {for (let i = 0; i < 15; i++) await Promise.resolve();};
const emit = (type, detail) => window.SpeechMenu.events.dispatchEvent(new window.CustomEvent(type, {detail}));
const snapshot = text => {
    const element = window.document.createElement('span');
    element.dataset.speechResponseSnapshot = ''; element.textContent = text; return element;
};

try {
    bar.setResponse(snapshot('first'), {resultId: 'first'}); await settle();
    assert.deepEqual(texts(), ['first'], 'a single result uses the chain');
    bar.setResponse(snapshot('second'), {resultId: 'second'}); await settle();
    assert.deepEqual(texts(), ['second', 'first'], 'new results dock to the left');
    assert.equal(window.getComputedStyle(content).flexDirection, 'row', 'results are columns in one row');
    assert(animations.some(a => a.target === items()[0] && a.frames[0].transform.startsWith('translateX(')),
        'new result enters horizontally');
    assert.equal(items()[0].style.zIndex, '1', 'docked results return above later incoming results');
    emit('utteranceStarted', {id: 41});
    assert.deepEqual(texts(), ['second', 'first'], 'new utterances retain existing results');
    emit('utteranceTranscriptChanged', {id: 41, transcript: 'show log ready at four', isFinal: false});
    emit('speechCommandDigested', {utteranceId: 41, transcript: 'show log', consumedTranscript: 'show log'});
    assert.equal(shadow.querySelector('#activity').textContent, 'Ready At four', 'processed command leaves the active display');
    emit('utteranceTranscriptChanged', {id: 41, transcript: 'show log ready at four twelve', isFinal: false});
    assert.equal(shadow.querySelector('#activity').textContent, 'Ready At four twelve', 'cumulative results retain only the unfinished value');
    emit('speechRecognitionStatusChanged', {status: 'grammar-switch'});
    assert.equal(shadow.querySelector('#activity').textContent, 'Ready At four twelve', 'decoder grammar switches cannot replace the recognized words');
    emit('speechCommandExecuted', {utteranceId: 41, transcript: 'show log'});
    emit('speechCommandMatched', {utteranceId:41, transcript:'show log', canonicalTranscript:'Log'});
    emit('speechArgumentsPrepared', {utteranceId:41, arguments:['stale']});
    assert.equal(shadow.querySelector('#activity').textContent, 'Ready At four twelve', 'late execution feedback cannot restore processed words');
    assert.equal(shadow.querySelector('#codes').textContent, '', 'processed argument badges cannot return after pruning');

    emit('utteranceStarted', {id: 44});
    emit('utteranceTranscriptChanged', {id:44,transcript:'background noise'});
    emit('speechSegmentSkipped', {utteranceId:44,transcript:'background noise',consumedTranscript:'background noise'});
    emit('utteranceTranscriptChanged', {id:44,transcript:'background noisy words'});
    assert.equal(shadow.querySelector('#activity').textContent,'','revised discarded noise cannot return as accumulated dictation');
    assert.deepEqual(texts(),['second','first'],'discarding noise retains unrelated result columns');

    hold = true;
    bar.presentResponseTransition(snapshot('before'), snapshot('after'), {resultId: 'transition'});
    bar.setResponse(snapshot('newest'), {resultId: 'newest'});
    for (const animation of animations) animation.finish(); hold = false; await settle();
    assert.deepEqual(texts(), ['newest', 'after', 'second', 'first'], 'late before/after animation only updates its own column');
    const first = items().at(-1);
    first.getBoundingClientRect = () => ({left: 250, right: 300, width: 50});
    shadow.querySelector('#response').getBoundingClientRect = () => ({left: 0, right: 300, width: 300});
    await bar.clearResponse({resultId: 'first'});
    const exit = animations.findLast(a => a.target === content);
    assert.equal(exit.frames[1].transform, 'translateX(50px)', 'expiry pushes the whole chain right until the expired column exits');
    assert.deepEqual(texts(), ['newest', 'after', 'second']);
    await Promise.all([bar.clearResponse({resultId: 'second'}), bar.clearResponse({resultId: 'transition'})]);
    assert.deepEqual(texts(), ['newest'], 'simultaneous expirations preserve newer results');
    await bar.clearResponse();
    assert.equal(bar.hasAttribute('has-response'), false);

    // The parent schedules one TTL for each result, including dictation.
    const timers = new Map(); let timerId = 0;
    window.setTimeout = (callback, delay) => {const id = ++timerId; timers.set(id, {callback, delay}); return id;};
    window.clearTimeout = id => timers.delete(id);
    const presentation = window.WMOFPresentationSetters;
    const command = ttl => {const e = window.document.createElement('speech-command'); if (ttl) e.setAttribute('speech-response-timeout', ttl); return e;};
    const a = command('100ms'), b = command('500ms'), persistent = command('persistent');
    presentation.presentSpeechDictation('older', {commandElement: a, utteranceId: 41});
    presentation.presentSpeechDictation({value: 'newer', display: {prefix: 'Time', code: '4:22'}}, {commandElement: b, utteranceId: 41});
    presentation.presentSpeechDictation('persistent', {commandElement: persistent, utteranceId: 42});
    assert.deepEqual(texts(), ['persistent', 'Time 4:22', 'older']);
    assert.deepEqual([...timers.values()].map(t => t.delay), [100, 500], 'a new result never resets an earlier TTL');
    const fire = delay => {const [id, timer] = [...timers].find(([, t]) => t.delay === delay); timers.delete(id); timer.callback();};
    fire(100); await settle();
    assert.deepEqual(texts(), ['persistent', 'Time 4:22'], 'only the expired result is removed');
    fire(500); await settle();
    assert.deepEqual(texts(), ['persistent'], 'persistent TTL keeps its result across other expirations');
    emit('utteranceStarted', {id:42});emit('utteranceUnrecognized', {id:42, transcript:'junk'});
    fire(2000); await settle();
    assert.deepEqual(texts(), ['persistent'], 'clearing a rejected transcript cannot clear an unrelated result TTL');
    presentation.presentSpeechDictation('default', {commandElement: command(), utteranceId: 43});
    assert([...timers.values()].some(t => t.delay === 2000), 'default result TTL remains two seconds');
    await presentation.dismissSpeechResponse();
    assert.deepEqual(texts(), []); assert.equal(timers.size, 0, 'explicit dismissal clears all timers');
    console.log('PASS response columns, newest-left docking, independent TTLs, cross-utterance retention, whole-chain expiry and animation isolation');
} finally {await window.happyDOM.close();}
