from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_split = '''                        segment.timeRangeFullEntry =\n                            true;\n                    }\n\n                    this.#setRangeTiming(\n'''
new_split = '''                        segment.timeRangeFullEntry =\n                            true;\n\n                        segment.setAttribute(\n                            "ignore-overlaps",\n                            ""\n                        );\n                    }\n\n                    this.#setRangeTiming(\n'''
if old_split not in text:
    raise SystemExit('split segment marker not found')
text = text.replace(old_split, new_split, 1)

old_moved = '''                        movedSegment.timeRangeFullEntry =\n                            true;\n\n                        this.#setRangeTiming(\n'''
new_moved = '''                        movedSegment.timeRangeFullEntry =\n                            true;\n\n                        movedSegment.setAttribute(\n                            "ignore-overlaps",\n                            ""\n                        );\n\n                        this.#setRangeTiming(\n'''
if old_moved not in text:
    raise SystemExit('moved segment marker not found')
text = text.replace(old_moved, new_moved, 1)

path.write_text(text)
