from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text(encoding="utf-8")

helper_marker = '''        #prepareTimerTypeIndicatorInward(\n            state\n        ) {\n'''

helpers = '''        #isTimerTypeTransitionVisualRange(\n            range\n        ) {\n            const type =\n                range?.getAttribute?.(\n                    "type"\n                );\n\n            return (\n                type === "elapsed" ||\n                type === "remaining" ||\n                type === "wave"\n            );\n        }\n\n        #prepareTimerTypeTransitionVisualRange(\n            range,\n            state =\n                this.#timerTypeTransitionState\n        ) {\n            if (\n                !state ||\n                state.visualFadeStarted ||\n                !range?.isConnected ||\n                !this.#isTimerTypeTransitionVisualRange(\n                    range\n                )\n            ) {\n                return;\n            }\n\n            if (!state.visualFadeRanges) {\n                state.visualFadeRanges =\n                    new Set();\n            }\n\n            if (\n                range.clockTimerTypeTransitionOpacityState ===\n                    undefined\n            ) {\n                range.clockTimerTypeTransitionOpacityState = {\n                    target:\n                        this.#getRangeOpacity(\n                            range\n                        ),\n                    inlineValue:\n                        range.style.getPropertyValue(\n                            "opacity"\n                        ),\n                    inlinePriority:\n                        range.style.getPropertyPriority(\n                            "opacity"\n                        )\n                };\n            }\n\n            range.style.setProperty(\n                "opacity",\n                "0"\n            );\n\n            state.visualFadeRanges.add(\n                range\n            );\n        }\n\n        #restoreTimerTypeTransitionVisualRange(\n            range\n        ) {\n            if (!range) {\n                return;\n            }\n\n            const opacityState =\n                range.clockTimerTypeTransitionOpacityState;\n\n            if (!opacityState) {\n                range.style.removeProperty(\n                    "opacity"\n                );\n\n                return;\n            }\n\n            if (opacityState.inlineValue) {\n                range.style.setProperty(\n                    "opacity",\n                    opacityState.inlineValue,\n                    opacityState.inlinePriority ??\n                        ""\n                );\n            }\n            else {\n                range.style.removeProperty(\n                    "opacity"\n                );\n            }\n\n            delete range.clockTimerTypeTransitionOpacityState;\n        }\n\n        #stripTimerTypeTransitionOldVisualRanges(\n            rings\n        ) {\n            for (const ring of rings) {\n                for (\n                    const range of\n                        Array.from(\n                            ring.children\n                        )\n                ) {\n                    if (\n                        range.localName !==\n                            "time-range" ||\n                        !this.#isTimerTypeTransitionVisualRange(\n                            range\n                        )\n                    ) {\n                        continue;\n                    }\n\n                    range.remove();\n                }\n            }\n\n            this.#elapsedRange =\n                undefined;\n\n            this.#remainingRanges.clear();\n\n            this.#removeWaveRange();\n        }\n\n        #finishTimerTypeTransitionVisualFade(\n            state\n        ) {\n            if (!state) {\n                return;\n            }\n\n            for (\n                const animation of\n                    state.visualFadeAnimations ??\n                        []\n            ) {\n                animation.cancel();\n            }\n\n            state.visualFadeAnimations\n                ?.clear();\n\n            for (\n                const range of\n                    state.visualFadeRanges ??\n                        []\n            ) {\n                this.#restoreTimerTypeTransitionVisualRange(\n                    range\n                );\n            }\n\n            state.visualFadeRanges\n                ?.clear();\n        }\n\n        #startTimerTypeTransitionVisualFade(\n            state\n        ) {\n            if (\n                state !==\n                    this.#timerTypeTransitionState ||\n                state.visualFadeStarted\n            ) {\n                return;\n            }\n\n            for (\n                const ring of\n                    state.newRings\n            ) {\n                if (!ring.isConnected) {\n                    continue;\n                }\n\n                for (\n                    const range of\n                        ring.children\n                ) {\n                    this.#prepareTimerTypeTransitionVisualRange(\n                        range,\n                        state\n                    );\n                }\n            }\n\n            if (\n                this.#waveRange?.isConnected\n            ) {\n                this.#prepareTimerTypeTransitionVisualRange(\n                    this.#waveRange,\n                    state\n                );\n            }\n\n            state.visualFadeStarted =\n                true;\n\n            state.visualFadeAnimations =\n                new Set();\n\n            for (\n                const range of\n                    state.visualFadeRanges ??\n                        []\n            ) {\n                if (!range.isConnected) {\n                    continue;\n                }\n\n                const opacityState =\n                    range.clockTimerTypeTransitionOpacityState;\n\n                const target =\n                    Number.isFinite(\n                        opacityState?.target\n                    )\n                        ? Math.min(\n                            1,\n                            Math.max(\n                                0,\n                                opacityState.target\n                            )\n                        )\n                        : 1;\n\n                range.style.setProperty(\n                    "opacity",\n                    "0"\n                );\n\n                if (\n                    typeof range.animate !==\n                        "function"\n                ) {\n                    this.#restoreTimerTypeTransitionVisualRange(\n                        range\n                    );\n\n                    continue;\n                }\n\n                const animation =\n                    range.animate(\n                        [\n                            { opacity: "0" },\n                            {\n                                opacity:\n                                    String(\n                                        target\n                                    )\n                            }\n                        ],\n                        {\n                            duration: 750,\n                            easing:\n                                "ease-in-out",\n                            fill: "both"\n                        }\n                    );\n\n                state.visualFadeAnimations.add(\n                    animation\n                );\n\n                animation.finished.then(\n                    () => {\n                        state.visualFadeAnimations\n                            ?.delete(\n                                animation\n                            );\n\n                        this.#restoreTimerTypeTransitionVisualRange(\n                            range\n                        );\n\n                        animation.cancel();\n                    },\n                    () => {}\n                );\n            }\n        }\n\n        #scheduleTimerTypeTransitionRelease(\n            state,\n            duration = 750\n        ) {\n            if (\n                state.indicatorOutwardTimeout !==\n                    undefined\n            ) {\n                clearTimeout(\n                    state.indicatorOutwardTimeout\n                );\n            }\n\n            state.indicatorOutwardTimeout =\n                setTimeout(\n                    () => {\n                        state.indicatorOutwardTimeout =\n                            undefined;\n\n                        if (\n                            state !==\n                                this.#timerTypeTransitionState\n                        ) {\n                            return;\n                        }\n\n                        this.#releaseTimerTypeIndicator(\n                            state\n                        );\n                    },\n                    Math.max(\n                        0,\n                        duration\n                    )\n                );\n        }\n\n'''

