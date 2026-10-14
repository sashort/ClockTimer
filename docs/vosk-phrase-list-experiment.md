# Vosk phrase-list compiler experiment

`VoskPhraseListCompiler.js` expands complete phrases from the existing
`lang/en-US/speech-patterns.json` records. It is intentionally separate
from command execution. The opt-in `VoskRecognizer` now uses its staged compiler
with `VoskGrammarRouter` and SpeechMenu's active/contextual planner.

## Contract

`VoskPhraseListCompiler.compile(patternRecords, { capturePhrases, maxPhrasesPerPattern })` returns:

- `phrases`: deduplicated, normalized complete utterances suitable for a Vosk phrase-list JSON array.
- `phraseCount` and `duplicateCount`: phrase-list size and duplicate expansions removed.
- `recordsSeen` and `supportedPatterns`: compilation coverage.
- `unsupported`: source pattern, optional ID, and the reason it was rejected.

Every named capture needs an explicit finite phrase list keyed by its capture name. A
capture such as `(?<spokenTime>.+)` is not treated as “any words”: the compiler
only substitutes supplied time expressions. Unsupported regex constructs and expansion
limits are reported; they are never silently widened into permissive vocabularies.

## Deliberate limitations

This first compiler supports literals, non-capturing groups, alternation, optional
groups, named captures with supplied vocabularies, and normalized whitespace. It does
not yet support arbitrary regex quantifiers, character classes, lookarounds, or open-ended
capture values. Those patterns are listed in `unsupported` and need an explicit
finite grammar representation before they can be included safely.

The staged compiler does not expand a Cartesian product of command/value phrases.
It expands literal syntax with capture markers, substitutes finite vocabularies for
typed stages, and validates capture choices against their original capture regex.
Finite named choices without a value type remain complete command phrases.

## Browser integration

Load a matched [vosk-browser runtime](https://github.com/ccoreilly/vosk-browser) and
a model that supports dynamic grammars before opting in:

```js
// Load your deployed vosk-browser script first (it exposes globalThis.Vosk).
globalThis.WMOF_SPEECH_BACKEND = "vosk";
globalThis.WMOF_VOSK_CONFIG = {
    modelUrl: "/vendor/vosk/model.tar.gz",
    overlapMilliseconds: 320,
    // Optional, finite per-capture restrictions for the actual input context:
    capturePhrases: { pin: ["one two three four", "four three two one"] }
};
```

Alternatively supply an already loaded `model`. SpeechMenu provides the authoritative
`contextProvider`; configuration cannot override that provider. The adapter uses the
existing 16 kHz audio-worklet/VAD path, without opening another microphone. It creates
a constrained KaldiRecognizer for each internal stage, fences stale callbacks, retains
a bounded PCM tail, and replays it into the replacement. Recognized next-stage text
that predates the replay window is carried forward. Audio endpoint results remain
interim; only the VAD final request emits a final SpeechMenu transcript.

Initial records come from `#availableCandidates`, including SpeechMenu's permitted
global commands in a modal. Future contexts come from isolated probes of the existing
chain planner with the utterance's initial candidates/surfaces. Probes do not execute
actions or modify live collectors. A value stage also includes the projected command
heads needed to recognize its boundary. Once a finite value and an available next head
match, the router consumes that boundary and selects the next stage. All stages use
the same SpeechMenu utterance ID and publish a cumulative transcript.

Default English choices cover 12-hour times with minutes/meridiem, numbers 0–999,
single-unit durations using those numbers, one to four spoken digits, and month/day
dates plus today/tomorrow. They are bounded recognition choices, not new semantic
parsers. Supply `valuePhrases` by type or `capturePhrases` by capture to narrow or
extend a finite range (including composite durations, years and longer PINs).
Preprocessor context/field metadata overrides ambiguous capture types: `timeValue`
on Standard Time is a duration, while `spokenTime` on Ready At is a clock time.

Unknown or unsupported syntax is omitted and reported as `grammar-omissions` status.
An empty active grammar fails explicitly; it never falls back to unrestricted Vosk.
Vosk phrase lists constrain decoder vocabulary, but do not enforce regex order or
semantic validity. SpeechMenu continues to validate and execute every command.

Lightsail now deploys this branch and enables Vosk via `speech/VoskTestConfig.js`.
`deploy/install_vosk_assets.py` installs vosk-browser 0.0.8 and the official small
English 0.15 model from checksum-pinned sources, serves them from the same origin,
and verifies installed hashes on repeat deployments. The model archive includes
explicit directory entries so the browser's IndexedDB cache can persist it.
Runtime/model binaries are not committed to Git. Runtime loading is lazy and
model initialization rejects on worker errors or a timeout.

Visit `order-filler.php?speech-backend=sherpa` for a per-visit Sherpa comparison.
The Lightsail deployment is gated on the focused speech tests. Browser smoke checks
verify real WASM/model initialization, constrained decoder creation, and a complete
silent utterance with its original ID. Real microphone accuracy and switch timing
still need acoustic validation against the deployed model.
PocketSphinx implementation files are unchanged.

## Tests

Run `node tests/vosk-phrase-list-compiler.mjs` to exercise complete-phrase expansion,
capture substitution, optional/alternative forms, expansion caps, and explicit rejection
of unsupported patterns. `node tests/vosk-grammar-router.mjs` covers stage switching,
unanimous/ambiguous prefixes, finite values, typed/suffix/chained transitions, utterance
IDs, bounded replay, text carry, stale callbacks and final-result ordering.
`node tests/vosk-speechmenu-context.mjs` verifies active/modal availability, projected
contexts without execution, and authoritative execution of Ready At → Standard Time
chains including four twelve, four thirteen and four twenty two.
