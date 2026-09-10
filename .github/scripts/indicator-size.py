from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                    font-size: var(--clock-timer-indicator-symbol-size, 12px);'''
new='''                    font-size:\n                        var(\n                            --clock-timer-indicator-symbol-size,\n                            var(\n                                --clock-timer-auto-indicator-symbol-size,\n                                10px\n                            )\n                        );'''
if old not in s: raise SystemExit('missing font-size anchor')
s=s.replace(old,new,1)
old='''                            this.#scheduleFontSizing();\n                        \n\n                    this.#refreshTimeRangeVisualGeometry();}'''
new='''                            this.#scheduleFontSizing();\n                            this.#scheduleIndicatorSymbolUpdate();\n\n                            this.#refreshTimeRangeVisualGeometry();\n                        }'''
if old not in s: raise SystemExit('missing resize observer anchor')
s=s.replace(old,new,1)
old='''            const inset = ring.renderedInset ?? ring.inset ?? "0px";\n\n            this.#indicatorRing.style.inset = inset;\n            this.#indicatorTrack.style.transform = `rotate(${normalizedAngle}deg)`;'''
new='''            const inset =\n                ring.renderedInset ??\n                ring.inset ??\n                "0px";\n\n            const renderedWidth =\n                Number.parseFloat(\n                    ring.renderedWidth ??\n                    ring.width ??\n                    "0px"\n                );\n\n            if (\n                Number.isFinite(renderedWidth) &&\n                renderedWidth > 0\n            ) {\n                const symbolSize =\n                    renderedWidth * 0.8;\n\n                this.#indicatorSymbol.style.setProperty(\n                    "--clock-timer-auto-indicator-symbol-size",\n                    `${symbolSize}px`\n                );\n            }\n\n            this.#indicatorRing.style.inset = inset;\n            this.#indicatorTrack.style.transform = `rotate(${normalizedAngle}deg)`;'''
if old not in s: raise SystemExit('missing indicator geometry anchor')
s=s.replace(old,new,1)
p.write_text(s)
