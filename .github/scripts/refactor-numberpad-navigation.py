from pathlib import Path

app_path = Path("app.js")
app = app_path.read_text()


def replace_once(old, new, label):
    global app
    count = app.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    app = app.replace(old, new, 1)


def replace_block(start_marker, end_marker, replacement, label):
    global app
    start = app.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found")
    end = app.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker not found")
    app = app[:start] + replacement + app[end:]

replace_once(
'''    const uiReturnStack = [];
''',
'''    const uiReturnStack = [];
    let tripSettingsNavigation = {
        returnTarget: "home",
        numberPadState: undefined
    };
''',
"navigation state"
)

replace_once(
'''        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {
            const frame = uiReturnStack[index];
            if (
                frame?.type === "number-pad" &&
                frame.state?.connectionStatusToken === token
            ) {
                frame.state.persistence = normalized;
                if (presentation) frame.state.connectionPresentation = presentation;
                break;
            }
        }
''',
'''        const returnState =
            tripSettingsNavigation.returnTarget === "number-pad"
                ? tripSettingsNavigation.numberPadState
                : undefined;
        if (returnState?.connectionStatusToken === token) {
            returnState.persistence = normalized;
            if (presentation) returnState.connectionPresentation = presentation;
        }
''',
"connection snapshot sync"
)

replace_once(
'''    function captureNumberPadReturnFrame() {
        return numberPadState
            ? { type: "number-pad", state: { ...numberPadState } }
            : undefined;
    }

''',
'''    function resetTripSettingsNavigation() {
        tripSettingsNavigation = {
            returnTarget: "home",
            numberPadState: undefined
        };
    }

    function setTripSettingsReturnToNumberPad(state = numberPadState) {
        tripSettingsNavigation = {
            returnTarget: "number-pad",
            numberPadState: state ? { ...state } : undefined
        };
    }

    function getTripSettingsReturnNumberPadState() {
        return tripSettingsNavigation.returnTarget === "number-pad"
            ? tripSettingsNavigation.numberPadState
            : undefined;
    }

''',
"navigation helpers"
)

