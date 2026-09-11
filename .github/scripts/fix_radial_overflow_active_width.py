from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()

old = '''                const width =
                    active
                        ?
                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"
                        :
                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";'''

new = '''                const width =
                    active
                        ?
                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))"
                        :
                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))";'''

count = source.count(old)
if count != 1:
    raise RuntimeError(f"expected one active/inactive width block, found {count}")

path.write_text(source.replace(old, new, 1))
