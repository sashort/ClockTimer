from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
repls=[
('''                    font-size:\n                        var(\n                            --clock-timer-indicator-symbol-size,\n                            var(\n                                --clock-timer-auto-indicator-symbol-size,\n                                10px\n                            )\n                        );''','''                    font-size: var(--clock-timer-indicator-symbol-size, 12px);'''),
('''                            this.#scheduleFontSizing();\n                            this.#scheduleIndicatorSymbolUpdate();\n\n                            this.#refreshTimeRangeVisualGeometry();\n                        }''','''                            this.#scheduleFontSizing();\n                        \n\n                    this.#refreshTimeRangeVisualGeometry();}'''),
('''            const inset =\n                ring.renderedInset ??\n                ring.inset ??\n                "0px";\n\n            const renderedWidth =\n                Number.parseFloat(\n                    ring.renderedWidth ??\n                    ring.width ??\n                    "0px"\n                );\n\n            if (\n                Number.isFinite(renderedWidth) &&\n                renderedWidth > 0\n            ) {\n                const symbolSize =\n                    renderedWidth * 0.8;\n\n                this.#indicatorSymbol.style.setProperty(\n                    "--clock-timer-auto-indicator-symbol-size",\n                    `${symbolSize}px`\n                );\n            }''','''            const inset = ring.renderedInset ?? ring.inset ?? "0px";''')
]
for old,new in repls:
    if old not in s:
        raise SystemExit('missing rollback anchor')
    s=s.replace(old,new,1)
p.write_text(s)
