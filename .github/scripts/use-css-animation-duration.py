from pathlib import Path

# TimeRange: resolve the inherited ClockTimer CSS duration for all internal timing animations.
p = Path('TimeRange.js')
s = p.read_text()
anchor = '''    #animateToLogicalTiming() {\n'''
helper = '''    #getAnimationDuration() {\n        const raw =\n            getComputedStyle(\n                this\n            ).getPropertyValue(\n                "--clock-timer-ring-resize-duration"\n            ).trim();\n\n        const match =\n            raw.match(\n                /^(\\d+(?:\\.\\d+)?|\\.\\d+)(ms|s)$/i\n            );\n\n        if (!match) {\n            return TimeRange.#animationDuration;\n        }\n\n        const amount =\n            Number(\n                match[1]\n            );\n\n        if (\n            !Number.isFinite(amount) ||\n            amount < 0\n        ) {\n            return TimeRange.#animationDuration;\n        }\n\n        return (\n            match[2].toLowerCase() ===\n                "s"\n        )\n            ? amount * 1000\n            : amount;\n    }\n\n'''
if helper not in s:
    if anchor not in s:
        raise SystemExit('TimeRange anchor not found')
    s = s.replace(anchor, helper + anchor, 1)
old = '''        const duration =\n            TimeRange.#animationDuration;'''
count = s.count(old)
if count < 2:
    raise SystemExit(f'expected at least 2 TimeRange duration uses, found {count}')
s = s.replace(old, '''        const duration =\n            this.#getAnimationDuration();''')
p.write_text(s)

# ClockTimer: make the CSS custom property the source of truth for JS-driven start/clear timing.
p = Path('ClockTimer.js')
s = p.read_text()
start = s.index('        #getRangeAnimationDuration() {')
end = s.index('        #getPlannedSegments() {', start)
replacement = '''        #getRangeAnimationDuration() {\n            const raw =\n                getComputedStyle(\n                    this\n                ).getPropertyValue(\n                    "--clock-timer-ring-resize-duration"\n                ).trim();\n\n            const match =\n                raw.match(\n                    /^(\\d+(?:\\.\\d+)?|\\.\\d+)(ms|s)$/i\n                );\n\n            if (!match) {\n                return 333;\n            }\n\n            const amount =\n                Number(\n                    match[1]\n                );\n\n            if (\n                !Number.isFinite(amount) ||\n                amount < 0\n            ) {\n                return 333;\n            }\n\n            return (\n                match[2].toLowerCase() ===\n                    "s"\n            )\n                ? amount * 1000\n                : amount;\n        }\n\n'''
s = s[:start] + replacement + s[end:]

# Synchronize all ClockTimer-managed RingContainers to the same computed CSS duration
# whenever ring layout is refreshed, so border/number/tick/hand ring motion uses it too.
anchor = '''        #refreshRingLayout(\n            now,\n            {\n                refreshTickMarks = false\n            } = {}\n        ) {\n'''
insert = anchor + '''            const duration =\n                this.#getRangeAnimationDuration();\n\n            for (\n                const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container"\n                    )\n            ) {\n                ring.resizeDuration =\n                    `${duration}ms`;\n            }\n\n'''
if anchor not in s:
    raise SystemExit('ClockTimer refresh anchor not found')
s = s.replace(anchor, insert, 1)
p.write_text(s)
