/* Pure normalization and scale conversion for audio settings controls. */
(function (root) {
    "use strict";

    const CHIME_VOLUME_RATIO = 0.5;
    const AUDIO_PERCENT_STEP = 5;
    const AUDIO_SPEECH_VELOCITY_MIN = 0.5;
    const AUDIO_SPEECH_VELOCITY_MAX = 2.8;
    const CHIME_RATES = Object.freeze([
        Object.freeze({ label: "Slow", value: 0.8 }),
        Object.freeze({ label: "Medium", value: 1 }),
        Object.freeze({ label: "Fast", value: 1.2 })
    ]);

    function normalizeChimeRate(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1;
        return CHIME_RATES.reduce((nearest, rate) =>
            Math.abs(rate.value - numeric) < Math.abs(nearest - numeric)
                ? rate.value : nearest, 1);
    }

    function savedChimeRate(value, version) {
        if (version === 2 || value === undefined) return normalizeChimeRate(value);
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1;
        const oldRates = [1, 1.25, 1.5];
        const nearest = oldRates.reduce((best, rate) =>
            Math.abs(rate - numeric) < Math.abs(best - numeric) ? rate : best, 1);
        return normalizeChimeRate(nearest / 1.25);
    }

    function formatChimeRate(value) {
        return CHIME_RATES.find(rate => rate.value === normalizeChimeRate(value)).label;
    }

    function audioVelocityPercent(value, maximum) {
        const numeric = Number(value);
        const limit = Number(maximum);
        if (!Number.isFinite(numeric) || !Number.isFinite(limit) || limit <= 0) return 0;
        return Math.max(0, Math.min(100, numeric / limit * 100));
    }

    function formatAudioVelocityPercent(value, maximum) {
        return Math.round(audioVelocityPercent(value, maximum)) + "%";
    }

    function stepAudioVelocity(value, minimum, maximum, deltaPercent) {
        const floorPercent = Number(minimum) / Number(maximum) * 100;
        const nextPercent = Math.max(
            floorPercent,
            Math.min(100, audioVelocityPercent(value, maximum) + Number(deltaPercent))
        );
        return Number((Number(maximum) * nextPercent / 100).toFixed(6));
    }

    function audioVelocityAtPercent(percent, minimum, maximum) {
        const requested = Math.max(0, Math.min(100, Number(percent)));
        return Number(Math.max(
            Number(minimum),
            Number(maximum) * requested / 100
        ).toFixed(6));
    }

    function audioVolumeAtPercent(percent) {
        return Number((Math.max(0, Math.min(100, Number(percent))) / 100).toFixed(6));
    }

    function stepAudioVolume(value, deltaPercent) {
        const current = Number.isFinite(Number(value)) ? Number(value) * 100 : 100;
        const next = Math.max(0, Math.min(100, current + Number(deltaPercent)));
        return Number((next / 100).toFixed(6));
    }

    root.WMOFAudioSettingsModel = Object.freeze({
        CHIME_VOLUME_RATIO,
        AUDIO_PERCENT_STEP,
        AUDIO_SPEECH_VELOCITY_MIN,
        AUDIO_SPEECH_VELOCITY_MAX,
        CHIME_RATES,
        normalizeChimeRate,
        savedChimeRate,
        formatChimeRate,
        audioVelocityPercent,
        formatAudioVelocityPercent,
        stepAudioVelocity,
        audioVelocityAtPercent,
        audioVolumeAtPercent,
        stepAudioVolume
    });
})(globalThis);
