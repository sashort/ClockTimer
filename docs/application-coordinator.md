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

## Verification

Run `node tests/application-coordinator.mjs`,
`node tests/async-command-lifecycle.mjs`, and
`node tests/app-state-transactions.mjs --coordinator-end-trip`.
The app regression delays the stop response, verifies visible disabled controls,
attempts duplicate input, dismisses the completed summary, and cancels a speech
operation after the server acknowledges its trip end. Both CI and the Lightsail
deployment gate run these checks alongside storage/clock and Vosk regressions.
