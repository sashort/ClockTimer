from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()
old = '''                    box-sizing:\n                        border-box;\n\n                    overflow:\n                        hidden;'''
new = '''                    box-sizing:\n                        border-box;\n\n                    padding:\n                        1px;\n\n                    overflow:\n                        hidden;'''
if old not in text:
    raise SystemExit("ClockTimer host box-sizing block not found")
text = text.replace(old, new, 1)
path.write_text(text)
