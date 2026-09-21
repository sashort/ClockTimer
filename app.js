(() => {
    "use strict";

    const API_BASE = "https://wmof.sashort-apps.com/";
    const calendarRanges = new CalendarRange({baseUrl: API_BASE, databaseOnly: true,
        profile: document.documentElement.dataset.calendarProfile || "walmart-us"});
    let tripLogRequestSequence = 0;
    let tripTotalsRefreshQueue = Promise.resolve();
    const STORAGE = {
        percentMode: "wmof.clock.percentMode",
        renderedTimeMode: "wmof.clock.renderedTimeMode",
        graphicalSettings: "wmof.clock.graphicalSettings",
        tripPreferences: "wmof.clock.tripPreferences",
        tripLogPinned: "wmof.clock.tripLogPinned",
        tripLogRange: "wmof.clock.tripLogRange",
        tripLogIncludeCurrent: "wmof.clock.tripLogIncludeCurrent",
        customTripLogDates: "wmof.clock.customTripLogDates"
    };

    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
    const PERCENT_MODES = ["trip", "total", "auto"];
    const TRIP_PREFERENCE_DEFAULTS = {
        lateBreakBehavior: "showLateWindow",
        syncGoals: false
    };
    const GRAPHICAL_DEFAULTS = {
        timerType: "radial-overflow",
        timerMode: "elapsed",
        tripColor: "#0053e2",
        earlyStartColor: "#4dbdf5",
        showEarlyStart: true,
        breakColor: "#001e60",
        lunchColor: "#ffc220",
        breakBufferColor: "#6b7f99",
        showBreakBuffer: true,
        downColor: "#5f6772",
        approvalSurplusColor: "#9c6b30",
        approvalDeficitColor: "#7a1f3d",
        toleranceColor: "#2e7d32",
        latencyColor: "#e1251b",
        showTolerance: true,
        showLatency: true,
        militaryTime: true,
        timeFormat: "HHmm",
        dateFormat: "",
        visibleHours: "12,3,6,9",
        tickMarks: "[10]",
        indicatorSymbol: "▲",
        showHourHand: true,
        showMinuteHand: true,
        showSecondHand: true,
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
    const GRAPHICAL_HELP = {
        timerMode: {
            title: "Timer Mode",
            text: "Elapsed fills the timer as counted time passes. Remaining begins full and decreases toward zero."
        },
        timerType: {
            title: "Timer Type",
            text: "Radial Overflow preserves the clock’s normal minute scale. The ring starts at the minute mark where the trip began, follows the clock face, and continues into additional rings when the timeframe exceeds the available circle. Radial Fitted starts at the top of the clock and visually compresses the entire trip timeframe into one complete ring, with each range sized in proportion to its share of the trip."
        },
        tripColor: {title: "Trip Color", text: "The productive portion of the active trip uses this color."},
        earlyStartColor: {title: "Early Start Color", text: "Sets the color for time worked before the scheduled start.", stateControl: "showEarlyStart", stateText: {true: "Early Start uses this color.", false: "The adjacent Trip range extends through Early Start and uses the Trip color."}},
        lunchColor: {title: "Lunch Color", text: "Lunch intervals use this color and do not count as productive trip time."},
        breakColor: {title: "Break Color", text: "Break intervals use this color and pause productive elapsed time."},
        breakBufferColor: {title: "Break Buffer Color", text: "Sets the color for the allowed buffer around a break or lunch.", stateControl: "showBreakBuffer", stateText: {true: "The buffer is shown with this color.", false: "The adjacent interval extends across the buffer."}},
        downColor: {title: "Down Color", text: "Down-time intervals use this color while productive elapsed time is paused."},
        approvalSurplusColor: {title: "Approval Surplus Color", text: "Approval Surplus is extra approved Down time that remains excluded after Down ends."},
        approvalDeficitColor: {title: "Approval Deficit Color", text: "Approval Deficit is the unapproved portion of a Down interval and counts as productive elapsed time."},
        toleranceColor: {title: "Tolerance Color", text: "Sets the color for the time allowed around a goal boundary.", stateControl: "showTolerance", stateText: {true: "Tolerance is always shown.", false: "The underlying Trip range extends through tolerance.", undefined: "Clock/Timer decides when the tolerance range is useful."}},
        latencyColor: {title: "Latency Color", text: "Sets the color for late time as it consumes the following Trip range.", stateControl: "showLatency", stateText: {true: "Latency is shown with this color.", false: "Latency is still calculated while the underlying Trip range remains visible."}},
        hourHandColor: {title: "Hour Hand Color", text: "Sets the hour hand color.", stateControl: "showHourHand", stateText: {true: "The hour hand is visible.", false: "The hour hand is hidden."}},
        minuteHandColor: {title: "Minute Hand Color", text: "Sets the minute hand color.", stateControl: "showMinuteHand", stateText: {true: "The minute hand is visible.", false: "The minute hand is hidden."}},
        secondHandColor: {title: "Second Hand Color", text: "Sets the second hand color.", stateControl: "showSecondHand", stateText: {true: "The second hand is visible.", false: "The second hand is hidden."}},
        hourColor: {title: "Hour Number Color", text: "Sets the color of the hour numbers and tick marks."},
        timeColor: {title: "Current Time Color", text: "Sets the color of the current time displayed in the center of the clock."}
    };

    const $ = selector => document.querySelector(selector);
    const clockTimer = $("#clockTimer");
    const clockPreview = $("#clockPreview");
    const app = $("#app");
    const loginDialog = $("#loginDialog");
    const profileDialog = $("#profileDialog");
    let signedInProfile;
    function populateProfile(user = signedInProfile) {
        if (!user) return;
        signedInProfile = user;
        for (const [id, field] of [["profileUsername", "username"], ["firstName", "first_name"],
            ["lastName", "last_name"], ["preferredName", "preferred_name"]]) {
            $("#" + id).value = user[field] ?? "";
        }
        const permissions=Number(user.permissions)||0;$("#adminMenuGroup").hidden=permissions===0;$("#newUserButton").hidden=!(permissions&5);
    }
    profileDialog.addEventListener("opening", () => populateProfile());
    const graphicalDialog = $("#graphicalSettingsDialog");
    const stateDialog = $("#stateSettingsDialog");
    const profileMenuButton = $("#profileMenuButton");
    const authButton = $("#authButton");
    const mainMenu = $("#mainMenu");
    const scopeToggle = $("#scopeToggle");
    const scopeConnectionButton = $("#scopeConnectionButton");
    const tripListMenuButton = $("#tripListMenuButton");
    const tripLogPinButton = $("#tripLogPinButton");
    const tripLogRangeSelect = $("#tripLogRangeSelect");
    const tripLogStartDate = $("#tripLogStartDate");
    const tripLogEndDate = $("#tripLogEndDate");
    const tripLogRangeError = $("#tripLogRangeError");
    let tripRangeRevision = 0;
    const syncGoalsMenuButton = $("#syncGoalsMenuButton");
    const syncGoalsMenuIcon = syncGoalsMenuButton?.querySelector(".sync-goals-menu-icon");
    const tripLogButton = $("#tripLogButton");
    const tripLogCloseButton = $("#tripLogCloseButton");
    const tripLogSettingsButton = $("#tripLogSettingsButton");
    let tripLogSettingsVisible = false;
    const tripLogBody = $("#tripLogBody");
    const goalSyncButton = $("#goalSyncButton");
    const autoGoalDialog = $("#autoGoalDialog");
    const autoTripGoalValue = $("#autoTripGoalValue");
    const autoTotalGoalValue = $("#autoTotalGoalValue");
    const activeTripControls = $("#activeTripControls");
    const endTripButton = $("#endTripButton");
    const tripActionRow = $(".trip-action-row");
    const breakButton = $("#breakButton");
    const downButton = $("#downButton");
    const downTripControls = $("#downTripControls");
    const downElapsedValue = $("#downElapsedValue");
    const downDetailsButton = $("#downDetailsButton");
    const downBreakButton = $("#downBreakButton");
    const downResumeButton = $("#downResumeButton");
    const downCancelButton = $("#downCancelButton");
    const breakDialog = $("#breakDialog");
    const scheduledStartDialog = $("#scheduledStartDialog");
    const scheduledStartCountdown = $("#scheduledStartCountdown");
    const scheduledStartStandard = $("#scheduledStartStandard");
    const scheduledStartStandardValue = $("#scheduledStartStandardValue");
    const scheduledStartAuto = $("#scheduledStartAuto");
    const scheduledStartAutoOption = $("#scheduledStartAutoOption");
    const scheduledStartMessage = $("#scheduledStartMessage");
    const scheduledStartNow = $("#scheduledStartNow");
    const scheduledStartOnTime = $("#scheduledStartOnTime");
    const scheduledStartCancel = $("#scheduledStartCancel");
    const scheduledStartClose = $("#scheduledStartClose");
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

    let timerStartedAt = 0;
    let timerAccumulated = 0;
    let timerInterval;
    let loginPromptTimeout;
    let loginPending = false;
    let stagedStandardTime;
    let tripDraft;
    let tripSettingsSession;
    let tripStartsNowState;
    let tripStartsNowExiting = false;
    let tripStartsNowExitTimer;
    let scheduledStartTicker;
    let scheduledStartAutoArmed = false;
    let scheduledStartNeedsResolution = false;
    let scheduledStartReturnMode;
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
    let deliberatelyLoggedOut = safeStorageGet("wmof.deliberatelyLoggedOut") === "true";
    let initialLoginAttemptPending = true;
    let numberPadConnectionSequence = 0;
    let connectionResumePromise;
    let connectionCloudPhase = "settled";
    let connectionCloudSequence = 0;
    let connectionCloudSettleTimer;
    let loginDialogFullyOpen = false;
    let clockTimerTapTimer;
    let clockTimerLastTapAt = -Infinity;
    let renderedTimeLongPressTimer;
    let renderedTimeLongPressed = false;
    let endTimeGoalOverride;
    let endTimeLockDialogInitialScopes = [];
    let endTimeGoalLockFlashTimer;
    let syncNetworkStatus;
    let syncOfflineTransitionSequence = 0;

    const CONNECTION_INDICATOR_MINIMUM = 1000;
    const NUMBER_PAD_LONG_PRESS = 750;
    const NUMBER_PAD_DOUBLE_PRESS = 350;
    const CLOCK_TIMER_DOUBLE_PRESS = 350;
    const STARTUP_CONNECTION_DELAY = 2000;
    const CONNECTION_UI_TRANSITION_DURATION = 750;
    const BUTTON_PRESS_IN_DURATION = 120;
    const BUTTON_PRESS_OUT_DURATION = 140;
    const TRIP_START_TRANSITION_DURATION = 250;
    const cloudIconTransitions = new WeakMap();
    const syncIconAnimations = new WeakMap();
    const offlineCloudAnimations = new WeakMap();
    const buttonPressStates = new WeakMap();
    const pointerPressButtons = new Map();
    const tripFieldAttentionAnimations = new WeakMap();
    const dialogCloseTimers = new WeakMap();
    const settingsHelpRevealTimers = new WeakMap();
    const SETTINGS_HELP_FADE_DURATION = 750;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 350;
    const TRIP_LIST_BODY_DELAY = 125;
    const TRIP_LIST_BODY_DURATION = 425;
    const TRIP_LIST_MERGE_DURATION = 300;
    const TRIP_LOG_RANGES = new Set([
        "day",
        "week",
        "pay-period",
        "month",
        "year",
        "custom"
    ]);
    let activeSettingsHelpButton;
    let graphicalHelpVisible = false;
    let settingsHelpAnimation;
    let tripListButtonAnimation;
    let tripListBodyAnimationFrame;

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
        if (button === goalSyncButton) return;
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

        const custom = range === "custom";
        if (tripLogStartDate) tripLogStartDate.disabled = !custom;
        if (tripLogEndDate) tripLogEndDate.disabled = !custom;
        if (custom) {
            let saved;
            try { saved = JSON.parse(safeStorageGet(STORAGE.customTripLogDates)); } catch {}
            if (saved?.start && saved?.end) {
                tripLogStartDate.value = saved.start; tripLogEndDate.value = saved.end;
            }
            if (!tripLogStartDate.value || !tripLogEndDate.value) {
                const today = new Intl.DateTimeFormat("en-CA", {timeZone: calendarRanges.getTimezone(), year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date());
                const parts = Object.fromEntries(today.map(part => [part.type, part.value]));
                tripLogStartDate.value ||= `${parts.year}-${parts.month}-${parts.day}`;
                tripLogEndDate.value ||= tripLogStartDate.value;
            }
        }
        if (notify) refreshTripLogSelection();
        else void resolveTripLogCalendar(range).catch(() => {});

        return range;
    }

    function showTripRangeError(message = "") {
        if (tripLogRangeError) { tripLogRangeError.textContent = message; tripLogRangeError.hidden = !message; }
        for (const input of [tripLogStartDate, tripLogEndDate]) input?.setAttribute("aria-invalid", String(Boolean(message)));
    }

    async function resolveTripLogCalendar(range = getTripLogRange()) {
        const revision = tripRangeRevision;
        const calendar = range === "custom"
            ? CalendarRange.custom(tripLogStartDate.value, tripLogEndDate.value, calendarRanges.getTimezone())
            : await calendarRanges.resolve({range});
        if (revision === tripRangeRevision && range === getTripLogRange()) {
            const dates = CalendarRange.dates(calendar);
            if (range !== "custom") { tripLogStartDate.value = dates.start; tripLogEndDate.value = dates.end; }
            showTripRangeError();
        }
        return calendar;
    }

    function refreshTripLogSelection() {
        tripRangeRevision++;
        tripLogRequestSequence++;
        const range = getTripLogRange();
        if (range === "custom") {
            try { CalendarRange.custom(tripLogStartDate.value, tripLogEndDate.value, calendarRanges.getTimezone()); }
            catch (error) { showTripRangeError(error.message); return; }
            safeStorageSet(STORAGE.customTripLogDates, JSON.stringify({start: tripLogStartDate.value, end: tripLogEndDate.value}));
        }
        showTripRangeError();
        window.dispatchEvent(new CustomEvent("wmof:trip-log-range-changed", {detail: {range}}));
        if (getTripListState() === "open") void dispatchTripListRequest("range");
        else void refreshGoalTotalsForRange(range).catch(error => {
            if (!error.clockTimerOffline) {
                showTripRangeError(error.message);
                window.dispatchEvent(new CustomEvent("wmof:trip-log-error", {detail: {range, message: error.message}}));
            }
        });
    }

    function tripLogIsPinned() {
        return app.dataset.tripLogPinned !== "false";
    }

    function getStoredTripLogPinned() {
        return safeStorageGet(STORAGE.tripLogPinned) !== "false";
    }

    function setTripLogPinned(value, { persist = true } = {}) {
        const pinned = value !== false;

        app.dataset.tripLogPinned = String(pinned);

        tripLogPinButton?.setAttribute(
            "aria-pressed",
            String(pinned)
        );

        if (tripLogPinButton) {
            const label = pinned
                ? "Unpin Trip Log"
                : "Pin Trip Log";

            tripLogPinButton.setAttribute(
                "aria-label",
                label
            );

            tripLogPinButton.title =
                label;
        }

        if (tripLogButton) {
            const hidden =
                !pinned &&
                !tripListIsActive();

            tripLogButton.inert =
                hidden;

            if (!hidden) {
                tripLogButton.removeAttribute(
                    "aria-hidden"
                );
            }
            else {
                tripLogButton.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }

        if (persist) {
            safeStorageSet(
                STORAGE.tripLogPinned,
                String(pinned)
            );
        }

        return pinned;
    }

    function getTripListState() {
        return app.dataset.tripListState || "closed";
    }

    function tripListIsActive() {
        return getTripListState() !== "closed";
    }

    function getAppContentMetrics() {
        const rect = app.getBoundingClientRect();
        const style = getComputedStyle(app);
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const height = tripLogButton?.offsetHeight || 74;

        return {
            rect,
            paddingLeft,
            paddingRight,
            paddingTop,
            paddingBottom,
            height,
            left: rect.left + paddingLeft,
            width: Math.max(0, rect.width - paddingLeft - paddingRight)
        };
    }

    function getTripLogTopRect() {
        const metrics = getAppContentMetrics();
        return {
            left: metrics.left,
            top: metrics.rect.top + metrics.paddingTop,
            width: metrics.width,
            height: metrics.height
        };
    }

    function getTripLogBottomRect() {
        const metrics = getAppContentMetrics();
        return {
            left: metrics.left,
            top: metrics.rect.bottom - metrics.paddingBottom - metrics.height,
            width: metrics.width,
            height: metrics.height
        };
    }

    function setFloatingTripLogRect(rect) {
        if (!tripLogButton || !rect) return;

        tripLogButton.classList.add(
            "trip-log-floating"
        );
        tripLogButton.style.left = `${rect.left}px`;
        tripLogButton.style.top = `${rect.top}px`;
        tripLogButton.style.width = `${rect.width}px`;
        tripLogButton.style.height = `${rect.height}px`;
    }

    function clearFloatingTripLogRect() {
        if (!tripLogButton) return;

        tripLogButton.classList.remove(
            "trip-log-floating"
        );
        tripLogButton.style.removeProperty("left");
        tripLogButton.style.removeProperty("top");
        tripLogButton.style.removeProperty("width");
        tripLogButton.style.removeProperty("height");
        tripLogButton.style.removeProperty("transform");
    }

    async function animateTripLogButton(
        fromTransform,
        toTransform,
        duration = TRIP_LIST_BUTTON_TRANSITION_DURATION
    ) {
        tripListButtonAnimation?.cancel();

        tripListButtonAnimation =
            tripLogButton.animate(
                [
                    { transform: fromTransform },
                    { transform: toTransform }
                ],
                {
                    duration,
                    easing: "ease-in-out",
                    fill: "both"
                }
            );

        try {
            await tripListButtonAnimation.finished;
        }
        catch {}

        tripListButtonAnimation?.cancel();
        tripListButtonAnimation = undefined;
    }

    function getTripLogBodyRect() {
        const metrics =
            getAppContentMetrics();

        const topRect =
            getTripLogTopRect();

        const top =
            topRect.top +
            topRect.height;

        const bottom =
            metrics.rect.bottom;

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
        if (tripLogSettingsButton) {
            tripLogSettingsButton.style.left = `${rect.left + 8}px`;
            tripLogSettingsButton.style.top = tripLogCloseButton.style.top;
            tripLogSettingsButton.style.color = getComputedStyle(tripLogButton).color;
        }
    }

    async function dispatchTripListRequest(
        source = "button"
    ) {
        const sequence = ++tripLogRequestSequence;
        const range = getTripLogRange();
        if (tripLogBody) {
            tripLogBody.setAttribute("aria-busy", "true");
            if (!tripLogBody.querySelector('.trip-log-settings')) tripLogBody.textContent = "Loading trips…";
        }
        try {
            const calendar = await resolveTripLogCalendar(range);
            if (sequence !== tripLogRequestSequence) return;
            if (deliberatelyLoggedOut || clockTimer.networkStatus === "offline") {
                const data = offlineTripLogData(calendar);
                if (!data.loginRequired) {
                    const tripWindow = CalendarRange.tripWindow(calendar);
                    clockTimer.calculateOfflineTripTotals(data.allTrips, tripWindow.startTime, tripWindow.endTime);
                    updateSummaryValues();
                }
                renderTripLog(data, calendar);
                return;
            }
            const tripWindow = CalendarRange.tripWindow(calendar);
            await updateTripTotals(tripWindow, () => sequence === tripLogRequestSequence);
            if (sequence !== tripLogRequestSequence) return;
            const url = new URL("api/trips/", API_BASE);
            url.search = new URLSearchParams({
                result: "list", minDateTime: tripWindow.startTime, maxDateTime: tripWindow.endTime,
                nonProductionFilter: "all", productionFilter: clockTimer.productionFilter || "all", verbose:"true", limit: "1000"
            });
            const data = {trips: []};
            let page;
            do {
                url.searchParams.set("offset", String(data.trips.length));
                const response = await fetch(url, {credentials: "same-origin", headers: {Accept: "application/json"}});
                page = await response.json();
                if (!response.ok) throw new Error(page.message || "Trip lookup failed.");
                if (sequence !== tripLogRequestSequence) return;
                data.trips.push(...page.trips);
            } while (page.trips.length === 1000);
            if (sequence !== tripLogRequestSequence) return;
            safeStorageSet("wmof.tripLogCache", JSON.stringify({userId: signedInProfile?.id, trips: data.trips}));
            renderTripLog(data, calendar);
            if (sequence !== tripLogRequestSequence) return;
        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-request",
                {
                    detail: {
                        open: true,
                        source,
                        range, ...tripWindow, calendar, trips: data.trips
                    }
                }
            )
        );
        } catch (error) {
            if (sequence !== tripLogRequestSequence) return;
            if (clockTimer.networkStatus === "offline") {
                try {
                    const calendar = await resolveTripLogCalendar(range);
                    if (sequence !== tripLogRequestSequence) return;
                    renderTripLog(offlineTripLogData(calendar), calendar);
                    return;
                } catch {}
            }
            if (tripLogView && tripLogBody?.querySelector('.trip-log-settings')) tripLogView.error(error);
            else if (tripLogBody) tripLogBody.textContent = error.message || "Trip Log is unavailable.";
            window.dispatchEvent(new CustomEvent("wmof:trip-log-error", {detail: {range, message: error.message}}));
        } finally {
            if (sequence === tripLogRequestSequence) tripLogBody?.setAttribute("aria-busy", "false");
        }
    }

    let tripLogView;
    function getTripLogIncludeCurrent() {
        return safeStorageGet(STORAGE.tripLogIncludeCurrent) === "true";
    }

    function setTripLogIncludeCurrent(value) {
        safeStorageSet(STORAGE.tripLogIncludeCurrent, String(Boolean(value)));
        tripLogView?.rerender();
    }

    function offlineTripLogData(calendar) {
        let cached;
        try {cached = JSON.parse(safeStorageGet("wmof.tripLogCache") || "null");} catch {}
        const local = clockTimer.getLocalTripLog();
        const loginRequired = deliberatelyLoggedOut || (!signedInProfile && !cached && !local.length);
        const allTrips = new Map();
        if (!loginRequired) {
            if (cached && (!signedInProfile || cached.userId === signedInProfile.id)) {
                for (const trip of cached.trips || []) allTrips.set(String(trip.id), trip);
            }
            for (const trip of local) allTrips.set(String(trip.id), trip);
        }
        const tripWindow = CalendarRange.tripWindow(calendar);
        const trips = [...allTrips.values()].filter(trip => {
            const time = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(trip.startTime) ? trip.startTime : trip.startTime.replace(" ", "T") + "Z");
            const filter = clockTimer.productionFilter || "all";
            return time >= Date.parse(tripWindow.startTime) && time < Date.parse(tripWindow.endTime) &&
                (filter === "all" || (filter === "productive" && !trip.nonProduction) || (filter === "non-productive" && trip.nonProduction));
        });
        return {trips, allTrips: [...allTrips.values()], loginRequired, offline: true, incomplete: true};
    }

    function renderTripLog(data, calendar) {
        if (!tripLogBody) return;
        tripLogView ||= new TripLog(tripLogBody, {
            range:getTripLogRange, filter:()=>clockTimer.productionFilter || "all",
            includeCurrent:getTripLogIncludeCurrent,
            onIncludeCurrent:setTripLogIncludeCurrent,
            onRange:value=>setTripLogRange(value),
            onFilter:setTripProductionFilter,
            onDate:(key,value)=>{(key === "start" ? tripLogStartDate : tripLogEndDate).value=value;refreshTripLogSelection();},
            numberPad:openNumberPad,
            request:async (id,change)=>{
                const result=await clockTimer.tripEditorRequest(id,change);
                if(change){renderTripActionState();renderSyncGoalsState();updateSummaryValues();}
                return result;
            },
            refresh:()=>dispatchTripListRequest("edit"),
            downDetailsInfo:(tripId,intervalKey)=>clockTimer.downDetailsRequest(tripId,intervalKey),
            openDownDetails:(trip,intervalKey,editing)=>openDownDetailsModal(trip.id,intervalKey,{editing}),
            liveTrip:()=>{
                if (!tripIsLive()) return null;
                const interval=clockTimer.getActiveIntervalState?.(new Date());
                const intervalType=String(interval?.intervalType||"").toLowerCase();
                const phase=String(interval?.phase||"").toLowerCase();
                const activeState=phase.endsWith("-buffer")
                    ? "buffer"
                    : ["latency","pending","late-start"].includes(phase)
                        ? "latency"
                        : ["break","lunch","down","tolerance","early-start","trip"].includes(intervalType)
                            ? intervalType
                            : "trip";
                if (clockTimer.networkStatus === "offline" || !clockTimer.currentTripId) {
                    const local=clockTimer.getLocalTripLog().find(trip=>trip.running);
                    return local?{...local,activeState,includeInParentPercent:getTripLogIncludeCurrent()}:null;
                }
                const summary=clockTimer.getSummarySnapshot().trip;
                const totalSummary=clockTimer.getSummarySnapshot().total;
                const tripGoalMissed=Number.isFinite(summary.countedPercent)&&Number.isFinite(summary.percentGoal)&&
                    summary.countedPercent<summary.percentGoal;
                const totalGoalMissed=Number.isFinite(totalSummary?.countedPercent)&&Number.isFinite(totalSummary?.percentGoal)&&
                    totalSummary.countedPercent<totalSummary.percentGoal;
                const start=clockTimer.uiState?.trip_start_component?.date?.toISOString?.();
                if(!start) return null;
                return {id:clockTimer.currentTripId,running:true,activeState,
                    includeInParentPercent:getTripLogIncludeCurrent()||tripGoalMissed||totalGoalMissed,startTime:start,endTime:new Date().toISOString(),
                    standardTimeMilliseconds:summary.standardTimeMilliseconds,
                    actualTimeMilliseconds:summary.countedTimeElapsedMilliseconds,
                    countedTimeMilliseconds:summary.countedTimeElapsedMilliseconds,nonProduction:clockTimer.nonProduction};
            }
        });
        tripLogView.render(data,calendar);
        if (!tripLogView.trips.length) {
            tripLogSettingsVisible = true;
            tripLogSettingsButton?.setAttribute("aria-expanded", "true");
            tripLogSettingsButton?.setAttribute("aria-label", "Hide Trip Log settings");
        }
        tripLogView.setSettingsVisible(tripLogSettingsVisible);
    }

    function setTripProductionFilter(value, {notify=true}={}) {
        if (!["all","productive","non-productive"].includes(value)) value="all";
        clockTimer.productionFilter=value;
        $("#tripProductionFilter").value=value;
        safeStorageSet("wmof.tripProductionFilter",value);
        if (notify) {tripRangeRevision++;refreshTripLogSelection();}
    }

    function updateTripTotals(tripWindow, isCurrent = () => true) {
        const task = tripTotalsRefreshQueue.catch(() => {}).then(() =>
            isCurrent() ? Promise.resolve().then(() => {
                if (clockTimer.networkStatus === "offline") {
                    const data = offlineTripLogData(tripWindow);
                    return clockTimer.calculateOfflineTripTotals(data.allTrips, tripWindow.startTime, tripWindow.endTime);
                }
                return clockTimer.calculateTripTotals(tripWindow.startTime, tripWindow.endTime);
            }).then(result => {
                if (isCurrent()) updateSummaryValues();
                return result;
            }) : null
        );
        tripTotalsRefreshQueue = task;
        return task;
    }

    async function refreshGoalTotalsForRange(range) {
        const revision = tripRangeRevision;
        const calendar = await resolveTripLogCalendar(range);
        return updateTripTotals(CalendarRange.tripWindow(calendar), () => revision === tripRangeRevision && range === getTripLogRange());
    }

    function animateTripLogBody(
        target,
        opening,
        duration = TRIP_LIST_BODY_DURATION
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

        const fullDuration =
            Math.max(1, duration);

        const edgeSpeed =
            Math.max(
                fullWidth / 2,
                fullHeight / 2
            ) /
            fullDuration;

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

    function setTripLogMergeDuration(duration) {
        const value =
            `${Math.max(0, duration)}ms`;

        for (
            const element of
                [
                    tripLogButton,
                    tripLogBody,
                    tripLogCloseButton,
                    tripLogSettingsButton
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
                    tripLogCloseButton,
                    tripLogSettingsButton
                ]
        ) {
            element?.style.removeProperty(
                "--trip-list-merge-duration"
            );
        }
    }

    async function showTripLogMerge(
        duration = TRIP_LIST_MERGE_DURATION
    ) {
        if (
            !tripLogButton ||
            !tripLogBody ||
            !tripLogCloseButton
        ) {
            return;
        }

        setTripLogMergeDuration(
            duration
        );

        tripLogButton.classList.add(
            "trip-log-merged"
        );

        tripLogBody.classList.add(
            "trip-log-merged"
        );

        positionTripLogCloseButton();

        tripLogCloseButton.hidden =
            false;
        tripLogSettingsButton.hidden = false;

        requestAnimationFrame(
            () => {
                if (
                    tripListIsActive()
                ) {
                    tripLogCloseButton.classList.add(
                        "is-visible"
                    );
                    tripLogSettingsButton.classList.add("is-visible");
                }
            }
        );

        await wait(
            duration
        );

        clearTripLogMergeDuration();
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
        tripLogSettingsButton?.classList.remove("is-visible");

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
            tripLogSettingsButton.hidden = true;
        }

        clearTripLogMergeDuration();
    }

    async function openTripList(source = "button") {
        if (
            !tripLogButton ||
            !tripLogBody ||
            getTripListState() !== "closed"
        ) {
            return false;
        }

        tripLogSettingsVisible = false;
        tripLogView?.setSettingsVisible(false);
        tripLogSettingsButton?.setAttribute("aria-expanded", "false");
        tripLogSettingsButton?.setAttribute("aria-label", "Show Trip Log settings");

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

        setFloatingTripLogBodyRect({
            left: bodyRect.left + bodyRect.width / 2,
            top: bodyRect.top + bodyRect.height / 2,
            width: 0,
            height: 0
        });

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

        await showTripLogMerge();

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

        await hideTripLogMerge(
            TRIP_LIST_MERGE_DURATION
        );

        await animateTripLogBody(
            bodyRect,
            false,
            TRIP_LIST_BODY_DURATION
        );

        tripLogBody.hidden =
            true;

        clearFloatingTripLogBodyRect();

        await wait(
            TRIP_LIST_BODY_DELAY
        );

        if (pinned) {
            const destination =
                getTripLogBottomRect();

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${destination.top - topRect.top}px)`,
                TRIP_LIST_BUTTON_TRANSITION_DURATION
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
                `translateY(-${distance}px)`,
                TRIP_LIST_BUTTON_TRANSITION_DURATION
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
        const state=renderedScope&&typeof renderedScope==="object"?renderedScope:clockTimer.uiState;
        if(renderedScope&&typeof renderedScope==="object")renderedScope=state.effective_goal_type;
        const enabled =
            getSyncGoalsState();

        const idle = enabled && normalizedConnectionStatus() === "online" && !tripIsLive();
        for (const element of [goalSyncButton, syncGoalsMenuIcon]) {
            if (!element) continue;
            element.classList.toggle("sync-paused", idle);
            if (!element.querySelector(".sync-pause-badge")) {
                const badge = document.createElement("span");
                badge.className = "sync-pause-badge";badge.setAttribute("aria-hidden", "true");
                element.append(badge);
            }
        }
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

        if (syncGoalsMenuIcon) {
            syncGoalsMenuIcon.dataset.syncState =
                enabled
                    ? "enabled"
                    : "disabled";
        }

        if (goalSyncButton) {
            const calculable=enabled&&normalizedConnectionStatus()==="online"&&tripIsLive()&&Boolean(state?.auto_goal_active)&&Boolean(state?.goal_component?.valid);
            ensureSyncOfflineOverlay(goalSyncButton);
            goalSyncButton.classList.toggle("sync-calculable",calculable);
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

        clockTimer.configure({
            auto_goal: enabled
        });

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

    // sync-offline-icon-state-v1
    function getSyncVisualElements() {
        return [
            syncGoalsMenuIcon,
            goalSyncButton
        ].filter(Boolean);
    }

    function ensureSyncOfflineOverlay(element) {
        if (!element) return undefined;

        let overlay =
            element.querySelector(
                ":scope > .sync-offline-overlay"
            );

        if (!overlay) {
            overlay =
                document.createElement("span");
            overlay.className =
                "sync-offline-overlay";
            overlay.setAttribute(
                "aria-hidden",
                "true"
            );
            element.append(overlay);
        }

        element.dataset.syncLayered = "true";

        let arrow =
            overlay.querySelector(
                ":scope > .sync-offline-arrow"
            );

        if (!arrow) {
            arrow =
                document.createElement("span");
            arrow.className =
                "sync-offline-arrow";
            overlay.append(arrow);
        }

        let offlineX =
            overlay.querySelector(
                ":scope > .sync-offline-x"
            );

        if (!offlineX) {
            offlineX =
                document.createElement("span");
            offlineX.className =
                "sync-offline-x";
            overlay.append(offlineX);
        }

        return overlay;
    }

    function setSyncOfflineVisualState(state) {
        for (const element of getSyncVisualElements()) {
            ensureSyncOfflineOverlay(element);
            element.dataset.syncNetworkState = state;
        }
    }

    function clearSyncOfflineVisualState() {
        syncOfflineTransitionSequence += 1;

        for (const element of getSyncVisualElements()) {
            delete element.dataset.syncNetworkState;
        }
    }

    async function transitionSyncIconsOffline() {
        const sequence =
            ++syncOfflineTransitionSequence;

        setSyncOfflineVisualState(
            "offline-prep"
        );
        animateSyncGoalsIcons();

        await wait(
            CONNECTION_UI_TRANSITION_DURATION
        );

        if (
            sequence !== syncOfflineTransitionSequence ||
            normalizedConnectionStatus() !== "offline"
        ) {
            return;
        }

        setSyncOfflineVisualState(
            "offline-fading"
        );

        await wait(
            CONNECTION_UI_TRANSITION_DURATION
        );

        if (
            sequence !== syncOfflineTransitionSequence ||
            normalizedConnectionStatus() !== "offline"
        ) {
            return;
        }

        setSyncOfflineVisualState(
            "offline"
        );
    }

    function syncSyncIconConnectionState(status) {
        const normalized =
            normalizedConnectionStatus(status);

        const previous =
            syncNetworkStatus;

        syncNetworkStatus =
            normalized;

        if (normalized === "online") {
            clearSyncOfflineVisualState();
            return;
        }

        if (previous === "online") {
            void transitionSyncIconsOffline();
            return;
        }

        if (previous === undefined) {
            syncOfflineTransitionSequence += 1;
            setSyncOfflineVisualState(
                "offline"
            );
        }
    }

    function animateSyncGoalsIcons() {
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

            // sync-three-state-and-trip-settings-v1
            // The arrow is the only rotating layer. Red slash/X overlays stay fixed.
            const animationTarget =
                ensureSyncOfflineOverlay(element)?.querySelector(
                    ":scope > .sync-offline-arrow"
                );

            if (!animationTarget) continue;

            element.classList.add(
                "sync-icon-spinning"
            );

            const animation =
                animationTarget.animate(
                    [
                        { transform: "rotate(0deg)" },
                        { transform: "rotate(360deg)" }
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
                        element.classList.remove(
                            "sync-icon-spinning"
                        );
                    }
                });
        }
    }

    function toggleSyncGoals() {
        if (normalizedConnectionStatus() === "offline") {
            animateOfflineClouds();
        }

        const enabled =
            setSyncGoals(
                !getSyncGoalsState()
            );

        animateSyncGoalsIcons();

        return enabled;
    }

    function normalizeGraphicalSettings(value) {
        const source =
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
                ? value
                : {};

        const settings = {};

        for (
            const [key, fallback] of
                Object.entries(GRAPHICAL_DEFAULTS)
        ) {
            const candidate =
                Object.prototype.hasOwnProperty.call(
                    source,
                    key
                )
                    ? source[key]
                    : fallback;

            // Move saved defaults to the reference palette; keep custom colors.
            if (
                (key === "lunchColor" && candidate === "#ffc420") ||
                (key === "earlyStartColor" && candidate === "#00a6d2")
            ) {
                settings[key] = fallback;
                continue;
            }

            if (key === "showTolerance") {
                settings[key] =
                    candidate === null ||
                    candidate === undefined
                        ? undefined
                        : typeof candidate === "boolean"
                            ? candidate
                            : fallback;
                continue;
            }

            if (typeof fallback === "boolean") {
                settings[key] =
                    typeof candidate === "boolean"
                        ? candidate
                        : fallback;
                continue;
            }

            settings[key] =
                typeof candidate === "string"
                    ? candidate
                    : fallback;
        }

        settings.timerType =
            settings.timerType === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";

        settings.timerMode =
            settings.timerMode === "remaining"
                ? "remaining"
                : "elapsed";

        return settings;
    }

    function getGraphicalSettings() {
        let stored;

        try {
            const raw =
                safeStorageGet(
                    STORAGE.graphicalSettings
                );

            stored =
                raw
                    ? JSON.parse(raw)
                    : undefined;
        }
        catch {
            stored = undefined;
        }

        return normalizeGraphicalSettings(
            stored
        );
    }

    function saveGraphicalSettings(settings) {
        const normalized =
            normalizeGraphicalSettings(
                settings
            );

        const stored = {
            ...normalized,
            showTolerance:
                normalized.showTolerance === undefined
                    ? null
                    : normalized.showTolerance
        };

        safeStorageSet(
            STORAGE.graphicalSettings,
            JSON.stringify(stored)
        );

        return normalized;
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
        const permissions=Number(signedInProfile?.permissions)||0,showAdmin=connected&&permissions!==0;
        $("#adminMenuGroup").hidden=!showAdmin;$("#newUserButton").hidden=!showAdmin||!(permissions&5);
        if(!showAdmin){$("#adminSubmenu").hidden=true;$("#adminMenuButton").setAttribute("aria-expanded","false");}
        authButton.textContent = connected ? "Logout" : "Login";
        authButton.classList.toggle("logout-button", connected);
    }

    function wait(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
    }

    function normalizedConnectionStatus(value = clockTimer.networkStatus) {
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

        const normalized =
            getConnectionVisualStatus(status);

        const transitionActive =
            connectionCloudPhase !== "settled";

        const visible =
            normalized !== "online" ||
            transitionActive;

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

    function animateOfflineClouds() {
        const candidates = [
            {
                element: scopeConnectionButton,
                offline:
                    scopeConnectionButton?.dataset.cloudState ===
                        "offline"
            },
            {
                element: tripSettingsCloud,
                offline:
                    tripSettingsCloud?.dataset.networkStatus ===
                        "offline"
            },
            {
                element: numberPadConnection,
                offline:
                    numberPadSettingsArea?.dataset.persistence ===
                        "offline"
            }
        ];

        for (const { element, offline } of candidates) {
            if (!element || !offline) continue;

            offlineCloudAnimations.get(
                element
            )?.cancel();

            const animation =
                element.animate(
                    [
                        { opacity: 1 },
                        { opacity: 0.38 },
                        { opacity: 1 }
                    ],
                    {
                        duration:
                            CONNECTION_UI_TRANSITION_DURATION,
                        easing: "ease-in-out"
                    }
                );

            offlineCloudAnimations.set(
                element,
                animation
            );

            animation.finished
                .catch(() => {})
                .finally(() => {
                    if (
                        offlineCloudAnimations.get(
                            element
                        ) === animation
                    ) {
                        offlineCloudAnimations.delete(
                            element
                        );
                    }
                });
        }
    }

    function updateNumberPadConnectionStatus(token, status, { presentation } = {}) {
        renderSyncGoalsState();
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
                        state &&
                        state.connectionStatusToken === token &&
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

        animateOfflineClouds();

        const sequence =
            ++connectionCloudSequence;

        clearTimeout(connectionCloudSettleTimer);
        connectionCloudSettleTimer = undefined;

        connectionCloudPhase =
            "retry";

        let token;

        const visibleNumberPadOfflineCloud =
            Boolean(
                numberPadDialog?.open &&
                numberPadState &&
                numberPadConnection &&
                !numberPadConnection.hidden &&
                numberPadState.mode !== "percent" &&
                numberPadSettingsArea?.dataset.persistence ===
                    "offline"
            );

        if (
            numberPadState &&
            (
                source === "number-pad" ||
                visibleNumberPadOfflineCloud
            )
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

        // Every visible offline cloud participates in the same retry
        // presentation, regardless of which cloud started the retry.
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

    function emitUIEvent(target, name, detail = {}, cancelable = false) {
        if (!target) return true;
        return target.dispatchEvent(new CustomEvent(name, {
            detail,
            bubbles: true,
            cancelable
        }));
    }

    function openDialogElement(dialog, { duration = 250, reason = "user" } = {}) {
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

    loginDialog.addEventListener("closing", () => {
        loginDialogFullyOpen = false;
    });

    function showConnectionRetryLoginDialog() {
        clearTimeout(loginPromptTimeout);
        loginPromptTimeout = undefined;
        initialLoginAttemptPending = false;

        if (loginDialog.open) return true;

        const opened = openDialogElement(loginDialog, {
            duration: CONNECTION_UI_TRANSITION_DURATION,
            reason: "connection-retry"
        });
        if (!opened) return false;

        requestAnimationFrame(() => {
            $("#loginUsername")?.focus({ preventScroll: true });
        });
        return true;
    }

    function showInitialLoginDialog() {
        if (deliberatelyLoggedOut) return;
        if (loginDialog.open) return;
        const opened = openDialogElement(loginDialog, {
            duration: CONNECTION_UI_TRANSITION_DURATION,
            reason: "initial-login"
        });
        initialLoginAttemptPending = false;
        if (!opened) return;

        requestAnimationFrame(() => {
            $("#loginUsername")?.focus({ preventScroll: true });
        });
    }

    function syncNetworkStatusUI() {
        clearTimeout(loginPromptTimeout);
        loginPromptTimeout = undefined;

        const networkStatus =
            clockTimer.networkStatus;

        syncSyncIconConnectionState(
            networkStatus
        );

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
            if (deliberatelyLoggedOut) return;
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

    function normalizePercentMode(value) {
        const normalized =
            String(value || "trip")
                .trim()
                .toLowerCase();

        return PERCENT_MODES.includes(normalized)
            ? normalized
            : "trip";
    }

    function syncScopeUI(persist = false) {
        const actual =
            normalizePercentMode(
                clockTimer.percentMode
            );

        const label =
            actual === "total"
                ? "Total"
                : actual === "auto"
                    ? "Auto"
                    : "Trip";

        scopeToggle.textContent = label;
        scopeToggle.dataset.percentMode = actual;
        scopeToggle.setAttribute(
            "aria-label",
            `Percent mode: ${label}`
        );

        syncScopeConnectionCloud();
        updateSummaryValues();

        if (persist) {
            safeStorageSet(
                STORAGE.percentMode,
                actual
            );
        }

        return actual;
    }

    function applyScope(mode, persist = true) {
        const requested =
            normalizePercentMode(mode);

        clockTimer.configure({
            goal_type: requested
        });

        return syncScopeUI(persist);
    }

    function applyRenderedTimeMode(mode, persist = true) {
        const next = RENDERED_TIME_MODES.includes(mode) ? mode : "remaining";
        clockTimer.configure({
            rendered_time_type:
                next === "elapsed"
                    ? "calculated_start_time"
                    : next === "calculated-end"
                        ? "calculated_end_time"
                        : "time_remaining"
        });
        updateSummaryValues();
        if (persist) safeStorageSet(STORAGE.renderedTimeMode, next);
    }

    function goalAttributeSnapshot(name) {
        return {
            present: clockTimer.hasAttribute(name),
            value: clockTimer.getAttribute(name)
        };
    }

    function restoreGoalAttribute(name, snapshot) {
        clockTimer.configure({
            [name === "total-goal" ? "total_goal" : "trip_goal"]:
                snapshot?.present ? snapshot.value : null
        });
    }

    function renderEndTimeGoalLock() {
        const lock = $("#endTimeGoalLock");
        if (!lock) return;
        const scopes = endTimeGoalOverride?.scopes || [];
        const mode = normalizePercentMode(clockTimer.percentMode);
        const appliesToMode = mode === "auto" ? scopes.length > 0 : scopes.includes(mode);
        const temporarilyVisible = endTimeGoalLockFlashTimer !== undefined && appliesToMode;
        const hidden = !endTimeGoalOverride ||
            (!temporarilyVisible && (
                clockTimer.renderedTimeMode !== "calculated-end" ||
                !appliesToMode
            ));
        const visibilityChanged = lock.hidden !== hidden;
        lock.hidden = hidden;
        lock.setAttribute("aria-pressed", String(Boolean(endTimeGoalOverride)));
        if (!hidden && visibilityChanged) requestAnimationFrame(alignStatusIcons);
    }

    function endTimeGoalDisplayScope(snapshot) {
        if (!endTimeGoalOverride) return undefined;
        const scopes = endTimeGoalOverride.scopes || [];
        const mode = normalizePercentMode(clockTimer.percentMode);
        if (mode !== "auto") return scopes.includes(mode) ? mode : undefined;
        if (scopes.includes(snapshot?.scope)) return snapshot.scope;
        return scopes.includes("trip") ? "trip" : scopes.includes("total") ? "total" : undefined;
    }

    function endTimeGoalLockedForMode(mode = normalizePercentMode(clockTimer.percentMode)) {
        const scopes = endTimeGoalOverride?.scopes || [];
        return mode === "auto" ? scopes.length > 0 : scopes.includes(mode);
    }

    function flashEndTimeGoalLock() {
        const lock = $("#endTimeGoalLock");
        if (!lock || !endTimeGoalLockedForMode()) return false;
        clearTimeout(endTimeGoalLockFlashTimer);
        lock.hidden = false;
        alignStatusIcons();
        lock.classList.remove("is-rejecting");
        void lock.offsetWidth;
        lock.classList.add("is-rejecting");
        endTimeGoalLockFlashTimer = setTimeout(() => {
            lock.classList.remove("is-rejecting");
            endTimeGoalLockFlashTimer = undefined;
            renderEndTimeGoalLock();
        }, 600);
        return true;
    }

    function releaseEndTimeGoalOverride() {
        const override = endTimeGoalOverride;
        if (!override) return false;
        endTimeGoalOverride = undefined;
        restoreGoalAttribute("trip-goal", override.tripGoal);
        restoreGoalAttribute("total-goal", override.totalGoal);
        clockTimer.configure({auto_goal: override.autoSyncTripGoal});
        renderEndTimeGoalLock();
        queueSummaryRefresh();
        return true;
    }

    function selectedEndTimeLockScopes() {
        return [
            $("#endTimeTripLock")?.checked ? "trip" : undefined,
            $("#endTimeTotalLock")?.checked ? "total" : undefined
        ].filter(Boolean);
    }

    function refreshEndTimeLockDialog() {
        const scopes = new Set(endTimeGoalOverride?.scopes || []);
        endTimeLockDialogInitialScopes = [...scopes].sort();
        $("#endTimeTripLock").checked = scopes.has("trip");
        $("#endTimeTotalLock").checked = scopes.has("total");
        $("#endTimeLockReleaseMessage").hidden = scopes.size !== 0;
    }

    function updateEndTimeLockReleaseMessage() {
        $("#endTimeLockReleaseMessage").hidden = selectedEndTimeLockScopes().length !== 0;
    }

    function goalForDeadline(summary, scope, currentSummary, deadline) {
        const values = scope === "total" ? summary?.total : summary?.trip;
        const currentValues = scope === "total" ? currentSummary?.total : currentSummary?.trip;
        const standard = Number(values?.standardTimeMilliseconds);
        let counted = Number(values?.countedTimeElapsedMilliseconds);
        let currentCounted = Number(currentValues?.countedTimeElapsedMilliseconds);
        if (scope === "total") {
            counted -= Number(values?.allowanceCreditMilliseconds || 0);
            currentCounted -= Number(currentValues?.allowanceCreditMilliseconds || 0);
        }
        if (
            Number.isFinite(currentCounted) &&
            counted <= currentCounted &&
            deadline instanceof Date &&
            deadline.getTime() > Date.now()
        ) {
            const activeInterval = clockTimer.getActiveIntervalState?.(new Date());
            const activeType = String(activeInterval?.intervalType || "").toLowerCase();
            const knownPauseRemaining =
                (activeType === "break" || activeType === "lunch") &&
                Number.isFinite(activeInterval?.remainingMilliseconds)
                    ? Math.max(0, activeInterval.remainingMilliseconds)
                    : 0;
            const available = Math.max(
                0,
                deadline.getTime() - Date.now() - knownPauseRemaining
            );
            counted = currentCounted + available;
        }
        return Number.isFinite(standard) && standard > 0 &&
            Number.isFinite(counted) && counted > 0
                ? standard / counted
                : undefined;
    }

    function percentGoalAttribute(value) {
        return `${Number((value * 100).toFixed(6))}%`;
    }

    function setEndTimeGoalScopes(scopes) {
        if (!endTimeGoalOverride) return false;
        const normalized = [...new Set(scopes)].filter(scope => scope === "trip" || scope === "total");
        if (normalized.length === 0) return releaseEndTimeGoalOverride();
        const currentSummary = clockTimer.getSummarySnapshot?.(new Date());
        const summary = clockTimer.getSummarySnapshot?.(endTimeGoalOverride.deadline);
        const goals = Object.fromEntries(normalized.map(scope => [
            scope,
            goalForDeadline(summary, scope, currentSummary, endTimeGoalOverride.deadline)
        ]));
        if (normalized.some(scope => !Number.isFinite(goals[scope]) || goals[scope] <= 0)) return false;
        restoreGoalAttribute("trip-goal", endTimeGoalOverride.tripGoal);
        restoreGoalAttribute("total-goal", endTimeGoalOverride.totalGoal);
        clockTimer.configure({auto_goal: false});
        for (const scope of normalized) {
            clockTimer.configure({
                [scope === "total" ? "total_goal" : "trip_goal"]:
                    percentGoalAttribute(goals[scope])
            });
        }
        endTimeGoalOverride.scopes = normalized;
        renderEndTimeGoalLock();
        queueSummaryRefresh();
        return true;
    }

    function applyEndTimeGoalOverride(target) {
        const deadline = target instanceof Date ? new Date(target.getTime()) : new Date(target);
        if (!tripIsLive() || Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
            return false;
        }
        const currentSummary = clockTimer.getSummarySnapshot?.(new Date());
        const summary = clockTimer.getSummarySnapshot?.(deadline);
        const mode = normalizePercentMode(clockTimer.percentMode);
        const scopes = mode === "auto" ? ["trip", "total"] : [mode];
        const goals = Object.fromEntries(scopes.map(scope => [
            scope,
            goalForDeadline(summary, scope, currentSummary, deadline)
        ]));
        if (scopes.some(scope => !Number.isFinite(goals[scope]) || goals[scope] <= 0)) return false;

        if (!endTimeGoalOverride) {
            endTimeGoalOverride = {
                tripGoal: goalAttributeSnapshot("trip-goal"),
                totalGoal: goalAttributeSnapshot("total-goal"),
                autoSyncTripGoal: Boolean(clockTimer.autoSyncTripGoal),
                scopes: [...scopes],
                deadline
            };
        }
        else {
            restoreGoalAttribute("trip-goal", endTimeGoalOverride.tripGoal);
            restoreGoalAttribute("total-goal", endTimeGoalOverride.totalGoal);
            clockTimer.configure({auto_goal: endTimeGoalOverride.autoSyncTripGoal});
            endTimeGoalOverride.deadline = deadline;
            endTimeGoalOverride.scopes = [...scopes];
        }

        clockTimer.configure({auto_goal: false});
        for (const scope of scopes) {
            clockTimer.configure({
                [scope === "total" ? "total_goal" : "trip_goal"]:
                    percentGoalAttribute(goals[scope])
            });
        }
        applyRenderedTimeMode("calculated-end");
        renderEndTimeGoalLock();
        queueSummaryRefresh();
        return true;
    }

    function currentRenderedEndTarget() {
        if (endTimeGoalOverride?.deadline instanceof Date) {
            return new Date(endTimeGoalOverride.deadline.getTime());
        }
        let summary;
        try { summary = clockTimer.getSummarySnapshot?.(new Date()); }
        catch { return undefined; }
        const text = summary?.selected?.renderedTime;
        const match = typeof text === "string" && text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (!match) return undefined;
        const now = new Date();
        const target = new Date(now);
        target.setHours(Number(match[1]), Number(match[2]), Number(match[3]), 0);
        if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
        return target;
    }

    function openEndTimeGoalNumberPad() {
        if (!tripIsLive() || clockTimer.renderedTimeMode !== "calculated-end") return false;
        const target = currentRenderedEndTarget();
        if (!target) return false;
        const defaults = getTripMomentDefaults(target);
        void openNumberPad({
            mode: "absolute",
            source: "end-time-goal",
            title: "End Time",
            initialValue: defaults.creationTime,
            tripDefaults: defaults,
            role: "root",
            workflow: "edit-trip",
            cancelTarget: "home",
            confirmTarget: "home",
            onConfirm: value => applyEndTimeGoalOverride(value)
        }).catch(() => {});
        return true;
    }

    function formatSummaryPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? `${Math.round(numeric * 100)}%`
            : fallback;
    }

    function renderClockTimerUIState(state) {
        if (!state?.time_component || !state?.standard_time_component) return false;
        const tripStateChanged = app.dataset.tripState !== (state.trip_active ? "running" : "ready");
        if (tripStateChanged) {
            app.classList.add("trip-state-snap");
            void app.offsetHeight;
        }
        app.dataset.clockTimerState = state.state;
        app.dataset.tripState = state.trip_active ? "running" : "ready";
        app.dataset.state = state.state;
        app.dataset.intervalState = state.active_interval_type || (state.trip_active ? "normal" : "none");
        app.classList.forEach(name => {
            if (name.startsWith("clock-timer-state-")) app.classList.remove(name);
        });
        if (state.state_class) app.classList.add(state.state_class);

        const standardLabel = $("#standardTimeLabel");
        const renderedLabel = $("#renderedTimeLabel");
        standardLabel.classList.remove("summary-label-responsive");
        renderedLabel.classList.remove("summary-label-responsive");
        standardLabel.textContent = state.standard_time_header_text;
        if (state.time_header_short_text) {
            const full = document.createElement("span");
            full.className = "summary-label-full";
            full.textContent = state.time_header_text;
            const short = document.createElement("span");
            short.className = "summary-label-short";
            short.textContent = state.time_header_short_text;
            renderedLabel.classList.add("summary-label-responsive");
            renderedLabel.replaceChildren(full, short);
        }
        else {
            renderedLabel.textContent = state.time_header_text;
        }
        $("#standardTimeValue").textContent = state.standard_time_component.text;
        $("#renderedTimeValue").textContent = state.time_component.text;
        $("#currentPercentValue").textContent = state.current_percent_component.text;
        $("#goalPercentValue").textContent = state.goal_component.text;
        $("#goalPercentValue").setAttribute(
            "aria-label",
            state.goal_type === "auto"
                ? "Choose Trip or Total goal"
                : state.goal_type === "total"
                    ? "Edit Total goal"
                    : "Edit Trip goal"
        );
        const controls = state.controls;
        if (controls) {
            activeTripControls.hidden = !controls.active_trip_visible;
            tripActionRow.hidden = !controls.trip_action_row_visible;
            breakButton.hidden = !controls.break_visible;
            downButton.hidden = !controls.down_visible;
            endTripButton.hidden = !controls.primary_action?.visible;
            endTripButton.disabled = controls.primary_action?.enabled === false;
            endTripButton.textContent = controls.primary_action?.text || "End Trip";
            setEndTripButtonIntervalPalette(state.active_interval_type);
        }
        if (
            String(state.active_interval_type || "")
                .toLowerCase() === "down"
        ) {
            renderTripActionState();
        }
        renderEndTimeGoalLock();
        renderSyncGoalsState(state);
        if (tripStateChanged) {
            requestAnimationFrame(() => app.classList.remove("trip-state-snap"));
        }
        return true;
    }

    function activeDownReference(){const active=clockTimer.getActiveIntervalState?.(new Date());if(String(active?.intervalType||'').toLowerCase()==='down'&&active?.intervalKey)return{tripId:clockTimer.currentTripId,intervalKey:active.intervalKey};const trips=clockTimer.getLocalTripLog(),trip=trips.find(candidate=>candidate.running)||trips[trips.length-1];const events=trip?.events||[];const ended=new Set(events.filter(event=>event.event==="interval.ended").map(event=>event.value?.intervalKey));const start=[...events].reverse().find(event=>event.event==="interval.started"&&event.value?.type==="down"&&!ended.has(event.value?.intervalKey));return trip&&start?{tripId:trip.id||clockTimer.currentTripId,intervalKey:start.value.intervalKey}:null;}

    async function openDownDetailsModal(tripId,intervalKey,{editing=false,capture=false}={}){
        let data;
        try {data=await clockTimer.downDetailsRequest(tripId,intervalKey);}
        catch {data={active:Boolean(capture),hasImage:false,notes:''};}
        document.querySelector('.down-details-dialog')?.remove();
        const dialog=document.createElement('dialog');dialog.className='app-dialog down-details-dialog';const form=document.createElement('form');form.method='dialog';
        const header=document.createElement('header');header.className='dialog-header';header.innerHTML='<h2>Down Details</h2>';const close=document.createElement('button');close.type='button';close.className='dialog-close';close.setAttribute('aria-label','Close Down Details');close.addEventListener('click',()=>dialog.close());header.append(close);form.append(header);
        const body=document.createElement('div');body.className='down-details-body';const photo=document.createElement('div');photo.className='down-details-photo';let selectedImage;let cameraStream;let selectedImageUrl;
        const stopCamera=()=>{cameraStream?.getTracks?.().forEach(track=>track.stop());cameraStream=undefined;};
        const image=document.createElement('img');image.alt='Down time photo';
        const showSelectedImage=()=>{stopCamera();if(selectedImageUrl)URL.revokeObjectURL(selectedImageUrl);selectedImageUrl=URL.createObjectURL(selectedImage);image.src=selectedImageUrl;const clear=document.createElement('button');clear.type='button';clear.className='down-details-photo-clear';clear.setAttribute('aria-label','Clear captured photo');clear.setAttribute('title','Clear captured photo');clear.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>';clear.addEventListener('click',()=>{selectedImage=undefined;if(selectedImageUrl){URL.revokeObjectURL(selectedImageUrl);selectedImageUrl=undefined;}image.removeAttribute('src');void openCamera();});photo.replaceChildren(image,clear);};
        const openFileFallback=()=>{const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';input.addEventListener('change',()=>{selectedImage=input.files?.[0];if(selectedImage)showSelectedImage();},{once:true});input.click();};
        const openCamera=async()=>{
            if(!navigator.mediaDevices?.getUserMedia){openFileFallback();return;}
            try{
                cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
                const stage=document.createElement('div');stage.className='down-camera-stage';
                const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=cameraStream;
                const shutter=document.createElement('button');shutter.type='button';shutter.className='down-camera-shutter';shutter.setAttribute('aria-label','Capture Down photo');shutter.textContent='Capture Photo';
                shutter.addEventListener('click',async()=>{const canvas=document.createElement('canvas');canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)return;selectedImage=new File([blob],`down-${Date.now()}.jpg`,{type:'image/jpeg'});showSelectedImage();});
                stage.append(video,shutter);photo.replaceChildren(stage);await video.play?.();
            }catch{openFileFallback();}
        };
        if(data.hasImage){image.src=data.imageUrl;photo.append(image);}else if(capture&&data.active){const camera=document.createElement('button');camera.type='button';camera.className='down-details-camera';camera.innerHTML='<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M6 14h13l5-8h16l5 8h13v32H6z"/><circle cx="32" cy="30" r="12"/><circle cx="51" cy="20" r="2"/></svg><strong>Take Photo</strong>';camera.addEventListener('click',()=>void openCamera());photo.append(camera);}else {const empty=document.createElement('p');empty.textContent='No photo attached.';photo.append(empty);}body.append(photo);
        const label=document.createElement('label');label.textContent='Notes';const notes=document.createElement('textarea');notes.maxLength=10000;notes.placeholder='Describe the cause of the down time…';notes.value=data.notes||'';notes.readOnly=!editing&&!capture;label.append(notes);body.append(label);
        let deleteImage=false;if((editing||capture)&&data.hasImage){const remove=document.createElement('button');remove.type='button';remove.className='down-details-delete';remove.textContent='Delete Photo';remove.addEventListener('click',()=>{if(confirm('Delete this Down photo?')){deleteImage=true;photo.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Photo will be deleted when saved.'}));remove.hidden=true;}});body.append(remove);}const helper=document.createElement('p');helper.className='down-details-helper';helper.textContent='One photo may be attached to this Down interval.';body.append(helper);form.append(body);
        const actions=document.createElement('div');actions.className='dialog-actions two-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent=(editing||capture)?'Cancel':'Close';cancel.addEventListener('click',()=>dialog.close());actions.append(cancel);if(editing||capture){const save=document.createElement('button');save.type='submit';save.className='primary-action';save.textContent='Save';actions.append(save);form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{const payload=new FormData();payload.set('notes',notes.value);if(selectedImage)payload.set('image',selectedImage);if(deleteImage)payload.set('deleteImage','1');await clockTimer.downDetailsRequest(tripId,intervalKey,payload);dialog.close();if(!tripLogBody.hidden)await dispatchTripListRequest('down-details');}catch(error){let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.className='trip-log-error';alert.setAttribute('role','alert');body.append(alert);}alert.textContent=error.message;}finally{save.disabled=false;}});}form.append(actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{stopCamera();if(selectedImageUrl)URL.revokeObjectURL(selectedImageUrl);dialog.remove();},{once:true});dialog.showModal();
    }

    function updateSummaryValues(state = clockTimer.uiState) {
        renderClockTimerUIState(state);
    }

    function queueSummaryRefresh() {
        queueMicrotask(() => {
            renderClockTimerUIState(clockTimer.uiState);
            refreshAutoGoalDialog();
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

    function getContrastingTextColor(value) {
        const match = /^#([0-9a-f]{6})$/i.exec(String(value || "").trim());
        if (!match) return "#ffffff";

        const hex = match[1];
        const channels = [0, 2, 4].map(index => {
            const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
            return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance =
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2];
        const blackContrast = (luminance + 0.05) / 0.05;
        const whiteContrast = 1.05 / (luminance + 0.05);

        return blackContrast >= whiteContrast
            ? "#000000"
            : "#ffffff";
    }

    function applyGraphicalSettings(settings, target = clockTimer) {
        target.setAttribute("timer-type", settings.timerType || GRAPHICAL_DEFAULTS.timerType);
        target.setAttribute("timer-mode", settings.timerMode || GRAPHICAL_DEFAULTS.timerMode);
        target.setAttribute("military-time", String(Boolean(settings.militaryTime)));
        target.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm A"));

        setOptionalAttribute(target, "date-format", settings.dateFormat);
        setOptionalAttribute(target, "visible-hours", settings.visibleHours);
        setOptionalAttribute(target, "tick-marks", settings.tickMarks);
        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);
        target.removeAttribute("grayscale");
        target.removeAttribute("grayscale-ramp");
        target.showTolerance = settings.showTolerance;
        target.toggleAttribute("render-early-start-as-trip", !Boolean(settings.showEarlyStart));
        target.toggleAttribute("hide-break-buffer", !Boolean(settings.showBreakBuffer));
        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));
        target.toggleAttribute("hide-hour-hand", !Boolean(settings.showHourHand));
        target.toggleAttribute("hide-minute-hand", !Boolean(settings.showMinuteHand));
        target.toggleAttribute("hide-second-hand", !Boolean(settings.showSecondHand));

        const variables = {
            "--clock-timer-trip-color": settings.tripColor,
            "--clock-timer-early-start-color": settings.earlyStartColor,
            "--clock-timer-break-color": settings.breakColor,
            "--clock-timer-lunch-color": settings.lunchColor,
            "--clock-timer-break-buffer-color": settings.breakBufferColor,
            "--clock-timer-down-color": settings.downColor,
            "--clock-timer-approval-surplus-color": settings.approvalSurplusColor,
            "--clock-timer-approval-deficit-color": settings.approvalDeficitColor,
            "--clock-timer-tolerance-color": settings.toleranceColor,
            "--clock-timer-latency-color": settings.latencyColor,
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

        if (target === clockPreview) {
            renderClockPreviewRanges(settings);
        }

        if (target === clockTimer) {
            const paletteRoot = document.documentElement;
            const tripColor = settings.tripColor || GRAPHICAL_DEFAULTS.tripColor;
            const earlyStartColor = settings.earlyStartColor || GRAPHICAL_DEFAULTS.earlyStartColor;
            const breakColor = settings.breakColor || GRAPHICAL_DEFAULTS.breakColor;
            const lunchColor = settings.lunchColor || GRAPHICAL_DEFAULTS.lunchColor;
            const breakBufferColor = settings.breakBufferColor || GRAPHICAL_DEFAULTS.breakBufferColor;
            const downColor = settings.downColor || GRAPHICAL_DEFAULTS.downColor;
            const approvalSurplusColor = settings.approvalSurplusColor || GRAPHICAL_DEFAULTS.approvalSurplusColor;
            const approvalDeficitColor = settings.approvalDeficitColor || GRAPHICAL_DEFAULTS.approvalDeficitColor;
            const toleranceColor = settings.toleranceColor || GRAPHICAL_DEFAULTS.toleranceColor;
            const latencyColor = settings.latencyColor || GRAPHICAL_DEFAULTS.latencyColor;

            paletteRoot.style.setProperty("--timer-trip-color", tripColor);
            paletteRoot.style.setProperty("--timer-early-start-color", earlyStartColor);
            paletteRoot.style.setProperty("--timer-break-color", breakColor);
            paletteRoot.style.setProperty("--timer-break-text-color", getContrastingTextColor(breakColor));
            paletteRoot.style.setProperty("--timer-lunch-color", lunchColor);
            paletteRoot.style.setProperty("--timer-lunch-text-color", getContrastingTextColor(lunchColor));
            paletteRoot.style.setProperty("--timer-break-buffer-color", breakBufferColor);
            paletteRoot.style.setProperty("--timer-down-color", downColor);
            paletteRoot.style.setProperty("--timer-down-text-color", getContrastingTextColor(downColor));
            paletteRoot.style.setProperty("--timer-approval-surplus-color", approvalSurplusColor);
            paletteRoot.style.setProperty("--timer-approval-deficit-color", approvalDeficitColor);
            paletteRoot.style.setProperty("--timer-tolerance-color", toleranceColor);
            paletteRoot.style.setProperty("--timer-latency-color", latencyColor);
        }
    }

    function setToleranceCheckboxValue(control, value) {
        if (!control) return;

        const state =
            value === undefined
                ? "undefined"
                : value
                    ? "true"
                    : "false";

        control.dataset.toleranceState =
            state;

        control.indeterminate =
            state === "undefined";

        control.checked =
            state === "true";

        control.setAttribute(
            "aria-checked",
            state === "undefined"
                ? "mixed"
                : state
        );
    }

    function getToleranceCheckboxValue(control) {
        const state =
            control?.dataset.toleranceState;

        if (state === "undefined") {
            return undefined;
        }

        if (state === "false") {
            return false;
        }

        return true;
    }

    function settingsFromForm(form) {
        const data = new FormData(form);
        const text = name => String(data.get(name) || "").trim();
        return {
            timerType: text("timerType"),
            timerMode: text("timerMode"),
            tripColor: text("tripColor"),
            earlyStartColor: text("earlyStartColor"),
            showEarlyStart: form.elements.showEarlyStart.checked,
            breakColor: text("breakColor"),
            lunchColor: text("lunchColor"),
            breakBufferColor: text("breakBufferColor"),
            showBreakBuffer: form.elements.showBreakBuffer.checked,
            downColor: text("downColor"),
            approvalSurplusColor: text("approvalSurplusColor"),
            approvalDeficitColor: text("approvalDeficitColor"),
            toleranceColor: text("toleranceColor"),
            latencyColor: text("latencyColor"),
            showTolerance:
                getToleranceCheckboxValue(
                    form.elements.showTolerance
                ),
            showLatency: form.elements.showLatency.checked,
            militaryTime: form.elements.militaryTime.checked,
            timeFormat: text("timeFormat"),
            dateFormat: text("dateFormat"),
            visibleHours: text("visibleHours"),
            tickMarks: text("tickMarks"),
            indicatorSymbol: text("indicatorSymbol"),
            showHourHand: form.elements.showHourHand.checked,
            showMinuteHand: form.elements.showMinuteHand.checked,
            showSecondHand: form.elements.showSecondHand.checked,
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
            if (key === "showTolerance") {
                setToleranceCheckboxValue(
                    control,
                    value
                );
                continue;
            }
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;
        }
        syncTimeFormatForMilitaryToggle(form);
        applyGraphicalSettings(
            settingsFromForm(form),
            clockPreview
        );
    }

    function formatPreviewDate(value) {
        const pad = (part, length = 2) => String(part).padStart(length, "0");
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
    }

    function renderClockPreviewRanges(settings = settingsFromForm($("#graphicalSettingsForm"))) {
        if (!clockPreview) return;

        clockPreview.querySelector('[data-settings-preview="ranges"]')?.remove();

        const ring = document.createElement("ring-container");
        ring.dataset.settingsPreview = "ranges";
        ring.clockTimerRing = 0;
        ring.clockTimerRingIndex = 0;
        ring.clockTimerExternalRangeLayout =
            settings.timerType === "radial-fitted";
        ring.setAttribute("width", "18px");
        ring.setAttribute("inset", "18px");

        const segments = [
            ["trip", 10],
            [settings.showEarlyStart ? "earlystart" : "trip", 10],
            ["break", 10],
            [settings.showBreakBuffer ? "buffer" : "break", 10],
            ["lunch", 15],
            ["down", 10],
            ["approval-surplus", 5],
            ["approval-deficit", 5],
            [settings.showTolerance === false ? "trip" : "tolerance", 5],
            [settings.showLatency ? "latency" : "trip", 10]
        ];
        let cursor = new Date();
        cursor.setSeconds(0, 0);
        cursor = new Date(cursor.getTime() - 45 * 60 * 1000);

        for (const [type, minutes] of segments) {
            const end = new Date(cursor.getTime() + minutes * 60 * 1000);
            const range = document.createElement("time-range");
            range.setAttribute("type", type);
            range.setAttribute("start-time", formatPreviewDate(cursor));
            range.setAttribute("end-time", formatPreviewDate(end));
            ring.append(range);
            cursor = end;
        }

        clockPreview.prepend(ring);
    }

    function installGraphicalHelpButtons() {
        const form = $("#graphicalSettingsForm");
        for (const key of Object.keys(GRAPHICAL_HELP)) {
            if (getSettingsHelpButton(key)) continue;
            const control = form.elements[key];
            if (!control) continue;
            const button = document.createElement("button");
            button.className = "settings-help-button";
            button.type = "button";
            button.textContent = "?";
            button.dataset.helpKey = key;
            button.setAttribute("aria-label", `About ${GRAPHICAL_HELP[key].title}`);
            button.setAttribute("aria-hidden", "true");
            button.tabIndex = -1;

            const colorRow = control.closest(".timer-color-row");
            if (colorRow) {
                colorRow.classList.add("has-setting-help");
                colorRow.querySelector("label")?.before(button);
                continue;
            }

            const label = control.closest("label");
            if (!label) continue;
            label.classList.add("has-inline-setting-help");
            if (control.type === "color") label.classList.add("has-inline-color-help");
            const caption = document.createElement("span");
            caption.className = "setting-help-caption";
            for (const node of Array.from(label.childNodes)) {
                if (node === control || node === button) continue;
                if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
                caption.append(node);
            }
            if (control.type === "color") label.prepend(button, caption);
            else label.prepend(caption, button);
        }
    }

    function setGraphicalHelpVisibility(visible) {
        graphicalHelpVisible = Boolean(visible);
        graphicalDialog.classList.toggle("show-setting-help", graphicalHelpVisible);
        const toggle = $("#graphicalHelpToggle");
        toggle?.setAttribute("aria-pressed", String(graphicalHelpVisible));
        toggle?.setAttribute("aria-label", graphicalHelpVisible ? "Hide setting help" : "Show setting help");
        graphicalDialog.querySelectorAll(".settings-help-button").forEach(button => {
            button.setAttribute("aria-hidden", String(!graphicalHelpVisible));
            button.tabIndex = graphicalHelpVisible ? 0 : -1;
        });
        if (!graphicalHelpVisible) void closeSettingsHelpPopover({immediate: true});
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
                : (includesSeconds ? "h:mm:ss A" : "h:mm A");
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

    function getSettingsHelpElements() {
        return {
            popover: $("#graphicalHelpPopover"),
            title: $("#graphicalHelpTitle"),
            body: $("#graphicalHelpBody"),
            close: $("#graphicalHelpClose")
        };
    }

    function getSettingsHelpTemplate(key) {
        const ids = {
            syncGoals: "settingsHelpSyncGoals",
            tolerance: "settingsHelpTolerance",
            latency: "settingsHelpLatency",
            timeFormat: "settingsHelpTimeFormat",
            dateFormat: "settingsHelpDateFormat",
            visibleHours: "settingsHelpVisibleHours",
            tickMarks: "settingsHelpTickMarks"
        };

        return document.getElementById(
            ids[key]
        );
    }

    function getSettingsHelpButton(key) {
        return Array.from(
            graphicalDialog.querySelectorAll(
                ".settings-help-button"
            )
        ).find(
            button =>
                button.dataset.helpKey === key
        );
    }

    function hideSettingsHelpButton(button) {
        if (!button) return;
        if (button.classList.contains("menu-help-button")) return;

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        button.classList.remove(
            "is-visible"
        );

        if (
            graphicalHelpVisible &&
            graphicalDialog.contains(button)
        ) {
            button.setAttribute("aria-hidden", "false");
            button.tabIndex = 0;
            return;
        }

        button.setAttribute(
            "aria-hidden",
            "true"
        );

        button.tabIndex =
            -1;
    }

    function revealSettingsHelpButton(button) {
        if (!button) return;

        for (
            const candidate of
                graphicalDialog.querySelectorAll(
                    ".settings-help-button.is-visible"
                )
        ) {
            if (
                candidate !== button &&
                candidate !== activeSettingsHelpButton
            ) {
                hideSettingsHelpButton(
                    candidate
                );
            }
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        button.classList.add(
            "is-visible"
        );

        button.setAttribute(
            "aria-hidden",
            "false"
        );

        button.tabIndex =
            0;

        if (button === activeSettingsHelpButton) {
            return;
        }

        settingsHelpRevealTimers.set(
            button,
            setTimeout(
                () =>
                    hideSettingsHelpButton(
                        button
                    ),
                SETTINGS_HELP_FADE_DURATION +
                    SETTINGS_HELP_VISIBLE_DURATION
            )
        );
    }

    async function closeSettingsHelpPopover({
        immediate = false
    } = {}) {
        const {
            popover,
            title,
            body
        } = getSettingsHelpElements();

        const button =
            activeSettingsHelpButton;

        activeSettingsHelpButton =
            undefined;

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        hideSettingsHelpButton(
            button
        );

        if (
            !popover ||
            !popover.matches(
                ":popover-open"
            )
        ) {
            return;
        }

        if (!immediate) {
            const opacity =
                Number.parseFloat(
                    getComputedStyle(
                        popover
                    ).opacity
                );

            settingsHelpAnimation =
                popover.animate(
                    [
                        {
                            opacity:
                                Number.isFinite(opacity)
                                    ? opacity
                                    : 1
                        },
                        { opacity: 0 }
                    ],
                    {
                        duration:
                            SETTINGS_HELP_FADE_DURATION,
                        easing: "linear",
                        fill: "both"
                    }
                );

            try {
                await settingsHelpAnimation.finished;
            }
            catch {}
        }

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            popover.hidePopover();
        }

        if (title) title.textContent = "";
        if (body) body.replaceChildren();
    }

    function getGraphicalHelpState(control) {
        return control?.name === "showTolerance"
            ? getToleranceCheckboxValue(control)
            : Boolean(control?.checked);
    }

    function syncGraphicalHelpState(definition, body) {
        if (!definition?.stateControl || !body) return;
        const source = $("#graphicalSettingsForm").elements[definition.stateControl];
        const checkbox = body.querySelector(".settings-help-state-toggle");
        const label = body.querySelector(".settings-help-state-label");
        const description = body.querySelector(".settings-help-state-behavior");
        if (!source || !checkbox || !label || !description) return;

        const state = getGraphicalHelpState(source);
        checkbox.checked = state === true;
        checkbox.indeterminate = state === undefined;
        checkbox.setAttribute("aria-checked", state === undefined ? "mixed" : String(state));
        label.textContent = state === undefined ? "Automatic" : state ? "Enabled" : "Disabled";
        description.textContent = definition.stateText[String(state)];
    }

    function appendGraphicalHelpState(definition, body) {
        if (!definition?.stateControl) return;
        const divider = document.createElement("hr");
        divider.className = "settings-help-divider";
        const row = document.createElement("label");
        row.className = "settings-help-state-row";
        const checkbox = document.createElement("input");
        checkbox.className = "settings-help-state-toggle";
        checkbox.type = "checkbox";
        const label = document.createElement("strong");
        label.className = "settings-help-state-label";
        row.append(checkbox, label);
        const state = document.createElement("p");
        state.className = "settings-help-state-behavior";
        body.append(divider, row, state);
        checkbox.addEventListener("change", () => {
            const source = $("#graphicalSettingsForm").elements[definition.stateControl];
            source?.click();
            syncGraphicalHelpState(definition, body);
        });
        syncGraphicalHelpState(definition, body);
    }

    function refreshActiveGraphicalHelpState() {
        const key = activeSettingsHelpButton?.dataset.helpKey;
        const definition = GRAPHICAL_HELP[key];
        if (definition?.stateControl) {
            syncGraphicalHelpState(definition, $("#graphicalHelpBody"));
        }
    }

    async function openSettingsHelpPopover(
        key,
        button
    ) {
        const definition = GRAPHICAL_HELP[key];
        const template =
            getSettingsHelpTemplate(
                key
            );

        const {
            popover,
            title,
            body,
            close
        } = getSettingsHelpElements();

        if (
            (!template && !definition) ||
            !popover ||
            !title ||
            !body
        ) {
            return;
        }

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            await closeSettingsHelpPopover();
        }

        // A closed dialog hides its descendants; an open modal makes outside
        // content inert. Keep shared help in the requesting button's context.
        const helpHost = button.closest("dialog") || document.body;
        if (popover.parentElement !== helpHost) {
            helpHost.append(popover);
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        activeSettingsHelpButton =
            button;

        revealSettingsHelpButton(
            button
        );

        title.textContent = definition?.title || template.dataset.helpTitle || "Help";
        if (definition) {
            const paragraph = document.createElement("p");
            paragraph.textContent = definition.text;
            body.replaceChildren(paragraph);
            appendGraphicalHelpState(definition, body);
        }
        else {
            body.replaceChildren(template.content.cloneNode(true));
        }

        const latencyColor =
            graphicalDialog.querySelector(
                '[name="latencyColor"]'
            )?.value ||
            GRAPHICAL_DEFAULTS.latencyColor;

        popover.style.setProperty(
            "--settings-help-latency-color",
            latencyColor
        );

        popover.showPopover();

        settingsHelpAnimation?.cancel();

        settingsHelpAnimation =
            popover.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration:
                        SETTINGS_HELP_FADE_DURATION,
                    easing: "linear",
                    fill: "both"
                }
            );

        try {
            await settingsHelpAnimation.finished;
        }
        catch {}

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        close?.focus({
            preventScroll: true
        });
    }

    installGraphicalHelpButtons();
    renderClockPreviewRanges();
    setGraphicalHelpVisibility(false);

    $("#graphicalHelpToggle")?.addEventListener("click", () => {
        setGraphicalHelpVisibility(!graphicalHelpVisible);
    });

    document.querySelectorAll(
        ".settings-help-button"
    ).forEach(
        button => {
            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    revealSettingsHelpButton(
                        button
                    );

                    void openSettingsHelpPopover(
                        button.dataset.helpKey,
                        button
                    );
                }
            );
        }
    );

    $("#graphicalHelpClose")?.addEventListener(
        "click",
        () => {
            void closeSettingsHelpPopover();
        }
    );

    document.addEventListener(
        "pointerdown",
        event => {
            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            const path =
                event.composedPath();

            if (
                path.includes(popover) ||
                path.includes(
                    activeSettingsHelpButton
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    graphicalDialog.addEventListener(
        "close",
        () => {
            void closeSettingsHelpPopover({
                immediate: true
            });
        }
    );

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

    scopeToggle.addEventListener("pointerup", () => {
        const current =
            PERCENT_MODES.indexOf(
                normalizePercentMode(
                    clockTimer.percentMode
                )
            );

        applyScope(
            PERCENT_MODES[
                (current + 1) %
                PERCENT_MODES.length
            ]
        );
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
    );

    const renderedTimeButton = $("#renderedTimeButton");

    function cancelRenderedTimeLongPress() {
        clearTimeout(renderedTimeLongPressTimer);
        renderedTimeLongPressTimer = undefined;
    }

    renderedTimeButton.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        renderedTimeLongPressed = false;
        cancelRenderedTimeLongPress();
        if (!tripIsLive() || clockTimer.renderedTimeMode !== "calculated-end") return;
        renderedTimeLongPressTimer = setTimeout(() => {
            renderedTimeLongPressTimer = undefined;
            renderedTimeLongPressed = openEndTimeGoalNumberPad();
        }, 650);
    });

    renderedTimeButton.addEventListener("pointerup", () => {
        cancelRenderedTimeLongPress();
        if (renderedTimeLongPressed) {
            renderedTimeLongPressed = false;
            return;
        }
        const index = RENDERED_TIME_MODES.indexOf(clockTimer.renderedTimeMode);
        applyRenderedTimeMode(RENDERED_TIME_MODES[(index + 1) % RENDERED_TIME_MODES.length]);
    });

    for (const type of ["pointercancel", "pointerleave"]) {
        renderedTimeButton.addEventListener(type, cancelRenderedTimeLongPress);
    }

    renderedTimeButton.addEventListener("contextmenu", event => event.preventDefault());

    $("#endTimeGoalLock")?.addEventListener("click", event => {
        event.stopPropagation();
        if (clockTimer.percentMode !== "auto") {
            releaseEndTimeGoalOverride();
            return;
        }
        refreshEndTimeLockDialog();
        openDialogElement($("#endTimeLockDialog"), {
            duration: 250,
            reason: "end-time-lock-scopes"
        });
    });

    for (const checkbox of [$("#endTimeTripLock"), $("#endTimeTotalLock")]) {
        checkbox?.addEventListener("change", updateEndTimeLockReleaseMessage);
    }

    $("#endTimeLockForm")?.addEventListener("submit", event => {
        event.preventDefault();
        const scopes = selectedEndTimeLockScopes().sort();
        const unchanged = scopes.length === endTimeLockDialogInitialScopes.length &&
            scopes.every((scope, index) => scope === endTimeLockDialogInitialScopes[index]);
        if (!unchanged && !setEndTimeGoalScopes(scopes)) return;
        closeDialog($("#endTimeLockDialog"), { reason: "end-time-lock-scopes-saved" });
    });

    function toggleClockTimerTypeFromTap() {
        if (!tripIsLive()) return false;

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
        return true;
    }

    function toggleClockTimerElapsedRemaining() {
        if (!tripIsLive()) return false;

        applyRenderedTimeMode(
            clockTimer.renderedTimeMode === "elapsed"
                ? "remaining"
                : "elapsed"
        );

        return true;
    }

    clockTimer.addEventListener("pointerup", event => {
        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        if (!tripIsLive()) {
            clearTimeout(clockTimerTapTimer);
            clockTimerTapTimer = undefined;
            clockTimerLastTapAt = -Infinity;
            return;
        }

        const now = performance.now();

        if (
            clockTimerTapTimer !== undefined &&
            now - clockTimerLastTapAt <=
                CLOCK_TIMER_DOUBLE_PRESS
        ) {
            clearTimeout(clockTimerTapTimer);
            clockTimerTapTimer = undefined;
            clockTimerLastTapAt = -Infinity;
            toggleClockTimerElapsedRemaining();
            return;
        }

        if (clockTimerTapTimer !== undefined) {
            clearTimeout(clockTimerTapTimer);
        }

        clockTimerLastTapAt = now;
        clockTimerTapTimer = setTimeout(
            () => {
                clockTimerTapTimer = undefined;
                clockTimerLastTapAt = -Infinity;
                toggleClockTimerTypeFromTap();
            },
            CLOCK_TIMER_DOUBLE_PRESS
        );
    });

    tripLogPinButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            setTripLogPinned(
                !tripLogIsPinned()
            );
        }
    );

    mainMenu?.addEventListener("toggle", event => {
        if (event.newState === "open") void resolveTripLogCalendar().catch(error => showTripRangeError(error.message));
    });

    for (const input of [tripLogStartDate, tripLogEndDate]) input?.addEventListener("change", () => {
        if (getTripLogRange() === "custom") refreshTripLogSelection();
    });

    $("#tripProductionFilter").addEventListener("change",event=>setTripProductionFilter(event.target.value));
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

    tripLogSettingsButton?.addEventListener("click", () => {
        tripLogSettingsVisible = !tripLogSettingsVisible;
        tripLogSettingsButton.setAttribute("aria-expanded", String(tripLogSettingsVisible));
        tripLogSettingsButton.setAttribute("aria-label", tripLogSettingsVisible ? "Hide Trip Log settings" : "Show Trip Log settings");
        tripLogView?.setSettingsVisible(tripLogSettingsVisible);
    });
    tripLogCloseButton?.addEventListener(
        "click",
        () => {
            void closeTripList(
                "close"
            );
        }
    );

    document.querySelectorAll("[data-dialog]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.dataset.dialog === "profileDialog" && clockTimer.networkStatus !== "online") {
                openDialog("loginDialog", { fromPopover: true, reason: "popover-handoff" });
                return;
            }
            if (button.dataset.dialog === "graphicalSettingsDialog") {
                setGraphicalHelpVisibility(false);
                fillGraphicalForm(getGraphicalSettings());
            }
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

        if (event.target.name === "showTolerance") {
            const previous =
                getToleranceCheckboxValue(
                    event.target
                );

            const next =
                previous === true
                    ? false
                    : previous === false
                        ? undefined
                        : true;

            setToleranceCheckboxValue(
                event.target,
                next
            );
        }
        else if (event.target.name === "militaryTime") {
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
            refreshActiveGraphicalHelpState();
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

    $("#loginForm").addEventListener("submit", async event => {
        event.preventDefault();
        const username = $("#loginUsername").value.trim();
        const password = $("#loginPassword").value;
        const error = $("#loginError");
        error.textContent = "";

        if (normalizedConnectionStatus() === "offline") {
            animateOfflineClouds();
        }

        loginPending = true;
        try {
            const result = await clockTimer.connect(username, password);
            if (!result?.connected) throw new Error("Login failed.");
            deliberatelyLoggedOut = false;
            safeStorageSet("wmof.deliberatelyLoggedOut", "false");
            populateProfile(result.user);

            for (let index = uiReturnStack.length - 1; index >= 0; index -= 1) {
                if (
                    uiReturnStack[index]?.type === "popover" &&
                    uiReturnStack[index]?.element === mainMenu
                ) {
                    uiReturnStack.splice(index, 1);
                }
            }
            hidePopoverForHandoff(mainMenu);

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
        deliberatelyLoggedOut = true;
        safeStorageSet("wmof.deliberatelyLoggedOut", "true");
        clearTimeout(loginPromptTimeout);
        try { await clockTimer.disconnect(); }
        catch {}
        finally { syncNetworkStatusUI(); }
    });

    $("#adminMenuButton").addEventListener("click", () => {const submenu=$("#adminSubmenu"),open=submenu.hidden;submenu.hidden=!open;$("#adminMenuButton").setAttribute("aria-expanded",String(open));});
    $("#newUserButton").addEventListener("click", () => {mainMenu?.hidePopover?.();$("#newUserFrame").src=`${API_BASE}api/admin/new-user/`;openDialog("newUserDialog",{fromPopover:true,reason:"admin-new-user"});});

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

    async function fetchResource(url, options = {}) {
        return fetch(url, options)
            .then(async response => {
                const text =
                    await response
                        .text()
                        .catch(() => "");

                return {
                    response,
                    body: response.ok
                        ? {
                            ok: true,
                            status: response.status,
                            text
                        }
                        : {
                            ok: false,
                            error: "http_error",
                            message:
                                `Request failed (${response.status}).`,
                            status: response.status,
                            text
                        }
                };
            })
            .catch(cause => ({
                response: undefined,
                body: {
                    ok: false,
                    error: "fetch_failed",
                    message:
                        cause?.message ||
                        "Network request failed.",
                    status: 0,
                    text: ""
                },
                cause
            }));
    }

    async function ensureNumberPadLoaded() {
        if (numberPadDialog?.isConnected) return;
        if (!numberPadLoadPromise) {
            numberPadLoadPromise = (async () => {
                const result =
                    await fetchResource(
                        "numberpad.html",
                        { cache: "no-store" }
                    );

                const body =
                    result.body || {};

                if (!body.ok) {
                    throw new Error(
                        body.message ||
                        "Unable to load number pad."
                    );
                }

                const template = document.createElement("template");
                template.innerHTML = String(body.text || "").trim();
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
        if (!absoluteDigitsValid(state.pending, state.meridiem)) return undefined;
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
        if (source === "trip-goal") {
            return "Trip Percent";
        }
        if (source === "total-goal") {
            return "Total Percent";
        }
        return titles[source] || "Number Pad";
    }

    function numberPadValueValid() {
        if (!numberPadState) return false;
        if (!numberPadState.pending) return Boolean(numberPadState.allowEmpty);
        if (numberPadState.mode === "percent") {
            return Number.isInteger(Number(numberPadState.pending)) && Number(numberPadState.pending) > 0;
        }
        if (numberPadState.mode === "absolute") {
            return Boolean(numberPadState.pendingDate) && absoluteDigitsValid(numberPadState.pending, numberPadState.meridiem);
        }
        return timeDigitsValid(numberPadState.pending);
    }

    function absoluteValuesEqual(first, second) {
        const firstHour = absoluteHour24(first);
        const secondHour = absoluteHour24(second);
        if (firstHour === undefined || secondHour === undefined) {
            return first.pending === second.pending && first.meridiem === second.meridiem;
        }
        const firstParts = splitAbsoluteDigits(first.pending);
        const secondParts = splitAbsoluteDigits(second.pending);
        return firstHour === secondHour && firstParts.minute === secondParts.minute &&
            firstParts.second === secondParts.second;
    }

    function numberPadHasChanges() {
        if (!numberPadState) return false;
        if (numberPadState.mode === "absolute") {
            return numberPadState.pendingDate !== numberPadState.initialDate ||
                !absoluteValuesEqual(numberPadState, {
                    pending: numberPadState.initial,
                    meridiem: numberPadState.initialMeridiem
                });
        }
        return numberPadState.pending !== numberPadState.initial ||
            numberPadState.pendingDate !== numberPadState.initialDate ||
            numberPadState.meridiem !== numberPadState.initialMeridiem;
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges() || (numberPadState.meridiem ?? null) !== (numberPadState.initialMeridiem ?? null)) return "reset";
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
        numberPadContext.classList.toggle("absolute-mode", absoluteMode);
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

        $("#numberPadBackspace").disabled = !numberPadState.pending;
        numberPadContext.style.setProperty(
            "--number-pad-title-center",
            absoluteMode
                ? "calc((100% - clamp(54px, 16vw, 72px)) / 2)"
                : "50%"
        );
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
            !numberPadState.onConfirm &&
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
        duration = 250,
        onConfirm, onCancel, title, allowEmpty = false
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
            onConfirm, onCancel,
            source,
            title: title || getNumberPadTitle(source),
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
            everEdited: false,
            allowEmpty: Boolean(allowEmpty)
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
        if (state.onCancel && discardPrepared) state.onCancel();
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
                renderDeferredTrip();
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

    function getPercentGoalAttribute(scope) {
        return scope === "total"
            ? "total-goal"
            : "trip-goal";
    }

    function parsePercentGoalAttribute(raw) {
        if (typeof raw !== "string") {
            return undefined;
        }

        let text =
            raw.trim();

        if (!text) {
            return undefined;
        }

        const percent =
            text.endsWith("%");

        if (percent) {
            text = text.slice(0, -1).trim();
        }

        let value =
            Number(text);

        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }

        if (percent) {
            value /= 100;
        }
        else if (value > 1.5) {
            value /= 100;
        }

        return Number.isFinite(value) && value > 0
            ? value
            : undefined;
    }

    function getConfiguredGoalDisplay(scope) {
        const attribute =
            getPercentGoalAttribute(scope);

        if (!clockTimer.hasAttribute(attribute)) {
            return "100%";
        }

        return formatSummaryPercent(
            parsePercentGoalAttribute(
                clockTimer.getAttribute(attribute)
            ),
            "100%"
        );
    }

    function getPercentGoalValue(scope) {
        const attribute =
            getPercentGoalAttribute(scope);

        const raw =
            clockTimer.getAttribute(attribute);

        return raw && raw.trim()
            ? raw
            : "100%";
    }

    function refreshAutoGoalDialog() {
        if (!autoGoalDialog) {
            return;
        }

        if (autoTripGoalValue) {
            autoTripGoalValue.textContent =
                getConfiguredGoalDisplay("trip");
        }

        if (autoTotalGoalValue) {
            autoTotalGoalValue.textContent =
                getConfiguredGoalDisplay("total");
        }

        const lockedScopes = new Set(endTimeGoalOverride?.scopes || []);
        for (const button of autoGoalDialog.querySelectorAll("[data-auto-goal-scope]")) {
            const scope = button.dataset.autoGoalScope === "total" ? "total" : "trip";
            const locked = lockedScopes.has(scope);
            button.disabled = locked;
            button.setAttribute(
                "aria-label",
                locked
                    ? `${scope === "total" ? "Total" : "Trip"} goal locked to End Time`
                    : `Edit ${scope === "total" ? "Total" : "Trip"} goal`
            );
        }
    }

    function openAutoGoalDialog() {
        if (!autoGoalDialog) {
            return false;
        }

        refreshAutoGoalDialog();

        return openDialogElement(
            autoGoalDialog,
            {
                duration: 250,
                reason: "auto-goal"
            }
        );
    }

    function openPercentGoalNumberPad(scope) {
        const normalizedScope =
            scope === "total"
                ? "total"
                : "trip";

        return openNumberPad({
            mode: "percent",
            source:
                `${normalizedScope}-goal`,
            initialValue:
                getPercentGoalValue(
                    normalizedScope
                ),
            role: "root",
            workflow:
                tripIsLive()
                    ? "edit-trip"
                    : null,
            cancelTarget: "home",
            confirmTarget: "home"
        });
    }

    async function commitNumberPad() {
        if (!numberPadState || !numberPadValueValid()) return false;
        const state = { ...numberPadState };
        if (state.onConfirm) {
            const value = !state.pending ? undefined : state.mode === "absolute" ? new Date(`${state.pendingDate}T${String(absoluteHour24(state)).padStart(2,"0")}:${String(splitAbsoluteDigits(state.pending).minute).padStart(2,"0")}:${String(splitAbsoluteDigits(state.pending).second).padStart(2,"0")}`).toISOString() : renderTimeDigits(state.pending);
            return await state.onConfirm(value) !== false;
        }
        if (!numberPadHasChanges() && !state.startsTripOnConfirm) return false;
        if (state.mode === "percent") {
            const percent =
                Number(state.pending);

            const attribute =
                state.source === "total-goal"
                    ? "total-goal"
                    : "trip-goal";

            clockTimer.configure({
                [attribute === "total-goal" ? "total_goal" : "trip_goal"]:
                    `${percent}%`
            });

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
            if (scheduledStartReturnMode) {
                const returnMode = scheduledStartReturnMode;
                scheduledStartReturnMode = undefined;
                setTimeout(() => {
                    applyTripSettingsSession();
                    if (tripSettingsDialog.open) closeDialog(tripSettingsDialog, {reason:"scheduled-standard-set",immediate:true});
                    showScheduledStartDialog({resolution:returnMode === "resolution"});
                }, 300);
            }
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

    function eraseNumberPadPendingValue() {
        if (!numberPadState) return;
        numberPadState.pending = "";
        numberPadState.meridiem = undefined;
        numberPadState.replaceOnNextDigit = false;
        numberPadState.everEdited = true;
        refreshNumberPad();
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
        if (next !== "AM" && next !== "PM") return;
        const parts = splitAbsoluteDigits(numberPadState.pending);
        if (!parts) return;
        const previous = numberPadState.meridiem;
        const previousValue = { pending: numberPadState.pending, meridiem: previous };
        const target = previous === next ? null : next;
        let hour = parts.hour;
        if (previous && !target) {
            hour = hour % 12 + (previous === "PM" ? 12 : 0);
        }
        else if (target) {
            hour = hour % 12 || 12;
        }
        numberPadState.meridiem = target;
        numberPadState.pending = absoluteDigits(hour, parts.minute, parts.second);
        if (!absoluteValuesEqual(previousValue, numberPadState)) numberPadState.everEdited = true;
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

    function tripDraftFutureStartDate(draft = tripDraft) {
        const date = parseDateInput(draft?.creationDate);
        const timeline = parseTimelineTime(draft?.startTime);
        if (!date || !Number.isFinite(timeline)) return undefined;
        return new Date(date.getTime() + timeline);
    }

    function tripDraftHasFutureStart(draft = tripDraft, now = new Date()) {
        const start = tripDraftFutureStartDate(draft);
        return start instanceof Date && start.getTime() > now.getTime();
    }

    function futureTripClockIcon(date) {
        const centerX = 10.5, centerY = 13;
        const point = (turn, length) => {
            const angle = turn * Math.PI * 2 - Math.PI / 2;
            return [centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length];
        };
        const minuteTurn = date.getMinutes() / 60;
        const hourTurn = (date.getHours() % 12 + minuteTurn) / 12;
        const [hourX,hourY] = point(hourTurn, 3.2);
        const [minuteX,minuteY] = point(minuteTurn, 4.6);
        return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="${centerX}" cy="${centerY}" r="6.5"/><path d="M${centerX} ${centerY}L${hourX.toFixed(2)} ${hourY.toFixed(2)}M${centerX} ${centerY}L${minuteX.toFixed(2)} ${minuteY.toFixed(2)}M15.8 5.6a8.7 8.7 0 0 1 3.2 5.7M19.6 8.5l-.6 2.8-2.8-.6"/></svg>`;
    }

    function tripDraftCanRequestStart(draft = tripDraft) {
        if (tripDraftCanStart(draft)) return true;
        if (!draft || draft.deferred || !tripDraftHasFutureStart(draft)) return false;
        const creationTime = parseTimelineTime(draft.creationTime);
        const scheduledStart = parseTimelineTime(draft.scheduledStart);
        const actualStart = parseTimelineTime(draft.startTime);
        return Boolean(parseDateInput(draft.creationDate)) &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 86400000 &&
            Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
            Number.isFinite(actualStart) && actualStart >= 0;
    }

    function stopScheduledStartTicker() {
        clearInterval(scheduledStartTicker);
        scheduledStartTicker = undefined;
    }

    function flagScheduledStandardTime() {
        scheduledStartStandard.classList.remove("needs-value");
        void scheduledStartStandard.offsetWidth;
        scheduledStartStandard.classList.add("needs-value");
        scheduledStartMessage.hidden = false;
        scheduledStartMessage.textContent = "Enter Standard Time before starting the trip.";
    }

    async function beginScheduledTrip(mode) {
        if (!tripDraftCanStart(tripDraft)) {
            flagScheduledStandardTime();
            return false;
        }
        if (mode === "now") Object.assign(tripDraft, resumedTripStarts(tripDraft, new Date()));
        else tripDraft.startTime = formatTimelineMilliseconds(parseTimelineTime(tripDraft.startTime));
        stopScheduledStartTicker();
        scheduledStartAutoArmed = false;
        scheduledStartNeedsResolution = false;
        if (!await startTripDraft()) return false;
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-trip-start"});
        return true;
    }

    function openMissingScheduledStandard() {
        scheduledStartNeedsResolution = true;
        scheduledStartReturnMode = "resolution";
        scheduledStartAutoArmed = false;
        stopScheduledStartTicker();
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-standard-required",immediate:true});
        tripSettingsSession = undefined;
        beginTripSettingsSession();
        openTripSettingsDialog("scheduled-standard-required", {duration:0});
        drawAttentionToTripField("standard-time");
    }

    function updateScheduledStartDialog() {
        const scheduled = tripDraftFutureStartDate();
        const remaining = scheduled ? scheduled.getTime() - Date.now() : 0;
        scheduledStartCountdown.textContent = formatDuration(Math.max(0, remaining));
        scheduledStartStandardValue.textContent = String(tripDraft?.standardTime || "").trim() || "---";
        if (scheduledStartAutoArmed && remaining <= 0) {
            scheduledStartAutoArmed = false;
            if (tripDraftCanStart(tripDraft)) void beginScheduledTrip("scheduled");
            else openMissingScheduledStandard();
        }
    }

    function showScheduledStartDialog({resolution=false}={}) {
        scheduledStartNeedsResolution = Boolean(resolution);
        scheduledStartAutoOption.hidden = resolution;
        scheduledStartCancel.hidden = resolution;
        scheduledStartOnTime.hidden = !resolution;
        scheduledStartNow.hidden = false;
        scheduledStartAuto.checked = scheduledStartAutoArmed;
        scheduledStartMessage.hidden = true;
        scheduledStartStandard.classList.remove("needs-value");
        updateScheduledStartDialog();
        stopScheduledStartTicker();
        scheduledStartTicker = setInterval(updateScheduledStartDialog, 250);
        if (!scheduledStartDialog.open) openDialogElement(scheduledStartDialog, {reason:resolution?"scheduled-start-resolution":"early-start"});
    }

    function cancelScheduledStartPrompt() {
        scheduledStartAutoArmed = false;
        scheduledStartNeedsResolution = false;
        stopScheduledStartTicker();
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-start-cancel"});
    }

    scheduledStartAuto.addEventListener("change", () => {
        scheduledStartAutoArmed = scheduledStartAuto.checked;
        updateScheduledStartDialog();
    });
    scheduledStartNow.addEventListener("click", () => void beginScheduledTrip("now"));
    scheduledStartOnTime.addEventListener("click", () => void beginScheduledTrip("scheduled"));
    scheduledStartCancel.addEventListener("click", cancelScheduledStartPrompt);
    scheduledStartClose.addEventListener("click", cancelScheduledStartPrompt);
    scheduledStartDialog.addEventListener("cancel", event => {event.preventDefault();cancelScheduledStartPrompt();});
    scheduledStartStandard.addEventListener("click", () => {
        scheduledStartReturnMode = scheduledStartNeedsResolution ? "resolution" : "initial";
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-standard-edit",immediate:true});
        tripSettingsSession = undefined;
        beginTripSettingsSession();
        openTripSettingsDialog("scheduled-standard-edit", {duration:0});
        drawAttentionToTripField("standard-time");
    });

    function tripDraftCanStart(draft = tripDraft) {
        if (!draft || !parseDateInput(draft.creationDate)) return false;
        const standardTime = parseTimelineTime(draft.standardTime);
        const creationTime = parseTimelineTime(draft.creationTime);
        const scheduledStart = parseTimelineTime(draft.scheduledStart);
        const actualStart = parseTimelineTime(draft.startTime);
        return (
            (draft.deferred || (Number.isFinite(standardTime) && standardTime > 0)) &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 24 * 60 * 60 * 1000 &&
            (draft.deferred || (Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
            Number.isFinite(actualStart) && actualStart >= 0))
        );
    }

    async function startTripDraft() {
        const draft = tripDraft;
        if (draft?.deferred) return false;
        const standardTime = String(draft?.standardTime || "").trim();
        if (!tripDraftCanStart(draft)) return false;

        clockTimer.configure({auto_goal: Boolean(draft.syncGoals)});
        clockTimer.intervalElapsedBehavior = "startLatency";
        clockTimer.autoRestartTripAfterLateBreak =
            draft.lateBreakBehavior === "autoRestartTrip";

        if (draft.syncGoals) {
            const calendar = await resolveTripLogCalendar();
            const window = CalendarRange.tripWindow(calendar);
            try { await updateTripTotals(window); }
            catch (error) { if (!error.clockTimerOffline) throw error; }
        }

        await clockTimer.start({
            standardTime,
            creationDate: draft.creationDate,
            nonProduction: draft.nonProduction === true,
            creationTime: draft.creationTime,
            scheduledStart: draft.scheduledStart,
            startTime: draft.startTime
        });
        if (draft.creationDate && clockTimer.creationDate !== draft.creationDate) {
            clockTimer.creationDate = draft.creationDate;
        }

        stagedStandardTime = standardTime;
        tripDraft = undefined;
        renderDeferredTrip();
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
            deferred: !live && Boolean(draft.deferred),
            nonProduction: live ? clockTimer.nonProduction : draft.nonProduction === true,
            syncGoals: live
                ? Boolean(clockTimer.autoSyncTripGoal)
                : Boolean(draft.syncGoals)
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
            deferred: Boolean(values.deferred),
            nonProduction: values.nonProduction === true,
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            syncGoals: Boolean(values.syncGoals)
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

        // Layout widths stay unscaled while the dialog animates into view.
        const measureLabel = label => {
            const probe = document.createElement("span");
            probe.textContent = label.textContent;
            probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:max-content;white-space:nowrap;font:inherit;";
            tripSetStartsNow.append(probe);
            const width = probe.scrollWidth;
            probe.remove();
            return width;
        };
        const fullWidth = !tripSetStartsNowActions.classList.contains("is-selecting") &&
            !tripStartsNowExiting;
        const startWidth = fullWidth ? measureLabel(tripSetStartsNowStartCopy) : 0;
        const nowWidth = fullWidth ? measureLabel(tripSetStartsNowNowLabel) : 0;
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
        // Measure the labels before changing layout so every transition starts together.
        syncTripStartsNowButtonContent(active);
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
            deferred: Boolean(values.deferred),
            nonProduction: values.nonProduction === true,
            standardTime: values.standardTime,
            creationTime: values.creationTime,
            creationDate: values.creationDate,
            scheduledStart: values.scheduledStart,
            startTime: values.startTime,
            syncGoals: Boolean(values.syncGoals)
        });
    }

    function applyTripSettingsSession() {
        const session = tripSettingsSession;
        if (!session) return true;
        const values = session.values;

        if (!session.live) {
            if (!tripDraft) return false;
            Object.assign(tripDraft, {
                deferred: Boolean(values.deferred),
            nonProduction: values.nonProduction === true,
                standardTime: values.standardTime,
                creationTime: values.creationTime,
                creationDate: values.creationDate,
                scheduledStart: values.scheduledStart,
                startTime: values.startTime,
                syncGoals: Boolean(values.syncGoals)
            });
            return true;
        }

        try {
            if (clockTimer.creationDate !== values.creationDate) clockTimer.creationDate = values.creationDate;
            if (clockTimer.creationTime !== values.creationTime) clockTimer.creationTime = values.creationTime;
            if (clockTimer.scheduledStart !== values.scheduledStart) clockTimer.scheduledStart = values.scheduledStart;
            if (clockTimer.startTime !== values.startTime) clockTimer.startTime = values.startTime;
            if (clockTimer.standardTime !== values.standardTime) clockTimer.standardTime = values.standardTime;
            clockTimer.nonProduction = values.nonProduction === true;
            clockTimer.configure({auto_goal: Boolean(values.syncGoals)});
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

    function refreshTripSettingsValues() {
        syncTripSettingsCloud();
        const live = tripIsLive();
        const draft = !live ? tripDraft : undefined;
        const settingsValues = tripSettingsSession?.values || getCurrentTripSettingsValues();
        if (settingsValues?.deferred) settingsValues.scheduledStart = settingsValues.creationTime;
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
            "standard-time": settingsValues?.deferred
                ? "---"
                : settingsValues?.standardTime || "---"
        };

        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            button.disabled = (!live && !draft) || (settingsValues?.deferred && ["standard-time", "scheduled-start", "actual-start"].includes(button.dataset.tripTimeField));
        });
        $("#tripProductive").checked = !settingsValues?.nonProduction;
        $("#tripDefer").checked = Boolean(settingsValues?.deferred);
        $("#tripDefer").disabled = live || !draft;
        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";
        const futureTrip = Boolean(draft && !settingsValues?.deferred && tripDraftHasFutureStart(getTripSettingsCandidateDraft()));
        tripSettingsPrimary.dataset.futureTrip = String(futureTrip);
        if (futureTrip) {
            tripSettingsPrimary.innerHTML = futureTripClockIcon(tripDraftFutureStartDate(getTripSettingsCandidateDraft()));
            tripSettingsPrimary.setAttribute("aria-label", "Review future trip start");
            tripSettingsPrimary.title = "Future trip";
        }
        else {
            tripSettingsPrimary.textContent = settingsValues?.deferred ? "Defer" : draft ? "Start Trip" : "Save";
            tripSettingsPrimary.setAttribute("aria-label", tripSettingsPrimary.textContent);
            tripSettingsPrimary.removeAttribute("title");
        }
        tripSettingsPrimary.value = draft ? "start" : "save";
        tripSettingsPrimary.disabled = Boolean(draft && !tripDraftCanRequestStart(getTripSettingsCandidateDraft()));
        syncTripStartsNowUI();
        if (settingsValues?.deferred) tripSetStartsNow.disabled = true;
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
        if (opened) syncTripStartsNowUI();
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
        if (tripSettingsSession?.values.deferred && ["scheduled-start", "actual-start"].includes(field)) return Promise.resolve();
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
        const backspace = $("#numberPadBackspace");
        let deleteTimer, held = false;
        const erase = eraseNumberPadPendingValue;
        backspace.addEventListener("pointerdown", event => {
            held = false;backspace.setPointerCapture?.(event.pointerId);
            deleteTimer = setTimeout(() => {held=true;erase(true);}, NUMBER_PAD_LONG_PRESS);
        });
        backspace.addEventListener("pointerup", () => {clearTimeout(deleteTimer);if (!held) erase(false);});
        backspace.addEventListener("pointercancel", () => clearTimeout(deleteTimer));
        backspace.addEventListener("click", event => {if (event.detail===0) erase(false);});

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
            void resumeConnectionFromCloud({ source: "number-pad" }).catch(() => {});
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
        if (
            tripSettingsCloud.dataset.networkStatus !== "offline" ||
            connectionCloudPhase !== "settled"
        ) return;
        void resumeConnectionFromCloud({
            source: "trip-settings"
        }).catch(() => {});
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
                snapshot: {
                    scheduledStart: values.scheduledStart,
                    startTime: values.startTime
                },
                scheduled: false,
                actual: false
            };
            syncTripStartsNowUI();
            return;
        }

        beginTripStartsNowExit();
    });

    tripSetStartsNowCancel.addEventListener("pointerup", () => {
        if (!tripStartsNowState) return;
        const values = tripSettingsSession?.values;
        const snapshot = tripStartsNowState.snapshot;
        if (values && snapshot) {
            if (tripStartsNowState.scheduled) {
                values.scheduledStart = snapshot.scheduledStart;
            }
            if (tripStartsNowState.actual) {
                values.startTime = snapshot.startTime;
            }
        }
        beginTripStartsNowExit();
    });

    tripStartNowToggles.forEach(button => {
        button.addEventListener("pointerup", () => {
            if (!tripStartsNowState) return;
            const values = tripSettingsSession?.values;
            const snapshot = tripStartsNowState.snapshot;
            if (!values || !snapshot) return;

            const scheduled =
                button.dataset.tripStartNowTarget === "scheduled-start";
            const key = scheduled ? "scheduled" : "actual";
            const selected = !tripStartsNowState[key];
            tripStartsNowState[key] = selected;

            if (scheduled) {
                values.scheduledStart = selected
                    ? tripStartsNowState.value
                    : snapshot.scheduledStart;
            }
            else {
                values.startTime = selected
                    ? tripStartsNowState.value
                    : snapshot.startTime;
            }

            refreshTripSettingsValues();
        });
    });

    $("#tripProductive").addEventListener("change", event => {
        const session = tripSettingsSession || beginTripSettingsSession();
        if (session) session.values.nonProduction = !event.target.checked;
    });

    function renderDeferredTrip() {
        const button = $("#newTripButton");
        button.classList.toggle("has-deferred-trip", Boolean(tripDraft?.deferred));
        button.title = tripDraft?.deferred ? "Resume deferred trip" : "New Trip";
    }

    $("#tripDefer").addEventListener("change", event => {
        const session = tripSettingsSession || beginTripSettingsSession();
        if (!session || session.live) return;
        const values = session.values;
        if (event.target.checked) {
            session.preDeferredValues = cloneTripSettingsValues(values);
            values.scheduledStart = values.creationTime;
            values.startTime = undefined;
            tripStartsNowState = undefined;
            tripStartsNowExiting = false;
        } else {
            if (session.preDeferredValues) {
                Object.assign(values, cloneTripSettingsValues(session.preDeferredValues));
            }
            session.preDeferredValues = undefined;
        }
        values.deferred = event.target.checked;
        tripStartsNowState = undefined;
        refreshTripSettingsValues();
    });

    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!tripSettingsSession) beginTripSettingsSession();

        void (async () => {
            const startingDraft = Boolean(tripDraft && !tripIsLive());
            if (!applyTripSettingsSession()) {
                refreshTripSettingsValues();
                return;
            }

            if (startingDraft) {
                if (tripDraft.deferred) {
                    tripStartsNowState = undefined;
                    tripSettingsSession = undefined;
                    if (numberPadDialog?.open) await closeNumberPad({ discardPrepared: false, allowChanged: true, immediate: true, destination: "home" });
                    uiReturnStack.length = 0;
                    resetTripSettingsNavigation();
                    closeDialog(tripSettingsDialog, { reason: "trip-settings-defer" });
                    renderDeferredTrip();
                    return;
                }
                if (tripDraftHasFutureStart(tripDraft)) {
                    tripStartsNowState = undefined;
                    tripSettingsSession = undefined;
                    resetTripSettingsNavigation();
                    closeDialog(tripSettingsDialog, { reason: "trip-settings-scheduled", immediate: true });
                    showScheduledStartDialog();
                    return;
                }
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
            await clockTimer.persistCurrentTrip();
            tripStartsNowState = undefined;
            tripSettingsSession = undefined;
            await closeTripSettingsToNavigation("trip-settings-save");
        })().catch(() => {});
    });

    function resumedTripStarts(draft, moment) {
        const base = parseDateInput(draft.creationDate);
        const days = (Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate()) -
            Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86400000;
        const elapsed = days * 86400000 + ((moment.getHours() * 60 + moment.getMinutes()) * 60 + moment.getSeconds()) * 1000 + moment.getMilliseconds();
        const time = formatTimelineMilliseconds(elapsed);
        return { scheduledStart: draft.scheduledStart ?? draft.creationTime, startTime: time };
    }

    async function beginNewTripWorkflow({ initialValue, tripMoment } = {}) {
        if (clockTimer.status === "stopped") await clockTimer.resetCompletedTrip();
        const deferredDraft = tripDraft?.deferred ? tripDraft : undefined;
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
        tripDraft = deferredDraft ? {
            ...deferredDraft,
            deferred: false,
            ...resumedTripStarts(deferredDraft, moment)
        } : {
            ...tripDefaults,
            standardTime: newTripInitialValue || "",
            lateBreakBehavior: tripPreferences.lateBreakBehavior,
            syncGoals: tripPreferences.syncGoals
        };

        renderDeferredTrip();
        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                deferredDraft ? { pending: true } : clockTimer.prepareTrip({ timeout: 5000, at: moment })
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
            initialValue: deferredDraft ? tripDraft.standardTime : newTripInitialValue,
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

    downDetailsButton.addEventListener("pointerup", () => {
        const reference=activeDownReference();
        if(reference?.tripId&&reference.intervalKey)void openDownDetailsModal(reference.tripId,reference.intervalKey,{editing:true,capture:true});
    });

    downBreakButton.addEventListener("pointerup", () => {
        openDialog("breakDialog", { reason: "down-break" });
    });

    downResumeButton.addEventListener("pointerup", () => {
        void clockTimer.endInterval().then(() => renderTripActionState()).catch(() => {});
    });

    downCancelButton.addEventListener("pointerup", () => {
        void (async () => {
            await clockTimer.endInterval();
            await endCurrentIntervalOrTrip();
        })().catch(() => {});
    });

    breakDialog.querySelectorAll("[data-break-type]").forEach(button => {
        button.addEventListener("click", async event => {
            event.preventDefault();

            const breakType =
                button.dataset.breakType;

            closeDialog(
                breakDialog,
                { reason: "break-type-selected" }
            );

            try {
                await startBreakInterval(
                    breakType
                );
            }
            catch {
                updateSummaryValues();
                renderTripActionState();
            }
        });
    });

    $("#standardTimeButton").addEventListener("pointerup", () => {
        let summary;
        try {
            summary =
                clockTimer.getSummarySnapshot?.(
                    new Date()
                );
        }
        catch {}

        if (
            !tripIsLive() ||
            summary?.scope === "total"
        ) {
            return;
        }

        resetTripSettingsNavigation();
        openTripSettingsDialog("summary-standard-time", {
            focusField: "standard-time"
        });
    });

    $("#goalPercentValue").addEventListener("pointerup", () => {
        if (clockTimer.percentMode === "auto") {
            openAutoGoalDialog();
            return;
        }

        if (endTimeGoalLockedForMode()) {
            flashEndTimeGoalLock();
            return;
        }

        void openPercentGoalNumberPad(
            clockTimer.percentMode === "total"
                ? "total"
                : "trip"
        ).catch(() => {});
    });

    autoGoalDialog
        ?.querySelectorAll(
            "[data-auto-goal-scope]"
        )
        .forEach(button => {
            button.addEventListener(
                "pointerup",
                () => {
                    const scope =
                        button.dataset.autoGoalScope ===
                            "total"
                            ? "total"
                            : "trip";

                    closeDialog(
                        autoGoalDialog,
                        {
                            reason:
                                "auto-goal-selected",
                            immediate: true
                        }
                    );

                    void openPercentGoalNumberPad(
                        scope
                    ).catch(() => {});
                }
            );
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
        const numeric = Number(milliseconds);
        const negative = Number.isFinite(numeric) && numeric < 0;
        const totalSeconds = Math.floor(Math.abs(numeric) / 1000) || 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${negative ? "-" : ""}${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function setEndTripButtonIntervalPalette(intervalType) {
        const normalized =
            String(intervalType || "")
                .trim()
                .toLowerCase();

        if (normalized === "break") {
            endTripButton.style.background =
                "var(--timer-break-color, #001e60)";
            endTripButton.style.color =
                "var(--timer-break-text-color, #ffffff)";
            return;
        }

        if (normalized === "lunch") {
            endTripButton.style.background =
                "var(--timer-lunch-color, #ffc220)";
            endTripButton.style.color =
                "var(--timer-lunch-text-color, #000000)";
            return;
        }

        endTripButton.style.removeProperty(
            "background"
        );
        endTripButton.style.removeProperty(
            "color"
        );
    }

    function renderTripActionState(now = new Date()) {
        renderSyncGoalsState();
        if (!tripIsLive()) {
            app.dataset.intervalState = "none";
            downTripControls.hidden = true;
            endTripButton.hidden = false;
            tripActionRow.hidden = false;
            setEndTripButtonIntervalPalette();
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
            setEndTripButtonIntervalPalette();
            downElapsedValue.value = formatDuration(interval.elapsedMilliseconds)
                .replace(/^0(?=\d:)/, "");
            downElapsedValue.textContent = downElapsedValue.value;
            downTripControls.hidden = false;
            endTripButton.hidden = true;
            tripActionRow.hidden = true;
            return;
        }

        downTripControls.hidden = true;

        if (intervalType === "break" || intervalType === "lunch") {
            app.dataset.intervalState = "break";
            activeTripControls.hidden = false;
            endTripButton.hidden = false;
            endTripButton.disabled = false;
            setEndTripButtonIntervalPalette(
                intervalType
            );
            const label = intervalType === "lunch" ? "Lunch" : "Break";
            endTripButton.textContent =
                `End ${label} : ${formatIntervalClock(interval.remainingMilliseconds)}`;
            tripActionRow.hidden = true;
            breakButton.hidden = true;
            downButton.hidden = true;
            return;
        }

        app.dataset.intervalState = "normal";
        endTripButton.hidden = false;
        setEndTripButtonIntervalPalette();
        endTripButton.textContent = "End Trip";
        tripActionRow.hidden = false;
        breakButton.hidden = false;
        downButton.hidden = false;
    }

    async function endCurrentIntervalOrTrip() {
        const interval = clockTimer.getActiveIntervalState?.(new Date());
        const intervalType = String(interval?.intervalType || "").toLowerCase();

        if (intervalType === "break" || intervalType === "lunch") {
            await clockTimer.endInterval();
            updateSummaryValues();
            renderTripActionState();
            return;
        }

        if (intervalType === "down") {
            await clockTimer.endInterval();
            renderTripActionState();
            return;
        }

        const tripMoment = new Date();
        await clockTimer.stop();
        await clockTimer.resetCompletedTrip();
        await beginNewTripWorkflow({
            initialValue: "",
            tripMoment
        });
    }

    async function startBreakInterval(kind) {
        const configs = {
            break: { type: "break", length: "15:00", attributes: { breakType: "break" } },
            lunch: { type: "lunch", length: "30:00", attributes: { breakType: "lunch" } },
            "short-break": { type: "break", length: "10:00", attributes: { breakType: "short" } }
        };
        const config = configs[kind];
        if (!config) return false;

        const active = clockTimer.getActiveIntervalState?.(new Date());
        if (String(active?.intervalType || "").toLowerCase() === "down") {
            const ended =
                await clockTimer.endInterval();

            updateSummaryValues();
            renderTripActionState();

            if (!ended) {
                return false;
            }
        }

        const result = await clockTimer.startInterval(
            config.type,
            config.length,
            config.attributes,
            "2:30",
            "2:30"
        );

        updateSummaryValues();
        renderTripActionState();

        return Boolean(result);
    }

    function setTripControlState(running) {
        const nextTripState =
            running ? "running" : "ready";
        const stateChanged =
            app.dataset.tripState !== nextTripState;

        if (stateChanged) {
            app.classList.add(
                "trip-state-snap"
            );
            void app.offsetHeight;
        }

        app.dataset.tripState = nextTripState;
        app.dataset.state = clockTimer.status;
        activeTripControls.hidden = !running;
        renderTripActionState();

        if (stateChanged) {
            void app.offsetHeight;
            requestAnimationFrame(() => {
                app.classList.remove(
                    "trip-state-snap"
                );
            });
        }
    }

    clockTimer.addEventListener("cadenceTick", event => {
        if (
            endTimeGoalOverride?.deadline instanceof Date &&
            event.detail?.now instanceof Date &&
            event.detail.now.getTime() >= endTimeGoalOverride.deadline.getTime()
        ) {
            releaseEndTimeGoalOverride();
        }
        renderTripActionState(event.detail?.now);
    });

    clockTimer.addEventListener("uiStateChanged", event => {
        renderClockTimerUIState(event.detail);
    });

    clockTimer.addEventListener("started", event => {
        setTripControlState(true);
    });


    function animateDownTimeClockTransition() {
        clockTimer.spin?.({
            rotations: 1,
            duration: "1.5s"
        });
    }


    clockTimer.addEventListener("downTimeStarted", () => {
        app.dataset.intervalState = "down";
        animateDownTimeClockTransition();
        renderTripActionState();
    });

    clockTimer.addEventListener("downTimeEnded", () => {
        renderTripActionState();
        animateDownTimeClockTransition();
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
        "tripLoaded",
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
        releaseEndTimeGoalOverride();
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
        renderSyncGoalsState();
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

    clockTimer.addEventListener("tripLoaded", () => setTripControlState(!["ready","stopped"].includes(clockTimer.status)));
    clockTimer.addEventListener("activeTripRestored", event => {
        const state = event.detail?.state || clockTimer.uiState;
        if (state) renderClockTimerUIState(state);
        setTripControlState(Boolean(state?.trip_active));
    });
    for (const event of ["intervalStarted","intervalEnded","intervalDeleted","stopped","cleared","completedTripsSynced"]) {
        clockTimer.addEventListener(event,()=>{if(getTripListState()==="open") void dispatchTripListRequest("trip-change");});
    }
    setInterval(()=>{
        if(tripIsLive() && getTripListState()==="open" && tripLogView && !tripLogView.editor && !numberPadDialog?.open &&
            (!tripLogBody.contains(document.activeElement) || document.activeElement?.matches("summary")) &&
            !tripLogBody.querySelector(".trip-log-menu-actions:not([hidden])")) {
            tripLogView.render({trips:tripLogView.trips, offline:tripLogView.offline, incomplete:tripLogView.incomplete, loginRequired:tripLogView.loginRequired},tripLogView.calendar);
        }
    },1000);

    function alignStatusIcons() {
        if (!scopeConnectionButton || scopeConnectionButton.hidden) return;
        const reference=scopeConnectionButton.getBoundingClientRect();const center=reference.left+reference.width/2;
        for(const icon of [goalSyncButton,$(".deferred-trip-icon"),$("#endTimeGoalLock")]) {
            if(!icon || icon.hidden) continue;
            const parent=icon.offsetParent;if(!parent) continue;
            icon.style.left=`${center-parent.getBoundingClientRect().left-parent.clientLeft-icon.offsetWidth/2}px`;
            icon.style.right="auto";
        }
    }
    const statusIconObserver=new ResizeObserver(()=>requestAnimationFrame(alignStatusIcons));
    for(const element of [scopeConnectionButton,goalSyncButton,$("#newTripButton"),$(".deferred-trip-icon"),$("#endTimeGoalLock")]) if(element) statusIconObserver.observe(element);

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

    function onCalendarRulesLoaded(event) {
        if (event.detail.calendars?.length) calendarRanges.setDatabaseRecords(event.detail.calendars);
        refreshTripLogSelection();
    }

    function onConnected(event) {
        populateProfile(event.detail?.user);
        reserveSemanticEvent(event, "ClockTimer connected");
    }

    function onDisconnected(event) {
        if (event.detail?.source === "disconnect") {
            signedInProfile = undefined;
            for (const id of ["profileUsername", "firstName", "lastName", "preferredName"]) $("#" + id).value = "";
        }
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
        calendarRulesLoaded: onCalendarRulesLoaded,
        connected: onConnected,
        disconnected: onDisconnected,
        aggregatesSynced: onAggregatesSynced
    };

    for (const [eventName, handler] of Object.entries(semanticClockTimerHandlers)) {
        clockTimer.addEventListener(eventName, handler);
    }

    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    app.dataset.tripListState = "closed";
    tripLogButton?.setAttribute("aria-expanded", "false");
    setTripLogPinned(
        getStoredTripLogPinned(),
        { persist: false }
    );

    if (
        document.documentElement.dataset.tripLogStartup ===
            "unpinned"
    ) {
        requestAnimationFrame(
            () => requestAnimationFrame(
                () => {
                    delete document.documentElement.dataset.tripLogStartup;
                }
            )
        );
    }

    applyGraphicalSettings(graphicalSettings);
    fillGraphicalForm(graphicalSettings);
    fillTripPreferencesForm(tripPreferences);
    setTripProductionFilter(safeStorageGet("wmof.tripProductionFilter") || "all", {notify:false});
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
    clockTimer.configure({
        auto_goal: tripPreferences.syncGoals
    });
    renderSyncGoalsState();
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);
    applyRenderedTimeMode(safeStorageGet(STORAGE.renderedTimeMode) || "remaining", false);
    updateSummaryValues();
    syncNetworkStatusUI({ startup: true });
    void (async () => {
        try {
            const response = await fetch(new URL("api/calendar/?result=records", API_BASE), {credentials:"same-origin", headers:{Accept:"application/json"}});
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Calendar lookup failed.");
            calendarRanges.setDatabaseRecords(data.calendars);
            refreshTripLogSelection();
        } catch (error) { showTripRangeError(error.message || "Calendar lookup failed."); }
    })();
})();
