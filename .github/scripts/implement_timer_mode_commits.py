from pathlib import Path
import subprocess

ROOT = Path('.')
CLOCK = ROOT / 'ClockTimer.js'
RANGE = ROOT / 'TimeRange.js'


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: target not found')
    return text.replace(old, new, 1)


def commit(message, *paths):
    for path in paths:
        subprocess.run(['git', 'add', path], check=True)
    subprocess.run(['node', '--check', 'ClockTimer.js'], check=True)
    subprocess.run(['node', '--check', 'TimeRange.js'], check=True)
    subprocess.run(['git', 'commit', '-m', message], check=True)


# Commit 1: timer-mode attribute and propagation to elapsed ranges.
clock = CLOCK.read_text()
clock = replace_once(
    clock,
    '''        static observedAttributes = [\n            "percent-goal",''',
    '''        static observedAttributes = [\n            "percent-goal",\n            "timer-mode",''',
    'observed timer-mode'
)
clock = replace_once(
    clock,
    '''                case "percent-goal":\n                    if (''',
    '''                case "timer-mode":\n                    this.#handleTimerModeChange();\n                    break;\n\n                case "percent-goal":\n                    if (''',
    'timer-mode callback'
)
clock = replace_once(
    clock,
    '''        #ensureAttributes() {\n            if (\n                !this.hasAttribute(\n                    "percent-goal"\n                )\n            ) {''',
    '''        #ensureAttributes() {\n            if (\n                !this.hasAttribute(\n                    "timer-mode"\n                )\n            ) {\n                this.setAttribute(\n                    "timer-mode",\n                    "elapsed"\n                );\n            }\n            else {\n                this.#normalizeTimerMode();\n            }\n\n            if (\n                !this.hasAttribute(\n                    "percent-goal"\n                )\n            ) {''',
    'ensure timer-mode'
)
clock = replace_once(
    clock,
    '''        #ensureBorderRing() {''',
    '''        #getTimerMode() {\n            return this.getAttribute(\n                "timer-mode"\n            ) === "remaining"\n                ? "remaining"\n                : "elapsed";\n        }\n\n        #normalizeTimerMode() {\n            const raw =\n                this.getAttribute(\n                    "timer-mode"\n                );\n\n            const normalized =\n                typeof raw === "string" &&\n                raw.trim().toLowerCase() ===\n                    "remaining"\n                    ? "remaining"\n                    : "elapsed";\n\n            if (raw !== normalized) {\n                this.setAttribute(\n                    "timer-mode",\n                    normalized\n                );\n            }\n\n            return normalized;\n        }\n\n        #handleTimerModeChange() {\n            const mode =\n                this.#normalizeTimerMode();\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        'time-range[type="elapsed"]'\n                    )\n            ) {\n                range.setAttribute(\n                    "timer-mode",\n                    mode\n                );\n\n                range.refreshVisualGeometry?.();\n            }\n        }\n\n        #ensureBorderRing() {''',
    'timer-mode helpers'
)
clock = replace_once(
    clock,
    '''            if (\n                type ===\n                    "elapsed"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n            }''',
    '''            if (\n                type ===\n                    "elapsed"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }''',
    'elapsed timer-mode propagation'
)
CLOCK.write_text(clock)
commit('Add ClockTimer timer mode attribute', 'ClockTimer.js')


