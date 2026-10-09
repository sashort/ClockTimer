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

    function resolveRange(selected, readStored) {
        return normalizeRange(selected ?? readStored?.());
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

    function includeCurrent(value) {
        return value === "true";
    }

    function pinned(value) {
        return value !== "false";
    }

    function pinnedInput(value) {
        return value !== false;
    }

    function offlineTrips({ cachedTrips = [], localTrips = [], loginRequired = false, window, productionFilter = "all" } = {}) {
        const allTrips = new Map();
        if (!loginRequired) {
            for (const trip of cachedTrips) allTrips.set(String(trip.id), trip);
            for (const trip of localTrips) allTrips.set(String(trip.id), trip);
        }
        const start = Date.parse(window?.startTime);
        const end = Date.parse(window?.endTime);
        const trips = [...allTrips.values()].filter(trip => {
            const rawStart = trip.startTime;
            const time = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(rawStart)
                ? rawStart
                : rawStart.replace(" ", "T") + "Z");
            return time >= start && time < end
                && (productionFilter === "all"
                    || (productionFilter === "productive" && !trip.nonProduction)
                    || (productionFilter === "non-productive" && trip.nonProduction));
        });
        return { trips, allTrips: [...allTrips.values()], loginRequired, offline: true, incomplete: true };
    }

    root.ClockTimerTripLogModel = Object.freeze({
        ranges,
        productionFilters,
        normalizeProductionFilter,
        normalizeRange,
        resolveRange,
        liveEffectiveMilliseconds,
        userFacingTotalText,
        includeCurrent,
        pinned,
        pinnedInput,
        offlineTrips
    });
})(globalThis);
