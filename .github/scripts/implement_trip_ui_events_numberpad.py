from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# ClockTimer event naming + standard-time transition events.
clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()

for old, new, label in [
    ('"percentModeChange"', '"percentModeChanged"', "percent mode event"),
    ('"goalChange"', '"goalChanged"', "goal event"),
    ('"renderedPercentGoalChange"', '"renderedPercentGoalChanged"', "rendered percent goal event"),
    ('"renderedTimeModeChange"', '"renderedTimeModeChanged"', "rendered time mode event"),
    ('"intervalStart"', '"intervalStarted"', "interval started event"),
    ('"intervalEnd"', '"intervalEnded"', "interval ended event"),
    ('"intervalApprovalToggle"', '"intervalApprovalToggled"', "interval approval toggled event"),
    ('"intervalApprovalChange"', '"intervalApprovalChanged"', "interval approval changed event"),
    ('"intervalDelete"', '"intervalDeleted"', "interval deleted event"),
    ('"intervalElapsedBehaviorChange"', '"intervalElapsedBehaviorChanged"', "interval behavior event"),
]:
    if old not in clock:
        raise RuntimeError(f"{label}: missing {old}")
    clock = clock.replace(old, new)

clock = replace_once(
    clock,
    '''            this.#emitClockTimerEvent("start", {
                ...result,
                ...this.#getTimingDetail(''',
    '''            const summary = this.#buildSummarySnapshot(new Date());
            this.#emitClockTimerEvent("started", {
                ...result,
                summary,
                ...this.#getTimingDetail(''',
    "started event",
)

clock = replace_once(
    clock,
    '''            const result = this.#mutationResult(synced);
            this.#emitClockTimerEvent("stop", result);
            return result;''',
    '''            const result = this.#mutationResult(synced);
            const summary = this.#buildSummarySnapshot(new Date());
            this.#emitClockTimerEvent("stopped", {
                ...result,
                summary
            });
            return result;''',
    "stopped event",
)

clock = replace_once(
    clock,
    '''            const proceed = this.#emitClockTimerEvent("clear", {
                tripId: Number.isInteger(oldTripId) ? oldTripId : undefined
            }, {
                cancelable: !connected
            });''',
    '''            const proceed = this.#emitClockTimerEvent("clearing", {
                tripId: Number.isInteger(oldTripId) ? oldTripId : undefined
            }, {
                cancelable: !connected
            });''',
    "clearing event",
)

old_setter = '''        set standardTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateDurationTime(
                        value,
                        "standardTime"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousValue =
                this.#standardTime;

            const previousDuration =
                this.#standardDuration;

            this.#standardTime =
                this.#formatStandardTime(
                    parsed.total
                );

            this.#standardDuration =
                parsed.total;

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousDuration
                )
            ) {
                this.#calculatedEndTime +=
                    parsed.total -
                    previousDuration;
            }

            if (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#tripTotals
            ) {
                this.#handleTripGoalChange();
            }

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#emitClockTimerEvent(
                "standardTimeChange",
                {
                    previousValue,
                    value: this.#standardTime,
                    standardTimeMilliseconds: this.#standardDuration
                }
            );
        }
'''
new_setter = '''        set standardTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateDurationTime(
                        value,
                        "standardTime"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousValue =
                this.#standardTime;

            const previousDuration =
                this.#standardDuration;

            const nextValue =
                this.#formatStandardTime(
                    parsed.total
                );

            if (nextValue === previousValue) {
                return;
            }

            const proceed =
                this.#emitClockTimerEvent(
                    "standardTimeChanging",
                    {
                        previousValue,
                        value: nextValue,
                        standardTimeMilliseconds: parsed.total
                    },
                    {
                        cancelable: true
                    }
                );

            if (!proceed) {
                return;
            }

            this.#standardTime =
                nextValue;

            this.#standardDuration =
                parsed.total;

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousDuration
                )
            ) {
                this.#calculatedEndTime +=
                    parsed.total -
                    previousDuration;
            }

            if (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#tripTotals
            ) {
                this.#handleTripGoalChange();
            }

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#emitClockTimerEvent(
                "standardTimeChanged",
                {
                    previousValue,
                    value: this.#standardTime,
                    standardTimeMilliseconds: this.#standardDuration,
                    summary: this.#buildSummarySnapshot(new Date())
                }
            );
        }
'''
clock = replace_once(clock, old_setter, new_setter, "standard time setter")
clock_path.write_text(clock)

