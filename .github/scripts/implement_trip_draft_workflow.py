from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

app = Path("app.js")
text = app.read_text(encoding="utf-8")

text = replace_once(
    text,
    '    const tripSettingsDialog = $("#tripSettingsDialog");\n    const tripSettingsForm = $("#tripSettingsForm");',
    '    const tripSettingsDialog = $("#tripSettingsDialog");\n    const tripSettingsForm = $("#tripSettingsForm");\n    const tripSettingsPrimary = $("#tripSettingsPrimary");',
    "trip settings primary control"
)

text = replace_once(
    text,
    '    let loginPending = false;\n    let stagedStandardTime;\n    let numberPadState;',
    '    let loginPending = false;\n    let stagedStandardTime;\n    let tripDraft;\n    let numberPadState;',
    "trip draft state"
)

text = replace_once(
    text,
    '''        const valid = numberPadValueValid();\n        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;\n        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";\n        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");\n        numberPadConfirm.disabled = !changed || (!autocorrect && !valid);''',
    '''        const valid = numberPadValueValid();\n        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;\n        const startsTrip = Boolean(numberPadState.startsTripOnConfirm);\n        const confirmAction = autocorrect ? "autocorrect" : startsTrip ? "start" : "confirm";\n        numberPadConfirm.dataset.action = confirmAction;\n        numberPadConfirm.setAttribute(\n            "aria-label",\n            autocorrect ? "Auto-Correct" : startsTrip ? "Start Trip" : "Confirm"\n        );\n        numberPadConfirm.disabled = autocorrect\n            ? false\n            : startsTrip\n                ? !valid\n                : (!changed || !valid);''',
    "number pad start action"
)

text = replace_once(
    text,
    '    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, tripDefaults, duration = 250 } = {}) {',
    '    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, tripDefaults, startsTripOnConfirm = false, duration = 250 } = {}) {',
    "number pad start parameter"
)

text = replace_once(
    text,
    '''            persistence: source === "new-trip"\n                ? (clockTimer.networkStatus === "online" ? "pending" : "offline")\n                : clockTimer.networkStatus,\n            tripDefaults\n        };''',
    '''            persistence: source === "new-trip"\n                ? (clockTimer.networkStatus === "online" ? "pending" : "offline")\n                : clockTimer.networkStatus,\n            tripDefaults,\n            startsTripOnConfirm: Boolean(startsTripOnConfirm)\n        };''',
    "store number pad start behavior"
)

text = replace_once(
    text,
    '''        if (discardPrepared && state?.source === "new-trip") {\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }''',
    '''        if (discardPrepared && state?.source === "new-trip") {\n            tripDraft = undefined;\n            uiReturnStack.length = 0;\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }''',
    "discard trip draft with root number pad"
)

text = replace_once(
    text,
    '''    async function commitNumberPad() {\n        if (!numberPadState || !numberPadHasChanges() || !numberPadValueValid()) return false;\n        const state = { ...numberPadState };''',
    '''    async function commitNumberPad() {\n        if (!numberPadState || !numberPadValueValid()) return false;\n        const state = { ...numberPadState };\n        if (!numberPadHasChanges() && !state.startsTripOnConfirm) return false;''',
    "allow unchanged start action"
)

old_duration = '''        const formatted = renderTimeDigits(state.pending);\n        if (!formatted) return false;\n        stagedStandardTime = formatted;\n        if (state.source === "standard-time" && !tripIsLive()) {\n            const parentNumberPad = findUIReturnFrame("number-pad")?.state;\n            if (parentNumberPad) {\n                parentNumberPad.pending = state.pending;\n                parentNumberPad.replaceOnNextDigit = false;\n            }\n        }\n        if (state.source === "new-trip") {\n            const tripDefaults = state.tripDefaults;\n            await clockTimer.start({\n                standardTime: formatted,\n                creationTime: tripDefaults?.creationTime,\n                scheduledStart: tripDefaults?.scheduledStart,\n                startTime: tripDefaults?.startTime\n            });\n            if (tripDefaults?.creationDate && clockTimer.creationDate !== tripDefaults.creationDate) {\n                clockTimer.creationDate = tripDefaults.creationDate;\n            }\n        }\n        else if (clockTimer.standardTime !== undefined) {\n            clockTimer.standardTime = formatted;\n            if (clockTimer.standardTime !== formatted) return false;\n        }\n        return true;'''

