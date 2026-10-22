# Version 2 speech recognition contract

Updated 16 October 2026. This is the implementation guide for the Version 2
replacement, alongside [command chains](speech-command-chains.md), the
[FSM reference](clock-timer-fsm.md), and [behavioral scenarios](fsm-v2-cases.json).
Requirements below are normative; the evidence section distinguishes tested
behavior from live reports and future architecture.

The [class contracts](class-architecture-v2.md) specify the extracted lifecycle,
branch-policy and feedback classes, their APIs, dependency order, ownership rules,
examples, tests, and remaining integration gaps.

## Separate capture, interpretation, effects, and display

An acoustic utterance identifies captured audio. A logical speech session owns
the recognized command chain and its continuations. A decoder segment is an
internal grammar/decoder boundary. A UI state or surface is an effect of the
workflow. These identities must not be treated as interchangeable.

Use this processing order: audio -> recognizer hypotheses -> root planner and
collectors -> serialized actions and transaction settlement -> presentation.
Recognition adapters supply text, finality, and identity; they do not execute
commands or decide business validity. UI rendering must not own collection.

## Root decisions and collection

Commands and contexts return `valid`, `incomplete`, `malformed`, or `defer`.
An outcome identifies its accepted span, normalized value if any, remainder,
and failure reason. A valid prefix may still be extendable. `defer` returns a
portion to the root for arbitration; it is not permission to execute the tail.

For `ready four twelve sync on`, the duration returns `0:04:12`, its accepted
span, and `sync on` as remainder. The root validates the next independent head.
Commands use the same arbitration contract as typed value contexts.

For `ready hundred seven seconds`, the malformed Ready section owns and
discards its remaining numeric text. Never recover `seven seconds` as a new
duration. Resume scanning only at an eligible independent literal command head.
Roll back dependent provisional effects while retaining earlier independent
commands that have already settled.

Collectors retain the longest valid value while allowing unconsumed text to be
revised. `twenty two fifty six` is one duration, `0:22:56`; `four twenty t` is an
unfinished time, not permission to commit `four twenty`. Language parsers and
classifiers belong in language packs, outside the generic session lifecycle.

## Generic continuation handoff across state changes

The logical session owns the consumed-span ledger, unconsumed transcript,
collector and normalized value, projected context/surface stack, cancellation
generation, pending effect queue, and silence deadline. A state change transfers
the destination context within that session. It must not restart interpretation
at the original command head or silently drop the collector.

The current branch expresses intended handoffs through `speech-chain-next`,
`speech-chain-context`, and `speech-chain-surface`. Version 2 may use typed FSM
transitions instead of DOM attributes, but must preserve the same ownership:

1. Before executing an opener, record its authorized destination and continuation.
2. Consume the opener exactly once and retain its immutable span in the ledger.
3. Allow the declared UI transition while retaining unconsumed text, collector,
   cancellation identity, and the existing silence deadline.
4. Derive both decoder grammar and execution candidates from that same owned
   continuation and current unconsumed transcript. An opener becoming unavailable
   after its own effect does not revoke the destination it has already opened.
5. Keep an incomplete next token in its current grammar. Grammar probes must be
   side-effect free and must not erase or mutate the live collector.
6. Recheck hard authorization and operation ownership before effects. Cancel an
   unexpected transition, revoked permission, replaced target, or failed action.
7. On completion, cancellation, malformed invalidation, or timeout, settle the
   owned transaction and release its collectors, projected state, and locks.

This applies to Ready -> duration, Break Start -> type -> OK, login ID -> PIN
-> review, scheduled-time workflows, and nested surfaces such as Log -> Close.
Each workflow must declare its valid continuation; do not preserve speech across
arbitrary unrelated state changes merely because recognition is still active.

The October 16 Ready failure demonstrates the rule: the editor opened and the
Mic Bar continued showing numbers, but the decoder context provider replanned the
consumed `ready` against changed UI availability and returned no grammar records.
The fix plans the remainder in the session's owned projected context instead.

## Silence and final decoding

Complete, incomplete, and malformed collections all have a bounded silence
settlement. Speech resumption before the deadline cancels it. Expected state
changes neither restart that deadline nor remove the continuation.

Use active-trip speaking/continuation pauses, a saved timing profile, and speech
settings. The existing implementation separates pause detection from extra
dispatch grace. Continuation observations are bounded to 220–900 ms; command
separation observations to 420–1800 ms. Speech velocity controls dispatch grace.
Preserve that adaptive policy rather than introducing another fixed 350 ms cap.

At silence expiry, stop capture for that acoustic utterance and request/drain
the recognizer final. Keep logical ownership until it arrives or a bounded
recognizer failure occurs. Never mark the last partial as final yourself: it may
omit `six` in `twenty two fifty six`, or the `ok` in a break-start chain.
Only then accept, reject, or discard the remaining section. A finalized value
does not manufacture an absent confirmation or start a trip by itself.

## Pruning and transaction boundaries

Remove consumed commands and discarded junk from the active Mic Bar text
immediately. Keep a separate consumed-span ledger so cumulative decoder results
cannot execute those words again. Accepted command spans are immutable; unrelated
noise may be revised. Do not remove repeated numeric words by text deduplication.

Serialize dependent effects under one root-owned operation. A completed terminal
command stream can settle while the acoustic utterance continues; following
independent commands get their own operation. Release only the locks owned by
the completing or failing operation. Failed or malformed dependents roll back
their uncommitted root, without undoing independently settled commands.

## Recognition adapter boundaries

The active UI/FSM context limits the initial command grammar. Projected contexts
limit subsequent command and value grammars. Grammar switches preserve utterance
identity, bounded PCM overlap, next-stage seed text, and ordered hypothesis
delivery. Fence late decoder callbacks by generation. Final decoding and ordinary
audio-endpoint results must remain distinguishable.

The current Vosk adapter expects 16 kHz audio. No sample-rate change was requested.
Custom native decoder switching remains deferred; this contract does not claim
that native in-place switching has been implemented. Joining separately ended
acoustic utterances into one logical session needs an explicit continuity rule;
do not concatenate unrelated utterances as a shortcut for UI handoff.

## Response display and feedback

Use one horizontal row of result columns, newest on the left. New results move
from the right underneath existing columns and dock at the leftmost position.
Each result remains until its own TTL, including across utterance boundaries.
At expiry move the whole chain right until the expired result is outside the
Mic Bar. Single-result output uses this same path. Retain per-result before/after
snapshots and code dictation; unrelated cleanup must not clear existing results.
The current default TTL is two seconds with configured persistent/manual options.

The active text shows only unconsumed speech. Internal `grammar-switch` notices
must not overwrite it. Keep diagnostics separate from user-facing output.
Microphone state feedback uses one deduplicated transition path for pointer,
voice, and remote actions, with the dedicated activation/deactivation chimes.