# Main markup: ready/running trip controls and deferred Break modal shell.
index_path = Path("index.html")
index = index_path.read_text()
index = replace_once(
    index,
    '<main id="app" class="app is-offline" data-state="offline">',
    '<main id="app" class="app is-offline" data-state="offline" data-trip-state="ready">',
    "trip state attribute",
)
index = replace_once(
    index,
    '        <button id="newTripButton" class="new-trip-button" type="button">New Trip</button>\n',
    '''        <section id="tripActionControls" class="trip-action-controls" aria-label="Trip controls">
            <button id="newTripButton" class="new-trip-button" type="button">New Trip</button>
            <div id="activeTripControls" class="active-trip-controls" hidden>
                <button id="endTripButton" class="trip-action-button end-trip-button" type="button">End Trip</button>
                <div class="trip-action-row">
                    <button id="breakButton" class="trip-action-button break-button" type="button">Break</button>
                    <button id="downButton" class="trip-action-button down-button" type="button">Down</button>
                </div>
            </div>
        </section>
''',
    "trip control markup",
)
index = replace_once(
    index,
    '''    <script src="TemporalFormat.js"></script>''',
    '''    <dialog id="breakDialog" class="app-dialog break-dialog">
        <section class="break-dialog-content">
            <header class="dialog-header">
                <h2>Break</h2>
                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>
            </header>
            <p>Break options will be added here.</p>
        </section>
    </dialog>

    <script src="TemporalFormat.js"></script>''',
    "break modal",
)
index_path.write_text(index)

# CSS: active trip layout, handoff behavior, dialog opening duration.
css_path = Path("app.css")
css = css_path.read_text()
css = replace_once(
    css,
    '''.new-trip-button {
    margin: 0;''',
    '''.trip-action-controls {
    width: 100%;
    height: 100%;
    min-height: 0;
}

.active-trip-controls {
    width: 100%;
    height: 100%;
    display: none;
    grid-template-rows: 1fr 1fr;
}

.trip-action-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 0;
}

.app[data-trip-state="running"] {
    grid-template-rows: 52px 142px 122px 0 122px 1fr 74px;
}

.app[data-trip-state="running"] .new-trip-button {
    display: none;
}

.app[data-trip-state="running"] .active-trip-controls {
    display: grid;
}

.trip-action-button {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    border: 3px solid #000;
    border-radius: 15px;
    color: var(--wm-blue-dark);
    font-size: 38px;
    font-weight: 700;
    line-height: 1;
}

.end-trip-button,
.break-button {
    background: var(--wm-yellow);
}

.down-button {
    color: var(--wm-white);
    background: #2e7d32;
}

.new-trip-button {
    margin: 0;''',
    "trip controls css",
)
css = replace_once(
    css,
    '''[popover] {
    opacity: 0;''',
    '''[popover] {
    opacity: 0;''',
    "popover anchor",
)
# Add immediate popover rule after popover transition block opening.
css = replace_once(
    css,
    '''[popover]:popover-open {
    opacity: 1;
}
''',
    '''[popover]:popover-open {
    opacity: 1;
}

[popover].popover-immediate-close {
    transition: none !important;
}
''',
    "immediate popover css",
)
css = replace_once(
    css,
    '''    transition-duration: 250ms;
    transition-timing-function: linear;
    transition-behavior: normal, allow-discrete, allow-discrete;
}

.login-dialog.initial-login-opening {
    transition-duration: 750ms;
}
''',
    '''    transition-duration: var(--app-dialog-transition-duration, 250ms);
    transition-timing-function: linear;
    transition-behavior: normal, allow-discrete, allow-discrete;
}
''',
    "dialog duration css",
)
css = replace_once(
    css,
    '''    transition: opacity 250ms linear;
}

.login-dialog.initial-login-opening::backdrop {
    transition-duration: 750ms;
}
''',
    '''    transition: opacity var(--app-dialog-transition-duration, 250ms) linear;
}
''',
    "dialog backdrop duration css",
)
css += '''

.break-dialog {
    width: min(420px, calc(100vw - 32px));
    padding: 20px;
}

.break-dialog-content {
    display: grid;
    gap: 18px;
}

.break-dialog-content p {
    margin: 0;
    text-align: center;
}
'''
css_path.write_text(css)

