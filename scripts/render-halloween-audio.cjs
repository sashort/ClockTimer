// Render the actual Cinematic Pulse Bass touchtones and their release path.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, '../outputs/cinematic-pulse-touchtones'));
fs.mkdirSync(output, {recursive: true});
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const base = JSON.parse(read('api/audio/catalog.json'));
const seasonal = JSON.parse(process.env.HALLOWEEN_AUDIO_CATALOG
    ? fs.readFileSync(process.env.HALLOWEEN_AUDIO_CATALOG, 'utf8') : read('api/audio/halloween.json'));
const sampleFiles = Object.fromEntries(Object.values(seasonal.instruments).flatMap(i => i.samples || []).map(s =>
    [s.url, fs.readFileSync(path.join(root, s.url)).toString('base64')]));
const horizon = /const scheduleAheadSeconds =\s*this\.#isPhone\(\)\s*\? 1\.8\s*: 2\.6;/;
assert(horizon.test(read('api/audio/AudioEngine.js')));
const engine = read('api/audio/AudioEngine.js').replace(horizon, 'const scheduleAheadSeconds = 20;');
const cues = ['keypad', 'twelve-key-sequence'];
function wav(samples, rate = 48000) {
    const b = Buffer.alloc(44 + samples.length * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((s, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
    return b;
}
(async () => {
    const browser = await chromium.launch({channel: 'msedge', headless: true});
    const report = [], suites = {};
    try {
        for (const speed of [1, 0.625]) {
            const suite = [];
            for (const name of cues) {
                const page = await browser.newPage();
                const warnings = [];
                page.on('console', message => {
                    if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text());
                });
                try {
                    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html></html>'}));
                    await page.goto('http://halloween.test/?halloweenPreview=1');
                    await page.evaluate(({base, seasonal, sampleFiles, seconds}) => {
                        globalThis.fetch = async url => sampleFiles[url]
                            ? {ok: true, arrayBuffer: async () => Uint8Array.from(atob(sampleFiles[url]), c => c.charCodeAt(0)).buffer}
                            : {ok: true, json: async () => String(url).includes('halloween.json') ? seasonal : base};
                        globalThis.setTimeout = () => 1; globalThis.clearTimeout = () => {};
                        globalThis.AudioContext = class extends OfflineAudioContext {
                            constructor() {super(1, 48000 * seconds, 48000); globalThis.renderContext = this;}
                            resume() {return Promise.resolve();}
                        };
                    }, {base, seasonal, sampleFiles, seconds: seasonal.touchtones.idleBell ? 25 : name === 'keypad' ? 2 : 8});
                    await page.addScriptTag({content: read('api/audio/HalloweenAudio.js')});
                    await page.addScriptTag({content: engine});
                    const encoded = await page.evaluate(async ({name, speed}) => {
                        let keypad;
                        if (name === 'twelve-key-sequence') {
                            const pairs = [[697,1209], [697,1336], [697,1477], [770,1209],
                                [770,1336], [770,1477], [852,1209], [852,1336], [852,1477], [941,1209], [941,1336], [941,1477]];
                            keypad = await WMOFAudio.startFrequencies(pairs[0], {reason: 'number-pad', volume: 0.3});
                            const hold = 0.25 / speed, period = hold + 0.15;
                            for (let i = 1; i <= pairs.length; i++) {
                                renderContext.suspend((i - 1) * period + hold).then(async () => {
                                    keypad.stop();
                                    await WMOFHalloweenAudio.whenIdleScheduled();
                                    await OfflineAudioContext.prototype.resume.call(renderContext);
                                });
                                if (i < pairs.length) renderContext.suspend(i * period).then(async () => {
                                    keypad = await WMOFAudio.startFrequencies(pairs[i], {reason: 'number-pad', volume: 0.3});
                                    await OfflineAudioContext.prototype.resume.call(renderContext);
                                });
                            }
                        } else if (name === 'keypad') {
                            keypad = await WMOFAudio.startFrequencies([697, 1209], {reason: 'number-pad', volume: 0.3});
                            renderContext.suspend(0.25 / speed).then(async () => {
                                keypad.stop(); await WMOFHalloweenAudio.whenIdleScheduled(); await OfflineAudioContext.prototype.resume.call(renderContext);
                            });
                        } else await WMOFAudio.startSong(name, {toneVolume: 0.3, toneVelocity: speed,
                            includeSpeech: false, useSelectedInstrument: true});
                        const buffer = await renderContext.startRendering();
                        const raw = new Uint8Array(buffer.getChannelData(0).buffer);
                        let bytes = ''; for (let i = 0; i < raw.length; i += 8192)
                            bytes += String.fromCharCode(...raw.subarray(i, i + 8192));
                        return btoa(bytes);
                    }, {name, speed});
                    const bytes = Buffer.from(encoded, 'base64');
                    assert(!warnings.some(w => /Halloween .*unavailable|Idle bell unavailable|Unknown instrument/.test(w)),
                        'Preview must use the intended instrument, without falling back: ' + warnings.join('; '));
                    let samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
                    assert(samples.every(Number.isFinite), 'finite ' + name);
                    const peak = samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
                    assert(peak > 0.001 && peak < 0.98, 'audible and unclipped: ' + name + ' peak ' + peak);
                    let end = samples.length - 1;
                    while (end > 0 && Math.abs(samples[end]) < 0.00002) end--;
                    end = Math.min(samples.length, end + 4800);
                    samples = samples.slice(0, end);
                    const file = `${name}-${speed === 1 ? '250ms' : '400ms'}.wav`;
                    fs.writeFileSync(path.join(output, file), wav(samples));
                    report.push({name, speed, peak, seconds: samples.length / 48000, file});
                    suite.push(samples, new Float32Array(48000 * 0.45));
                    console.log(`${file}: ${(samples.length / 48000).toFixed(3)}s, peak ${peak.toFixed(3)}`);
                } finally {await page.close();}
            }
            const combined = new Float32Array(suite.reduce((n, s) => n + s.length, 0));
            let at = 0; for (const s of suite) {combined.set(s, at); at += s.length;}
            const file = `suite-bass-${speed === 1 ? '250ms' : '400ms'}.wav`;
            fs.writeFileSync(path.join(output, file), wav(combined)); suites[speed] = file;
        }
        fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
        fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cinematic Pulse Bass touchtones</title>
            <style>body{font:17px system-ui;background:#16120e;color:#ffe4ac;max-width:850px;margin:30px auto;padding:20px}h1{color:#ffab24}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #66503b;text-align:left}audio{max-width:300px;width:100%}</style>
            <h1>Cinematic Pulse Bass touchtones</h1><p>${seasonal.touchtones.bell ? 'Cinematic Pulse Bass with a softly ringing bell accent' : 'Cinematic Pulse Bass only'}, transposed down ${Math.abs(seasonal.touchtones.octaveShift)} octaves into the existing cues' bass register. Each key sounds for 250 ms or 400 ms, followed by a 150 ms gap in the twelve-key sequence.</p>
            <p>250 ms per press <audio controls src="${suites[1]}"></audio></p><p>400 ms per press <audio controls src="${suites[0.625]}"></audio></p>
            <table><tr><th>Example</th><th>250 ms per press</th><th>400 ms per press</th></tr>${cues.map(name => `<tr><td>${name.replaceAll('-', ' ')}</td>${['250ms','400ms'].map(s => `<td><audio controls preload="none" src="${name}-${s}.wav"></audio></td>`).join('')}</tr>`).join('')}</table>
            <script>document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause()},true)</script>`);
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
