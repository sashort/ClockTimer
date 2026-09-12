from pathlib import Path
import re

clock_path = Path("ClockTimer.js")
time_path = Path("TimeRange.js")
clock = clock_path.read_text()
time = time_path.read_text()


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing marker: {label}")
    return text.replace(old, new, 1)

# Private state for the unified state-change visual choreography.
clock = replace_once(
    clock,
    "        #waveRange;\n\n        #elapsedRange;",
    "        #waveRange;\n\n        #stateChangeVisualState;\n\n        #stateChangeWaveRing;\n\n        #stateChangeWaveRange;\n\n        #stateChangeWaveTimeout;\n\n        #elapsedRange;",
    "state change private fields",
)

# A dedicated one-shot wave that starts with its bright center at 12 o'clock,
# sweeps once clockwise, and is gone after exactly 750ms.
time = replace_once(
    time,
    '''            :host([type="wave"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

            @keyframes elapsed-wave-sweep {''',
    '''            :host([type="wave"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

            :host([type="wave"][state-change-wave]) #elapsed-wave {
                animation: state-change-wave-sweep 750ms linear 1 both;
            }

            @keyframes state-change-wave-sweep {
                0% {
                    opacity: 1;
                    transform: rotate(-180deg);
                }

                96% {
                    opacity: 1;
                }

                100% {
                    opacity: 0;
                    transform: rotate(180deg);
                }
            }

            @keyframes elapsed-wave-sweep {''',
    "state change wave CSS",
)