## Evidence and remaining verification

### Class extraction (local implementation, 16 October)

`SpeechContinuationSession.js` owns continuation phase, collectors, consumed spans,
expected transitions and silence scheduling. `SpeechCommandBranchPolicy.js` owns
plan preference. The reusable `OwnedFeedbackScope.js` owns deferred feedback and
playback leases. SpeechMenu delegates to these classes; language parsers, the FSM,
recognition adapters, and playback remain separate. Independent class tests and
integration regressions exercise this local implementation; it is not deployed.
The class guide records exact APIs, load order, and remaining adapter migration.

Additional user-confirmed rules for the class implementation:

- Any command with a viable continuation leading to a different state must stay
  pending until input resolves that branch or silence plus final decoding settles
  it. A shorter exact command must not execute before an unfinished longer head.
- Opening a window is a provisional effect, not the end of a collector. In
  `ready at five` -> scheduled dialog opens -> `thirty`, the logical session must
  retain the time collector and produce five thirty across that state change.
- Announcements declare a settlement boundary and an owner. Hold next-step prompts
  while collecting; cancel queued feedback and stop owned playback on resumed or
  superseding input. Accepted input can announce the next step. Malformed,
  incomplete, or invalid settlement selects correction feedback instead.
- Playback adapters must implement the stop/signal contract. The classes'
  feedback leases do not yet establish that all existing audio paths can stop
  active playback. Direct dialog prompts still need integration.

The shared branch-priority change has reproduced and prevented the incorrect
voice-pad opening on `ready a` before it grows into `ready at`. The current
`--branch-boundaries --voice-feedback` scenario still fails for interim Ready
during an active trip; its projected destination needs to follow the FSM state.
Speech Off succeeds with supplied text in that fixture; the live recognition
failure remains unverified. Do not mark either live report resolved prematurely.

The partial-token fix is implemented now as a compatibility guard because the
planned grammar-switching implementation is not yet in place. Reassess it when
switching is implemented, retaining regression coverage. Malformed final
continuations still invalidate already consumed but uncommitted root steps;
pruning must not let a shorter terminal command escape dependent rollback.

Further extraction candidates outside speech are AnnouncementScheduler (all input
methods), ValueEntrySession (voice/keypad views), TripWorkflow, BreakWorkflow,
LoginSession, SurfaceNavigator, and TripLogController. Reuse the existing
ApplicationCoordinator, ClockTimer, AccountSettings, and TripLog responsibilities.
Prioritize cohesive lifecycle/ownership boundaries over simply wrapping functions.

| Behavior | Current regression evidence |
| --- | --- |
| Growing values, root decisions, malformed discard, pruning | `tests/speech-command-digest.mjs`, `tests/speech-failfast.mjs`, `tests/app-state-transactions.mjs --speech-boundaries` |
| Final word and break OK delivered after silence | `tests/app-state-transactions.mjs --decoder-final-boundaries --voice-feedback` |
| Owned grammar through Ready and Break state changes | `tests/app-state-transactions.mjs --ready-handoff --voice-feedback` |
| Adaptive timing and resumed speech | `tests/adaptive-speech-timing.mjs`, `tests/app-state-transactions.mjs --voicepad-continuation` |
| Real interval actions and confirmations | `tests/app-state-transactions.mjs --interval-actions`, `--break-end-stream --voice-feedback` |
| Decoder staging, audio overlap, stale callbacks | `tests/vosk-grammar-router.mjs`, `tests/vosk-speechmenu-context.mjs` |
| Response columns, TTLs, diagnostic suppression | `tests/speech-response-chain.mjs`, `tests/speech-response-chain-browser.mjs` |
| Mic feedback | `tests/observer-microphone.mjs`, `tests/app-state-transactions.mjs --mic-feedback --voice-feedback` |

The tests use supplied hypotheses and mocked persistence; they do not establish
physical microphone decoding accuracy or audible output quality. The handoff
regression must check decoder grammar as well as the final UI value: parser-only
tests passed while the reported live Ready path was broken. Version 2 must add
equivalent public-input coverage for every declared continuation transition,
including delayed rendering, revisions, permission loss, cancellation, unrelated
modal changes, final-decode delay, and zero writes before required confirmation.


## Modal controls and typed value ownership

See [Modal interaction and viewport ownership](modal-interaction-v2.md) for the
implemented SharedModal/SharedModalHost classes, viewport ownership, input-session
transfer and announcement completion ordering. Every open registered dialog and
the persistent microphone belong to one interactive region; the background is inert.

Typed value commands pass the captured value directly to their action. The
voice editor must not depend solely on a temporary global recognizer execution
context that may have unwound before a queued action runs. Non-value commands
retain their explicit transcript routing. Duration entry does not start a trip;
the separate OK confirmation still owns validation and persistence.

Mic off preserves the current value-entry session while switching Voicepad to
numberpad. Mic on offers “Switch to voice input?”; its announcement waits for the
mic chime and announcement to finish. Spoken Sleep uses its own command queue.
Discarded spans count as consumed display input, so a revised ASR hypothesis
cannot paint that rejected noise again. Result columns keep their independent
TTLs throughout these operations.

The unwanted command aliases and direct starts removed on October 16, 2026 must
remain absent from decoder vocabulary and Commands: rudy/rudd/ruddy, sin/sink on/off,
sin/sink/sync status, castle, start break, start lunch and start short break.
The retained break-start route is `break start` followed by a type and OK.

## Time readback and reference cue

See [Time implementation contract](time-reference-v2.md) for the local class-based
implementation: duration-only speech, effective voice/speed estimation, real speech
completion, a scheduled D5 reference cue, retries/cancellation and test evidence.

## Login confirmation and initial Ready

ID entry still needs four digits plus OK. Four PIN digits plus one OK now
authenticates once; the separate PIN readback/review confirmation is removed.
Failure retains the ID, clears the PIN and focuses its first slot. Keyboard
Return, mobile Return and button OK follow the same path. Decoder partial
repetition must not submit twice.

`--post-login-ready --voice-feedback` covers the first Ready with no active trip
and repeats it between trips. It delivers partials, silence and delayed decoder
finals through the recognizer callback, then speaks a separate duration. Ready
must settle with zero pending transactions/locks while leaving Voicepad open.
Duration entry alone must not start a trip. These supplied-hypothesis tests do
not establish that the reported physical Android lockout has been eliminated.

## Mute/wake decoder lifecycle

Hotword refresh is an optional backend capability. Vosk uses its finite grammar
context provider and has no `setHotwords` method; command registration must not
throw when that method is absent. Tests must include the real adapter shape,
not just a mock that supplies methods absent from production.

