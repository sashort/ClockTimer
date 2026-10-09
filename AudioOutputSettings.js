/* Applies normalized audio settings to the shared audio runtime. */
(function (root) {
    "use strict";

    function apply({ settings, voiceSelection, language, audio = root.WMOFAudio,
        chimeVolumeRatio = 0.5, syncAdaptiveTimingRate = () => {} } = {}) {
        if (!settings) throw new TypeError("Audio settings are required.");
        const voice = voiceSelection || { provider: "system", voice: "" };
        audio?.configureOutput?.({
            speechVolume: settings.volume,
            toneVolume: settings.volume * chimeVolumeRatio,
            speechVelocity: settings.speechVelocity,
            toneVelocity: settings.toneVelocity,
            instrument: settings.instrument,
            speechLanguage: language,
            voiceProvider: voice.provider,
            voice: voice.voice
        });
        syncAdaptiveTimingRate();
    }

    root.WMOFAudioOutputSettings = Object.freeze({ apply });
})(globalThis);