helpers = r'''
        #getStateChangeActiveRing() {
            const rings =
                Array.from(
                    this.#rings.values()
                ).filter(
                    ring =>
                        ring?.isConnected &&
                        ring.clockTimerExitingRing !==
                            true
                );

            const active =
                rings.find(
                    ring =>
                        ring.hasAttribute(
                            "active"
                        )
                );

            if (active) {
                return active;
            }

            if (this.#started) {
                const now =
                    this.#getCurrentTimelineTime();

                if (Number.isFinite(now)) {
                    const ring =
                        this.#rings.get(
                            this.#getTimerRingIndex(
                                now
                            )
                        );

                    if (ring?.isConnected) {
                        return ring;
                    }
                }
            }

            return rings[0];
        }

        #removeStateChangeWave() {
            if (
                this.#stateChangeWaveTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#stateChangeWaveTimeout
                );

                this.#stateChangeWaveTimeout =
                    undefined;
            }

            this.#stateChangeWaveRange?.remove();
            this.#stateChangeWaveRing?.remove();

            this.#stateChangeWaveRange =
                undefined;

            this.#stateChangeWaveRing =
                undefined;
        }

        #configureInternalVisualRing(
            ring,
            sourceRing,
            zIndex
        ) {
            ring.style.position =
                "absolute";

            ring.style.inset =
                "0";

            ring.style.width =
                "100%";

            ring.style.height =
                "100%";

            ring.style.zIndex =
                String(zIndex);

            ring.style.pointerEvents =
                "none";

            ring.style.background =
                "transparent";

            ring.resizeDuration =
                "0ms";

            ring.resizeFilter =
                "none";

            ring.reorderFilter =
                "none";

            ring.connectFilter =
                "none";

            ring.disconnectFilter =
                "none";

            ring.filterRamp =
                false;

            ring.filterRampFront =
                "0ms";

            ring.filterRampEnd =
                "0ms";

            ring.filterRampConnect =
                "0ms";

            ring.filterRampDisconnect =
                "0ms";

            ring.clockTimerRing =
                "";

            ring.clockTimerRingIndex =
                sourceRing?.clockTimerRingIndex ??
                "";

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            this.#syncInternalVisualRingGeometry(
                ring,
                sourceRing
            );
        }

        #syncInternalVisualRingGeometry(
            ring,
            sourceRing
        ) {
            if (
                !ring ||
                !sourceRing
            ) {
                return;
            }

            const inset =
                sourceRing.renderedInset ??
                sourceRing.getAttribute(
                    "inset"
                ) ??
                sourceRing.inset ??
                "0px";

            const width =
                sourceRing.renderedWidth ??
                sourceRing.getAttribute(
                    "width"
                ) ??
                sourceRing.width ??
                "0px";

            ring.clockTimerRingIndex =
                sourceRing.clockTimerRingIndex ??
                "";

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            ring.inset =
                String(inset);

            ring.width =
                String(width);

            ring.snapGeometry?.();
        }

        #startStateChangeWave() {
            this.#removeStateChangeWave();

            if (
                !this.#started ||
                !this.#ringLayer
            ) {
                return;
            }

            const sourceRing =
                this.#getStateChangeActiveRing();

            if (!sourceRing) {
                return;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.id =
                "state-change-wave-ring";

            ring.clockTimerInternalStateChangeWave =
                "";

            this.#configureInternalVisualRing(
                ring,
                sourceRing,
                110
            );

            this.#ringLayer.appendChild(
                ring
            );

            let start;
            let end;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds(
                        this.#getCurrentTimelineTime()
                    );

                start =
                    bounds?.start;

                end =
                    bounds?.end;
            }
            else {
                const ringIndex =
                    Number(
                        sourceRing.clockTimerRingIndex
                    );

                if (Number.isFinite(ringIndex)) {
                    start =
                        this.#getTimerRingStart(
                            ringIndex
                        );

                    end =
                        this.#getTimerRingEnd(
                            ringIndex
                        );
                }
            }

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                start =
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                        ? this.#scheduledStartMilliseconds
                        : 0;

                end =
                    start +
                    ClockTimer.#HOUR;
            }

            const range =
                document.createElement(
                    "time-range"
                );

            range.setAttribute(
                "type",
                "wave"
            );

            range.setAttribute(
                "state-change-wave",
                ""
            );

            range.setAttribute(
                "overlapping",
                ""
            );

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            range.setAttribute(
                "end-time",
                this.#formatTimelineTime(
                    end
                )
            );

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);

            range.clockTimerInternalStateChangeWave =
                "";

            range.timeRangeFullEntry =
                true;

            range.style.clipPath =
                "none";

            ring.appendChild(
                range
            );

            this.#stateChangeWaveRing =
                ring;

            this.#stateChangeWaveRange =
                range;

            this.#stateChangeWaveTimeout =
                setTimeout(
                    () => {
                        this.#stateChangeWaveTimeout =
                            undefined;

                        if (
                            this.#stateChangeWaveRange ===
                                range
                        ) {
                            this.#removeStateChangeWave();
                        }
                    },
                    750
                );
        }

        #removeNormalStateVisualRanges() {
            for (
                const range of
                    Array.from(
                        this.querySelectorAll(
                            ":scope > ring-container > time-range.elapsed, :scope > ring-container > time-range.remaining"
                        )
                    )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            this.#elapsedRange =
                undefined;

            this.#remainingRanges.clear();

            this.#removeWaveRange();
        }

        #getStateChangeRangeTiming(
            range,
            timestamp = performance.now()
        ) {
            const animation =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (
                animation &&
                Number.isFinite(animation.fromStart) &&
                Number.isFinite(animation.fromEnd) &&
                Number.isFinite(animation.targetStart) &&
                Number.isFinite(animation.targetEnd)
            ) {
                const duration =
                    Number(animation.duration);

                const progress =
                    !Number.isFinite(duration) ||
                    duration <= 0
                        ? 1
                        : animation.startedAt ===
                            undefined
                            ? 0
                            : Math.min(
                                1,
                                Math.max(
                                    0,
                                    (
                                        timestamp -
                                        animation.startedAt
                                    ) /
                                    duration
                                )
                            );

                return {
                    start:
                        animation.fromStart +
                        (
                            animation.targetStart -
                            animation.fromStart
                        ) *
                        progress,
                    end:
                        animation.fromEnd +
                        (
                            animation.targetEnd -
                            animation.fromEnd
                        ) *
                        progress
                };
            }

            return {
                start:
                    Number(
                        range.clockTimerStart
                    ),
                end:
                    Number(
                        range.clockTimerEnd
                    )
            };
        }

        #getStateChangeFittedBounds(
            timestamp = performance.now()
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return undefined;
            }

            for (
                const animation of
                    this.#timeRangeTimingAnimations.values()
            ) {
                const from =
                    animation.fromFittedBounds;

                const target =
                    animation.targetFittedBounds;

                if (
                    !from ||
                    !target ||
                    !Number.isFinite(from.start) ||
                    !Number.isFinite(from.end) ||
                    !Number.isFinite(target.start) ||
                    !Number.isFinite(target.end)
                ) {
                    continue;
                }

                const duration =
                    Number(animation.duration);

                const progress =
                    !Number.isFinite(duration) ||
                    duration <= 0
                        ? 1
                        : animation.startedAt ===
                            undefined
                            ? 0
                            : Math.min(
                                1,
                                Math.max(
                                    0,
                                    (
                                        timestamp -
                                        animation.startedAt
                                    ) /
                                    duration
                                )
                            );

                const start =
                    from.start +
                    (
                        target.start -
                        from.start
                    ) *
                    progress;

                const end =
                    from.end +
                    (
                        target.end -
                        from.end
                    ) *
                    progress;

                if (end > start) {
                    return {
                        start,
                        end,
                        duration:
                            end - start
                    };
                }
            }

            return this.#getRadialFittedBounds(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined
            );
        }

        #getStateChangeVisibleSegments(
            timestamp = performance.now()
        ) {
            const byRing =
                new Map();

            const ignoredTypes =
                new Set([
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
                    range.timeRangeExiting ===
                        true ||
                    range.clockTimerStateChangeOverlay !==
                        undefined ||
                    ignoredTypes.has(
                        range.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                const sourceRing =
                    range.parentElement;

                if (
                    !sourceRing ||
                    !sourceRing.isConnected ||
                    sourceRing.clockTimerExitingRing ===
                        true ||
                    sourceRing.clockTimerLayoutDetached ===
                        true
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(
                        range
                    );

                const opacity =
                    Number.parseFloat(
                        style.opacity
                    );

                if (
                    style.display === "none" ||
                    style.visibility === "hidden" ||
                    (
                        Number.isFinite(opacity) &&
                        opacity <= 0
                    )
                ) {
                    continue;
                }

                const timing =
                    this.#getStateChangeRangeTiming(
                        range,
                        timestamp
                    );

                if (
                    !Number.isFinite(timing.start) ||
                    !Number.isFinite(timing.end) ||
                    timing.end <= timing.start
                ) {
                    continue;
                }

                if (!byRing.has(sourceRing)) {
                    byRing.set(
                        sourceRing,
                        []
                    );
                }

                byRing.get(sourceRing).push({
                    start: timing.start,
                    end: timing.end
                });
            }

            const segments = [];

            for (
                const [sourceRing, entries] of
                    byRing
            ) {
                entries.sort(
                    (a, b) =>
                        a.start - b.start ||
                        a.end - b.end
                );

                let current;

                for (const entry of entries) {
                    if (
                        current &&
                        entry.start <=
                            current.end + 0.0001
                    ) {
                        current.end =
                            Math.max(
                                current.end,
                                entry.end
                            );

                        continue;
                    }

                    current = {
                        sourceRing,
                        start: entry.start,
                        end: entry.end
                    };

                    segments.push(
                        current
                    );
                }
            }

            segments.sort(
                (a, b) =>
                    Number(
                        a.sourceRing.clockTimerRingIndex
                    ) -
                    Number(
                        b.sourceRing.clockTimerRingIndex
                    ) ||
                    a.start - b.start
            );

            return segments;
        }

        #getStateChangeFinalCoverage() {
            if (!this.#started) {
                return [];
            }

            const now =
                this.#getCurrentTimelineTime();

            if (!Number.isFinite(now)) {
                return [];
            }

            const mode =
                this.#getTimerMode();

            if (mode === "elapsed") {
                const ringIndex =
                    this.#getTimerRingIndex(
                        now
                    );

                const sourceRing =
                    this.#rings.get(
                        ringIndex
                    );

                const start =
                    this.#getTimerRingStart(
                        ringIndex
                    );

                if (
                    sourceRing?.isConnected &&
                    Number.isFinite(start) &&
                    now > start
                ) {
                    return [{
                        sourceRing,
                        start,
                        end: now
                    }];
                }

                return [];
            }

            const visibleEnd =
                this.#getLatestTimerEnd();

            if (
                !Number.isFinite(visibleEnd) ||
                visibleEnd <= now
            ) {
                return [];
            }

            const coverage = [];
            let cursor = now;

            while (cursor < visibleEnd) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const sourceRing =
                    this.#rings.get(
                        ringIndex
                    );

                const ringEnd =
                    this.#getTimerRingEnd(
                        ringIndex
                    );

                const end =
                    Math.min(
                        visibleEnd,
                        ringEnd
                    );

                if (
                    !sourceRing?.isConnected ||
                    !Number.isFinite(end) ||
                    end <= cursor
                ) {
                    break;
                }

                coverage.push({
                    sourceRing,
                    start: cursor,
                    end
                });

                cursor = end;
            }

            return coverage;
        }

        #splitStateChangeOverlaySegments(
            visibleSegments,
            fadeStarted
        ) {
            if (!fadeStarted) {
                return visibleSegments.map(
                    segment => ({
                        ...segment,
                        role: "hold"
                    })
                );
            }

            const coverage =
                this.#getStateChangeFinalCoverage();

            const pieces = [];

            for (const segment of visibleSegments) {
                const matches =
                    coverage
                        .filter(
                            item =>
                                item.sourceRing ===
                                    segment.sourceRing &&
                                item.end >
                                    segment.start &&
                                item.start <
                                    segment.end
                        )
                        .map(
                            item => ({
                                start:
                                    Math.max(
                                        segment.start,
                                        item.start
                                    ),
                                end:
                                    Math.min(
                                        segment.end,
                                        item.end
                                    )
                            })
                        )
                        .sort(
                            (a, b) =>
                                a.start - b.start
                        );

                let cursor =
                    segment.start;

                for (const match of matches) {
                    if (match.start > cursor) {
                        pieces.push({
                            sourceRing:
                                segment.sourceRing,
                            start: cursor,
                            end: match.start,
                            role: "fade"
                        });
                    }

                    if (match.end > match.start) {
                        pieces.push({
                            sourceRing:
                                segment.sourceRing,
                            start: match.start,
                            end: match.end,
                            role: "keep"
                        });
                    }

                    cursor =
                        Math.max(
                            cursor,
                            match.end
                        );
                }

                if (cursor < segment.end) {
                    pieces.push({
                        sourceRing:
                            segment.sourceRing,
                        start: cursor,
                        end: segment.end,
                        role: "fade"
                    });
                }
            }

            return pieces;
        }

        #removeStateChangeOverlayRing(
            state,
            sourceRing
        ) {
            const record =
                state.overlayRings.get(
                    sourceRing
                );

            if (!record) {
                return;
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (const range of record.ranges) {
                TimeRangeClass?.resumeLayout?.(
                    range
                );
            }

            record.ring.remove();

            state.overlayRings.delete(
                sourceRing
            );
        }

        #ensureStateChangeOverlayRing(
            state,
            sourceRing
        ) {
            let record =
                state.overlayRings.get(
                    sourceRing
                );

            if (record) {
                this.#syncInternalVisualRingGeometry(
                    record.ring,
                    sourceRing
                );

                return record;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerInternalStateChangeOverlay =
                "";

            this.#configureInternalVisualRing(
                ring,
                sourceRing,
                100
            );

            this.#ringLayer.appendChild(
                ring
            );

            record = {
                ring,
                ranges: []
            };

            state.overlayRings.set(
                sourceRing,
                record
            );

            return record;
        }

        #syncStateChangeOverlayRecord(
            state,
            sourceRing,
            pieces,
            timestamp
        ) {
            const record =
                this.#ensureStateChangeOverlayRing(
                    state,
                    sourceRing
                );

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const fittedBounds =
                this.#getStateChangeFittedBounds(
                    timestamp
                );

            const fadeProgress =
                state.fadeStartedAt ===
                    undefined
                    ? 0
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.fadeStartedAt
                            ) /
                            750
                        )
                    );

            for (
                let index = 0;
                index < pieces.length;
                index++
            ) {
                const piece =
                    pieces[index];

                let range =
                    record.ranges[index];

                if (!range) {
                    range =
                        this.#createTimeRange(
                            state.mode,
                            piece.start,
                            piece.end,
                            {
                                dynamic: true
                            }
                        );

                    range.clockTimerStateChangeOverlay =
                        "";

                    range.timeRangeFullEntry =
                        true;

                    range.style.zIndex =
                        "100";

                    record.ring.appendChild(
                        range
                    );

                    TimeRangeClass?.suspendLayout?.(
                        range
                    );

                    record.ranges.push(
                        range
                    );
                }

                this.#setRangeTiming(
                    range,
                    piece.start,
                    piece.end,
                    range.hasAttribute(
                        "range-length"
                    )
                );

                range.clockTimerStart =
                    String(piece.start);

                range.clockTimerEnd =
                    String(piece.end);

                const ringIndex =
                    Number(
                        sourceRing.clockTimerRingIndex
                    );

                const origin =
                    this.#getTimerType() ===
                        "radial-fitted"
                        ? fittedBounds?.start
                        : (
                            Number.isFinite(ringIndex)
                                ? this.#getTimerRingStart(
                                    ringIndex
                                )
                                : undefined
                        );

                const layout =
                    this.#calculateTimeRangeLayout(
                        range,
                        piece.start,
                        piece.end,
                        origin,
                        fittedBounds
                    );

                if (layout) {
                    this.#applyTimeRangeLayout(
                        range,
                        layout,
                        true
                    );
                }

                if (piece.role === "fade") {
                    const targetOpacity =
                        Number.isFinite(
                            range.clockTimerStateChangeOpacity
                        )
                            ? range.clockTimerStateChangeOpacity
                            : this.#getRangeOpacity(
                                range
                            );

                    range.clockTimerStateChangeOpacity =
                        targetOpacity;

                    range.style.opacity =
                        String(
                            Math.max(
                                0,
                                targetOpacity *
                                    (1 - fadeProgress)
                            )
                        );
                }
                else {
                    delete range.clockTimerStateChangeOpacity;

                    range.style.removeProperty(
                        "opacity"
                    );
                }
            }

            while (
                record.ranges.length >
                    pieces.length
            ) {
                const range =
                    record.ranges.pop();

                TimeRangeClass?.resumeLayout?.(
                    range
                );

                range.remove();
            }
        }

        #syncStateChangeVisuals(
            state,
            timestamp = performance.now()
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                !state.activated
            ) {
                return;
            }

            const visible =
                this.#getStateChangeVisibleSegments(
                    timestamp
                );

            const pieces =
                this.#splitStateChangeOverlaySegments(
                    visible,
                    state.fadeStartedAt !==
                        undefined
                );

            const byRing =
                new Map();

            for (const piece of pieces) {
                if (!byRing.has(piece.sourceRing)) {
                    byRing.set(
                        piece.sourceRing,
                        []
                    );
                }

                byRing.get(piece.sourceRing).push(
                    piece
                );
            }

            for (
                const sourceRing of
                    Array.from(
                        state.overlayRings.keys()
                    )
            ) {
                if (
                    !sourceRing.isConnected ||
                    !byRing.has(sourceRing)
                ) {
                    this.#removeStateChangeOverlayRing(
                        state,
                        sourceRing
                    );
                }
            }

            for (
                const [sourceRing, ringPieces] of
                    byRing
            ) {
                this.#syncStateChangeOverlayRecord(
                    state,
                    sourceRing,
                    ringPieces,
                    timestamp
                );
            }
        }

        #stepStateChangeVisuals(
            state,
            timestamp
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            state.frame =
                undefined;

            if (!this.isConnected) {
                this.#cancelStateChangeVisuals(
                    false
                );

                return;
            }

            if (
                Number.isFinite(
                    state.totalDuration
                )
            ) {
                const elapsed =
                    timestamp -
                    state.startedAt;

                const fadeAt =
                    Math.max(
                        0,
                        state.totalDuration -
                        750
                    );

                if (
                    state.fadeStartedAt ===
                        undefined &&
                    elapsed >= fadeAt
                ) {
                    state.fadeStartedAt =
                        state.startedAt +
                        fadeAt;
                }

                if (
                    elapsed >=
                        state.totalDuration
                ) {
                    if (
                        state.fadeStartedAt ===
                            undefined
                    ) {
                        state.fadeStartedAt =
                            timestamp -
                            750;
                    }

                    this.#syncStateChangeVisuals(
                        state,
                        timestamp
                    );

                    this.#finishStateChangeVisuals(
                        state
                    );

                    return;
                }
            }

            this.#syncStateChangeVisuals(
                state,
                timestamp
            );

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepStateChangeVisuals(
                            state,
                            nextTimestamp
                        )
                );
        }

        #beginStateChangeVisuals() {
            if (
                !this.#started ||
                !this.isConnected
            ) {
                return undefined;
            }

            this.#cancelStateChangeVisuals(
                false
            );

            this.#startStateChangeWave();
            this.#removeNormalStateVisualRanges();

            const state = {
                mode:
                    this.#getTimerMode(),
                startedAt:
                    performance.now(),
                activated:
                    false,
                frame:
                    undefined,
                fadeStartedAt:
                    undefined,
                totalDuration:
                    undefined,
                overlayRings:
                    new Map()
            };

            this.#stateChangeVisualState =
                state;

            return state;
        }

        #activateStateChangeVisuals(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                state.activated
            ) {
                return;
            }

            state.mode =
                this.#getTimerMode();

            state.activated =
                true;

            this.#syncStateChangeVisuals(
                state
            );

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepStateChangeVisuals(
                            state,
                            timestamp
                        )
                );
        }

        #setStateChangeVisualDuration(
            state,
            duration
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            state.totalDuration =
                Math.max(
                    750,
                    Number.isFinite(duration)
                        ? duration
                        : 0
                );
        }

        #startStateChangeVisualFade(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                state.fadeStartedAt !==
                    undefined
            ) {
                return;
            }

            state.fadeStartedAt =
                performance.now();
        }

        #getStateChangeAnimationDuration() {
            return Math.max(
                this.#getRangeAnimationDuration(),
                0,
                ...this.#getTimerRings().map(
                    ring =>
                        this.#getTimerTypeRingAnimationDuration(
                            ring
                        )
                )
            );
        }

        #finishStateChangeVisuals(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            if (state.frame !== undefined) {
                cancelAnimationFrame(
                    state.frame
                );

                state.frame =
                    undefined;
            }

            for (
                const sourceRing of
                    Array.from(
                        state.overlayRings.keys()
                    )
            ) {
                this.#removeStateChangeOverlayRing(
                    state,
                    sourceRing
                );
            }

            this.#removeStateChangeWave();

            this.#stateChangeVisualState =
                undefined;

            if (!this.#started) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime();

            this.#updateElapsedRange(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#syncWaveRange();

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    now,
                    {
                        suspendLayout: false
                    }
                );
            }
        }

        #cancelStateChangeVisuals(
            restore = true
        ) {
            const state =
                this.#stateChangeVisualState;

            if (state?.frame !== undefined) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            if (state) {
                for (
                    const sourceRing of
                        Array.from(
                            state.overlayRings.keys()
                        )
                ) {
                    this.#removeStateChangeOverlayRing(
                        state,
                        sourceRing
                    );
                }
            }

            this.#removeStateChangeWave();

            this.#stateChangeVisualState =
                undefined;

            if (
                !restore ||
                !this.#started
            ) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime();

            this.#updateElapsedRange(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#syncWaveRange();
        }

'''