A pointer/remote wake retires an idle capture that may have been created with a
wake-only grammar, clears pre-roll and resets VAD. The next voiced frame builds
a new utterance using current UI commands. An owned command continuation and
spoken Wake keep their command queue. A suspended/interrupted AudioContext is
resumed before announcing the unmuted state. This preserves editor session data.
`--mic-wake-grammar --voice-feedback` uses the actual Vosk adapter with a controlled
decoder to check three mute/wake cycles and the resulting phrase lists. Physical
Android audio capture remains a live verification step.

## Browser silence timer regression and deferred presentation

The TG01JO console report showed repeated `Illegal invocation` exceptions from
`SpeechContinuationSession.armSilence`. Native Window timers had been stored as
private instance fields and invoked with the session as their receiver. Node and
injected-timer tests did not expose the browser receiver requirement. Default
scheduler/canceller adapters now call `globalThis.setTimeout/clearTimeout` through
closures. Injected schedulers remain supported. Real browser coverage reproduces
the old exception and checks arm/cancel/rearm and settlement after the fix.

A failed silence callback leaves a root collecting, preventing final recognition
and transaction settlement. This accounts for the common Ready/Down/Break Start
Applying pattern and accumulated transcript junk. Browser integration now also
settles initial Ready using the actual native silence timer and delayed final.
Physical Android confirmation remains separate from supplied-hypothesis evidence.

Action results may return a deferred `speechResponse` promise. Logical command
completion never waits for optional presentation; only response rendering awaits
it. An invalidated response resolves undefined and cancels its pending presentation.
Time uses this protocol so queued audio cannot hold a recognition root open.

Announcement layers come from the catalog definition. A summary-only definition
cannot implicitly enable a chime layer or fall back to an invented same-named
song. This prevents the separate `Unknown song: sync-state` console error.


## State-dependent command transitions (Ready ending a trip)

A command's predicted continuation must follow the same state branch as its
execution. Ready opens Voicepad when no trip is running, but ends a running
trip and opens its summary. Projecting Voicepad unconditionally caused the
summary to be classified as an unexpected modal and cancelled/rolled back the
command. Direct-final transcript tests missed this; interim Ready followed by
silence reproduces the cancellation.

`speech-chain-transition="WMOFSpeechTransitions.ready"` names a synchronous,
side-effect-free provider returning `{surface, context}`. SpeechMenu resolves
it during planning, before execution changes state, and stores that projection
on the step. The provider overrides both static `speech-chain-surface` and
`speech-chain-next` defaults, including clearing a context by omitting it.
Missing, invalid or throwing providers reject that plan; static contracts keep
their existing behavior when no provider is declared. The Vosk context provider
uses the same planner, so grammar and execution share the branch decision.

Keep state-specific decisions in the application's transition provider; the
recognizer must not special-case Ready. Preserve the unexpected-modal guard
for unrelated windows. Tests cover partial Ready, silence and delayed finals
for first Ready after login, ending a running trip, and Ready after its summary.
The native mobile browser test starts a trip with voice, ends it through the
silence boundary, and checks the summary opens with no pending locks/transactions.


## English number interpretation and readback inherited from Sherpa

Preserve the Sherpa contracts recorded in commits 6185ac55 (grouped duration
input), 86d64e07 (shared Formal Time output), 6a3a27c4/d6c08ca1 (positional
readback and zero fields), and e107d299 (hour/minute conjunction). These are
language rules, independent of acoustic backend or decoder grammar stages.

- Unitless numeric groups are positional: two groups are minutes/seconds;
  three groups are hours/minutes/seconds. Individual spoken digits retain
  keypad semantics, anchored from seconds at the right.
- An explicit first unit establishes the position of following omitted units:
  an hour and five is 1:05:00; an hour one and twelve is 1:01:12;
  twenty-three minutes and twenty-four is 0:23:24. Explicit seconds remain
  seconds: an hour twelve seconds is 1:00:12. Preserve zero-thirty and the
  other documented parser exceptions; do not reinterpret them in the decoder.
- Formal Time controls output, not accepted input. Informal readback includes
  twenty-two seventeen (0:22:17), twenty-two oh six (0:22:06),
  one oh one oh six (1:01:06), an hour and five (1:05:00), and
  an hour twenty (1:20:00). Formal output states the units with agreement,
  e.g. twenty-two minutes and seventeen seconds. Voicepad, Standard Time and
  informational readbacks share the formatter. The current parser matches
  the Sherpa branch; vocabulary generation must preserve all supported forms.

Vosk replay ownership: decoder endpoint accumulation contains only decoder-local
text. Merge the carried next-stage seed for published transcripts, keeping it
separate from raw endpoints; otherwise a short replay endpoint followed by its
continuation can turn twenty two seventeen into twenty two twenty two seventeen.
A shorter replay prefix must not append itself to a longer carried prefix. Do
not globally deduplicate numeric words: repeated digits and three-group durations
remain legitimate. tests/vosk-grammar-router.mjs covers split replay endpoints,
article/hour continuation and genuinely repeated speech. These deterministic
tests verify adapter behavior; they do not substitute for acoustic/device tests.


## Sync availability feedback

Do not confuse a valid empty aggregate with unavailable totals. Zero completed
trips in the selected scope are usable: Sync then computes the active trip goal
from the total goal alone. Unknown totals must never be treated as zero.
For an online active trip, data-unavailable and time-blocked both show the
existing red X, with distinct announcement, tooltip and accessible label:
Cannot sync: trip totals are unavailable / Not enough time to sync.
Offline retains the existing cloud badge and Cannot sync offline message.
Turning Sync off retains its neutral slash. Restoring usable totals clears
the unavailable state and announces the calculable goal.
The sync-availability app test covers zero history, unavailable data, recovery,
impossible targets and offline state; it runs independently of command tests.


## Sleeping microphone: voice policy versus pointer access

Sleeping recognition accepts only the configured Wake command and its aliases.
Use one runtime policy at candidate selection, projected-context planning,
optimistic state-command attempts, cached decoder vocabulary and immediately
before speech dispatch. Cached awake commands and primed contexts cannot
override sleep. Recheck after asynchronous preprocessing/surface hooks so an
attempt prepared while awake cannot execute after the user puts the mic to sleep.

This restriction is for voice execution. The Commands list remains manually
accessible by pointer/touch at any time, including while sleeping; opening it
manually must not wake recognition or authorize spoken Commands. After Wake,
normal spoken commands become available again. Tests: --sleep-wake-only checks
cached/fresh grammar, rejected normal commands, unchanged server writes and voice
wake; mic-modal-browser.cjs verifies a real touch opens the list during sleep,
spoken Commands cannot open it, and spoken Wake restores voice access.


## Application mode and between-trip entry

