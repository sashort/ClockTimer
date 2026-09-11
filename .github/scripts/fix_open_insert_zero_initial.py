from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_effective = '''            const effectiveEnd =\n                record.openEnded\n                    ? (\n                        Number.isFinite(\n                            this.#openEndedLastTick\n                        ) &&\n                        this.#openEndedLastTick > start\n                            ? this.#openEndedLastTick\n                            : start + 1\n                    )\n'''
new_effective = '''            const effectiveEnd =\n                record.openEnded\n                    ? (\n                        Number.isFinite(\n                            this.#openEndedLastTick\n                        ) &&\n                        this.#openEndedLastTick > start\n                            ? this.#openEndedLastTick\n                            : start\n                    )\n'''
if old_effective not in text:
    raise SystemExit('effective end block not found')
text = text.replace(old_effective, new_effective, 1)

old_placeholder = '''                const range =\n                    document.createElement(\n                        "time-range"\n                    );\n\n                range.setAttribute(\n                    "type",\n                    record.type\n                );\n\n                range.setAttribute(\n                    "start-time",\n                    this.#formatTimelineTime(\n                        start\n                    )\n                );\n\n                if (this.#starting) {\n                    range.timeRangeFullEntry =\n                        true;\n                }\n\n                range.clockTimerStart =\n                    String(start);\n\n                range.clockTimerInserted =\n                    record.id;\n'''
new_placeholder = '''                const range =\n                    this.#createTimeRange(\n                        record.type,\n                        start,\n                        start,\n                        { dynamic: true }\n                    );\n\n                delete range.clockTimerDynamic;\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.timeRangeFullEntry =\n                    true;\n\n                range.clockTimerInserted =\n                    record.id;\n'''
if old_placeholder not in text:
    raise SystemExit('placeholder block not found')
text = text.replace(old_placeholder, new_placeholder, 1)

old_segment = '''                delete range.clockTimerDynamic;\n\n                range.clockTimerInserted =\n                    record.id;\n'''
new_segment = '''                delete range.clockTimerDynamic;\n\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.clockTimerInserted =\n                    record.id;\n'''
if old_segment not in text:
    raise SystemExit('rendered segment block not found')
text = text.replace(old_segment, new_segment, 1)

old_sync_new = '''                    delete range.clockTimerDynamic;\n\n                    range.clockTimerInserted =\n                        record.id;\n'''
new_sync_new = '''                    delete range.clockTimerDynamic;\n\n                    range.setAttribute(\n                        "overlapping",\n                        ""\n                    );\n\n                    range.clockTimerInserted =\n                        record.id;\n'''
if old_sync_new not in text:
    raise SystemExit('sync new segment block not found')
text = text.replace(old_sync_new, new_sync_new, 1)

path.write_text(text)
