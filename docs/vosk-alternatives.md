# Vosk multiple hypotheses

Native Vosk supports SetMaxAlternatives. The official browser package 0.0.8 omits that native binding and its worker/public API; an adapter setting cannot add an absent WebAssembly function. ClockTimer owns the custom source patch in deploy/vosk-browser/patch.py and the build workflow .github/workflows/vosk-browser-alternatives.yml. Pin the upstream revision and verify the resulting artifact checksum before installation. The vosk-browser-alternatives branch builds and tests the dependency without deploying the application. No custom runtime has been deployed yet.

## Return contract

VoskRecognizer accepts maxAlternatives (integer 0 through 30, default 10) and optional requireAlternatives. With a capable runtime it calls KaldiRecognizer.setMaxAlternatives before audio submission. An older runtime emits alternatives-unavailable; requireAlternatives rejects instead of silently claiming N-best support. Zero preserves the single-text runtime mode. The Vosk server already configures native alternatives; its transport returns the same hypothesis information without requiring a second decoder.

Endpoint/final results emit alternatives with utteranceId, count, selectedIndex, and hypotheses. Browser results also include segmentId and isFinal. Each hypothesis has index, cumulative text, segmentText, the original native confidence score, and optional word timings. The score is not a probability and can exceed one. The requested number is a maximum: native Vosk may return only one or a few hypotheses. Partial results remain single-best.

A transcript event continues to contain the one selected transcript and its immutable source segments. N-best transcript events additionally expose hypotheses and selectedIndex. SpeechMenu forwards alternatives as speechRecognitionAlternatives for diagnostics; Mic Bar still reflects validated command-buffer content, rather than all competing guesses. Do not execute every hypothesis.

## Selection and ownership

The shared command planner chooses the first usable ranked hypothesis against the current available commands and projected continuation. Preserve utterance/segment identities, async command dependencies and interim/final dispatch guards. The recognizer's reply queue is separate from its audio/final fence, preventing asynchronous selection from waiting behind a fence that needs that reply. Closing invalidates pending selection before it can publish.

While sleeping, only the primary hypothesis is eligible. Never search lower ranks for Wake. Four-digit login collectors reject spoken teen/tens groups: in the saved ID take, `zero zero fourteen okay` is rejected and `zero zero four two okay` is the valid second candidate. If two candidates both contain valid four-digit codes, grammar validity alone cannot establish which credential was intended.

## Evidence

Local native replay processed 31 approved human Fast takes with maximum 10. The custom command-domain candidate returned three alternatives for the ID take, with the correct literal digits in second place. Other takes were allowed to return a single candidate. These are pilot results, not a held-out accuracy estimate. Human audio and private replay reports remain outside the repository.

`node tests/vosk-recognizer.mjs` checks bounds, capability reporting, original ranks/scores/timings, selected-only collection, immutable segments, final fencing, audio accounting and stale selection after Close. `node tests/app-state-transactions.mjs --vosk-alternatives --voice-feedback` checks the actual ID alternatives, command validation, duplicate dispatch prevention and sleeping rejection. `node tests/vosk-server-browser.cjs` checks the native/server protocol. Rebuild and replay the browser binary before claiming browser N-best support is complete.