Application mode is separate from recognition mode and Trip/Total/Auto. The
current Order Filler template explicitly sets `app-mode="debug"`; missing or
unknown values do not choose a default. `ApplicationMode` in `app.js` owns the
immutable `manualStandardTimeEntry` and `serverTripAssignment` capabilities;
`WMOFInteractionState.state.appMode` exposes the selected mode. Production and Simulation are
reserved modes and cannot yet be activated by this entry point. Simulation
behavior is unspecified and must not inherit assumed Debug/Production semantics.

Debug summary OK opens manual standard-time entry: Voicepad for a spoken OK when
available, Numberpad for a button press even when the microphone is listening.
Cancel dismisses without starting entry. The summary is retained between trips;
it does not use the transient notification timeout. Future assignment hints are
ignored in Debug. An actual unfinished Debug trip can still be restored normally.
Production will obtain the next trip and standard time from the server; it must
not fall back to Debug entry when an assignment is missing. Those future paths
are explicitly not implemented or claimed as passing mode-specific coverage.

The combined-state contract in `docs/order-filler-state-contract.json` separates
**transitional announcements** from **user-activated announcements**. A voice
command that changes state still produces transitional feedback; an explicit Time
or Trip Summary request produces user-activated feedback. Both retain ownership,
completion, continuation and stale-cancellation rules.


## State mapping and the future test branch

The current [state inventory](application-state-inventory.html) enumerates shared
behavioral regions, modal lifecycles and explicitly Debug-only manual trip-entry
workflows. Its JSON source is `application-state-inventory.json`. App-mode is
execution-policy metadata, not a duplicate set of running/overtime/input states.
Server-assigned trips are excluded from this mapping; future mode transitions
are not being designed here.

Keep debugging on the existing branch. After Debug is stable, create the
`test` branch for runtime enumeration/FSM changes. The map records the owner,
focus, collector, validity, operation and audio dimensions that replacement must
expose, including current observability gaps. It does not replace runtime logic
or equate the existing 39 transition tests with a complete state enumeration.


## Open investigation: unexpected wake and replay duplication

Live report: saying “microphone” while sleeping wakes recognition. The deployed
English `system:wake` pattern is `^wake$`, and no built-in microphone alias was
found. Vocabulary/decoder-phrase and sleeping-runtime regression checks now
explicitly reject the literal transcript “microphone”; these pass locally.
This does not prove the acoustic decoder cannot misrecognize it as “wake”.
`SpeechEditorRuntime.js` also loads `api/speech-editor-config/`, whose saved
entries can replace an existing command's pattern. No local
`database/speech-editor.json` exists. An authorized live GET using the
`access_token` query parameter returned zero saved entries and no matching macros,
ruling out a saved server-side microphone alias at the time of inspection.
Do not claim an alias was found or removed. The Mic Bar's diagnostic status
`grammar-omissions` was masking useful text; locally it now stays out of the
transcript display like `grammar-switch`. This display correction does not
resolve the unexpected acoustic wake or implement timestamp splicing.

At the user's request, the Vosk adapter now adds `microphone` as a recognition-only
dummy in command grammars, including the sleeping Wake grammar. It has no
SpeechMenu action or routing record, does not wake/sleep/toggle the mic, and is
absent from the Commands list. Root command parsing discards it as unmatched
speech. Time/duration/digit collector grammars are unchanged. Keep decoder
vocabulary separate from actionable commands in Version 2. Adapter tests prove
the word is offered to the decoder and remains literal; they do not prove an
acoustic false-wake has been cured. Live verification is still required.

A separate continuing report concerns overlapping decoder results. Current
`VoskRecognizer.#mergeSeed` performs lexical suffix/prefix merging. The adapter
enables word timing with `setWords(true)` but does not use timing records when
merging. Proposed next design (not implemented): an AudioTranscriptTimeline
class with an utterance-relative PCM sample clock; each replacement decoder
records the exact global sample offset of replay's first sample. Convert local
word times onto that clock, reconcile words describing the same audio interval,
preserve identical words at separate intervals, and fence stale generations.
Boundary words need timing tolerance and an explicit ownership rule. Sample
positions are exact; ASR word boundaries remain estimates. Final word timing is
available, but the current browser wrapper exposes text-only partials, so live
switches require exposing partial-word timing or a documented provisional path
that cannot commit replayed text twice. Avoid promising timestamps alone cure
acoustic recognition errors or two independently captured microphone streams.

## Goal commands, dependent feedback and login startup

English goal commands now use a readback head with an optional percentage:
`trip goal [<percent> [percent]]`, and
`day|week|money|month|year goal [<percent> [percent]]`.
Bare heads read back; extensions set. The spoken `total goal` command is removed.
The percentage-first form remains available for named scopes and Trip. Internal
`total` model fields still represent the selected aggregate; this does not add
separate persisted goal percentages for every range.

A scoped command selects its aggregate range before applying the percentage and
waits for that range's totals. Auto stays Auto; Sync stays enabled if already on.
Existing ClockTimer algorithms own recalculation. These changes do not introduce
a second goal calculator. A partial `trip goal` must wait for a continuation or
the normal silence/final boundary before readback. Partial numeric extensions
must not set an intermediate goal.

Value-first commands require support at all three layers: transcript pruning
preserves declared typed starts; Vosk offers the following literal suffix and
routes the typed prefix; the planner treats a fully valid typed value plus an
explicit suffix as anchored. Otherwise a trailing `trip`/`week` mode command can
steal the value. Atomic ID/PIN confirmation grammars retain their stricter routing.

`GoalChangeAnnouncement` (app-scoped in `app.js`) snapshots the prior scope and
goals. Its `run` method suppresses intermediate Sync responses, then restores the
Sync feedback baseline even on failure. Its `message` method compares settled
values and produces one response, for example:
`Week goal set to 105 percent. Auto goal recalculated. New trip goal 112 percent.`
Outside Auto, a Sync-caused change uses `Sync value changed.` instead. A dependent
Trip sentence is omitted when the displayed Trip goal did not change. Version 2
should inject model snapshots and language formatting into this policy class and
retain a single operation owner for asynchronous totals and feedback.

`GoalFailureAnnouncementBatch` owns one trip's pending/playing failure period. It
deduplicates goals, retains the latest fallback, and captures mode/scope. Speech
is built at its actual playback boundary, allowing failures arriving in the
queue or during the chime to consolidate as `Trip and total goal failed.` The
period plays one failure chime. If another goal fails after speech has already
started, announce only the newly failed goal without another chime; spoken audio
cannot be retroactively combined. A replacement trip invalidates stale output.
Summary/details enablement and existing fallback/overtime details remain in force.

