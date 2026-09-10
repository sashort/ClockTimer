from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

text = text.replace(
'''        #hostBackgroundOverride;\n''',
'''        #hostBackgroundOverride =\n            false;\n\n        #hostBackgroundInlineValue =\n            \"\";\n\n        #hostBackgroundInlinePriority =\n            \"\";\n''',
1
)

old = '''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (!this.#hostBackgroundOverride) {\n                const override =\n                    document.createElement(\"style\");\n\n                override.textContent =\n                    \":host { background-color: transparent !important; }\";\n\n                this.#shadowRoot.appendChild(override);\n                this.#hostBackgroundOverride = override;\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            const override =\n                this.#hostBackgroundOverride;\n\n            if (override) {\n                override.disabled = true;\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            if (override) {\n                override.disabled = false;\n            }\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n        }\n'''

new = '''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (!this.#hostBackgroundOverride) {\n                this.#hostBackgroundInlineValue =\n                    this.style.getPropertyValue(\n                        \"background-color\"\n                    );\n\n                this.#hostBackgroundInlinePriority =\n                    this.style.getPropertyPriority(\n                        \"background-color\"\n                    );\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (this.#hostBackgroundOverride) {\n                this.style.removeProperty(\n                    \"background-color\"\n                );\n\n                if (this.#hostBackgroundInlineValue) {\n                    this.style.setProperty(\n                        \"background-color\",\n                        this.#hostBackgroundInlineValue,\n                        this.#hostBackgroundInlinePriority\n                    );\n                }\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            this.style.setProperty(\n                \"background-color\",\n                \"transparent\",\n                \"important\"\n            );\n\n            this.#hostBackgroundOverride =\n                true;\n        }\n'''

if old not in text:
    raise SystemExit('background capture block not found')
text = text.replace(old, new, 1)

old_stop = '''            if (this.#hostBackgroundOverride) {\n                this.#hostBackgroundOverride.remove();\n                this.#hostBackgroundOverride = undefined;\n            }\n'''
new_stop = '''            if (this.#hostBackgroundOverride) {\n                this.style.removeProperty(\n                    \"background-color\"\n                );\n\n                if (this.#hostBackgroundInlineValue) {\n                    this.style.setProperty(\n                        \"background-color\",\n                        this.#hostBackgroundInlineValue,\n                        this.#hostBackgroundInlinePriority\n                    );\n                }\n\n                this.#hostBackgroundOverride =\n                    false;\n            }\n'''
if old_stop not in text:
    raise SystemExit('background stop block not found')
text = text.replace(old_stop, new_stop, 1)

path.write_text(text)
