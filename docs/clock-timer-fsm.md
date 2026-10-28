# ClockTimer state dispatch

## Current Debug state inventory

Use the [searchable state map](application-state-inventory.html) and its
[machine-readable inventory](application-state-inventory.json) for enumeration.
The map currently records 126 regions with 470 named values, 33 surface types
with four lifecycle states each, nine aliases for useful combined states, and
11 explicitly Debug-only manual-trip workflow entries. These are vocabulary
counts, **not** the number of unique reachable application states or test cases.

The shared state vocabulary is independent of app-mode. Debug-only manual
trip-entry workflows are marked separately; reusable Voicepad/Numberpad states
remain shared. Server-assigned trips are excluded from this map. Simulation and
Production transitions are outside the current mapping scope; their behavior is
not invented from mode names. The current runtime remains explicitly Debug.

A complete behavioral state combines the selected regions, each active owner's
operation/collector/audio state, and the ordered modal/return/continuation paths.
Payload includes numerical readings, exact percentages, timestamps and identities;
credentials never enter state IDs. Independent comparison regions preserve ties
and goals below 100%. Named aliases make Early Start, B-game, Overtime, buffers
and between-trip summary states easy to find without conflating their dimensions.

The source audit registers static and dynamically loaded surfaces, two unnamed
dynamic dialogs, the mode dropdown, menu parent panes, operation and continuation
phases, and every node in the existing FSM chart. Legacy nodes are mapped,
retired, or explicitly outside the coupled Order Filler scope. Coverage checks
fail if a registered source disappears, a new static surface/pane is omitted, or
a chart node has no disposition. This audit is not a proof of every reachable
combination or a claim that every transition has a runtime test.

The map records root-snapshot observability gaps rather than deriving command
eligibility from disabled buttons. In particular, unnamed custom-date/Down Details
dialogs and editor/break/scheduled/audio ownership detail need explicit runtime
bindings in the later FSM work. Current case-family projections (including the
old app-mode observations) are test fixtures, not a competing shared enumeration.

Stay on the current Debug branch while debugging. Create the `test` branch only
after Debug is stable, then modify runtime enumerations/FSM and mode-specific
transitions there. This inventory work creates neither that branch nor a runtime
FSM replacement.

Run `node tests/application-state-inventory.mjs` for source/model/view coverage,
and `node scripts/build-application-state-inventory.cjs` after editing the JSON.
The existing 39 runtime cases remain a separate, partial transition evidence set.

## Coupled-state behavioral contract, 18 October 2026

The incremental machine-readable contract is
[order-filler-state-contract.json](order-filler-state-contract.json). It is a new
behavioral oracle alongside the existing graph, not a claim that every combined
state has already been enumerated. Its axes identify the state dimensions still
to reconcile; its backlog records unreviewed combinations. Historical graph or
prose entries must not override newer explicit requirements such as one PIN OK.

A case supplies independent Given state assertions, public setup inputs, an
input method and command, and expected state, command dispatch count, trip write
count, remaining locks, and ordered audio. Required/forbidden command lists are
partial assertions; an explicit `only` list is exhaustive for that case.
An omitted audio expectation is unreviewed, never an assertion of silence. An
explicit empty audio list requires silence. Case definitions do not constitute
passing evidence: execute the runner to obtain results for the current checkout.

The initial 17 cases cover microphone activation/deactivation and duplicate
suppression; sleeping voice rejection with Commands open and closed; pointer
Commands access while sleeping; and Time while running, in B-game, overtime,
early start, break, short break, lunch and Down. Time cases verify one dispatch,
ordered speech/chime requests, completion barriers, no trip writes and no locks.
B-game fixtures use a 120% Trip goal after its 25-minute deadline but before the
30-minute standard deadline. Early fixtures distinguish the historical start
relation from being before scheduled start. These are representative cases, not
all combinations of goal modes, dialogs, permissions or speech collectors.

Unspecified Total scope is Day, and unspecified goals are 100%. Existing explicit
settings take precedence. Auto requires no scope selector or percentage-entry
prompt when those settings are missing. The two Auto defaults cases verify voice
and the pointer action, including the ordinary Auto Mode confirmation, no new
dialog/editor, no trip writes and no remaining locks. This tests existing runtime
defaults; no new setup workflow is introduced.

