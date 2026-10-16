# Version 2 class contracts

Updated 16 October 2026. This document specifies the extracted classes, their
integration boundaries, and what remains outside them. Read it with the
[speech lifecycle contract](speech-recognition-v2.md) and
[FSM scenarios](fsm-v2-cases.json). A passing supplied-transcript test is not
evidence of physical microphone accuracy.

## Responsibility map

| Component | Owns | Must delegate |
| --- | --- | --- |
| `SpeechCommandBranchPolicy` | Preference between eligible interpretation plans | Eligibility, parsing, FSM destinations, execution |
| `SpeechContinuationSession` | Open collection, consumed spans, expected-surface membership, lifecycle and silence deadline | Recognition, language rules, permissions, transaction settlement, playback |
| `OwnedFeedbackScope` | Deferred feedback and cancellation leases for one workflow | When that workflow is valid, audio synthesis, playback ordering across owners |
| SpeechMenu | Orchestration of recognition, planning, lifecycle and serialized dispatch | Lifecycle to the session; plan ordering to policy; feedback ownership to scope |
| Existing ApplicationCoordinator / CommandOperation | Effect ownership, locks, pending acknowledgements, checkpoint/rollback | Language parsing and recognition |
| Existing language parsers / value contexts | Language-specific values and valid/incomplete/malformed/defer decisions | UI rendering and action execution |

The three new classes are classic scripts that register their class on
`globalThis`. Load `OwnedFeedbackScope.js` and `SpeechCommandBranchPolicy.js`,
then `SpeechContinuationSession.js`, before SpeechMenu. The application runtime
loader and speech asset cache include them. Tests install the same sources through
`tests/speech-lifecycle-fixture.mjs` in the correct Node or browser scope.

## SpeechContinuationSession

Construct with `{id, surfaces, now, schedule, unschedule, onError, feedback}`.
Only `id` identifies the session; the other arguments have defaults. `surfaces`
contains opaque destination tokens. The three clock functions are injectable so
deadline behavior can be tested without a microphone, DOM, or wall-clock sleep.
`feedback` can inject an OwnedFeedbackScope-compatible object; otherwise the
session constructs one. `onError` receives feedback adapter errors.

| API | Contract |
| --- | --- |
| `phase` | `collecting`, `settling`, `accepted`, or terminal `cancelled` |
| `collectors` | Map of collector identity to its current parsing state |
| `acceptedSpans` | Consumed command spans; consumption is distinct from persisted effects |
| `expectedSurfaces` | Set of destinations already authorized/projected by the caller |
| `context` | Current opaque continuation context |
| `observe(text)` | Update the hypothesis and return to collecting; interrupt owned active feedback on changed text, while retaining pending feedback for arbitration |
| `transfer(context, surface)` | Preserve collector and deadline across an expected destination; return false for an unexpected surface or cancelled session |
| `armSilence(delay, expire)` | Schedule one nonnegative finite delay, replacing the previous timer; expose the absolute `deadline` |
| `cancelSilence()` | Cancel the deadline and fence callbacks from the old timer |
| `deferFeedback(key, start)` | Queue replaceable owned feedback; return its identity-specific cancellation function |
| `cancelFeedback(reason, discard)` | Interrupt playback, optionally preserving pending feedback |
| `settle(true)` | Accept after external final-decode/transaction checks, cancel the timer, and release pending feedback once |
| `settle(false)` / `cancel(reason)` | Close the session, cancel timers and feedback, clear collectors, reject late input/transfer |

```mermaid
stateDiagram-v2
    [*] --> collecting
    collecting --> collecting: expected UI transition / growing text
    collecting --> settling: silence expires; request final decode
    settling --> collecting: collection explicitly resumes
    settling --> accepted: final decode and root effects accepted
    collecting --> cancelled: cancellation / failed root
    settling --> cancelled: invalid final / failure
    accepted --> collecting: next input in the same capture
    cancelled --> [*]
```

Silence expiry only calls the injected `expire` function. It cannot accept the
last partial or authorize an action. The orchestrator must request the recognizer
final, run root validation, and settle the operation before `settle(true)`.
Recognition final timeout/failure belongs to the recognizer/coordinator layer.
Actual resumed-speech events cancel the deadline through the orchestrator; receiving
a hypothesis alone must not manufacture a new adaptive pause window.

