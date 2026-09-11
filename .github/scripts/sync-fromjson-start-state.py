from pathlib import Path

path=Path('ClockTimer.js')
s=path.read_text()

old='''                this.#calculatedEndTime =\n                    terminal;\n\n                const originalPercentGoal =\n                    this.#percentGoal;\n\n                this.#percentGoal =\n                    1;\n\n                this.#ringAnchor =\n                    creationMilliseconds;\n\n                this.#startedAtEpoch =\n                    creationDate.getTime();'''
new='''                this.#calculatedEndTime =\n                    this.#scheduledStartMilliseconds +\n                    this.#standardDuration;\n\n                const originalPercentGoal =\n                    this.#percentGoal;\n\n                this.#percentGoal =\n                    1;\n\n                this.#ringAnchor =\n                    creationMilliseconds;\n\n                this.#startedAtEpoch =\n                    creationDate.getTime();\n\n                this.#tickAlignmentMilliseconds =\n                    this.#millisecondsComponent(\n                        this.#scheduledStartMilliseconds\n                    );\n\n                this.#setIndicatorSymbolVisible(false);'''
if old not in s:
    raise SystemExit('fromJSON initialization block not found')
s=s.replace(old,new,1)
path.write_text(s)
