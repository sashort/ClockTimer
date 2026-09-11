from pathlib import Path

path = Path('ClockTimer.js')
s = path.read_text()

marker = '''                    this.#buildPlannedRanges(
                        startTimeMilliseconds
                    );

                    for (let index = 1; index < events.length - 1; index++) {'''
insert = '''                    this.#buildPlannedRanges(
                        startTimeMilliseconds
                    );

                    let elapsedCursor =
                        startTimeMilliseconds;

                    while (elapsedCursor < terminal) {
                        const ringIndex =
                            this.#getRingIndex(
                                elapsedCursor
                            );

                        const segmentEnd =
                            Math.min(
                                terminal,
                                this.#getRingStart(
                                    ringIndex
                                ) +
                                    ClockTimer.#HOUR
                            );

                        const ring =
                            this.#ensureRing(
                                ringIndex
                            );

                        const elapsedRange =
                            this.#createTimeRange(
                                "elapsed",
                                elapsedCursor,
                                segmentEnd
                            );

                        elapsedRange.setAttribute(
                            "overlapping",
                            ""
                        );

                        ring.appendChild(
                            elapsedRange
                        );

                        elapsedCursor =
                            segmentEnd;
                    }

                    for (let index = 1; index < events.length - 1; index++) {'''
if marker not in s:
    raise SystemExit('fromJSON insertion point not found')
s = s.replace(marker, insert, 1)

old = '''                    this.#refreshRingLayout(
                        terminal,
                        {
                            refreshTickMarks: true
                        }
                    );'''
new = '''                    this.#refreshRingLayout(
                        Math.max(
                            terminal,
                            this.#standardEnd ?? terminal
                        ),
                        {
                            refreshTickMarks: true
                        }
                    );'''
if old not in s:
    raise SystemExit('fromJSON refresh target not found')
s = s.replace(old, new, 1)

path.write_text(s)
