from pathlib import Path

APP_JS = Path("app.js")
APP_CSS = Path("app.css")

js = APP_JS.read_text(encoding="utf-8")
css = APP_CSS.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


js = replace_once(
    js,
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => closeDialog(button.closest("dialog")));\n    });''',
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            closeDialog(dialog, {\n                immediate: dialog === tripSettingsDialog && tripSettingsPadStack.length > 0\n            });\n        });\n    });''',
    "trip settings close handoff"
)

js = replace_once(
    js,
    '''    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false, tripDefaults } = {}) {''',
    '''    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false, tripDefaults, duration = 250 } = {}) {''',
    "openNumberPad duration parameter"
)

js = replace_once(
    js,
    '''            openDialogElement(numberPadDialog, {\n                duration: 250,\n                reason: `number-pad:${source}`\n            });''',
    '''            openDialogElement(numberPadDialog, {\n                duration,\n                reason: `number-pad:${source}`\n            });''',
    "openNumberPad duration use"
)

js = replace_once(
    js,
    '''    async function restoreNumberPadState(snapshot) {\n        if (!snapshot) return;''',
    '''    async function restoreNumberPadState(snapshot, { duration = 0 } = {}) {\n        if (!snapshot) return;''',
    "restoreNumberPadState duration parameter"
)

js = replace_once(
    js,
    '''            openDialogElement(numberPadDialog, {\n                duration: 250,\n                reason: "trip-settings-return"\n            });''',
    '''            openDialogElement(numberPadDialog, {\n                duration,\n                reason: "trip-settings-return"\n            });''',
    "restoreNumberPadState duration use"
)

js = replace_once(
    js,
    '''    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {''',
    '''    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false, immediate = false } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        const tripSettingsHandoff = suppressReturn || Boolean(state?.returnToTripSettings);\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {\n            reason: "number-pad",\n            immediate: immediate || tripSettingsHandoff\n        })) {''',
    "closeNumberPad immediate handoff"
)

js = replace_once(
    js,
    '''    function openTripSettingsDialog(reason = "number-pad-settings") {\n        refreshTripSettingsValues();\n        return openDialogElement(tripSettingsDialog, { duration: 250, reason });\n    }''',
    '''    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {\n        refreshTripSettingsValues();\n        return openDialogElement(tripSettingsDialog, { duration, reason });\n    }''',
    "openTripSettingsDialog duration"
)

js = replace_once(
    js,
    '''        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field, snapshot),\n            tripDefaults: snapshot?.tripDefaults,\n            returnToTripSettings: true\n        });''',
    '''        return openNumberPad({\n            mode: absolute ? "absolute" : "time",\n            source: field,\n            initialValue: getTripFieldValue(field, snapshot),\n            tripDefaults: snapshot?.tripDefaults,\n            returnToTripSettings: true,\n            duration: 0\n        });''',
    "trip settings to number pad open"
)

js = replace_once(
    js,
    '''            if (tripSettingsOpenAfterPadClose) {\n                tripSettingsOpenAfterPadClose = false;\n                openTripSettingsDialog();\n                return;\n            }\n            if (state?.returnToTripSettings) {\n                openTripSettingsDialog("number-pad-return");\n            }''',
    '''            if (tripSettingsOpenAfterPadClose) {\n                tripSettingsOpenAfterPadClose = false;\n                openTripSettingsDialog("number-pad-settings", { duration: 0 });\n                return;\n            }\n            if (state?.returnToTripSettings) {\n                openTripSettingsDialog("number-pad-return", { duration: 0 });\n            }''',
    "number pad to trip settings open"
)

js = replace_once(
    js,
    '''        closeDialog(tripSettingsDialog, { reason: "trip-settings-save" });''',
    '''        closeDialog(tripSettingsDialog, {\n            reason: "trip-settings-save",\n            immediate: tripSettingsPadStack.length > 0\n        });''',
    "trip settings save handoff"
)

css = replace_once(
    css,
    '''    transition-duration: 250ms;\n    transition-timing-function: linear;\n    transition-behavior: normal, allow-discrete, allow-discrete;\n}\n\n.number-pad-dialog[open] { opacity: 1; }\n\n.number-pad-dialog::backdrop {\n    background: rgb(0 0 0 / 55%);\n    opacity: 0;\n    transition: opacity 250ms linear;''',
    '''    transition-duration: var(--app-dialog-transition-duration, 250ms);\n    transition-timing-function: linear;\n    transition-behavior: normal, allow-discrete, allow-discrete;\n}\n\n.number-pad-dialog[open] { opacity: 1; }\n\n.number-pad-dialog::backdrop {\n    background: rgb(0 0 0 / 55%);\n    opacity: 0;\n    transition: opacity var(--app-dialog-transition-duration, 250ms) linear;''',
    "number pad transition duration variable"
)

fullscreen_css = '''\n\n/* fullscreen-trip-editor-v1 */\n.trip-settings-dialog,\n.number-pad-dialog {\n    position: fixed;\n    inset: 0;\n    width: 100vw;\n    max-width: none;\n    height: 100dvh;\n    max-height: none;\n    margin: 0;\n    padding: 0;\n    border: 0;\n    border-radius: 0;\n    box-shadow: none;\n}\n\n.trip-settings-dialog {\n    overflow: auto;\n}\n\n.trip-settings-dialog form {\n    min-height: 100%;\n}\n\n.number-pad-dialog {\n    overflow: hidden;\n    background: var(--wm-blue-dark);\n}\n\n.number-pad-shell {\n    width: 100%;\n    height: 100%;\n    min-height: 100%;\n    display: grid;\n    grid-template-rows: auto auto minmax(0, 1fr);\n    border: 0;\n    border-radius: 0;\n    box-shadow: none;\n}\n\n.number-pad-grid {\n    min-height: 0;\n    grid-template-rows: repeat(4, minmax(0, 1fr));\n}\n\n.number-pad-key {\n    height: 100%;\n    aspect-ratio: auto;\n}\n'''

if "/* fullscreen-trip-editor-v1 */" in css:
    raise RuntimeError("fullscreen CSS block already exists")
css += fullscreen_css

APP_JS.write_text(js, encoding="utf-8")
APP_CSS.write_text(css, encoding="utf-8")
