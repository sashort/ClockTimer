# Stable release reference

## I0462X — October 23, 2026

User feedback: “very stable with almost no lag.” This is user-observed production
behavior, and is the reference baseline for future speech stability and latency comparisons.

- Production commit: `bb6cd93b6712c03be6282b800ace3e183bb6c45d`
- Source tree: `7f3ea5373b93b1f7c68420ce224cc1e71c40b458`
- Approximate deployment/build time: October 23, 2026, 9:37 PM America/New_York (EDT).
- Verified successful deployment: https://github.com/sashort/ClockTimer/actions/runs/40049919410
- Recognition: client-side sequential Vosk; one active decoder, bounded buffered audio,
  prepared decoders, and shared command-slot dependencies.

This release removed grammar projection's wait on command completion, preserved pending
final results across captures, released final-result fences before waiting on actions,
reused compact grammar vocabulary tables, and separated decoder readiness display from
microphone capture/command availability. Dynamic activation of parallel recognizers was
discussed but is not part of this baseline.

The deployment gates, live build identity, live grammar worker, and version popover were
verified before success was announced. Preserve this exact commit as the comparison point
when evaluating subsequent recognition changes.

The [current implementation guide](speech-current-implementation.md) documents this
runtime, its invariants, source components, diagnostics, and experimental boundaries.
