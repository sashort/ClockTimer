/* Pure trip-liveness classification with authoritative timer-state precedence. */
(function (root) {
    "use strict";

    function isLive(input = {}) {
        const {timerState, status, appTripState} = input || {};
        if (typeof timerState?.trip_active === "boolean") return timerState.trip_active;
        return status === "running" || appTripState === "running";
    }

    root.ClockTimerTripRuntimeModel = Object.freeze({isLive});
})(globalThis);
