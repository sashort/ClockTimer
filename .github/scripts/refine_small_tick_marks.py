from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

replacements = {
    'clamp(8px, 4cqi, 20px);': 'clamp(2px, 2cqi, 10px);',
    'clamp(1px, 0.45cqi, 2px);': 'clamp(0.5px, 0.45cqi, 2px);',
    'clamp(2px, 0.75cqi, 3px);': 'clamp(1px, 0.75cqi, 3px);',
}

for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one occurrence of {old!r}, found {count}')
    text = text.replace(old, new, 1)

path.write_text(text)
