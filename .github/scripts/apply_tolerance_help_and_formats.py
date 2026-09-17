from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_regex(text, pattern, replacement, label):
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return result


# TemporalFormat.js ---------------------------------------------------------
path = Path("TemporalFormat.js")
text = path.read_text()

text = replace_once(
    text,
    '''    static #DATE_TOKENS = [
        "yyyy",
        "MMMM",
        "MMM",
        "MM",
        "dd",
        "yy",
        "M",
        "d"
    ];

    static #TIME_TOKENS = [
        "HH",
        "hh",
        "mm",
        "ss",
        "H",
        "h"
    ];''',
    '''    static #DATE_TOKENS = [
        "dddd",
        "yyyy",
        "MMMM",
        "ddd",
        "MMM",
        "MM",
        "dd",
        "yy",
        "M",
        "d"
    ];

    static #TIME_TOKENS = [
        "HH",
        "hh",
        "mm",
        "ss",
        "H",
        "h",
        "A"
    ];''',
    "TemporalFormat token lists"
)

text = replace_once(
    text,
    '''    static #MONTHS_LONG = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];''',
    '''    static #MONTHS_LONG = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];

    static #WEEKDAYS_SHORT = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat"
    ];

    static #WEEKDAYS_LONG = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];''',
    "TemporalFormat weekday names"
)

text = replace_once(
    text,
    '''            dd: TemporalFormat.#pad(
                date.getDate(),
                2
            ),
            d: String(
                date.getDate()
            )''',
    '''            dddd: TemporalFormat.#WEEKDAYS_LONG[
                date.getDay()
            ],
            ddd: TemporalFormat.#WEEKDAYS_SHORT[
                date.getDay()
            ],
            dd: TemporalFormat.#pad(
                date.getDate(),
                2
            ),
            d: String(
                date.getDate()
            )''',
    "TemporalFormat weekday values"
)

text = replace_once(
    text,
    '''            ss: TemporalFormat.#pad(
                date.getSeconds(),
                2
            )''',
    '''            ss: TemporalFormat.#pad(
                date.getSeconds(),
                2
            ),
            A:
                militaryHour < 12
                    ? "AM"
                    : "PM"''',
    "TemporalFormat AM/PM value"
)

path.write_text(text.rstrip() + "\n")


# ClockTimer.js -------------------------------------------------------------
path = Path("ClockTimer.js")
text = path.read_text()

text = replace_once(
    text,
    '''        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm AM/PM"
                : "HHmm";
        }''',
    '''        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm A"
                : "HHmm";
        }''',
    "ClockTimer standard default format"
)

text = replace_regex(
    text,
    r'''        get showTolerance\(\) \{.*?\n        #normalizeIntervalElapsedBehavior\(''',
    '''        get showTolerance() {
            return this.#showTolerance;
        }

        set showTolerance(value) {
            let normalized;

            if (value === undefined) {
                normalized = undefined;
            }
            else if (typeof value === "boolean") {
                normalized = value;
            }
            else if (typeof value === "string") {
                const text =
                    value.trim().toLowerCase();

                if (text === "true") {
                    normalized = true;
                }
                else if (text === "false") {
                    normalized = false;
                }
                else {
                    return;
                }
            }
            else {
                return;
            }

            if (normalized === this.#showTolerance) {
                return;
            }

            this.#showTolerance =
                normalized;

            if (
                !this.#started ||
                this.#renderedPercentGoal <= 1
            ) {
                return;
            }

            this.#transitionShowTolerance();
        }

        #normalizeIntervalElapsedBehavior(''',
    "ClockTimer tri-state showTolerance setter"
)

text = replace_once(
    text,
    '''                !this.#showTolerance &&
                this.#renderedPercentGoal > 1 &&''',
    '''                this.#showTolerance === undefined &&
                this.#renderedPercentGoal > 1 &&''',
    "ClockTimer progressive tolerance tick"
)

text = replace_regex(
    text,
    r'''        #getCurrentToleranceRenderEnd\(\) \{.*?\n        #ringHasNonToleranceContent\(''',
    '''        #getCurrentTripRenderEnd() {
            let end;

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerPlanned !==
                                    undefined &&
                                range.timeRangeExiting !==
                                    true &&
                                range.getAttribute(
                                    "type"
                                ) === "trip"
                        )
            ) {
                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

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

            return end;
        }

        #getCurrentToleranceRenderEnd() {
            let end;

            for (
                const range of
                    this.#getToleranceRanges()
            ) {
                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

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

            return end;
        }

        #getToleranceTransitionSegments(
            tripEnd,
            toleranceEnd
        ) {
            const segments = [];

            if (
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                ) ||
                !Number.isFinite(tripEnd) ||
                tripEnd <= this.#scheduledStartMilliseconds
            ) {
                return segments;
            }

            const spans = [
                {
                    type: "trip",
                    start:
                        this.#scheduledStartMilliseconds,
                    end: tripEnd
                }
            ];

            if (
                Number.isFinite(toleranceEnd) &&
                toleranceEnd > tripEnd
            ) {
                spans.push({
                    type: "tolerance",
                    start: tripEnd,
                    end: toleranceEnd
                });
            }

            for (const span of spans) {
                let cursor =
                    span.start;

                while (cursor < span.end) {
                    const ringIndex =
                        this.#getTimerRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getTimerRingEnd(
                            ringIndex
                        );

                    const segmentEnd =
                        Math.min(
                            span.end,
                            ringEnd
                        );

                    if (
                        !Number.isFinite(segmentEnd) ||
                        segmentEnd <= cursor
                    ) {
                        break;
                    }

                    segments.push({
                        type: span.type,
                        ringIndex,
                        start: cursor,
                        end: segmentEnd
                    });

                    cursor =
                        segmentEnd;
                }
            }

            return segments;
        }

        #ringHasNonToleranceContent(''',
    "ClockTimer tolerance transition segment helpers"
)

