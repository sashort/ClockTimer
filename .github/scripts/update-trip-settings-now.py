from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# index.html
path = Path("index.html")
text = path.read_text(encoding="utf-8")

rows = {
    "standard-time": ("Standard Time", "Expected duration."),
    "scheduled-start": ("Scheduled Start", "Planned start time."),
    "actual-start": ("Actual Start", "When the trip actually started."),
    "creation-time": ("Creation Time", "When the trip was created."),
}
for field, (title, description) in rows.items():
    old = f'''                    <div class="trip-time-copy">\n                        <strong>{title}</strong>\n                        <span>{description}</span>\n                    </div>'''
    new = f'''                    <div class="trip-time-copy">\n                        <strong>{title}</strong>\n                        <span class="trip-time-separator" aria-hidden="true">—</span>\n                        <span class="trip-time-description">{description}</span>\n                    </div>'''
    text = replace_once(text, old, new, f"{field} inline description")

text = replace_once(
    text,
    '''            </section>\n            <fieldset class="trip-settings-behavior">\n                <legend>Options</legend>\n                <label class="toggle-row">Match Trip Goal to Total<input name="autoSyncTripGoal" type="checkbox"></label>\n            </fieldset>''',
    '''            </section>\n\n            <button id="tripSetStartsNow" class="trip-now-action" type="button" hidden>Set Scheduled/Actual Start to Now</button>\n\n            <fieldset class="trip-settings-behavior">\n                <legend>Options</legend>\n                <label id="tripGoalSyncOption" class="toggle-row trip-goal-sync-option">\n                    <span class="trip-goal-sync-label">\n                        <span class="trip-goal-sync-text">Match Trip Goal To Total</span>\n                        <span id="tripGoalSyncNoData" class="trip-goal-sync-status" hidden>(No Data)</span>\n                    </span>\n                    <input name="autoSyncTripGoal" type="checkbox">\n                </label>\n            </fieldset>''',
    "now button and goal option"
)
path.write_text(text, encoding="utf-8")


