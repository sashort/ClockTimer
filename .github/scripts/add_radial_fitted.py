from pathlib import Path
import re
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '            "percent-goal",\n            "timer-mode",',
    '            "percent-goal",\n            "timer-type",\n            "timer-mode",',
    "observe timer-type"
)

replace_once(
    '            switch (name) {\n                case "timer-mode":',
    '''            switch (name) {
                case "timer-type":
                    this.#normalizeTimerType();
                    break;

                case "timer-mode":''',
    "timer-type attribute handler"
)

replace_once(
    '''        #ensureAttributes() {
            if (
                !this.hasAttribute(
                    "timer-mode"
                )
            ) {''',
    '''        #ensureAttributes() {
            if (
                !this.hasAttribute(
                    "timer-type"
                )
            ) {
                this.setAttribute(
                    "timer-type",
                    "radial-overflow"
                );
            }
            else {
                this.#normalizeTimerType();
            }

            if (
                !this.hasAttribute(
                    "timer-mode"
                )
            ) {''',
    "default timer-type"
)

replace_once(
    '''        #getTimerMode() {''',
    '''        #getTimerType() {
            return this.getAttribute(
                "timer-type"
            ) === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";
        }

        #normalizeTimerType() {
            const raw =
                this.getAttribute(
                    "timer-type"
                );

            const normalized =
                typeof raw === "string" &&
                raw.trim().toLowerCase() ===
                    "radial-fitted"
                    ? "radial-fitted"
                    : "radial-overflow";

            if (raw !== normalized) {
                this.setAttribute(
                    "timer-type",
                    normalized
                );
            }

            return normalized;
        }

        #getTimerMode() {''',
    "timer-type helpers"
)

# Route every ClockTimer ring lookup through the timer-type strategy.
ring_index_calls = text.count("this.#getRingIndex(")
ring_start_calls = text.count("this.#getRingStart(")
if ring_index_calls < 10:
    raise RuntimeError(f"unexpected getRingIndex call count: {ring_index_calls}")
if ring_start_calls < 5:
    raise RuntimeError(f"unexpected getRingStart call count: {ring_start_calls}")
text = text.replace("this.#getRingIndex(", "this.#getTimerRingIndex(")
text = text.replace("this.#getRingStart(", "this.#getTimerRingStart(")

# Any hour-based segment boundary becomes unbounded in radial-fitted mode,
# causing the enclosing Math.min(..., ringEnd) to keep the whole span in ring 0.
text, direct_ring_end_count = re.subn(
    r'this\.\#getTimerRingStart\(\s*ringIndex\s*\)\s*\+\s*ClockTimer\.\#HOUR',
    'this.#getTimerRingEnd(ringIndex)',
    text
)
text, variable_ring_end_count = re.subn(
    r'ringStart\s*\+\s*ClockTimer\.\#HOUR',
    'this.#getTimerRingEnd(ringIndex)',
    text
)
if direct_ring_end_count + variable_ring_end_count < 8:
    raise RuntimeError(
        "unexpected timer ring-end replacement count: "
        f"{direct_ring_end_count + variable_ring_end_count}"
    )

replace_once(
    '''        #getRingIndex(
            milliseconds
        ) {''',
    '''        #getTimerRingIndex(
            milliseconds
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                return 0;
            }

            return this.#getRingIndex(
                milliseconds
            );
        }

        #getTimerRingStart(
            ringIndex
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds();

                if (bounds) {
                    return bounds.start;
                }

                if (
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                ) {
                    return this.#scheduledStartMilliseconds;
                }

                if (
                    Number.isFinite(
                        this.#ringAnchor
                    )
                ) {
                    return this.#ringAnchor;
                }

                return 0;
            }

            return this.#getRingStart(
                ringIndex
            );
        }

        #getTimerRingEnd(
            ringIndex
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                return Infinity;
            }

            return (
                this.#getRingStart(
                    ringIndex
                ) +
                ClockTimer.#HOUR
            );
        }

        #getRingIndex(
            milliseconds
        ) {''',
    "timer ring strategy helpers"
)

replace_once(
    '''            this.#ringAnchor =
                start -
                (
                    (
                        start % ClockTimer.#HOUR
                    ) +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;''',
    '''            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#ringAnchor =
                    start;

                return;
            }

            this.#ringAnchor =
                start -
                (
                    (
                        start % ClockTimer.#HOUR
                    ) +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;''',
    "fitted insertion anchor"
)

