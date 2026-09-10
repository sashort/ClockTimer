from pathlib import Path

clock_path = Path('ClockTimer.js')
time_path = Path('TimeRange.js')

clock = clock_path.read_text()
time = time_path.read_text()

# 1) Start/clear need a way to force TimeRange visual geometry to its logical geometry.
needle = '''    removeAnimated({\n        collapseTo = "end",\n        targetStart,\n        targetEnd\n    } = {}) {'''
insert = '''    snapToLogicalTiming() {\n        if (\n            this.#animationFrame !==\n                undefined\n        ) {\n            cancelAnimationFrame(\n                this.#animationFrame\n            );\n\n            this.#animationFrame =\n                undefined;\n        }\n\n        this.#removeAfterAnimation =\n            false;\n\n        this.#renderStartTime =\n            this.#cloneDate(\n                this.#startTime\n            );\n\n        this.#renderEndTime =\n            this.#cloneDate(\n                this.#endTime\n            );\n\n        this.#updateClipPath();\n\n        return this;\n    }\n\n    removeAnimated({\n        collapseTo = "end",\n        targetStart,\n        targetEnd\n    } = {}) {'''
if needle not in time:
    raise SystemExit('TimeRange removeAnimated insertion point not found')
time = time.replace(needle, insert, 1)

# 2) During start(), do not use the special full-entry/opacity path. Start is ring-width only.
needle = '''            if (this.#starting) {\n                range.setAttribute(\n                    "data-time-range-full-entry",\n                    ""\n                );\n            }\n\n            range.dataset.clockTimerStart ='''
replacement = '''            range.dataset.clockTimerStart ='''
if needle not in clock:
    raise SystemExit('starting full-entry block not found')
clock = clock.replace(needle, replacement, 1)

# 3) Add a ClockTimer helper that freezes every current timer range at final logical angles.
needle = '''        #animateStartedRingWidths() {\n            const duration ='''
insert = '''        #snapTimerRangeAngles() {\n            for (\n                const range of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring] > time-range"\n                    )\n            ) {\n                if (\n                    typeof range.snapToLogicalTiming ===\n                        "function"\n                ) {\n                    range.snapToLogicalTiming();\n                }\n            }\n        }\n\n        #animateStartedRingWidths() {\n            const duration ='''
if needle not in clock:
    raise SystemExit('animateStartedRingWidths insertion point not found')
clock = clock.replace(needle, insert, 1)

# 4) Start: perform the first tick while rings are still zero-width, then snap all angular geometry,
# and only after that begin the radial width growth. Schedule the next tick without doing a second immediate tick.
needle = '''            try {\n                this.#buildPlannedRanges();\n\n                this.#renderAllInsertedRanges();\n\n                this.#refreshRingLayout(\n                    this.#getCurrentTimelineTime(),\n                    {\n                        refreshTickMarks: true\n                    }\n                );\n            }\n            finally {\n                this.#starting =\n                    false;\n            }\n\n            this.#animateStartedRingWidths();\n\n            this.#startTickTimer();\n\n            return this;'''
replacement = '''            try {\n                this.#buildPlannedRanges();\n\n                this.#renderAllInsertedRanges();\n\n                this.#refreshRingLayout(\n                    this.#getCurrentTimelineTime(),\n                    {\n                        refreshTickMarks: true\n                    }\n                );\n\n                this.#tick();\n\n                this.#snapTimerRangeAngles();\n            }\n            finally {\n                this.#starting =\n                    false;\n            }\n\n            this.#animateStartedRingWidths();\n\n            this.#stopTickTimer();\n            this.#scheduleNextTick();\n\n            return this;'''
if needle not in clock:
    raise SystemExit('start block not found')
clock = clock.replace(needle, replacement, 1)

# 5) Clear: if a range is in the middle of a normal boundary animation, snap it to its final logical
# angle before its ring begins collapsing. No TimeRange angle changes occur during clear().
needle = '''                for (\n                    const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                ) {\n                    ring.removeAttribute('''
replacement = '''                for (\n                    const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                ) {\n                    for (\n                        const range of\n                            ring.querySelectorAll(\n                                ":scope > time-range"\n                            )\n                    ) {\n                        if (\n                            typeof range.snapToLogicalTiming ===\n                                "function"\n                        ) {\n                            range.snapToLogicalTiming();\n                        }\n                    }\n\n                    ring.removeAttribute('''
if needle not in clock:
    raise SystemExit('clear ring loop not found')
clock = clock.replace(needle, replacement, 1)

clock_path.write_text(clock)
time_path.write_text(time)
