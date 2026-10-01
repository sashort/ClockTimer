# ClockTimer state dispatch

ClockTimer's core uses an explicit trip lifecycle and named handler families.
`#transitionLifecycle(event)` moves between `ready`, `running`, and `stopped`.
`start`, `stop`, and `reset` are the supported events. Replay and deletion use
these same transitions. Stop settles counted time before changing state; clear
resets its accumulator.

While running, the operating state is derived from authoritative interval records:
`running`, `break`, `lunch`, `buffer`, `down`, or `other`. A prepared trip is
`deferred`. Interval updates run before cadence dispatch so the handler sees the
new phase when a boundary is crossed. Rendered rings never determine these states.

## Handler families

| Family | Relevant flags | Examples |
| --- | --- | --- |
| `selectGoal` | Configured mode; percentage ordering for Auto | `selectGoal_trip`, `selectGoal_auto_total_trip_standard` |
| `requirements` | Goal being calculated | `requirements_trip`, `requirements_total`, `requirements_standard` |
| `syncGoal` | Whether Sync can run for the current trip | `syncGoal_on`, `syncGoal_off` |
| `tick` | Operating state | `tick_running`, `tick_down`, `tick_buffer` |
| `renderTime` | Time display or idle clock | `renderTime_elapsed`, `renderTime_remaining`, `renderTime_end`, `renderTime_clock` |
| `ringOrder` | Active trip or inactive | `ringOrder_running`, `ringOrder_inactive` |
| `ringLayout` | Fit or overflow | `ringLayout_fit`, `ringLayout_overflow` |

`#dispatch(family, flags, context)` constructs a name with underscores and invokes
`this.#dispatchHandlers[name].call(this, context)`. The private registry contains
private method references because JavaScript cannot access `#methods` through
bracket notation. Missing handlers throw immediately. States with identical
behavior deliberately share a handler; no full cross product of unrelated flags
is generated.

## Goals and percentage ordering

Configured goal mode and selected current goal are distinct. Auto filters out
unavailable or unattainable candidates, then chooses the first available candidate
in the percentage order. An explicit calculated end-time goal retains its existing
Trip priority. Fixed Trip and Total modes retain their selected scope even after a
goal is missed.

The ordering uses effective Trip and Total percentages and Standard = 100%.
Sync's calculated Trip percentage therefore participates in the ordering. The
ordering is cached until either effective percentage changes.

The six orders, highest percentage first, are:

- `trip_total_standard`
- `trip_standard_total`
- `total_trip_standard`
- `total_standard_trip`
- `standard_trip_total`
- `standard_total_trip`

Equal percentages keep Trip, then Total, then Standard priority. Numerical values
remain available to the calculation helpers, so ties do not imply separate ranges.

Sync dispatch is `on` only when enabled and an active trip has usable start
properties. Otherwise its `off` handler removes stale Sync-derived Trip goals
without discarding a calculated end-time goal.

## Accounting and presentation

Durations, actual percentages, aggregate totals, interval approvals, colors, and
visibility preferences remain data. Counted time continues to use timestamps and
interval records. Goal selection and display changes do not reset it. Total goal
requirements retain their rounding to a whole percentage point for the implied
Trip goal. Open Down retains the counted-time budget even when an end time is
unavailable.

Start relation and goal progress are derived values, rather than independent
booleans that can contradict the timestamps. `getDispatchState(now)` returns a
frozen diagnostic snapshot with the operating state, configured and current goal,
percentage order, Sync flag, time display, ring layout, start relation, goal
progress, and active interval status. Active interval status is `open`, `scheduled`,
or `none`; approval decisions remain on their interval records.

The established ring animation, collision, and geometry helpers are retained
behind the handler families.

## Verification

Run `TZ=UTC node tests/clock-timer-fsm.mjs` from the repository root. It exercises
all six orders, ties, Sync on/off, Trip/Total/Auto, unavailable candidates,
fit/overflow, Down cancellation, and lifecycle resets.

For an implementation comparison, set `CLOCK_TIMER_BASELINE` to a saved previous
ClockTimer.js. The test compares timing summaries, all three time displays, goal
selection, and rendered range boundaries against that source in a separate DOM.
