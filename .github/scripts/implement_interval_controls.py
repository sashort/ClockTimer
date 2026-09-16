from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))


def sub_once(path, pattern, replacement, label, flags=re.S | re.M):
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 regex match in {path}, found {count}")
    p.write_text(updated)


# index.html: late-break preference semantics and break-type chooser.
replace_once(
    "index.html",
    '''                <label>When I End Break Late\n                    <select name="intervalElapsedBehavior">\n                        <option value="startLatency">Show Late Window</option>\n                        <option value="rollover">Auto-Restart Trip</option>\n                    </select>\n                </label>''',
    '''                <label>When I End Break Late\n                    <select name="lateBreakBehavior">\n                        <option value="showLateWindow">Show Late Window</option>\n                        <option value="autoRestartTrip">Auto-Restart Trip</option>\n                    </select>\n                </label>''',
    "late-break preference select",
)
replace_once(
    "index.html",
    '''    <dialog id="breakDialog" class="app-dialog break-dialog">\n        <section class="break-dialog-content">\n            <header class="dialog-header">\n                <h2>Break</h2>\n                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>\n            </header>\n            <p>Break options will be added here.</p>\n        </section>\n    </dialog>''',
    '''    <dialog id="breakDialog" class="app-dialog break-dialog">\n        <section class="break-dialog-content">\n            <header class="dialog-header">\n                <h2>Select Break Type</h2>\n                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>\n            </header>\n            <div class="break-type-actions" role="group" aria-label="Break type">\n                <button class="break-type-button" type="button" data-break-type="break">Break</button>\n                <button class="break-type-button lunch" type="button" data-break-type="lunch">Lunch</button>\n                <button class="break-type-button" type="button" data-break-type="short-break">Short Break</button>\n            </div>\n        </section>\n    </dialog>''',
    "break dialog chooser",
)

# app.css: interval control state + chooser design.
css = Path("app.css").read_text()
css += '''\n\n/* Active interval controls */\n.app[data-interval-state="break"] .active-trip-controls {\n    grid-template-rows: 1fr;\n}\n\n.app[data-interval-state="down"] .trip-action-row {\n    grid-template-columns: 1fr;\n}\n\n.app[data-interval-state="down"] .break-button {\n    grid-column: 1 / -1;\n}\n\n.break-dialog {\n    width: min(680px, calc(100vw - 24px));\n}\n\n.break-dialog-content {\n    display: grid;\n    gap: 20px;\n}\n\n.break-type-actions {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n    gap: 12px;\n    padding: 8px 4px 4px;\n}\n\n.break-type-button {\n    min-height: 88px;\n    margin: 0;\n    padding: 12px 8px;\n    border: 3px solid #000;\n    border-radius: 15px;\n    color: var(--wm-white);\n    background: var(--wm-blue-dark);\n    font-size: clamp(18px, 4vw, 28px);\n    font-weight: 700;\n    line-height: 1.05;\n}\n\n.break-type-button.lunch {\n    color: var(--wm-blue-dark);\n    background: var(--wm-yellow);\n}\n\n@media (max-width: 480px) {\n    .break-type-actions { gap: 8px; }\n    .break-type-button { min-height: 78px; }\n}\n'''
Path("app.css").write_text(css)

# ClockTimer.js: expose active interval state, down event, and automatic restart event.
replace_once(
    "ClockTimer.js",
    '''        #intervalElapsedBehavior =\n            "startLatency";''',
    '''        #intervalElapsedBehavior =\n            "startLatency";\n\n        #autoRestartTripAfterLateBreak =\n            false;''',
    "auto restart private state",
)

clock = Path("ClockTimer.js").read_text()
marker = '''        get state() {'''
if clock.count(marker) != 1:
    raise SystemExit(f"public interval-state insertion marker count={clock.count(marker)}")
