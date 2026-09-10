const fixed = [];
for (let second = 0; second < 60; second += 5) {
    fixed.push(second * 6);
}

if (fixed.length !== 12) {
    throw new Error(`expected 12 fixed ticks, got ${fixed.length}`);
}

const expectedFixed = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
if (fixed.join(',') !== expectedFixed.join(',')) {
    throw new Error(`bad fixed angles: ${fixed}`);
}

const rolling = second =>
    Array.from(
        { length: 11 },
        (_, index) => (second + index - 5 + 60) % 60
    );

const at58 = rolling(58);
const expected58 = [53, 54, 55, 56, 57, 58, 59, 0, 1, 2, 3];
if (at58.join(',') !== expected58.join(',')) {
    throw new Error(`bad rolling wrap: ${at58}`);
}

if (at58[5] !== 58) {
    throw new Error('current second is not centered');
}

const nextDelay = milliseconds =>
    milliseconds === 0 ? 1000 : 1000 - milliseconds;

const delays = [0, 1, 250, 999].map(nextDelay);
if (delays.join(',') !== '1000,999,750,1') {
    throw new Error(`bad second-boundary delays: ${delays}`);
}

console.log('second tick math tests passed');
