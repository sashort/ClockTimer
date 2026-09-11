from pathlib import Path
import re

path = Path('ClockTimer.js')
text = path.read_text()

# Make timer-mode changes state-first. Do not crossfade elapsed and remaining
# TimeRanges together; the host's timer-mode CSS owns elapsed visibility and
# remaining ranges are synchronously created/removed by applyTimerModeState.
pattern = re.compile(
    r'''        #handleTimerModeChange\(\n            oldValue,\n            newValue\n        \) \{.*?\n        \}\n\n        #findWaveSourceRange\(''',
    re.S,
)
replacement = '''        #handleTimerModeChange(\n            oldValue,\n            newValue\n        ) {\n            const mode =\n                this.#normalizeTimerMode();\n\n            if (newValue !== mode) {\n                return;\n            }\n\n            this.#cancelTimerModeTransition();\n\n            this.#applyTimerModeState(\n                mode\n            );\n        }\n\n        #findWaveSourceRange('''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('Could not replace #handleTimerModeChange')

# Remaining and wave ranges are static geometry. They should never enter the
# generic timing interpolation pipeline. Update logical timing while layout is
# suspended, calculate the final geometry with TimeRange's calculation APIs,
# commit it, then resume layout.
needle = '''            const active =\n                this.#timeRangeTimingAnimations.get(\n                    range\n                );\n\n            if (active) {'''
insert = '''            const rangeType =\n                range.getAttribute(\n                    "type"\n                );\n\n            if (\n                rangeType === "remaining" ||\n                rangeType === "wave"\n            ) {\n                this.#releaseTimeRangeTimingAnimation(\n                    range\n                );\n\n                TimeRangeClass?.suspendLayout?.(\n                    range\n                );\n\n                this.#writeRangeTiming(\n                    range,\n                    start,\n                    end,\n                    preserveRangeLength\n                );\n\n                const originMilliseconds =\n                    this.#getTimeRangeOriginMilliseconds(\n                        range,\n                        start\n                    );\n\n                const targetLayout =\n                    this.#calculateTimeRangeLayout(\n                        range,\n                        start,\n                        end,\n                        originMilliseconds\n                    );\n\n                if (targetLayout) {\n                    this.#applyTimeRangeLayout(\n                        range,\n                        targetLayout,\n                        true\n                    );\n                }\n\n                TimeRangeClass?.resumeLayout?.(\n                    range\n                );\n\n                if (!targetLayout) {\n                    range.refreshVisualGeometry?.();\n                }\n\n                return true;\n            }\n\n            const active =\n                this.#timeRangeTimingAnimations.get(\n                    range\n                );\n\n            if (active) {'''
if needle not in text:
    raise SystemExit('Could not find #setRangeTiming insertion point')
text = text.replace(needle, insert, 1)

# Release any coordinator-owned timing suspension before removing remaining
# ranges. This also makes cleanup safe if the user changes mode during an
# already-running timing animation from an older state.
needle = '''        #removeRemainingRanges() {\n            for (\n                const range of\n                    this.#remainingRanges.values()\n            ) {\n                range.remove();\n            }'''
replacement = '''        #removeRemainingRanges() {\n            for (\n                const range of\n                    this.#remainingRanges.values()\n            ) {\n                this.#releaseTimeRangeTimingAnimation(\n                    range\n                );\n\n                range.remove();\n            }'''
if needle not in text:
    raise SystemExit('Could not patch #removeRemainingRanges')
text = text.replace(needle, replacement, 1)

needle = '''                ) {\n                    range.remove();\n                    this.#remainingRanges.delete(\n                        ringIndex\n                    );\n                }\n            }\n\n            for (\n                let ringIndex = firstRing;'''
replacement = '''                ) {\n                    this.#releaseTimeRangeTimingAnimation(\n                        range\n                    );\n\n                    range.remove();\n                    this.#remainingRanges.delete(\n                        ringIndex\n                    );\n                }\n            }\n\n            for (\n                let ringIndex = firstRing;'''
if needle not in text:
    raise SystemExit('Could not patch stale remaining-range removal')
text = text.replace(needle, replacement, 1)

path.write_text(text)
