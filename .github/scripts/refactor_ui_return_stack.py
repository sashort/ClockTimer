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
    '''    let numberPadAM;\n    let numberPadPM;\n    let numberPadClosedState;\n    const tripSettingsPadStack = [];\n    let tripSettingsOpeningEditor = false;''',
    '''    let numberPadAM;\n    let numberPadPM;\n    const uiReturnStack = [];''',
    "replace ad-hoc navigation state"
)

replace_once(
    '''    function hidePopoverForHandoff(popover) {\n        if (!popoverIsOpen(popover)) return true;\n        popover.classList.add("popover-immediate-close");\n        popover.hidePopover?.();\n        const closed = !popoverIsOpen(popover);\n        requestAnimationFrame(() => popover.classList.remove("popover-immediate-close"));\n        return closed;\n    }''',
    '''    function hidePopoverForHandoff(popover) {\n        if (!popoverIsOpen(popover)) return true;\n        popover.classList.add("popover-immediate-close");\n        popover.hidePopover?.();\n        const closed = !popoverIsOpen(popover);\n        requestAnimationFrame(() => popover.classList.remove("popover-immediate-close"));\n        return closed;\n    }\n\n    function peekUIReturnFrame() {\n        return uiReturnStack[uiReturnStack.length - 1];\n    }\n\n    function findUIReturnFrame(type) {\n        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {\n            if (uiReturnStack[index]?.type === type) return uiReturnStack[index];\n        }\n        return undefined;\n    }\n\n    function pushUIReturnFrame(frame) {\n        if (!frame) return false;\n        uiReturnStack.push(frame);\n        return true;\n    }\n\n    function popUIReturnFrame(frame = peekUIReturnFrame()) {\n        if (!frame || peekUIReturnFrame() !== frame) return false;\n        uiReturnStack.pop();\n        return true;\n    }\n\n    function captureNumberPadReturnFrame() {\n        return numberPadState\n            ? { type: "number-pad", state: { ...numberPadState } }\n            : undefined;\n    }\n\n    async function restoreUIReturnFrame(frame, reason = "ui-return") {\n        if (!frame) return false;\n\n        if (frame.type === "number-pad") {\n            await restoreNumberPadState(frame.state, { duration: 0 });\n            return Boolean(numberPadDialog?.open);\n        }\n\n        if (frame.type === "dialog") {\n            if (frame.element?.open) return true;\n            if (frame.element === tripSettingsDialog) {\n                return openTripSettingsDialog(reason, { duration: 0 });\n            }\n            return openDialogElement(frame.element, { duration: 0, reason });\n        }\n\n        if (frame.type === "popover") {\n            if (popoverIsOpen(frame.element)) return true;\n            try { frame.element?.showPopover?.(); }\n            catch { return false; }\n            return popoverIsOpen(frame.element);\n        }\n\n        return false;\n    }\n\n    async function closeDialogWithReturn(dialog, { reason = "user", immediate = false } = {}) {\n        if (!dialog?.open) return false;\n        const caller = peekUIReturnFrame();\n\n        if (caller && !await restoreUIReturnFrame(caller, `${reason}:return`)) {\n            return false;\n        }\n\n        const handoffImmediate = immediate || (\n            dialog === tripSettingsDialog && caller?.type === "number-pad"\n        );\n        if (!closeDialog(dialog, { reason, immediate: handoffImmediate })) return false;\n        if (caller) popUIReturnFrame(caller);\n        return true;\n    }''',
    "insert UI return stack helpers"
)

