from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

text = text.replace(
'''    #contourLayer;\n    #elapsedWaveLayer;\n''',
'''    #contourLayer;\n    #elapsedBaseLayer;\n    #elapsedWaveLayer;\n''',
1
)

text = text.replace(
'''            #elapsed-wave {\n                position: absolute;\n                inset: 0;\n                display: none;\n                pointer-events: none;\n                transform-origin: 50% 50%;\n                background-repeat: no-repeat;\n                will-change: transform;\n            }\n\n            :host([type="elapsed"]) {\n''',
'''            #elapsed-base,\n            #elapsed-wave {\n                position: absolute;\n                inset: 0;\n                display: none;\n                pointer-events: none;\n                background-repeat: no-repeat;\n            }\n\n            #elapsed-wave {\n                transform-origin: 50% 50%;\n                will-change: transform;\n            }\n\n            :host([type="elapsed"]) {\n''',
1
)

text = text.replace(
'''            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n                animation: elapsed-wave-sweep 4.5s linear infinite;\n            }\n''',
'''            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }\n\n            :host([type="elapsed"]) #elapsed-wave {\n                animation: elapsed-wave-sweep 4.5s linear infinite;\n            }\n''',
1
)

text = text.replace(
'''        this.#elapsedWaveLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedWaveLayer.id =\n            "elapsed-wave";\n''',
'''        this.#elapsedBaseLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedBaseLayer.id =\n            "elapsed-base";\n\n        this.#elapsedWaveLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedWaveLayer.id =\n            "elapsed-wave";\n''',
1
)

text = text.replace(
'''            this.#styleElement,\n            this.#contourLayer,\n            this.#elapsedWaveLayer\n''',
'''            this.#styleElement,\n            this.#contourLayer,\n            this.#elapsedBaseLayer,\n            this.#elapsedWaveLayer\n''',
1
)

text = text.replace(
'''        if (!this.#elapsedWaveLayer) {\n            return;\n        }\n''',
'''        if (\n            !this.#elapsedBaseLayer ||\n            !this.#elapsedWaveLayer\n        ) {\n            return;\n        }\n''',
1
)

text = text.replace(
'''            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";\n\n            return;\n''',
'''            this.#elapsedBaseLayer.style.background =\n                "transparent";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";\n\n            return;\n''',
1
)

anchor = '''        strength =\n            Math.min(\n                0.82,\n                Math.max(\n                    0.46,\n                    strength\n                )\n            );\n\n        const shoulder =\n'''
replacement = '''        strength =\n            Math.min(\n                0.82,\n                Math.max(\n                    0.46,\n                    strength\n                )\n            );\n\n        const baseStrength =\n            Math.min(\n                0.16,\n                Math.max(\n                    0.08,\n                    0.09 +\n                        contrastRange * 0.04 +\n                        (1 - strongestOpacity) * 0.03\n                )\n            );\n\n        this.#elapsedBaseLayer.style.mixBlendMode =\n            "screen";\n\n        this.#elapsedBaseLayer.style.background =\n            `rgba(255, 255, 255, ${baseStrength.toFixed(3)})`;\n\n        const shoulder =\n'''
if anchor not in text:
    raise SystemExit('strength anchor not found')
text = text.replace(anchor, replacement, 1)

path.write_text(text)
