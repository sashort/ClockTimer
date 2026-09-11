from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker not found")
    return text[:start] + replacement + text[end:]


# -----------------------------------------------------------------------------
# TimeRange.js
# -----------------------------------------------------------------------------
path = Path("TimeRange.js")
text = path.read_text()

text = replace_once(
    text,
    '''            TimeRange.#reorderParent(\n                this.parentElement\n            );''',
    '''            TimeRange.#reorderParent(\n                this.parentElement,\n                this\n            );''',
    "TimeRange overlapping reorder source",
)

geometry_api = r'''    static calculateClipPath({
        startAngle,
        endAngle,
        width,
        height,
        parent = undefined,
        mode = "radial"
    } = {}) {
        if (
            !Number.isFinite(startAngle) ||
            !Number.isFinite(endAngle) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return;
        }

        if (
            mode === "radial" &&
            Math.abs(
                endAngle - startAngle
            ) >= 360
        ) {
            return "none";
        }

        const corners =
            TimeRange.calculateCorners({
                startAngle,
                endAngle,
                width,
                height,
                parent,
                mode
            });

        if (!Array.isArray(corners)) {
            return;
        }

        const pointText =
            point =>
                `${
                    point.x /
                    width *
                    100
                }% ${
                    point.y /
                    height *
                    100
                }%`;

        if (mode !== "radial") {
            return `polygon(${corners.map(pointText).join(", ")})`;
        }

        const startPoint =
            TimeRange.calculateEdgePoint(
                startAngle,
                width,
                height
            );

        const endPoint =
            TimeRange.calculateEdgePoint(
                endAngle,
                width,
                height
            );

        return `polygon(${[
            "50% 50%",
            pointText(startPoint),
            ...corners.map(pointText),
            pointText(endPoint)
        ].join(", ")})`;
    }

    applyAnimatedLayout({
        clipPath,
        startAngle,
        endAngle,
        duration
    } = {}) {
        if (
            typeof clipPath !== "string" ||
            clipPath.trim() === ""
        ) {
            return false;
        }

        this.#updateContour();
        this.#updateGeometryVariables();

        this.#updateWaveGeometry(
            startAngle,
            endAngle,
            duration
        );

        this.#applyClipPath(
            clipPath
        );

        return true;
    }

    commitAnimatedLayout(
        layout = {}
    ) {
        if (
            !this.applyAnimatedLayout(
                layout
            )
        ) {
            return false;
        }

        this.#renderStartTime =
            this.#cloneDate(
                this.#startTime
            );

        this.#renderEndTime =
            this.#cloneDate(
                this.#endTime
            );

        return true;
    }

'''

text = replace_once(
    text,
    '''    #cloneDate(value) {''',
    geometry_api + '''    #cloneDate(value) {''',
    "TimeRange geometry animation API insertion",
)

