from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                    font-size: var(--clock-timer-indicator-symbol-size, 12px);\n                    color: currentColor;\n                    transform: translate(-50%, -100%);\n                    transform-origin: 50% 100%;\n                    pointer-events: none;'''
new='''                    font-size: var(--clock-timer-indicator-symbol-size, 12px);\n                    color: var(--clock-timer-indicator-symbol-color, white);\n                    text-shadow: var(--clock-timer-indicator-symbol-shadow, 0 0 2px rgb(0 0 0 / 50%));\n                    transform: translate(-50%, -50%);\n                    transform-origin: 50% 50%;\n                    pointer-events: none;'''
if old not in s:
    raise SystemExit('anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