public_methods = '''        get autoRestartTripAfterLateBreak() {\n            return this.#autoRestartTripAfterLateBreak;\n        }\n\n        set autoRestartTripAfterLateBreak(value) {\n            this.#autoRestartTripAfterLateBreak = Boolean(value);\n        }\n\n        getActiveIntervalState(now = new Date()) {\n            if (!(now instanceof Date) || Number.isNaN(now.getTime())) {\n                throw new TypeError("now must be a valid Date.");\n            }\n\n            const timelineNow = this.#getCurrentTimelineTime(now);\n            const current = this.#getCurrentInterval(timelineNow);\n            let record = current?.record;\n            let currentType = current?.type;\n            let intervalType = current?.type;\n            let phase = current?.type;\n            let start = current?.start;\n            let end = current?.end;\n            let open = current?.open === true;\n\n            if (record?.clockTimerBufferedIntervalRecordId) {\n                const buffered = this.#insertedRanges.find(\n                    candidate => candidate.id === record.clockTimerBufferedIntervalRecordId\n                );\n                if (buffered) {\n                    intervalType = buffered.type;\n                    phase = `${record.clockTimerBufferPosition || "buffer"}-buffer`;\n                }\n            }\n\n            if (!current && this.#pendingIntervalRecord) {\n                record = this.#pendingIntervalRecord;\n                currentType = "latency";\n                intervalType = record.type;\n                phase = record.clockTimerElapsedDispatched === true ? "latency" : "pending";\n                start = this.#dateToTimelineTime(record.startDate);\n                end = Number(record.clockTimerElapsedBoundaryTimeline);\n                if (!Number.isFinite(end)) {\n                    end = this.#getPendingIntervalElapsedBoundary(record);\n                }\n                open = false;\n            }\n\n            if (!record || !Number.isFinite(start)) {\n                return undefined;\n            }\n\n            const elapsedMilliseconds = Math.max(0, timelineNow - start);\n            const remainingMilliseconds = Number.isFinite(end)\n                ? Math.max(0, end - timelineNow)\n                : undefined;\n\n            return {\n                intervalId: Number.isInteger(Number(record.intervalId))\n                    ? Number(record.intervalId)\n                    : undefined,\n                type: currentType,\n                intervalType: String(intervalType || currentType || "").trim(),\n                phase: String(phase || currentType || "").trim(),\n                open,\n                startTime: this.#timelineToISO(start),\n                boundaryTime: Number.isFinite(end) ? this.#timelineToISO(end) : undefined,\n                elapsedMilliseconds,\n                remainingMilliseconds\n            };\n        }\n\n'''
clock = clock.replace(marker, public_methods + marker, 1)
Path("ClockTimer.js").write_text(clock)

# Add downTimeStarted immediately after the generic intervalStarted event and before its return.
clock = Path("ClockTimer.js").read_text()
start_marker = '            this.#emitClockTimerEvent("intervalStarted", {'
start_index = clock.find(start_marker)
if start_index < 0:
    raise SystemExit("intervalStarted marker not found")
return_index = clock.find('\n            return result;', start_index)
if return_index < 0:
    raise SystemExit("intervalStarted return marker not found")
down_event = '''\n\n            if (\n                String(record.type).toLowerCase() === "down" &&\n                record.openEnded === true\n            ) {\n                this.#emitClockTimerEvent("downTimeStarted", {\n                    ...result,\n                    type: record.type,\n                    startTime: record.startDate?.toISOString?.(),\n                    endTime: undefined\n                });\n            }'''
clock = clock[:return_index] + down_event + clock[return_index:]
Path("ClockTimer.js").write_text(clock)

# Auto restart only after latency has actually started at an end-buffer boundary.
clock = Path("ClockTimer.js").read_text()
latency_marker = '''            this.#emitClockTimerEvent(\n                "latencyStarted",'''
latency_index = clock.find(latency_marker)
if latency_index < 0:
    raise SystemExit("latencyStarted marker not found")
latency_return = clock.find('\n            return true;', latency_index)
if latency_return < 0:
    raise SystemExit("latencyStarted return marker not found")
auto_restart = '''\n\n            if (\n                this.#autoRestartTripAfterLateBreak &&\n                decision.boundaryType === "end-buffer" &&\n                ["break", "lunch"].includes(String(record.type).toLowerCase()) &&\n                this.#endPendingInterval(now)\n            ) {\n                this.#emitClockTimerEvent("tripAutomaticallyRestarted", {\n                    intervalId: Number.isInteger(Number(record.intervalId))\n                        ? Number(record.intervalId)\n                        : undefined,\n                    intervalType: record.type,\n                    boundaryType: decision.boundaryType,\n                    boundaryTime: this.#timelineToISO(boundary),\n                    restartTime: this.#timelineToISO(now)\n                });\n                return true;\n            }'''
clock = clock[:latency_return] + auto_restart + clock[latency_return:]
Path("ClockTimer.js").write_text(clock)

