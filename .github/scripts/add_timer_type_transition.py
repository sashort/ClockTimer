from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
clock_path = root / "ClockTimer.js"
ring_path = root / "RingContainer.js"
clock = clock_path.read_text()
ring = ring_path.read_text()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# ClockTimer transition state.
clock = replace_once(
    clock,
    '''        #timerModeTransitionToken =
            0;

        #waveRing;''',
    '''        #timerModeTransitionToken =
            0;

        #timerType =
            "radial-overflow";

        #timerTypeTransitionToken =
            0;

        #timerTypeTransitioning =
            false;

        #timerTypeTransitionBuilding =
            false;

        #timerTypeTransitionState;

        #timerTypeIndicatorFrozen =
            false;

        #waveRing;''',
    "timer type transition fields"
)

# The local symbol spin is around the symbol's own center.
clock = replace_once(
    clock,
    '''                    transform-origin: 50% 0;
                    pointer-events: none;
                }

                #indicator-symbol::before {''',
    '''                    transform-origin: 50% 50%;
                    pointer-events: none;
                }

                #indicator-symbol::before {''',
    "indicator transform origin"
)

# Cancel timer-type work on disconnect.
clock = replace_once(
    clock,
    '''            this.#stopFaceBackgroundTracking();

            this.#cancelTimerModeTransition();''',
    '''            this.#stopFaceBackgroundTracking();

            this.#cancelTimerTypeTransition(
                false
            );

            this.#cancelTimerModeTransition();''',
    "disconnect timer type cancellation"
)

# Observe timer-type through a semantic handler instead of normalization only.
clock = replace_once(
    clock,
    '''                case "timer-type":
                    this.#normalizeTimerType();
                    break;''',
    '''                case "timer-type":
                    this.#handleTimerTypeChange(
                        oldValue,
                        newValue
                    );
                    break;''',
    "timer-type attribute handler"
)

# Establish the semantic timer type during initial connection without animating.
clock = replace_once(
    clock,
    '''            else {
                this.#normalizeTimerType();
            }

            if (
                !this.hasAttribute(
                    "timer-mode"
                )
            ) {''',
    '''            else {
                this.#timerType =
                    this.#normalizeTimerType();
            }

            if (
                !this.hasAttribute(
                    "timer-mode"
                )
            ) {''',
    "initial timer type state"
)

# getTimerType must remain stable while normalization dispatches nested attribute callbacks.
clock = replace_once(
    clock,
    '''        #getTimerType() {
            return this.getAttribute(
                "timer-type"
            ) === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";
        }
''',
    '''        #getTimerType() {
            return this.#timerType;
        }
''',
    "semantic getTimerType"
)