text = replace_regex(
    text,
    r'''        #syncToleranceTransitionRanges\(\n            state,\n            end\n        \) \{.*?\n        #maybeFinishToleranceTransition\(''',
    '''        #syncToleranceTransitionRanges(
            state,
            tripEnd,
            toleranceEnd
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            state.currentTripEnd =
                tripEnd;

            state.currentEnd =
                toleranceEnd;

            const desired =
                this.#getToleranceTransitionSegments(
                    tripEnd,
                    toleranceEnd
                );

            const existing =
                new Map();

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerPlanned !==
                                    undefined &&
                                candidate.timeRangeExiting !==
                                    true &&
                                (
                                    candidate.getAttribute(
                                        "type"
                                    ) === "trip" ||
                                    candidate.getAttribute(
                                        "type"
                                    ) === "tolerance"
                                )
                        )
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (!Number.isFinite(ringIndex)) {
                    continue;
                }

                const key =
                    `${range.getAttribute("type")}:${ringIndex}`;

                if (!existing.has(key)) {
                    existing.set(
                        key,
                        range
                    );
                }
            }

            let layoutChanged =
                false;

            for (const target of desired) {
                let ring =
                    this.#rings.get(
                        target.ringIndex
                    );

                if (!ring) {
                    ring =
                        this.#ensureRing(
                            target.ringIndex
                        );

                    layoutChanged =
                        true;

                    this.#startToleranceRingFade(
                        state,
                        ring,
                        "in"
                    );
                }

                const key =
                    `${target.type}:${target.ringIndex}`;

                let range =
                    existing.get(
                        key
                    );

                if (range) {
                    existing.delete(
                        key
                    );
                }
                else {
                    range =
                        this.#createTimeRange(
                            target.type,
                            target.start,
                            target.end
                        );

                    range.timeRangeFullEntry =
                        true;

                    ring.appendChild(
                        range
                    );
                }

                this.#writeToleranceTransitionTiming(
                    state,
                    range,
                    target.start,
                    target.end
                );

                if (
                    this.#getTimerType() !==
                        "radial-fitted"
                ) {
                    const layout =
                        this.#calculateTimeRangeLayout(
                            range,
                            target.start,
                            target.end
                        );

                    if (layout) {
                        this.#applyTimeRangeLayout(
                            range,
                            layout,
                            true
                        );
                    }
                    else {
                        range.snapToLogicalTiming?.();
                    }
                }
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (const range of existing.values()) {
                state.suspendedRanges.delete(
                    range
                );

                TimeRangeClass?.resumeLayout?.(
                    range
                );

                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            const visualEnd =
                Math.max(
                    tripEnd,
                    toleranceEnd
                );

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    visualEnd,
                    {
                        suspendLayout: false
                    }
                );
            }

            if (layoutChanged) {
                this.#refreshRingLayout(
                    visualEnd
                );
            }
        }

        #maybeFinishToleranceTransition(''',
    "ClockTimer synchronized trip/tolerance transition"
)

text = replace_once(
    text,
    '''            this.#syncToleranceTransitionRanges(
                state,
                state.targetEnd
            );''',
    '''            this.#syncToleranceTransitionRanges(
                state,
                state.targetTripEnd,
                state.targetEnd
            );''',
    "ClockTimer finish tolerance transition boundaries"
)

text = replace_once(
    text,
    '''            this.#toleranceTransitionState =
                undefined;

            this.#removeEmptyRings();''',
    '''            this.#toleranceTransitionState =
                undefined;

            this.#reconcilePlannedRanges();

            this.#removeEmptyRings();''',
    "ClockTimer final tolerance reconciliation"
)

text = replace_regex(
    text,
    r'''        #stepToleranceTransition\(\n            state,\n            timestamp\n        \) \{.*?\n        #transitionShowTolerance\(\) \{''',
    '''        #stepToleranceTransition(
            state,
            timestamp
        ) {
            if (
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            if (
                !this.isConnected ||
                !this.#started
            ) {
                this.#cancelToleranceTransition();
                return;
            }

            if (
                state.startedAt ===
                    undefined
            ) {
                state.startedAt =
                    timestamp;
            }

            const progress =
                state.duration <= 0
                    ? 1
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.startedAt
                            ) /
                            state.duration
                        )
                    );

            const currentTripEnd =
                state.fromTripEnd +
                (
                    state.targetTripEnd -
                    state.fromTripEnd
                ) *
                progress;

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            this.#syncToleranceTransitionRanges(
                state,
                currentTripEnd,
                currentEnd
            );

            if (progress >= 1) {
                state.frame =
                    undefined;

                state.endpointFinished =
                    true;

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepToleranceTransition(
                            state,
                            nextTimestamp
                        )
                );
        }

        #transitionShowTolerance() {''',
    "ClockTimer dual-boundary tolerance step"
)

