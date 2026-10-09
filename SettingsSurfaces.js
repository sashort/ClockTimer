/* Shared settings-surface contract for host dialogs and the embedded settings document. */
(function (root) {
    "use strict";
    const ids = Object.freeze([
        "graphicalSettingsDialog",
        "audioSettingsDialog",
        "audioAnnouncementsDialog",
        "stateSettingsDialog",
        "tripSettingsDialog"
    ]);
    const valid = new Set(ids);

    function normalize(value) {
        return valid.has(value) ? value : "graphicalSettingsDialog";
    }

    function contextFor(parent, surface) {
        const base = root.ClockTimerContext?.normalize(parent || {}) || parent || {};
        return root.ClockTimerContext?.child(base, {
            surface: normalize(surface),
            presentation: "graphical-settings",
            features: ["settings"],
            capabilities: {
                speechMenu: false,
                speechRecognition: false,
                audioAnnouncements: false,
                loginFlow: false,
                calendarStartup: false,
                liveStream: false
            }
        }) || { ...base, surface: normalize(surface), presentation: "graphical-settings" };
    }

    root.ClockTimerSettingsSurfaces = Object.freeze({ ids, isValid: value => valid.has(value), normalize, contextFor });
})(globalThis);
