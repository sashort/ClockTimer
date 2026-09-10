const parse = text => {
    const match = text.match(/^\+\/-(\d+(?:\.\d+)?)$/);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
};

const rolling = (currentSecond, value) => {
    const radius = Math.floor(value);
    const seconds = [];
    for (let offset = -radius; offset <= radius; offset++) {
        seconds.push((currentSecond + offset + 60) % 60);
    }
    return seconds;
};

const assertEqual = (actual, expected, label) => {
    if (actual.join(',') !== expected.join(',')) {
        throw new Error(`${label}: ${actual} !== ${expected}`);
    }
};

if (parse('+/-2.5') !== 2.5) throw new Error('failed to parse +/-2.5');
if (parse('+/-5') !== 5) throw new Error('failed to preserve +/-5');
if (parse('+/-0') !== undefined) throw new Error('accepted zero');
if (parse('+/-x') !== undefined) throw new Error('accepted invalid decimal');

assertEqual(rolling(10, 2.5), [8,9,10,11,12], '+/-2.5 at 10');
assertEqual(rolling(0, 2.5), [58,59,0,1,2], '+/-2.5 wrap');

console.log('decimal rolling offset tests passed');
