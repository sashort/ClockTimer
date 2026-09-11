from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


def replace_block(start_marker, end_marker, replacement, label):
    global text
    start = text.find(start_marker)
    if start == -1:
        raise SystemExit(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end == -1:
        raise SystemExit(f"{label}: end marker not found")
    text = text[:start] + replacement + text[end:]


replacement_helpers = r'''        #getTimerTypeIndicatorTopInset() {
            if (!this.#indicatorRing) {
                return 0;
            }

            const computedTop =
                Number.parseFloat(
                    getComputedStyle(
                        this.#indicatorRing
                    ).top
                );

            if (Number.isFinite(computedTop)) {
                return computedTop;
            }

            const inlineInset =
                Number.parseFloat(
                    this.#indicatorRing.style.inset
                );

            return Number.isFinite(inlineInset)
                ? inlineInset
                : 0;
        }

        #prepareTimerTypeIndicatorInward(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol
            ) {
                return;
            }

            const activeRings =
                state.oldRings.filter(
                    ring =>
                        ring.hasAttribute(
                            "active"
                        )
                );

            const baseInset =
                this.#getTimerTypeIndicatorTopInset();

            let inwardTip;

            for (const ring of activeRings) {
                const geometry =
                    state.oldGeometry.get(
                        ring
                    );

                if (!geometry) {
                    continue;
                }

                const innerEdge =
                    geometry.inset +
                    geometry.width / 2;

                if (
                    Number.isFinite(innerEdge) &&
                    (
                        !Number.isFinite(inwardTip) ||
                        innerEdge > inwardTip
                    )
                ) {
                    inwardTip =
                        innerEdge;
                }
            }

            state.indicatorBaseInset =
                baseInset;

            state.indicatorInwardTip =
                Number.isFinite(inwardTip)
                    ? inwardTip
                    : baseInset;

            state.indicatorInwardDistance =
                Math.max(
                    0,
                    state.indicatorInwardTip -
                    baseInset
                );
        }

        #startTimerTypeIndicatorInward(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol
            ) {
                return;
            }

            const duration =
                750;

            const distance =
                Number.isFinite(
                    state.indicatorInwardDistance
                )
                    ? state.indicatorInwardDistance
                    : 0;

            const transparentShadow =
                "drop-shadow(0 2px 2px rgb(0 0 0 / 0%)) drop-shadow(0 0 5px rgb(0 0 0 / 0%))";

            const heavyShadow =
                "drop-shadow(0 2px 2px rgb(0 0 0 / 80%)) drop-shadow(0 0 5px rgb(0 0 0 / 65%))";

            const startTransform =
                "translateX(-50%) translateY(0px)";

            const endTransform =
                `translateX(-50%) translateY(${distance}px)`;

            if (
                typeof this.#indicatorSymbol.animate !==
                    "function"
            ) {
                this.#indicatorSymbol.style.transform =
                    endTransform;

                this.#indicatorSymbol.style.filter =
                    heavyShadow;

                return;
            }

            const animation =
                this.#indicatorSymbol.animate(
                    [
                        {
                            transform:
                                startTransform,
                            filter:
                                transparentShadow
                        },
                        {
                            transform:
                                endTransform,
                            filter:
                                heavyShadow
                        }
                    ],
                    {
                        duration,
                        easing:
                            "ease-in-out",
                        fill: "both"
                    }
                );

            state.indicatorInwardAnimation =
                animation;

            animation.finished.then(
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState
                    ) {
                        return;
                    }

                    this.#indicatorSymbol.style.transform =
                        endTransform;

                    this.#indicatorSymbol.style.filter =
                        heavyShadow;

                    animation.cancel();

                    state.indicatorInwardAnimation =
                        undefined;
                },
                () => {}
            );
        }

        #startTimerTypeIndicatorOutward(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState ||
                !state.indicatorUsed ||
                !this.#indicatorSymbol
            ) {
                this.#releaseTimerTypeIndicator(
                    state
                );

                return;
            }

            const duration =
                750;

            const transparentShadow =
                "drop-shadow(0 2px 2px rgb(0 0 0 / 0%)) drop-shadow(0 0 5px rgb(0 0 0 / 0%))";

            const heavyShadow =
                "drop-shadow(0 2px 2px rgb(0 0 0 / 80%)) drop-shadow(0 0 5px rgb(0 0 0 / 65%))";

            state.indicatorGeometryFrozen =
                false;

            this.#timerTypeIndicatorFrozen =
                false;

            this.#updateIndicatorSymbol();

            const newBaseInset =
                this.#getTimerTypeIndicatorTopInset();

            const inwardTip =
                Number.isFinite(
                    state.indicatorInwardTip
                )
                    ? state.indicatorInwardTip
                    : newBaseInset;

            const compensation =
                inwardTip -
                newBaseInset;

            const startTransform =
                `translateX(-50%) translateY(${compensation}px)`;

            const endTransform =
                "translateX(-50%) translateY(0px)";

            this.#indicatorSymbol.style.transform =
                startTransform;

            this.#indicatorSymbol.style.filter =
                heavyShadow;

            if (
                typeof this.#indicatorSymbol.animate !==
                    "function"
            ) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );

                this.#releaseTimerTypeIndicator(
                    state
                );

                return;
            }

            const animation =
                this.#indicatorSymbol.animate(
                    [
                        {
                            transform:
                                startTransform,
                            filter:
                                heavyShadow
                        },
                        {
                            transform:
                                endTransform,
                            filter:
                                transparentShadow
                        }
                    ],
                    {
                        duration,
                        easing:
                            "ease-in-out",
                        fill: "both"
                    }
                );

            state.indicatorOutwardAnimation =
                animation;

            animation.finished.then(
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState
                    ) {
                        return;
                    }

                    this.#indicatorSymbol.style.removeProperty(
                        "transform"
                    );

                    this.#indicatorSymbol.style.removeProperty(
                        "filter"
                    );

                    animation.cancel();

                    state.indicatorOutwardAnimation =
                        undefined;

                    this.#releaseTimerTypeIndicator(
                        state
                    );
                },
                () => {}
            );
        }

'''

replace_block(
    '        #startTimerTypeIndicatorSpin(\n',
    '        #releaseTimerTypeIndicator(\n',
    replacement_helpers,
    'replace indicator spin helpers'
)

replacement_catchup = r'''        #startTimerTypeIndicatorCatchup(
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
                            this.#startTimerTypeIndicatorOutward(
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

                            this.#startTimerTypeIndicatorOutward(
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

                                this.#startTimerTypeIndicatorOutward(
                                    state
                                );
                            },
                            () => {}
                        );
                    },
                    750
                );
        }

'''

replace_block(
    '        #startTimerTypeIndicatorCatchup(\n',
    '        #finishTimerTypeTransition(\n',
    replacement_catchup,
    'replace indicator catchup'
)

replace_once(
'''            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;

            this.#updateIndicatorSymbol();
''',
'''            state.indicatorGeometryFrozen =
                false;

            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (this.#indicatorSymbol) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );
            }

            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;

            this.#updateIndicatorSymbol();
''',
    'release indicator cleanup'
)

replace_once(
'''            state.indicatorSpinAnimation
                ?.cancel();
''',
'''            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (this.#indicatorSymbol) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );
            }
''',
    'cancel indicator animations'
)

replace_once(
'''            this.#startTimerTypeIndicatorSpin(
                state,
                maximumDuration
            );
''',
'''            this.#startTimerTypeIndicatorInward(
                state
            );
''',
    'start inward indicator animation'
)

replace_once(
'''                ringsFinished:
                    false
            };
''',
'''                ringsFinished:
                    false,
                indicatorGeometryFrozen:
                    false
            };
''',
    'add indicator geometry state'
)

replace_once(
'''            this.#timerTypeTransitionState =
                state;

            this.#timerTypeTransitioning =
                true;
''',
'''            this.#timerTypeTransitionState =
                state;

            state.indicatorGeometryFrozen =
                state.indicatorUsed;

            this.#timerTypeTransitioning =
                true;
''',
    'freeze indicator geometry'
)

replace_once(
'''                this.#rings =
                    new Map();
''',
'''                this.#prepareTimerTypeIndicatorInward(
                    state
                );

                this.#rings =
                    new Map();
''',
    'capture old indicator target'
)

replace_once(
'''            this.#indicatorRing.style.inset = `${topInset}px`;
            this.#indicatorSymbol.style.height = `${radialSpan}px`;
            this.#indicatorSymbol.style.fontSize = `${radialSpan}px`;

            if (!this.#timerTypeIndicatorFrozen) {
                this.#indicatorTrack.style.transform =
                    `rotate(${normalizedAngle}deg)`;
            }
''',
'''            const freezeGeometry =
                this.#timerTypeTransitionState
                    ?.indicatorGeometryFrozen ===
                        true;

            if (!freezeGeometry) {
                this.#indicatorRing.style.inset =
                    `${topInset}px`;

                this.#indicatorSymbol.style.height =
                    `${radialSpan}px`;

                this.#indicatorSymbol.style.fontSize =
                    `${radialSpan}px`;
            }

            if (!this.#timerTypeIndicatorFrozen) {
                this.#indicatorTrack.style.transform =
                    `rotate(${normalizedAngle}deg)`;
            }
''',
    'freeze indicator geometry during transition'
)

if '#startTimerTypeIndicatorSpin' in text or 'indicatorSpinAnimation' in text:
    raise SystemExit('old indicator spin implementation remains')

for required in (
    '#startTimerTypeIndicatorInward',
    '#startTimerTypeIndicatorOutward',
    'indicatorGeometryFrozen',
    'drop-shadow(0 2px 2px rgb(0 0 0 / 80%))',
    'state.indicatorInwardTip',
):
    if required not in text:
        raise SystemExit(f'missing expected transition code: {required}')

path.write_text(text)
