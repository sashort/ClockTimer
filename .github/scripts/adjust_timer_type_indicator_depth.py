from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text(encoding="utf-8")

shadow_marker = '''        #getTimerTypeIndicatorShadow(
            visible
        ) {
            return visible
                ? "drop-shadow(0 2px 2px rgb(0 0 0 / 80%)) drop-shadow(0 0 5px rgb(0 0 0 / 65%))"
                : "drop-shadow(0 2px 2px rgb(0 0 0 / 0%)) drop-shadow(0 0 5px rgb(0 0 0 / 0%))";
        }

'''

helpers = '''        #setTimerTypeIndicatorTransitionLayer(
            active
        ) {
            if (!this.#indicatorRing) {
                return;
            }

            if (active) {
                this.#indicatorRing.style.zIndex =
                    "2147483647";

                return;
            }

            this.#indicatorRing.style.removeProperty(
                "z-index"
            );
        }

        #getTimerTypeIndicatorSymbolHeight() {
            if (!this.#indicatorSymbol) {
                return 0;
            }

            const computedHeight =
                Number.parseFloat(
                    getComputedStyle(
                        this.#indicatorSymbol
                    ).height
                );

            if (
                Number.isFinite(computedHeight) &&
                computedHeight > 0
            ) {
                return computedHeight;
            }

            const renderedHeight =
                this.#indicatorSymbol
                    .getBoundingClientRect()
                    .height;

            return Number.isFinite(renderedHeight)
                ? renderedHeight
                : 0;
        }

        #getTimerTypeIndicatorTickCenter(
            state
        ) {
            if (
                !this.hasAttribute(
                    "tick-marks"
                ) ||
                !this.#tickMarkLayer ||
                this.#tickMarkLayer.childElementCount ===
                    0
            ) {
                return undefined;
            }

            let tickInset;

            const target =
                state.targetGeometry
                    ?.get(
                        this.#tickRing
                    );

            if (
                target &&
                Number.isFinite(
                    target.inset
                )
            ) {
                tickInset =
                    target.inset;
            }

            if (!Number.isFinite(tickInset)) {
                tickInset =
                    Number.parseFloat(
                        getComputedStyle(
                            this.#tickMarkLayer
                        ).top
                    );
            }

            if (!Number.isFinite(tickInset)) {
                return undefined;
            }

            let tickLength = 0;

            for (
                const mark of
                    this.#tickMarkLayer.querySelectorAll(
                        ".tick-mark"
                    )
            ) {
                const height =
                    Number.parseFloat(
                        getComputedStyle(
                            mark
                        ).height
                    );

                if (Number.isFinite(height)) {
                    tickLength =
                        Math.max(
                            tickLength,
                            height
                        );
                }
            }

            if (tickLength <= 0) {
                return undefined;
            }

            return (
                tickInset +
                tickLength / 2
            );
        }

        #retargetTimerTypeIndicatorToTicks(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol ||
                !this.#indicatorRing
            ) {
                return;
            }

            const center =
                this.#getTimerTypeIndicatorTickCenter(
                    state
                );

            if (!Number.isFinite(center)) {
                return;
            }

            const baseInset =
                this.#getTimerTypeIndicatorTopInset();

            const symbolHeight =
                this.#getTimerTypeIndicatorSymbolHeight();

            if (symbolHeight <= 0) {
                return;
            }

            state.indicatorInwardCenter =
                center;

            state.indicatorInwardDistance =
                Math.max(
                    0,
                    center -
                    baseInset -
                    symbolHeight / 2
                );
        }

'''

if text.count(shadow_marker) != 1:
    raise SystemExit(
        f"Expected one indicator shadow helper, found {text.count(shadow_marker)}; refusing to patch."
    )

text = text.replace(
    shadow_marker,
    shadow_marker + helpers,
    1
)

old_outward = '''            const inwardTip =
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
'''

new_outward = '''            let distance;

            if (
                Number.isFinite(
                    state.indicatorInwardCenter
                )
            ) {
                const symbolHeight =
                    this.#getTimerTypeIndicatorSymbolHeight();

                distance =
                    Math.max(
                        0,
                        state.indicatorInwardCenter -
                        newBaseInset -
                        symbolHeight / 2
                    );
            }
            else {
                const inwardTip =
                    Number.isFinite(
                        state.indicatorInwardTip
                    )
                        ? state.indicatorInwardTip
                        : newBaseInset;

                distance =
                    Math.max(
                        0,
                        inwardTip -
                        newBaseInset
                    );
            }
'''

if text.count(old_outward) != 1:
    raise SystemExit(
        f"Expected one outward indicator distance block, found {text.count(old_outward)}; refusing to patch."
    )

text = text.replace(
    old_outward,
    new_outward,
    1
)

old_release = '''            this.#timerTypeIndicatorFrozen =
                false;

            this.#timerTypeTransitionState =
                undefined;
'''

new_release = '''            this.#timerTypeIndicatorFrozen =
                false;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            this.#timerTypeTransitionState =
                undefined;
'''

if text.count(old_release) != 1:
    raise SystemExit(
        f"Expected one indicator release block, found {text.count(old_release)}; refusing to patch."
    )

text = text.replace(
    old_release,
    new_release,
    1
)

old_cancel = '''            this.#timerTypeTransitionToken++;

            if (!state) {
'''

new_cancel = '''            this.#timerTypeTransitionToken++;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            if (!state) {
'''

if text.count(old_cancel) != 1:
    raise SystemExit(
        f"Expected one timer type cancel block, found {text.count(old_cancel)}; refusing to patch."
    )

text = text.replace(
    old_cancel,
    new_cancel,
    1
)

old_transition_layer = '''            this.#timerTypeIndicatorFrozen =
                state.indicatorUsed;

            if (
                this.#indicatorHandoffTimeout !==
'''

new_transition_layer = '''            this.#timerTypeIndicatorFrozen =
                state.indicatorUsed;

            this.#setTimerTypeIndicatorTransitionLayer(
                state.indicatorUsed
            );

            if (
                this.#indicatorHandoffTimeout !==
'''

if text.count(old_transition_layer) != 1:
    raise SystemExit(
        f"Expected one transition indicator layer insertion point, found {text.count(old_transition_layer)}; refusing to patch."
    )

text = text.replace(
    old_transition_layer,
    new_transition_layer,
    1
)

old_target = '''                state.targetGeometry =
                    this.#calculateTimerTypeTargetGeometry(
                        state.newRings
                    );

                for (
                    const ring of
                        state.newRings
'''

new_target = '''                state.targetGeometry =
                    this.#calculateTimerTypeTargetGeometry(
                        state.newRings
                    );

                this.#retargetTimerTypeIndicatorToTicks(
                    state
                );

                for (
                    const ring of
                        state.newRings
'''

if text.count(old_target) != 1:
    raise SystemExit(
        f"Expected one target geometry insertion point, found {text.count(old_target)}; refusing to patch."
    )

text = text.replace(
    old_target,
    new_target,
    1
)

path.write_text(text, encoding="utf-8")
