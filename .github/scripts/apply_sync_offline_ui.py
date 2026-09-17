from pathlib import Path

APP = Path("app.js")
CSS = Path("app.css")

app = APP.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")

MARKER = "sync-offline-icon-state-v1"
if MARKER in app and MARKER in css:
    raise SystemExit(0)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


app = replace_once(
    app,
    """    let clockTimerTapTimer;\n    let clockTimerLastTapAt = -Infinity;\n""",
    """    let clockTimerTapTimer;\n    let clockTimerLastTapAt = -Infinity;\n    let syncNetworkStatus;\n    let syncOfflineTransitionSequence = 0;\n""",
    "sync network state declarations"
)

app = replace_once(
    app,
    """    const cloudIconTransitions = new WeakMap();\n    const syncIconAnimations = new WeakMap();\n""",
    """    const cloudIconTransitions = new WeakMap();\n    const syncIconAnimations = new WeakMap();\n    const offlineCloudAnimations = new WeakMap();\n""",
    "offline cloud animation map"
)

app = replace_once(
    app,
    """    function animateSyncGoalsIcons() {\n""",
    """    // sync-offline-icon-state-v1\n    function getSyncVisualElements() {\n        return [\n            syncGoalsMenuIcon,\n            goalSyncButton\n        ].filter(Boolean);\n    }\n\n    function ensureSyncOfflineOverlay(element) {\n        if (!element) return undefined;\n\n        let overlay =\n            element.querySelector(\n                \":scope > .sync-offline-overlay\"\n            );\n\n        if (!overlay) {\n            overlay =\n                document.createElement(\"span\");\n            overlay.className =\n                \"sync-offline-overlay\";\n            overlay.setAttribute(\n                \"aria-hidden\",\n                \"true\"\n            );\n            element.append(overlay);\n        }\n\n        return overlay;\n    }\n\n    function setSyncOfflineVisualState(state) {\n        for (const element of getSyncVisualElements()) {\n            ensureSyncOfflineOverlay(element);\n            element.dataset.syncNetworkState = state;\n        }\n    }\n\n    function clearSyncOfflineVisualState() {\n        syncOfflineTransitionSequence += 1;\n\n        for (const element of getSyncVisualElements()) {\n            delete element.dataset.syncNetworkState;\n        }\n    }\n\n    async function transitionSyncIconsOffline() {\n        const sequence =\n            ++syncOfflineTransitionSequence;\n\n        setSyncOfflineVisualState(\n            \"offline-prep\"\n        );\n        animateSyncGoalsIcons();\n\n        await wait(\n            CONNECTION_UI_TRANSITION_DURATION\n        );\n\n        if (\n            sequence !== syncOfflineTransitionSequence ||\n            normalizedConnectionStatus() !== \"offline\"\n        ) {\n            return;\n        }\n\n        setSyncOfflineVisualState(\n            \"offline-fading\"\n        );\n\n        await wait(\n            CONNECTION_UI_TRANSITION_DURATION\n        );\n\n        if (\n            sequence !== syncOfflineTransitionSequence ||\n            normalizedConnectionStatus() !== \"offline\"\n        ) {\n            return;\n        }\n\n        setSyncOfflineVisualState(\n            \"offline\"\n        );\n    }\n\n    function syncSyncIconConnectionState(status) {\n        const normalized =\n            normalizedConnectionStatus(status);\n\n        const previous =\n            syncNetworkStatus;\n\n        syncNetworkStatus =\n            normalized;\n\n        if (normalized === \"online\") {\n            clearSyncOfflineVisualState();\n            return;\n        }\n\n        if (previous === \"online\") {\n            void transitionSyncIconsOffline();\n            return;\n        }\n\n        if (previous === undefined) {\n            syncOfflineTransitionSequence += 1;\n            setSyncOfflineVisualState(\n                \"offline\"\n            );\n        }\n    }\n\n    function animateSyncGoalsIcons() {\n""",
    "sync offline icon helpers"
)

app = replace_once(
    app,
    """    function toggleSyncGoals() {\n        const enabled =\n""",
    """    function toggleSyncGoals() {\n        if (normalizedConnectionStatus() === \"offline\") {\n            animateOfflineClouds();\n        }\n\n        const enabled =\n""",
    "sync button offline cloud animation"
)

