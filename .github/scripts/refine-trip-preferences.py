from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))

# index.html: rename the menu/dialog, simplify late-break choices, and identify per-trip preferences.
replace_once(
    "index.html",
    '<button type="button" data-dialog="stateSettingsDialog">Clock State Settings</button>',
    '<button type="button" data-dialog="stateSettingsDialog">Trip Preferences</button>',
    "menu label",
)
replace_once(
    "index.html",
    '<h2>Clock State Settings</h2>',
    '<h2>Trip Preferences</h2>',
    "dialog title",
)
replace_once(
    "index.html",
    '''            <fieldset>\n                <legend>Interval Behavior</legend>\n                <label>When an interval elapses\n                    <select name="intervalElapsedBehavior">\n                        <option value="startLatency">Start Latency</option>\n                        <option value="extendBoundary">Keep Boundary Open</option>\n                        <option value="extendInterval">Extend Interval Only</option>\n                    </select>\n                </label>\n                <label class="toggle-row">Auto Sync Trip Goal<input name="autoSyncTripGoal" type="checkbox"></label>\n            </fieldset>''',
    '''            <fieldset>\n                <legend>Defaults</legend>\n                <label>When I End Break Late\n                    <select name="intervalElapsedBehavior">\n                        <option value="startLatency">Show Late Window</option>\n                        <option value="rollover">Auto-Restart Trip</option>\n                    </select>\n                </label>\n                <label class="toggle-row">Match Trip Goal To Total<input name="matchTripGoalToTotal" type="checkbox"></label>\n            </fieldset>''',
    "preference controls",
)
replace_once(
    "index.html",
    '<fieldset class="trip-settings-behavior">\n                <legend>Trip Preferences</legend>',
    '<fieldset id="tripSettingsPreferences" class="trip-settings-behavior">\n                <legend>Trip Preferences</legend>',
    "trip preference fieldset id",
)

# ClockTimer.js: introduce rollover as an elapsed behavior that advances with no timer-side action.
replace_once(
    "ClockTimer.js",
    '''            if (normalized === "extendinterval") {\n                return "extendInterval";\n            }\n\n            return fallback;''',
    '''            if (normalized === "extendinterval") {\n                return "extendInterval";\n            }\n\n            if (normalized === "rollover") {\n                return "rollover";\n            }\n\n            return fallback;''',
    "normalize rollover",
)
text = Path("ClockTimer.js").read_text()
old_error = 'intervalElapsedBehavior must be startLatency, extendBoundary, or extendInterval.'
new_error = 'intervalElapsedBehavior must be startLatency, extendBoundary, extendInterval, or rollover.'
if text.count(old_error) != 1:
    raise SystemExit(f"interval behavior setter error: expected one match, found {text.count(old_error)}")
text = text.replace(old_error, new_error, 1)
old_detail_error = 'intervalElapsed behavior must be startLatency, extendBoundary, or extendInterval.'
new_detail_error = 'intervalElapsed behavior must be startLatency, extendBoundary, extendInterval, or rollover.'
if text.count(old_detail_error) != 1:
    raise SystemExit(f"interval event error: expected one match, found {text.count(old_detail_error)}")
text = text.replace(old_detail_error, new_detail_error, 1)
Path("ClockTimer.js").write_text(text)
replace_once(
    "ClockTimer.js",
    '''            if (extendInterval) {\n                if (\n                    record.clockTimerExtensionActive ===\n                        true\n                ) {\n                    return true;\n                }\n\n                return this.#startIntervalExtension(\n                    record,\n                    boundary,\n                    now,\n                    decision\n                );\n            }\n\n            const intervalEnd =''',
    '''            if (extendInterval) {\n                if (\n                    record.clockTimerExtensionActive ===\n                        true\n                ) {\n                    return true;\n                }\n\n                return this.#startIntervalExtension(\n                    record,\n                    boundary,\n                    now,\n                    decision\n                );\n            }\n\n            if (decision.behavior === "rollover") {\n                return true;\n            }\n\n            const intervalEnd =''',
    "rollover no-action boundary",
)

