from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            if (\n                normalized === "+/-5"\n            ) {\n                return {\n                    type: "rolling-offset",\n                    value: 5\n                };\n            }'''
new = '''            const rollingOffsetMatch =\n                normalized.match(\n                    /^\\+\\/-(\\d+(?:\\.\\d+)?)$/\n                );\n\n            if (rollingOffsetMatch) {\n                const value =\n                    Number(\n                        rollingOffsetMatch[1]\n                    );\n\n                if (\n                    Number.isFinite(value) &&\n                    value > 0\n                ) {\n                    return {\n                        type: "rolling-offset",\n                        value\n                    };\n                }\n            }'''

if text.count(old) != 1:
    raise SystemExit(f'rolling offset parser anchor count: {text.count(old)}')
text = text.replace(old, new, 1)

old = '''                for (\n                    let offset = -mode.value;\n                    offset <= mode.value;\n                    offset++\n                ) {'''
new = '''                const wholeSecondRadius =\n                    Math.floor(\n                        mode.value\n                    );\n\n                for (\n                    let offset = -wholeSecondRadius;\n                    offset <= wholeSecondRadius;\n                    offset++\n                ) {'''

if text.count(old) != 1:
    raise SystemExit(f'rolling offset loop anchor count: {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text)
