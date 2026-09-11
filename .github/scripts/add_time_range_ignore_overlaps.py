from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old = '''    #removeOverlaps() {\n        if (\n            this.hasAttribute(\n                "overlapping"\n            )\n        ) {\n            return;\n        }\n'''

new = '''    #removeOverlaps() {\n        if (\n            this.hasAttribute(\n                "ignore-overlaps"\n            )\n        ) {\n            this.removeAttribute(\n                "ignore-overlaps"\n            );\n\n            return;\n        }\n\n        if (\n            this.hasAttribute(\n                "overlapping"\n            )\n        ) {\n            return;\n        }\n'''

if old not in text:
    raise SystemExit('removeOverlaps opening block not found')

text = text.replace(old, new, 1)
path.write_text(text)
