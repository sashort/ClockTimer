import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({ url: 'https://clock.example/' });
try {
    window.eval(fs.readFileSync(new URL('../TimeRangeModel.js', import.meta.url), 'utf8'));
    const { TimeRange, TimeRangeTick } = window;
    const time = minute => new window.Date(Date.UTC(2026, 9, 6, 12, minute));
    assert.equal('END' in TimeRange.Events, false);

    const logical = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), boundaries: [time(10), time(20)]});
    assert.equal(new Set(logical.ranges.map(range => range.entityId)).size, 1, 'Factory split pieces share one entity');
    assert.equal(new Set(logical.ranges.map(range => range.rangeId)).size, 1, 'Split pieces share their public range ID');
    assert.equal(new Set(logical.ranges.map(range => range.pieceId)).size, 3, 'Each piece has its own identity');
    assert.throws(() => { logical.ranges[0].rangeId = 'replacement'; }, TypeError, 'rangeId is read-only');
    const originalEntity = logical.ranges[2].entityId;
    const pieces = logical.group.split(logical.ranges[2], time(25));
    assert.equal(pieces[0].entityId, originalEntity);
    assert.equal(pieces[1].entityId, originalEntity, 'Further splits preserve the original entity');
    assert.equal(pieces[0].rangeId, pieces[1].rangeId);
    assert.notEqual(pieces[0].pieceId, pieces[1].pieceId);
    const separateEntity = TimeRange.create({type: 'Fixed', start: time(0), end: time(30)});
    assert.notEqual(separateEntity.ranges[0].entityId, originalEntity, 'Separately created ranges are separate entities');

    const collectRanges = group => {
        const ranges = [];
        for (let range = group.head; range; range = range.next) ranges.push(range);
        return ranges;
    };
    const shape = group => collectRanges(group).map(range => [range.type,
        (range.start.getTime() - time(0).getTime()) / 60000,
        (range.end.getTime() - time(0).getTime()) / 60000]);
    const removable = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), splitPoints: [time(10), time(20)]});
    const retained = TimeRange.create({group: removable.group, type: 'Fixed', start: time(40), end: time(50)}).ranges[0];
    const removedPieces = [];
    removable.group.addEventListener('remove', event => removedPieces.push(event.detail.range));
    assert.throws(() => removable.group.remove(removable.ranges[1]), /rangeId/, 'Public removal rejects individual objects');
    assert.equal(removable.group.size, 4);
    assert.equal(removable.group.remove(removable.ranges[1].rangeId), true);
    assert.deepEqual(removedPieces, Array.from(removable.ranges), 'Removing by ID removes every sibling piece');
    assert.deepEqual(collectRanges(removable.group), [retained], 'Other logical ranges remain');
    assert.equal(removable.group.size, 1);
    assert(removable.ranges.every(range => range.previous === null && range.next === null));
    assert.equal(removable.group.remove(removable.ranges[1].rangeId), false, 'An absent ID does nothing');

    const gapEdit = TimeRange.create({type: 'Fixed', start: time(0), end: time(10), splitPoints: [time(30)]});
    const gapRange = TimeRange.create({group: gapEdit.group, type: 'Fixed', start: time(20), end: time(40)}).ranges[0];
    gapEdit.group.tick(time(25), time(0));
    const gapResets = [];
    gapEdit.group.addEventListener('boundary-reset', event => gapResets.push(...event.detail.boundaries));
    gapEdit.group.beginUpdate();
    gapEdit.group.setRangeInterval(gapRange.rangeId, time(35), time(60));
    gapEdit.group.endUpdate();
    gapEdit.group.tick(time(27));
    assert.equal(gapResets.length, 1, 'Replacing split pieces preserves reached entrance history');
    assert.equal(gapResets[0].after.rangeId, gapRange.rangeId);
    assert.equal(gapResets[0].time.getTime(), time(35).getTime());

    const movedPoints = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), splitPoints: [time(10), time(20)]});
    const entityId = movedPoints.ranges[0].entityId;
    const survivingPieceId = movedPoints.ranges[0].pieceId;
    const editEvents = [];
    for (const type of Object.values(TimeRange.Events)) movedPoints.group.addEventListener(type, event => editEvents.push(event));
    movedPoints.group.beginUpdate();
    movedPoints.group.setSplitPoints([time(15), time(25)]);
    movedPoints.group.endUpdate();
    assert.equal(editEvents.length, 0, 'Changing split points is silent until the next tick');
    movedPoints.group.tick(time(0), time(0));
    assert.deepEqual(shape(movedPoints.group), [['Collapsable', 0, 15], ['Collapsable', 15, 25], ['Expandable', 25, 30]],
        'Changed split points remove obsolete cuts and create the new cuts');
    assert(collectRanges(movedPoints.group).every(range => range.entityId === entityId));
    assert.equal(movedPoints.group.head.pieceId, survivingPieceId);
    assert.equal(editEvents.length, 0, 'Future normalization produces neither boundary event');
    movedPoints.group.beginUpdate();
    movedPoints.group.setSplitPoints([]);
    movedPoints.group.endUpdate();
    movedPoints.group.tick(time(0));
    assert.deepEqual(shape(movedPoints.group), [['Fixed', 0, 30]], 'Removing split points reunites the original entity');
    assert.equal(movedPoints.group.head.entityId, entityId);
    assert.equal(movedPoints.group.head.entityType, 'Fixed');

    const partial = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), boundaries: [time(10)]});
    partial.group.beginUpdate();
    TimeRange._setTypeAndEnd(partial.ranges[0], 'Collapsable', time(20).getTime());
    partial.group.notifyRangeChanged(partial.ranges[0]);
    partial.group.endUpdate();
    partial.group.tick(time(0), time(0));
    assert.deepEqual(shape(partial.group), [['Collapsable', 0, 10], ['Expandable', 10, 30]],
        'Only the matching-type portion beyond the split point merges with its sibling');
    assert(collectRanges(partial.group).every(range => range.entityId === partial.ranges[0].entityId));

    const unrelated = TimeRange.create({type: 'Fixed', start: time(0), end: time(10)});
    unrelated.group.beginUpdate();
    TimeRange.create({group: unrelated.group, type: 'Fixed', start: time(10), end: time(20)});
    unrelated.group.endUpdate();
    unrelated.group.tick(time(0), time(0));
    assert.equal(unrelated.group.size, 2, 'Touching entities retain their separate identities');
    unrelated.group.beginUpdate();
    TimeRange.create({group: unrelated.group, type: 'Fixed', start: time(5), end: time(15)});
    unrelated.group.endUpdate();
    assert.throws(() => unrelated.group.tick(time(0)), /overlap/, 'Matching types from different entities cannot merge');

    const fixed = TimeRange.create({ type: 'Fixed', start: time(0), end: time(10) });
    const events = [];
    fixed.group.addEventListener('end', event => events.push(event));
    fixed.group.tick(time(10), time(0));
    const overrun = new TimeRangeTick(time(15), time(10));
    fixed.group.tick(overrun);
    assert.equal(events.length, 0, 'Neither reaching nor passing the final boundary emits end');
    assert.equal(fixed.group.tail, fixed.ranges[0]);
    assert.equal(fixed.group.endTime.getTime(), time(10).getTime());

    const expanding = TimeRange.create({ type: 'Expandable', start: time(0), end: time(10) });
    const changes = [];
    expanding.group.addEventListener('end', event => events.push(event));
    expanding.group.addEventListener('change', event => changes.push(event.detail));
    expanding.group.tick(time(15), time(10));
    assert.equal(changes.length, 1, 'Existing change notifications remain available');
    assert.equal(changes[0].range, expanding.ranges[0]);
    assert.equal(expanding.group.endTime.getTime(), time(15).getTime());
    assert.equal(events.length, 0);

    const sameEntity = TimeRange.create({type: 'Fixed', start: time(0), end: time(20), splitPoints: [time(10)]});
    const sameEntityEvents = [];
    for (const type of ['split-point-reached', 'boundary-reached']) {
        sameEntity.group.addEventListener(type, event => sameEntityEvents.push({type, ...event.detail}));
    }
    sameEntity.group.tick(time(10), time(0));
    assert.deepEqual(sameEntityEvents.map(event => event.type), ['split-point-reached'],
        'A logical split emits only the split-point event');
    assert.equal(sameEntityEvents[0].splitPoints[0].before.entityId, sameEntityEvents[0].splitPoints[0].after.entityId);
    sameEntity.group.tick(time(10));
    assert.equal(sameEntityEvents.length, 1, 'A reached split point is emitted only once');

    const differentEntities = TimeRange.create({type: 'Fixed', start: time(0), end: time(10), splitPoints: [time(10)]});
    TimeRange.create({group: differentEntities.group, type: 'Fixed', start: time(10), end: time(20)});
    const bothKinds = [];
    for (const type of ['split-point-reached', 'boundary-reached']) {
        differentEntities.group.addEventListener(type, event => bothKinds.push({type, ...event.detail}));
    }
    differentEntities.group.tick(time(10), time(0));
    assert.deepEqual(bothKinds.map(event => event.type), ['split-point-reached', 'boundary-reached']);
    assert.equal(bothKinds[0].splitPoints[0].time.getTime(), bothKinds[1].boundaries[0].time.getTime());
    assert.notEqual(bothKinds[1].boundaries[0].before.entityId, bothKinds[1].boundaries[0].after.entityId);

    const multiPoints = TimeRange.create({type: 'Fixed', start: time(0), end: time(30), splitPoints: [time(10), time(20)]});
    const pointBatches = [];
    multiPoints.group.addEventListener('split-point-reached', event => pointBatches.push(event.detail));
    multiPoints.group.tick(time(20), time(0));
    assert.equal(pointBatches.length, 1);
    assert.deepEqual(Array.from(pointBatches[0].splitPoints, point => point.time.getTime()), [time(10).getTime(), time(20).getTime()],
        'A delayed tick batches all reached split points');

    const movablePoint = {id: 'movable-cut', time: time(10)};
    const movable = TimeRange.create({type: 'Fixed', start: time(0), end: time(100), splitPoints: [movablePoint]});
    const movableEvents = [];
    for (const type of ['split-point-reached', 'split-point-reset']) {
        movable.group.addEventListener(type, event => movableEvents.push({type, ...event.detail}));
    }
    movable.group.tick(time(10), time(0));
    assert.equal(movableEvents[0].splitPoints[0].splitPoint, movablePoint, 'Events reference the supplied split-point object');
    assert.equal(movable.group.splitPoints[0], movablePoint);
    movable.group.beginUpdate();
    movablePoint.time = time(40);
    const addedPoint = {id: 'temporary-cut', time: time(25)};
    assert.equal(movable.group.addSplitPoint(addedPoint), addedPoint);
    assert.equal(movable.group.removeSplitPoint(addedPoint), true);
    assert.equal(movable.group.removeSplitPoint(addedPoint), false);
    movable.group.endUpdate();
    assert.equal(movableEvents.length, 1, 'Editing split-point objects emits nothing before the next tick');
    movable.group.tick(time(10));
    assert.deepEqual(movableEvents.map(event => event.type), ['split-point-reached', 'split-point-reset']);
    assert.equal(movableEvents[1].splitPoints[0].splitPoint, movablePoint);
    assert.equal(movableEvents[1].splitPoints[0].time.getTime(), time(40).getTime());
    movable.group.tick(time(10));
    assert.equal(movableEvents.length, 2, 'A reset is emitted only once');
    movable.group.tick(time(40));
    assert.equal(movableEvents.at(-1).type, 'split-point-reached', 'The same object can be reached again after resetting');
    assert.equal(movableEvents.at(-1).splitPoints[0].splitPoint, movablePoint);
    assert.equal(movableEvents[0].splitPoints[0].time.getTime(), time(10).getTime(), 'Event times remain snapshots after the object moves');

    const resetPoints = [{id: 'first-cut', time: time(10)}, {id: 'second-cut', time: time(20)}];
    const resetting = TimeRange.create({type: 'Fixed', start: time(0), end: time(100), splitPoints: resetPoints});
    resetting.group.tick(time(20), time(0));
    const resetBatches = [];
    resetting.group.addEventListener('split-point-reset', event => resetBatches.push(event.detail));
    resetting.group.beginUpdate();
    resetPoints[0].time = time(60);
    resetPoints[1].time = time(50);
    resetting.group.endUpdate();
    resetting.group.tick(time(20));
    assert.equal(resetBatches.length, 1, 'One reset event batches every reset point');
    assert.deepEqual(Array.from(resetBatches[0].splitPoints, entry => entry.splitPoint.id), ['second-cut', 'first-cut']);

    const deletedEvents = [];
    resetting.group.addEventListener('split-point-reached', event => deletedEvents.push(event.detail));
    resetting.group.beginUpdate();
    resetting.group.removeSplitPoint('first-cut');
    resetting.group.removeSplitPoint('second-cut');
    resetting.group.endUpdate();
    resetting.group.tick(time(70));
    assert.equal(deletedEvents.length, 0, 'Deleted points never produce later reached events');
    assert.equal(resetting.group.splitPoints.length, 0);

    const outsidePoint = {id: 'outside-cut', time: time(10)};
    const outside = TimeRange.create({type: 'Fixed', start: time(0), end: time(10), splitPoints: [outsidePoint]});
    outside.group.tick(time(10), time(0));
    const outsideResets = [];
    outside.group.addEventListener('split-point-reset', event => outsideResets.push(event.detail));
    outside.group.beginUpdate();
    outsidePoint.time = time(20);
    outside.group.endUpdate();
    outside.group.tick(time(10));
    assert.equal(outsideResets.length, 1, 'Moving a reached point outside the group still resets it');
    assert.equal(outsideResets[0].splitPoints[0].splitPoint, outsidePoint);
    assert.throws(() => outside.group.setSplitPoints([{id: 'duplicate', time: time(10)}, {id: 'duplicate', time: time(20)}]), /unique/);

    const catchupPoint = {id: 'catchup-cut', time: time(10)};
    const catchup = TimeRange.create({type: 'Fixed', start: time(0), end: time(100), splitPoints: [catchupPoint]});
    catchup.group.tick(time(10), time(0));
    const catchupEvents = [];
    for (const type of ['split-point-reset', 'split-point-reached']) catchup.group.addEventListener(type, event => catchupEvents.push(event));
    catchup.group.beginUpdate();
    catchupPoint.time = time(20);
    catchup.group.endUpdate();
    catchup.group.tick(time(30));
    assert.deepEqual(catchupEvents.map(event => event.type), ['split-point-reset', 'split-point-reached'],
        'A delayed tick reports the edit reset before reaching the moved point again');

    const chain = TimeRange.create({ type: 'Fixed', start: time(0), end: time(10) });
    const second = TimeRange.create({ group: chain.group, type: 'Fixed', start: time(10), end: time(20) }).ranges[0];
    const third = TimeRange.create({ group: chain.group, type: 'Fixed', start: time(25), end: time(30) }).ranges[0];
    const crossed = [];
    chain.group.addEventListener('boundary-reached', event => crossed.push(event.detail));
    chain.group.tick(time(35), time(0));
    assert.equal(crossed.length, 1, 'A delayed tick batches multiple boundaries');
    assert.deepEqual(Array.from(crossed[0].boundaries, boundary => boundary.time.getTime()), [10, 20, 25, 30].map(minute => time(minute).getTime()));
    assert.equal(crossed[0].boundaries[0].before, chain.ranges[0]);
    assert.equal(crossed[0].boundaries[0].after, second);
    assert.equal(crossed[0].boundaries.at(-1).before, third);
    assert.equal('after' in crossed[0].boundaries.at(-1), false);
    chain.group.tick(time(36));
    assert.equal(crossed.length, 1, 'Repeated ticks do not re-emit reached boundaries');
    assert.equal(chain.group.tickData.lastTickTime.getTime(), time(35).getTime());
    assert.equal(chain.group.lastTickTime.getTime(), time(36).getTime());

    const edited = TimeRange.create({ type: 'Fixed', start: time(0), end: time(10) });
    const boundaryEvents = [];
    const structuralEvents = [];
    for (const type of ['boundary-reached', 'boundary-reset']) {
        edited.group.addEventListener(type, event => boundaryEvents.push({type, ...event.detail}));
    }
    for (const type of ['insert', 'remove', 'change', 'split']) {
        edited.group.addEventListener(type, event => structuralEvents.push(event));
    }
    edited.group.tick(time(20), time(0));
    boundaryEvents.length = 0;
    edited.group.beginUpdate();
    edited.group.beginUpdate();
    TimeRange._setTypeAndEnd(edited.ranges[0], 'Fixed', time(30).getTime());
    edited.group.notifyRangeChanged(edited.ranges[0]);
    edited.group.endUpdate();
    edited.group.tick(time(20));
    assert.equal(boundaryEvents.length, 0);
    assert.equal(structuralEvents.length, 0);
    edited.group.endUpdate();
    assert.equal(boundaryEvents.length, 0, 'endUpdate waits for the next tick');
    edited.group.tick(time(20));
    assert.deepEqual(boundaryEvents.map(event => event.type), ['boundary-reset']);
    assert.equal(boundaryEvents[0].boundaries[0].time.getTime(), time(30).getTime());
    edited.group.tick(time(30));
    assert.deepEqual(boundaryEvents.map(event => event.type), ['boundary-reset', 'boundary-reached']);
    assert.throws(() => edited.group.endUpdate(), /No TimeRangeGroup update/);

    // A split preserves the original end and entity. Its new interior cut is
    // reported as a split point, while the original end can independently reset.
    edited.group.beginUpdate();
    edited.group.setBoundaries([time(5)]);
    TimeRange._setTypeAndEnd(edited.ranges[0], 'Fixed', time(50).getTime());
    edited.group.split(edited.ranges[0], time(5));
    edited.group.endUpdate();
    boundaryEvents.length = 0;
    const splitEvents = [];
    edited.group.addEventListener('split-point-reached', event => splitEvents.push(event.detail));
    edited.group.tick(time(30));
    assert.deepEqual(boundaryEvents.map(event => event.type), ['boundary-reset']);
    assert.equal(splitEvents[0].splitPoints[0].time.getTime(), time(5).getTime());
    assert.equal(boundaryEvents[0].boundaries[0].time.getTime(), time(50).getTime());
    assert.equal('after' in boundaryEvents[0].boundaries[0], false);

    const invalid = TimeRange.create({ type: 'Fixed', start: time(0), end: time(10) });
    invalid.group.tick(time(1), time(0));
    invalid.group.beginUpdate();
    const overlapping = TimeRange.create({ group: invalid.group, type: 'Collapsable', start: time(5), end: time(15) }).ranges[0];
    invalid.group.endUpdate();
    const invalidEvents = [];
    invalid.group.addEventListener('boundary-reached', event => invalidEvents.push(event));
    assert.throws(() => invalid.group.tick(time(20)), /overlap/);
    assert.equal(invalid.group.lastTickTime.getTime(), time(1).getTime());
    assert.equal(invalidEvents.length, 0);
    invalid.group.beginUpdate();
    invalid.group.remove(overlapping.rangeId);
    invalid.group.endUpdate();
    invalid.group.tick(time(20));
    assert.equal(invalidEvents.length, 1, 'A repaired update can validate and reconcile');

    const illegalTypes = TimeRange.create({ type: 'Expandable', start: time(0), end: time(10) });
    illegalTypes.group.beginUpdate();
    TimeRange.create({ group: illegalTypes.group, type: 'Expandable', start: time(10), end: time(20) });
    illegalTypes.group.endUpdate();
    assert.throws(() => illegalTypes.group.tick(time(0), time(0)), /Adjacent Expandable/, 'Separate entities are never merged to conceal illegal adjacency');

    const clock = new window.EventTarget();
    const fromClock = TimeRange.create({ clock, type: 'Fixed', start: time(0), end: time(10) });
    const clockEvents = [];
    fromClock.group.addEventListener('boundary-reached', event => clockEvents.push(event.detail));
    clock.dispatchEvent(new window.CustomEvent('tick', {detail: {currentTime: time(10), lastTickTime: time(0)}}));
    assert.equal(clockEvents.length, 1, 'Clock ticks automatically generate boundary events');
    fromClock.group.remove(fromClock.ranges[0].rangeId);
    clock.dispatchEvent(new window.CustomEvent('tick', {detail: {currentTime: time(15), lastTickTime: time(10)}}));
    assert.equal(fromClock.group.lastTickTime.getTime(), time(15).getTime(), 'Empty groups retain tick data');
    const savedTime = fromClock.group.lastTickTime;
    savedTime.setTime(0);
    assert.equal(fromClock.group.lastTickTime.getTime(), time(15).getTime(), 'Stored tick times cannot be changed through date getters');
    fromClock.group.dispose();
    assert.equal(fromClock.group.tickData, null);

    const paused = TimeRange.create({type: 'Expandable', start: time(0), end: time(10)});
    paused.group.tick(time(5), time(0));
    const validTick = paused.group.tickData;
    const endBeforeUpdate = paused.group.endTime.getTime();
    paused.group.beginUpdate();
    paused.group.beginUpdate();
    paused.group.tick(time(15), time(10));
    paused.group.endUpdate();
    const suspendedTick = new TimeRangeTick(time(20), time(15));
    paused.group.tick(suspendedTick);
    assert.equal(paused.group.tickData, validTick, 'Suspended ticks do not replace valid tick data');
    assert.equal(paused.group.lastTickTime.getTime(), time(5).getTime());
    paused.group.endUpdate();
    paused.group.tick(new TimeRangeTick(time(30), time(25)));
    assert.equal(paused.group.tickData.totalDelta, 25 * 60000, 'Resume includes the entire suspended interval');
    assert.equal(paused.group.endTime.getTime() - endBeforeUpdate, 25 * 60000);
    assert.equal(suspendedTick.cursorTime.getTime(), time(15).getTime());

    const failedResume = TimeRange.create({type: 'Expandable', start: time(0), end: time(10)});
    failedResume.group.tick(time(5), time(0));
    failedResume.group.beginUpdate();
    const conflict = TimeRange.create({group: failedResume.group, type: 'Fixed', start: time(1), end: time(3)}).ranges[0];
    failedResume.group.endUpdate();
    assert.throws(() => failedResume.group.tick(time(20), time(15)), /overlap/);
    assert.equal(failedResume.group.lastTickTime.getTime(), time(5).getTime());
    failedResume.group.beginUpdate();
    failedResume.group.remove(conflict.rangeId);
    failedResume.group.endUpdate();
    failedResume.group.tick(time(30), time(25));
    assert.equal(failedResume.group.tickData.totalDelta, 25 * 60000, 'Failed validation does not consume elapsed time');

    const placement = TimeRange.create({type: 'Expandable', start: time(0), end: time(10)});
    TimeRange.create({group: placement.group, type: 'Moveable', start: time(20), end: time(30)});
    const placementSize = placement.group.size;
    assert.throws(() => TimeRange.create({group: placement.group, type: 'Fixed', start: time(15), end: time(20)}), /rooted/);
    assert.equal(placement.group.size, placementSize, 'A failed factory insertion leaves no orphaned ranges');

    const disposing = TimeRange.create({type: 'Fixed', start: time(0), end: time(10)});
    const disposingTail = TimeRange.create({group: disposing.group, type: 'Fixed', start: time(10), end: time(20)}).ranges[0];
    disposing.group.dispose();
    assert.equal(disposing.ranges[0].next, null);
    assert.equal(disposingTail.previous, null);
    assert.equal(disposing.group.remove(disposingTail.rangeId), false);
    assert.equal(disposing.group.size, 0, 'Disposal leaves no linked orphaned members');
    console.log('PASS typed group tick batches, resets, silent nested updates, deferred validation, and end removal');
} finally {
    await window.happyDOM.close();
}
