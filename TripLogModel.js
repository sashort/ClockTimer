/* Pure trip-log range policy shared by startup and application UI. */
(function (root) {
    "use strict";

    const ranges = Object.freeze([
        "day",
        "week",
        "pay-period",
        "month",
        "year",
        "custom"
    ]);
    const allowed = new Set(ranges);

    function normalizeRange(value) {
        const normalized = String(value || "day").trim().toLowerCase();
        return allowed.has(normalized) ? normalized : "day";
    }

    root.ClockTimerTripLogModel = Object.freeze({ ranges, normalizeRange });
})(globalThis);
