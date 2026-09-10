from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()
old = '''                spans.push({
                    type: "late-start",
                    start: this.#scheduledStartMilliseconds,
                    end: this.#startTimeMilliseconds
                });'''
new = '''                spans.push({
                    type: "prestart",
                    start: this.#scheduledStartMilliseconds,
                    end: this.#startTimeMilliseconds
                });'''
if old not in text:
    raise SystemExit("late-start planned segment not found")
text = text.replace(old, new, 1)
path.write_text(text)