clock = replace_once(
    clock,
    "\n\n        #getTimerMode() {",
    "\n" + helpers + "        #getTimerMode() {",
    "insert state change helpers",
)

# Normal elapsed/remaining/wave maintenance must stay out of the way while the
# transition overlays own the visual state.
clock = replace_once(
    clock,
    '''        #updateElapsedRange(
            now
        ) {
            if (
                !this.#started
            ) {
                return;
            }
''',
    '''        #updateElapsedRange(
            now
        ) {
            if (
                !this.#started ||
                this.#stateChangeVisualState
            ) {
                return;
            }
''',
    "elapsed state-change guard",
)

clock = replace_once(
    clock,
    '''        #updateRemainingRanges(
            start
        ) {
            if (
                this.#getTimerMode() !==
                    "remaining" ||
                !Number.isFinite(start)
            ) {
''',
    '''        #updateRemainingRanges(
            start
        ) {
            if (this.#stateChangeVisualState) {
                return;
            }

            if (
                this.#getTimerMode() !==
                    "remaining" ||
                !Number.isFinite(start)
            ) {
''',
    "remaining state-change guard",
)

clock = replace_once(
    clock,
    '''        #syncWaveRange() {
            const source =
                this.#findWaveSourceRange();
''',
    '''        #syncWaveRange() {
            if (this.#stateChangeVisualState) {
                this.#removeWaveRange();
                return;
            }

            const source =
                this.#findWaveSourceRange();
''',
    "wave state-change guard",
)