transition_methods = r'''

        #handleTimerTypeChange(
            oldValue,
            newValue
        ) {
            const timerType =
                this.#normalizeTimerType();

            if (newValue !== timerType) {
                return;
            }

            const previousType =
                this.#timerType;

            this.#timerType =
                timerType;

            if (
                previousType === timerType ||
                !this.isConnected
            ) {
                return;
            }

            this.#transitionTimerType(
                previousType,
                timerType
            );
        }

        #getTimerTypeRangeSnapshotSignature(
            snapshot
        ) {
            const attributes =
                snapshot.attributes
                    .map(
                        ([name, value]) => [
                            name,
                            value
                        ]
                    )
                    .sort(
                        (a, b) =>
                            a[0].localeCompare(
                                b[0]
                            ) ||
                            a[1].localeCompare(
                                b[1]
                            )
                    );

            const state =
                Object.entries(
                    snapshot.state
                )
                    .map(
                        ([name, value]) => [
                            name,
                            typeof value === "object" &&
                            value !== null
                                ? JSON.stringify(
                                    value
                                )
                                : String(
                                    value
                                )
                        ]
                    )
                    .sort(
                        (a, b) =>
                            a[0].localeCompare(
                                b[0]
                            ) ||
                            a[1].localeCompare(
                                b[1]
                            )
                    );

            return JSON.stringify({
                attributes,
                state,
                rangeLength:
                    snapshot.hasRangeLength
            });
        }

        #captureTimerTypeRangeSnapshots(
            rings
        ) {
            const snapshots = [];

            for (const ring of rings) {
                for (const range of ring.children) {
                    if (
                        range.localName !==
                            "time-range" ||
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

                    if (!Number.isFinite(start)) {
                        continue;
                    }

                    const attributes =
                        Array.from(
                            range.attributes
                        )
                            .filter(
                                attribute =>
                                    ![
                                        "start-time",
                                        "end-time",
                                        "range-length",
                                        "ignore-overlaps",
                                        "timer-mode-transitioning"
                                    ].includes(
                                        attribute.name.toLowerCase()
                                    )
                            )
                            .map(
                                attribute => [
                                    attribute.name,
                                    attribute.value
                                ]
                            );

                    const state = {};

                    for (
                        const key of
                            Object.keys(range)
                    ) {
                        if (
                            !key.startsWith(
                                "clockTimer"
                            ) ||
                            key ===
                                "clockTimerStart" ||
                            key ===
                                "clockTimerEnd"
                        ) {
                            continue;
                        }

                        state[key] =
                            range[key];
                    }

                    const snapshot = {
                        start,
                        end:
                            Number.isFinite(end)
                                ? end
                                : undefined,
                        attributes,
                        state,
                        hasRangeLength:
                            range.hasAttribute(
                                "range-length"
                            )
                    };

                    snapshot.signature =
                        this.#getTimerTypeRangeSnapshotSignature(
                            snapshot
                        );

                    snapshots.push(
                        snapshot
                    );
                }
            }

            snapshots.sort(
                (a, b) =>
                    a.start - b.start ||
                    (
                        Number.isFinite(a.end)
                            ? a.end
                            : Infinity
                    ) -
                    (
                        Number.isFinite(b.end)
                            ? b.end
                            : Infinity
                    ) ||
                    a.signature.localeCompare(
                        b.signature
                    )
            );

            const merged = [];

            for (const snapshot of snapshots) {
                const previous =
                    merged[
                        merged.length - 1
                    ];

                if (
                    previous &&
                    previous.signature ===
                        snapshot.signature &&
                    Number.isFinite(
                        previous.end
                    ) &&
                    Number.isFinite(
                        snapshot.end
                    ) &&
                    previous.end ===
                        snapshot.start
                ) {
                    previous.end =
                        snapshot.end;

                    continue;
                }

                merged.push({
                    ...snapshot,
                    attributes:
                        snapshot.attributes.map(
                            entry => [
                                ...entry
                            ]
                        ),
                    state: {
                        ...snapshot.state
                    }
                });
            }

            return merged;
        }

        #appendTimerTypeTransitionRange(
            snapshot,
            start,
            end,
            ring
        ) {
            const range =
                document.createElement(
                    "time-range"
                );

            for (
                const [name, value] of
                    snapshot.attributes
            ) {
                range.setAttribute(
                    name,
                    value
                );
            }

            range.setAttribute(
                "ignore-overlaps",
                ""
            );

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            if (Number.isFinite(end)) {
                range.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        end
                    )
                );

                if (
                    snapshot.hasRangeLength
                ) {
                    range.setAttribute(
                        "range-length",
                        this.#formatStandardTime(
                            end - start
                        )
                    );
                }
            }

            range.clockTimerStart =
                String(start);

            if (Number.isFinite(end)) {
                range.clockTimerEnd =
                    String(end);
            }

            for (
                const [key, value] of
                    Object.entries(
                        snapshot.state
                    )
            ) {
                range[key] = value;
            }

            range.timeRangeFullEntry =
                true;

            ring.appendChild(
                range
            );

            return range;
        }

        #renderTimerTypeRangeSnapshots(
            snapshots
        ) {
            const ranges = [];

            for (const snapshot of snapshots) {
                if (
                    !Number.isFinite(
                        snapshot.end
                    ) ||
                    snapshot.end <=
                        snapshot.start
                ) {
                    const ring =
                        this.#ensureRing(
                            this.#getTimerRingIndex(
                                snapshot.start
                            )
                        );

                    ranges.push(
                        this.#appendTimerTypeTransitionRange(
                            snapshot,
                            snapshot.start,
                            undefined,
                            ring
                        )
                    );

                    continue;
                }

                let cursor =
                    snapshot.start;

                while (
                    cursor < snapshot.end
                ) {
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
                            snapshot.end,
                            ringEnd
                        );

                    if (
                        !Number.isFinite(
                            segmentEnd
                        ) ||
                        segmentEnd <= cursor
                    ) {
                        break;
                    }

                    const ring =
                        this.#ensureRing(
                            ringIndex
                        );

                    ranges.push(
                        this.#appendTimerTypeTransitionRange(
                            snapshot,
                            cursor,
                            segmentEnd,
                            ring
                        )
                    );

                    cursor =
                        segmentEnd;
                }
            }

            return ranges;
        }

        #rebuildTimerTypeRangeReferences() {
            this.#elapsedRange =
                undefined;

            this.#remainingRanges.clear();
            this.#overtimeRanges.clear();

            let elapsedEnd =
                -Infinity;

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (
                    range.clockTimerElapsed !==
                        undefined
                ) {
                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    if (
                        Number.isFinite(end) &&
                        end > elapsedEnd
                    ) {
                        this.#elapsedRange =
                            range;

                        elapsedEnd =
                            end;
                    }
                }

                if (
                    Number.isFinite(ringIndex) &&
                    range.clockTimerRemaining !==
                        undefined
                ) {
                    this.#remainingRanges.set(
                        ringIndex,
                        range
                    );
                }

                if (
                    Number.isFinite(ringIndex) &&
                    range.clockTimerOvertime !==
                        undefined
                ) {
                    this.#overtimeRanges.set(
                        ringIndex,
                        range
                    );
                }
            }
        }

        #getTimerTypeTransitionReferenceTime(
            snapshots
        ) {
            if (this.#started) {
                return this.#getCurrentTimelineTime();
            }

            let reference;

            for (const snapshot of snapshots) {
                if (
                    Number.isFinite(
                        snapshot.end
                    ) &&
                    (
                        !Number.isFinite(
                            reference
                        ) ||
                        snapshot.end > reference
                    )
                ) {
                    reference =
                        snapshot.end;
                }
            }

            if (Number.isFinite(reference)) {
                return reference;
            }

            if (
                Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return this.#scheduledStartMilliseconds;
            }

            return snapshots.find(
                snapshot =>
                    Number.isFinite(
                        snapshot.start
                    )
            )?.start;
        }

        #resolveTimerTypeTransitionLength(
            value,
            context = this
        ) {
            if (
                typeof value === "number" &&
                Number.isFinite(value)
            ) {
                return value;
            }

            const text =
                String(
                    value ?? "0px"
                ).trim();

            if (!text) {
                return 0;
            }

            const measure =
                document.createElement(
                    "div"
                );

            measure.style.position =
                "absolute";

            measure.style.visibility =
                "hidden";

            measure.style.pointerEvents =
                "none";

            measure.style.marginLeft =
                text;

            const parent =
                context?.appendChild
                    ? context
                    : this;

            parent.appendChild(
                measure
            );

            const resolved =
                Number.parseFloat(
                    getComputedStyle(
                        measure
                    ).marginLeft
                );

            measure.remove();

            return Number.isFinite(
                resolved
            )
                ? resolved
                : 0;
        }

        #getTimerTypeTransitionMargin(
            ring,
            side
        ) {
            const value =
                side === "inner"
                    ? (
                        ring.innerMargin ??
                        ring.margin ??
                        "0px"
                    )
                    : (
                        ring.outerMargin ??
                        ring.margin ??
                        "0px"
                    );

            return this.#resolveTimerTypeTransitionLength(
                value,
                ring
            );
        }

        #collapseTimerTypeTransitionMargins(
            first,
            second
        ) {
            return (
                Math.max(
                    0,
                    first,
                    second
                ) +
                Math.min(
                    0,
                    first,
                    second
                )
            );
        }

        #calculateTimerTypeTargetGeometry(
            newRings
        ) {
            const newRingSet =
                new Set(
                    newRings
                );

            const geometry =
                new Map();

            let previous;

            for (
                const ring of
                    Array.from(
                        this.children
                    ).filter(
                        element =>
                            element.localName ===
                                "ring-container" &&
                            element.clockTimerLayoutDetached !==
                                true
                    )
            ) {
                const widthValue =
                    newRingSet.has(ring)
                        ? (
                            ring.clockTimerTargetWidth ??
                            ring.width ??
                            "0px"
                        )
                        : (
                            ring.width ??
                            "0px"
                        );

                const width =
                    Math.max(
                        0,
                        this.#resolveTimerTypeTransitionLength(
                            widthValue,
                            ring
                        )
                    );

                const insetValue =
                    ring.inset;

                let inset;

                if (
                    insetValue !== null &&
                    insetValue !== undefined &&
                    String(
                        insetValue
                    ).trim().toLowerCase() !==
                        "auto"
                ) {
                    inset =
                        this.#resolveTimerTypeTransitionLength(
                            insetValue,
                            ring
                        );
                }
                else if (!previous) {
                    inset =
                        this.#getTimerTypeTransitionMargin(
                            ring,
                            "outer"
                        ) +
                        width / 2;
                }
                else {
                    inset =
                        previous.inset +
                        previous.width / 2 +
                        this.#collapseTimerTypeTransitionMargins(
                            previous.innerMargin,
                            this.#getTimerTypeTransitionMargin(
                                ring,
                                "outer"
                            )
                        ) +
                        width / 2;
                }

                const entry = {
                    inset,
                    width,
                    widthValue,
                    innerMargin:
                        this.#getTimerTypeTransitionMargin(
                            ring,
                            "inner"
                        )
                };

                geometry.set(
                    ring,
                    entry
                );

                previous =
                    entry;
            }

            return geometry;
        }

        #isTimerRingOutsideBorder(
            ring
        ) {
            if (
                ring?.hasAttribute?.(
                    "active"
                )
            ) {
                return true;
            }

            if (
                !this.#borderRing ||
                this.#borderRing.parentElement !==
                    this
            ) {
                return false;
            }

            const children =
                Array.from(
                    this.children
                );

            const ringIndex =
                children.indexOf(
                    ring
                );

            const borderIndex =
                children.indexOf(
                    this.#borderRing
                );

            return (
                ringIndex !== -1 &&
                borderIndex !== -1 &&
                ringIndex < borderIndex
            );
        }

        #getTimerTypeRingAnimationDuration(
            ring
        ) {
            const base =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.resizeDuration ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            const filter =
                String(
                    ring?.resizeFilter ??
                    "none"
                ).trim().toLowerCase();

            if (
                filter === "none" ||
                ring?.filterRamp === false
            ) {
                return Math.max(
                    0,
                    base
                );
            }

            const front =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.filterRampFront ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            const end =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.filterRampEnd ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            return Math.max(
                0,
                front + base + end
            );
        }

        #snapTimerTypeRings(
            rings
        ) {
            for (
                const ring of
                    new Set(rings)
            ) {
                if (
                    ring?.isConnected &&
                    typeof ring.snapGeometry ===
                        "function"
                ) {
                    ring.snapGeometry();
                }
            }
        }

        #getIndicatorTrackAngle() {
            if (!this.#indicatorTrack) {
                return 0;
            }

            const normalize =
                angle =>
                    (
                        (
                            angle % 360
                        ) +
                        360
                    ) % 360;

            const transform =
                getComputedStyle(
                    this.#indicatorTrack
                ).transform;

            if (
                transform &&
                transform !== "none"
            ) {
                try {
                    const matrix =
                        new DOMMatrixReadOnly(
                            transform
                        );

                    const angle =
                        Math.atan2(
                            matrix.b,
                            matrix.a
                        ) *
                        180 /
                        Math.PI;

                    if (Number.isFinite(angle)) {
                        return normalize(
                            angle
                        );
                    }
                }
                catch {
                    // Fall through to the inline transform.
                }
            }

            const match =
                this.#indicatorTrack.style.transform
                    .match(
                        /rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i
                    );

            return match
                ? normalize(
                    Number(match[1])
                )
                : 0;
        }

        #getIndicatorAngleForTime(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds(
                        milliseconds
                    );

                if (!bounds) {
                    return undefined;
                }

                return Math.max(
                    0,
                    Math.min(
                        360,
                        (
                            (
                                milliseconds -
                                bounds.start
                            ) /
                            bounds.duration
                        ) *
                        360
                    )
                );
            }

            const millisecondsIntoHour =
                (
                    milliseconds %
                        ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) %
                ClockTimer.#HOUR;

            return (
                millisecondsIntoHour /
                ClockTimer.#HOUR
            ) *
            360;
        }

        #startTimerTypeIndicatorSpin(
            state,
            duration
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol ||
                duration <= 0 ||
                typeof this.#indicatorSymbol.animate !==
                    "function"
            ) {
                return;
            }

            const seconds =
                duration /
                1000;

            const minimumTurns =
                Math.max(
                    1,
                    Math.ceil(
                        seconds * 6
                    )
                );

            const maximumTurns =
                Math.max(
                    minimumTurns,
                    Math.floor(
                        seconds * 8
                    )
                );

            const preferredTurns =
                Math.round(
                    seconds * 7
                );

            const turns =
                Math.min(
                    maximumTurns,
                    Math.max(
                        minimumTurns,
                        preferredTurns
                    )
                );

            state.indicatorSpinAnimation =
                this.#indicatorSymbol.animate(
                    [
                        {
                            transform:
                                "translateX(-50%) rotate(0deg)"
                        },
                        {
                            transform:
                                `translateX(-50%) rotate(${turns * 360}deg)`
                        }
                    ],
                    {
                        duration,
                        easing: "linear"
                    }
                );
        }

        #releaseTimerTypeIndicator(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;

            this.#updateIndicatorSymbol();
        }

        #startTimerTypeIndicatorCatchup(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.hasAttribute(
                    "indicator-symbol"
                ) ||
                !this.#started ||
                !this.#indicatorTrack
            ) {
                this.#releaseTimerTypeIndicator(
                    state
                );

                return;
            }

            state.indicatorDelayTimeout =
                setTimeout(
                    () => {
                        state.indicatorDelayTimeout =
                            undefined;

                        if (
                            state !==
                                this.#timerTypeTransitionState ||
                            !this.#started
                        ) {
                            return;
                        }

                        const duration =
                            750;

                        const startAngle =
                            this.#getIndicatorTrackAngle();

                        const targetTime =
                            this.#getCurrentTimelineTime(
                                new Date(
                                    Date.now() +
                                    duration
                                )
                            );

                        const targetAngle =
                            this.#getIndicatorAngleForTime(
                                targetTime
                            );

                        if (
                            !Number.isFinite(
                                targetAngle
                            )
                        ) {
                            this.#releaseTimerTypeIndicator(
                                state
                            );

                            return;
                        }

                        const delta =
                            (
                                targetAngle -
                                startAngle +
                                360
                            ) %
                            360;

                        const endAngle =
                            startAngle +
                            delta;

                        if (
                            typeof this.#indicatorTrack.animate !==
                                "function" ||
                            delta === 0
                        ) {
                            this.#indicatorTrack.style.transform =
                                `rotate(${targetAngle}deg)`;

                            this.#releaseTimerTypeIndicator(
                                state
                            );

                            return;
                        }

                        const animation =
                            this.#indicatorTrack.animate(
                                [
                                    {
                                        transform:
                                            `rotate(${startAngle}deg)`
                                    },
                                    {
                                        transform:
                                            `rotate(${endAngle}deg)`
                                    }
                                ],
                                {
                                    duration,
                                    easing:
                                        "ease-in-out",
                                    fill: "both"
                                }
                            );

                        state.indicatorTrackAnimation =
                            animation;

                        animation.finished.then(
                            () => {
                                if (
                                    state !==
                                        this.#timerTypeTransitionState
                                ) {
                                    return;
                                }

                                this.#indicatorTrack.style.transform =
                                    `rotate(${targetAngle}deg)`;

                                animation.cancel();

                                state.indicatorTrackAnimation =
                                    undefined;

                                this.#releaseTimerTypeIndicator(
                                    state
                                );
                            },
                            () => {}
                        );
                    },
                    750
                );
        }

        #finishTimerTypeTransition(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            if (
                state.geometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.geometryFrame
                );

                state.geometryFrame =
                    undefined;
            }

            if (
                state.collapseFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.collapseFrame
                );

                state.collapseFrame =
                    undefined;
            }

            const now =
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : state.referenceTime;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    now,
                    {
                        suspendLayout:
                            false
                    }
                );
            }

            for (
                const ring of
                    state.newRings
            ) {
                if (!ring.isConnected) {
                    continue;
                }

                ring.inset =
                    undefined;

                ring.snapGeometry?.();

                delete ring.clockTimerTargetWidth;
                delete ring.clockTimerTransitionNew;

                ring.style.removeProperty(
                    "z-index"
                );
            }

            for (
                const ring of
                    state.oldRings
            ) {
                ring.remove();
            }

            state.oldRings = [];
            state.ringsFinished =
                true;

            this.#timerTypeTransitioning =
                false;

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks:
                        true
                }
            );

            this.#updateIndicatorSymbol();

            this.#startTimerTypeIndicatorCatchup(
                state
            );
        }

        #cancelTimerTypeTransition(
            commit = true
        ) {
            const state =
                this.#timerTypeTransitionState;

            this.#timerTypeTransitionToken++;

            if (!state) {
                this.#timerTypeTransitioning =
                    false;

                this.#timerTypeIndicatorFrozen =
                    false;

                return;
            }

            if (
                state.startFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.startFrame
                );
            }

            if (
                state.geometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.geometryFrame
                );
            }

            if (
                state.collapseFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.collapseFrame
                );
            }

            if (
                state.cleanupTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.cleanupTimeout
                );
            }

            if (
                state.indicatorDelayTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.indicatorDelayTimeout
                );
            }

            state.indicatorSpinAnimation
                ?.cancel();

            if (
                state.indicatorTrackAnimation
            ) {
                const angle =
                    this.#getIndicatorTrackAngle();

                state.indicatorTrackAnimation.cancel();

                this.#indicatorTrack.style.transform =
                    `rotate(${angle}deg)`;
            }

            if (commit) {
                for (
                    const ring of
                        state.oldRings
                ) {
                    const geometry =
                        state.oldGeometry.get(
                            ring
                        );

                    if (
                        ring.isConnected &&
                        geometry
                    ) {
                        ring.inset =
                            `${geometry.collapseInset}px`;

                        ring.width =
                            "0px";

                        ring.snapGeometry?.();
                    }
                }

                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (
                        ring.isConnected &&
                        target
                    ) {
                        ring.inset =
                            `${target.inset}px`;

                        ring.width =
                            target.widthValue;

                        ring.snapGeometry?.();

                        ring.inset =
                            undefined;

                        ring.snapGeometry?.();
                    }

                    delete ring.clockTimerTargetWidth;
                    delete ring.clockTimerTransitionNew;

                    ring.style.removeProperty(
                        "z-index"
                    );
                }

                for (
                    const ring of
                        state.oldRings
                ) {
                    ring.remove();
                }
            }

            this.#timerTypeTransitionState =
                undefined;

            this.#timerTypeTransitioning =
                false;

            this.#timerTypeTransitionBuilding =
                false;

            this.#timerTypeIndicatorFrozen =
                false;

            if (
                commit &&
                this.isConnected
            ) {
                const now =
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined;

                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks:
                            true
                    }
                );
            }
        }

        #startTimerTypeRingAnimations(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            state.startFrame =
                undefined;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (
                    const ring of
                        state.oldRings
                ) {
                    const geometry =
                        state.oldGeometry.get(
                            ring
                        );

                    if (!geometry) {
                        continue;
                    }

                    ring.inset =
                        `${geometry.collapseInset}px`;

                    ring.width =
                        "0px";
                }

                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (!target) {
                        continue;
                    }

                    ring.inset =
                        `${target.inset}px`;

                    ring.width =
                        target.widthValue;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            const animatedRings =
                new Set([
                    ...state.oldRings,
                    ...state.newRings,
                    ...Array.from(
                        this.children
                    ).filter(
                        element =>
                            element.localName ===
                                "ring-container" &&
                            element.clockTimerLayoutDetached !==
                                true
                    )
                ]);

            const maximumDuration =
                Math.max(
                    0,
                    ...Array.from(
                        animatedRings
                    ).map(
                        ring =>
                            this.#getTimerTypeRingAnimationDuration(
                                ring
                            )
                    )
                );

            state.maximumDuration =
                maximumDuration;

            this.#startTimerTypeIndicatorSpin(
                state,
                maximumDuration
            );

            const refresh =
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState ||
                        state.ringsFinished
                    ) {
                        state.geometryFrame =
                            undefined;

                        return;
                    }

                    const now =
                        this.#started
                            ? this.#getCurrentTimelineTime()
                            : state.referenceTime;

                    if (
                        this.#getTimerType() ===
                            "radial-fitted"
                    ) {
                        this.#refreshRadialFittedLayouts(
                            now,
                            {
                                suspendLayout:
                                    false
                            }
                        );
                    }

                    this.#syncWaveRange();
                    this.#updateIndicatorSymbol();

                    state.geometryFrame =
                        requestAnimationFrame(
                            refresh
                        );
                };

            state.geometryFrame =
                requestAnimationFrame(
                    refresh
                );

            state.cleanupTimeout =
                setTimeout(
                    () => {
                        state.cleanupTimeout =
                            undefined;

                        const waitForCollapse =
                            () => {
                                if (
                                    state !==
                                        this.#timerTypeTransitionState
                                ) {
                                    return;
                                }

                                const collapsed =
                                    state.oldRings.every(
                                        ring =>
                                            !ring.isConnected ||
                                            this.#resolveTimerTypeTransitionLength(
                                                ring.renderedWidth ??
                                                "0px",
                                                ring
                                            ) <=
                                                0.05
                                    );

                                if (!collapsed) {
                                    state.collapseFrame =
                                        requestAnimationFrame(
                                            waitForCollapse
                                        );

                                    return;
                                }

                                state.collapseFrame =
                                    undefined;

                                this.#finishTimerTypeTransition(
                                    state
                                );
                            };

                        state.collapseFrame =
                            requestAnimationFrame(
                                waitForCollapse
                            );
                    },
                    maximumDuration
                );
        }

        #transitionTimerType(
            previousType,
            timerType
        ) {
            this.#cancelTimerTypeTransition(
                true
            );

            this.#cancelTimerModeTransition();
            this.#cancelTimeRangeTimingAnimations();

            const oldRings =
                this.#getTimerRings()
                    .filter(
                        ring =>
                            ring.isConnected
                    );

            if (oldRings.length === 0) {
                const now =
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined;

                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks:
                            true
                    }
                );

                return;
            }

            const snapshots =
                this.#captureTimerTypeRangeSnapshots(
                    oldRings
                );

            const token =
                ++this.#timerTypeTransitionToken;

            const state = {
                token,
                previousType,
                timerType,
                oldRings:
                    [...oldRings],
                newRings: [],
                oldGeometry:
                    new Map(),
                targetGeometry:
                    new Map(),
                referenceTime:
                    this.#getTimerTypeTransitionReferenceTime(
                        snapshots
                    ),
                indicatorUsed:
                    this.hasAttribute(
                        "indicator-symbol"
                    ) &&
                    this.#started &&
                    Boolean(
                        this.#indicatorSymbol
                    ),
                ringsFinished:
                    false
            };

            this.#timerTypeTransitionState =
                state;

            this.#timerTypeTransitioning =
                true;

            this.#timerTypeIndicatorFrozen =
                state.indicatorUsed;

            if (
                this.#indicatorHandoffTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#indicatorHandoffTimeout
                );

                this.#indicatorHandoffTimeout =
                    undefined;
            }

            this.#indicatorHandoffFrozen =
                false;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (const ring of oldRings) {
                    const inset =
                        this.#resolveTimerTypeTransitionLength(
                            ring.renderedInset ??
                            ring.inset ??
                            "0px",
                            ring
                        );

                    const width =
                        Math.max(
                            0,
                            this.#resolveTimerTypeTransitionLength(
                                ring.renderedWidth ??
                                ring.width ??
                                "0px",
                                ring
                            )
                        );

                    const towardBorder =
                        this.#isTimerRingOutsideBorder(
                            ring
                        )
                            ? 1
                            : -1;

                    state.oldGeometry.set(
                        ring,
                        {
                            inset,
                            width,
                            collapseInset:
                                inset +
                                towardBorder *
                                width / 2
                        }
                    );

                    ring.clockTimerExitingRing =
                        true;

                    ring.clockTimerLayoutDetached =
                        true;

                    ring.style.zIndex =
                        "-1";

                    ring.inset =
                        `${inset}px`;

                    ring.width =
                        `${width}px`;

                    for (
                        const range of
                            ring.children
                    ) {
                        if (
                            range.localName ===
                                "time-range"
                        ) {
                            range.timeRangeExiting =
                                true;
                        }
                    }
                }

                this.#rings =
                    new Map();

                this.#elapsedRange =
                    undefined;

                this.#remainingRanges.clear();
                this.#overtimeRanges.clear();

                if (
                    timerType ===
                        "radial-overflow" &&
                    !this.#hasStartProperties()
                ) {
                    const earliest =
                        snapshots
                            .map(
                                snapshot =>
                                    snapshot.start
                            )
                            .filter(
                                Number.isFinite
                            )
                            .sort(
                                (a, b) =>
                                    a - b
                            )[0];

                    if (Number.isFinite(earliest)) {
                        this.#ringAnchor =
                            earliest -
                            (
                                (
                                    earliest %
                                        ClockTimer.#HOUR +
                                    ClockTimer.#HOUR
                                ) %
                                ClockTimer.#HOUR
                            );
                    }
                }

                this.#timerTypeTransitionBuilding =
                    true;

                this.#renderTimerTypeRangeSnapshots(
                    snapshots
                );

                this.#rebuildTimerTypeRangeReferences();

                const reference =
                    Number.isFinite(
                        state.referenceTime
                    )
                        ? state.referenceTime
                        : this.#scheduledStartMilliseconds;

                if (
                    Number.isFinite(reference) &&
                    this.#rings.size > 0
                ) {
                    this.#reorderRings(
                        reference
                    );
                }

                state.newRings =
                    Array.from(
                        this.#rings.values()
                    );

                for (
                    const ring of
                        state.newRings
                ) {
                    ring.clockTimerTransitionNew =
                        true;
                }

                state.targetGeometry =
                    this.#calculateTimerTypeTargetGeometry(
                        state.newRings
                    );

                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (!target) {
                        continue;
                    }

                    const outside =
                        this.#isTimerRingOutsideBorder(
                            ring
                        );

                    const initialInset =
                        target.inset +
                        (
                            outside
                                ? target.width / 2
                                : -target.width / 2
                        );

                    ring.inset =
                        `${initialInset}px`;

                    ring.width =
                        "0px";
                }
            }
            finally {
                this.#timerTypeTransitionBuilding =
                    false;

                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            this.#snapTimerTypeRings([
                ...oldRings,
                ...Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container"
                )
            ]);

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    state.referenceTime,
                    {
                        suspendLayout:
                            false
                    }
                );
            }

            this.#syncWaveRange();
            this.#updateIndicatorSymbol();

            state.startFrame =
                requestAnimationFrame(
                    () =>
                        this.#startTimerTypeRingAnimations(
                            state
                        )
                );
        }
'''

