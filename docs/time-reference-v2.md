# Time readback and reference tone: Version 2 implementation contract

Status: implemented on `pocketsphinx-experiment`. Automated
evidence is listed below. Actual system-voice playback and physical output timing
still need verification on the target devices.

## Required user experience

The `time` / `how long` command says only a positional duration, for example
**"twenty-two fifty-six"**, then sounds the approved reference tone when that
duration remains. Never say "at the tone", "minutes", "seconds" or "hours".
This wording overrides the formal-time preference for this specific readback.

For Break, Lunch and Down time, the amount is fixed: play the chime first,
wait for its completion, then speak the current duration once. This path has no
future projection or scheduled performance deadline. A running trip retains the
speech-then-reference-tone sequence.

The reference is the **first attack** of the song, not its end or fading tail.
`time-reference` is the approved D5 note on `cinematic-pulse-bass`, BPM 300,
length one beat (nominally 200 ms), dynamic `mf`. It has no preceding note,
bend, spoken catalog summary or setting-change chime. Chime rate can change its
length; it must not change the reference instant. Use the defined instrument,
not the user's alternative instrument selection. Existing volume and announcement
layer settings continue to apply.

Positional examples: `22:56` -> "twenty-two fifty-six"; `22:00` ->
"twenty-two oh oh"; `1:05:09` -> "one oh five oh nine"; `0:30` -> "thirty".
Negative remaining time uses "minus" before the duration to retain its sign.

## Responsibilities and source map

| Component | Owns | Must not own |
| --- | --- | --- |
| `SpeechDurationEstimator.js` | Conservative text/voice/rate estimates and bounded in-memory playback measurements | Timer state, playback, recognition or network storage |
| `ToneReferencedAnnouncement.js` | Future target selection, whole-second alignment, speech completion, deadline retry and cancellation through the cue | Language wording, timer math, audio hardware |
| `app.js`: `formatToneReadback` | Positional English wording and Mic Bar code display | Scheduling or speech-length prediction |
| `app.js`: `readTimeAtTone` | Clock projection, settings, one semantic queue component, adapter callbacks and action response | Instrument synthesis or learned duration model |
| `WMOFActions.readTimeRemaining` | Delegates the public Time action to the readback adapter | An independent second implementation |
| `api/audio/AudioEngine.js`: `startSong` | Conversion from a performance deadline into Web Audio's clock and cancellable song nodes | Choosing the duration to announce |
| Audio and announcement catalogs | Approved song, stable announcement identity (type ID 27), layer controls | Runtime target timestamps |

Load the estimator before the coordinator. The speech runtime loader and asset
cache list include both classes. The test lifecycle loader follows the same order.
Keep these reusable classes separate from the existing rejection-cue class.

## Clock and duration calculation

At invocation, capture a wall-clock/performance-clock pair `wall0`, `perf0`.
For performance timestamp `p`, project the timer at
`new Date(wall0 + p - perf0)`. This fixes the relationship for this request and
avoids calculating elapsed audio time from repeated wall-clock reads.

The adapter reads `ClockTimer.getSummarySnapshot(projectedDate).selected`, so
the active trip/standard/total scope and counted-time accounting remain with
ClockTimer. The signed remaining duration in milliseconds is:

```text
remaining(p) = selected.standardTimeMilliseconds / selected.percentGoal
               - selected.countedTimeElapsedMilliseconds
```

Do not calculate from formatted `getRenderedTime()` strings: they lose subsecond
precision and may be aligned to a display cadence. Do not advance the model tick
or persist a future state to predict a tone. Snapshot projection is a query.
Missing standard/count/goal values return an unavailable action rather than a
fabricated duration.

## Estimating announcement duration, including speech speed

The current AudioEngine uses system `SpeechSynthesisUtterance`; it provides
completion callbacks, not a prepared PCM buffer with an exact duration. A character
count alone cannot provide exact timing. The estimator therefore combines a
conservative initial model with observed successful playback:

```text
effectiveRate = explicitRate(default 1) * clamp(speechVelocity, 0.5, 4)
profileKey = [language, voiceProvider, selectedVoice, effectiveRate, pitch]
```

