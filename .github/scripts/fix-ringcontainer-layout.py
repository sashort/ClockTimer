from pathlib import Path

path = Path('RingContainer.js')
text = path.read_text()

old = '''    #outerMargin;\n    #innerMargin;\n    #instanceFilter;'''
new = '''    #outerMargin;\n    #innerMargin;\n    #layoutInsetTarget;\n    #instanceFilter;'''
assert old in text
text = text.replace(old, new, 1)

old = '''            if (\n                ring.getAttribute(\n                    "inset"\n                ) !==\n                    targetInset\n            ) {\n                const current =\n                    ring.#getGeometry();'''
new = '''            const currentInset =\n                ring.#layoutInsetTarget ??\n                ring.getAttribute(\n                    "inset"\n                );\n\n            if (\n                currentInset !==\n                    targetInset\n            ) {\n                const current =\n                    ring.#getGeometry();'''
assert old in text
text = text.replace(old, new, 1)

old = '''                ring.#animateResize(\n                    current,\n                    target,\n                    {\n                        commitAttributes: true\n                    }\n                );'''
new = '''                ring.#layoutInsetTarget =\n                    targetInset;\n\n                ring.#animateResize(\n                    current,\n                    target,\n                    {\n                        commitAttributes: true\n                    }\n                );'''
assert old in text
text = text.replace(old, new, 1)

old = '''            ::slotted(*) {\n                pointer-events:\n                    none;\n            }'''
new = '''            ::slotted(time-range) {\n                position: absolute;\n\n                inset: 0;\n\n                display: block;\n\n                width: 100%;\n                height: 100%;\n\n                box-sizing:\n                    border-box;\n            }\n\n            ::slotted(*) {\n                pointer-events:\n                    none;\n            }'''
assert old in text
text = text.replace(old, new, 1)

old = '''        this.#resizeAnimation =\n            this.animate(\n                [\n                    {\n                        opacity: 1\n                    },\n                    {\n                        opacity: 1\n                    }\n                ],\n                {\n                    duration,\n                    easing,\n                    fill: "both"\n                }\n            );\n\n        if (\n            this.filterRamp'''
new = '''        this.#resizeAnimation =\n            this.animate(\n                [\n                    {\n                        opacity: 1\n                    },\n                    {\n                        opacity: 1\n                    }\n                ],\n                {\n                    duration,\n                    easing,\n                    fill: "both"\n                }\n            );\n\n        const resizeAnimation =\n            this.#resizeAnimation;\n\n        if (\n            this.filterRamp'''
assert old in text
text = text.replace(old, new, 1)

old = '''        this.#pendingResize =\n            this.#resizeAnimation.finished\n                .catch(() => {})\n                .finally(\n                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            commitAttributes\n                        ) {'''
new = '''        this.#pendingResize =\n            resizeAnimation.finished\n                .catch(() => {})\n                .finally(\n                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            this.#resizeAnimation !==\n                                resizeAnimation\n                        ) {\n                            return;\n                        }\n\n                        if (\n                            commitAttributes\n                        ) {'''
assert old in text
text = text.replace(old, new, 1)

old = '''                        this.#updateStyle(\n                            targetGeometry\n                        );\n\n                        this.#resizeAnimation =\n                            undefined;'''
new = '''                        this.#updateStyle(\n                            targetGeometry\n                        );\n\n                        if (\n                            this.#layoutInsetTarget ===\n                                targetGeometry.inset\n                        ) {\n                            this.#layoutInsetTarget =\n                                undefined;\n                        }\n\n                        this.#resizeAnimation =\n                            undefined;'''
assert old in text
text = text.replace(old, new, 1)

path.write_text(text)
