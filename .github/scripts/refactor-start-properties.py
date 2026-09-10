from pathlib import Path
import re

p = Path('ClockTimer.js')
s = p.read_text()

def once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)

def replace_in_method(start_marker, end_marker, transform, label):
    global s
    start = s.find(start_marker)
    if start < 0:
        raise SystemExit(f'{label}: start marker not found')
    end = s.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'{label}: end marker not found')
    body = s[start:end]
    new_body = transform(body)
    if new_body == body:
        raise SystemExit(f'{label}: method body unchanged')
    s = s[:start] + new_body + s[end:]

# startTime is represented by the generated earlystart/prestart TimeRanges,
# not by retained ClockTimer private fields.
once('''        #scheduledStartMilliseconds;\n\n        #startTime;\n\n        #startTimeMilliseconds;\n\n        #standardTime;''', '''        #scheduledStartMilliseconds;\n\n        #standardTime;''', 'remove startTime fields')

# Public property API. The three start configuration properties are retained;
# startTime is derived from the planned TimeRanges.
marker = '''        suspendUpdate() {\n'''
api = '''        get standardTime() {\n            return this.#standardTime;\n        }\n\n        set standardTime(value) {\n            this.#assertStartPropertiesInitialized(\n                "standardTime"\n            );\n\n            const parsed =\n                this.#validateDurationTime(\n                    value,\n                    "standardTime"\n                );\n\n            this.#standardTime =\n                this.#formatStandardTime(\n                    parsed.total\n                );\n\n            this.#standardDuration =\n                parsed.total;\n        }\n\n        get creationTime() {\n            return this.#creationTime;\n        }\n\n        set creationTime(value) {\n            this.#assertStartPropertiesInitialized(\n                "creationTime"\n            );\n\n            const parsed =\n                this.#validateClockTime(\n                    value,\n                    "creationTime"\n                );\n\n            this.#creationTime =\n                this.#formatStandardTime(\n                    parsed.total,\n                    { clock: true }\n                );\n\n            this.#creationMilliseconds =\n                parsed.total;\n        }\n\n        get scheduledStart() {\n            return this.#scheduledStart;\n        }\n\n        set scheduledStart(value) {\n            this.#assertStartPropertiesInitialized(\n                "scheduledStart"\n            );\n\n            const parsed =\n                this.#validateClockTime(\n                    value,\n                    "scheduledStart"\n                );\n\n            this.#scheduledStartMilliseconds =\n                this.#resolveNear(\n                    parsed.total,\n                    this.#creationMilliseconds\n                );\n\n            this.#scheduledStart =\n                this.#formatTimelineTime(\n                    this.#scheduledStartMilliseconds\n                );\n        }\n\n        get startTime() {\n            if (!this.#hasStartProperties()) {\n                return undefined;\n            }\n\n            const milliseconds =\n                this.#getStartTimeMilliseconds();\n\n            return Number.isFinite(milliseconds)\n                ? this.#formatTimelineTime(\n                    milliseconds\n                )\n                : undefined;\n        }\n\n        set startTime(value) {\n            this.#assertStartPropertiesInitialized(\n                "startTime"\n            );\n\n            const parsed =\n                this.#validateClockTime(\n                    value,\n                    "startTime"\n                );\n\n            const milliseconds =\n                this.#resolveNear(\n                    parsed.total,\n                    this.#scheduledStartMilliseconds\n                );\n\n            this.#reconcilePlannedRanges({\n                startTimeMilliseconds:\n                    milliseconds\n            });\n\n            this.#refreshRingLayout(\n                this.#started\n                    ? this.#getCurrentTimelineTime()\n                    : milliseconds,\n                { refreshTickMarks: true }\n            );\n        }\n\n        #hasStartProperties() {\n            return (\n                this.#standardTime !== undefined &&\n                this.#creationTime !== undefined &&\n                this.#scheduledStart !== undefined\n            );\n        }\n\n        #assertStartPropertiesInitialized(name) {\n            if (this.#hasStartProperties()) {\n                return;\n            }\n\n            throw new Error(\n                `${name} cannot be set before start() or after clear().`\n            );\n        }\n\n        #getStartTimeMilliseconds() {\n            if (!this.#hasStartProperties()) {\n                return undefined;\n            }\n\n            const ranges =\n                this.#getManagedTimeRanges()\n                    .filter(\n                        range =>\n                            range.clockTimerPlanned !==\n                                undefined\n                    );\n\n            const earlyStarts =\n                ranges\n                    .filter(\n                        range =>\n                            range.getAttribute(\n                                "type"\n                            ) === "earlystart"\n                    )\n                    .map(\n                        range =>\n                            Number(\n                                range.clockTimerStart\n                            )\n                    )\n                    .filter(Number.isFinite);\n\n            if (earlyStarts.length > 0) {\n                return Math.min(\n                    ...earlyStarts\n                );\n            }\n\n            const prestartEnds =\n                ranges\n                    .filter(\n                        range =>\n                            range.getAttribute(\n                                "type"\n                            ) === "prestart"\n                    )\n                    .map(\n                        range =>\n                            Number(\n                                range.clockTimerEnd\n                            )\n                    )\n                    .filter(Number.isFinite);\n\n            if (prestartEnds.length > 0) {\n                return Math.max(\n                    ...prestartEnds\n                );\n            }\n\n            return this.#scheduledStartMilliseconds;\n        }\n\n'''
once(marker, api + marker, 'insert public start property API')

