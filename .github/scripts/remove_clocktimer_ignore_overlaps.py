from pathlib import Path
import re

path = Path('ClockTimer.js')
text = path.read_text()
pattern = re.compile(r'''\n\s*[A-Za-z_$][\w$]*\.setAttribute\(\n\s*"ignore-overlaps",\n\s*""\n\s*\);''')
text, count = pattern.subn('', text)
if count == 0:
    raise SystemExit('no ClockTimer ignore-overlaps setters found')
if 'ignore-overlaps' in text:
    raise SystemExit('ClockTimer.js still contains ignore-overlaps')
path.write_text(text)
print(f'removed {count} ClockTimer ignore-overlaps setters')
