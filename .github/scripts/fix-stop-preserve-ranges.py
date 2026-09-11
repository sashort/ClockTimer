from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            for (const item of ranges) {\n                if (\n                    item.range ===\n                        current?.range\n                ) {\n                    continue;\n                }\n\n                if (\n                    item.start >= stopTime\n                ) {\n                    item.range.remove();\n                }\n            }\n\n'''
if old not in s:
    raise SystemExit('stop removal loop not found')
s=s.replace(old,'',1)
p.write_text(s)
