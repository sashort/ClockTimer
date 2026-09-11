from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''                this.#tickAlignmentMilliseconds =\n                    this.#millisecondsComponent(\n                        start\n                    );\n\n                this.#renderOverwriteRecord(\n                    record\n                );\n\n                const overwriteElement =\n'''
new = '''                this.#tickAlignmentMilliseconds =\n                    this.#millisecondsComponent(\n                        start\n                    );\n\n                const initialNowDate =\n                    new Date();\n\n                let initialNow =\n                    this.#getCurrentTimelineTime(\n                        initialNowDate\n                    );\n\n                if (initialNow <= start) {\n                    initialNow =\n                        start + 1;\n                }\n\n                this.#updateOpenOverwriteRange(\n                    new Date(\n                        initialNowDate.getTime() +\n                        Math.max(\n                            0,\n                            initialNow -\n                                this.#getCurrentTimelineTime(\n                                    initialNowDate\n                                )\n                        )\n                    )\n                );\n\n                const overwriteElement =\n'''

if old not in text:
    raise SystemExit("open overwrite initial render block not found")

text = text.replace(old, new, 1)
path.write_text(text)
