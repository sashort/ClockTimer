# Speech experiments

The active development path is local sequential Vosk recognition with shared,
sample-addressed slots and declared next-slot forecasts. Experiments below do
not change the deployed backend or authorize infrastructure changes.

## Server-side recognition — deferred

Recorded 2026-10-23. The user requested that this remain an experiment to revisit
later while work continues on the local implementation.

Reuse the existing `vosk-server` backend: continuous browser capture sends mono
16 kHz PCM over WSS to our Vosk worker, with language routing, native alternatives,
and the existing browser collectors and validated command buffer. Evaluate
recognition, slot metadata, grammar switching, and prepared decoders server-side.

The latest deployment capacity check reported 0.4 GiB total RAM, 0.2 GiB available,
and 8.3 GiB free disk. The existing large-model installer policy requires a
16 GiB host, 12 GiB available RAM and 10 GiB free disk. The speech service was
therefore skipped. On inspection, `/api/speech/session/` returned HTTP 503
`speech_unavailable`, and `/speech-ws` returned HTTP 404. These are observations
from 2026-10-23, not permanent host specifications or inherent Vosk requirements.

Prerequisite: review a separate speech host or an instance upgrade; do not resize
or incur new infrastructure charges automatically. Retain the 10-second anonymous
login lease, session promotion after login, locale isolation and admission limits.

Compare the same authorized recordings against the optimized local baseline.
Measure correct/missed/incorrect commands, false wake activations, p50/p95
audio-to-dispatch latency, network round trip, oldest queued audio age, decoder
switch stages, throughput, memory, concurrent sessions and hosting cost. Report
accuracy alongside speed. Do not infer accuracy from transport tests.

Implementation reference: [server-speech-recognition.md](server-speech-recognition.md).
