from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            this.#extendCalculatedEndTime(\n                nextStart - now,\n                nextRange.getAttribute(\n                    "type"\n                )\n            );\n\n            this.#setRangeStart(\n                nextRange,\n                now\n            );'''
new='''            this.#extendCalculatedEndTime(\n                nextStart - now,\n                nextRange.getAttribute(\n                    "type"\n                )\n            );\n\n            nextRange.removeAttribute(\n                "overwrite"\n            );\n\n            this.#setRangeStart(\n                nextRange,\n                now\n            );'''
assert old in s
s=s.replace(old,new,1)
old2='''            this.#setRangeEnd(\n                currentRange,\n                now\n            );\n\n            const replacementType =\n                type.trim();'''
new2='''            currentRange.removeAttribute(\n                "overwrite"\n            );\n\n            this.#setRangeEnd(\n                currentRange,\n                now\n            );\n\n            const replacementType =\n                type.trim();'''
assert old2 in s
s=s.replace(old2,new2,1)
p.write_text(s)
