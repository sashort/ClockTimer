from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

def once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

once('''        #openEndedLastTick;\n\n        #preserveInsertedOnClear =''', '''        #openEndedLastTick;\n\n        #overwriteRanges =\n            [];\n\n        #openOverwriteRange;\n\n        #openOverwriteLastTick;\n\n        #preserveInsertedOnClear =''', 'overwrite fields')

once('''                        case "insert":\n                            this.insert(operation.args);\n                            break;\n\n                        case "replaceWithNext":''', '''                        case "insert":\n                            this.insert(operation.args);\n                            break;\n\n                        case "overwrite":\n                            this.overwrite(operation.args);\n                            break;\n\n                        case "replaceWithNext":''', 'async overwrite dispatch')

once('''                        "insert",\n                        "replaceWithNext",\n                        "replaceToNext"''', '''                        "insert",\n                        "overwrite",\n                        "replaceWithNext",\n                        "replaceToNext"''', 'stop cancels queued overwrite')

# Insert overwrite API and helpers before closeOpenRange().
marker = '''        closeOpenRange() {\n'''
block = r'''        overwrite({
            type,
            startTime,
            endTime,
            rangeLength
        } = {}) {
            const explicitStart =
                startTime !== undefined &&
                startTime !== null;

            const hasEnd =
                endTime !== undefined;

            const hasLength =
                rangeLength !== undefined;

            const openEnded =
                !explicitStart &&
                !hasEnd &&
                !hasLength;

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                const args = {
                    type,
                    startTime,
                    endTime,
                    rangeLength
                };

                if (openEnded) {
                    this.#recordPendingTickAlignment(
                        new Date().getMilliseconds()
                    );
                }

                this.#queueAsyncOperation({
                    type: "overwrite",
                    args
                });

                return true;
            }

            if (
                typeof type !== "string" ||
                type.trim() === ""
            ) {
                return false;
            }

            if (
                explicitStart &&
                !hasEnd &&
                !hasLength
            ) {
                return false;
            }

            if (
                openEnded &&
                !this.#hasStartProperties()
            ) {
                return false;
            }

            if (this.#openOverwriteRange) {
                return false;
            }

            const reference =
                this.#getCurrentTimelineTime();

            let start;

            try {
                if (explicitStart) {
                    const parsedStart =
                        this.#validateClockTime(
                            startTime,
                            "startTime"
                        );

                    start =
                        this.#resolveNear(
                            parsedStart.total,
                            reference
                        );
                }
                else {
                    start = reference;
                }
            }
            catch {
                return false;
            }

            let end;
            let duration;

            if (hasEnd) {
                try {
                    const parsedEnd =
                        this.#validateClockTime(
                            endTime,
                            "endTime"
                        );

                    end =
                        this.#resolveNear(
                            parsedEnd.total,
                            start
                        );
                }
                catch {
                    return false;
                }
            }

            if (hasLength) {
                try {
                    duration =
                        this.#validateDurationTime(
                            rangeLength,
                            "rangeLength"
                        ).total;
                }
                catch {
                    return false;
                }
            }

            if (
                Number.isFinite(end) &&
                end <= start
            ) {
                return false;
            }

            if (
                Number.isFinite(end) &&
                Number.isFinite(duration) &&
                end - start !== duration
            ) {
                return false;
            }

            if (
                !Number.isFinite(end) &&
                Number.isFinite(duration)
            ) {
                end =
                    start + duration;
            }

            if (
                Number.isFinite(end) &&
                !Number.isFinite(duration)
            ) {
                duration =
                    end - start;
            }

            const record = {
                id:
                    `overwrite-${Date.now()}-${Math.random()}`,
                type:
                    type.trim(),
                start,
                end:
                    Number.isFinite(end)
                        ? end
                        : undefined,
                openEnded
            };

            if (openEnded) {
                this.#overwriteRanges.push(
                    record
                );

                this.#openOverwriteRange =
                    record;

                this.#openOverwriteLastTick =
                    start;

                this.#tickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        start
                    );

                this.#renderOverwriteRecord(
                    record
                );

                this.#refreshRingLayout(
                    start,
                    { refreshTickMarks: true }
                );

                this.#stopTickTimer();
                this.#scheduleNextTick();

                return true;
            }

            const net =
                this.#getOverwriteCalculatedEndDelta(
                    start,
                    end,
                    record.type
                );

            this.#adjustCalculatedEndTime(
                net
            );

            this.#trimOverwriteRecords(
                start,
                end
            );

            this.#overwriteRanges.push(
                record
            );

            this.#applyOverwriteMask(
                start,
                end
            );

            this.#renderOverwriteRecord(
                record
            );

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : start,
                { refreshTickMarks: true }
            );

            return true;
        }

        #adjustCalculatedEndTime(delta) {
            if (
                !Number.isFinite(
                    this.#calculatedEndTime
                ) ||
                !Number.isFinite(delta) ||
                delta === 0
            ) {
                return;
            }

            this.#calculatedEndTime +=
                delta;
        }

        #getOverwriteCalculatedEndDelta(
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

        #copyClockTimerRangeState(
            source,
            target
        ) {
            for (const key of Object.keys(source)) {
                if (
                    !key.startsWith("clockTimer") ||
                    key === "clockTimerStart" ||
                    key === "clockTimerEnd"
                ) {
                    continue;
                }

                target[key] =
                    source[key];
            }
        }

        #splitRangeForOverwrite(
            range,
            leftStart,
            leftEnd,
            rightStart,
            rightEnd
        ) {
            const attributes =
                this.#getPreservedAttributes(
                    range
                );

            const preserveRangeLength =
                range.hasAttribute(
                    "range-length"
                );

            this.#setRangeTiming(
                range,
                leftStart,
                leftEnd,
                preserveRangeLength
            );

            const right =
                document.createElement(
                    "time-range"
                );

            this.#applyPreservedAttributes(
                right,
                attributes
            );

            this.#copyClockTimerRangeState(
                range,
                right
            );

            this.#setRangeTiming(
                right,
                rightStart,
                rightEnd,
                preserveRangeLength
            );

            const ring =
                this.#ensureRing(
                    this.#getRingIndex(
                        rightStart
                    )
                );

            ring.appendChild(
                right
            );
        }

        #applyOverwriteMask(
            start,
            end
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return;
            }

            const ranges =
                Array.from(
                    this.#getManagedTimeRanges()
                );

            for (const range of ranges) {
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
                    !Number.isFinite(rangeEnd) ||
                    rangeEnd <= start ||
                    rangeStart >= end
                ) {
                    continue;
                }

                if (
                    start <= rangeStart &&
                    rangeEnd <= end
                ) {
                    if (
                        typeof range.removeAnimated ===
                            "function"
                    ) {
                        range.removeAnimated({
                            collapseTo: "start"
                        });
                    }
                    else {
                        range.remove();
                    }

                    continue;
                }

                const preserveRangeLength =
                    range.hasAttribute(
                        "range-length"
                    );

                if (
                    rangeStart < start &&
                    end < rangeEnd
                ) {
                    this.#splitRangeForOverwrite(
                        range,
                        rangeStart,
                        start,
                        end,
                        rangeEnd
                    );

                    continue;
                }

                if (
                    rangeStart < start &&
                    start < rangeEnd
                ) {
                    this.#setRangeTiming(
                        range,
                        rangeStart,
                        start,
                        preserveRangeLength
                    );

                    continue;
                }

                if (
                    rangeStart < end &&
                    end < rangeEnd
                ) {
                    this.#setRangeTiming(
                        range,
                        end,
                        rangeEnd,
                        preserveRangeLength
                    );
                }
            }
        }

        #trimOverwriteRecords(
            start,
            end
        ) {
            const next = [];

            for (
                const record of
                    this.#overwriteRanges
            ) {
                if (
                    record.openEnded ||
                    !Number.isFinite(record.end) ||
                    record.end <= start ||
                    record.start >= end
                ) {
                    next.push(record);
                    continue;
                }

                if (
                    start <= record.start &&
                    record.end <= end
                ) {
                    continue;
                }

                if (
                    record.start < start &&
                    end < record.end
                ) {
                    next.push({
                        ...record,
                        end: start
                    });

                    next.push({
                        ...record,
                        id:
                            `overwrite-${Date.now()}-${Math.random()}`,
                        start: end
                    });

                    continue;
                }

                if (
                    record.start < start
                ) {
                    next.push({
                        ...record,
                        end: start
                    });

                    continue;
                }

                next.push({
                    ...record,
                    start: end
                });
            }

            this.#overwriteRanges =
                next;

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerOverwrite !==
                                    undefined
                        )
            ) {
                range.remove();
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                this.#applyOverwriteMask(
                    record.start,
                    record.end
                );

                this.#renderOverwriteRecord(
                    record
                );
            }
        }

        #renderOverwriteRecord(record) {
            const end =
                record.openEnded
                    ? this.#openOverwriteLastTick
                    : record.end;

            if (
                !Number.isFinite(end) ||
                end <= record.start
            ) {
                return;
            }

            let cursor =
                record.start;

            while (cursor < end) {
                const ringIndex =
                    this.#getRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getRingStart(
                        ringIndex
                    ) +
                    ClockTimer.#HOUR;

                const segmentEnd =
                    Math.min(
                        end,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const range =
                    this.#createTimeRange(
                        record.type,
                        cursor,
                        segmentEnd,
                        { dynamic: true }
                    );

                delete range.clockTimerDynamic;

                range.clockTimerOverwrite =
                    record.id;

                range.timeRangeFullEntry =
                    true;

                ring.appendChild(
                    range
                );

                cursor =
                    segmentEnd;
            }
        }

        #reapplyOverwriteRanges() {
            if (this.#overwriteRanges.length === 0) {
                return;
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
                    Number.isFinite(end) &&
                    end > record.start
                ) {
                    this.#applyOverwriteMask(
                        record.start,
                        end
                    );
                }
            }
        }

        #updateOpenOverwriteRange(
            nowDate
        ) {
            const record =
                this.#openOverwriteRange;

            if (!record) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const previous =
                Number.isFinite(
                    this.#openOverwriteLastTick
                )
                    ? this.#openOverwriteLastTick
                    : record.start;

            if (now <= previous) {
                return;
            }

            const net =
                this.#getOverwriteCalculatedEndDelta(
                    previous,
                    now,
                    record.type
                );

            this.#adjustCalculatedEndTime(
                net
            );

            this.#applyOverwriteMask(
                previous,
                now
            );

            this.#openOverwriteLastTick =
                now;

            record.end =
                now;

            this.#renderOverwriteRecord({
                ...record,
                start: previous,
                openEnded: false
            });
        }

'''
once(marker, block + marker, 'overwrite API block')

