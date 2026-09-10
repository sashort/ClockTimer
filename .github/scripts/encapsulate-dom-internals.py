from pathlib import Path
import re

clock_path = Path('ClockTimer.js')
time_path = Path('TimeRange.js')

clock = clock_path.read_text()
time = time_path.read_text()

# Move ClockTimer-owned data-* bookkeeping to plain JS properties.
clock = re.sub(r'\.dataset\.clockTimer([A-Za-z0-9_]+)', lambda m: '.clockTimer' + m.group(1), clock)

# Move host-generated responsive values inside the closed shadow tree.
clock = clock.replace('''            this.style.setProperty(\n                "--clock-timer-auto-hour-font-size",\n                `${hourSize}px`\n            );''', '''            this.#hourLayer.style.setProperty(\n                "--clock-timer-auto-hour-font-size",\n                `${hourSize}px`\n            );''')
clock = clock.replace('''            this.style.setProperty(\n                "--clock-timer-auto-time-font-size",\n                `${fittedSize}px`\n            );''', '''            this.#timeElement.style.setProperty(\n                "--clock-timer-auto-time-font-size",\n                `${fittedSize}px`\n            );''')

# Replace TimeRange transient DOM markers with JS properties.
clock = clock.replace('''                    range.hasAttribute(\n                        "data-time-range-exiting"\n                    )''', '''                    range.timeRangeExiting ===\n                        true''')
clock = clock.replace('''                replacement.setAttribute(\n                    "data-time-range-full-entry",\n                    ""\n                );''', '''                replacement.timeRangeFullEntry =\n                    true;''')
clock = clock.replace('''                    range.setAttribute(\n                        "data-time-range-full-entry",\n                        ""\n                    );''', '''                    range.timeRangeFullEntry =\n                        true;''')
clock = clock.replace('''                range.setAttribute(\n                    "data-time-range-full-entry",\n                    ""\n                );''', '''                range.timeRangeFullEntry =\n                    true;''')

# Ring lifecycle markers are JS-only state.
clock = clock.replace('''                    ring.removeAttribute(\n                        "data-clock-timer-ring"\n                    );\n\n                    ring.setAttribute(\n                        "data-clock-timer-exiting-ring",\n                        ""\n                    );''', '''                    delete ring.clockTimerRing;\n\n                    ring.clockTimerExitingRing =\n                        true;''')

# Query helpers keep internal state out of selectors/HTML.
helper = '''\n        #getManagedTimeRanges() {\n            const ranges = [];\n\n            for (const child of this.children) {\n                if (\n                    child.localName !==\n                        "ring-container"\n                ) {\n                    continue;\n                }\n\n                for (const range of child.children) {\n                    if (\n                        range.localName ===\n                            "time-range"\n                    ) {\n                        ranges.push(range);\n                    }\n                }\n            }\n\n            return ranges;\n        }\n\n        #getTimerRings() {\n            return Array.from(\n                this.children\n            ).filter(\n                child =>\n                    child.localName ===\n                        "ring-container" &&\n                    child.clockTimerRing !==\n                        undefined\n            );\n        }\n\n        #getTimerRanges() {\n            const ranges = [];\n\n            for (const ring of\n                this.#getTimerRings()\n            ) {\n                for (const range of ring.children) {\n                    if (\n                        range.localName ===\n                            "time-range"\n                    ) {\n                        ranges.push(range);\n                    }\n                }\n            }\n\n            return ranges;\n        }\n'''
needle = '        #getPercentGoal() {'
if helper.strip() not in clock:
    clock = clock.replace(needle, helper + '\n' + needle, 1)