The earlier runtime fixture names 30 case families across recognition, trip, timing,
start relation, focus, goals, interval and session regions. These are projections
that can overlap; they are not the shared enumeration or a count of unique combined states. Eighteen families
are linked to runnable cases; twelve additional families are explicitly unreviewed.
A case records its Given and expected family, and the driver checks each named
family against the real interaction snapshot. B-game also requires a goal above
100% and performance still above 100%; a late goal alone is insufficient.

The next 22 cases cover partial/final Ready, continuing duration entry, cancelling
entry, break selection/confirmation/start for all three types, Break End prompt
and cancellation, Down/resume, requested summary, summary close/OK paths and
Ready ending a running trip. Cases check relevant command availability before
and after transitions, actual dialog/button properties, exactly-once event writes,
remaining locks and specified announcements. Partial announcement requirements
are marked separately from a complete ordered audio sequence; unspecified audio
is still unreviewed. These 39 tests are not a count of unique combined states.

Application mode is an independent axis, `appMode`, with the names
`debug`, `production` and `simulation`. There is no default or saved-setting fallback.
The canonical Order Filler template explicitly declares `app-mode="debug"`.
`ApplicationMode` in `app.js` is an immutable capability object; it rejects
missing/unknown modes. The current entry point permits only Debug and explicitly
rejects Production and Simulation activation until those implementations exist. This is separate
from Trip/Total/Auto, goal scope, and ClockTimer presentation modes.

All current runtime cases assert Debug. Debug uses manual standard-time entry
and ignores future server-assignment hints in summary responses. Restoration of
an existing unfinished Debug trip is unaffected. Production requirements are
recorded separately as not implemented: the server assigns the next trip and
standard time, with no fallback to manual entry. Its absent/loading/error
assignment behavior remains to be specified. Existing summary assignment tests
must not be presented as completed Production coverage. Simulation is a reserved
future mode with unspecified trip source, timing, persistence, controls and audio;
its behavior must not be inferred from either Debug or Production.

Between trips, the Debug summary stays open until dismissed by an accepted
interaction. Spoken OK opens Voicepad when recognition is available; pressing OK
opens Numberpad. Cancel/Close dismiss without opening either editor. The retained
prior rule lets another valid command dismiss and execute. One idle case waits
eight seconds, beyond the transient overlay lifetime, and requires the summary
to remain open with no repeated audio, commands, writes or locks. Another presses
the actual summary OK button while the mic is listening and checks Numberpad.

Announcement categories use the agreed terms:

- **Transitional announcements** follow workflow/domain changes, including changes
  initiated by the user. Examples: Break started, Trip resumed, a newly opened
  entry prompt, or the automatic summary after ending a trip. Duplicate/no-op
  transitions and stale transition owners must not replay them.
- **User-activated announcements** answer explicit information requests, such as
  Time or Trip Summary. Opening a summary dialog does not change the category.

The categories currently describe the behavioral oracle. They do not introduce
another runtime queue or change the existing announcement scheduler. Both kinds
retain owner/cancellation rules. A state snapshot alone is never an instruction
to replay an announcement on every tick.

Use `node tests/order-filler-state-contract.mjs --inventory --validate-only`
to list named families and their case references without running the app. Use
`--case-prefix=FLOW-` to run just the workflow group. The inventory deliberately
retains unreviewed authentication, recognition, buffer and loading/error families.
Unreviewed here means not yet represented by a runnable case in this contract;
other existing suites may already cover those behaviors.

Run `node tests/order-filler-state-contract.mjs`. Each case starts an isolated
real-app fixture, reaches state through public APIs and speech input, and
compares observations with the JSON expectations. No private state is injected
to manufacture a Given state. The recognizer fixture supplies transcripts; this
is not a physical-device acoustic test. Audio checks observe playback requests
and simulated completion, not a rendered waveform or actual playback timing.

Use `--validate-only` for schema/oracle checks. For a single runtime case run
`TZ=UTC node tests/app-state-transactions.mjs --state-contract --case=TIME-B-GAME --voice-feedback`.
Set `STATE_CONTRACT_DEBUG=1` to include non-credential timer diagnostics.
The negative oracle checks ensure missing snapshots, empty or overbroad grammar,
duplicate audio and reversed audio fail. Production does not yet consume this
contract: retain it as an independent oracle while coverage and semantics are
reviewed before changing runtime dispatch architecture.

