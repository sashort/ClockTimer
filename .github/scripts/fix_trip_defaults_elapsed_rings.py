from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()

clock = replace_once(
    clock,
    '        async prepareTrip({ timeout = 5000 } = {}) {\n            const timeoutMilliseconds = Number(timeout);\n            if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {\n                throw new RangeError("timeout must be a positive number of milliseconds.");\n            }\n\n            const now = new Date();',
    '        async prepareTrip({ timeout = 5000, at } = {}) {\n            const timeoutMilliseconds = Number(timeout);\n            if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {\n                throw new RangeError("timeout must be a positive number of milliseconds.");\n            }\n\n            const now = at === undefined\n                ? new Date()\n                : at instanceof Date\n                    ? new Date(at.getTime())\n                    : new Date(at);\n            if (Number.isNaN(now.getTime())) {\n                throw new TypeError("at must be a valid Date or date-time value.");\n            }',
    "prepareTrip timestamp"
)

clock = replace_once(
    clock,
    '                creationTime: time,\n                startTime: time,\n                creationDate: now.toISOString(),',
    '                creationTime: time,\n                scheduledStart: time,\n                startTime: time,\n                creationDate: now.toISOString(),',
    "prepared scheduled start"
)

clock = replace_once(
    clock,
    '                if (localOptions.scheduledStart === undefined) localOptions.scheduledStart = prepared.startTime;',
    '                if (localOptions.scheduledStart === undefined) localOptions.scheduledStart = prepared.scheduledStart ?? prepared.startTime;',
    "prepared scheduled start consumption"
)

clock = replace_once(
    clock,
    '            this.#emitClockTimerEvent("stopped", {\n                ...result,\n                summary\n            });',
    '            this.#emitClockTimerEvent("stopped", {\n                ...result,\n                summary,\n                stopTime: persistedEnd\n            });',
    "stopped event time"
)

clock = replace_once(
    clock,
    '            const initialWidth =\n                "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))";',
    '            const initialWidth =\n                "var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))";',
    "initial inactive width"
)

clock = replace_once(
    clock,
    '                const width =\n                    active\n                        ?\n                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"\n                        :\n                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";',
    '                const width =\n                    active\n                        ?\n                        "var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"\n                        :\n                        "var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))";',
    "active inactive ring widths"
)

clock = replace_once(
    clock,
    '        #formatSignedRenderedDuration(\n            milliseconds\n        ) {',
    '        #getOpenIntervalDuration(\n            start,\n            end\n        ) {\n            if (\n                !Number.isFinite(start) ||\n                !Number.isFinite(end) ||\n                end <= start ||\n                !this.#openEndedRange?.openEnded\n            ) {\n                return 0;\n            }\n\n            const intervalStart =\n                this.#dateToTimelineTime(\n                    this.#openEndedRange.startDate\n                );\n\n            if (!Number.isFinite(intervalStart)) {\n                return 0;\n            }\n\n            return Math.max(\n                0,\n                end -\n                    Math.max(\n                        start,\n                        intervalStart\n                    )\n            );\n        }\n\n        #formatElapsedRenderedDuration(\n            milliseconds\n        ) {\n            if (!Number.isFinite(milliseconds)) {\n                return undefined;\n            }\n\n            return this.#formatSignedRenderedDuration(\n                Math.trunc(milliseconds / 1000) * 1000\n            );\n        }\n\n        #formatSignedRenderedDuration(\n            milliseconds\n        ) {',
    "open interval and elapsed formatter helpers"
)

clock = replace_once(
    clock,
    '                milliseconds =\n                    end -\n                    start -\n                    this.#getClosedIntervalDuration(\n                        start,\n                        end\n                    );',
    '                milliseconds =\n                    end -\n                    start -\n                    this.#getClosedIntervalDuration(\n                        start,\n                        end\n                    ) -\n                    this.#getOpenIntervalDuration(\n                        start,\n                        end\n                    );',
    "freeze elapsed during open interval"
)

clock = replace_once(
    clock,
    '            return this.#formatSignedRenderedDuration(\n                milliseconds\n            );\n        }\n\n        #updateDisplay(',
    '            return mode === "elapsed"\n                ? this.#formatElapsedRenderedDuration(\n                    milliseconds\n                )\n                : this.#formatSignedRenderedDuration(\n                    milliseconds\n                );\n        }\n\n        #updateDisplay(',
    "truncate elapsed milliseconds"
)

clock = replace_once(
    clock,
    '            if (this.#renderedTimeMode === "elapsed") {\n                renderedTime = this.#formatSignedRenderedDuration(actualTimeMilliseconds);\n            }',
    '            if (this.#renderedTimeMode === "elapsed") {\n                renderedTime = this.#formatElapsedRenderedDuration(actualTimeMilliseconds);\n            }',
    "truncate total elapsed milliseconds"
)

clock_path.write_text(clock)