# app.js: preference migration, active-control rendering, and interval actions.
replace_once(
    "app.js",
    '''    const TRIP_PREFERENCE_DEFAULTS = {\n        intervalElapsedBehavior: "startLatency",\n        matchTripGoalToTotal: false\n    };''',
    '''    const TRIP_PREFERENCE_DEFAULTS = {\n        lateBreakBehavior: "showLateWindow",\n        matchTripGoalToTotal: false\n    };''',
    "trip preference defaults",
)
replace_once(
    "app.js",
    '''    const activeTripControls = $("#activeTripControls");\n    const breakDialog = $("#breakDialog");''',
    '''    const activeTripControls = $("#activeTripControls");\n    const endTripButton = $("#endTripButton");\n    const tripActionRow = $(".trip-action-row");\n    const breakButton = $("#breakButton");\n    const downButton = $("#downButton");\n    const breakDialog = $("#breakDialog");''',
    "trip action refs",
)
sub_once(
    "app.js",
    r'''    function getTripPreferences\(\) \{.*?^    \}\n\n    function saveTripPreferences''',
    '''    function getTripPreferences() {\n        const stored = getStoredJSON(STORAGE.tripPreferences, TRIP_PREFERENCE_DEFAULTS);\n        const legacy = stored.intervalElapsedBehavior === "rollover"\n            ? "autoRestartTrip"\n            : "showLateWindow";\n        return {\n            lateBreakBehavior: stored.lateBreakBehavior === "autoRestartTrip"\n                ? "autoRestartTrip"\n                : stored.lateBreakBehavior === "showLateWindow"\n                    ? "showLateWindow"\n                    : legacy,\n            matchTripGoalToTotal: Boolean(stored.matchTripGoalToTotal)\n        };\n    }\n\n    function saveTripPreferences''',
    "getTripPreferences",
)
sub_once(
    "app.js",
    r'''    function fillTripPreferencesForm\(preferences = getTripPreferences\(\)\) \{.*?^    \}''',
    '''    function fillTripPreferencesForm(preferences = getTripPreferences()) {\n        const form = $("#stateSettingsForm");\n        form.elements.lateBreakBehavior.value = preferences.lateBreakBehavior;\n        form.elements.matchTripGoalToTotal.checked = Boolean(preferences.matchTripGoalToTotal);\n    }''',
    "fillTripPreferencesForm",
)
sub_once(
    "app.js",
    r'''    \$\("#stateSettingsForm"\)\.addEventListener\("submit", event => \{.*?^    \}\);''',
    '''    $("#stateSettingsForm").addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        const preferences = {\n            lateBreakBehavior:\n                form.elements.lateBreakBehavior.value === "autoRestartTrip"\n                    ? "autoRestartTrip"\n                    : "showLateWindow",\n            matchTripGoalToTotal: form.elements.matchTripGoalToTotal.checked\n        };\n        saveTripPreferences(preferences);\n        if (!tripIsLive() && !tripDraft) {\n            clockTimer.intervalElapsedBehavior = "startLatency";\n            clockTimer.autoRestartTripAfterLateBreak =\n                preferences.lateBreakBehavior === "autoRestartTrip";\n        }\n        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});\n    });''',
    "state settings submit",
)
replace_once(
    "app.js",
    '''        clockTimer.autoSyncTripGoal = Boolean(draft.matchTripGoalToTotal);\n        clockTimer.intervalElapsedBehavior =\n            draft.intervalElapsedBehavior === "rollover"\n                ? "rollover"\n                : "startLatency";''',
    '''        clockTimer.autoSyncTripGoal = Boolean(draft.matchTripGoalToTotal);\n        clockTimer.intervalElapsedBehavior = "startLatency";\n        clockTimer.autoRestartTripAfterLateBreak =\n            draft.lateBreakBehavior === "autoRestartTrip";''',
    "draft start preferences",
)
replace_once(
    "app.js",
    '''            standardTime: newTripInitialValue || "",\n            intervalElapsedBehavior: tripPreferences.intervalElapsedBehavior,\n            matchTripGoalToTotal: tripPreferences.matchTripGoalToTotal''',
    '''            standardTime: newTripInitialValue || "",\n            lateBreakBehavior: tripPreferences.lateBreakBehavior,\n            matchTripGoalToTotal: tripPreferences.matchTripGoalToTotal''',
    "new trip preference draft",
)
replace_once(
    "app.js",
    '''    clockTimer.intervalElapsedBehavior = tripPreferences.intervalElapsedBehavior;''',
    '''    clockTimer.intervalElapsedBehavior = "startLatency";\n    clockTimer.autoRestartTripAfterLateBreak =\n        tripPreferences.lateBreakBehavior === "autoRestartTrip";''',
    "startup late-break preference",
)

