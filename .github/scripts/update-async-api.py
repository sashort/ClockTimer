from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()


def section(start_marker, end_marker):
    global s
    a = s.index(start_marker)
    b = s.index(end_marker, a)
    return a, b, s[a:b]


def replace_section(start_marker, end_marker, transform):
    global s
    a, b, block = section(start_marker, end_marker)
    new = transform(block)
    s = s[:a] + new + s[b:]

# Add async dispatch for the new previous-direction replacements.
needle = '''                        case "replaceToNext":\n                            this.replaceToNext(operation.value);\n                            break;\n\n                        case "closeOpenRange":'''
replacement = '''                        case "replaceToNext":\n                            this.replaceToNext(operation.value);\n                            break;\n\n                        case "replaceWithPrevious":\n                            this.replaceWithPrevious();\n                            break;\n\n                        case "replaceToPrevious":\n                            this.replaceToPrevious(operation.value);\n                            break;\n\n                        case "closeOpenRange":'''
if needle not in s:
    raise SystemExit('async dispatch anchor not found')
s = s.replace(needle, replacement, 1)

# start(): validate without throwing, and return boolean success.
def patch_start(block):
    anchor = '''        start({\n            standardTime,\n            creationTime,\n            startTime,\n            scheduledStart\n        } = {}) {\n'''
    preflight = anchor + '''            try {\n                this.#validateDurationTime(\n                    standardTime,\n                    "standardTime"\n                );\n\n                if (creationTime !== undefined) {\n                    this.#validateClockTime(\n                        creationTime,\n                        "creationTime"\n                    );\n                }\n\n                if (scheduledStart !== undefined) {\n                    this.#validateClockTime(\n                        scheduledStart,\n                        "scheduledStart"\n                    );\n                }\n\n                if (startTime !== undefined) {\n                    this.#validateClockTime(\n                        startTime,\n                        "startTime"\n                    );\n                }\n            }\n            catch {\n                return false;\n            }\n\n'''
    if anchor not in block:
        raise SystemExit('start header not found')
    block = block.replace(anchor, preflight, 1)
    block = block.replace('''                return this;\n            }\n\n            this.#preserveInsertedOnClear =''', '''                return true;\n            }\n\n            this.#preserveInsertedOnClear =''', 1)
    idx = block.rfind('            return this;')
    if idx < 0:
        raise SystemExit('start final return not found')
    block = block[:idx] + '            return true;' + block[idx + len('            return this;'):]
    return block
replace_section('        start({\n', '        #cloneInsertedRecords(', patch_start)

# reset(): no throw; boolean success.
def patch_reset(block):
    old = '''            if (!this.#startResetState) {\n                throw new Error(\n                    "reset() cannot be called before start() or after clear()."\n                );\n            }'''
    if old not in block:
        raise SystemExit('reset throw guard not found')
    block = block.replace(old, '''            if (!this.#startResetState) {\n                return false;\n            }''', 1)
    block = block.replace('''                return this;\n            }\n\n            const baseline =''', '''                return true;\n            }\n\n            const baseline =''', 1)
    idx = block.rfind('            return this;')
    if idx < 0:
        raise SystemExit('reset final return not found')
    block = block[:idx] + '            return true;' + block[idx + len('            return this;'):]
    return block
replace_section('        reset() {\n', '        #typeExtendsCalculatedEndTime(', patch_reset)

# insert(): failures/queued operations return no value; successful immediate insert returns the created TimeRange.
def patch_insert(block):
    block = block.replace('return false;', 'return;')
    block = block.replace('''                return true;\n            }\n\n            if (\n                typeof type''', '''                return;\n            }\n\n            if (\n                typeof type''', 1)
    needle = '''            this.#renderAllInsertedRanges();\n\n            if (\n                this.#needsTick()\n            ) {\n                this.#startTickTimer();\n            }\n\n            return true;'''
    replacement = '''            this.#renderAllInsertedRanges();\n\n            const insertedElement =\n                this.#getManagedTimeRanges()\n                    .find(\n                        candidate =>\n                            candidate.clockTimerInserted ===\n                                record.id\n                    );\n\n            if (\n                this.#needsTick()\n            ) {\n                this.#startTickTimer();\n            }\n\n            return insertedElement;'''
    if needle not in block:
        raise SystemExit('insert final block not found')
    return block.replace(needle, replacement, 1)
