const fixed = step => {
    const seconds = [];
    for (let second = 0; second < 60; second += step) seconds.push(second);
    return seconds;
};

const rollingGroups = (currentSecond, value, includeBoundaries) => {
    const groupCount = Math.max(1, Math.ceil(value / 5));
    const currentGroup = Math.floor(currentSecond / 5);
    const startGroup = currentGroup - Math.floor((groupCount - 1) / 2);
    const startSecond = startGroup * 5;
    const endSecond = startSecond + groupCount * 5;
    const firstSecond = includeBoundaries ? startSecond : startSecond + 1;
    const lastSecond = includeBoundaries ? endSecond : endSecond - 1;
    const seconds = [];
    for (let second = firstSecond; second <= lastSecond; second++) {
        seconds.push((second % 60 + 60) % 60);
    }
    return seconds;
};

const assertEqual = (actual, expected, label) => {
    if (actual.join(',') !== expected.join(',')) {
        throw new Error(`${label}: ${actual} !== ${expected}`);
    }
};

assertEqual(fixed(1), Array.from({length:60}, (_, i) => i), 'tick-marks empty/1');
assertEqual(fixed(20), [0,20,40], 'tick-marks 20');
assertEqual(rollingGroups(23, 5, true), [20,21,22,23,24,25], '[5] at 23');
assertEqual(rollingGroups(23, 5, false), [21,22,23,24], '(5) at 23');
assertEqual(rollingGroups(23, 15, true), [15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], '[15] at 23');
assertEqual(rollingGroups(1, 15, true), [55,56,57,58,59,0,1,2,3,4,5,6,7,8,9,10], '[15] wrap at 1');

for (const second of [0,5,10,15,20,25,30,35,40,45,50,55]) {
    if (second % 5 !== 0) throw new Error('major tick test failed');
}

console.log('tick mark mode tests passed');
