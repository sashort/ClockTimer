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
    '    let tripSettingsOpenAfterPadClose = false;\n',
    '',
    'remove delayed trip settings flag'
)

replace_once(
    '''    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false, immediate = false } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        const tripSettingsHandoff = suppressReturn || Boolean(state?.returnToTripSettings);\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {\n            reason: "number-pad",\n            immediate: immediate || tripSettingsHandoff\n        })) {\n            return false;\n        }\n        numberPadClosedState = suppressReturn && state ? { ...state, returnToTripSettings: false } : state;\n        resetNumberPad();\n        if (discardPrepared && state?.source === "new-trip") {\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }\n        return true;\n    }''',
    '''    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false, immediate = false } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        const tripSettingsHandoff = suppressReturn || Boolean(state?.returnToTripSettings);\n\n        if (tripSettingsHandoff && !tripSettingsDialog.open) {\n            const reason = suppressReturn ? "number-pad-settings" : "number-pad-return";\n            if (!openTripSettingsDialog(reason, { duration: 0 })) return false;\n        }\n\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {\n            reason: "number-pad",\n            immediate: immediate || tripSettingsHandoff\n        })) {\n            return false;\n        }\n\n        numberPadClosedState = tripSettingsHandoff && state\n            ? { ...state, returnToTripSettings: false }\n            : state;\n        resetNumberPad();\n        if (discardPrepared && state?.source === "new-trip") {\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }\n        return true;\n    }''',
    'show trip settings before closing number pad'
)

replace_once(
    '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            tripSettingsPadStack.push({ ...numberPadState });\n            tripSettingsOpenAfterPadClose = true;\n            closeNumberPad({ discardPrepared: false, allowChanged: true, suppressReturn: true });\n        });''',
    '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            tripSettingsPadStack.push({ ...numberPadState });\n            if (!closeNumberPad({\n                discardPrepared: false,\n                allowChanged: true,\n                suppressReturn: true,\n                immediate: true\n            })) {\n                tripSettingsPadStack.pop();\n            }\n        });''',
    'settings button handoff'
)

replace_once(
    '''        numberPadDialog.addEventListener("closed", () => {\n            const state = numberPadClosedState;\n            numberPadClosedState = undefined;\n            if (tripSettingsOpenAfterPadClose) {\n                tripSettingsOpenAfterPadClose = false;\n                openTripSettingsDialog("number-pad-settings", { duration: 0 });\n                return;\n            }\n            if (state?.returnToTripSettings) {\n                openTripSettingsDialog("number-pad-return", { duration: 0 });\n            }\n        });''',
    '''        numberPadDialog.addEventListener("closed", () => {\n            const state = numberPadClosedState;\n            numberPadClosedState = undefined;\n            if (state?.returnToTripSettings && !tripSettingsDialog.open) {\n                openTripSettingsDialog("number-pad-return", { duration: 0 });\n            }\n        });''',
    'remove post-close trip settings open'
)

path.write_text(text, encoding="utf-8")
