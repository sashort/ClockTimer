from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            const ringStart = this.#getRingStart(ringIndex);\n            const angle = ((end - ringStart) / ClockTimer.#HOUR) * 360;\n            const normalizedAngle = (angle % 360 + 360) % 360;\n            const inset = ring.renderedInset ?? ring.inset ?? "0px";\n'''
new='''            const millisecondsIntoHour =\n                (\n                    end % ClockTimer.#HOUR +\n                    ClockTimer.#HOUR\n                ) % ClockTimer.#HOUR;\n\n            const normalizedAngle =\n                (\n                    millisecondsIntoHour /\n                    ClockTimer.#HOUR\n                ) * 360;\n\n            const inset = ring.renderedInset ?? ring.inset ?? "0px";\n'''
if old not in s:
    raise SystemExit('indicator angle anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