The FSM must validate context, destination, and permissions before transfer.
Surface membership is a continuity guard, not authorization. An unexpected transfer
returns false without changing the collector/context/deadline; its caller decides
how to cancel or roll back the operation.

The current SpeechMenu adapter lazily creates a session and shares its existing
collector, surface and consumed-span containers with it. During migration these
are aliases, not two copies. An invalidated root gets a fresh session before an
independent root can reuse the same acoustic capture. A cancelled session itself
is never revived. A replacement implementation should give logical sessions their
own identity and retain the acoustic/decoder IDs separately. The class does not
merge independently ended utterances or choose continuity rules for them.

## OwnedFeedbackScope

This class is reusable outside speech: a pointer-triggered workflow can own the
same kind of deferred prompt or chime as a voice-triggered workflow.

Construct with `{onError}`. Use stable keys for feedback that should replace an
older version, and separate keys for independent messages.

| API | Contract |
| --- | --- |
| `defer(key, start)` | Replace that key's pending/active feedback; return cancellation for this exact entry |
| `release()` | Start pending entries once at the caller-selected acceptance boundary |
| `interrupt(reason, {discardPending})` | Abort/stop active leases, optionally discard pending entries; scope remains reusable |
| `cancel(reason)` | Permanently close the scope and cancel all owned entries |
| `closed`, `pendingCount`, `playingCount` | Lifecycle/diagnostic state without exposing internal queue maps |

The start callback receives an AbortSignal. It can return a stop function or a
handle with `stop()` and optional `finished` promise. An ongoing asynchronous
adapter must return a handle; a callback without one is considered fire-and-forget
and leaves no active lease. Each scope affects only the handles it owns.

```js
const feedback = new OwnedFeedbackScope({onError: reportPlaybackFailure});
const cancelPrompt = feedback.defer('next-step', signal =>
    playbackAdapter.start('Say standard time', {signal}));

// Called only after final interpretation and workflow acceptance:
feedback.release();

// Resumed input, a replaced state, or cancellation:
feedback.interrupt('continuation-resumed');
```

`playbackAdapter.start` in this example is an adapter contract, not a new existing
AudioEngine method. It must return `{stop, finished}` for active cancellation.
Native/global synthesis cancellation must not be substituted for an owned stop
if it would cancel unrelated feedback.

Identity rules are essential: an old cancellation function cannot cancel its
replacement; an old finished promise cannot remove a newer lease; cancellation
inside `start` also stops a handle returned afterward. Cancellation of another
pending entry during release prevents that entry from starting. Playback callback
errors are reported without preventing unrelated queued entries from starting.

The scope is not a global announcement scheduler. It does not assign priorities
between workflows, synthesize text, or alter an operation's business outcome.
The existing semantic announcement scheduler and direct dialog speech calls still
need migration to adapters that honor the lease contract. Do not claim that all
active native speech can already be stopped by this extraction.

## SpeechCommandBranchPolicy

`compare(left, right, {final})` returns a positive value if `left` is preferred,
negative if `right` is preferred, and zero on a tie. Missing plans are lower
priority. Ties retain the planner's existing order. Inputs are eligible plans with
`steps`, `pending`, `invalid`, `exact`, and `consumedWords`.

Pending metadata distinguishes a viable literal prefix (`hasCommandPrefix`) from
a command head with its first word actually recognized (`headStarted`). A whole
unresolved head such as `ready a...` takes precedence over a decomposition that
would execute Ready and open the wrong state. A fragment such as `o` must not
automatically outrank an already introduced `sync o...` continuation. Final input
removes the interim hold and lets root validation settle complete/invalid plans.

**Compatibility note:** the partial-token guard is implemented because the planned
grammar-switching solution is not yet in place. Experimental routing exists, but
the deferred custom native implementation has not been built. Review the guard
after switching is implemented; preserve root validity, consumed-span and ownership
invariants regardless. The user explicitly requested implementing the fix now,
with this note, rather than deferring the bug.

An invalid final continuation must consider both newly planned steps and the
root's already consumed but uncommitted steps. A shorter terminal match must not
settle that root and escape rollback simply because its opener left the live text.
This remains a root/executor responsibility, not a side effect of policy comparison.

## Evidence and remaining work

- `tests/owned-feedback-scope.mjs`: deferred/replaced feedback, stale cancellation
  and completion, cancellation during startup, errors, and owner isolation.