app = Path("app.js").read_text()
insert_marker = '''    function setTripControlState(running) {'''
if app.count(insert_marker) != 1:
    raise SystemExit(f"trip-control function marker count={app.count(insert_marker)}")
helpers = '''    function formatIntervalClock(milliseconds) {\n        const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);\n        const minutes = Math.floor(totalSeconds / 60);\n        const seconds = totalSeconds % 60;\n        return `${minutes}:${String(seconds).padStart(2, "0")}`;\n    }\n\n    function renderTripActionState(now = new Date()) {\n        if (!tripIsLive()) {\n            app.dataset.intervalState = "none";\n            endTripButton.textContent = "End Trip";\n            tripActionRow.hidden = false;\n            breakButton.hidden = false;\n            downButton.hidden = false;\n            return;\n        }\n\n        const instant = now instanceof Date && !Number.isNaN(now.getTime())\n            ? now\n            : new Date();\n        const interval = clockTimer.getActiveIntervalState?.(instant);\n        const intervalType = String(interval?.intervalType || "").toLowerCase();\n\n        if (intervalType === "down") {\n            app.dataset.intervalState = "down";\n            endTripButton.textContent =\n                `Resume Trip : ${formatIntervalClock(interval.elapsedMilliseconds)}`;\n            tripActionRow.hidden = false;\n            breakButton.hidden = false;\n            downButton.hidden = true;\n            return;\n        }\n\n        if (intervalType === "break" || intervalType === "lunch") {\n            app.dataset.intervalState = "break";\n            const label = intervalType === "lunch" ? "Lunch" : "Break";\n            endTripButton.textContent =\n                `End ${label} : ${formatIntervalClock(interval.remainingMilliseconds)}`;\n            tripActionRow.hidden = true;\n            breakButton.hidden = true;\n            downButton.hidden = true;\n            return;\n        }\n\n        app.dataset.intervalState = "normal";\n        endTripButton.textContent = "End Trip";\n        tripActionRow.hidden = false;\n        breakButton.hidden = false;\n        downButton.hidden = false;\n    }\n\n    async function endCurrentIntervalOrTrip() {\n        const interval = clockTimer.getActiveIntervalState?.(new Date());\n        const intervalType = String(interval?.intervalType || "").toLowerCase();\n\n        if (["break", "lunch", "down"].includes(intervalType)) {\n            await clockTimer.endInterval();\n            renderTripActionState();\n            return;\n        }\n\n        const tripMoment = new Date();\n        await clockTimer.stop();\n        await clockTimer.clear();\n        await beginNewTripWorkflow({\n            initialValue: "",\n            tripMoment\n        });\n    }\n\n    async function startBreakInterval(kind) {\n        const configs = {\n            break: { type: "break", length: "0:15:00", attributes: { breakType: "break" } },\n            lunch: { type: "lunch", length: "0:30:00", attributes: { breakType: "lunch" } },\n            "short-break": { type: "break", length: "0:10:00", attributes: { breakType: "short" } }\n        };\n        const config = configs[kind];\n        if (!config) return false;\n\n        const active = clockTimer.getActiveIntervalState?.(new Date());\n        if (String(active?.intervalType || "").toLowerCase() === "down") {\n            await clockTimer.endInterval();\n        }\n\n        const result = await clockTimer.startInterval(\n            config.type,\n            config.length,\n            config.attributes,\n            "0:02:30",\n            "0:02:30"\n        );\n        if (result) renderTripActionState();\n        return Boolean(result);\n    }\n\n'''
app = app.replace(insert_marker, helpers + insert_marker, 1)
Path("app.js").write_text(app)

