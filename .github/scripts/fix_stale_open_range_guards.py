from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_insert = '''            if (\n                this.#openEndedRange\n            ) {\n                return;\n            }\n'''
new_insert = '''            if (\n                this.#openEndedRange\n            ) {\n                const openRecord =\n                    this.#openEndedRange;\n\n                const hasOpenElement =\n                    this.#getManagedTimeRanges()\n                        .some(\n                            candidate =>\n                                candidate.clockTimerInserted ===\n                                    openRecord.id &&\n                                candidate.isConnected\n                        );\n\n                if (hasOpenElement) {\n                    return;\n                }\n\n                this.#insertedRanges =\n                    this.#insertedRanges.filter(\n                        record =>\n                            record !== openRecord\n                    );\n\n                this.#openEndedRange =\n                    undefined;\n\n                this.#openEndedLastTick =\n                    undefined;\n            }\n'''
if old_insert not in text:
    raise SystemExit('insert open guard not found')
text = text.replace(old_insert, new_insert, 1)

old_overwrite = '''            if (this.#openOverwriteRange) {\n                return;\n            }\n'''
new_overwrite = '''            if (this.#openOverwriteRange) {\n                const openRecord =\n                    this.#openOverwriteRange;\n\n                const hasOpenElement =\n                    this.#getManagedTimeRanges()\n                        .some(\n                            candidate =>\n                                candidate.clockTimerOverwrite ===\n                                    openRecord.id &&\n                                candidate.isConnected\n                        );\n\n                if (hasOpenElement) {\n                    return;\n                }\n\n                this.#overwriteRanges =\n                    this.#overwriteRanges.filter(\n                        record =>\n                            record !== openRecord\n                    );\n\n                this.#openOverwriteRange =\n                    undefined;\n\n                this.#openOverwriteLastTick =\n                    undefined;\n            }\n'''
if old_overwrite not in text:
    raise SystemExit('overwrite open guard not found')
text = text.replace(old_overwrite, new_overwrite, 1)

path.write_text(text)
