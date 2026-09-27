"use strict";

class AdaptiveSpeechTiming {
    static DEFAULT_CONTINUATION_MEAN_MS = 420;
    static DEFAULT_CONTINUATION_VARIANCE_MS2 = 6400;
    static DEFAULT_STREAM_SEPARATION_MEAN_MS = 760;
    static DEFAULT_STREAM_SEPARATION_VARIANCE_MS2 = 14400;
    static MIN_CONTINUATION_GRACE_MS = 220;
    static MAX_CONTINUATION_GRACE_MS = 900;
    static MIN_STREAM_SEPARATION_MS = 420;
    static MAX_STREAM_SEPARATION_MS = 1800;
    static PRIOR_EQUIVALENT_SAMPLES = 3;
    static MAX_RECENT_PAUSES = 12;

    #baseline;
    #trip;
    #tripActive = false;
    #ttsRate = 1;
    #recentPauses = [];
    #updatedAt;

    constructor(profile = {}) {
        this.#baseline = {
            continuation:
                this.#profileStats(
                    profile,
                    "continuation"
                ),
            separation:
                this.#profileStats(
                    profile,
                    "separation"
                )
        };
        this.#trip = this.#emptyTrip();
        this.#updatedAt =
            Number(profile?.updatedAt) ||
            undefined;
    }

    #emptyStats() {
        return {
            meanMs: undefined,
            varianceMs2: undefined,
            samples: 0,
            m2: 0
        };
    }

    #emptyTrip() {
        return {
            continuation:
                this.#emptyStats(),
            separation:
                this.#emptyStats()
        };
    }

    #number(value) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : undefined;
    }

    #profileStats(profile, type) {
        const prefix =
            type === "continuation"
                ? "continuationPause"
                : "streamSeparation";

        const mean =
            this.#number(
                profile?.[
                    prefix +
                    "MeanMs"
                ]
            );
        const variance =
            this.#number(
                profile?.[
                    prefix +
                    "VarianceMs2"
                ]
            );
        const samples =
            Math.max(
                0,
                Math.floor(
                    this.#number(
                        profile?.[
                            prefix +
                            "Samples"
                        ]
                    ) ||
                    0
                )
            );

        return {
            meanMs:
                mean !== undefined &&
                mean >= 0
                    ? mean
                    : undefined,
            varianceMs2:
                variance !== undefined &&
                variance >= 0
                    ? variance
                    : undefined,
            samples,
            m2:
                (
                    variance !== undefined &&
                    variance >= 0
                        ? variance
                        : 0
                ) *
                Math.max(
                    0,
                    samples - 1
                )
        };
    }

    configureProfile(profile = {}) {
        this.#baseline = {
            continuation:
                this.#profileStats(
                    profile,
                    "continuation"
                ),
            separation:
                this.#profileStats(
                    profile,
                    "separation"
                )
        };

        this.#updatedAt =
            Number(profile?.updatedAt) ||
            this.#updatedAt;

        return this.snapshot;
    }

    setTtsRate(value) {
        const number =
            Number(value);

        if (!Number.isFinite(number)) {
            return this.#ttsRate;
        }

        this.#ttsRate =
            Math.max(
                0.5,
                Math.min(
                    4,
                    number
                )
            );

        return this.#ttsRate;
    }

    startTrip() {
        if (this.#tripActive) {
            return false;
        }

        this.#tripActive = true;
        this.#trip = this.#emptyTrip();
        this.#recentPauses = [];

        return true;
    }

    finishTrip() {
        if (!this.#tripActive) {
            return this.serializeProfile();
        }

        this.#mergeTripIntoBaseline(
            "continuation"
        );
        this.#mergeTripIntoBaseline(
            "separation"
        );

        this.#tripActive = false;
        this.#updatedAt = Date.now();

        const profile =
            this.serializeProfile();

        this.#trip = this.#emptyTrip();

        return profile;
    }

    resetTrip() {
        this.#tripActive = false;
        this.#trip = this.#emptyTrip();
        this.#recentPauses = [];
    }

    #record(type, milliseconds, source) {
        if (!this.#tripActive) {
            return false;
        }

        const value =
            Number(milliseconds);

        if (
            !Number.isFinite(value) ||
            value < 70 ||
            value > 2500
        ) {
            return false;
        }

        const stats =
            this.#trip[type];

        stats.samples++;

        if (stats.samples === 1) {
            stats.meanMs = value;
            stats.varianceMs2 = 0;
            stats.m2 = 0;
        }
        else {
            const delta =
                value -
                stats.meanMs;

            stats.meanMs +=
                delta /
                stats.samples;

            const delta2 =
                value -
                stats.meanMs;

            stats.m2 +=
                delta *
                delta2;

            stats.varianceMs2 =
                stats.m2 /
                Math.max(
                    1,
                    stats.samples - 1
                );
        }

        this.#recentPauses.push({
            type,
            milliseconds:
                Math.round(value),
            source:
                String(
                    source ||
                    "speech"
                ),
            at:
                Date.now()
        });

        if (
            this.#recentPauses.length >
            AdaptiveSpeechTiming
                .MAX_RECENT_PAUSES
        ) {
            this.#recentPauses.splice(
                0,
                this.#recentPauses.length -
                    AdaptiveSpeechTiming
                        .MAX_RECENT_PAUSES
            );
        }

        return true;
    }

    observeContinuationPause(
        milliseconds,
        {
            source = "speech"
        } = {}
    ) {
        return this.#record(
            "continuation",
            milliseconds,
            source
        );
    }

    observeStreamSeparation(
        milliseconds,
        {
            source = "speech"
        } = {}
    ) {
        return this.#record(
            "separation",
            milliseconds,
            source
        );
    }

    #ttsPriorFactor(
        rate = this.#ttsRate
    ) {
        const factor =
            1 -
            0.16 *
                Math.log2(
                    rate
                );

        return Math.max(
            0.75,
            Math.min(
                1.18,
                factor
            )
        );
    }

    #effective(
        type,
        {
            priorFactor =
                this.#ttsPriorFactor()
        } = {}
    ) {
        const isContinuation =
            type === "continuation";
        const baseline =
            this.#baseline[type];
        const observed =
            this.#trip[type];

        const defaultMean =
            isContinuation
                ? AdaptiveSpeechTiming
                    .DEFAULT_CONTINUATION_MEAN_MS
                : AdaptiveSpeechTiming
                    .DEFAULT_STREAM_SEPARATION_MEAN_MS;
        const defaultVariance =
            isContinuation
                ? AdaptiveSpeechTiming
                    .DEFAULT_CONTINUATION_VARIANCE_MS2
                : AdaptiveSpeechTiming
                    .DEFAULT_STREAM_SEPARATION_VARIANCE_MS2;

        const baselineMean =
            Number.isFinite(
                baseline.meanMs
            ) &&
            baseline.samples > 0
                ? baseline.meanMs
                : defaultMean;
        const baselineVariance =
            Number.isFinite(
                baseline.varianceMs2
            ) &&
            baseline.samples > 1
                ? baseline.varianceMs2
                : defaultVariance;

        const priorMean =
            baselineMean *
            priorFactor;

        const observedSamples =
            observed.samples;
        const priorWeight =
            AdaptiveSpeechTiming
                .PRIOR_EQUIVALENT_SAMPLES;
        const confidence =
            observedSamples > 0
                ? observedSamples /
                    (
                        observedSamples +
                        priorWeight
                    )
                : 0;

        const meanMs =
            observedSamples > 0
                ? (
                    priorMean *
                        (1 - confidence) +
                    observed.meanMs *
                        confidence
                )
                : priorMean;

        const observedVariance =
            observedSamples > 1
                ? observed.varianceMs2
                : baselineVariance;

        const varianceMs2 =
            baselineVariance *
                (1 - confidence) +
            observedVariance *
                confidence;

        return {
            meanMs,
            varianceMs2:
                Math.max(
                    0,
                    varianceMs2
                ),
            confidence,
            priorMeanMs:
                priorMean,
            priorFactor,
            baselineMeanMs:
                baselineMean,
            observedSamples
        };
    }

    #continuationWindowMilliseconds(
        priorFactor
    ) {
        const effective =
            this.#effective(
                "continuation",
                {
                    priorFactor
                }
            );
        const deviation =
            Math.sqrt(
                effective
                    .varianceMs2
            );
        const earlyTripMargin =
            80 *
            (
                1 -
                effective
                    .confidence
            );
        const raw =
            effective.meanMs +
            deviation *
                1.1 +
            earlyTripMargin;

        return Math.round(
            Math.max(
                AdaptiveSpeechTiming
                    .MIN_CONTINUATION_GRACE_MS,
                Math.min(
                    AdaptiveSpeechTiming
                        .MAX_CONTINUATION_GRACE_MS,
                    raw
                )
            )
        );
    }

    get continuationPauseBoundaryMilliseconds() {
        /*
         * Pause detection intentionally uses the fastest supported
         * speech-rate prior. Changing TTS speed must not make the
         * recognizer slower to notice that the user stopped speaking.
         * Fresh user pause samples still adapt this boundary.
         */
        return this
            .#continuationWindowMilliseconds(
                this.#ttsPriorFactor(
                    4
                )
            );
    }

    get continuationDispatchDelayMilliseconds() {
        /*
         * Slower speech changes only how long a continuation-capable
         * exact phrase is held after the pause boundary. At 100% speech
         * rate this delay is zero. This preserves immediate dispatch for
         * fully-qualified terminal commands.
         */
        const rateWindow =
            this
                .#continuationWindowMilliseconds(
                    this.#ttsPriorFactor()
                );

        return Math.max(
            0,
            rateWindow -
                this
                    .continuationPauseBoundaryMilliseconds
        );
    }

    get continuationGraceMilliseconds() {
        return (
            this
                .continuationPauseBoundaryMilliseconds +
            this
                .continuationDispatchDelayMilliseconds
        );
    }

    get streamSeparationMilliseconds() {
        const effective =
            this.#effective(
                "separation",
                {
                    priorFactor:
                        this.#ttsPriorFactor(
                            4
                        )
                }
            );
        const deviation =
            Math.sqrt(
                effective
                    .varianceMs2
            );
        const raw =
            effective.meanMs +
            deviation *
                1.25;

        return Math.round(
            Math.max(
                AdaptiveSpeechTiming
                    .MIN_STREAM_SEPARATION_MS,
                Math.min(
                    AdaptiveSpeechTiming
                        .MAX_STREAM_SEPARATION_MS,
                    raw
                )
            )
        );
    }

    #mergeTripIntoBaseline(type) {
        const observed =
            this.#trip[type];

        if (
            !observed.samples ||
            !Number.isFinite(
                observed.meanMs
            )
        ) {
            return false;
        }

        const baseline =
            this.#baseline[type];

        if (
            !baseline.samples ||
            !Number.isFinite(
                baseline.meanMs
            )
        ) {
            baseline.meanMs =
                observed.meanMs;
            baseline.varianceMs2 =
                observed.samples > 1
                    ? observed.varianceMs2
                    : 0;
            baseline.samples =
                observed.samples;
            baseline.m2 =
                (
                    baseline
                        .varianceMs2 ||
                    0
                ) *
                Math.max(
                    0,
                    baseline.samples - 1
                );

            return true;
        }

        const alpha =
            Math.min(
                0.25,
                0.05 +
                    observed.samples *
                        0.02
            );
        const oldMean =
            baseline.meanMs;
        const nextMean =
            oldMean *
                (1 - alpha) +
            observed.meanMs *
                alpha;
        const baselineVariance =
            Number.isFinite(
                baseline.varianceMs2
            )
                ? baseline.varianceMs2
                : 0;
        const observedVariance =
            Number.isFinite(
                observed.varianceMs2
            )
                ? observed.varianceMs2
                : baselineVariance;
        const meanDelta =
            observed.meanMs -
            oldMean;

        baseline.meanMs =
            nextMean;
        baseline.varianceMs2 =
            Math.max(
                0,
                baselineVariance *
                    (1 - alpha) +
                observedVariance *
                    alpha +
                meanDelta *
                    meanDelta *
                    alpha *
                    (1 - alpha)
            );
        baseline.samples =
            Math.min(
                4294967295,
                baseline.samples +
                    observed.samples
            );
        baseline.m2 =
            baseline.varianceMs2 *
            Math.max(
                0,
                baseline.samples - 1
            );

        return true;
    }

    serializeProfile() {
        const continuation =
            this.#baseline
                .continuation;
        const separation =
            this.#baseline
                .separation;

        return {
            continuationPauseMeanMs:
                continuation.samples
                    ? Math.round(
                        continuation.meanMs
                    )
                    : null,
            continuationPauseVarianceMs2:
                continuation.samples
                    ? Math.round(
                        continuation
                            .varianceMs2 ||
                        0
                    )
                    : null,
            continuationPauseSamples:
                continuation.samples,
            streamSeparationMeanMs:
                separation.samples
                    ? Math.round(
                        separation.meanMs
                    )
                    : null,
            streamSeparationVarianceMs2:
                separation.samples
                    ? Math.round(
                        separation
                            .varianceMs2 ||
                        0
                    )
                    : null,
            streamSeparationSamples:
                separation.samples,
            updatedAt:
                this.#updatedAt ||
                null
        };
    }

    get snapshot() {
        const continuation =
            this.#effective(
                "continuation"
            );
        const separation =
            this.#effective(
                "separation"
            );
        const continuationDeviation =
            Math.sqrt(
                continuation
                    .varianceMs2
            );
        const estimatedSpeechRate =
            AdaptiveSpeechTiming
                .DEFAULT_CONTINUATION_MEAN_MS /
            Math.max(
                1,
                continuation.meanMs
            );

        return {
            tripActive:
                this.#tripActive,
            ttsRate:
                this.#ttsRate,
            ttsPriorFactor:
                continuation.priorFactor,
            continuationPauseBoundaryMs:
                this.continuationPauseBoundaryMilliseconds,
            continuationDispatchDelayMs:
                this.continuationDispatchDelayMilliseconds,
            continuationGraceMs:
                this.continuationGraceMilliseconds,
            streamSeparationMs:
                this.streamSeparationMilliseconds,
            estimatedSpeechRate:
                Math.max(
                    0.5,
                    Math.min(
                        3,
                        estimatedSpeechRate
                    )
                ),
            effectiveContinuationMeanMs:
                continuation.meanMs,
            effectiveContinuationDeviationMs:
                continuationDeviation,
            continuationConfidence:
                continuation.confidence,
            baseline:
                this.serializeProfile(),
            trip: {
                continuationPauseMeanMs:
                    this.#trip
                        .continuation
                        .meanMs ??
                    null,
                continuationPauseVarianceMs2:
                    this.#trip
                        .continuation
                        .varianceMs2 ??
                    null,
                continuationPauseSamples:
                    this.#trip
                        .continuation
                        .samples,
                streamSeparationMeanMs:
                    this.#trip
                        .separation
                        .meanMs ??
                    null,
                streamSeparationVarianceMs2:
                    this.#trip
                        .separation
                        .varianceMs2 ??
                    null,
                streamSeparationSamples:
                    this.#trip
                        .separation
                        .samples
            },
            effective: {
                continuation,
                separation
            },
            recentPauses:
                this.#recentPauses
                    .map(
                        entry => ({
                            ...entry
                        })
                    )
        };
    }
}

globalThis.AdaptiveSpeechTiming =
    AdaptiveSpeechTiming;
