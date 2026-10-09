/* Synchronizes trip-log range controls and optional saved selection. */
(function (root) {
    "use strict";

    function apply(range, {
        select, startInput, endInput, persist = true,
        writeStorage, storageKey, initializeCustomDates = () => {}
    } = {}) {
        if (select) select.value = range;
        if (persist && typeof writeStorage === "function") writeStorage(storageKey, range);
        const custom = range === "custom";
        if (startInput) startInput.disabled = !custom;
        if (endInput) endInput.disabled = !custom;
        if (custom) initializeCustomDates();
        return range;
    }

    root.ClockTimerTripLogRangeControls = Object.freeze({ apply });
})(globalThis);