new_duration = '''        const formatted = renderTimeDigits(state.pending);\n        if (!formatted) return false;\n        stagedStandardTime = formatted;\n\n        if (!tripIsLive() && tripDraft) {\n            tripDraft.standardTime = formatted;\n            if (state.source === "standard-time") {\n                syncDraftStandardTimeReturnFrame(formatted);\n            }\n            if (state.startsTripOnConfirm) {\n                return startTripDraft();\n            }\n            return true;\n        }\n\n        if (state.startsTripOnConfirm) {\n            tripDraft = {\n                ...(state.tripDefaults || {}),\n                standardTime: formatted\n            };\n            return startTripDraft();\n        }\n\n        if (clockTimer.standardTime !== undefined) {\n            clockTimer.standardTime = formatted;\n            if (clockTimer.standardTime !== formatted) return false;\n        }\n        return true;'''
text = replace_once(text, old_duration, new_duration, "draft standard time commit")

old_trip_live = '''    function tripIsLive() {\n        return app.dataset.tripState === "running";\n    }'''
new_trip_live = '''    function tripIsLive() {\n        return app.dataset.tripState === "running";\n    }\n\n    function syncDraftStandardTimeReturnFrame(formatted) {\n        const frame = findUIReturnFrame("number-pad");\n        if (!frame?.state || frame.state.source !== "new-trip") return;\n        const digits = normalizeTimeDigits(formatted);\n        frame.state.initial = digits;\n        frame.state.pending = digits;\n        frame.state.replaceOnNextDigit = false;\n        frame.state.startsTripOnConfirm = true;\n    }\n\n    async function startTripDraft() {\n        const draft = tripDraft;\n        const standardTime = String(draft?.standardTime || "").trim();\n        if (!draft || !standardTime) return false;\n\n        await clockTimer.start({\n            standardTime,\n            creationTime: draft.creationTime,\n            scheduledStart: draft.scheduledStart,\n            startTime: draft.startTime\n        });\n        if (draft.creationDate && clockTimer.creationDate !== draft.creationDate) {\n            clockTimer.creationDate = draft.creationDate;\n        }\n\n        stagedStandardTime = standardTime;\n        tripDraft = undefined;\n        uiReturnStack.length = 0;\n        return true;\n    }'''
text = replace_once(text, old_trip_live, new_trip_live, "trip draft helpers")

old_refresh = '''    function refreshTripSettingsValues() {\n        const live = tripIsLive();\n        const snapshot = getTripSettingsPadSnapshot();\n        const pendingField = getTripSettingsPendingField(snapshot);\n        const tripDefaults = snapshot?.tripDefaults;\n        const values = {\n            "creation-time": live\n                ? formatTripTimeDisplay(clockTimer.creationTime, clockTimer.creationDate)\n                : tripDefaults\n                    ? formatTripTimeDisplay(tripDefaults.creationTime, tripDefaults.creationDate)\n                    : "---",\n            "scheduled-start": live\n                ? formatTripTimeDisplay(clockTimer.scheduledStart, clockTimer.creationDate)\n                : tripDefaults\n                    ? formatTripTimeDisplay(tripDefaults.scheduledStart, tripDefaults.creationDate)\n                    : "---",\n            "actual-start": live\n                ? formatTripTimeDisplay(clockTimer.startTime, clockTimer.creationDate)\n                : tripDefaults\n                    ? formatTripTimeDisplay(tripDefaults.startTime, tripDefaults.creationDate)\n                    : "---",\n            "standard-time": live && clockTimer.standardTime ? clockTimer.standardTime : "---"\n        };\n\n        if (pendingField) {\n            values[pendingField] = formatTripSettingsPendingValue(snapshot);\n        }\n\n        $("#tripCreationTime").textContent = values["creation-time"];\n        $("#tripScheduledStart").textContent = values["scheduled-start"];\n        $("#tripActualStart").textContent = values["actual-start"];\n        $("#tripStandardTime").textContent = values["standard-time"];\n        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n            const field = button.dataset.tripTimeField;\n            button.disabled = !live && !tripDefaults && !(field === "standard-time" && pendingField === "standard-time");\n        });\n        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;\n        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;\n    }'''