# Timer-type: begin the new visual choreography before old visual ranges are
# removed, build the overlay on the incoming rings, fade the surplus during
# the final 750ms outward phase, then hand off to normal live ranges.
clock = replace_once(
    clock,
    '''            this.#cancelTimerModeTransition();
            this.#cancelTimeRangeTimingAnimations();

            const oldRings =''',
    '''            this.#cancelTimerModeTransition();
            this.#cancelTimeRangeTimingAnimations();

            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            const oldRings =''',
    "timer type visual begin",
)

clock = replace_once(
    clock,
    '''            const state = {
                token,
                previousType,''',
    '''            const state = {
                token,
                stateChangeVisual,
                previousType,''',
    "timer type state visual reference",
)

clock = replace_once(
    clock,
    '''            this.#syncWaveRange();
            this.#updateIndicatorSymbol();

            state.startFrame =''',
    '''            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#syncWaveRange();
            this.#updateIndicatorSymbol();

            state.startFrame =''',
    "timer type activate visual overlay",
)

clock = replace_once(
    clock,
    '''            const duration = 750;

            this.#startTimerTypeTransitionVisualFade(
                state
            );''',
    '''            const duration = 750;

            this.#startStateChangeVisualFade(
                state.stateChangeVisual
            );

            this.#startTimerTypeTransitionVisualFade(
                state
            );''',
    "timer type final visual fade",
)

