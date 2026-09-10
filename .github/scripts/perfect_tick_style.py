from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

old_vars = '''                    --clock-timer-tick-inset:\n                        clamp(8px, 4cqi, 20px);\n\n                    --clock-timer-tick-width:\n                        clamp(1px, 0.45cqi, 2px);\n\n                    --clock-timer-tick-length:\n                        clamp(5px, 2.5cqi, 11px);\n\n                    --clock-timer-major-tick-width:\n                        clamp(2px, 0.75cqi, 3px);\n\n                    --clock-timer-major-tick-length:\n                        clamp(9px, 4cqi, 18px);\n\n                    --clock-timer-tick-color:\n                        currentColor;\n\n                    --clock-timer-tick-shadow:\n                        0 0 1px rgb(0 0 0 / 75%),\n                        0 0 2px rgb(0 0 0 / 45%);'''

new_vars = '''                    --clock-timer-tick-inset:\n                        clamp(5px, 2cqi, 10px);\n\n                    --clock-timer-tick-width:\n                        clamp(1px, 0.35cqi, 1.5px);\n\n                    --clock-timer-tick-length:\n                        clamp(4px, 1.6cqi, 7px);\n\n                    --clock-timer-major-tick-width:\n                        clamp(1.5px, 0.55cqi, 2.5px);\n\n                    --clock-timer-major-tick-length:\n                        clamp(8px, 3cqi, 13px);\n\n                    --clock-timer-tick-color:\n                        currentColor;\n\n                    --clock-timer-tick-shadow:\n                        0 0 1px rgb(0 0 0 / 35%);'''

assert s.count(old_vars) == 1, f'expected one tick variable block, found {s.count(old_vars)}'
s = s.replace(old_vars, new_vars, 1)

old_radius = '''                    border-radius:\n                        999px;'''
new_radius = '''                    border-radius:\n                        clamp(0px, 0.15cqi, 1px);'''
assert s.count(old_radius) == 1, f'expected one tick border-radius block, found {s.count(old_radius)}'
s = s.replace(old_radius, new_radius, 1)

p.write_text(s)
