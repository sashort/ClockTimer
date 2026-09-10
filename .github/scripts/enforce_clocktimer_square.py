from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()
old = '''                    display: block;\n\n                    box-sizing:\n                        border-box;'''
new = '''                    display: block;\n\n                    inline-size:\n                        min(100cqw, 100cqh);\n\n                    block-size:\n                        min(100cqw, 100cqh);\n\n                    aspect-ratio:\n                        1 / 1;\n\n                    place-self:\n                        center;\n\n                    margin:\n                        auto;\n\n                    box-sizing:\n                        border-box;'''
if old not in text:
    raise SystemExit('ClockTimer host display block marker not found')
text = text.replace(old, new, 1)
path.write_text(text)
