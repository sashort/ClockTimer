from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            const preserveRangeLength =\n                range.hasAttribute(\n                    "range-length"\n                );\n\n            let firstSegment =\n                true;\n'''
new = '''            const preserveRangeLength =\n                range.hasAttribute(\n                    "range-length"\n                );\n\n            const isSplit =\n                spans.length > 1;\n\n            let firstSegment =\n                true;\n'''
if old not in text:
    raise SystemExit('split setup block not found')
text = text.replace(old, new, 1)

old2 = '''                    this.#setRangeTiming(\n                        segment,\n                        cursor,\n                        segmentEnd,\n                        preserveRangeLength\n                    );\n\n                    const ring =\n'''
new2 = '''                    this.#setRangeTiming(\n                        segment,\n                        cursor,\n                        segmentEnd,\n                        preserveRangeLength\n                    );\n\n                    if (\n                        isSplit &&\n                        segment === range &&\n                        typeof range.snapToLogicalTiming ===\n                            "function"\n                    ) {\n                        range.snapToLogicalTiming();\n                    }\n\n                    const ring =\n'''
if old2 not in text:
    raise SystemExit('setRangeTiming block not found')
text = text.replace(old2, new2, 1)

path.write_text(text)
