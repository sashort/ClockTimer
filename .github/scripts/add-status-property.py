from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

old = '''        get originalStandardTime() {\n            return this.#originalStartArguments\n                ?.standardTime;\n        }\n'''

new = '''        get status() {\n            if (!this.#hasStartProperties()) {\n                return \"ready\";\n            }\n\n            if (\n                this.#openEndedRange ||\n                this.#openOverwriteRange\n            ) {\n                return \"open\";\n            }\n\n            return this.#started\n                ? \"running\"\n                : \"stopped\";\n        }\n\n        get originalStandardTime() {\n            return this.#originalStartArguments\n                ?.standardTime;\n        }\n'''

count = s.count(old)
if count != 1:
    raise SystemExit(f'status insertion point: expected 1 match, found {count}')

s = s.replace(old, new, 1)

if 'get status() {' not in s:
    raise SystemExit('status getter missing after patch')

p.write_text(s)
