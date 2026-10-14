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

timing.setTtsRate(4);
const fastBoundary =
    timing.continuationPauseBoundaryMilliseconds;
const fastSeparation =
    timing.streamSeparationMilliseconds;
const fastDispatchDelay =
    timing.continuationDispatchDelayMilliseconds;

assert.equal(
    fastDispatchDelay,
    0,
    "At 100% speech rate continuation-capable phrases should have no extra dispatch delay."
);

timing.setTtsRate(2);
assert.equal(
    timing.continuationPauseBoundaryMilliseconds,
    fastBoundary,
    "Changing speech rate must not change the pause boundary."
);
assert.equal(
    timing.streamSeparationMilliseconds,
    fastSeparation,
    "Changing speech rate must not change repeatable-command stream separation."
);
assert.ok(
    timing.continuationDispatchDelayMilliseconds >
        fastDispatchDelay,
    "Slower speech should add only continuation dispatch delay."
);

const mediumDispatchDelay =
    timing.continuationDispatchDelayMilliseconds;

timing.setTtsRate(0.5);
assert.equal(
    timing.continuationPauseBoundaryMilliseconds,
    fastBoundary,
    "Very slow speech must retain the fast pause boundary."
);
assert.equal(
    timing.streamSeparationMilliseconds,
    fastSeparation,
    "Very slow speech must retain fast stream separation."
);
assert.ok(
    timing.continuationDispatchDelayMilliseconds >
        mediumDispatchDelay,
    "Very slow speech should allow a longer continuation dispatch hold."
);

const slowRateSnapshot =
    timing.snapshot;

timing.setTtsRate(4);
const fastRateSnapshot =
    timing.snapshot;

assert.equal(
    slowRateSnapshot.estimatedSpeechRate,
    fastRateSnapshot.estimatedSpeechRate,
    "Changing configured speech rate must not change the estimated user speech rate without new observations."
);
assert.notEqual(
    slowRateSnapshot.ttsPriorFactor,
    fastRateSnapshot.ttsPriorFactor,
    "Configured speech rate should still change only the continuation dispatch prior."
);

timing.setTtsRate(2);

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