replace_once(
    '''    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {\n        const dialog = document.getElementById(id);\n        if (!dialog || dialog.open) return false;\n        if (fromPopover && !hidePopoverForHandoff(mainMenu)) return false;\n        return openDialogElement(dialog, {\n            duration: fromPopover ? 750 : 250,\n            reason\n        });\n    }''',
    '''    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {\n        const dialog = document.getElementById(id);\n        if (!dialog || dialog.open) return false;\n\n        const caller = fromPopover && popoverIsOpen(mainMenu)\n            ? { type: "popover", element: mainMenu }\n            : undefined;\n        if (caller) pushUIReturnFrame(caller);\n\n        const opened = openDialogElement(dialog, {\n            duration: fromPopover ? 750 : 250,\n            reason\n        });\n        if (!opened) {\n            if (caller) popUIReturnFrame(caller);\n            return false;\n        }\n\n        if (caller && !hidePopoverForHandoff(mainMenu)) {\n            closeDialog(dialog, { reason: `${reason}:rollback`, immediate: true });\n            popUIReturnFrame(caller);\n            return false;\n        }\n        return true;\n    }''',
    "make popover-to-dialog navigation stack aware"
)

replace_once(
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            if (dialog === tripSettingsDialog && tripSettingsPadStack.length > 0) {\n                void returnToNumberPadFromTripSettings("trip-settings-close").catch(() => {});\n                return;\n            }\n            closeDialog(dialog);\n        });\n    });''',
    '''    document.querySelectorAll("[data-close-dialog]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            const dialog = button.closest("dialog");\n            void closeDialogWithReturn(dialog, { reason: "dialog-close" }).catch(() => {});\n        });\n    });\n\n    document.querySelectorAll("dialog").forEach(dialog => {\n        dialog.addEventListener("cancel", event => {\n            if (!peekUIReturnFrame()) return;\n            event.preventDefault();\n            void closeDialogWithReturn(dialog, { reason: "dialog-cancel" }).catch(() => {});\n        });\n    });''',
    "route dialog close and cancel through stack"
)

replace_once(
    '''        closeDialog(graphicalDialog);''',
    '''        void closeDialogWithReturn(graphicalDialog, { reason: "graphical-settings-save" }).catch(() => {});''',
    "graphical settings stack return"
)

replace_once(
    '''        closeDialog(stateDialog);''',
    '''        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});''',
    "state settings stack return"
)

replace_once(
    '''        closeDialog(profileDialog);''',
    '''        void closeDialogWithReturn(profileDialog, { reason: "profile-save" }).catch(() => {});''',
    "profile stack return"
)

replace_once(
    '''        if (loginDialog.open) closeDialog(loginDialog);''',
    '''        if (loginDialog.open) {\n            void closeDialogWithReturn(loginDialog, { reason: "login-connected" }).catch(() => {});\n        }''',
    "login stack return"
)

replace_once(
    '''    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false, tripDefaults, duration = 250 } = {}) {''',
    '''    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, tripDefaults, duration = 250 } = {}) {''',
    "remove number pad return flag parameter"
)

replace_once(
    '''            tripDefaults,\n            returnToTripSettings\n        };''',
    '''            tripDefaults\n        };''',
    "remove number pad return flag state"
)

replace_once(
    '''    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false, immediate = false } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        const tripSettingsHandoff = suppressReturn || Boolean(state?.returnToTripSettings);\n\n        if (tripSettingsHandoff && !tripSettingsDialog.open) {\n            const reason = suppressReturn ? "number-pad-settings" : "number-pad-return";\n            if (!openTripSettingsDialog(reason, { duration: 0 })) return false;\n        }\n\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {\n            reason: "number-pad",\n            immediate: immediate || tripSettingsHandoff\n        })) {\n            return false;\n        }\n\n        numberPadClosedState = tripSettingsHandoff && state\n            ? { ...state, returnToTripSettings: false }\n            : state;\n        resetNumberPad();\n        if (discardPrepared && state?.source === "new-trip") {\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }\n        return true;\n    }\n\n    function requestNumberPadClose() {\n        return closeNumberPad();\n    }''',
    '''    async function closeNumberPad({\n        discardPrepared = true,\n        allowChanged = false,\n        immediate = false,\n        returnToCaller = true\n    } = {}) {\n        const state = numberPadState;\n        if (!allowChanged && numberPadHasChanges()) return false;\n        const caller = returnToCaller ? peekUIReturnFrame() : undefined;\n\n        if (caller && !await restoreUIReturnFrame(caller, "number-pad-return")) {\n            return false;\n        }\n\n        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {\n            reason: "number-pad",\n            immediate: immediate || Boolean(caller)\n        })) {\n            return false;\n        }\n\n        if (caller) popUIReturnFrame(caller);\n        if (!numberPadDialog?.open) resetNumberPad();\n        if (discardPrepared && state?.source === "new-trip") {\n            clockTimer.discardPreparedTrip?.().catch?.(() => {});\n        }\n        return true;\n    }\n\n    async function requestNumberPadClose() {\n        return closeNumberPad();\n    }''',
    "replace number pad ad-hoc return logic"
)