text = replace_regex(
    text,
    r'''        #transitionShowTolerance\(\) \{.*?\n        #getToleranceRenderEnd\(''',
    '''        #transitionShowTolerance() {
            this.#cancelToleranceTransition();

            const now =
                this.#getCurrentTimelineTime();

            if (
                !Number.isFinite(now) ||
                !Number.isFinite(
                    this.#calculatedEnd
                ) ||
                !Number.isFinite(
                    this.#standardEnd
                )
            ) {
                this.#reconcilePlannedRanges();
                return;
            }

            const clampToTolerance =
                value =>
                    Math.max(
                        this.#calculatedEnd,
                        Math.min(
                            this.#standardEnd,
                            value
                        )
                    );

            const renderedTripEnd =
                this.#getCurrentTripRenderEnd();

            const fromTripEnd =
                clampToTolerance(
                    Number.isFinite(renderedTripEnd)
                        ? renderedTripEnd
                        : (
                            this.#showTolerance === false
                                ? this.#standardEnd
                                : this.#calculatedEnd
                        )
                );

            const renderedToleranceEnd =
                this.#getCurrentToleranceRenderEnd();

            const fromEnd =
                Math.max(
                    fromTripEnd,
                    Number.isFinite(renderedToleranceEnd)
                        ? clampToTolerance(
                            renderedToleranceEnd
                        )
                        : fromTripEnd
                );

            const targetTripEnd =
                this.#showTolerance === false
                    ? this.#standardEnd
                    : this.#calculatedEnd;

            const targetEnd =
                this.#showTolerance === true
                    ? this.#standardEnd
                    : this.#showTolerance === false
                        ? this.#standardEnd
                        : clampToTolerance(
                            now
                        );

            if (
                fromTripEnd === targetTripEnd &&
                fromEnd === targetEnd
            ) {
                this.#reconcilePlannedRanges();

                this.#refreshRingLayout(
                    now,
                    { refreshTickMarks: true }
                );

                return;
            }

            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
                        targetTripEnd,
                        targetEnd
                    ).map(
                        segment =>
                            segment.ringIndex
                    )
                );

            const ringWillAppear =
                Array.from(
                    finalRingIndexes
                ).some(
                    ringIndex =>
                        !this.#rings.has(
                            ringIndex
                        )
                );

            const state = {
                fromTripEnd,
                targetTripEnd,
                fromEnd,
                targetEnd,
                currentTripEnd: fromTripEnd,
                currentEnd: fromEnd,
                duration:
                    ringWillAppear
                        ? 750
                        : this.#getRangeAnimationDuration(),
                startedAt: undefined,
                frame: undefined,
                endpointFinished: false,
                suspendedRanges:
                    new Set(),
                ringFades:
                    new Map()
            };

            state.stateChangeVisual =
                stateChangeVisual;

            this.#toleranceTransitionState =
                state;

            this.#syncToleranceTransitionRanges(
                state,
                fromTripEnd,
                fromEnd
            );

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                state.duration
            );

            if (state.duration <= 0) {
                state.endpointFinished =
                    true;

                this.#syncToleranceTransitionRanges(
                    state,
                    targetTripEnd,
                    targetEnd
                );

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepToleranceTransition(
                            state,
                            timestamp
                        )
                );
        }

        #getToleranceRenderEnd(''',
    "ClockTimer tri-state tolerance transition"
)

text = replace_regex(
    text,
    r'''        #getToleranceRenderEnd\(\n            now = undefined\n        \) \{.*?\n        #getPlannedSegments\(''',
    '''        #getToleranceRenderEnd(
            now = undefined
        ) {
            if (
                this.#renderedPercentGoal <= 1
            ) {
                return undefined;
            }

            const transitionEnd =
                this.#toleranceTransitionState
                    ?.currentEnd;

            const transitionTripEnd =
                this.#toleranceTransitionState
                    ?.currentTripEnd;

            if (
                Number.isFinite(transitionEnd) &&
                Number.isFinite(transitionTripEnd)
            ) {
                return transitionEnd >
                    transitionTripEnd
                    ? transitionEnd
                    : undefined;
            }

            if (!this.#started) {
                return this.#showTolerance === true
                    ? this.#standardEnd
                    : undefined;
            }

            if (this.#showTolerance === true) {
                return this.#standardEnd;
            }

            if (this.#showTolerance === false) {
                return undefined;
            }

            const current =
                Number.isFinite(now)
                    ? now
                    : this.#getCurrentTimelineTime();

            if (
                !Number.isFinite(current) ||
                current <= this.#calculatedEnd
            ) {
                return undefined;
            }

            return Math.min(
                current,
                this.#standardEnd
            );
        }

        #getPlannedSegments(''',
    "ClockTimer tolerance render state"
)

old_planned = '''            if (this.#renderedPercentGoal > 1) {
                this.#tripEnd =
                    this.#calculatedEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                spans.push({
                    type: "trip",
                    start: tripStart,
                    end: this.#calculatedEnd
                });

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        this.#calculatedEnd
                ) {
                    spans.push({
                        type: "tolerance",
                        start: this.#calculatedEnd,
                        end: toleranceRenderEnd
                    });
                }
            }
            else {'''
