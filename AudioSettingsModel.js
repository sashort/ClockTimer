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

    function normalizeVoiceSelection(selection) {
        return {
            provider: typeof selection?.provider === "string" && selection.provider.trim()
                ? selection.provider.trim() : "system",
            voice: typeof selection?.voice === "string" ? selection.voice.trim() : ""
        };
    }

    function encodeVoiceSelection(provider, voice) {
        return String(provider || "system") + "|" + encodeURIComponent(String(voice || ""));
    }

    function decodeVoiceSelection(value) {
        const text = String(value || "");
        const separator = text.indexOf("|");
        if (separator < 0) return { provider: "system", voice: "" };
        let voice = "";
        try { voice = decodeURIComponent(text.slice(separator + 1)); } catch {}
        return { provider: text.slice(0, separator).trim() || "system", voice };
    }

    function audioCellUserEnabled(settings, announcement, layer, { ignoreMaster = false, overridesMaster = () => false } = {}) {
        const row = settings?.rows?.[announcement];
        const masterEnabled = ignoreMaster
            || overridesMaster(announcement, layer)
            || settings?.masters?.[layer] !== false;
        return Boolean(row && row.enabled !== false && masterEnabled && row[layer] !== -1);
    }

    function audioAnnouncementOutput({
        settings,
        announcement,
        rowOverride,
        language,
        speechStart,
        speechPauseAt1x = 300
    }) {
        const row = rowOverride || settings?.rows?.[announcement] || {};
        const custom = row.custom || {};
        const resolve = property => Object.prototype.hasOwnProperty.call(custom, property)
            ? custom[property]
            : settings?.[property];
        const speechVelocity = resolve("speechVelocity");
        return {
            lang: language,
            speechStart,
            speechVolume: resolve("volume"),
            toneVolume: resolve("volume") * CHIME_VOLUME_RATIO,
            speechVelocity,
            toneVelocity: resolve("toneVelocity"),
            speechDelayMs: speechPauseAt1x / Math.max(0.01, Number(speechVelocity) || 1)
        };
    }

    function create({ announcements = [], language = "en-US" } = {}) {
        function defaultAudioSettings() {
            const rows = {};
    
            for (const [key] of announcements) {
                rows[key] = {
                    enabled: true,
                    chime: 0,
                    summary: 0,
                    details: 0
                };
            }
    
            return {
                volume: 1,
                chimeRateVersion: 2,
                masterVelocity: 1,
                speechVelocity: 1,
                toneVelocity: 1,
                instrument: "",
                voices: {
                    [language]: {
                        provider:
                            "system",
                        voice:
                            ""
                    }
                },
                formalTime: false,
                masters: {
                    chime: true,
                    summary: true,
                    details: true
                },
                rows
            };
        }
    
        function normalizeAudioSettings(source) {
            const settings = defaultAudioSettings();
            const value =
                source && typeof source === "object"
                    ? source
                    : {};
            const clamp =
                (candidate, minimum, maximum, fallback) => {
                    const numeric = Number(candidate);
                    return Number.isFinite(numeric)
                        ? Math.max(minimum, Math.min(maximum, numeric))
                        : fallback;
                };
    
            settings.volume = clamp(value.volume ?? value.speechVolume ?? value.toneVolume, 0, 1, 1);
            settings.masterVelocity =
                clamp(value.masterVelocity, 0.5, 4, 1);
            settings.speechVelocity =
                clamp(
                    value.speechVelocity,
                    AUDIO_SPEECH_VELOCITY_MIN,
                    AUDIO_SPEECH_VELOCITY_MAX,
                    1
                );
            settings.toneVelocity =
                savedChimeRate(value.toneVelocity, value.chimeRateVersion);
            settings.instrument =
                typeof value.instrument ===
                    "string"
                    ? value.instrument.trim()
                    : "";
    
            settings.voices = {};
            const storedVoices =
                value.voices &&
                typeof value.voices ===
                    "object"
                    ? value.voices
                    : {};
    
            for (
                const [
                    language,
                    selection
                ] of Object.entries(
                    storedVoices
                )
            ) {
                if (
                    !language ||
                    !selection ||
                    typeof selection !==
                        "object"
                ) {
                    continue;
                }
    
                settings.voices[
                    language
                ] = {
                    provider:
                        typeof selection
                            .provider ===
                            "string" &&
                        selection.provider
                            .trim()
                            ? selection
                                .provider
                                .trim()
                            : "system",
                    voice:
                        typeof selection
                            .voice ===
                            "string"
                            ? selection.voice
                                .trim()
                            : ""
                };
            }
    
            settings.voices[
                language
            ] ||= {
                provider:
                    "system",
                voice:
                    ""
            };
    
            settings.formalTime =
                value.formalTime === true;
    
            for (const layer of ["chime", "summary", "details"]) {
                if (typeof value.masters?.[layer] === "boolean") {
                    settings.masters[layer] =
                        value.masters[layer];
                }
            }
    
            for (const [key] of announcements) {
                const row = value.rows?.[key];
                if (!row || typeof row !== "object") continue;
    
                if (typeof row.enabled === "boolean") {
                    settings.rows[key].enabled =
                        row.enabled;
                }
    
                for (const layer of ["chime", "summary", "details"]) {
                    if (row[layer] === -1 || row[layer] === 0) {
                        settings.rows[key][layer] =
                            row[layer];
                    }
                }
    
                if (
                    row.custom &&
                    typeof row.custom === "object"
                ) {
                    const custom = {};
    
                    const copyCustom =
                        (
                            property,
                            minimum,
                            maximum
                        ) => {
                            if (
                                !Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        row.custom,
                                        property
                                    )
                            ) {
                                return;
                            }
    
                            const numeric =
                                Number(
                                    row.custom[
                                        property
                                    ]
                                );
    
                            if (
                                !Number.isFinite(
                                    numeric
                                )
                            ) {
                                return;
                            }
    
                            custom[property] =
                                Math.max(
                                    minimum,
                                    Math.min(
                                        maximum,
                                        numeric
                                    )
                                );
                        };
    
                    const legacyVolume = row.custom.volume ?? row.custom.speechVolume ?? row.custom.toneVolume;
                    if (Number.isFinite(Number(legacyVolume))) {
                        custom.volume = clamp(legacyVolume, 0, 1, 1);
                    }
                    copyCustom(
                        "speechVelocity",
                        AUDIO_SPEECH_VELOCITY_MIN,
                        AUDIO_SPEECH_VELOCITY_MAX
                    );
                    copyCustom(
                        "toneVelocity",
                        0.5,
                        1.5
                    );
                    if (Object.prototype.hasOwnProperty.call(custom, "toneVelocity")) {
                        custom.toneVelocity = savedChimeRate(custom.toneVelocity, value.chimeRateVersion);
                    }
    
                    if (
                        Object.keys(
                            custom
                        ).length
                    ) {
                        settings.rows[key]
                            .custom =
                            custom;
                    }
                }
            }
    
            return settings;
        }

        function read(raw) {
            try {
                return normalizeAudioSettings(raw ? JSON.parse(raw) : undefined);
            } catch {
                return defaultAudioSettings();
            }
        }

        function serialize(settings) {
            return JSON.stringify(settings);
        }

        return Object.freeze({ defaultAudioSettings, normalizeAudioSettings, read, serialize });
    }

    root.WMOFAudioSettingsModel = Object.freeze({
        create,
        normalizeVoiceSelection,
        encodeVoiceSelection,
        decodeVoiceSelection,
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
        stepAudioVolume,
        audioCellUserEnabled,
        audioAnnouncementOutput
    });
})(globalThis);