app_path = Path("app.js")
app = app_path.read_text()

app = replace_once(
    app,
    '    function formatDateInput(date) {\n        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";\n        const pad = value => String(value).padStart(2, "0");\n        return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;\n    }',
    '    function formatDateInput(date) {\n        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";\n        const pad = value => String(value).padStart(2, "0");\n        return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;\n    }\n\n    function getTripMomentDefaults(value = new Date()) {\n        const date = value instanceof Date\n            ? new Date(value.getTime())\n            : new Date(value);\n        if (Number.isNaN(date.getTime())) return undefined;\n        const milliseconds =\n            (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +\n            date.getMilliseconds();\n        let time = formatTimelineMilliseconds(milliseconds);\n        if (date.getMilliseconds() !== 0) {\n            time += `.${String(date.getMilliseconds()).padStart(3, "0")}`;\n        }\n        return {\n            creationTime: time,\n            scheduledStart: time,\n            startTime: time,\n            creationDate: formatDateInput(date)\n        };\n    }',
    "trip moment defaults"
)

app = replace_once(
    app,
    '        const base = getTripBaseDate();\n        const dayMilliseconds = date.getTime() - base.getTime();',
    '        const base = parseDateInput(state.tripDefaults?.creationDate) || getTripBaseDate();\n        const dayMilliseconds = date.getTime() - base.getTime();',
    "absolute pad prepared date base"
)

app = replace_once(
    app,
    '    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false } = {}) {',
    '    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false, tripDefaults } = {}) {',
    "number pad trip defaults argument"
)

app = replace_once(
    app,
    '            persistence: source === "new-trip"\n                ? (clockTimer.networkStatus === "online" ? "pending" : "offline")\n                : clockTimer.networkStatus,\n            returnToTripSettings',
    '            persistence: source === "new-trip"\n                ? (clockTimer.networkStatus === "online" ? "pending" : "offline")\n                : clockTimer.networkStatus,\n            tripDefaults,\n            returnToTripSettings',
    "number pad trip defaults state"
)

app = replace_once(
    app,
    '    function formatTripTimeDisplay(value) {\n        const milliseconds = parseTimelineTime(value);\n        if (!Number.isFinite(milliseconds)) return "---";\n        const base = getTripBaseDate();',
    '    function formatTripTimeDisplay(value, creationDate) {\n        const milliseconds = parseTimelineTime(value);\n        if (!Number.isFinite(milliseconds)) return "---";\n        const base = parseDateInput(creationDate) || getTripBaseDate();',
    "trip time display prepared date"
)

old_refresh = '''    function refreshTripSettingsValues() {
        const live = tripIsLive();
        const snapshot = getTripSettingsPadSnapshot();
        const pendingField = getTripSettingsPendingField(snapshot);
        const values = {
            "creation-time": live ? formatTripTimeDisplay(clockTimer.creationTime) : "---",
            "scheduled-start": live ? formatTripTimeDisplay(clockTimer.scheduledStart) : "---",
            "actual-start": live ? formatTripTimeDisplay(clockTimer.startTime) : "---",
            "standard-time": live && clockTimer.standardTime ? clockTimer.standardTime : "---"
        };

        if (pendingField) {
            values[pendingField] = formatTripSettingsPendingValue(snapshot);
        }

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            const field = button.dataset.tripTimeField;
            button.disabled = !live && !(field === "standard-time" && pendingField === "standard-time");
        });
        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
    }'''
new_refresh = '''    function refreshTripSettingsValues() {
        const live = tripIsLive();
        const snapshot = getTripSettingsPadSnapshot();
        const pendingField = getTripSettingsPendingField(snapshot);
        const tripDefaults = snapshot?.tripDefaults;
        const values = {
            "creation-time": live
                ? formatTripTimeDisplay(clockTimer.creationTime, clockTimer.creationDate)
                : tripDefaults
                    ? formatTripTimeDisplay(tripDefaults.creationTime, tripDefaults.creationDate)
                    : "---",
            "scheduled-start": live
                ? formatTripTimeDisplay(clockTimer.scheduledStart, clockTimer.creationDate)
                : tripDefaults
                    ? formatTripTimeDisplay(tripDefaults.scheduledStart, tripDefaults.creationDate)
                    : "---",
            "actual-start": live
                ? formatTripTimeDisplay(clockTimer.startTime, clockTimer.creationDate)
                : tripDefaults
                    ? formatTripTimeDisplay(tripDefaults.startTime, tripDefaults.creationDate)
                    : "---",
            "standard-time": live && clockTimer.standardTime ? clockTimer.standardTime : "---"
        };

        if (pendingField) {
            values[pendingField] = formatTripSettingsPendingValue(snapshot);
        }

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            const field = button.dataset.tripTimeField;
            button.disabled = !live && !tripDefaults && !(field === "standard-time" && pendingField === "standard-time");
        });
        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
    }'''
