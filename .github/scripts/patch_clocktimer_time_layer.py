from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")

old_clock_face = '''                #clock-face {\n                    position: absolute;\n\n                    inset: 0;\n\n                    width: 100%;\n                    height: 100%;\n\n                    pointer-events:\n                        none;\n                }'''
new_clock_face = '''                #clock-face {\n                    position: absolute;\n\n                    inset: 0;\n\n                    width: 100%;\n                    height: 100%;\n\n                    isolation:\n                        isolate;\n\n                    pointer-events:\n                        none;\n                }'''

old_rings = '''                    z-index: 10;\n\n                    pointer-events:\n                        none;'''
new_rings = '''                    z-index: 0;\n\n                    isolation:\n                        isolate;\n\n                    pointer-events:\n                        none;'''

old_time = '''                    z-index: 40;\n\n                    pointer-events:\n                        none;'''
new_time = '''                    z-index: 100;\n\n                    pointer-events:\n                        none;'''

for old, new, label in [
    (old_clock_face, new_clock_face, "clock-face stacking context"),
    (old_rings, new_rings, "rings stacking context"),
    (old_time, new_time, "time z-index"),
]:
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