new_refresh = '''    function refreshTripSettingsValues() {\n        const live = tripIsLive();\n        const draft = !live ? tripDraft : undefined;\n        const values = {\n            "creation-time": live\n                ? formatTripTimeDisplay(clockTimer.creationTime, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.creationTime, draft.creationDate)\n                    : "---",\n            "scheduled-start": live\n                ? formatTripTimeDisplay(clockTimer.scheduledStart, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.scheduledStart, draft.creationDate)\n                    : "---",\n            "actual-start": live\n                ? formatTripTimeDisplay(clockTimer.startTime, clockTimer.creationDate)\n                : draft\n                    ? formatTripTimeDisplay(draft.startTime, draft.creationDate)\n                    : "---",\n            "standard-time": live\n                ? (clockTimer.standardTime || "---")\n                : (draft?.standardTime || "---")\n        };\n\n        $("#tripCreationTime").textContent = values["creation-time"];\n        $("#tripScheduledStart").textContent = values["scheduled-start"];\n        $("#tripActualStart").textContent = values["actual-start"];\n        $("#tripStandardTime").textContent = values["standard-time"];\n        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n            button.disabled = !live && !draft;\n        });\n        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;\n        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;\n        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";\n        tripSettingsPrimary.value = draft ? "start" : "save";\n        tripSettingsPrimary.disabled = Boolean(draft && !draft.standardTime);\n    }'''
text = replace_once(text, old_refresh, new_refresh, "draft trip settings rendering")

old_field = '''    function getTripFieldValue(field, snapshot = getTripSettingsPadSnapshot()) {\n        const defaults = !tripIsLive() ? snapshot?.tripDefaults : undefined;\n        if (field === "creation-time") return defaults?.creationTime || clockTimer.creationTime || "";\n        if (field === "scheduled-start") return defaults?.scheduledStart || clockTimer.scheduledStart || "";\n        if (field === "actual-start") return defaults?.startTime || clockTimer.startTime || "";\n        if (field === "standard-time") return clockTimer.standardTime || "";\n        return "";\n    }\n\n    function openTripFieldNumberPad(field) {\n        const snapshot = getTripSettingsPadSnapshot();\n        const pendingField = getTripSettingsPendingField(snapshot);\n\n        if (pendingField === field && snapshot) {\n            return restoreNumberPadState({\n                ...snapshot,\n                source: field,\n                title: getNumberPadTitle(field),\n            });\n        }\n\n        if (!tripIsLive() && !snapshot?.tripDefaults) return Promise.resolve();\n        const absolute = field !== "standard-time";\n        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field, snapshot),\n            tripDefaults: snapshot?.tripDefaults,\n            duration: 0\n        });\n    }'''

