from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return updated


def patch_index():
    path = Path("index.html")
    text = path.read_text()
    text = replace_once(
        text,
        'class="app is-offline" data-state="offline" data-trip-state="ready" data-trip-log-pinned="true" data-trip-grayscale-ramp="250"',
        'class="app" data-state="offline" data-trip-state="ready" data-trip-log-pinned="true"',
        "remove startup grayscale state",
    )
    path.write_text(text.rstrip() + "\n")


def patch_app():
    path = Path("app.js")
    text = path.read_text()

    text = replace_once(
        text,
        "    let loginPromptTimeout;\n    let grayscaleReleaseTimeout;\n    let loginPending = false;",
        "    let loginPromptTimeout;\n    let loginPending = false;",
        "remove grayscale timeout",
    )
    text = replace_once(
        text,
        "    const STARTUP_CONNECTION_DELAY = 2000;\n    const STARTUP_GRAYSCALE_RAMP = 2000;\n    const CONNECTION_UI_TRANSITION_DURATION = 750;",
        "    const STARTUP_CONNECTION_DELAY = 2000;\n    const CONNECTION_UI_TRANSITION_DURATION = 750;",
        "remove grayscale duration",
    )
    text = replace_once(
        text,
        "    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;\n    const TRIP_LIST_BODY_DELAY = 350;\n    const TRIP_LIST_BODY_DURATION = 1000;\n    const TRIP_LIST_MERGE_DURATION = 750;",
        "    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;\n    const TRIP_LIST_BODY_DELAY = 350;\n    const TRIP_LIST_BODY_DURATION = 1000;\n    const TRIP_LIST_MERGE_DURATION = 750;\n    const TRIP_LIST_CLOSE_BUTTON_DURATION = 350;\n    const TRIP_LIST_CLOSE_BODY_DELAY = 125;\n    const TRIP_LIST_CLOSE_BODY_DURATION = 425;\n    const TRIP_LIST_CLOSE_MERGE_DURATION = 300;",
        "add compressed Trip Log close timing",
    )
    text = replace_once(
        text,
        "    const cloudIconTransitions = new WeakMap();\n    const buttonPressStates = new WeakMap();",
        "    const cloudIconTransitions = new WeakMap();\n    const syncIconAnimations = new WeakMap();\n    const buttonPressStates = new WeakMap();",
        "add sync animation tracking",
    )

    text = replace_once(
        text,
        "    async function animateTripLogButton(fromTransform, toTransform) {",
        "    async function animateTripLogButton(\n        fromTransform,\n        toTransform,\n        duration = TRIP_LIST_BUTTON_TRANSITION_DURATION\n    ) {",
        "parameterize Trip Log button duration",
    )
    text = replace_once(
        text,
        "                    duration: TRIP_LIST_BUTTON_TRANSITION_DURATION,",
        "                    duration,",
        "use Trip Log button duration",
    )
    text = replace_once(
        text,
        "    function animateTripLogBody(\n        target,\n        opening\n    ) {",
        "    function animateTripLogBody(\n        target,\n        opening,\n        duration = TRIP_LIST_BODY_DURATION\n    ) {",
        "parameterize Trip Log body duration",
    )
    text = replace_once(
        text,
        "        const fullDuration =\n            TRIP_LIST_BODY_DURATION;",
        "        const fullDuration =\n            Math.max(1, duration);",
        "use Trip Log body duration",
    )

    old_merge = '''    function showTripLogMerge() {
        if (
            !tripLogButton ||
            !tripLogBody ||
            !tripLogCloseButton
        ) {
            return;
        }

        tripLogButton.classList.add(
            "trip-log-merged"
        );

        tripLogBody.classList.add(
            "trip-log-merged"
        );

        positionTripLogCloseButton();

        tripLogCloseButton.hidden =
            false;

        requestAnimationFrame(
            () => {
                if (
                    tripListIsActive()
                ) {
                    tripLogCloseButton.classList.add(
                        "is-visible"
                    );
                }
            }
        );
    }

    async function hideTripLogMerge() {
        tripLogCloseButton?.classList.remove(
            "is-visible"
        );

        tripLogButton?.classList.remove(
            "trip-log-merged"
        );

        tripLogBody?.classList.remove(
            "trip-log-merged"
        );

        await wait(
            TRIP_LIST_MERGE_DURATION
        );

        if (tripLogCloseButton) {
            tripLogCloseButton.hidden =
                true;
        }
    }'''
    new_merge = '''    function setTripLogMergeDuration(duration) {
        const value =
            `${Math.max(0, duration)}ms`;

        for (
            const element of
                [
                    tripLogButton,
                    tripLogBody,
                    tripLogCloseButton
                ]
        ) {
            element?.style.setProperty(
                "--trip-list-merge-duration",
                value
            );
        }
    }

    function clearTripLogMergeDuration() {
        for (
            const element of
                [
                    tripLogButton,
                    tripLogBody,
                    tripLogCloseButton
                ]
        ) {
            element?.style.removeProperty(
                "--trip-list-merge-duration"
            );
        }
    }

    function showTripLogMerge() {
        if (
            !tripLogButton ||
            !tripLogBody ||
            !tripLogCloseButton
        ) {
            return;
        }

        clearTripLogMergeDuration();

        tripLogButton.classList.add(
            "trip-log-merged"
        );

        tripLogBody.classList.add(
            "trip-log-merged"
        );

        positionTripLogCloseButton();

        tripLogCloseButton.hidden =
            false;

        requestAnimationFrame(
            () => {
                if (
                    tripListIsActive()
                ) {
                    tripLogCloseButton.classList.add(
                        "is-visible"
                    );
                }
            }
        );
    }

    async function hideTripLogMerge(
        duration = TRIP_LIST_MERGE_DURATION
    ) {
        setTripLogMergeDuration(
            duration
        );

        tripLogCloseButton?.classList.remove(
            "is-visible"
        );

        tripLogButton?.classList.remove(
            "trip-log-merged"
        );

        tripLogBody?.classList.remove(
            "trip-log-merged"
        );

        await wait(
            duration
        );

        if (tripLogCloseButton) {
            tripLogCloseButton.hidden =
                true;
        }

        clearTripLogMergeDuration();
    }'''
    text = replace_once(text, old_merge, new_merge, "compressible Trip Log merge")

    text = replace_once(
        text,
        "        await hideTripLogMerge();\n\n        await animateTripLogBody(\n            bodyRect,\n            false\n        );",
        "        await hideTripLogMerge(\n            TRIP_LIST_CLOSE_MERGE_DURATION\n        );\n\n        await animateTripLogBody(\n            bodyRect,\n            false,\n            TRIP_LIST_CLOSE_BODY_DURATION\n        );",
        "compressed Trip Log close merge/body",
    )
    text = replace_once(
        text,
        "        await wait(\n            TRIP_LIST_BODY_DELAY\n        );\n\n        if (pinned) {",
        "        await wait(\n            TRIP_LIST_CLOSE_BODY_DELAY\n        );\n\n        if (pinned) {",
        "compressed Trip Log close delay",
    )
    text = replace_once(
        text,
        "            await animateTripLogButton(\n                \"translateY(0px)\",\n                `translateY(${destination.top - topRect.top}px)`\n            );",
        "            await animateTripLogButton(\n                \"translateY(0px)\",\n                `translateY(${destination.top - topRect.top}px)`,\n                TRIP_LIST_CLOSE_BUTTON_DURATION\n            );",
        "compressed pinned Trip Log return",
    )
    text = replace_once(
        text,
        "            await animateTripLogButton(\n                \"translateY(0px)\",\n                `translateY(-${distance}px)`\n            );",
        "            await animateTripLogButton(\n                \"translateY(0px)\",\n                `translateY(-${distance}px)`,\n                TRIP_LIST_CLOSE_BUTTON_DURATION\n            );",
        "compressed unpinned Trip Log return",
    )

    old_scope = '''        const mode =
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
            );'''
    new_scope = '''        const normalized =
            getConnectionVisualStatus(status);

        const transitionActive =
            connectionCloudPhase !== "settled";

        const visible =
            normalized !== "online" ||
            transitionActive;'''
    text = replace_once(text, old_scope, new_scope, "show offline cloud in Trip mode")

    network_pattern = r'''    function syncNetworkStatusUI\([^)]*\) \{.*?\n    \}\n\n    function normalizePercentMode'''
    network_replacement = '''    function syncNetworkStatusUI() {
        clearTimeout(loginPromptTimeout);
        loginPromptTimeout = undefined;

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
            void closeDialogWithReturn(
                loginDialog,
                { reason: "login-connected" }
            ).catch(() => {});
        }
    }

    function normalizePercentMode'''
    text = sub_once(text, network_pattern, network_replacement, "remove offline grayscale logic")

    grayscale_pattern = r'''    function tripGrayscaleRamp\(\) \{.*?\n    \}\n\n    function syncTripGrayscale\(running = tripIsLive\(\)\) \{.*?\n    \}\n\n    function setTripControlState'''
    text = sub_once(
        text,
        grayscale_pattern,
        "    function setTripControlState",
        "remove trip grayscale helpers",
    )
    text = replace_once(
        text,
        "        app.dataset.state = clockTimer.status;\n        syncTripGrayscale(running);\n        activeTripControls.hidden = !running;",
        "        app.dataset.state = clockTimer.status;\n        activeTripControls.hidden = !running;",
        "remove trip grayscale state sync",
    )

    old_sync_icon = '''        if (syncGoalsMenuIcon) {
            const nextState =
                enabled
                    ? "enabled"
                    : "disabled";

            const animate =
                syncGoalsMenuIcon.dataset.syncInitialized ===
                    "true";

            setCloudIconVisualState(
                syncGoalsMenuIcon,
                () => syncGoalsMenuIcon.dataset.syncState,
                value => { syncGoalsMenuIcon.dataset.syncState = value; },
                nextState,
                { animate }
            );

            syncGoalsMenuIcon.dataset.syncInitialized =
                "true";
        }'''
    new_sync_icon = '''        if (syncGoalsMenuIcon) {
            syncGoalsMenuIcon.dataset.syncState =
                enabled
                    ? "enabled"
                    : "disabled";
        }'''
    text = replace_once(text, old_sync_icon, new_sync_icon, "prepare sync icon for spin animation")

    old_toggle = '''    function toggleSyncGoals() {
        return setSyncGoals(
            !getSyncGoalsState()
        );
    }'''
    new_toggle = '''    function animateSyncGoalsIcons() {
        for (
            const element of
                [
                    syncGoalsMenuIcon,
                    goalSyncButton
                ]
        ) {
            if (!element || element.hidden) continue;

            syncIconAnimations.get(
                element
            )?.cancel();

            const anchored =
                element === goalSyncButton;

            const prefix =
                anchored
                    ? "translateY(-50%) "
                    : "";

            const animation =
                element.animate(
                    [
                        {
                            transform:
                                `${prefix}rotate(0deg)`
                        },
                        {
                            transform:
                                `${prefix}rotate(360deg)`
                        }
                    ],
                    {
                        duration:
                            CONNECTION_UI_TRANSITION_DURATION,
                        easing: "ease-in-out"
                    }
                );

            syncIconAnimations.set(
                element,
                animation
            );

            animation.finished
                .catch(() => {})
                .finally(() => {
                    if (
                        syncIconAnimations.get(
                            element
                        ) === animation
                    ) {
                        syncIconAnimations.delete(
                            element
                        );
                    }
                });
        }
    }

    function toggleSyncGoals() {
        const enabled =
            setSyncGoals(
                !getSyncGoalsState()
            );

        animateSyncGoalsIcons();

        return enabled;
    }'''
    text = replace_once(text, old_toggle, new_toggle, "spin sync icons on toggle")

    path.write_text(text.rstrip() + "\n")