# Application gesture/event orchestration + number-pad edit behavior.
app_path = Path("app.js")
app = app_path.read_text()

app = replace_once(
    app,
    '''    const authButton = $("#authButton");
''',
    '''    const authButton = $("#authButton");
    const mainMenu = $("#mainMenu");
    const activeTripControls = $("#activeTripControls");
    const breakDialog = $("#breakDialog");
''',
    "app element refs",
)
app = replace_once(
    app,
    '''    let numberPadLastClearPointerDown = 0;
''',
    '''    let numberPadLastClearPointerDown = 0;
    let initialLoginSuppressed = false;
    let initialLoginAttemptPending = true;
''',
    "initial login state",
)

old_login_helpers = '''    function showInitialLoginDialog() {
        if (loginDialog.open) return;
        loginDialog.classList.add("initial-login-opening");
        loginDialog.showModal();
        requestAnimationFrame(() => {
            $("#loginUsername")?.focus({ preventScroll: true });
        });
        setTimeout(() => {
            loginDialog.classList.remove("initial-login-opening");
        }, INITIAL_LOGIN_FADE_DURATION);
    }

    function closeDialog(dialog) {
        if (!dialog?.open) return;
        dialog.classList.remove("initial-login-opening");
        dialog.close();
    }

    loginDialog.addEventListener("cancel", () => {
        loginDialog.classList.remove("initial-login-opening");
    });
'''
new_login_helpers = '''    function emitUIEvent(target, name, detail = {}, cancelable = false) {
        if (!target) return true;
        return target.dispatchEvent(new CustomEvent(name, {
            detail,
            bubbles: true,
            cancelable
        }));
    }

    function openDialogElement(dialog, { duration = 250, reason = "user" } = {}) {
        if (!dialog || dialog.open) return false;
        const proceed = emitUIEvent(dialog, "opening", { reason, duration }, true);
        if (!proceed) return false;
        dialog.style.setProperty("--app-dialog-transition-duration", `${duration}ms`);
        dialog.showModal();
        setTimeout(() => {
            if (!dialog.open) return;
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(dialog, "opened", { reason, duration });
        }, duration);
        return true;
    }

    function closeDialog(dialog, { reason = "user", immediate = false } = {}) {
        if (!dialog?.open) return false;
        const proceed = emitUIEvent(dialog, "closing", { reason, immediate }, true);
        if (!proceed) return false;
        if (immediate) dialog.style.setProperty("--app-dialog-transition-duration", "0ms");
        dialog.close();
        const duration = immediate ? 0 : 250;
        setTimeout(() => {
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(dialog, "closed", { reason, immediate });
        }, duration);
        return true;
    }

    function popoverIsOpen(popover) {
        try { return Boolean(popover?.matches?.(":popover-open")); }
        catch { return false; }
    }

    function hidePopoverForHandoff(popover) {
        if (!popoverIsOpen(popover)) return true;
        popover.classList.add("popover-immediate-close");
        popover.hidePopover?.();
        const closed = !popoverIsOpen(popover);
        requestAnimationFrame(() => popover.classList.remove("popover-immediate-close"));
        return closed;
    }

    document.querySelectorAll("[popover]").forEach(popover => {
        popover.addEventListener("beforetoggle", event => {
            const opening = event.newState === "open";
            const proceed = emitUIEvent(
                popover,
                opening ? "opening" : "closing",
                { oldState: event.oldState, newState: event.newState },
                true
            );
            if (!proceed) event.preventDefault();
        });
        popover.addEventListener("toggle", event => {
            emitUIEvent(
                popover,
                event.newState === "open" ? "opened" : "closed",
                { oldState: event.oldState, newState: event.newState }
            );
        });
    });

    document.addEventListener("pointerdown", event => {
        if (initialLoginAttemptPending && !loginDialog.open) {
            initialLoginSuppressed = true;
        }
        const trigger = event.target.closest?.("[data-dialog], [popovertarget]");
        const sourcePopover = trigger?.closest?.("[popover]");
        if (sourcePopover && trigger !== $("#menuButton")) {
            sourcePopover.classList.add("popover-immediate-close");
        }
    }, true);

    loginDialog.addEventListener("opening", event => {
        if (event.detail?.reason === "initial-login" && initialLoginSuppressed) {
            event.preventDefault();
        }
    });

    function showInitialLoginDialog() {
        if (loginDialog.open) return;
        const opened = openDialogElement(loginDialog, {
            duration: INITIAL_LOGIN_FADE_DURATION,
            reason: "initial-login"
        });
        initialLoginAttemptPending = false;
        if (!opened) return;
        requestAnimationFrame(() => {
            $("#loginUsername")?.focus({ preventScroll: true });
        });
    }
'''
app = replace_once(app, old_login_helpers, new_login_helpers, "login lifecycle helpers")

