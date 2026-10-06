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
for (const name of ['TemporalFormat', 'RingContainer', 'TimeRange', 'TimeRangeGroup', 'ClockTimer']) {
    window.eval(fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));
}
const Range = window.customElements.get('time-range');
const Group = window.TimeRangeGroup;
const totals = group => [group.totalCountedTime, group.elapsedCountedTime, group.remainingCountedTime];
const timers = [];
try {
    const first = Range.createCountedRange(0, 100, 40);
    const second = Range.createCountedRange(100, 200, 120);
    assert.deepEqual({...first.counted}, {total: 100, elapsed: 40, remaining: 60});
    assert.equal(first.startTime.getTime(), 0);
    assert.equal(first.endTime.getTime(), 100);
    assert.equal(first.isConnected, false);
    assert.equal(first.shadowRoot, null);
    assert.equal('intervalRecord' in first, false);
    assert.throws(() => Range.createCountedRange(100, 0), /Invalid counted interval/);
    const group = new Group([first, second]);
    assert.deepEqual(totals(group), [200, 60, 140]);
    group.add(first);
    assert.equal(group.timeRanges.length, 2, 'membership is unique');
    first.updateCountedTime(100);
    group.recalculateCountedTime();
    assert.deepEqual(totals(group), [200, 120, 80]);
    group.remove(first);
    assert.deepEqual(totals(group), [100, 20, 80]);
    group.clear();
    assert.deepEqual(totals(group), [0, 0, 0]);

    const events = [];
    const listener = event => events.push(event);
    group.addEventListener('boundary-reached', listener);
    assert.equal(group.checkBoundary(first, 99, second), false);
    assert.equal(events.length, 0);
    assert.equal(group.checkBoundary(first, 100, second), true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'boundary-reached');
    assert.equal(events[0].before, first);
    assert.equal(events[0].after, second);
    group.checkBoundary(first, 250, second);
    assert.equal(events.length, 1, 'repeated/delayed checks emit once');
    group.checkBoundary(second, 250);
    assert.equal(events.length, 2);
    assert.equal('after' in events[1], false);
    group.clear();
    group.checkBoundary(undefined, 0, first);
    assert.equal('before' in events[2], false);
    group.checkBoundary(first, 100);
    assert.equal(events.length, 4, 'entering a range does not suppress its end boundary');
    group.removeEventListener('boundary-reached', listener);
    group.checkBoundary(second, 250);
    assert.equal(events.length, 4);

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
    const realCheck = Group.prototype.checkBoundary;
    const boundaries = [];
    let observedGroup;
    Group.prototype.checkBoundary = function(...args) {
        observedGroup = this;
        this.addEventListener('boundary-reached', capture);
        return realCheck.apply(this, args);
    };
    const capture = event => boundaries.push(event);
    for (const behavior of ['startLatency', 'extendBoundary', 'extendInterval', 'rollover']) {
        window.__testTime = epoch;
        const timer = window.document.createElement('clock-timer');
        timers.push(timer);
        window.document.body.append(timer);
        timer.configure({goal_type: 'trip', trip_goal: '100%'});
        await timer.start({standardTime: '0:30:00'});
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
        observedGroup.checkBoundary(event.before, event.now + 1000);
        assert.equal(boundaries.length, before + 1, `${behavior}: subsequent checks do not notify again`);
        assert.equal(elapsed.length, 1);
        timer.remove();
    }
    Group.prototype.checkBoundary = realCheck;
    console.log('PASS TimeRange count ownership, group totals/cache/reset, boundary payload/deduplication, and timer boundary policies');
} finally {
    for (const timer of timers) timer.remove();
    await window.happyDOM.close();
}