## Version 2 behavioral test reference, 16 October 2026

The [speech recognition contract](speech-recognition-v2.md) specifies generic
continuation ownership through FSM/UI changes, final decoding, adaptive silence,
pruning, root validity, and response presentation. Use its evidence matrix with
the state-transition scenarios below.

Use the [reconciled working FSM](mainline-fsm-draft.html) and its
[machine-readable model](mainline-fsm-draft.json) for current implementation work.
The separately approved October chart below is preserved as a historical baseline;
its approval is not evidence that later behavior was tested.

The reconciliation inventories every one of the 281 intervening commits from
`25608199497d995d1cf4b04eeef53e5984d26bc1` (last working-model update) through
`831745dbd2c3bfa0baf494ed6f12f6a8c069debc`, including merges, corrective commits,
reversions and tests. The current login changes are identified as working changes.
The latest separate approved-model update, `1020a029`, is recorded independently.

Ten structured `v2_contracts` now cover speech planning, recognizer routing,
operation ownership and UI lockouts, breaks and Down, range/Sync reads,
replay/rendering, standalone settings, and authentication. Stable state and edge
IDs are retained; superseded inputs are retired rather than silently reused.
The interactive HTML embeds the exact JSON model. Its exported SVG is the updated
mainline overview; use the interactive Login group for authentication details.

Input type and outcome are independent: touch, mouse and keyboard use single
lines; speech uses double lines. Valid paths are solid and invalid paths dashed.
System events use dash-dot lines, and persistence rollback uses dotted lines.
Separate labeled badges show passed, failed or untested status. Invalid paths
specify the retained/destination state, discarded input and prohibited effects;
an invalid input path can itself have a passing test.

[Version 2 scenarios](fsm-v2-cases.json) are independent of the replacement's
internal classes. A test driver must reach each **Given** state through public
inputs, deliver the **When** event, settle the specified effect boundary, and
compare **Expect**: phase, focus, control availability, ordered speech, API/event
counts, owner locks and preserved state. Zero requests and zero repeated commands
are required assertions. Never derive expected results from the implementation
under test or insert private state to bypass a transition.

The runtime login oracle uses `login.phase`: `id-entry`, `pin-entry`,
`submitting`, `password-entry`, or `closed`. ID and PIN speech input both
require exactly four digits plus OK. ID group OK focuses the first PIN cell and
speaks the individual ID digits, a sentence pause, then Password. PIN group OK
submits authentication exactly once; there is no second confirmation or PIN
readback. A failed login retains ID, clears PIN and focuses the first PIN cell.
Cancel on an empty PIN returns to empty ID; Cancel on entered PIN clears PIN,
and a second Cancel returns to ID. Backspace on an empty first PIN cell also
restarts ID. `reviewReady` is a compatibility name for a complete PIN awaiting
its first OK, not a separate review stage.
Public snapshots and trace evidence must never contain raw PIN digits.

Listed automated scenarios are evidence sources, not a claim that every chart
edge or physical microphone path passed. Unverified user reports and unresolved
older contracts remain explicit coverage gaps. Structured `v2_contracts` and
`v2_test_vectors` take precedence over historical prose in reconciled areas.
Custom in-place Vosk switching is deferred and requires a new branch.

Run `node tests/fsm-reference.mjs` for model/HTML parity, stable edge references,
complete commit inventory, scenario structure and single-confirmation login invariants.
Run `node tests/app-state-transactions.mjs --pin-review --voice-feedback` to compare
the real login runtime against the model's bindings and speech/persistence rules.
`scripts/reconcile-fsm.cjs` rebuilds this reconciliation at its pinned reviewed
head; changing `FSM_REVIEWED_HEAD` requires reviewing the newly inventoried changes.

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
| `syncGoal` | Whether Sync can run for the active trip | `syncGoal_on`, `syncGoal_off` |
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

## Current presentation and editor addendum, 27 October 2026

