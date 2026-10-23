# Client-side Vosk context handoffs

## Ownership

The implementation runs on each client. SpeechMenu owns the existing microphone, 16 kHz worklet, voice-activity detection and adaptive silence timeout. VoskContextRecognizer never calls getUserMedia and never sends audio to a speech server. It owns one bounded PCM ring and one active native decoder at a time. VoskRecognizer's lazy loader owns the shared model; retired decoders are removed before their successors are created.

The local Vosk backend uses this adapter when WMOF_VOSK_CONFIG.contextHandoff is true. `?speech-handoff=off` selects the original full-vocabulary continuous adapter for comparison. The server adapter does not use this path.

## Audio positions and one-use destinations

PcmSampleBuffer copies capture samples immediately, assigns monotonically increasing sample positions, and retains at most 30 seconds (1,920,000 bytes at 16 kHz Float32). Queue overflow or expired required audio fails explicitly. Audio is captured once. Replaying buffered samples is counted separately from received samples; it is not a second microphone stream.

SpeechBoundaryAnalyzer receives a one-use destination. Its handoff method claims and clears that reference synchronously before awaiting the local transfer. A repeated callback cannot transfer to the same destination again. Cancellation, transfer failure and shutdown clear pending references. The active decoder is then held by the recognizer controller, not by a stale pending analyzer destination.

The semantic commit point comes from finalized native word timestamps, translated to global sample positions using the decoder's input origin. The analyzer does not move that commit point. It searches already-captured audio for a quiet region preceding at least 120 ms of preserved context, looking back up to 300 ms by default. If no quiet region exists, it uses conservative overlap. The search requires no future silence. Native timestamps remain estimates; this policy preserves audio around uncertain boundaries rather than claiming exact phonetic separation.

Words replayed before the committed boundary are filtered by timed position (word midpoint), never by matching equal strings. Repeated digits must survive. Untimed partials from a replayed overlap are speculative; they cannot append duplicated executable text. A native checkpoint supplies finalized timing before committing a handoff. A revised or unverifiable boundary fails explicitly.

## Grammar and execution

SpeechMenu's existing availability, projected surfaces, chain-next declarations and typed capture contracts supply the grammar records. The root is the currently available command vocabulary, including sleeping restrictions. The grammar router selects command, digit, time, duration, number or date stages. Finite declared next-command chains are included as lookahead so a fast continuation remains audible before its decoder handoff finishes. These are generated from application declarations, not credential samples.

Each stage uses a separate VoskRecognizer with a fixed grammar and the same loaded model. Grammar changes do not mutate an actively decoding Vosk graph. Decoder epochs fence late results from retired stages. Handoff events preserve one application utterance ID and report source/destination grammar, commit/replay sample positions and timing measurements.

Collectors and the command buffer remain the semantic authority. The router neither executes commands nor changes their duplicate guard. The transcript remains cumulative across stages; the existing validated command buffer owns execution identity, dependencies and dispatch. A complete value is not necessarily a complete command or the end of a stream.

## Digit bounds and context

SpeechValueCollector supports either `digitRange:[minimum,maximum]` or discrete `digitCounts:[4,8]`, not both. In the latter case four digits are valid and extendable, five through seven are incomplete, eight are valid and terminal, and overflow is malformed. A silence boundary rejects a forbidden intermediate count. Leading zeros are strings and remain intact.

Optional `digitContexts:{4:'id',8:'credentials'}` selects context metadata only at valid counts. It does not execute callbacks. Callers may supply structured descriptors for further interpretation. ID and PIN commands declare their accepted counts; the router combines available declarations for the current digit stream. The shared login commands still own authentication and field assignment.

A four-digit field must not force a confirmation decoder while more digits continue. Both the four-digit-plus-confirmation flow and eight consecutive digits with optional final confirmation are regression cases. Production English uses the single confirmation token `okay`; `ok`, `o k` and `oh k` are not confirmation aliases. `oh` remains zero in digit entry. Confirmation is matched as a whole token and cannot be consumed as a zero syllable.

## Silence and cancellation

Speech activity and AdaptiveSpeechTiming still own utterance closure. Boundary analysis does not decide that speech has ended and does not create a second timeout. When silence expires, the processor assumes no further continuations, settles complete commands and applies existing incomplete/malformed handling. In-flight checkpoints settle buffered audio before final completion. Aborting cancels the utterance, clears the destination and retires the decoder. The microphone stays open for the next utterance.

## Validation and performance

`tests/package.json` exposes `test:speech-handoff`. It checks bounded capture copying/wrap/expiry, conservative boundary selection, one-use destinations including failure/cancellation, sample-based replay, stale results, final settlement, generic digit bounds/discrete counts and okay-only production patterns.

Real-browser acoustic checks use the rebuilt Vosk WASM and saved human recordings locally. Joined ID/PIN tests splice recorded digit portions and must be identified as assembled cases, not new continuous human takes. No original recording is modified or uploaded. Structural numeric vocabulary coverage does not imply acoustic coverage for every number or language.

Handoff diagnostics separate analyzer time, native finalization and total handoff preparation/submission. Replay completion and command execution need end-to-end measurement as well; these metrics must not be advertised as Android latency or a guarantee of no perceptible delay. Android device validation is required before deployment qualification.


## Latency and asynchronous work

Asynchronous PCM delivery and transcript analysis each preserve order. Independent
validated commands may execute concurrently, but `async` does not move grammar
construction, pattern expansion, or continuation parsing off the main thread.
Keep those operations out of repeated per-partial and per-utterance work.

The finite compiler caches syntax only for immutable vocabularies (bounded to
512 pattern entries per vocabulary), and attaches the current live command
record on every call. Mutable vocabularies bypass this cache. Language changes
use a different vocabulary identity. Availability, permissions, sleep state,
and execution decisions must never be cached as compiled syntax.

