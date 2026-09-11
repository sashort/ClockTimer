from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
needle='''        closeOpenRange() {'''
assert needle in s
block=r'''        #getProtectedRangeTypes() {
            return new Set([
                "trip",
                "tolerance",
                "overtime",
                "earlystart",
                "prestart",
                "elapsed"
            ]);
        }

        #shiftPlannedRangesAfter(
            cutoff,
            delta
        ) {
            if (
                !Number.isFinite(cutoff) ||
                !Number.isFinite(delta) ||
                delta === 0
            ) {
                return;
            }

            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerPlanned !==
                                undefined &&
                            range.timeRangeExiting !==
                                true
                    );

            for (const range of ranges) {
                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= cutoff
                ) {
                    continue;
                }

                if (start >= cutoff) {
                    this.#replaceRangeWithSegments(
                        range,
                        [[
                            start + delta,
                            end + delta
                        ]]
                    );

                    continue;
                }

                this.#replaceRangeWithSegments(
                    range,
                    [
                        [
                            start,
                            cutoff
                        ],
                        [
                            cutoff + delta,
                            end + delta
                        ]
                    ]
                );
            }
        }

        #getOverwriteCalculatedEndDeltaForRebuild(
            start,
            end,
            type
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return 0;
            }

            let delta =
                this.#typeExtendsCalculatedEndTime(
                    type
                )
                    ? end - start
                    : 0;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.getAttribute("type") ===
                        "elapsed" ||
                    range.clockTimerOverwrite !==
                        undefined ||
                    range.timeRangeExiting === true
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd)
                ) {
                    continue;
                }

                const overlap =
                    Math.max(
                        0,
                        Math.min(end, rangeEnd) -
                        Math.max(start, rangeStart)
                    );

                if (
                    overlap > 0 &&
                    this.#typeExtendsCalculatedEndTime(
                        range.getAttribute("type")
                    )
                ) {
                    delta -= overlap;
                }
            }

            return delta;
        }

        #rebuildAfterRangeDeletion() {
            if (!this.#hasStartProperties()) {
                this.#refreshRingLayout(
                    undefined,
                    { refreshTickMarks: true }
                );
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            this.#reconcilePlannedRanges({
                startTimeMilliseconds
            });

            this.#calculatedEndTime =
                this.#scheduledStartMilliseconds +
                this.#standardDuration;

            const inserted =
                [...this.#insertedRanges]
                    .sort(
                        (a, b) =>
                            this.#dateToTimelineTime(
                                a.startDate
                            ) -
                            this.#dateToTimelineTime(
                                b.startDate
                            )
                    );

            for (const record of inserted) {
                const start =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                const end =
                    record.openEnded
                        ? this.#openEndedLastTick
                        : (
                            record.endDate
                                ? this.#dateToTimelineTime(
                                    record.endDate
                                )
                                : undefined
                        );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    continue;
                }

                const duration =
                    end - start;

                this.#extendCalculatedEndTime(
                    duration,
                    record.type
                );

                this.#shiftPlannedRangesAfter(
                    start,
                    duration
                );

                this.#shiftScheduleMarkers(
                    start,
                    duration
                );
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                const end =
                    record.openEnded
                        ? this.#openOverwriteLastTick
                        : record.end;

                if (
                    !Number.isFinite(record.start) ||
                    !Number.isFinite(end) ||
                    end <= record.start
                ) {
                    continue;
                }

                this.#adjustCalculatedEndTime(
                    this.#getOverwriteCalculatedEndDeltaForRebuild(
                        record.start,
                        end,
                        record.type
                    )
                );
            }

            this.#removeOvertimeRanges();

            let now;

            if (this.#started) {
                now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(
                    now
                );

                this.#updateOvertimeRanges(
                    now
                );
            }

            this.#reapplyOverwriteRanges();

            this.#rebuildOvertimeRangeMap();

            this.#refreshRingLayout(
                this.#started
                    ? now
                    : startTimeMilliseconds,
                { refreshTickMarks: true }
            );
        }

        delete(timeRange) {
            if (
                !timeRange ||
                timeRange.localName !==
                    "time-range"
            ) {
                return false;
            }

            const ring =
                timeRange.parentElement;

            if (
                !ring ||
                ring.localName !==
                    "ring-container" ||
                ring.parentElement !== this
            ) {
                return false;
            }

            const type =
                String(
                    timeRange.getAttribute(
                        "type"
                    ) ?? ""
                ).trim();

            if (
                this.#getProtectedRangeTypes()
                    .has(type)
            ) {
                return false;
            }

            const insertedId =
                timeRange.clockTimerInserted;

            const overwriteId =
                timeRange.clockTimerOverwrite;

            if (insertedId !== undefined) {
                const record =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id === insertedId
                    );

                this.#insertedRanges =
                    this.#insertedRanges.filter(
                        candidate =>
                            candidate.id !== insertedId
                    );

                if (
                    this.#openEndedRange === record
                ) {
                    this.#openEndedRange =
                        undefined;

                    this.#openEndedLastTick =
                        undefined;
                }

                for (
                    const range of
                        this.#getManagedTimeRanges()
                            .filter(
                                candidate =>
                                    candidate.clockTimerInserted ===
                                        insertedId
                            )
                ) {
                    range.remove();
                }
            }
            else if (overwriteId !== undefined) {
                const record =
                    this.#overwriteRanges.find(
                        candidate =>
                            candidate.id === overwriteId
                    );

                this.#overwriteRanges =
                    this.#overwriteRanges.filter(
                        candidate =>
                            candidate.id !== overwriteId
                    );

                if (
                    this.#openOverwriteRange === record
                ) {
                    this.#openOverwriteRange =
                        undefined;

                    this.#openOverwriteLastTick =
                        undefined;
                }

                for (
                    const range of
                        this.#getManagedTimeRanges()
                            .filter(
                                candidate =>
                                    candidate.clockTimerOverwrite ===
                                        overwriteId
                            )
                ) {
                    range.remove();
                }
            }
            else {
                timeRange.remove();
            }

            this.#rebuildAfterRangeDeletion();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }
            else {
                this.#stopTickTimer();
            }

            return true;
        }

'''
s=s.replace(needle,block+needle,1)
p.write_text(s)
