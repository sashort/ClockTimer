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

Use `group.setSplitPoints(dates)` and `group.splitPoints`; the earlier
`setBoundaries()` and `boundaries` names remain compatibility aliases.
`TimeRange.create({ type, start, end, splitPoints, clock })` accepts initial points.

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

Each range exposes read-only `rangeId`, `entityId`, and `entityType` properties.
`rangeId` identifies one physical piece. All pieces made by splitting a logical
range share `entityId` and retain its original `entityType`. Further splitting
preserves those values; a merge retains the surviving piece's range ID.

## Tick and boundary events

`group.tick(currentTime, lastTickTime)` processes clock ticks. The group retains
the latest `TimeRangeTick` as `tickData`, including its current, previous, and
cursor times. `group.lastTickTime` is the latest tick's current time; a subsequent
`tick(currentTime)` uses it as the previous time. Empty groups also retain ticks.
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

The group also emits `split-point-reached` with `detail: { tick, splitPoints }`.
`splitPoints` is a chronological array of `{ time, before, after }` entries for
ClockTimer split points reached during that tick. It emits once per reached point
and batches multiple points into one event. At a split point between different
entities, both `split-point-reached` and `boundary-reached` are emitted; between
pieces of one entity, only `split-point-reached` is emitted.

`before` is omitted when entering the group or a range after a gap. `after` is
omitted when leaving the group or entering a gap. Shared endpoints appear once
with both neighbors. Each event batches all affected boundaries for that tick.
Unchanged reached boundaries do not emit again. The final range boundary reports
the group ending, so there is no separate `end` event or `TimeRange.Events.END`.
Existing `insert`, `remove`, `change`, and `split` events remain available outside
updates and validation.
