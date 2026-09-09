from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

replacements = [
    (
        '"var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"',
        '"var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))"'
    ),
    (
        '"var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))"',
        '"var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"'
    ),
    (
        '"var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))";',
        '"var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))";'
    ),
    (
        '                        b - a\n',
        '                        a - b\n'
    ),
    (
        '''            const order = [\n                activeRing,\n                borderRing,\n                ...inactive,\n                handRing,\n                numberRing\n            ];''',
        '''            const order = [\n                ...inactive,\n                borderRing,\n                activeRing,\n                handRing,\n                numberRing\n            ];'''
    )
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'expected source fragment not found: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