if text.count(helper_marker) != 1:
    raise SystemExit(
        f"Expected one indicator inward helper marker, found {text.count(helper_marker)}; refusing to patch."
    )

text = text.replace(
    helper_marker,
    helpers + helper_marker,
    1
)

old_append = '''            ring.appendChild(\n                range\n            );\n\n            return range;\n        }\n\n        #renderTimerTypeRangeSnapshots(\n'''

new_append = '''            ring.appendChild(\n                range\n            );\n\n            this.#prepareTimerTypeTransitionVisualRange(\n                range\n            );\n\n            return range;\n        }\n\n        #renderTimerTypeRangeSnapshots(\n'''

if text.count(old_append) != 1:
    raise SystemExit(
        f"Expected one transition range append block, found {text.count(old_append)}; refusing to patch."
    )

text = text.replace(
    old_append,
    new_append,
    1
)

old_wave = '''            else {\n                this.#setRangeTiming(\n                    range,\n                    start,\n                    end,\n                    range.hasAttribute(\n                        "range-length"\n                    )\n                );\n            }\n        }\n\n        #ensureBorderRing() {\n'''

new_wave = '''            else {\n                this.#setRangeTiming(\n                    range,\n                    start,\n                    end,\n                    range.hasAttribute(\n                        "range-length"\n                    )\n                );\n            }\n\n            this.#prepareTimerTypeTransitionVisualRange(\n                range\n            );\n        }\n\n        #ensureBorderRing() {\n'''

if text.count(old_wave) != 1:
    raise SystemExit(
        f"Expected one wave sync tail, found {text.count(old_wave)}; refusing to patch."
    )

text = text.replace(
    old_wave,
    new_wave,
    1
)

old_strip_point = '''            this.#timerTypeTransitionState =\n                state;\n\n            this.#timerTypeTransitioning =\n                true;\n'''

new_strip_point = '''            this.#timerTypeTransitionState =\n                state;\n\n            this.#stripTimerTypeTransitionOldVisualRanges(\n                oldRings\n            );\n\n            this.#timerTypeTransitioning =\n                true;\n'''

if text.count(old_strip_point) != 1:
    raise SystemExit(
        f"Expected one timer type transition state assignment, found {text.count(old_strip_point)}; refusing to patch."
    )

text = text.replace(
    old_strip_point,
    new_strip_point,
    1
)

old_outward_guard = '''        #startTimerTypeIndicatorOutward(\n            state\n        ) {\n            if (\n                state !==\n                    this.#timerTypeTransitionState ||\n                !state.indicatorUsed ||\n                !this.#indicatorSymbol\n            ) {\n                this.#releaseTimerTypeIndicator(\n                    state\n                );\n\n                return;\n            }\n\n            const duration = 750;\n'''

new_outward_guard = '''        #startTimerTypeIndicatorOutward(\n            state\n        ) {\n            if (\n                state !==\n                    this.#timerTypeTransitionState\n            ) {\n                return;\n            }\n\n            const duration = 750;\n\n            this.#startTimerTypeTransitionVisualFade(\n                state\n            );\n\n            const indicatorAvailable =\n                state.indicatorUsed &&\n                this.hasAttribute(\n                    "indicator-symbol"\n                ) &&\n                this.#started &&\n                Boolean(\n                    this.#indicatorSymbol\n                );\n\n            if (!indicatorAvailable) {\n                this.#scheduleTimerTypeTransitionRelease(\n                    state,\n                    duration\n                );\n\n                return;\n            }\n'''