The [goal-bar contract](goal-bar.md) and [today’s change audit](2026-10-27-ui-changes.md)
are the current rules for presentation and goal editing. The working FSM adds
`GOAL-SELECT` and `GOAL-PERCENT`, guarded header/node/triangle edges, two structured
contracts, and fourteen v2 vectors. `GOAL-DISPLAY` covers implemented local behavior;
`GOAL-BAR-LIFECYCLE-ANIMATION` is explicitly proposed. No production deployment or
new graph approval is implied. The previous commit reconciliation remains a
historical audit through 16 October, not an audit of uncommitted working changes.

Presentation mode, goal failure/compression state and selector configuration are
orthogonal to trip phase. Numerical percentages, time strings and configured
choice lists are payload, not a Cartesian expansion of focused-surface states.
The passive goal-limit notice is a registered surface but never command focus.
Main Standard Time is always trip-only; aggregate mode does not disable its editor.

The shared inventory includes Classic/Bar mode, idle/active/break-only projection,
failure set, left/right triangle visibility, selector choice class, Standard Time
availability and input-limit status. Its generated HTML embeds the same inventory
and coupled-state contract. Stable graph IDs are preserved; the separately
approved graph points to this addendum without changing its historical approval.

## Goals and percentage ordering

Configured goal mode and selected current goal are distinct. Auto compares the
current-trip counted-time allowance derived from each candidate's percentage,
then chooses the shortest available time. Total includes the selected range's
logged standard/counted time, so its raw percentage cannot be compared directly
with Trip's percentage. For example, Total 120% can imply 20 minutes while Trip
140% implies about 21 minutes 26 seconds; Total is the first target in that case.

Missed, unavailable, and non-positive allowances cannot win Auto. As each target
is missed, the next longer available time is used. Equal derived times keep Total (aggregate),
then Trip, then Standard priority. Goal-failure fallback announcements likewise
choose the earliest remaining deadline. Fixed Trip and Total modes retain their
selected scope after a goal is missed. Explicit calculated end-time goals retain
their Trip target unless the aggregate allowance ties it; Aggregate wins that tie.

The cached ordering key contains all three derived allowances, including their
availability, rather than the raw goal percentages. Updating logged aggregates,
Sync, Override, standard duration, or elapsed time therefore refreshes selection
when those derived values change. The legacy `percentageOrder` diagnostic and
six scope-order handler names remain compatible; their ordering now means
shortest time first:

- `trip_total_standard`
- `trip_standard_total`
- `total_trip_standard`
- `total_standard_trip`
- `standard_trip_total`
- `standard_total_trip`

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

Rendering lifecycle invariants:

- Model-removed `time-range` views are hidden and must compute to `display: none`,
  even though ordinary slotted ranges use `display: block`. Removing their clip
  path must never expose an unclipped Down fill across the clock face.
- An animated exit owns DOM removal. Canceling its animation during a disconnect
  or a replacement geometry commit must complete that removal exactly once.
  Reconnecting a ring must not revive an obsolete overtime arc.
- Normal hour-boundary ring reordering is distinct from an obsolete arc. The
  October 25 Down → Lunch restore and fitted/overflow replay did not reproduce
  the reported screenshot's exact ring arrangement; interrupted exit removal and
  hidden-view painting were reproduced independently.

`node tests/ring-hidden-range-browser.cjs` checks these visibility and exit
invariants in Chromium. `node tests/radial-fitted-tick-browser.cjs` checks that
Down and overtime arcs share the fitted projection across successive ticks.

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


## Checking announcements and commands against the inventory

The searchable `application-state-inventory.html` now includes the independent
behavioral expectations in `order-filler-state-contract.json`. Its behavior table
shows the input, before/after snapshot predicates, mapped region identifiers,
required/forbidden or exclusive voice commands, and audio expectations for each
scenario. State rows show scenario-reference counts, not a claim of exhaustive
coverage. Search the behavior table by command, state identifier, or announcement.

`inventoryBindings` connects public snapshot paths to inventory regions.
`tests/state-contract-fixture.mjs` rejects unknown region values before checking
actual runtime state; family predicates use the same checks. Current bindings
cover recognition, goal mode/scope, operating state, historical start relation,
editor kind/field and login phase.
Other regions, surface phases and combinations still require explicit bindings
and behavioral cases. The table labels missing expectations **Unreviewed**;
omitted audio never means silence. Required announcements alone do not forbid
other audio, and required/forbidden commands do not enumerate the entire grammar.

