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
The adapter preserves interim revisions and consumes final result slots once.
`tests/web-speech-recognizer.mjs` and `tests/web-speech-command-selection.mjs`
verify these contracts using simulated browser results; they do not establish
real acoustic recognition accuracy. Browser recognition may use a remote speech
service. This adapter uses browser-owned microphone capture, not Vosk PCM input.


Fully formed Web Speech commands with no possible continuations execute from
interim results. Commands with viable continuations keep collecting. Each
utterance owns `interimDispatchedCommandIds`, a set reserved synchronously before
queuing an interim action. It uses `data-speech-editor-id`, the element ID, or a
stable runtime ID for an anonymous command. Later interim revisions and final
results cannot dispatch an ID in that set again, even with different wording.
The set survives command-stream settlement and state transfers, and resets only
with a new utterance. Other command IDs can execute in that same utterance.