normalize_marker = '''            return normalized;
        }

        #getTimerMode() {'''
clock = replace_once(
    clock,
    normalize_marker,
    '''            return normalized;
        }''' + transition_methods + '''

        #getTimerMode() {''',
    "timer type transition methods"
)

# Exiting old rings must not participate in current ring geometry.
clock = replace_once(
    clock,
    '''                    element =>
                        element.localName ===
                            "ring-container"
                );''',
    '''                    element =>
                        element.localName ===
                            "ring-container" &&
                        element.clockTimerExitingRing !==
                            true
                );''',
    "getRingInset excludes old rings"
)

clock = replace_once(
    clock,
    '''                    child =>
                        child.localName ===
                            "ring-container" &&
                        child.clockTimerRing !==
                            undefined
                );''',
    '''                    child =>
                        child.localName ===
                            "ring-container" &&
                        child.clockTimerRing !==
                            undefined &&
                        child.clockTimerExitingRing !==
                            true
                );''',
    "permanent order excludes old timer rings"
)

# Fitted wave layout is ClockTimer-managed just like fitted timer rings.
clock = replace_once(
    clock,
    '''            const ring =
                this.#waveRing;

            ring.style.display =
                "block";''',
    '''            const ring =
                this.#waveRing;

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            ring.style.display =
                "block";''',
    "wave external layout ownership"
)

