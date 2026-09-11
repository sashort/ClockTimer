from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


start = text.index("        #startTimerTypeIndicatorSpin(\n")
end = text.index("        #releaseTimerTypeIndicator(\n", start)

indicator_methods = r'''        #getTimerTypeIndicatorTopInset() {
            if (!this.#indicatorRing) {
                return 0;
            }

            const top =
                Number.parseFloat(
                    getComputedStyle(
                        this.#indicatorRing
                    ).top
                );

            if (Number.isFinite(top)) {
                return top;
            }

            const inset =
                Number.parseFloat(
                    this.#indicatorRing.style.inset
                );

            return Number.isFinite(inset)
                ? inset
                : 0;
        }

        #getTimerTypeIndicatorShadow(
            visible
        ) {
            return visible
                ? "drop-shadow(0 2px 2px rgb(0 0 0 / 80%)) drop-shadow(0 0 5px rgb(0 0 0 / 65%))"
                : "drop-shadow(0 2px 2px rgb(0 0 0 / 0%)) drop-shadow(0 0 5px rgb(0 0 0 / 0%))";
        }

        #prepareTimerTypeIndicatorInward(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol ||
                !this.#indicatorRing
            ) {
                return;
            }

            const baseInset =
                this.#getTimerTypeIndicatorTopInset();

            let inwardTip;

            for (
                const ring of
                    state.oldRings
            ) {
                if (
                    !ring.hasAttribute(
                        "active"
                    )
                ) {
                    continue;
                }

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

            const duration = 750;

            const distance =
                Number.isFinite(
                    state.indicatorInwardDistance
                )
                    ? state.indicatorInwardDistance
                    : 0;

            const startTransform =
                "translateX(-50%) translateY(0px)";

            const endTransform =
                `translateX(-50%) translateY(${distance}px)`;

            const transparentShadow =
                this.#getTimerTypeIndicatorShadow(
                    false
                );

            const heavyShadow =
                this.#getTimerTypeIndicatorShadow(
                    true
                );

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

            const duration = 750;

            const heavyShadow =
                this.#getTimerTypeIndicatorShadow(
                    true
                );

            const transparentShadow =
                this.#getTimerTypeIndicatorShadow(
                    false
                );

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

            const distance =
                Math.max(
                    0,
                    inwardTip -
                    newBaseInset
                );

            const startTransform =
                `translateX(-50%) translateY(${distance}px)`;

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

text = text[:start] + indicator_methods + text[end:]

replace_once(
'''            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;
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

            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;
''',
"release cleanup"
)

# Catch-up failures/completion should send the symbol outward rather than
# abruptly releasing it.
text = text.replace(
'''                            this.#releaseTimerTypeIndicator(
                                state
                            );''',
'''                            this.#startTimerTypeIndicatorOutward(
                                state
                            );''',
3
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
"cancel cleanup"
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
"start inward"
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
"prepare inward geometry"
)

replace_once(
'''            if (this.#indicatorHandoffFrozen) {
                this.#setIndicatorSymbolVisible(true);
                return;
            }

            if (!this.hasAttribute("indicator-symbol") || !this.#started || !this.#elapsedRange) {
''',
'''            if (this.#indicatorHandoffFrozen) {
                this.#setIndicatorSymbolVisible(true);
                return;
            }

            if (
                this.#timerTypeIndicatorFrozen &&
                this.#timerTypeTransitionState
                    ?.indicatorUsed
            ) {
                this.#setIndicatorSymbolVisible(
                    true
                );

                return;
            }

            if (!this.hasAttribute("indicator-symbol") || !this.#started || !this.#elapsedRange) {
''',
"freeze indicator geometry"
)

if "#startTimerTypeIndicatorSpin(" in text:
    raise SystemExit("old spin method still present")
if "indicatorSpinAnimation" in text:
    raise SystemExit("old spin state still present")

path.write_text(text)