The model bounds effective rate to the engine/browser rate range. The initial
estimate weights words and vowel groups, scales speech units by effective rate,
and includes a fixed startup allowance. This is an English-oriented heuristic,
not a linguistic phoneme-duration model. Fast and slow settings use separate
profiles. Actual measurements also remain separate for different voices, languages
and pitches. A change of voice or speed must not inherit incompatible observations.

After a successful spoken phrase, measure elapsed **request-to-completion** time
using the performance clock. Learn a smoothed per-unit rate for unfamiliar phrases;
remember a measured exact phrase with a safety multiplier for repeats. Including
startup/queue latency is intentionally conservative. Rejected, cancelled, empty,
nonfinite, implausibly short or excessively long measurements do not train it.
Storage is bounded to 32 profiles and 128 phrases per profile and stays in memory.
No conversation text, phrases or measurements are uploaded or persisted by this class.

If Version 2 later supports preparing speech audio, use the prepared audio buffer's
duration as an estimator adapter. Keep the completion and cancellation safeguards:
knowing duration does not eliminate playback errors or a cancelled request.

## Solve target time and wording together

An estimated announcement changes which duration will remain at its end; that
duration can change the words and therefore the estimate. Resolve that dependency
before starting playback:

1. Record when this queue component actually starts. Never estimate from the time
   the command entered a busy announcement queue.
2. Pick a prospective target, with a 180 ms speech-to-tone gap and 400 ms extra
   allowance by default.
3. Project the signed remaining duration at that target and format its exact words.
4. Estimate those words using the selected voice and effective rate.
5. Extend the target if speech plus gap and allowance need more time. Align moving
   countdowns with an exact whole remaining second, then recalculate the words.
6. Repeat with a bounded loop (12 iterations). Only extend targets, preventing
   oscillation when different wording falls across a minute/hour boundary.

Whole-second alignment uses the projected value and its slope. For a countdown
moving at -1 millisecond per millisecond, move the target forward until the value
reaches the next lower multiple of 1000. The same rule works through zero and
into negative remaining time. A frozen/nonlinear projection does not pretend it
has that slope. The formatted display rounds its signed value to whole seconds.

## Playback sequence, ownership and overruns

```mermaid
sequenceDiagram
    participant Queue as Semantic announcement queue
    participant Readback as ToneReferencedAnnouncement
    participant Speech as System speech
    participant Audio as AudioEngine
    Queue->>Readback: start one atomic component
    Readback->>Readback: project, format, estimate, align target
    Readback->>Speech: speak duration only
    Speech-->>Readback: actual successful completion
    alt speech ended with gap remaining and projection unchanged
        Readback->>Audio: startSong(time-reference, startAtPerformanceMs)
        Audio-->>Readback: cancellable scheduled handle
        Audio->>Audio: first note at reference instant
    else late speech or changed projection
        Readback->>Readback: learn timing; abandon the missed cue
        Note over Readback: App does not automatically speak a second time
    end
    Readback-->>Queue: finished or cancelled
```

Speech must complete successfully before `play` is called. Do not use an estimate
as a substitute for the speech engine's `onEnd` callback. `onError` and a refusal
to start return failure, preventing a cue. If real speech leaves less than the
gap, or the target projection changes by more than 2 ms, discard that target.
The reusable class permits retries, but the app explicitly uses `maxAttempts:1`
and a conservative 1500 ms margin. One invocation never automatically speaks a
second duration. A missed deadline trains the estimator for the next request and
produces no misleading late cue.

The app keeps speech, gap and cue in **one semantic queue component**, so ordinary
queued announcements cannot interleave between them. Repeated Time requests in
the same scope share an in-flight readback, preventing duplicate queued speech.
A changed timer status, interval identity, selected mode or disabled audio layer
invalidates its owner. The coordinator checks its guard during scheduling
and every 40 ms through song completion, stopping a pending/playing song if the
owner becomes invalid. A projection that changes before the attack also stops it.
Do not stop all audio or cancel unrelated announcements as part of this ownership.