app = replace_once(
    app,
    """    function updateNumberPadConnectionStatus(token, status, { presentation } = {}) {\n""",
    """    function animateOfflineClouds() {\n        const candidates = [\n            {\n                element: scopeConnectionButton,\n                offline:\n                    scopeConnectionButton?.dataset.cloudState ===\n                        \"offline\"\n            },\n            {\n                element: tripSettingsCloud,\n                offline:\n                    tripSettingsCloud?.dataset.networkStatus ===\n                        \"offline\"\n            },\n            {\n                element: numberPadConnection,\n                offline:\n                    numberPadSettingsArea?.dataset.persistence ===\n                        \"offline\"\n            }\n        ];\n\n        for (const { element, offline } of candidates) {\n            if (!element || !offline) continue;\n\n            offlineCloudAnimations.get(\n                element\n            )?.cancel();\n\n            const animation =\n                element.animate(\n                    [\n                        { opacity: 1 },\n                        { opacity: 0.38 },\n                        { opacity: 1 }\n                    ],\n                    {\n                        duration:\n                            CONNECTION_UI_TRANSITION_DURATION,\n                        easing: \"ease-in-out\"\n                    }\n                );\n\n            offlineCloudAnimations.set(\n                element,\n                animation\n            );\n\n            animation.finished\n                .catch(() => {})\n                .finally(() => {\n                    if (\n                        offlineCloudAnimations.get(\n                            element\n                        ) === animation\n                    ) {\n                        offlineCloudAnimations.delete(\n                            element\n                        );\n                    }\n                });\n        }\n    }\n\n    function updateNumberPadConnectionStatus(token, status, { presentation } = {}) {\n""",
    "offline cloud animation helper"
)

app = replace_once(
    app,
    """    async function resumeConnectionFromCloud({ source = \"trip-settings\" } = {}) {\n        if (connectionCloudPhase !== \"settled\") {\n            return false;\n        }\n\n        const sequence =\n""",
    """    async function resumeConnectionFromCloud({ source = \"trip-settings\" } = {}) {\n        if (connectionCloudPhase !== \"settled\") {\n            return false;\n        }\n\n        animateOfflineClouds();\n\n        const sequence =\n""",
    "reconnect cloud animation trigger"
)

app = replace_once(
    app,
    """        const networkStatus =\n            clockTimer.networkStatus;\n\n        const offline =\n""",
    """        const networkStatus =\n            clockTimer.networkStatus;\n\n        syncSyncIconConnectionState(\n            networkStatus\n        );\n\n        const offline =\n""",
    "network-driven sync icon state"
)

app = replace_once(
    app,
    """        error.textContent = \"\";\n        loginPending = true;\n""",
    """        error.textContent = \"\";\n\n        if (normalizedConnectionStatus() === \"offline\") {\n            animateOfflineClouds();\n        }\n\n        loginPending = true;\n""",
    "login connect attempt cloud animation"
)

css_addition = r'''

/* sync-offline-icon-state-v1 */
.hamburger-button {
    background: var(--wm-blue-dark);
}

.app,
.app button,
.app output,
.app select {
    font-family: Helvetica, Arial, sans-serif;
    font-weight: 700;
}

.sync-offline-overlay {
    position: absolute;
    display: block;
    color: var(--wm-white);
    opacity: 0;
    pointer-events: none;
}

.sync-goals-menu-icon > .sync-offline-overlay {
    inset: 0;
}

.goal-sync-button > .sync-offline-overlay {
    left: 50%;
    top: 50%;
    width: 28px;
    height: 28px;
    transform: translate(-50%, -50%);
}

.sync-offline-overlay::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
}

.sync-offline-overlay::after {
    content: "";
    position: absolute;
    left: -2px;
    bottom: -2px;
    width: 13px;
    height: 13px;
    background: var(--wm-red);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 3l10 10M13 3 3 13' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 3l10 10M13 3 3 13' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 55%));
}

.sync-goals-menu-icon[data-sync-network-state],
.goal-sync-button[data-sync-network-state] {
    color: var(--wm-white);
}

.sync-goals-menu-icon[data-sync-network-state="offline-prep"]::after,
.sync-goals-menu-icon[data-sync-network-state="offline-fading"]::after,
.goal-sync-button[data-sync-network-state="offline-prep"]::after,
.goal-sync-button[data-sync-network-state="offline-fading"]::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 32px;
    height: 3px;
    border-radius: 999px;
    background: var(--wm-red);
    box-shadow: 0 0 1px rgb(0 0 0 / 55%);
    opacity: 1;
    transform: translate(-50%, -50%) rotate(45deg);
    transform-origin: center;
    pointer-events: none;
}

.sync-goals-menu-icon[data-sync-network-state="offline-fading"]::after,
.goal-sync-button[data-sync-network-state="offline-fading"]::after {
    opacity: 0;
    transition: opacity 750ms linear;
}

.sync-goals-menu-icon[data-sync-network-state="offline"]::after,
.goal-sync-button[data-sync-network-state="offline"]::after {
    opacity: 0;
}

.sync-goals-menu-icon[data-sync-network-state="offline-fading"] > .sync-offline-overlay,
.goal-sync-button[data-sync-network-state="offline-fading"] > .sync-offline-overlay {
    opacity: 1;
    transition: opacity 750ms linear;
}

.sync-goals-menu-icon[data-sync-network-state="offline"] > .sync-offline-overlay,
.goal-sync-button[data-sync-network-state="offline"] > .sync-offline-overlay {
    opacity: 1;
}
'''

css = css.rstrip() + css_addition + "\n"

APP.write_text(app, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