# Central date/time validation helpers shared by start(), stop(), setters,
# and any other methods that need the same input rules.
parse_marker = '''        #parseStandardTime(\n            value,\n'''
helpers = '''        #validateClockTime(\n            value,\n            name = "time"\n        ) {\n            return this.#parseStandardTime(\n                value,\n                {\n                    duration: false,\n                    name\n                }\n            );\n        }\n\n        #validateDurationTime(\n            value,\n            name = "duration"\n        ) {\n            return this.#parseStandardTime(\n                value,\n                {\n                    duration: true,\n                    name\n                }\n            );\n        }\n\n'''
once(parse_marker, helpers + parse_marker, 'insert validation helpers')

# Use the shared validators in stop() and pending-start alignment.
once('''            const parsed =\n                this.#parseStandardTime(\n                    parsedStop,\n                    {\n                        duration: false,\n                        name: "stopTime"\n                    }\n                );''', '''            const parsed =\n                this.#validateClockTime(\n                    parsedStop,\n                    "stopTime"\n                );''', 'stop validation helper')
once('''                const parsed =\n                    this.#parseStandardTime(\n                        value,\n                        {\n                            duration: false,\n                            name: "scheduledStart"\n                        }\n                    );''', '''                const parsed =\n                    this.#validateClockTime(\n                        value,\n                        "scheduledStart"\n                    );''', 'alignment validation helper')

# start() validates through helpers and keeps actual start only as a local value
# long enough to construct its special TimeRange.
once('''            const standard =\n                this.#parseStandardTime(\n                    standardTime,\n                    {\n                        duration: true,\n                        name: "standardTime"\n                    }\n                );''', '''            const standard =\n                this.#validateDurationTime(\n                    standardTime,\n                    "standardTime"\n                );''', 'standardTime validation')
once('''            const creation =\n                this.#parseStandardTime(\n                    creationTime,\n                    {\n                        duration: false,\n                        name: "creationTime"\n                    }\n                );''', '''            const creation =\n                this.#validateClockTime(\n                    creationTime,\n                    "creationTime"\n                );''', 'creationTime validation')
once('''            const scheduled =\n                this.#parseStandardTime(\n                    scheduledStart,\n                    {\n                        duration: false,\n                        name: "scheduledStart"\n                    }\n                );''', '''            const scheduled =\n                this.#validateClockTime(\n                    scheduledStart,\n                    "scheduledStart"\n                );''', 'scheduledStart validation')

