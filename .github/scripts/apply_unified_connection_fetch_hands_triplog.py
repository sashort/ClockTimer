from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def replace_region(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found")
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"{label}: end marker not found")
    return text[:start] + replacement + text[end:]


def patch_index():
    path = Path("index.html")
    text = path.read_text()

    old_header = '''        <header class="app-header">
            <button id="menuButton" class="header-button hamburger-button" type="button" popovertarget="mainMenu" aria-label="Open menu">
                <span></span><span></span><span></span>
            </button>
            <button id="scopeToggle" class="header-button scope-toggle" type="button">Trip</button>
        </header>'''
    new_header = '''        <header class="app-header">
            <button id="menuButton" class="header-button hamburger-button" type="button" popovertarget="mainMenu" aria-label="Open menu">
                <span></span><span></span><span></span>
            </button>
            <div class="scope-control">
                <button id="scopeConnectionButton" class="scope-connection-button" type="button" data-cloud-state="offline" aria-label="Offline. Retry connection" hidden></button>
                <button id="scopeToggle" class="scope-toggle" type="button">Trip</button>
            </div>
        </header>'''
    text = replace_once(text, old_header, new_header, "scope control header")

    rows = [
        (
            '''                        <div class="style-row three-control-row">
                            <span>Hour Hand</span>
                            <label>Length<input name="hourHandLength" value="28%"></label>
                            <label>Width<input name="hourHandWidth" value="5px"></label>
                            <label>Color<input name="hourHandColor" type="color" value="#ffffff"></label>
                        </div>''',
            '''                        <div class="style-row three-control-row hand-style-row">
                            <span>Hour Hand</span>
                            <label class="hand-enabled-control">Show<input name="showHourHand" type="checkbox" checked aria-label="Show Hour Hand"></label>
                            <label>Length<input name="hourHandLength" value="28%"></label>
                            <label>Width<input name="hourHandWidth" value="5px"></label>
                            <label>Color<input name="hourHandColor" type="color" value="#ffffff"></label>
                        </div>''',
            "hour hand checkbox"
        ),
        (
            '''                        <div class="style-row three-control-row">
                            <span>Minute Hand</span>
                            <label>Length<input name="minuteHandLength" value="38%"></label>
                            <label>Width<input name="minuteHandWidth" value="4px"></label>
                            <label>Color<input name="minuteHandColor" type="color" value="#ffffff"></label>
                        </div>''',
            '''                        <div class="style-row three-control-row hand-style-row">
                            <span>Minute Hand</span>
                            <label class="hand-enabled-control">Show<input name="showMinuteHand" type="checkbox" checked aria-label="Show Minute Hand"></label>
                            <label>Length<input name="minuteHandLength" value="38%"></label>
                            <label>Width<input name="minuteHandWidth" value="4px"></label>
                            <label>Color<input name="minuteHandColor" type="color" value="#ffffff"></label>
                        </div>''',
            "minute hand checkbox"
        ),
        (
            '''                        <div class="style-row three-control-row">
                            <span>Second Hand</span>
                            <label>Length<input name="secondHandLength" value="42%"></label>
                            <label>Width<input name="secondHandWidth" value="2px"></label>
                            <label>Color<input name="secondHandColor" type="color" value="#ffc220"></label>
                        </div>''',
            '''                        <div class="style-row three-control-row hand-style-row">
                            <span>Second Hand</span>
                            <label class="hand-enabled-control">Show<input name="showSecondHand" type="checkbox" checked aria-label="Show Second Hand"></label>
                            <label>Length<input name="secondHandLength" value="42%"></label>
                            <label>Width<input name="secondHandWidth" value="2px"></label>
                            <label>Color<input name="secondHandColor" type="color" value="#ffc220"></label>
                        </div>''',
            "second hand checkbox"
        )
    ]
    for old, new, label in rows:
        text = replace_once(text, old, new, label)

    path.write_text(text.rstrip() + "\n")


