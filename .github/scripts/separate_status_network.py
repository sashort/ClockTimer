from pathlib import Path


def find_matching_brace(text, open_index):
    depth = 0
    quote = None
    escape = False
    i = open_index
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", "`"):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise AssertionError("unmatched brace")


def replace_method(text, marker, replacement):
    start = text.find(marker)
    if start < 0:
        raise AssertionError(f"missing method: {marker}")
    open_index = text.find("{", start)
    if open_index < 0:
        raise AssertionError(f"missing method brace: {marker}")
    close_index = find_matching_brace(text, open_index)
    return text[:start] + replacement + text[close_index + 1:]


clock_path = Path("ClockTimer.js")
clock = clock_path.read_text(encoding="utf-8")

clock = replace_method(
    clock,
    "        #emitClockTimerEvent(name, detail = {}, { cancelable = false } = {}) {",
    '''        #emitClockTimerEvent(name, detail = {}, { cancelable = false } = {}) {
            if (!this.#eventsReady) {
                return true;
            }

            return this.dispatchEvent(new CustomEvent(name, {
                detail: {
                    ...detail,
                    connected: this.#connectionState === "connected",
                    networkStatus: this.networkStatus
                },
                bubbles: true,
                composed: true,
                cancelable
            }));
        }'''
)

clock = replace_method(
    clock,
    "        #setConnected(csrfToken, detail = {}) {",
    '''        #setConnected(csrfToken, detail = {}) {
            const previousNetworkStatus =
                this.networkStatus;

            const wasConnected =
                this.#connectionState ===
                    "connected";

            this.#csrfToken =
                csrfToken;

            this.#connectionState =
                "connected";

            const networkStatus =
                this.networkStatus;

            if (networkStatus !== previousNetworkStatus) {
                this.#emitClockTimerEvent(
                    "networkStatusChanged",
                    {
                        ...detail,
                        previousValue: previousNetworkStatus,
                        value: networkStatus
                    }
                );
            }

            if (!wasConnected) {
                this.#emitClockTimerEvent(
                    "connected",
                    detail
                );
            }
        }'''
)

clock = replace_method(
    clock,
    "        #setOffline(detail = {}) {",
    '''        #setOffline(detail = {}) {
            const previousNetworkStatus =
                this.networkStatus;

            const wasConnected =
                this.#connectionState ===
                    "connected";

            this.#connectionState =
                "offline";

            this.#csrfToken =
                undefined;

            const networkStatus =
                this.networkStatus;

            if (networkStatus !== previousNetworkStatus) {
                this.#emitClockTimerEvent(
                    "networkStatusChanged",
                    {
                        ...detail,
                        previousValue: previousNetworkStatus,
                        value: networkStatus
                    }
                );
            }

            if (wasConnected) {
                this.#emitClockTimerEvent(
                    "disconnected",
                    detail
                );
            }

            if (
                this.#percentMode === "total" &&
                !this.#canSelectTotalMode()
            ) {
                this.#setPercentModeAutomatically(
                    "trip",
                    "total-aggregate-unavailable"
                );
            }
        }'''
)

clock = replace_method(
    clock,
    "        get status() {",
    '''        get status() {
            if (!this.#hasStartProperties()) {
                return "ready";
            }

            if (
                this.#openEndedRange ||
                this.#openOverwriteRange
            ) {
                return "open";
            }

            return this.#started
                ? "running"
                : "stopped";
        }'''
)

old_getters = '''        get state() {
            return this.status;
        }

        get connected() {
            return this.#connectionState === "connected";
        }
'''
new_getters = '''        get state() {
            return this.status;
        }

        get networkStatus() {
            return this.#connectionState === "connected"
                ? "online"
                : "offline";
        }

        get connected() {
            return this.networkStatus === "online";
        }
'''
if old_getters not in clock:
    raise AssertionError("missing state/connected getter block")
clock = clock.replace(old_getters, new_getters, 1)
clock_path.write_text(clock, encoding="utf-8")


app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
app = replace_method(
    app,
    "    function setOffline(offline, { login = false, startup = false } = {}) {",
    '''    function syncNetworkStatusUI({ login = false, startup = false } = {}) {
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

        if (loginDialog.open) closeDialog(loginDialog);
        if (!app.classList.contains("is-offline")) return;

        const ramp = login ? LOGIN_GRAYSCALE_RAMP : STARTUP_GRAYSCALE_RAMP;
        const delay = startup ? STARTUP_CONNECTION_DELAY : 0;
        app.style.setProperty("--app-grayscale-ramp", `${ramp}ms`);

        grayscaleReleaseTimeout = setTimeout(() => {
            grayscaleReleaseTimeout = undefined;
            if (clockTimer.networkStatus !== "online") return;
            requestAnimationFrame(() => app.classList.remove("is-offline"));
        }, delay);
    }'''
)

replacements = {
    '            setOffline(false, { login: true });': '            syncNetworkStatusUI({ login: true });',
    '        finally { setOffline(true); }': '        finally { syncNetworkStatusUI(); }',
    '            if (button.dataset.dialog === "profileDialog" && !clockTimer.connected) {': '            if (button.dataset.dialog === "profileDialog" && clockTimer.networkStatus !== "online") {',
    '        if (!clockTimer.connected) {': '        if (clockTimer.networkStatus !== "online") {',
    'numberPadState.persistence || (clockTimer.connected ? "online" : "offline")': 'numberPadState.persistence || clockTimer.networkStatus',
    '? (clockTimer.connected ? "pending" : "offline")': '? (clockTimer.networkStatus === "online" ? "pending" : "offline")',
    ': (clockTimer.connected ? "online" : "offline"),': ': clockTimer.networkStatus,',
    '    setOffline(!clockTimer.connected, { startup: true });': '    syncNetworkStatusUI({ startup: true });',
}
for old, new in replacements.items():
    if old not in app:
        raise AssertionError(f"missing app anchor: {old}")
    app = app.replace(old, new, 1)

old_listeners = '''    clockTimer.addEventListener("connected", () => {
        setOffline(false, { login: loginPending });
        queueSummaryRefresh();
    });
    clockTimer.addEventListener("disconnected", () => {
        setOffline(true);
        queueSummaryRefresh();
    });
'''
new_listeners = '''    clockTimer.addEventListener("networkStatusChanged", () => {
        syncNetworkStatusUI({ login: loginPending });
        queueSummaryRefresh();
    });
'''
if old_listeners not in app:
    raise AssertionError("missing network listeners block")
app = app.replace(old_listeners, new_listeners, 1)

old_trip_state = '''    function setTripControlState(running) {
        app.dataset.tripState = running ? "running" : "ready";
        activeTripControls.hidden = !running;
    }
'''
new_trip_state = '''    function setTripControlState(running) {
        app.dataset.tripState = running ? "running" : "ready";
        app.dataset.state = clockTimer.status;
        activeTripControls.hidden = !running;
    }
'''
if old_trip_state not in app:
    raise AssertionError("missing trip control state block")
app = app.replace(old_trip_state, new_trip_state, 1)

if "setOffline(" in app:
    raise AssertionError("legacy setOffline call remains")
if "clockTimer.connected" in app:
    raise AssertionError("app still uses connected for network state")

app_path.write_text(app, encoding="utf-8")