new_update_clip_path = r'''    #updateGeometryVariables() {
        const parent =
            this.parentElement;

        if (!parent) {
            return;
        }

        const ringInset =
            parent.getAttribute(
                "inset"
            );

        const ringWidth =
            parent.getAttribute(
                "width"
            );

        const effectiveRingInset =
            ringInset &&
                ringInset !== "auto"
                ? ringInset
                : "0px";

        const effectiveRingWidth =
            ringWidth ||
                "0px";

        this.#geometryStyleElement.textContent = `
            :host {
                --time-range-ring-inset: ${effectiveRingInset};
                --time-range-ring-width: ${effectiveRingWidth};
            }
        `;
    }

    #applyClipPath(
        clipPath
    ) {
        this.#styleElement.textContent = `
            :host {
                clip-path: ${clipPath};
            }
        `;
    }

    #updateWaveGeometry(
        startAngle,
        endAngle,
        duration
    ) {
        if (
            this.getAttribute("type") !==
                "wave" ||
            !Number.isFinite(startAngle) ||
            !Number.isFinite(endAngle) ||
            !Number.isFinite(duration)
        ) {
            return;
        }

        if (
            duration >=
                60 * 60 * 1000
        ) {
            const waveWidth = 38;

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-width",
                `${waveWidth}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-shoulder",
                `${waveWidth * 0.35}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-start-angle",
                `${-waveWidth - 180}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-end-angle",
                `${360 + waveWidth - 180}deg`
            );

            return;
        }

        const sweepEndAngle =
            duration > 0 &&
            endAngle <= startAngle
                ? endAngle + 360
                : endAngle;

        const sweepAngle =
            Math.max(
                0,
                sweepEndAngle - startAngle
            );

        const waveWidth =
            Math.max(
                1.5,
                Math.min(
                    38,
                    sweepAngle * 0.4
                )
            );

        this.#elapsedWaveLayer.style.setProperty(
            "--elapsed-wave-width",
            `${waveWidth}deg`
        );

        this.#elapsedWaveLayer.style.setProperty(
            "--elapsed-wave-shoulder",
            `${Math.max(0.5, waveWidth * 0.35)}deg`
        );

        this.#elapsedWaveLayer.style.setProperty(
            "--elapsed-wave-start-angle",
            `${startAngle - waveWidth - 180}deg`
        );

        this.#elapsedWaveLayer.style.setProperty(
            "--elapsed-wave-end-angle",
            `${sweepEndAngle + waveWidth - 180}deg`
        );
    }

    #updateClipPath() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return;
        }

        const parent =
            this.parentElement;

        if (!parent) {
            return;
        }

        this.#updateContour();
        this.#updateGeometryVariables();

        const width =
            parent.clientWidth;

        const height =
            parent.clientHeight;

        if (
            width <= 0 ||
            height <= 0
        ) {
            this.#styleElement.textContent =
                "";

            return;
        }

        if (
            !(this.#startTime instanceof Date) ||
            !(this.#endTime instanceof Date)
        ) {
            this.#applyClipPath(
                "polygon(50% 50%, 50% 50%, 50% 50%)"
            );

            return;
        }

        const renderStart =
            this.#renderStartTime instanceof Date
                ? this.#renderStartTime
                : this.#startTime;

        const renderEnd =
            this.#renderEndTime instanceof Date
                ? this.#renderEndTime
                : this.#endTime;

        const duration =
            renderEnd.getTime() -
            renderStart.getTime();

        const ringOrigin =
            this.#getRingOriginTime();

        const startAngle =
            TimeRange.calculateTimeAngle(
                renderStart,
                ringOrigin
            );

        let endAngle =
            TimeRange.calculateTimeAngle(
                renderEnd,
                ringOrigin
            );

        if (
            !Number.isFinite(startAngle) ||
            !Number.isFinite(endAngle)
        ) {
            return;
        }

        if (
            duration >=
                60 * 60 * 1000
        ) {
            endAngle =
                startAngle + 360;
        }

        this.#updateWaveGeometry(
            startAngle,
            endAngle,
            duration
        );

        const clipPath =
            TimeRange.calculateClipPath({
                startAngle,
                endAngle,
                width,
                height,
                parent,
                mode: "radial"
            });

        if (clipPath === undefined) {
            return;
        }

        this.#applyClipPath(
            clipPath
        );
    }

'''

text = replace_between(
    text,
    "    #updateClipPath() {",
    "    static #reorderParent(",
    new_update_clip_path,
    "TimeRange updateClipPath replacement",
)

path.write_text(text)


# -----------------------------------------------------------------------------
# ClockTimer.js
# -----------------------------------------------------------------------------
path = Path("ClockTimer.js")
text = path.read_text()

text = replace_once(
    text,
    '''        #timerModeTransitionAnimations =\n            new Set();\n\n        #timerModeTransitionToken =''',
    '''        #timerModeTransitionAnimations =\n            new Set();\n\n        #timeRangeTimingAnimations =\n            new Map();\n\n        #timerModeTransitionToken =''',
    "ClockTimer timing animation map",
)

text = replace_once(
    text,
    '''            this.#cancelTimerModeTransition();\n\n            this.#spinAnimation''',
    '''            this.#cancelTimerModeTransition();\n            this.#cancelTimeRangeTimingAnimations();\n\n            this.#spinAnimation''',
    "ClockTimer disconnect timing cancellation",
)

