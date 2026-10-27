# Shared speech language controller

`SpeechLanguageController.js` is the application entry point for value parsing,
normalization, formatting, classification, collector constraints and recognizer vocabulary.
`VoskGrammarRouter.valuePhrases()` delegates to it for compatibility. English
vocabulary no longer lives inside the recognizer router.

Each locale registers a versioned contract, currently
`lang/en-US/SpeechLanguageContract.js`. The language manifest loads its parsers
and then its contract. The controller is loaded before those locale scripts.
Unsupported locales fail explicitly; the controller does not substitute English.
Low-level locale parsers remain independently testable and do not execute commands.

The contract supplies:

- Finite recognition vocabularies for time, duration, numbers, digits and dates.
- Adapters for `normalize`, `parse`, `format` and `classify`.
- Collector constraints and generated parity cases with declared meanings.
- Locale-specific lexical forms, units, omissions and interpretation rules.

English number vocabulary uses `EnglishSpokenPercentParser.spokenForms()` and its
lexical tables. Thus “one ten”, “one hundred ten”, “one hundred and ten” and
“a hundred and ten” are checked against the same parser. The controller owns
common orchestration rather than English spellings. Command availability,
dependencies and execution remain owned by SpeechMenu and the validated buffer.

`bindCollectors()` registers shared value contexts, resolves the active keypad
mode at classification time, and updates locale constraints on activation.
Registration waits for a lazily loaded SpeechMenu; its initialization calls
`refreshCollectors()` before recognition begins.
Vocabulary is immutable and cached per contract. Activation changes the revision
used by SpeechMenu's continuation cache. Stop recognition before changing locale:
the controller rejects switching a running recognizer to another language.

Clock and duration values retain separate meanings. Parsed components preserve
whether a value was actually supplied. For “an hour and five”, hours `1` and
minutes `5` are explicit; omitted seconds appear as `[0]` in Drop-In diagnostics.
An omitted unit does not make a spoken number inferred. The caller still supplies
the value's purpose, such as scheduled start, standard duration, ID or PIN.

Run `node tests/speech-language-controller.mjs` or `npm --prefix tests run
test:speech-language`. The generated English suite covers all contract number
forms through 999, every hour/minute combination, minute/second durations and
component provenance. It compares vocabulary, normalization, parsing and collector
classification, and tests locale isolation and activation bounds. Existing parser,
recognizer handoff and workflow tests still apply. These are semantic parity
checks; actual recognition accuracy requires recorded speech tests separately.

When adding a language, register its own contract and generated cases through its
language manifest. Do not add locale branches to the controller, Vosk router,
SpeechMenu or app value collectors. New accepted forms must be provided by the
locale parser/contract and pass the parity suite before deployment.

Goal parsing and the UI goal limit are separate contracts. The controller can
parse a valid positive percentage above 150; the shared app goal setter/pad then
caps user entry to 150, updates the display and emits localized correction feedback.
Do not truncate the grammar vocabulary to enforce this UI rule, and do not cap
calculated inferred trip requirements. Labels, captions and number/time formatting
are presentation data; opening a node editor must use its configured goal value.
