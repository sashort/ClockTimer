from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            const animation =
                this.animate(
                    [
                        {
                            offset: 0,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        },
'''

new = '''            const animation =
                this.#clockFace.animate(
                    [
                        {
                            offset: 0,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        },
'''

if old not in text:
    raise SystemExit("spin animation target not found")

text = text.replace(old, new, 1)
path.write_text(text)