animation_helpers = r'''        #timeRangeTimelineDate(
            milliseconds
        ) {
            const base =
                new Date(
                    2000,
                    0,
                    1,
                    0,
                    0,
                    0,
                    0
                );

            return new Date(
                base.getTime() +
                milliseconds
            );
        }

        #getTimeRangeOriginMilliseconds(
            range,
            fallbackStart
        ) {
            let earliest =
                Number.isFinite(
                    fallbackStart
                )
                    ? fallbackStart
                    : undefined;

            const parent =
                range?.parentElement;

            if (parent) {
                for (
                    const child of
                        parent.children
                ) {
                    if (
                        child.localName !==
                            "time-range" ||
                        child.timeRangeExiting ===
                            true
                    ) {
                        continue;
                    }

                    const start =
                        child === range &&
                        Number.isFinite(
                            fallbackStart
                        )
                            ? fallbackStart
                            : Number(
                                child.clockTimerStart
                            );

                    if (
                        Number.isFinite(start) &&
                        (
                            !Number.isFinite(earliest) ||
                            start < earliest
                        )
                    ) {
                        earliest =
                            start;
                    }
                }
            }

            if (!Number.isFinite(earliest)) {
                return 0;
            }

            return (
                Math.floor(
                    earliest /
                    ClockTimer.#HOUR
                ) *
                ClockTimer.#HOUR
            );
        }

        #calculateTimeRangeLayout(
            range,
            start,
            end,
            originMilliseconds
        ) {
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const parent =
                range?.parentElement;

            if (
                !TimeRangeClass ||
                typeof TimeRangeClass.calculateTimeAngle !==
                    "function" ||
                typeof TimeRangeClass.calculateClipPath !==
                    "function" ||
                !parent ||
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end < start
            ) {
                return;
            }

            const width =
                parent.clientWidth;

            const height =
                parent.clientHeight;

            if (
                width <= 0 ||
                height <= 0
            ) {
                return;
            }

            const origin =
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

            const clipPath =
                TimeRangeClass.calculateClipPath({
                    startAngle,
                    endAngle,
                    width,
                    height,
                    parent,
                    mode: "radial"
                });

            if (
                typeof clipPath !==
                    "string"
            ) {
                return;
            }

            return {
                clipPath,
                startAngle,
                endAngle,
                duration:
                    rangeDuration,
                originMilliseconds:
                    origin
            };
        }

        #applyTimeRangeLayout(
            range,
            layout,
            commit = false
        ) {
            if (!range || !layout) {
                return false;
            }

            const method =
                commit
                    ? range.commitAnimatedLayout
                    : range.applyAnimatedLayout;

            if (
                typeof method !==
                    "function"
            ) {
                return false;
            }

            return (
                method.call(
                    range,
                    layout
                ) !== false
            );
        }

        #writeRangeTiming(
            range,
            start,
            end,
            preserveRangeLength = false
        ) {
            const startTime =
                this.#formatTimelineTime(
                    start
                );

            const endTime =
                this.#formatTimelineTime(
                    end
                );

            if (
                typeof range.transitionTo ===
                    "function"
            ) {
                range.transitionTo({
                    startTime,
                    endTime
                });
            }
            else {
                range.setAttribute(
                    "start-time",
                    startTime
                );

                range.setAttribute(
                    "end-time",
                    endTime
                );
            }

            if (preserveRangeLength) {
                range.setAttribute(
                    "range-length",
                    this.#formatStandardTime(
                        end - start
                    )
                );
            }
            else {
                range.removeAttribute(
                    "range-length"
                );
            }

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);
        }

        #finishTimeRangeTimingAnimation(
            range,
            state
        ) {
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout
            );

            const pending =
                state.pending;

            if (
                pending &&
                (
                    pending.start !==
                        state.targetStart ||
                    pending.end !==
                        state.targetEnd
                ) &&
                range.isConnected
            ) {
                state.pending =
                    undefined;

                state.fromStart =
                    state.targetStart;

                state.fromEnd =
                    state.targetEnd;

                state.targetStart =
                    pending.start;

                state.targetEnd =
                    pending.end;

                state.originMilliseconds =
                    this.#getTimeRangeOriginMilliseconds(
                        range,
                        pending.start
                    );

                state.targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        pending.start,
                        pending.end,
                        state.originMilliseconds
                    );

                if (!state.targetLayout) {
                    this.#timeRangeTimingAnimations.delete(
                        range
                    );

                    TimeRangeClass?.resumeLayout?.(
                        range
                    );

                    range.refreshVisualGeometry?.();
                    return;
                }

                state.startedAt =
                    undefined;

                state.duration =
                    this.#getRangeAnimationDuration();

                state.frame =
                    requestAnimationFrame(
                        timestamp =>
                            this.#stepTimeRangeTimingAnimation(
                                range,
                                state,
                                timestamp
                            )
                    );

                return;
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout,
                true
            );

            this.#timeRangeTimingAnimations.delete(
                range
            );

            TimeRangeClass?.resumeLayout?.(
                range
            );
        }

        #stepTimeRangeTimingAnimation(
            range,
            state,
            timestamp
        ) {
            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            if (!range.isConnected) {
                this.#timeRangeTimingAnimations.delete(
                    range
                );

                TimeRangeClass?.resumeLayout?.(
                    range
                );

                return;
            }

            if (
                state.startedAt ===
                    undefined
            ) {
                state.startedAt =
                    timestamp;
            }

            const duration =
                Math.max(
                    0,
                    state.duration
                );

            const progress =
                duration <= 0
                    ? 1
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.startedAt
                            ) /
                            duration
                        )
                    );

            const currentStart =
                state.fromStart +
                (
                    state.targetStart -
                    state.fromStart
                ) *
                progress;

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            const currentLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    currentStart,
                    currentEnd,
                    state.originMilliseconds
                );

            if (currentLayout) {
                this.#applyTimeRangeLayout(
                    range,
                    currentLayout
                );
            }

            if (progress >= 1) {
                state.frame =
                    undefined;

                this.#finishTimeRangeTimingAnimation(
                    range,
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepTimeRangeTimingAnimation(
                            range,
                            state,
                            nextTimestamp
                        )
                );
        }

        #cancelTimeRangeTimingAnimations() {
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (
                const [range, state] of
                    this.#timeRangeTimingAnimations
            ) {
                if (
                    state.frame !==
                        undefined
                ) {
                    cancelAnimationFrame(
                        state.frame
                    );
                }

                TimeRangeClass?.resumeLayout?.(
                    range
                );
            }

            this.#timeRangeTimingAnimations.clear();
        }

'''