new_planned = '''            if (this.#renderedPercentGoal > 1) {
                const transitionTripEnd =
                    this.#toleranceTransitionState
                        ?.currentTripEnd;

                const tripRenderEnd =
                    Number.isFinite(
                        transitionTripEnd
                    )
                        ? Math.max(
                            this.#calculatedEnd,
                            Math.min(
                                this.#standardEnd,
                                transitionTripEnd
                            )
                        )
                        : this.#showTolerance === false
                            ? this.#standardEnd
                            : this.#calculatedEnd;

                this.#tripEnd =
                    tripRenderEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                spans.push({
                    type: "trip",
                    start: tripStart,
                    end: tripRenderEnd
                });

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        tripRenderEnd
                ) {
                    spans.push({
                        type: "tolerance",
                        start: tripRenderEnd,
                        end: toleranceRenderEnd
                    });
                }
            }
            else {'''
text = replace_once(text, old_planned, new_planned, "ClockTimer planned tri-state tolerance")

old_build = '''            if (
                this.#renderedPercentGoal >
                    1
            ) {
                this.#tripEnd =
                    this.#calculatedEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                this.#createSpan(
                    "trip",
                    tripStart,
                    this.#calculatedEnd
                );

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        this.#calculatedEnd
                ) {
                    this.#createSpan(
                        "tolerance",
                        this.#calculatedEnd,
                        toleranceRenderEnd
                    );
                }

                return;
            }'''
new_build = '''            if (
                this.#renderedPercentGoal >
                    1
            ) {
                const tripRenderEnd =
                    this.#showTolerance === false
                        ? this.#standardEnd
                        : this.#calculatedEnd;

                this.#tripEnd =
                    tripRenderEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                this.#createSpan(
                    "trip",
                    tripStart,
                    tripRenderEnd
                );

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        tripRenderEnd
                ) {
                    this.#createSpan(
                        "tolerance",
                        tripRenderEnd,
                        toleranceRenderEnd
                    );
                }

                return;
            }'''
text = replace_once(text, old_build, new_build, "ClockTimer initial tri-state tolerance")

path.write_text(text.rstrip() + "\n")


# index.html ----------------------------------------------------------------
path = Path("index.html")
text = path.read_text()

text = replace_once(
    text,
    '''                            <div class="timer-color-row with-toggle">
                                <label for="toleranceColor">Tolerance</label>
                                <input name="showTolerance" type="checkbox" checked aria-label="Show Tolerance">
                                <input id="toleranceColor" name="toleranceColor" type="color" value="#2e7d32">
                            </div>
                            <div class="timer-color-row with-toggle">
                                <label for="latencyColor">Latency</label>
                                <input name="showLatency" type="checkbox" checked aria-label="Show Latency">
                                <input id="latencyColor" name="latencyColor" type="color" value="#e1251b">
                            </div>''',
    '''                            <div class="timer-color-row with-toggle has-setting-help">
                                <label class="settings-help-label" for="toleranceColor" data-help-key="tolerance">Tolerance</label>
                                <button class="settings-help-button" type="button" data-help-key="tolerance" aria-label="About Tolerance" aria-hidden="true" tabindex="-1">?</button>
                                <input name="showTolerance" type="checkbox" checked data-tolerance-state="true" aria-label="Tolerance display">
                                <input id="toleranceColor" name="toleranceColor" type="color" value="#2e7d32" aria-label="Tolerance color">
                            </div>
                            <div class="timer-color-row with-toggle has-setting-help">
                                <label class="settings-help-label" for="latencyColor" data-help-key="latency">Latency</label>
                                <button class="settings-help-button" type="button" data-help-key="latency" aria-label="About Latency" aria-hidden="true" tabindex="-1">?</button>
                                <input name="showLatency" type="checkbox" checked aria-label="Show Latency">
                                <input id="latencyColor" name="latencyColor" type="color" value="#e1251b" aria-label="Latency color">
                            </div>''',
    "index tolerance and latency help controls"
)

text = replace_once(
    text,
    '''                        <label>Time Format<input name="timeFormat" value="HHmm"></label>
                        <label>Date Format<input name="dateFormat" placeholder="hidden"></label>
                        <label>Visible Hours<input name="visibleHours" value="12,3,6,9"></label>
                        <label>Tick Marks<input name="tickMarks" value="[10]"></label>''',
    '''                        <div class="settings-help-row">
                            <label class="settings-help-label" for="timeFormat" data-help-key="timeFormat">Time Format</label>
                            <button class="settings-help-button" type="button" data-help-key="timeFormat" aria-label="About Time Format" aria-hidden="true" tabindex="-1">?</button>
                            <input id="timeFormat" name="timeFormat" value="HHmm">
                        </div>
                        <div class="settings-help-row">
                            <label class="settings-help-label" for="dateFormat" data-help-key="dateFormat">Date Format</label>
                            <button class="settings-help-button" type="button" data-help-key="dateFormat" aria-label="About Date Format" aria-hidden="true" tabindex="-1">?</button>
                            <input id="dateFormat" name="dateFormat" placeholder="hidden">
                        </div>
                        <div class="settings-help-row">
                            <label class="settings-help-label" for="visibleHours" data-help-key="visibleHours">Visible Hours</label>
                            <button class="settings-help-button" type="button" data-help-key="visibleHours" aria-label="About Visible Hours" aria-hidden="true" tabindex="-1">?</button>
                            <input id="visibleHours" name="visibleHours" value="12,3,6,9">
                        </div>
                        <div class="settings-help-row">
                            <label class="settings-help-label" for="tickMarks" data-help-key="tickMarks">Tick Marks</label>
                            <button class="settings-help-button" type="button" data-help-key="tickMarks" aria-label="About Tick Marks" aria-hidden="true" tabindex="-1">?</button>
                            <input id="tickMarks" name="tickMarks" value="[10]">
                        </div>''',
    "index time display help controls"
)

