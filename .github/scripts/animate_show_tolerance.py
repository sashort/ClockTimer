from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''        #loadingFromJSON =\n            false;\n\n        #startedAtEpoch;''',
    '''        #loadingFromJSON =\n            false;\n\n        #toleranceTransitionState;\n\n        #startedAtEpoch;''',
    "tolerance transition state"
)

replace_once(
    '''            const now =\n                this.#getCurrentTimelineTime();\n\n            this.#reconcilePlannedRanges();\n\n            this.#refreshRingLayout(\n                now,\n                { refreshTickMarks: true }\n            );\n        }\n\n        get status() {''',
    '''            this.#transitionShowTolerance();\n        }\n\n        get status() {''',
    "showTolerance setter transition"
)

helpers = r'''        #getToleranceRanges() {
            return this.#getManagedTimeRanges()
                .filter(
                    range =>
                        range.clockTimerPlanned !==
                            undefined &&
                        range.timeRangeExiting !==
                            true &&
                        range.getAttribute(
                            "type"
                        ) === "tolerance"
                );
        }

        #getCurrentToleranceRenderEnd() {
            let end =
                this.#calculatedEnd;

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
            end
        ) {
            const segments = [];

            if (
                !Number.isFinite(
                    this.#calculatedEnd
                ) ||
                !Number.isFinite(end) ||
                end <= this.#calculatedEnd
            ) {
                return segments;
            }

            let cursor =
                this.#calculatedEnd;

            while (cursor < end) {
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
                        end,
                        ringEnd
                    );

                if (
                    !Number.isFinite(segmentEnd) ||
                    segmentEnd <= cursor
                ) {
                    break;
                }

                segments.push({
                    ringIndex,
                    start: cursor,
                    end: segmentEnd
                });

                cursor =
                    segmentEnd;
            }

            return segments;
        }

        #ringHasNonToleranceContent(
            ring
        ) {
            for (const child of ring.children) {
                if (
                    child.localName !==
                        "time-range"
                ) {
                    return true;
                }

                if (
                    child.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                if (
                    child.clockTimerPlanned !==
                        undefined &&
                    child.getAttribute(
                        "type"
                    ) === "tolerance"
                ) {
                    continue;
                }

                return true;
            }

            return false;
        }

        #getToleranceFadeOutRings(
            targetEnd
        ) {
            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
                        targetEnd
                    ).map(
                        segment =>
                            segment.ringIndex
                    )
                );

            const rings = [];

            for (
                const [ringIndex, ring] of
                    this.#rings
            ) {
                if (
                    finalRingIndexes.has(
                        ringIndex
                    ) ||
                    this.#ringHasNonToleranceContent(
                        ring
                    )
                ) {
                    continue;
                }

                const hasTolerance =
                    Array.from(
                        ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.clockTimerPlanned !==
                                undefined &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    );

                if (hasTolerance) {
                    rings.push(
                        ring
                    );
                }
            }

            return rings;
        }

        #startToleranceRingFade(
            state,
            ring,
            direction
        ) {
            if (
                !state ||
                !ring ||
                state.ringFades.has(
                    ring
                )
            ) {
                return;
            }

            ring.clockTimerToleranceTransitionHold =
                true;

            const targetOpacity =
                getComputedStyle(
                    ring
                ).opacity || "1";

            const fromOpacity =
                direction === "in"
                    ? "0"
                    : targetOpacity;

            const toOpacity =
                direction === "in"
                    ? targetOpacity
                    : "0";

            const fade = {
                ring,
                direction,
                animation: undefined,
                finished: false
            };

            state.ringFades.set(
                ring,
                fade
            );

            if (
                typeof ring.animate !==
                    "function"
            ) {
                fade.finished =
                    true;

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            const animation =
                ring.animate(
                    [
                        {
                            opacity:
                                fromOpacity
                        },
                        {
                            opacity:
                                toOpacity
                        }
                    ],
                    {
                        duration: 750,
                        easing: "linear",
                        fill: "both"
                    }
                );

            fade.animation =
                animation;

            animation.finished
                .then(
                    () => {
                        fade.finished =
                            true;

                        this.#maybeFinishToleranceTransition(
                            state
                        );
                    }
                )
                .catch(() => {});
        }

        #suspendToleranceTransitionRange(
            state,
            range
        ) {
            if (
                state.suspendedRanges.has(
                    range
                )
            ) {
                return;
            }

            this.#releaseTimeRangeTimingAnimation(
                range
            );

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            TimeRangeClass?.suspendLayout?.(
                range
            );

            state.suspendedRanges.add(
                range
            );
        }

        #writeToleranceTransitionTiming(
            state,
            range,
            start,
            end
        ) {
            this.#suspendToleranceTransitionRange(
                state,
                range
            );

            const startTime =
                this.#formatTimelineTime(
                    start
                );

            const endTime =
                this.#formatTimelineTime(
                    end
                );

            if (
                range.getAttribute(
                    "start-time"
                ) !== startTime
            ) {
                range.setAttribute(
                    "start-time",
                    startTime
                );
            }

            if (
                range.getAttribute(
                    "end-time"
                ) !== endTime
            ) {
                range.setAttribute(
                    "end-time",
                    endTime
                );
            }

            range.removeAttribute(
                "range-length"
            );

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);
        }

        #syncToleranceTransitionRanges(
            state,
            end
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            state.currentEnd =
                end;

            const desired =
                this.#getToleranceTransitionSegments(
                    end
                );

            const existing =
                new Map();

            for (
                const range of
                    this.#getToleranceRanges()
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (
                    !Number.isFinite(ringIndex) ||
                    existing.has(ringIndex)
                ) {
                    continue;
                }

                existing.set(
                    ringIndex,
                    range
                );
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

                let range =
                    existing.get(
                        target.ringIndex
                    );

                if (range) {
                    existing.delete(
                        target.ringIndex
                    );
                }
                else {
                    range =
                        this.#createTimeRange(
                            "tolerance",
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

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    end,
                    {
                        suspendLayout: false
                    }
                );
            }

            if (layoutChanged) {
                this.#refreshRingLayout(
                    end
                );
            }
        }

        #maybeFinishToleranceTransition(
            state
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state ||
                !state.endpointFinished
            ) {
                return;
            }

            for (const fade of state.ringFades.values()) {
                if (!fade.finished) {
                    return;
                }
            }

            this.#finishToleranceTransition(
                state
            );
        }

        #finishToleranceTransition(
            state
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );

                state.frame =
                    undefined;
            }

            this.#syncToleranceTransitionRanges(
                state,
                state.targetEnd
            );

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (
                const range of
                    state.suspendedRanges
            ) {
                TimeRangeClass?.resumeLayout?.(
                    range
                );
            }

            state.suspendedRanges.clear();

            for (const fade of state.ringFades.values()) {
                fade.animation?.cancel();

                delete fade.ring
                    .clockTimerToleranceTransitionHold;

                if (
                    fade.direction === "out" &&
                    !this.#ringHasNonToleranceContent(
                        fade.ring
                    ) &&
                    !Array.from(
                        fade.ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.clockTimerPlanned !==
                                undefined &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    )
                ) {
                    const ringIndex =
                        Number(
                            fade.ring.clockTimerRingIndex
                        );

                    fade.ring.remove();

                    if (
                        Number.isFinite(ringIndex)
                    ) {
                        this.#rings.delete(
                            ringIndex
                        );
                    }
                }
            }

            state.ringFades.clear();

            this.#toleranceTransitionState =
                undefined;

            this.#removeEmptyRings();

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined,
                {
                    refreshTickMarks: true
                }
            );
        }

        #cancelToleranceTransition() {
            const state =
                this.#toleranceTransitionState;

            if (!state) {
                return;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (
                const range of
                    state.suspendedRanges
            ) {
                TimeRangeClass?.resumeLayout?.(
                    range
                );
            }

            for (const fade of state.ringFades.values()) {
                fade.animation?.cancel();

                delete fade.ring
                    .clockTimerToleranceTransitionHold;
            }

            this.#toleranceTransitionState =
                undefined;
        }

        #stepToleranceTransition(
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

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            this.#syncToleranceTransitionRanges(
                state,
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

        #transitionShowTolerance() {
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

            const fromEnd =
                Math.max(
                    this.#calculatedEnd,
                    Math.min(
                        this.#standardEnd,
                        this.#getCurrentToleranceRenderEnd() ??
                            this.#calculatedEnd
                    )
                );

            const targetEnd =
                this.#showTolerance
                    ? this.#standardEnd
                    : Math.max(
                        this.#calculatedEnd,
                        Math.min(
                            now,
                            this.#standardEnd
                        )
                    );

            if (fromEnd === targetEnd) {
                this.#reconcilePlannedRanges();

                this.#refreshRingLayout(
                    now,
                    { refreshTickMarks: true }
                );

                return;
            }

            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
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

            const fadeOutRings =
                this.#getToleranceFadeOutRings(
                    targetEnd
                );

            const state = {
                fromEnd,
                targetEnd,
                currentEnd: fromEnd,
                duration:
                    ringWillAppear ||
                    fadeOutRings.length > 0
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

            this.#toleranceTransitionState =
                state;

            for (const ring of fadeOutRings) {
                this.#startToleranceRingFade(
                    state,
                    ring,
                    "out"
                );
            }

            this.#syncToleranceTransitionRanges(
                state,
                fromEnd
            );

            if (state.duration <= 0) {
                state.endpointFinished =
                    true;

                this.#syncToleranceTransitionRanges(
                    state,
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

'''

