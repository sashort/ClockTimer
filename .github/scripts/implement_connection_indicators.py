from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))


# ClockTimer: expose the existing session-resume machinery to UI consumers.
replace_once(
    "ClockTimer.js",
    '''        async connect(username, password) {''',
    '''        async resumeConnection() {\n            return this.#ensureConnected();\n        }\n\n        async connect(username, password) {''',
    "resumeConnection public method",
)

# Number pad: make the cloud its own control while preserving the gear as Trip Settings.
replace_once(
    "numberpad.html",
    '''            <button id="numberPadSettings" class="number-pad-settings" type="button" aria-label="Trip settings" data-persistence="offline">\n                <span class="number-pad-settings-gear" aria-hidden="true"></span>\n                <span class="number-pad-persistence-badge" aria-hidden="true"></span>\n            </button>''',
    '''            <div id="numberPadSettingsArea" class="number-pad-settings" data-persistence="offline">\n                <button id="numberPadSettings" class="number-pad-settings-control" type="button" aria-label="Trip settings">\n                    <span class="number-pad-settings-gear" aria-hidden="true"></span>\n                </button>\n                <button id="numberPadConnection" class="number-pad-persistence-badge" type="button" aria-label="Offline. Retry connection"></button>\n            </div>''',
    "number pad connection control",
)

# Trip Settings: cloud sits immediately left of the title.
replace_once(
    "index.html",
    '''            <header class="dialog-header">\n                <h2 id="tripSettingsTitle">Edit Trip Settings</h2>\n                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>\n            </header>''',
    '''            <header class="dialog-header trip-settings-header">\n                <div class="trip-settings-heading">\n                    <button id="tripSettingsCloud" class="trip-settings-cloud" type="button" data-network-status="offline" aria-label="Offline. Retry connection"></button>\n                    <h2 id="tripSettingsTitle">Edit Trip Settings</h2>\n                </div>\n                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>\n            </header>''',
    "trip settings cloud header",
)

# App references/state/constants.
replace_once(
    "app.js",
    '''    const tripSettingsTitle = $("#tripSettingsTitle");\n    const tripSettingsPrimary = $("#tripSettingsPrimary");''',
    '''    const tripSettingsTitle = $("#tripSettingsTitle");\n    const tripSettingsCloud = $("#tripSettingsCloud");\n    const tripSettingsPrimary = $("#tripSettingsPrimary");''',
    "trip settings cloud ref",
)
replace_once(
    "app.js",
    '''    let numberPadSettings;\n    let numberPadClear;''',
    '''    let numberPadSettingsArea;\n    let numberPadSettings;\n    let numberPadConnection;\n    let numberPadClear;''',
    "number pad connection refs",
)
replace_once(
    "app.js",
    '''    let initialLoginAttemptPending = true;\n\n    const NUMBER_PAD_LONG_PRESS = 750;''',
    '''    let initialLoginAttemptPending = true;\n    let numberPadConnectionSequence = 0;\n    let connectionResumePromise;\n\n    const CONNECTION_INDICATOR_MINIMUM = 1000;\n    const NUMBER_PAD_LONG_PRESS = 750;''',
    "connection state and minimum",
)

