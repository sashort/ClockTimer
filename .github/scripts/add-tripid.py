from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

# Add private field after creation milliseconds.
old = '''        #creationMilliseconds;\n\n        #scheduledStart;\n'''
new = '''        #creationMilliseconds;\n\n        #tripId;\n\n        #scheduledStart;\n'''
if '#tripId;' not in text:
    if old not in text:
        raise SystemExit('tripId field anchor not found')
    text = text.replace(old, new, 1)

# Add tripId parameter to start.
old = '''        start({\n            standardTime,\n            creationTime,\n            startTime,\n            scheduledStart\n        } = {}) {\n            try {\n'''
new = '''        start({\n            tripId,\n            standardTime,\n            creationTime,\n            startTime,\n            scheduledStart\n        } = {}) {\n            try {\n                if (!Number.isInteger(tripId)) {\n                    throw new TypeError(\n                        "tripId must be a non-null integer."\n                    );\n                }\n\n'''
if old not in text:
    raise SystemExit('start signature anchor not found')
text = text.replace(old, new, 1)

# Preserve supplied args.
old = '''            const suppliedStartArguments = {\n                standardTime,\n                creationTime,\n                startTime,\n                scheduledStart\n            };\n'''
new = '''            const suppliedStartArguments = {\n                tripId,\n                standardTime,\n                creationTime,\n                startTime,\n                scheduledStart\n            };\n'''
if old not in text:
    raise SystemExit('supplied args anchor not found')
text = text.replace(old, new, 1)

# Preserve queued args.
old = '''                const args = {\n                    standardTime,\n                    creationTime,\n                    startTime,\n                    scheduledStart\n                };\n'''
new = '''                const args = {\n                    tripId,\n                    standardTime,\n                    creationTime,\n                    startTime,\n                    scheduledStart\n                };\n'''
if old not in text:
    raise SystemExit('queued args anchor not found')
text = text.replace(old, new, 1)

# Assign tripId only after start validation and clear completes.
old = '''            const standard =\n                this.#validateDurationTime(\n                    standardTime,\n                    "standardTime"\n                );\n'''
new = '''            this.#tripId =\n                tripId;\n\n            const standard =\n                this.#validateDurationTime(\n                    standardTime,\n                    "standardTime"\n                );\n'''
if old not in text:
    raise SystemExit('tripId assignment anchor not found')
text = text.replace(old, new, 1)

# Preserve tripId in reset baseline args.
old = '''                    args: {\n                        standardTime:\n                            this.#standardTime,\n'''
new = '''                    args: {\n                        tripId:\n                            this.#tripId,\n                        standardTime:\n                            this.#standardTime,\n'''
if old not in text:
    raise SystemExit('reset args anchor not found')
text = text.replace(old, new, 1)

# Add creationDate getter immediately before standardTime getter.
anchor = '''        get standardTime() {\n            return this.#standardTime;\n        }\n'''
getter = '''        get creationDate() {\n            return this.#formatJSONDate(\n                this.#getJSONCreationDate()\n            );\n        }\n\n'''
if '        get creationDate() {' not in text:
    if anchor not in text:
        raise SystemExit('creationDate getter anchor not found')
    text = text.replace(anchor, getter + anchor, 1)

# Rewrite toJSON header to use getters and emit tripId first.
old = '''        toJSON() {\n            const creationDate =\n                this.#getJSONCreationDate();\n\n            const result = {\n                creationDate:\n                    this.#formatJSONDate(\n                        creationDate\n                    ),\n                standardTime:\n                    this.#standardTime,\n                scheduledStart:\n                    this.#scheduledStart,\n                records: []\n            };\n\n            if (!creationDate) {\n                return result;\n            }\n'''
new = '''        toJSON() {\n            const creationDate =\n                this.#getJSONCreationDate();\n\n            const result = {\n                tripId:\n                    this.#tripId,\n                creationDate:\n                    this.creationDate,\n                standardTime:\n                    this.standardTime,\n                scheduledStart:\n                    this.scheduledStart,\n                records: []\n            };\n\n            if (!creationDate) {\n                return result;\n            }\n'''
if old not in text:
    raise SystemExit('toJSON header anchor not found')
text = text.replace(old, new, 1)

path.write_text(text)