replace_once(
'''        if (frame.type === "number-pad") {
            await restoreNumberPadState(frame.state, { duration: 0 });
            return Boolean(numberPadDialog?.open);
        }

''',
'''',
"remove number pad stack restore"
)

replace_block(
'''    function getNumberPadClearAction() {''',
'''    function refreshNumberPad() {''',
'''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges()) return "reset";
        if (numberPadState.backTarget === "trip-settings") return "back";
        if (
            numberPadState.role === "root" &&
            numberPadState.source === "standard-time" &&
            !numberPadState.everEdited
        ) {
            return "home";
        }
        return "close";
    }

''',
"clear action"
)

replace_once(
'''        numberPadSettingsArea.hidden = percentMode;
        if (!percentMode) {
''',
'''        const settingsVisible =
            !percentMode &&
            numberPadState.role !== "trip-settings-field";
        numberPadSettingsArea.hidden = !settingsVisible;
        numberPadSettingsArea.parentElement?.classList.toggle(
            "settings-hidden",
            !settingsVisible
        );
        if (settingsVisible) {
''',
"settings visibility"
)

replace_block(
'''    async function openNumberPad({''',
'''    async function restoreNumberPadState(''',
'''    async function openNumberPad({
        mode,
        source,
        initialValue = "",
        preparationPromise,
        tripDefaults,
        startsTripOnConfirm = false,
        role = "root",
        workflow,
        cancelTarget = "home",
        confirmTarget,
        backTarget,
        duration = 250
    } = {}) {
        await ensureNumberPadLoaded();
        const normalizedMode = mode === "percent"
            ? "percent"
            : mode === "absolute"
                ? "absolute"
                : "duration";
        const normalizedRole = role === "trip-settings-field"
            ? "trip-settings-field"
            : "root";
        let initial;
        let initialDate;
        let initialMeridiem;
        if (normalizedMode === "absolute") {
            const absolute = getAbsolutePadInitial(initialValue, tripDefaults?.creationDate);
            initial = absolute.digits;
            initialDate = absolute.date;
            initialMeridiem = absolute.meridiem;
        }
        else {
            initial = normalizedMode === "percent"
                ? normalizePercentDigits(initialValue)
                : normalizeTimeDigits(initialValue);
        }
        const state = {
            mode: normalizedMode,
            source,
            title: getNumberPadTitle(source),
            initial,
            pending: initial,
            initialDate,
            pendingDate: initialDate,
            initialMeridiem,
            meridiem: initialMeridiem,
            replaceOnNextDigit: source !== "new-trip",
            persistence: source === "new-trip"
                ? "pending"
                : normalizedConnectionStatus(),
            connectionPresentation: source === "new-trip"
                ? "initial"
                : "settled",
            connectionStatusToken: ++numberPadConnectionSequence,
            tripDefaults,
            startsTripOnConfirm: Boolean(startsTripOnConfirm),
            role: normalizedRole,
            workflow: workflow || (
                source === "new-trip"
                    ? "new-trip"
                    : tripIsLive()
                        ? "edit-trip"
                        : null
            ),
            cancelTarget,
            confirmTarget: confirmTarget || (
                normalizedRole === "trip-settings-field"
                    ? "trip-settings"
                    : "home"
            ),
            backTarget: backTarget || (
                normalizedRole === "trip-settings-field"
                    ? "trip-settings"
                    : undefined
            ),
            everEdited: false
        };
        numberPadState = state;
        refreshNumberPad();
        mainMenu?.hidePopover?.();
        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration,
                reason: `number-pad:${source}`
            });
        }

        if (source === "new-trip") {
            void settleInitialNumberPadConnection(
                state,
                preparationPromise ?? Promise.resolve()
            );
        }
    }

''',
"open number pad"
)

replace_block(
'''    async function closeNumberPad({''',
'''    function getPercentGoalValue() {''',
'''    async function closeNumberPad({
        discardPrepared = true,
        allowChanged = false,
        immediate = false,
        destination
    } = {}) {
        const state = numberPadState;
        if (!state) return false;
        if (!allowChanged && numberPadHasChanges()) return false;

        const target = destination ?? state.cancelTarget ?? "home";
        if (target === "trip-settings") {
            if (!tripSettingsSession) beginTripSettingsSession();
            if (!openTripSettingsDialog("number-pad-return", { duration: 0 })) {
                return false;
            }
        }

        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {
            reason: "number-pad",
            immediate: immediate || target === "trip-settings"
        })) {
            if (target === "trip-settings" && tripSettingsDialog.open) {
                closeDialog(tripSettingsDialog, {
                    reason: "number-pad-return:rollback",
                    immediate: true
                });
            }
            return false;
        }

        if (target === "home") {
            if (state.role === "trip-settings-field") {
                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
            }
            if (discardPrepared && state.workflow === "new-trip") {
                tripDraft = undefined;
                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
                clockTimer.discardPreparedTrip?.().catch?.(() => {});
            }
        }
        return true;
    }

    async function requestNumberPadClose() {
        if (!numberPadState) return false;
        const action = getNumberPadClearAction();
        const destination = action === "back"
            ? numberPadState.backTarget
            : numberPadState.cancelTarget;
        return closeNumberPad({
            destination,
            discardPrepared: destination === "home"
        });
    }

    async function cancelNumberPad() {
        if (!numberPadState) return false;
        return closeNumberPad({
            destination: numberPadState.cancelTarget || "home",
            discardPrepared: true,
            allowChanged: true
        });
    }

''',
"close number pad"
)

replace_once(
'''    function getTripSettingsPadSnapshot() {
        return findUIReturnFrame("number-pad")?.state;
    }
''',
'''    function getTripSettingsPadSnapshot() {
        return getTripSettingsReturnNumberPadState();
    }
''',
"trip settings pad snapshot"
)

replace_once(
'''    function syncDraftStandardTimeReturnFrame(formatted) {
        const frame = findUIReturnFrame("number-pad");
        if (!frame?.state || frame.state.source !== "new-trip") return;
        const digits = normalizeTimeDigits(formatted);
        frame.state.initial = digits;
        frame.state.pending = digits;
        frame.state.replaceOnNextDigit = false;
        frame.state.startsTripOnConfirm = true;
    }
''',
'''    function syncDraftStandardTimeReturnFrame(formatted) {
        const state = getTripSettingsReturnNumberPadState();
        if (!state || state.source !== "new-trip") return;
        const digits = normalizeTimeDigits(formatted);
        state.initial = digits;
        state.pending = digits;
        state.replaceOnNextDigit = false;
        state.startsTripOnConfirm = true;
    }
''',
"draft number pad sync"
)

replace_block(
'''    function syncTripSettingsCallerAfterSave() {''',
'''    function getTripSettingsDerivedTotalGoalPercent(values) {''',
'''    function syncTripSettingsCallerAfterSave() {
        const state = getTripSettingsReturnNumberPadState();
        const standardTime = tripSettingsSession?.values?.standardTime;
        if (!state || state.source !== "standard-time" || !standardTime) return;
        const digits = normalizeTimeDigits(standardTime);
        if (!digits) return;
        const changed = digits !== state.initial;
        state.initial = digits;
        state.pending = digits;
        state.replaceOnNextDigit = false;
        state.everEdited = Boolean(state.everEdited || changed);
    }

    async function closeTripSettingsToNavigation(reason) {
        const returnState = getTripSettingsReturnNumberPadState();
        if (returnState) {
            await restoreNumberPadState(returnState, { duration: 0 });
        }

        const closed = closeDialog(tripSettingsDialog, {
            reason,
            immediate: Boolean(returnState)
        });
        if (!closed) {
            if (returnState && numberPadDialog?.open) {
                await closeNumberPad({
                    discardPrepared: false,
                    allowChanged: true,
                    immediate: true,
                    destination: "none"
                });
            }
            return false;
        }

        resetTripSettingsNavigation();
        return true;
    }

    async function cancelTripSettingsDialog(reason = "trip-settings-cancel") {
        tripStartsNowState = undefined;
        tripSettingsSession = undefined;
        return closeTripSettingsToNavigation(reason);
    }

''',
"trip settings navigation close"
)

replace_block(
'''    function openTripFieldNumberPad(field) {''',
'''    function bindNumberPadEvents() {''',
'''    function openTripFieldNumberPad(field) {
        if (!tripIsLive() && !tripDraft) return Promise.resolve();
        const live = tripIsLive();
        const absolute = field !== "standard-time";
        const values = tripSettingsSession?.values || getCurrentTripSettingsValues();
        const tripDefaults = live
            ? { creationDate: values?.creationDate || clockTimer.creationDate }
            : getTripSettingsCandidateDraft();
        return openNumberPad({
            mode: absolute ? "absolute" : "time",
            source: field,
            initialValue: getTripFieldValue(field),
            tripDefaults,
            startsTripOnConfirm: false,
            role: "trip-settings-field",
            workflow: live ? "edit-trip" : "new-trip",
            cancelTarget: "home",
            confirmTarget: "trip-settings",
            backTarget: "trip-settings",
            duration: 0
        });
    }

''',
"trip field number pad"
)

replace_once(
'''                if (await commitNumberPad()) {
                    await closeNumberPad({ discardPrepared: false, allowChanged: true });
                }
''',
'''                if (await commitNumberPad()) {
                    const destination = numberPadState?.confirmTarget || "home";
                    await closeNumberPad({
                        discardPrepared: false,
                        allowChanged: true,
                        destination
                    });
                }
''',
"confirm navigation"
)

replace_block(
'''        numberPadSettings.addEventListener("pointerup", () => {''',
'''        numberPadDialog.addEventListener("cancel", event => {''',
'''        numberPadSettings.addEventListener("pointerup", () => {
            if (
                !numberPadState ||
                numberPadState.mode === "percent" ||
                numberPadState.role === "trip-settings-field"
            ) return;
            if (tripDraft && numberPadState.source === "new-trip" && numberPadValueValid()) {
                const formatted = renderTimeDigits(numberPadState.pending);
                if (formatted) tripDraft.standardTime = formatted;
            }

            const returnState = { ...numberPadState };
            setTripSettingsReturnToNumberPad(returnState);

            if (!openTripSettingsDialog("number-pad-settings", { duration: 0 })) {
                resetTripSettingsNavigation();
                return;
            }

            void closeNumberPad({
                discardPrepared: false,
                allowChanged: true,
                immediate: true,
                destination: "none"
            }).then(closed => {
                if (closed) return;
                resetTripSettingsNavigation();
                closeDialog(tripSettingsDialog, {
                    reason: "number-pad-settings:rollback",
                    immediate: true
                });
            }).catch(() => {
                resetTripSettingsNavigation();
            });
        });

''',
"number pad settings handoff"
)

replace_once(
'''        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            void requestNumberPadClose().catch(() => {});
        });
''',
'''        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            void cancelNumberPad().catch(() => {});
        });
''',
"number pad cancel"
)

replace_block(
'''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {''',
'''    tripSetStartsNow.addEventListener("pointerup", () => {''',
'''    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;

            void (async () => {
                try {
                    await openTripFieldNumberPad(field);
                    if (!numberPadDialog?.open) return;
                    if (!closeDialog(tripSettingsDialog, {
                        reason: `trip-settings:${field}`,
                        immediate: true
                    })) {
                        await closeNumberPad({
                            discardPrepared: false,
                            allowChanged: true,
                            immediate: true,
                            destination: "none"
                        });
                    }
                }
                catch {}
            })();
        });
    });

''',
"trip settings field handoff"
)

replace_once(
'''                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });
                return;
''',
'''                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });
                return;
''',
"new trip save navigation"
)

replace_once(
'''            syncTripSettingsCallerAfterSave();
            tripStartsNowState = undefined;
            tripSettingsSession = undefined;
            await closeDialogWithReturn(tripSettingsDialog, {
                reason: "trip-settings-save"
            });
''',
'''            syncTripSettingsCallerAfterSave();
            tripStartsNowState = undefined;
            tripSettingsSession = undefined;
            await closeTripSettingsToNavigation("trip-settings-save");
''',
"trip settings save navigation"
)

replace_once(
'''    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        uiReturnStack.length = 0;
''',
'''    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        uiReturnStack.length = 0;
        resetTripSettingsNavigation();
        tripSettingsSession = undefined;
        tripStartsNowState = undefined;
''',
"new trip navigation reset"
)

replace_once(
'''        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise,
            tripDefaults: tripDraft,
            startsTripOnConfirm: true
        });
''',
'''        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise,
            tripDefaults: tripDraft,
            startsTripOnConfirm: true,
            role: "root",
            workflow: "new-trip",
            cancelTarget: "home",
            confirmTarget: "home"
        });
