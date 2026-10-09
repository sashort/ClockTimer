/* Pure readiness rules for starting a trip draft. Parsing and UI state stay in app.js. */
(function (root) {
    "use strict";

    function canStart({ creationDateValid, deferred, standardTimeMilliseconds, creationTime, scheduledStart, actualStart } = {}) {
        if (!creationDateValid) return false;
        return (
            (
                deferred ||
                (Number.isSafeInteger(standardTimeMilliseconds) && standardTimeMilliseconds > 0)
            ) &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 24 * 60 * 60 * 1000 &&
            (
                deferred ||
                (
                    Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
                    Number.isFinite(actualStart) && actualStart >= 0
                )
            )
        );
    }

    function canRequestStart({ canStartNow, deferred, hasFutureStart, creationDateValid, creationTime, scheduledStart, actualStart } = {}) {
        if (canStartNow) return true;
        if (deferred || !hasFutureStart) return false;
        return Boolean(creationDateValid) &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 86400000 &&
            Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
            Number.isFinite(actualStart) && actualStart >= 0;
    }

    root.ClockTimerTripDraftModel = Object.freeze({ canStart, canRequestStart });
})(globalThis);
