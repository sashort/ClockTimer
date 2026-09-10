from pathlib import Path

path = Path('RingContainer.js')
text = path.read_text()

text = text.replace('''        if (\n            newValue?.trim().toLowerCase() ===\n                "calculated"\n        ) {\n            this.#syncingAttribute =\n                true;\n\n            try {\n                if (oldValue === null) {\n                    this.removeAttribute(name);\n                }\n                else {\n                    this.setAttribute(\n                        name,\n                        oldValue\n                    );\n                }\n            }\n            finally {\n                this.#syncingAttribute =\n                    false;\n            }\n\n            throw new TypeError(\n                `"calculated" is reserved for RingContainer internal attribute reflection and cannot be assigned to ${name}.`\n            );\n        }\n''', '''        if (\n            newValue?.trim().toLowerCase() ===\n                "calculated"\n        ) {\n            this.#syncingAttribute =\n                true;\n\n            try {\n                if (oldValue === null) {\n                    this.removeAttribute(name);\n                }\n                else {\n                    this.setAttribute(\n                        name,\n                        oldValue\n                    );\n                }\n            }\n            finally {\n                this.#syncingAttribute =\n                    false;\n            }\n\n            return;\n        }\n''', 1)

text = text.replace('''            if (\n                original.toLowerCase() ===\n                    "calculated"\n            ) {\n                throw new TypeError(\n                    `"calculated" is reserved for RingContainer internal attribute reflection and cannot be assigned to ${name}.`\n                );\n            }\n\n''', '''            if (\n                original.toLowerCase() ===\n                    "calculated"\n            ) {\n                return;\n            }\n\n''', 1)

old = '''            if (\n                original === undefined\n            ) {\n                this.removeAttribute(\n                    name\n                );\n            }\n            else {\n                this.setAttribute(\n                    name,\n                    this.#getReflectedLengthValue(\n                        original\n                    )\n                );\n            }\n'''
new = '''            if (\n                original === undefined ||\n                !RingContainer.#isFixedLength(\n                    original\n                )\n            ) {\n                this.removeAttribute(\n                    name\n                );\n            }\n            else {\n                this.setAttribute(\n                    name,\n                    original\n                );\n            }\n'''
if old not in text:
    raise SystemExit('setter reflection block not found')
text = text.replace(old, new, 1)

start = text.index('    #getReflectedLengthValue(')
end = text.index('    #afterLengthValueChange()', start)
text = text[:start] + '''    static #isFixedLength(\n        value\n    ) {\n        if (\n            value === undefined ||\n            value === null\n        ) {\n            return false;\n        }\n\n        return /^[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:px|in|cm)$/i\n            .test(\n                String(value).trim()\n            );\n    }\n\n''' + text[end:]

old = '''                const normalized =\n                    this.#getReflectedLengthValue(\n                        original\n                    );\n\n                if (\n                    this.getAttribute(name) !==\n                        normalized\n                ) {\n                    this.setAttribute(\n                        name,\n                        normalized\n                    );\n                }\n'''
new = '''                if (\n                    !RingContainer.#isFixedLength(\n                        original\n                    )\n                ) {\n                    if (\n                        this.hasAttribute(\n                            name\n                        )\n                    ) {\n                        this.removeAttribute(\n                            name\n                        );\n                    }\n\n                    continue;\n                }\n\n                if (\n                    this.getAttribute(name) !==\n                        original\n                ) {\n                    this.setAttribute(\n                        name,\n                        original\n                    );\n                }\n'''
if old not in text:
    raise SystemExit('refresh reflection block not found')
text = text.replace(old, new, 1)

path.write_text(text)
