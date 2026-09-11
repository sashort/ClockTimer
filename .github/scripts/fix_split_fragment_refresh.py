from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

needle = '''                    else if (\n                        segment.parentElement !== ring\n                    ) {\n                        ring.appendChild(\n                            segment\n                        );\n                    }\n'''
replacement = '''                    else if (\n                        segment.parentElement !== ring\n                    ) {\n                        ring.appendChild(\n                            segment\n                        );\n\n                        if (\n                            typeof segment.refreshVisualGeometry ===\n                                "function"\n                        ) {\n                            segment.refreshVisualGeometry();\n                        }\n                    }\n'''

if needle not in text:
    raise SystemExit('target append block not found')

text = text.replace(needle, replacement, 1)
path.write_text(text)
