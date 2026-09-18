from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''                    // Planned-range reconciliation is coordinated by ClockTimer.
                    // Do not let TimeRange's generic sibling-overlap resolver
                    // displace an authoritative overwrite while this range connects.
                    range.setAttribute(
                        "ignore-overlaps",
                        ""
                    );

                    ring.appendChild(range);
'''

new = '''                    const TimeRangeClass =
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
'''

count = text.count(old)
if count != 1:
    raise SystemExit(
        f"planned reconcile suspension point: expected one match, found {count}"
    )

text = text.replace(old, new, 1)
path.write_text(text)
