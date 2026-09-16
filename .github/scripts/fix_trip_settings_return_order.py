from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '            "new-trip": "Start Time",',
    '            "new-trip": "Standard Time",',
    'new trip number pad banner'
)

replace_once(
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            closeDialog(dialog, {\n                immediate: dialog === tripSettingsDialog && tripSettingsPadStack.length > 0\n            });\n        });\n    });''',
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            if (dialog === tripSettingsDialog && tripSettingsPadStack.length > 0) {\n                void returnToNumberPadFromTripSettings("trip-settings-close").catch(() => {});\n                return;\n            }\n            closeDialog(dialog);\n        });\n    });''',
    'trip settings close button return order'
)

replace_once(
    '''    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {\n        refreshTripSettingsValues();\n        return openDialogElement(tripSettingsDialog, { duration, reason });\n    }''',
    '''    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {\n        refreshTripSettingsValues();\n        return openDialogElement(tripSettingsDialog, { duration, reason });\n    }\n\n    async function returnToNumberPadFromTripSettings(reason = "trip-settings-return") {\n        const snapshot = getTripSettingsPadSnapshot();\n        if (!snapshot) return closeDialog(tripSettingsDialog, { reason });\n\n        await restoreNumberPadState(snapshot, { duration: 0 });\n        if (!numberPadDialog?.open) return false;\n\n        tripSettingsPadStack.pop();\n        tripSettingsOpeningEditor = true;\n        if (!closeDialog(tripSettingsDialog, { reason, immediate: true })) {\n            tripSettingsOpeningEditor = false;\n            tripSettingsPadStack.push(snapshot);\n            return false;\n        }\n        return true;\n    }''',
    'add trip settings return helper'
)

replace_once(
    '''    tripSettingsDialog.addEventListener("closed", () => {\n        if (tripSettingsOpeningEditor) {\n            tripSettingsOpeningEditor = false;\n            return;\n        }\n        const snapshot = tripSettingsPadStack.pop();\n        if (snapshot) void restoreNumberPadState(snapshot).catch(() => {});\n    });''',
    '''    tripSettingsDialog.addEventListener("closed", () => {\n        if (tripSettingsOpeningEditor) {\n            tripSettingsOpeningEditor = false;\n        }\n    });\n\n    tripSettingsDialog.addEventListener("cancel", event => {\n        if (tripSettingsPadStack.length === 0) return;\n        event.preventDefault();\n        void returnToNumberPadFromTripSettings("trip-settings-cancel").catch(() => {});\n    });''',
    'remove close-then-restore behavior'
)

replace_once(
    '''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            if (button.disabled) return;\n            const field = button.dataset.tripTimeField;\n            tripSettingsOpeningEditor = true;\n            if (!closeDialog(tripSettingsDialog, { reason: `trip-settings:${field}`, immediate: true })) {\n                tripSettingsOpeningEditor = false;\n                return;\n            }\n            setTimeout(() => {\n                void openTripFieldNumberPad(field).catch(() => {});\n            }, 0);\n        });\n    });''',
    '''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            if (button.disabled) return;\n            const field = button.dataset.tripTimeField;\n            void (async () => {\n                try {\n                    await openTripFieldNumberPad(field);\n                    if (!numberPadDialog?.open) return;\n                    tripSettingsOpeningEditor = true;\n                    if (!closeDialog(tripSettingsDialog, { reason: `trip-settings:${field}`, immediate: true })) {\n                        tripSettingsOpeningEditor = false;\n                    }\n                }\n                catch {}\n            })();\n        });\n    });''',
    'show field number pad before closing trip settings'
)

replace_once(
    '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;\n        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        closeDialog(tripSettingsDialog, {\n            reason: "trip-settings-save",\n            immediate: tripSettingsPadStack.length > 0\n        });\n    });''',
    '''    tripSettingsForm.addEventListener("submit", event => {\n        event.preventDefault();\n        const form = event.currentTarget;\n        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;\n        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;\n        if (tripSettingsPadStack.length > 0) {\n            void returnToNumberPadFromTripSettings("trip-settings-save").catch(() => {});\n            return;\n        }\n        closeDialog(tripSettingsDialog, { reason: "trip-settings-save" });\n    });''',
    'trip settings save return order'
)

path.write_text(text, encoding="utf-8")
