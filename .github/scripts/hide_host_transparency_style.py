from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''        #faceBackgroundFrame;\n\n        #hostBackgroundOverride =\n'''
new = '''        #faceBackgroundFrame;\n\n        #hostTransparencyStyle;\n\n        #hostBackgroundOverride =\n'''
if old not in text:
    raise SystemExit("private field insertion point not found")
text = text.replace(old, new, 1)

old = '''            `;\n\n            const clockFace =\n'''
new = '''            `;\n\n            this.#hostTransparencyStyle =\n                document.createElement(\n                    "style"\n                );\n\n            this.#hostTransparencyStyle.textContent =\n                `:host { background-color: transparent !important; }`;\n\n            const clockFace =\n'''
if old not in text:
    raise SystemExit("constructor style insertion point not found")
text = text.replace(old, new, 1)

old = '''            this.#shadowRoot.append(\n                style,\n                clockFace\n            );\n'''
new = '''            this.#shadowRoot.append(\n                style,\n                this.#hostTransparencyStyle,\n                clockFace\n            );\n'''
if old not in text:
    raise SystemExit("shadow append block not found")
text = text.replace(old, new, 1)

old = '''            this.style.removeProperty(\n                "background-color"\n            );\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            this.style.setProperty(\n                "background-color",\n                "transparent",\n                "important"\n            );\n'''
new = '''            const transparencySheet =\n                this.#hostTransparencyStyle\n                    ?.sheet;\n\n            if (transparencySheet) {\n                transparencySheet.disabled =\n                    true;\n            }\n\n            let backgroundColor;\n\n            try {\n                backgroundColor =\n                    getComputedStyle(this)\n                        .backgroundColor;\n            }\n            finally {\n                if (transparencySheet) {\n                    transparencySheet.disabled =\n                        false;\n                }\n            }\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n'''
if old not in text:
    raise SystemExit("inline transparency block not found")
text = text.replace(old, new, 1)

path.write_text(text)
