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

    function register({
        dispatcher = root.ClockTimerDispatcher,
        startup = root.ClockTimerStartup,
        context = root.ClockTimerPageContext,
        settingsOnlyPage = false,
        apiBase,
        calendarRanges,
        refreshTripLogSelection,
        showTripRangeError,
        fetchImpl = root.fetch
    }) {
        if (settingsOnlyPage || !dispatcher || !startup) return false;
        dispatcher.register(
            "calendarStartup",
            currentContext => startup.runWhenEnabled("calendarStartup", currentContext, () => start({
                apiBase,
                calendarRanges,
                refreshTripLogSelection,
                showTripRangeError,
                fetchImpl
            })),
            currentContext => currentContext.capabilities?.calendarStartup !== false
        );
        void dispatcher.bootstrap(context).catch(error => {
            console.error("ClockTimer startup dispatcher failed.", error);
        });
        return true;
    }

    root.ClockTimerCalendarStartup = Object.freeze({ start, register });
})(globalThis);
