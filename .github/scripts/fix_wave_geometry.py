from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old = '''        if (
            this.getAttribute("type") ===
                "elapsed"
        ) {
            const sweepEndAngle ='''

new = '''        if (
            this.getAttribute("type") ===
                "wave"
        ) {
            const sweepEndAngle ='''

if old not in text:
    raise SystemExit('normal wave geometry block not found')

path.write_text(text.replace(old, new, 1))
