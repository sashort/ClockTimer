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

    old_menu = '''        <nav id="mainMenu" class="main-menu" popover aria-label="Application menu">
            <button id="profileMenuButton" type="button" data-dialog="profileDialog" hidden>Profile</button>
            <button type="button" data-dialog="stateSettingsDialog">Trip Preferences</button>
            <button type="button" data-dialog="graphicalSettingsDialog">Clock Graphical Settings</button>
            <div class="main-menu-row trip-list-menu-row">
                <button id="tripListMenuButton" class="trip-list-menu-button" type="button">Trip Log</button>
                <button id="tripLogPinButton" class="menu-pin-button" type="button" aria-label="Unpin Trip Log" aria-pressed="true" title="Unpin Trip Log"></button>
            </div>
            <hr>
            <button id="authButton" type="button">Login</button>
        </nav>'''
    new_menu = '''        <nav id="mainMenu" class="main-menu" popover aria-label="Application menu">
            <button id="profileMenuButton" type="button" data-dialog="profileDialog" hidden>Profile</button>
            <button type="button" data-dialog="graphicalSettingsDialog">Clock/Timer Settings</button>
            <button id="syncGoalsMenuButton" class="sync-goals-menu-button" type="button" aria-pressed="false">Sync Goals</button>
            <div class="main-menu-row trip-list-menu-row">
                <button id="tripListMenuButton" class="trip-list-menu-button" type="button">Trip Log</button>
                <button id="tripLogPinButton" class="menu-pin-button" type="button" aria-label="Unpin Trip Log" aria-pressed="true" title="Unpin Trip Log"></button>
            </div>
            <label class="trip-log-range-menu" for="tripLogRangeSelect">
                <span>Trip Log Range</span>
                <select id="tripLogRangeSelect" aria-label="Trip Log Range">
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="pay-period">Pay Period</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                </select>
            </label>
            <hr>
            <button id="authButton" type="button">Login</button>
        </nav>'''
    text = replace_once(text, old_menu, new_menu, "hamburger menu")

    old_percent = '''            <div class="percent-summary" aria-live="polite">
                <strong id="currentPercentValue">---</strong>
                <span>/</span>
                <button id="goalPercentValue" class="percent-value-button" type="button" aria-label="Edit percent goal">100%</button>
            </div>'''
    new_percent = '''            <div class="percent-summary" aria-live="polite">
                <strong id="currentPercentValue">---</strong>
                <span>/</span>
                <button id="goalPercentValue" class="percent-value-button" type="button" aria-label="Edit percent goal">100%</button>
                <button id="goalSyncButton" class="goal-sync-button" type="button" aria-label="Enable Sync Goals" aria-pressed="false" hidden></button>
            </div>'''
    text = replace_once(text, old_percent, new_percent, "main percent summary sync button")

    old_trip_log = '''        <button id="tripLogButton" class="trip-log-button" type="button" aria-expanded="false">Trip Log</button>'''
    new_trip_log = '''        <button id="tripLogButton" class="trip-log-button" type="button" aria-expanded="false" aria-controls="tripLogBody">Trip Log</button>
        <button id="tripLogCloseButton" class="trip-log-close-button" type="button" aria-label="Close Trip Log" hidden></button>
        <section id="tripLogBody" class="trip-log-body" aria-label="Trip Log" hidden></section>'''
    text = replace_once(text, old_trip_log, new_trip_log, "Trip Log body shell")

    text = replace_once(
        text,
        "                <h2>Clock Graphical Settings</h2>",
        "                <h2>Clock/Timer Settings</h2>",
        "Clock/Timer Settings dialog heading"
    )

    text = replace_once(
        text,
        '                <label class="toggle-row">Match Trip Goal To Total<input name="matchTripGoalToTotal" type="checkbox"></label>\n',
        "",
        "remove old Match Trip Goal preference"
    )

    old_trip_preferences = '''            <fieldset id="tripSettingsPreferences" class="trip-settings-behavior">
                <legend>Trip Preferences</legend>
                <label id="tripGoalSyncOption" class="toggle-row trip-goal-sync-option">
                    <span class="trip-goal-sync-label">
                        <span class="trip-goal-sync-text">Match Trip Goal To Total</span>
                        <span id="tripGoalSyncNoData" class="trip-goal-sync-status" hidden>(No Data)</span>
                    </span>
                    <input name="autoSyncTripGoal" type="checkbox">
                </label>
            </fieldset>

'''
    text = replace_once(text, old_trip_preferences, "", "remove Trip Settings preferences")

    path.write_text(text.rstrip() + "\n")


