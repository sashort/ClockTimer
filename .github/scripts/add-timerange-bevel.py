from pathlib import Path
p=Path('TimeRange.js')
s=p.read_text()
old='''        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.appendChild(\n            this.#styleElement\n        );'''
new='''        const bevelStyle =\n            document.createElement(\n                "style"\n            );\n\n        bevelStyle.textContent = `\n            :host:not([overlapping]) {\n                filter:\n                    drop-shadow(\n                        -0.75px -0.75px 0\n                        rgba(255, 255, 255, 0.55)\n                    )\n                    drop-shadow(\n                        0.75px 0.75px 0\n                        rgba(0, 0, 0, 0.35)\n                    );\n            }\n\n            :host([overlapping]) {\n                filter: none;\n            }\n        `;\n\n        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.append(\n            bevelStyle,\n            this.#styleElement\n        );'''
if old not in s: raise SystemExit('constructor style block not found')
s=s.replace(old,new,1)
p.write_text(s)
