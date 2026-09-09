from pathlib import Path
import re

path = Path('ClockTimer.js')
text = path.read_text()

pattern = r'var\(--clock-timer-border-width,\s*[^)]+\)'
matches = re.findall(pattern, text)

if not matches:
    raise SystemExit('clock-timer-border-width fallback not found')

replacement = 'var(--clock-timer-border-width, clamp(2px, 1.5cqi, 7px))'
text, count = re.subn(pattern, replacement, text)

print(f'updated {count} border-width fallback(s)')
path.write_text(text)
