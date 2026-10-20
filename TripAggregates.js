(() => {
    "use strict";
    const instant = value => Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(String(value)) ? value : String(value).replace(" ", "T") + "Z");
    const duration = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    // Shares approval precedence with the entry editor; totals never invent a
    // separate approval policy or clamp an approved surplus to the logged time.
    class TripDowntimeSummary {
        static approved(started, ended, events = []) {
            if (String(started?.value?.type || '').toLowerCase() !== 'down') return undefined;
            const approval = [...events].reverse().find(event => event.event === 'interval.approval-changed' && event.value?.intervalKey === started.value?.intervalKey);
            if (approval?.value?.state === 'unapproved') return 0;
            if (approval?.value?.state === 'approved' && Number.isSafeInteger(approval.value.value) && approval.value.value >= 0) return approval.value.value;
            if (Number.isSafeInteger(started.value.approvedTime) && started.value.approvedTime >= 0) return started.value.approvedTime;
            if (!started.timestamp || !ended?.timestamp) return undefined;
            const elapsed = instant(ended.timestamp) - instant(started.timestamp);
            return Number.isSafeInteger(elapsed) && elapsed >= 0 ? elapsed : undefined;
        }
        static trip(trip, {now = Date.now()} = {}) {
            if (trip.breakOnly || trip.events?.some(event => event.event === "trip.started" && event.value?.breakOnly === true)) {
                return Object.freeze({loggedMilliseconds:0, approvedMilliseconds:0, intervalCount:0, hasDowntime:false});
            }
            const events = trip.events || [], starts = new Map(), ends = new Map(), deleted = new Set();
            for (const event of events) {
                const key = event.value?.intervalKey;
                if (!key) continue;
                if (event.event === 'interval.deleted') deleted.add(key);
                if (event.event === 'interval.started' && String(event.value?.type || '').toLowerCase() === 'down') starts.set(key, event);
                if (event.event === 'interval.ended') ends.set(key, event);
            }
            let loggedMilliseconds = 0, approvedMilliseconds = 0, intervalCount = 0;
            for (const [key, started] of starts) {
                if (deleted.has(key)) continue;
                const ended = ends.get(key), start = instant(started.timestamp);
                const finish = ended ? instant(ended.timestamp) : trip.running ? now : NaN;
                const elapsed = finish - start;
                if (!Number.isSafeInteger(elapsed) || elapsed < 0) continue;
                loggedMilliseconds += elapsed;
                approvedMilliseconds += duration(this.approved(started, ended, events));
                intervalCount++;
            }
            return Object.freeze({loggedMilliseconds, approvedMilliseconds, intervalCount,
                hasDowntime: loggedMilliseconds > 0 || approvedMilliseconds > 0});
        }
        static calculate(trips, options) {
            let loggedMilliseconds = 0, approvedMilliseconds = 0, intervalCount = 0;
            for (const trip of trips) {
                const summary = this.trip(trip, options);
                loggedMilliseconds += summary.loggedMilliseconds;
                approvedMilliseconds += summary.approvedMilliseconds;
                intervalCount += summary.intervalCount;
            }
            return Object.freeze({loggedMilliseconds, approvedMilliseconds, intervalCount,
                hasDowntime: loggedMilliseconds > 0 || approvedMilliseconds > 0});
        }
    }
    globalThis.TripDowntimeSummary = TripDowntimeSummary;
    // Persisted counted time is authoritative; active trips use the allotted floor after unused break credit.
    const countedTime = trip => {
        const stored = Number.isSafeInteger(trip?.countedTimeMilliseconds) && trip.countedTimeMilliseconds >= 0
            ? trip.countedTimeMilliseconds : duration(trip?.actualTimeMilliseconds);
        return trip?.running ? Math.max(0, duration(trip.allottedTimeMilliseconds) - duration(trip.allowanceCreditMilliseconds), stored) : stored;
    };
    globalThis.TripAggregates = Object.freeze({
        counted: countedTime,
        calculate({trips, rangeWindow = null, currentTripId = null, includeActiveTrip = false, goalPercent = 1, now = Date.now()}) {
            const start = rangeWindow ? Date.parse(rangeWindow.startTime) : -Infinity, end = rangeWindow ? Date.parse(rangeWindow.endTime) : Infinity;
            if (rangeWindow && (!Number.isFinite(start) || !Number.isFinite(end) || end < start)) throw new TypeError("Invalid trip aggregation range.");
            const unique = new Map();
            for (const trip of trips) unique.set(trip.id == null ? trip : String(trip.id), trip);
            const included = [...unique.values()].filter(trip => {
                if (trip.breakOnly || trip.events?.some(event => event.event === "trip.started" && event.value?.breakOnly === true)) return false;
                const time = instant(trip.startTime);
                const active = trip.running || (currentTripId !== null && String(trip.id) === String(currentTripId));
                return (includeActiveTrip || !active) && (!rangeWindow || time >= start && time <= end);
            });
            const sum = key => included.reduce((value, trip) => value + duration(trip[key]), 0);
            const standard = sum("standardTimeMilliseconds"), actual = sum("actualTimeMilliseconds"), counted = included.reduce((sum, trip) => sum + countedTime(trip), 0);
            const goal = Number.isFinite(goalPercent) && goalPercent > 0 ? goalPercent : 1;
            return Object.freeze({includeActiveTrip: Boolean(includeActiveTrip), tripCount: included.length, standardTimeMilliseconds: standard,
                actualTimeMilliseconds: actual, countedTimeMilliseconds: counted,
                downtime: TripDowntimeSummary.calculate(included, {now}),
                percent: counted > 0 ? standard / counted : null,
                goalPercent: goal, bankedTimeMilliseconds: Math.round(standard / goal - counted)});
        }
    });
})();
