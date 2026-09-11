from pathlib import Path

# TimeRange: a range without both logical endpoints must not render as an unclipped full ring.
path = Path('TimeRange.js')
text = path.read_text()
old = '''        if (\n            width <= 0 ||\n            height <= 0 ||\n            !(\n                this.#startTime instanceof Date\n            ) ||\n            !(\n                this.#endTime instanceof Date\n            )\n        ) {\n            this.#styleElement.textContent =\n                \"\";\n\n            return;\n        }\n'''
new = '''        if (\n            width <= 0 ||\n            height <= 0\n        ) {\n            this.#styleElement.textContent =\n                \"\";\n\n            return;\n        }\n\n        if (\n            !(\n                this.#startTime instanceof Date\n            ) ||\n            !(\n                this.#endTime instanceof Date\n            )\n        ) {\n            this.#styleElement.textContent = `\n                :host {\n                    clip-path: polygon(\n                        50% 50%,\n                        50% 50%,\n                        50% 50%\n                    );\n                }\n            `;\n\n            return;\n        }\n'''
if old not in text:
    raise SystemExit('TimeRange missing-endpoint block not found')
text = text.replace(old, new, 1)
path.write_text(text)

# ClockTimer: split/moved pieces are continuations of an existing scheduled range,
# so they should enter at their final geometry rather than replay TimeRange entry animation.
path = Path('ClockTimer.js')
text = path.read_text()
old = '''                    if (\n                        !firstSegment\n                    ) {\n                        this.#applyPreservedAttributes(\n                            segment,\n                            preservedAttributes\n                        );\n\n                        this.#copyClockTimerRangeState(\n                            range,\n                            segment\n                        );\n                    }\n\n                    this.#setRangeTiming(\n'''
new = '''                    if (\n                        !firstSegment\n                    ) {\n                        this.#applyPreservedAttributes(\n                            segment,\n                            preservedAttributes\n                        );\n\n                        this.#copyClockTimerRangeState(\n                            range,\n                            segment\n                        );\n\n                        segment.timeRangeFullEntry =\n                            true;\n                    }\n\n                    this.#setRangeTiming(\n'''
if old not in text:
    raise SystemExit('ClockTimer split segment block not found')
text = text.replace(old, new, 1)

old = '''                        this.#copyClockTimerRangeState(\n                            range,\n                            movedSegment\n                        );\n\n                        this.#setRangeTiming(\n'''
new = '''                        this.#copyClockTimerRangeState(\n                            range,\n                            movedSegment\n                        );\n\n                        movedSegment.timeRangeFullEntry =\n                            true;\n\n                        this.#setRangeTiming(\n'''
if old not in text:
    raise SystemExit('ClockTimer moved segment block not found')
text = text.replace(old, new, 1)
path.write_text(text)
