import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({url: 'https://clock.example/'});
try {
    const css = window.CSS;
    css.registerProperty = () => {};
    Object.defineProperty(window, 'CSS', {value: css});
    for (const name of ['TemporalFormat', 'RingContainer', 'TimeRangeModel', 'TimeRangeElement']) {
        window.eval(fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));
    }
    const { TimeRange, TimeRangeElement } = window;
    const time = minute => new window.Date(Date.UTC(2026, 9, 6, 12, minute));
    assert.equal(window.customElements.get('time-range'), TimeRangeElement);
    const ring = window.document.createElement('ring-container');
    window.document.body.append(ring);

    // The element is a view of all pieces with one logical ID, not interval logic.
    const logical = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), splitPoints: [time(10), time(20)]});
    const element = TimeRangeElement.create(logical.ranges[1]);
    ring.appendChild(element);
    assert.equal(element.rangeId, logical.ranges[0].rangeId);
    assert.throws(() => { element.rangeId = 'edited'; }, TypeError);
    assert.equal(element.ranges.length, 3);
    assert.equal(element.startTime.getTime(), time(0).getTime());
    assert.equal(element.endTime.getTime(), time(30).getTime());
    assert.equal(element.rangeLength, 30 * 60000);
    assert.equal(element.getAttribute('range-id'), element.rangeId);
    assert.equal(element.getAttribute('start-time'), time(0).toISOString());
    assert.equal(element.shadowRoot, null, 'RingContainer owns rendering');
    element.startTime.setTime(0);
    assert.equal(element.startTime.getTime(), time(0).getTime(), 'Date getters are defensive');
    const layout = ring.calculateRangeLayout(element, {originMilliseconds: time(0).getTime()});
    assert.equal(layout.duration, 30 * 60000);
    assert.equal(typeof layout.clipPath, 'string');
    ring.applyRangeLayout(element, layout);
    assert.equal(element.style.clipPath, layout.clipPath.trim());

    // Validation can alter presentation while emitting no boundary events.
    logical.group.beginUpdate();
    logical.group.setSplitPoints([]);
    TimeRange._setTypeAndEnd(logical.ranges[2], 'Expandable', time(40).getTime());
    logical.group.endUpdate();
    const notifications = [];
    element.addEventListener('time-range-changed', event => notifications.push(event.detail));
    element.refresh();
    assert.equal(element.endTime.getTime(), time(30).getTime(), 'Unvalidated edits remain hidden');
    assert.equal(notifications.length, 0);
    logical.group.tick(time(0), time(0));
    assert.equal(element.ranges.length, 1);
    assert.equal(element.endTime.getTime(), time(40).getTime(), 'Committed normalization refreshes without a boundary event');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].before.endTime.getTime(), time(30).getTime());
    assert.equal(notifications[0].after.endTime.getTime(), time(40).getTime());

    // Collapse of the original bound piece must not remove its sibling view.
    const split = TimeRange.create({type: 'Fixed', start: time(0), end: time(20), splitPoints: [time(10)]});
    element.bind(split.ranges[0]);
    split.group.tick(time(10), time(0));
    assert.equal(split.group.size, 1);
    assert.equal(element.hidden, false);
    assert.equal(element.startTime.getTime(), time(10).getTime());
    assert.equal(element.rangeId, split.ranges[1].rangeId);
    assert.equal(element.transitionTo({startTime: time(12), endTime: time(25)}), true);
    assert.equal(element.startTime.getTime(), time(12).getTime(), 'Editing uses the surviving model piece');
    assert.equal(element.rangeId, split.ranges[1].rangeId, 'Editing preserves logical identity');
    assert.equal(logical.group.remove(logical.ranges[0].rangeId), true);
    assert.equal(element.hidden, false, 'Rebinding releases the old group');
    split.group.remove(element.rangeId);
    assert.equal(element.hidden, true);
    assert.equal(element.startTime, null);
    assert.equal(element.style.clipPath, '');

    // Detachment stops notifications; reconnection catches up once.
    const growing = TimeRange.create({type: 'Expandable', start: time(0), end: time(10)});
    element.bind(growing.ranges[0]);
    element.remove();
    growing.group.tick(time(5), time(0));
    assert.equal(element.endTime.getTime(), time(10).getTime());
    ring.appendChild(element);
    assert.equal(element.endTime.getTime(), time(15).getTime());
    growing.group.dispose();
    assert.equal(element.hidden, true, 'Disposal clears the view');
    assert.throws(() => element.bind({}), /TimeRange/);

    // No renderer (or renderer global) is required for the element to function.
    const standalone = new Window({url: 'https://clock.example/'});
    try {
        for (const name of ['TimeRangeModel', 'TimeRangeElement']) {
            standalone.eval(fs.readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8'));
        }
        const simple = standalone.TimeRange.create({type: 'Expandable', start: time(0), end: time(10)});
        const view = standalone.TimeRangeElement.create(simple.ranges[0]);
        standalone.document.body.append(view);
        const changes = [];
        standalone.document.body.addEventListener('time-range-changed', event => changes.push(event.detail));
        simple.group.tick(time(5), time(0));
        assert.equal(view.endTime.getTime(), time(15).getTime());
        assert.equal(changes.length, 1, 'Generic change notifications bubble to any consumer');
        assert.equal(standalone.RingContainer, undefined);
        assert.equal(view.style.clipPath, '', 'The element performs no geometry work');
        view.clockTimerApprovalReadOnly = true;
        assert.throws(() => view.setAttribute('approved', ''), /ClockTimer/);
        view.clockTimerDerivedReadOnly = true;
        assert.throws(() => view.transitionTo({startTime: time(0), endTime: time(20)}), /cannot be modified/);
        view.clockTimerInternalMutation = true;
        view.setAttribute('approved', '');
        delete view.clockTimerInternalMutation;
        delete view.clockTimerDerivedReadOnly;
        simple.group.beginUpdate();
        standalone.TimeRange.create({group: simple.group, type: 'Fixed', start: time(1), end: time(3)});
        simple.group.endUpdate();
        assert.throws(() => simple.group.tick(time(20)), /overlap/);
        assert.equal(view.endTime.getTime(), time(15).getTime(), 'Failed validation preserves the committed view');
        assert.equal(changes.length, 1);
    } finally {
        await standalone.happyDOM.close();
    }
    assert.throws(() => window.eval(fs.readFileSync(new URL('../TimeRangeElement.js', import.meta.url), 'utf8')),
        /already|declared|defined|registered|instead/i, 'A registered element cannot be silently replaced');
    console.log('PASS model-backed TimeRangeElement identity, committed updates, split/removal, lifecycle, and RingContainer layout');
} finally {
    await window.happyDOM.close();
}