`run` accepts `{valueAt, format, speak, play, profile, guard, onPlan, reference,
gapMs, marginMs, maxAttempts}`. `reference:"before"` selects fixed-value,
chime-then-speech playback; the default `"after"` selects a future time cue. `speak(text)` resolves strictly `true` only on successful
completion. `play(plan)` returns `{finished, stop}` or `null` for a missed audio
deadline. `onPlan` receives `{at,value,text,attempt}`. The result contains
`performed`, the final plan on success, or a reason on cancellation/failure.
Inject `now` and `wait` into the constructor for deterministic tests.

## Scheduling the audible reference

`AudioEngine.startSong(name, {startAtPerformanceMs, ...existingOptions})` accepts
an absolute performance timestamp. After catalog/context preparation it refuses
to schedule if fewer than 35 ms remain, returning `null`. A nonfinite timestamp
is a programming error. The coordinator can retry a missed setup deadline.

When `AudioContext.getOutputTimestamp()` supplies a usable pair:

```text
audioStart = outputTimestamp.contextTime
             + (targetPerformanceMs - outputTimestamp.performanceTime) / 1000
```

Otherwise use `context.currentTime + (targetPerformanceMs - performance.now())/1000`.
Require at least 15 ms of Web Audio scheduling lead. The cue's zero-offset note
uses this start time and remains cancellable through its normal song handle.
Calls without a deadline retain the existing `currentTime + 15 ms` behavior.

Output timestamps improve clock alignment but cannot promise identical physical
arrival time across speakers, Bluetooth devices, OS speech engines and browser
implementations. The fallback does not compensate for an unknown output latency.
Verify this on devices; keep an output-latency calibration policy separate from
text-duration estimation. Do not claim that millisecond scheduling equals measured
millisecond acoustic accuracy.

## Settings and display behavior

With both summary and chime enabled, use the full synchronized sequence. With
summary alone, speak the current duration without claiming a future tone reference.
With chime alone, play the cue without an announcement. Both disabled still return
a Mic Bar dictation value without audio. Semantic suppression is consumed once per
request, not again for each retry. The chosen voice, rate and volume remain the
existing audio settings; Time has its own configurable announcement row.

The action returns an accepted result immediately with a deferred presentation:
`{speechResponse: Promise<DictationResponse | undefined>}`. SpeechMenu's logical
command queue and transaction settlement do not wait for that promise. Its
presentation completion awaits the actual plan and then creates the normal Mic
Bar result column. An invalidated plan resolves without a result. This generic
protocol separates optional presentation from command completion; it is not a
second Time-command parser or recognition queue.

The app's one in-flight request coalesces repeated requests while its audio is
queued or playing. Already-speaking OS speech has no per-call stop handle; scope
changes suppress its obsolete cue. Keep unrelated audio ownership intact.

## Verification and acceptance

- `node tests/tone-referenced-announcement.mjs`: rate adjustment, profile isolation,
  observed durations, whole-second alignment, optional retry, app single-attempt
  behavior, fixed-value chime-first ordering, cancellation and approved song.
- `node tests/scheduled-audio-cue.mjs`: actual AudioEngine scheduling through a
  recording AudioContext adapter, output-timestamp/fallback mappings, stale-deadline
  silence, cancellation and ordinary-song compatibility.
- `node tests/app-state-transactions.mjs --time-reference --voice-feedback`: actual
  Time action, future duration wording without units/preamble, approved instrument,
  scheduled performance deadline, absence of a setting-change cue and released locks.
- `--time-reference-voice --voice-feedback`: first spoken Time completes without
  needing a second utterance and produces one spoken readback.
- `--time-reference-paused --voice-feedback`: Break/Lunch/Down chime first,
  duration second, and repeated pending requests share one readback.
- `--deferred-readback --voice-feedback`: an earlier held audio component cannot
  block Time command commitment or a later Down action.

Version 2 acceptance must additionally cover short/long phrases; voice, speed and
pitch changes; minute/hour/zero crossings; overtime; counted-time pauses and scope
changes; a busy announcement queue; speech error/cancel; audio resume/setup delay;
repeat Time; muted layers; and real-device latency. Pure tests use injected clocks
and playback callbacks. They prove coordination, not microphone or acoustic accuracy.