clock = replace_once(
    clock,
    '''            this.#timerTypeIndicatorFrozen =
                false;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            this.#timerTypeTransitionState =
                undefined;''',
    '''            this.#timerTypeIndicatorFrozen =
                false;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            this.#finishStateChangeVisuals(
                state.stateChangeVisual
            );

            this.#timerTypeTransitionState =
                undefined;''',
    "timer type finish visual overlay",
)

# In cancellation, remove transition-only visuals without reconstructing live
# visual ranges against a half-transitioned ring tree.
method_match = re.search(
    r"(        #cancelTimerTypeTransition\(\n            commit = true\n        \) \{.*?)(\n        #startTimerTypeRingAnimations\()",
    clock,
    re.S,
)
if not method_match:
    raise SystemExit("missing timer type cancel method")
cancel_method = method_match.group(1)
needle = '''            this.#timerTypeTransitionState =
                undefined;'''
if needle not in cancel_method:
    raise SystemExit("missing timer type cancel state clear")
cancel_method = cancel_method.replace(
    needle,
    '''            if (
                state.stateChangeVisual ===
                    this.#stateChangeVisualState
            ) {
                this.#cancelStateChangeVisuals(
                    false
                );
            }

            this.#timerTypeTransitionState =
                undefined;''',
    1,
)
clock = clock[:method_match.start(1)] + cancel_method + clock[method_match.end(1):]

