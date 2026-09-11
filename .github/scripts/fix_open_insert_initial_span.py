from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            const effectiveEnd =\n                record.openEnded\n                    ? (\n                        Number.isFinite(\n                            this.#openEndedLastTick\n                        ) &&\n                        this.#openEndedLastTick > start\n                            ? this.#openEndedLastTick\n                            : undefined\n                    )\n                    : (\n'''
new = '''            const effectiveEnd =\n                record.openEnded\n                    ? (\n                        Number.isFinite(\n                            this.#openEndedLastTick\n                        ) &&\n                        this.#openEndedLastTick > start\n                            ? this.#openEndedLastTick\n                            : start + 1\n                    )\n                    : (\n'''

if old not in text:
    raise SystemExit("open inserted effectiveEnd block not found")

text = text.replace(old, new, 1)
path.write_text(text)