old_open_dialog = '''    function openDialog(id) {
        const dialog = document.getElementById(id);
        if (dialog && !dialog.open) dialog.showModal();
        $("#mainMenu")?.hidePopover?.();
    }
'''
new_open_dialog = '''    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return false;
        if (fromPopover && !hidePopoverForHandoff(mainMenu)) return false;
        return openDialogElement(dialog, {
            duration: fromPopover ? 750 : 250,
            reason
        });
    }
'''
app = replace_once(app, old_open_dialog, new_open_dialog, "open dialog wrapper")

old_dialog_bind = '''    document.querySelectorAll("[data-dialog]").forEach(button => {
        button.addEventListener("click", () => {
            if (button.dataset.dialog === "profileDialog" && !clockTimer.connected) {
                openDialog("loginDialog");
                return;
            }
            if (button.dataset.dialog === "graphicalSettingsDialog") fillGraphicalForm(getGraphicalSettings());
            openDialog(button.dataset.dialog);
        });
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("click", () => closeDialog(button.closest("dialog")));
    });
'''
new_dialog_bind = '''    document.querySelectorAll("[data-dialog]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.dataset.dialog === "profileDialog" && !clockTimer.connected) {
                openDialog("loginDialog", { fromPopover: true, reason: "popover-handoff" });
                return;
            }
            if (button.dataset.dialog === "graphicalSettingsDialog") fillGraphicalForm(getGraphicalSettings());
            openDialog(button.dataset.dialog, { fromPopover: true, reason: "popover-handoff" });
        });
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("pointerup", () => closeDialog(button.closest("dialog")));
    });
'''
app = replace_once(app, old_dialog_bind, new_dialog_bind, "dialog pointer bindings")

old_auth = '''    authButton.addEventListener("click", async () => {
        $("#mainMenu")?.hidePopover?.();
        if (!clockTimer.connected) {
            clearTimeout(loginPromptTimeout);
            loginPromptTimeout = undefined;
            if (!loginDialog.open) loginDialog.showModal();
            return;
        }
        try { await clockTimer.disconnect(); }
        catch {}
        finally { setOffline(true); }
    });
'''
new_auth = '''    authButton.addEventListener("pointerup", async () => {
        if (!clockTimer.connected) {
            clearTimeout(loginPromptTimeout);
            loginPromptTimeout = undefined;
            initialLoginAttemptPending = false;
            openDialog("loginDialog", { fromPopover: true, reason: "popover-handoff" });
            return;
        }
        mainMenu?.hidePopover?.();
        try { await clockTimer.disconnect(); }
        catch {}
        finally { setOffline(true); }
    });
'''
app = replace_once(app, old_auth, new_auth, "auth pointer binding")

# Number pad: existing value stays visible, first numeric gesture replaces it; Clear resets to initial.
app = replace_once(
    app,
    '''            pending: initial,
            locked,
            persistence:''',
    '''            pending: initial,
            replaceOnNextDigit: source !== "new-trip",
            locked,
            persistence:''',
    "number pad replace state",
)
app = replace_once(
    app,
    '''        numberPadState.pending = "";
        refreshNumberPad();
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("click", () => {
                if (!numberPadState) return;
                numberPadState.pending += button.dataset.number;
                refreshNumberPad();
            });
        });''',
    '''        numberPadState.pending = numberPadState.initial;
        numberPadState.replaceOnNextDigit = numberPadState.source !== "new-trip";
        refreshNumberPad();
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                numberPadState.pending += button.dataset.number;
                refreshNumberPad();
            });
        });''',
    "number pad digit replacement",
)
app = replace_once(
    app,
    '''                numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                refreshNumberPad();''',
    '''                numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                numberPadState.replaceOnNextDigit = false;
                refreshNumberPad();''',
    "autocorrect replacement state",
)

