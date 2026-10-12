# Vosk phrase-list compiler experiment

`VoskPhraseListCompiler.js` expands complete phrases from the existing
`lang/en-US/speech-patterns.json` records. It is intentionally separate
from `SpeechMenu` and the active recognizer while the grammar is measured.

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

This is not yet wired to the microphone or Vosk runtime. In particular, phrase generation
must be measured against realistic finite vocabularies for spoken times, durations,
percentages, and PIN entry before choosing a model or activating it. A PIN grammar should
be bounded by the actual PIN-entry context rather than enumerating arbitrary digit strings.

## Tests

Run `node tests/vosk-phrase-list-compiler.mjs` to exercise complete-phrase expansion,
capture substitution, optional/alternative forms, expansion caps, and explicit rejection
of unsupported patterns.
