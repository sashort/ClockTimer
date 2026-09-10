from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

text = text.replace(
'''        #indicatorHandoffTimeout;\n\n        #tickMarkTimeout;''',
'''        #indicatorHandoffTimeout;\n\n        #ringLayerHandoffTimeout;\n\n        #tickMarkTimeout;''',
1)

text = text.replace(
'''                ::slotted(ring-container) {\n                    position: absolute;\n\n                    display: block;\n\n                    box-sizing:\n                        border-box;\n\n                    pointer-events:\n                        none;\n                }''',
'''                ::slotted(ring-container) {\n                    position: absolute;\n\n                    display: block;\n\n                    box-sizing:\n                        border-box;\n\n                    background:\n                        transparent !important;\n\n                    pointer-events:\n                        none;\n                }''',
1)

text = text.replace(
'''            this.#indicatorHandoffFrozen =\n                false;\n\n            if (\n                this.#handStartTimeout !==\n                    undefined\n            ) {''',
'''            this.#indicatorHandoffFrozen =\n                false;\n\n            if (\n                this.#ringLayerHandoffTimeout !==\n                    undefined\n            ) {\n                clearTimeout(\n                    this.#ringLayerHandoffTimeout\n                );\n\n                this.#ringLayerHandoffTimeout =\n                    undefined;\n            }\n\n            for (\n                const ring of\n                    this.#rings.values()\n            ) {\n                ring.style.removeProperty(\n                    "z-index"\n                );\n            }\n\n            if (\n                this.#handStartTimeout !==\n                    undefined\n            ) {''',
1)

needle = '''            const activeRing =\n                this.#ensureRing(\n                    activeIndex\n                );\n\n            const inactive ='''
replacement = '''            const activeRing =\n                this.#ensureRing(\n                    activeIndex\n                );\n\n            const becomingInactiveRing =\n                Array.from(\n                    this.#rings.values()\n                ).find(\n                    ring =>\n                        ring !== activeRing &&\n                        ring.hasAttribute(\n                            "active"\n                        )\n                );\n\n            if (becomingInactiveRing) {\n                if (\n                    this.#ringLayerHandoffTimeout !==\n                        undefined\n                ) {\n                    clearTimeout(\n                        this.#ringLayerHandoffTimeout\n                    );\n                }\n\n                for (\n                    const ring of\n                        this.#rings.values()\n                ) {\n                    ring.style.zIndex =\n                        "0";\n                }\n\n                becomingInactiveRing.style.zIndex =\n                    "1";\n\n                activeRing.style.zIndex =\n                    "2";\n\n                const duration =\n                    this.#getRangeAnimationDuration();\n\n                this.#ringLayerHandoffTimeout =\n                    setTimeout(\n                        () => {\n                            this.#ringLayerHandoffTimeout =\n                                undefined;\n\n                            for (\n                                const ring of\n                                    this.#rings.values()\n                            ) {\n                                ring.style.removeProperty(\n                                    "z-index"\n                                );\n                            }\n                        },\n                        Math.max(\n                            0,\n                            duration\n                        )\n                    );\n            }\n\n            const inactive ='''
if needle not in text:
    raise SystemExit('active ring insertion point not found')
text = text.replace(needle, replacement, 1)

path.write_text(text)
