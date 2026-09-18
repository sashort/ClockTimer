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

                    const TimeRangeClass =
                        customElements.get(
                            "time-range"
                        );

                    TimeRangeClass?.suspendLayout?.(
                        range
                    );

                    try {
                        ring.appendChild(
                            range
                        );
                    }
                    finally {
                        TimeRangeClass?.resumeLayout?.(
                            range
                        );
                    }
''',
"planned reconcile suspendLayout"
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

                    this.#syncOverwriteRangeElements(
                        record,
                        end
                    );
                }
''',
"overwrite reapply visual sync"
)

path.write_text(text)
