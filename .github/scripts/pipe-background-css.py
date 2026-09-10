from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

# Remove the temporary HTML attribute API.
text = text.replace(',\n            "background-color"\n        ];', '\n        ];')
text = text.replace('            this.#captureFaceBackground();\n            this.#syncFaceBackgroundColor();\n', '            this.#captureFaceBackground();\n')
text = text.replace('''\n                case "background-color":\n                    this.#syncFaceBackgroundColor();\n                    break;\n''', '')


def remove_method(source, signature):
    start = source.find(signature)
    if start < 0:
        return source
    brace = source.find('{', start)
    if brace < 0:
        raise RuntimeError(f"No opening brace for {signature}")
    depth = 0
    i = brace
    in_string = None
    escape = False
    while i < len(source):
        ch = source[i]
        if in_string:
            if escape:
                escape = False
            elif ch == '\\\\':
                escape = True
            elif ch == in_string:
                in_string = None
        else:
            if ch in ('\"', "'", '`'):
                in_string = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    while end < len(source) and source[end] in ' \t':
                        end += 1
                    if source[end:end+2] == '\n\n':
                        end += 2
                    elif source[end:end+1] == '\n':
                        end += 1
                    return source[:start] + source[end:]
        i += 1
    raise RuntimeError(f"Unclosed method {signature}")

text = remove_method(text, '        #syncFaceBackgroundColor()')

old_capture = '''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (this.#hostBackgroundOverride) {\n                this.#hostBackgroundOverride.remove();\n                this.#hostBackgroundOverride = undefined;\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            const override =\n                document.createElement("style");\n\n            override.textContent =\n                ":host { background-color: transparent !important; }";\n\n            this.#shadowRoot.appendChild(override);\n            this.#hostBackgroundOverride = override;\n        }\n'''

new_capture = '''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (!this.#hostBackgroundOverride) {\n                const override =\n                    document.createElement("style");\n\n                override.textContent =\n                    ":host { background-color: transparent !important; }";\n\n                this.#shadowRoot.appendChild(override);\n                this.#hostBackgroundOverride = override;\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            const override =\n                this.#hostBackgroundOverride;\n\n            if (override) {\n                override.disabled = true;\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            if (override) {\n                override.disabled = false;\n            }\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n        }\n'''

if old_capture not in text:
    raise RuntimeError("Expected capture method not found")
text = text.replace(old_capture, new_capture, 1)

old_update = '''                this.#syncFaceBackgroundGeometry();\n                this.#faceBackgroundFrame = requestAnimationFrame(update);\n'''
new_update = '''                this.#syncFaceBackgroundFromExternalCSS();\n                this.#syncFaceBackgroundGeometry();\n                this.#faceBackgroundFrame = requestAnimationFrame(update);\n'''
if old_update not in text:
    raise RuntimeError("Face background tracking update not found")
text = text.replace(old_update, new_update, 1)

old_initial = '''            this.#syncFaceBackgroundGeometry();\n            this.#faceBackgroundFrame = requestAnimationFrame(update);\n'''
new_initial = '''            this.#syncFaceBackgroundFromExternalCSS();\n            this.#syncFaceBackgroundGeometry();\n            this.#faceBackgroundFrame = requestAnimationFrame(update);\n'''
if old_initial not in text:
    raise RuntimeError("Face background tracking initial sync not found")
text = text.replace(old_initial, new_initial, 1)

path.write_text(text)
