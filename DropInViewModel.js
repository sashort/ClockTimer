/* Pure projection for the read-only Drop-In view of the active ClockTimer state. */
(function (root) {
    "use strict";

    function create({
        summary,
        microphone,
        timeDisplay,
        model,
        appearance,
        mode,
        range,
        customDates,
        active,
        tripId,
        tripStart,
        nonProduction,
        productionFilter,
        calendars = []
    } = {}) {
        return {
            summary: {
                trip: {
                    available: summary?.trip?.available,
                    standardTimeMilliseconds: summary?.trip?.standardTimeMilliseconds,
                    countedTimeElapsedMilliseconds: summary?.trip?.countedTimeElapsedMilliseconds,
                    percentGoal: summary?.trip?.percentGoal
                },
                total: summary?.total ? {
                    percentGoal: summary.total.percentGoal,
                    standardTimeMilliseconds: summary.total.standardTimeMilliseconds,
                    countedTimeElapsedMilliseconds: summary.total.countedTimeElapsedMilliseconds,
                    allowanceCreditMilliseconds: summary.total.allowanceCreditMilliseconds
                } : null
            },
            microphone,
            timeDisplay,
            model,
            appearance,
            mode,
            range,
            customDates: range === "custom" ? customDates : null,
            active: Boolean(active),
            tripId,
            tripStart,
            nonProduction,
            productionFilter,
            calendars: calendars.map(record => ({
                profile: record.profile,
                searchedYear: record.searchedYear,
                timezone: record.timezone,
                rules: Object.fromEntries([
                    "weekStartDay", "cutoffTime", "effectiveFrom", "effectiveThrough",
                    "recurring", "payPeriodDays", "payPeriodAnchorDate", "payPeriodAnchorBasis"
                ].filter(key => key in (record.rules || {})).map(key => [key, record.rules[key]]))
            }))
        };
    }

    root.ClockTimerDropInViewModel = Object.freeze({ create });
})(globalThis);