help_markup = '''    <div id="graphicalHelpPopover" class="settings-help-popover" popover="manual" role="dialog" aria-labelledby="graphicalHelpTitle">
        <header class="settings-help-header">
            <h3 id="graphicalHelpTitle"></h3>
            <button id="graphicalHelpClose" class="settings-help-close" type="button" aria-label="Close help">×</button>
        </header>
        <div id="graphicalHelpBody" class="settings-help-body"></div>
    </div>

    <template id="settingsHelpTolerance" data-help-title="Tolerance">
        <p><strong>Tolerance</strong> is the portion of <strong>your standard trip</strong> that remains after your goal-adjusted trip end.</p>
        <p>For example, when your goal is above 100%, the timer calculates an earlier target end for your trip. The time between that calculated end and your original standard end is Tolerance.</p>
        <div class="settings-help-state-grid">
            <strong>Checked</strong><span>Always show your full tolerance period.</span>
            <strong>Unchecked</strong><span>Never show tolerance. If tolerance would normally exist, your trip simply extends through that time to your standard end.</span>
            <strong>Indeterminate</strong><span>Show tolerance only after you’ve entered it. As you move beyond your calculated trip end, the elapsed portion is revealed as tolerance.</span>
        </div>
        <p>Tolerance only applies when your goal produces a calculated end earlier than your standard end.</p>
    </template>

    <template id="settingsHelpLatency" data-help-title="Latency">
        <p class="settings-help-latency-lead"><strong>Latency</strong> is counted time that begins the moment you are <strong class="settings-help-late">LATE!</strong></p>
        <div class="settings-help-example-grid">
            <span aria-hidden="true">•</span><div><strong>Trip Start</strong> — You start your trip after your scheduled start.</div>
            <span aria-hidden="true">•</span><div><strong>Break</strong> — You return from Break after your break’s expected end.</div>
            <span aria-hidden="true">•</span><div><strong>Lunch</strong> — You return from Lunch after your lunch’s expected end.</div>
        </div>
        <p>Latency continues until you resume your trip or start down time, and it counts as elapsed trip time.</p>
    </template>

    <template id="settingsHelpTimeFormat" data-help-title="Time Format">
        <p><strong>Time Format</strong> controls how your current time is displayed in the center of your clock.</p>
        <p>Your format must include an hour token and <code>mm</code> for minutes. Add <code>ss</code> if you want seconds. Other punctuation, spaces, and characters are displayed as you enter them.</p>
        <div class="settings-help-token-grid">
            <code>H</code><span>Military hour without a leading zero.</span>
            <code>HH</code><span>Military hour with a leading zero.</span>
            <code>h</code><span>12-hour time without a leading zero.</span>
            <code>hh</code><span>12-hour time with a leading zero.</span>
            <code>mm</code><span>Two-digit minutes.</span>
            <code>ss</code><span>Two-digit seconds.</span>
            <code>A</code><span>AM or PM.</span>
        </div>
        <p>Your hour format should match your <strong>Military Time</strong> setting.</p>
        <div class="settings-help-token-grid settings-help-examples">
            <code>HHmm</code><span>1437</span>
            <code>HH:mm</code><span>14:37</span>
            <code>HH:mm:ss</code><span>14:37:22</span>
            <code>h:mm A</code><span>2:37 PM</span>
        </div>
    </template>

    <template id="settingsHelpDateFormat" data-help-title="Date Format">
        <p><strong>Date Format</strong> controls how the date is displayed above your current time.</p>
        <p><strong>Leave this field blank if you don’t want the date shown.</strong> When you use a date format, it must include a year, month, and numeric day.</p>
        <div class="settings-help-token-grid">
            <code>yyyy</code><span>Four-digit year.</span>
            <code>yy</code><span>Two-digit year.</span>
            <code>M</code><span>Numeric month.</span>
            <code>MM</code><span>Two-digit month.</span>
            <code>MMM</code><span>Abbreviated month name, such as Sep.</span>
            <code>MMMM</code><span>Full month name, such as September.</span>
            <code>d</code><span>Numeric day.</span>
            <code>dd</code><span>Two-digit day.</span>
            <code>ddd</code><span>Abbreviated day name, such as Thu.</span>
            <code>dddd</code><span>Full day name, such as Thursday.</span>
        </div>
        <p>Other punctuation, spaces, and characters are displayed as you enter them.</p>
        <div class="settings-help-token-grid settings-help-examples">
            <code>MMM d, yyyy</code><span>Sep 17, 2026</span>
            <code>MMMM d, yyyy</code><span>September 17, 2026</span>
            <code>ddd, MMM d, yyyy</code><span>Thu, Sep 17, 2026</span>
            <code>dddd, MMMM d, yyyy</code><span>Thursday, September 17, 2026</span>
        </div>
    </template>

    <template id="settingsHelpVisibleHours" data-help-title="Visible Hours">
        <p><strong>Visible Hours</strong> lets you choose which hour positions are labeled around your clock.</p>
        <p>Separate the hours you want to see with commas. For example, <code>12,3,6,9</code> shows the four quarter-hour positions.</p>
        <p><strong>Leave this field blank to show all hour labels.</strong></p>
        <p>When you use Military Time, the labels change with the time of day while your selected clock positions stay the same. For example, the <code>3</code> position can display <strong>15</strong> in the afternoon.</p>
    </template>

    <template id="settingsHelpTickMarks" data-help-title="Tick Marks">
        <p><strong>Tick Marks</strong> controls which second marks appear around your clock.</p>
        <div class="settings-help-token-grid">
            <code>10</code><span>Show fixed tick marks every 10 seconds.</span>
            <code>[10]</code><span>Show a rolling 10-second group and include its boundary marks.</span>
            <code>(10)</code><span>Show a rolling 10-second group without its boundary marks.</span>
            <code>+/-10</code><span>Show a rolling window 10 seconds before and after the current second.</span>
        </div>
        <p><strong>Leave this field blank to hide tick marks.</strong> Fixed values can be from <code>1</code> through <code>60</code>. Every 5-second tick is visually emphasized as a major tick.</p>
    </template>

'''
text = replace_once(
    text,
    '    <dialog id="stateSettingsDialog" class="app-dialog settings-dialog state-dialog">',
    help_markup + '    <dialog id="stateSettingsDialog" class="app-dialog settings-dialog state-dialog">',
    "index centered help popover"
)

