/* Pure normalization and ClockTimer mapping for rendered-time display modes. */
(function (root) {
    "use strict";

    const modes = Object.freeze(["remaining", "calculated-end", "elapsed"]);

    function normalize(value) {
        return modes.includes(value) ? value : "remaining";
    }

    function clockTimerAttribute(value) {
        switch (normalize(value)) {
            case "elapsed":
                return "calculated_start_time";
            case "calculated-end":
                return "calculated_end_time";
            default:
                return "time_remaining";
        }
    }

    root.ClockTimerTimerDisplayModel = Object.freeze({
        modes,
        normalize,
        clockTimerAttribute
    });
})(globalThis);
