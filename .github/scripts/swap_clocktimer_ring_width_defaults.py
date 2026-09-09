from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

active_old = 'var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))'
inactive_old = 'var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))'
active_new = 'var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))'
inactive_new = 'var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))'

active_count = text.count(active_old)
inactive_count = text.count(inactive_old)
if active_count < 1 or inactive_count < 1:
    raise SystemExit(f'expected ring width defaults not found: active={active_count}, inactive={inactive_count}')

text = text.replace(active_old, active_new)
text = text.replace(inactive_old, inactive_new)
path.write_text(text)
print(f'swapped active={active_count}, inactive={inactive_count} ring width fallback(s)')