app = replace_once(app, old_refresh, new_refresh, "trip settings values")

app = replace_once(
    app,
    '    function getTripFieldValue(field) {\n        if (field === "creation-time") return clockTimer.creationTime || "";\n        if (field === "scheduled-start") return clockTimer.scheduledStart || "";\n        if (field === "actual-start") return clockTimer.startTime || "";\n        if (field === "standard-time") return clockTimer.standardTime || "";\n        return "";\n    }',
    '    function getTripFieldValue(field, snapshot = getTripSettingsPadSnapshot()) {\n        const defaults = !tripIsLive() ? snapshot?.tripDefaults : undefined;\n        if (field === "creation-time") return defaults?.creationTime || clockTimer.creationTime || "";\n        if (field === "scheduled-start") return defaults?.scheduledStart || clockTimer.scheduledStart || "";\n        if (field === "actual-start") return defaults?.startTime || clockTimer.startTime || "";\n        if (field === "standard-time") return clockTimer.standardTime || "";\n        return "";\n    }',
    "trip field prepared values"
)

app = replace_once(
    app,
    '        if (!tripIsLive()) return Promise.resolve();\n        const absolute = field !== "standard-time";\n        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field),\n            returnToTripSettings: true\n        });',
    '        if (!tripIsLive() && !snapshot?.tripDefaults) return Promise.resolve();\n        const absolute = field !== "standard-time";\n        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field, snapshot),\n            tripDefaults: snapshot?.tripDefaults,\n            returnToTripSettings: true\n        });',
    "edit prepared trip settings"
)

app = replace_once(
    app,
    '        if (state.mode === "absolute") {\n            if (state.source === "creation-time") {',
    '        if (state.mode === "absolute") {\n            if (!tripIsLive() && state.tripDefaults) {\n                if (state.source === "creation-time") {\n                    const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));\n                    if (!value) return false;\n                    state.tripDefaults.creationTime = value;\n                    state.tripDefaults.creationDate = state.pendingDate;\n                    return true;\n                }\n\n                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state));\n                if (!value) return false;\n                if (state.source === "scheduled-start") {\n                    state.tripDefaults.scheduledStart = value;\n                    return true;\n                }\n                if (state.source === "actual-start") {\n                    state.tripDefaults.startTime = value;\n                    return true;\n                }\n            }\n\n            if (state.source === "creation-time") {',
    "commit prepared absolute timing"
)

app = replace_once(
    app,
    '        if (state.source === "new-trip") {\n            await clockTimer.start({ standardTime: formatted });\n        }',
    '        if (state.source === "new-trip") {\n            const tripDefaults = state.tripDefaults;\n            await clockTimer.start({\n                standardTime: formatted,\n                creationTime: tripDefaults?.creationTime,\n                scheduledStart: tripDefaults?.scheduledStart,\n                startTime: tripDefaults?.startTime\n            });\n            if (tripDefaults?.creationDate && clockTimer.creationDate !== tripDefaults.creationDate) {\n                clockTimer.creationDate = tripDefaults.creationDate;\n            }\n        }',
    "start with prepared timing defaults"
)

old_workflow = '''    async function beginNewTripWorkflow({ initialValue } = {}) {
        const newTripInitialValue = initialValue ?? (
            clockTimer.status === "stopped"
                ? ""
                : (stagedStandardTime || "")
        );

        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000 })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise
        });
    }

    $("#newTripButton").addEventListener("pointerup", () => {
        void beginNewTripWorkflow().catch(() => {});
    });'''
new_workflow = '''    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        const moment = tripMoment instanceof Date && !Number.isNaN(tripMoment.getTime())
            ? new Date(tripMoment.getTime())
            : new Date();
        const tripDefaults = getTripMomentDefaults(moment);
        const newTripInitialValue = initialValue ?? (
            clockTimer.status === "stopped"
                ? ""
                : (stagedStandardTime || "")
        );

        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000, at: moment })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise,
            tripDefaults
        });
    }

    $("#newTripButton").addEventListener("pointerup", () => {
        void beginNewTripWorkflow({ tripMoment: new Date() }).catch(() => {});
    });'''
app = replace_once(app, old_workflow, new_workflow, "new trip button moment")

app = replace_once(
    app,
    '        updatePostStopSummary(event.detail?.summary);\n        void beginNewTripWorkflow({ initialValue: "" }).catch(() => {});',
    '        updatePostStopSummary(event.detail?.summary);\n        const stopMoment = event.detail?.stopTime\n            ? new Date(event.detail.stopTime)\n            : new Date();\n        void beginNewTripWorkflow({\n            initialValue: "",\n            tripMoment: Number.isNaN(stopMoment.getTime()) ? new Date() : stopMoment\n        }).catch(() => {});',
    "end trip button moment handoff"
)

app_path.write_text(app)
