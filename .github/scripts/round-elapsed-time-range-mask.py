from pathlib import Path
p = Path('TimeRange.js')
s = p.read_text()
old = '''        const staticRange =\n            this.getAttribute("type") !==\n                "elapsed";\n\n        if (staticRange) {\n            const renderedRingWidth =\n'''
new = '''        {\n            const renderedRingWidth =\n'''
if old not in s:
    raise SystemExit('target block not found')
s = s.replace(old, new, 1)
p.write_text(s)