# app.js: persist defaults separately from current-trip state.
replace_once(
    "app.js",
    '''        graphicalSettings: "wmof.clock.graphicalSettings",\n        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion"''',
    '''        graphicalSettings: "wmof.clock.graphicalSettings",\n        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion",\n        tripPreferences: "wmof.clock.tripPreferences"''',
    "trip preference storage key",
)
replace_once(
    "app.js",
    '''    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];\n    const GRAPHICAL_DEFAULTS = {''',
    '''    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];\n    const TRIP_PREFERENCE_DEFAULTS = {\n        intervalElapsedBehavior: "startLatency",\n        matchTripGoalToTotal: false\n    };\n    const GRAPHICAL_DEFAULTS = {''',
    "preference defaults",
)
replace_once(
    "app.js",
    '''    const tripGoalSyncOption = $("#tripGoalSyncOption");\n    const tripGoalSyncNoData = $("#tripGoalSyncNoData");''',
    '''    const tripGoalSyncOption = $("#tripGoalSyncOption");\n    const tripGoalSyncNoData = $("#tripGoalSyncNoData");\n    const tripSettingsPreferences = $("#tripSettingsPreferences");''',
    "preference fieldset ref",
)
replace_once(
    "app.js",
    '''    function getStoredJSON(key, fallback) {\n        try {\n            const raw = safeStorageGet(key);\n            return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };\n        }\n        catch {\n            return { ...fallback };\n        }\n    }\n\n    function getGraphicalSettings() {''',
    '''    function getStoredJSON(key, fallback) {\n        try {\n            const raw = safeStorageGet(key);\n            return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };\n        }\n        catch {\n            return { ...fallback };\n        }\n    }\n\n    function getTripPreferences() {\n        const stored = getStoredJSON(STORAGE.tripPreferences, TRIP_PREFERENCE_DEFAULTS);\n        return {\n            intervalElapsedBehavior:\n                stored.intervalElapsedBehavior === "rollover"\n                    ? "rollover"\n                    : "startLatency",\n            matchTripGoalToTotal: Boolean(stored.matchTripGoalToTotal)\n        };\n    }\n\n    function saveTripPreferences(preferences) {\n        safeStorageSet(STORAGE.tripPreferences, JSON.stringify(preferences));\n    }\n\n    function fillTripPreferencesForm(preferences = getTripPreferences()) {\n        const form = $("#stateSettingsForm");\n        form.elements.intervalElapsedBehavior.value = preferences.intervalElapsedBehavior;\n        form.elements.matchTripGoalToTotal.checked = Boolean(preferences.matchTripGoalToTotal);\n    }\n\n    function getGraphicalSettings() {''',
    "preference helpers",
)
replace_once(
    "app.js",
    '''            if (button.dataset.dialog === "graphicalSettingsDialog") fillGraphicalForm(getGraphicalSettings());\n            openDialog(button.dataset.dialog, { fromPopover: true, reason: "popover-handoff" });''',
    '''            if (button.dataset.dialog === "graphicalSettingsDialog") fillGraphicalForm(getGraphicalSettings());\n            if (button.dataset.dialog === "stateSettingsDialog") fillTripPreferencesForm();\n            openDialog(button.dataset.dialog, { fromPopover: true, reason: "popover-handoff" });''',
    "populate preference form",
)
replace_once(
    "app.js",
    '''    $("#stateSettingsForm").addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;\n        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});\n    });''',
    '''    $("#stateSettingsForm").addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        const preferences = {\n            intervalElapsedBehavior:\n                form.elements.intervalElapsedBehavior.value === "rollover"\n                    ? "rollover"\n                    : "startLatency",\n            matchTripGoalToTotal: form.elements.matchTripGoalToTotal.checked\n        };\n        saveTripPreferences(preferences);\n        if (!tripIsLive() && !tripDraft) {\n            clockTimer.intervalElapsedBehavior = preferences.intervalElapsedBehavior;\n        }\n        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});\n    });''',
    "save preference defaults",
)
replace_once(
    "app.js",
    '''        await clockTimer.start({\n            standardTime,\n            creationTime: draft.creationTime,\n            scheduledStart: draft.scheduledStart,\n            startTime: draft.startTime\n        });''',
    '''        clockTimer.autoSyncTripGoal = Boolean(draft.matchTripGoalToTotal);\n        clockTimer.intervalElapsedBehavior =\n            draft.intervalElapsedBehavior === "rollover"\n                ? "rollover"\n                : "startLatency";\n\n        await clockTimer.start({\n            standardTime,\n            creationTime: draft.creationTime,\n            scheduledStart: draft.scheduledStart,\n            startTime: draft.startTime\n        });''',
    "apply draft preferences on start",
)
replace_once(
    "app.js",
    '''        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        tripSetStartsNow.hidden = !draft;\n        tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(draft.creationDate));\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;\n        if (!aggregateGoalAvailable && clockTimer.autoSyncTripGoal) {\n            clockTimer.autoSyncTripGoal = false;\n        }\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable;\n        autoSyncTripGoal.checked = aggregateGoalAvailable && clockTimer.autoSyncTripGoal;\n        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);\n        tripGoalSyncNoData.hidden = aggregateGoalAvailable;''',
    '''        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        tripSetStartsNow.hidden = !draft;\n        tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(draft.creationDate));\n        const preferencesVisible = Boolean(draft || live);\n        tripSettingsPreferences.hidden = !preferencesVisible;\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;\n        const selectedGoalSync = draft\n            ? Boolean(draft.matchTripGoalToTotal)\n            : live\n                ? Boolean(clockTimer.autoSyncTripGoal)\n                : Boolean(getTripPreferences().matchTripGoalToTotal);\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;\n        autoSyncTripGoal.checked = selectedGoalSync;\n        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);\n        tripGoalSyncNoData.hidden = aggregateGoalAvailable;''',
    "per-trip preference rendering",
)
replace_once(
    "app.js",
    '''    tripSettingsDialog.addEventListener("opening", () => {\n        refreshTripSettingsValues();\n    });\n\n    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {''',
    '''    tripSettingsDialog.addEventListener("opening", () => {\n        refreshTripSettingsValues();\n    });\n\n    tripSettingsForm.elements.autoSyncTripGoal.addEventListener("change", event => {\n        const checked = event.currentTarget.checked;\n        if (tripDraft && !tripIsLive()) {\n            tripDraft.matchTripGoalToTotal = checked;\n        }\n        else if (tripIsLive()) {\n            clockTimer.autoSyncTripGoal = checked;\n        }\n    });\n\n    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {''',
    "persist per-trip checkbox while navigating",
)
replace_once(
    "app.js",
    '''        const form = event.currentTarget;\n        clockTimer.autoSyncTripGoal =\n            !form.elements.autoSyncTripGoal.disabled &&\n            form.elements.autoSyncTripGoal.checked;\n\n        void (async () => {''',
    '''        const form = event.currentTarget;\n        if (tripDraft && !tripIsLive()) {\n            tripDraft.matchTripGoalToTotal = form.elements.autoSyncTripGoal.checked;\n        }\n        else if (tripIsLive()) {\n            clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        }\n\n        void (async () => {''',
    "submit selected trip preference",
)
replace_once(
    "app.js",
    '''        const tripDefaults = getTripMomentDefaults(moment);\n        const newTripInitialValue = initialValue ?? (''',
    '''        const tripDefaults = getTripMomentDefaults(moment);\n        const tripPreferences = getTripPreferences();\n        const newTripInitialValue = initialValue ?? (''',
    "load defaults for new trip",
)
replace_once(
    "app.js",
    '''        tripDraft = {\n            ...tripDefaults,\n            standardTime: newTripInitialValue || ""\n        };''',
    '''        tripDraft = {\n            ...tripDefaults,\n            standardTime: newTripInitialValue || "",\n            intervalElapsedBehavior: tripPreferences.intervalElapsedBehavior,\n            matchTripGoalToTotal: tripPreferences.matchTripGoalToTotal\n        };''',
    "store defaults on draft",
)
replace_once(
    "app.js",
    '''    clockTimer.addEventListener("started", event => {\n        setTripControlState(true);\n        updateSummaryValues(event.detail?.summary);\n    });\n\n    const summaryRefreshEvents = [''',
    '''    clockTimer.addEventListener("started", event => {\n        setTripControlState(true);\n        updateSummaryValues(event.detail?.summary);\n    });\n\n    clockTimer.addEventListener("intervalElapsed", event => {\n        if (\n            event.detail?.intervalType !== "break" ||\n            event.detail?.behavior !== "rollover"\n        ) {\n            return;\n        }\n\n        queueMicrotask(() => {\n            void clockTimer.endInterval().catch(() => {});\n        });\n    });\n\n    const summaryRefreshEvents = [''',
    "auto restart elapsed break",
)
replace_once(
    "app.js",
    '''    const graphicalSettings = getGraphicalSettings();\n    applyGraphicalSettings(graphicalSettings);\n    fillGraphicalForm(graphicalSettings);''',
    '''    const graphicalSettings = getGraphicalSettings();\n    const tripPreferences = getTripPreferences();\n    applyGraphicalSettings(graphicalSettings);\n    fillGraphicalForm(graphicalSettings);\n    fillTripPreferencesForm(tripPreferences);\n    clockTimer.intervalElapsedBehavior = tripPreferences.intervalElapsedBehavior;''',
    "initialize preference defaults",
)