# Commit 2: live remaining overlays.
clock = CLOCK.read_text()
clock = replace_once(
    clock,
    '''        #overtimeRanges =\n            new Map();\n\n        #elapsedRange;''',
    '''        #overtimeRanges =\n            new Map();\n\n        #remainingRanges =\n            new Map();\n\n        #elapsedRange;''',
    'remaining map'
)
old_handler = '''        #handleTimerModeChange() {\n            const mode =\n                this.#normalizeTimerMode();\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        'time-range[type="elapsed"]'\n                    )\n            ) {\n                range.setAttribute(\n                    "timer-mode",\n                    mode\n                );\n\n                range.refreshVisualGeometry?.();\n            }\n        }'''
new_handler = '''        #handleTimerModeChange() {\n            const mode =\n                this.#normalizeTimerMode();\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        'time-range[type="elapsed"]'\n                    )\n            ) {\n                range.setAttribute(\n                    "timer-mode",\n                    mode\n                );\n\n                range.refreshVisualGeometry?.();\n            }\n\n            if (mode !== "remaining") {\n                this.#removeRemainingRanges();\n                return;\n            }\n\n            let start;\n\n            if (this.#started) {\n                start =\n                    this.#getCurrentTimelineTime();\n            }\n            else {\n                for (\n                    const range of\n                        this.querySelectorAll(\n                            'time-range[type="elapsed"]'\n                        )\n                ) {\n                    const end =\n                        Number(\n                            range.clockTimerEnd\n                        );\n\n                    if (\n                        Number.isFinite(end) &&\n                        (\n                            !Number.isFinite(start) ||\n                            end > start\n                        )\n                    ) {\n                        start = end;\n                    }\n                }\n            }\n\n            if (Number.isFinite(start)) {\n                this.#updateRemainingRanges(\n                    start\n                );\n            }\n        }'''
clock = replace_once(clock, old_handler, new_handler, 'expanded timer-mode handler')
clock = replace_once(
    clock,
    '''            if (\n                type ===\n                    "elapsed"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }''',
    '''            if (\n                type === "elapsed" ||\n                type === "remaining"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n            }\n\n            if (type === "elapsed") {\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }''',
    'remaining overlapping creation'
)
remaining_methods = '''        #getLatestTimerEnd() {\n            let latest;\n\n            for (\n                const range of\n                    this.querySelectorAll(\n                        "ring-container > time-range"\n                    )\n            ) {\n                if (\n                    range.getAttribute(\n                        "type"\n                    ) === "remaining"\n                ) {\n                    continue;\n                }\n\n                const end =\n                    Number(\n                        range.clockTimerEnd\n                    );\n\n                if (\n                    Number.isFinite(end) &&\n                    (\n                        !Number.isFinite(latest) ||\n                        end > latest\n                    )\n                ) {\n                    latest = end;\n                }\n            }\n\n            return latest;\n        }\n\n        #removeRemainingRanges() {\n            for (\n                const range of\n                    this.#remainingRanges.values()\n            ) {\n                range.remove();\n            }\n\n            this.#remainingRanges.clear();\n        }\n\n        #updateRemainingRanges(\n            start\n        ) {\n            if (\n                this.#getTimerMode() !==\n                    "remaining" ||\n                !Number.isFinite(start)\n            ) {\n                this.#removeRemainingRanges();\n                return;\n            }\n\n            const latestEnd =\n                this.#getLatestTimerEnd();\n\n            if (\n                !Number.isFinite(latestEnd) ||\n                latestEnd <= start\n            ) {\n                this.#removeRemainingRanges();\n                return;\n            }\n\n            const firstRing =\n                this.#getRingIndex(\n                    start\n                );\n\n            const lastRing =\n                this.#getRingIndex(\n                    latestEnd - 0.0001\n                );\n\n            for (\n                const [ringIndex, range] of\n                    this.#remainingRanges\n            ) {\n                if (\n                    ringIndex < firstRing ||\n                    ringIndex > lastRing ||\n                    !range.isConnected\n                ) {\n                    range.remove();\n                    this.#remainingRanges.delete(\n                        ringIndex\n                    );\n                }\n            }\n\n            for (\n                let ringIndex = firstRing;\n                ringIndex <= lastRing;\n                ringIndex++\n            ) {\n                const ringStart =\n                    this.#getRingStart(\n                        ringIndex\n                    );\n\n                const ringEnd =\n                    ringStart +\n                    ClockTimer.#HOUR;\n\n                const segmentStart =\n                    Math.max(\n                        start,\n                        ringStart\n                    );\n\n                const segmentEnd =\n                    Math.min(\n                        latestEnd,\n                        ringEnd\n                    );\n\n                if (segmentEnd <= segmentStart) {\n                    continue;\n                }\n\n                const ring =\n                    this.#ensureRing(\n                        ringIndex\n                    );\n\n                let range =\n                    this.#remainingRanges.get(\n                        ringIndex\n                    );\n\n                if (\n                    !range ||\n                    range.parentElement !== ring\n                ) {\n                    range =\n                        this.#createTimeRange(\n                            "remaining",\n                            segmentStart,\n                            segmentEnd,\n                            {\n                                dynamic: true\n                            }\n                        );\n\n                    range.clockTimerRemaining =\n                        "";\n\n                    range.timeRangeFullEntry =\n                        true;\n\n                    ring.appendChild(\n                        range\n                    );\n\n                    this.#remainingRanges.set(\n                        ringIndex,\n                        range\n                    );\n                }\n                else {\n                    this.#setRangeStart(\n                        range,\n                        segmentStart\n                    );\n\n                    this.#setRangeEnd(\n                        range,\n                        segmentEnd\n                    );\n                }\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.snapToLogicalTiming?.();\n            }\n        }\n\n'''
clock = replace_once(
    clock,
    '''        #updateOvertimeRanges(\n            now\n        ) {''',
    remaining_methods + '''        #updateOvertimeRanges(\n            now\n        ) {''',
    'remaining methods'
)
# Keep remaining synchronized anywhere live elapsed/overtime state is refreshed.
clock = clock.replace(
    '''                this.#updateOvertimeRanges(\n                    now\n                );''',
    '''                this.#updateOvertimeRanges(\n                    now\n                );\n\n                this.#updateRemainingRanges(\n                    now\n                );'''
)
clock = clock.replace(
    '''            this.#updateOvertimeRanges(\n                now\n            );''',
    '''            this.#updateOvertimeRanges(\n                now\n            );\n\n            this.#updateRemainingRanges(\n                now\n            );'''
)
clock = replace_once(
    clock,
    '''            this.#overtimeRanges.clear();\n\n            this.#rings.clear();''',
    '''            this.#overtimeRanges.clear();\n\n            this.#remainingRanges.clear();\n\n            this.#rings.clear();''',
    'clear remaining map'
)
clock = clock.replace(
    '''                "prestart",\n                "elapsed"\n            ]);''',
    '''                "prestart",\n                "elapsed",\n                "remaining"\n            ]);'''
)
clock = clock.replace(
    '''                        "prestart",\n                        "elapsed"\n                    ]);''',
    '''                        "prestart",\n                        "elapsed",\n                        "remaining"\n                    ]);'''
)
clock = replace_once(
    clock,
    '''                "prestart",\n                "overtime"\n            ]).has(''',
    '''                "prestart",\n                "overtime",\n                "remaining"\n            ]).has(''',
    'remaining calculated-end exclusion'
)
CLOCK.write_text(clock)
commit('Add live remaining timer overlays', 'ClockTimer.js')


