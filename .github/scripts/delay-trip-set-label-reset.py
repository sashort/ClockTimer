from pathlib import Path

path = Path("app.js")
text = path.read_text()

old = '''    let tripSettingsSession;\n    let tripStartsNowState;\n    let numberPadState;\n'''
new = '''    let tripSettingsSession;\n    let tripStartsNowState;\n    let tripStartsNowExiting = false;\n    let tripStartsNowExitTimer;\n    let numberPadState;\n'''
assert old in text
text = text.replace(old, new, 1)

old = '''    const BUTTON_PRESS_IN_DURATION = 120;\n    const BUTTON_PRESS_OUT_DURATION = 140;\n'''
new = '''    const BUTTON_PRESS_IN_DURATION = 120;\n    const BUTTON_PRESS_OUT_DURATION = 140;\n    const TRIP_START_TRANSITION_DURATION = 250;\n'''
assert old in text
text = text.replace(old, new, 1)

old = '''        if (!active) {\n            tripSetStartsNow.textContent = "Set Scheduled/Actual Start to Now";\n            tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(values?.creationDate || draft.creationDate));\n            return;\n        }\n'''
new = '''        if (!active) {\n            if (!tripStartsNowExiting) {\n                tripSetStartsNow.textContent = "Set Scheduled/Actual Start to Now";\n            }\n            tripSetStartsNow.disabled = tripStartsNowExiting ||\n                Boolean(draft && !parseDateInput(values?.creationDate || draft.creationDate));\n            return;\n        }\n'''
assert old in text
text = text.replace(old, new, 1)

anchor = '''    function restoreDraftFromTripSettingsOriginal() {\n'''
insert = '''    function finishTripStartsNowExit() {\n        clearTimeout(tripStartsNowExitTimer);\n        tripStartsNowExitTimer = undefined;\n        if (!tripStartsNowExiting) return;\n        tripStartsNowExiting = false;\n        if (!tripStartsNowState) syncTripStartsNowUI();\n    }\n\n    function beginTripStartsNowExit() {\n        if (!tripStartsNowState || tripStartsNowExiting) return;\n        clearTimeout(tripStartsNowExitTimer);\n        tripStartsNowExiting = true;\n        tripStartsNowState = undefined;\n\n        const handleTransitionEnd = event => {\n            if (event.target !== tripSetStartsNow || event.propertyName !== "flex-basis") return;\n            tripSetStartsNow.removeEventListener("transitionend", handleTransitionEnd);\n            finishTripStartsNowExit();\n        };\n        tripSetStartsNow.addEventListener("transitionend", handleTransitionEnd);\n        tripStartsNowExitTimer = setTimeout(() => {\n            tripSetStartsNow.removeEventListener("transitionend", handleTransitionEnd);\n            finishTripStartsNowExit();\n        }, TRIP_START_TRANSITION_DURATION + 50);\n\n        refreshTripSettingsValues();\n    }\n\n'''
assert anchor in text
text = text.replace(anchor, insert + anchor, 1)

old = '''        if (tripStartsNowState.scheduled) values.scheduledStart = tripStartsNowState.value;\n        if (tripStartsNowState.actual) values.startTime = tripStartsNowState.value;\n        tripStartsNowState = undefined;\n        refreshTripSettingsValues();\n    });\n\n    tripSetStartsNowCancel.addEventListener("pointerup", () => {\n        if (!tripStartsNowState) return;\n        tripStartsNowState = undefined;\n        refreshTripSettingsValues();\n    });\n'''
new = '''        if (tripStartsNowState.scheduled) values.scheduledStart = tripStartsNowState.value;\n        if (tripStartsNowState.actual) values.startTime = tripStartsNowState.value;\n        beginTripStartsNowExit();\n    });\n\n    tripSetStartsNowCancel.addEventListener("pointerup", () => {\n        if (!tripStartsNowState) return;\n        beginTripStartsNowExit();\n    });\n'''
assert old in text
text = text.replace(old, new, 1)

path.write_text(text)
