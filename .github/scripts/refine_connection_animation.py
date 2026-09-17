from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


path = Path("app.js")
app = path.read_text()

app = replace_once(
    app,
    '''    const CONNECTION_INDICATOR_MINIMUM = 1000;\n    const CONNECTION_CLOUD_FADE_DURATION = 250;\n''',
    '''    const CONNECTION_INDICATOR_MINIMUM = 1000;\n''',
    "remove obsolete cloud fade delay constant"
)

app = replace_once(
    app,
    '''    let numberPadConnectionSequence = 0;\n    let connectionResumePromise;\n''',
    '''    let numberPadConnectionSequence = 0;\n    let connectionResumePromise;\n    let loginDialogFullyOpen = false;\n''',
    "login fully-open state"
)

old = '''    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt =
            Number.isFinite(state?.connectionAnimationStartedAt)
                ? state.connectionAnimationStartedAt
                : performance.now();
        try {
            await Promise.resolve(preparationPromise);
        }
        catch {}

        const fadeStartAt = Math.max(
            startedAt + CONNECTION_INDICATOR_MINIMUM - CONNECTION_CLOUD_FADE_DURATION,
            performance.now()
        );
        const beforeFade = fadeStartAt - performance.now();
        if (beforeFade > 0) await wait(beforeFade);

        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus,
            { presentation: "handoff" }
        );
        await wait(CONNECTION_CLOUD_FADE_DURATION);

        const status = normalizedConnectionStatus();
        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            status,
            {
                presentation:
                    status === "offline" && !loginDialog.open
                        ? "awaiting-login"
                        : "settled"
            }
        );
    }
'''
new = '''    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt =
            Number.isFinite(state?.connectionAnimationStartedAt)
                ? state.connectionAnimationStartedAt
                : performance.now();
        try {
            await Promise.resolve(preparationPromise);
        }
        catch {}

        const remaining =
            CONNECTION_INDICATOR_MINIMUM -
            (performance.now() - startedAt);
        if (remaining > 0) await wait(remaining);

        const status = normalizedConnectionStatus();
        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            status,
            {
                presentation:
                    status === "offline" && !loginDialogFullyOpen
                        ? "awaiting-login"
                        : "settled"
            }
        );
    }
'''
app = replace_once(app, old, new, "initial number-pad connection timing")

app = replace_once(
    app,
    '''            updateNumberPadConnectionStatus(
                token,
                "pending",
                { presentation: "retry" }
            );
''',
    '''            updateNumberPadConnectionStatus(
                token,
                "offline",
                { presentation: "retry" }
            );
''',
    "retry preserves offline cloud while gear spins"
)

app = replace_once(
    app,
    '''        if (token) {
            updateNumberPadConnectionStatus(
                token,
                status,
                { presentation: "settled" }
            );
        }
        else {
            const frame = findUIReturnFrame("number-pad");
            if (frame?.state) {
                frame.state.persistence = status;
                frame.state.connectionPresentation = "settled";
            }
        }
''',
    '''        const presentation =
            status === "offline" && !loginDialogFullyOpen
                ? "awaiting-login"
                : "settled";
        if (token) {
            updateNumberPadConnectionStatus(
                token,
                status,
                { presentation }
            );
        }
        else {
            const frame = findUIReturnFrame("number-pad");
            if (frame?.state) {
                frame.state.persistence = status;
                frame.state.connectionPresentation = presentation;
            }
        }
''',
    "retry completion presentation"
)

old = '''        if (settingsVisible) {
            const status = numberPadState.persistence || normalizedConnectionStatus();
            numberPadSettingsArea.dataset.persistence = status;
            numberPadSettingsArea.dataset.connectionPhase =
                numberPadState.connectionPresentation || "settled";
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
'''
new = '''        if (settingsVisible) {
            const status = numberPadState.persistence || normalizedConnectionStatus();
            const phase =
                numberPadState.connectionPresentation || "settled";
            const connectionBusy =
                status === "pending" ||
                phase === "retry" ||
                phase === "awaiting-login";
            numberPadSettingsArea.dataset.persistence = status;
            numberPadSettingsArea.dataset.connectionPhase = phase;
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
'''
app = replace_once(app, old, new, "connection busy accessibility state")

old = '''        numberPadState = state;
        refreshNumberPad();
        if (
            source === "new-trip" &&
            state.persistence === "pending"
        ) {
            state.connectionAnimationStartedAt =
                performance.now();
        }
        mainMenu?.hidePopover?.();
'''
new = '''        if (
            source === "new-trip" &&
            state.persistence === "pending"
        ) {
            state.connectionAnimationStartedAt =
                performance.now();
        }
        numberPadState = state;
        refreshNumberPad();
        mainMenu?.hidePopover?.();
'''
app = replace_once(app, old, new, "anchor animation before first render")

old = '''    loginDialog.addEventListener("opening", event => {
        if (event.detail?.reason === "initial-login" && initialLoginSuppressed) {
            event.preventDefault();
        }
    });

    function showInitialLoginDialog() {
'''
new = '''    loginDialog.addEventListener("opening", event => {
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
                { presentation: "settled" }
            );
        }
    });

    loginDialog.addEventListener("closing", () => {
        loginDialogFullyOpen = false;
    });

    function showInitialLoginDialog() {
'''
app = replace_once(app, old, new, "login fully-faded handoff event")

old = '''        initialLoginAttemptPending = false;
        if (!opened) return;

        const connectionState =
            numberPadState ??
            findUIReturnFrame("number-pad")?.state;
        if (
            connectionState?.connectionPresentation ===
                "awaiting-login" &&
            connectionState.connectionStatusToken
        ) {
            updateNumberPadConnectionStatus(
                connectionState.connectionStatusToken,
                "offline",
                { presentation: "settled" }
            );
        }

        requestAnimationFrame(() => {
'''
new = '''        initialLoginAttemptPending = false;
        if (!opened) return;

        requestAnimationFrame(() => {
'''
app = replace_once(app, old, new, "do not stop gear at login fade start")

path.write_text(app)


path = Path("app.css")
css = path.read_text()
css += r'''

/* connection-animation-anchor-v2 */
.number-pad-settings[data-connection-phase="initial"][data-persistence="pending"] .number-pad-persistence-badge {
    display: grid;
    animation: number-pad-cloud-fade-in 1000ms linear both;
}

.number-pad-settings[data-connection-phase="initial"][data-persistence="pending"] .number-pad-persistence-badge::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
}

.number-pad-settings[data-connection-phase="retry"] .number-pad-settings-gear,
.number-pad-settings[data-connection-phase="awaiting-login"] .number-pad-settings-gear {
    animation: number-pad-gear-spin 800ms linear infinite;
}
'''
path.write_text(css)
