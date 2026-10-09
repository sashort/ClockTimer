/* Calendar startup integration, kept independent of app.js lexical state. */
(function (root) {
    "use strict";

    async function start({
        apiBase,
        calendarRanges,
        refreshTripLogSelection,
        showTripRangeError,
        fetchImpl = root.fetch
    }) {
        try {
            const response = await fetchImpl(new URL("api/calendar/?result=records", apiBase), {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Calendar lookup failed.");
            calendarRanges.setDatabaseRecords(data.calendars);
            refreshTripLogSelection();
            return { ok: true, count: Array.isArray(data.calendars) ? data.calendars.length : 0 };
        } catch (error) {
            showTripRangeError(error.message || "Calendar lookup failed.");
            return { ok: false, error };
        }
    }

    root.ClockTimerCalendarStartup = Object.freeze({ start });
})(globalThis);
