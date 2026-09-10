from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()
old = '''        return earliest;\n    }\n\n    static #updateParentClipPaths('''
new = '''        if (\n            !(earliest instanceof Date)\n        ) {\n            return undefined;\n        }\n\n        const hourOrigin =\n            new Date(\n                earliest.getTime()\n            );\n\n        hourOrigin.setMinutes(\n            0,\n            0,\n            0\n        );\n\n        return hourOrigin;\n    }\n\n    static #updateParentClipPaths('''
if old not in text:
    raise SystemExit('target block not found')
path.write_text(text.replace(old, new, 1))
