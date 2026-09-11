from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                finally {\n                    this.#starting =\n                        false;\n                }\n\n                this.#originalStartArguments =\n'''
new='''                finally {\n                    this.#starting =\n                        false;\n                }\n\n                for (const ring of this.#rings.values()) {\n                    const targetWidth =\n                        ring.clockTimerTargetWidth;\n\n                    if (targetWidth) {\n                        ring.setAttribute(\n                            "width",\n                            targetWidth\n                        );\n\n                        delete ring.clockTimerTargetWidth;\n                    }\n                }\n\n                this.#refreshRingLayout(\n                    terminal,\n                    {\n                        refreshTickMarks: true\n                    }\n                );\n\n                this.#originalStartArguments =\n'''
if old not in s:
    raise SystemExit('fromJSON finally anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