- `tests/speech-continuation-session.mjs`: retained collectors/deadlines through
  handoff, stale timer fencing, delayed final settlement, cancellation, branch policy.
- `tests/speech-command-digest.mjs`: partial `sync o` cannot toggle Sync or run Off;
  growing values and consumed-command ordering remain intact.
- `tests/app-state-transactions.mjs --speech-boundaries`: invalid final continuation
  rolls back its uncommitted Ready root, without undoing earlier independent roots.
- Existing handoff, delayed-final, Vosk context, and adaptive continuation tests
  exercise the adapters. Native microphone recognition is separate verification.

The active-trip Ready failure and live Speech Off recognition failure remain open
tasks. `--branch-boundaries --voice-feedback` is a local investigation fixture,
not a passing release gate while its active-trip Ready assertion remains unresolved.
Keep Version 2's required behavior separate from evidence of completed integration.

## Other extraction candidates (planned, not implemented here)

| Class | Responsibility | Existing component to retain |
| --- | --- | --- |
| AnnouncementScheduler | Global feedback ordering/priority and adapter execution | Announcement definitions, AudioEngine |
| ValueEntrySession | Typed draft, validation, confirm/cancel, return destination | Language parsers; keypad/voice-pad views |
| SurfaceNavigator | Dialog stack and expected/return transitions | FSM and ApplicationCoordinator |
| TripWorkflow | Draft, immediate/scheduled start, deferral, summary | ClockTimer and persistence |
| BreakWorkflow | Type, interval identity, confirmation/cancellation | ClockTimer interval model |
| LoginSession | ID/PIN/review/submission/retry, focus instructions | IdentityContext and server authentication |
| TripLogController | Range requests, stale-response cancellation, pinned/loading state | TripLog rendering and aggregates |

Extract a cohesive responsibility behind its current public behavior, add boundary
tests, then migrate callers. Avoid a class per function or a second application-wide
state machine that competes with the coordinator. `app.js` should progressively
become component construction and wiring.


## SpeechRejectionFeedback

This class adapts confirmed `speechAttemptRejected` events to a playback callback.
Construct with `{events, play, enabled, onError, rememberedRoots}`; call `dispose()`
to remove its listener. It remembers up to 256 logical roots by default and fences
repeated partial/final reports. Muted reports are consumed without replay on unmute.
The application adapter uses `playSemanticSong("speech-rejected")`, preserving the
existing audio settings. The song has no spoken announcement: a short downward
D-sharp-to-A bend with a quiet low supporting note, using the existing instrument.

The event contract is `{id, rootId, source:"recognition", confirmed:true, outcome,
reason, transcript}`. SpeechMenu owns semantic classification and root identity;
the playback class does not infer rejection from silence or backend errors.

| Outcome | Playback boundary |
| --- | --- |
| malformed | Once the owned section is definitively rejected |
| incomplete | Adaptive silence ends collection and final decoding confirms incompleteness |
| invalid-value | Final decoding rejects the collected value |
| unrecognized | Final decoding cannot resolve a command attempt |

Viable continuation, ignored noise/junk, success, cancellation, muting, hardware
errors and server/business failures are silent. Each rejected root can cue once;
earlier independent successful roots retain their effects. A final incomplete
longer command head retains ownership over a shorter pending split, while a fully
valid command can settle at silence. Thus incomplete `ready at` must not execute
bare `ready` and discard `at`.

Evidence: `tests/speech-rejection-feedback.mjs` verifies selection, deduplication,
mute/disposal and the approved song. `tests/app-state-transactions.mjs
--rejection-feedback --voice-feedback` exercises actual malformed input, silence
plus decoder final, invalid values, unknown commands and silent exclusions.
These are local automated checks; live microphone validation and deployment are separate.

## Tone-referenced Time readback

Implemented locally through `SpeechDurationEstimator` and `ToneReferencedAnnouncement`.
See [the complete Version 2 Time implementation contract](time-reference-v2.md) for
wording, projection math, speed/voice measurements, timing, retries, ownership,
settings, display limitations and executable verification. Neither this change
nor the rejection-cue class has been deployed yet.

Speech feedback adapters bind after `speech-runtime-ready` (or immediately when the runtime already exists). App startup must not read `SpeechMenu.events` before lazy loading finishes. Binding is idempotent so the same app cannot duplicate rejection listeners. The settings browser integration test covers cold app startup with this lazy runtime.