# Selector-based internal markers -> property filtering.
clock = clock.replace('''            const existing =\n                Array.from(\n                    this.querySelectorAll(\n                        ':scope > ring-container > time-range[data-clock-timer-planned]:not([data-time-range-exiting])'\n                    )\n                );''', '''            const existing =\n                this.#getManagedTimeRanges()\n                    .filter(\n                        range =>\n                            range.clockTimerPlanned !==\n                                undefined &&\n                            range.timeRangeExiting !==\n                                true\n                    );''')
clock = clock.replace('''            for (\n                const range of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring] > time-range"\n                    )\n            ) {''', '''            for (\n                const range of\n                    this.#getTimerRanges()\n            ) {''')
clock = clock.replace('''            const rings =\n                Array.from(\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                );''', '''            const rings =\n                this.#getTimerRings();''')
clock = clock.replace('''                for (\n                    const ring of\n                    this.querySelectorAll(\n                        ":scope > ring-container[data-clock-timer-ring]"\n                    )\n                ) {''', '''                for (\n                    const ring of\n                        this.#getTimerRings()\n                ) {''')
clock = clock.replace('''                        child.hasAttribute(\n                            "data-clock-timer-ring"\n                        )''', '''                        child.clockTimerRing !==\n                            undefined''')
clock = clock.replace('''            const ranges =\n                Array.from(\n                    this.querySelectorAll(\n                        ':scope > ring-container[data-clock-timer-ring] > time-range:not([data-clock-timer-inserted])'\n                    )\n                );''', '''            const ranges =\n                this.#getTimerRanges()\n                    .filter(\n                        range =>\n                            range.clockTimerInserted ===\n                                undefined\n                    );''')
clock = clock.replace('''            for (\n                const range of\n                    this.querySelectorAll(\n                        ':scope > ring-container[data-clock-timer-ring] > time-range[data-clock-timer-overtime]'\n                    )\n            ) {''', '''            for (\n                const range of\n                    this.#getTimerRanges()\n                        .filter(\n                            range =>\n                                range.clockTimerOvertime !==\n                                    undefined\n                        )\n            ) {''')
clock = clock.replace('''            for (\n                const range of\n                    this.querySelectorAll(\n                        ':scope > ring-container > time-range[data-clock-timer-inserted]'\n                    )\n            ) {''', '''            for (\n                const range of\n                    this.#getManagedTimeRanges()\n                        .filter(\n                            range =>\n                                range.clockTimerInserted !==\n                                    undefined\n                        )\n            ) {''')
clock = clock.replace('''                const rendered =\n                    Array.from(\n                        this.querySelectorAll(\n                            ':scope > ring-container > time-range[data-clock-timer-inserted]'\n                        )\n                    ).filter(\n                        range =>\n                            range.clockTimerInserted ===\n                                record.id\n                    );''', '''                const rendered =\n                    this.#getManagedTimeRanges()\n                        .filter(\n                            range =>\n                                range.clockTimerInserted ===\n                                    record.id\n                        );''')
clock = clock.replace('''            for (\n                const range of\n                    this.querySelectorAll(\n                        ":scope > ring-container > time-range[data-clock-timer-planned]"\n                    )\n            ) {''', '''            for (\n                const range of\n                    this.#getManagedTimeRanges()\n                        .filter(\n                            range =>\n                                range.clockTimerPlanned !==\n                                    undefined\n                        )\n            ) {''')

# Preserve only public/declarative attributes; old internal attrs no longer exist.
clock = clock.replace(''' ||\n                    name === "data-clock-timer-start" ||\n                    name === "data-clock-timer-end"''', '')
clock = clock.replace(''' ||\n                    normalizedName === "data-clock-timer-start" ||\n                    normalizedName === "data-clock-timer-end"''', '')

# Any remaining exact data selectors/markers are implementation leftovers and should fail the workflow below.

# TimeRange transient state -> properties, and host CSS vars -> closed-shadow contour node.
time = time.replace('''            this.hasAttribute(\n                "data-time-range-full-entry"\n            )''', '''            this.timeRangeFullEntry ===\n                true''')
time = time.replace('''            this.removeAttribute(\n                "data-time-range-full-entry"\n            );''', '''            delete this.timeRangeFullEntry;''')
time = time.replace('''        this.setAttribute(\n            "data-time-range-exiting",\n            ""\n        );''', '''        this.timeRangeExiting =\n            true;''')
time = time.replace('''            !parent.hasAttribute(\n                "data-clock-timer-ring"\n            )''', '''            parent.clockTimerRing ===\n                undefined''')
time = time.replace('''        this.style.setProperty(\n            "--time-range-ring-inset",''', '''        this.#contourLayer.style.setProperty(\n            "--time-range-ring-inset",''')
time = time.replace('''        this.style.setProperty(\n            "--time-range-ring-width",''', '''        this.#contourLayer.style.setProperty(\n            "--time-range-ring-width",''')

clock_path.write_text(clock)
time_path.write_text(time)
