from pathlib import Path
p = Path('ClockTimer.js')
s = p.read_text()
old = 'type: "early-start",'
new = 'type: "earlystart",'
if old not in s:
    raise SystemExit('early-start planned type not found')
s = s.replace(old, new)
p.write_text(s)