Run `node tests/order-filler-state-contract.mjs` for fresh runtime verification.
The static view embeds expectations only and deliberately has no saved green
pass status. Run `node scripts/build-application-state-inventory.cjs` after
changing either JSON contract. Sleeping command attempts explicitly expect no
audio, and sleeping result states require an exclusive Wake grammar, including
when the Commands menu was opened manually. Pointer access remains available.

This is an incremental Debug audit; it does not replace the runtime FSM, assert
full reachability, implement Simulation/Production, or introduce server-assigned
trip behavior. Continue filling missing expectations before moving to `test`.


## Trip Log downtime ledger

`TripDowntimeSummary` in `TripAggregates.js` is the shared, read-only calculator
for logged and approved downtime. Trip Log entry editing uses its same approval
resolver, keeping individual entries and totals consistent. Latest explicit
approval wins; unapproved means zero; stored approved time is next; otherwise a
closed interval defaults to its elapsed duration, preserving the existing rule.
Approved time can exceed logged time. Deleted intervals and non-Down intervals
are excluded, and duplicate interval keys do not double count. Open intervals
use one render-time clock sample. No approval or persistence state is changed.

`TripAggregates.calculate().downtime` uses exactly the same deduplicated,
range-filtered, active-trip-included population as the performance totals.
`TripLog` displays that ledger under each trip, each aggregate and the overview.
No ledger is rendered when logged and approved values are both zero. Black
backgrounds distinguish the ledger. Its labels are in the English UI resources.

Each expanded aggregate has one `.trip-log-group-children` container with a
single left guide aligned beneath its disclosure arrow. Nested groups add one
line each; no extra nested outlines are drawn. Collapse naturally hides the
guide and its children. Tests cover approval changes/defaults/surplus/deletion,
active inclusion, zero omission, and readable, arrow-aligned layouts at phone
and desktop widths. Version 2 should preserve the pure calculator and UI split.

### Standalone breaks and overdue break handoff (2026-10-20)

`BreakSessionPolicy` in `ClockTimer.js` is a pure policy shared by the timer,
interaction snapshot, touch controls and speech availability. Its input is the
active trip flag, persisted break-only flag, interval snapshot and one clock
sample. `canConvertBreak` becomes true at the original scheduled end buffer,
including when the interval's configured elapsed behavior extends its end.
`scheduledBoundaryTime` preserves that original boundary separately from the
current display boundary. `getDispatchState()` exposes `sessionKind` and
`breakDownEligible`; `getUIState()` exposes `break_only` and `break_transition`.

`startDownTime(at)` rechecks eligibility, closes an overdue regular break at
`downStart`, suppresses the intermediate trip-resumed announcement, then starts
Down at the same instant. Selecting it later therefore credits all elapsed time
since the buffer ended to downtime. Existing downtime announcements, animations,
approval/persistence and transaction rollback remain the shared flow. The End
Break row animates to two equal tracks with a gutter; Down enters from the right.
Reduced motion disables this animation. Existing `down` and `down time` commands
invoke the same action; no new voice aliases are added.

`startBreakSession()` creates a standalone timed-break owner while idle. It has
no standard time (`null` in durable records), no production/non-production
classification, and contributes nothing to any aggregate, including trip counts,
actual/counted/standard time, performance or downtime. The internal zero budget
supports clock arithmetic only; it is never presented or persisted as standard
time. `trip.started.breakOnly` survives load/restore/observer snapshots and
migration 014 adds `trips.break_only` with a nullable standard-time contract.
Apply that migration before deploying this change to an existing database.
It also converts historical owners explicitly marked breakOnly in their events.

Log queries retain these sessions for applicable range/All filters; Productive
and Non-productive filters exclude them because neither classification applies.
Local/offline lists follow the same rule. Aggregation filters separately, so
entries remain visible even when excluded from performance. A Break only badge
and lighter row distinguish the session, with selected-color streak animation
outlined by light/dark edges for contrast. The row shows elapsed duration and
start time, without standard/count/performance fields or standard-time settings.

