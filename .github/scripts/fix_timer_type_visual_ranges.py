from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old_capture = '''                    if (\n                        range.localName !==\n                            "time-range" ||\n                        range.timeRangeExiting ===\n                            true\n                    ) {\n                        continue;\n                    }\n'''
new_capture = '''                    if (\n                        range.localName !==\n                            "time-range" ||\n                        range.timeRangeExiting ===\n                            true ||\n                        this.#isTimerTypeTransitionVisualRange(\n                            range\n                        )\n                    ) {\n                        continue;\n                    }\n'''

capture_anchor = '''        #captureTimerTypeRangeSnapshots(\n            rings\n        ) {\n            const snapshots = [];\n\n            for (const ring of rings) {\n                for (const range of ring.children) {\n'''
anchor_index = text.find(capture_anchor)
if anchor_index < 0:
    raise SystemExit("capture snapshot anchor not found")
condition_index = text.find(old_capture, anchor_index)
if condition_index < 0:
    raise SystemExit("capture snapshot condition not found")
text = text[:condition_index] + new_capture + text[condition_index + len(old_capture):]

old_rebuild = '''                this.#rebuildTimerTypeRangeReferences();\n\n                const reference =\n                    Number.isFinite(\n                        state.referenceTime\n                    )\n                        ? state.referenceTime\n                        : this.#scheduledStartMilliseconds;\n'''
new_rebuild = '''                this.#rebuildTimerTypeRangeReferences();\n\n                if (this.#started) {\n                    const visualReference =\n                        Number.isFinite(\n                            state.referenceTime\n                        )\n                            ? state.referenceTime\n                            : this.#getCurrentTimelineTime();\n\n                    this.#updateElapsedRange(\n                        visualReference\n                    );\n\n                    this.#updateRemainingRanges(\n                        visualReference\n                    );\n                }\n\n                const reference =\n                    Number.isFinite(\n                        state.referenceTime\n                    )\n                        ? state.referenceTime\n                        : this.#scheduledStartMilliseconds;\n'''
if old_rebuild not in text:
    raise SystemExit("transition rebuild anchor not found")
text = text.replace(old_rebuild, new_rebuild, 1)

path.write_text(text)