def patch_css():
    path = Path("app.css")
    text = path.read_text()

    text = replace_once(
        text,
        '''    overflow: hidden;
    transition:
        filter var(--app-grayscale-ramp, 2000ms) linear,
        grid-template-rows var(--trip-log-layout-duration) ease-in-out;''',
        '''    overflow: hidden;
    transition:
        grid-template-rows var(--trip-log-layout-duration) ease-in-out;''',
        "remove app grayscale transition",
    )
    text = replace_once(
        text,
        '\n.app.is-offline { filter: grayscale(1); }\n',
        '\n',
        "remove app offline grayscale",
    )
    text = replace_once(
        text,
        '''.hand-caption {
    width: min(120px, 100%);''',
        '''.hand-caption {
    width: min(128px, 100%);''',
        "widen hand caption alignment box",
    )
    text = replace_once(
        text,
        '''.hand-caption > span {
    min-width: 0;
}''',
        '''.hand-caption > span {
    min-width: 0;
    white-space: nowrap;
}''',
        "prevent hand label wrapping",
    )

    text = replace_once(
        text,
        '''.scope-toggle {
    width: 100%;
    height: 100%;
    padding-inline: 44px;
    text-align: center;
}''',
        '''.scope-toggle {
    width: 100%;
    height: 100%;
    padding-inline: 48px;
    text-align: center;
}''',
        "reserve symmetric space for larger cloud",
    )
    text = replace_once(
        text,
        '''.scope-connection-button,
.goal-sync-button {
    width: 32px;
    height: 32px;
    padding: 6px;
    border: 0;
    border-radius: 50%;
    font-size: 20px;
}''',
        '''.scope-connection-button,
.goal-sync-button {
    width: 40px;
    height: 40px;
    padding: 6px;
    border: 0;
    border-radius: 50%;
    font-size: 24px;
}''',
        "enlarge main connection controls",
    )
    text = replace_once(
        text,
        '''.scope-connection-button {
    position: absolute;
    top: 10px;
    right: 8px;''',
        '''.scope-connection-button {
    position: absolute;
    top: 6px;
    right: 6px;''',
        "align larger cloud",
    )
    text = replace_once(
        text,
        '''.scope-connection-button::before,
.goal-sync-button::before {
    width: 20px;
    height: 20px;
}''',
        '''.scope-connection-button::before,
.goal-sync-button::before {
    width: 28px;
    height: 28px;
    filter:
        drop-shadow(0.65px 0 0 currentColor)
        drop-shadow(-0.65px 0 0 currentColor)
        drop-shadow(0 0.65px 0 currentColor)
        drop-shadow(0 -0.65px 0 currentColor);
}''',
        "bold main cloud and sync icons",
    )
    text = replace_once(
        text,
        '''.goal-sync-button {
    position: absolute;
    top: 50%;
    right: 8px;''',
        '''.goal-sync-button {
    position: absolute;
    top: 50%;
    right: 6px;''',
        "align larger sync icon",
    )

    path.write_text(text.rstrip() + "\n")


patch_index()
patch_app()
patch_css()