def patch_app():
    path = Path("app.js")
    text = path.read_text()

    text = replace_once(
        text,
        '''        indicatorSymbol: "▲",
        hourHandLength: "28%",''',
        '''        indicatorSymbol: "▲",
        showHourHand: true,
        showMinuteHand: true,
        showSecondHand: true,
        hourHandLength: "28%",''',
        "hand visibility defaults"
    )

    text = replace_once(
        text,
        '''    const mainMenu = $("#mainMenu");
    const tripListMenuButton = $("#tripListMenuButton");''',
        '''    const mainMenu = $("#mainMenu");
    const scopeToggle = $("#scopeToggle");
    const scopeConnectionButton = $("#scopeConnectionButton");
    const tripListMenuButton = $("#tripListMenuButton");''',
        "scope control references"
    )

    text = replace_once(
        text,
        '''    let connectionResumePromise;
    let loginDialogFullyOpen = false;''',
        '''    let connectionResumePromise;
    let connectionCloudPhase = "settled";
    let connectionCloudSequence = 0;
    let connectionCloudSettleTimer;
    let loginDialogFullyOpen = false;''',
        "connection sequence state"
    )

    text = replace_once(
        text,
        '''    const STARTUP_GRAYSCALE_RAMP = 2000;
    const LOGIN_GRAYSCALE_RAMP = 750;
    const INITIAL_LOGIN_FADE_DURATION = 750;
    const BUTTON_PRESS_IN_DURATION = 120;''',
        '''    const STARTUP_GRAYSCALE_RAMP = 2000;
    const CONNECTION_UI_TRANSITION_DURATION = 750;
    const BUTTON_PRESS_IN_DURATION = 120;''',
        "unified connection timing constant"
    )

    text = replace_once(
        text,
        '''    const TRIP_START_TRANSITION_DURATION = 250;
    const CLOUD_ICON_TRANSITION_DURATION = 750;''',
        '''    const TRIP_START_TRANSITION_DURATION = 250;''',
        "remove duplicate cloud duration"
    )

    text = replace_once(
        text,
        '''    const TRIP_LIST_BODY_DELAY = 350;
    const TRIP_LIST_MERGE_DURATION = 250;''',
        '''    const TRIP_LIST_BODY_DELAY = 350;
    const TRIP_LIST_BODY_DURATION = 1000;
    const TRIP_LIST_MERGE_DURATION = 750;''',
        "Trip Log timing constants"
    )

    old_body_speed = '''        const edgeSpeed =
            (
                fullWidth / 2
            ) /
            TRIP_LIST_BUTTON_TRANSITION_DURATION;

        const fullDuration =
            Math.max(
                TRIP_LIST_BUTTON_TRANSITION_DURATION,
                (
                    fullHeight / 2
                ) /
                    edgeSpeed
            );'''
    new_body_speed = '''        const fullDuration =
            TRIP_LIST_BODY_DURATION;

        const edgeSpeed =
            Math.max(
                fullWidth / 2,
                fullHeight / 2
            ) /
            fullDuration;'''
    text = replace_once(text, old_body_speed, new_body_speed, "fixed one-second Trip Log body growth")

    connection_block = r'''    function normalizedConnectionStatus(value = clockTimer.networkStatus) {
        return value === "online" ? "online" : "offline";
    }

    function getConnectionVisualStatus(status = clockTimer.networkStatus) {
        if (
            connectionCloudPhase === "retry" ||
            connectionCloudPhase === "awaiting-login"
        ) {
            return "pending";
        }

        return status === "pending"
            ? "pending"
            : normalizedConnectionStatus(status);
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

            const halfDuration = CONNECTION_UI_TRANSITION_DURATION / 2;
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
        const normalized = getConnectionVisualStatus(status);
        const busy =
            normalized === "pending" ||
            connectionCloudPhase !== "settled";
        setCloudIconVisualState(
            tripSettingsCloud,
            () => tripSettingsCloud.dataset.networkStatus,
            value => { tripSettingsCloud.dataset.networkStatus = value; },
            normalized,
            { animate: Boolean(tripSettingsCloud.dataset.networkStatus) }
        );
        tripSettingsCloud.setAttribute("aria-busy", String(busy));
        tripSettingsCloud.setAttribute(
            "aria-label",
            busy
                ? "Checking connection"
                : normalized === "online"
                    ? "Connected"
                    : "Offline. Retry connection"
        );
        tripSettingsCloud.setAttribute(
            "aria-disabled",
            String(busy || normalized !== "offline")
        );
    }

    function syncScopeConnectionCloud(status = clockTimer.networkStatus) {
        if (!scopeConnectionButton) return;

        const mode =
            normalizePercentMode(
                clockTimer.percentMode
            );

        const modeSupportsCloud =
            mode === "total" ||
            mode === "auto";

        const normalized =
            getConnectionVisualStatus(status);

        const transitionActive =
            connectionCloudPhase !== "settled";

        const visible =
            modeSupportsCloud &&
            (
                normalized !== "online" ||
                transitionActive
            );

        scopeConnectionButton.hidden =
            !visible;

        if (!visible) {
            scopeConnectionButton.setAttribute(
                "aria-busy",
                "false"
            );
            return;
        }

        setCloudIconVisualState(
            scopeConnectionButton,
            () => scopeConnectionButton.dataset.cloudState,
            value => { scopeConnectionButton.dataset.cloudState = value; },
            normalized,
            { animate: Boolean(scopeConnectionButton.dataset.cloudState) }
        );

        const busy =
            normalized === "pending" ||
            transitionActive;

        scopeConnectionButton.disabled =
            busy ||
            normalized !== "offline";

        scopeConnectionButton.setAttribute(
            "aria-busy",
            String(busy)
        );

        scopeConnectionButton.setAttribute(
            "aria-label",
            busy
                ? "Checking connection"
                : normalized === "online"
                    ? "Connected"
                    : "Offline. Retry connection"
        );
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

    function getConnectionNumberPadState() {
        return numberPadState ??
            findUIReturnFrame("number-pad")?.state;
    }

    function getConnectionNumberPadToken() {
        const state =
            getConnectionNumberPadState();

        return state?.connectionStatusToken;
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

    function settleConnectionCloudPresentation(
        status,
        token,
        sequence = connectionCloudSequence
    ) {
        clearTimeout(connectionCloudSettleTimer);
        connectionCloudSettleTimer = undefined;

        if (sequence !== connectionCloudSequence) {
            return;
        }

        const normalized =
            normalizedConnectionStatus(status);

        connectionCloudPhase =
            "settling";

        if (token) {
            updateNumberPadConnectionStatus(
                token,
                normalized,
                { presentation: "cloud-fade" }
            );
        }

        syncTripSettingsCloud(normalized);
        syncScopeConnectionCloud(normalized);
        syncNetworkStatusUI();

        connectionCloudSettleTimer =
            setTimeout(
                () => {
                    if (
                        sequence !== connectionCloudSequence
                    ) {
                        return;
                    }

                    connectionCloudSettleTimer =
                        undefined;

                    connectionCloudPhase =
                        "settled";

                    const state =
                        getConnectionNumberPadState();

                    if (
                        state?.connectionStatusToken === token &&
                        state.connectionPresentation === "cloud-fade"
                    ) {
                        updateNumberPadConnectionStatus(
                            token,
                            normalized,
                            { presentation: "settled" }
                        );
                    }

                    syncTripSettingsCloud(normalized);
                    syncScopeConnectionCloud(normalized);
                },
                CONNECTION_UI_TRANSITION_DURATION
            );
    }

    async function resumeConnectionFromCloud({ source = "trip-settings" } = {}) {
        if (connectionCloudPhase !== "settled") {
            return false;
        }

        const sequence =
            ++connectionCloudSequence;

        clearTimeout(connectionCloudSettleTimer);
        connectionCloudSettleTimer = undefined;

        connectionCloudPhase =
            "retry";

        let token;

        if (
            source === "number-pad" &&
            numberPadState
        ) {
            token =
                numberPadState.connectionStatusToken ||
                ++numberPadConnectionSequence;

            numberPadState.connectionStatusToken =
                token;

            updateNumberPadConnectionStatus(
                token,
                "pending",
                { presentation: "retry" }
            );
        }

        syncTripSettingsCloud("pending");
        syncScopeConnectionCloud("pending");

        if (!connectionResumePromise) {
            connectionResumePromise =
                Promise.resolve(
                    clockTimer.resumeConnection()
                )
                    .catch(() => false)
                    .finally(() => {
                        connectionResumePromise =
                            undefined;
                    });
        }

        await connectionResumePromise;

        if (sequence !== connectionCloudSequence) {
            return false;
        }

        const status =
            normalizedConnectionStatus();

        if (status === "online") {
            settleConnectionCloudPresentation(
                "online",
                token,
                sequence
            );
            return true;
        }

        connectionCloudPhase =
            "awaiting-login";

        if (token) {
            updateNumberPadConnectionStatus(
                token,
                "pending",
                { presentation: "awaiting-login" }
            );
        }

        syncTripSettingsCloud("pending");
        syncScopeConnectionCloud("pending");
        syncNetworkStatusUI();

        if (
            loginDialogFullyOpen ||
            !showConnectionRetryLoginDialog()
        ) {
            settleConnectionCloudPresentation(
                "offline",
                token,
                sequence
            );
        }

        return false;
    }

'''
    text = replace_region(
        text,
        "    function normalizedConnectionStatus(value = clockTimer.networkStatus) {",
        "    function emitUIEvent(target, name, detail = {}, cancelable = false) {",
        connection_block,
        "unified cloud connection sequence"
    )

    dialog_block = r'''    function openDialogElement(dialog, { duration = 250, reason = "user" } = {}) {
        if (
            !dialog ||
            dialog.open ||
            dialog.classList.contains("dialog-closing")
        ) return false;

        const transitionDuration =
            dialog === loginDialog && duration !== 0
                ? CONNECTION_UI_TRANSITION_DURATION
                : duration;

        const proceed = emitUIEvent(
            dialog,
            "opening",
            {
                reason,
                duration: transitionDuration
            },
            true
        );
        if (!proceed) return false;
        dialog.style.setProperty(
            "--app-dialog-transition-duration",
            `${transitionDuration}ms`
        );
        dialog.showModal();
        setTimeout(() => {
            if (!dialog.open || dialog.classList.contains("dialog-closing")) return;
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(
                dialog,
                "opened",
                {
                    reason,
                    duration: transitionDuration
                }
            );
        }, transitionDuration);
        return true;
    }

    function closeDialog(dialog, { reason = "user", immediate = false } = {}) {
        if (
            !dialog?.open ||
            dialog.classList.contains("dialog-closing")
        ) return false;
        const proceed = emitUIEvent(dialog, "closing", { reason, immediate }, true);
        if (!proceed) return false;

        const duration =
            immediate
                ? 0
                : dialog === loginDialog
                    ? CONNECTION_UI_TRANSITION_DURATION
                    : 250;

        const finishClose = () => {
            dialogCloseTimers.delete(dialog);
            dialog.style.setProperty("--app-dialog-transition-duration", "0ms");
            if (dialog.open) dialog.close();
            dialog.classList.remove("dialog-closing");
            requestAnimationFrame(() => {
                dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            });
            emitUIEvent(dialog, "closed", { reason, immediate });
        };

        if (duration === 0) {
            finishClose();
            return true;
        }

        dialog.style.setProperty("--app-dialog-transition-duration", `${duration}ms`);
        dialog.classList.add("dialog-closing");
        dialogCloseTimers.set(
            dialog,
            setTimeout(finishClose, duration)
        );
        return true;
    }

'''
    text = replace_region(
        text,
        "    function openDialogElement(dialog, { duration = 250, reason = \"user\" } = {}) {",
        "    function popoverIsOpen(popover) {",
        dialog_block,
        "unified login dialog timing"
    )

    opened_block = r'''    loginDialog.addEventListener("opened", () => {
        loginDialogFullyOpen = true;

        if (
            connectionCloudPhase ===
                "awaiting-login"
        ) {
            settleConnectionCloudPresentation(
                "offline",
                getConnectionNumberPadToken(),
                connectionCloudSequence
            );
        }
    });

'''
    text = replace_region(
        text,
        '    loginDialog.addEventListener("opened", () => {',
        '    loginDialog.addEventListener("closing", () => {',
        opened_block,
        "connection retry login-open synchronization"
    )

    text = text.replace(
        "duration: INITIAL_LOGIN_FADE_DURATION",
        "duration: CONNECTION_UI_TRANSITION_DURATION"
    )
    if "INITIAL_LOGIN_FADE_DURATION" in text:
        raise SystemExit("INITIAL_LOGIN_FADE_DURATION remains")

    network_block = r'''    function syncNetworkStatusUI({ login = false, startup = false } = {}) {
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
        syncScopeConnectionCloud(networkStatus);

        if (offline) {
            if (tripIsLive()) {
                app.style.setProperty("--app-grayscale-ramp", `${tripGrayscaleRamp()}ms`);
                app.classList.remove("is-offline");
            }
            else {
                app.style.setProperty("--app-grayscale-ramp", `${STARTUP_GRAYSCALE_RAMP}ms`);
                app.classList.add("is-offline");
            }

            if (connectionCloudPhase === "settled") {
                loginPromptTimeout = setTimeout(() => {
                    loginPromptTimeout = undefined;
                    if (
                        clockTimer.networkStatus === "offline" &&
                        !loginDialog.open
                    ) {
                        showInitialLoginDialog();
                    }
                }, STARTUP_CONNECTION_DELAY);
            }
            return;
        }

        if (loginDialog.open) {
            void closeDialogWithReturn(loginDialog, { reason: "login-connected" }).catch(() => {});
        }
        if (!app.classList.contains("is-offline")) return;

        const ramp =
            login || connectionCloudPhase !== "settled"
                ? CONNECTION_UI_TRANSITION_DURATION
                : STARTUP_GRAYSCALE_RAMP;
        const delay = startup ? STARTUP_CONNECTION_DELAY : 0;
        app.style.setProperty("--app-grayscale-ramp", `${ramp}ms`);

        grayscaleReleaseTimeout = setTimeout(() => {
            grayscaleReleaseTimeout = undefined;
            if (clockTimer.networkStatus !== "online") return;
            requestAnimationFrame(() => app.classList.remove("is-offline"));
        }, delay);
    }

'''
    text = replace_region(
        text,
        "    function syncNetworkStatusUI({ login = false, startup = false } = {}) {",
        "    function normalizePercentMode(value) {",
        network_block,
        "network status UI synchronization"
    )

    old_scope_ui = '''        const button = $("#scopeToggle");
        button.textContent = label;
        button.dataset.percentMode = actual;
        button.setAttribute(
            "aria-label",
            `Percent mode: ${label}`
        );

        updateSummaryValues();'''
    new_scope_ui = '''        scopeToggle.textContent = label;
        scopeToggle.dataset.percentMode = actual;
        scopeToggle.setAttribute(
            "aria-label",
            `Percent mode: ${label}`
        );

        syncScopeConnectionCloud();
        updateSummaryValues();'''
    text = replace_once(text, old_scope_ui, new_scope_ui, "scope UI cloud rendering")

    text = replace_once(
        text,
        '''        target.showTolerance = settings.showTolerance;
        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));

        const variables = {''',
        '''        target.showTolerance = settings.showTolerance;
        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));
        target.toggleAttribute("hide-hour-hand", !Boolean(settings.showHourHand));
        target.toggleAttribute("hide-minute-hand", !Boolean(settings.showMinuteHand));
        target.toggleAttribute("hide-second-hand", !Boolean(settings.showSecondHand));

        const variables = {''',
        "apply hand visibility preferences"
    )

    text = replace_once(
        text,
        '''            indicatorSymbol: text("indicatorSymbol"),
            hourHandLength: text("hourHandLength"),''',
        '''            indicatorSymbol: text("indicatorSymbol"),
            showHourHand: form.elements.showHourHand.checked,
            showMinuteHand: form.elements.showMinuteHand.checked,
            showSecondHand: form.elements.showSecondHand.checked,
            hourHandLength: text("hourHandLength"),''',
        "read hand visibility preferences"
    )

    old_scope_handler = '''    $("#scopeToggle").addEventListener("pointerup", () => {
        const current =
            PERCENT_MODES.indexOf(
                normalizePercentMode(
                    clockTimer.percentMode
                )
            );

        clockTimer.percentMode =
            PERCENT_MODES[
                (current + 1) %
                PERCENT_MODES.length
            ];
    });'''
    new_scope_handler = '''    scopeToggle.addEventListener("pointerup", () => {
        const current =
            PERCENT_MODES.indexOf(
                normalizePercentMode(
                    clockTimer.percentMode
                )
            );

        clockTimer.percentMode =
            PERCENT_MODES[
                (current + 1) %
                PERCENT_MODES.length
            ];
    });

    scopeConnectionButton?.addEventListener(
        "click",
        () => {
            if (
                normalizedConnectionStatus() !== "offline" ||
                connectionCloudPhase !== "settled"
            ) {
                return;
            }

            void resumeConnectionFromCloud({
                source: "scope"
            }).catch(() => {});
        }
    );'''
    text = replace_once(text, old_scope_handler, new_scope_handler, "scope cloud retry handler")

    text = replace_once(
        text,
        'void resumeConnectionFromCloud({ numberPad: true }).catch(() => {});',
        'void resumeConnectionFromCloud({ source: "number-pad" }).catch(() => {});',
        "number-pad unified connection call"
    )

    text = replace_once(
        text,
        '''    tripSettingsCloud.addEventListener("click", () => {
        if (tripSettingsCloud.dataset.networkStatus !== "offline") return;
        void resumeConnectionFromCloud().catch(() => {});
    });''',
        '''    tripSettingsCloud.addEventListener("click", () => {
        if (
            tripSettingsCloud.dataset.networkStatus !== "offline" ||
            connectionCloudPhase !== "settled"
        ) return;
        void resumeConnectionFromCloud({
            source: "trip-settings"
        }).catch(() => {});
    });''',
        "Trip Settings unified connection call"
    )

    if "LOGIN_GRAYSCALE_RAMP" in text or "CLOUD_ICON_TRANSITION_DURATION" in text:
        raise SystemExit("duplicate connection timing constant remains")

    path.write_text(text.rstrip() + "\n")


