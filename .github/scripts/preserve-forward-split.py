from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''            let firstSegment =\n                true;\n\n            for (\n                const [\n                    spanStart,\n                    spanEnd\n                ] of spans\n            ) {'''
new='''            let firstSegment =\n                true;\n\n            const preserveForwardRange =\n                spans.length > 1;\n\n            let segmentIndex = 0;\n\n            for (\n                const [\n                    spanStart,\n                    spanEnd\n                ] of spans\n            ) {'''
if old not in s: raise SystemExit('anchor1 not found')
s=s.replace(old,new,1)
old2='''                    const segment =\n                        firstSegment\n                            ? range\n                            : document.createElement(\n                                "time-range"\n                            );'''
new2='''                    const useOriginalRange =\n                        preserveForwardRange\n                            ? segmentIndex ===\n                                spans.length - 1\n                            : firstSegment;\n\n                    const segment =\n                        useOriginalRange\n                            ? range\n                            : document.createElement(\n                                "time-range"\n                            );'''
if old2 not in s: raise SystemExit('anchor2 not found')
s=s.replace(old2,new2,1)
old3='''                    if (\n                        !firstSegment\n                    ) {'''
new3='''                    if (\n                        segment !== range\n                    ) {'''
if old3 not in s: raise SystemExit('anchor3 not found')
s=s.replace(old3,new3,1)
old4='''                    if (\n                        segment === range &&\n                        range.parentElement !== ring\n                    ) {'''
# no change needed logically
# increment segmentIndex after each outer span, not each ring chunk; easiest inject after inner while
anchor='''                    cursor =\n                        segmentEnd;\n                }\n            }\n        }'''
replacement='''                    cursor =\n                        segmentEnd;\n                }\n\n                segmentIndex++;\n            }\n        }'''
if anchor not in s: raise SystemExit('anchor4 not found')
s=s.replace(anchor,replacement,1)
# Atomic snap should apply whenever original is retained in a multi-span split
old5='''                    if (\n                        spans.length > 1 &&\n                        firstSegment &&\n                        typeof range.snapToLogicalTiming ===\n                            "function"\n                    ) {\n                        range.snapToLogicalTiming();\n                    }'''
if old5 in s:
    new5='''                    if (\n                        spans.length > 1 &&\n                        segment === range &&\n                        typeof range.snapToLogicalTiming ===\n                            "function"\n                    ) {\n                        range.snapToLogicalTiming();\n                    }'''
    s=s.replace(old5,new5,1)
p.write_text(s)