def patch_app():
    path = Path("app.js")
    text = path.read_text()

    # Canonical current name only; no legacy aliases or migration paths.
    text = text.replace("matchTripGoalToTotal", "syncGoals")

    text = replace_once(
        text,
        '        tripLogPinned: "wmof.clock.tripLogPinned"\n',
        '        tripLogPinned: "wmof.clock.tripLogPinned",\n        tripLogRange: "wmof.clock.tripLogRange"\n',
        "Trip Log range storage key"
    )

    old_refs = '''    const tripListMenuButton = $("#tripListMenuButton");
    const tripLogPinButton = $("#tripLogPinButton");
    const tripLogButton = $("#tripLogButton");
    const autoGoalDialog = $("#autoGoalDialog");'''
    new_refs = '''    const tripListMenuButton = $("#tripListMenuButton");
    const tripLogPinButton = $("#tripLogPinButton");
    const tripLogRangeSelect = $("#tripLogRangeSelect");
    const syncGoalsMenuButton = $("#syncGoalsMenuButton");
    const tripLogButton = $("#tripLogButton");
    const tripLogCloseButton = $("#tripLogCloseButton");
    const tripLogBody = $("#tripLogBody");
    const goalSyncButton = $("#goalSyncButton");
    const autoGoalDialog = $("#autoGoalDialog");'''
    text = replace_once(text, old_refs, new_refs, "new menu/Trip Log element references")

    old_trip_refs = '''    const tripStartNowToggles = [...tripSettingsDialog.querySelectorAll("[data-trip-start-now-target]")];
    const tripGoalSyncOption = $("#tripGoalSyncOption");
    const tripGoalSyncNoData = $("#tripGoalSyncNoData");
    const tripSettingsPreferences = $("#tripSettingsPreferences");'''
    new_trip_refs = '''    const tripStartNowToggles = [...tripSettingsDialog.querySelectorAll("[data-trip-start-now-target]")];'''
    text = replace_once(text, old_trip_refs, new_trip_refs, "remove Trip Settings sync references")

    old_animation_state = '''    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;
    let activeSettingsHelpButton;
    let settingsHelpAnimation;
    let tripListButtonAnimation;'''
    new_animation_state = '''    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;
    const TRIP_LIST_BODY_DELAY = 350;
    const TRIP_LIST_MERGE_DURATION = 250;
    const TRIP_LOG_RANGES = new Set([
        "day",
        "week",
        "pay-period",
        "month",
        "year"
    ]);
    let activeSettingsHelpButton;
    let settingsHelpAnimation;
    let tripListButtonAnimation;
    let tripListBodyAnimationFrame;'''
    text = replace_once(text, old_animation_state, new_animation_state, "Trip Log animation state")

    old_storage = '''    function safeStorageSet(key, value) {
        try { localStorage.setItem(key, value); }
        catch {}
    }

'''
    new_storage = '''    function safeStorageSet(key, value) {
        try { localStorage.setItem(key, value); }
        catch {}
    }

    function normalizeTripLogRange(value) {
        const normalized =
            String(value || "day")
                .trim()
                .toLowerCase();

        return TRIP_LOG_RANGES.has(normalized)
            ? normalized
            : "day";
    }

    function getTripLogRange() {
        return normalizeTripLogRange(
            safeStorageGet(
                STORAGE.tripLogRange
            )
        );
    }

    function setTripLogRange(
        value,
        {
            persist = true,
            notify = true
        } = {}
    ) {
        const range =
            normalizeTripLogRange(value);

        if (tripLogRangeSelect) {
            tripLogRangeSelect.value =
                range;
        }

        if (persist) {
            safeStorageSet(
                STORAGE.tripLogRange,
                range
            );
        }

        if (notify) {
            window.dispatchEvent(
                new CustomEvent(
                    "wmof:trip-log-range-changed",
                    {
                        detail: {
                            range
                        }
                    }
                )
            );

            if (
                getTripListState() ===
                    "open"
            ) {
                dispatchTripListRequest(
                    "range"
                );
            }
        }

        return range;
    }

'''
    text = replace_once(text, old_storage, new_storage, "Trip Log range helpers")

    start = text.find("    async function openTripList(")
    end = text.find("    function getStoredJSON(", start)
    if start < 0 or end < 0:
        raise SystemExit("Trip Log lifecycle region not found")

    trip_log_lifecycle = '''    function getTripLogBodyRect() {
        const metrics =
            getAppContentMetrics();

        const topRect =
            getTripLogTopRect();

        const top =
            topRect.top +
            topRect.height;

        const bottom =
            metrics.rect.bottom -
            metrics.paddingBottom;

        return {
            left: metrics.left,
            top,
            width: metrics.width,
            height:
                Math.max(
                    0,
                    bottom - top
                )
        };
    }

    function setFloatingTripLogBodyRect(rect) {
        if (!tripLogBody || !rect) return;

        tripLogBody.style.left =
            `${rect.left}px`;

        tripLogBody.style.top =
            `${rect.top}px`;

        tripLogBody.style.width =
            `${rect.width}px`;

        tripLogBody.style.height =
            `${rect.height}px`;
    }

    function clearFloatingTripLogBodyRect() {
        if (!tripLogBody) return;

        tripLogBody.style.removeProperty(
            "left"
        );

        tripLogBody.style.removeProperty(
            "top"
        );

        tripLogBody.style.removeProperty(
            "width"
        );

        tripLogBody.style.removeProperty(
            "height"
        );
    }

    function positionTripLogCloseButton(
        rect = getTripLogTopRect()
    ) {
        if (!tripLogCloseButton || !rect) return;

        const width =
            52;

        const height =
            52;

        tripLogCloseButton.style.left =
            `${rect.left + rect.width - width - 8}px`;

        tripLogCloseButton.style.top =
            `${rect.top + (rect.height - height) / 2}px`;
    }

    function dispatchTripListRequest(
        source = "button"
    ) {
        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-request",
                {
                    detail: {
                        open: true,
                        source,
                        range:
                            getTripLogRange()
                    }
                }
            )
        );
    }

    function animateTripLogBody(
        target,
        opening
    ) {
        if (!tripLogBody || !target) {
            return Promise.resolve(false);
        }

        if (
            tripListBodyAnimationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                tripListBodyAnimationFrame
            );

            tripListBodyAnimationFrame =
                undefined;
        }

        const fullWidth =
            Math.max(
                0,
                target.width
            );

        const fullHeight =
            Math.max(
                0,
                target.height
            );

        const centerX =
            target.left +
            fullWidth / 2;

        const centerY =
            target.top +
            fullHeight / 2;

        if (
            fullWidth <= 0 ||
            fullHeight <= 0
        ) {
            setFloatingTripLogBodyRect(
                target
            );

            return Promise.resolve(true);
        }

        const edgeSpeed =
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
            );

        return new Promise(
            resolve => {
                let startedAt;

                const frame =
                    timestamp => {
                        if (
                            startedAt ===
                                undefined
                        ) {
                            startedAt =
                                timestamp;
                        }

                        const elapsed =
                            Math.min(
                                fullDuration,
                                timestamp -
                                    startedAt
                            );

                        const travelled =
                            edgeSpeed *
                            (
                                opening
                                    ? elapsed
                                    : fullDuration -
                                        elapsed
                            );

                        const halfWidth =
                            Math.min(
                                fullWidth / 2,
                                Math.max(
                                    0,
                                    travelled
                                )
                            );

                        const halfHeight =
                            Math.min(
                                fullHeight / 2,
                                Math.max(
                                    0,
                                    travelled
                                )
                            );

                        setFloatingTripLogBodyRect({
                            left:
                                centerX -
                                halfWidth,
                            top:
                                centerY -
                                halfHeight,
                            width:
                                halfWidth * 2,
                            height:
                                halfHeight * 2
                        });

                        if (elapsed >= fullDuration) {
                            tripListBodyAnimationFrame =
                                undefined;

                            if (opening) {
                                setFloatingTripLogBodyRect(
                                    target
                                );
                            }

                            resolve(true);
                            return;
                        }

                        tripListBodyAnimationFrame =
                            requestAnimationFrame(
                                frame
                            );
                    };

                tripListBodyAnimationFrame =
                    requestAnimationFrame(
                        frame
                    );
            }
        );
    }

    function showTripLogMerge() {
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
    }

    async function openTripList(source = "button") {
        if (
            !tripLogButton ||
            !tripLogBody ||
            getTripListState() !== "closed"
        ) {
            return false;
        }

        const pinned =
            tripLogIsPinned();

        const topRect =
            getTripLogTopRect();

        app.dataset.tripListState =
            "opening";

        tripLogButton.inert =
            true;

        tripLogButton.removeAttribute(
            "aria-hidden"
        );

        tripLogButton.setAttribute(
            "aria-expanded",
            "true"
        );

        if (pinned) {
            const sourceRect =
                tripLogButton.getBoundingClientRect();

            setFloatingTripLogRect(
                sourceRect
            );

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${topRect.top - sourceRect.top}px)`
            );
        }
        else {
            setFloatingTripLogRect(
                topRect
            );

            const distance =
                topRect.top +
                topRect.height +
                8;

            await animateTripLogButton(
                `translateY(-${distance}px)`,
                "translateY(0px)"
            );
        }

        setFloatingTripLogRect(
            topRect
        );

        await wait(
            TRIP_LIST_BODY_DELAY
        );

        const bodyRect =
            getTripLogBodyRect();

        tripLogBody.hidden =
            false;

        tripLogBody.inert =
            false;

        dispatchTripListRequest(
            source
        );

        await animateTripLogBody(
            bodyRect,
            true
        );

        app.dataset.tripListState =
            "open";

        showTripLogMerge();

        return true;
    }

    async function closeTripList(source = "close") {
        if (
            !tripLogButton ||
            !tripLogBody ||
            getTripListState() !== "open"
        ) {
            return false;
        }

        const pinned =
            tripLogIsPinned();

        const topRect =
            getTripLogTopRect();

        const bodyRect =
            getTripLogBodyRect();

        setFloatingTripLogRect(
            topRect
        );

        setFloatingTripLogBodyRect(
            bodyRect
        );

        app.dataset.tripListState =
            "closing";

        tripLogButton.inert =
            true;

        tripLogButton.setAttribute(
            "aria-expanded",
            "false"
        );

        tripLogBody.inert =
            true;

        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-closing",
                {
                    detail: {
                        open: false,
                        source,
                        pinned,
                        range:
                            getTripLogRange()
                    }
                }
            )
        );

        await hideTripLogMerge();

        await animateTripLogBody(
            bodyRect,
            false
        );

        tripLogBody.hidden =
            true;

        clearFloatingTripLogBodyRect();

        if (pinned) {
            const destination =
                getTripLogBottomRect();

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${destination.top - topRect.top}px)`
            );

            setFloatingTripLogRect(
                destination
            );
        }
        else {
            const distance =
                topRect.top +
                topRect.height +
                8;

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(-${distance}px)`
            );
        }

        app.dataset.tripListState =
            "closed";

        clearFloatingTripLogRect();

        setTripLogPinned(
            pinned,
            {
                persist: false
            }
        );

        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-closed",
                {
                    detail: {
                        open: false,
                        source,
                        pinned,
                        range:
                            getTripLogRange()
                    }
                }
            )
        );

        return true;
    }

'''
    text = text[:start] + trip_log_lifecycle + text[end:]

    pref_start = "    function getTripPreferences() {"
    pref_end = "    function getGraphicalSettings() {"
    prefs = '''    function getTripPreferences() {
        let stored = {};

        try {
            stored =
                JSON.parse(
                    safeStorageGet(
                        STORAGE.tripPreferences
                    ) ||
                        "{}"
                );
        }
        catch {}

        const lateBreakBehavior =
            stored.lateBreakBehavior ===
                "autoRestartTrip"
                ? "autoRestartTrip"
                : TRIP_PREFERENCE_DEFAULTS.lateBreakBehavior;

        return {
            lateBreakBehavior,
            syncGoals:
                Boolean(
                    stored.syncGoals ??
                    TRIP_PREFERENCE_DEFAULTS.syncGoals
                )
        };
    }

    function saveTripPreferences(preferences) {
        safeStorageSet(
            STORAGE.tripPreferences,
            JSON.stringify(
                preferences
            )
        );
    }

    function fillTripPreferencesForm(
        preferences = getTripPreferences()
    ) {
        const form =
            $("#stateSettingsForm");

        form.elements.lateBreakBehavior.value =
            preferences.lateBreakBehavior;
    }

    function getSyncGoalsState() {
        if (tripIsLive()) {
            return Boolean(
                clockTimer.autoSyncTripGoal
            );
        }

        if (
            tripSettingsSession?.values &&
            !tripSettingsSession.live
        ) {
            return Boolean(
                tripSettingsSession.values.syncGoals
            );
        }

        if (tripDraft) {
            return Boolean(
                tripDraft.syncGoals
            );
        }

        return Boolean(
            clockTimer.autoSyncTripGoal
        );
    }

    function getRenderedGoalScope() {
        try {
            const snapshot =
                clockTimer.getSummarySnapshot?.(
                    new Date()
                );

            if (snapshot?.scope) {
                return snapshot.scope;
            }
        }
        catch {}

        return clockTimer.percentMode === "total"
            ? "total"
            : clockTimer.percentMode === "auto"
                ? "standard"
                : "trip";
    }

    function renderSyncGoalsState(
        renderedScope = getRenderedGoalScope()
    ) {
        const enabled =
            getSyncGoalsState();

        for (
            const button of
                [
                    syncGoalsMenuButton,
                    goalSyncButton
                ]
        ) {
            if (!button) continue;

            button.setAttribute(
                "aria-pressed",
                String(enabled)
            );

            button.setAttribute(
                "aria-label",
                enabled
                    ? "Disable Sync Goals"
                    : "Enable Sync Goals"
            );

            button.title =
                enabled
                    ? "Sync Goals enabled"
                    : "Sync Goals disabled";
        }

        if (goalSyncButton) {
            goalSyncButton.hidden =
                renderedScope !==
                    "trip";
        }
    }

    function setSyncGoals(
        value,
        {
            persist = true
        } = {}
    ) {
        const enabled =
            Boolean(value);

        clockTimer.autoSyncTripGoal =
            enabled;

        if (tripDraft) {
            tripDraft.syncGoals =
                enabled;
        }

        if (
            tripSettingsSession?.values
        ) {
            tripSettingsSession.values.syncGoals =
                enabled;
        }

        if (persist) {
            saveTripPreferences({
                ...getTripPreferences(),
                syncGoals:
                    enabled
            });
        }

        renderSyncGoalsState();
        queueSummaryRefresh();

        return enabled;
    }

    function toggleSyncGoals() {
        return setSyncGoals(
            !getSyncGoalsState()
        );
    }

'''
    text = replace_region(text, pref_start, pref_end, prefs, "canonical Trip Preferences and Sync Goals")

    old_handlers = '''    tripLogPinButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            setTripLogPinned(
                !tripLogIsPinned()
            );
        }
    );

    tripListMenuButton?.addEventListener(
        "click",
        () => {
            mainMenu?.hidePopover?.();
            void openTripList("menu");
        }
    );

    tripLogButton?.addEventListener(
        "click",
        () => {
            void toggleTripList("button");
        }
    );
'''
    new_handlers = '''    tripLogPinButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            setTripLogPinned(
                !tripLogIsPinned()
            );
        }
    );

    tripLogRangeSelect?.addEventListener(
        "change",
        event => {
            setTripLogRange(
                event.currentTarget.value
            );
        }
    );

    syncGoalsMenuButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            toggleSyncGoals();
        }
    );

    goalSyncButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            toggleSyncGoals();
        }
    );

    tripListMenuButton?.addEventListener(
        "click",
        () => {
            mainMenu?.hidePopover?.();
            void openTripList("menu");
        }
    );

    tripLogButton?.addEventListener(
        "click",
        () => {
            if (
                getTripListState() ===
                    "closed"
            ) {
                void openTripList(
                    "button"
                );
            }
        }
    );

    tripLogCloseButton?.addEventListener(
        "click",
        () => {
            void closeTripList(
                "close"
            );
        }
    );
'''
    text = replace_once(text, old_handlers, new_handlers, "menu and Trip Log handlers")

    state_start = '    $("#stateSettingsForm").addEventListener("submit", event => {'
    state_end = '    $("#loginForm").addEventListener("submit", async event => {'
    state_handler = '''    $("#stateSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        const preferences = {
            ...getTripPreferences(),
            lateBreakBehavior:
                form.elements.lateBreakBehavior.value === "autoRestartTrip"
                    ? "autoRestartTrip"
                    : "showLateWindow"
        };
        saveTripPreferences(preferences);
        if (!tripIsLive() && !tripDraft) {
            clockTimer.intervalElapsedBehavior = "startLatency";
            clockTimer.autoRestartTripAfterLateBreak =
                preferences.lateBreakBehavior === "autoRestartTrip";
        }
        void closeDialogWithReturn(stateDialog, { reason: "state-settings-save" }).catch(() => {});
    });

'''
    text = replace_region(text, state_start, state_end, state_handler, "state settings submit without goal sync")

    text = replace_region(
        text,
        "    function getTripSettingsDerivedTotalGoalPercent(values) {",
        "    function refreshTripSettingsValues() {",
        "",
        "remove obsolete Trip Settings goal derivation display"
    )

    text = replace_region(
        text,
        "        const preferencesVisible = Boolean(draft || live);",
        "        tripSettingsPrimary.textContent =",
        "",
        "remove Trip Settings preferences rendering"
    )

    text = replace_region(
        text,
        '    tripSettingsForm.elements.autoSyncTripGoal.addEventListener("change", event => {',
        '    tripSettingsDialog.querySelectorAll("[data-trip-time-field]")',
        "",
        "remove Trip Settings sync checkbox listener"
    )

    old_submit_preamble = '''    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!tripSettingsSession) beginTripSettingsSession();
        if (tripSettingsSession) {
            tripSettingsSession.values.syncGoals =
                event.currentTarget.elements.autoSyncTripGoal.checked;
        }

'''
    new_submit_preamble = '''    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!tripSettingsSession) beginTripSettingsSession();

'''
    text = replace_once(text, old_submit_preamble, new_submit_preamble, "Trip Settings submit sync removal")

    old_summary_tail = '''        goalButton.setAttribute(
            "aria-label",
            clockTimer.percentMode === "auto"
                ? "Choose Trip or Total goal"
                : clockTimer.percentMode === "total"
                    ? "Edit Total goal"
                    : "Edit Trip goal"
        );
    }
'''
    new_summary_tail = '''        goalButton.setAttribute(
            "aria-label",
            clockTimer.percentMode === "auto"
                ? "Choose Trip or Total goal"
                : clockTimer.percentMode === "total"
                    ? "Edit Total goal"
                    : "Edit Trip goal"
        );

        renderSyncGoalsState(
            scope
        );
    }
'''
    text = replace_once(text, old_summary_tail, new_summary_tail, "main goal sync visibility")

    old_startup = '''    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    fillTripPreferencesForm(tripPreferences);
    clockTimer.intervalElapsedBehavior = "startLatency";
    clockTimer.autoRestartTripAfterLateBreak =
        tripPreferences.lateBreakBehavior === "autoRestartTrip";
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);'''
    new_startup = '''    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    fillTripPreferencesForm(tripPreferences);
    setTripLogRange(
        getTripLogRange(),
        {
            persist: false,
            notify: false
        }
    );
    clockTimer.intervalElapsedBehavior = "startLatency";
    clockTimer.autoRestartTripAfterLateBreak =
        tripPreferences.lateBreakBehavior === "autoRestartTrip";
    clockTimer.autoSyncTripGoal =
        tripPreferences.syncGoals;
    renderSyncGoalsState();
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);'''
    text = replace_once(text, old_startup, new_startup, "startup Sync Goals and Trip Log Range")

    path.write_text(text.rstrip() + "\n")


