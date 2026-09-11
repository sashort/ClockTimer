from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_initial = '''                range.setAttribute(\n                    "start-time",\n                    this.#formatTimelineTime(\n                        start\n                    )\n                );\n\n                if (this.#starting) {\n'''
new_initial = '''                range.setAttribute(\n                    "start-time",\n                    this.#formatTimelineTime(\n                        start\n                    )\n                );\n\n                range.setAttribute(\n                    "ignore-overlaps",\n                    ""\n                );\n\n                if (this.#starting) {\n'''
if old_initial not in text:
    raise SystemExit('initial open insert creation block not found')
text = text.replace(old_initial, new_initial, 1)

old_segment = '''                    delete range.clockTimerDynamic;\n\n                    range.clockTimerInserted =\n                        record.id;\n\n                    this.#applyOtherAttributes(\n'''
new_segment = '''                    delete range.clockTimerDynamic;\n\n                    range.setAttribute(\n                        "ignore-overlaps",\n                        ""\n                    );\n\n                    range.clockTimerInserted =\n                        record.id;\n\n                    this.#applyOtherAttributes(\n'''
# Patch only the first occurrence after #syncOpenEndedRangeElements marker.
marker = text.index('        #syncOpenEndedRangeElements(')
pos = text.find(old_segment, marker)
if pos == -1:
    raise SystemExit('open insert segment creation block not found')
text = text[:pos] + text[pos:].replace(old_segment, new_segment, 1)

path.write_text(text)
