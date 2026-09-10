from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
s=s.replace('''        #hostBackgroundOverride;\n\n''','')
old='''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (!this.#hostBackgroundOverride) {\n                const override =\n                    document.createElement("style");\n\n                override.textContent =\n                    ":host { background-color: transparent !important; }";\n\n                this.#shadowRoot.appendChild(override);\n                this.#hostBackgroundOverride = override;\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            const override =\n                this.#hostBackgroundOverride;\n\n            if (override) {\n                override.disabled = true;\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            if (override) {\n                override.disabled = false;\n            }\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n        }\n'''
new='''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            this.style.removeProperty(\n                "background-color"\n            );\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            this.style.setProperty(\n                "background-color",\n                "transparent",\n                "important"\n            );\n        }\n'''
if old not in s:
    raise SystemExit('capture block not found')
s=s.replace(old,new)
old2='''            if (this.#hostBackgroundOverride) {\n                this.#hostBackgroundOverride.remove();\n                this.#hostBackgroundOverride = undefined;\n            }\n'''
if old2 not in s:
    raise SystemExit('stop override block not found')
s=s.replace(old2,'')
p.write_text(s)
