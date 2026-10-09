/* Pure trip-preference normalization, kept independent of DOM and storage. */
(function (root) {
    "use strict";

    const defaults = Object.freeze({
        lateBreakBehavior: "showLateWindow",
        syncGoals: false
    });

    function normalize(value) {
        const stored = value && typeof value === "object" ? value : {};
        return {
            lateBreakBehavior: stored.lateBreakBehavior === "autoRestartTrip"
                ? "autoRestartTrip"
                : defaults.lateBreakBehavior,
            syncGoals: Boolean(stored.syncGoals ?? defaults.syncGoals)
        };
    }

    function read(raw) {
        try {
            return normalize(raw ? JSON.parse(raw) : {});
        } catch {
            return normalize({});
        }
    }

    function serialize(value) {
        return JSON.stringify(normalize(value));
    }

    root.ClockTimerTripPreferencesModel = Object.freeze({ defaults, normalize, read, serialize });
})(globalThis);
