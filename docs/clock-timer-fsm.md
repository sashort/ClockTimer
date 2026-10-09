# ClockTimer state dispatch

## Approved mainline interaction chart

The [interactive mainline FSM](mainline-fsm.html) is the approved reference for
focus, trip phase, command availability, transitions, and ordered audio feedback.
It was approved on 6 October 2026 against version J8KMSL, commit
`2b137e138a2f570dc35295f7dc3545e59bbc4a08`.

The chart includes 41 states/state families and 144 active transitions (three retired IDs are retained) with stable IDs.
Pointer transitions use single lines, voice uses double lines, system automatic
transitions use dashed lines, and persistence rollback uses dotted lines.
Green means tested and passed, red means tested and failed, and gray means
untested; chart approval does not imply that transitions have been tested.
Record the tested application version and evidence alongside each result.

Use the hamburger menu for pointer and touch gestures. The + / − controls expand
and collapse voice feedback tables in playback order. Save HTML retains recorded
results in a self-contained copy; Export SVG captures the current view.
The [structured model](mainline-fsm.json) supports test and implementation
references. Keep it consistent with the model embedded in the HTML. The
[flat mainline SVG](mainline-fsm.svg) is a static overview; other groups are
available in the interactive chart.

For the existing authenticated Developer → Docs endpoint, use
`/api/docs/?path=mainline-fsm.html`.

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

## Voice feedback and break confirmation

The Break Selector is pointer-only. Voice uses **Start Break**, **Start Short
Break**, or **Start Lunch**, optionally followed by **OK**. **Break Start** is
removed. Without OK, voice opens and speaks “Are you ready to start your
<break type>?” with OK/Cancel. OK starts the selected interval; Cancel keeps the
trip state. With OK in the same utterance, both the question and dialog are
suppressed, including incremental recognition.

The new start transitions B420–B425 are skippable. Retired voice selector
transitions retain their IDs for reference. `speech-skippable` is configurable
in the speech editor; an explicit false preserves its announcement in a chain.

Break, Lunch and Short Break announce the selected type and its matching end
command: **End Break**, **End Short Break**, or **End Lunch**, optionally followed
by **OK**. Standalone commands ask “Are you ready to end your <break type>?”
with OK/Cancel. The same utterance with OK skips both question and dialog.
Only the command matching the active interval is eligible. Resume applies to
Down Time.

Command patterns, question templates, interval labels and button captions come
from language resources. Mainline actions pass semantic identifiers (`break`,
`short-break`, `lunch`) to one shared workflow; they do not parse English labels.
The regression fixture also exercises translated start/confirmation phrases.

In Scheduled Start, `[Standard Time] <duration>` has an optional prefix:
`standard time thirty minutes` and `thirty minutes` set the same field.
The optional prefix applies only to the scheduled-start surface.

## Drop-In controls and settings sources

The evolving interactive draft and its JSON define remote microphone request and
result transitions (`DROP-IN-MIC-REQUEST`, `DROP-IN-MIC-RESULT`). The mic uses the
publisher mic-bar sleep/wake control. It requires an authorized selected peer,
accepts explicit on/off commands, and confirms the publisher state. A ten-second
timeout, disconnection, or target change ends the pending operation.

Observer settings use `settingsSource: default | custom | user`. Default applies
the saved baseline; Custom restores that observer's retained choices for the
selected person; User mirrors the publisher display. Mode, Goal and Sync controls show the five source badges and live Mirror values.
Settings retains sound controls and read-only ClockTimer appearance following the publisher.
Only listening sound controls are editable in this view. Field provenance is
stored explicitly; a user value matching default clears its override and follows
future baseline changes. Mode, Sync and Goal share an Apply to Default/User
confirmation, and each supports a per-field Mirror choice.

Regression coverage: `observer-microphone.mjs`, `remote_microphone_permissions.php`,
`observer-goal-pad.mjs`, `drop-in-preferences.mjs`, `drop-in-page.mjs`, and
`drop-in-observer-replay.mjs`.


## Shared settings dialog surface

Order-Filler and Drop-In display `settings.html` directly inside an iframe-only modal dialog. The modal adds no heading, navigation, or close button around the standalone page. Escape or clicking the dialog backdrop closes the modal and returns to the unchanged parent page.

Order-Filler keeps distinct launcher entries for Clock/Timer Settings and Audio Settings. Each entry selects its corresponding settings surface in the iframe. Drop-In reuses its existing ClockTimer menu item to open the graphical settings surface; no additional top-of-page launcher is added. The standalone page owns its existing labels, controls, and settings handlers. Its embedded presentation hides the standalone return header, while direct navigation without a selected surface retains the full page.

Settings navigation is orthogonal to the trip lifecycle. Opening or closing the dialog must not dispatch `start`, `stop`, or `reset`, alter the focused trip phase, or change persistence semantics. Existing settings handlers and persistence paths are preserved. Regression coverage lives in `tests/standalone-settings-page.mjs`.