replace_section('        insert({\n', '        overwrite({\n', patch_insert)

# overwrite(): failures/queued operations return no value; successful immediate overwrite returns its first rendered TimeRange.
def patch_overwrite(block):
    block = block.replace('return false;', 'return;')
    block = block.replace('''                return true;\n            }\n\n            if (\n                typeof type''', '''                return;\n            }\n\n            if (\n                typeof type''', 1)
    open_old = '''                this.#renderOverwriteRecord(\n                    record\n                );\n\n                this.#refreshRingLayout(\n                    start,\n                    { refreshTickMarks: true }\n                );\n\n                this.#stopTickTimer();\n                this.#scheduleNextTick();\n\n                return true;'''
    open_new = '''                this.#renderOverwriteRecord(\n                    record\n                );\n\n                const overwriteElement =\n                    this.#getManagedTimeRanges()\n                        .find(\n                            candidate =>\n                                candidate.clockTimerOverwrite ===\n                                    record.id\n                        );\n\n                this.#refreshRingLayout(\n                    start,\n                    { refreshTickMarks: true }\n                );\n\n                this.#stopTickTimer();\n                this.#scheduleNextTick();\n\n                return overwriteElement;'''
    if open_old not in block:
        raise SystemExit('open overwrite return block not found')
    block = block.replace(open_old, open_new, 1)
    closed_old = '''            this.#renderOverwriteRecord(\n                record\n            );\n\n            this.#refreshRingLayout(\n                this.#started\n                    ? this.#getCurrentTimelineTime()\n                    : start,\n                { refreshTickMarks: true }\n            );\n\n            return true;'''
    closed_new = '''            this.#renderOverwriteRecord(\n                record\n            );\n\n            const overwriteElement =\n                this.#getManagedTimeRanges()\n                    .find(\n                        candidate =>\n                            candidate.clockTimerOverwrite ===\n                                record.id\n                    );\n\n            this.#refreshRingLayout(\n                this.#started\n                    ? this.#getCurrentTimelineTime()\n                    : start,\n                { refreshTickMarks: true }\n            );\n\n            return overwriteElement;'''
    if closed_old not in block:
        raise SystemExit('closed overwrite return block not found')
    return block.replace(closed_old, closed_new, 1)
replace_section('        overwrite({\n', '        #adjustCalculatedEndTime(', patch_overwrite)

# close(): remove its exception and use boolean success.
def patch_close(block):
    old = '''            if (!openInsert && !openOverwrite) {\n                throw new Error(\n                    "close() requires an open-ended insert or overwrite."\n                );\n            }'''
    if old not in block:
        raise SystemExit('close throw guard not found')
    block = block.replace(old, '''            if (!openInsert && !openOverwrite) {\n                return false;\n            }''', 1)
    idx = block.rfind('            return this;')
    if idx < 0:
        raise SystemExit('close final return not found')
    return block[:idx] + '            return true;' + block[idx + len('            return this;'):]
replace_section('        close() {\n', '        closeOpenRange() {\n', patch_close)

# replaceWithNext(): return the modified TimeRange, otherwise undefined.
def patch_replace_with_next(block):
    block = block.replace('return false;', 'return;')
    block = block.replace('''                return true;\n            }''', '''                return;\n            }''', 1)
    idx = block.rfind('            return true;')
    if idx < 0:
        raise SystemExit('replaceWithNext final return not found')
    return block[:idx] + '            return nextRange;' + block[idx + len('            return true;'):]
replace_section('        replaceWithNext() {\n', '        replaceToNext(\n', patch_replace_with_next)

# replaceToNext(): no throw; return replacement element or undefined.
def patch_replace_to_next(block):
    throw_guard = '''            if (!this.#hasStartProperties()) {\n                throw new Error(\n                    "replaceToNext() cannot be called before start() or after clear()."\n                );\n            }\n\n'''
    if throw_guard not in block:
        raise SystemExit('replaceToNext throw guard not found')
    block = block.replace(throw_guard, '''            if (!this.#hasStartProperties()) {\n                return;\n            }\n\n''', 1)
    block = block.replace('return false;', 'return;')
    block = block.replace('''                return true;\n            }''', '''                return;\n            }''', 1)
    return block