replace_once(
    '''        #getTimeRangeOriginMilliseconds(
            range,
            fallbackStart
        ) {
            let earliest =''',
    '''        #getRadialFittedBounds(
            now
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return undefined;
            }

            let start;
            let end;

            const ignoredTypes =
                new Set([
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.timeRangeExiting === true ||
                    ignoredTypes.has(
                        range.getAttribute(
                            "type"
                        )
                    )
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
                    Number.isFinite(rangeStart) &&
                    (
                        !Number.isFinite(start) ||
                        rangeStart < start
                    )
                ) {
                    start =
                        rangeStart;
                }

                if (
                    Number.isFinite(rangeEnd) &&
                    (
                        !Number.isFinite(end) ||
                        rangeEnd > end
                    )
                ) {
                    end =
                        rangeEnd;
                }
            }

            if (!Number.isFinite(start)) {
                if (
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                ) {
                    start =
                        this.#scheduledStartMilliseconds;
                }
                else if (
                    Number.isFinite(
                        this.#ringAnchor
                    )
                ) {
                    start =
                        this.#ringAnchor;
                }
            }

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                )
            ) {
                end =
                    Number.isFinite(end)
                        ? Math.max(
                            end,
                            this.#calculatedEndTime
                        )
                        : this.#calculatedEndTime;
            }

            const current =
                Number.isFinite(now)
                    ? now
                    : (
                        this.#started
                            ? this.#getCurrentTimelineTime()
                            : undefined
                    );

            const currentThreshold =
                Number.isFinite(
                    this.#calculatedEndTime
                )
                    ? this.#calculatedEndTime
                    : end;

            if (
                Number.isFinite(current) &&
                Number.isFinite(currentThreshold) &&
                current >= currentThreshold
            ) {
                end =
                    Number.isFinite(end)
                        ? Math.max(
                            end,
                            current
                        )
                        : current;
            }

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return undefined;
            }

            return {
                start,
                end,
                duration:
                    end - start
            };
        }

        #refreshRadialFittedLayouts(
            now
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return;
            }

            const bounds =
                this.#getRadialFittedBounds(
                    now
                );

            if (!bounds) {
                return;
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const ranges =
                this.#getTimerRanges()
                    .filter(
                        range =>
                            range.isConnected &&
                            range.timeRangeExiting !== true
                    );

            if (
                this.#waveRange?.isConnected &&
                !ranges.includes(
                    this.#waveRange
                )
            ) {
                ranges.push(
                    this.#waveRange
                );
            }

            const suspended = [];

            try {
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
                        end <= start
                    ) {
                        continue;
                    }

                    const coordinatorManaged =
                        this.#timeRangeTimingAnimations.has(
                            range
                        );

                    if (
                        !coordinatorManaged &&
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {
                        TimeRangeClass.suspendLayout(
                            range
                        );

                        suspended.push(
                            range
                        );
                    }

                    const layout =
                        this.#calculateTimeRangeLayout(
                            range,
                            start,
                            end,
                            bounds.start,
                            bounds
                        );

                    if (layout) {
                        this.#applyTimeRangeLayout(
                            range,
                            layout,
                            true
                        );
                    }
                }
            }
            finally {
                if (
                    typeof TimeRangeClass?.resumeLayout ===
                        "function"
                ) {
                    for (const range of suspended) {
                        TimeRangeClass.resumeLayout(
                            range
                        );
                    }
                }
            }
        }

        #getTimeRangeOriginMilliseconds(
            range,
            fallbackStart
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds();

                if (bounds) {
                    return bounds.start;
                }
            }

            let earliest =''',
    "radial fitted bounds and layout refresh"
)

replace_once(
    '''        #calculateTimeRangeLayout(
            range,
            start,
            end,
            originMilliseconds
        ) {''',
    '''        #calculateTimeRangeLayout(
            range,
            start,
            end,
            originMilliseconds,
            fittedBounds
        ) {''',
    "fitted layout parameter"
)

old_angle_block = '''            const origin =
                Number.isFinite(
                    originMilliseconds
                )
                    ? originMilliseconds
                    : this.#getTimeRangeOriginMilliseconds(
                        range,
                        start
                    );

            const originDate =
                this.#timeRangeTimelineDate(
                    origin
                );

            const startAngle =
                TimeRangeClass.calculateTimeAngle(
                    this.#timeRangeTimelineDate(
                        start
                    ),
                    originDate
                );

            let endAngle =
                TimeRangeClass.calculateTimeAngle(
                    this.#timeRangeTimelineDate(
                        end
                    ),
                    originDate
                );

            if (
                !Number.isFinite(startAngle) ||
                !Number.isFinite(endAngle)
            ) {
                return;
            }

            const rangeDuration =
                end - start;

            if (
                rangeDuration >=
                    ClockTimer.#HOUR
            ) {
                endAngle =
                    startAngle + 360;
            }
'''
new_angle_block = '''            const rangeDuration =
                end - start;

            let origin;
            let startAngle;
            let endAngle;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    fittedBounds ??
                    this.#getRadialFittedBounds();

                if (!bounds) {
                    return;
                }

                origin =
                    bounds.start;

                const degreesPerMillisecond =
                    360 /
                    bounds.duration;

                startAngle =
                    (
                        start -
                        bounds.start
                    ) *
                    degreesPerMillisecond;

                endAngle =
                    (
                        end -
                        bounds.start
                    ) *
                    degreesPerMillisecond;

                startAngle =
                    Math.max(
                        0,
                        Math.min(
                            360,
                            startAngle
                        )
                    );

                endAngle =
                    Math.max(
                        0,
                        Math.min(
                            360,
                            endAngle
                        )
                    );
            }
            else {
                origin =
                    Number.isFinite(
                        originMilliseconds
                    )
                        ? originMilliseconds
                        : this.#getTimeRangeOriginMilliseconds(
                            range,
                            start
                        );

                const originDate =
                    this.#timeRangeTimelineDate(
                        origin
                    );

                startAngle =
                    TimeRangeClass.calculateTimeAngle(
                        this.#timeRangeTimelineDate(
                            start
                        ),
                        originDate
                    );

                endAngle =
                    TimeRangeClass.calculateTimeAngle(
                        this.#timeRangeTimelineDate(
                            end
                        ),
                        originDate
                    );

                if (
                    rangeDuration >=
                        ClockTimer.#HOUR
                ) {
                    endAngle =
                        startAngle + 360;
                }
            }

            if (
                !Number.isFinite(startAngle) ||
                !Number.isFinite(endAngle)
            ) {
                return;
            }
'''
replace_once(
    old_angle_block,
    new_angle_block,
    "fitted angle calculation"
)

