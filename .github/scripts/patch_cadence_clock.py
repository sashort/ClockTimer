from pathlib import Path


def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


p = Path("ClockTimer.js")
s = p.read_text()

helpers = r'''        #getElapsedStartTimeMilliseconds() {
            const candidates = [];

            if (Number.isFinite(this.#scheduledStartMilliseconds)) {
                candidates.push(this.#scheduledStartMilliseconds);
            }

            const relevantTypes = new Set([
                "earlystart",
                "latency",
                "trip",
                "overtime"
            ]);

            for (const range of this.#getManagedTimeRanges()) {
                if (
                    range.timeRangeExiting === true ||
                    !relevantTypes.has(
                        String(range.getAttribute("type") ?? "").trim().toLowerCase()
                    )
                ) {
                    continue;
                }

                const start = Number(range.clockTimerStart);
                if (Number.isFinite(start)) candidates.push(start);
            }

            return candidates.length > 0
                ? Math.min(...candidates)
                : this.#getStartTimeMilliseconds();
        }

        #getCountedTimeElapsed(timelineNow) {
            if (!Number.isFinite(timelineNow)) return 0;

            const countedTypes = new Set([
                "trip",
                "latency",
                "overtime"
            ]);
            const segments = [];

            for (const range of this.#getManagedTimeRanges()) {
                if (
                    range.timeRangeExiting === true ||
                    !countedTypes.has(
                        String(range.getAttribute("type") ?? "").trim().toLowerCase()
                    )
                ) {
                    continue;
                }

                const start = Number(range.clockTimerStart);
                const end = Number(range.clockTimerEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
                const clippedEnd = Math.min(end, timelineNow);
                if (clippedEnd > start) segments.push([start, clippedEnd]);
            }

            segments.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            let total = 0;
            let current;

            for (const segment of segments) {
                if (!current || segment[0] > current[1]) {
                    current = [...segment];
                    total += current[1] - current[0];
                    continue;
                }
                if (segment[1] > current[1]) {
                    total += segment[1] - current[1];
                    current[1] = segment[1];
                }
            }

            return Math.max(0, total);
        }

        #getSummaryTimelineNow(nowDate = new Date()) {
            if (
                !this.#started &&
                this.#hasStartProperties() &&
                Number.isFinite(this.#openEndedLastTick)
            ) {
                return this.#openEndedLastTick;
            }
            return this.#getCurrentTimelineTime(nowDate);
        }

        #getTripActualTimeElapsed(timelineNow) {
            const start = this.#getElapsedStartTimeMilliseconds();
            return Number.isFinite(start) && Number.isFinite(timelineNow)
                ? Math.max(0, timelineNow - start)
                : 0;
        }

        #getScopePercentGoal(scope) {
            const goal = scope === "total"
                ? this.#getTotalGoal()
                : this.#getTripGoal();
            return Number.isFinite(goal) && goal > 0 ? goal : undefined;
        }

        #getTotalSummary(timelineNow, nowDate) {
            const base = this.#hasUsableAggregateSnapshot()
                ? this.#tripTotals
                : undefined;

            if (!base && !this.#hasStartProperties()) return undefined;

            let standardTimeMilliseconds = Number(base?.standardTimeMilliseconds ?? 0);
            let actualTimeMilliseconds = Number(base?.actualTimeMilliseconds ?? 0);
            let countedTimeMilliseconds = Number(base?.countedTimeMilliseconds ?? 0);

            if (this.#hasStartProperties() && this.#tripAddedToAggregate !== true) {
                standardTimeMilliseconds += Number(this.#standardDuration ?? 0);
                actualTimeMilliseconds += this.#getTripActualTimeElapsed(timelineNow);
                countedTimeMilliseconds += this.#getCountedTimeElapsed(timelineNow);
            }

            const countedPercent = actualTimeMilliseconds > 0
                ? countedTimeMilliseconds / actualTimeMilliseconds
                : 0;
            const percentGoal = this.#getScopePercentGoal("total");
            const allowedTimeMilliseconds =
                Number.isFinite(percentGoal) && percentGoal > 0
                    ? standardTimeMilliseconds / percentGoal
                    : standardTimeMilliseconds;
            const remainingMilliseconds = allowedTimeMilliseconds - actualTimeMilliseconds;

            let renderedTime;
            if (this.#renderedTimeMode === "elapsed") {
                renderedTime = this.#formatSignedRenderedDuration(actualTimeMilliseconds);
            }
            else if (this.#renderedTimeMode === "calculated-end") {
                renderedTime = this.#formatClockDisplayTime(
                    new Date(nowDate.getTime() + remainingMilliseconds)
                );
            }
            else {
                renderedTime = this.#formatSignedRenderedDuration(remainingMilliseconds);
            }

            return {
                standardTime: Number.isFinite(standardTimeMilliseconds)
                    ? this.#formatStandardTime(Math.max(0, standardTimeMilliseconds))
                    : undefined,
                standardTimeMilliseconds,
                actualTimeElapsedMilliseconds: actualTimeMilliseconds,
                countedTimeElapsedMilliseconds: countedTimeMilliseconds,
                countedPercent,
                percentGoal,
                renderedTime,
                renderedTimeMode: this.#renderedTimeMode
            };
        }

        #buildSummarySnapshot(nowDate = new Date()) {
            const validNow =
                nowDate instanceof Date && !Number.isNaN(nowDate.getTime())
                    ? new Date(nowDate.getTime())
                    : new Date();
            const timelineNow = this.#getSummaryTimelineNow(validNow);
            const hasTrip = this.#hasStartProperties();
            const tripActualTimeElapsedMilliseconds = hasTrip
                ? this.#getTripActualTimeElapsed(timelineNow)
                : 0;
            const tripCountedTimeElapsedMilliseconds = hasTrip
                ? this.#getCountedTimeElapsed(timelineNow)
                : 0;
            const tripCountedPercent = tripActualTimeElapsedMilliseconds > 0
                ? tripCountedTimeElapsedMilliseconds / tripActualTimeElapsedMilliseconds
                : 0;

            const trip = {
                available: hasTrip,
                standardTime: this.#standardTime,
                standardTimeMilliseconds: Number.isFinite(this.#standardDuration)
                    ? this.#standardDuration
                    : undefined,
                actualTimeElapsedMilliseconds: tripActualTimeElapsedMilliseconds,
                countedTimeElapsedMilliseconds: tripCountedTimeElapsedMilliseconds,
                countedPercent: tripCountedPercent,
                percentGoal: this.#getScopePercentGoal("trip"),
                renderedTime: hasTrip
                    ? (
                        this.#started
                            ? this.#calculateRenderedTime(validNow, this.#renderedTimeMode)
                            : this.#renderedTime
                    )
                    : undefined,
                renderedTimeMode: this.#renderedTimeMode
            };

            const total = this.#getTotalSummary(timelineNow, validNow);
            if (total) total.available = true;
            const scope = this.#percentMode === "total" && total ? "total" : "trip";

            return {
                now: new Date(validNow.getTime()),
                timestamp: validNow.getTime(),
                timelineMilliseconds: timelineNow,
                scope,
                renderedTimeMode: this.#renderedTimeMode,
                trip,
                total,
                selected: scope === "total" ? total : trip
            };
        }

        #emitCadenceTick(nowDate = new Date()) {
            const summary = this.#buildSummarySnapshot(nowDate);
            this.#emitClockTimerEvent("cadenceTick", {
                now: new Date(summary.now.getTime()),
                timestamp: summary.timestamp,
                cadenceMilliseconds: 1000,
                cadenceOffsetMilliseconds: Number.isFinite(this.#tickAlignmentMilliseconds)
                    ? this.#millisecondsComponent(this.#tickAlignmentMilliseconds)
                    : 0,
                tripCountedPercent: summary.trip.countedPercent,
                totalCountedPercent: summary.total?.countedPercent,
                tripCountedTimeElapsedMilliseconds:
                    summary.trip.countedTimeElapsedMilliseconds,
                totalCountedTimeElapsedMilliseconds:
                    summary.total?.countedTimeElapsedMilliseconds,
                summary
            });
        }

'''
s = one(s, "        #getCurrentTimelineTime(\n            now = new Date()\n        ) {", helpers + "        #getCurrentTimelineTime(\n            now = new Date()\n        ) {", "summary helpers")