# Number pad commit becomes event-driven for UI refresh.
app = replace_once(
    app,
    '''            clockTimer.setAttribute(attribute, `${percent}%`);
            updateSummaryValues();
            return true;''',
    '''            clockTimer.setAttribute(attribute, `${percent}%`);
            return true;''',
    "percent commit refresh",
)
app = replace_once(
    app,
    '''        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
        }
        updateSummaryValues();
        return true;''',
    '''        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
            if (clockTimer.standardTime !== formatted) return false;
        }
        return true;''',
    "standard commit refresh",
)

# Shared New/Next Trip workflow and running controls.
old_new_trip = '''    $("#newTripButton").addEventListener("click", () => {
        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000 })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        void openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        }).catch(() => {});
    });
'''
new_new_trip = '''    async function beginNewTripWorkflow() {
        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000 })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        });
    }

    $("#newTripButton").addEventListener("pointerup", () => {
        void beginNewTripWorkflow().catch(() => {});
    });

    $("#endTripButton").addEventListener("pointerup", () => {
        void clockTimer.stop().catch(() => {});
    });

    $("#breakButton").addEventListener("pointerup", () => {
        openDialog("breakDialog", { reason: "break" });
    });

    $("#downButton").addEventListener("pointerup", () => {
        void clockTimer.startInterval("down").catch(() => {});
    });
'''
app = replace_once(app, old_new_trip, new_new_trip, "shared new trip workflow")

# Standard/goal number-pad entry gestures use pointerup.
app = app.replace('$("#standardTimeButton").addEventListener("click", () => {', '$("#standardTimeButton").addEventListener("pointerup", () => {', 1)
app = app.replace('$("#goalPercentValue").addEventListener("click", () => {', '$("#goalPercentValue").addEventListener("pointerup", () => {', 1)

old_event_tail = '''    clockTimer.addEventListener("cadenceTick", event => {
        updateSummaryValues(event.detail?.summary);
    });

    const summaryRefreshEvents = [
        "start",
        "stop",
        "cleared",
        "goalChange",
        "renderedPercentGoalChange",
        "renderedTimeModeChange",
        "standardTimeChange",
        "intervalStart",
        "intervalEnd",
        "intervalElapsed",
        "intervalExtended",
        "intervalApprovalToggle",
        "intervalApprovalChange",
        "intervalDelete",
        "goalChangeFailed"
    ];

    for (const eventName of summaryRefreshEvents) {
        clockTimer.addEventListener(eventName, queueSummaryRefresh);
    }

    clockTimer.addEventListener("percentModeChange", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });
'''
new_event_tail = '''    function setTripControlState(running) {
        app.dataset.tripState = running ? "running" : "ready";
        activeTripControls.hidden = !running;
    }

    function updatePostStopSummary(summary) {
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

    clockTimer.addEventListener("cadenceTick", event => {
        updateSummaryValues(event.detail?.summary);
    });

    clockTimer.addEventListener("started", event => {
        setTripControlState(true);
        updateSummaryValues(event.detail?.summary);
    });

    clockTimer.addEventListener("stopped", event => {
        setTripControlState(false);
        updatePostStopSummary(event.detail?.summary);
        void beginNewTripWorkflow().catch(() => {});
    });

    const summaryRefreshEvents = [
        "cleared",
        "goalChanged",
        "renderedPercentGoalChanged",
        "renderedTimeModeChanged",
        "standardTimeChanged",
        "intervalStarted",
        "intervalEnded",
        "intervalElapsed",
        "intervalExtended",
        "intervalApprovalToggled",
        "intervalApprovalChanged",
        "intervalDeleted",
        "goalChangeFailed"
    ];

    for (const eventName of summaryRefreshEvents) {
        clockTimer.addEventListener(eventName, queueSummaryRefresh);
    }

    clockTimer.addEventListener("cleared", () => {
        setTripControlState(false);
    });

    clockTimer.addEventListener("percentModeChanged", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });
'''
app = replace_once(app, old_event_tail, new_event_tail, "clock event listeners")

# Break dialog reference should be exercised so static analyzers don't consider it accidental.
app = replace_once(
    app,
    '''    const graphicalSettings = getGraphicalSettings();''',
    '''    breakDialog?.addEventListener("opened", () => {});

    const graphicalSettings = getGraphicalSettings();''',
    "break dialog lifecycle anchor",
)

app_path.write_text(app)
print("trip UI, event naming, login handoff, and number-pad edit patch complete")