# Timer-mode now uses only the final mode's transition overlay. There is no
# elapsed/remaining crossfade: old live ranges disappear immediately.
mode_match = re.search(
    r"        #handleTimerModeChange\(\n            oldValue,\n            newValue\n        \) \{.*?\n        \}\n\n        #findWaveSourceRange\(\)",
    clock,
    re.S,
)
if not mode_match:
    raise SystemExit("missing timer mode handler")
new_mode_handler = '''        #handleTimerModeChange(
            oldValue,
            newValue
        ) {
            const mode =
                this.#normalizeTimerMode();

            if (newValue !== mode) {
                return;
            }

            this.#cancelTimerModeTransition();

            if (
                !this.#started ||
                !this.isConnected
            ) {
                this.#applyTimerModeState(
                    mode
                );

                return;
            }

            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                750
            );
        }

        #findWaveSourceRange()'''
clock = clock[:mode_match.start()] + new_mode_handler + clock[mode_match.end():]

# Percent-goal: start visuals before the goal mutates, then track the target
# geometry and keep the visual choreography alive for at least the 750ms wave.
percent_match = re.search(
    r"(        #handlePercentGoalChange\(\) \{.*?)(\n        #getRangeAnimationDuration\(\) \{)",
    clock,
    re.S,
)
if not percent_match:
    raise SystemExit("missing percent goal method")