public_method = r'''        getSummarySnapshot(now = new Date()) {
            if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
                throw new TypeError("now must be a valid Date.");
            }
            return this.#buildSummarySnapshot(now);
        }

'''
s = one(s, "        get state() {\n            return this.status;\n        }", public_method + "        get state() {\n            return this.status;\n        }", "public summary")

# Persist counted time and use the earliest elapsed trip boundary for aggregate duration.
s = one(s,
'''        #tripPersistencePayload() {
            const startTime = this.#timelineToISO(this.#getStartTimeMilliseconds());
            const endTime = this.#timelineToISO(this.#calculatedEndTime);
            const standardTimeMilliseconds =
                Math.round(
                    this.#standardDuration
                );''',
'''        #tripPersistencePayload() {
            const timelineNow = this.#getSummaryTimelineNow(new Date());
            const startTime = this.#timelineToISO(this.#getElapsedStartTimeMilliseconds());
            const endTime = this.#timelineToISO(this.#calculatedEndTime);
            const standardTimeMilliseconds =
                Math.round(
                    this.#standardDuration
                );
            const countedTimeMilliseconds =
                Math.round(
                    this.#getCountedTimeElapsed(timelineNow)
                );''', "persistence calculation")
s = one(s,
'''            const payload = {
                startTime,
                endTime,
                standardTimeMilliseconds,
                nonProduction:
                    this.#nonProduction
            };''',
'''            const payload = {
                startTime,
                endTime,
                standardTimeMilliseconds,
                countedTimeMilliseconds,
                nonProduction:
                    this.#nonProduction
            };''', "persistence payload")