replace_once(
    '''            requestNumberPadClose();\n            return;''',
    '''            void requestNumberPadClose().catch(() => {});\n            return;''',
    "async number pad close action"
)

replace_once(
    '''                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false, allowChanged: true });''',
    '''                if (await commitNumberPad()) {\n                    await closeNumberPad({ discardPrepared: false, allowChanged: true });\n                }''',
    "await number pad close after commit"
)

replace_once(
    '''    function getTripSettingsPadSnapshot() {\n        return tripSettingsPadStack[tripSettingsPadStack.length - 1];\n    }''',
    '''    function getTripSettingsPadSnapshot() {\n        return findUIReturnFrame("number-pad")?.state;\n    }''',
    "derive trip settings number pad state from UI stack"
)

replace_once(
    '''    async function returnToNumberPadFromTripSettings(reason = "trip-settings-return") {\n        const snapshot = getTripSettingsPadSnapshot();\n        if (!snapshot) return closeDialog(tripSettingsDialog, { reason });\n\n        await restoreNumberPadState(snapshot, { duration: 0 });\n        if (!numberPadDialog?.open) return false;\n\n        tripSettingsPadStack.pop();\n        tripSettingsOpeningEditor = true;\n        if (!closeDialog(tripSettingsDialog, { reason, immediate: true })) {\n            tripSettingsOpeningEditor = false;\n            tripSettingsPadStack.push(snapshot);\n            return false;\n        }\n        return true;\n    }\n\n''',
    '''''',
    "remove trip settings special return helper"
)

replace_once(
    '''                returnToTripSettings: true\n            });''',
    '''            });''',
    "remove restored number pad trip settings flag"
)

replace_once(
    '''            tripDefaults: snapshot?.tripDefaults,\n            returnToTripSettings: true,\n            duration: 0''',
    '''            tripDefaults: snapshot?.tripDefaults,\n            duration: 0''',
    "remove new number pad trip settings flag"
)

replace_once(
    '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            tripSettingsPadStack.push({ ...numberPadState });\n            if (!closeNumberPad({\n                discardPrepared: false,\n                allowChanged: true,\n                suppressReturn: true,\n                immediate: true\n            })) {\n                tripSettingsPadStack.pop();\n            }\n        });''',
    '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;\n            const caller = captureNumberPadReturnFrame();\n            if (!caller) return;\n            pushUIReturnFrame(caller);\n\n            if (!openTripSettingsDialog("number-pad-settings", { duration: 0 })) {\n                popUIReturnFrame(caller);\n                return;\n            }\n\n            void closeNumberPad({\n                discardPrepared: false,\n                allowChanged: true,\n                immediate: true,\n                returnToCaller: false\n            }).then(closed => {\n                if (closed) return;\n                popUIReturnFrame(caller);\n                closeDialog(tripSettingsDialog, {\n                    reason: "number-pad-settings:rollback",\n                    immediate: true\n                });\n            }).catch(() => {\n                popUIReturnFrame(caller);\n            });\n        });''',
    "number pad to trip settings stack navigation"
)

replace_once(
    '''        numberPadDialog.addEventListener("cancel", event => {\n            event.preventDefault();\n            requestNumberPadClose();\n        });''',
    '''        numberPadDialog.addEventListener("cancel", event => {\n            event.preventDefault();\n            void requestNumberPadClose().catch(() => {});\n        });''',
    "number pad cancel async return"
)