percent_method = percent_match.group(1)
percent_method = replace_once(
    percent_method,
    '''            const previousGoal =
                this.#percentGoal;

            const percentGoalAnimation =''',
    '''            const previousGoal =
                this.#percentGoal;

            const stateChangeVisual =
                this.#started &&
                goal !== previousGoal
                    ? this.#beginStateChangeVisuals()
                    : undefined;

            const percentGoalAnimation =''',
    "percent goal visual begin",
)
last_refresh = percent_method.rfind("            this.#refreshRingLayout(")
if last_refresh == -1:
    raise SystemExit("missing percent goal final refresh")
# Find the end of that call by locating the final method-closing brace.
method_end = percent_method.rfind("        }")
if method_end == -1 or method_end < last_refresh:
    raise SystemExit("missing percent goal method end")
insert = '''

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                this.#getStateChangeAnimationDuration()
            );
'''
percent_method = percent_method[:method_end] + insert + percent_method[method_end:]
clock = clock[:percent_match.start(1)] + percent_method + clock[percent_match.end(1):]

# showTolerance: begin after we know a real endpoint transition is needed.
show_match = re.search(
    r"(        #transitionShowTolerance\(\) \{.*?)(\n        #getToleranceRenderEnd\()",
    clock,
    re.S,
)
if not show_match:
    raise SystemExit("missing showTolerance transition method")
