from pathlib import Path

ring_path = Path('RingContainer.js')
time_path = Path('TimeRange.js')

ring = ring_path.read_text()
time = time_path.read_text()

needle = '''    #finishAnimation(\n        expectedToken\n    ) {'''
helper = '''    #refreshChildVisualGeometry() {\n        for (const child of this.children) {\n            if (\n                typeof child.refreshVisualGeometry ===\n                    "function"\n            ) {\n                child.refreshVisualGeometry();\n            }\n        }\n    }\n\n'''
if helper.strip() not in ring:
    ring = ring.replace(needle, helper + needle, 1)

needle2 = '''        this.#setTransition(\n            "--ring-container-inset, --ring-container-width",\n            this.resizeDuration\n        );\n    }\n\n    #cancelAnimation('''
repl2 = '''        this.#setTransition(\n            "--ring-container-inset, --ring-container-width",\n            this.resizeDuration\n        );\n\n        this.#refreshChildVisualGeometry();\n    }\n\n    #cancelAnimation('''
if needle2 not in ring:
    raise SystemExit('RingContainer finishAnimation target not found')
ring = ring.replace(needle2, repl2, 1)

needle3 = '''    removeAnimated({\n        collapseTo = "end",'''
method = '''    refreshVisualGeometry() {\n        this.#updateClipPath();\n\n        return this;\n    }\n\n'''
if method.strip() not in time:
    if needle3 not in time:
        raise SystemExit('TimeRange insertion target not found')
    time = time.replace(needle3, method + needle3, 1)

ring_path.write_text(ring)
time_path.write_text(time)
