from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

def once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

once('''        #calculatedEnd;\n\n        #toleranceEnd;''', '''        #calculatedEnd;\n\n        #calculatedEndTime;\n\n        #toleranceEnd;''', 'private calculatedEndTime field')

# Initialize the independent calculated end-time baseline when start() finishes parsing.
once('''            this.#standardDuration =\n                standard.total;\n\n            this.#percentGoal =''', '''            this.#standardDuration =\n                standard.total;\n\n            this.#calculatedEndTime =\n                this.#scheduledStartMilliseconds +\n                this.#standardDuration;\n\n            this.#percentGoal =''', 'start calculatedEndTime initialization')

# Clear it with the rest of start-derived state.
once('''            this.#calculatedEnd =\n                undefined;\n\n            this.#toleranceEnd =''', '''            this.#calculatedEnd =\n                undefined;\n\n            this.#calculatedEndTime =\n                undefined;\n\n            this.#toleranceEnd =''', 'clear calculatedEndTime')

# Centralize which inserted/replacement types extend calculatedEndTime.
marker = '''        insert({\n            type,\n'''
helpers = '''        #typeExtendsCalculatedEndTime(type) {\n            return !new Set([\n                "trip",\n                "earlystart",\n                "prestart",\n                "overtime"\n            ]).has(\n                String(type).trim()\n            );\n        }\n\n        #extendCalculatedEndTime(\n            duration,\n            type\n        ) {\n            if (\n                !Number.isFinite(\n                    this.#calculatedEndTime\n                ) ||\n                !Number.isFinite(duration) ||\n                duration <= 0 ||\n                !this.#typeExtendsCalculatedEndTime(\n                    type\n                )\n            ) {\n                return;\n            }\n\n            this.#calculatedEndTime +=\n                duration;\n        }\n\n'''
once(marker, helpers + marker, 'calculatedEndTime helpers')

# Closed insertions extend immediately by their duration. Open-ended inserts extend tick-by-tick instead.
once('''            this.#insertedRanges.push(\n                record\n            );\n\n            if (\n                record.openEnded\n            ) {''', '''            this.#insertedRanges.push(\n                record\n            );\n\n            if (\n                Number.isFinite(\n                    record.rangeLength\n                )\n            ) {\n                this.#extendCalculatedEndTime(\n                    record.rangeLength,\n                    record.type\n                );\n            }\n\n            if (\n                record.openEnded\n            ) {''', 'insert calculatedEndTime extension')

# replaceWithNext extends the next range backwards to now; count that newly claimed duration when applicable.
once('''            this.#setRangeStart(\n                nextRange,\n                now\n            );''', '''            this.#extendCalculatedEndTime(\n                nextStart - now,\n                nextRange.getAttribute(\n                    "type"\n                )\n            );\n\n            this.#setRangeStart(\n                nextRange,\n                now\n            );''', 'replaceWithNext calculatedEndTime extension')

# replaceToNext creates a new replacement span from now to nextStart.
once('''            const replacement =\n                this.#createTimeRange(\n                    type.trim(),\n                    now,\n                    nextStart,''', '''            const replacementType =\n                type.trim();\n\n            this.#extendCalculatedEndTime(\n                nextStart - now,\n                replacementType\n            );\n\n            const replacement =\n                this.#createTimeRange(\n                    replacementType,\n                    now,\n                    nextStart,''', 'replaceToNext calculatedEndTime extension')

# Every successful open-ended tick extension contributes only that tick's newly added delta.
once('''            const delta =\n                now - previous;\n\n            this.#openEndedLastTick =\n                now;''', '''            const delta =\n                now - previous;\n\n            this.#extendCalculatedEndTime(\n                delta,\n                record.type\n            );\n\n            this.#openEndedLastTick =\n                now;''', 'open-ended tick calculatedEndTime extension')

# stop() closes an active open-ended insertion at the requested stop point and accounts for any final partial tick.
needle = '''            this.#stopTickTimer();\n\n            this.#started =\n                false;'''
replacement = '''            this.#stopTickTimer();\n\n            const openRecord =\n                this.#openEndedRange;\n\n            if (openRecord) {\n                const openStart =\n                    this.#dateToTimelineTime(\n                        openRecord.startDate\n                    );\n\n                if (\n                    Number.isFinite(openStart) &&\n                    stopTime >= openStart\n                ) {\n                    const previous =\n                        Number.isFinite(\n                            this.#openEndedLastTick\n                        )\n                            ? this.#openEndedLastTick\n                            : openStart;\n\n                    if (stopTime > previous) {\n                        this.#extendCalculatedEndTime(\n                            stopTime - previous,\n                            openRecord.type\n                        );\n                    }\n\n                    openRecord.openEnded =\n                        false;\n\n                    openRecord.rangeLength =\n                        Math.max(\n                            0,\n                            stopTime - openStart\n                        );\n\n                    openRecord.endDate =\n                        new Date(\n                            openRecord.startDate.getTime() +\n                            openRecord.rangeLength\n                        );\n\n                    this.#openEndedRange =\n                        undefined;\n\n                    this.#openEndedLastTick =\n                        undefined;\n\n                    this.#renderAllInsertedRanges();\n                }\n            }\n\n            this.#started =\n                false;'''
once(needle, replacement, 'stop closes open-ended insert')

for needle in [
    '#calculatedEndTime;',
    'this.#calculatedEndTime =\n                this.#scheduledStartMilliseconds +',
    '"overtime"',
    '#extendCalculatedEndTime(',
    'openRecord.openEnded =\n                        false;'
]:
    if needle not in s:
        raise SystemExit(f'missing expected code: {needle}')

p.write_text(s)
