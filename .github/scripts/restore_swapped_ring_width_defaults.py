from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

active_old = 'var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))'
inactive_old = 'var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))'
active_new = 'var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))'
inactive_new = 'var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))'

if active_old not in text or inactive_old not in text:
    raise SystemExit('expected pre-swap defaults not found')

text = text.replace(active_old, active_new)
text = text.replace(inactive_old, inactive_new)
path.write_text(text)