sub_once(
    "app.js",
    r'''    function setTripControlState\(running\) \{.*?^    \}''',
    '''    function setTripControlState(running) {\n        app.dataset.tripState = running ? "running" : "ready";\n        app.dataset.state = clockTimer.status;\n        activeTripControls.hidden = !running;\n        renderTripActionState();\n    }''',
    "setTripControlState",
)

# Replace the primary trip action and Break/Down handlers.
sub_once(
    "app.js",
    r'''    \$\("#endTripButton"\)\.addEventListener\("pointerup", \(\) => \{.*?^    \}\);''',
    '''    endTripButton.addEventListener("pointerup", () => {\n        void endCurrentIntervalOrTrip().catch(() => {});\n    });''',
    "end trip dynamic action",
)
sub_once(
    "app.js",
    r'''    \$\("#breakButton"\)\.addEventListener\("pointerup", \(\) => \{.*?^    \}\);''',
    '''    breakButton.addEventListener("pointerup", () => {\n        openDialog("breakDialog", { reason: "break" });\n    });''',
    "break button",
)
sub_once(
    "app.js",
    r'''    \$\("#downButton"\)\.addEventListener\("pointerup", \(\) => \{.*?^    \}\);''',
    '''    downButton.addEventListener("pointerup", () => {\n        void clockTimer.startInterval("down").then(result => {\n            if (result) renderTripActionState();\n        }).catch(() => {});\n    });\n\n    breakDialog.querySelectorAll("[data-break-type]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            void (async () => {\n                if (!await startBreakInterval(button.dataset.breakType)) return;\n                closeDialog(breakDialog, { reason: "break-type-selected" });\n            })().catch(() => {});\n        });\n    });''',
    "down and break type handlers",
)

# Cadence tick is the single timer that refreshes interval button content.
replace_once(
    "app.js",
    '''    clockTimer.addEventListener("cadenceTick", event => {\n        updateSummaryValues(event.detail?.summary);\n    });''',
    '''    clockTimer.addEventListener("cadenceTick", event => {\n        updateSummaryValues(event.detail?.summary);\n        renderTripActionState(event.detail?.now);\n    });''',
    "cadence interval rendering",
)

# Remove the old rollover listener; ClockTimer now emits a dedicated restart event.
sub_once(
    "app.js",
    r'''\n    clockTimer\.addEventListener\("intervalElapsed", event => \{\n        if \(\n            event\.detail\?\.intervalType !== "break" \|\|\n            event\.detail\?\.behavior !== "rollover"\n        \) \{\n            return;\n        \}\n\n        queueMicrotask\(\(\) => \{\n            void clockTimer\.endInterval\(\)\.catch\(\(\) => \{\}\);\n        \}\);\n    \}\);\n''',
    '\n',
    "remove rollover listener",
)

app = Path("app.js").read_text()
summary_marker = '''    const summaryRefreshEvents = ['''
if app.count(summary_marker) != 1:
    raise SystemExit(f"summary marker count={app.count(summary_marker)}")
interval_listeners = '''    clockTimer.addEventListener("downTimeStarted", () => {\n        renderTripActionState();\n    });\n\n    clockTimer.addEventListener("tripAutomaticallyRestarted", () => {\n        setTripControlState(true);\n        renderTripActionState();\n    });\n\n    clockTimer.addEventListener("intervalStarted", () => {\n        renderTripActionState();\n    });\n\n    clockTimer.addEventListener("intervalEnded", () => {\n        renderTripActionState();\n    });\n\n'''
app = app.replace(summary_marker, interval_listeners + summary_marker, 1)
Path("app.js").write_text(app)

# Sanity checks before CI syntax checks.
for path, required in {
    "ClockTimer.js": [
        "getActiveIntervalState(now = new Date())",
        "tripAutomaticallyRestarted",
        "downTimeStarted",
        "#autoRestartTripAfterLateBreak"
    ],
    "app.js": [
        "renderTripActionState",
        "startBreakInterval",
        "lateBreakBehavior",
        'clockTimer.startInterval("down")'
    ],
    "index.html": [
        "Select Break Type",
        'data-break-type="short-break"',
        'name="lateBreakBehavior"'
    ]
}.items():
    text = Path(path).read_text()
    for value in required:
        if value not in text:
            raise SystemExit(f"missing {value!r} in {path}")