replace_once(
    '''        numberPadDialog.addEventListener("closed", () => {\n            const state = numberPadClosedState;\n            numberPadClosedState = undefined;\n            if (state?.returnToTripSettings && !tripSettingsDialog.open) {\n                openTripSettingsDialog("number-pad-return", { duration: 0 });\n            }\n        });''',
    '''''',
    "remove number pad closed return guessing"
)

replace_once(
    '''    tripSettingsDialog.addEventListener("closed", () => {\n        if (tripSettingsOpeningEditor) {\n            tripSettingsOpeningEditor = false;\n        }\n    });\n\n    tripSettingsDialog.addEventListener("cancel", event => {\n        if (tripSettingsPadStack.length === 0) return;\n        event.preventDefault();\n        void returnToNumberPadFromTripSettings("trip-settings-cancel").catch(() => {});\n    });\n\n''',
    '''''',
    "remove trip settings ad-hoc close state"
)

replace_once(
    '''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            if (button.disabled) return;\n            const field = button.dataset.tripTimeField;\n            void (async () => {\n                try {\n                    await openTripFieldNumberPad(field);\n                    if (!numberPadDialog?.open) return;\n                    tripSettingsOpeningEditor = true;\n                    if (!closeDialog(tripSettingsDialog, { reason: `trip-settings:${field}`, immediate: true })) {\n                        tripSettingsOpeningEditor = false;\n                    }\n                }\n                catch {}\n            })();\n        });\n    });''',
    '''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {\n        button.addEventListener("pointerup", () => {\n            if (button.disabled) return;\n            const field = button.dataset.tripTimeField;\n            const caller = { type: "dialog", element: tripSettingsDialog };\n            pushUIReturnFrame(caller);\n\n            void (async () => {\n                try {\n                    await openTripFieldNumberPad(field);\n                    if (!numberPadDialog?.open) {\n                        popUIReturnFrame(caller);\n                        return;\n                    }\n                    if (!closeDialog(tripSettingsDialog, {\n                        reason: `trip-settings:${field}`,\n                        immediate: true\n                    })) {\n                        popUIReturnFrame(caller);\n                        await closeNumberPad({\n                            discardPrepared: false,\n                            allowChanged: true,\n                            immediate: true,\n                            returnToCaller: false\n                        });\n                    }\n                }\n                catch {\n                    popUIReturnFrame(caller);\n                }\n            })();\n        });\n    });''',
    "trip settings editor stack navigation"
)

replace_once(
    '''        if (tripSettingsPadStack.length > 0) {\n            void returnToNumberPadFromTripSettings("trip-settings-save").catch(() => {});\n            return;\n        }\n        closeDialog(tripSettingsDialog, { reason: "trip-settings-save" });''',
    '''        void closeDialogWithReturn(tripSettingsDialog, {\n            reason: "trip-settings-save"\n        }).catch(() => {});''',
    "trip settings save stack return"
)

replace_once(
    '''        stagedStandardTime = formatted;\n        if (state.source === "new-trip") {''',
    '''        stagedStandardTime = formatted;\n        if (state.source === "standard-time" && !tripIsLive()) {\n            const parentNumberPad = findUIReturnFrame("number-pad")?.state;\n            if (parentNumberPad) {\n                parentNumberPad.pending = state.pending;\n                parentNumberPad.replaceOnNextDigit = false;\n            }\n        }\n        if (state.source === "new-trip") {''',
    "sync pre-trip standard time back to parent number pad"
)

replace_once(
    '''    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {\n        const moment = tripMoment instanceof Date && !Number.isNaN(tripMoment.getTime())''',
    '''    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {\n        uiReturnStack.length = 0;\n        const moment = tripMoment instanceof Date && !Number.isNaN(tripMoment.getTime())''',
    "clear navigation stack for root trip workflow"
)

# Ensure no legacy state remains.
legacy = [
    "tripSettingsPadStack",
    "tripSettingsOpeningEditor",
    "numberPadClosedState",
    "returnToTripSettings",
    "suppressReturn"
]
for token in legacy:
    if token in text:
        raise RuntimeError(f"legacy navigation token remains: {token}")

path.write_text(text, encoding="utf-8")
