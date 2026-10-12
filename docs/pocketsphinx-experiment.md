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
  capture pipeline. Its SpeechMenu-compatible `accept(utteranceId, samples,
  sampleRate, grammarName)`, `finishUtterance()`, and `abortUtterance()` methods
  serialize audio processing around utterance starts and stops.
- `SpeechMenu.js` now has an opt-in PocketSphinx path selected by setting
  `WMOF_SPEECH_BACKEND = "pocketsphinx"` and supplying
  `WMOF_POCKETSPHINX_CONFIG`. It registers the configured FSG grammars, feeds
  SpeechMenu's existing AudioWorklet frames into the adapter, and routes
  transcripts into the existing planner without the Sherpa-specific transcript
  head-pruning step. Sherpa remains the default unless this configuration is
  explicitly supplied.
- Tests exercise the grammar context, grammar catalog, and worker adapter
  protocol without requiring a microphone or WASM model.

## Remaining integration work

1. Supply and validate the actual runtime/model/dictionary assets. No model or
   dictionary is bundled, so recognition cannot be activated until a compatible
   runtime set is deployed.
2. Generate the configured `commands`, `time`, `date`, `digits`, `number`, and
   `duration` FSG objects from the existing command patterns and vocabulary;
   every grammar token must have a pronunciation in the loaded dictionary.
3. Complete the grammar-boundary protocol. The adapter selects a grammar at
   utterance start; it does not switch the active PocketSphinx search mid-utterance.
   A command prefix such as “ready at” therefore needs a recognized boundary or
   a supported runtime-level search-switch operation before a value grammar can
   take over.
4. Run the adapter unit tests and browser tests with a real model and
   microphone, covering time/date entry, digit/PIN entry, command chaining,
   final transcript delivery, and cancellation.

The integration is opt-in and is not yet verified end to end. Sherpa remains the
production default until the runtime assets and browser tests pass.
