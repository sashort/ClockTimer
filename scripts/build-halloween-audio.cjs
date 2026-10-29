// Reuse the existing Cinematic Pulse Bass definition; no organ samples.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const score = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/instruments/neon-countdown-score.json'), 'utf8'));
const pulse = JSON.parse(fs.readFileSync(path.join(root, 'api/audio/catalog.json'), 'utf8')).instruments['cinematic-pulse-bass'];
fs.writeFileSync(path.join(root, 'api/audio/halloween.json'), JSON.stringify({
  instruments: {'halloween-pulse': pulse, 'halloween-strings': score.instruments['finale-horror-strings'],
    'halloween-idle-pulse': score.instruments['midnight-pulse']}, songs: {},
  touchtones: {octaveShift: -4, pulseGain: 0.4, attackSeconds: 0.008, releaseSeconds: 0.012,
    strings: {gain: 1.7, ringSeconds: 0.25, decaySeconds: 0.5, voicing: 'bass-harmonics'},
    idleBell: {pulse: true, timeoutSeconds: 1, holdSeconds: 1.2, volume: 0.35}}
}, null, 2) + '\n');
console.log('Built Cinematic Pulse Bass-only touchtones; announcement cues remain unchanged.');
