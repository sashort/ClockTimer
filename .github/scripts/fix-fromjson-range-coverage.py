from pathlib import Path

p=Path('ClockTimer.js')
s=p.read_text()
old='''                    this.#buildPlannedRanges(\n                        startTimeMilliseconds\n                    );\n\n                    let elapsedCursor ='''
new='''                    this.#buildPlannedRanges(\n                        startTimeMilliseconds\n                    );\n\n                    const restoredCalculatedEndTime =\n                        this.#calculatedEndTime;\n\n                    const coverageEnd =\n                        Math.max(\n                            terminal,\n                            restoredCalculatedEndTime ?? terminal\n                        );\n\n                    if (\n                        Number.isFinite(this.#standardEnd) &&\n                        coverageEnd > this.#standardEnd\n                    ) {\n                        this.#createSpan(\n                            "overtime",\n                            this.#standardEnd,\n                            coverageEnd\n                        );\n                    }\n\n                    this.#calculatedEndTime =\n                        coverageEnd;\n\n                    let elapsedCursor ='''
if old not in s: raise SystemExit('build insertion target missing')
s=s.replace(old,new,1)
old='''                    this.#refreshRingLayout(\n                        Math.max(\n                            terminal,\n                            this.#standardEnd ?? terminal\n                        ),'''
new='''                    this.#refreshRingLayout(\n                        coverageEnd,'''
if old not in s: raise SystemExit('inner refresh target missing')
s=s.replace(old,new,1)
old='''                this.#refreshRingLayout(\n                    terminal,\n                    {\n                        refreshTickMarks: true\n                    }\n                );'''
new='''                this.#refreshRingLayout(\n                    Math.max(\n                        terminal,\n                        this.#calculatedEndTime ?? terminal\n                    ),\n                    {\n                        refreshTickMarks: true\n                    }\n                );'''
if old not in s: raise SystemExit('final refresh target missing')
s=s.replace(old,new,1)
p.write_text(s)