# During a timer-type transition, fitted layout is applied without suspendLayout.
clock = replace_once(
    clock,
    '''                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );''',
    '''                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined,
                    {
                        suspendLayout:
                            !this.#timerTypeTransitioning
                    }
                );''',
    "resize fitted refresh suspension policy"
)

clock = replace_once(
    clock,
    '''        #refreshRadialFittedLayouts(
            now
        ) {''',
    '''        #refreshRadialFittedLayouts(
            now,
            {
                suspendLayout = true
            } = {}
        ) {''',
    "fitted refresh options"
)

clock = replace_once(
    clock,
    '''                    if (
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {''',
    '''                    if (
                        suspendLayout &&
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {''',
    "conditional fitted suspension"
)

# The snap path must also honor the no-suspend transition rendering rule.
clock = replace_once(
    clock,
    '''                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

                return;
            }

            for (
                const range of
                    this.#getTimerRanges()''',
    '''                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined,
                    {
                        suspendLayout:
                            !this.#timerTypeTransitioning
                    }
                );

                return;
            }

            for (
                const range of
                    this.#getTimerRanges()''',
    "snap fitted refresh suspension policy"
)

# Merge/manage/current-ring helpers ignore old rings that are collapsing.
clock = replace_once(
    clock,
    '''            for (const ring of this.children) {
                if (
                    ring.localName !==
                        "ring-container"
                ) {
                    continue;
                }

                if (
                    this.#mergeAdjacentIdenticalRangesInRing(''',
    '''            for (const ring of this.children) {
                if (
                    ring.localName !==
                        "ring-container" ||
                    ring.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                if (
                    this.#mergeAdjacentIdenticalRangesInRing(''',
    "merge excludes old rings"
)