def patch_css():
    path = Path("app.css")
    text = path.read_text().rstrip()

    block = r'''

/* menu-sync-triplog-v1 */
.main-menu .trip-list-menu-row {
    border-radius: 10px;
    background: transparent;
    transition: background 180ms linear;
}

.main-menu .trip-list-menu-row:hover,
.main-menu .trip-list-menu-row:focus-within {
    background: linear-gradient(
        90deg,
        rgb(255 255 255 / 6%),
        rgb(139 213 255 / 18%),
        rgb(255 255 255 / 6%)
    );
}

.main-menu .trip-list-menu-row > button:hover,
.main-menu .trip-list-menu-row > button:focus-visible {
    background: transparent;
}

.trip-log-range-menu {
    margin: 2px 16px 8px 64px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    color: rgb(255 255 255 / 78%);
    font-size: 12px;
    font-weight: 600;
}

.trip-log-range-menu select {
    min-width: 0;
    margin: 0;
    padding: 5px 24px 5px 8px;
    border: 1px solid rgb(255 255 255 / 34%);
    border-radius: 7px;
    color: var(--wm-white);
    background: rgb(32 41 51 / 94%);
    font: inherit;
    font-size: 12px;
}

.main-menu [data-dialog="graphicalSettingsDialog"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10.2 4.1C5.8 4.8 3 8.1 3 12c0 4.9 4 8.9 8.9 8.9h1.2c1.5 0 2.7-1.2 2.7-2.7 0-1.4-1.1-2.5-2.5-2.5h-1.1c-1.1 0-2-.9-2-2s.9-2 2-2h2.4c.4 0 .9 0 1.3-.1' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='6.9' cy='11.4' r='1.1' fill='black'/%3E%3Ccircle cx='9.3' cy='7.6' r='1.1' fill='black'/%3E%3Cpath d='M18.1 2.2l.5 1.5 1.5.5 1.3-.7 1.1 1.1-.7 1.3.5 1.5 1.5.5v1.6l-1.5.5-.5 1.5.7 1.3-1.1 1.1-1.3-.7-1.5.5-.5 1.5h-1.6l-.5-1.5-1.5-.5-1.3.7-1.1-1.1.7-1.3-.5-1.5-1.5-.5V7.9l1.5-.5.5-1.5-.7-1.3 1.1-1.1 1.3.7 1.5-.5.5-1.5h1.6Z' fill='black'/%3E%3Ccircle cx='17.3' cy='8.7' r='2.1' fill='white'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10.2 4.1C5.8 4.8 3 8.1 3 12c0 4.9 4 8.9 8.9 8.9h1.2c1.5 0 2.7-1.2 2.7-2.7 0-1.4-1.1-2.5-2.5-2.5h-1.1c-1.1 0-2-.9-2-2s.9-2 2-2h2.4c.4 0 .9 0 1.3-.1' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='6.9' cy='11.4' r='1.1' fill='black'/%3E%3Ccircle cx='9.3' cy='7.6' r='1.1' fill='black'/%3E%3Cpath d='M18.1 2.2l.5 1.5 1.5.5 1.3-.7 1.1 1.1-.7 1.3.5 1.5 1.5.5v1.6l-1.5.5-.5 1.5.7 1.3-1.1 1.1-1.3-.7-1.5.5-.5 1.5h-1.6l-.5-1.5-1.5-.5-1.3.7-1.1-1.1.7-1.3-.5-1.5-1.5-.5V7.9l1.5-.5.5-1.5-.7-1.3 1.1-1.1 1.3.7 1.5-.5.5-1.5h1.6Z' fill='black'/%3E%3Ccircle cx='17.3' cy='8.7' r='2.1' fill='white'/%3E%3C/svg%3E");
}

#syncGoalsMenuButton::before,
.goal-sync-button::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2M5 5l14 14' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2M5 5l14 14' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

#syncGoalsMenuButton[aria-pressed="true"]::before,
.goal-sync-button[aria-pressed="true"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5.2 8.8A7.5 7.5 0 0 1 18 6.7L20.5 9M20.5 9V4.8M18.8 15.2A7.5 7.5 0 0 1 6 17.3L3.5 15M3.5 15v4.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

#syncGoalsMenuButton[aria-pressed="true"],
.goal-sync-button[aria-pressed="true"] {
    color: #8bd5ff;
}

.goal-sync-button {
    appearance: none;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    margin: 0 0 0 -4px;
    padding: 5px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: rgb(255 255 255 / 72%);
    background: transparent;
}

.goal-sync-button[hidden] {
    display: none;
}

.goal-sync-button::before {
    content: "";
    width: 28px;
    height: 28px;
    background: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.trip-log-button,
.trip-log-body {
    box-sizing: border-box;
    border: 3px solid rgb(255 255 255 / 38%);
    color: var(--wm-white);
    background: var(--ui-gray-gradient, var(--wm-gray));
    box-shadow: var(--ui-inner-highlight), 0 7px 16px rgb(0 0 0 / 24%);
}

.trip-log-button.trip-log-floating {
    transition:
        border-color var(--trip-list-merge-duration, 250ms) linear,
        border-radius var(--trip-list-merge-duration, 250ms) ease-in-out,
        color var(--trip-list-merge-duration, 250ms) linear,
        background var(--trip-list-merge-duration, 250ms) linear,
        box-shadow var(--trip-list-merge-duration, 250ms) linear;
}

.trip-log-body {
    position: fixed;
    z-index: 2999;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 14px;
    transform: none;
    transition:
        border-color var(--trip-list-merge-duration, 250ms) linear,
        border-radius var(--trip-list-merge-duration, 250ms) ease-in-out,
        background var(--trip-list-merge-duration, 250ms) linear;
    will-change: left, top, width, height;
}

.trip-log-body[hidden] {
    display: none;
}

.trip-log-button.trip-log-merged,
.trip-log-body.trip-log-merged {
    background: var(--ui-charcoal-gradient, #2f3943);
}

.trip-log-button.trip-log-merged {
    border-bottom-color: transparent;
    border-radius: 14px 14px 0 0;
}

.trip-log-body.trip-log-merged {
    border-top-color: transparent;
    border-radius: 0 0 14px 14px;
}

.trip-log-close-button {
    appearance: none;
    position: fixed;
    z-index: 3002;
    width: 52px;
    height: 52px;
    margin: 0;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--wm-white);
    background: transparent;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--trip-list-merge-duration, 250ms) linear;
}

.trip-log-close-button[hidden] {
    display: none;
}

.trip-log-close-button.is-visible {
    opacity: 1;
    pointer-events: auto;
}

.trip-log-close-button::before {
    content: "";
    width: 30px;
    height: 30px;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
}
'''

    if "/* menu-sync-triplog-v1 */" in text:
        raise SystemExit("menu-sync-triplog-v1 already present")

    path.write_text(text + block + "\n")


def main():
    patch_index()
    patch_app()
    patch_css()


if __name__ == "__main__":
    main()