# Connection indicator helpers live after syncConnectionUI.
replace_once(
    "app.js",
    '''    function syncConnectionUI(connected) {\n        profileMenuButton.hidden = !connected;\n        authButton.textContent = connected ? "Logout" : "Login";\n        authButton.classList.toggle("logout-button", connected);\n    }\n\n    function emitUIEvent''',
    '''    function syncConnectionUI(connected) {\n        profileMenuButton.hidden = !connected;\n        authButton.textContent = connected ? "Logout" : "Login";\n        authButton.classList.toggle("logout-button", connected);\n    }\n\n    function wait(milliseconds) {\n        return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));\n    }\n\n    function normalizedConnectionStatus(value = clockTimer.networkStatus) {\n        return value === "online" ? "online" : "offline";\n    }\n\n    function syncTripSettingsCloud(status = clockTimer.networkStatus) {\n        if (!tripSettingsCloud) return;\n        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);\n        tripSettingsCloud.dataset.networkStatus = normalized;\n        tripSettingsCloud.setAttribute("aria-busy", String(normalized === "pending"));\n        tripSettingsCloud.setAttribute(\n            "aria-label",\n            normalized === "pending"\n                ? "Checking connection"\n                : normalized === "online"\n                    ? "Connected"\n                    : "Offline. Retry connection"\n        );\n        tripSettingsCloud.setAttribute("aria-disabled", String(normalized !== "offline"));\n    }\n\n    function updateNumberPadConnectionStatus(token, status) {\n        const normalized = status === "pending" ? "pending" : normalizedConnectionStatus(status);\n        if (numberPadState?.connectionStatusToken === token) {\n            numberPadState.persistence = normalized;\n            refreshNumberPad();\n        }\n        for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {\n            const frame = uiReturnStack[index];\n            if (\n                frame?.type === "number-pad" &&\n                frame.state?.connectionStatusToken === token\n            ) {\n                frame.state.persistence = normalized;\n                break;\n            }\n        }\n    }\n\n    async function settleInitialNumberPadConnection(state, preparationPromise) {\n        const startedAt = performance.now();\n        try {\n            await Promise.resolve(preparationPromise);\n        }\n        catch {}\n        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);\n        if (remaining > 0) await wait(remaining);\n        updateNumberPadConnectionStatus(\n            state.connectionStatusToken,\n            clockTimer.networkStatus\n        );\n    }\n\n    async function resumeConnectionFromCloud({ numberPad = false } = {}) {\n        const startedAt = performance.now();\n        let token;\n\n        if (numberPad && numberPadState) {\n            token = numberPadState.connectionStatusToken || ++numberPadConnectionSequence;\n            numberPadState.connectionStatusToken = token;\n            updateNumberPadConnectionStatus(token, "pending");\n        }\n        syncTripSettingsCloud("pending");\n\n        if (!connectionResumePromise) {\n            connectionResumePromise = Promise.resolve()\n                .then(() => clockTimer.resumeConnection())\n                .catch(() => false)\n                .finally(() => {\n                    connectionResumePromise = undefined;\n                });\n        }\n\n        await connectionResumePromise;\n        const remaining = CONNECTION_INDICATOR_MINIMUM - (performance.now() - startedAt);\n        if (remaining > 0) await wait(remaining);\n\n        const status = normalizedConnectionStatus();\n        if (token) {\n            updateNumberPadConnectionStatus(token, status);\n        }\n        else {\n            const frame = findUIReturnFrame("number-pad");\n            if (frame?.state) frame.state.persistence = status;\n        }\n        syncTripSettingsCloud(status);\n        syncNetworkStatusUI();\n        return status === "online";\n    }\n\n    function emitUIEvent''',
    "connection indicator helpers",
)

# Keep the Trip Settings cloud synchronized whenever global connection UI updates.
replace_once(
    "app.js",
    '''        syncConnectionUI(\n            networkStatus === "online"\n        );\n\n        if (offline) {''',
    '''        syncConnectionUI(\n            networkStatus === "online"\n        );\n        syncTripSettingsCloud(networkStatus);\n\n        if (offline) {''',
    "sync trip settings cloud with network",
)

# Dynamic number pad refs.
replace_once(
    "app.js",
    '''                numberPadDisplay = $("#numberPadDisplay");\n                numberPadSettings = $("#numberPadSettings");\n                numberPadClear = $("#numberPadClear");''',
    '''                numberPadDisplay = $("#numberPadDisplay");\n                numberPadSettingsArea = $("#numberPadSettingsArea");\n                numberPadSettings = $("#numberPadSettings");\n                numberPadConnection = $("#numberPadConnection");\n                numberPadClear = $("#numberPadClear");''',
    "number pad loaded refs",
)

# Refresh uses wrapper status and gives the cloud its own accessible action.
replace_once(
    "app.js",
    '''        numberPadSettings.hidden = percentMode;\n        if (!percentMode) {\n            numberPadSettings.dataset.persistence = numberPadState.persistence || clockTimer.networkStatus;\n            numberPadSettings.setAttribute(\n                "aria-label",\n                numberPadSettings.dataset.persistence === "pending"\n                    ? "Trip settings; trip persistence pending"\n                    : numberPadSettings.dataset.persistence === "online"\n                        ? "Trip settings; trip persisted online"\n                        : "Trip settings; trip local and not persisted"\n            );\n        }''',
    '''        numberPadSettingsArea.hidden = percentMode;\n        if (!percentMode) {\n            const status = numberPadState.persistence || normalizedConnectionStatus();\n            numberPadSettingsArea.dataset.persistence = status;\n            numberPadSettings.setAttribute("aria-label", "Trip settings");\n            numberPadConnection.setAttribute(\n                "aria-label",\n                status === "pending"\n                    ? "Checking connection"\n                    : status === "online"\n                        ? "Connected"\n                        : "Offline. Retry connection"\n            );\n            numberPadConnection.setAttribute("aria-busy", String(status === "pending"));\n            numberPadConnection.setAttribute("aria-disabled", String(status !== "offline"));\n        }''',
    "number pad status refresh",
)

# New Trip/End Trip always show the gear for at least one second, regardless of immediate result.
replace_once(
    "app.js",
    '''            persistence: source === "new-trip"\n                ? (clockTimer.networkStatus === "online" ? "pending" : "offline")\n                : clockTimer.networkStatus,\n            tripDefaults,\n            startsTripOnConfirm: Boolean(startsTripOnConfirm)''',
    '''            persistence: source === "new-trip"\n                ? "pending"\n                : normalizedConnectionStatus(),\n            connectionStatusToken: ++numberPadConnectionSequence,\n            tripDefaults,\n            startsTripOnConfirm: Boolean(startsTripOnConfirm)''',
    "number pad initial pending status",
)
replace_once(
    "app.js",
    '''        if (preparationPromise) {\n            Promise.resolve(preparationPromise).then(result => {\n                if (numberPadState !== state) return;\n                state.persistence = result?.persisted ? "online" : "offline";\n                refreshNumberPad();\n            }).catch(() => {\n                if (numberPadState !== state) return;\n                state.persistence = "offline";\n                refreshNumberPad();\n            });\n        }''',
    '''        if (source === "new-trip") {\n            void settleInitialNumberPadConnection(\n                state,\n                preparationPromise ?? Promise.resolve()\n            );\n        }''',
    "minimum initial gear duration",
)