replace_once(
    '''        #refreshTimeRangeVisualGeometry() {
            for (''',
    '''        #refreshTimeRangeVisualGeometry() {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

                return;
            }

            for (''',
    "fitted resize geometry refresh"
)

replace_once(
    '''        #snapTimerRangeAngles() {
            for (''',
    '''        #snapTimerRangeAngles() {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

                return;
            }

            for (''',
    "fitted startup geometry refresh"
)

replace_once(
    '''            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();
            this.#syncWaveRange();

            if (
                !this.hasAttribute(''',
    '''            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();
            this.#syncWaveRange();

            this.#refreshRadialFittedLayouts(
                now
            );

            if (
                !this.hasAttribute(''',
    "fitted ring refresh"
)

replace_once(
    '''            this.#setRangeEnd(
                this.#elapsedRange,
                now
            );''',
    '''            if (
                this.#getTimerType() ===
                    "radial-fitted" &&
                Number(
                    this.#elapsedRange.clockTimerStart
                ) !== ringStart
            ) {
                this.#setRangeStart(
                    this.#elapsedRange,
                    ringStart
                );
            }

            this.#setRangeEnd(
                this.#elapsedRange,
                now
            );''',
    "keep fitted elapsed start at fitted origin"
)

replace_once(
    '''            const millisecondsIntoHour =
                (
                    end % ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;

            const normalizedAngle =
                (
                    millisecondsIntoHour /
                    ClockTimer.#HOUR
                ) * 360;''',
    '''            let normalizedAngle;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds(
                        end
                    );

                if (!bounds) {
                    this.#setIndicatorSymbolVisible(false);
                    return;
                }

                normalizedAngle =
                    Math.max(
                        0,
                        Math.min(
                            360,
                            (
                                (
                                    end -
                                    bounds.start
                                ) /
                                bounds.duration
                            ) *
                            360
                        )
                    );
            }
            else {
                const millisecondsIntoHour =
                    (
                        end % ClockTimer.#HOUR +
                        ClockTimer.#HOUR
                    ) % ClockTimer.#HOUR;

                normalizedAngle =
                    (
                        millisecondsIntoHour /
                        ClockTimer.#HOUR
                    ) * 360;
            }''',
    "fitted indicator angle"
)

# The only direct uses left should be inside the strategy helpers themselves.
remaining_index_calls = text.count("this.#getRingIndex(")
remaining_start_calls = text.count("this.#getRingStart(")
if remaining_index_calls != 1:
    raise RuntimeError(
        f"expected one direct getRingIndex call in strategy helper, found {remaining_index_calls}"
    )
if remaining_start_calls != 2:
    raise RuntimeError(
        f"expected two direct getRingStart calls in strategy helpers, found {remaining_start_calls}"
    )

if re.search(r'ringStart\s*\+\s*ClockTimer\.\#HOUR', text):
    raise RuntimeError("hour-based ringEnd remains outside strategy helper")

required = [
    '"timer-type"',
    '"radial-overflow"',
    '"radial-fitted"',
    '#getRadialFittedBounds(',
    '#refreshRadialFittedLayouts(',
    '#getTimerRingIndex(',
    '#getTimerRingEnd('
]
for marker in required:
    if marker not in text:
        raise RuntimeError(f"missing expected marker: {marker}")

path.write_text(text)
print(
    "patched ClockTimer.js:",
    f"ring-index calls routed={ring_index_calls}",
    f"ring-start calls routed={ring_start_calls}",
    f"ring-end rewrites={direct_ring_end_count + variable_ring_end_count}"
)
