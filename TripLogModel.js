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
    const productionFilters = Object.freeze(["all", "productive", "non-productive"]);

    function normalizeProductionFilter(value) {
        return productionFilters.includes(value) ? value : "all";
    }

    function normalizeRange(value) {
        const normalized = String(value || "day").trim().toLowerCase();
        return allowed.has(normalized) ? normalized : "day";
    }

    function liveEffectiveMilliseconds(summary, isLive) {
        const trip = summary?.trip;
        if (!isLive || !trip?.available) return undefined;

        const counted = trip.countedTimeElapsedMilliseconds;
        const allotted = trip.allottedTimeMilliseconds;
        if (!Number.isSafeInteger(counted) || counted < 0) return undefined;

        return Number.isSafeInteger(allotted) && allotted >= 0
            ? Math.max(allotted, counted)
            : counted;
    }

    function userFacingTotalText(value, label) {
        const text = String(value ?? "");
        return label === "Total" ? text : text.replace(/\bTotal\b/g, label);
    }

    root.ClockTimerTripLogModel = Object.freeze({
        ranges,
        productionFilters,
        normalizeProductionFilter,
        normalizeRange,
        liveEffectiveMilliseconds,
        userFacingTotalText
    });
})(globalThis);
