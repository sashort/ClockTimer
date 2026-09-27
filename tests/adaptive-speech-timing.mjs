import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
    new URL("../AdaptiveSpeechTiming.js", import.meta.url),
    "utf8"
);

const factory =
    new Function(
        source +
        "\nreturn globalThis.AdaptiveSpeechTiming;"
    );

const AdaptiveSpeechTiming =
    factory();

const timing =
    new AdaptiveSpeechTiming({
        continuationPauseMeanMs: 400,
        continuationPauseVarianceMs2: 6400,
        continuationPauseSamples: 50,
        streamSeparationMeanMs: 800,
        streamSeparationVarianceMs2: 14400,
        streamSeparationSamples: 20
    });

assert.equal(
    timing.snapshot.tripActive,
    false
);

const neutralGrace =
    timing.continuationGraceMilliseconds;

timing.setTtsRate(2);
const fastTtsGrace =
    timing.continuationGraceMilliseconds;

assert.ok(
    fastTtsGrace <
    neutralGrace,
    "A faster TTS rate should shorten only the weak prior."
);

assert.equal(
    timing.startTrip(),
    true
);

for (
    const pause of
        [280, 300, 290, 310, 295, 285]
) {
    assert.equal(
        timing.observeContinuationPause(
            pause,
            {
                source:
                    "test"
            }
        ),
        true
    );
}

const learned =
    timing.snapshot;

assert.equal(
    learned.trip
        .continuationPauseSamples,
    6
);
assert.ok(
    learned
        .continuationConfidence >
    0.5
);
assert.ok(
    learned
        .effectiveContinuationMeanMs <
    350
);
assert.ok(
    learned
        .estimatedSpeechRate >
    1
);

const persisted =
    timing.finishTrip();

assert.ok(
    persisted
        .continuationPauseSamples >
    50
);
assert.ok(
    persisted
        .continuationPauseMeanMs <
    400
);
assert.equal(
    timing.snapshot.tripActive,
    false
);

timing.startTrip();
const inheritedGrace =
    timing.continuationGraceMilliseconds;

timing.observeContinuationPause(
    650
);
timing.observeContinuationPause(
    630
);
timing.observeContinuationPause(
    670
);

assert.ok(
    timing
        .continuationGraceMilliseconds >
    inheritedGrace,
    "A new trip should adapt quickly away from its weak inherited prior."
);

assert.equal(
    timing.observeContinuationPause(
        5000
    ),
    false,
    "Outlier pauses outside the training window are ignored."
);

console.log(
    "adaptive speech timing tests passed"
);
