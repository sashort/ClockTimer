from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '"var(--clock-timer-number-inset, .25rem)"'
new = '"var(--clock-timer-number-inset, clamp(4px, 3cqi, 16px))"'

if text.count(old) != 1:
    raise SystemExit(f'expected one number inset fallback, found {text.count(old)}')

text = text.replace(old, new, 1)
path.write_text(text)
