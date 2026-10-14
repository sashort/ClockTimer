# Application orchestration

`WMOFCoordinator` is the single application coordinator. `WMOFStateTransactions`
and the `StateTransactions` constructor are compatibility aliases to that same
implementation; there is no second coordinator or transaction queue.

SpeechMenu continues to plan and validate speech commands. ClockTimer owns the
trip model. Storage, recognition workers, renderers and audio are participants.
Their internal buffering does not decide whether an application operation commits.

## Operation lifecycle

Inputs receive monotonically increasing receipt IDs and monotonic start/end
timestamps, plus an ISO wall-clock start time. A bounded, read-only history is
available through `WMOFCoordinator.trace` and live `event` notifications. It records
pointer/keyboard contacts, activations, utterance capture, operations, network and
browser-storage requests, announcements, deferred UI effects and reconciliation.
It does not record typed keys, PINs, passwords, request bodies or audio.

Operation receipts include phase history, source, parent receipt, predecessor
dependency, and execution/settled state revisions. A later mutation waits for its
predecessor to settle. Speech chain steps share one operation and staged writes;
final recognition must release the operation's outstanding result before commit.
Independent read/input actions preserve their existing synchronous/asynchronous
return contract and are traced without waiting behind a mutation.

`defer(key, callback, options)` owns delayed UI work. A new callback for the same
resource supersedes the previous one. Cancellation removes owned callbacks, and
state revision/context guards suppress stale work. Scheduled-trip speech prompts
also wait for operation completion, so they cannot interrupt a collecting command
chain. Mechanical dialog closes use their dialog identity and closing-state guard.
Already settled transactions cannot be reused by late bound callbacks.

## Persistence and recovery

Browser writes are staged until command acceptance. Explicit server rejection
retains the existing snapshot rollback behavior. A confirmed remote write cannot
be undone by restoring an older browser snapshot. A lost response after sending a
mutation is also treated as an uncertain outcome, rather than proof of rejection.

For those cases the coordinator cancels dependent work and invokes its recovery
participants: ClockTimer reads the server's authoritative active-trip state with
a fresh, bounded signal, then the interface derives its controls from that model.
Recovery failure is reported explicitly; it is never described as successful
reconciliation. Summary reads retain their independent request-ID/cancellation
guards and do not own the trip mutation.

## End Trip and transient controls

A stopped timer is immediately inactive even while its start properties remain
available for summary/persistence. Those properties no longer authorize End Trip,
Break or Down. During the pending end operation the existing controls stay visible,
dimmed and disabled, including the summary confirmation buttons. They cannot accept
pointer input. When the operation settles, the interface presents the committed
ready/summary state. Summary cancellation cannot restore a running trip.
Action implementations, including Down and New Trip, read semantic availability
rather than the disabled state that their own pending operation applies to the
buttons. `--interval-actions` covers pointer Break selection, voice confirmation,
Down/resume and one persisted event per accepted interval.
Both "start break" and "break start" select the regular break. Either accepts
OK in the same utterance or through the existing confirmation dialog.

## Verification

The user-defined speech contract is: one acoustic utterance can contain separate
commands, related chains, and intervening commands. A fully formed command with
no legal continuation executes and settles immediately. The command-processing
stream then ends, while the acoustic utterance ID, captured PCM and Vosk overlap
buffer remain alive. Future planning waits for the operation to settle. Valid
chain context survives unrelated commands, such as Ready At → Sync On → Standard
Time; a malformed Ready At earns no context for its dependent Standard Time.

Leading junk is excluded from the consumed command head, including in decoder
finals and Vosk vocabulary routing. Revised noise cannot cancel or repeat that
head. Malformed intermediate segments are omitted. An invalid final suffix
cannot revert prior completed commands. Typed continuations fail immediately
when known vocabulary proves them malformed; opaque patterns remain conservative.
Detected silence gives an unfinished segment at most 350 ms to continue. A valid
collector settles at that boundary; an incomplete one is discarded. Resuming
speech cancels the deadline. The decoder's finite vocabulary is not used to
claim that an unbounded application value parser has no possible continuation.

The numeric voice-login surface accepts only an atomic four-digit code followed
by OK, or Cancel. Standalone digits/OK cannot edit credentials or advance login;
five-digit runs cannot be recovered as a four-digit suffix. Pointer login entry
retains its existing behavior. `--voice-code` verifies these rules in the app.
`--voice-code-adapter` also drives the actual Vosk adapter through consecutive ID
and PIN confirmations. After digit four its decoder vocabulary contains only OK
and Cancel forms. Unsupported words from the wider pre-switch vocabulary are
not carried into the confirmation stage; overlap audio is re-decoded there.
Terminal literal text remains seeded until consumed, so a new partial for the
PIN cannot erase the preceding ID's OK. An unrelated word such as "day" cannot
confirm a code.

SpeechMenu rejects an invalid final/only segment immediately and aborts that
utterance's decoder without stopping microphone recognition for later utterances.
Late decoder results cannot revive a rejected utterance. Malformed middle segments
can be skipped at an explicit command boundary in the available context; skipped
words remain part of the consumed transcript. A malformed state-changing command
does not grant its projected context to the next segment. Interim values remain
revisable. Execution/persistence failures retain coordinator cancellation and
recovery semantics rather than being treated as harmless recognition noise.
Run `node tests/speech-failfast.mjs` for the focused segment regressions.

Run `node tests/application-coordinator.mjs`,
`node tests/async-command-lifecycle.mjs`, and
`node tests/app-state-transactions.mjs --coordinator-end-trip`.
The app regression delays the stop response, verifies visible disabled controls,
attempts duplicate input, dismisses the completed summary, and cancels a speech
operation after the server acknowledges its trip end. Both CI and the Lightsail
deployment gate run these checks alongside storage/clock and Vosk regressions.
