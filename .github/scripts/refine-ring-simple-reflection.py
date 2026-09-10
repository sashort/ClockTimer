from pathlib import Path

path = Path('RingContainer.js')
text = path.read_text()

text = text.replace(
'''                    RingContainer.#isFixedLength(\n                        original\n                    )\n                        ? original\n                        : "calculated"''',
'''                    RingContainer.#isSimpleLength(\n                        original\n                    )\n                        ? original\n                        : "calculated"'''
)

old = '''    static #isFixedLength(\n        value\n    ) {\n        if (\n            value === undefined ||\n            value === null\n        ) {\n            return false;\n        }\n\n        return /^[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:px|in|cm)$/i\n            .test(\n                String(value).trim()\n            );\n    }\n'''

new = '''    static #isSimpleLength(\n        value\n    ) {\n        if (\n            value === undefined ||\n            value === null\n        ) {\n            return false;\n        }\n\n        const length =\n            String(value).trim();\n\n        if (!length) {\n            return false;\n        }\n\n        let remaining =\n            length.replace(\n                /var\\(\\s*--[A-Za-z0-9_-]+(?:\\s*,[^()]*)?\\s*\\)/g,\n                \"\"\n            );\n\n        return !/[()\\[\\]{}+*\\/]/.test(\n            remaining\n        ) &&\n            !/(?:^|\\s)-(?:\\s|$)/.test(\n                remaining\n            );\n    }\n'''

if old not in text:
    raise SystemExit('isFixedLength block not found')
text = text.replace(old, new, 1)

# The resize refresh path must use the same simple-vs-calculated classification.
text = text.replace(
'''                    RingContainer.#isFixedLength(\n                        original\n                    )\n                        ? original\n                        : "calculated"''',
'''                    RingContainer.#isSimpleLength(\n                        original\n                    )\n                        ? original\n                        : "calculated"'''
)

if '#isFixedLength' in text:
    raise SystemExit('stale isFixedLength reference remains')

path.write_text(text)
