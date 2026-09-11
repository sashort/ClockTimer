from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

start = s.index('        get standardTime() {\n')
end = s.index('        #getStartTimeMilliseconds() {\n', start)

replacement = r'''        get standardTime() {
            return this.#standardTime;
        }

        set standardTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateDurationTime(
                        value,
                        "standardTime"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousDuration =
                this.#standardDuration;

            this.#standardTime =
                this.#formatStandardTime(
                    parsed.total
                );

            this.#standardDuration =
                parsed.total;

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousDuration
                )
            ) {
                this.#calculatedEndTime +=
                    parsed.total -
                    previousDuration;
            }

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );
        }

        get creationTime() {
            return this.#creationTime;
        }

        set creationTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "creationTime"
                    );
            }
            catch {
                return;
            }

            this.#creationTime =
                this.#formatStandardTime(
                    parsed.total,
                    { clock: true }
                );

            this.#creationMilliseconds =
                parsed.total;
        }

        get scheduledStart() {
            return this.#scheduledStart;
        }

        set scheduledStart(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "scheduledStart"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousScheduledStart =
                this.#scheduledStartMilliseconds;

            const milliseconds =
                this.#resolveNear(
                    parsed.total,
                    this.#creationMilliseconds
                );

            this.#scheduledStartMilliseconds =
                milliseconds;

            this.#scheduledStart =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousScheduledStart
                )
            ) {
                this.#calculatedEndTime +=
                    milliseconds -
                    previousScheduledStart;
            }

            this.#tickAlignmentMilliseconds =
                this.#millisecondsComponent(
                    milliseconds
                );

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#stopTickTimer();

            if (this.#needsTick()) {
                this.#scheduleNextTick();
            }
        }

        get startTime() {
            if (!this.#hasStartProperties()) {
                return undefined;
            }

            const milliseconds =
                this.#getStartTimeMilliseconds();

            return Number.isFinite(milliseconds)
                ? this.#formatTimelineTime(
                    milliseconds
                )
                : undefined;
        }

        set startTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "startTime"
                    );
            }
            catch {
                return;
            }

            const milliseconds =
                this.#resolveNear(
                    parsed.total,
                    this.#scheduledStartMilliseconds
                );

            this.#refreshAfterStartPropertyChange(
                milliseconds
            );
        }

        #refreshAfterStartPropertyChange(
            startTimeMilliseconds =
                this.#getStartTimeMilliseconds()
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            this.#reconcilePlannedRanges({
                startTimeMilliseconds
            });

            this.#removeOvertimeRanges();

            let now;

            if (this.#started) {
                now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(
                    now
                );

                this.#updateOvertimeRanges(
                    now
                );
            }

            this.#reapplyOverwriteRanges();

            this.#refreshRingLayout(
                this.#started
                    ? now
                    : startTimeMilliseconds,
                { refreshTickMarks: true }
            );
        }

        #hasStartProperties() {
            return (
                this.#standardTime !== undefined &&
                this.#creationTime !== undefined &&
                this.#scheduledStart !== undefined
            );
        }

'''

s = s[:start] + replacement + s[end:]
p.write_text(s)
