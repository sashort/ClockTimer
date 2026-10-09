/* Initializes the editable start/end dates for a custom trip-log range. */
(function (root) {
    "use strict";

    function initialize({ startInput, endInput, readStorage, storageKey, timezone = "UTC", now = new Date() } = {}) {
        if (!startInput || !endInput) return;
        let saved;
        try { saved = JSON.parse(readStorage?.(storageKey)); } catch {}
        if (saved?.start && saved?.end) {
            startInput.value = saved.start;
            endInput.value = saved.end;
        }
        if (!startInput.value || !endInput.value) {
            const partsList = new Intl.DateTimeFormat("en-CA", {
                timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
            }).formatToParts(now);
            const parts = Object.fromEntries(partsList.map(part => [part.type, part.value]));
            startInput.value ||= `${parts.year}-${parts.month}-${parts.day}`;
            endInput.value ||= startInput.value;
        }
    }

    root.ClockTimerTripLogCustomDates = Object.freeze({ initialize });
})(globalThis);
