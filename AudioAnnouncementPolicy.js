/* Application-specific policy adapter for announcement enablement and output. */
(function (root) {
    "use strict";

    function cellEnabled({ model = root.WMOFAudioSettingsModel, settings, announcement, layer, options = {}, overridesMaster } = {}) {
        return model.audioCellUserEnabled(settings, announcement, layer, {
            ...options,
            overridesMaster
        });
    }

    function output({ model = root.WMOFAudioSettingsModel, settings, announcement, rowOverride,
        language, speechStart, speechPauseAt1x = 300 } = {}) {
        return model.audioAnnouncementOutput({
            settings, announcement, rowOverride, language, speechStart, speechPauseAt1x
        });
    }

    root.WMOFAudioAnnouncementPolicy = Object.freeze({ cellEnabled, output });
})(globalThis);
