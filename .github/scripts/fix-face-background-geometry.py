from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            const inset = Number(this.#borderRing.renderedInset);\n            const width = Number(this.#borderRing.renderedWidth);\n'''
new='''            const inset = Number.parseFloat(\n                this.#borderRing.renderedInset\n            );\n\n            const width = Number.parseFloat(\n                this.#borderRing.renderedWidth\n            );\n'''
if old not in s:
    raise SystemExit('face background geometry conversion block not found')
s=s.replace(old,new,1)
p.write_text(s)
