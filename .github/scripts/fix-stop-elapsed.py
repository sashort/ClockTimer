from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            if (\n                this.#elapsedRange &&\n                this.#elapsedRange.isConnected\n            ) {\n                this.#elapsedRange.setAttribute(\n                    "end-time",\n                    this.#formatTimelineTime(\n                        stopTime\n                    )\n                );\n\n                this.#elapsedRange.clockTimerEnd =\n                    String(stopTime);\n\n                this.#elapsedRange.stopElapsedAnimation\n                    ?.();\n            }\n'''
new='''            for (const elapsedRange of\n                this.querySelectorAll(\n                    'time-range[type="elapsed"]'\n                )) {\n                elapsedRange.stopElapsedAnimation\n                    ?.();\n\n                elapsedRange.remove();\n            }\n\n            this.#elapsedRange =\n                undefined;\n'''
if old not in s: raise SystemExit('stop elapsed anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