# app.js
path = Path("app.js")
text = path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''    const tripSettingsForm = $("#tripSettingsForm");\n    const tripSettingsTitle = $("#tripSettingsTitle");\n    const tripSettingsPrimary = $("#tripSettingsPrimary");''',
    '''    const tripSettingsForm = $("#tripSettingsForm");\n    const tripSettingsTitle = $("#tripSettingsTitle");\n    const tripSettingsPrimary = $("#tripSettingsPrimary");\n    const tripSetStartsNow = $("#tripSetStartsNow");\n    const tripGoalSyncOption = $("#tripGoalSyncOption");\n    const tripGoalSyncNoData = $("#tripGoalSyncNoData");''',
    "trip settings references"
)

text = replace_once(
    text,
    '''    function formatTimelineMilliseconds(milliseconds) {\n        if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;\n        const totalSeconds = Math.floor(milliseconds / 1000);\n        const hours = Math.floor(totalSeconds / 3600);\n        const minutes = Math.floor((totalSeconds % 3600) / 60);\n        const seconds = totalSeconds % 60;\n        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;\n    }''',
    '''    function formatTimelineMilliseconds(milliseconds) {\n        if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;\n        const totalSeconds = Math.floor(milliseconds / 1000);\n        const hours = Math.floor(totalSeconds / 3600);\n        const minutes = Math.floor((totalSeconds % 3600) / 60);\n        const seconds = totalSeconds % 60;\n        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;\n    }\n\n    function formatTimelineDateTime(date, creationDate) {\n        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;\n        const base = parseDateInput(creationDate);\n        if (!base) return undefined;\n        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());\n        const timeMilliseconds =\n            (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +\n            date.getMilliseconds();\n        const timelineMilliseconds = day.getTime() - base.getTime() + timeMilliseconds;\n        const formatted = formatTimelineMilliseconds(timelineMilliseconds);\n        if (!formatted) return undefined;\n        return date.getMilliseconds() === 0\n            ? formatted\n            : `${formatted}.${String(date.getMilliseconds()).padStart(3, "0")}`;\n    }''',
    "timeline now formatter"
)

text = replace_once(
    text,
    '''    async function startTripDraft() {\n        const draft = tripDraft;\n        const standardTime = String(draft?.standardTime || "").trim();\n        if (!draft || !standardTime) return false;''',
    '''    function tripDraftCanStart(draft = tripDraft) {\n        if (!draft || !parseDateInput(draft.creationDate)) return false;\n        const standardTime = parseTimelineTime(draft.standardTime);\n        const creationTime = parseTimelineTime(draft.creationTime);\n        const scheduledStart = parseTimelineTime(draft.scheduledStart);\n        const actualStart = parseTimelineTime(draft.startTime);\n        return (\n            Number.isFinite(standardTime) && standardTime > 0 &&\n            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 24 * 60 * 60 * 1000 &&\n            Number.isFinite(scheduledStart) && scheduledStart >= 0 &&\n            Number.isFinite(actualStart) && actualStart >= 0\n        );\n    }\n\n    async function startTripDraft() {\n        const draft = tripDraft;\n        const standardTime = String(draft?.standardTime || "").trim();\n        if (!tripDraftCanStart(draft)) return false;''',
    "draft start validity"
)

text = replace_once(
    text,
    '''        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;\n        if (!aggregateGoalAvailable && clockTimer.autoSyncTripGoal) {\n            clockTimer.autoSyncTripGoal = false;\n        }\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable;\n        autoSyncTripGoal.checked = aggregateGoalAvailable && clockTimer.autoSyncTripGoal;\n        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";\n        tripSettingsPrimary.value = draft ? "start" : "save";\n        tripSettingsPrimary.disabled = Boolean(draft && !draft.standardTime);''',
    '''        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";\n        tripSetStartsNow.hidden = !draft;\n        tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(draft.creationDate));\n        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;\n        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;\n        if (!aggregateGoalAvailable && clockTimer.autoSyncTripGoal) {\n            clockTimer.autoSyncTripGoal = false;\n        }\n        autoSyncTripGoal.disabled = !aggregateGoalAvailable;\n        autoSyncTripGoal.checked = aggregateGoalAvailable && clockTimer.autoSyncTripGoal;\n        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);\n        tripGoalSyncNoData.hidden = aggregateGoalAvailable;\n        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";\n        tripSettingsPrimary.value = draft ? "start" : "save";\n        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanStart(draft));''',
    "trip settings refresh state"
)

text = replace_once(
    text,
    '''    tripSettingsForm.addEventListener("submit", event => {''',
    '''    tripSetStartsNow.addEventListener("pointerup", () => {\n        if (!tripDraft || tripIsLive()) return;\n        const now = new Date();\n        const value = formatTimelineDateTime(now, tripDraft.creationDate);\n        if (!value) return;\n        tripDraft.scheduledStart = value;\n        tripDraft.startTime = value;\n        refreshTripSettingsValues();\n    });\n\n    tripSettingsForm.addEventListener("submit", event => {''',
    "set starts to now action"
)

path.write_text(text, encoding="utf-8")


# app.css
path = Path("app.css")
text = path.read_text(encoding="utf-8")
text += '''\n\n/* compact-trip-settings-v2 */\n.trip-time-copy {\n    display: flex;\n    align-items: baseline;\n    gap: 0.55em;\n    min-width: 0;\n    line-height: 1.2;\n}\n\n.trip-time-copy strong {\n    flex: 0 0 auto;\n}\n\n.trip-time-separator {\n    flex: 0 0 auto;\n    color: rgb(255 255 255 / 48%);\n}\n\n.trip-time-description,\n.trip-goal-sync-status {\n    color: rgb(255 255 255 / 74%);\n    font-size: 13px;\n    font-weight: 400;\n}\n\n.trip-time-description {\n    min-width: 0;\n}\n\n.trip-now-action {\n    min-height: 48px;\n    padding: 10px 16px;\n    border: 1.5px solid rgb(190 224 255 / 84%);\n    border-radius: 10px;\n    color: var(--wm-white);\n    background: var(--ui-blue-gradient);\n    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);\n    font-size: 16px;\n    font-weight: 700;\n}\n\n.trip-now-action:disabled {\n    opacity: 0.38;\n    cursor: not-allowed;\n}\n\n.trip-goal-sync-label {\n    display: flex;\n    align-items: baseline;\n    gap: 0.6em;\n    min-width: 0;\n}\n\n.trip-goal-sync-option.is-unavailable .trip-goal-sync-text {\n    text-decoration: line-through;\n    text-decoration-thickness: 1px;\n    opacity: 0.62;\n}\n\n.trip-goal-sync-status {\n    flex: 0 0 auto;\n    text-decoration: none;\n}\n\n@media (max-width: 620px) {\n    .trip-time-copy {\n        gap: 0.45em;\n    }\n\n    .trip-time-description,\n    .trip-goal-sync-status {\n        font-size: 12px;\n    }\n}\n'''
path.write_text(text, encoding="utf-8")
