import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({url: 'https://clock.example/'});
const epoch = Date.parse('2026-09-19T12:00:00Z');
window.__testTime = epoch;
window.eval(`const RangeDate = Date; window.Date = class extends RangeDate {
    constructor(...args) { super(...(args.length ? args : [window.__testTime])); }
    static now() { return window.__testTime; }
};`);
const css = window.CSS;
css.registerProperty = () => {};
Object.defineProperty(window, 'CSS', {value: css});
Object.defineProperty(window, 'AbortController', {value: globalThis.AbortController});
Object.defineProperty(window, 'AbortSignal', {value: globalThis.AbortSignal});
window.Element.prototype.animate = () => ({finished: Promise.resolve(), cancel(){},
    finish(){}, play(){}, pause(){}, effect: {getComputedTiming(){return {progress: 1};}}});
for (const name of ['TemporalFormat', 'RingContainer', 'TimeRangeModel', 'TimeRangeElement', 'ClockTimer']) {
    window.eval(fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));
}
const Range = window.TimeRange;
const Group = window.TimeRangeGroup;
const totals = group => [group.totalCountedTime, group.elapsedCountedTime, group.remainingCountedTime];
const timers = [];
try {
    const first = Range.createCountedRange(0, 100, 40);
    assert.deepEqual({...first.counted}, {total: 100, elapsed: 40, remaining: 60});
    assert.equal(first.start.getTime(), 0);
    assert.equal(first.end.getTime(), 100);
    assert.equal(first instanceof window.HTMLElement, false, 'Accounting uses pure model objects');
    assert.throws(() => Range.createCountedRange(100, 0), /Invalid counted interval/);
    const group = first.group;
    const second = Range.create({group, type: 'Fixed', start: 100, end: 200}).ranges[0];
    second.setCountedTime(100, 20);
    assert.deepEqual(totals(group), [200, 60, 140]);
    first.updateCountedTime(100);
    assert.deepEqual(totals(group), [200, 120, 80]);
    const events = [];
    group.addEventListener('boundary-reached', event => events.push(...event.detail.boundaries));
    group.tick(0, 0);
    group.tick(99);
    assert.equal(events.length, 0);
    group.tick(100);
    assert.equal(events.length, 1);
    assert.equal(events[0].before, first);
    assert.equal(events[0].after, second);
    group.tick(250);
    assert.equal(events.length, 2);
    assert.equal('after' in events[1], false);
    group.tick(250);
    assert.equal(events.length, 2, 'Repeated ticks do not repeat crossings');
    group.remove(first.rangeId);
    assert.deepEqual(totals(group), [100, 20, 80]);
    group.clear();
    assert.deepEqual(totals(group), [0, 0, 0]);

    const countedSplit = Range.createCountedRange(0, 100, 40);
    countedSplit.group.beginUpdate();
    countedSplit.group.setSplitPoints([50]);
    countedSplit.group.endUpdate();
    countedSplit.group.tick(0, 0);
    assert.deepEqual({...countedSplit.group.head.counted}, {total: 50, elapsed: 40, remaining: 10});
    assert.deepEqual({...countedSplit.group.tail.counted}, {total: 50, elapsed: 0, remaining: 50});
    assert.deepEqual(totals(countedSplit.group), [100, 40, 60], 'Logical splitting preserves totals');
    countedSplit.group.beginUpdate();
    countedSplit.group.setSplitPoints([]);
    countedSplit.group.endUpdate();
    countedSplit.group.tick(0);
    assert.deepEqual(totals(countedSplit.group), [100, 40, 60], 'Merging preserves counted state');

    group.updateAccounting(0, 100, [[20, 40], [80, Infinity]], 200);
    assert.deepEqual(totals(group), [200, 60, 140]);
    const members = [...group.timeRanges];
    group.updateAccounting(0, 100, [[20, 40], [80, Infinity]], 200);
    assert.equal(group.timeRanges[0], members[0], 'unchanged reads reuse counted ranges');
    group.updateAccounting(0, 120, [[20, 40]], 200);
    assert.deepEqual(totals(group), [200, 100, 100]);
    group.updateAccounting(0, 120, [], 50);
    assert.deepEqual(totals(group), [120, 120, 0], 'overtime keeps the full counted value');
    group.updateAccounting(0, 10, [], 50);
    assert.deepEqual(totals(group), [50, 10, 40], 'backward time rebuilds accounting');
    group.updateAccounting(5, 10, [], 50);
    assert.deepEqual(totals(group), [50, 5, 45], 'start edits rebuild accounting');
    group.clear();
    group.updateAccounting(5, 10, [], 50);
    assert.deepEqual(totals(group), [50, 5, 45], 'clear invalidates the accounting cache');
    group.updateAccounting(0, 10, [], 200 / 3);
    assert(Math.abs(group.totalCountedTime - 200 / 3) < 1e-9,
        'fractional percentage budgets retain counted precision');

    // Observe the real group used by ClockTimer and compare its transition
    // with the existing public lifecycle event, including its policy override.
    const realTick = Group.prototype.tick;
    const boundaries = [];
    let observedGroup;
    Group.prototype.tick = function(...args) {
        observedGroup = this;
        this.addEventListener('boundary-reached', capture);
        return realTick.apply(this, args);
    };
    const capture = event => boundaries.push(...event.detail.boundaries);
    for (const behavior of ['startLatency', 'extendBoundary', 'extendInterval', 'rollover']) {
        window.__testTime = epoch;
        const timer = window.document.createElement('clock-timer');
        timers.push(timer);
        window.document.body.append(timer);
        timer.configure({goal_type: 'trip', trip_goal: '100%'});
        await timer.start({standardTime: '0:30:00'});
        assert([...timer.querySelectorAll('time-range')].every(element =>
            element instanceof window.TimeRangeElement && element.model instanceof Range),
            'ClockTimer renders model-backed elements');
        assert.equal(typeof observedGroup?.checkBoundary, 'undefined', 'There is no explicit boundary-check API');
        timer.intervalElapsedBehavior = behavior;
        const elapsed = [];
        timer.addEventListener('intervalElapsed', event => elapsed.push(event.detail));
        await timer.startInterval('break', 60000, {breakType: 'short'});
        const before = boundaries.length;
        window.__testTime += 90000;
        await timer.endInterval();
        assert.equal(boundaries.length, before + 1, `${behavior}: group detects the delayed boundary`);
        assert.equal(elapsed.length, 1, `${behavior}: one lifecycle notification`);
        assert.equal(elapsed[0].defaultBehavior, behavior);
        assert.equal(boundaries.at(-1).before instanceof Range, true);
        assert.equal('intervalRecord' in boundaries.at(-1).before, false);
        const event = boundaries.at(-1);
        observedGroup.tick(observedGroup.lastTickTime.getTime() + 1000);
        assert.equal(boundaries.length, before + 1, `${behavior}: subsequent checks do not notify again`);
        assert.equal(elapsed.length, 1);
        timer.remove();
    }
    Group.prototype.tick = realTick;
    console.log('PASS TimeRange count ownership, group totals/cache/reset, boundary payload/deduplication, and timer boundary policies');
} finally {
    for (const timer of timers) timer.remove();
    await window.happyDOM.close();
}
