from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            const scheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            elapsedBoundary
                        )
                            ? elapsedBoundary
                            : this.#getIntervalRecordEnd(
                                record
                            )
                    )
                    : undefined;
            const lifecycleScheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            Number(
                                record.clockTimerExtensionOriginalEndTimeline
                            )
                        )
                            ? Number(
                                record.clockTimerExtensionOriginalEndTimeline
                            )
                            : this.#getIntervalRecordEnd(
                                record
                            )
                    )
                    : undefined;
'''
new = '''            const recordType =
                String(
                    record?.type ?? ""
                ).trim().toLowerCase();

            const bufferedScheduledEnd =
                record &&
                (
                    recordType === "break" ||
                    recordType === "lunch"
                )
                    ? this.#getPendingIntervalElapsedBoundary(
                        record
                    )
                    : undefined;

            const scheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            elapsedBoundary
                        )
                            ? elapsedBoundary
                            : Number.isFinite(
                                bufferedScheduledEnd
                            )
                                ? bufferedScheduledEnd
                                : this.#getIntervalRecordEnd(
                                    record
                                )
                    )
                    : undefined;
            const lifecycleScheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            bufferedScheduledEnd
                        )
                            ? bufferedScheduledEnd
                            : Number.isFinite(
                                Number(
                                    record.clockTimerExtensionOriginalEndTimeline
                                )
                            )
                                ? Number(
                                    record.clockTimerExtensionOriginalEndTimeline
                                )
                                : this.#getIntervalRecordEnd(
                                    record
                                )
                    )
                    : undefined;
'''
if text.count(old) != 1:
    raise SystemExit(f'endInterval scheduled boundary block count={text.count(old)}')
text = text.replace(old, new)

needle = '''        #endPendingInterval(now) {
            const record =
                this.#pendingIntervalRecord;

            if (!record || !Number.isFinite(now)) {
                return false;
            }

            if (
                record.clockTimerExtensionActive ===
                    true
            ) {
'''
replacement = '''        #endBufferedPendingInterval(
            record,
            now
        ) {
            if (
                !record ||
                !Number.isFinite(now)
            ) {
                return false;
            }

            const type =
                String(
                    record.type ?? ""
                ).trim().toLowerCase();

            if (
                type !== "break" &&
                type !== "lunch"
            ) {
                return false;
            }

            const bufferedStart =
                Number(
                    record.clockTimerBufferedStartTimeline
                );

            const bufferedEnd =
                this.#getPendingIntervalElapsedBoundary(
                    record
                );

            if (
                !Number.isFinite(bufferedStart) ||
                !Number.isFinite(bufferedEnd) ||
                now < bufferedStart ||
                now >= bufferedEnd
            ) {
                return false;
            }

            const startBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "start"
                );

            const endBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "end"
                );

            const linked =
                [
                    startBuffer,
                    record,
                    endBuffer
                ].filter(Boolean);

            for (const candidate of linked) {
                const start =
                    this.#dateToTimelineTime(
                        candidate.startDate
                    );

                const end =
                    this.#getIntervalRecordEnd(
                        candidate
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end)
                ) {
                    continue;
                }

                if (end <= now) {
                    continue;
                }

                if (start >= now) {
                    candidate.clockTimerPendingDelete =
                        true;

                    continue;
                }

                const duration =
                    Math.max(
                        0,
                        now - start
                    );

                candidate.rangeLength =
                    duration;

                candidate.endDate =
                    new Date(
                        candidate.startDate.getTime() +
                        duration
                    );

                candidate.clockTimerExplicitlyEnded =
                    true;

                candidate.clockTimerExplicitEndTimeline =
                    now;

                if (candidate === record) {
                    candidate.clockTimerPersistenceEnd =
                        this.#timelineToISO(
                            now
                        );
                }
            }

            record.clockTimerExplicitlyEnded =
                true;

            record.clockTimerExplicitEndTimeline =
                now;

            this.#pendingIntervalRecord =
                undefined;

            this.#renderAllInsertedRanges();

            this.#rebuildAfterRangeDeletion();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }
            else {
                this.#stopTickTimer();
            }

            return true;
        }

        #endPendingInterval(now) {
            const record =
                this.#pendingIntervalRecord;

            if (!record || !Number.isFinite(now)) {
                return false;
            }

            if (
                this.#endBufferedPendingInterval(
                    record,
                    now
                )
            ) {
                return true;
            }

            if (
                record.clockTimerExtensionActive ===
                    true
            ) {
'''
if text.count(needle) != 1:
    raise SystemExit(f'endPendingInterval insertion point count={text.count(needle)}')
text = text.replace(needle, replacement)
path.write_text(text)

# app.js: make the click path explicitly distinguish Break/Lunch from Down.
path = Path('app.js')
text = path.read_text()
old = '''    async function endCurrentIntervalOrTrip() {
        const interval = clockTimer.getActiveIntervalState?.(new Date());
        const intervalType = String(interval?.intervalType || "").toLowerCase();

        if (["break", "lunch", "down"].includes(intervalType)) {
            await clockTimer.endInterval();
            renderTripActionState();
            return;
        }

        const tripMoment = new Date();
'''
new = '''    async function endCurrentIntervalOrTrip() {
        const interval = clockTimer.getActiveIntervalState?.(new Date());
        const intervalType = String(interval?.intervalType || "").toLowerCase();

        if (intervalType === "break" || intervalType === "lunch") {
            await clockTimer.endInterval();
            updateSummaryValues();
            renderTripActionState();
            return;
        }

        if (intervalType === "down") {
            await clockTimer.endInterval();
            renderTripActionState();
            return;
        }

        const tripMoment = new Date();
'''
if text.count(old) != 1:
    raise SystemExit(f'app endCurrentIntervalOrTrip block count={text.count(old)}')
text = text.replace(old, new)
path.write_text(text)
