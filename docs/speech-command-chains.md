# Speech command chains

SpeechMenu consumes utterances from left to right. `#planDigest` probes prefixes against eligible DOM speech items, then follows `speech-chain-next` to items with matching `speech-chain-context`. `#queueDigestStep` serializes accepted actions; `#processElement` invokes the resolved `speech-function` with parsed arguments.

For example, “ready at four fifteen standard time one hour” schedules Ready before applying Standard Time. Follow-up items receive temporary `primed` attributes while their projected workflow is valid, allowing recognition before the associated dialog renders. Disabled actions and authorization checks remain enforced. Priming is cleared when the utterance finishes, fails, or is canceled.

Typed preprocessors receive `provisional: true` during matching. They must reject invalid typed values rather than let wildcard patterns absorb later commands. Actual actions still validate their arguments and workflow state. A failed prerequisite prevents dependent actions; revising an already consumed prefix cancels the chain without replaying it.

Run `npm run test:speech-chain` from `tests` to verify incremental consumption, UI lag, parameter boundaries, ordered execution, cancellation, permissions, and the real Ready/Standard Time and Break handlers.