# Cloud click is separate from the gear/settings click.
replace_once(
    "app.js",
    '''        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;''',
    '''        numberPadConnection.addEventListener("click", () => {\n            if (\n                !numberPadState ||\n                numberPadState.mode === "percent" ||\n                numberPadSettingsArea.dataset.persistence !== "offline"\n            ) return;\n            void resumeConnectionFromCloud({ numberPad: true }).catch(() => {});\n        });\n\n        numberPadSettings.addEventListener("pointerup", () => {\n            if (!numberPadState || numberPadState.mode === "percent") return;''',
    "number pad cloud reconnect handler",
)

# Trip Settings cloud reflects state on each refresh and is clickable only while offline.
replace_once(
    "app.js",
    '''    function refreshTripSettingsValues() {\n        const live = tripIsLive();''',
    '''    function refreshTripSettingsValues() {\n        syncTripSettingsCloud();\n        const live = tripIsLive();''',
    "trip settings cloud refresh",
)
replace_once(
    "app.js",
    '''    tripSettingsDialog.addEventListener("opening", () => {\n        refreshTripSettingsValues();\n    });''',
    '''    tripSettingsDialog.addEventListener("opening", () => {\n        refreshTripSettingsValues();\n    });\n\n    tripSettingsCloud.addEventListener("click", () => {\n        if (tripSettingsCloud.dataset.networkStatus !== "offline") return;\n        void resumeConnectionFromCloud().catch(() => {});\n    });''',
    "trip settings cloud reconnect handler",
)

# CSS: number-pad settings becomes a wrapper with two independent buttons; add Trip Settings cloud.
css = Path("app.css").read_text()
css += r'''

/* Connection indicators */
.number-pad-settings {
    position: relative;
}

.number-pad-settings-control {
    appearance: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    display: grid;
    place-items: center;
    color: inherit;
    background: transparent;
    touch-action: manipulation;
}

.number-pad-persistence-badge {
    appearance: none;
    margin: 0;
    padding: 0;
    z-index: 2;
    color: var(--wm-white);
    cursor: default;
    touch-action: manipulation;
}

.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge {
    cursor: pointer;
}

.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge:hover,
.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge:focus-visible {
    box-shadow: 0 0 0 3px rgb(255 255 255 / 28%);
}

.trip-settings-heading {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.trip-settings-cloud {
    appearance: none;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    margin: 0;
    padding: 4px;
    border: 0;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: var(--wm-white);
    background: transparent;
    cursor: default;
}

.trip-settings-cloud::before {
    content: "";
    width: 26px;
    height: 26px;
    background: currentColor;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.trip-settings-cloud[data-network-status="online"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
}

.trip-settings-cloud[data-network-status="offline"] {
    color: rgb(255 255 255 / 78%);
    cursor: pointer;
}

.trip-settings-cloud[data-network-status="offline"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}

.trip-settings-cloud[data-network-status="offline"]:hover,
.trip-settings-cloud[data-network-status="offline"]:focus-visible {
    background: rgb(255 255 255 / 10%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 28%);
}

.trip-settings-cloud[data-network-status="pending"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    animation: trip-settings-cloud-pulse 700ms ease-in-out infinite alternate;
}

@keyframes trip-settings-cloud-pulse {
    from { opacity: 0.35; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
}
'''
Path("app.css").write_text(css)

# Static sanity checks.
checks = {
    "ClockTimer.js": [
        "async resumeConnection()",
        "return this.#ensureConnected();",
    ],
    "numberpad.html": [
        'id="numberPadSettingsArea"',
        'id="numberPadConnection"',
    ],
    "index.html": [
        'id="tripSettingsCloud"',
        "trip-settings-heading",
    ],
    "app.js": [
        "CONNECTION_INDICATOR_MINIMUM = 1000",
        "settleInitialNumberPadConnection",
        "resumeConnectionFromCloud",
        'numberPadConnection.addEventListener("click"',
        'tripSettingsCloud.addEventListener("click"',
        'persistence: source === "new-trip"',
    ],
    "app.css": [
        ".number-pad-settings-control",
        ".trip-settings-cloud",
        'data-network-status="offline"',
    ],
}
for path, required in checks.items():
    text = Path(path).read_text()
    for needle in required:
        if needle not in text:
            raise SystemExit(f"missing {needle!r} in {path}")
