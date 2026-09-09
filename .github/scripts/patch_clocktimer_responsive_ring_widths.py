from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

replacements = {
    '"var(--clock-timer-inactive-ring-width, 4px)"': '"var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))"',
    '"var(--clock-timer-active-ring-width, 8px)"': '"var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"',
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected text: {old}')
    text = text.replace(old, new)

path.write_text(text)
