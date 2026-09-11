from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            if (\n                type === "elapsed" ||\n                type === "remaining"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }'''

new = '''            if (\n                type === "elapsed" ||\n                type === "remaining"\n            ) {\n                range.classList.add(\n                    type\n                );\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }'''

if old not in text:
    raise SystemExit('elapsed/remaining creation block not found')

path.write_text(text.replace(old, new, 1))