clock = replace_once(
    clock,
    '''            for (const child of this.children) {
                if (
                    child.localName !==
                        "ring-container"
                ) {
                    continue;
                }

                for (const range of child.children) {''',
    '''            for (const child of this.children) {
                if (
                    child.localName !==
                        "ring-container" ||
                    child.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                for (const range of child.children) {''',
    "managed ranges excludes old rings"
)

clock = replace_once(
    clock,
    '''                    child.localName ===
                        "ring-container" &&
                    child.clockTimerRing !==
                        undefined
            );''',
    '''                    child.localName ===
                        "ring-container" &&
                    child.clockTimerRing !==
                        undefined &&
                    child.clockTimerExitingRing !==
                        true
            );''',
    "timer rings excludes old rings"
)

# Refresh only current rings' duration and keep fitted updates unsuspended during the handoff.
clock = replace_once(
    clock,
    '''            for (
                const ring of
                    this.querySelectorAll(
                        ":scope > ring-container"
                    )
            ) {
                ring.resizeDuration =
                    `${duration}ms`;
            }''',
    '''            for (
                const ring of
                    this.querySelectorAll(
                        ":scope > ring-container"
                    )
            ) {
                if (
                    ring.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                ring.resizeDuration =
                    `${duration}ms`;
            }''',
    "refresh ignores old ring duration"
)

