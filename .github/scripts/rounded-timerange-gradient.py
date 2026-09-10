from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()
old = '''        const bevelStyle =\n            document.createElement(\n                "style"\n            );\n\n        bevelStyle.textContent = `\n            :host:not([overlapping]) {\n                filter:\n                    drop-shadow(\n                        -0.75px -0.75px 0\n                        rgba(255, 255, 255, 0.55)\n                    )\n                    drop-shadow(\n                        0.75px 0.75px 0\n                        rgba(0, 0, 0, 0.35)\n                    );\n            }\n\n            :host([overlapping]) {\n                filter: none;\n            }\n        `;\n\n        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.append(\n            bevelStyle,\n            this.#styleElement\n        );'''
new = '''        const contourStyle =\n            document.createElement(\n                "style"\n            );\n\n        contourStyle.textContent = `\n            :host:not([overlapping]) {\n                background-image:\n                    radial-gradient(\n                        circle at center,\n                        rgba(0, 0, 0, 0.22)\n                            calc(50% - var(--time-range-ring-inset) - (var(--time-range-ring-width) / 2)),\n                        rgba(255, 255, 255, 0.30)\n                            calc(50% - var(--time-range-ring-inset)),\n                        rgba(0, 0, 0, 0.20)\n                            calc(50% - var(--time-range-ring-inset) + (var(--time-range-ring-width) / 2))\n                    ) !important;\n            }\n\n            :host([overlapping]) {\n                background-image: none !important;\n            }\n        `;\n\n        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.append(\n            contourStyle,\n            this.#styleElement\n        );'''
if old not in text:
    raise SystemExit('old bevel block not found')
text = text.replace(old, new, 1)

needle = '''        const width =\n            parent.clientWidth;\n\n        const height =\n            parent.clientHeight;'''
replacement = '''        const width =\n            parent.clientWidth;\n\n        const height =\n            parent.clientHeight;\n\n        const ringInset =\n            parent.getAttribute(\n                "inset"\n            );\n\n        const ringWidth =\n            parent.getAttribute(\n                "width"\n            );\n\n        this.style.setProperty(\n            "--time-range-ring-inset",\n            ringInset &&\n                ringInset !== "auto"\n                ? ringInset\n                : "0px"\n        );\n\n        this.style.setProperty(\n            "--time-range-ring-width",\n            ringWidth ||\n                "0px"\n        );'''
if needle not in text:
    raise SystemExit('updateClipPath geometry block not found')
text = text.replace(needle, replacement, 1)
path.write_text(text)
