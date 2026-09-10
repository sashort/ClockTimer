from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")

old = '''                ::slotted(ring-container) {
                    position: absolute;

                    inset: 0;

                    display: block;

                    width: 100%;
                    height: 100%;

                    box-sizing:
                        border-box;

                    pointer-events:
                        none;
                }
'''

new = '''                ::slotted(ring-container) {
                    position: absolute;

                    display: block;

                    box-sizing:
                        border-box;

                    pointer-events:
                        none;
                }
'''

if old not in text:
    raise RuntimeError("Expected ClockTimer slotted ring-container rule was not found")

text = text.replace(old, new, 1)

# Preserve the currently requested active/inactive width behavior exactly.
expected_width_logic = '''                const width =
                    active
                        ?
                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"
                        :
                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";'''
if expected_width_logic not in text:
    raise RuntimeError("Active/inactive width logic changed unexpectedly; refusing to write")

path.write_text(text, encoding="utf-8")