The initial voice-login prompt must follow dialog lifecycle, not successful
focus of the first digit field. `opened` queues the empty-stage prompt even if
mobile focus is elsewhere. Startup speech and model readiness gate its release;
the model-start path also respects completion of microphone activation feedback.
Explicit later digit-focus prompts retain their focus checks.

Regression coverage: `tests/goal-feedback.mjs`,
`tests/app-state-transactions.mjs --range-permissions`,
`--goal-cascade --voice-feedback`, `--goal-failure-batch --voice-feedback`,
`--startup-speech --startup-no-focus --voice-feedback`,
`--voice-code-adapter`, and `tests/vosk-speechmenu-context.mjs`.

### Break session ownership

Break commands use `BreakSessionPolicy` and `ClockTimer.getBreakTransitionState()`;
see `clock-timer-fsm.md` for lifecycle/persistence details. `break start` can open
the existing selector while idle and create a standalone break-only owner without standard time or production classification.
It remains in applicable Trip Log lists and is excluded from every aggregate.
`break end` keeps its existing confirmation and stale-interval identity checks;
ending that standalone interval also ends its owner, without a productive summary.
A break-only owner never exposes Down to speech, even after its end buffer.
For an overdue regular break, `down`/`down time` and the new button call the same
`startDownTime` operation and backdate to the original buffered end. Availability
must follow model policy across grammar refreshes, not button visibility. Keep
intermediate trip-resumed announcements suppressed during this handoff.


### Web Speech experiment: shared alternative selection

The `web-speech-experiment` Order Filler page uses browser SpeechRecognition,
without loading the Vosk recognizer or its model. The adapter requests multiple
transcripts with one shared `maxAlternatives` limit (default 10, adjustable with
`?speech-alternatives=10`). The browser may return fewer than requested.

The shared command planner examines the returned hypotheses in rank order and
selects a valid interpretation for the current application state. For example,
returned `sink on`, `sync on`, `sink gone` can select `sync on` when available.
This does not register `sink on` as an alias. Probing does not execute commands;
normal command dispatch still validates the selected transcript. Sleeping does
not search lower-ranked hypotheses for a wake command.

There are no per-command alternative limits: `speech-max-alternatives` and
`commandAlternatives` are not used. One shared limit applies to all commands.
The adapter preserves interim revisions and consumes native final result slots once.
A native final slot does not settle an open logical value; see the shared value
collection contract below.
`tests/web-speech-recognizer.mjs` and `tests/web-speech-command-selection.mjs`
verify these contracts using simulated browser results; they do not establish
real acoustic recognition accuracy. Browser recognition may use a remote speech
service. This adapter uses browser-owned microphone capture, not Vosk PCM input.


Fully formed Web Speech commands with no possible continuations execute from
interim results. Commands with viable continuations keep collecting. Each
utterance owns `dispatchedCommandIds`, a set that reserves an unscoped
identity before queuing and a scoped identity immediately before dispatch. It uses `data-speech-editor-id`, the element ID, or a
stable runtime ID for an anonymous command. Later interim revisions and final
results cannot dispatch an ID in that set again, even with different wording.
The set survives command-stream settlement and state transfers, and resets only
with a new utterance. Other command IDs can execute in that same utterance.


### Optional command execution context

Every command has an execution context, defaulting to `null`. The shared interim
duplicate guard remains active; its identity is the command ID together with the
resolved execution context. Reworded partials and final confirmation cannot
redispatch that identity within an utterance. A different execution context can
legitimately reuse the same command ID in that utterance.

Declare `speech-execution-context="scheduled-start-time"` for a literal label,
or name a provider such as `WMOFSpeechExecutionContexts.login`. A provider returns
`null`, a string, or a flat object of named string/null labels, for example
`{valueType: "percent", scope: "day"}`. Object keys are canonicalized and the
captured object is frozen. Providers receive the command element, matched
transcript, and prepared argument list. Context labels should describe purpose
or target, without including credential values or transient loading states.

The context is captured immediately before dispatch, after preceding asynchronous
actions settle, so ID-to-PIN state changes are visible even when both commands
arrive in one recognition result. The guard reserves the identity before calling
the action. Commands with no context retain their existing immediate reservation.
`SpeechMenu.executionContext.commandContext` and the `executionContext` field on
`speechCommandDispatched`, `speechCommandExecuted`, and `speechCommandRejected`
events retain the captured context for inspection and testing.

Voice login binds the shared digit/confirmation commands to `id` and `pin`.
Other suggested contexts are examples, not globally assigned classifications.
An atomic input's declared complete pattern establishes its terminal boundary
without any Vosk finite-phrase compiler. The Web Speech login browser regression
covers cumulative and back-to-back interims, single and separate finals, formatted
numeric codes, exact-once authentication, and absence of stranded locks.


### Login boundaries, command handoff, and matched transcript lifetime

Voice login accepts ID + OK followed by PIN + OK, including cumulative interim
revisions and separate final result slots. It also accepts eight sequential
digits (first four ID, last four PIN), with an optional final OK. The combined
command has execution context `credentials`; it reuses existing ID-entry,
PIN-entry, submitting, and closed states rather than introducing parallel states.

`speech-dispatch-boundary` is a generic command attribute for transitions whose
next command inventory cannot be projected safely. The planner consumes that
command, retains the suffix, settles its action and transaction, then replans the
suffix against authoritative surface and availability state. Login completion
awaits its owned dialog-close completion, including its animation; authentication
success alone does not release the continuation. Failure leaves the login surface
in control and cannot authorize the suffix. No particular Sync, goal, or Ready
sequence is special-cased. `tests/web-speech-login-browser.cjs` checks these flows
against the existing FSM families, exact-once dispatch, and lock settlement.

Consumed text is pruned from processing immediately, but the latest matched
transcript remains visible in the Mic Bar after interim dispatch and final
confirmation. Its default lifetime is 2,000 ms. A command's
`speech-transcript-timeout` overrides its `speech-response-timeout`, then the bar's
`speech-transcript-timeout`, then the default. Numeric milliseconds, `ms`, and `s`
are accepted; `persistent`, `manual`, and `none` retain until replaced or cleared.
Unfinished selected text can occupy the display while collection continues.
Response result columns have independent TTLs. Transcript expiry does not
redispatch commands or change listening state. Disconnect and explicit clear
cancel retention. `tests/speech-response-chain.mjs` covers this behavior.

Goal setting in en-US supports scope before or after the value, with optional
`goal` and `percent`: `day 105`, `day goal 105 percent`, `105 day`, and
`105 percent day goal`. Scopes are trip, day, week, money, month, and year.
A scope without a value or `goal` remains a mode command; `day goal` remains
readback. Existing percent preprocessing and setters own validation, range
selection, Auto retention, Sync recalculation, and announcements. The
`--range-permissions` app integration test covers all 48 setting combinations.


### en-US preprocessor audit on the Web Speech branch

