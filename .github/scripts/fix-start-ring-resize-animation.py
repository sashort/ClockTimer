from pathlib import Path

path = Path("RingContainer.js")
text = path.read_text()
old = '''        this.#sizeObserver =\n            new ResizeObserver(\n                () => {\n                    this.#updateProperties(\n                        false\n                    );\n\n                    this.#updateAutomaticFollowingRings(\n                        false\n                    );\n\n                    this.#refreshChildVisualGeometry();\n                }\n            );\n'''
new = '''        this.#sizeObserver =\n            new ResizeObserver(\n                () => {\n                    if (\n                        this.#animationPhase !==\n                            "idle"\n                    ) {\n                        this.#refreshChildVisualGeometry();\n                        return;\n                    }\n\n                    this.#updateProperties(\n                        false\n                    );\n\n                    this.#updateAutomaticFollowingRings(\n                        false\n                    );\n\n                    this.#refreshChildVisualGeometry();\n                }\n            );\n'''
if old not in text:
    raise SystemExit("ResizeObserver block not found")
text = text.replace(old, new, 1)
path.write_text(text)
