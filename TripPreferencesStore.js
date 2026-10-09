/* Storage adapter for trip preferences; normalization remains in the pure model. */
(function (root) {
    "use strict";

    function normalizeFallback(value) {
        const stored = value && typeof value === "object" ? value : {};
        return {
            lateBreakBehavior: stored.lateBreakBehavior === "autoRestartTrip"
                ? "autoRestartTrip"
                : "showLateWindow",
            syncGoals: Boolean(stored.syncGoals ?? false)
        };
    }

    function create({
        key = "tripPreferences",
        getItem = () => null,
        setItem = () => {},
        model
    } = {}) {
        const getModel = () => model || root.ClockTimerTripPreferencesModel;

        function read() {
            let raw = null;
            try {
                raw = getItem(key);
            } catch {}

            const currentModel = getModel();
            if (currentModel?.read) return currentModel.read(raw);

            try {
                return normalizeFallback(raw ? JSON.parse(raw) : {});
            } catch {
                return normalizeFallback({});
            }
        }

        function save(value) {
            const currentModel = getModel();
            const normalized = currentModel?.normalize
                ? currentModel.normalize(value)
                : normalizeFallback(value);
            const serialized = currentModel?.serialize
                ? currentModel.serialize(normalized)
                : JSON.stringify(normalized);
            setItem(key, serialized);
            return normalized;
        }

        return Object.freeze({ read, save });
    }

    root.ClockTimerTripPreferencesStore = Object.freeze({ create });
})(globalThis);
