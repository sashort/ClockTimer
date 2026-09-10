from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text()

host_pattern = re.compile(
    r'(\s*:host\s*\{\s*)(--clock-timer-tick-width:)',
    re.S,
)
text, host_count = host_pattern.subn(
    r'\1--clock-timer-tick-inset:\n                        clamp(5px, 2cqi, 10px);\n\n                    \2',
    text,
    count=1,
)
if host_count != 1:
    raise SystemExit(f"Expected one :host tick-width anchor, found {host_count}")

ensure_pattern = re.compile(
    r'(#ensureTickRing\(\)\s*\{.*?ring\.setAttribute\(\s*"width",\s*"0px"\s*\);)',
    re.S,
)
match = ensure_pattern.search(text)
if not match:
    raise SystemExit("Could not locate tick-ring width assignment")

insertion = '''\n\n            ring.setAttribute(\n                "outer-margin",\n                "var(--clock-timer-tick-inset, clamp(5px, 2cqi, 10px))"\n            );'''
text = text[:match.end()] + insertion + text[match.end():]

flush_pattern = re.compile(
    r'if\s*\(\s*ring\s*===\s*this\.#tickRing\s*\)\s*\{\s*return\s+outerInset;\s*\}',
    re.S,
)
if not flush_pattern.search(text):
    raise SystemExit("#getTickInset is not preserving flush visible ticks")

path.write_text(text)
