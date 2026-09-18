from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            if (
                currentInterval?.open &&
                !this.#closeOpenIntervalAt(
                    nowDate,
                    currentInterval
                )
            ) {
                return false;
            }

            let cursor =
                now;
'''

new = '''            if (
                currentInterval?.open &&
                !this.#closeOpenIntervalAt(
                    nowDate,
                    currentInterval
                )
            ) {
                return false;
            }

            let activeEarlyStartOverwrite;

            if (Number.isFinite(duration)) {
                activeEarlyStartOverwrite =
                    this.#overwriteRanges.find(
                        record =>
                            record.type ===
                                "earlystart" &&
                            record.openEnded !==
                                true &&
                            Number.isFinite(
                                record.start
                            ) &&
                            Number.isFinite(
                                record.end
                            ) &&
                            record.start <=
                                now &&
                            now <
                                record.end
                    );
            }

            if (activeEarlyStartOverwrite) {
                this.#trimOverwriteRecords(
                    now,
                    activeEarlyStartOverwrite.end
                );
            }

            let cursor =
                now;
'''

count = text.count(old)
if count != 1:
    raise SystemExit(
        f"expected one startInterval insertion point, found {count}"
    )

text = text.replace(old, new, 1)
path.write_text(text)