replace_once(
    '''        #getToleranceRenderEnd(\n            now = undefined\n        ) {''',
    helpers + '''        #getToleranceRenderEnd(\n            now = undefined\n        ) {''',
    "showTolerance transition helpers"
)

replace_once(
    '''            if (\n                !this.#started ||\n                this.#showTolerance\n            ) {\n                return this.#standardEnd;\n            }''',
    '''            const transitionEnd =\n                this.#toleranceTransitionState\n                    ?.currentEnd;\n\n            if (\n                Number.isFinite(\n                    transitionEnd\n                )\n            ) {\n                return transitionEnd >\n                    this.#calculatedEnd\n                    ? transitionEnd\n                    : undefined;\n            }\n\n            if (\n                !this.#started ||\n                this.#showTolerance\n            ) {\n                return this.#standardEnd;\n            }''',
    "transition render end override"
)

replace_once(
    '''                if (\n                    ring.children.length >\n                        0\n                ) {\n                    continue;\n                }''',
    '''                if (\n                    ring.children.length >\n                        0 ||\n                    ring.clockTimerToleranceTransitionHold ===\n                        true\n                ) {\n                    continue;\n                }''',
    "hold fading tolerance rings"
)

replace_once(
    '''                !this.#showTolerance &&\n                this.#percentGoal > 1 &&\n                this.#json === undefined &&\n                !this.#loadingFromJSON\n            ) {''',
    '''                !this.#showTolerance &&\n                this.#percentGoal > 1 &&\n                this.#json === undefined &&\n                !this.#loadingFromJSON &&\n                !this.#toleranceTransitionState\n            ) {''',
    "skip tick reconcile during tolerance transition"
)

replace_once(
    '''            this.#json =\n                undefined;\n\n            this.#stopTickTimer();''',
    '''            this.#json =\n                undefined;\n\n            this.#cancelToleranceTransition();\n\n            this.#stopTickTimer();''',
    "clear tolerance transition"
)

path.write_text(text)
