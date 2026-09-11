from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''        stop(stopTime) {\n            const parsedStop =\n                stopTime === undefined\n                    ? this.#dateToStandardTime(\n                        new Date()\n                    )\n                    : stopTime;\n\n            const parsed =\n                this.#validateClockTime(\n                    parsedStop,\n                    "stopTime"\n                );'''
new='''        stop(\n            stopTime = this.#dateToStandardTime(\n                new Date()\n            )\n        ) {\n            const parsed =\n                this.#validateClockTime(\n                    stopTime,\n                    "stopTime"\n                );'''
assert old in s
s=s.replace(old,new,1)
p.write_text(s)
