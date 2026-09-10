from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''        stop() {\n            const stopTime =\n                new Date();'''
new='''        stop(stopTime) {\n            stopTime =\n                stopTime === undefined\n                    ? new Date()\n                    : this.#uniformDate(\n                        stopTime,\n                        false\n                    );'''
if old not in s:
    raise SystemExit('stop method pattern not found')
s=s.replace(old,new,1)
p.write_text(s)