show_method = show_match.group(1)
show_method = replace_once(
    show_method,
    '''            const finalRingIndexes =
                new Set(''',
    '''            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            const finalRingIndexes =
                new Set(''',
    "showTolerance visual begin",
)
show_method = replace_once(
    show_method,
    '''            this.#toleranceTransitionState =
                state;
''',
    '''            state.stateChangeVisual =
                stateChangeVisual;

            this.#toleranceTransitionState =
                state;
''',
    "showTolerance state visual reference",
)
show_method = replace_once(
    show_method,
    '''            this.#syncToleranceTransitionRanges(
                state,
                fromEnd
            );
''',
    '''            this.#syncToleranceTransitionRanges(
                state,
                fromEnd
            );

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                state.duration
            );
''',
    "showTolerance activate visuals",
)
clock = clock[:show_match.start(1)] + show_method + clock[show_match.end(1):]

# If a tolerance transition is interrupted, its visual coordinator must be
# interrupted too. A normal completed tolerance transition is allowed to end
# before the 750ms state-change visual if its own geometry duration is shorter.
tol_cancel_match = re.search(
    r"(        #cancelToleranceTransition\(\) \{.*?)(\n        #stepToleranceTransition\()",
    clock,
    re.S,
)
if not tol_cancel_match:
    raise SystemExit("missing tolerance cancel method")
tol_cancel = tol_cancel_match.group(1)
needle = '''            this.#toleranceTransitionState =
                undefined;'''
if needle not in tol_cancel:
    raise SystemExit("missing tolerance cancel clear")
tol_cancel = tol_cancel.replace(
    needle,
    '''            if (
                state.stateChangeVisual ===
                    this.#stateChangeVisualState
            ) {
                this.#cancelStateChangeVisuals(
                    false
                );
            }

            this.#toleranceTransitionState =
                undefined;''',
    1,
)
clock = clock[:tol_cancel_match.start(1)] + tol_cancel + clock[tol_cancel_match.end(1):]

# Clearing tears down any transient state-change visuals as well.
clock = replace_once(
    clock,
    '''            this.#cancelToleranceTransition();

            this.#stopTickTimer();''',
    '''            this.#cancelToleranceTransition();
            this.#cancelStateChangeVisuals(false);

            this.#stopTickTimer();''',
    "clear state change visuals",
)

clock_path.write_text(clock)
time_path.write_text(time)