path.write_text(text.rstrip() + "\n")


# app.js -------------------------------------------------------------------
path = Path("app.js")
text = path.read_text()

text = replace_once(
    text,
    '''    function getGraphicalSettings() {
        return getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
    }

    function saveGraphicalSettings(settings) {
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
    }''',
    '''    function getGraphicalSettings() {
        const settings =
            getStoredJSON(
                STORAGE.graphicalSettings,
                GRAPHICAL_DEFAULTS
            );

        if (settings.showTolerance === null) {
            settings.showTolerance =
                undefined;
        }

        return settings;
    }

    function saveGraphicalSettings(settings) {
        const stored = {
            ...settings,
            showTolerance:
                settings.showTolerance === undefined
                    ? null
                    : settings.showTolerance
        };

        safeStorageSet(
            STORAGE.graphicalSettings,
            JSON.stringify(stored)
        );
    }''',
    "app tri-state tolerance persistence"
)

text = replace_once(
    text,
    '''    const tripFieldAttentionAnimations = new WeakMap();''',
    '''    const tripFieldAttentionAnimations = new WeakMap();
    const settingsHelpRevealTimers = new WeakMap();
    const SETTINGS_HELP_FADE_DURATION = 750;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    let activeSettingsHelpButton;
    let settingsHelpAnimation;''',
    "app settings help state"
)

text = replace_once(
    text,
    '''        target.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm AM/PM"));''',
    '''        target.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm A"));''',
    "app standard time format fallback"
)

text = replace_once(
    text,
    '''        target.showTolerance = Boolean(settings.showTolerance);''',
    '''        target.showTolerance = settings.showTolerance;''',
    "app apply tri-state tolerance"
)

text = replace_once(
    text,
    '''            const downColor = settings.downColor || GRAPHICAL_DEFAULTS.downColor;

            paletteRoot.style.setProperty("--timer-break-color", breakColor);''',
    '''            const downColor = settings.downColor || GRAPHICAL_DEFAULTS.downColor;
            const latencyColor = settings.latencyColor || GRAPHICAL_DEFAULTS.latencyColor;

            paletteRoot.style.setProperty("--timer-break-color", breakColor);''',
    "app latency palette variable declaration"
)

text = replace_once(
    text,
    '''            paletteRoot.style.setProperty("--timer-down-color", downColor);
            paletteRoot.style.setProperty("--timer-down-text-color", getContrastingTextColor(downColor));''',
    '''            paletteRoot.style.setProperty("--timer-down-color", downColor);
            paletteRoot.style.setProperty("--timer-down-text-color", getContrastingTextColor(downColor));
            paletteRoot.style.setProperty("--timer-latency-color", latencyColor);''',
    "app latency palette variable"
)

tri_state_helpers = '''    function setToleranceCheckboxValue(control, value) {
        if (!control) return;

        const state =
            value === undefined
                ? "undefined"
                : value
                    ? "true"
                    : "false";

        control.dataset.toleranceState =
            state;

        control.indeterminate =
            state === "undefined";

        control.checked =
            state === "true";

        control.setAttribute(
            "aria-checked",
            state === "undefined"
                ? "mixed"
                : state
        );
    }

    function getToleranceCheckboxValue(control) {
        const state =
            control?.dataset.toleranceState;

        if (state === "undefined") {
            return undefined;
        }

        if (state === "false") {
            return false;
        }

        return true;
    }

'''
text = replace_once(
    text,
    '''    function settingsFromForm(form) {''',
    tri_state_helpers + '''    function settingsFromForm(form) {''',
    "app tri-state tolerance helpers"
)

text = replace_once(
    text,
    '''            showTolerance: form.elements.showTolerance.checked,''',
    '''            showTolerance:
                getToleranceCheckboxValue(
                    form.elements.showTolerance
                ),''',
    "app read tri-state tolerance"
)

text = replace_once(
    text,
    '''            if (!control) continue;
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;''',
    '''            if (!control) continue;
            if (key === "showTolerance") {
                setToleranceCheckboxValue(
                    control,
                    value
                );
                continue;
            }
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;''',
    "app fill tri-state tolerance"
)

text = replace_once(
    text,
    '''                : (includesSeconds ? "h:mm:ss AM/PM" : "h:mm AM/PM");''',
    '''                : (includesSeconds ? "h:mm:ss A" : "h:mm A");''',
    "app standard time format toggle"
)

