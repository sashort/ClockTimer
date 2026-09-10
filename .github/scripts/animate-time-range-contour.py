from pathlib import Path

ring_path = Path('RingContainer.js')
time_path = Path('TimeRange.js')

ring = ring_path.read_text()
time = time_path.read_text()

# Add a RAF handle for child visual refresh during CSS geometry transitions.
needle = '''    #animationEndRamp = "0ms";\n'''
replacement = '''    #animationEndRamp = "0ms";\n\n    #geometryRefreshFrame;\n'''
if '#geometryRefreshFrame;' not in ring:
    ring = ring.replace(needle, replacement, 1)

# Expose rendered geometry as JS-only properties for child TimeRanges.
needle = '''    static get batchResizing() {\n'''
helper = '''    get renderedInset() {\n        return this.#getRenderedGeometry().inset;\n    }\n\n    get renderedWidth() {\n        return this.#getRenderedGeometry().width;\n    }\n\n'''
if 'get renderedInset()' not in ring:
    ring = ring.replace(needle, helper + needle, 1)

# Continuously refresh child TimeRange visual geometry while ring geometry transitions.
needle = '''    #refreshChildVisualGeometry() {\n        for (const child of this.children) {\n            if (\n                typeof child.refreshVisualGeometry ===\n                    "function"\n            ) {\n                child.refreshVisualGeometry();\n            }\n        }\n    }\n'''
replacement = '''    #refreshChildVisualGeometry() {\n        for (const child of this.children) {\n            if (\n                typeof child.refreshVisualGeometry ===\n                    "function"\n            ) {\n                child.refreshVisualGeometry();\n            }\n        }\n    }\n\n    #startChildGeometryRefresh() {\n        if (\n            this.#geometryRefreshFrame !==\n                undefined\n        ) {\n            cancelAnimationFrame(\n                this.#geometryRefreshFrame\n            );\n        }\n\n        const refresh = () => {\n            if (\n                this.#animationPhase !==\n                    "geometry"\n            ) {\n                this.#geometryRefreshFrame =\n                    undefined;\n\n                return;\n            }\n\n            this.#refreshChildVisualGeometry();\n\n            this.#geometryRefreshFrame =\n                requestAnimationFrame(\n                    refresh\n                );\n        };\n\n        this.#refreshChildVisualGeometry();\n\n        this.#geometryRefreshFrame =\n            requestAnimationFrame(\n                refresh\n            );\n    }\n\n    #stopChildGeometryRefresh() {\n        if (\n            this.#geometryRefreshFrame ===\n                undefined\n        ) {\n            return;\n        }\n\n        cancelAnimationFrame(\n            this.#geometryRefreshFrame\n        );\n\n        this.#geometryRefreshFrame =\n            undefined;\n    }\n'''
if '#startChildGeometryRefresh()' not in ring:
    ring = ring.replace(needle, replacement, 1)

# Start refreshing immediately after the CSS transition target is applied.
needle = '''        this.#container.style.setProperty(\n            "--ring-container-width",\n            this.#animationTargetWidth\n        );\n\n        if (\n            milliseconds <= 0\n        ) {\n'''
replacement = '''        this.#container.style.setProperty(\n            "--ring-container-width",\n            this.#animationTargetWidth\n        );\n\n        this.#startChildGeometryRefresh();\n\n        if (\n            milliseconds <= 0\n        ) {\n'''
if 'this.#startChildGeometryRefresh();' not in ring.split('#startGeometryAnimation()',1)[1].split('#startEndRamp()',1)[0]:
    ring = ring.replace(needle, replacement, 1)

# Stop refresh loops on finish and cancellation.
needle = '''        clearTimeout(\n            this.#phaseTimer\n        );\n\n        ++this.#animationToken;\n\n        this.#animationPhase =\n            "idle";\n'''
replacement = '''        clearTimeout(\n            this.#phaseTimer\n        );\n\n        this.#stopChildGeometryRefresh();\n\n        ++this.#animationToken;\n\n        this.#animationPhase =\n            "idle";\n'''
ring = ring.replace(needle, replacement, 2)

# Use RingContainer's rendered CSS-transition geometry for the contour, with attribute fallbacks.
time = time.replace('''        const ringWidth =\n            this.#resolveLength(\n                parent.getAttribute(\n                    "width"\n                ) ??\n                "0px"\n            );\n\n        const ringInset =\n            this.#resolveLength(\n                this.#getEffectiveRingInset(\n                    parent\n                )\n            );''', '''        const ringWidth =\n            this.#resolveLength(\n                parent.renderedWidth ??\n                parent.getAttribute(\n                    "width"\n                ) ??\n                "0px"\n            );\n\n        const ringInset =\n            this.#resolveLength(\n                parent.renderedInset ??\n                this.#getEffectiveRingInset(\n                    parent\n                )\n            );''')

ring_path.write_text(ring)
time_path.write_text(time)
