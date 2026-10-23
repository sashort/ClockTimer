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
