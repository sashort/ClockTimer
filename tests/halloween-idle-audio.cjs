const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/halloween.json'), 'utf8'));
const score = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/instruments/neon-countdown-score.json'), 'utf8'));
catalog.touchtones = {...catalog.touchtones, octaveShift: -4,
    strings: {gain: 1.7, ringSeconds: 0.25, decaySeconds: 0.5},
    idleBell: {gain: 1.5, timeoutSeconds: 1}};
catalog.instruments['halloween-strings'] = score.instruments['finale-horror-strings'];
catalog.instruments['halloween-idle-bell'] = score.instruments['midnight-tubular-bells'];
const requests = [], nodes = [];
const scope = {URLSearchParams, Date, console, location: {search: '?halloweenPreview=1'},
    setTimeout: fn => fn(), fetch: async url => {
        requests.push(url); return {ok: true, json: async () => catalog, arrayBuffer: async () => url};
    }};
vm.createContext(scope); vm.runInContext(fs.readFileSync(path.join(root, 'api/audio/HalloweenAudio.js'), 'utf8'), scope);
const param = () => ({value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelAndHoldAtTime(){}});
const context = {currentTime: 0, decodeAudioData: async url => ({url}),
    createGain: node, createBiquadFilter: node, createOscillator: node, createBufferSource: node};
function node() {
    const n = {gain: param(), frequency: param(), detune: param(), Q: param(), playbackRate: param(),
        connect(){}, disconnect(){this.disconnected = true;}, addEventListener(){},
        start(at = context.currentTime){this.startsAt = at;}, stop(at = context.currentTime){
            if (this.buffer) assert.notEqual(this.startsAt, undefined, 'start a sample before scheduling its stop');
            this.stopped = true; this.endsAt = at;
        }};
    nodes.push(n); return n;
}
const entry = () => ({nodes: new Set(), released: false});
const bells = () => nodes.filter(n => n.buffer?.url.includes('tubular'));
(async () => {
    const audio = scope.WMOFHalloweenAudio, e1 = entry(), e2 = entry();
    const pair = [697, 1209];
    const pitches = audio.chordFrequencies(pair, catalog.touchtones);
    assert.deepEqual(Array.from(pitches), [1209 / 2, 697, 697 * 1.5].sort((a, b) => a - b),
        'string voices derive from both bass pitches and their fifth');
    await audio.touchtones(context, node(), pair, 0.3, e1);
    assert.equal(bells().length, 0, 'no bell on a keypress');
    context.currentTime = 0.25; e1.releaseAudioNodes('key-released'); await audio.whenIdleScheduled();
    assert.equal(bells().at(-1).startsAt, 1.25, 'bell follows a full second of inactivity');
    const first = bells().at(-1);
    context.currentTime = 0.8; await audio.touchtones(context, node(), [770, 1336], 0.3, e2);
    assert(first.stopped, 'next press cancels the pending bell');
    context.currentTime = 1.05; e2.releaseAudioNodes('key-released'); await audio.whenIdleScheduled();
    assert.equal(bells().at(-1).startsAt, 2.05);
    const previous = bells().at(-1);
    context.currentTime = 1.4; await audio.buttonActivity();
    assert(previous.stopped, 'other keypad buttons restart the inactivity timeout');
    const current = bells().at(-1);
    assert.equal(current.startsAt, 2.4);
    const compatible = audio.chordFrequencies([770, 1336], catalog.touchtones).map(f => f / 2);
    const recording = catalog.instruments['halloween-idle-bell'].samples.find(s => s.url === current.buffer.url);
    assert(compatible.some(f => Math.abs(current.playbackRate.value * recording.rootFrequency - f) < 1e-8),
        'bell is chosen from the last chord');
    context.currentTime = 3; await audio.buttonActivity();
    assert(!current.stopped, 'an already ringing bell retains its natural decay');
    audio.cancelPending(true);
    assert(bells().every(b => b.stopped), 'hard cancellation stops ringing and pending bells');
    const unique = new Set(requests.filter(r => r.endsWith('.wav')));
    assert.equal(requests.filter(r => r.endsWith('.wav')).length, unique.size, 'recordings are cached across presses');
    catalog.touchtones.idleBell = {gain: 6, timeoutSeconds: 1, chord: true,
        envelope: {attack: 0.12, hold: 0.6, release: 1}};
    const organScope = {...scope}; vm.createContext(organScope);
    vm.runInContext(fs.readFileSync(path.join(root, 'api/audio/HalloweenAudio.js'), 'utf8'), organScope);
    const before = nodes.length;
    const chord = await organScope.WMOFHalloweenAudio.playIdleBell(context, node(), 0.3, pair, 0, 6);
    assert.equal(chord.pitches.length, 4, 'organ plays a chord instead of one note');
    const voices = nodes.slice(before).filter(n => n.buffer);
    assert.equal(voices.length, 4);
    assert(voices.every(n => n.startsAt === 6 && n.endsAt > 7.7), 'all voices sustain and release after the scheduled start');
    assert(Math.abs(chord.pitches[2] / chord.pitches[0] - 6 / 5) < 1e-8, 'organ has a dark minor third');
    organScope.WMOFHalloweenAudio.cancelPending(true);
    catalog.touchtones.idleBell = {pulse: true, timeoutSeconds: 1, holdSeconds: 1.2, volume: 0.35};
    catalog.instruments['halloween-idle-pulse'] = score.instruments['midnight-pulse'];
    const calls = [], stops = [];
    organScope.performance = {now: () => 5000};
    organScope.WMOFAudio = {startSong: async (name, options) => {
        calls.push({name, options}); return {id: 77, finished: new Promise(() => {})};
    }, stopSong: id => stops.push(id)};
    const lowPulse = await organScope.WMOFHalloweenAudio.playIdleBell(context, node(), 0.3, pair, 0, 10);
    assert.equal(calls[0].name, 'halloween-idle-pulse');
    assert.equal(calls[0].options.seasonalNote, 'F1', 'timeout uses a low note related to the last bass root');
    assert.equal(calls[0].options.startAtPerformanceMs, 12000, 'synth preserves the scheduled timeout');
    assert.equal(calls[0].options.useSelectedInstrument, false);
    const pulseCatalog = await organScope.WMOFHalloweenAudio.pulseCatalog({instruments: {}, songs: {}}, 'F1');
    assert.equal(pulseCatalog.instruments['halloween-idle-pulse'], score.instruments['midnight-pulse'], 'use actual Part 2 preset');
    assert.equal(pulseCatalog.songs['halloween-idle-pulse'].events[0].length, '2.4', 'hold the pulse for 1.2 seconds');
    lowPulse.stop(); assert.deepEqual(stops, [77], 'pending synth note can be canceled');
    console.log('PASS bass-related chords, idle timing/reset, natural decay, cancellation, cached samples, organ envelope and actual Part 2 synth dispatch');
})().catch(error => {console.error(error); process.exitCode = 1;});
