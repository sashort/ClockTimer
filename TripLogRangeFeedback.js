/* Presentation boundary for trip-log date-range validation feedback. */
(function (root) {
    "use strict";

    function showError(message = "", { errorElement, dateInputs = [] } = {}) {
        const visibleMessage = String(message || "");
        if (errorElement) {
            errorElement.textContent = visibleMessage;
            errorElement.hidden = !visibleMessage;
        }
        for (const input of dateInputs) {
            input?.setAttribute("aria-invalid", String(Boolean(visibleMessage)));
        }
    }

    root.ClockTimerTripLogRangeFeedback = Object.freeze({ showError });
})(globalThis);
