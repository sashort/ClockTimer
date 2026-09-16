from pathlib import Path

ROOT = Path('.')
html_path = ROOT / 'index.html'
js_path = ROOT / 'app.js'
css_path = ROOT / 'app.css'

html = html_path.read_text()
js = js_path.read_text()
css = css_path.read_text()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# --- index.html ---
html = replace_once(
    html,
    '''                    <button class="trip-time-edit" type="button" data-trip-time-field="scheduled-start" aria-label="Edit scheduled start"><span aria-hidden="true"></span></button>''',
    '''                    <button class="trip-time-edit" type="button" data-trip-time-field="scheduled-start" aria-label="Edit scheduled start"><span aria-hidden="true"></span></button>\n                    <button class="trip-time-now-toggle" type="button" data-trip-start-now-target="scheduled-start" aria-label="Set scheduled start to timestamp" aria-pressed="false" hidden>-</button>''',
    'scheduled start timestamp toggle'
)
html = replace_once(
    html,
    '''                    <button class="trip-time-edit" type="button" data-trip-time-field="actual-start" aria-label="Edit actual start"><span aria-hidden="true"></span></button>''',
    '''                    <button class="trip-time-edit" type="button" data-trip-time-field="actual-start" aria-label="Edit actual start"><span aria-hidden="true"></span></button>\n                    <button class="trip-time-now-toggle" type="button" data-trip-start-now-target="actual-start" aria-label="Set actual start to timestamp" aria-pressed="false" hidden>-</button>''',
    'actual start timestamp toggle'
)
html = replace_once(
    html,
    '''            <button id="tripSetStartsNow" class="trip-now-action" type="button" hidden>Set Scheduled/Actual Start to Now</button>''',
    '''            <div id="tripSetStartsNowActions" class="trip-now-actions" hidden>\n                <button id="tripSetStartsNow" class="trip-now-action" type="button">Set Scheduled/Actual Start to Now</button>\n                <button id="tripSetStartsNowCancel" class="trip-now-cancel" type="button" hidden>Cancel</button>\n            </div>''',
    'timestamp action row'
)

# --- app.js references/state ---
js = replace_once(
    js,
    '''    const tripSettingsPrimary = $("#tripSettingsPrimary");\n    const tripSetStartsNow = $("#tripSetStartsNow");\n    const tripGoalSyncOption = $("#tripGoalSyncOption");''',
    '''    const tripSettingsPrimary = $("#tripSettingsPrimary");\n    const tripSetStartsNowActions = $("#tripSetStartsNowActions");\n    const tripSetStartsNow = $("#tripSetStartsNow");\n    const tripSetStartsNowCancel = $("#tripSetStartsNowCancel");\n    const tripStartNowToggles = [...tripSettingsDialog.querySelectorAll("[data-trip-start-now-target]")];\n    const tripGoalSyncOption = $("#tripGoalSyncOption");''',
    'trip settings refs'
)
js = replace_once(
    js,
    '''    let stagedStandardTime;\n    let tripDraft;\n    let numberPadState;''',
    '''    let stagedStandardTime;\n    let tripDraft;\n    let tripSettingsSession;\n    let tripStartsNowState;\n    let numberPadState;''',
    'trip settings state'
)

# Trip Settings close buttons need rollback semantics.
js = replace_once(
    js,
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            void closeDialogWithReturn(dialog, { reason: "dialog-close" }).catch(() => {});\n        });\n    });''',
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            if (dialog === tripSettingsDialog) {\n                void cancelTripSettingsDialog("trip-settings-cancel").catch(() => {});\n                return;\n            }\n            void closeDialogWithReturn(dialog, { reason: "dialog-close" }).catch(() => {});\n        });\n    });''',
    'trip settings close rollback'
)
js = replace_once(
    js,
    '''    document.querySelectorAll("dialog").forEach(dialog => {\n        dialog.addEventListener("cancel", event => {\n            if (!peekUIReturnFrame()) return;\n            event.preventDefault();\n            void closeDialogWithReturn(dialog, { reason: "dialog-cancel" }).catch(() => {});\n        });\n    });''',
    '''    document.querySelectorAll("dialog").forEach(dialog => {\n        dialog.addEventListener("cancel", event => {\n            if (dialog === tripSettingsDialog) {\n                event.preventDefault();\n                void cancelTripSettingsDialog("trip-settings-cancel").catch(() => {});\n                return;\n            }\n            if (!peekUIReturnFrame()) return;\n            event.preventDefault();\n            void closeDialogWithReturn(dialog, { reason: "dialog-cancel" }).catch(() => {});\n        });\n    });''',
    'trip settings escape rollback'
)