The rendered startup inventory binds 14 elements to one preprocessor function:
`WMOFSpeechProcessing.normalizeSpeechValue`. Six use clock values, five percent,
and three duration. These are startup bindings; editor context can change with
its input mode. The function extracts the named regex field, delegates to
`EnglishSpeechValuePreprocessor`, and replaces only that field. It also rejects
invalid provisional values. Dropping it would remove application-level validation
and canonicalization, even when recognition already supplies numeric text.

| Layer | Finding | Recommendation |
| --- | --- | --- |
| Clock parsing | `3:40` and `15:40` are already supported; invalid `25:90` is rejected; spoken fallback still accepts `twenty till four`. | Keep validation, meridiem/day handling, and date selection. Review spoken-form coverage against actual browser output. |
| Duration parsing | `22:17` becomes `0:22:17`; `an hour and five` becomes `1:05:00`; compact `105` is `0:01:05`. | Keep: browser text does not define the application's duration/keypad semantics. |
| Percent parsing | `105%` and `one hundred five` both become `105`. | Keep numeric/unit validation; spoken fallback may be reduced only with browser evidence. |
| Collector classification | `valid`, `incomplete`, `malformed`, and `defer` govern continuations. | Keep independently of the recognition backend. |
| Recognition repairs | `tutu` is rewritten to 22 in all three parsers; duration also accepts `to`/`too` as two. | Candidates for isolation or removal on this branch, not essential numeric parsing. No removal made in this audit. |
| Language definitions | Six preprocessor records describe three distinct handler/context/field combinations. | Metadata deduplication candidate; consolidate references deliberately without removing the shared function. |

`tests/speech-value-preprocessor.mjs` passes. Direct probes confirm the numeric,
spoken, and invalid-value examples above. These probes assess parser behavior,
not which transcript a real browser will return. The complete rendered attribute
snapshot is `order-filler-speech-attributes-en-us.html` and its accompanying JSON.


### Browser capture recovery contract for V2

`BrowserSpeechSession` (in `WebSpeechRecognizer.js`) owns native capture lifecycle;
`WebSpeechRecognizer` owns transcript snapshots, selection, and utterance finals;
SpeechMenu owns command validity, state transitions, and effects. Recovering the
microphone must never replay a command or bypass a state gate. Browser service
start and actual audio capture are separate facts. `captureListening` is true
only for an active service with capture evidence; `onaudiostart` or a current
recognition result supplies that evidence. A service start by itself is insufficient.

The session handles native `start`, `audiostart`, `audioend`, speech activity,
results, errors, and end. Each attempt creates a fresh native recognizer and
installs callbacks tied to that exact instance. Detachment clears callbacks and
aborts the old instance, so late events cannot restart or feed a replacement.
Configuration (locale, alternatives, interim/continuous mode, local-processing
preference) is reapplied on every attempt.

Recovery policy:

- `network`, unexpected `aborted`, `audio-capture`, and `no-speech` recover.
  An ordinary end also schedules a new session.
- An audio-end event immediately clears capture readiness. If no end arrives,
  wait for recognition to drain; capture ending does not end recognition.
  A 10,000 ms watchdog bounds missing results/end. Once a final result has
  arrived, a 1,000 ms missing-end guard can safely restart the session.
- Every native start, including restarts, has a 10,000 ms capture-start watchdog.
  Missing audio after a service start therefore cannot strand the adapter.
- Restart backoff begins at 300 ms, doubles to a 5,000 ms ceiling, and stops
  after six unsuccessful/unstable recovery attempts. A usable result or five
  seconds of stable capture resets the failure count. No-speech is a normal
  inactivity boundary rather than an accumulated service failure.
- A missing final after an explicit finish has a 10,000 ms deadline; it settles
  the old utterance and recovers capture. Alternative selection has a 10,000 ms
  deadline so a stuck planner promise cannot permanently block the result queue.
- Permission/service denial, unsupported configuration, and exhausted recovery
  are fatal and visible. They do not loop permission requests. An explicit user
  restart is needed after those failures.
- Foreground return and persisted-page restoration replace potentially interrupted
  sessions. An online event retries a session that is not listening. These hooks
  are removed on close, and deliberate microphone off cancels all recovery timers.

The Mic Bar maps native startup/recovery to localized starting/reconnecting text;
raw transport labels are not transcripts. Wake/sleep and announcement suspension
remain separate states. Neither unmute nor announcement completion can paint
Listening while capture is unavailable. The application maps recovery to its
existing starting state, preserving the existing shared FSM vocabulary. Recovery
status is not proof of successful recognition of a particular spoken command.

`tests/web-speech-recovery.mjs` uses virtual time and injected failures to check
capture evidence, retries, missing end/final callbacks, restart watchdogs, stale
callbacks, permissions, retry exhaustion, foreground restoration, deliberate off,
and stuck selection. Browser integration checks verify the Mic Bar and successful
command dispatch after recovery, including interruption during the initial login
prompt. These are deterministic lifecycle tests, not acoustic accuracy evidence.
The user's exact intermittent trigger remains unconfirmed; permanent closure on
transient errors and absent restart watchdogs were independently found in code.


### Matched browser transcripts and latency diagnosis

The Mic Bar subscribes to `speechTranscriptScoped` for the Web Speech backend.
Only a hypothesis already accepted by the command selector takes this path.
Display it immediately, before later live-planning and UI/transaction barriers;
keep the existing transcript timeout (two seconds by default). Command digestion
applies any command-specific timeout override. Raw rejected alternatives remain
out of the Mic Bar. Tests must inspect its visible `#activity` region: `#codes`
is a separate argument display and is not evidence that a transcript was visible.

Browser result timing is separate from command/announcement completion. The
adapter emits `resultTiming`, forwarded as `speechBrowserResultTiming`, with the
native callback receipt timestamp, queue wait, selector time, and acceptance flag.
Speech Diagnostics retains these values in its exported rows. These measurements
contain no extra transcript or credentials. They distinguish app-side backlog
from delays before the browser delivers text. No server upload is added. Android
may deliver a different sequence of interim/final callbacks than the deterministic
test double; passing simulated login tests does not establish device latency.

The shared percent row owns four grid tracks. Its Sync button remains positioned
relative so layered arrows, pause/cloud/X overlays stay local to the fixed 40px
button. Hidden Sync retains its exit animation while its track collapses to zero;
text fitting uses the destination dimensions so animation cannot chase intermediate
measurements. Grid, font-size, and icon transitions respect reduced motion.

Already captured results keep their command eligibility while the adapter selects
and delivers them, even if the browser has just ended capture. The adapter owns a
scoped `processingResult` flag; SpeechMenu exposes it as `processingCapturedSpeech`.
The application uses it only to admit pending captured input during recovery.
Capture status remains separate: the Mic Bar can be reconnecting while retaining
validated text until its normal TTL. A final-result-then-native-end login test
protects this ordering. Deliberate off, sleep, and authorization gates still apply.


