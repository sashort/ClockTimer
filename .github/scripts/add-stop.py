from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

needle = '''        spin(rotations = 1, duration) {\n'''
if needle not in text:
    raise SystemExit('spin method anchor not found')

method = r'''        stop() {
            const stopTime =
                this.#dateToTimelineTime(
                    new Date()
                );

            this.#stopTickTimer();

            this.#started =
                false;

            if (this.#updatesSuspended) {
                const cancelledTypes =
                    new Set([
                        "insert",
                        "replaceWithNext",
                        "replaceToNext"
                    ]);

                this.#asyncOperationBuffer =
                    this.#asyncOperationBuffer.filter(
                        operation =>
                            !cancelledTypes.has(
                                operation.type
                            )
                    );

                this.#asyncResumePending =
                    this.#asyncOperationBuffer.length > 0;
            }

            const ranges =
                Array.from(
                    this.querySelectorAll(
                        "time-range"
                    )
                )
                    .filter(
                        range =>
                            range.getAttribute(
                                "type"
                            ) !== "elapsed"
                    )
                    .map(
                        range => ({
                            range,
                            start:
                                Number(
                                    range.clockTimerStart
                                ),
                            end:
                                Number(
                                    range.clockTimerEnd
                                )
                        })
                    )
                    .filter(
                        item =>
                            Number.isFinite(
                                item.start
                            ) &&
                            Number.isFinite(
                                item.end
                            )
                    )
                    .sort(
                        (a, b) =>
                            a.start - b.start ||
                            a.end - b.end
                    );

            let current;

            for (const item of ranges) {
                if (
                    item.start < stopTime &&
                    stopTime <= item.end
                ) {
                    current =
                        item;
                }
            }

            if (current) {
                current.range.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        stopTime
                    )
                );

                current.range.clockTimerEnd =
                    String(stopTime);
            }

            for (const item of ranges) {
                if (
                    item.range ===
                        current?.range
                ) {
                    continue;
                }

                if (
                    item.start >= stopTime
                ) {
                    item.range.remove();
                }
            }

            if (
                this.#elapsedRange &&
                this.#elapsedRange.isConnected
            ) {
                this.#elapsedRange.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        stopTime
                    )
                );

                this.#elapsedRange.clockTimerEnd =
                    String(stopTime);
            }

            for (
                const [ringIndex, range] of
                    this.#overtimeRanges
            ) {
                if (!range.isConnected) {
                    this.#overtimeRanges.delete(
                        ringIndex
                    );
                }
            }

            if (
                this.#openEndedRange &&
                !this.#openEndedRange.isConnected
            ) {
                this.#openEndedRange =
                    undefined;
            }

            this.#openEndedLastTick =
                stopTime;

            this.#scheduleIndicatorSymbolUpdate();

            return this;
        }

'''

text = text.replace(needle, method + needle, 1)
path.write_text(text)
