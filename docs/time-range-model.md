# Linked TimeRange model

`TimeRangeModel.js` defines the typed linked model (Fixed, Moveable, Expandable,
Collapsable). It is separate from the counted-time `TimeRangeGroup.js` currently
loaded by ClockTimer. Do not load both implementations into the same global scope.

## Updates and split points

Call `group.beginUpdate()` before changing ranges or ClockTimer-supplied split
points, then `group.endUpdate()`. Updates may nest. Validation is always suspended
while an update is open, and the group emits no events during that update.
The outermost `endUpdate()` schedules validation for the next tick; it emits
nothing itself. An unmatched `endUpdate()` throws.

Split points are mutable objects with stable IDs: `{ id, time }`. Keep the ID
unchanged when moving a point. `group.splitPoints` returns a copy of the collection
containing the same objects, so changing a point's `time` edits that point.
Use `setSplitPoints(points)`, `addSplitPoint(point)`, and `removeSplitPoint(pointOrId)`
to edit membership. Objects without an ID receive one automatically. Duplicate
IDs are rejected. Date-based input is still accepted and converted into objects;
`setBoundaries()` accepts either form and `boundaries` returns Date snapshots.
`TimeRange.create({ type, start, end, splitPoints, clock })` accepts initial points.

```js
const point = { id: "lunch-start", time: new Date("2026-10-06T12:00:00Z") };
group.beginUpdate();
group.addSplitPoint(point);
point.time = new Date("2026-10-06T12:15:00Z");
group.removeSplitPoint("obsolete-point");
group.endUpdate(); // validation and notifications wait for the next tick
```

The next tick normalizes the ranges against the latest split points, reusing the
existing splitting behavior. Portions before an internal split point are
Collapsable; the final portion is Expandable. Obsolete cuts disappear when
matching portions merge. Without internal split points, the pieces return to
their original entity type. Ranges only merge when their types and entity IDs
match and they overlap or touch; configured split points preserve the cuts.
Different entities cannot merge, even if their types match.

Validation checks interval validity, overlaps, zero-length restrictions, and
the existing adjacency rules. Failed validation emits no boundary notifications
and remains pending until repaired. Normalization suppresses structural events;
the boundary batches describe the normalized chain when tick processing finishes.

## Entity identity

Each range exposes read-only `rangeId`, `pieceId`, `entityId`, and `entityType`
properties. All pieces of one logical range share `rangeId` (also exposed as
`entityId`) and retain its original `entityType`. `pieceId` identifies an individual
piece. Further splitting preserves the logical ID; a merge retains the surviving
piece's `pieceId`.

Call `group.remove(range.rangeId)` to remove every piece of that logical range.
The public method accepts only an ID, never a range object; an unknown ID returns
`false`. Internal collapse and merge operations unlink only the affected piece.

## Tick and boundary events

`group.tick(currentTime, lastTickTime)` processes clock ticks. The group retains
the latest valid `TimeRangeTick` as `tickData`, including its current, previous,
and cursor times. `group.lastTickTime` is the last valid tick's current time.
Ticks received during an update are ignored. After `endUpdate()`, elapsed time
spans from that last valid time to the next tick that passes validation, including
the entire suspended interval. Failed validation leaves this baseline unchanged.
The supplied `lastTickTime` initializes the first tick; later ticks use the group's
own last valid time, even if a clock reports a newer previous time during resume.
Empty groups also retain valid ticks.
The `clock` supplied to the group automatically forwards its `tick` events.

After successful processing, the group emits zero, one, or both of:

- `boundary-reached`: pending range boundaries now at or before tick time.
- `boundary-reset`: previously reached boundaries now after tick time because
  ranges changed. They become pending and can be reached again later.

These events concern logical entity transitions: a shared endpoint between pieces
of the same entity does not emit either boundary event. Group entrance, exit, and
gaps still have their corresponding boundary notifications. Both are
`CustomEvent`s with this `detail`:

```js
{
    tick, // TimeRangeTick
    boundaries: [
        { time, before, after } // time is a Date; entries are chronological
    ]
}
```

The group also emits `split-point-reached` and `split-point-reset`, each with
`detail: { tick, splitPoints }`. `splitPoints` is a chronological array of
`{ splitPoint, time, before, after }` entries. `splitPoint` references the original
mutable object; `time` is a Date snapshot that will not change if it moves later.
A previously reached point moved after the stored tick time emits
`split-point-reset` at the next tick. It becomes pending and can emit
`split-point-reached` again. A delayed tick that has already passed the new time
emits reset first, then reached. Multiple points are batched by event type;
unchanged points do not repeatedly notify, and deleted points do not notify.
At a split point between different
entities, both `split-point-reached` and `boundary-reached` are emitted; between
pieces of one entity, only `split-point-reached` is emitted.

`before` is omitted when entering the group or a range after a gap. `after` is
omitted when leaving the group or entering a gap. Shared endpoints appear once
with both neighbors. Each event batches all affected boundaries for that tick.
Unchanged reached boundaries do not emit again. The final range boundary reports
the group ending, so there is no separate `end` event or `TimeRange.Events.END`.
Existing `insert`, `remove`, `change`, and `split` events remain available outside
updates and validation.

## Implementation layout

Related operations are grouped together in the source: shared time helpers,
tick cursor data, group edits, split-point management, membership and splitting,
normalization and validation, tick propagation, event batching, and cleanup.
Individual intervals and type-specific ticking stay on TimeRange; collection
rules stay on TimeRangeGroup. Compatibility aliases remain available.

The group derives its extent from its head and tail instead of maintaining a
second start/end cache. Normalization uses sorted split-point lookup; event
collection visits points that intersect each interval rather than scanning every
point against every range. Removed members retain their original tick snapshots
without causing repeated full-group scans. Both event families share the same
transition and batch-delivery helpers.
