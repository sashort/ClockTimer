from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            let nextRange;\n            let nextStart =\n                Infinity;\n'''
new = '''            let currentRange;\n            let currentStart =\n                -Infinity;\n\n            let nextRange;\n            let nextStart =\n                Infinity;\n'''
if old not in text:
    raise SystemExit('replaceWithNext declarations not found')
text = text.replace(old, new, 1)

old = '''                if (\n                    start < now ||\n                    start >= nextStart\n                ) {\n                    continue;\n                }\n\n                nextRange =\n                    range;\n\n                nextStart =\n                    start;\n'''
new = '''                const end =\n                    Number(\n                        range.clockTimerEnd\n                    );\n\n                if (\n                    Number.isFinite(end) &&\n                    start <= now &&\n                    end > now &&\n                    start > currentStart\n                ) {\n                    currentRange =\n                        range;\n\n                    currentStart =\n                        start;\n                }\n\n                if (\n                    start < now ||\n                    start >= nextStart\n                ) {\n                    continue;\n                }\n\n                nextRange =\n                    range;\n\n                nextStart =\n                    start;\n'''
if old not in text:
    raise SystemExit('replaceWithNext range selection not found')
text = text.replace(old, new, 1)

old = '''            nextRange.removeAttribute(\n                "overwrite"\n            );\n\n            this.#setRangeStart(\n'''
new = '''            currentRange?.removeAttribute(\n                "overwrite"\n            );\n\n            this.#setRangeStart(\n'''
if old not in text:
    raise SystemExit('wrong overwrite removal not found')
text = text.replace(old, new, 1)

path.write_text(text)