clock = replace_once(
    clock,
    '''            this.#refreshRadialFittedLayouts(
                now
            );''',
    '''            this.#refreshRadialFittedLayouts(
                now,
                {
                    suspendLayout:
                        !this.#timerTypeTransitioning
                }
            );''',
    "refresh ring fitted policy"
)

# New fitted rings are ClockTimer-layout-owned; transition-building rings always start at radial width zero.
clock = replace_once(
    clock,
    '''            ring.clockTimerRingIndex =
                String(
                    ringIndex
                );

            const initialWidth =''',
    '''            ring.clockTimerRingIndex =
                String(
                    ringIndex
                );

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            const initialWidth =''',
    "timer ring external layout ownership"
)

clock = replace_once(
    clock,
    '''            if (this.#starting) {
                ring.clockTimerTargetWidth =
                    initialWidth;''',
    '''            if (
                this.#starting ||
                this.#timerTypeTransitionBuilding
            ) {
                ring.clockTimerTargetWidth =
                    initialWidth;''',
    "new transition ring starts at zero width"
)

# Reordering is frozen once the transition is actually animating; setup is still allowed to establish final order.
clock = replace_once(
    clock,
    '''        #reorderRings(
            now
        ) {
            const borderRing =''',
    '''        #reorderRings(
            now
        ) {
            if (
                this.#timerTypeTransitioning &&
                !this.#timerTypeTransitionBuilding
            ) {
                return;
            }

            const borderRing =''',
    "freeze ring reorder during timer type animation"
)