# Stage nested number-pad edits into the Trip Settings session.
js = replace_once(
    js,
    '''        if (state.mode === "absolute") {\n            if (!tripIsLive() && state.tripDefaults) {''',
    '''        if (state.mode === "absolute") {\n            if (tripSettingsSession && ["creation-time", "scheduled-start", "actual-start"].includes(state.source)) {\n                const values = tripSettingsSession.values;\n                if (state.source === "creation-time") {\n                    const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));\n                    if (!value) return false;\n                    values.creationTime = value;\n                    values.creationDate = state.pendingDate;\n                    return true;\n                }\n\n                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state));\n                if (!value) return false;\n                if (state.source === "scheduled-start") {\n                    values.scheduledStart = value;\n                    return true;\n                }\n                values.startTime = value;\n                return true;\n            }\n\n            if (!tripIsLive() && state.tripDefaults) {''',
    'stage absolute trip fields'
)
js = replace_once(
    js,
    '''        const formatted = renderTimeDigits(state.pending);\n        if (!formatted) return false;\n        stagedStandardTime = formatted;''',
    '''        const formatted = renderTimeDigits(state.pending);\n        if (!formatted) return false;\n        if (tripSettingsSession && state.source === "standard-time") {\n            tripSettingsSession.values.standardTime = formatted;\n            return true;\n        }\n        stagedStandardTime = formatted;''',
    'stage standard time'
)

helpers = r'''
    function cloneTripSettingsValues(values) {
        return values ? { ...values } : undefined;
    }

    function getCurrentTripSettingsValues() {
        const live = tripIsLive();
        const draft = !live ? tripDraft : undefined;
        if (!live && !draft) return undefined;
        return {
            standardTime: live ? (clockTimer.standardTime || "") : (draft.standardTime || ""),
            creationTime: live ? (clockTimer.creationTime || "") : (draft.creationTime || ""),
            creationDate: live ? (clockTimer.creationDate || "") : (draft.creationDate || ""),
            scheduledStart: live ? (clockTimer.scheduledStart || "") : (draft.scheduledStart || ""),
            startTime: live ? (clockTimer.startTime || "") : (draft.startTime || ""),
            matchTripGoalToTotal: live
                ? Boolean(clockTimer.autoSyncTripGoal)
                : Boolean(draft.matchTripGoalToTotal)
        };
    }

    function beginTripSettingsSession() {
        if (tripSettingsSession) return tripSettingsSession;
        const values = getCurrentTripSettingsValues();
        if (!values) return undefined;
        tripSettingsSession = {
            live: tripIsLive(),
            original: cloneTripSettingsValues(values),
            values: cloneTripSettingsValues(values)
        };
        return tripSettingsSession;
    }

    function getTripSettingsCandidateDraft() {
        if (!tripDraft) return undefined;
        const values = tripSettingsSession?.values;
        if (!values) return tripDraft;
        return {
            ...tripDraft,
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
        };
    }

    function formatTripTimeOnly(value, creationDate) {
        const formatted = formatTripTimeDisplay(value, creationDate);
        return formatted === "---" ? formatted : formatted.split(" · ")[0];
    }

    function syncTripStartsNowUI() {
        const draft = !tripIsLive() ? tripDraft : undefined;
        const active = Boolean(draft && tripStartsNowState);
        const values = tripSettingsSession?.values;
        tripSetStartsNowActions.hidden = !draft;
        tripSetStartsNowActions.classList.toggle("is-selecting", active);
        tripSetStartsNowCancel.hidden = !active;
        tripSettingsDialog.classList.toggle("is-setting-starts-now", active);

        tripSettingsDialog.querySelectorAll(".trip-time-edit").forEach(button => {
            button.hidden = active;
        });

        tripStartNowToggles.forEach(button => {
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            const selected = Boolean(active && tripStartsNowState[key]);
            button.hidden = !active;
            button.textContent = selected ? "✓" : "-";
            button.setAttribute("aria-pressed", String(selected));
        });

        if (!active) {
            tripSetStartsNow.textContent = "Set Scheduled/Actual Start to Now";
            tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(values?.creationDate || draft.creationDate));
            return;
        }

        tripSetStartsNow.textContent = `Set To ${tripStartsNowState.label}`;
        tripSetStartsNow.disabled = !tripStartsNowState.scheduled && !tripStartsNowState.actual;
    }

    function restoreDraftFromTripSettingsOriginal() {
        if (!tripDraft || tripSettingsSession?.live || !tripSettingsSession?.original) return;
        const values = tripSettingsSession.original;
        Object.assign(tripDraft, {
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
        });
    }

    function applyTripSettingsSession() {
        const session = tripSettingsSession;
        if (!session) return true;
        const values = session.values;

        if (!session.live) {
            if (!tripDraft) return false;
            Object.assign(tripDraft, {
                standardTime: values.standardTime,
                creationTime: values.creationTime,
                creationDate: values.creationDate,
                scheduledStart: values.scheduledStart,
                startTime: values.startTime,
                matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
            });
            return true;
        }

        try {
            if (clockTimer.creationDate !== values.creationDate) clockTimer.creationDate = values.creationDate;
            if (clockTimer.creationTime !== values.creationTime) clockTimer.creationTime = values.creationTime;
            if (clockTimer.scheduledStart !== values.scheduledStart) clockTimer.scheduledStart = values.scheduledStart;
            if (clockTimer.startTime !== values.startTime) clockTimer.startTime = values.startTime;
            if (clockTimer.standardTime !== values.standardTime) clockTimer.standardTime = values.standardTime;
            clockTimer.autoSyncTripGoal = Boolean(values.matchTripGoalToTotal);
            stagedStandardTime = values.standardTime || stagedStandardTime;
            return true;
        }
        catch {
            return false;
        }
    }

    function syncTripSettingsCallerAfterSave() {
        const frame = findUIReturnFrame("number-pad");
        const standardTime = tripSettingsSession?.values?.standardTime;
        if (!frame?.state || frame.state.source !== "standard-time" || !standardTime) return;
        const digits = normalizeTimeDigits(standardTime);
        if (!digits) return;
        const changed = digits !== frame.state.initial;
        frame.state.initial = digits;
        frame.state.pending = digits;
        frame.state.replaceOnNextDigit = false;
        frame.state.everEdited = Boolean(frame.state.everEdited || changed);
    }

    async function cancelTripSettingsDialog(reason = "trip-settings-cancel") {
        tripStartsNowState = undefined;
        tripSettingsSession = undefined;
        return closeDialogWithReturn(tripSettingsDialog, { reason });
    }
'''
js = replace_once(
    js,
    '''    function refreshTripSettingsValues() {''',
    helpers + '''\n    function refreshTripSettingsValues() {''',
    'trip settings session helpers'
)

