from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text(encoding="utf-8")

helper_marker = '''        #handlePercentGoalChange() {
'''

helper = '''        #captureRadialFittedPercentGoalAnimation(
            now
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted" ||
                !this.#started
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

            const timings =
                new Map();

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
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
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end < start
                ) {
                    continue;
                }

                timings.set(
                    range,
                    {
                        start,
                        end
                    }
                );
            }

            return {
                bounds: {
                    start:
                        bounds.start,
                    end:
                        bounds.end,
                    duration:
                        bounds.duration
                },
                timings
            };
        }

        #prepareRadialFittedPercentGoalAnimation(
            snapshot,
            now
        ) {
            if (
                !snapshot ||
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return;
            }

            const targetBounds =
                this.#getRadialFittedBounds(
                    now
                );

            if (!targetBounds) {
                return;
            }

            const duration =
                this.#getRangeAnimationDuration();

            if (duration <= 0) {
                return;
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            if (
                !TimeRangeClass ||
                typeof TimeRangeClass.suspendLayout !==
                    "function"
            ) {
                return;
            }

            const boundsChanged =
                snapshot.bounds.start !==
                    targetBounds.start ||
                snapshot.bounds.end !==
                    targetBounds.end;

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const targetStart =
                    Number(
                        range.clockTimerStart
                    );

                const targetEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(targetStart) ||
                    !Number.isFinite(targetEnd) ||
                    targetEnd < targetStart
                ) {
                    continue;
                }

                const active =
                    this.#timeRangeTimingAnimations.get(
                        range
                    );

                if (active) {
                    if (boundsChanged) {
                        active.fromFittedBounds = {
                            ...snapshot.bounds
                        };

                        active.targetFittedBounds = {
                            start:
                                targetBounds.start,
                            end:
                                targetBounds.end,
                            duration:
                                targetBounds.duration
                        };

                        const targetLayout =
                            this.#calculateTimeRangeLayout(
                                range,
                                active.targetStart,
                                active.targetEnd,
                                active.originMilliseconds,
                                active.targetFittedBounds
                            );

                        if (targetLayout) {
                            active.targetLayout =
                                targetLayout;
                        }
                    }

                    continue;
                }

                const previous =
                    snapshot.timings.get(
                        range
                    );

                const timingChanged =
                    !previous ||
                    previous.start !==
                        targetStart ||
                    previous.end !==
                        targetEnd;

                if (
                    !boundsChanged &&
                    !timingChanged
                ) {
                    continue;
                }

                const fromStart =
                    previous?.start ??
                    targetStart;

                const fromEnd =
                    previous?.end ??
                    targetStart;

                const originMilliseconds =
                    targetBounds.start;

                const fromLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        fromStart,
                        fromEnd,
                        originMilliseconds,
                        snapshot.bounds
                    );

                const targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        targetStart,
                        targetEnd,
                        originMilliseconds,
                        targetBounds
                    );

                if (
                    !fromLayout ||
                    !targetLayout
                ) {
                    continue;
                }

                TimeRangeClass.suspendLayout(
                    range
                );

                this.#applyTimeRangeLayout(
                    range,
                    fromLayout
                );

                const state = {
                    fromStart,
                    fromEnd,
                    targetStart,
                    targetEnd,
                    originMilliseconds,
                    targetLayout,
                    fromFittedBounds: {
                        ...snapshot.bounds
                    },
                    targetFittedBounds: {
                        start:
                            targetBounds.start,
                        end:
                            targetBounds.end,
                        duration:
                            targetBounds.duration
                    },
                    pending:
                        undefined,
                    frame:
                        undefined,
                    startedAt:
                        undefined,
                    duration
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
            }
        }

'''

if text.count(helper_marker) != 1:
    raise SystemExit(
        f"Expected one percent-goal handler marker, found {text.count(helper_marker)}; refusing to patch."
    )

text = text.replace(
    helper_marker,
    helper + helper_marker,
    1
)

old_capture = '''            const previousGoal =
                this.#percentGoal;

            const counterclockwiseOvertimeRemoval =
'''

new_capture = '''            const previousGoal =
                this.#percentGoal;

            const percentGoalAnimation =
                this.#captureRadialFittedPercentGoalAnimation(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

            const counterclockwiseOvertimeRemoval =
'''

if text.count(old_capture) != 1:
    raise SystemExit(
        f"Expected one percent-goal capture insertion point, found {text.count(old_capture)}; refusing to patch."
    )

text = text.replace(
    old_capture,
    new_capture,
    1
)

old_prepare = '''            this.#reapplyOverwriteRanges();

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks: true
                }
            );
        }

        #getRangeAnimationDuration() {
'''

new_prepare = '''            this.#reapplyOverwriteRanges();

            this.#prepareRadialFittedPercentGoalAnimation(
                percentGoalAnimation,
                now
            );

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks: true
                }
            );
        }

        #getRangeAnimationDuration() {
'''

if text.count(old_prepare) != 1:
    raise SystemExit(
        f"Expected one percent-goal prepare insertion point, found {text.count(old_prepare)}; refusing to patch."
    )

text = text.replace(
    old_prepare,
    new_prepare,
    1
)

old_step = '''            const currentLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    currentStart,
                    currentEnd,
                    state.originMilliseconds
                );
'''

new_step = '''            let fittedBounds;

            if (
                state.fromFittedBounds &&
                state.targetFittedBounds
            ) {
                const start =
                    state.fromFittedBounds.start +
                    (
                        state.targetFittedBounds.start -
                        state.fromFittedBounds.start
                    ) *
                    progress;

                const end =
                    state.fromFittedBounds.end +
                    (
                        state.targetFittedBounds.end -
                        state.fromFittedBounds.end
                    ) *
                    progress;

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    end > start
                ) {
                    fittedBounds = {
                        start,
                        end,
                        duration:
                            end - start
                    };
                }
            }

            const currentLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    currentStart,
                    currentEnd,
                    state.originMilliseconds,
                    fittedBounds
                );
'''

if text.count(old_step) != 1:
    raise SystemExit(
        f"Expected one timing animation layout step, found {text.count(old_step)}; refusing to patch."
    )

text = text.replace(
    old_step,
    new_step,
    1
)

old_pending = '''                state.fromEnd =
                    state.targetEnd;

                state.targetStart =
                    pending.start;
'''

new_pending = '''                state.fromEnd =
                    state.targetEnd;

                if (
                    state.targetFittedBounds
                ) {
                    state.fromFittedBounds = {
                        ...state.targetFittedBounds
                    };
                }

                state.targetStart =
                    pending.start;
'''

if text.count(old_pending) != 1:
    raise SystemExit(
        f"Expected one pending animation handoff, found {text.count(old_pending)}; refusing to patch."
    )

text = text.replace(
    old_pending,
    new_pending,
    1
)

path.write_text(text, encoding="utf-8")
