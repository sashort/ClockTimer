from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

replace_to_next_start = text.index("        replaceToNext(\n")
replace_to_next_end = text.index("        replaceWithPrevious()", replace_to_next_start)

replace_to_next = '''        replaceToNext(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceToNext",
                    value: type
                });

                return;
            }

            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const ringIndex =
                this.#getRingIndex(
                    now
                );

            const ring =
                this.#rings.get(
                    ringIndex
                );

            if (!ring) {
                return;
            }

            let currentRange;
            let currentStart =
                -Infinity;
            let currentEnd;

            for (
                const range of
                    ring.querySelectorAll(
                        ":scope > time-range"
                    )
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;

                    currentEnd =
                        end;
                }
            }

            if (
                !currentRange ||
                !Number.isFinite(
                    currentEnd
                ) ||
                currentEnd <= now
            ) {
                return;
            }

            this.#setRangeEnd(
                currentRange,
                now
            );

            const replacementType =
                type.trim();

            this.#extendCalculatedEndTime(
                currentEnd - now,
                replacementType
            );

            const replacement =
                this.#createTimeRange(
                    replacementType,
                    now,
                    currentEnd,
                    {
                        dynamic: true
                    }
                );

            replacement.setAttribute(
                "data-time-range-full-entry",
                ""
            );

            ring.insertBefore(
                replacement,
                currentRange.nextSibling
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return replacement;
        }

'''

text = (
    text[:replace_to_next_start]
    + replace_to_next
    + text[replace_to_next_end:]
)

replace_to_previous_start = text.index("        replaceToPrevious(\n")
replace_to_previous_end = text.index("        clear() {", replace_to_previous_start)

replace_to_previous = '''        replaceToPrevious(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceToPrevious",
                    value: type
                });

                return;
            }

            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            let currentRange;
            let currentStart =
                -Infinity;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }
            }

            if (
                !currentRange ||
                !Number.isFinite(
                    currentStart
                ) ||
                currentStart >= now
            ) {
                return;
            }

            const ring =
                currentRange.parentElement;

            if (!ring) {
                return;
            }

            this.#setRangeStart(
                currentRange,
                now
            );

            const replacementType =
                type.trim();

            this.#extendCalculatedEndTime(
                now - currentStart,
                replacementType
            );

            const replacement =
                this.#createTimeRange(
                    replacementType,
                    currentStart,
                    now,
                    {
                        dynamic: true
                    }
                );

            replacement.setAttribute(
                "data-time-range-full-entry",
                ""
            );

            ring.insertBefore(
                replacement,
                currentRange
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return replacement;
        }

'''

text = (
    text[:replace_to_previous_start]
    + replace_to_previous
    + text[replace_to_previous_end:]
)

path.write_text(text)
