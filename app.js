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
    const tripSetStartsNowActions = $("#tripSetStartsNowActions");
    const tripSetStartsNow = $("#tripSetStartsNow");
    const tripSetStartsNowStartCopy = tripSetStartsNow.querySelector(".trip-now-start-copy");
    const tripSetStartsNowValueCopy = tripSetStartsNow.querySelector(".trip-now-value-copy");
    const tripSetStartsNowNowLabel = tripSetStartsNow.querySelector(".trip-now-now-label");
    const tripSetStartsNowTimestampLabel = tripSetStartsNow.querySelector(".trip-now-timestamp-label");
    const tripSetStartsNowCancel = $("#tripSetStartsNowCancel");
    const tripStartNowToggles = [...tripSettingsDialog.querySelectorAll("[data-trip-start-now-target]")];
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
    let tripSettingsSession;
    let tripStartsNowState;
    let tripStartsNowExiting = false;
    let tripStartsNowExitTimer;
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
    let tripSettingsNavigation = {
        returnTarget: "home",
        numberPadState: undefined
    };
    let numberPadLongPressTimer;
    let numberPadLongPressed = false;
    let numberPadLastClearPointerDown = 0;
    let initialLoginSuppressed = false;
    let initialLoginAttemptPending = true;
    let numberPadConnectionSequence = 0;
    let connectionResumePromise;
    let loginDialogFullyOpen = false;

    const CONNECTION_INDICATOR_MINIMUM = 1000;
    const NUMBER_PAD_LONG_PRESS = 750;
    const NUMBER_PAD_DOUBLE_PRESS = 350;
    const STARTUP_CONNECTION_DELAY = 2000;
    const STARTUP_GRAYSCALE_RAMP = 2000;
    const LOGIN_GRAYSCALE_RAMP = 750;
    const INITIAL_LOGIN_FADE_DURATION = 750;
    const BUTTON_PRESS_IN_DURATION = 120;
    const BUTTON_PRESS_OUT_DURATION = 140;
    const TRIP_START_TRANSITION_DURATION = 250;
    const CLOUD_ICON_TRANSITION_DURATION = 750;
    const cloudIconTransitions = new WeakMap();
    const buttonPressStates = new WeakMap();
    const pointerPressButtons = new Map();
    const tripFieldAttentionAnimations = new WeakMap();

    function getPressedShadow(baseShadow, pressedShadow) {
        return !baseShadow || baseShadow === "none"
            ? pressedShadow
            : `${baseShadow}, ${pressedShadow}`;
    }

    function getPressedTextShadow(baseShadow) {
        const pressed = "0 2px 3px rgb(0 0 0 / 48%), 0 0 5px rgb(255 255 255 / 18%)";
        return !baseShadow || baseShadow === "none"
            ? pressed
            : `${baseShadow}, ${pressed}`;
    }

    function finishButtonPressFeedback(button, state) {
        if (!state || state.releaseStarted) return;
        state.releaseStarted = true;
        state.releaseAnimation = button.animate([
            {
                boxShadow: state.pressedBoxShadow,
                textShadow: state.pressedTextShadow
            },
            {
                boxShadow: state.baseBoxShadow,
                textShadow: state.baseTextShadow
            }
        ], {
            duration: BUTTON_PRESS_OUT_DURATION,
            easing: "ease-in-out",
            fill: "forwards"
        });
        state.releaseAnimation.finished
            .catch(() => {})
            .finally(() => {
                state.pressAnimation?.cancel();
                state.releaseAnimation?.cancel();
                if (buttonPressStates.get(button) === state) {
                    buttonPressStates.delete(button);
                }
            });
    }

    function beginButtonPressFeedback(button) {
        if (!(button instanceof HTMLButtonElement) || button.disabled) return;
        if (buttonPressStates.has(button)) return;

        const style = getComputedStyle(button);
        const baseBoxShadow = style.boxShadow || "none";
        const baseTextShadow = style.textShadow || "none";
        const state = {
            released: false,
            pressFinished: false,
            releaseStarted: false,
            baseBoxShadow,
            baseTextShadow,
            pressedBoxShadow: getPressedShadow(
                baseBoxShadow,
                "inset 0 4px 8px rgb(0 0 0 / 38%), inset 0 1px 2px rgb(0 0 0 / 52%)"
            ),
            pressedTextShadow: getPressedTextShadow(baseTextShadow)
        };
        buttonPressStates.set(button, state);
        state.pressAnimation = button.animate([
            {
                boxShadow: state.baseBoxShadow,
                textShadow: state.baseTextShadow
            },
            {
                boxShadow: state.pressedBoxShadow,
                textShadow: state.pressedTextShadow
            }
        ], {
            duration: BUTTON_PRESS_IN_DURATION,
            easing: "ease-out",
            fill: "forwards"
        });
        state.pressAnimation.finished
            .then(() => {
                state.pressFinished = true;
                if (state.released) finishButtonPressFeedback(button, state);
            })
            .catch(() => {});
    }

    function releaseButtonPressFeedback(button) {
        const state = buttonPressStates.get(button);
        if (!state) return;
        state.released = true;
        if (state.pressFinished) finishButtonPressFeedback(button, state);
    }

    function getEventButton(event) {
        return event.composedPath().find(node => node instanceof HTMLButtonElement);
    }

    document.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const button = getEventButton(event);
        if (!button || button.disabled) return;
        pointerPressButtons.set(event.pointerId, button);
        beginButtonPressFeedback(button);
    }, true);

    ["pointerup", "pointercancel"].forEach(type => {
        document.addEventListener(type, event => {
            const button = pointerPressButtons.get(event.pointerId);
            if (!button) return;
            pointerPressButtons.delete(event.pointerId);
            releaseButtonPressFeedback(button);
        }, true);
    });

    document.addEventListener("keydown", event => {
        if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
        const button = getEventButton(event);
        if (!button || button.disabled) return;
        beginButtonPressFeedback(button);
    }, true);

    document.addEventListener("keyup", event => {
        if (event.key !== " " && event.key !== "Enter") return;
        const button = getEventButton(event);
        if (!button) return;
        releaseButtonPressFeedback(button);
    }, true);

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

    function setCloudIconVisualState(element, getState, applyState, nextState, { animate = true } = {}) {
        if (!element || typeof getState !== "function" || typeof applyState !== "function") {
            applyState?.(nextState);
            return;
        }

        let controller = cloudIconTransitions.get(element);
        if (!controller) {
            controller = {
                chain: Promise.resolve(),
                animation: undefined,
                generation: 0,
                targetState: getState()
            };
            cloudIconTransitions.set(element, controller);
        }

        if (!animate) {
            controller.generation += 1;
            controller.animation?.cancel();
            controller.animation = undefined;
            controller.chain = Promise.resolve();
            controller.targetState = nextState;
            element.style.transform = "";
            applyState(nextState);
            return;
        }

        if (controller.targetState === nextState) return;
        controller.targetState = nextState;
        const generation = controller.generation;

        controller.chain = controller.chain.then(async () => {
            if (generation !== controller.generation) return;
            if (getState() === nextState) return;

            const halfDuration = CLOUD_ICON_TRANSITION_DURATION / 2;
            controller.animation = element.animate(
                [
                    { transform: "rotateY(0deg)" },
                    { transform: "rotateY(90deg)" }
                ],
                { duration: halfDuration, easing: "linear", fill: "forwards" }
            );

            try { await controller.animation.finished; }
            catch { return; }
            if (generation !== controller.generation) return;

            applyState(nextState);
            element.style.transform = "rotateY(-90deg)";
            controller.animation.cancel();
            controller.animation = element.animate(
                [
                    { transform: "rotateY(-90deg)" },
                    { transform: "rotateY(0deg)" }
                ],
                { duration: halfDuration, easing: "linear", fill: "forwards" }
            );

            try { await controller.animation.finished; }
            catch { return; }
            if (generation !== controller.generation) return;

            element.style.transform = "";
            controller.animation.cancel();
            controller.animation = undefined;
        }).catch(() => {});
    }

    function syncTripSettingsCloud(status = clockTimer.networkStatus) {
        if (!tripSettingsCloud) return;
        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);
        setCloudIconVisualState(
            tripSettingsCloud,
            () => tripSettingsCloud.dataset.networkStatus,
            value => { tripSettingsCloud.dataset.networkStatus = value; },
            normalized,
            { animate: Boolean(tripSettingsCloud.dataset.networkStatus) }
        );
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

    function updateNumberPadConnectionStatus(token, status, { presentation } = {}) {
        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);
        if (numberPadState?.connectionStatusToken === token) {
            numberPadState.persistence = normalized;
            if (presentation) numberPadState.connectionPresentation = presentation;
            refreshNumberPad();
        }
        const returnState =
            tripSettingsNavigation.returnTarget === "number-pad"
                ? tripSettingsNavigation.numberPadState
                : undefined;
        if (returnState?.connectionStatusToken === token) {
            returnState.persistence = normalized;
            if (presentation) returnState.connectionPresentation = presentation;
        }
    }

    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt =
            Number.isFinite(state?.connectionAnimationStartedAt)
                ? state.connectionAnimationStartedAt
                : performance.now();

        void Promise.resolve(preparationPromise).catch(() => {});

        const remaining =
            CONNECTION_INDICATOR_MINIMUM -
            (performance.now() - startedAt);
        if (remaining > 0) await wait(remaining);

        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus === "online" ? "online" : "offline",
            { presentation: "initial-cloud" }
        );
    }

    async function resumeConnectionFromCloud({ numberPad = false } = {}) {
        const startedAt = performance.now();
        let token;

        if (numberPad && numberPadState) {
            token = numberPadState.connectionStatusToken || ++numberPadConnectionSequence;
            numberPadState.connectionStatusToken = token;
            updateNumberPadConnectionStatus(token, "pending", { presentation: "retry" });
        }
        else {
            syncTripSettingsCloud("pending");
        }

        if (!connectionResumePromise) {
            connectionResumePromise = (async () => {
                try { return await clockTimer.resumeConnection(); }
                catch { return false; }
            })().finally(() => {
                connectionResumePromise = undefined;
            });
        }

        try { await connectionResumePromise; }
        catch {}

        const status = normalizedConnectionStatus();

        if (numberPad && token) {
            if (status === "online") {
                updateNumberPadConnectionStatus(token, "online", { presentation: "cloud-fade" });
                syncTripSettingsCloud(status);
                syncNetworkStatusUI();
                return true;
            }

            updateNumberPadConnectionStatus(token, "pending", { presentation: "awaiting-login" });
            syncTripSettingsCloud(status);
            syncNetworkStatusUI();

            if (loginDialogFullyOpen) {
                updateNumberPadConnectionStatus(token, "offline", { presentation: "cloud-fade" });
            }
            else if (!showConnectionRetryLoginDialog()) {
                updateNumberPadConnectionStatus(token, "offline", { presentation: "cloud-fade" });
            }
            return false;
        }

        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);
        if (remaining > 0) await wait(remaining);

        const presentation =
            status === "offline" && !loginDialogFullyOpen
                ? "awaiting-login"
                : "settled";
        const frame = findUIReturnFrame("number-pad");
        if (frame?.state) {
            frame.state.persistence = status;
            frame.state.connectionPresentation = presentation;
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

    function resetTripSettingsNavigation() {
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

    async function restoreUIReturnFrame(frame, reason = "ui-return") {
        if (!frame) return false;

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
        loginDialogFullyOpen = false;
        if (event.detail?.reason === "initial-login" && initialLoginSuppressed) {
            event.preventDefault();
        }
    });

    loginDialog.addEventListener("opened", () => {
        loginDialogFullyOpen = true;
        const connectionState =
            numberPadState ??
            findUIReturnFrame("number-pad")?.state;
        if (
            connectionState?.connectionPresentation === "awaiting-login" &&
            connectionState.connectionStatusToken
        ) {
            updateNumberPadConnectionStatus(
                connectionState.connectionStatusToken,
                "offline",
                { presentation: "cloud-fade" }
            );
        }
    });

    loginDialog.addEventListener("closing", () => {
        loginDialogFullyOpen = false;
    });

    function showConnectionRetryLoginDialog() {
        clearTimeout(loginPromptTimeout);
        loginPromptTimeout = undefined;
        initialLoginAttemptPending = false;

        if (loginDialog.open) return true;

        const opened = openDialogElement(loginDialog, {
            duration: INITIAL_LOGIN_FADE_DURATION,
            reason: "connection-retry"
        });
        if (!opened) return false;

        requestAnimationFrame(() => {
            $("#loginUsername")?.focus({ preventScroll: true });
        });
        return true;
    }

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
            if (tripIsLive()) {
                app.style.setProperty("--app-grayscale-ramp", `${tripGrayscaleRamp()}ms`);
                app.classList.remove("is-offline");
            }
            else {
                app.style.setProperty("--app-grayscale-ramp", `${STARTUP_GRAYSCALE_RAMP}ms`);
                app.classList.add("is-offline");
            }
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

    function getMainRenderedTimeValue(selected) {
        const renderedTime =
            typeof selected?.renderedTime === "string"
                ? selected.renderedTime
                : "";

        if (!renderedTime) return undefined;

        const mode =
            selected?.renderedTimeMode ??
            clockTimer.renderedTimeMode;

        if (mode !== "remaining" && mode !== "elapsed") {
            return renderedTime;
        }

        let intervalState;
        try {
            intervalState =
                clockTimer.getActiveIntervalState?.(
                    new Date()
                );
        }
        catch {}

        if (intervalState?.open !== false) {
            return renderedTime;
        }

        return `${renderedTime}${mode === "remaining" ? "⁺" : "⁻"}`;
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
        const mainRenderedTime =
            getMainRenderedTimeValue(
                selected
            );
        $("#renderedTimeValue").textContent =
            mainRenderedTime || "---";
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
        syncTimeFormatForMilitaryToggle(form);
        applyGraphicalSettings(
            settingsFromForm(form),
            clockPreview
        );
    }

    function getGraphicalTimeFormatType(value) {
        const format = String(value || "").trim();
        if (!format || typeof TemporalFormat === "undefined") {
            return undefined;
        }

        const formatType =
            TemporalFormat.getFormatType(
                format
            );

        return formatType?.type === "time"
            ? formatType["time-type"]
            : undefined;
    }

    function syncTimeFormatForMilitaryToggle(form) {
        const control = form.elements.timeFormat;
        const current = String(control.value || "").trim();
        const military = form.elements.militaryTime.checked;
        const formatType = getGraphicalTimeFormatType(current);
        const conflict = military
            ? formatType !== "military"
            : formatType !== "12-hour";

        if (!current || conflict) {
            const includesSeconds = /s/i.test(current);
            control.value = military
                ? (includesSeconds ? "HHmmss" : "HHmm")
                : (includesSeconds ? "h:mm:ss AM/PM" : "h:mm AM/PM");
        }
    }

    function syncMilitaryToggleForTimeFormat(form) {
        const formatType = getGraphicalTimeFormatType(
            form.elements.timeFormat.value
        );

        if (formatType === "military") {
            form.elements.militaryTime.checked = true;
        }
        else if (formatType === "12-hour") {
            form.elements.militaryTime.checked = false;
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
        const current =
            clockTimer.getAttribute("timer-type") === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";

        const next =
            current === "radial-overflow"
                ? "radial-fitted"
                : "radial-overflow";

        clockTimer.setAttribute(
            "timer-type",
            next
        );

        const settings = getGraphicalSettings();
        settings.timerType = next;
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
            if (dialog === tripSettingsDialog) {
                void cancelTripSettingsDialog("trip-settings-cancel").catch(() => {});
                return;
            }
            void closeDialogWithReturn(dialog, { reason: "dialog-close" }).catch(() => {});
        });
    });

    document.querySelectorAll("dialog").forEach(dialog => {
        dialog.addEventListener("cancel", event => {
            if (dialog === tripSettingsDialog) {
                event.preventDefault();
                void cancelTripSettingsDialog("trip-settings-cancel").catch(() => {});
                return;
            }
            if (!peekUIReturnFrame()) return;
            event.preventDefault();
            void closeDialogWithReturn(dialog, { reason: "dialog-cancel" }).catch(() => {});
        });
    });

    $("#graphicalSettingsForm").addEventListener("input", event => {
        const form = event.currentTarget;

        if (event.target.name === "militaryTime") {
            syncTimeFormatForMilitaryToggle(form);
        }
        else if (event.target.name === "timeFormat") {
            syncMilitaryToggleForTimeFormat(form);
        }

        if (event.target.matches("input, select")) {
            applyGraphicalSettings(
                settingsFromForm(form),
                clockPreview
            );
        }
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        syncMilitaryToggleForTimeFormat(form);
        syncTimeFormatForMilitaryToggle(form);
        const settings = settingsFromForm(form);
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
                    : clearAction === "home"
                        ? "Home"
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

        const settingsVisible =
            !percentMode &&
            numberPadState.role !== "trip-settings-field";
        numberPadSettingsArea.hidden = !settingsVisible;
        numberPadSettingsArea.parentElement?.classList.toggle(
            "settings-hidden",
            !settingsVisible
        );
        if (settingsVisible) {
            const status = numberPadState.persistence || normalizedConnectionStatus();
            const phase =
                numberPadState.connectionPresentation || "settled";
            const connectionBusy =
                status === "pending" ||
                phase === "retry" ||
                phase === "awaiting-login";
            numberPadSettingsArea.dataset.persistence = status;
            setCloudIconVisualState(
                numberPadConnection,
                () => numberPadConnection.dataset.cloudState,
                value => { numberPadConnection.dataset.cloudState = value; },
                status,
                {
                    animate:
                        Boolean(numberPadConnection.dataset.cloudState) &&
                        phase !== "initial" &&
                        phase !== "initial-cloud"
                }
            );
            numberPadSettingsArea.dataset.connectionPhase =
                phase === "awaiting-login" ? "retry" : phase;
            numberPadSettings.setAttribute("aria-label", "Trip settings");
            numberPadConnection.setAttribute(
                "aria-label",
                connectionBusy
                    ? "Checking connection"
                    : status === "online"
                        ? "Connected"
                        : "Offline. Retry connection"
            );
            numberPadConnection.setAttribute(
                "aria-busy",
                String(connectionBusy)
            );
            numberPadConnection.setAttribute(
                "aria-disabled",
                String(connectionBusy || status !== "offline")
            );
        }
    }

    async function openNumberPad({
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
        if (
            source === "new-trip" &&
            state.persistence === "pending"
        ) {
            state.connectionAnimationStartedAt =
                performance.now();
        }
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
            if (tripSettingsSession && ["creation-time", "scheduled-start", "actual-start"].includes(state.source)) {
                const values = tripSettingsSession.values;
                if (state.source === "creation-time") {
                    const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));
                    if (!value) return false;
                    values.creationTime = value;
                    values.creationDate = state.pendingDate;
                    refreshTripSettingsValues();
                    return true;
                }

                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state));
                if (!value) return false;
                if (state.source === "scheduled-start") {
                    values.scheduledStart = value;
                    refreshTripSettingsValues();
                    return true;
                }
                values.startTime = value;
                refreshTripSettingsValues();
                return true;
            }

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
        if (tripSettingsSession && state.source === "standard-time") {
            tripSettingsSession.values.standardTime = formatted;
            refreshTripSettingsValues();
            return true;
        }
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
        if (action === "close" || action === "back" || action === "home") {
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
        if (target !== previous) numberPadState.everEdited = true;
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
        return getTripSettingsReturnNumberPadState();
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
        const state = getTripSettingsReturnNumberPadState();
        if (!state || state.source !== "new-trip") return;
        const digits = normalizeTimeDigits(formatted);
        state.initial = digits;
        state.pending = digits;
        state.replaceOnNextDigit = false;
        state.startsTripOnConfirm = true;
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


    function cloneTripSettingsValues(values) {
        return values ? { ...values } : undefined;
    }

    function getCurrentTripSettingsValues() {
        const live = tripIsLive();
        const draft = !live ? tripDraft : undefined;
        if (!live && !draft) return undefined;
        return {
            standardTime: live ? (clockTimer.standardTime || "") : (draft.standardTime || ""),
            creationTime: live ? (clockTimer.creationTime || "") : (draft.creationTime || ""),
            creationDate: live ? (clockTimer.creationDate || "") : (draft.creationDate || ""),
            scheduledStart: live ? (clockTimer.scheduledStart || "") : (draft.scheduledStart || ""),
            startTime: live ? (clockTimer.startTime || "") : (draft.startTime || ""),
            matchTripGoalToTotal: live
                ? Boolean(clockTimer.autoSyncTripGoal)
                : Boolean(draft.matchTripGoalToTotal)
        };
    }

    function beginTripSettingsSession() {
        if (tripSettingsSession) return tripSettingsSession;
        const values = getCurrentTripSettingsValues();
        if (!values) return undefined;
        tripSettingsSession = {
            live: tripIsLive(),
            original: cloneTripSettingsValues(values),
            values: cloneTripSettingsValues(values)
        };
        return tripSettingsSession;
    }

    function getTripSettingsCandidateDraft() {
        if (!tripDraft) return undefined;
        const values = tripSettingsSession?.values;
        if (!values) return tripDraft;
        return {
            ...tripDraft,
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
        };
    }

    function formatTripTimeOnly(value, creationDate) {
        const formatted = formatTripTimeDisplay(value, creationDate);
        return formatted === "---" ? formatted : formatted.split(" · ")[0];
    }

    function syncTripStartsNowButtonContent(active) {
        if (
            !tripSetStartsNowStartCopy ||
            !tripSetStartsNowValueCopy ||
            !tripSetStartsNowNowLabel ||
            !tripSetStartsNowTimestampLabel
        ) {
            return;
        }

        if (active && tripStartsNowState?.label) {
            tripSetStartsNowTimestampLabel.textContent =
                tripStartsNowState.label;
        }
        else if (!tripStartsNowExiting) {
            tripSetStartsNowTimestampLabel.textContent = "";
        }

        const startWidth =
            tripSetStartsNowStartCopy.scrollWidth;
        const nowWidth =
            tripSetStartsNowNowLabel.scrollWidth;
        const timestampWidth =
            tripSetStartsNowTimestampLabel.scrollWidth;

        if (startWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-start-copy-width",
                `${startWidth}px`
            );
        }
        if (nowWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-now-width",
                `${nowWidth}px`
            );
        }
        if (timestampWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-timestamp-width",
                `${timestampWidth}px`
            );
        }

        tripSetStartsNowNowLabel.setAttribute(
            "aria-hidden",
            String(active)
        );
        tripSetStartsNowTimestampLabel.setAttribute(
            "aria-hidden",
            String(!active)
        );
        tripSetStartsNow.setAttribute(
            "aria-label",
            active && tripStartsNowState?.label
                ? `Set To ${tripStartsNowState.label}`
                : "Set Scheduled/Actual Start to Now"
        );
    }

    function syncTripStartsNowUI() {
        const draft = !tripIsLive() ? tripDraft : undefined;
        const active = Boolean(draft && tripStartsNowState);
        const values = tripSettingsSession?.values;
        tripSetStartsNowActions.hidden = !draft;
        tripSetStartsNowActions.classList.toggle("is-selecting", active);
        tripSetStartsNowActions.classList.toggle("is-exiting", tripStartsNowExiting);
        tripSetStartsNowCancel.hidden = false;
        tripSetStartsNowCancel.disabled = !active;
        tripSetStartsNowCancel.tabIndex = active ? 0 : -1;
        tripSetStartsNowCancel.setAttribute("aria-hidden", String(!active));
        tripSettingsDialog.classList.toggle("is-setting-starts-now", active);

        tripSettingsDialog.querySelectorAll(".trip-time-edit").forEach(button => {
            button.hidden = false;
            button.tabIndex = active ? -1 : 0;
            button.setAttribute("aria-hidden", String(active));
        });

        tripStartNowToggles.forEach(button => {
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            const selected = Boolean(active && tripStartsNowState[key]);
            button.hidden = false;
            button.tabIndex = active ? 0 : -1;
            button.setAttribute("aria-hidden", String(!active));
            button.textContent = selected ? "✓" : "-";
            button.setAttribute("aria-pressed", String(selected));
        });

        syncTripStartsNowButtonContent(active);

        if (!active) {
            tripSetStartsNow.disabled =
                Boolean(
                    draft &&
                    !parseDateInput(
                        values?.creationDate ||
                        draft.creationDate
                    )
                );
            return;
        }

        tripSetStartsNow.disabled =
            !tripStartsNowState.scheduled &&
            !tripStartsNowState.actual;
    }

    function finishTripStartsNowExit() {
        clearTimeout(tripStartsNowExitTimer);
        tripStartsNowExitTimer = undefined;
        if (!tripStartsNowExiting) return;

        tripStartsNowExiting = false;
        if (!tripStartsNowState) syncTripStartsNowUI();
    }

    function beginTripStartsNowExit() {
        if (!tripStartsNowState || tripStartsNowExiting) return;
        clearTimeout(tripStartsNowExitTimer);
        tripStartsNowExiting = true;
        tripStartsNowState = undefined;

        const handleTransitionEnd = event => {
            if (event.target !== tripSetStartsNow || event.propertyName !== "flex-basis") return;
            tripSetStartsNow.removeEventListener("transitionend", handleTransitionEnd);
            finishTripStartsNowExit();
        };
        tripSetStartsNow.addEventListener("transitionend", handleTransitionEnd);
        tripStartsNowExitTimer = setTimeout(() => {
            tripSetStartsNow.removeEventListener("transitionend", handleTransitionEnd);
            finishTripStartsNowExit();
        }, TRIP_START_TRANSITION_DURATION + 50);

        refreshTripSettingsValues();
    }

    function restoreDraftFromTripSettingsOriginal() {
        if (!tripDraft || tripSettingsSession?.live || !tripSettingsSession?.original) return;
        const values = tripSettingsSession.original;
        Object.assign(tripDraft, {
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
        });
    }

    function applyTripSettingsSession() {
        const session = tripSettingsSession;
        if (!session) return true;
        const values = session.values;

        if (!session.live) {
            if (!tripDraft) return false;
            Object.assign(tripDraft, {
                standardTime: values.standardTime,
                creationTime: values.creationTime,
                creationDate: values.creationDate,
                scheduledStart: values.scheduledStart,
                startTime: values.startTime,
                matchTripGoalToTotal: Boolean(values.matchTripGoalToTotal)
            });
            return true;
        }

        try {
            if (clockTimer.creationDate !== values.creationDate) clockTimer.creationDate = values.creationDate;
            if (clockTimer.creationTime !== values.creationTime) clockTimer.creationTime = values.creationTime;
            if (clockTimer.scheduledStart !== values.scheduledStart) clockTimer.scheduledStart = values.scheduledStart;
            if (clockTimer.startTime !== values.startTime) clockTimer.startTime = values.startTime;
            if (clockTimer.standardTime !== values.standardTime) clockTimer.standardTime = values.standardTime;
            clockTimer.autoSyncTripGoal = Boolean(values.matchTripGoalToTotal);
            stagedStandardTime = values.standardTime || stagedStandardTime;
            return true;
        }
        catch {
            return false;
        }
    }

    function syncTripSettingsCallerAfterSave() {
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

    function getTripSettingsDerivedTotalGoalPercent(values) {
        if (clockTimer.hasAggregateData !== true) return undefined;
        const standardTime = String(values?.standardTime || "").trim();
        if (!standardTime) return undefined;
        const goal = Number(
            clockTimer.calculateTripGoalFromTotal?.(
                standardTime
            )
        );
        if (!Number.isFinite(goal) || goal <= 0) return undefined;
        return Math.round(goal * 100);
    }

    function refreshTripSettingsValues() {
        syncTripSettingsCloud();
        const live = tripIsLive();
        const draft = !live ? tripDraft : undefined;
        const settingsValues = tripSettingsSession?.values || getCurrentTripSettingsValues();
        const creationDate = settingsValues?.creationDate || draft?.creationDate || clockTimer.creationDate;
        const values = {
            "creation-time": settingsValues
                ? formatTripTimeDisplay(settingsValues.creationTime, creationDate)
                : "---",
            "scheduled-start": settingsValues
                ? formatTripTimeDisplay(settingsValues.scheduledStart, creationDate)
                : "---",
            "actual-start": settingsValues
                ? formatTripTimeDisplay(settingsValues.startTime, creationDate)
                : "---",
            "standard-time": settingsValues?.standardTime || "---"
        };

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            button.disabled = !live && !draft;
        });
        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";
        const preferencesVisible = Boolean(draft || live);
        tripSettingsPreferences.hidden = !preferencesVisible;
        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;
        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;
        const derivedTotalGoalPercent =
            getTripSettingsDerivedTotalGoalPercent(
                settingsValues
            );
        const selectedGoalSync = settingsValues
            ? Boolean(settingsValues.matchTripGoalToTotal)
            : Boolean(getTripPreferences().matchTripGoalToTotal);
        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;
        autoSyncTripGoal.checked = selectedGoalSync;
        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);
        if (!aggregateGoalAvailable) {
            tripGoalSyncNoData.textContent = "(No Data)";
            tripGoalSyncNoData.hidden = false;
        }
        else if (Number.isFinite(derivedTotalGoalPercent)) {
            tripGoalSyncNoData.textContent = `(${derivedTotalGoalPercent}%)`;
            tripGoalSyncNoData.hidden = false;
        }
        else {
            tripGoalSyncNoData.textContent = "";
            tripGoalSyncNoData.hidden = true;
        }
        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";
        tripSettingsPrimary.value = draft ? "start" : "save";
        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanStart(getTripSettingsCandidateDraft()));
        syncTripStartsNowUI();
    }

    function drawAttentionToTripField(field) {
        if (!field) return false;
        const row = [...tripSettingsDialog.querySelectorAll("[data-trip-time-row]")]
            .find(candidate => candidate.dataset.tripTimeRow === field);
        if (!row) return false;

        tripFieldAttentionAnimations.get(row)?.cancel();
        const style = getComputedStyle(row);
        const baseShadow = style.boxShadow && style.boxShadow !== "none"
            ? style.boxShadow
            : "none";
        const pulseShadow = baseShadow === "none"
            ? "0 0 0 3px rgb(255 194 32 / 58%), 0 0 20px rgb(255 194 32 / 24%)"
            : `${baseShadow}, 0 0 0 3px rgb(255 194 32 / 58%), 0 0 20px rgb(255 194 32 / 24%)`;
        const animation = row.animate([
            { offset: 0, scale: "1", boxShadow: baseShadow },
            { offset: 0.38, scale: "1.012", boxShadow: pulseShadow },
            { offset: 1, scale: "1", boxShadow: baseShadow }
        ], {
            duration: 800,
            easing: "ease-in-out"
        });
        tripFieldAttentionAnimations.set(row, animation);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (tripFieldAttentionAnimations.get(row) === animation) {
                    tripFieldAttentionAnimations.delete(row);
                }
            });
        return true;
    }

    function openTripSettingsDialog(
        reason = "number-pad-settings",
        { duration = 250, focusField } = {}
    ) {
        const existingSession = Boolean(tripSettingsSession);
        if (!existingSession) beginTripSettingsSession();
        refreshTripSettingsValues();

        if (tripSettingsDialog.open) {
            if (focusField) {
                requestAnimationFrame(() => drawAttentionToTripField(focusField));
            }
            return true;
        }

        const opened = openDialogElement(tripSettingsDialog, { duration, reason });
        if (!opened && !existingSession) {
            tripSettingsSession = undefined;
            tripStartsNowState = undefined;
        }
        if (opened && focusField) {
            tripSettingsDialog.addEventListener("opened", () => {
                drawAttentionToTripField(focusField);
            }, { once: true });
        }
        return opened;
    }

    function getTripFieldValue(field) {
        const values = tripSettingsSession?.values || getCurrentTripSettingsValues();
        if (!values) return "";
        if (field === "creation-time") return values.creationTime || "";
        if (field === "scheduled-start") return values.scheduledStart || "";
        if (field === "actual-start") return values.startTime || "";
        if (field === "standard-time") return values.standardTime || "";
        return "";
    }

    function openTripFieldNumberPad(field) {
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

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                const previousPending = numberPadState.pending;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                const candidate = numberPadState.pending + button.dataset.number;
                if (numberPadState.mode === "absolute" && candidate.length > 6) return;
                numberPadState.pending = candidate;
                if (candidate !== previousPending) numberPadState.everEdited = true;
                refreshNumberPad();
            });
        });

        [numberPadAM, numberPadPM].forEach(button => {
            button.addEventListener("pointerup", () => changeNumberPadMeridiem(button.dataset.meridiem));
        });

        numberPadDate.addEventListener("input", () => {
            if (!numberPadState || numberPadState.mode !== "absolute") return;
            if (numberPadState.pendingDate !== numberPadDate.value) {
                numberPadState.everEdited = true;
            }
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
                    const destination = numberPadState?.confirmTarget || "home";
                    await closeNumberPad({
                        discardPrepared: false,
                        allowChanged: true,
                        destination
                    });
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

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            void cancelNumberPad().catch(() => {});
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
        if (!tripSettingsSession) beginTripSettingsSession();
        if (tripSettingsSession) {
            tripSettingsSession.values.matchTripGoalToTotal = event.currentTarget.checked;
        }
    });

    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
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

    tripSetStartsNow.addEventListener("pointerup", () => {
        if (!tripDraft || tripIsLive()) return;
        if (!tripSettingsSession) beginTripSettingsSession();
        const values = tripSettingsSession?.values;
        if (!values) return;

        if (!tripStartsNowState) {
            const now = new Date();
            const value = formatTimelineDateTime(now, values.creationDate);
            if (!value) return;
            const label = formatTripTimeOnly(value, values.creationDate);
            if (!label || label === "---") return;
            tripStartsNowState = {
                value,
                label,
                scheduled: false,
                actual: false
            };
            syncTripStartsNowUI();
            return;
        }

        if (tripStartsNowState.scheduled) values.scheduledStart = tripStartsNowState.value;
        if (tripStartsNowState.actual) values.startTime = tripStartsNowState.value;
        beginTripStartsNowExit();
    });

    tripSetStartsNowCancel.addEventListener("pointerup", () => {
        if (!tripStartsNowState) return;
        beginTripStartsNowExit();
    });

    tripStartNowToggles.forEach(button => {
        button.addEventListener("pointerup", () => {
            if (!tripStartsNowState) return;
            const key = button.dataset.tripStartNowTarget === "scheduled-start"
                ? "scheduled"
                : "actual";
            tripStartsNowState[key] = !tripStartsNowState[key];
            syncTripStartsNowUI();
        });
    });

    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!tripSettingsSession) beginTripSettingsSession();
        if (tripSettingsSession) {
            tripSettingsSession.values.matchTripGoalToTotal =
                event.currentTarget.elements.autoSyncTripGoal.checked;
        }

        void (async () => {
            const startingDraft = Boolean(tripDraft && !tripIsLive());
            if (!applyTripSettingsSession()) {
                refreshTripSettingsValues();
                return;
            }

            if (startingDraft) {
                try {
                    if (!await startTripDraft()) {
                        restoreDraftFromTripSettingsOriginal();
                        refreshTripSettingsValues();
                        return;
                    }
                }
                catch {
                    restoreDraftFromTripSettingsOriginal();
                    refreshTripSettingsValues();
                    return;
                }
                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
                closeDialog(tripSettingsDialog, { reason: "trip-settings-start" });
                return;
            }

            syncTripSettingsCallerAfterSave();
            tripStartsNowState = undefined;
            tripSettingsSession = undefined;
            await closeTripSettingsToNavigation("trip-settings-save");
        })().catch(() => {});
    });

    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        uiReturnStack.length = 0;
        resetTripSettingsNavigation();
        tripSettingsSession = undefined;
        tripStartsNowState = undefined;
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
            startsTripOnConfirm: true,
            role: "root",
            workflow: "new-trip",
            cancelTarget: "home",
            confirmTarget: "home"
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
        button.addEventListener("click", () => {
            const startPromise =
                startBreakInterval(
                    button.dataset.breakType
                );

            closeDialog(
                breakDialog,
                { reason: "break-type-selected" }
            );

            void startPromise.catch(() => {});
        });
    });

    $("#standardTimeButton").addEventListener("pointerup", () => {
        if (!tripIsLive() || clockTimer.percentMode === "total") return;
        resetTripSettingsNavigation();
        openTripSettingsDialog("summary-standard-time", {
            focusField: "standard-time"
        });
    });

    $("#goalPercentValue").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue(),
            role: "root",
            workflow: tripIsLive() ? "edit-trip" : null,
            cancelTarget: "home",
            confirmTarget: "home"
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
        return Boolean(result);
    }

    function tripGrayscaleRamp() {
        const value = Number(app.dataset.tripGrayscaleRamp);
        return Number.isFinite(value) && value >= 0 ? value : 250;
    }

    function syncTripGrayscale(running = tripIsLive()) {
        app.style.setProperty("--app-grayscale-ramp", `${tripGrayscaleRamp()}ms`);

        if (running) {
            if (!app.classList.contains("is-offline")) return;
            requestAnimationFrame(() => {
                if (tripIsLive()) app.classList.remove("is-offline");
            });
            return;
        }

        if (clockTimer.networkStatus === "online" || app.classList.contains("is-offline")) return;
        requestAnimationFrame(() => {
            if (!tripIsLive() && clockTimer.networkStatus !== "online") {
                app.classList.add("is-offline");
            }
        });
    }

    function setTripControlState(running) {
        app.dataset.tripState = running ? "running" : "ready";
        app.dataset.state = clockTimer.status;
        syncTripGrayscale(running);
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
        const connectionState =
            numberPadState ??
            getTripSettingsReturnNumberPadState();
        const phase = connectionState?.connectionPresentation;
        if (
            connectionState?.connectionStatusToken &&
            !["initial", "retry", "awaiting-login"].includes(phase)
        ) {
            updateNumberPadConnectionStatus(
                connectionState.connectionStatusToken,
                normalizedConnectionStatus(),
                { presentation: "cloud-fade" }
            );
        }
        syncNetworkStatusUI({ login: loginPending });
        queueSummaryRefresh();
    });

    // Semantic ClockTimer event integration points.
    // These bodies intentionally do not change UI yet; future speech synthesis and
    // other user-facing reactions should be implemented here rather than decoding
    // lower-level ClockTimer events elsewhere.
    function reserveSemanticEvent(event, purpose) {
        const detail = event.detail;
        void detail;
        void purpose;
    }

    function onTripStarted(event) {
        reserveSemanticEvent(event, "Trip started on time");
    }

    function onTripStartedEarly(event) {
        reserveSemanticEvent(event, "Trip started early");
    }

    function onTripStartedLate(event) {
        reserveSemanticEvent(event, "Trip started late");
    }

    function onBreakStarted(event) {
        reserveSemanticEvent(event, "Break or lunch started");
    }

    function onBreakEndedEarly(event) {
        reserveSemanticEvent(event, "Break or lunch manually ended before the auto-restart boundary");
    }

    function onBreakEndedAutomatically(event) {
        reserveSemanticEvent(event, "Break or lunch automatically ended at the end-buffer boundary");
    }

    function onBreakEndedLate(event) {
        reserveSemanticEvent(event, "Break or lunch manually ended after the end-buffer boundary");
    }

    function onDownTimeStarted(event) {
        reserveSemanticEvent(event, "Down time started");
    }

    function onTripResumed(event) {
        reserveSemanticEvent(event, "Trip resumed from down time");
    }

    function onTripEnded(event) {
        reserveSemanticEvent(event, "Trip ended");
    }

    function onTotalGoalSet(event) {
        reserveSemanticEvent(event, "Total goal explicitly set");
    }

    function onTripGoalSet(event) {
        reserveSemanticEvent(event, "Trip goal explicitly set");
    }

    function onTripGoalAutomaticallySet(event) {
        reserveSemanticEvent(event, "Trip goal derived automatically");
    }

    function onTripGoalFailed(event) {
        reserveSemanticEvent(event, "Trip goal failed");
    }

    function onTotalGoalFailed(event) {
        reserveSemanticEvent(event, "Total goal failed");
    }

    function onPercentModeChanged(event) {
        reserveSemanticEvent(event, "Percent scope mode changed");
    }

    function onGoalAutomaticallyAdjusted(event) {
        reserveSemanticEvent(event, "Higher automatic goal became unattainable and the rendered goal adjusted");
    }

    function onStandardTimeChanged(event) {
        reserveSemanticEvent(event, "Standard time changed");
    }

    function onCreationTimeChanged(event) {
        reserveSemanticEvent(event, "Creation time changed");
    }

    function onScheduledStartChanged(event) {
        reserveSemanticEvent(event, "Scheduled start changed");
    }

    function onActualStartChanged(event) {
        reserveSemanticEvent(event, "Actual start changed");
    }

    function onConnected(event) {
        reserveSemanticEvent(event, "ClockTimer connected");
    }

    function onDisconnected(event) {
        reserveSemanticEvent(event, "ClockTimer disconnected");
    }

    function onAggregatesSynced(event) {
        reserveSemanticEvent(event, "Reconnect refreshed aggregate data and the aggregate snapshot changed");
    }

    const semanticClockTimerHandlers = {
        tripStarted: onTripStarted,
        tripStartedEarly: onTripStartedEarly,
        tripStartedLate: onTripStartedLate,
        breakStarted: onBreakStarted,
        breakEndedEarly: onBreakEndedEarly,
        breakEndedAutomatically: onBreakEndedAutomatically,
        breakEndedLate: onBreakEndedLate,
        downTimeStarted: onDownTimeStarted,
        tripResumed: onTripResumed,
        tripEnded: onTripEnded,
        totalGoalSet: onTotalGoalSet,
        tripGoalSet: onTripGoalSet,
        tripGoalAutomaticallySet: onTripGoalAutomaticallySet,
        tripGoalFailed: onTripGoalFailed,
        totalGoalFailed: onTotalGoalFailed,
        percentModeChanged: onPercentModeChanged,
        goalAutomaticallyAdjusted: onGoalAutomaticallyAdjusted,
        standardTimeChanged: onStandardTimeChanged,
        creationTimeChanged: onCreationTimeChanged,
        scheduledStartChanged: onScheduledStartChanged,
        actualStartChanged: onActualStartChanged,
        connected: onConnected,
        disconnected: onDisconnected,
        aggregatesSynced: onAggregatesSynced
    };

    for (const [eventName, handler] of Object.entries(semanticClockTimerHandlers)) {
        clockTimer.addEventListener(eventName, handler);
    }

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