clock = replace_once(
    clock,
    '''                if (this.#starting) {
                    ring.clockTimerTargetWidth =
                        width;''',
    '''                if (
                    this.#starting ||
                    this.#timerTypeTransitionBuilding
                ) {
                    ring.clockTimerTargetWidth =
                        width;''',
    "reorder stores transition target width"
)

# Indicator angle calculation is shared with the post-transition track catch-up, and frozen transitions never rewrite the track.
old_indicator_angles = '''            let normalizedAngle;

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
            }
'''
new_indicator_angles = '''            const normalizedAngle =
                this.#getIndicatorAngleForTime(
                    end
                );

            if (
                !Number.isFinite(
                    normalizedAngle
                )
            ) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }
'''
clock = replace_once(
    clock,
    old_indicator_angles,
    new_indicator_angles,
    "indicator shared angle calculation"
)

clock = replace_once(
    clock,
    '''            this.#indicatorRing.style.inset = `${topInset}px`;
            this.#indicatorSymbol.style.height = `${radialSpan}px`;
            this.#indicatorSymbol.style.fontSize = `${radialSpan}px`;
            this.#indicatorTrack.style.transform = `rotate(${normalizedAngle}deg)`;
            this.#setIndicatorSymbolVisible(!this.#starting);''',
    '''            this.#indicatorRing.style.inset = `${topInset}px`;
            this.#indicatorSymbol.style.height = `${radialSpan}px`;
            this.#indicatorSymbol.style.fontSize = `${radialSpan}px`;

            if (!this.#timerTypeIndicatorFrozen) {
                this.#indicatorTrack.style.transform =
                    `rotate(${normalizedAngle}deg)`;
            }

            this.#setIndicatorSymbolVisible(!this.#starting);''',
    "indicator track freeze"
)

