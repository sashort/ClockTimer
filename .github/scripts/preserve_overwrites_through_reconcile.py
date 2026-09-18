from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)

replace_once(
'''                    const range =
                        this.#createTimeRange(
                            target.type,
                            target.start,
                            target.end
                        );

                    ring.appendChild(range);
''',
'''                    const range =
                        this.#createTimeRange(
                            target.type,
                            target.start,
                            target.end
                        );

                    // Planned-range reconciliation is coordinated by ClockTimer.
                    // Do not let TimeRange's generic sibling-overlap resolver
                    // displace an authoritative overwrite while this range connects.
                    range.setAttribute(
                        "ignore-overlaps",
                        ""
                    );

                    ring.appendChild(range);
''',
"planned reconcile ignore-overlaps"
)

replace_once(
'''        #syncOpenOverwriteRangeElements(
            record,
            effectiveEnd
        ) {
''',
'''        #syncOverwriteRangeElements(
            record,
            effectiveEnd
        ) {
''',
"rename overwrite sync helper"
)

replace_once(
'''            this.#syncOpenOverwriteRangeElements(
                record,
                now
            );
''',
'''            this.#syncOverwriteRangeElements(
                record,
                now
            );
''',
"open overwrite sync call"
)

replace_once(
'''                if (
                    Number.isFinite(end) &&
                    end > record.start
                ) {
                    this.#applyOverwriteMask(
                        record.start,
                        end
                    );
                }
''',
'''                if (
                    Number.isFinite(end) &&
                    end > record.start
                ) {
                    this.#applyOverwriteMask(
                        record.start,
                        end
                    );

                    // Reconciliation may replace planned TimeRanges. Keep the
                    // overwrite record authoritative by restoring/synchronizing
                    // its visual segments after the mask is applied.
                    this.#syncOverwriteRangeElements(
                        record,
                        end
                    );
                }
''',
"overwrite reapply visual sync"
)

path.write_text(text)
