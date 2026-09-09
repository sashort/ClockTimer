from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''                    width:\n                        max-content;\n\n                    max-width:\n                        100%;\n\n                    background:\n                        transparent;'''
new = '''                    width:\n                        fit-content;\n\n                    height:\n                        fit-content;\n\n                    max-width:\n                        100%;\n\n                    max-height:\n                        100%;\n\n                    place-self:\n                        center;\n\n                    background:\n                        transparent;'''

if old not in text:
    raise SystemExit('expected #time sizing block not found')

text = text.replace(old, new, 1)
path.write_text(text)
