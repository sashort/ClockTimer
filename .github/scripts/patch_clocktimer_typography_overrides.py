from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            numberLayer.style.zIndex =\n                "20";\n\n            ring.appendChild(\n'''
new = '''            numberLayer.style.zIndex =\n                "20";\n\n            numberLayer.style.fontFamily =\n                "var(--clock-timer-hour-font, inherit)";\n\n            numberLayer.style.fontSize =\n                "var(--clock-timer-hour-font-size, var(--clock-timer-auto-hour-font-size, 1rem))";\n\n            ring.appendChild(\n'''
if old not in text:
    raise SystemExit('number layer insertion point not found')
text = text.replace(old, new, 1)

old = '''                element.style.fontFamily =\n                    "var(--clock-timer-hour-font, inherit)";\n\n                element.style.fontSize =\n                    "var(--clock-timer-hour-font-size, var(--clock-timer-auto-hour-font-size, 1rem))";\n\n'''
if old not in text:
    raise SystemExit('hour inline typography block not found')
text = text.replace(old, '', 1)

path.write_text(text)
