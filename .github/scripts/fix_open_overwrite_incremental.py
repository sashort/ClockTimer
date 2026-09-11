from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

needle = '''        #reapplyOverwriteRanges() {
            if (this.#overwriteRanges.length === 0) {
                return;
            }
'''
helper = '''        #syncOpenOverwriteRangeElements(
            record,
            effectiveEnd
        ) {
            if (
                !record ||
                !Number.isFinite(record.start) ||
                !Number.isFinite(effectiveEnd) ||
                effectiveEnd <= record.start
            ) {
                return;
            }

            const existing =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerOverwrite ===
                                record.id &&
                            range.timeRangeExiting !==
                                true
                    )
                    .sort(
                        (a, b) =>
                            Number(a.clockTimerStart) -
                            Number(b.clockTimerStart)
                    );

            let cursor =
                record.start;

            let index =
                0;

            while (cursor < effectiveEnd) {
                const ringIndex =
                    this.#getRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getRingStart(
                        ringIndex
                    ) +
                    ClockTimer.#HOUR;

                const segmentEnd =
                    Math.min(
                        effectiveEnd,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                let range =
                    existing[index];

                if (!range) {
                    range =
                        this.#createTimeRange(
                            record.type,
                            cursor,
                            segmentEnd,
                            { dynamic: true }
                        );

                    delete range.clockTimerDynamic;

                    range.clockTimerOverwrite =
                        record.id;

                    range.timeRangeFullEntry =
                        true;

                    ring.appendChild(
                        range
                    );
                }
                else {
                    if (
                        range.parentElement !==
                            ring
                    ) {
                        ring.appendChild(
                            range
                        );
                    }

                    this.#setRangeTiming(
                        range,
                        cursor,
                        segmentEnd
                    );
                }

                cursor =
                    segmentEnd;

                index++;
            }

            for (
                ;
                index < existing.length;
                index++
            ) {
                const range =
                    existing[index];

                if (
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    range.removeAnimated({
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #reapplyOverwriteRanges() {
            if (this.#overwriteRanges.length === 0) {
                return;
            }
'''

if needle not in text:
    raise SystemExit('reapply anchor not found')
text = text.replace(needle, helper, 1)

old = '''            record.end =
                now;

            this.#renderOverwriteRecord({
                ...record,
                start: previous,
                openEnded: false
            });
'''
new = '''            record.end =
                now;

            this.#syncOpenOverwriteRangeElements(
                record,
                now
            );
'''

if old not in text:
    raise SystemExit('open overwrite tick render block not found')
text = text.replace(old, new, 1)

path.write_text(text)
