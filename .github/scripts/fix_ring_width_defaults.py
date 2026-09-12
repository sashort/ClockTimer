from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

active_old = 'var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))'
active_new = 'var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))'
inactive_old = 'var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))'
inactive_new = 'var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))'

if text.count(active_old) != 2:
    raise SystemExit(f"expected 2 active width defaults, found {text.count(active_old)}")
if text.count(inactive_old) != 1:
    raise SystemExit(f"expected 1 inactive width default, found {text.count(inactive_old)}")

text = text.replace(active_old, active_new)
text = text.replace(inactive_old, inactive_new)
path.write_text(text)