once('''            this.#openEndedLastTick =\n                stopTime;\n\n            this.#scheduleIndicatorSymbolUpdate();''', '''            this.#openEndedLastTick =\n                stopTime;\n\n            const openOverwrite =\n                this.#openOverwriteRange;\n\n            if (openOverwrite) {\n                const previous =\n                    Number.isFinite(\n                        this.#openOverwriteLastTick\n                    )\n                        ? this.#openOverwriteLastTick\n                        : openOverwrite.start;\n\n                if (stopTime > previous) {\n                    const net =\n                        this.#getOverwriteCalculatedEndDelta(\n                            previous,\n                            stopTime,\n                            openOverwrite.type\n                        );\n\n                    this.#adjustCalculatedEndTime(\n                        net\n                    );\n\n                    this.#applyOverwriteMask(\n                        previous,\n                        stopTime\n                    );\n\n                    this.#renderOverwriteRecord({\n                        ...openOverwrite,\n                        start: previous,\n                        end: stopTime,\n                        openEnded: false\n                    });\n                }\n\n                openOverwrite.openEnded =\n                    false;\n\n                openOverwrite.end =\n                    Math.max(\n                        openOverwrite.start,\n                        stopTime\n                    );\n\n                this.#openOverwriteRange =\n                    undefined;\n\n                this.#openOverwriteLastTick =\n                    undefined;\n            }\n\n            this.#scheduleIndicatorSymbolUpdate();''', 'stop closes overwrite')

