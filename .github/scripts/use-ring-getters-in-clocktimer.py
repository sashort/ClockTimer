from pathlib import Path
import re

path = Path('ClockTimer.js')
text = path.read_text()

attrs = {
    'width': 'width',
    'inset': 'inset',
    'margin': 'margin',
    'inner-margin': 'innerMargin',
    'outer-margin': 'outerMargin',
}

count = 0
for attr, prop in attrs.items():
    pattern = re.compile(
        rf'(?P<obj>\b(?:[A-Za-z_$][\w$]*[Rr]ing[A-Za-z0-9_$]*|ring))\.getAttribute\(\s*["\']{re.escape(attr)}["\']\s*\)'
    )
    text, n = pattern.subn(lambda m: f'{m.group("obj")}.{prop}', text)
    count += n

if count == 0:
    raise SystemExit('No RingContainer attribute reads were replaced in ClockTimer.js')

remaining = []
for i, line in enumerate(text.splitlines(), 1):
    if re.search(r'\b(?:[A-Za-z_$][\w$]*[Rr]ing[A-Za-z0-9_$]*|ring)\.getAttribute\(\s*["\'](?:width|inset|margin|inner-margin|outer-margin)["\']', line):
        remaining.append(f'{i}: {line.strip()}')

if remaining:
    raise SystemExit('Remaining RingContainer geometry attribute reads:\n' + '\n'.join(remaining))

path.write_text(text)
print(f'Replaced {count} RingContainer geometry attribute read(s) with public getters')
