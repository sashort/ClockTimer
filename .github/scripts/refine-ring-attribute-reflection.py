from pathlib import Path

path = Path('RingContainer.js')
text = path.read_text()

old = '''            if (\n                original === undefined ||\n                !RingContainer.#isFixedLength(\n                    original\n                )\n            ) {\n                this.removeAttribute(\n                    name\n                );\n            }\n            else {\n                this.setAttribute(\n                    name,\n                    original\n                );\n            }\n'''
new = '''            if (\n                original === undefined\n            ) {\n                this.removeAttribute(\n                    name\n                );\n            }\n            else {\n                this.setAttribute(\n                    name,\n                    RingContainer.#isFixedLength(\n                        original\n                    )\n                        ? original\n                        : "calculated"\n                );\n            }\n'''
if old not in text:
    raise SystemExit('current setter reflection block not found')
text = text.replace(old, new, 1)

old = '''                if (\n                    !RingContainer.#isFixedLength(\n                        original\n                    )\n                ) {\n                    if (\n                        this.hasAttribute(\n                            name\n                        )\n                    ) {\n                        this.removeAttribute(\n                            name\n                        );\n                    }\n\n                    continue;\n                }\n\n                if (\n                    this.getAttribute(name) !==\n                        original\n                ) {\n                    this.setAttribute(\n                        name,\n                        original\n                    );\n                }\n'''
new = '''                const reflected =\n                    RingContainer.#isFixedLength(\n                        original\n                    )\n                        ? original\n                        : "calculated";\n\n                if (\n                    this.getAttribute(name) !==\n                        reflected\n                ) {\n                    this.setAttribute(\n                        name,\n                        reflected\n                    );\n                }\n'''
if old not in text:
    raise SystemExit('current refresh reflection block not found')
text = text.replace(old, new, 1)

path.write_text(text)
