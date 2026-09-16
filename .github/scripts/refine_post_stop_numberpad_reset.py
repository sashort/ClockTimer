from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

old = '''    function closeNumberPad({ discardPrepared = true } = {}) {
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
'''
new = '''    function resetNumberPad() {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        numberPadState = undefined;
        if (numberPadDisplay) numberPadDisplay.textContent = "";
        if (numberPadClear) {
            numberPadClear.dataset.action = "close";
            numberPadClear.setAttribute("aria-label", "Close");
        }
        if (numberPadConfirm) {
            numberPadConfirm.dataset.action = "confirm";
            numberPadConfirm.setAttribute("aria-label", "Confirm");
            numberPadConfirm.disabled = true;
        }
    }

    function closeNumberPad({ discardPrepared = true } = {}) {
        const state = numberPadState;
        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {
            return false;
        }
        resetNumberPad();
        if (discardPrepared && state?.source === "new-trip") {
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
        return true;
    }
'''
if old not in text:
    raise SystemExit('closeNumberPad anchor not found')
text = text.replace(old, new, 1)

old = '''        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            const state = numberPadState;
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
            openDialog("stateSettingsDialog", { reason: "number-pad-settings" });
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            requestNumberPadClose();
        });
'''
new = '''        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            const state = numberPadState;
            const reopenOptions = {
                mode: state.mode,
                source: state.source,
                initialValue: state.mode === "percent"
                    ? state.initial
                    : (state.initial ? renderTimeDigits(state.initial) : "")
            };
            const persistence = state.persistence;
            if (!closeNumberPad({ discardPrepared: false })) return;
            const reopen = () => {
                stateDialog.removeEventListener("closed", reopen);
                void openNumberPad(reopenOptions).then(() => {
                    if (!numberPadState) return;
                    numberPadState.persistence = persistence;
                    refreshNumberPad();
                }).catch(() => {});
            };
            stateDialog.addEventListener("closed", reopen);
            openDialog("stateSettingsDialog", { reason: "number-pad-settings" });
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            requestNumberPadClose();
        });

        numberPadDialog.addEventListener("close", () => {
            resetNumberPad();
        });
'''
if old not in text:
    raise SystemExit('numberpad settings anchor not found')
text = text.replace(old, new, 1)

old = '''    function updatePostStopSummary(summary) {
        if (clockTimer.percentMode === "total" && summary?.total) {
            updateSummaryValues(summary);
            return;
        }
        $("#standardTimeValue").textContent = "---";
        $("#renderedTimeValue").textContent = "---";
        $("#currentPercentValue").textContent = "---";
        const goal = summary?.trip?.percentGoal ?? clockTimer.renderedPercentGoal;
        $("#goalPercentValue").textContent = formatSummaryPercent(goal, "100%");
    }
'''
new = '''    function updatePostStopSummary(summary) {
        updateSummaryValues(summary);
        if (clockTimer.percentMode === "total") return;

        $("#currentPercentValue").textContent = "---";
        if (clockTimer.renderedTimeMode === "calculated-end") {
            $("#renderedTimeValue").textContent = "---";
        }
    }
'''
if old not in text:
    raise SystemExit('post-stop summary anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
