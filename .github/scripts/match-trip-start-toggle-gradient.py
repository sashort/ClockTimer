from pathlib import Path

path = Path('app.css')
text = path.read_text()
old = '    background: linear-gradient(145deg, #70ceff 0%, #35abef 52%, #1687d7 100%);\n'
new = '    background: var(--ui-blue-gradient);\n'
if old not in text:
    raise SystemExit('trip start toggle gradient not found')
text = text.replace(old, new, 1)
path.write_text(text)
