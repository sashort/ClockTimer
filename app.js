(() => {
    "use strict";

    const API_BASE = "https://wmof.sashort-apps.com/";
    const GRAPHICAL_SETTINGS_VERSION = 4;
    const STORAGE = {
        percentMode: "wmof.clock.percentMode",
        renderedTimeMode: "wmof.clock.renderedTimeMode",
        graphicalSettings: "wmof.clock.graphicalSettings",
        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion"
    };

    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
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

    let timerStartedAt = 0;
    let timerAccumulated = 0;
    let timerInterval;
    let loginPromptTimeout;
    let grayscaleReleaseTimeout;
    let loginPending = false;
    let stagedStandardTime;
    let numberPadState;
    let numberPadLoadPromise;
    let numberPadDialog;
    let numberPadDisplay;
    let numberPadSettings;
    let numberPadClear;
    let numberPadConfirm;
    let numberPadLongPressTimer;
    let numberPadLongPressed = false;
    let numberPadLastClearPointerDown = 0;

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

    function showInitialLoginDialog() {
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

    function setOffline(offline, { login = false, startup = false } = {}) {
        clearTimeout(loginPromptTimeout);
        clearTimeout(grayscaleReleaseTimeout);
        loginPromptTimeout = undefined;
        grayscaleReleaseTimeout = undefined;

        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");
        syncConnectionUI(!offline);

        if (offline) {
            app.style.setProperty("--app-grayscale-ramp", `${STARTUP_GRAYSCALE_RAMP}ms`);
            app.classList.add("is-offline");
            loginPromptTimeout = setTimeout(() => {
                loginPromptTimeout = undefined;
                if (!clockTimer.connected && !loginDialog.open) showInitialLoginDialog();
            }, STARTUP_CONNECTION_DELAY);
            return;
        }

        if (loginDialog.open) closeDialog(loginDialog);
        if (!app.classList.contains("is-offline")) return;

        const ramp = login ? LOGIN_GRAYSCALE_RAMP : STARTUP_GRAYSCALE_RAMP;
        const delay = startup ? STARTUP_CONNECTION_DELAY : 0;
        app.style.setProperty("--app-grayscale-ramp", `${ramp}ms`);

        grayscaleReleaseTimeout = setTimeout(() => {
            grayscaleReleaseTimeout = undefined;
            if (!clockTimer.connected) return;
            requestAnimationFrame(() => app.classList.remove("is-offline"));
        }, delay);
    }

    function syncScopeUI(persist = false) {
        const actual = clockTimer.percentMode === "total" ? "total" : "trip";
        $("#scopeToggle").textContent = actual === "total" ? "Total" : "Trip";
        updateSummaryLabels();
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

    function updateSummaryValues() {
        const standard = clockTimer.standardTime || stagedStandardTime;
        $("#standardTimeValue").textContent = typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent =
            ["running", "stopped"].includes(clockTimer.status)
                ? (clockTimer.renderedTime || "---")
                : "---";
        const goal = Number(clockTimer.renderedPercentGoal);
        $("#goalPercentValue").textContent = Number.isFinite(goal) ? `${Math.round(goal * 100)}%` : "100%";
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

    function openDialog(id) {
        const dialog = document.getElementById(id);
        if (dialog && !dialog.open) dialog.showModal();
        $("#mainMenu")?.hidePopover?.();
    }

    $("#scopeToggle").addEventListener("click", () => {
        applyScope(clockTimer.percentMode === "total" ? "trip" : "total");
    });

    $("#renderedTimeButton").addEventListener("click", () => {
        const index = RENDERED_TIME_MODES.indexOf(clockTimer.renderedTimeMode);
        applyRenderedTimeMode(RENDERED_TIME_MODES[(index + 1) % RENDERED_TIME_MODES.length]);
    });

    clockTimer.addEventListener("pointerdown", () => {
        if (clockTimer.getAttribute("timer-type") !== "radial-overflow") return;
        clockTimer.setAttribute("timer-type", "radial-fitted");
        const settings = getGraphicalSettings();
        settings.timerType = "radial-fitted";
        saveGraphicalSettings(settings);
    });

    document.querySelectorAll("[data-dialog]").forEach(button => {
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

    $("#graphicalSettingsForm").addEventListener("input", event => {
        if (event.target.name === "militaryTime") syncTimeFormatForMilitaryToggle(event.currentTarget);
        if (event.target.matches("input, select")) applyGraphicalSettings(settingsFromForm(event.currentTarget), clockPreview);
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const settings = settingsFromForm(event.currentTarget);
        applyGraphicalSettings(settings);
        saveGraphicalSettings(settings);
        closeDialog(graphicalDialog);
    });

    $("#resetGraphicalSettings").addEventListener("click", () => fillGraphicalForm({ ...GRAPHICAL_DEFAULTS }));

    $("#stateSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;
        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;
        closeDialog(stateDialog);
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
            setOffline(false, { login: true });
        }
        catch (failure) {
            error.textContent = failure?.message || "Unable to login.";
        }
        finally {
            loginPending = false;
        }
    });

    authButton.addEventListener("click", async () => {
        $("#mainMenu")?.hidePopover?.();
        if (!clockTimer.connected) {
            clearTimeout(loginPromptTimeout);
            loginPromptTimeout = undefined;
            if (!loginDialog.open) loginDialog.showModal();
            return;
        }
        try { await clockTimer.disconnect(); }
        finally { setOffline(true); }
    });

    $("#newUserButton").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("wmof:new-user-request", { detail: { apiBase: API_BASE } }));
    });

    $("#profileForm").addEventListener("submit", event => {
        event.preventDefault();
        closeDialog(profileDialog);
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
                numberPadSettings = $("#numberPadSettings");
                numberPadClear = $("#numberPadClear");
                numberPadConfirm = $("#numberPadConfirm");
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
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
        if (!match) return "";
        const hours = match[1] || "";
        const minutes = match[2];
        const seconds = match[3];
        return hours ? `${hours}${minutes.padStart(2, "0")}${seconds}` : `${minutes}${seconds}`;
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

    function normalizePercentDigits(value) {
        const match = String(value || "").trim().match(/^(\d+)(?:%)?$/);
        return match ? String(Number(match[1])) : "";
    }

    function numberPadValueValid() {
        if (!numberPadState || !numberPadState.pending) return false;
        if (numberPadState.mode === "percent") {
            return Number.isInteger(Number(numberPadState.pending)) && Number(numberPadState.pending) > 0;
        }
        return timeDigitsValid(numberPadState.pending);
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadState.pending === "" || numberPadState.pending === numberPadState.initial
            ? "close"
            : "clear";
    }

    function refreshNumberPad() {
        if (!numberPadState || !numberPadDialog) return;
        const percentMode = numberPadState.mode === "percent";
        numberPadDisplay.textContent = percentMode
            ? (numberPadState.pending ? `${Number(numberPadState.pending)}%` : "")
            : (numberPadState.pending ? renderTimeDigits(numberPadState.pending) : "");

        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "clear" ? "Clear" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !autocorrect && !valid;

        const header = numberPadDialog.querySelector(".number-pad-header");
        header?.classList.toggle("percent-mode", percentMode);
        numberPadSettings.hidden = percentMode;
        if (!percentMode) {
            numberPadSettings.dataset.persistence = numberPadState.persistence || (clockTimer.connected ? "online" : "offline");
            numberPadSettings.setAttribute(
                "aria-label",
                numberPadSettings.dataset.persistence === "pending"
                    ? "Number pad settings; trip persistence pending"
                    : numberPadSettings.dataset.persistence === "online"
                        ? "Number pad settings; trip persisted online"
                        : "Number pad settings; trip local and not persisted"
            );
        }
    }

    async function openNumberPad({ mode, source, initialValue = "", preparationPromise } = {}) {
        await ensureNumberPadLoaded();
        const initial = mode === "percent"
            ? normalizePercentDigits(initialValue)
            : normalizeTimeDigits(initialValue);
        const locked = source === "standard-time" && typeof clockTimer.standardTime === "string" && clockTimer.standardTime !== "";
        const state = {
            mode,
            source,
            initial,
            pending: initial,
            locked,
            persistence: source === "new-trip"
                ? (clockTimer.connected ? "pending" : "offline")
                : (clockTimer.connected ? "online" : "offline")
        };
        numberPadState = state;
        refreshNumberPad();
        $("#mainMenu")?.hidePopover?.();
        if (!numberPadDialog.open) numberPadDialog.showModal();

        if (preparationPromise) {
            Promise.resolve(preparationPromise).then(result => {
                if (numberPadState !== state) return;
                state.persistence = result?.persisted ? "online" : "offline";
                refreshNumberPad();
            }).catch(() => {
                if (numberPadState !== state) return;
                state.persistence = "offline";
                refreshNumberPad();
            });
        }
    }

    function closeNumberPad({ discardPrepared = true } = {}) {
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
        if (state.mode === "percent") {
            const percent = Number(state.pending);
            const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
            clockTimer.setAttribute(attribute, `${percent}%`);
            updateSummaryValues();
            return true;
        }

        const formatted = renderTimeDigits(state.pending);
        if (!formatted) return false;
        stagedStandardTime = formatted;
        if (state.source === "new-trip") {
            await clockTimer.start({ standardTime: formatted });
        }
        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
        }
        updateSummaryValues();
        return true;
    }

    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            requestNumberPadClose();
            return;
        }
        numberPadState.pending = "";
        refreshNumberPad();
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("click", () => {
                if (!numberPadState) return;
                numberPadState.pending += button.dataset.number;
                refreshNumberPad();
            });
        });

        numberPadConfirm.addEventListener("click", async () => {
            if (!numberPadState || numberPadConfirm.disabled) return;
            if (numberPadConfirm.dataset.action === "autocorrect") {
                numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                refreshNumberPad();
                return;
            }
            try {
                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false });
            }
            catch {
                if (numberPadState) {
                    numberPadState.persistence = "offline";
                    refreshNumberPad();
                }
            }
        });

        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "clear") return;
            const now = performance.now();
            const doublePress = now - numberPadLastClearPointerDown <= NUMBER_PAD_DOUBLE_PRESS;
            numberPadLastClearPointerDown = now;
            numberPadLongPressed = false;
            numberPadClear.setPointerCapture?.(event.pointerId);
            clearTimeout(numberPadLongPressTimer);
            if (doublePress) {
                numberPadLongPressed = true;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
                return;
            }
            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
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

        numberPadSettings.addEventListener("click", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            const state = numberPadState;
            numberPadDialog.close();
            const reopen = () => {
                stateDialog.removeEventListener("close", reopen);
                if (numberPadState === state && !numberPadDialog.open) numberPadDialog.showModal();
            };
            stateDialog.addEventListener("close", reopen);
            openDialog("stateSettingsDialog");
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            requestNumberPadClose();
        });
    }

    $("#newTripButton").addEventListener("click", () => {
        const preparationPromise = clockTimer.prepareTrip({ timeout: 5000 });
        void openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        });
    });

    $("#standardTimeButton").addEventListener("click", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        });
    });

    $("#goalPercentValue").addEventListener("click", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        });
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

    for (const eventName of ["tick", "start", "stop", "clear", "goalChange"]) {
        clockTimer.addEventListener(eventName, updateSummaryValues);
    }

    clockTimer.addEventListener("percentModeChange", () => {
        syncScopeUI(true);
        updateSummaryValues();
    });

    clockTimer.addEventListener("connect", () => setOffline(false, { login: loginPending }));
    clockTimer.addEventListener("disconnect", () => setOffline(true));

    const graphicalSettings = getGraphicalSettings();
    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);
    applyRenderedTimeMode(safeStorageGet(STORAGE.renderedTimeMode) || "remaining", false);
    updateSummaryValues();
    setOffline(!clockTimer.connected, { startup: true });
})();
