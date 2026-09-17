from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def patch_app_js():
    path = Path("app.js")
    text = path.read_text()

    text = replace_once(
        text,
        '''    let connectionCloudSettleTimer;\n    let loginDialogFullyOpen = false;''',
        '''    let connectionCloudSettleTimer;\n    let loginDialogFullyOpen = false;\n    let clockTimerTapTimer;\n    let clockTimerLastTapAt = -Infinity;''',
        "ClockTimer tap state"
    )

    text = replace_once(
        text,
        '''    const NUMBER_PAD_DOUBLE_PRESS = 350;\n    const STARTUP_CONNECTION_DELAY = 2000;''',
        '''    const NUMBER_PAD_DOUBLE_PRESS = 350;\n    const CLOCK_TIMER_DOUBLE_PRESS = 350;\n    const STARTUP_CONNECTION_DELAY = 2000;''',
        "ClockTimer double press constant"
    )

    old_sync = '''            const animation =\n                element.animate(\n                    [\n                        {\n                            transform:\n                                `${prefix}rotateY(0deg)`\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(90deg)`,\n                            offset: 0.5\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(-90deg)`,\n                            offset: 0.5001\n                        },\n                        {\n                            transform:\n                                `${prefix}rotateY(0deg)`\n                        }\n                    ],\n                    {\n                        duration:\n                            CONNECTION_UI_TRANSITION_DURATION,\n                        easing: "linear"\n                    }\n                );'''
    new_sync = '''            const animation =\n                element.animate(\n                    [\n                        {\n                            transform:\n                                `${prefix}rotate(0deg)`\n                        },\n                        {\n                            transform:\n                                `${prefix}rotate(360deg)`\n                        }\n                    ],\n                    {\n                        duration:\n                            CONNECTION_UI_TRANSITION_DURATION,\n                        easing: "ease-in-out"\n                    }\n                );'''
    text = replace_once(text, old_sync, new_sync, "preserve Sync spin animation")

    old_retry = '''        let token;\n\n        if (\n            source === "number-pad" &&\n            numberPadState\n        ) {\n            token =\n                numberPadState.connectionStatusToken ||\n                ++numberPadConnectionSequence;\n\n            numberPadState.connectionStatusToken =\n                token;\n\n            updateNumberPadConnectionStatus(\n                token,\n                "pending",\n                { presentation: "retry" }\n            );\n        }\n\n        syncTripSettingsCloud("pending");\n        syncScopeConnectionCloud("pending");'''
    new_retry = '''        let token;\n\n        const visibleNumberPadOfflineCloud =\n            Boolean(\n                numberPadDialog?.open &&\n                numberPadState &&\n                numberPadConnection &&\n                !numberPadConnection.hidden &&\n                numberPadState.mode !== "percent" &&\n                numberPadSettingsArea?.dataset.persistence ===\n                    "offline"\n            );\n\n        if (\n            numberPadState &&\n            (\n                source === "number-pad" ||\n                visibleNumberPadOfflineCloud\n            )\n        ) {\n            token =\n                numberPadState.connectionStatusToken ||\n                ++numberPadConnectionSequence;\n\n            numberPadState.connectionStatusToken =\n                token;\n\n            updateNumberPadConnectionStatus(\n                token,\n                "pending",\n                { presentation: "retry" }\n            );\n        }\n\n        // Every visible offline cloud participates in the same retry\n        // presentation, regardless of which cloud started the retry.\n        syncTripSettingsCloud("pending");\n        syncScopeConnectionCloud("pending");'''
    text = replace_once(text, old_retry, new_retry, "animate every visible retry cloud")

    old_gesture = '''    clockTimer.addEventListener("pointerdown", () => {\n        const current =\n            clockTimer.getAttribute("timer-type") === "radial-fitted"\n                ? "radial-fitted"\n                : "radial-overflow";\n\n        const next =\n            current === "radial-overflow"\n                ? "radial-fitted"\n                : "radial-overflow";\n\n        clockTimer.setAttribute(\n            "timer-type",\n            next\n        );\n\n        const settings = getGraphicalSettings();\n        settings.timerType = next;\n        saveGraphicalSettings(settings);\n    });'''
    new_gesture = '''    function toggleClockTimerTypeFromTap() {\n        if (!tripIsLive()) return false;\n\n        const current =\n            clockTimer.getAttribute("timer-type") === "radial-fitted"\n                ? "radial-fitted"\n                : "radial-overflow";\n\n        const next =\n            current === "radial-overflow"\n                ? "radial-fitted"\n                : "radial-overflow";\n\n        clockTimer.setAttribute(\n            "timer-type",\n            next\n        );\n\n        const settings = getGraphicalSettings();\n        settings.timerType = next;\n        saveGraphicalSettings(settings);\n        return true;\n    }\n\n    function toggleClockTimerElapsedRemaining() {\n        if (!tripIsLive()) return false;\n\n        applyRenderedTimeMode(\n            clockTimer.renderedTimeMode === "elapsed"\n                ? "remaining"\n                : "elapsed"\n        );\n\n        return true;\n    }\n\n    clockTimer.addEventListener("pointerup", event => {\n        if (\n            event.pointerType === "mouse" &&\n            event.button !== 0\n        ) {\n            return;\n        }\n\n        if (!tripIsLive()) {\n            clearTimeout(clockTimerTapTimer);\n            clockTimerTapTimer = undefined;\n            clockTimerLastTapAt = -Infinity;\n            return;\n        }\n\n        const now = performance.now();\n\n        if (\n            clockTimerTapTimer !== undefined &&\n            now - clockTimerLastTapAt <=\n                CLOCK_TIMER_DOUBLE_PRESS\n        ) {\n            clearTimeout(clockTimerTapTimer);\n            clockTimerTapTimer = undefined;\n            clockTimerLastTapAt = -Infinity;\n            toggleClockTimerElapsedRemaining();\n            return;\n        }\n\n        if (clockTimerTapTimer !== undefined) {\n            clearTimeout(clockTimerTapTimer);\n        }\n\n        clockTimerLastTapAt = now;\n        clockTimerTapTimer = setTimeout(\n            () => {\n                clockTimerTapTimer = undefined;\n                clockTimerLastTapAt = -Infinity;\n                toggleClockTimerTypeFromTap();\n            },\n            CLOCK_TIMER_DOUBLE_PRESS\n        );\n    });'''
    text = replace_once(text, old_gesture, new_gesture, "deferred ClockTimer single/double tap")

    path.write_text(text.rstrip() + "\n")