help_functions = '''    function getSettingsHelpElements() {
        return {
            popover: $("#graphicalHelpPopover"),
            title: $("#graphicalHelpTitle"),
            body: $("#graphicalHelpBody"),
            close: $("#graphicalHelpClose")
        };
    }

    function getSettingsHelpTemplate(key) {
        const ids = {
            tolerance: "settingsHelpTolerance",
            latency: "settingsHelpLatency",
            timeFormat: "settingsHelpTimeFormat",
            dateFormat: "settingsHelpDateFormat",
            visibleHours: "settingsHelpVisibleHours",
            tickMarks: "settingsHelpTickMarks"
        };

        return document.getElementById(
            ids[key]
        );
    }

    function getSettingsHelpButton(key) {
        return Array.from(
            graphicalDialog.querySelectorAll(
                ".settings-help-button"
            )
        ).find(
            button =>
                button.dataset.helpKey === key
        );
    }

    function hideSettingsHelpButton(button) {
        if (!button) return;

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        button.classList.remove(
            "is-visible"
        );

        button.setAttribute(
            "aria-hidden",
            "true"
        );

        button.tabIndex =
            -1;
    }

    function revealSettingsHelpButton(button) {
        if (!button) return;

        for (
            const candidate of
                graphicalDialog.querySelectorAll(
                    ".settings-help-button.is-visible"
                )
        ) {
            if (
                candidate !== button &&
                candidate !== activeSettingsHelpButton
            ) {
                hideSettingsHelpButton(
                    candidate
                );
            }
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        button.classList.add(
            "is-visible"
        );

        button.setAttribute(
            "aria-hidden",
            "false"
        );

        button.tabIndex =
            0;

        if (button === activeSettingsHelpButton) {
            return;
        }

        settingsHelpRevealTimers.set(
            button,
            setTimeout(
                () =>
                    hideSettingsHelpButton(
                        button
                    ),
                SETTINGS_HELP_FADE_DURATION +
                    SETTINGS_HELP_VISIBLE_DURATION
            )
        );
    }

    async function closeSettingsHelpPopover({
        immediate = false
    } = {}) {
        const {
            popover,
            title,
            body
        } = getSettingsHelpElements();

        const button =
            activeSettingsHelpButton;

        activeSettingsHelpButton =
            undefined;

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        hideSettingsHelpButton(
            button
        );

        if (
            !popover ||
            !popover.matches(
                ":popover-open"
            )
        ) {
            return;
        }

        if (!immediate) {
            const opacity =
                Number.parseFloat(
                    getComputedStyle(
                        popover
                    ).opacity
                );

            settingsHelpAnimation =
                popover.animate(
                    [
                        {
                            opacity:
                                Number.isFinite(opacity)
                                    ? opacity
                                    : 1
                        },
                        { opacity: 0 }
                    ],
                    {
                        duration:
                            SETTINGS_HELP_FADE_DURATION,
                        easing: "linear",
                        fill: "both"
                    }
                );

            try {
                await settingsHelpAnimation.finished;
            }
            catch {}
        }

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            popover.hidePopover();
        }

        if (title) title.textContent = "";
        if (body) body.replaceChildren();
    }

    async function openSettingsHelpPopover(
        key,
        button
    ) {
        const template =
            getSettingsHelpTemplate(
                key
            );

        const {
            popover,
            title,
            body,
            close
        } = getSettingsHelpElements();

        if (
            !template ||
            !popover ||
            !title ||
            !body
        ) {
            return;
        }

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            await closeSettingsHelpPopover();
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        activeSettingsHelpButton =
            button;

        revealSettingsHelpButton(
            button
        );

        title.textContent =
            template.dataset.helpTitle ||
            "Help";

        body.replaceChildren(
            template.content.cloneNode(
                true
            )
        );

        const latencyColor =
            graphicalDialog.querySelector(
                '[name="latencyColor"]'
            )?.value ||
            GRAPHICAL_DEFAULTS.latencyColor;

        popover.style.setProperty(
            "--settings-help-latency-color",
            latencyColor
        );

        popover.showPopover();

        settingsHelpAnimation?.cancel();

        settingsHelpAnimation =
            popover.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration:
                        SETTINGS_HELP_FADE_DURATION,
                    easing: "linear",
                    fill: "both"
                }
            );

        try {
            await settingsHelpAnimation.finished;
        }
        catch {}

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        close?.focus({
            preventScroll: true
        });
    }

    graphicalDialog.querySelectorAll(
        ".settings-help-label"
    ).forEach(
        label => {
            label.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    revealSettingsHelpButton(
                        getSettingsHelpButton(
                            label.dataset.helpKey
                        )
                    );
                }
            );
        }
    );

    graphicalDialog.querySelectorAll(
        ".settings-help-button"
    ).forEach(
        button => {
            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    revealSettingsHelpButton(
                        button
                    );

                    void openSettingsHelpPopover(
                        button.dataset.helpKey,
                        button
                    );
                }
            );
        }
    );

    $("#graphicalHelpClose")?.addEventListener(
        "click",
        () => {
            void closeSettingsHelpPopover();
        }
    );

    document.addEventListener(
        "pointerdown",
        event => {
            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            const path =
                event.composedPath();

            if (
                path.includes(popover) ||
                path.includes(
                    activeSettingsHelpButton
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    graphicalDialog.addEventListener(
        "close",
        () => {
            void closeSettingsHelpPopover({
                immediate: true
            });
        }
    );

'''
text = replace_once(
    text,
    '''    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {''',
    help_functions + '''    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {''',
    "app settings help behavior"
)