def patch_clock_timer():
    path = Path("ClockTimer.js")
    text = path.read_text()

    replacement = r'''        async #fetchRequest(url, options = {}) {
            return fetch(url, options)
                .then(
                    async response => ({
                        response,
                        body:
                            await response
                                .json()
                                .catch(() => ({}))
                    })
                )
                .catch(
                    cause => ({
                        response: undefined,
                        body: {
                            error:
                                cause?.name === "AbortError"
                                    ? "aborted"
                                    : "fetch_failed",
                            message:
                                cause?.name === "AbortError"
                                    ? "The request was aborted."
                                    : "The API is unavailable."
                        },
                        cause
                    })
                );
        }

        async #apiRequest(endpoint, { method = "GET", body, csrf = false, query, signal } = {}) {
            const headers = { "Accept": "application/json" };
            if (body !== undefined) {
                headers["Content-Type"] = "application/json";
            }
            if (csrf) {
                if (!this.#csrfToken) {
                    const error = new Error("A CSRF token is required.");
                    error.clockTimerOffline = true;
                    throw error;
                }
                headers["X-CSRF-Token"] = this.#csrfToken;
            }

            const result =
                await this.#fetchRequest(
                    this.#apiURL(endpoint, query),
                    {
                        method,
                        credentials: "same-origin",
                        headers,
                        body:
                            body === undefined
                                ? undefined
                                : JSON.stringify(body),
                        signal
                    }
                );

            const response =
                result.response;

            const data =
                result.body || {};

            if (!response) {
                if (data.error === "aborted") {
                    throw result.cause ??
                        new DOMException(
                            data.message || "The request was aborted.",
                            "AbortError"
                        );
                }

                this.#setOffline({
                    source: "api",
                    reason: "unavailable"
                });

                const error =
                    new Error(
                        data.message ||
                            "The API is unavailable.",
                        {
                            cause: result.cause
                        }
                    );

                error.clockTimerOffline =
                    true;

                throw error;
            }

            if (!response.ok) {
                const error = new Error(
                    data.message || `API request failed (${response.status}).`
                );
                if (response.status === 401 || data.error === "invalid_csrf") {
                    this.#setOffline({
                        source: "api",
                        reason:
                            response.status === 401
                                ? "unauthorized"
                                : "invalid-csrf"
                    });
                    error.clockTimerOffline = true;
                }
                throw error;
            }
            return data;
        }

'''
    text = replace_region(
        text,
        "        async #apiRequest(endpoint, { method = \"GET\", body, csrf = false, query, signal } = {}) {",
        "        async #resumeSession() {",
        replacement,
        "fetch exception wrapper"
    )

    if "response = await fetch" in text:
        raise SystemExit("raw fetch try/catch remains")

    path.write_text(text.rstrip() + "\n")