''',
"new trip root route"
)

replace_once(
'''        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
''',
'''        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || "",
            role: "root",
            workflow: "edit-trip",
            cancelTarget: "home",
            confirmTarget: "home"
        }).catch(() => {});
''',
"standard time root route"
)

replace_once(
'''        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        }).catch(() => {});
''',
'''        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue(),
            role: "root",
            workflow: tripIsLive() ? "edit-trip" : null,
            cancelTarget: "home",
            confirmTarget: "home"
        }).catch(() => {});
''',
"percent root route"
)

# The generic return stack remains for popover/dialog handoffs, but number-pad
# navigation must not depend on it anymore.
if 'captureNumberPadReturnFrame' in app:
    raise SystemExit('captureNumberPadReturnFrame still present')
if 'if (peekUIReturnFrame()) return "back";' in app:
    raise SystemExit('number pad clear action still stack-dependent')

app_path.write_text(app)

css_path = Path("app.css")
css = css_path.read_text()
css_marker = '''/* reversible-disabled-ui-v1 */
'''
css_insert = '''/* explicit-numberpad-navigation-v1 */
.number-pad-header.settings-hidden {
    grid-template-columns: 1fr;
}

'''
if css_insert not in css:
    if css.count(css_marker) != 1:
        raise SystemExit(f"CSS marker expected once, found {css.count(css_marker)}")
    css = css.replace(css_marker, css_insert + css_marker, 1)
css_path.write_text(css)
