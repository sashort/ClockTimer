from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old = '''        const parent =\n            this.parentElement;\n\n        let darkestLuminance = 1;'''
new = '''        const parent =\n            this.parentElement;\n\n        const activeRing =\n            parent?.hasAttribute(\n                "active"\n            ) === true;\n\n        let darkestLuminance = 1;'''
if old not in text:
    raise SystemExit('parent anchor not found')
text = text.replace(old, new, 1)

old = '''        const baseStrength =\n            Math.min(\n                0.18,\n                Math.max(\n                    0.12,\n                    0.13 +\n                        contrastRange * 0.03 +\n                        (1 - strongestOpacity) * 0.03\n                )\n            );\n\n        const edgeStrength =\n            Math.min(\n                0.25,\n                Math.max(\n                    0.15,\n                    0.17 +\n                        contrastRange * 0.04 +\n                        (1 - strongestOpacity) * 0.04\n                )\n            );'''
new = '''        const baseStrength =\n            activeRing\n                ? Math.min(\n                    0.34,\n                    Math.max(\n                        0.24,\n                        0.26 +\n                            contrastRange * 0.05 +\n                            (1 - strongestOpacity) * 0.04\n                    )\n                )\n                : Math.min(\n                    0.18,\n                    Math.max(\n                        0.12,\n                        0.13 +\n                            contrastRange * 0.03 +\n                            (1 - strongestOpacity) * 0.03\n                    )\n                );\n\n        const edgeStrength =\n            activeRing\n                ? Math.min(\n                    0.48,\n                    Math.max(\n                        0.34,\n                        0.37 +\n                            contrastRange * 0.06 +\n                            (1 - strongestOpacity) * 0.05\n                    )\n                )\n                : Math.min(\n                    0.25,\n                    Math.max(\n                        0.15,\n                        0.17 +\n                            contrastRange * 0.04 +\n                            (1 - strongestOpacity) * 0.04\n                    )\n                );'''
if old not in text:
    raise SystemExit('strength block not found')
text = text.replace(old, new, 1)

old = '''        this.#elapsedEdgeLayer.style.setProperty(\n            "--elapsed-edge-strength",\n            edgeStrength.toFixed(3)\n        );\n\n        const shoulder =\n            strength * 0.38;'''
new = '''        this.#elapsedEdgeLayer.style.setProperty(\n            "--elapsed-edge-strength",\n            edgeStrength.toFixed(3)\n        );\n\n        if (!activeRing) {\n            this.#elapsedWaveLayer.style.animation =\n                "none";\n\n            this.#elapsedWaveLayer.style.opacity =\n                "0";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";\n\n            return;\n        }\n\n        this.#elapsedWaveLayer.style.removeProperty(\n            "animation"\n        );\n\n        this.#elapsedWaveLayer.style.removeProperty(\n            "opacity"\n        );\n\n        const shoulder =\n            strength * 0.38;'''
if old not in text:
    raise SystemExit('wave gate anchor not found')
text = text.replace(old, new, 1)

path.write_text(text)