once('''                this.#openEndedLastTick =\n                    undefined;\n            }\n\n            const RingContainerClass =''', '''                this.#openEndedLastTick =\n                    undefined;\n            }\n\n            this.#overwriteRanges =\n                [];\n\n            this.#openOverwriteRange =\n                undefined;\n\n            this.#openOverwriteLastTick =\n                undefined;\n\n            const RingContainerClass =''', 'clear overwrite state')

once('''                this.#started ||\n                Boolean(\n                    this.#openEndedRange\n                )\n            );''', '''                this.#started ||\n                Boolean(\n                    this.#openEndedRange\n                ) ||\n                Boolean(\n                    this.#openOverwriteRange\n                )\n            );''', 'needs tick overwrite')

once('''            this.#updateOpenEndedRange(\n                nowDate\n            );\n\n            if (\n                !this.#started''', '''            this.#updateOpenEndedRange(\n                nowDate\n            );\n\n            this.#updateOpenOverwriteRange(\n                nowDate\n            );\n\n            if (\n                !this.#started''', 'tick overwrite update')

# Re-mask generated ranges before layout after percent-goal reconciliation.
once('''            this.#updateOvertimeRanges(\n                now\n            );\n\n            this.#refreshRingLayout(\n                now,''', '''            this.#updateOvertimeRanges(\n                now\n            );\n\n            this.#reapplyOverwriteRanges();\n\n            this.#refreshRingLayout(\n                now,''', 'percent goal overwrite remask')

# Re-mask newly rendered inserted ranges before layout.
once('''            this.#refreshRingLayout(\n                this.#started\n                    ? this.#getCurrentTimelineTime()\n                    : undefined\n            );\n        }\n\n        #shiftScheduleMarkers(''', '''            this.#reapplyOverwriteRanges();\n\n            this.#refreshRingLayout(\n                this.#started\n                    ? this.#getCurrentTimelineTime()\n                    : undefined\n            );\n        }\n\n        #shiftScheduleMarkers(''', 'insert render overwrite remask')

# Re-mask dynamic overtime before final tick layout.
once('''            this.#updateOvertimeRanges(\n                now\n            );\n\n            this.#refreshRingLayout(\n                now\n            );\n        }\n''', '''            this.#updateOvertimeRanges(\n                now\n            );\n\n            this.#reapplyOverwriteRanges();\n\n            this.#refreshRingLayout(\n                now\n            );\n        }\n''', 'tick overwrite remask')

for needle in [
    'overwrite({',
    'case "overwrite":',
    '#openOverwriteRange;',
    '#updateOpenOverwriteRange(',
    'this.#reapplyOverwriteRanges();'
]:
    if needle not in s:
        raise SystemExit(f'missing expected overwrite code: {needle}')

p.write_text(s)
