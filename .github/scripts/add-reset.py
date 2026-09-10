from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

def once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    s = s.replace(old, new, 1)

# Preserve the exact values supplied to start(), plus the effective baseline needed by reset().
once('''        #standardDuration;\n\n        #percentGoal =''', '''        #standardDuration;\n\n        #originalStartArguments;\n\n        #startResetState;\n\n        #restoringStartState =\n            false;\n\n        #percentGoal =''', 'start state fields')

# Public read-only access to the literal values originally supplied to start().
once('''        get standardTime() {\n            return this.#standardTime;\n        }''', '''        get originalStandardTime() {\n            return this.#originalStartArguments\n                ?.standardTime;\n        }\n\n        get originalCreationTime() {\n            return this.#originalStartArguments\n                ?.creationTime;\n        }\n\n        get originalScheduledStart() {\n            return this.#originalStartArguments\n                ?.scheduledStart;\n        }\n\n        get originalStartTime() {\n            return this.#originalStartArguments\n                ?.startTime;\n        }\n\n        get standardTime() {\n            return this.#standardTime;\n        }''', 'original start getters')

# reset() is async like other non-tick mutations.
once('''                        case "overwrite":\n                            this.overwrite(operation.args);\n                            break;\n\n                        case "replaceWithNext":''', '''                        case "overwrite":\n                            this.overwrite(operation.args);\n                            break;\n\n                        case "reset":\n                            this.reset();\n                            break;\n\n                        case "replaceWithNext":''', 'async reset dispatch')

# Capture literal inputs before normalization/defaulting.
once('''        start({\n            standardTime,\n            creationTime,\n            startTime,\n            scheduledStart\n        } = {}) {\n            if (''', '''        start({\n            standardTime,\n            creationTime,\n            startTime,\n            scheduledStart\n        } = {}) {\n            const suppliedStartArguments = {\n                standardTime,\n                creationTime,\n                startTime,\n                scheduledStart\n            };\n\n            if (''', 'capture start inputs')

# Snapshot the successful initial state. During reset(), do not replace this baseline.
once('''            this.#stopTickTimer();\n            this.#scheduleNextTick();\n\n            return this;\n        }\n\n        #typeExtendsCalculatedEndTime(type) {''', '''            this.#stopTickTimer();\n            this.#scheduleNextTick();\n\n            if (!this.#restoringStartState) {\n                this.#originalStartArguments = {\n                    ...suppliedStartArguments\n                };\n\n                this.#startResetState = {\n                    args: {\n                        standardTime:\n                            this.#standardTime,\n                        creationTime:\n                            this.#creationTime,\n                        startTime:\n                            this.#formatTimelineTime(\n                                startTimeMilliseconds\n                            ),\n                        scheduledStart:\n                            this.#scheduledStart\n                    },\n                    startedAtEpoch:\n                        this.#startedAtEpoch,\n                    tickAlignmentMilliseconds:\n                        this.#tickAlignmentMilliseconds,\n                    percentGoal:\n                        this.getAttribute(\n                            "percent-goal"\n                        ),\n                    insertedRanges:\n                        this.#cloneInsertedRecords(\n                            this.#insertedRanges\n                        ),\n                    openEndedRangeId:\n                        this.#openEndedRange?.id,\n                    openEndedLastTick:\n                        this.#openEndedLastTick\n                };\n            }\n\n            return this;\n        }\n\n        #cloneInsertedRecords(records) {\n            return records.map(record => ({\n                ...record,\n                startDate:\n                    new Date(\n                        record.startDate.getTime()\n                    ),\n                endDate:\n                    record.endDate\n                        ? new Date(\n                            record.endDate.getTime()\n                        )\n                        : undefined,\n                otherAttributes: {\n                    ...(record.otherAttributes ?? {})\n                },\n                preservedAttributes:\n                    (record.preservedAttributes ?? [])\n                        .map(snapshot => ({\n                            ...snapshot,\n                            attributes: {\n                                ...(snapshot.attributes ?? {})\n                            }\n                        }))\n            }));\n        }\n\n        reset() {\n            if (!this.#startResetState) {\n                throw new Error(\n                    "reset() cannot be called before start() or after clear()."\n                );\n            }\n\n            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {\n                this.#queueAsyncOperation({\n                    type: "reset"\n                });\n\n                return this;\n            }\n\n            const baseline =\n                this.#startResetState;\n\n            this.#insertedRanges =\n                this.#cloneInsertedRecords(\n                    baseline.insertedRanges\n                );\n\n            this.#openEndedRange =\n                baseline.openEndedRangeId\n                    ? this.#insertedRanges.find(\n                        record =>\n                            record.id ===\n                                baseline.openEndedRangeId\n                    )\n                    : undefined;\n\n            this.#openEndedLastTick =\n                baseline.openEndedLastTick;\n\n            if (baseline.percentGoal === null) {\n                this.removeAttribute(\n                    "percent-goal"\n                );\n            }\n            else {\n                this.setAttribute(\n                    "percent-goal",\n                    baseline.percentGoal\n                );\n            }\n\n            this.#restoringStartState =\n                true;\n\n            try {\n                this.start({\n                    ...baseline.args\n                });\n\n                this.#startedAtEpoch =\n                    baseline.startedAtEpoch;\n\n                this.#tickAlignmentMilliseconds =\n                    baseline.tickAlignmentMilliseconds;\n\n                this.#stopTickTimer();\n                this.#tick();\n                this.#scheduleNextTick();\n            }\n            finally {\n                this.#restoringStartState =\n                    false;\n            }\n\n            return this;\n        }\n\n        #typeExtendsCalculatedEndTime(type) {''', 'snapshot and reset')

# clear() invalidates original/baseline state only when it is a user-visible clear or a new start.
once('''            this.#standardDuration =\n                undefined;\n\n            this.#startedAtEpoch =''', '''            this.#standardDuration =\n                undefined;\n\n            if (!this.#restoringStartState) {\n                this.#originalStartArguments =\n                    undefined;\n\n                this.#startResetState =\n                    undefined;\n            }\n\n            this.#startedAtEpoch =''', 'clear start baseline')

for needle in [
    '#originalStartArguments;',
    '#startResetState;',
    'get originalStandardTime()',
    'reset() {',
    'case "reset":',
    '#cloneInsertedRecords(records)',
    'baseline.startedAtEpoch'
]:
    if needle not in s:
        raise SystemExit(f'missing expected code: {needle}')

p.write_text(s)