# Commit 3: JSON restoration semantics for remaining mode.
clock = CLOCK.read_text()
clock = replace_once(
    clock,
    '''                        elapsedRange.setAttribute(\n                            "overlapping",\n                            ""\n                        );\n\n                        elapsedRange.setAttribute(\n                            "static-elapsed",\n                            ""\n                        );''',
    '''                        elapsedRange.setAttribute(\n                            "overlapping",\n                            ""\n                        );\n\n                        elapsedRange.clockTimerImportedElapsed =\n                            "";\n\n                        if (\n                            this.#getTimerMode() ===\n                                "elapsed"\n                        ) {\n                            elapsedRange.setAttribute(\n                                "static-elapsed",\n                                ""\n                            );\n                        }''',
    'JSON elapsed behavior'
)
clock = replace_once(
    clock,
    '''                    this.#refreshRingLayout(\n                        coverageEnd,''',
    '''                    if (\n                        this.#getTimerMode() ===\n                            "remaining"\n                    ) {\n                        this.#updateRemainingRanges(\n                            terminal\n                        );\n                    }\n\n                    this.#refreshRingLayout(\n                        coverageEnd,''',
    'JSON remaining span'
)
old_toggle = '''                range.setAttribute(\n                    "timer-mode",\n                    mode\n                );\n\n                range.refreshVisualGeometry?.();'''
new_toggle = '''                range.setAttribute(\n                    "timer-mode",\n                    mode\n                );\n\n                if (\n                    range.clockTimerImportedElapsed !==\n                        undefined\n                ) {\n                    if (mode === "remaining") {\n                        range.removeAttribute(\n                            "static-elapsed"\n                        );\n                    }\n                    else {\n                        range.setAttribute(\n                            "static-elapsed",\n                            ""\n                        );\n                    }\n                }\n\n                range.refreshVisualGeometry?.();'''
clock = replace_once(clock, old_toggle, new_toggle, 'loaded elapsed mode switching')
CLOCK.write_text(clock)
commit('Restore remaining overlays from JSON end time', 'ClockTimer.js')


# Commit 4: TimeRange visual rules and no-animation behavior.
tr = RANGE.read_text()
tr = replace_once(
    tr,
    '''            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-edge,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }\n''',
    '''            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-edge,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }\n\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-base,\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-edge {\n                display: none;\n            }\n\n            :host([type="remaining"]) {\n                animation: none !important;\n                transition: none !important;\n            }\n''',
    'remaining visual CSS'
)
tr = replace_once(
    tr,
    '''    #startTimingAnimation(\n        fromStart,\n        fromEnd,\n        targetStart,\n        targetEnd,\n        removeAfter = false\n    ) {\n        if (''',
    '''    #startTimingAnimation(\n        fromStart,\n        fromEnd,\n        targetStart,\n        targetEnd,\n        removeAfter = false\n    ) {\n        if (\n            this.getAttribute(\n                "type"\n            ) === "remaining"\n        ) {\n            this.#renderStartTime =\n                this.#cloneDate(\n                    targetStart\n                );\n\n            this.#renderEndTime =\n                this.#cloneDate(\n                    targetEnd\n                );\n\n            this.#updateClipPath();\n\n            if (removeAfter) {\n                this.remove();\n            }\n\n            return;\n        }\n\n        if (''',
    'remaining timing animation bypass'
)
RANGE.write_text(tr)
commit('Keep elapsed wave while remaining mode is static', 'TimeRange.js')

# Final validation.
clock = CLOCK.read_text()
tr = RANGE.read_text()
assert '"timer-mode"' in clock
assert '#remainingRanges' in clock
assert '#updateRemainingRanges' in clock
assert 'clockTimerImportedElapsed' in clock
assert '"remaining"' in clock
assert 'timer-mode="remaining"' in tr
assert ':host([type="remaining"])' in tr
subprocess.run(['node', '--check', 'ClockTimer.js'], check=True)
subprocess.run(['node', '--check', 'TimeRange.js'], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
