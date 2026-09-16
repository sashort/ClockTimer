(() => {
    "use strict";

    const API_BASE = "https://wmof.sashort-apps.com/";
    const GRAPHICAL_SETTINGS_VERSION = 4;
    const STORAGE = {
        percentMode: "wmof.clock.percentMode",
        renderedTimeMode: "wmof.clock.renderedTimeMode",
        graphicalSettings: "wmof.clock.graphicalSettings",
        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion",
        tripPreferences: "wmof.clock.tripPreferences"
    };

    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
    const TRIP_PREFERENCE_DEFAULTS = {
        lateBreakBehavior: "showLateWindow",
        matchTripGoalToTotal: false
    };
    const GRAPHICAL_DEFAULTS = {
        timerType: "radial-overflow",
        timerMode: "elapsed",
        showTolerance: true,
        militaryTime: true,
        timeFormat: "HHmm",
        dateFormat: "",
        visibleHours: "12,3,6,9",
        tickMarks: "[10]",
        indicatorSymbol: "▲",
        hourHandLength: "28%",
        hourHandWidth: "5px",
        hourHandColor: "#ffffff",
        minuteHandLength: "38%",
        minuteHandWidth: "4px",
        minuteHandColor: "#ffffff",
        secondHandLength: "42%",
        secondHandWidth: "2px",
        secondHandColor: "#ffc220",
        hourFont: "Helvetica, Arial, sans-serif",
        hourFontSize: "24px",
        hourColor: "#ffffff",
        timeFont: "Helvetica, Arial, sans-serif",
        timeFontSize: "48px",
        timeColor: "#ffffff",
        activeRingWidth: "12px",
        inactiveRingWidth: "6px",
        borderWidth: "5px"
    };

    const $ = selector => document.querySelector(selector);
    const clockTimer = $("#clockTimer");
    const clockPreview = $("#clockPreview");
    const app = $("#app");
    const loginDialog = $("#loginDialog");
    const profileDialog = $("#profileDialog");
    const graphicalDialog = $("#graphicalSettingsDialog");
    const stateDialog = $("#stateSettingsDialog");
    const profileMenuButton = $("#profileMenuButton");
    const authButton = $("#authButton");
    const mainMenu = $("#mainMenu");
    const activeTripControls = $("#activeTripControls");
    const endTripButton = $("#endTripButton");
    const tripActionRow = $(".trip-action-row");
    const breakButton = $("#breakButton");
    const downButton = $("#downButton");
    const breakDialog = $("#breakDialog");
    const tripSettingsDialog = $("#tripSettingsDialog");
    const tripSettingsForm = $("#tripSettingsForm");
    const tripSettingsTitle = $("#tripSettingsTitle");
    const tripSettingsCloud = $("#tripSettingsCloud");
    const tripSettingsPrimary = $("#tripSettingsPrimary");
    const tripSetStartsNow = $("#tripSetStartsNow");
    const tripGoalSyncOption = $("#tripGoalSyncOption");
    const tripGoalSyncNoData = $("#tripGoalSyncNoData");
    const tripSettingsPreferences = $("#tripSettingsPreferences");

    let timerStartedAt = 0;
    let timerAccumulated = 0;
    let timerInterval;
    let loginPromptTimeout;
    let grayscaleReleaseTimeout;
    let loginPending = false;
    let stagedStandardTime;
    let tripDraft;
    let numberPadState;
    let numberPadLoadPromise;
    let numberPadDialog;
    let numberPadDisplay;
    let numberPadSettingsArea;
    let numberPadSettings;
    let numberPadConnection;
    let numberPadClear;
    let numberPadConfirm;
    let numberPadContext;
    let numberPadReadout;
    let numberPadDate;
    let numberPadDateRow;
    let numberPadAM;
    let numberPadPM;
    const uiReturnStack = [];
    let numberPadLongPressTimer;
    let numberPadLongPressed = false;
    let numberPadLastClearPointerDown = 0;
    let initialLoginSuppressed = false;
    let initialLoginAttemptPending = true;
    let numberPadConnectionSequence = 0;
    let connectionResumePromise;

    const CONNECTION_INDICATOR_MINIMUM = 1000;
    const NUMBER_PAD_LONG_PRESS = 750;
    const NUMBER_PAD_DOUBLE_PRESS = 350;
    const STARTUP_CONNECTION_DELAY = 2000;
    const STARTUP_GRAYSCALE_RAMP = 2000;
    const LOGIN_GRAYSCALE_RAMP = 750;
    const INITIAL_LOGIN_FADE_DURATION = 750;

    function safeStorageGet(key) {
        try { return localStorage.getItem(key); }
        catch { return null; }
    }

    function safeStorageSet(key, value) {
        try { localStorage.setItem(key, value); }
        catch {}
    }

    function getStoredJSON(key, fallback) {
        try {
            const raw = safeStorageGet(key);
            return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
        }
        catch {
            return { ...fallback };
        }
    }

    function getTripPreferences() {
        let stored = {};
        try {
            stored = JSON.parse(safeStorageGet(STORAGE.tripPreferences) || "{}");
        }
        catch {}

        const lateBreakBehavior = stored.lateBreakBehavior === "autoRestartTrip"
            ? "autoRestartTrip"
            : stored.lateBreakBehavior === "showLateWindow"
                ? "showLateWindow"
                : stored.intervalElapsedBehavior === "rollover"
                    ? "autoRestartTrip"
                    : TRIP_PREFERENCE_DEFAULTS.lateBreakBehavior;

        return {
            lateBreakBehavior,
            matchTripGoalToTotal: Boolean(
                stored.matchTripGoalToTotal ??
                TRIP_PREFERENCE_DEFAULTS.matchTripGoalToTotal
            )
        };
    }

    function saveTripPreferences(preferences) {
        safeStorageSet(STORAGE.tripPreferences, JSON.stringify(preferences));
    }

    function fillTripPreferencesForm(preferences = getTripPreferences()) {
        const form = $("#stateSettingsForm");
        form.elements.lateBreakBehavior.value = preferences.lateBreakBehavior;
        form.elements.matchTripGoalToTotal.checked = Boolean(preferences.matchTripGoalToTotal);
    }

    function getGraphicalSettings() {
        const settings = getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
        const version = Number(safeStorageGet(STORAGE.graphicalSettingsVersion) || 0);

        if (version < GRAPHICAL_SETTINGS_VERSION) {
            delete settings.grayscale;
            delete settings.grayscaleRamp;
            if (!settings.timeFormat || settings.timeFormat === "HHmmss") settings.timeFormat = "HHmm";
            if (!settings.visibleHours) settings.visibleHours = GRAPHICAL_DEFAULTS.visibleHours;
            if (!settings.tickMarks) settings.tickMarks = GRAPHICAL_DEFAULTS.tickMarks;
            if (!settings.indicatorSymbol || settings.indicatorSymbol === "↑") settings.indicatorSymbol = GRAPHICAL_DEFAULTS.indicatorSymbol;
            if (!settings.borderWidth || settings.borderWidth === "7px") settings.borderWidth = GRAPHICAL_DEFAULTS.borderWidth;
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
            safeStorageSet(STORAGE.graphicalSettingsVersion, String(GRAPHICAL_SETTINGS_VERSION));
        }

        return settings;
    }

    function saveGraphicalSettings(settings) {
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
        safeStorageSet(STORAGE.graphicalSettingsVersion, String(GRAPHICAL_SETTINGS_VERSION));
    }

    function formatDuration(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
    }

    function syncConnectionUI(connected) {
        profileMenuButton.hidden = !connected;
        authButton.textContent = connected ? "Logout" : "Login";
        authButton.classList.toggle("logout-button", connected);
    }

    function wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
    }

    function normalizedConnectionStatus(value = clockTimer.networkStatus) {
        return value === "online" ? "online" : "offline";
    }

    function syncTripSettingsCloud(status = clockTimer.networkStatus) {
        if (!tripSettingsCloud) return;
        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);
        tripSettingsCloud.dataset.networkStatus = normalized;
        tripSettingsCloud.setAttribute("aria-busy", String(normalized === "pending"));
        tripSettingsCloud.setAttribute(
            "aria-label",
            normalized === "pending"
                ? "Checking connection"
                : normalized === "online"
                    ? "Connected"
                    : "Offline. Retry connection"
        );
        tripSettingsCloud.setAttribute("aria-disabled", String(normalized !== "offline"));
    }

    function updateNumberPadConnectionStatus(token, status) {
        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);
        if (numberPadState?.connectionStatusToken === token) {
            numberPadState.persistence = normalized;
            refreshNumberPad();
        }
        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {
            const frame = uiReturnStack[index];
            if (
                frame?.type === "number-pad" &&
                frame.state?.connectionStatusToken === token
            ) {
                frame.state.persistence = normalized;
                break;
            }
        }
    }

    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt = performance.now();
        try {
            await Promise.resolve(preparationPromise);
        }
        catch {}
        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);
        if (remaining > 0) await wait(remaining);
        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus
        );
    }

    async function resumeConnectionFromCloud({ numberPad = false } = {}) {
        const startedAt = performance.now();
        let token;

        if (numberPad && numberPadState) {
            token = numberPadState.connectionStatusToken || ++numberPadConnectionSequence;
            numberPadState.connectionStatusToken = token;
            updateNumberPadConnectionStatus(token, "pending");
        }
        syncTripSettingsCloud("pending");

        if (!connectionResumePromise) {
            connectionResumePromise = Promise.resolve()
                .then(() => clockTimer.resumeConnection())
                .catch(() => false)
                .finally(() => {
                    connectionResumePromise = undefined;
                });
        }

        await connectionResumePromise;
        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);
        if (remaining > 0) await wait(remaining);

        const status = normalizedConnectionStatus();
        if (token) {
            updateNumberPadConnectionStatus(token, status);
        }
        else {
            const frame = findUIReturnFrame("number-pad");
            if (frame?.state) frame.state.persistence = status;
        }
        syncTripSettingsCloud(status);
        syncNetworkStatusUI();
        return status === "online";
    }

    function emitUIEvent(target, name, detail = {}, cancelable = false) {
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

    function peekUIReturnFrame() {
        return uiReturnStack[uiReturnStack.length - 1];
    }

    function findUIReturnFrame(type) {
        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {
            if (uiReturnStack[index]?.type === type) return uiReturnStack[index];
        }
        return undefined;
    }

    function pushUIReturnFrame(frame) {
        if (!frame) return false;
        uiReturnStack.push(frame);
        return true;
    }

    function popUIReturnFrame(frame = peekUIReturnFrame()) {
        if (!frame || peekUIReturnFrame() !== frame) return false;
        uiReturnStack.pop();
        return true;
    }

    function captureNumberPadReturnFrame() {
        return numberPadState
            ? { type: "number-pad", state: { ...numberPadState } }
            : undefined;
    }

    async function restoreUIReturnFrame(frame, reason = "ui-return") {
        if (!frame) return false;

        if (frame.type === "number-pad") {
            await restoreNumberPadState(frame.state, { duration: 0 });
            return Boolean(numberPadDialog?.open);
        }

        if (frame.type === "dialog") {
            if (frame.element?.open) return true;
            if (frame.element === tripSettingsDialog) {
                return openTripSettingsDialog(reason, { duration: 0 });
            }
            return openDialogElement(frame.element, { duration: 0, reason });
        }

        if (frame.type === "popover") {
            if (popoverIsOpen(frame.element)) return true;
            try { frame.element?.showPopover?.(); }
            catch { return false; }
            return popoverIsOpen(frame.element);
        }

        return false;
    }

    async function closeDialogWithReturn(dialog, { reason = "user", immediate = false } = {}) {
        if (!dialog?.open) return false;
        const caller = peekUIReturnFrame();

        if (caller && !await restoreUIReturnFrame(caller, `${reason}:return`)) {
            return false;
        }

        const handoffImmediate = immediate || (
            dialog === tripSettingsDialog && caller?.type === "number-pad"
        );
        if (!closeDialog(dialog, { reason, immediate: handoffImmediate })) return false;
        if (caller) {
            popUIReturnFrame(caller);
            if (caller.type === "number-pad" && numberPadDialog?.open) {
                refreshNumberPad();
            }
        }
        return true;
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
            if (event.newState === "closed" && popover.classList.contains("popover-immediate-close")) {
                requestAnimationFrame(() => popover.classList.remove("popover-immediate-close"));
            }
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

    function syncNetworkStatusUI({ login = false, startup = false } = {}) {
        clearTimeout(loginPromptTimeout);
        clearTimeout(grayscaleReleaseTimeout);
        loginPromptTimeout = undefined;
        grayscaleReleaseTimeout = undefined;

        const networkStatus =
            clockTimer.networkStatus;

        const offline =
            networkStatus === "offline";

        app.dataset.state =
            clockTimer.status;

        app.dataset.networkStatus =
            networkStatus;

        syncConnectionUI(
            networkStatus === "online"
        );
        syncTripSettingsCloud(networkStatus);

        if (offline) {
            app.style.setProperty("--app-grayscale-ramp", `${STARTUP_GRAYSCALE_RAMP}ms`);
            app.classList.add("is-offline");
            loginPromptTimeout = setTimeout(() => {
                loginPromptTimeout = undefined;
                if (
                    clockTimer.networkStatus === "offline" &&
                    !loginDialog.open
                ) {
                    showInitialLoginDialog();
                }
            }, STARTUP_CONNECTION_DELAY);
            return;
        }

        if (loginDialog.open) {
            void closeDialogWithReturn(loginDialog, { reason: "login-connected" }).catch(() => {});
        }
        if (!app.classList.contains("is-offline")) return;

        const ramp = login ? LOGIN_GRAYSCALE_RAMP : STARTUP_GRAYSCALE_RAMP;
        const delay = startup ? STARTUP_CONNECTION_DELAY : 0;
        app.style.setProperty("--app-grayscale-ramp", `${ramp}ms`);

        grayscaleReleaseTimeout = setTimeout(() => {
            grayscaleReleaseTimeout = undefined;
            if (clockTimer.networkStatus !== "online") return;
            requestAnimationFrame(() => app.classList.remove("is-offline"));
        }, delay);
    }

    function syncScopeUI(persist = false) {
        const actual = clockTimer.percentMode === "total" ? "total" : "trip";
        $("#scopeToggle").textContent = actual === "total" ? "Total" : "Trip";
        updateSummaryLabels();
        updateSummaryValues();
        if (persist) safeStorageSet(STORAGE.percentMode, actual);
        return actual;
    }

    function applyScope(mode, persist = true) {
        const requested = mode === "total" ? "total" : "trip";
        clockTimer.percentMode = requested;
        return syncScopeUI(persist);
    }

    function applyRenderedTimeMode(mode, persist = true) {
        const next = RENDERED_TIME_MODES.includes(mode) ? mode : "remaining";
        clockTimer.renderedTimeMode = next;
        updateSummaryLabels();
        updateSummaryValues();
        if (persist) safeStorageSet(STORAGE.renderedTimeMode, next);
    }

    function updateSummaryLabels() {
        const scope = clockTimer.percentMode === "total" ? "Total" : "Trip";
        const mode = clockTimer.renderedTimeMode;
        const suffix = mode === "elapsed" ? "Time Elapsed" : mode === "calculated-end" ? "End Time" : "Time Remaining";
        $("#standardTimeLabel").textContent = `${scope} Standard Time`;
        $("#renderedTimeLabel").textContent = `${scope} ${suffix}`;
    }

    function formatSummaryPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? `${Math.round(numeric * 100)}%`
            : fallback;
    }

    function updateSummaryValues(summary) {
        let snapshot = summary;
        if (!snapshot?.selected) {
            try {
                snapshot = clockTimer.getSummarySnapshot?.(new Date());
            }
            catch {
                snapshot = undefined;
            }
        }

        const scope = clockTimer.percentMode === "total" ? "total" : "trip";
        const selected = snapshot?.[scope] ?? snapshot?.selected;
        const standard = selected?.standardTime ||
            (scope === "trip" ? (clockTimer.standardTime || stagedStandardTime) : undefined);

        $("#standardTimeValue").textContent =
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
    }

    function queueSummaryRefresh() {
        queueMicrotask(() => {
            updateSummaryLabels();
            updateSummaryValues();
        });
    }

    function setOptionalAttribute(target, name, value) {
        if (value === "" || value === null || value === undefined) target.removeAttribute(name);
        else target.setAttribute(name, value);
    }

    function setClockVariable(target, name, value) {
        if (value === "" || value === null || value === undefined) target.style.removeProperty(name);
        else target.style.setProperty(name, value);
    }

    function applyGraphicalSettings(settings, target = clockTimer) {
        target.setAttribute("timer-type", settings.timerType || GRAPHICAL_DEFAULTS.timerType);
        target.setAttribute("timer-mode", settings.timerMode || GRAPHICAL_DEFAULTS.timerMode);
        target.setAttribute("military-time", String(Boolean(settings.militaryTime)));
        target.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm AM/PM"));

        setOptionalAttribute(target, "date-format", settings.dateFormat);
        setOptionalAttribute(target, "visible-hours", settings.visibleHours);
        setOptionalAttribute(target, "tick-marks", settings.tickMarks);
        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);
        target.removeAttribute("grayscale");
        target.removeAttribute("grayscale-ramp");
        target.showTolerance = Boolean(settings.showTolerance);

        const variables = {
            "--clock-timer-hour-hand-length": settings.hourHandLength,
            "--clock-timer-hour-hand-width": settings.hourHandWidth,
            "--clock-timer-hour-hand-color": settings.hourHandColor,
            "--clock-timer-minute-hand-length": settings.minuteHandLength,
            "--clock-timer-minute-hand-width": settings.minuteHandWidth,
            "--clock-timer-minute-hand-color": settings.minuteHandColor,
            "--clock-timer-second-hand-length": settings.secondHandLength,
            "--clock-timer-second-hand-width": settings.secondHandWidth,
            "--clock-timer-second-hand-color": settings.secondHandColor,
            "--clock-timer-hour-font": settings.hourFont,
            "--clock-timer-hour-font-size": settings.hourFontSize,
            "--clock-timer-time-font": settings.timeFont,
            "--clock-timer-time-font-size": settings.timeFontSize,
            "--clock-timer-time-color": settings.timeColor,
            "--clock-timer-active-ring-width": settings.activeRingWidth,
            "--clock-timer-inactive-ring-width": settings.inactiveRingWidth,
            "--clock-timer-border-width": settings.borderWidth,
            "--clock-timer-tick-color": settings.hourColor
        };

        for (const [name, value] of Object.entries(variables)) setClockVariable(target, name, value);
        target.style.color = settings.hourColor || GRAPHICAL_DEFAULTS.hourColor;
    }

    function settingsFromForm(form) {
        const data = new FormData(form);
        const text = name => String(data.get(name) || "").trim();
        return {
            timerType: text("timerType"),
            timerMode: text("timerMode"),
            showTolerance: form.elements.showTolerance.checked,
            militaryTime: form.elements.militaryTime.checked,
            timeFormat: text("timeFormat"),
            dateFormat: text("dateFormat"),
            visibleHours: text("visibleHours"),
            tickMarks: text("tickMarks"),
            indicatorSymbol: text("indicatorSymbol"),
            hourHandLength: text("hourHandLength"),
            hourHandWidth: text("hourHandWidth"),
            hourHandColor: text("hourHandColor"),
            minuteHandLength: text("minuteHandLength"),
            minuteHandWidth: text("minuteHandWidth"),
            minuteHandColor: text("minuteHandColor"),
            secondHandLength: text("secondHandLength"),
            secondHandWidth: text("secondHandWidth"),
            secondHandColor: text("secondHandColor"),
            hourFont: text("hourFont"),
            hourFontSize: text("hourFontSize"),
            hourColor: text("hourColor"),
            timeFont: text("timeFont"),
            timeFontSize: text("timeFontSize"),
            timeColor: text("timeColor"),
            activeRingWidth: text("activeRingWidth"),
            inactiveRingWidth: text("inactiveRingWidth"),
            borderWidth: text("borderWidth")
        };
    }

    function fillGraphicalForm(settings) {
        const form = $("#graphicalSettingsForm");
        for (const [key, value] of Object.entries(settings)) {
            const control = form.elements[key];
            if (!control) continue;
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;
        }
        applyGraphicalSettings(settings, clockPreview);
    }

    function syncTimeFormatForMilitaryToggle(form) {
        const control = form.elements.timeFormat;
        const current = String(control.value || "").trim();
        const military = form.elements.militaryTime.checked;
        const militaryDefaults = new Set(["HHmm", "HHmmss"]);
        const standardDefaults = new Set(["h:mm AM/PM", "h:mm:ss AM/PM"]);
        if (military) {
            if (!current || standardDefaults.has(current)) control.value = "HHmm";
        }
        else if (!current || militaryDefaults.has(current)) {
            control.value = "h:mm AM/PM";
        }
    }

    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return false;

        const caller = fromPopover && popoverIsOpen(mainMenu)
            ? { type: "popover", element: mainMenu }
            : undefined;
        if (caller) pushUIReturnFrame(caller);

        const opened = openDialogElement(dialog, {
            duration: fromPopover ? 750 : 250,
            reason
        });
        if (!opened) {
            if (caller) popUIReturnFrame(caller);
            return false;
        }

        if (caller && !hidePopoverForHandoff(mainMenu)) {
            closeDialog(dialog, { reason: `${reason}:rollback`, immediate: true });
            popUIReturnFrame(caller);
            return false;
        }
        return true;
    }

    $("#scopeToggle").addEventListener("pointerup", () => {
        clockTimer.percentMode = clockTimer.percentMode === "total" ? "trip" : "total";
    });

    $("#renderedTimeButton").addEventListener("pointerup", () => {
        const index = RENDERED_TIME_MODES.indexOf(clockTimer.renderedTimeMode);
        clockTimer.renderedTimeMode = RENDERED_TIME_MODES[(index + 1) % RENDERED_TIME_MODES.length];
    });

    clockTimer.addEventListener("pointerdown", () => {
        if (clockTimer.getAttribute("timer-type") !== "radial-overflow") return;
        clockTimer.setAttribute("timer-type", "radial-fitted");
        const settings = getGraphicalSettings();
        settings.timerType = "radial-fitted";
        saveGraphicalSettings(settings);
    });

    document.querySelectorAll("[data-dialog]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.dataset.dialog === "profileDialog" && clockTimer.networkStatus !== "online") {
                openDialog("loginDialog", { fromPopover: true, reason: "popover-handoff" });
                return;
            }
            if (button.dataset.dialog === "graphicalSettingsDialog") fillGraphicalForm(getGraphicalSettings());
            if (button.dataset.dialog === "stateSettingsDialog") fillTripPreferencesForm();
            openDialog(button.dataset.dialog, { fromPopover: true, reason: "popover-handoff" });
        });
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("pointerup", () => {
            const dialog = button.closest("dialog");
            void closeDialogWithReturn(dialog, { reason: "dialog-close" }).catch(() => {});
        });
    });

    document.querySelectorAll("dialog").forEach(dialog => {
        dialog.addEventListener("cancel", event => {
            if (!peekUIReturnFrame()) return;
            event.preventDefault();
            void closeDialogWithReturn(dialog, { reason: "dialog-cancel" }).catch(() => {});
        });
    });

    $("#graphicalSettingsForm").addEventListener("input", event => {
        if (event.target.name === "militaryTime") syncTimeFormatForMilitaryToggle(event.currentTarget);
        if (event.target.matches("input, select")) applyGraphicalSettings(settingsFromForm(event.currentTarget), clockPreview);
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const settings = settingsFromForm(event.currentTarget);
        applyGraphicalSettings(settings);
        saveGraphicalSettings(settings);
        void closeDialogWithReturn(graphicalDialog, { reason: "graphical-settings-save" }).catch(() => {});
    });

    $("#resetGraphicalSettings").addEventListener("click", () => fillGraphicalForm({ ...GRAPHICAL_DEFAULTS }));

    $("#stateSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        const preferences = {
            lateBreakBehavior:
                form.elements.lateBreakBehavior.value === "autoRestartTrip"
                    ? "autoRestartTrip"
                    : "showLateWindow",
            matchTripGoalToTotal: form.elements.matchTripGoalToTotal.checked
        };
        saveTripPreferences(preferences);
        if (!tripIsLive() && !tripDraft) {
            clockTimer.intervalElapsedBehavior = "startLatency";
            clockTimer.autoRestartTripAfterLateBreak =
                preferences.lateBreakBehavior === "autoRestartTrip";
        }
        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});
    });

    $("#loginForm").addEventListener("submit", async event => {
        event.preventDefault();
        const username = $("#loginUsername").value.trim();
        const password = $("#loginPassword").value;
        const error = $("#loginError");
        error.textContent = "";
        loginPending = true;
        try {
            const result = await clockTimer.connect(username, password);
            if (!result?.connected) throw new Error("Login failed.");
            $("#profileUsername").value = result.user?.username || username;
            syncNetworkStatusUI({ login: true });
        }
        catch (failure) {
            error.textContent = failure?.message || "Unable to login.";
        }
        finally {
            loginPending = false;
        }
    });

    authButton.addEventListener("pointerup", async () => {
        if (clockTimer.networkStatus !== "online") {
            clearTimeout(loginPromptTimeout);
            loginPromptTimeout = undefined;
            initialLoginAttemptPending = false;
            openDialog("loginDialog", { fromPopover: true, reason: "popover-handoff" });
            return;
        }
        mainMenu?.hidePopover?.();
        try { await clockTimer.disconnect(); }
        catch {}
        finally { syncNetworkStatusUI(); }
    });

    $("#newUserButton").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("wmof:new-user-request", { detail: { apiBase: API_BASE } }));
    });

    $("#profileForm").addEventListener("submit", event => {
        event.preventDefault();
        void closeDialogWithReturn(profileDialog, { reason: "profile-save" }).catch(() => {});
        window.dispatchEvent(new CustomEvent("wmof:profile-save", {
            detail: Object.fromEntries(new FormData(event.currentTarget))
        }));
    });

    $("#resetPasswordButton").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("wmof:reset-password-request", { detail: { apiBase: API_BASE } }));
    });

    async function ensureNumberPadLoaded() {
        if (numberPadDialog?.isConnected) return;
        if (!numberPadLoadPromise) {
            numberPadLoadPromise = (async () => {
                const response = await fetch("numberpad.html", { cache: "no-store" });
                if (!response.ok) throw new Error(`Unable to load number pad (${response.status}).`);
                const template = document.createElement("template");
                template.innerHTML = (await response.text()).trim();
                document.body.append(template.content.cloneNode(true));
                numberPadDialog = $("#numberPadDialog");
                numberPadDisplay = $("#numberPadDisplay");
                numberPadSettingsArea = $("#numberPadSettingsArea");
                numberPadSettings = $("#numberPadSettings");
                numberPadConnection = $("#numberPadConnection");
                numberPadClear = $("#numberPadClear");
                numberPadConfirm = $("#numberPadConfirm");
                numberPadContext = $("#numberPadContext");
                numberPadReadout = $("#numberPadReadout");
                numberPadDate = $("#numberPadDate");
                numberPadDateRow = $("#numberPadDateRow");
                numberPadAM = $("#numberPadAM");
                numberPadPM = $("#numberPadPM");
                bindNumberPadEvents();
            })().catch(error => {
                numberPadLoadPromise = undefined;
                throw error;
            });
        }
        await numberPadLoadPromise;
    }

    function normalizeTimeDigits(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (!match) return "";
        const hours = match[1] || "";
        const minutes = match[2];
        const seconds = match[3];
        return hours ? `${hours}${minutes.padStart(2, "0")}${seconds}` : `${minutes}${seconds}`;
    }

    function parseTimelineTime(value) {
        const text = String(value || "").trim();
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (!match) return undefined;
        const hours = Number(match[1] || 0);
        const minutes = Number(match[2]);
        const seconds = Number(match[3]);
        const milliseconds = Number(String(match[4] || "0").padEnd(3, "0"));
        if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) return undefined;
        if (minutes > 59 || seconds > 59) return undefined;
        return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
    }

    function splitTimeDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        const secondsText = raw.slice(-2).padStart(2, "0");
        if (raw.length <= 2) return { hoursText: "", minutesText: "0", secondsText };
        if (raw.length <= 4) return {
            hoursText: "",
            minutesText: raw.slice(0, -2) || "0",
            secondsText
        };
        return {
            hoursText: raw.slice(0, -4).replace(/^0+(?=\d)/, "") || "0",
            minutesText: raw.slice(-4, -2),
            secondsText
        };
    }

    function renderTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return "";
        return parts.hoursText
            ? `${parts.hoursText}:${parts.minutesText.padStart(2, "0")}:${parts.secondsText}`
            : `${Number(parts.minutesText)}:${parts.secondsText}`;
    }

    function timeDigitsValid(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return false;
        return Number(parts.minutesText) < 60 && Number(parts.secondsText) < 60;
    }

    function autocorrectTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return raw;
        const totalSeconds =
            Number(parts.hoursText || 0) * 3600 +
            Number(parts.minutesText) * 60 +
            Number(parts.secondsText);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return hours > 0
            ? `${hours}${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`
            : `${minutes}${String(seconds).padStart(2, "0")}`;
    }

    function splitAbsoluteDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        if (raw.length <= 2) {
            return { hour: Number(raw), minute: 0, second: 0 };
        }
        if (raw.length <= 4) {
            return {
                hour: Number(raw.slice(0, -2)),
                minute: Number(raw.slice(-2)),
                second: 0
            };
        }
        return {
            hour: Number(raw.slice(0, -4)),
            minute: Number(raw.slice(-4, -2)),
            second: Number(raw.slice(-2))
        };
    }

    function absoluteDigits(hour, minute, second) {
        return `${Number(hour)}${String(minute).padStart(2, "0")}${String(second).padStart(2, "0")}`;
    }

    function absoluteDigitsValid(raw, meridiem) {
        const parts = splitAbsoluteDigits(raw);
        if (!parts) return false;
        if (parts.minute > 59 || parts.second > 59) return false;
        return meridiem ? parts.hour >= 1 && parts.hour <= 12 : parts.hour >= 0 && parts.hour <= 23;
    }

    function renderAbsoluteDigits(raw) {
        const parts = splitAbsoluteDigits(raw);
        if (!parts) return "";
        return `${parts.hour}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
    }

    function formatDateInput(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
        const pad = value => String(value).padStart(2, "0");
        return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function getTripMomentDefaults(value = new Date()) {
        const date = value instanceof Date
            ? new Date(value.getTime())
            : new Date(value);
        if (Number.isNaN(date.getTime())) return undefined;
        const milliseconds =
            (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +
            date.getMilliseconds();
        let time = formatTimelineMilliseconds(milliseconds);
        if (date.getMilliseconds() !== 0) {
            time += `.${String(date.getMilliseconds()).padStart(3, "0")}`;
        }
        return {
            creationTime: time,
            scheduledStart: time,
            startTime: time,
            creationDate: formatDateInput(date)
        };
    }

    function parseDateInput(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return undefined;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (
            date.getFullYear() !== Number(match[1]) ||
            date.getMonth() !== Number(match[2]) - 1 ||
            date.getDate() !== Number(match[3])
        ) return undefined;
        return date;
    }

    function shiftDateInput(value, days) {
        const date = parseDateInput(value);
        if (!date || !Number.isFinite(days)) return value;
        date.setDate(date.getDate() + days);
        return formatDateInput(date);
    }

    function getTripBaseDate() {
        return parseDateInput(clockTimer.creationDate) || new Date(new Date().setHours(0, 0, 0, 0));
    }

    function getAbsolutePadInitial(value, creationDate) {
        const milliseconds = parseTimelineTime(value);
        const base = parseDateInput(creationDate) || getTripBaseDate();
        const date = new Date(base.getTime() + (Number.isFinite(milliseconds) ? milliseconds : 0));
        const hour24 = date.getHours();
        const military = clockTimer.getAttribute("military-time") !== "false";
        const meridiem = military ? null : (hour24 >= 12 ? "PM" : "AM");
        const displayHour = meridiem ? (hour24 % 12 || 12) : hour24;
        return {
            digits: absoluteDigits(displayHour, date.getMinutes(), date.getSeconds()),
            date: formatDateInput(date),
            meridiem
        };
    }

    function absoluteHour24(state) {
        const parts = splitAbsoluteDigits(state.pending);
        if (!parts) return undefined;
        if (state.meridiem === "AM") return parts.hour === 12 ? 0 : parts.hour;
        if (state.meridiem === "PM") return parts.hour === 12 ? 12 : parts.hour + 12;
        return parts.hour;
    }

    function absoluteTimelineMilliseconds(state, { creation = false } = {}) {
        if (!absoluteDigitsValid(state.pending, state.meridiem)) return undefined;
        const date = parseDateInput(state.pendingDate);
        if (!date) return undefined;
        const hour = absoluteHour24(state);
        if (!Number.isFinite(hour)) return undefined;
        const parts = splitAbsoluteDigits(state.pending);
        const timeMilliseconds = ((hour * 60 + parts.minute) * 60 + parts.second) * 1000;
        if (creation) return timeMilliseconds;
        const base = parseDateInput(state.tripDefaults?.creationDate) || getTripBaseDate();
        const dayMilliseconds = date.getTime() - base.getTime();
        const result = dayMilliseconds + timeMilliseconds;
        return result >= 0 ? result : undefined;
    }

    function formatTimelineMilliseconds(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function formatTimelineDateTime(date, creationDate) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
        const base = parseDateInput(creationDate);
        if (!base) return undefined;
        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const timeMilliseconds =
            (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +
            date.getMilliseconds();
        const timelineMilliseconds = day.getTime() - base.getTime() + timeMilliseconds;
        const formatted = formatTimelineMilliseconds(timelineMilliseconds);
        if (!formatted) return undefined;
        return date.getMilliseconds() === 0
            ? formatted
            : `${formatted}.${String(date.getMilliseconds()).padStart(3, "0")}`;
    }

    function autocorrectAbsoluteState(state) {
        const parts = splitAbsoluteDigits(state.pending);
        if (!parts) return;
        let hour24;
        if (state.meridiem === "AM") hour24 = parts.hour % 12;
        else if (state.meridiem === "PM") hour24 = (parts.hour % 12) + 12;
        else hour24 = parts.hour;
        let totalSeconds = hour24 * 3600 + parts.minute * 60 + parts.second;
        const dayOffset = Math.floor(totalSeconds / 86400);
        totalSeconds = ((totalSeconds % 86400) + 86400) % 86400;
        const correctedHour24 = Math.floor(totalSeconds / 3600);
        const minute = Math.floor((totalSeconds % 3600) / 60);
        const second = totalSeconds % 60;
        state.pendingDate = shiftDateInput(state.pendingDate, dayOffset);
        if (state.meridiem) {
            state.meridiem = correctedHour24 >= 12 ? "PM" : "AM";
            state.pending = absoluteDigits(correctedHour24 % 12 || 12, minute, second);
        }
        else {
            state.pending = absoluteDigits(correctedHour24, minute, second);
        }
    }

    function normalizePercentDigits(value) {
        const match = String(value || "").trim().match(/^(\d+)(?:%)?$/);
        return match ? String(Number(match[1])) : "";
    }

    function getNumberPadTitle(source) {
        const titles = {
            "new-trip": "Standard Time",
            "standard-time": "Standard Time",
            "creation-time": "Creation Time",
            "scheduled-start": "Scheduled Start",
            "actual-start": "Actual Start"
        };
        if (source === "percent-goal") {
            return clockTimer.percentMode === "total" ? "Total Percent" : "Trip Percent";
        }
        return titles[source] || "Number Pad";
    }

    function numberPadValueValid() {
        if (!numberPadState || !numberPadState.pending) return false;
        if (numberPadState.mode === "percent") {
            return Number.isInteger(Number(numberPadState.pending)) && Number(numberPadState.pending) > 0;
        }
        if (numberPadState.mode === "absolute") {
            return Boolean(numberPadState.pendingDate) && absoluteDigitsValid(numberPadState.pending, numberPadState.meridiem);
        }
        return timeDigitsValid(numberPadState.pending);
    }

    function numberPadHasChanges() {
        if (!numberPadState) return false;
        return numberPadState.pending !== numberPadState.initial ||
            numberPadState.pendingDate !== numberPadState.initialDate ||
            numberPadState.meridiem !== numberPadState.initialMeridiem;
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges()) return "reset";
        return peekUIReturnFrame() ? "back" : "close";
    }

    function refreshNumberPad() {
        if (!numberPadState || !numberPadDialog) return;
        const percentMode = numberPadState.mode === "percent";
        const absoluteMode = numberPadState.mode === "absolute";
        numberPadContext.textContent = numberPadState.title;
        numberPadReadout.classList.toggle("absolute-mode", absoluteMode);
        numberPadDisplay.textContent = percentMode
            ? (numberPadState.pending ? `${Number(numberPadState.pending)}%` : "---")
            : absoluteMode
                ? (numberPadState.pending ? renderAbsoluteDigits(numberPadState.pending) : "---")
                : (numberPadState.pending ? renderTimeDigits(numberPadState.pending) : "---");

        numberPadDateRow.hidden = !absoluteMode;
        numberPadAM.hidden = !absoluteMode;
        numberPadPM.hidden = !absoluteMode;
        if (absoluteMode) {
            numberPadDate.value = numberPadState.pendingDate || "";
            numberPadAM.classList.toggle("is-selected", numberPadState.meridiem === "AM");
            numberPadPM.classList.toggle("is-selected", numberPadState.meridiem === "PM");
            numberPadAM.setAttribute("aria-pressed", String(numberPadState.meridiem === "AM"));
            numberPadPM.setAttribute("aria-pressed", String(numberPadState.meridiem === "PM"));
        }

        const changed = numberPadHasChanges();
        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute(
            "aria-label",
            clearAction === "reset"
                ? "Reset"
                : clearAction === "back"
                    ? "Back"
                    : "Close"
        );

        const valid = numberPadValueValid();
        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;
        const startsTrip = Boolean(numberPadState.startsTripOnConfirm);
        const confirmAction = autocorrect ? "autocorrect" : startsTrip ? "start" : "confirm";
        numberPadConfirm.dataset.action = confirmAction;
        numberPadConfirm.setAttribute(
            "aria-label",
            autocorrect ? "Auto-Correct" : startsTrip ? "Start Trip" : "Confirm"
        );
        numberPadConfirm.disabled = autocorrect
            ? false
            : startsTrip
                ? !valid
                : (!changed || !valid);

        numberPadSettingsArea.hidden = percentMode;
        if (!percentMode) {
            const status = numberPadState.persistence || normalizedConnectionStatus();
            numberPadSettingsArea.dataset.persistence = status;
            numberPadSettings.setAttribute("aria-label", "Trip settings");
            numberPadConnection.setAttribute(
                "aria-label",
                status === "pending"
                    ? "Checking connection"
                    : status === "online"
                        ? "Connected"
                        : "Offline. Retry connection"
            );
            numberPadConnection.setAttribute("aria-busy", String(status === "pending"));
            numberPadConnection.setAttribute("aria-disabled", String(status !== "offline"));
        }
    }

    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, tripDefaults, startsTripOnConfirm = false, duration = 250 } = {}) {
        await ensureNumberPadLoaded();
        const normalizedMode = mode === "percent" ? "percent" : mode === "absolute" ? "absolute" : "duration";
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
            connectionStatusToken: ++numberPadConnectionSequence,
            tripDefaults,
            startsTripOnConfirm: Boolean(startsTripOnConfirm)
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

    async function restoreNumberPadState(snapshot, { duration = 0 } = {}) {
        if (!snapshot) return;
        await ensureNumberPadLoaded();
        numberPadState = { ...snapshot };
        refreshNumberPad();
        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration,
                reason: "trip-settings-return"
            });
        }
    }

    function resetNumberPad() {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        numberPadState = undefined;
        if (numberPadDisplay) numberPadDisplay.textContent = "";
        if (numberPadContext) numberPadContext.textContent = "Number Pad";
        if (numberPadDate) numberPadDate.value = "";
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

    async function closeNumberPad({
        discardPrepared = true,
        allowChanged = false,
        immediate = false,
        returnToCaller = true
    } = {}) {
        const state = numberPadState;
        if (!allowChanged && numberPadHasChanges()) return false;
        const caller = returnToCaller ? peekUIReturnFrame() : undefined;

        if (caller && !await restoreUIReturnFrame(caller, "number-pad-return")) {
            return false;
        }

        if (numberPadDialog?.open && !closeDialog(numberPadDialog, {
            reason: "number-pad",
            immediate: immediate || Boolean(caller)
        })) {
            return false;
        }

        if (caller) popUIReturnFrame(caller);
        if (discardPrepared && state?.source === "new-trip") {
            tripDraft = undefined;
            uiReturnStack.length = 0;
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
        return true;
    }

    async function requestNumberPadClose() {
        return closeNumberPad();
    }

    function getPercentGoalValue() {
        const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
        const raw = clockTimer.getAttribute(attribute);
        if (raw) return raw;
        const goal = Number(clockTimer.renderedPercentGoal);
        return Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : "100%";
    }

    async function commitNumberPad() {
        if (!numberPadState || !numberPadValueValid()) return false;
        const state = { ...numberPadState };
        if (!numberPadHasChanges() && !state.startsTripOnConfirm) return false;
        if (state.mode === "percent") {
            const percent = Number(state.pending);
            const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
            clockTimer.setAttribute(attribute, `${percent}%`);
            return true;
        }

        if (state.mode === "absolute") {
            if (!tripIsLive() && state.tripDefaults) {
                if (state.source === "creation-time") {
                    const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));
                    if (!value) return false;
                    state.tripDefaults.creationTime = value;
                    state.tripDefaults.creationDate = state.pendingDate;
                    return true;
                }

                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state));
                if (!value) return false;
                if (state.source === "scheduled-start") {
                    state.tripDefaults.scheduledStart = value;
                    return true;
                }
                if (state.source === "actual-start") {
                    state.tripDefaults.startTime = value;
                    return true;
                }
            }

            if (state.source === "creation-time") {
                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));
                if (!value) return false;
                if (state.pendingDate !== clockTimer.creationDate) {
                    clockTimer.creationDate = state.pendingDate;
                    if (clockTimer.creationDate !== state.pendingDate) return false;
                }
                clockTimer.creationTime = value;
                return clockTimer.creationTime === value;
            }

            const timeline = absoluteTimelineMilliseconds(state);
            const value = formatTimelineMilliseconds(timeline);
            if (!value) return false;
            if (state.source === "scheduled-start") {
                clockTimer.scheduledStart = value;
                return clockTimer.scheduledStart === value;
            }
            if (state.source === "actual-start") {
                clockTimer.startTime = value;
                return clockTimer.startTime === value;
            }
            return false;
        }

        const formatted = renderTimeDigits(state.pending);
        if (!formatted) return false;
        stagedStandardTime = formatted;

        if (!tripIsLive() && tripDraft) {
            tripDraft.standardTime = formatted;
            if (state.source === "standard-time") {
                syncDraftStandardTimeReturnFrame(formatted);
            }
            if (state.startsTripOnConfirm) {
                return startTripDraft();
            }
            return true;
        }

        if (state.startsTripOnConfirm) {
            tripDraft = {
                ...(state.tripDefaults || {}),
                standardTime: formatted
            };
            return startTripDraft();
        }

        if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
            if (clockTimer.standardTime !== formatted) return false;
        }
        return true;
    }

    function resetNumberPadPendingValue() {
        if (!numberPadState) return;
        numberPadState.pending = numberPadState.initial;
        numberPadState.pendingDate = numberPadState.initialDate;
        numberPadState.meridiem = numberPadState.initialMeridiem;
        numberPadState.replaceOnNextDigit = numberPadState.source !== "new-trip";
        refreshNumberPad();
    }

    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        const action = getNumberPadClearAction();
        if (action === "close" || action === "back") {
            void requestNumberPadClose().catch(() => {});
            return;
        }
        resetNumberPadPendingValue();
    }

    function changeNumberPadMeridiem(next) {
        if (!numberPadState || numberPadState.mode !== "absolute") return;
        const parts = splitAbsoluteDigits(numberPadState.pending);
        if (!parts) return;
        const previous = numberPadState.meridiem;
        const target = previous === next ? null : next;
        let hour = parts.hour;
        if (previous && !target) {
            hour = previous === "AM"
                ? (hour === 12 ? 0 : hour)
                : (hour === 12 ? 12 : hour + 12);
        }
        else if (!previous && target && hour > 12) {
            hour = hour % 12 || 12;
        }
        numberPadState.meridiem = target;
        numberPadState.pending = absoluteDigits(hour, parts.minute, parts.second);
        numberPadState.replaceOnNextDigit = false;
        refreshNumberPad();
    }

    function formatTripTimeDisplay(value, creationDate) {
        const milliseconds = parseTimelineTime(value);
        if (!Number.isFinite(milliseconds)) return "---";
        const base = parseDateInput(creationDate) || getTripBaseDate();
        const date = new Date(base.getTime() + milliseconds);
        const military = clockTimer.getAttribute("military-time") !== "false";
        const time = military
            ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`
            : `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")} ${date.getHours() >= 12 ? "PM" : "AM"}`;
        const dateText = new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(date);
        return `${time} · ${dateText}`;
    }

    function getTripSettingsPadSnapshot() {
        return findUIReturnFrame("number-pad")?.state;
    }

    function getTripSettingsPendingField(snapshot = getTripSettingsPadSnapshot()) {
        if (!snapshot) return undefined;
        if (snapshot.source === "new-trip" || snapshot.source === "standard-time") {
            return "standard-time";
        }
        if (["creation-time", "scheduled-start", "actual-start"].includes(snapshot.source)) {
            return snapshot.source;
        }
        return undefined;
    }

    function formatTripSettingsPendingValue(snapshot) {
        if (!snapshot) return "---";
        if (snapshot.mode === "absolute") {
            const parts = splitAbsoluteDigits(snapshot.pending);
            const date = parseDateInput(snapshot.pendingDate);
            if (!parts || !date) return "---";
            const time = snapshot.meridiem
                ? `${parts.hour}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")} ${snapshot.meridiem}`
                : `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
            const dateText = new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
            }).format(date);
            return `${time} · ${dateText}`;
        }
        if (snapshot.mode === "duration") {
            return snapshot.pending ? renderTimeDigits(snapshot.pending) : "---";
        }
        return "---";
    }

    function tripIsLive() {
        return app.dataset.tripState === "running";
    }

    function syncDraftStandardTimeReturnFrame(formatted) {
        const frame = findUIReturnFrame("number-pad");
        if (!frame?.state || frame.state.source !== "new-trip") return;
        const digits = normalizeTimeDigits(formatted);
        frame.state.initial = digits;
        frame.state.pending = digits;
        frame.state.replaceOnNextDigit = false;
        frame.state.startsTripOnConfirm = true;
    }

    function tripDraftCanStart(draft = tripDraft) {
        if (!draft || !parseDateInput(draft.creationDate)) return false;
        const standardTime = parseTimelineTime(draft.standardTime);
        const creationTime = parseTimelineTime(draft.creationTime);
        const scheduledStart = parseTimelineTime(draft.scheduledStart);
        const actualStart = parseTimelineTime(draft.startTime);
        return (
            Number.isFinite(standardTime) && standardTime > 0 &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 24 * 60 * 60 * 1000 &&
            Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
            Number.isFinite(actualStart) && actualStart >= 0
        );
    }

    async function startTripDraft() {
        const draft = tripDraft;
        const standardTime = String(draft?.standardTime || "").trim();
        if (!tripDraftCanStart(draft)) return false;

        clockTimer.autoSyncTripGoal = Boolean(draft.matchTripGoalToTotal);
        clockTimer.intervalElapsedBehavior = "startLatency";
        clockTimer.autoRestartTripAfterLateBreak =
            draft.lateBreakBehavior === "autoRestartTrip";

        await clockTimer.start({
            standardTime,
            creationTime: draft.creationTime,
            scheduledStart: draft.scheduledStart,
            startTime: draft.startTime
        });
        if (draft.creationDate && clockTimer.creationDate !== draft.creationDate) {
            clockTimer.creationDate = draft.creationDate;
        }

        stagedStandardTime = standardTime;
        tripDraft = undefined;
        uiReturnStack.length = 0;
        return true;
    }

    function refreshTripSettingsValues() {
        syncTripSettingsCloud();
        const live = tripIsLive();
        const draft = !live ? tripDraft : undefined;
        const values = {
            "creation-time": live
                ? formatTripTimeDisplay(clockTimer.creationTime, clockTimer.creationDate)
                : draft
                    ? formatTripTimeDisplay(draft.creationTime, draft.creationDate)
                    : "---",
            "scheduled-start": live
                ? formatTripTimeDisplay(clockTimer.scheduledStart, clockTimer.creationDate)
                : draft
                    ? formatTripTimeDisplay(draft.scheduledStart, draft.creationDate)
                    : "---",
            "actual-start": live
                ? formatTripTimeDisplay(clockTimer.startTime, clockTimer.creationDate)
                : draft
                    ? formatTripTimeDisplay(draft.startTime, draft.creationDate)
                    : "---",
            "standard-time": live
                ? (clockTimer.standardTime || "---")
                : (draft?.standardTime || "---")
        };

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            button.disabled = !live && !draft;
        });
        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";
        tripSetStartsNow.hidden = !draft;
        tripSetStartsNow.disabled = Boolean(draft && !parseDateInput(draft.creationDate));
        const preferencesVisible = Boolean(draft || live);
        tripSettingsPreferences.hidden = !preferencesVisible;
        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;
        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;
        const selectedGoalSync = draft
            ? Boolean(draft.matchTripGoalToTotal)
            : live
                ? Boolean(clockTimer.autoSyncTripGoal)
                : Boolean(getTripPreferences().matchTripGoalToTotal);
        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;
        autoSyncTripGoal.checked = selectedGoalSync;
        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);
        tripGoalSyncNoData.hidden = aggregateGoalAvailable;
        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";
        tripSettingsPrimary.value = draft ? "start" : "save";
        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanStart(draft));
    }

    function openTripSettingsDialog(reason = "number-pad-settings", { duration = 250 } = {}) {
        refreshTripSettingsValues();
        return openDialogElement(tripSettingsDialog, { duration, reason });
    }

    function getTripFieldValue(field) {
        const draft = !tripIsLive() ? tripDraft : undefined;
        if (field === "creation-time") return draft?.creationTime || clockTimer.creationTime || "";
        if (field === "scheduled-start") return draft?.scheduledStart || clockTimer.scheduledStart || "";
        if (field === "actual-start") return draft?.startTime || clockTimer.startTime || "";
        if (field === "standard-time") return draft?.standardTime || clockTimer.standardTime || "";
        return "";
    }

    function openTripFieldNumberPad(field) {
        if (!tripIsLive() && !tripDraft) return Promise.resolve();
        const absolute = field !== "standard-time";
        return openNumberPad({
            mode: absolute ? "absolute" : "time",
            source: field,
            initialValue: getTripFieldValue(field),
            tripDefaults: !tripIsLive() ? tripDraft : undefined,
            startsTripOnConfirm: false,
            duration: 0
        });
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                const candidate = numberPadState.pending + button.dataset.number;
                if (numberPadState.mode === "absolute" && candidate.length > 6) return;
                numberPadState.pending = candidate;
                refreshNumberPad();
            });
        });

        [numberPadAM, numberPadPM].forEach(button => {
            button.addEventListener("pointerup", () => changeNumberPadMeridiem(button.dataset.meridiem));
        });

        numberPadDate.addEventListener("input", () => {
            if (!numberPadState || numberPadState.mode !== "absolute") return;
            numberPadState.pendingDate = numberPadDate.value;
            refreshNumberPad();
        });

        numberPadConfirm.addEventListener("pointerup", async () => {
            if (!numberPadState || numberPadConfirm.disabled) return;
            if (numberPadConfirm.dataset.action === "autocorrect") {
                if (numberPadState.mode === "absolute") autocorrectAbsoluteState(numberPadState);
                else numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                numberPadState.replaceOnNextDigit = false;
                refreshNumberPad();
                return;
            }
            try {
                if (await commitNumberPad()) {
                    await closeNumberPad({ discardPrepared: false, allowChanged: true });
                }
            }
            catch {
                if (numberPadState) {
                    numberPadState.persistence = "offline";
                    refreshNumberPad();
                }
            }
        });

        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "reset") return;
            const now = performance.now();
            const doublePress = now - numberPadLastClearPointerDown <= NUMBER_PAD_DOUBLE_PRESS;
            numberPadLastClearPointerDown = now;
            numberPadLongPressed = false;
            numberPadClear.setPointerCapture?.(event.pointerId);
            clearTimeout(numberPadLongPressTimer);
            if (doublePress) {
                numberPadLongPressed = true;
                resetNumberPadPendingValue();
                return;
            }
            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                resetNumberPadPendingValue();
            }, NUMBER_PAD_LONG_PRESS);
        });

        numberPadClear.addEventListener("pointerup", event => {
            if (numberPadClear.hasPointerCapture?.(event.pointerId)) numberPadClear.releasePointerCapture(event.pointerId);
            if (numberPadLongPressTimer !== undefined) {
                clearTimeout(numberPadLongPressTimer);
                numberPadLongPressTimer = undefined;
            }
            if (numberPadLongPressed) {
                numberPadLongPressed = false;
                return;
            }
            runNumberPadClearShortAction();
        });

        numberPadClear.addEventListener("pointercancel", () => {
            clearTimeout(numberPadLongPressTimer);
            numberPadLongPressTimer = undefined;
            numberPadLongPressed = false;
        });

        numberPadClear.addEventListener("click", event => {
            if (event.detail === 0) runNumberPadClearShortAction();
        });

        numberPadConnection.addEventListener("click", () => {
            if (
                !numberPadState ||
                numberPadState.mode === "percent" ||
                numberPadSettingsArea.dataset.persistence !== "offline"
            ) return;
            void resumeConnectionFromCloud({ numberPad: true }).catch(() => {});
        });

        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            if (tripDraft && numberPadState.source === "new-trip" && numberPadValueValid()) {
                const formatted = renderTimeDigits(numberPadState.pending);
                if (formatted) tripDraft.standardTime = formatted;
            }
            const caller = captureNumberPadReturnFrame();
            if (!caller) return;
            pushUIReturnFrame(caller);

            if (!openTripSettingsDialog("number-pad-settings", { duration: 0 })) {
                popUIReturnFrame(caller);
                return;
            }

            void closeNumberPad({
                discardPrepared: false,
                allowChanged: true,
                immediate: true,
                returnToCaller: false
            }).then(closed => {
                if (closed) return;
                popUIReturnFrame(caller);
                closeDialog(tripSettingsDialog, {
                    reason: "number-pad-settings:rollback",
                    immediate: true
                });
            }).catch(() => {
                popUIReturnFrame(caller);
            });
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            void requestNumberPadClose().catch(() => {});
        });

        numberPadDialog.addEventListener("close", () => {
            resetNumberPad();
        });


    }

    tripSettingsDialog.addEventListener("opening", () => {
        refreshTripSettingsValues();
    });

    tripSettingsCloud.addEventListener("click", () => {
        if (tripSettingsCloud.dataset.networkStatus !== "offline") return;
        void resumeConnectionFromCloud().catch(() => {});
    });

    tripSettingsForm.elements.autoSyncTripGoal.addEventListener("change", event => {
        const checked = event.currentTarget.checked;
        if (tripDraft && !tripIsLive()) {
            tripDraft.matchTripGoalToTotal = checked;
        }
        else if (tripIsLive()) {
            clockTimer.autoSyncTripGoal = checked;
        }
    });

    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;
            const caller = { type: "dialog", element: tripSettingsDialog };
            pushUIReturnFrame(caller);

            void (async () => {
                try {
                    await openTripFieldNumberPad(field);
                    if (!numberPadDialog?.open) {
                        popUIReturnFrame(caller);
                        return;
                    }
                    if (!closeDialog(tripSettingsDialog, {
                        reason: `trip-settings:${field}`,
                        immediate: true
                    })) {
                        popUIReturnFrame(caller);
                        await closeNumberPad({
                            discardPrepared: false,
                            allowChanged: true,
                            immediate: true,
                            returnToCaller: false
                        });
                    }
                }
                catch {
                    popUIReturnFrame(caller);
                }
            })();
        });
    });

    tripSetStartsNow.addEventListener("pointerup", () => {
        if (!tripDraft || tripIsLive()) return;
        const now = new Date();
        const value = formatTimelineDateTime(now, tripDraft.creationDate);
        if (!value) return;
        tripDraft.scheduledStart = value;
        tripDraft.startTime = value;
        refreshTripSettingsValues();
    });

    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (tripDraft && !tripIsLive()) {
            tripDraft.matchTripGoalToTotal = form.elements.autoSyncTripGoal.checked;
        }
        else if (tripIsLive()) {
            clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;
        }

        void (async () => {
            if (tripDraft && !tripIsLive()) {
                if (!await startTripDraft()) {
                    refreshTripSettingsValues();
                    return;
                }
                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });
                return;
            }

            await closeDialogWithReturn(tripSettingsDialog, {
                reason: "trip-settings-save"
            });
        })().catch(() => {});
    });

    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        uiReturnStack.length = 0;
        const moment = tripMoment instanceof Date && !Number.isNaN(tripMoment.getTime())
            ? new Date(tripMoment.getTime())
            : new Date();
        const tripDefaults = getTripMomentDefaults(moment);
        const tripPreferences = getTripPreferences();
        const newTripInitialValue = initialValue ?? (
            clockTimer.status === "stopped"
                ? ""
                : (stagedStandardTime || "")
        );
        tripDraft = {
            ...tripDefaults,
            standardTime: newTripInitialValue || "",
            lateBreakBehavior: tripPreferences.lateBreakBehavior,
            matchTripGoalToTotal: tripPreferences.matchTripGoalToTotal
        };

        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000, at: moment })
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
            initialValue: newTripInitialValue,
            preparationPromise,
            tripDefaults: tripDraft,
            startsTripOnConfirm: true
        });
    }

    $("#newTripButton").addEventListener("pointerup", () => {
        void beginNewTripWorkflow({ tripMoment: new Date() }).catch(() => {});
    });

    endTripButton.addEventListener("pointerup", () => {
        void endCurrentIntervalOrTrip().catch(() => {});
    });

    breakButton.addEventListener("pointerup", () => {
        openDialog("breakDialog", { reason: "break" });
    });

    downButton.addEventListener("pointerup", () => {
        void clockTimer.startInterval("down").then(result => {
            if (result) renderTripActionState();
        }).catch(() => {});
    });

    breakDialog.querySelectorAll("[data-break-type]").forEach(button => {
        button.addEventListener("pointerup", () => {
            void (async () => {
                if (!await startBreakInterval(button.dataset.breakType)) return;
                closeDialog(breakDialog, { reason: "break-type-selected" });
            })().catch(() => {});
        });
    });

    $("#standardTimeButton").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
    });

    $("#goalPercentValue").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        }).catch(() => {});
    });

    function renderIndependentTimer() {
        const active = timerStartedAt ? Date.now() - timerStartedAt : 0;
        $("#independentTimerValue").value = formatDuration(timerAccumulated + active);
    }

    $("#independentStart").addEventListener("click", () => {
        if (timerStartedAt) return;
        timerStartedAt = Date.now();
        timerInterval = setInterval(renderIndependentTimer, 250);
        renderIndependentTimer();
    });

    $("#independentStop").addEventListener("click", () => {
        if (!timerStartedAt) return;
        timerAccumulated += Date.now() - timerStartedAt;
        timerStartedAt = 0;
        clearInterval(timerInterval);
        renderIndependentTimer();
    });

    $("#independentReset").addEventListener("click", () => {
        timerStartedAt = 0;
        timerAccumulated = 0;
        clearInterval(timerInterval);
        $("#independentTimerValue").value = "---";
    });

    function formatIntervalClock(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function renderTripActionState(now = new Date()) {
        if (!tripIsLive()) {
            app.dataset.intervalState = "none";
            endTripButton.textContent = "End Trip";
            tripActionRow.hidden = false;
            breakButton.hidden = false;
            downButton.hidden = false;
            return;
        }

        const instant = now instanceof Date && !Number.isNaN(now.getTime())
            ? now
            : new Date();
        const interval = clockTimer.getActiveIntervalState?.(instant);
        const intervalType = String(interval?.intervalType || "").toLowerCase();

        if (intervalType === "down") {
            app.dataset.intervalState = "down";
            endTripButton.textContent =
                `Resume Trip : ${formatIntervalClock(interval.elapsedMilliseconds)}`;
            tripActionRow.hidden = false;
            breakButton.hidden = false;
            downButton.hidden = true;
            return;
        }

        if (intervalType === "break" || intervalType === "lunch") {
            app.dataset.intervalState = "break";
            const label = intervalType === "lunch" ? "Lunch" : "Break";
            endTripButton.textContent =
                `End ${label} : ${formatIntervalClock(interval.remainingMilliseconds)}`;
            tripActionRow.hidden = true;
            breakButton.hidden = true;
            downButton.hidden = true;
            return;
        }

        app.dataset.intervalState = "normal";
        endTripButton.textContent = "End Trip";
        tripActionRow.hidden = false;
        breakButton.hidden = false;
        downButton.hidden = false;
    }

    async function endCurrentIntervalOrTrip() {
        const interval = clockTimer.getActiveIntervalState?.(new Date());
        const intervalType = String(interval?.intervalType || "").toLowerCase();

        if (["break", "lunch", "down"].includes(intervalType)) {
            await clockTimer.endInterval();
            renderTripActionState();
            return;
        }

        const tripMoment = new Date();
        await clockTimer.stop();
        await clockTimer.clear();
        await beginNewTripWorkflow({
            initialValue: "",
            tripMoment
        });
    }

    async function startBreakInterval(kind) {
        const configs = {
            break: { type: "break", length: "0:15:00", attributes: { breakType: "break" } },
            lunch: { type: "lunch", length: "0:30:00", attributes: { breakType: "lunch" } },
            "short-break": { type: "break", length: "0:10:00", attributes: { breakType: "short" } }
        };
        const config = configs[kind];
        if (!config) return false;

        const active = clockTimer.getActiveIntervalState?.(new Date());
        if (String(active?.intervalType || "").toLowerCase() === "down") {
            await clockTimer.endInterval();
        }

        const result = await clockTimer.startInterval(
            config.type,
            config.length,
            config.attributes,
            "0:02:30",
            "0:02:30"
        );
        if (result) renderTripActionState();
        return Boolean(result);
    }

    function setTripControlState(running) {
        app.dataset.tripState = running ? "running" : "ready";
        app.dataset.state = clockTimer.status;
        activeTripControls.hidden = !running;
        renderTripActionState();
    }

    clockTimer.addEventListener("cadenceTick", event => {
        updateSummaryValues(event.detail?.summary);
        renderTripActionState(event.detail?.now);
    });

    clockTimer.addEventListener("started", event => {
        setTripControlState(true);
        updateSummaryValues(event.detail?.summary);
    });


    clockTimer.addEventListener("downTimeStarted", () => {
        renderTripActionState();
    });

    clockTimer.addEventListener("tripAutomaticallyRestarted", () => {
        setTripControlState(true);
        renderTripActionState();
    });

    clockTimer.addEventListener("intervalStarted", () => {
        renderTripActionState();
    });

    clockTimer.addEventListener("intervalEnded", () => {
        renderTripActionState();
    });

    const summaryRefreshEvents = [
        "cleared",
        "goalChanged",
        "renderedPercentGoalChanged",
        "standardTimeChanged",
        "creationDateChanged",
        "creationTimeChanged",
        "scheduledStartChanged",
        "startTimeChanged",
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
        stagedStandardTime = undefined;
        updateSummaryValues();
    });

    clockTimer.addEventListener("percentModeChanged", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
    });

    clockTimer.addEventListener("renderedTimeModeChanged", () => {
        safeStorageSet(STORAGE.renderedTimeMode, clockTimer.renderedTimeMode);
        queueSummaryRefresh();
    });

    clockTimer.addEventListener("networkStatusChanged", () => {
        syncNetworkStatusUI({ login: loginPending });
        queueSummaryRefresh();
    });

    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    fillTripPreferencesForm(tripPreferences);
    clockTimer.intervalElapsedBehavior = "startLatency";
    clockTimer.autoRestartTripAfterLateBreak =
        tripPreferences.lateBreakBehavior === "autoRestartTrip";
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);
    applyRenderedTimeMode(safeStorageGet(STORAGE.renderedTimeMode) || "remaining", false);
    updateSummaryValues();
    syncNetworkStatusUI({ startup: true });
})();
