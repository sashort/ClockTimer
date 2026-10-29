const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/catalog.json'), 'utf8'));
const seasonal = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/halloween.json'), 'utf8'));
const snapshot = JSON.stringify(base);
// Exercise the pulse-only fallback separately from the recorded layer/idle test.
delete seasonal.touchtones.strings; delete seasonal.touchtones.idleBell;
const scope = {URLSearchParams, Date, setTimeout: fn => fn(), location: {search: ''}, fetch: async () => ({ok: true, json: async () => seasonal})};
vm.createContext(scope); vm.runInContext(fs.readFileSync(path.join(root, 'api/audio/HalloweenAudio.js'), 'utf8'), scope);
(async () => {
    const audio = scope.WMOFHalloweenAudio;
    assert(!audio.isActive(new Date(2026, 9, 30, 23, 59)));
    assert(audio.isActive(new Date(2026, 9, 31, 0, 0)));
    assert(!audio.isActive(new Date(2026, 10, 1, 0, 0)));
    scope.location.search = '?halloweenPreview=1';
    assert(audio.isActive(new Date(2026, 9, 29)));
    assert.equal(Object.keys(seasonal.songs).length, 0, 'no announcement cue overrides');
    assert.equal(audio.catalog, undefined, 'normal song selection is not intercepted');
    assert.equal(JSON.stringify(base), snapshot, 'saved/default catalog is never changed');
    const sampleLoads = [], frequencies = [], sources = [];
    const param = () => ({value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelAndHoldAtTime(){}});
    const node = () => ({connect(){}, start(){}, stop(){this.stopped=true;}, disconnect(){this.disconnected=true;}, gain: param(), frequency: param(), playbackRate: param(), detune: param(), Q: param()});
    const context = {currentTime: 0, decodeAudioData: async b => b,
        createGain: node, createBiquadFilter: node,
        createOscillator(){const n = node(); frequencies.push(n); return n;},
        createBufferSource(){const n = node(); sources.push(n); return n;}};
    scope.fetch = async url => url.endsWith('.wav')
        ? (sampleLoads.push(url), {ok: true, arrayBuffer: async () => new ArrayBuffer(8)})
        : {ok: true, json: async () => seasonal};
    const pair = [697, 1209];
    for (let i = 0; i < 12; i++) await audio.touchtones(context, node(), pair, 0.3, {nodes: new Set(), released: false});
    assert.equal(sampleLoads.length, 0, 'pulse requires no sample downloads');
    assert.equal(sources.length, 0, 'no organ or other sampled voice is created');
    const fundamental = frequencies.filter((_, i) => i % 4 < 2).map(n => n.frequency.value);
    assert.equal(seasonal.touchtones.octaveShift, -4, 'use the selected low bass register');
    assert(fundamental.every(f => pair.some(input => f === input / 16)), 'transpose both frequencies down four octaves');
    const release = {nodes: new Set(), released: false};
    await audio.touchtones(context, node(), pair, 0.3, release);
    const playing = [...release.nodes]; release.releaseAudioNodes();
    assert(playing.every(n => n.disconnected), 'released tone nodes are disconnected after the fade');
    assert(playing.filter(n => n.buffer || n.detune).every(n => n.stopped), 'all sound sources are stopped');
    const count = sources.length;
    await audio.touchtones(context, node(), pair, 0.3, {nodes: new Set(), released: true});
    assert.equal(sources.length, count, 'released taps do not create delayed ghost tones');
    console.log('PASS seasonal dates, unchanged announcements, bass octave transposition, sample-free rapid taps, canceled taps and smooth-release cleanup');
})().catch(error => {console.error(error); process.exitCode = 1;});