# RingContainer gets a synchronous geometry commit used only for invisible transition setup,
# and ClockTimer-owned/detached rings are excluded from sibling layout refreshes.
ring = replace_once(
    ring,
    '''    get renderedWidth() {
        return this.#getRenderedGeometry().width;
    }

    static get batchResizing() {''',
    '''    get renderedWidth() {
        return this.#getRenderedGeometry().width;
    }

    snapGeometry() {
        this.#cancelAnimation();

        this.#resizePending =
            false;

        this.#reorderPending =
            false;

        this.#pendingLifecycleAction =
            undefined;

        this.#updateProperties(
            false
        );

        this.#updateAutomaticFollowingRings(
            false
        );

        this.#refreshChildVisualGeometry();

        return this;
    }

    static get batchResizing() {''',
    "RingContainer snapGeometry"
)

ring = replace_once(
    ring,
    '''        return Array.from(
            parent.children
        ).filter(
            element =>
                element instanceof
                RingContainer
        );''',
    '''        return Array.from(
            parent.children
        ).filter(
            element =>
                element instanceof
                    RingContainer &&
                element.clockTimerLayoutDetached !==
                    true
        );''',
    "RingContainer parent rings exclude detached"
)

ring = replace_once(
    ring,
    '''    #refreshChildVisualGeometry() {
        for (const child of this.children) {''',
    '''    #refreshChildVisualGeometry() {
        if (
            this.clockTimerLayoutDetached ===
                true ||
            this.clockTimerExternalRangeLayout ===
                true
        ) {
            return;
        }

        for (const child of this.children) {''',
    "RingContainer child geometry ownership"
)

ring = replace_once(
    ring,
    '''        return Array.from(
            parent.children
        ).some(
            child =>
                child instanceof
                    RingContainer &&
                child.#reorderPending
        );''',
    '''        return Array.from(
            parent.children
        ).some(
            child =>
                child instanceof
                    RingContainer &&
                child.clockTimerLayoutDetached !==
                    true &&
                child.#reorderPending
        );''',
    "RingContainer pending reorder excludes detached"
)

ring = replace_once(
    ring,
    '''            if (
                child instanceof
                    RingContainer
            ) {
                child.#resizePending =
                    true;
            }''',
    '''            if (
                child instanceof
                    RingContainer &&
                child.clockTimerLayoutDetached !==
                    true
            ) {
                child.#resizePending =
                    true;
            }''',
    "RingContainer mark pending excludes detached"
)

ring = replace_once(
    ring,
    '''    #afterLengthValueChange() {
        if (
            !this.isConnected
        ) {''',
    '''    #afterLengthValueChange() {
        if (
            !this.isConnected
        ) {''',
    "RingContainer after length anchor"
)
# Insert detached handling after the disconnected branch rather than changing its behavior.
ring = replace_once(
    ring,
    '''            return;
        }

        if (
            this.#parentHasPendingReorder()
        ) {''',
    '''            return;
        }

        if (
            this.clockTimerLayoutDetached ===
                true
        ) {
            this.#scheduleResize();
            return;
        }

        if (
            this.#parentHasPendingReorder()
        ) {''',
    "RingContainer detached resize isolation"
)

ring = replace_once(
    ring,
    '''        while (sibling) {
            if (
                sibling instanceof
                    RingContainer
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .previousElementSibling;
        }''',
    '''        while (sibling) {
            if (
                sibling instanceof
                    RingContainer &&
                sibling.clockTimerLayoutDetached !==
                    true
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .previousElementSibling;
        }''',
    "RingContainer previous skips detached"
)

ring = replace_once(
    ring,
    '''        while (sibling) {
            if (
                sibling instanceof
                    RingContainer
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .nextElementSibling;
        }''',
    '''        while (sibling) {
            if (
                sibling instanceof
                    RingContainer &&
                sibling.clockTimerLayoutDetached !==
                    true
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .nextElementSibling;
        }''',
    "RingContainer next skips detached"
)

# Structural safety checks.
required_clock = [
    "#transitionTimerType(",
    "#startTimerTypeRingAnimations(",
    "clockTimerLayoutDetached",
    "suspendLayout = true",
    "#getIndicatorAngleForTime(",
    "#timerTypeIndicatorFrozen"
]
for marker in required_clock:
    if marker not in clock:
        raise RuntimeError(f"ClockTimer missing expected marker: {marker}")

required_ring = [
    "snapGeometry()",
    "clockTimerLayoutDetached",
    "clockTimerExternalRangeLayout"
]
for marker in required_ring:
    if marker not in ring:
        raise RuntimeError(f"RingContainer missing expected marker: {marker}")

clock_path.write_text(clock)
ring_path.write_text(ring)
print("Applied timer-type transition implementation")