### Capture completion is not recognition completion

`audioend` means capture stopped; it is not a failure or proof that the final
transcript has arrived. See the [Web Speech event contract](https://webaudio.github.io/web-speech-api/#speechreco-events).
The previous one-second audio-end watchdog could abort a valid remote result
before delivery. A regression now delivers a final after 1.5 seconds and requires
that it is processed exactly once, with capture still reported inactive.

The native-session owner exposes a separate processing/draining phase. Normal
`audioend` displays Processing, preserves its callbacks for the bounded final-result
wait, and waits for `end` to restart. A delayed result does not claim capture has
resumed. Normal `end`, no-speech completion, and a missing end after a delivered
final use a clean restart without consuming the transient-error retry budget.
Only actual failures or expired progress watchdogs enter Reconnecting. Tests also
cycle twelve short normal sessions to verify they cannot exhaust error retries.

For shared percentage presentation, actual and goal always occupy equal-width
tracks, even when their text lengths differ. Each uses its own font-fit scale.
Sync remains fixed-size in its separate track, which collapses when hidden.


### Shared validated command buffer

See [ValidatedCommandBuffer](class-architecture-v2.md#validatedcommandbuffer--accepted-work-independent-of-capture).
Capture session identity no longer owns the execution queue or accepted Mic Bar
text. SpeechMenu publishes buffer snapshots; the Mic Bar renders the same ordered
components being executed. Restarting capture can accept new components while an
earlier command is pending. Keep per-command execution-context deduplication,
owned malformed-root cancellation, and transactional authorization.

### Interim and final dispatch share the same reservation

Reserve each command ID plus its resolved execution context before invocation,
regardless of whether the first accepted component is interim or final. A final
result confirms earlier interim work; repeated finals and late interims must also
be unable to replay a final-first command. The reservation belongs to the logical
utterance and is not cleared when an action completes or opens a new surface.
Distinct contexts such as login ID and PIN remain distinct dispatch identities.

Before enqueueing an interim component, keep any viable longer command or growing
value pending. A complete terminal command, an explicit next-command boundary, or
the established logical final/silence boundary can release it. A native final
slot alone is not that boundary for an open value. Do not use the buffer or
Mic Bar text to infer execution eligibility.

`tests/web-speech-command-selection.mjs` covers final-first replay protection and
a short command with a longer continuation. `tests/web-speech-login-browser.cjs`
observes Mic Bar display mutations during repeated cumulative login results,
including distinct and identical ID/PIN values, and asserts once-only dispatch.
These simulated cases do not establish the cause of a physical Android transcript
repetition; compare validated components and dispatch identities when diagnosing
that device behavior.

## Shared value collection across contexts and capture sessions

Use `SpeechValueCollector` for source identity, revision replacement, accumulation,
classification, and once-only completion. Keep language rules in the shared duration,
clock, and percentage parsers. Digit and future date/option strategies use their own
completion rules through the same lifecycle, rather than pad-specific fragment
assembly. The implementation contract and required regression matrix are in
[class-architecture-v2.md](class-architecture-v2.md#speechvaluecollector-shared-value-lifecycle).

There are three distinct boundaries:

1. Native segment finality: stable words for one browser result slot.
2. Capture completion: microphone/session ends; recognition may restart.
3. Logical value completion: confirmation, a valid following command, or adaptive
   silence closes the accumulated value and allows dispatch.

For example, final `an hour` followed by final `and five` must produce one logical
`an hour and five` and one `1:05:00` value. Final `ready at five` followed by final
`thirty` must produce a single `5:30` scheduled-start value. Do not interpret the
second segment using the pad's already-updated value, and do not drop earlier
segments simply because capture restarts.

SpeechMenu marks selected, extensible values with `collectingValue`; registered
classifiers may also retain incomplete value vocabulary. The browser adapter emits
these as logical interim transcripts, with `segmentFinal` identifying native
finality. An owned child continuation deadline settles the value after the existing
adaptive silence interval. Command-probe cancellation must not erase this deadline.
A replayed native final slot has no new pending words and cannot reset its timer.
If capture ends after a selected interim without a final slot, seal that closed
capture span, preserve it through restart, and revalidate it at the logical boundary.
Sealing does not claim native finality.
The pure grammar collector also uses `SpeechValueCollector` classification state;
its speculative probes cannot mutate the live source collection.

Existing pads receive settled values through the command queue. This change does
not introduce a second duration/time parser or move business effects into the
recognizer. Malformed logical finals still use the common rejection path; stop and
parent cancellation discard open values and fence late callbacks.


## Vosk return: one decoder with shared collectors (22 October 2026)

This supersedes the grammar-switching and parallel-grammar experiment described above. Keep the current application/UI baseline; changing the recognition backend must not restore an older copy of Mic Bar, dialogs, trip log, diagnostics, sync presentation or layout.

The Vosk path now uses the model's complete vocabulary: instantiate `KaldiRecognizer(sampleRate)` without a grammar argument. Do not call the phrase compiler, context router, parallel search factory, grammar replacement, overlap replay or waveform merge code. Feed each worklet PCM block to one decoder once. Ordinary utterance finalization may dispose a decoder; it does not close the microphone stream. Capture remains owned by SpeechMenu until mic-off/stop (or an actual capture failure).

`SpeechValueCollector`, owned by `SpeechContinuationSession`, stores decoder spans. A decoder `result` freezes that span and opens the next span; `partialresult` replaces only the current mutable span. Native endpoints are emitted as `segmentFinal`, with `isFinal: false`. Only the application's silence/explicit boundary requests the logical final result. Thus an endpoint after "an hour" can continue as "and five" without applying an hour and then replacing it with five minutes. Identical text in distinct spans remains valid; never remove words merely because they match an earlier span. No timestamp/audio splice is needed because there are no competing/replayed audio streams.

The existing shared planner still owns command matching, malformed/incomplete handling, expected UI transitions, adaptive silence, execution contexts and interim/final dispatch deduplication. `ValidatedCommandBuffer` owns accepted work and its display lifetime. Mic Bar renders that buffer, rather than decoder hypotheses; lifecycle/status events cannot erase still-visible accepted commands. Reconnecting Mic Bar hydrates the current buffer snapshot. This is separate from the removed audio replay buffer.

Digit-count constraints are independent of numeric value validity: ID and PIN remain exactly four digits, combined credentials eight; raw duration digits allow one to six and hour/minute clock digits one to four. Existing seconds-capable clock parsing and formatted values remain supported. Midnight/leading zeroes can be valid; whether zero duration can start a trip is a business rule, not a digit-count rule.

Vosk is the default backend for this release. `?speech-backend=web-speech` selects the browser-service comparison path; `?speech-backend=vosk` explicitly selects Vosk. The current pinned browser wrapper does not expose Vosk's core `SetMaxAlternatives`; this port uses its single partial/completed hypothesis. Do not claim N-best support until the worker/WASM boundary actually exposes it. Acoustic accuracy and Android performance still require device recordings; deterministic decoder tests establish orchestration only.

Validation: `tests/vosk-recognizer.mjs` checks full-vocabulary construction, one submission per PCM block, endpoint continuations, mutable revisions, repeated digit spans, final response draining, cancellation and stale callbacks. `tests/vosk-collector-browser.cjs` exercises the adapter through the current UI with deterministic decoder words and a real browser capture pipeline. Legacy compiler/router unit tests describe isolated utilities, not the active recognition architecture.


### Explicit command-chain heads

`speech-command-chain-head` marks a command that is complete syntactically but can lead into a related command. Declare its next context with `speech-chain-next`; descendants use `speech-chain-context` and may themselves be heads. The planner must consider this metadata when deciding whether an interim is terminal. The application marks each generated command with a declared next context, including both `break start` (next: break-choice) and the break type (next: break-confirm). An evolving partial must not dispatch the last head merely because its regex matches. A subsequent validated command establishes its boundary; application silence/finalization can settle a bare head. `okay` is terminal and may execute immediately when complete. This contract is shared by Vosk and Web Speech. It changes continuation handling, not the list of accepted aliases.


## Continuous Vosk audio and logical silence boundaries (22 October 2026)

Keep capture, decoder transport, logical collection, and command execution separate.
`VoskRecognizer.continuousInput` means SpeechMenu submits every eligible worklet
frame through `acceptAudio` exactly once, including idle frames. Do not also send
those frames through utterance append or replay the pre-roll. Explicit microphone
stop and announcement feedback suspension retain their existing behavior.

One native full-vocabulary decoder lives until listening stops. Beginning a logical
utterance binds its shared collector; it does not allocate a new decoder. Native
endpoints remain source spans. Adaptive silence, based on speech rate and settings,
**assumes no further continuations will follow**, settles the pending command/value,
and closes that logical continuation. This does not assert that continuations were
impossible. The microphone and decoder remain open for subsequent commands.
Existing root junk pruning and malformed/incomplete collection cleanup still run
at the logical boundary; they never require closing the capture stream.

Serialize boundary requests with PCM submission. A final boundary drains all prior
worker replies before requesting its final result. New begin/audio requests queue
behind that fence. Process worker replies outside the queue so the fence cannot
deadlock waiting for a reply queued behind itself. Never dispose of the previous
decoder when new speech begins; doing so can discard pending trailing words.
`retrieveFinalResult` resets native decoding state while reusing the same wrapper;
the pinned WASM runtime is tested for repeated finalization and subsequent audio.

`audioDelivery` exposes received/submitted sample totals and the outstanding sample
count. PCM is released after its response; it is not retained as a recording. The
transport allows at most 30 seconds of outstanding audio by default (about 1.92 MB
of float samples, excluding worker copies). Overload produces an explicit fatal
error instead of silently dropping frames or allowing unlimited growth. The
five-second worker-response deadline detects a stalled worker, not user silence.
These protections cannot recover audio that the browser/device never delivers.

Validation: `tests/vosk-recognizer.mjs` covers delayed final results overlapping the
next utterance, single submission, idle audio, aborts, and overload.
`tests/vosk-continuous-runtime-browser.cjs` exercises repeated boundaries with the
actual pinned runtime/model. `tests/vosk-collector-browser.cjs` exercises current UI
handoffs and commands. These are transport/behavior tests, not acoustic-accuracy claims.


## Independent command execution and value-first collection (22 October 2026)

`ValidatedCommandBuffer` schedules accepted components asynchronously. A component
may declare `dependsOn` handles referencing previously accepted work. It starts
only after all those completions succeed; a failed or canceled prerequisite
prevents dependent execution. Cancellation resolves dependency waiters promptly.
The buffer owns execution and display lifetime independently of capture and
retains its duplicate guard and bounded idle TTL.

Commands that mutate shared trip/dialog state retain explicit dependencies on
the preceding state command, including across captures. Safe independent actions
opt in with `ActionFunctions` metadata `{independent:true, transaction:false}`;
SpeechMenu publishes this as `speech-independent`. Sync and Sync Override are the
initial actions using this path. They bypass the trip transaction queue, run
with their own buffer chain, and must not inherit a pending Start operation.
An independent failure cannot reject its neighboring state chain; a rejected
Start must not roll back an independently completed Sync change. Other actions
must not opt in until their rollback and persistence behavior is verified.

Accept independent validated tails before awaiting a state transition barrier,
for both interim and final-only recognition. Reconcile with the consumed prefix
to avoid dispatching a tail twice. A following dependent command still waits for
the preceding state command, even when an independent command appears between
them. Final settlement waits for all accepted branches, including new work added
while settlement is waiting.

A value-first declaration can be pending before its literal suffix is spoken:
`one twelve` may grow into `one twelve percent day goal`. Use the declaration's
shared value-context classifier to retain viable prefixes; do not discard them
as root junk merely because the trailing command word has not arrived. Exact
completed values still require a real command or logical silence/final boundary.
In en-US percentages, `one twelve` means 112, `one twenty two` means 122, and
`two fifteen` means 215. Pure digit sequences keep their existing meaning:
`one two` is 12 and `one oh five` is 105. Both scope/number orders support optional
Goal and Percent words for Trip, Day, Week, Money, Month and Year.

Validation includes held Start success/failure with independent Sync Off,
interim/final-only delivery, dependency failure/cancellation, all 48 goal forms,
growing value-first/scope-first transcripts and native endpoint splits.

## Server-backed recognition (22 October 2026)

[Shared server speech recognition](server-speech-recognition.md) defines the
language-routed API, signed pre-login grants, PCM protocol, resource limits,
installation and rollout. Version 2 should preserve the existing collector and
command-buffer contracts when replacing a decoder transport. The server owns
acoustic recognition only; it does not duplicate command/FSM interpretation.


### Server login lease

Keep the server speech connection separate from command execution and account
permissions. A server-reported 10-second anonymous lease drives countdown/status
UI; expiry stops capture, preserves entered credentials, and never aborts a login
HTTP request already running. Require explicit anonymous retry. Successful login
upgrades the same socket with a fresh signed authenticated grant, or starts an
authenticated replacement after expiry. Never extend the lease for audio,
partial credentials, repeated downgrade messages or failed authentication.
See `server-speech-recognition.md` for the wire contract and resource limits.
