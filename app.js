(() => {
    "use strict";

    const API_BASE = "https://wmof.sashort-apps.com/";
    const STORAGE = {
        percentMode: "wmof.clock.percentMode",
        renderedTimeMode: "wmof.clock.renderedTimeMode",
        graphicalSettings: "wmof.clock.graphicalSettings"
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
        grayscale: "0",
        grayscaleRamp: "333ms"
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

    function setOffline(offline) {
        app.classList.toggle("is-offline", offline);
        app.dataset.state = offline ? "offline" : (clockTimer.status === "running" ? "running" : "ready");
        syncConnectionUI(!offline);

        if (offline && !loginDialog.open) loginDialog.showModal();
        if (!offline && loginDialog.open) loginDialog.close();
    }

    function applyScope(mode, persist = true) {
        const next = mode === "total" ? "total" : "trip";
        clockTimer.percentMode = next;
        $("#scopeToggle").textContent = next === "trip" ? "Trip" : "Total";
        updateSummaryLabels();
        if (persist) safeStorageSet(STORAGE.percentMode, next);
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
        const standard = clockTimer.standardTime;
        $("#standardTimeValue").textContent = typeof standard === "string" && standard ? standard : "---";
        $("#renderedTimeValue").textContent = clockTimer.renderedTime || "---";

        const goal = Number(clockTimer.renderedPercentGoal);
        $("#goalPercentValue").textContent = Number.isFinite(goal) ? `${Math.round(goal * 100)}%` : "100%";
    }

    function applyGraphicalSettings(settings, target = clockTimer) {
        target.setAttribute("timer-type", settings.timerType);
        target.setAttribute("timer-mode", settings.timerMode);
        target.setAttribute("military-time", String(Boolean(settings.militaryTime)));
        target.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm AM/PM"));

        for (const [name, value] of [
            ["date-format", settings.dateFormat],
            ["visible-hours", settings.visibleHours],
            ["tick-marks", settings.tickMarks],
            ["indicator-symbol", settings.indicatorSymbol]
        ]) {
            if (value === "" || value === null || value === undefined) target.removeAttribute(name);
            else target.setAttribute(name, value);
        }

        target.setAttribute("grayscale", `${Math.max(0, Math.min(100, Number(settings.grayscale) || 0))}%`);
        target.setAttribute("grayscale-ramp", settings.grayscaleRamp || "333ms");
        target.showTolerance = Boolean(settings.showTolerance);
    }

    function settingsFromForm(form) {
        const data = new FormData(form);
        return {
            timerType: data.get("timerType"),
            timerMode: data.get("timerMode"),
            showTolerance: form.elements.showTolerance.checked,
            militaryTime: form.elements.militaryTime.checked,
            timeFormat: String(data.get("timeFormat") || "").trim(),
            dateFormat: String(data.get("dateFormat") || "").trim(),
            visibleHours: String(data.get("visibleHours") || "").trim(),
            tickMarks: String(data.get("tickMarks") || "").trim(),
            indicatorSymbol: String(data.get("indicatorSymbol") || "").trim(),
            grayscale: String(data.get("grayscale") || "0"),
            grayscaleRamp: String(data.get("grayscaleRamp") || "333ms").trim()
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

        const settings = getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
        settings.timerType = "radial-fitted";
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
    });

    document.querySelectorAll("[data-dialog]").forEach(button => {
        button.addEventListener("click", () => {
            if (button.dataset.dialog === "profileDialog" && !clockTimer.connected) {
                openDialog("loginDialog");
                return;
            }

            if (button.dataset.dialog === "graphicalSettingsDialog") {
                fillGraphicalForm(getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS));
            }

            openDialog(button.dataset.dialog);
        });
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog")?.close());
    });

    $("#graphicalSettingsForm").addEventListener("input", event => {
        if (event.target.name === "militaryTime") {
            syncTimeFormatForMilitaryToggle(event.currentTarget);
        }

        if (event.target.matches("input, select")) {
            applyGraphicalSettings(settingsFromForm(event.currentTarget), clockPreview);
        }
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const settings = settingsFromForm(event.currentTarget);
        applyGraphicalSettings(settings);
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
        graphicalDialog.close();
    });

    $("#resetGraphicalSettings").addEventListener("click", () => fillGraphicalForm(GRAPHICAL_DEFAULTS));

    $("#stateSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;
        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;
        clockTimer.nonProductionFilter = form.elements.nonProductionFilter.value;
        stateDialog.close();
    });

    $("#loginForm").addEventListener("submit", async event => {
        event.preventDefault();
        const username = $("#loginUsername").value.trim();
        const password = $("#loginPassword").value;
        const error = $("#loginError");
        error.textContent = "";
        try {
            const result = await clockTimer.connect(username, password);
            if (!result?.connected) throw new Error("Login failed.");
            $("#profileUsername").value = result.user?.username || username;
            setOffline(false);
        }
        catch (failure) {
            error.textContent = failure?.message || "Unable to login.";
        }
    });

    authButton.addEventListener("click", async () => {
        $("#mainMenu")?.hidePopover?.();

        if (!clockTimer.connected) {
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
        profileDialog.close();
        window.dispatchEvent(new CustomEvent("wmof:profile-save", {
            detail: Object.fromEntries(new FormData(event.currentTarget))
        }));
    });

    $("#resetPasswordButton").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("wmof:reset-password-request", { detail: { apiBase: API_BASE } }));
    });

    for (const id of ["newTripButton", "standardTimeButton"]) {
        $("#" + id).addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("wmof:number-pad-request", {
                detail: { source: id === "newTripButton" ? "new-trip" : "standard-time" }
            }));
        });
    }

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

    for (const eventName of ["tick", "start", "clear", "goalChange", "percentModeChange"]) {
        clockTimer.addEventListener(eventName, updateSummaryValues);
    }

    clockTimer.addEventListener("connect", () => setOffline(false));
    clockTimer.addEventListener("disconnect", () => setOffline(true));

    const graphicalSettings = getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);
    applyRenderedTimeMode(safeStorageGet(STORAGE.renderedTimeMode) || "remaining", false);
    updateSummaryValues();
    setOffline(!clockTimer.connected);
})();