new_field = '''    function getTripFieldValue(field) {\n        const draft = !tripIsLive() ? tripDraft : undefined;\n        if (field === "creation-time") return draft?.creationTime || clockTimer.creationTime || "";\n        if (field === "scheduled-start") return draft?.scheduledStart || clockTimer.scheduledStart || "";\n        if (field === "actual-start") return draft?.startTime || clockTimer.startTime || "";\n        if (field === "standard-time") return draft?.standardTime || clockTimer.standardTime || "";\n        return "";\n    }\n\n    function openTripFieldNumberPad(field) {\n        if (!tripIsLive() && !tripDraft) return Promise.resolve();\n        const absolute = field !== "standard-time";\n        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field),\n            tripDefaults: !tripIsLive() ? tripDraft : undefined,\n            startsTripOnConfirm: false,\n            duration: 0\n        });\n    }'''
text = replace_once(text, old_field, new_field, "fresh trip field editor")

old_settings_click = '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            const caller = captureNumberPadReturnFrame();'''
new_settings_click = '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            if (tripDraft && numberPadState.source === "new-trip" && numberPadValueValid()) {\n                const formatted = renderTimeDigits(numberPadState.pending);\n                if (formatted) tripDraft.standardTime = formatted;\n            }\n            const caller = captureNumberPadReturnFrame();'''
text = replace_once(text, old_settings_click, new_settings_click, "sync draft before settings")

old_submit = '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;\n        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        void closeDialogWithReturn(tripSettingsDialog, {\n            reason: "trip-settings-save"\n        }).catch(() => {});\n    });'''
new_submit = '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;\n        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n\n        void (async () => {\n            if (tripDraft && !tripIsLive()) {\n                if (!await startTripDraft()) {\n                    refreshTripSettingsValues();\n                    return;\n                }\n                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });\n                return;\n            }\n\n            await closeDialogWithReturn(tripSettingsDialog, {\n                reason: "trip-settings-save"\n            });\n        })().catch(() => {});\n    });'''
text = replace_once(text, old_submit, new_submit, "trip settings start action")

old_begin = '''        const tripDefaults = getTripMomentDefaults(moment);\n        const newTripInitialValue = initialValue ?? (\n            clockTimer.status === "stopped"\n                ? ""\n                : (stagedStandardTime || "")\n        );'''
new_begin = '''        const tripDefaults = getTripMomentDefaults(moment);\n        const newTripInitialValue = initialValue ?? (\n            clockTimer.status === "stopped"\n                ? ""\n                : (stagedStandardTime || "")\n        );\n        tripDraft = {\n            ...tripDefaults,\n            standardTime: newTripInitialValue || ""\n        };'''
text = replace_once(text, old_begin, new_begin, "initialize trip draft")

text = replace_once(
    text,
    '''            initialValue: newTripInitialValue,\n            preparationPromise,\n            tripDefaults\n        });''',
    '''            initialValue: newTripInitialValue,\n            preparationPromise,\n            tripDefaults: tripDraft,\n            startsTripOnConfirm: true\n        });''',
    "root number pad starts trip"
)

app.write_text(text, encoding="utf-8")

html = Path("index.html")
text = html.read_text(encoding="utf-8")
text = replace_once(
    text,
    '<button class="primary-action" type="submit" value="save">Save</button>\n            </div>\n        </form>\n    </dialog>\n\n    <dialog id="breakDialog"',
    '<button id="tripSettingsPrimary" class="primary-action" type="submit" value="save">Save</button>\n            </div>\n        </form>\n    </dialog>\n\n    <dialog id="breakDialog"',
    "trip settings primary id"
)
html.write_text(text, encoding="utf-8")

css = Path("app.css")
text = css.read_text(encoding="utf-8")
marker = '''.number-pad-confirm[data-action="confirm"]::before {\n    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m4 12 5 5L20 6' fill='none' stroke='black' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m4 12 5 5L20 6' fill='none' stroke='black' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");\n}\n'''
addition = marker + '''\n.number-pad-confirm[data-action="start"]::before {\n    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 3.5 20 12 6 20.5Z' fill='black'/%3E%3C/svg%3E");\n    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 3.5 20 12 6 20.5Z' fill='black'/%3E%3C/svg%3E");\n}\n'''
text = replace_once(text, marker, addition, "start triangle icon")
css.write_text(text, encoding="utf-8")