Break-only owners reject Down and replacement intervals, disable automatic
late-break resume, and finish/reset when End Break/End Lunch is confirmed.
They retain break announcements but skip productive trip announcements, goal
failure audio and the trip summary. The idle Start Break control is full-width
beneath New Trip and opens the existing selector; canceling creates no session.

Version 2 should retain these as independent policy and lifecycle operations,
with the owning coordinator providing atomic checkpoint/rollback for the two
mutations in a handoff. Do not infer eligibility from hidden/disabled controls.
Tests: `app-state-transactions.mjs --break-session-controls --voice-feedback`
checks standalone types, replay, model guards, touch/voice handoff and exact
boundary timestamps. `break-session-browser.cjs` checks mobile geometry and
actual touch activation; ordinary interval and boundary suites cover regressions.

The mobile End Break presentation follows the approved mockup: one centered
label/countdown at full width, two compact centered lines in the split row, with
positive elapsed-over-buffer notation. The adjoining label is Down Time.
Boundary observation remains monotonic when a factual interval end is backdated;
`TimeRangeGroup` must never be ticked backwards to implement that operation.

### Shared session timing validation

`api/_core/trip_session_timing.php` defines `TripSessionTimingInput::parse` as
the common request contract: standalone breaks accept only a null/absent standard,
while ordinary trips require a positive integer. The API wrapper maps invalid
input to 422. Both `api/command-check` and all `api/trips` start/stop/create writes
use this validator. Updating storage validation alone is insufficient: an older
preflight rule can reject an otherwise valid break before persistence and revert
its UI transaction. `tests/trip-session-timing.php` covers that distinction.
The browser regression now selects and confirms a break through the actual idle
selector and compares computed New Trip/Start Break typography across viewports.

The Auto selector displays its current target in brackets, such as `[Trip]`,
`[Week]`, or `[Standard]`, with a light-blue tint. It refreshes with summary
updates as the active goal changes; the configured mode remains Auto.

Idle Auto renders `[Auto]` until an active production trip has a target.
The optional shared goal-bar projection and its geometry, failure states, input
limit and time semantics are documented in [goal-bar.md](goal-bar.md).

The main `standard_time_component` always represents the trip, never the selected
aggregate. `standard_time_header_text` is “Standard Time” in every scope. The
main Standard Time edit action remains available throughout an active production
trip, including Down/Break/Lunch; aggregate selection is not an edit guard.

The goal bar filters goals by configured mode: Trip excludes aggregates, aggregate
modes exclude Trip, and Auto retains both. Failure routing uses only these visible
goals. All active bar values and main time readouts remain current-trip based;
main labels are Trip Time Elapsed, Trip Time Remaining or Trip End Time. Main Remaining and bar Current both use Standard as zero.

Current bar interaction supersedes the earlier per-node routes: Whole bar, including nodes, labels, background and compression triangles, opens the existing selector: Trip only in Trip mode, selected aggregate only in aggregate mode, both in Auto. Failure count does not filter choices. No Standard Time edit or Current time-mode action from the bar. Classic and Bar goal dialogs and pads show actual configured and inferred trip values; only actual is edited.

The main active time value and bar Current now share the same formatter and
interval annotation in Remaining, Elapsed and End Time. Aggregate selection and
goal changes cannot change this Current readout. Goal deadlines and budgets remain
separate accounting/target-node values. This fixes the mismatch reported in EVQT6K.

Standalone-break UI has no ⁺/⁻ timing suffix. Interval completion events capture
breakOnly ownership, and saved/lost timing feedback is suppressed for that owner.
Regular trip pauses retain their timing feedback. Percentage display is a direct
Settings item aligned with Clock/Timer Settings, not a nested Clock/Timer option.

Standalone completion speech uses the interval type: Break, Short break or Lunch
ended / ended early / ended late. Regular trip intervals keep their Trip resumed
announcements and timing details. This changes wording, not lifecycle transitions.

Lower aggregate goals must not allocate future overtime/remaining clock geometry. The active trip owns clock range bounds; computed aggregate deadlines remain goal metadata. Verify Auto Day 40% / Trip 100% before/after Standard failure and after reload in Overflow and Fitted modes.