old_refresh = '''    function refreshTripSettingsValues() {\n        syncTripSettingsCloud();\n        const live = tripIsLive();\n        const draft = !live ? tripDraft : undefined;\n        const values = {\n            "creation-time": live\n                ? formatTripTimeDisplay(clockTimer.creationTime, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.creationTime, draft.creationDate)\n                    : "---",\n            "scheduled-start": live\n                ? formatTripTimeDisplay(clockTimer.scheduledStart, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.scheduledStart, draft.creationDate)\n                    : "---",\n            "actual-start": live\n                ? formatTripTimeDisplay(clockTimer.startTime, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.startTime, draft.creationDate)\n                    : "---",\n            "standard-time": live\n                ? (clockTimer.standardTime || "---")\n                : (draft?.standardTime || "---")\n        };\n\n        $("#tripCreationTime").textContent = values["creation-time"];\n        $("#tripScheduledStart").textContent = values["scheduled-start"];\n        $("#tripActualStart").textContent = values["actual-start"];\n        $("#tripStandardTime").textContent = values["standard-time"];\n        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n            button.disabled = !live && !draft;\n        });\n        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        tripSetStartsNow.hidden = !draft;\n        tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(draft.creationDate));\n        const preferencesVisible = Boolean(draft || live);\n        tripSettingsPreferences.hidden = !preferencesVisible;\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;\n        const selectedGoalSync = draft\n            ? Boolean(draft.matchTripGoalToTotal)\n            : live\n                ? Boolean(clockTimer.autoSyncTripGoal)\n                : Boolean(getTripPreferences().matchTripGoalToTotal);\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;\n        autoSyncTripGoal.checked = selectedGoalSync;\n        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);\n        tripGoalSyncNoData.hidden = aggregateGoalAvailable;\n        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";\n        tripSettingsPrimary.value = draft ? "start" : "save";\n        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanStart(draft));\n    }\n\n    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {\n        refreshTripSettingsValues();\n        return openDialogElement(tripSettingsDialog, { duration, reason });\n    }'''
new_refresh = '''    function refreshTripSettingsValues() {\n        syncTripSettingsCloud();\n        const live = tripIsLive();\n        const draft = !live ? tripDraft : undefined;\n        const settingsValues = tripSettingsSession?.values || getCurrentTripSettingsValues();\n        const creationDate = settingsValues?.creationDate || draft?.creationDate || clockTimer.creationDate;\n        const values = {\n            "creation-time": settingsValues\n                ? formatTripTimeDisplay(settingsValues.creationTime, creationDate)\n                : "---",\n            "scheduled-start": settingsValues\n                ? formatTripTimeDisplay(settingsValues.scheduledStart, creationDate)\n                : "---",\n            "actual-start": settingsValues\n                ? formatTripTimeDisplay(settingsValues.startTime, creationDate)\n                : "---",\n            "standard-time": settingsValues?.standardTime || "---"\n        };\n\n        $("#tripCreationTime").textContent = values["creation-time"];\n        $("#tripScheduledStart").textContent = values["scheduled-start"];\n        $("#tripActualStart").textContent = values["actual-start"];\n        $("#tripStandardTime").textContent = values["standard-time"];\n        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n            button.disabled = !live && !draft;\n        });\n        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        const preferencesVisible = Boolean(draft || live);\n        tripSettingsPreferences.hidden = !preferencesVisible;\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;\n        const selectedGoalSync = settingsValues\n            ? Boolean(settingsValues.matchTripGoalToTotal)\n            : Boolean(getTripPreferences().matchTripGoalToTotal);\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;\n        autoSyncTripGoal.checked = selectedGoalSync;\n        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);\n        tripGoalSyncNoData.hidden = aggregateGoalAvailable;\n        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";\n        tripSettingsPrimary.value = draft ? "start" : "save";\n        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanStart(getTripSettingsCandidateDraft()));\n        syncTripStartsNowUI();\n    }\n\n    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {\n        const existingSession = Boolean(tripSettingsSession);\n        if (!existingSession) beginTripSettingsSession();\n        refreshTripSettingsValues();\n        const opened = openDialogElement(tripSettingsDialog, { duration, reason });\n        if (!opened && !existingSession) {\n            tripSettingsSession = undefined;\n            tripStartsNowState = undefined;\n        }\n        return opened;\n    }'''
js = replace_once(js, old_refresh, new_refresh, 'trip settings refresh/open')

