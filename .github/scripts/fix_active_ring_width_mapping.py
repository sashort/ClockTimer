from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text(encoding="utf-8")

replacements = {
    '"var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"': '"var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"',
    '"var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))"': '"var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))"',
}

expected_counts = {
    '"var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"': 2,
    '"var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))"': 1,
}

for old, expected in expected_counts.items():
    actual = text.count(old)
    if actual != expected:
        raise SystemExit(
            f"Expected {expected} occurrence(s) of {old}, found {actual}; refusing to patch."
        )

for old, new in replacements.items():
    text = text.replace(old, new)

path.write_text(text, encoding="utf-8")