if text.count(old_outward_guard) != 1:
    raise SystemExit(
        f"Expected one outward indicator guard, found {text.count(old_outward_guard)}; refusing to patch."
    )

text = text.replace(
    old_outward_guard,
    new_outward_guard,
    1
)

old_no_animate = '''            if (\n                typeof this.#indicatorSymbol.animate !==\n                    "function"\n            ) {\n                this.#indicatorSymbol.style.removeProperty(\n                    "transform"\n                );\n\n                this.#indicatorSymbol.style.removeProperty(\n                    "filter"\n                );\n\n                this.#releaseTimerTypeIndicator(\n                    state\n                );\n\n                return;\n            }\n'''

new_no_animate = '''            if (\n                typeof this.#indicatorSymbol.animate !==\n                    "function"\n            ) {\n                this.#indicatorSymbol.style.removeProperty(\n                    "transform"\n                );\n\n                this.#indicatorSymbol.style.removeProperty(\n                    "filter"\n                );\n\n                this.#scheduleTimerTypeTransitionRelease(\n                    state,\n                    duration\n                );\n\n                return;\n            }\n'''

if text.count(old_no_animate) != 1:
    raise SystemExit(
        f"Expected one outward no-animation fallback, found {text.count(old_no_animate)}; refusing to patch."
    )

text = text.replace(
    old_no_animate,
    new_no_animate,
    1
)

old_catchup_guard = '''        #startTimerTypeIndicatorCatchup(\n            state\n        ) {\n            if (\n                !state.indicatorUsed ||\n                !this.hasAttribute(\n                    "indicator-symbol"\n                ) ||\n                !this.#started ||\n                !this.#indicatorTrack\n            ) {\n                this.#releaseTimerTypeIndicator(\n                    state\n                );\n\n                return;\n            }\n\n            state.indicatorDelayTimeout =\n'''

new_catchup_guard = '''        #startTimerTypeIndicatorCatchup(\n            state\n        ) {\n            if (\n                state !==\n                    this.#timerTypeTransitionState\n            ) {\n                return;\n            }\n\n            const indicatorAvailable =\n                state.indicatorUsed &&\n                this.hasAttribute(\n                    "indicator-symbol"\n                ) &&\n                this.#started &&\n                Boolean(\n                    this.#indicatorTrack\n                );\n\n            if (!indicatorAvailable) {\n                state.indicatorDelayTimeout =\n                    setTimeout(\n                        () => {\n                            state.indicatorDelayTimeout =\n                                undefined;\n\n                            if (\n                                state !==\n                                    this.#timerTypeTransitionState\n                            ) {\n                                return;\n                            }\n\n                            this.#startTimerTypeIndicatorOutward(\n                                state\n                            );\n                        },\n                        1500\n                    );\n\n                return;\n            }\n\n            state.indicatorDelayTimeout =\n'''

if text.count(old_catchup_guard) != 1:
    raise SystemExit(
        f"Expected one indicator catchup guard, found {text.count(old_catchup_guard)}; refusing to patch."
    )

text = text.replace(
    old_catchup_guard,
    new_catchup_guard,
    1
)

old_release_cleanup = '''            state.indicatorOutwardAnimation\n                ?.cancel();\n\n            if (this.#indicatorSymbol) {\n'''

new_release_cleanup = '''            state.indicatorOutwardAnimation\n                ?.cancel();\n\n            if (\n                state.indicatorOutwardTimeout !==\n                    undefined\n            ) {\n                clearTimeout(\n                    state.indicatorOutwardTimeout\n                );\n\n                state.indicatorOutwardTimeout =\n                    undefined;\n            }\n\n            this.#finishTimerTypeTransitionVisualFade(\n                state\n            );\n\n            if (this.#indicatorSymbol) {\n'''

# This block occurs in release and cancel. Replace only the first occurrence for release.
if text.count(old_release_cleanup) < 2:
    raise SystemExit(
        f"Expected at least two indicator cleanup blocks, found {text.count(old_release_cleanup)}; refusing to patch."
    )

text = text.replace(
    old_release_cleanup,
    new_release_cleanup,
    1
)

old_cancel_cleanup = '''            state.indicatorOutwardAnimation\n                ?.cancel();\n\n            if (this.#indicatorSymbol) {\n'''

new_cancel_cleanup = '''            state.indicatorOutwardAnimation\n                ?.cancel();\n\n            if (\n                state.indicatorOutwardTimeout !==\n                    undefined\n            ) {\n                clearTimeout(\n                    state.indicatorOutwardTimeout\n                );\n\n                state.indicatorOutwardTimeout =\n                    undefined;\n            }\n\n            this.#finishTimerTypeTransitionVisualFade(\n                state\n            );\n\n            if (this.#indicatorSymbol) {\n'''

if text.count(old_cancel_cleanup) != 1:
    raise SystemExit(
        f"Expected one remaining cancel cleanup block, found {text.count(old_cancel_cleanup)}; refusing to patch."
    )

text = text.replace(
    old_cancel_cleanup,
    new_cancel_cleanup,
    1
)

path.write_text(text, encoding="utf-8")
