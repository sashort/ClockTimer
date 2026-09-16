from pathlib import Path

app = Path('app.js')
text = app.read_text(encoding='utf-8')

old = '''        const changed = numberPadHasChanges();
        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "reset" ? "Reset" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !changed || (!autocorrect && !valid);
        numberPadSettings.disabled = changed;
'''
new = '''        const changed = numberPadHasChanges();
        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "reset" ? "Reset" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !changed || (!autocorrect && !valid);
'''
assert old in text
text = text.replace(old, new, 1)

text = text.replace('''        if (numberPadSettings) numberPadSettings.disabled = false;\n''', '', 1)

old = '''        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent" || numberPadHasChanges()) return;
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
            const pending = state.pending;
            const replaceOnNextDigit = state.replaceOnNextDigit;
            const persistence = state.persistence;
            if (!closeNumberPad({ discardPrepared: false, allowChanged: true })) return;
            const reopen = () => {
                stateDialog.removeEventListener("closed", reopen);
                void openNumberPad(reopenOptions).then(() => {
                    if (!numberPadState) return;
                    numberPadState.pending = pending;
                    numberPadState.replaceOnNextDigit = replaceOnNextDigit;
                    numberPadState.persistence = persistence;
                    refreshNumberPad();
                }).catch(() => {});
            };
            stateDialog.addEventListener("closed", reopen);
            openDialog("stateSettingsDialog", { reason: "number-pad-settings" });
        });
'''
assert old in text
text = text.replace(old, new, 1)

old = '''        $("#standardTimeValue").textContent =
            typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent =
            typeof selected?.renderedTime === "string" && selected.renderedTime
                ? selected.renderedTime
                : "---";
        $("#currentPercentValue").textContent =
            selected?.available === false
                ? "---"
                : formatSummaryPercent(selected?.countedPercent);
        $("#goalPercentValue").textContent =
            formatSummaryPercent(selected?.percentGoal, "100%");
'''
new = '''        const stoppedTrip = scope === "trip" && clockTimer.status === "stopped";

        $("#standardTimeValue").textContent =
            typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent =
            stoppedTrip && clockTimer.renderedTimeMode === "calculated-end"
                ? "---"
                : typeof selected?.renderedTime === "string" && selected.renderedTime
                    ? selected.renderedTime
                    : "---";
        $("#currentPercentValue").textContent =
            stoppedTrip || selected?.available === false
                ? "---"
                : formatSummaryPercent(selected?.countedPercent);
        $("#goalPercentValue").textContent =
            formatSummaryPercent(selected?.percentGoal, "100%");
'''
assert old in text
text = text.replace(old, new, 1)

old = '''    function updatePostStopSummary(summary) {
        updateSummaryValues(summary);
        if (clockTimer.percentMode === "total") return;

        $("#currentPercentValue").textContent = "---";
        if (clockTimer.renderedTimeMode === "calculated-end") {
            $("#renderedTimeValue").textContent = "---";
        }
    }
'''
new = '''    function updatePostStopSummary(summary) {
        updateSummaryValues(summary);
    }
'''
assert old in text
text = text.replace(old, new, 1)

old = '''    async function beginNewTripWorkflow() {
        let preparationPromise;
'''
new = '''    async function beginNewTripWorkflow({ initialValue } = {}) {
        const newTripInitialValue = initialValue ?? (
            clockTimer.status === "stopped"
                ? ""
                : (stagedStandardTime || "")
        );

        let preparationPromise;
'''
assert old in text
text = text.replace(old, new, 1)

old = '''        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        });
'''
new = '''        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise
        });
'''
assert old in text
text = text.replace(old, new, 1)

old = '''    clockTimer.addEventListener("stopped", event => {
        setTripControlState(false);
        updatePostStopSummary(event.detail?.summary);
        void beginNewTripWorkflow().catch(() => {});
    });
'''
new = '''    clockTimer.addEventListener("stopped", event => {
        setTripControlState(false);
        stagedStandardTime = undefined;
        updatePostStopSummary(event.detail?.summary);
        void beginNewTripWorkflow({ initialValue: "" }).catch(() => {});
    });
'''
assert old in text
text = text.replace(old, new, 1)

app.write_text(text, encoding='utf-8')

css = Path('app.css')
css_text = css.read_text(encoding='utf-8')
css_text = css_text.replace('''    text-align: center;\n}\n\n.number-pad-settings {''', '''    text-align: center;\n    cursor: pointer;\n}\n\n.number-pad-settings {''', 1)
css_text = css_text.replace('''.number-pad-settings:disabled { opacity: 0.38; cursor: not-allowed; }\n''', '', 1)
css.write_text(css_text, encoding='utf-8')