js = replace_once(
    js,
    '''    function getTripFieldValue(field) {\n        const draft = !tripIsLive() ? tripDraft : undefined;\n        if (field === "creation-time") return draft?.creationTime || clockTimer.creationTime || "";\n        if (field === "scheduled-start") return draft?.scheduledStart || clockTimer.scheduledStart || "";\n        if (field === "actual-start") return draft?.startTime || clockTimer.startTime || "";\n        if (field === "standard-time") return draft?.standardTime || clockTimer.standardTime || "";\n        return "";\n    }''',
    '''    function getTripFieldValue(field) {\n        const values = tripSettingsSession?.values || getCurrentTripSettingsValues();\n        if (!values) return "";\n        if (field === "creation-time") return values.creationTime || "";\n        if (field === "scheduled-start") return values.scheduledStart || "";\n        if (field === "actual-start") return values.startTime || "";\n        if (field === "standard-time") return values.standardTime || "";\n        return "";\n    }''',
    'trip field staged values'
)

js = replace_once(
    js,
    '''    tripSettingsForm.elements.autoSyncTripGoal.addEventListener("change", event => {\n        const checked = event.currentTarget.checked;\n        if (tripDraft && !tripIsLive()) {\n            tripDraft.matchTripGoalToTotal = checked;\n        }\n        else if (tripIsLive()) {\n            clockTimer.autoSyncTripGoal = checked;\n        }\n    });''',
    '''    tripSettingsForm.elements.autoSyncTripGoal.addEventListener("change", event => {\n        if (!tripSettingsSession) beginTripSettingsSession();\n        if (tripSettingsSession) {\n            tripSettingsSession.values.matchTripGoalToTotal = event.currentTarget.checked;\n        }\n    });''',
    'stage goal sync setting'
)

