from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()
old = '''        if (\n            splitMilliseconds <= startMilliseconds ||\n            splitMilliseconds >= endMilliseconds\n        ) {\n            return;\n        }\n'''
new = '''        if (\n            splitMilliseconds <= startMilliseconds ||\n            splitMilliseconds > endMilliseconds ||\n            (\n                splitMilliseconds === endMilliseconds &&\n                !insert\n            )\n        ) {\n            return;\n        }\n'''
if old not in text:
    raise SystemExit('split boundary block not found')
text = text.replace(old, new, 1)
old2 = '''        if (hadRangeLength) {\n            right.setAttribute(\n                "range-length",\n                this.#formatRangeLength(\n                    endMilliseconds -\n                    splitMilliseconds\n                )\n            );\n        }\n'''
new2 = '''        const rightLength =\n            endMilliseconds -\n            splitMilliseconds;\n\n        if (\n            hadRangeLength &&\n            rightLength > 0\n        ) {\n            right.setAttribute(\n                "range-length",\n                this.#formatRangeLength(\n                    rightLength\n                )\n            );\n        }\n'''
if old2 not in text:
    raise SystemExit('right range-length block not found')
text = text.replace(old2, new2, 1)
path.write_text(text)