s = one(s,
'''            const aggregateStartTimeline =
                this.#getStartTimeMilliseconds();
            const aggregateStartTime =
                this.#timelineToISO(
                    aggregateStartTimeline
                );
            const aggregateStandardTime =
                this.#standardDuration;''',
'''            const aggregateStartTimeline =
                this.#getElapsedStartTimeMilliseconds();
            const aggregateStartTime =
                this.#timelineToISO(
                    aggregateStartTimeline
                );
            const aggregateStandardTime =
                this.#standardDuration;
            const aggregateCountedTime =
                this.#getCountedTimeElapsed(
                    stopTimeline
                );''', "stop counted calculation")
s = one(s,
'''                    actualTimeMilliseconds:
                        stopTimeline -
                        aggregateStartTimeline,
                    nonProduction:
                        aggregateNonProduction''',
'''                    actualTimeMilliseconds:
                        stopTimeline -
                        aggregateStartTimeline,
                    countedTimeMilliseconds:
                        aggregateCountedTime,
                    nonProduction:
                        aggregateNonProduction''', "cached stop counted")
s = one(s,
'''                        standardTimeMilliseconds:
                            Math.round(
                                this.#standardDuration
                            )
                    }''',
'''                        standardTimeMilliseconds:
                            Math.round(
                                this.#standardDuration
                            ),
                        countedTimeMilliseconds:
                            Math.round(
                                aggregateCountedTime
                            )
                    }''', "stop API counted")

# Direct standard-time changes emit a post-change event.
s = one(s,
'''            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousDuration =
                this.#standardDuration;''',
'''            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousValue =
                this.#standardTime;

            const previousDuration =
                this.#standardDuration;''', "standard previous")
s = one(s,
'''            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );
        }

        get creationTime() {''',
'''            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#emitClockTimerEvent(
                "standardTimeChange",
                {
                    previousValue,
                    value: this.#standardTime,
                    standardTimeMilliseconds: this.#standardDuration
                }
            );
        }

        get creationTime() {''', "standard event")

# Keep the face as a wall clock; rendered trip/total time is summary data.
s = one(s,
'''            if (
                this.#timeElement &&
                renderedTime !== undefined
            ) {
                this.#timeElement.textContent =
                    renderedTime;

                this.#scheduleFontSizing();
            }''',
'''            this.#updateDisplay(
                now
            );''', "mode keeps clock face")
s = one(s,
'''            this.#renderedTime =
                result;

            this.#timeElement.textContent =
                result;

            this.#scheduleFontSizing();''',
'''            this.#renderedTime =
                result;

            const displayTime =
                this.#formatClockDisplayTime(
                    now
                );

            if (displayTime === undefined) return;

            this.#timeElement.textContent =
                displayTime;

            this.#scheduleFontSizing();''', "wall clock face")

# Clear has a post-clear notification distinct from the existing cancelable pre-clear event.
s = one(s,
'''            const resultTripId = this.#tripId ?? oldTripId;
            this.#tripId = undefined;
            this.#pendingIntervalRecord = undefined;
            return {
                synced,
                connected:
                    this.#connectionState ===
                        "connected",
                tripId: Number.isInteger(resultTripId) ? resultTripId : undefined,
                intervalId: undefined
            };''',
'''            const resultTripId = this.#tripId ?? oldTripId;
            this.#tripId = undefined;
            this.#pendingIntervalRecord = undefined;
            const result = {
                synced,
                connected:
                    this.#connectionState ===
                        "connected",
                tripId: Number.isInteger(resultTripId) ? resultTripId : undefined,
                intervalId: undefined
            };
            this.#emitClockTimerEvent("cleared", result);
            return result;''', "cleared event")

# Whole-second fallback cadence when there is no aligned cadence owner.
s = one(s,
'''                                this.#updateDisplay(
                                    new Date()
                                );

                                scheduleNext();''',
'''                                const displayNow = new Date();

                                this.#updateDisplay(
                                    displayNow
                                );

                                if (!this.#needsTick()) {
                                    this.#emitCadenceTick(
                                        displayNow
                                    );
                                }

                                scheduleNext();''', "whole-second cadence")

# Aligned cadence events are data-only; they do not call #updateDisplay.
s = one(s,
'''            if (
                !this.#started
            ) {
                return;
            }''',
'''            if (
                !this.#started
            ) {
                this.#emitCadenceTick(
                    nowDate
                );
                return;
            }''', "nonstarted cadence")
s = one(s,
'''            this.#refreshRingLayout(
                now
            );
        }

        #startHandAnimations() {''',
'''            this.#refreshRingLayout(
                now
            );

            this.#emitCadenceTick(
                nowDate
            );
        }

        #startHandAnimations() {''', "active cadence")

p.write_text(s)
print("ClockTimer cadence/summary patch complete")
