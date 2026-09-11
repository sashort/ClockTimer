from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            if (\n                record.openEnded\n            ) {\n                this.#openEndedRange =\n                    record;\n\n                this.#openEndedLastTick =\n                    startTimeline;\n            }\n\n            this.#tickAlignmentMilliseconds =\n                record.startDate.getMilliseconds();\n\n            this.#renderAllInsertedRanges();\n\n            const insertedElement =\n'''
new = '''            if (\n                record.openEnded\n            ) {\n                this.#openEndedRange =\n                    record;\n\n                this.#openEndedLastTick =\n                    startTimeline;\n            }\n\n            this.#tickAlignmentMilliseconds =\n                record.startDate.getMilliseconds();\n\n            if (record.openEnded) {\n                const initialNow =\n                    new Date();\n\n                if (\n                    initialNow.getTime() <=\n                        record.startDate.getTime()\n                ) {\n                    initialNow.setTime(\n                        record.startDate.getTime() +\n                        1\n                    );\n                }\n\n                this.#updateOpenEndedRange(\n                    initialNow\n                );\n            }\n            else {\n                this.#renderAllInsertedRanges();\n            }\n\n            const insertedElement =\n'''

if old not in text:
    raise SystemExit("insert open-ended render block not found")

text = text.replace(old, new, 1)
path.write_text(text)
