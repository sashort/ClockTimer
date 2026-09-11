from pathlib import Path
import re
p=Path('ClockTimer.js')
s=p.read_text()
pattern=r'''        #processElapsedOverwriteRanges\(\n            now\n        \) \{.*?\n        \}\n\n        #tick\(\) \{'''
replacement='''        #processElapsedOverwriteRanges(\n            now\n        ) {\n            const ranges =\n                this.#getManagedTimeRanges()\n                    .filter(\n                        range =>\n                            range.timeRangeExiting !== true &&\n                            range.hasAttribute(\n                                "overwrite"\n                            )\n                    );\n\n            for (const range of ranges) {\n                const end =\n                    Number(\n                        range.clockTimerEnd\n                    );\n\n                if (\n                    !Number.isFinite(end) ||\n                    now < end\n                ) {\n                    continue;\n                }\n\n                const overwriteType =\n                    range.getAttribute(\n                        "overwrite"\n                    )?.trim();\n\n                range.removeAttribute(\n                    "overwrite"\n                );\n\n                if (!overwriteType) {\n                    continue;\n                }\n\n                this.overwrite({\n                    type: overwriteType\n                });\n            }\n        }\n\n        #tick() {'''
ns,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
assert n==1, n
p.write_text(ns)
