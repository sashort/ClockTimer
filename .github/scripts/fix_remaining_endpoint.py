from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''        #getLatestTimerEnd() {\n            let latest;\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        \"ring-container > time-range\"\n                    )\n            ) {\n                if (\n                    range.getAttribute(\n                        \"type\"\n                    ) === \"remaining\"\n                ) {\n                    continue;\n                }\n\n                const end =\n                    Number(\n                        range.clockTimerEnd\n                    );\n'''
new = '''        #getLatestTimerEnd() {\n            let latest;\n\n            const ignoredTypes =\n                new Set([\n                    \"elapsed\",\n                    \"remaining\",\n                    \"wave\"\n                ]);\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        \"ring-container > time-range\"\n                    )\n            ) {\n                if (\n                    range.timeRangeExiting === true ||\n                    ignoredTypes.has(\n                        range.getAttribute(\n                            \"type\"\n                        )\n                    )\n                ) {\n                    continue;\n                }\n\n                const end =\n                    Number(\n                        range.clockTimerEnd\n                    );\n'''
if old not in text:
    raise SystemExit('Could not patch #getLatestTimerEnd')
text = text.replace(old, new, 1)

old = '''            const latestEnd =\n                this.#getLatestTimerEnd();\n'''
new = '''            const latestEnd =\n                Number.isFinite(\n                    this.#calculatedEndTime\n                )\n                    ? this.#calculatedEndTime\n                    : this.#getLatestTimerEnd();\n'''
if old not in text:
    raise SystemExit('Could not patch remaining endpoint selection')
text = text.replace(old, new, 1)

path.write_text(text)