def patch_css():
    path = Path("app.css")
    text = path.read_text().rstrip()

    old_scope = '''.scope-toggle {
    font-size: 24px;
    font-weight: 700;
}'''
    new_scope = r'''.scope-control {
    min-width: 0;
    height: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    overflow: hidden;
    border: var(--control-border);
    border-radius: 12px;
    color: var(--wm-white);
    background: var(--wm-blue-dark);
}

.scope-toggle,
.scope-connection-button {
    appearance: none;
    margin: 0;
    border: 0;
    border-radius: 0;
    color: inherit;
    background: transparent;
}

.scope-toggle {
    min-width: 0;
    padding: 0 16px;
    font-size: 24px;
    font-weight: 700;
}

.scope-connection-button {
    width: 52px;
    height: 100%;
    padding: 0;
    display: grid;
    place-items: center;
    border-right: 1px solid rgb(255 255 255 / 30%);
    font-size: 24px;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
}

.scope-connection-button[hidden] {
    display: none;
}

.scope-connection-button::before {
    content: "";
    width: 1.35em;
    height: 1.35em;
    background: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.scope-connection-button[data-cloud-state="online"] {
    color: #8bd5ff;
}

.scope-connection-button[data-cloud-state="online"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
}

.scope-connection-button[data-cloud-state="offline"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}

.scope-connection-button[data-cloud-state="pending"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3Cmask id='q'%3E%3Crect width='24' height='24' fill='white'/%3E%3Cpath d='M10.2 9.4a2.3 2.3 0 1 1 4.2 1.3c-.3.5-.8.8-1.3 1.15-.7.5-1.1.95-1.1 1.85' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='16.1' r='.9' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black' mask='url(%23q)'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3Cmask id='q'%3E%3Crect width='24' height='24' fill='white'/%3E%3Cpath d='M10.2 9.4a2.3 2.3 0 1 1 4.2 1.3c-.3.5-.8.8-1.3 1.15-.7.5-1.1.95-1.1 1.85' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='16.1' r='.9' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black' mask='url(%23q)'/%3E%3C/svg%3E");
}'''
    text = replace_once(text, old_scope, new_scope, "scope connection cloud CSS")

    hand_css = r'''

clock-timer[hide-hour-hand]::part(hour-hand),
clock-timer[hide-minute-hand]::part(minute-hand),
clock-timer[hide-second-hand]::part(second-hand) {
    display: none;
}

.hand-style-row {
    grid-template-columns:
        minmax(90px, 0.8fr)
        58px
        repeat(3, minmax(0, 1fr));
}

.hand-style-row .hand-enabled-control {
    place-items: center;
    align-self: end;
}

.hand-style-row .hand-enabled-control input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--wm-blue);
}

@media (max-width: 720px) {
    .hand-style-row {
        grid-template-columns: 58px repeat(3, minmax(0, 1fr));
    }

    .hand-style-row > span {
        grid-column: 1 / -1;
    }
}
'''

    marker = '''clock-timer::part(tick-mark),
clock-timer::part(major-tick-mark) {
    background: var(--clock-timer-tick-color, currentColor);
}'''
    text = replace_once(text, marker, marker + hand_css, "clock hand visibility CSS")

    text = text.replace(
        "var(--trip-list-merge-duration, 250ms)",
        "var(--trip-list-merge-duration, 750ms)"
    )

    text = replace_once(
        text,
        '''    transition:
        border-color var(--trip-list-merge-duration, 750ms) linear,
        border-radius var(--trip-list-merge-duration, 750ms) ease-in-out,
        background var(--trip-list-merge-duration, 750ms) linear;
    will-change: left, top, width, height;''',
        '''    transition:
        border-color var(--trip-list-merge-duration, 750ms) linear,
        border-radius var(--trip-list-merge-duration, 750ms) ease-in-out;
    will-change: left, top, width, height;''',
        "Trip Log body constant color"
    )

    text = replace_once(
        text,
        '''.trip-log-button.trip-log-merged,
.trip-log-body.trip-log-merged {
    background: var(--ui-charcoal-gradient, #2f3943);
}''',
        '''.trip-log-button.trip-log-merged {
    background: var(--ui-charcoal-gradient, #2f3943);
}''',
        "Trip Log header-only color change"
    )

    path.write_text(text.rstrip() + "\n")


def main():
    patch_index()
    patch_app()
    patch_clock_timer()
    patch_css()


if __name__ == "__main__":
    main()
