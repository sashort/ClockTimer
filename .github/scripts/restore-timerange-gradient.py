from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

text = text.replace(
'''    #styleElement;\n    #contourLayer;''',
'''    #styleElement;\n    #geometryStyleElement;\n    #contourLayer;''',
1
)

text = text.replace(
'''        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.append(\n            contourStyle,\n            this.#styleElement,\n            this.#contourLayer\n        );''',
'''        this.#styleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#geometryStyleElement =\n            document.createElement(\n                "style"\n            );\n\n        this.#shadowRoot.append(\n            contourStyle,\n            this.#geometryStyleElement,\n            this.#styleElement,\n            this.#contourLayer\n        );''',
1
)

old = '''        this.#contourLayer.style.setProperty(\n            "--time-range-ring-inset",\n            ringInset &&\n                ringInset !== "auto"\n                ? ringInset\n                : "0px"\n        );\n\n        this.#contourLayer.style.setProperty(\n            "--time-range-ring-width",\n            ringWidth ||\n                "0px"\n        );'''

new = '''        const effectiveRingInset =\n            ringInset &&\n                ringInset !== "auto"\n                ? ringInset\n                : "0px";\n\n        const effectiveRingWidth =\n            ringWidth ||\n                "0px";\n\n        this.#geometryStyleElement.textContent = `\n            :host {\n                --time-range-ring-inset: ${effectiveRingInset};\n                --time-range-ring-width: ${effectiveRingWidth};\n            }\n        `;'''

if old not in text:
    raise SystemExit('target host geometry block not found')
text = text.replace(old, new, 1)

path.write_text(text)
