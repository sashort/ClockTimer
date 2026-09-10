from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

text = text.replace(
'''    #contourLayer;\n    #elapsedBaseLayer;\n    #elapsedWaveLayer;''',
'''    #contourLayer;\n    #elapsedBaseLayer;\n    #elapsedEdgeLayer;\n    #elapsedWaveLayer;'''
)

text = text.replace(
'''            #elapsed-base,\n            #elapsed-wave {\n                position: absolute;\n                inset: 0;\n                display: none;\n                pointer-events: none;\n                background-repeat: no-repeat;\n            }''',
'''            #elapsed-base,\n            #elapsed-edge,\n            #elapsed-wave {\n                position: absolute;\n                inset: 0;\n                display: none;\n                pointer-events: none;\n                background-repeat: no-repeat;\n            }'''
)

text = text.replace(
'''            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }''',
'''            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-edge,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }'''
)

text = text.replace(
'''        this.#elapsedWaveLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedWaveLayer.id =\n            "elapsed-wave";''',
'''        this.#elapsedEdgeLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedEdgeLayer.id =\n            "elapsed-edge";\n\n        this.#elapsedWaveLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedWaveLayer.id =\n            "elapsed-wave";'''
)

text = text.replace(
'''            this.#contourLayer,\n            this.#elapsedBaseLayer,\n            this.#elapsedWaveLayer''',
'''            this.#contourLayer,\n            this.#elapsedBaseLayer,\n            this.#elapsedEdgeLayer,\n            this.#elapsedWaveLayer'''
)

text = text.replace(
'''            !this.#elapsedBaseLayer ||\n            !this.#elapsedWaveLayer''',
'''            !this.#elapsedBaseLayer ||\n            !this.#elapsedEdgeLayer ||\n            !this.#elapsedWaveLayer'''
)

text = text.replace(
'''            this.#elapsedBaseLayer.style.background =\n                "transparent";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";''',
'''            this.#elapsedBaseLayer.style.background =\n                "transparent";\n\n            this.#elapsedEdgeLayer.style.backgroundImage =\n                "none";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";'''
)

text = text.replace(
'''        const baseStrength =\n            Math.min(\n                0.16,\n                Math.max(\n                    0.08,\n                    0.09 +\n                        contrastRange * 0.04 +\n                        (1 - strongestOpacity) * 0.03\n                )\n            );''',
'''        const baseStrength =\n            Math.min(\n                0.18,\n                Math.max(\n                    0.12,\n                    0.13 +\n                        contrastRange * 0.03 +\n                        (1 - strongestOpacity) * 0.03\n                )\n            );\n\n        const edgeStrength =\n            Math.min(\n                0.25,\n                Math.max(\n                    0.15,\n                    0.17 +\n                        contrastRange * 0.04 +\n                        (1 - strongestOpacity) * 0.04\n                )\n            );'''
)

text = text.replace(
'''        this.#elapsedBaseLayer.style.background =\n            `rgba(255, 255, 255, ${baseStrength.toFixed(3)})`;\n\n        const shoulder =''',
'''        this.#elapsedBaseLayer.style.background =\n            `rgba(255, 255, 255, ${baseStrength.toFixed(3)})`;\n\n        this.#elapsedEdgeLayer.style.mixBlendMode =\n            "screen";\n\n        this.#elapsedEdgeLayer.style.setProperty(\n            "--elapsed-edge-strength",\n            edgeStrength.toFixed(3)\n        );\n\n        const shoulder ='''
)

text = text.replace(
'''        this.#contourLayer.style.backgroundImage =\n            `radial-gradient(circle at center, ` +\n            `rgba(0, 0, 0, 0.28) ${innerRadius}px, ` +\n            `rgba(255, 255, 255, 0.34) ${centerRadius}px, ` +\n            `rgba(0, 0, 0, 0.22) ${outerRadius}px)`;''',
'''        this.#contourLayer.style.backgroundImage =\n            `radial-gradient(circle at center, ` +\n            `rgba(0, 0, 0, 0.28) ${innerRadius}px, ` +\n            `rgba(255, 255, 255, 0.34) ${centerRadius}px, ` +\n            `rgba(0, 0, 0, 0.22) ${outerRadius}px)`;\n\n        if (this.#elapsedEdgeLayer) {\n            const edge =\n                2;\n\n            this.#elapsedEdgeLayer.style.backgroundImage =\n                `radial-gradient(circle at center, ` +\n                `transparent ${Math.max(0, innerRadius - edge)}px, ` +\n                `rgb(255 255 255 / var(--elapsed-edge-strength, 0.18)) ${innerRadius}px, ` +\n                `transparent ${innerRadius + edge}px, ` +\n                `transparent ${Math.max(innerRadius + edge, outerRadius - edge)}px, ` +\n                `rgb(255 255 255 / var(--elapsed-edge-strength, 0.18)) ${outerRadius}px, ` +\n                `transparent ${outerRadius + edge}px)`;\n        }'''
)

path.write_text(text)
