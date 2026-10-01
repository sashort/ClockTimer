# Speech command chains

SpeechMenu consumes utterances from left to right. `#planDigest` probes prefixes against eligible DOM speech items, then follows `speech-chain-next` to items with matching `speech-chain-context`. `#queueDigestStep` serializes accepted actions; `#processElement` invokes the resolved `speech-function` with parsed arguments.

For example, “ready at four fifteen standard time one hour” schedules Ready before applying Standard Time. Follow-up items receive temporary `primed` attributes while their projected workflow is valid, allowing recognition before the associated dialog renders. Disabled actions and authorization checks remain enforced. Priming is cleared when the utterance finishes, fails, or is canceled.

Typed preprocessors receive `provisional: true` during matching. They must reject invalid typed values rather than let wildcard patterns absorb later commands. Actual actions still validate their arguments and workflow state. A failed prerequisite prevents dependent actions; revising an already consumed prefix cancels the chain without replaying it.

Run `npm run test:speech-chain` from `tests` to verify incremental consumption, UI lag, parameter boundaries, ordered execution, cancellation, permissions, and the real Ready/Standard Time and Break handlers.

## Sequence collector

`#collectSpeechSequence` is an ancillary stage enabled by `speech-collect`. It probes growing prefixes through the item’s own regex and optional preprocessor, retaining the longest valid sequence. It assumes no language, number format, or parameter type. The planner receives that boundary rather than splitting one value into multiple commands. For example, “twenty two fifty six” remains one duration, `0:22:56`.

Collector state belongs to the utterance. Unconsumed recognition revisions replace it, accepted commands release it, and completion or invalidation clears it. A following command releases a valid prefix; otherwise the trailing parameter waits for the final decode. Final decodes after VAD closure collect locally without recreating persistent state. Existing fail-fast rules continue to decide whether an invalid tail is stable enough to reject.