old_now = '''    tripSetStartsNow.addEventListener("pointerup", () => {\n        if (!tripDraft || tripIsLive()) return;\n        const now = new Date();\n        const value = formatTimelineDateTime(now, tripDraft.creationDate);\n        if (!value) return;\n        tripDraft.scheduledStart = value;\n        tripDraft.startTime = value;\n        refreshTripSettingsValues();\n    });'''
new_now = '''    tripSetStartsNow.addEventListener("pointerup", () => {\n        if (!tripDraft || tripIsLive()) return;\n        if (!tripSettingsSession) beginTripSettingsSession();\n        const values = tripSettingsSession?.values;\n        if (!values) return;\n\n        if (!tripStartsNowState) {\n            const now = new Date();\n            const value = formatTimelineDateTime(now, values.creationDate);\n            if (!value) return;\n            const label = formatTripTimeOnly(value, values.creationDate);\n            if (!label || label === "---") return;\n            tripStartsNowState = {\n                value,\n                label,\n                scheduled: false,\n                actual: false\n            };\n            syncTripStartsNowUI();\n            return;\n        }\n\n        if (tripStartsNowState.scheduled) values.scheduledStart = tripStartsNowState.value;\n        if (tripStartsNowState.actual) values.startTime = tripStartsNowState.value;\n        tripStartsNowState = undefined;\n        refreshTripSettingsValues();\n    });\n\n    tripSetStartsNowCancel.addEventListener("pointerup", () => {\n        if (!tripStartsNowState) return;\n        tripStartsNowState = undefined;\n        refreshTripSettingsValues();\n    });\n\n    tripStartNowToggles.forEach(button => {\n        button.addEventListener("pointerup", () => {\n            if (!tripStartsNowState) return;\n            const key = button.dataset.tripStartNowTarget === "scheduled-start"\n                ? "scheduled"\n                : "actual";\n            tripStartsNowState[key] = !tripStartsNowState[key];\n            syncTripStartsNowUI();\n        });\n    });'''
js = replace_once(js, old_now, new_now, 'timestamp selection flow')

old_submit = '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        if (tripDraft && !tripIsLive()) {\n            tripDraft.matchTripGoalToTotal = form.elements.autoSyncTripGoal.checked;\n        }\n        else if (tripIsLive()) {\n            clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        }\n\n        void (async () => {\n            if (tripDraft && !tripIsLive()) {\n                if (!await startTripDraft()) {\n                    refreshTripSettingsValues();\n                    return;\n                }\n                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });\n                return;\n            }\n\n            await closeDialogWithReturn(tripSettingsDialog, {\n                reason: "trip-settings-save"\n            });\n        })().catch(() => {});\n    });'''
new_submit = '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        if (!tripSettingsSession) beginTripSettingsSession();\n        if (tripSettingsSession) {\n            tripSettingsSession.values.matchTripGoalToTotal =\n                event.currentTarget.elements.autoSyncTripGoal.checked;\n        }\n\n        void (async () => {\n            const startingDraft = Boolean(tripDraft && !tripIsLive());\n            if (!applyTripSettingsSession()) {\n                refreshTripSettingsValues();\n                return;\n            }\n\n            if (startingDraft) {\n                try {\n                    if (!await startTripDraft()) {\n                        restoreDraftFromTripSettingsOriginal();\n                        refreshTripSettingsValues();\n                        return;\n                    }\n                }\n                catch {\n                    restoreDraftFromTripSettingsOriginal();\n                    refreshTripSettingsValues();\n                    return;\n                }\n                tripStartsNowState = undefined;\n                tripSettingsSession = undefined;\n                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });\n                return;\n            }\n\n            syncTripSettingsCallerAfterSave();\n            tripStartsNowState = undefined;\n            tripSettingsSession = undefined;\n            await closeDialogWithReturn(tripSettingsDialog, {\n                reason: "trip-settings-save"\n            });\n        })().catch(() => {});\n    });'''
js = replace_once(js, old_submit, new_submit, 'trip settings staged submit')

# --- app.css ---
css += r'''

/* staged-trip-settings-timestamp-v1 */
.trip-now-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
}

.trip-now-actions[hidden],
.trip-now-cancel[hidden],
.trip-time-edit[hidden],
.trip-time-now-toggle[hidden] {
    display: none;
}

.trip-now-actions.is-selecting {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.trip-now-actions.is-selecting .trip-now-action {
    min-width: 0;
    padding-inline: 10px;
    font-size: clamp(13px, 3vw, 16px);
}

.trip-now-cancel {
    min-height: 48px;
    padding: 10px 16px;
    border: 1.5px solid rgb(255 255 255 / 72%);
    border-radius: 10px;
    color: var(--wm-white);
    background: var(--ui-charcoal-gradient);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
    font-size: 16px;
    font-weight: 700;
}

.trip-time-now-toggle {
    width: 54px;
    height: 54px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(215 241 255 / 92%);
    border-radius: 12px;
    color: var(--wm-white);
    background: linear-gradient(145deg, #70ceff 0%, #35abef 52%, #1687d7 100%);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
}

.trip-time-now-toggle[aria-pressed="true"] {
    box-shadow: inset 0 2px 5px rgb(0 0 0 / 24%), 0 4px 10px rgb(0 0 0 / 18%);
}

@media (max-width: 620px) {
    .trip-time-now-toggle {
        width: 50px;
        height: 50px;
    }
}
'''

html_path.write_text(html)
js_path.write_text(js)
css_path.write_text(css)