def patch_app_css():
    path = Path("app.css")
    text = path.read_text()

    marker = "/* sync-disabled-strike-v2 */"
    if marker in text:
        raise SystemExit("sync strike CSS already present")

    normal_sync_mask = '''url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")'''

    text += f'''\n\n{marker}\n#syncGoalsMenuButton[aria-pressed="false"] {{\n    text-decoration-line: line-through;\n    text-decoration-thickness: 2px;\n    text-decoration-color: currentColor;\n}}\n\n.sync-goals-menu-icon {{\n    position: relative;\n}}\n\n.sync-goals-menu-icon[data-sync-state="disabled"]::before,\n.goal-sync-button[aria-pressed="false"]::before {{\n    -webkit-mask-image: {normal_sync_mask};\n    mask-image: {normal_sync_mask};\n}}\n\n.sync-goals-menu-icon[data-sync-state="disabled"]::after,\n.goal-sync-button[aria-pressed="false"]::after {{\n    content: "";\n    position: absolute;\n    left: 50%;\n    top: 50%;\n    width: 32px;\n    height: 3px;\n    border-radius: 999px;\n    background: var(--wm-red);\n    box-shadow: 0 0 1px rgb(0 0 0 / 55%);\n    transform: translate(-50%, -50%) rotate(45deg);\n    transform-origin: center;\n    pointer-events: none;\n}}\n'''

    path.write_text(text.rstrip() + "\n")


patch_app_js()
patch_app_css()
