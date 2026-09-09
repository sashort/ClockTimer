from pathlib import Path

source = Path('.github/scripts/patch_clocktimer_hand_snap_format.py').read_text()
patch_only = source.split('# Static behavioral assertions for the new format grammar.', 1)[0]
exec(compile(patch_only, 'patch_clocktimer_hand_snap_format.py', 'exec'))

text = Path('ClockTimer.js').read_text()
required = [
    'return /^(?:hh:mm(?::ss)?|(?:h|0h):mm',
    'const militaryHour =',
    'format.startsWith(\n                    "0h:"',
    '#getHandTransform(',
    'createKeyframes(\n                        this.#hourHand',
    'createKeyframes(\n                        this.#minuteHand',
    'createKeyframes(\n                        this.#secondHand'
]
for item in required:
    if item not in text:
        raise SystemExit(f'missing expected patched source: {item}')

for forbidden in [
    'hh:mm AM/PM',
    'hh:mm:ss AM/PM'
]:
    if forbidden in text:
        raise SystemExit(f'found forbidden literal in patched source: {forbidden}')
