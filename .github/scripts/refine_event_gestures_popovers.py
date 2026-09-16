from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()
if '"latencyStart"' not in clock:
    raise RuntimeError("latencyStart event missing")
clock = clock.replace('"latencyStart"', '"latencyStarted"')
clock_path.write_text(clock)

app_path = Path("app.js")
app = app_path.read_text()

app = replace_once(
    app,
    '''        popover.addEventListener("toggle", event => {
            emitUIEvent(
                popover,
                event.newState === "open" ? "opened" : "closed",
                { oldState: event.oldState, newState: event.newState }
            );
        });''',
    '''        popover.addEventListener("toggle", event => {
            emitUIEvent(
                popover,
                event.newState === "open" ? "opened" : "closed",
                { oldState: event.oldState, newState: event.newState }
            );
            if (event.newState === "closed" && popover.classList.contains("popover-immediate-close")) {
                requestAnimationFrame(() => popover.classList.remove("popover-immediate-close"));
            }
        });''',
    "popover lifecycle cleanup",
)

app = replace_once(
    app,
    '''    $("#scopeToggle").addEventListener("click", () => {
        applyScope(clockTimer.percentMode === "total" ? "trip" : "total");
    });

    $("#renderedTimeButton").addEventListener("click", () => {
        const index = RENDERED_TIME_MODES.indexOf(clockTimer.renderedTimeMode);
        applyRenderedTimeMode(RENDERED_TIME_MODES[(index + 1) % RENDERED_TIME_MODES.length]);
    });''',
    '''    $("#scopeToggle").addEventListener("pointerup", () => {
        clockTimer.percentMode = clockTimer.percentMode === "total" ? "trip" : "total";
    });

    $("#renderedTimeButton").addEventListener("pointerup", () => {
        const index = RENDERED_TIME_MODES.indexOf(clockTimer.renderedTimeMode);
        clockTimer.renderedTimeMode = RENDERED_TIME_MODES[(index + 1) % RENDERED_TIME_MODES.length];
    });''',
    "summary pointer gestures",
)

app = replace_once(
    app,
    '''        $("#mainMenu")?.hidePopover?.();
        if (!numberPadDialog.open) numberPadDialog.showModal();''',
    '''        mainMenu?.hidePopover?.();
        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration: 250,
                reason: `number-pad:${source}`
            });
        }''',
    "number pad opening lifecycle",
)

app = replace_once(
    app,
    '''    function closeNumberPad({ discardPrepared = true } = {}) {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        const state = numberPadState;
        if (numberPadDialog?.open) numberPadDialog.close();
        numberPadState = undefined;
        if (discardPrepared && state?.source === "new-trip") {
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
    }

    function requestNumberPadClose() {
        if (numberPadState?.locked) return false;
        closeNumberPad();
        return true;
    }''',
    '''    function closeNumberPad({ discardPrepared = true } = {}) {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        const state = numberPadState;
        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {
            return false;
        }
        numberPadState = undefined;
        if (discardPrepared && state?.source === "new-trip") {
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
        return true;
    }

    function requestNumberPadClose() {
        if (numberPadState?.locked) return false;
        return closeNumberPad();
    }''',
    "number pad closing lifecycle",
)

app = app.replace('numberPadConfirm.addEventListener("click", async () => {', 'numberPadConfirm.addEventListener("pointerup", async () => {', 1)
app = app.replace('numberPadSettings.addEventListener("click", () => {', 'numberPadSettings.addEventListener("pointerup", () => {', 1)

app = replace_once(
    app,
    '''            const state = numberPadState;
            numberPadDialog.close();
            const reopen = () => {
                stateDialog.removeEventListener("close", reopen);
                if (numberPadState === state && !numberPadDialog.open) numberPadDialog.showModal();
            };
            stateDialog.addEventListener("close", reopen);
            openDialog("stateSettingsDialog");''',
    '''            const state = numberPadState;
            if (!closeDialog(numberPadDialog, { reason: "number-pad-settings" })) return;
            const reopen = () => {
                stateDialog.removeEventListener("close", reopen);
                if (numberPadState === state && !numberPadDialog.open) {
                    openDialogElement(numberPadDialog, {
                        duration: 250,
                        reason: "number-pad-settings-return"
                    });
                }
            };
            stateDialog.addEventListener("close", reopen);
            openDialog("stateSettingsDialog", { reason: "number-pad-settings" });''',
    "number pad settings lifecycle",
)

app = replace_once(
    app,
    '''    clockTimer.addEventListener("percentModeChanged", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });''',
    '''    clockTimer.addEventListener("percentModeChanged", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });

    clockTimer.addEventListener("renderedTimeModeChanged", () => {
        safeStorageSet(STORAGE.renderedTimeMode, clockTimer.renderedTimeMode);
        queueSummaryRefresh();
    });''',
    "rendered mode event persistence",
)

# It now has its own event listener, so don't also register the generic one.
app = app.replace('        "renderedTimeModeChanged",\n', '', 1)

app = replace_once(
    app,
    '''    breakDialog?.addEventListener("opened", () => {});

    const graphicalSettings = getGraphicalSettings();''',
    '''    const graphicalSettings = getGraphicalSettings();''',
    "remove break no-op",
)

app_path.write_text(app)
print("event gesture and popover refinements complete")
