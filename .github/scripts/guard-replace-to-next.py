from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
needle='''        replaceToNext(\n            type\n        ) {\n            if (\n                this.#updatesSuspended &&'''
replacement='''        replaceToNext(\n            type\n        ) {\n            if (!this.#hasStartProperties()) {\n                throw new Error(\n                    "replaceToNext() cannot be called before start() or after clear()."\n                );\n            }\n\n            if (\n                this.#updatesSuspended &&'''
if needle not in s:
    raise SystemExit('replaceToNext anchor not found')
s=s.replace(needle,replacement,1)
p.write_text(s)
