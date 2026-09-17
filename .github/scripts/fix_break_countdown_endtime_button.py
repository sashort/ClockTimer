from pathlib import Path

# ClockTimer.js
path = Path('ClockTimer.js')
text = path.read_text()
old = '''            if (record?.clockTimerBufferedIntervalRecordId) {
                const buffered = this.#insertedRanges.find(
                    candidate => candidate.id === record.clockTimerBufferedIntervalRecordId
                );
                if (buffered) {
                    intervalType = buffered.type;
                    phase = `${record.clockTimerBufferPosition || "buffer"}-buffer`;
                }
            }
'''
new = '''            if (record?.clockTimerBufferedIntervalRecordId) {
                const buffered = this.#insertedRanges.find(
                    candidate => candidate.id === record.clockTimerBufferedIntervalRecordId
                );
                if (buffered) {
                    intervalType = buffered.type;
                    phase = `${record.clockTimerBufferPosition || "buffer"}-buffer`;
                    record = buffered;
                }
            }
'''
if text.count(old) != 1:
    raise SystemExit(f'ClockTimer.js buffered owner block count={text.count(old)}')
text = text.replace(old, new)

old = '''            if (!record || !Number.isFinite(start)) {
                return undefined;
            }

            const elapsedMilliseconds = Math.max(0, timelineNow - start);
            const remainingMilliseconds = Number.isFinite(end)
                ? Math.max(0, end - timelineNow)
                : undefined;
'''
new = '''            if (!record || !Number.isFinite(start)) {
                return undefined;
            }

            if (
                intervalType === "break" ||
                intervalType === "lunch"
            ) {
                const bufferedEnd =
                    this.#getPendingIntervalElapsedBoundary(
                        record
                    );

                if (Number.isFinite(bufferedEnd)) {
                    end = bufferedEnd;
                }
            }

            const elapsedMilliseconds = Math.max(0, timelineNow - start);
            const remainingMilliseconds = Number.isFinite(end)
                ? Math.max(0, end - timelineNow)
                : undefined;
'''
if text.count(old) != 1:
    raise SystemExit(f'ClockTimer.js active interval boundary block count={text.count(old)}')
text = text.replace(old, new)

old = '''            else if (this.#renderedTimeMode === "calculated-end") {
                renderedTime = this.#formatSummaryEndTime(
                    new Date(nowDate.getTime() + remainingMilliseconds)
                );
            }
'''
new = '''            else if (this.#renderedTimeMode === "calculated-end") {
                let intervalAdjustmentMilliseconds = 0;

                const activeInterval =
                    this.getActiveIntervalState(
                        nowDate
                    );

                const activeIntervalType =
                    String(
                        activeInterval?.intervalType ?? ""
                    ).trim().toLowerCase();

                if (
                    (
                        activeIntervalType === "break" ||
                        activeIntervalType === "lunch"
                    ) &&
                    Number.isFinite(
                        activeInterval?.remainingMilliseconds
                    )
                ) {
                    intervalAdjustmentMilliseconds =
                        activeInterval.remainingMilliseconds;
                }

                renderedTime = this.#formatSummaryEndTime(
                    new Date(
                        nowDate.getTime() +
                        remainingMilliseconds +
                        intervalAdjustmentMilliseconds
                    )
                );
            }
'''
if text.count(old) != 1:
    raise SystemExit(f'ClockTimer.js total end block count={text.count(old)}')
text = text.replace(old, new)
path.write_text(text)

# app.js
path = Path('app.js')
text = path.read_text()
old = '''    function renderTripActionState(now = new Date()) {
        if (!tripIsLive()) {
            app.dataset.intervalState = "none";
            endTripButton.textContent = "End Trip";
'''
new = '''    function setEndTripButtonIntervalPalette(intervalType) {
        const normalized =
            String(intervalType || "")
                .trim()
                .toLowerCase();

        if (normalized === "break") {
            endTripButton.style.background =
                "var(--timer-break-color, #001e60)";
            endTripButton.style.color =
                "var(--timer-break-text-color, #ffffff)";
            return;
        }

        if (normalized === "lunch") {
            endTripButton.style.background =
                "var(--timer-lunch-color, #ffc420)";
            endTripButton.style.color =
                "var(--timer-lunch-text-color, #000000)";
            return;
        }

        endTripButton.style.removeProperty(
            "background"
        );
        endTripButton.style.removeProperty(
            "color"
        );
    }

    function renderTripActionState(now = new Date()) {
        if (!tripIsLive()) {
            app.dataset.intervalState = "none";
            setEndTripButtonIntervalPalette();
            endTripButton.textContent = "End Trip";
'''
if text.count(old) != 1:
    raise SystemExit(f'app.js render start block count={text.count(old)}')
text = text.replace(old, new)

old = '''        if (intervalType === "down") {
            app.dataset.intervalState = "down";
            endTripButton.textContent =
'''
new = '''        if (intervalType === "down") {
            app.dataset.intervalState = "down";
            setEndTripButtonIntervalPalette();
            endTripButton.textContent =
'''
if text.count(old) != 1:
    raise SystemExit(f'app.js down block count={text.count(old)}')
text = text.replace(old, new)

old = '''        if (intervalType === "break" || intervalType === "lunch") {
            app.dataset.intervalState = "break";
            const label = intervalType === "lunch" ? "Lunch" : "Break";
'''
new = '''        if (intervalType === "break" || intervalType === "lunch") {
            app.dataset.intervalState = "break";
            setEndTripButtonIntervalPalette(
                intervalType
            );
            const label = intervalType === "lunch" ? "Lunch" : "Break";
'''
if text.count(old) != 1:
    raise SystemExit(f'app.js break block count={text.count(old)}')
text = text.replace(old, new)

old = '''        app.dataset.intervalState = "normal";
        endTripButton.textContent = "End Trip";
'''
new = '''        app.dataset.intervalState = "normal";
        setEndTripButtonIntervalPalette();
        endTripButton.textContent = "End Trip";
'''
if text.count(old) != 1:
    raise SystemExit(f'app.js normal block count={text.count(old)}')
text = text.replace(old, new)
path.write_text(text)
