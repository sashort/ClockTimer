# PocketSphinx experiment integration notes

This branch is an experiment and does not replace the Sherpa backend yet.

## Runtime assets required

Deploy a matched PocketSphinx.js runtime set under a same-origin directory, for
example `vendor/pocketsphinx/`:

- `recognizer.js` (upstream Web Worker wrapper)
- `pocketsphinx.js`
- `pocketsphinx.wasm` when using the WebAssembly build
- a compatible acoustic model and its feature parameters
- a pronunciation dictionary for every word that can appear in any registered
  grammar

The adapter does not bundle these upstream binary/model assets. Configure
`runtimeFiles` as PocketSphinx.js lazy-load tuples
`[virtualDirectory, virtualFilename, sameOriginUrl]` and `runtimeFolders` as
`[virtualParentDirectory, folderName]` tuples. The adapter loads these into
the worker's virtual filesystem before calling `initialize`, so the
`-dict`/model configuration can refer to the virtual filenames. The worker
wrapper expects the `recognizer.js` and `pocketsphinx.js` versions to match.
Use an English acoustic model whose sample-rate/features match the adapter's
16 kHz PCM output, and verify the model's license and redistribution terms
before committing model files.

## Current code

- `SpeechGrammarContext.js` infers the next expected value category from named
  captures such as `spokenTime`, `timeValue`, `digits`, and `percent`.
- `PocketSphinxGrammarCatalog.js` builds FSG objects for command phrases and
  constrained value vocabularies.
- `PocketSphinxRecognizer.js` wraps the upstream worker protocol, exposes
  grammar registration and switching at utterance boundaries, and can either
  capture its own microphone or accept Float32 audio frames from an existing
  capture pipeline through `acceptAudioFrame(samples, sampleRate)`. Frames are
  resampled and batched into 16 kHz signed 16-bit PCM for the worker.
- Tests exercise the grammar context, grammar catalog, and worker adapter
  protocol without requiring a microphone or WASM model.

## Remaining integration work

1. Supply and validate the actual runtime/model/dictionary assets.
2. Build command-prefix grammars from the existing speech-pattern definitions
   and ensure every vocabulary token has a pronunciation before registering
   grammars.
3. Connect the adapter to SpeechMenu's existing utterance lifecycle and route
   hypotheses through its current command planner. Do not introduce a second
   command executor or transcript head/tail salvage.
4. Define a boundary protocol for switching from command-prefix to value
   grammar. PocketSphinx's worker API selects a search at `start()`; do not
   assume it can switch the active decoder search mid-utterance.
5. Run unit tests and browser tests with a real model and microphone, including
   time entry, date entry, digit/PIN entry, command chaining, and cancellation.

Until these steps are complete, the existing Sherpa path remains the active
production path on this branch.