The router reuses phrase lists only while its path, continuation, grammar, and
confirmation state are unchanged. Number word lists and typed-continuation tokens
are prepared once rather than split again on every hypothesis. Literal pattern
expansions have a separate bounded 512-entry cache keyed by pattern and limit.
Lookahead visits each identical continuation text once within one construction.
Audio boundaries, PCM replay, confirmation rules, and silence timeouts are
unchanged.

A local desktop replay on 2026-10-23 used recorded eight-digit login audio followed
by synthesized Sync Off, Day Goal 110, and Ready At 4:12 inputs. The slowest
handoff fell from 2957 ms to 558 ms; the longest observed main-thread task fell
from 2758 ms to 602 ms. Compilation totals fell from 4297 ms to 433 ms. These
are development measurements for that sequence, not Android latency guarantees
or acoustic accuracy benchmarks. All four intended commands dispatched in the
optimized replay. Raw recordings and profiler output remain outside the repo.

## Sequential slots and preparation

The primary local adapter remains sequential. `SpeechRecognitionLedger` records
context-declared heads and typed values with absolute PCM sample ranges. A head
can forecast the next type: Ready At forecasts Time with scheduled-start-time
context. Ownership does not execute a command. SpeechMenu's validated command
buffer retains that responsibility. Context changes must reject an asynchronous
slot plan before ownership is committed, even if the audio hypotheses did not change.

`VoskDecoderPool` prepares up to three idle decoders sharing the loaded model.
Only the selected decoder receives PCM. Forecast preparation overlaps native
finalization; it does not start another capture stream. Grammar compilation runs
in `speech/SpeechGrammarWorker.js` where supported, with a main-thread fallback.
Context snapshots are cached only within the current context version; obsolete
unprocessed partial inspections are coalesced while finals remain ordered.

Comparison options are `speech-warm=off`, `speech-grammar-worker=off`,
`speech-coalesce=off`, and `speech-alternatives=1..30` (default 10). Set
`speech-recognizers=parallel` only for the experimental simultaneous-decoder
benchmark. Its initial human eight-digit replay failed to log in and accumulated
audio backlog; structural unit tests do not qualify it for production.

Metadata on the execution path keeps stream identity, sample ranges, decoder
epoch/origin, context, command identity, ownership state and next-type forecast.
Byte offsets are derived from samples and PCM layout. Do not serialize the entire
slot history into each transcript event: changed slots have a dedicated event.
Do not validate incomplete slot heads by asking the full command planner again.
Full alternatives and display diagnostics remain separate from execution.
Partial words without native timing have no invented audio range.

Drop-In debug forwards bounded primitive slot positions and preparation/queue
metrics. The existing opt-in and login-credential exclusion apply to these events.

Run `node tests/vosk-login-benchmark.cjs recording.wav report.json sequential warm`
and repeat with `cold` against the same private human eight-digit recording.
The fixture uses mocked APIs and asserts the requested adapter actually ran;
login failure or browser errors produce a failing exit status. Recordings stay
outside Git. Overall time includes setup/playback and is not pure recognizer
latency. One warm desktop replay passed with a 134 ms handoff (1 ms boundary
analysis); repeated measurements and Android testing remain necessary before
claiming a device-level improvement.

Three subsequent cold/warm pairs all recognized the expected eight digits,
recorded their credentials slot and dispatched exactly once. Median decoder
preparation was 60 ms cold / 44 ms warm; median total handoff was 165 / 154 ms.
One warm run reached 261 ms, exceeding all three cold runs. This small desktop
sample supports a preparation benefit, not a reliable end-to-end latency claim.
The login benchmark defaults to the fixture's `00421234`; pass an eight-digit
expected value as its fifth argument for another reviewed recording. It fails
when the credentials slot differs, dispatch duplicates, login stays open, or
browser errors occur.


## Command execution slot dependencies

Recognition ownership and command execution have separate lifecycles. Execution slots
use `status`: `pending`, `executing`, `invalid`, or `resolved`. A value slot points to
its command head through `ownerHeadSlotId`; the head requires that value's stable slot
range. Command completion dependencies also use explicit start/end slot IDs, with
`kind` distinguishing a value requirement from another command's completion.
There is no separate resolved boolean.

The application declares `speech-slot-key` and `speech-wait-for-slots` alongside
its speech action metadata. Login publishes the authentication slot. Goal commands
wait for authentication and earlier Goal writes; Sync commands wait for authentication
and earlier Sync writes. Goal and Sync do not wait for one another. A pending value
or unrelated command blocks only its dependents, never the whole utterance. Cancellation
or invalidation propagates through those dependencies, while duplicate dispatch and
live availability checks still apply. Drop-In debug includes slot status, ownership,
dependency ranges, and the precise IDs still awaited.

A completed final utterance may outlive active microphone capture. After successful
login its remaining commands must still be planned, unless its session generation
changed or the chain was canceled. Independent-tail recovery must not discard a
preceding valid command or pull dependent commands into its bypass queue. Login
recognition uses the installed language's continuation vocabulary acoustically;
this never grants pre-authentication execution permission or expands sleeping grammar.

## Full-chain latency benchmark

`tests/vosk-command-chain-benchmark.cjs` replays a local human recording through the
real local audio/VAD/recognizer/planner stack with mocked application APIs. Supply
the reviewed final speech sample index separately from WAV padding. The primary
measurement is the validated scheduled time's planner event timestamp minus that
speech-end timestamp, using the playback AudioContext/monotonic clock anchor. Negative
values are retained. WAV end, action completion and announcement timing are different
measurements and must not substitute for planner latency. The benchmark also requires
one dispatch each for credentials, Trip Goal, Sync and Ready At.