text = replace_once(
    text,
    '''        #getPlannedSegments(\n''',
    animation_helpers + '''        #getPlannedSegments(\n''',
    "ClockTimer animation helper insertion",
)

new_set_range_timing = r'''        #setRangeTiming(
            range,
            start,
            end,
            preserveRangeLength = false
        ) {
            if (
                !range ||
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return false;
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const previousStart =
                Number(
                    range.clockTimerStart
                );

            const previousEnd =
                Number(
                    range.clockTimerEnd
                );

            const active =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (active) {
                this.#writeRangeTiming(
                    range,
                    start,
                    end,
                    preserveRangeLength
                );

                active.pending =
                    start === active.targetStart &&
                    end === active.targetEnd
                        ? undefined
                        : {
                            start,
                            end,
                            preserveRangeLength
                        };

                return true;
            }

            const canManageAnimation =
                range.isConnected &&
                TimeRangeClass &&
                typeof TimeRangeClass.suspendLayout ===
                    "function" &&
                typeof TimeRangeClass.resumeLayout ===
                    "function" &&
                typeof range.applyAnimatedLayout ===
                    "function" &&
                typeof range.commitAnimatedLayout ===
                    "function";

            if (!canManageAnimation) {
                this.#writeRangeTiming(
                    range,
                    start,
                    end,
                    preserveRangeLength
                );

                return true;
            }

            TimeRangeClass.suspendLayout(
                range
            );

            this.#writeRangeTiming(
                range,
                start,
                end,
                preserveRangeLength
            );

            const originMilliseconds =
                this.#getTimeRangeOriginMilliseconds(
                    range,
                    start
                );

            const targetLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    start,
                    end,
                    originMilliseconds
                );

            if (!targetLayout) {
                TimeRangeClass.resumeLayout(
                    range
                );

                range.refreshVisualGeometry?.();
                return true;
            }

            if (
                !Number.isFinite(previousStart) ||
                !Number.isFinite(previousEnd) ||
                (
                    previousStart === start &&
                    previousEnd === end
                ) ||
                this.#starting ||
                this.#getRangeAnimationDuration() <= 0
            ) {
                this.#applyTimeRangeLayout(
                    range,
                    targetLayout,
                    true
                );

                TimeRangeClass.resumeLayout(
                    range
                );

                return true;
            }

            const fromLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    previousStart,
                    previousEnd,
                    originMilliseconds
                );

            if (!fromLayout) {
                this.#applyTimeRangeLayout(
                    range,
                    targetLayout,
                    true
                );

                TimeRangeClass.resumeLayout(
                    range
                );

                return true;
            }

            this.#applyTimeRangeLayout(
                range,
                fromLayout
            );

            const state = {
                fromStart:
                    previousStart,
                fromEnd:
                    previousEnd,
                targetStart:
                    start,
                targetEnd:
                    end,
                originMilliseconds,
                targetLayout,
                pending:
                    undefined,
                frame:
                    undefined,
                startedAt:
                    undefined,
                duration:
                    this.#getRangeAnimationDuration()
            };

            this.#timeRangeTimingAnimations.set(
                range,
                state
            );

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepTimeRangeTimingAnimation(
                            range,
                            state,
                            timestamp
                        )
                );

            return true;
        }

'''

