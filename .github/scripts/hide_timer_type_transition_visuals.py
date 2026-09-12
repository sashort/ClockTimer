from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text(encoding="utf-8")

old_state = '''                range.clockTimerTypeTransitionOpacityState = {
                    target:
                        this.#getRangeOpacity(
                            range
                        ),
                    inlineValue:
                        range.style.getPropertyValue(
                            "opacity"
                        ),
                    inlinePriority:
                        range.style.getPropertyPriority(
                            "opacity"
                        )
                };
'''

new_state = '''                range.clockTimerTypeTransitionOpacityState = {
                    target:
                        this.#getRangeOpacity(
                            range
                        ),
                    inlineValue:
                        range.style.getPropertyValue(
                            "opacity"
                        ),
                    inlinePriority:
                        range.style.getPropertyPriority(
                            "opacity"
                        ),
                    displayInlineValue:
                        range.style.getPropertyValue(
                            "display"
                        ),
                    displayInlinePriority:
                        range.style.getPropertyPriority(
                            "display"
                        )
                };
'''

if text.count(old_state) != 1:
    raise SystemExit(
        f"Expected one transition opacity state block, found {text.count(old_state)}; refusing to patch."
    )

text = text.replace(
    old_state,
    new_state,
    1
)

old_hide = '''            range.style.setProperty(
                "opacity",
                "0"
            );

            state.visualFadeRanges.add(
'''

new_hide = '''            range.style.setProperty(
                "opacity",
                "0"
            );

            range.style.setProperty(
                "display",
                "none",
                "important"
            );

            state.visualFadeRanges.add(
'''

if text.count(old_hide) != 1:
    raise SystemExit(
        f"Expected one transition visual hide block, found {text.count(old_hide)}; refusing to patch."
    )

text = text.replace(
    old_hide,
    new_hide,
    1
)

old_restore = '''            if (opacityState.inlineValue) {
                range.style.setProperty(
                    "opacity",
                    opacityState.inlineValue,
                    opacityState.inlinePriority ??
                        ""
                );
            }
            else {
                range.style.removeProperty(
                    "opacity"
                );
            }

            delete range.clockTimerTypeTransitionOpacityState;
'''

new_restore = '''            if (opacityState.inlineValue) {
                range.style.setProperty(
                    "opacity",
                    opacityState.inlineValue,
                    opacityState.inlinePriority ??
                        ""
                );
            }
            else {
                range.style.removeProperty(
                    "opacity"
                );
            }

            if (opacityState.displayInlineValue) {
                range.style.setProperty(
                    "display",
                    opacityState.displayInlineValue,
                    opacityState.displayInlinePriority ??
                        ""
                );
            }
            else {
                range.style.removeProperty(
                    "display"
                );
            }

            delete range.clockTimerTypeTransitionOpacityState;
'''

if text.count(old_restore) != 1:
    raise SystemExit(
        f"Expected one transition visual restore block, found {text.count(old_restore)}; refusing to patch."
    )

text = text.replace(
    old_restore,
    new_restore,
    1
)

old_reveal = '''                range.style.setProperty(
                    "opacity",
                    "0"
                );

                if (
                    typeof range.animate !==
                        "function"
                ) {
'''

new_reveal = '''                range.style.setProperty(
                    "opacity",
                    "0"
                );

                if (opacityState?.displayInlineValue) {
                    range.style.setProperty(
                        "display",
                        opacityState.displayInlineValue,
                        opacityState.displayInlinePriority ??
                            ""
                    );
                }
                else {
                    range.style.removeProperty(
                        "display"
                    );
                }

                if (
                    typeof range.animate !==
                        "function"
                ) {
'''

if text.count(old_reveal) != 1:
    raise SystemExit(
        f"Expected one transition visual reveal block, found {text.count(old_reveal)}; refusing to patch."
    )

text = text.replace(
    old_reveal,
    new_reveal,
    1
)

path.write_text(text, encoding="utf-8")