text = replace_once(
    text,
    '''        if (event.target.name === "militaryTime") {
            syncTimeFormatForMilitaryToggle(form);
        }
        else if (event.target.name === "timeFormat") {
            syncMilitaryToggleForTimeFormat(form);
        }''',
    '''        if (event.target.name === "showTolerance") {
            const previous =
                getToleranceCheckboxValue(
                    event.target
                );

            const next =
                previous === true
                    ? false
                    : previous === false
                        ? undefined
                        : true;

            setToleranceCheckboxValue(
                event.target,
                next
            );
        }
        else if (event.target.name === "militaryTime") {
            syncTimeFormatForMilitaryToggle(form);
        }
        else if (event.target.name === "timeFormat") {
            syncMilitaryToggleForTimeFormat(form);
        }''',
    "app tri-state checkbox cycling"
)

path.write_text(text.rstrip() + "\n")


# app.css ------------------------------------------------------------------
path = Path("app.css")
text = path.read_text().rstrip()
marker = "/* graphical-settings-help-v1 */"
if marker in text:
    raise RuntimeError("app.css help block already exists")

text += r'''


/* graphical-settings-help-v1 */
.settings-help-row {
    display: grid;
    grid-template-columns: minmax(120px, 0.8fr) 32px minmax(0, 1.2fr);
    gap: 12px;
    align-items: center;
}

.app-dialog .settings-help-row > .settings-help-label,
.app-dialog .timer-color-row > .settings-help-label {
    display: block;
    min-width: 0;
    cursor: help;
    touch-action: manipulation;
}

.timer-color-row.with-toggle.has-setting-help {
    grid-template-columns: minmax(0, 1fr) 32px 28px 68px;
    gap: 8px;
}

.settings-help-button {
    appearance: none;
    box-sizing: border-box;
    width: 30px;
    height: 30px;
    margin: 0;
    padding: 0;
    justify-self: center;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(180 225 255 / 88%);
    border-radius: 50%;
    color: var(--wm-white);
    background: var(--wm-blue);
    box-shadow: var(--ui-inner-highlight), 0 4px 9px rgb(0 0 0 / 18%);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    font-size: 18px;
    font-weight: 900;
    line-height: 1;
    transition:
        opacity 750ms linear,
        visibility 0s linear 750ms;
}

.settings-help-button.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition:
        opacity 750ms linear,
        visibility 0s linear 0s;
}

.settings-help-button:focus-visible {
    outline: 2px solid var(--wm-white);
    outline-offset: 2px;
}

.settings-help-popover {
    position: fixed;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: min(680px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    margin: 0;
    padding: 24px;
    overflow: auto;
    border: 1.5px solid rgb(190 224 255 / 82%);
    border-radius: 16px;
    color: var(--wm-white);
    background: var(--wm-blue-dark);
    box-shadow: 0 22px 64px rgb(0 0 0 / 58%), inset 0 1px 0 rgb(255 255 255 / 12%);
    opacity: 1;
}

.settings-help-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    gap: 12px;
    align-items: center;
    margin: 0 0 18px;
    padding: 4px 0 10px;
    background: var(--wm-blue-dark);
    border-bottom: 1px solid rgb(190 224 255 / 34%);
}

.settings-help-header h3 {
    margin: 0;
    font-size: clamp(24px, 5vw, 30px);
}

.settings-help-close {
    appearance: none;
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(180 225 255 / 72%);
    border-radius: 10px;
    color: var(--wm-white);
    background: var(--wm-blue);
    font-size: 28px;
    line-height: 1;
}

.settings-help-body {
    display: grid;
    gap: 16px;
    font-size: 16px;
    line-height: 1.45;
}

.settings-help-body p {
    margin: 0;
}

.settings-help-body code {
    padding: 2px 6px;
    border-radius: 5px;
    color: #d8f0ff;
    background: rgb(0 113 206 / 24%);
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    font-size: 0.95em;
}

.settings-help-token-grid,
.settings-help-state-grid,
.settings-help-example-grid {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 8px 12px;
    align-items: start;
}

.settings-help-examples {
    padding-top: 4px;
    border-top: 1px solid rgb(190 224 255 / 22%);
}

.settings-help-example-grid > span {
    color: #a8dcff;
    font-weight: 900;
}

.settings-help-latency-lead {
    line-height: 1.65;
}

.settings-help-late {
    display: inline-block;
    margin-inline: 0.12em;
    color: var(--settings-help-latency-color, var(--timer-latency-color, #e1251b));
    font-size: clamp(1.55em, 6vw, 2.2em);
    font-weight: 950;
    line-height: 0.85;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 3px rgb(0 0 0 / 38%);
}

@media (max-width: 480px) {
    .settings-help-row {
        grid-template-columns: minmax(90px, 0.8fr) 30px minmax(0, 1.2fr);
        gap: 8px;
    }

    .timer-color-row.with-toggle.has-setting-help {
        grid-template-columns: minmax(0, 1fr) 30px 28px 68px;
        gap: 7px;
    }

    .settings-help-popover {
        width: calc(100vw - 24px);
        max-height: calc(100dvh - 24px);
        padding: 20px;
    }

    .settings-help-body {
        font-size: 15px;
    }

    .settings-help-token-grid,
    .settings-help-state-grid {
        column-gap: 10px;
    }
}
'''

path.write_text(text.rstrip() + "\n")

print("Applied tri-state tolerance, settings help, and format token changes.")