text = replace_between(
    text,
    "        #setRangeTiming(\n",
    "        #replaceRangeWithSegments(\n",
    new_set_range_timing,
    "ClockTimer setRangeTiming replacement",
)

new_start_end_helpers = r'''        #setRangeStart(
            range,
            milliseconds
        ) {
            const end =
                Number(
                    range?.clockTimerEnd
                );

            if (
                Number.isFinite(end) &&
                end > milliseconds
            ) {
                return this.#setRangeTiming(
                    range,
                    milliseconds,
                    end,
                    range.hasAttribute(
                        "range-length"
                    )
                );
            }

            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "start-time"
                ) !== formatted
            ) {
                range.setAttribute(
                    "start-time",
                    formatted
                );
            }

            range.clockTimerStart =
                String(milliseconds);

            return true;
        }

        #setRangeEnd(
            range,
            milliseconds
        ) {
            const start =
                Number(
                    range?.clockTimerStart
                );

            if (
                Number.isFinite(start) &&
                milliseconds > start
            ) {
                return this.#setRangeTiming(
                    range,
                    start,
                    milliseconds,
                    range.hasAttribute(
                        "range-length"
                    )
                );
            }

            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "end-time"
                ) !== formatted
            ) {
                range.setAttribute(
                    "end-time",
                    formatted
                );
            }

            range.clockTimerEnd =
                String(milliseconds);

            return true;
        }

'''

text = replace_between(
    text,
    "        #setRangeStart(\n",
    "        #ensureRing(\n",
    new_start_end_helpers,
    "ClockTimer range start/end helper replacement",
)

text = replace_once(
    text,
    '''                else {\n                    this.#setRangeStart(\n                        range,\n                        segmentStart\n                    );\n\n                    this.#setRangeEnd(\n                        range,\n                        segmentEnd\n                    );\n                }\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.snapToLogicalTiming?.();''',
    '''                else {\n                    this.#setRangeTiming(\n                        range,\n                        segmentStart,\n                        segmentEnd,\n                        range.hasAttribute(\n                            "range-length"\n                        )\n                    );\n                }\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );''',
    "ClockTimer remaining range update",
)

text = replace_once(
    text,
    '''            else {\n                this.#setRangeStart(\n                    range,\n                    start\n                );\n\n                this.#setRangeEnd(\n                    range,\n                    end\n                );\n            }\n\n            range.snapToLogicalTiming?.();\n            range.refreshVisualGeometry?.();''',
    '''            else {\n                this.#setRangeTiming(\n                    range,\n                    start,\n                    end,\n                    range.hasAttribute(\n                        "range-length"\n                    )\n                );\n            }''',
    "ClockTimer wave range update",
)

text = replace_once(
    text,
    '''                current.range.setAttribute(\n                    "end-time",\n                    this.#formatTimelineTime(\n                        stopTime\n                    )\n                );\n\n                current.range.clockTimerEnd =\n                    String(stopTime);''',
    '''                this.#setRangeEnd(\n                    current.range,\n                    stopTime\n                );''',
    "ClockTimer stop range timing update",
)

text = replace_once(
    text,
    '''            this.#stopTickTimer();\n            this.#setIndicatorSymbolVisible(false);''',
    '''            this.#stopTickTimer();\n            this.#cancelTimeRangeTimingAnimations();\n            this.#setIndicatorSymbolVisible(false);''',
    "ClockTimer clear animation cancellation",
)

path.write_text(text)