replace_section('        replaceToNext(\n', '        clear() {\n', patch_replace_to_next)

# Add mirror previous-direction replacement methods.
insert_at = s.index('        clear() {\n')
previous_methods = r'''        replaceWithPrevious() {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceWithPrevious"
                });

                return;
            }

            if (!this.#started) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            let currentRange;
            let currentStart =
                -Infinity;

            let previousRange;
            let previousEnd =
                -Infinity;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }

                if (
                    Number.isFinite(end) &&
                    end <= now &&
                    end > previousEnd
                ) {
                    previousRange =
                        range;

                    previousEnd =
                        end;
                }
            }

            if (
                !currentRange ||
                !previousRange ||
                previousEnd >= now
            ) {
                return;
            }

            this.#extendCalculatedEndTime(
                now - previousEnd,
                previousRange.getAttribute(
                    "type"
                )
            );

            this.#setRangeEnd(
                previousRange,
                now
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }

            return previousRange;
        }

        replaceToPrevious(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceToPrevious",
                    value: type
                });

                return;
            }

            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            let currentRange;
            let currentStart =
                -Infinity;

            let previousRange;
            let previousEnd =
                -Infinity;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }

                if (
                    Number.isFinite(end) &&
                    end <= now &&
                    end > previousEnd
                ) {
                    previousRange =
                        range;

                    previousEnd =
                        end;
                }
            }

            if (
                !currentRange ||
                !previousRange ||
                previousEnd >= now
            ) {
                return;
            }

            this.#setRangeStart(
                currentRange,
                now
            );

            const replacementType =
                type.trim();

            this.#extendCalculatedEndTime(
                now - previousEnd,
                replacementType
            );

            const replacement =
                this.#createTimeRange(
                    replacementType,
                    previousEnd,
                    now,
                    {
                        dynamic: true
                    }
                );

            replacement.setAttribute(
                "data-time-range-full-entry",
                ""
            );

            const ring =
                currentRange.parentElement;

            if (!ring) {
                return;
            }

            ring.insertBefore(
                replacement,
                currentRange
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }

            return replacement;
        }

'''
s = s[:insert_at] + previous_methods + s[insert_at:]

# clear(): valid only when start state exists; boolean success, including queued clear.
def patch_clear(block):
    header = '        clear() {\n'
    if not block.startswith(header):
        raise SystemExit('clear header not found')
    block = block.replace(header, header + '''            if (!this.#hasStartProperties()) {\n                return false;\n            }\n\n''', 1)
    block = block.replace('''                return;\n            }\n\n            this.#stopTickTimer();''', '''                return true;\n            }\n\n            this.#stopTickTimer();''', 1)
    tail = '''            this.#refreshRingLayout(\n                undefined,\n                {\n                    refreshTickMarks: true\n                }\n            );\n'''
    if tail not in block:
        raise SystemExit('clear tail not found')
    return block.replace(tail, tail + '''\n            return true;\n''', 1)
replace_section('        clear() {\n', '        #ensureAttributes() {\n', patch_clear)

# stop() should discard queued previous-direction replacements too.
needle = '''                        operation.type !==\n                            "replaceToNext"'''
if needle in s:
    s = s.replace(needle, '''                        operation.type !==\n                            "replaceToNext" &&\n                        operation.type !==\n                            "replaceWithPrevious" &&\n                        operation.type !==\n                            "replaceToPrevious"''', 1)
else:
    # Alternate compact formatting fallback.
    needle2 = 'operation.type !== "replaceToNext"'
    if needle2 not in s:
        raise SystemExit('stop async filter anchor not found')
    s = s.replace(needle2, 'operation.type !== "replaceToNext" &&\n                        operation.type !== "replaceWithPrevious" &&\n                        operation.type !== "replaceToPrevious"', 1)

p.write_text(s)
