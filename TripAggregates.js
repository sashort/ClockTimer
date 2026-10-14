(() => {
    "use strict";
    const instant = value => Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(String(value)) ? value : String(value).replace(" ", "T") + "Z");
    const duration = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    // Persisted counted time is authoritative; active trips use the allotted floor.
    const countedTime = trip => {
        const stored = Number.isSafeInteger(trip?.countedTimeMilliseconds) && trip.countedTimeMilliseconds >= 0
            ? trip.countedTimeMilliseconds : duration(trip?.actualTimeMilliseconds);
        return trip?.running ? Math.max(duration(trip.allottedTimeMilliseconds), stored) : stored;
    };
    globalThis.TripAggregates = Object.freeze({
        counted: countedTime,
        calculate({trips, rangeWindow = null, currentTripId = null, includeActiveTrip = false, goalPercent = 1}) {
            const start = rangeWindow ? Date.parse(rangeWindow.startTime) : -Infinity, end = rangeWindow ? Date.parse(rangeWindow.endTime) : Infinity;
            if (rangeWindow && (!Number.isFinite(start) || !Number.isFinite(end) || end < start)) throw new TypeError("Invalid trip aggregation range.");
            const unique = new Map();
            for (const trip of trips) unique.set(trip.id == null ? trip : String(trip.id), trip);
            const included = [...unique.values()].filter(trip => {
                const time = instant(trip.startTime);
                const active = trip.running || (currentTripId !== null && String(trip.id) === String(currentTripId));
                return (includeActiveTrip || !active) && (!rangeWindow || time >= start && time <= end);
            });
            const sum = key => included.reduce((value, trip) => value + duration(trip[key]), 0);
            const standard = sum("standardTimeMilliseconds"), actual = sum("actualTimeMilliseconds"), counted = included.reduce((sum, trip) => sum + countedTime(trip), 0);
            const goal = Number.isFinite(goalPercent) && goalPercent > 0 ? goalPercent : 1;
            return Object.freeze({includeActiveTrip: Boolean(includeActiveTrip), tripCount: included.length, standardTimeMilliseconds: standard,
                actualTimeMilliseconds: actual, countedTimeMilliseconds: counted,
                percent: counted > 0 ? standard / counted : null,
                goalPercent: goal, bankedTimeMilliseconds: Math.round(standard / goal - counted)});
        }
    });
})();