start_block = '''            if (\n                startTime !==\n                    undefined\n            ) {\n                const parsedStart =\n                    this.#parseStandardTime(\n                        startTime,\n                        {\n                            duration: false,\n                            name: "startTime"\n                        }\n                    );\n\n                this.#startTimeMilliseconds =\n                    this.#resolveNear(\n                        parsedStart.total,\n                        this.#scheduledStartMilliseconds\n                    );\n\n                this.#startTime =\n                    this.#formatTimelineTime(\n                        this.#startTimeMilliseconds\n                    );\n            }\n            else {\n                this.#startTime =\n                    undefined;\n\n                this.#startTimeMilliseconds =\n                    undefined;\n            }'''
start_new = '''            let startTimeMilliseconds =\n                this.#scheduledStartMilliseconds;\n\n            if (\n                startTime !==\n                    undefined\n            ) {\n                const parsedStart =\n                    this.#validateClockTime(\n                        startTime,\n                        "startTime"\n                    );\n\n                startTimeMilliseconds =\n                    this.#resolveNear(\n                        parsedStart.total,\n                        this.#scheduledStartMilliseconds\n                    );\n            }'''
once(start_block, start_new, 'startTime local calculation')
once('''                this.#buildPlannedRanges();''', '''                this.#buildPlannedRanges(\n                    startTimeMilliseconds\n                );''', 'pass startTime to initial planned ranges')

# clear() already clears the retained three properties; startTime has no backing state.
once('''            this.#startTime =\n                undefined;\n\n            this.#startTimeMilliseconds =\n                undefined;\n\n            this.#standardTime =''', '''            this.#standardTime =''', 'remove clear startTime state')

# Planned reconciliation can derive actual start from TimeRanges or accept an explicit
# local value from start()/the startTime setter.
once('''        #getPlannedSegments() {\n            const spans = [];''', '''        #getPlannedSegments(\n            startTimeMilliseconds =\n                this.#getStartTimeMilliseconds()\n        ) {\n            const spans = [];''', 'getPlannedSegments parameter')

def planned_transform(body):
    return body.replace(
        'this.#startTimeMilliseconds',
        'startTimeMilliseconds'
    )
replace_in_method(
    '        #getPlannedSegments(',
    '        #reconcilePlannedRanges(',
    planned_transform,
    'derive startTime in getPlannedSegments'
)

once('''        #reconcilePlannedRanges({\n            counterclockwiseOvertimeRemoval = false\n        } = {}) {\n            const desired =\n                this.#getPlannedSegments();''', '''        #reconcilePlannedRanges({\n            counterclockwiseOvertimeRemoval = false,\n            startTimeMilliseconds\n        } = {}) {\n            const desired =\n                this.#getPlannedSegments(\n                    startTimeMilliseconds\n                );''', 'reconcile startTime override')

# Existing TimeRanges are shifted before schedule markers. No separate actual-start
# state needs to be shifted here.
shift_old = '''            if (\n                Number.isFinite(\n                    this.#startTimeMilliseconds\n                ) &&\n                this.#startTimeMilliseconds >= cutoff\n            ) {\n                this.#startTimeMilliseconds += delta;\n\n                this.#startTime =\n                    this.#formatTimelineTime(\n                        this.#startTimeMilliseconds\n                    );\n            }\n\n'''
once(shift_old, '', 'remove retained startTime shift')

# Initial planned-range construction receives actual start as a local parameter.
once('''        #buildPlannedRanges() {''', '''        #buildPlannedRanges(\n            startTimeMilliseconds =\n                this.#scheduledStartMilliseconds\n        ) {''', 'buildPlannedRanges parameter')
replace_in_method(
    '        #buildPlannedRanges(',
    '        #createSpan(',
    planned_transform,
    'local startTime in buildPlannedRanges'
)

# Normalize both special type names everywhere; the old build method still carried
# the pre-refactor spellings.
s = s.replace('"early-start"', '"earlystart"')
s = s.replace('"late-start"', '"prestart"')

# Invariants.
if '#startTime' in s:
    raise SystemExit('retained #startTime state still present')
if '"early-start"' in s or '"late-start"' in s:
    raise SystemExit('old special TimeRange type names still present')
for needle in [
    'get standardTime()',
    'set standardTime(value)',
    'get creationTime()',
    'set creationTime(value)',
    'get scheduledStart()',
    'set scheduledStart(value)',
    'get startTime()',
    'set startTime(value)',
    '#validateClockTime(',
    '#validateDurationTime(',
    'type: "earlystart"',
    'type: "prestart"'
]:
    if needle not in s:
        raise SystemExit(f'missing expected code: {needle}')

p.write_text(s)
