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
        customTripLogDates: "wmof.clock.customTripLogDates",
        audioSettings: "wmof.clock.audioSettings"
    };

    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
    const PERCENT_MODES = ["trip", "total", "auto"];
    const TRIP_PREFERENCE_DEFAULTS = {
        lateBreakBehavior: "showLateWindow",
        syncGoals: false
    };
    const ANNOUNCEMENT_CATALOG =
        globalThis
            .WMOFAnnouncementCatalog;

    const AUDIO_ANNOUNCEMENTS =
        Object.freeze(
            (
                ANNOUNCEMENT_CATALOG
                    ?.list?.() ||
                []
            )
                .map(
                    entry => [
                        entry.key,
                        entry.label
                    ]
                )
        );

    const announcementDefinition =
        key =>
            ANNOUNCEMENT_CATALOG
                ?.get?.(
                    key
                );

    const announcementSongName =
        key =>
            announcementDefinition(
                key
            )?.song ||
            key;

    const announcementOverridesMaster =
        (
            key,
            layer
        ) =>
            announcementDefinition(
                key
            )
                ?.masterOverrides
                ?.includes?.(
                    layer
                ) === true;

    const announcementSpeechIgnoresMaster =
        (
            key,
            {
                ignoreSummaryMaster =
                    false
            } = {}
        ) =>
            Boolean(
                ignoreSummaryMaster ||
                announcementOverridesMaster(
                    key,
                    "summary"
                ) ||
                announcementOverridesMaster(
                    key,
                    "details"
                )
            );

    const AUDIO_DEFAULTS = Object.freeze({
        speechVolume: 1,
        toneVolume: 1,
        masterVelocity: 1,
        speechVelocity: 1,
        toneVelocity: 1,
        masters: Object.freeze({
            chime: true,
            summary: true,
            details: true
        })
    });

    const AUDIO_LANGUAGE = "en-US";
    const AUDIO_PERCENT_STEP = 5;
    const AUDIO_SPEECH_VELOCITY_MIN = 0.5;
    // The former 70% point (2.8×) is now the top of the speech range.
    const AUDIO_SPEECH_VELOCITY_MAX = 2.8;
    const AUDIO_TONE_VELOCITY_MIN = 0.5;
    const AUDIO_TONE_VELOCITY_MAX = 1.5;

    function audioVelocityPercent(value, maximum) {
        const numeric = Number(value);
        const limit = Number(maximum);
        if (!Number.isFinite(numeric) || !Number.isFinite(limit) || limit <= 0) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(
                100,
                numeric / limit * 100
            )
        );
    }

    function formatAudioVelocityPercent(value, maximum) {
        return Math.round(
            audioVelocityPercent(
                value,
                maximum
            )
        ) + "%";
    }

    function stepAudioVelocity(
        value,
        minimum,
        maximum,
        deltaPercent
    ) {
        const floorPercent =
            Number(minimum) /
            Number(maximum) *
            100;
        const nextPercent =
            Math.max(
                floorPercent,
                Math.min(
                    100,
                    audioVelocityPercent(
                        value,
                        maximum
                    ) +
                    Number(deltaPercent)
                )
            );

        return Number(
            (
                Number(maximum) *
                nextPercent /
                100
            ).toFixed(6)
        );
    }

    function audioVelocityAtPercent(
        percent,
        minimum,
        maximum
    ) {
        const requested =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(percent)
                )
            );

        return Number(
            Math.max(
                Number(minimum),
                Number(maximum) *
                    requested /
                    100
            )
                .toFixed(6)
        );
    }

    function audioVolumeAtPercent(
        percent
    ) {
        return Number(
            (
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(percent)
                    )
                ) /
                100
            )
                .toFixed(6)
        );
    }

    function stepAudioVolume(
        value,
        deltaPercent
    ) {
        const current =
            Number.isFinite(
                Number(value)
            )
                ? Number(value) * 100
                : 100;
        const next =
            Math.max(
                0,
                Math.min(
                    100,
                    current +
                    Number(deltaPercent)
                )
            );

        return Number(
            (next / 100)
                .toFixed(6)
        );
    }

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
        overtimeColor: "#ff5c5c",
        latencyColor: "#e1251b",
        showTolerance: true,
        showOvertime: true,
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
        hourHandColor: "#ffffff",
        minuteHandLength: "38%",
        minuteHandColor: "#ffffff",
        secondHandLength: "42%",
        secondHandColor: "#ffc220",
        clockFont: "Helvetica, Arial, sans-serif",
        hourColor: "#ffffff",
        timeColor: "#ffffff",
        borderColor: "#001e60"
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
        breakBufferColor: {title: "to/from Break Color", text: "Sets the color for the allowed time to or from Break or Lunch.", stateControl: "showBreakBuffer", stateText: {true: "to/from Break uses this color.", false: "The adjacent interval extends across that time."}},
        downColor: {title: "Down Color", text: "Down-time intervals use this color while productive elapsed time is paused."},
        approvalSurplusColor: {title: "Approval Surplus Color", text: "Approval Surplus is extra approved Down time that remains excluded after Down ends."},
        approvalDeficitColor: {title: "Approval Deficit Color", text: "Approval Deficit is the unapproved portion of a Down interval and counts as productive elapsed time."},
        overtimeColor: {title: "Overtime Color", text: "Overtime is the time your trip runs over the standard time.", stateControl: "showOvertime", stateText: {true: "Overtime is shown with its own color.", false: "Overtime is still counted but is shown as Trip time."}},
        toleranceColor: {title: "B-Game Color", text: "You aimed above 100%. B-Game shows the time after you miss that goal while you’re still above 100%.", stateControl: "showTolerance", stateText: {true: "B-Game is shown.", false: "That time is shown as Trip time.", undefined: "B-Game appears after you enter that portion of the trip."}},
        latencyColor: {title: "Late Start Color", text: "Sets the color for time that begins when you are late.", stateControl: "showLatency", stateText: {true: "Late Start is shown with this color.", false: "Late Start is still calculated while the underlying Trip range remains visible."}}
    };

    const $ = selector => document.querySelector(selector);

    const {
        wait,
        safeStorageGet,
        safeStorageSet,
        formatDuration,
        formatDateInput,
        parseDateInput
    } =
        globalThis
            .WMOFUtilities;

    const SHERPA_ASSET_VERSION =
        "2026-09-24-6";

    const SPEECH_RUNTIME_REVISION =
        "2026-10-01-command-digest-2";

    const speechRuntimeVersion =
        "?sherpa=" +
        encodeURIComponent(
            SHERPA_ASSET_VERSION
        ) +
        "&runtime=" +
        encodeURIComponent(
            SPEECH_RUNTIME_REVISION
        );

    const speechSearchParams =
        new URLSearchParams(
            location.search
        );

    const speechDiagnosticsEnabled =
        speechSearchParams.has(
            "speech-diagnostics"
        );

    const speechPipeline =
        speechSearchParams.get(
            "speech-pipeline"
        ) === "silero"
            ? "silero"
            : "raw";

    const speechAssetCacheReady =
        (async () => {
            if (
                !("serviceWorker" in navigator) ||
                !globalThis.isSecureContext
            ) {
                return false;
            }

            try {
                const registration =
                    await navigator
                        .serviceWorker
                        .register(
                            "SpeechAssetCacheWorker.js" +
                                speechRuntimeVersion,
                            {
                                scope: "./",
                                updateViaCache:
                                    "all"
                            }
                        );

                await navigator
                    .serviceWorker
                    .ready;

                if (
                    navigator
                        .serviceWorker
                        .controller
                ) {
                    return true;
                }

                await new Promise(
                    resolve => {
                        const timeout =
                            setTimeout(
                                resolve,
                                1500
                            );

                        navigator
                            .serviceWorker
                            .addEventListener(
                                "controllerchange",
                                () => {
                                    clearTimeout(
                                        timeout
                                    );
                                    resolve();
                                },
                                {
                                    once: true
                                }
                            );
                    }
                );

                return Boolean(
                    navigator
                        .serviceWorker
                        .controller
                );
            }
            catch (error) {
                console.warn(
                    "Sherpa asset cache unavailable:",
                    error
                );

                return false;
            }
        })();

    const loadClassicScript = source =>
        new Promise((resolve, reject) => {
            const existing = document.querySelector(
                `script[data-runtime-source="${source}"]`
            );

            if (existing?.dataset.loaded === "true") {
                resolve();
                return;
            }

            const script =
                existing ||
                document.createElement("script");

            const onLoad = () => {
                script.dataset.loaded = "true";
                resolve();
            };

            const onError = () => {
                reject(
                    new Error(
                        `Unable to load ${source}.`
                    )
                );
            };

            script.addEventListener(
                "load",
                onLoad,
                {once: true}
            );

            script.addEventListener(
                "error",
                onError,
                {once: true}
            );

            if (!existing) {
                script.src =
                    `${source}${speechRuntimeVersion}`;
                script.dataset.runtimeSource =
                    source;
                document.head.append(
                    script
                );
            }
        });

    let speechRuntimePromise;
    const ensureSpeechRuntime = () => {
        if (
            globalThis.SpeechMenu &&
            customElements.get("speech-mic-bar")
        ) {
            return Promise.resolve();
        }

        if (!speechRuntimePromise) {
            speechRuntimePromise =
                Promise.resolve()
                    .then(async () => {
                        await speechAssetCacheReady;
                        if (
                            !globalThis
                                .AdaptiveSpeechTiming
                        ) {
                            await loadClassicScript(
                                "AdaptiveSpeechTiming.js"
                            );
                        }

                        if (!globalThis.SherpaRecognizer) {
                            await loadClassicScript(
                                "SherpaRecognizer.js"
                            );
                        }

                        if (
                            speechPipeline === "silero" &&
                            !globalThis.SileroVad
                        ) {
                            await loadClassicScript(
                                "SileroVad.js"
                            );
                        }

                        if (!globalThis.SpeechMenu) {
                            await loadClassicScript(
                                "SpeechMenu.js?v=adaptive-timing-1"
                            );
                        }

                        if (
                            !globalThis.SpeechMenu.started &&
                            globalThis.SpeechMenu.pipeline !==
                                speechPipeline
                        ) {
                            globalThis.SpeechMenu.pipeline =
                                speechPipeline;
                        }

                        void globalThis.SpeechMenu
                            .loadCorrections(
                                new URL(
                                    "api/speech-corrections/?language=en-US",
                                    API_BASE
                                ).href
                            )
                            .catch(
                                () => {}
                            );

                        if (
                            !customElements.get(
                                "speech-mic-bar"
                            )
                        ) {
                            await loadClassicScript(
                                "SpeechMicBar.js"
                            );
                        }

                        if (
                            speechDiagnosticsEnabled &&
                            !customElements.get(
                                "speech-diagnostics"
                            )
                        ) {
                            await loadClassicScript(
                                "SpeechDiagnostics.js"
                            );
                        }

                        if (
                            speechDiagnosticsEnabled &&
                            !document.querySelector(
                                "speech-diagnostics"
                            )
                        ) {
                            document.body.append(
                                document.createElement(
                                    "speech-diagnostics"
                                )
                            );
                        }

                        document.dispatchEvent(
                            new CustomEvent(
                                "speech-runtime-ready"
                            )
                        );
                    });
        }

        return speechRuntimePromise;
    };

    const clockTimer = $("#clockTimer");

    const currentActionSignal =
        () =>
            globalThis
                .WMOFActionFunctions
                ?.invocationContext
                ?.signal;

    const speechTransactionDate =
        () => {
            const value =
                globalThis.SpeechMenu
                    ?.executionContext
                    ?.utteranceStartedAt;

            if (!value) {
                return undefined;
            }

            const date =
                new Date(
                    value
                );

            return Number.isNaN(
                date.getTime()
            )
                ? undefined
                : date;
        };

    clockTimer.transactionTimestampProvider =
        speechTransactionDate;

    const clockPreview = $("#clockPreview");
    if (clockPreview) {
        clockPreview.keepAspectRatio =
            true;
    }
    const PERMISSION_SUPERUSER =
        4;

    const PERMISSION_DEVELOPER_PREVIEW =
        8;

    const PERMISSION_DEVELOPER =
        16;

    const PERMISSION_GRANT_TOKEN_ACCESS =
        32;

    const PERMISSION_VIEW_LIVE_STREAMS =
        64;

    const PERMISSION_LOOKUP_USERS =
        128;

    const ACCESS_TOKEN_PERMISSION_MASK =
        PERMISSION_SUPERUSER |
        PERMISSION_GRANT_TOKEN_ACCESS;

    const SPEECH_EDITOR_PERMISSION_MASK =
        PERMISSION_SUPERUSER |
        PERMISSION_DEVELOPER_PREVIEW |
        PERMISSION_DEVELOPER;

    const DEVELOPER_MENU_PERMISSION_MASK =
        PERMISSION_DEVELOPER_PREVIEW |
        PERMISSION_DEVELOPER;

    const app = $("#app");
    const loginDialog = $("#loginDialog");
    const profileDialog = $("#profileDialog");
    let signedInProfile;

    const identityContext =
        globalThis
            .WMOFIdentityContext;

    const liveStreamDialog =
        $("#liveStreamDialog");
    const liveStreamViewerSection =
        $("#liveStreamViewerSection");
    const liveStreamIdentityName =
        $("#liveStreamIdentityName");
    const liveStreamIdentityMeta =
        $("#liveStreamIdentityMeta");
    const liveStreamLookupButton =
        $("#liveStreamLookupButton");
    const liveStreamWatchButton =
        $("#liveStreamWatchButton");
    const liveStreamViewerStatus =
        $("#liveStreamViewerStatus");
    const liveStreamVolumeControls =
        $("#liveStreamVolumeControls");
    const liveStreamTrainerMessage =
        $("#liveStreamTrainerMessage");
    const liveStreamTrainerMessageText =
        $("#liveStreamTrainerMessageText");
    const liveStreamTrainerMessageSend =
        $("#liveStreamTrainerMessageSend");
    const liveStreamTrainerMessageStatus =
        $("#liveStreamTrainerMessageStatus");
    const liveStreamMute =
        $("#liveStreamMute");
    const liveStreamMasterVolume =
        $("#liveStreamMasterVolume");
    const liveStreamMicVolume =
        $("#liveStreamMicVolume");
    const liveStreamProgramVolume =
        $("#liveStreamProgramVolume");
    const liveStreamMasterVolumeValue =
        $("#liveStreamMasterVolumeValue");
    const liveStreamMicVolumeValue =
        $("#liveStreamMicVolumeValue");
    const liveStreamProgramVolumeValue =
        $("#liveStreamProgramVolumeValue");
    const liveStreamRemoteState =
        $("#liveStreamRemoteState");
    const liveStreamRemoteTime =
        $("#liveStreamRemoteTime");
    const liveStreamRemoteGoal =
        $("#liveStreamRemoteGoal");
    const liveStreamRemoteSpeech =
        $("#liveStreamRemoteSpeech");

    const liveTripStream =
        typeof globalThis
            .WMOFLiveTripStream ===
            "function"
            ? new globalThis
                .WMOFLiveTripStream({
                    baseUrl:
                        API_BASE,
                    snapshotProvider:
                        () => {
                            let trip;

                            try {
                                trip =
                                    clockTimer
                                        .toJSON?.();
                            }
                            catch {
                                trip =
                                    undefined;
                            }

                            return {
                                timestamp:
                                    new Date()
                                        .toISOString(),
                                userId:
                                    signedInProfile
                                        ?.id,
                                uiState:
                                    clockTimer
                                        .uiState,
                                trip
                            };
                        }
                })
            : undefined;

    let liveStreamPresenceQueue =
        Promise.resolve();

    const syncAutomaticLivePublisher =
        () => {
            if (!liveTripStream) {
                return Promise.resolve(
                    false
                );
            }

            liveStreamPresenceQueue =
                liveStreamPresenceQueue
                    .catch(
                        () => {}
                    )
                    .then(
                        async () => {
                            const shouldPublish =
                                Boolean(
                                    signedInProfile
                                        ?.id
                                ) &&
                                clockTimer
                                    .networkStatus ===
                                    "online";

                            if (
                                shouldPublish &&
                                !liveTripStream
                                    .publishing
                            ) {
                                await liveTripStream
                                    .startPublishing({
                                        requestMicrophone:
                                            false
                                    });

                                if (
                                    globalThis
                                        .SpeechMenu
                                        ?.started
                                ) {
                                    await liveTripStream
                                        .refreshPublisherMicrophone?.();
                                }
                            }
                            else if (
                                !shouldPublish &&
                                liveTripStream
                                    .publishing
                            ) {
                                await liveTripStream
                                    .stopPublishing();
                            }

                            return liveTripStream
                                .publishing;
                        }
                    )
                    .catch(
                        error => {
                            console.warn(
                                "Automatic live stream presence failed:",
                                error
                            );

                            return false;
                        }
                    );

            return liveStreamPresenceQueue;
        };

    const canViewLiveStreams =
        () => {
            const permissions =
                Number(
                    signedInProfile
                        ?.permissions
                ) || 0;

            return Boolean(
                permissions &
                (
                    PERMISSION_VIEW_LIVE_STREAMS |
                    PERMISSION_SUPERUSER
                )
            );
        };

    const canLookupUsers =
        () => {
            const permissions =
                Number(
                    signedInProfile
                        ?.permissions
                ) || 0;

            return Boolean(
                permissions &
                (
                    PERMISSION_LOOKUP_USERS |
                    PERMISSION_SUPERUSER
                )
            );
        };

    const identityDisplayName =
        identity => {
            if (!identity) {
                return "No user selected";
            }

            const formal =
                [
                    identity.firstName,
                    identity.lastName
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " "
                    )
                    .trim();

            return (
                identity.preferredName ||
                formal ||
                identity.username ||
                "User"
            );
        };

    const identityMeta =
        identity => {
            if (!identity) {
                return "Use User Lookup to select an identity.";
            }

            const formal =
                [
                    identity.firstName,
                    identity.lastName
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " "
                    )
                    .trim();
            const parts = [];

            if (
                identity.preferredName &&
                formal &&
                identity.preferredName !==
                    formal
            ) {
                parts.push(
                    formal
                );
            }

            parts.push(
                "@" +
                    identity.username
            );
            parts.push(
                "ID " +
                    identity.userId
            );

            return parts.join(
                " · "
            );
        };

    function syncLiveStreamIdentityUI() {
        const identity =
            identityContext
                ?.current;
        const self =
            Boolean(
                identity &&
                Number(
                    identity.userId
                ) ===
                    Number(
                        signedInProfile
                            ?.id
                    )
            );

        liveStreamIdentityName.textContent =
            identityDisplayName(
                identity
            );
        liveStreamIdentityMeta.textContent =
            identityMeta(
                identity
            );
        liveStreamLookupButton.hidden =
            !canLookupUsers();

        if (
            !liveTripStream
                ?.viewing
        ) {
            liveStreamWatchButton.disabled =
                !canViewLiveStreams() ||
                !identity ||
                self;
        }

        if (
            !identity &&
            !liveTripStream
                ?.viewing
        ) {
            liveStreamViewerStatus.textContent =
                "Select a user with User Lookup.";
        }
        else if (
            self &&
            !liveTripStream
                ?.viewing
        ) {
            liveStreamViewerStatus.textContent =
                "Select another user.";
        }

        return identity;
    }

    const userLookup =
        typeof globalThis
            .WMOFUserLookup ===
            "function"
            ? new globalThis
                .WMOFUserLookup({
                    baseUrl:
                        API_BASE,
                    identityContext,
                    canLookup:
                        canLookupUsers,
                    canViewLive:
                        canViewLiveStreams,
                    currentUserId:
                        () =>
                            signedInProfile
                                ?.id,
                    onLiveStream:
                        () => {
                            void (
                                async () => {
                                    const dialog =
                                        $("#userLookupDialog");

                                    if (
                                        dialog
                                            ?.open
                                    ) {
                                        const closed =
                                            await closeDialogWithReturn(
                                                dialog,
                                                {
                                                    reason:
                                                        "identity-live-stream",
                                                    immediate:
                                                        true
                                                }
                                            );

                                        if (!closed) {
                                            return;
                                        }
                                    }

                                    openDialog(
                                        "liveStreamDialog",
                                        {
                                            fromPopover:
                                                popoverIsOpen(
                                                    mainMenu
                                                ),
                                            reason:
                                                "identity-live-stream"
                                        }
                                    );
                                }
                            )();
                        }
                })
            : undefined;

    const liveStreamPercent =
        value =>
            Math.round(
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(
                            value
                        ) ||
                        0
                    )
                ) *
                100
            );

    function syncLiveStreamVolumeLabels() {
        if (
            !liveTripStream
        ) {
            return;
        }

        liveStreamMute.checked =
            liveTripStream
                .viewerMuted;

        liveStreamMasterVolume.value =
            String(
                liveStreamPercent(
                    liveTripStream
                        .viewerMasterVolume
                )
            );

        liveStreamMicVolume.value =
            String(
                liveStreamPercent(
                    liveTripStream
                        .viewerMicrophoneVolume
                )
            );

        liveStreamProgramVolume.value =
            String(
                liveStreamPercent(
                    liveTripStream
                        .viewerProgramVolume
                )
            );

        liveStreamMasterVolumeValue.value =
            liveStreamMasterVolume.value +
            "%";
        liveStreamMicVolumeValue.value =
            liveStreamMicVolume.value +
            "%";
        liveStreamProgramVolumeValue.value =
            liveStreamProgramVolume.value +
            "%";
    }

    function renderLiveStreamSnapshot(
        snapshot
    ) {
        const state =
            snapshot?.uiState ||
            snapshot ||
            {};

        liveStreamRemoteState.textContent =
            String(
                state.state ||
                "—"
            )
                .replaceAll(
                    "_",
                    " "
                );

        liveStreamRemoteTime.textContent =
            state.time_component
                ?.text ||
            state.timeComponent
                ?.text ||
            "—";

        const current =
            state.current_percent_component
                ?.text ||
            state.currentPercentComponent
                ?.text;

        const goal =
            state.goal_component
                ?.text ||
            state.goalComponent
                ?.text;

        liveStreamRemoteGoal.textContent =
            current && goal
                ? current +
                    " / " +
                    goal
                : (
                    current ||
                    goal ||
                    "—"
                );
    }

    function syncLiveStreamViewerUI(
        detail = {}
    ) {
        const viewing =
            Boolean(
                liveTripStream
                    ?.viewing
            );

        liveStreamWatchButton.textContent =
            viewing
                ? "Stop Watching"
                : "Watch";

        const identity =
            syncLiveStreamIdentityUI();

        if (viewing) {
            liveStreamWatchButton.disabled =
                false;
        }

        liveStreamVolumeControls.disabled =
            !viewing;
        liveStreamTrainerMessage.disabled =
            !viewing;

        if (!viewing) {
            liveStreamTrainerMessageStatus.textContent =
                "";
        }

        if (
            viewing
        ) {
            const state =
                detail.state ||
                "connecting";

            liveStreamViewerStatus.textContent =
                state ===
                    "live"
                    ? "Live."
                    : "Viewing: " +
                        state +
                        ".";
        }
        else {
            const self =
                Boolean(
                    identity &&
                    Number(
                        identity.userId
                    ) ===
                        Number(
                            signedInProfile
                                ?.id
                        )
                );

            liveStreamViewerStatus.textContent =
                !identity
                    ? "Select a user with User Lookup."
                    : self
                        ? "Select another user."
                        : "Not viewing.";
            liveStreamRemoteState.textContent =
                "—";
            liveStreamRemoteTime.textContent =
                "—";
            liveStreamRemoteGoal.textContent =
                "—";
            liveStreamRemoteSpeech.textContent =
                "—";
        }

        syncLiveStreamVolumeLabels();
    }

    if (
        liveTripStream
    ) {
        liveTripStream
            .addEventListener(
                "viewerChanged",
                event =>
                    syncLiveStreamViewerUI(
                        event.detail
                    )
            );

        liveTripStream
            .addEventListener(
                "volumeChanged",
                syncLiveStreamVolumeLabels
            );

        liveTripStream
            .addEventListener(
                "snapshot",
                event =>
                    renderLiveStreamSnapshot(
                        event.detail
                            ?.snapshot
                    )
            );

        liveTripStream
            .addEventListener(
                "message",
                event => {
                    const detail =
                        event.detail;

                    if (
                        detail?.type ===
                            "speech.command"
                    ) {
                        liveStreamRemoteSpeech.textContent =
                            detail.payload
                                ?.canonicalTranscript ||
                            detail.payload
                                ?.transcript ||
                            "—";
                    }
                }
            );

        liveTripStream
            .addEventListener(
                "publisherMessage",
                event => {
                    const detail =
                        event.detail ||
                        {};

                    if (
                        detail.type !==
                            "trainer.tts"
                    ) {
                        return;
                    }

                    const text =
                        String(
                            detail.payload
                                ?.text ||
                            ""
                        )
                            .trim()
                            .slice(
                                0,
                                500
                            );

                    if (!text) {
                        return;
                    }

                    globalThis
                        .WMOFAudio
                        ?.speak?.(
                            text,
                            {
                                broadcast:
                                    false
                            }
                        );
                }
            );

        liveTripStream
            .addEventListener(
                "error",
                event => {
                    const error =
                        event.detail
                            ?.error;

                    const message =
                        error?.message ||
                        "Live stream error.";

                    if (
                        event.detail
                            ?.role ===
                            "publisher"
                    ) {
                        console.warn(
                            "Passive live stream publisher error:",
                            error
                        );

                        return;
                    }

                    liveStreamViewerStatus.textContent =
                        message;
                }
            );

        liveStreamWatchButton
            ?.addEventListener(
                "click",
                async () => {
                    liveStreamWatchButton.disabled =
                        true;

                    try {
                        if (
                            liveTripStream
                                .viewing
                        ) {
                            await liveTripStream
                                .stopViewing();
                        }
                        else {
                            if (
                                !canViewLiveStreams()
                            ) {
                                throw new Error(
                                    "Live stream permission is required."
                                );
                            }

                            const identity =
                                identityContext
                                    ?.current;
                            const targetUserId =
                                Number(
                                    identity
                                        ?.userId
                                );

                            if (
                                !Number
                                    .isInteger(
                                        targetUserId
                                    ) ||
                                targetUserId <
                                    1
                            ) {
                                throw new Error(
                                    "Select a user with User Lookup."
                                );
                            }

                            if (
                                targetUserId ===
                                    Number(
                                        signedInProfile
                                            ?.id
                                    )
                            ) {
                                throw new Error(
                                    "Select another user."
                                );
                            }

                            liveStreamViewerStatus.textContent =
                                "Connecting…";

                            await liveTripStream
                                .startViewing(
                                    targetUserId
                                );
                        }
                    }
                    catch (error) {
                        liveStreamViewerStatus.textContent =
                            error.message ||
                            "Unable to view the live stream.";
                    }
                    finally {
                        liveStreamWatchButton.disabled =
                            false;
                        syncLiveStreamViewerUI();
                    }
                }
            );

        const sendLiveTrainerMessage =
            async () => {
                const text =
                    String(
                        liveStreamTrainerMessageText
                            ?.value ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            500
                        );

                if (!canViewLiveStreams()) {
                    liveStreamTrainerMessageStatus.textContent =
                        "Live stream permission is required.";

                    return false;
                }

                if (!text) {
                    liveStreamTrainerMessageStatus.textContent =
                        "Enter a message.";

                    return false;
                }

                liveStreamTrainerMessageSend.disabled =
                    true;

                try {
                    await liveTripStream
                        .sendToPublisher(
                            "trainer.tts",
                            {
                                text
                            }
                        );

                    liveStreamTrainerMessageText.value =
                        "";
                    liveStreamTrainerMessageStatus.textContent =
                        "Sent.";

                    return true;
                }
                catch (error) {
                    liveStreamTrainerMessageStatus.textContent =
                        error.message ||
                        "Unable to send message.";

                    if (
                        Number(
                            error?.status
                        ) ===
                            403
                    ) {
                        void liveTripStream
                            .stopViewing({
                                notifyServer:
                                    false
                            });
                    }

                    return false;
                }
                finally {
                    liveStreamTrainerMessageSend.disabled =
                        !liveTripStream
                            .viewing;
                }
            };

        liveStreamTrainerMessageSend
            ?.addEventListener(
                "click",
                () =>
                    void sendLiveTrainerMessage()
            );

        liveStreamTrainerMessageText
            ?.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                            "Enter"
                    ) {
                        event.preventDefault();
                        void sendLiveTrainerMessage();
                    }
                }
            );

        liveStreamMute
            ?.addEventListener(
                "change",
                () =>
                    liveTripStream
                        .setViewerMuted(
                            liveStreamMute
                                .checked
                        )
            );

        for (
            const [
                input,
                setter
            ] of
            [
                [
                    liveStreamMasterVolume,
                    value =>
                        liveTripStream
                            .setViewerMasterVolume(
                                value
                            )
                ],
                [
                    liveStreamMicVolume,
                    value =>
                        liveTripStream
                            .setViewerMicrophoneVolume(
                                value
                            )
                ],
                [
                    liveStreamProgramVolume,
                    value =>
                        liveTripStream
                            .setViewerProgramVolume(
                                value
                            )
                ]
            ]
        ) {
            input?.addEventListener(
                "input",
                () =>
                    setter(
                        Number(
                            input.value
                        ) /
                        100
                    )
            );
        }

        liveStreamDialog
            ?.addEventListener(
                "opening",
                event => {
                    if (
                        !canViewLiveStreams()
                    ) {
                        event
                            .preventDefault();

                        return;
                    }

                    syncLiveStreamIdentityUI();
                    syncLiveStreamViewerUI();
                }
            );

        liveStreamLookupButton
            ?.addEventListener(
                "click",
                async () => {
                    if (
                        !canLookupUsers()
                    ) {
                        return;
                    }

                    if (
                        liveTripStream
                            .viewing
                    ) {
                        await liveTripStream
                            .stopViewing();
                    }

                    if (
                        liveStreamDialog
                            ?.open
                    ) {
                        const closed =
                            await closeDialogWithReturn(
                                liveStreamDialog,
                                {
                                    reason:
                                        "live-stream-user-lookup",
                                    immediate:
                                        true
                                }
                            );

                        if (!closed) {
                            return;
                        }
                    }

                    openDialog(
                        "userLookupDialog",
                        {
                            fromPopover:
                                popoverIsOpen(
                                    mainMenu
                                ),
                            reason:
                                "live-stream-user-lookup"
                        }
                    );
                }
            );

        for (
            const eventName of [
                "identity-selected",
                "identity-cleared"
            ]
        ) {
            identityContext
                ?.addEventListener?.(
                    eventName,
                    () => {
                        const identity =
                            identityContext
                                ?.current;

                        if (
                            liveTripStream
                                .viewing &&
                            Number(
                                liveTripStream
                                    .targetUserId
                            ) !==
                                Number(
                                    identity
                                        ?.userId
                                )
                        ) {
                            void liveTripStream
                                .stopViewing();
                        }

                        syncLiveStreamIdentityUI();
                        syncLiveStreamViewerUI();
                    }
                );
        }

        let liveSnapshotTimer;

        clockTimer
            .addEventListener(
                "uiStateChanged",
                () => {
                    if (
                        !liveTripStream
                            .publishing ||
                        liveSnapshotTimer
                    ) {
                        return;
                    }

                    liveSnapshotTimer =
                        setTimeout(
                            () => {
                                liveSnapshotTimer =
                                    undefined;

                                liveTripStream
                                    .broadcast(
                                        "snapshot",
                                        liveTripStream
                                            .publishing
                                            ? {
                                                timestamp:
                                                    new Date()
                                                        .toISOString(),
                                                userId:
                                                    signedInProfile
                                                        ?.id,
                                                uiState:
                                                    clockTimer
                                                        .uiState
                                            }
                                            : undefined
                                    );
                            },
                            250
                        );
                }
            );

        globalThis
            .addEventListener(
                "wmof-audio-speak",
                event => {
                    if (
                        liveTripStream
                            .publishing
                    ) {
                        liveTripStream
                            .broadcast(
                                "tts",
                                event.detail,
                                {
                                    persist:
                                        true
                                }
                            );
                    }
                }
            );

        let liveSpeechEvents;

        const wireLiveSpeechEvents =
            () => {
                const events =
                    globalThis
                        .SpeechMenu
                        ?.events;

                if (
                    !events ||
                    events ===
                        liveSpeechEvents
                ) {
                    return;
                }

                liveSpeechEvents =
                    events;

                events.addEventListener(
                    "started",
                    () => {
                        if (
                            liveTripStream
                                .publishing
                        ) {
                            void liveTripStream
                                .refreshPublisherMicrophone?.();
                        }
                    }
                );

                for (
                    const eventName of [
                        "stopped",
                        "speechCaptureEnded"
                    ]
                ) {
                    events.addEventListener(
                        eventName,
                        () => {
                            if (
                                liveTripStream
                                    .publishing
                            ) {
                                void liveTripStream
                                    .clearPublisherMicrophone?.();
                            }
                        }
                    );
                }

                if (
                    liveTripStream
                        .publishing &&
                    globalThis
                        .SpeechMenu
                        ?.started
                ) {
                    void liveTripStream
                        .refreshPublisherMicrophone?.();
                }

                events.addEventListener(
                    "speechCommandDispatched",
                    event => {
                        if (
                            !liveTripStream
                                .publishing
                        ) {
                            return;
                        }

                        const detail =
                            event.detail ||
                            {};

                        liveTripStream
                            .broadcast(
                                "speech.command",
                                {
                                    utteranceId:
                                        detail
                                            .utteranceId,
                                    utteranceStartedAt:
                                        detail
                                            .utteranceStartedAt,
                                    transcript:
                                        detail
                                            .transcript,
                                    canonicalTranscript:
                                        detail
                                            .canonicalTranscript,
                                    command:
                                        detail
                                            .commandElement
                                            ?.getAttribute?.(
                                                "speech-function"
                                            ),
                                    arguments:
                                        Array.isArray(
                                            detail
                                                .arguments
                                        )
                                            ? detail
                                                .arguments
                                                .map(
                                                    value =>
                                                        typeof value ===
                                                            "object"
                                                            ? String(
                                                                value
                                                            )
                                                            : value
                                                )
                                            : [],
                                    targetSelector:
                                        detail
                                            .targetSelector
                                },
                                {
                                    persist:
                                        true
                                }
                            );
                    }
                );
            };

        document
            .addEventListener(
                "speech-runtime-ready",
                wireLiveSpeechEvents
            );

        wireLiveSpeechEvents();
        syncLiveStreamViewerUI();
    }
    function populateProfile(user = signedInProfile) {
        if (!user) return;
        signedInProfile = user;
        for (const [id, field] of [["profileUsername", "username"], ["firstName", "first_name"],
            ["lastName", "last_name"], ["preferredName", "preferred_name"]]) {
            $("#" + id).value = user[field] ?? "";
        }
        const permissions =
            Number(user.permissions) || 0;

        const canCreateUsers =
            Boolean(
                permissions &
                (
                    1 |
                    PERMISSION_SUPERUSER
                )
            );

        const canManageTokens =
            Boolean(
                permissions &
                ACCESS_TOKEN_PERMISSION_MASK
            );

        const canUseDeveloperTools =
            Boolean(
                permissions &
                DEVELOPER_MENU_PERMISSION_MASK
            );

        const canUseSpeechEditor =
            Boolean(
                permissions &
                SPEECH_EDITOR_PERMISSION_MASK
            ) &&
            canUseDeveloperTools;

        const canViewLiveStreams =
            Boolean(
                permissions &
                (
                    PERMISSION_VIEW_LIVE_STREAMS |
                    PERMISSION_SUPERUSER
                )
            );

        const canLookupUsers =
            Boolean(
                permissions &
                (
                    PERMISSION_LOOKUP_USERS |
                    PERMISSION_SUPERUSER
                )
            );

        $("#userLookupButton").hidden =
            !canLookupUsers;

        $("#newUserButton").hidden =
            !canCreateUsers;

        $("#accessTokensButton").hidden =
            !canManageTokens;

        $("#liveStreamButton").hidden =
            !(
                canViewLiveStreams &&
                canLookupUsers
            );

        $("#liveStreamViewerSection").hidden =
            !canViewLiveStreams;

        liveStreamLookupButton.hidden =
            !canLookupUsers;

        if (!canLookupUsers) {
            identityContext
                ?.clear?.();
        }

        userLookup
            ?.sync?.();
        syncLiveStreamIdentityUI();

        if (
            !canViewLiveStreams &&
            liveTripStream
                ?.viewing
        ) {
            void liveTripStream
                .stopViewing({
                    notifyServer:
                        false
                });
        }

        $("#speechToolsGroup").hidden =
            false;

        $("#speechTrainingButton").hidden =
            false;

        $("#speechEditorButton").hidden =
            !canUseSpeechEditor;

        $("#speechTimingButton").hidden =
            !canUseDeveloperTools;

        $("#developerDocsButton").hidden =
            !canUseDeveloperTools;

        $("#easterEggToolsGroup").hidden =
            !canUseDeveloperTools;

        $("#sqlConsoleButton").hidden =
            !canUseDeveloperTools;

        $("#adminMenuGroup").hidden =
            !(
                canCreateUsers ||
                canManageTokens ||
                canLookupUsers
            );

        syncSpeechTrainingControls();

        void syncAutomaticLivePublisher();
    }
    profileDialog.addEventListener("opening", () => populateProfile());
    const graphicalDialog = $("#graphicalSettingsDialog");
    const stateDialog = $("#stateSettingsDialog");
    const profileMenuButton = $("#profileMenuButton");
    const authButton = $("#authButton");
    const menuAccountRow = $("#menuAccountRow");
    const menuLogoutSlot = $("#menuLogoutSlot");
    const mainMenu = $("#mainMenu");
    let hamburgerAnnouncementSilent = false;
    let hamburgerAnnouncementSilenceToken = 0;

    const markHamburgerAnnouncementSilent =
        event => {
            if (
                !mainMenu ||
                !event?.target ||
                !mainMenu.contains(
                    event.target
                )
            ) {
                return;
            }

            const token =
                ++hamburgerAnnouncementSilenceToken;

            hamburgerAnnouncementSilent =
                true;

            setTimeout(
                () => {
                    if (
                        hamburgerAnnouncementSilenceToken ===
                            token
                    ) {
                        hamburgerAnnouncementSilent =
                            false;
                    }
                },
                0
            );
        };

    for (
        const type of
            [
                "click",
                "change",
                "input",
                "submit",
                "keydown"
            ]
    ) {
        mainMenu?.addEventListener(
            type,
            markHamburgerAnnouncementSilent,
            true
        );
    }
    const easterEggSongSelect =
        $("#easterEggSongSelect");
    const easterEggPlayButton =
        $("#easterEggPlayButton");
    const easterEggPauseButton =
        $("#easterEggPauseButton");
    const easterEggStopButton =
        $("#easterEggStopButton");
    const easterEggRewindButton =
        $("#easterEggRewindButton");
    const speechRecognitionButton = $("#speechRecognitionButton");
    const speechMicBar = $("#speechMicBar");
    const speechTrainingButton = $("#speechTrainingButton");
    const speechTrainingChoiceDialog = $("#speechTrainingChoiceDialog");
    const speechTrainingPendingDialog = $("#speechTrainingPendingDialog");
    const speechTrainingPendingMessage = $("#speechTrainingPendingMessage");
    const speechTrainingPendingError = $("#speechTrainingPendingError");
    const speechTrainingPendingCancel = $("#speechTrainingPendingCancel");
    const speechTrainingPendingDiscard = $("#speechTrainingPendingDiscard");
    const speechTrainingPendingCommit = $("#speechTrainingPendingCommit");
    const speechTrainingWidget = $("#speechTrainingWidget");
    const speechTrainingDragHandle = $("#speechTrainingDragHandle");
    const speechTrainingPhrase = $("#speechTrainingPhrase");
    const speechTrainingHeard = $("#speechTrainingHeard");
    const speechTrainingHeardStatus = $("#speechTrainingHeardStatus");
    const speechTrainingPrompt = $("#speechTrainingPrompt");
    const speechTrainingCount = $("#speechTrainingCount");
    const speechTrainingStartStop = $("#speechTrainingStartStop");
    const speechTrainingResults = $("#speechTrainingResults");
    const speechTrainingResultsCount = $("#speechTrainingResultsCount");
    const speechTrainingResultsList = $("#speechTrainingResultsList");
    const speechTimingDialog = $("#speechTimingDialog");
    const speechTimingValues = {
        speechRate:
            $("#speechTimingRate"),
        grace:
            $("#speechTimingGrace"),
        dispatchDelay:
            $("#speechTimingDispatchDelay"),
        ttsRate:
            $("#speechTimingTtsRate"),
        ttsAdjustment:
            $("#speechTimingTtsAdjustment"),
        confidence:
            $("#speechTimingConfidence"),
        tripMean:
            $("#speechTimingTripMean"),
        tripDeviation:
            $("#speechTimingTripDeviation"),
        tripSamples:
            $("#speechTimingTripSamples"),
        baselineMean:
            $("#speechTimingBaselineMean"),
        baselineDeviation:
            $("#speechTimingBaselineDeviation"),
        baselineSamples:
            $("#speechTimingBaselineSamples"),
        stream:
            $("#speechTimingStream"),
        recent:
            $("#speechTimingRecent")
    };
    let speechTimingRenderTimer;

    let easterEggSong =
        easterEggSongSelect
            ?.value ||
        "neon-afterglow";
    let easterEggPlayback;
    let easterEggPlaybackBeat = 0;
    let easterEggPlaybackStartedAt;
    let easterEggPlaybackTempo = 104;
    let easterEggPlaybackGeneration = 0;
    let easterEggPlaybackStarting = false;

    const easterEggNow =
        () =>
            globalThis.performance
                ?.now?.() ??
            Date.now();

    const updateEasterEggControls =
        state => {
            const playing =
                state ===
                "playing";
            const paused =
                state ===
                "paused";

            if (easterEggPlayButton) {
                easterEggPlayButton.disabled =
                    playing ||
                    easterEggPlaybackStarting;
                easterEggPlayButton.textContent =
                    paused
                        ? "Resume"
                        : "Play";
            }

            if (easterEggPauseButton) {
                easterEggPauseButton.disabled =
                    !playing;
            }

            if (easterEggStopButton) {
                easterEggStopButton.disabled =
                    !playing &&
                    !paused;
            }

            if (easterEggRewindButton) {
                easterEggRewindButton.disabled =
                    !playing &&
                    !paused &&
                    easterEggPlaybackBeat <=
                        0;
            }
        };

    const captureEasterEggPlaybackBeat =
        () => {
            if (
                !easterEggPlayback ||
                easterEggPlaybackStartedAt ===
                    undefined
            ) {
                return;
            }

            const elapsedSeconds =
                Math.max(
                    0,
                    (
                        easterEggNow() -
                        easterEggPlaybackStartedAt
                    ) /
                        1000
                );

            easterEggPlaybackBeat +=
                elapsedSeconds *
                easterEggPlaybackTempo /
                60;

            easterEggPlaybackStartedAt =
                easterEggNow();
        };

    const startEasterEggPlayback =
        async () => {
            if (
                easterEggPlayback ||
                easterEggPlaybackStarting
            ) {
                return;
            }

            const audio =
                globalThis.WMOFAudio;

            if (!audio?.startSong) {
                return;
            }

            easterEggPlaybackStarting =
                true;
            updateEasterEggControls(
                easterEggPlaybackBeat >
                    0
                    ? "paused"
                    : "stopped"
            );

            const generation =
                ++easterEggPlaybackGeneration;

            try {
                const playback =
                    await audio.startSong(
                        easterEggSong,
                        {
                            startBeat:
                                easterEggPlaybackBeat,
                            includeSpeech:
                                false,
                            useSelectedInstrument:
                                false
                        }
                    );

                if (
                    generation !==
                    easterEggPlaybackGeneration
                ) {
                    playback?.stop?.();
                    return;
                }

                easterEggPlayback =
                    playback;
                easterEggPlaybackTempo =
                    Number(
                        playback?.bpm
                    ) ||
                    104;
                easterEggPlaybackStartedAt =
                    easterEggNow();

                updateEasterEggControls(
                    "playing"
                );

                void playback.finished
                    .then(
                        () => {
                            if (
                                easterEggPlayback
                                    ?.id !==
                                playback.id
                            ) {
                                return;
                            }

                            easterEggPlayback =
                                undefined;
                            easterEggPlaybackBeat =
                                0;
                            easterEggPlaybackStartedAt =
                                undefined;

                            updateEasterEggControls(
                                "stopped"
                            );
                        }
                    );
            }
            catch (error) {
                console.error(
                    "Easter egg playback failed:",
                    error
                );

                easterEggPlayback =
                    undefined;
                easterEggPlaybackStartedAt =
                    undefined;

                updateEasterEggControls(
                    easterEggPlaybackBeat >
                        0
                        ? "paused"
                        : "stopped"
                );
            }
            finally {
                easterEggPlaybackStarting =
                    false;

                updateEasterEggControls(
                    easterEggPlayback
                        ? "playing"
                        : (
                            easterEggPlaybackBeat >
                                0
                                ? "paused"
                                : "stopped"
                        )
                );
            }
        };

    const pauseEasterEggPlayback =
        () => {
            if (!easterEggPlayback) {
                return;
            }

            captureEasterEggPlaybackBeat();

            const playback =
                easterEggPlayback;

            easterEggPlayback =
                undefined;
            easterEggPlaybackStartedAt =
                undefined;
            ++easterEggPlaybackGeneration;

            playback.stop?.();

            updateEasterEggControls(
                "paused"
            );
        };

    const stopEasterEggPlayback =
        () => {
            const playback =
                easterEggPlayback;

            easterEggPlayback =
                undefined;
            easterEggPlaybackBeat =
                0;
            easterEggPlaybackStartedAt =
                undefined;
            ++easterEggPlaybackGeneration;

            playback?.stop?.();

            updateEasterEggControls(
                "stopped"
            );
        };

    const rewindEasterEggPlayback =
        async () => {
            const wasPlaying =
                Boolean(
                    easterEggPlayback
                );
            const playback =
                easterEggPlayback;

            easterEggPlayback =
                undefined;
            easterEggPlaybackBeat =
                0;
            easterEggPlaybackStartedAt =
                undefined;
            ++easterEggPlaybackGeneration;

            playback?.stop?.();

            updateEasterEggControls(
                "stopped"
            );

            if (wasPlaying) {
                await startEasterEggPlayback();
            }
        };

    easterEggSongSelect
        ?.addEventListener(
            "change",
            () => {
                stopEasterEggPlayback();

                easterEggSong =
                    easterEggSongSelect.value ||
                    "neon-afterglow";

                easterEggPlaybackTempo =
                    easterEggSong ===
                        "chrome-velocity"
                        ? 156
                        : 104;
            }
        );

    easterEggPlayButton
        ?.addEventListener(
            "click",
            () => {
                void startEasterEggPlayback();
            }
        );

    easterEggPauseButton
        ?.addEventListener(
            "click",
            pauseEasterEggPlayback
        );

    easterEggStopButton
        ?.addEventListener(
            "click",
            stopEasterEggPlayback
        );

    easterEggRewindButton
        ?.addEventListener(
            "click",
            () => {
                void rewindEasterEggPlayback();
            }
        );

    updateEasterEggControls(
        "stopped"
    );

    let speechRecognitionLanguageAvailable = false;
    let speechTrainingConnectionAvailable = false;
    let inAppSpeechTrainingEnabled = false;
    let speechTrainingActive = false;
    let speechTrainingTarget;
    let speechTrainingUtteranceCount = 0;
    let speechTrainingCsrfToken;
    let speechTrainingExecutionBeforeStart = true;
    let speechTrainingPromptTimer;
    let speechTrainingPendingDecision;
    let speechTrainingPendingDecisionResolve;
    let speechTrainingPendingBusy = false;
    let speechTrainingPendingReason;
    const speechTrainingPendingSamples = [];
    const speechTrainingSeenUtterances = new Set();
    const speechTrainingResultsHistory = [];
    const speechTrainingOutcomeByUtterance = new Map();

    new MutationObserver(
        records => {
            if (
                records.some(
                    record =>
                        record.attributeName ===
                            "open" &&
                        record.target
                            ?.matches?.(
                                "dialog[open]"
                            )
                )
            ) {
                queueMicrotask(
                    () =>
                        speechMicBar
                            ?.promoteTopLayer?.()
                );
            }
        }
    ).observe(
        document.documentElement,
        {
            subtree: true,
            attributes: true,
            attributeFilter: [
                "open"
            ]
        }
    );

    const setSpeechButtonState =
        globalThis
            .WMOFPresentationSetters
            .define(
                "setSpeechButtonState",
                (
                    enabled,
                    muted = false
                ) => {
                    speechRecognitionButton
                        ?.setAttribute(
                            "aria-pressed",
                            String(enabled)
                        );

                    speechRecognitionButton
                        ?.classList
                        .toggle(
                            "is-sleeping",
                            enabled &&
                                muted
                        );

                    if (
                        speechRecognitionButton
                    ) {
                        speechRecognitionButton
                            .title =
                            enabled
                                ? "Disable Speech Recognition"
                                : "Enable Speech Recognition";

                        speechRecognitionButton
                            .setAttribute(
                                "aria-label",
                                speechRecognitionButton
                                    .title
                            );
                    }
                }
            );

    let tripLogSpeechLayoutAnimationFrame;

    function animateTripLogSpeechBoundary() {
        if (
            tripLogSpeechLayoutAnimationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                tripLogSpeechLayoutAnimationFrame
            );
        }

        const duration =
            Number.parseFloat(
                getComputedStyle(app)
                    .getPropertyValue(
                        "--trip-log-layout-duration"
                    )
            ) ||
            1000;

        const startedAt =
            performance.now();

        const frame =
            now => {
                refreshTripLogBoundaryLayout();

                if (
                    now - startedAt <
                    duration + 34
                ) {
                    tripLogSpeechLayoutAnimationFrame =
                        requestAnimationFrame(
                            frame
                        );

                    return;
                }

                tripLogSpeechLayoutAnimationFrame =
                    undefined;

                refreshTripLogBoundaryLayout();
            };

        tripLogSpeechLayoutAnimationFrame =
            requestAnimationFrame(
                frame
            );
    }

    function speechRecognitionEnabled() {
        return (
            speechRecognitionButton
                ?.getAttribute(
                    "aria-pressed"
                ) ===
            "true"
        );
    }

    const setSpeechLayoutState =
        globalThis
            .WMOFPresentationSetters
            .define(
                "setSpeechLayoutState",
                enabled => {
                    app.dataset
                        .speechActive =
                        String(
                            Boolean(
                                enabled
                            )
                        );

                    animateTripLogSpeechBoundary();
                }
            );

    let speechActivationPending = false;
    let speechRecognitionSuspended = false;

    const disableSpeechRecognitionRuntime =
        async () => {
            if (speechTrainingActive) {
                return false;
            }

            setSpeechButtonState(
                false,
                false
            );
            setSpeechLayoutState(
                false
            );

            try {
                await ensureSpeechRuntime();

                const speechMenu =
                    globalThis.SpeechMenu;

                if (!speechMenu?.started) {
                    speechRecognitionSuspended =
                        false;
                    return false;
                }

                if (!speechRecognitionSuspended) {
                    speechMenu
                        .suspendListening?.(
                            "speech-recognition-disabled"
                        );
                    speechRecognitionSuspended =
                        true;
                }

                return true;
            }
            catch (error) {
                console.error(error);
                return false;
            }
        };

    const enableSpeechRecognitionRuntime =
        async () => {
            await ensureSpeechRuntime();

            const speechMenu =
                globalThis.SpeechMenu;

            if (
                speechRecognitionSuspended &&
                speechMenu?.started
            ) {
                speechMenu
                    .resumeListening?.(
                        "speech-recognition-disabled"
                    );
                speechRecognitionSuspended =
                    false;
                return true;
            }

            speechRecognitionSuspended =
                false;

            const englishLanguage =
                globalThis.WMOFLanguages?.["en-US"];

            return Boolean(
                await speechMenu?.start?.(
                    englishLanguage
                        ?.speechRecognitionLanguage ||
                        "en-US"
                )
            );
        };

    setSpeechButtonState(false);
    setSpeechLayoutState(false);

    speechRecognitionButton?.addEventListener(
        "click",
        async () => {
            if (
                speechActivationPending ||
                speechTrainingActive
            ) return;

            const enabled =
                speechRecognitionButton.getAttribute(
                    "aria-pressed"
                ) === "true";

            if (enabled) {
                await disableSpeechRecognitionRuntime();
                return;
            }

            speechActivationPending = true;
            setSpeechButtonState(true, false);
            setSpeechLayoutState(true);
            mainMenu?.hidePopover?.();

            try {
                const started =
                    await enableSpeechRecognitionRuntime();

                if (!started) {
                    setSpeechButtonState(false, false);
                    setSpeechLayoutState(false);
                }
            }
            catch (error) {
                console.error(error);
                setSpeechButtonState(false, false);
                setSpeechLayoutState(false);
            }
            finally {
                speechActivationPending = false;
            }
        }
    );
    const scopeToggle = $("#scopeToggle");
    const scopeConnectionButton = $("#scopeConnectionButton");
    const tripListMenuButton = $("#tripListMenuButton");
    const tripLogPinButton = $("#tripLogPinButton");
    const tripLogRangeSelect = $("#tripLogRangeSelect");
    const tripLogStartDate = $("#tripLogStartDate");
    const tripLogEndDate = $("#tripLogEndDate");
    const tripLogRangeError = $("#tripLogRangeError");
    let tripRangeRevision = 0;
    const toggleSyncMenuButton = $("#toggleSyncMenuButton");
    const syncGoalsMenuIcon = toggleSyncMenuButton?.querySelector(".sync-goals-menu-icon");
    const tripLogButton = $("#tripLogButton");
    const tripLogCloseButton = $("#tripLogCloseButton");
    const tripLogSettingsButton = $("#tripLogSettingsButton");
    let tripLogSettingsVisible = false;
    const tripLogBody = $("#tripLogBody");
    const toggleSyncGoalButton = $("#toggleSyncGoalButton");
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
    setOkAllowed(
        breakDialog,
        false
    );
    const tripTransitionOverlay = $("#tripTransitionOverlay");
    const tripTransitionOverlayTitle = $("#tripTransitionOverlayTitle");
    const tripTransitionOverlayDetails = $("#tripTransitionOverlayDetails");
    const scheduledStartDialog = $("#scheduledStartDialog");
    const scheduledStartCountdownLabel = $("#scheduledStartCountdownLabel");
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
    const audioSettingsDialog = $("#audioSettingsDialog");
    const audioSettingsForm = $("#audioSettingsForm");
    const audioAnnouncementsDialog = $("#audioAnnouncementsDialog");
    const audioAnnouncementsForm = $("#audioAnnouncementsForm");
    const audioAnnouncementsOpen = $("#audioAnnouncementsOpen");
    const audioAnnouncementRows = $("#audioAnnouncementRows");
    const audioAnnouncementPage = $("#audioAnnouncementPage");
    const audioAnnouncementEventList = $("#audioAnnouncementEventList");
    const audioAnnouncementBack = $("#audioAnnouncementBack");
    const audioAnnouncementSelectedLabel = $("#audioAnnouncementSelectedLabel");
    const audioAnnouncementMobileAttributeRow = $("#audioAnnouncementMobileAttributeRow");
    const audioAnnouncementMobileOverrides = $("#audioAnnouncementMobileOverrides");
    const audioAnnouncementPreview = $("#audioAnnouncementPreview");
    const audioAnnouncementApplyCustom = $("#audioAnnouncementApplyCustom");
    const audioAnnouncementResetCustom = $("#audioAnnouncementResetCustom");
    const audioAnnouncementCancelCustom = $("#audioAnnouncementCancelCustom");
    const audioSpeechVolume = $("#audioSpeechVolume");
    const audioToneVolume = $("#audioToneVolume");
    const audioVoice = $("#audioVoice");
    const audioInstrument = $("#audioInstrument");
    const audioMasterVelocity = $("#audioMasterVelocity");
    const audioSpeechVelocity = $("#audioSpeechVelocity");
    const audioToneVelocity = $("#audioToneVelocity");
    const audioFormalTime = $("#audioFormalTime");
    const audioSpeechVolumeValue = $("#audioSpeechVolumeValue");
    const audioToneVolumeValue = $("#audioToneVolumeValue");
    const audioMasterVelocityValue = $("#audioMasterVelocityValue");
    const audioSpeechVelocityValue = $("#audioSpeechVelocityValue");
    const audioToneVelocityValue = $("#audioToneVelocityValue");
    const audioSettingsReset = $("#audioSettingsReset");

    let loginPromptTimeout;
    let loginPending = false;
    let stagedStandardTimeMilliseconds;
    let tripDraft;
    let newTripWorkflowLocked = false;

    function refreshSpeechCommandContext() {
        queueMicrotask(
            () => globalThis
                .SpeechMenu
                ?.extrapolatePhrases?.()
        );
    }

    function syncNewTripButtonAvailability() {
        const button =
            document.getElementById(
                "newTripButton"
            );

        if (!button) {
            return false;
        }

        button.disabled =
            newTripWorkflowLocked ||
            tripIsLive();

        return !button.disabled;
    }

    function lockNewTripWorkflow() {
        const changed =
            !newTripWorkflowLocked;

        newTripWorkflowLocked =
            true;

        syncNewTripButtonAvailability();

        if (changed) {
            refreshSpeechCommandContext();
        }

        return true;
    }

    function releaseNewTripWorkflow() {
        const changed =
            newTripWorkflowLocked;

        newTripWorkflowLocked =
            false;

        syncNewTripButtonAvailability();

        if (changed) {
            refreshSpeechCommandContext();
        }

        return true;
    }
    let tripSettingsSession;
    let tripStartsNowState;
    let tripStartsNowExiting = false;
    let tripStartsNowExitTimer;
    const tripTransitionOverlayQueue = [];
    let tripTransitionOverlayActive = false;
    let tripTransitionOverlayTimer;
    let tripTransitionOverlayHideTimer;
    let audioAnnouncementDraft;
    let audioSettingsBoundaryResizeObserver;
    let scheduledStartTicker;
    let scheduledStartSpeechPromptTimer;
    let scheduledStartAutoArmed = false;
    let scheduledStartNeedsResolution = false;
    let numberPadState;
    let numberPadLoadPromise;
    let numberPadDialog;
    let englishSpeech;
    let installSpeechCommand;
    let numberPadDisplay;
    let numberPadSettingsArea;
    let numberPadSettings;
    let numberPadConnection;
    let numberPadClear;
    let numberPadReset;
    let numberPadCancel;
    let numberPadConfirm;
    let numberPadVoice;
    let preserveNumberPadStateOnClose = false;
    let numberPadContext;
    let numberPadReadout;
    let numberPadDate;
    let numberPadDateRow;
    let numberPadAM;
    let numberPadPM;
    const voiceEntrySurface = $("#voiceEntrySurface");
    const voiceEntryTitle = $("#voiceEntryTitle");
    const voiceEntryPrompt = $("#voiceEntryPrompt");
    const voiceEntryExample = $("#voiceEntryExample");
    const voiceEntryValue = $("#voiceEntryValue");
    const voiceEntryInstructions = $("#voiceEntryInstructions");
    const voiceEntryOkAction = $("#voiceEntryOkAction");
    const voiceEntryCancelAction = $("#voiceEntryCancelAction");
    const voiceEntryTouch = $("#voiceEntryTouch");
    const voiceEntryCancel = $("#voiceEntryCancel");
    let voiceEntryState;
    let voiceEntryExecutionBeforeOpen;
    let voiceEntrySystemExecutionBeforeOpen;
    let voiceEntryAcceptTimer;
    let voiceEntryFeedbackSequence = 0;
    let voiceEntryHandledUtteranceId;
    let voiceEntryTranscriptPipeBound = false;
    const uiReturnStack = [];
    let tripSettingsNavigation = {
        returnTarget: "home",
        numberPadState: undefined
    };
    const speechEditorPreview =
        new URLSearchParams(
            globalThis.location
                ?.search ||
            ""
        )
            .get(
                "speech-editor-preview"
            ) ===
        "1";

    let loginConfirmedThisLoad = false;
    let fullscreenLoginAttempt;
    let deliberatelyLoggedOut = safeStorageGet("wmof.deliberatelyLoggedOut") === "true";
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
    let endTimeGoalLockFlashTimer;
    let syncNetworkStatus;
    let syncOfflineTransitionSequence = 0;
    let syncAnnouncementState;
    let syncAnnouncementGoal;
    let syncPreferenceChangeInProgress =
        false;

    const CONNECTION_INDICATOR_MINIMUM = 1000;
    const CLOCK_TIMER_DOUBLE_PRESS = 350;
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
    const graphicalDetailsAnimations = new WeakMap();
    const GRAPHICAL_DETAILS_DURATION = 180;
    const SETTINGS_HELP_FADE_DURATION = 250;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 350;
    const TRIP_LIST_BODY_DELAY = 125;
    const TRIP_LIST_BODY_DURATION = 425;
    const TRIP_LIST_MERGE_DURATION = 300;
    const ANNOUNCEMENT_SPEECH_PAUSE_AT_1X = 300;
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
    let graphicalPreviewAnimationFrame;
    let graphicalPreviewResizeObserver;
    let settingsHelpAnimation;
    let tripListButtonAnimation;
    let tripListBodyAnimationFrame;

    function defaultAudioSettings() {
        const rows = {};

        for (const [key] of AUDIO_ANNOUNCEMENTS) {
            rows[key] = {
                enabled: true,
                chime: 0,
                summary: 0,
                details: 0
            };
        }

        return {
            speechVolume: 1,
            toneVolume: 1,
            masterVelocity: 1,
            speechVelocity: 1,
            toneVelocity: 1,
            instrument: "",
            voices: {
                [AUDIO_LANGUAGE]: {
                    provider:
                        "system",
                    voice:
                        ""
                }
            },
            formalTime: false,
            masters: {
                chime: true,
                summary: true,
                details: true
            },
            rows
        };
    }

    function normalizeAudioSettings(source) {
        const settings = defaultAudioSettings();
        const value =
            source && typeof source === "object"
                ? source
                : {};
        const clamp =
            (candidate, minimum, maximum, fallback) => {
                const numeric = Number(candidate);
                return Number.isFinite(numeric)
                    ? Math.max(minimum, Math.min(maximum, numeric))
                    : fallback;
            };

        settings.speechVolume =
            clamp(value.speechVolume, 0, 1, 1);
        settings.toneVolume =
            clamp(value.toneVolume, 0, 1, 1);
        settings.masterVelocity =
            clamp(value.masterVelocity, 0.5, 4, 1);
        settings.speechVelocity =
            clamp(
                value.speechVelocity,
                AUDIO_SPEECH_VELOCITY_MIN,
                AUDIO_SPEECH_VELOCITY_MAX,
                1
            );
        settings.toneVelocity =
            clamp(value.toneVelocity, 0.5, 1.5, 1);
        settings.instrument =
            typeof value.instrument ===
                "string"
                ? value.instrument.trim()
                : "";

        settings.voices = {};
        const storedVoices =
            value.voices &&
            typeof value.voices ===
                "object"
                ? value.voices
                : {};

        for (
            const [
                language,
                selection
            ] of Object.entries(
                storedVoices
            )
        ) {
            if (
                !language ||
                !selection ||
                typeof selection !==
                    "object"
            ) {
                continue;
            }

            settings.voices[
                language
            ] = {
                provider:
                    typeof selection
                        .provider ===
                        "string" &&
                    selection.provider
                        .trim()
                        ? selection
                            .provider
                            .trim()
                        : "system",
                voice:
                    typeof selection
                        .voice ===
                        "string"
                        ? selection.voice
                            .trim()
                        : ""
            };
        }

        settings.voices[
            AUDIO_LANGUAGE
        ] ||= {
            provider:
                "system",
            voice:
                ""
        };

        settings.formalTime =
            value.formalTime === true;

        for (const layer of ["chime", "summary", "details"]) {
            if (typeof value.masters?.[layer] === "boolean") {
                settings.masters[layer] =
                    value.masters[layer];
            }
        }

        for (const [key] of AUDIO_ANNOUNCEMENTS) {
            const row = value.rows?.[key];
            if (!row || typeof row !== "object") continue;

            if (typeof row.enabled === "boolean") {
                settings.rows[key].enabled =
                    row.enabled;
            }

            for (const layer of ["chime", "summary", "details"]) {
                if (row[layer] === -1 || row[layer] === 0) {
                    settings.rows[key][layer] =
                        row[layer];
                }
            }

            if (
                row.custom &&
                typeof row.custom === "object"
            ) {
                const custom = {};

                const copyCustom =
                    (
                        property,
                        minimum,
                        maximum
                    ) => {
                        if (
                            !Object.prototype
                                .hasOwnProperty
                                .call(
                                    row.custom,
                                    property
                                )
                        ) {
                            return;
                        }

                        const numeric =
                            Number(
                                row.custom[
                                    property
                                ]
                            );

                        if (
                            !Number.isFinite(
                                numeric
                            )
                        ) {
                            return;
                        }

                        custom[property] =
                            Math.max(
                                minimum,
                                Math.min(
                                    maximum,
                                    numeric
                                )
                            );
                    };

                copyCustom(
                    "speechVolume",
                    0,
                    1
                );
                copyCustom(
                    "toneVolume",
                    0,
                    1
                );
                copyCustom(
                    "speechVelocity",
                    AUDIO_SPEECH_VELOCITY_MIN,
                    AUDIO_SPEECH_VELOCITY_MAX
                );
                copyCustom(
                    "toneVelocity",
                    0.5,
                    1.5
                );

                if (
                    Object.keys(
                        custom
                    ).length
                ) {
                    settings.rows[key]
                        .custom =
                        custom;
                }
            }
        }

        return settings;
    }

    function loadAudioSettings() {
        try {
            const raw =
                safeStorageGet(
                    STORAGE.audioSettings
                );
            return normalizeAudioSettings(
                raw ? JSON.parse(raw) : undefined
            );
        }
        catch {
            return defaultAudioSettings();
        }
    }

    let audioSettings =
        loadAudioSettings();

    function saveAudioSettings() {
        safeStorageSet(
            STORAGE.audioSettings,
            JSON.stringify(audioSettings)
        );
    }

    function getAudioVoiceSelection(
        language =
            AUDIO_LANGUAGE
    ) {
        const selection =
            audioSettings.voices?.[
                language
            ];

        return {
            provider:
                typeof selection
                    ?.provider ===
                    "string" &&
                selection.provider
                    .trim()
                    ? selection.provider
                        .trim()
                    : "system",
            voice:
                typeof selection
                    ?.voice ===
                    "string"
                    ? selection.voice
                        .trim()
                    : ""
        };
    }

    function encodeAudioVoiceSelection(
        provider,
        voice
    ) {
        return (
            String(
                provider ||
                "system"
            ) +
            "|" +
            encodeURIComponent(
                String(
                    voice ||
                    ""
                )
            )
        );
    }

    function decodeAudioVoiceSelection(
        value
    ) {
        const text =
            String(
                value ||
                ""
            );
        const separator =
            text.indexOf("|");

        if (separator < 0) {
            return {
                provider:
                    "system",
                voice:
                    ""
            };
        }

        let voice = "";

        try {
            voice =
                decodeURIComponent(
                    text.slice(
                        separator + 1
                    )
                );
        }
        catch {}

        return {
            provider:
                text.slice(
                    0,
                    separator
                ).trim() ||
                "system",
            voice
        };
    }

    function applyAudioOutputSettings() {
        const voiceSelection =
            getAudioVoiceSelection();

        globalThis.WMOFAudio?.configureOutput?.({
            speechVolume:
                audioSettings.speechVolume,
            toneVolume:
                audioSettings.toneVolume,
            speechVelocity:
                audioSettings.speechVelocity,
            toneVelocity:
                audioSettings.toneVelocity,
            instrument:
                audioSettings.instrument,
            speechLanguage:
                AUDIO_LANGUAGE,
            voiceProvider:
                voiceSelection.provider,
            voice:
                voiceSelection.voice
        });

        syncAdaptiveSpeechTimingRate();
    }

    function audioCellUserEnabled(
        announcement,
        layer,
        {
            ignoreMaster = false
        } = {}
    ) {
        const row =
            audioSettings.rows[
                announcement
            ];
        const masterEnabled =
            ignoreMaster ||
            announcementOverridesMaster(
                announcement,
                layer
            ) ||
            audioSettings.masters[
                layer
            ] !== false;

        return Boolean(
            row &&
            row.enabled !== false &&
            masterEnabled &&
            row[layer] !== -1
        );
    }

    function audioAnnouncementOutput(
        announcement,
        rowOverride
    ) {
        const row =
            rowOverride ||
            audioSettings.rows[
                announcement
            ] ||
            {};
        const custom =
            row.custom ||
            {};

        const resolve =
            property =>
                Object.prototype
                    .hasOwnProperty
                    .call(
                        custom,
                        property
                    )
                    ? custom[
                        property
                    ]
                    : audioSettings[
                        property
                    ];

        const speechVelocity =
            resolve(
                "speechVelocity"
            );

        return {
            speechVolume:
                resolve(
                    "speechVolume"
                ),
            toneVolume:
                resolve(
                    "toneVolume"
                ),
            speechVelocity,
            toneVelocity:
                resolve(
                    "toneVelocity"
                ),
            speechDelayMs:
                ANNOUNCEMENT_SPEECH_PAUSE_AT_1X /
                Math.max(
                    0.01,
                    Number(
                        speechVelocity
                    ) ||
                    1
                )
        };
    }

    function cloneAudioAnnouncementRow(
        row
    ) {
        return row
            ? structuredClone(
                row
            )
            : undefined;
    }

    function selectedAudioAnnouncement() {
        return audioAnnouncementMobileAttributeRow
            ?.dataset
            .audioAnnouncement;
    }

    function selectedAudioAnnouncementState() {
        const announcement =
            selectedAudioAnnouncement();

        if (!announcement) {
            return undefined;
        }

        return audioAnnouncementDraft?.announcement ===
            announcement
            ? audioAnnouncementDraft.row
            : audioSettings.rows[
                announcement
            ];
    }

    function beginAudioAnnouncementDraft(
        announcement
    ) {
        const row =
            audioSettings.rows[
                announcement
            ];

        if (!row) {
            audioAnnouncementDraft =
                undefined;
            return;
        }

        audioAnnouncementDraft = {
            announcement,
            row:
                cloneAudioAnnouncementRow(
                    row
                )
        };
    }

    function discardAudioAnnouncementDraft() {
        audioAnnouncementDraft =
            undefined;
    }


    async function populateAudioVoiceOptions() {
        if (!audioVoice) return;

        const selected =
            getAudioVoiceSelection();
        const selectedValue =
            encodeAudioVoiceSelection(
                selected.provider,
                selected.voice
            );
        const fragment =
            document
                .createDocumentFragment();
        const defaultOption =
            document.createElement(
                "option"
            );

        defaultOption.value =
            encodeAudioVoiceSelection(
                "system",
                ""
            );
        defaultOption.textContent =
            "System Default";
        fragment.append(
            defaultOption
        );

        try {
            const catalog =
                await globalThis
                    .WMOFVoiceCatalog
                    ?.load?.(
                        AUDIO_LANGUAGE
                    );

            for (
                const provider of
                    catalog?.providers ||
                    []
            ) {
                if (
                    !provider?.voices
                        ?.length
                ) {
                    continue;
                }

                const group =
                    document.createElement(
                        "optgroup"
                    );

                group.label =
                    String(
                        provider.label ||
                        provider.id ||
                        "Voices"
                    );

                for (
                    const voice of
                        provider.voices
                ) {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        encodeAudioVoiceSelection(
                            voice.provider ||
                                provider.id,
                            voice.id
                        );
                    option.textContent =
                        String(
                            voice.name ||
                            voice.id
                        );

                    if (
                        voice.language &&
                        String(
                            voice.language
                        ).toLowerCase() !==
                            AUDIO_LANGUAGE
                                .toLowerCase()
                    ) {
                        option.textContent +=
                            " (" +
                            voice.language +
                            ")";
                    }

                    group.append(
                        option
                    );
                }

                fragment.append(
                    group
                );
            }
        }
        catch (error) {
            console.warn(
                "Unable to load speech voices:",
                error
            );
        }

        audioVoice.replaceChildren(
            fragment
        );

        const available =
            [
                ...audioVoice.options
            ].some(
                option =>
                    option.value ===
                    selectedValue
            );

        if (
            !available &&
            selected.voice
        ) {
            const unavailable =
                document.createElement(
                    "option"
                );

            unavailable.value =
                selectedValue;
            unavailable.textContent =
                "Unavailable saved voice";
            unavailable.disabled =
                true;
            audioVoice.append(
                unavailable
            );
        }

        audioVoice.value =
            available ||
            selected.voice
                ? selectedValue
                : defaultOption.value;
    }

    async function populateAudioInstrumentOptions() {
        if (!audioInstrument) return;

        try {
            const catalog =
                await globalThis.WMOFAudio
                    ?.load?.();
            const instruments =
                Object.entries(
                    catalog?.instruments ||
                    {}
                );

            const fragment =
                document.createDocumentFragment();
            const defaultOption =
                document.createElement(
                    "option"
                );

            defaultOption.value = "";
            defaultOption.textContent =
                "Song Default";
            fragment.append(
                defaultOption
            );

            for (
                const [
                    id,
                    instrument
                ] of instruments
            ) {
                if (
                    instrument
                        ?.selectable ===
                        false
                ) {
                    continue;
                }

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    id;
                option.textContent =
                    String(
                        instrument
                            ?.displayName ||
                        id
                    );

                fragment.append(
                    option
                );
            }

            audioInstrument
                .replaceChildren(
                    fragment
                );
            audioInstrument.value =
                audioSettings.instrument;

            if (
                audioInstrument.value !==
                    audioSettings.instrument
            ) {
                audioInstrument.value =
                    "";
            }
        }
        catch (error) {
            console.warn(
                "Unable to load audio instruments:",
                error
            );
        }
    }

    function getAudioSettingsSafeBottom() {
        const visualViewport =
            globalThis.visualViewport;
        const viewportTop =
            visualViewport?.offsetTop ??
            0;
        const viewportBottom =
            viewportTop +
            (
                visualViewport?.height ??
                globalThis.innerHeight
            );

        const speechTop =
            Number(
                speechMicBar
                    ?.getSafeTop?.()
            );

        if (
            Number.isFinite(
                speechTop
            )
        ) {
            return Math.max(
                viewportTop,
                Math.min(
                    viewportBottom,
                    speechTop
                )
            );
        }

        const fallbackTop =
            speechMicBar
                ?.getBoundingClientRect?.()
                ?.top;

        return Number.isFinite(
            fallbackTop
        )
            ? Math.max(
                viewportTop,
                Math.min(
                    viewportBottom,
                    fallbackTop
                )
            )
            : viewportBottom;
    }

    function refreshAudioSettingsBoundary() {
        if (!audioSettingsDialog) {
            return false;
        }

        const visualViewport =
            globalThis.visualViewport;
        const viewportTop =
            visualViewport?.offsetTop ??
            0;
        const safeBottom =
            getAudioSettingsSafeBottom();
        const safeHeight =
            Math.max(
                0,
                safeBottom -
                    viewportTop
            );

        for (
            const dialog of
            [
                audioSettingsDialog,
                audioAnnouncementsDialog
            ]
        ) {
            if (!dialog) continue;

            dialog.style
                .setProperty(
                    "--audio-settings-safe-top",
                    viewportTop +
                        "px"
                );

            dialog.style
                .setProperty(
                    "--audio-settings-safe-height",
                    safeHeight +
                        "px"
                );
        }

        return true;
    }

    function bindAudioSettingsBoundary() {
        speechMicBar
            ?.addEventListener(
                "speech-surface-boundary-change",
                refreshAudioSettingsBoundary
            );

        globalThis.visualViewport
            ?.addEventListener(
                "resize",
                refreshAudioSettingsBoundary
            );

        globalThis.visualViewport
            ?.addEventListener(
                "scroll",
                refreshAudioSettingsBoundary
            );

        globalThis.addEventListener(
            "resize",
            refreshAudioSettingsBoundary
        );

        if (
            typeof ResizeObserver ===
                "function" &&
            speechMicBar
        ) {
            audioSettingsBoundaryResizeObserver =
                new ResizeObserver(
                    refreshAudioSettingsBoundary
                );

            audioSettingsBoundaryResizeObserver
                .observe(
                    speechMicBar
                );
        }
    }

    function buildAudioAnnouncementRows() {
        if (!audioAnnouncementRows) return;

        const fragment =
            document.createDocumentFragment();

        for (const [key, label] of AUDIO_ANNOUNCEMENTS) {
            const row =
                document.createElement("tr");
            row.dataset.audioAnnouncement =
                key;

            const heading =
                document.createElement("th");
            heading.scope = "row";

            const labelElement =
                document.createElement("label");
            const master =
                document.createElement("input");
            master.type = "checkbox";
            master.dataset.audioRowMaster = "";

            const detailButton =
                document.createElement(
                    "button"
                );

            detailButton.type =
                "button";
            detailButton.className =
                "audio-announcement-desktop-detail";
            detailButton.dataset.audioAnnouncementDesktopDetail =
                key;
            detailButton.textContent =
                label + " ›";

            labelElement.append(
                master,
                detailButton
            );
            heading.append(labelElement);
            row.append(heading);

            for (const layer of ["chime", "summary", "details"]) {
                const cell =
                    document.createElement("td");
                const input =
                    document.createElement("input");
                input.type = "checkbox";
                input.dataset.audioLayer =
                    layer;
                input.setAttribute(
                    "aria-label",
                    label + " " + layer
                );
                cell.dataset.audioLayerLabel =
                    layer === "chime"
                        ? "Chime"
                        : layer === "summary"
                            ? "Summary"
                            : "Details";
                cell.append(input);
                row.append(cell);
            }

            fragment.append(row);
        }

        audioAnnouncementRows.replaceChildren(
            fragment
        );

        if (audioAnnouncementEventList) {
            const mobileFragment =
                document.createDocumentFragment();

            const addChoice =
                (key, label, master = false) => {
                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "audio-announcement-event-row";

                    if (!master) {
                        const enabled =
                            document.createElement(
                                "input"
                            );

                        enabled.type =
                            "checkbox";
                        enabled.className =
                            "audio-announcement-event-enabled";
                        enabled.dataset.audioAnnouncementEnabled =
                            key;
                        enabled.setAttribute(
                            "aria-label",
                            "Enable " + label
                        );

                        row.append(
                            enabled
                        );
                    }
                    else {
                        row.classList.add(
                            "audio-announcement-event-row-master"
                        );
                    }

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";
                    button.className =
                        "audio-announcement-event-choice";
                    button.dataset.audioAnnouncementSelect =
                        master
                            ? "master"
                            : key;

                    const text =
                        document.createElement(
                            "span"
                        );

                    text.textContent =
                        label;

                    const arrow =
                        document.createElement(
                            "span"
                        );

                    arrow.className =
                        "audio-announcement-event-arrow";
                    arrow.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                    arrow.textContent =
                        "›";

                    button.append(
                        text,
                        arrow
                    );

                    row.append(
                        button
                    );

                    mobileFragment.append(
                        row
                    );
                };

            addChoice(
                "master",
                "Master",
                true
            );

            for (
                const [
                    key,
                    label
                ] of
                AUDIO_ANNOUNCEMENTS
            ) {
                addChoice(
                    key,
                    label
                );
            }

            audioAnnouncementEventList
                .replaceChildren(
                    mobileFragment
                );
        }
    }

    function showAudioAnnouncementMobileDetail(
        selection,
        source
    ) {
        if (
            !audioAnnouncementPage ||
            !audioAnnouncementSelectedLabel ||
            !audioAnnouncementMobileAttributeRow
        ) {
            return false;
        }

        const master =
            selection ===
            "master";

        const entry =
            AUDIO_ANNOUNCEMENTS
                .find(
                    ([key]) =>
                        key ===
                        selection
                );

        if (
            !master &&
            !entry
        ) {
            return false;
        }

        audioAnnouncementSelectedLabel
            .textContent =
            master
                ? "Master"
                : entry[1];

        if (master) {
            discardAudioAnnouncementDraft();

            audioAnnouncementMobileAttributeRow
                .removeAttribute(
                    "data-audio-announcement"
                );
            audioAnnouncementMobileAttributeRow
                .hidden =
                true;

            if (
                audioAnnouncementMobileOverrides
            ) {
                audioAnnouncementMobileOverrides
                    .hidden =
                    true;
            }
        }
        else {
            beginAudioAnnouncementDraft(
                selection
            );

            audioAnnouncementMobileAttributeRow
                .dataset
                .audioAnnouncement =
                selection;
            audioAnnouncementMobileAttributeRow
                .hidden =
                false;

            if (
                audioAnnouncementMobileOverrides
            ) {
                audioAnnouncementMobileOverrides
                    .hidden =
                    false;
            }
        }

        renderAudioSettings();

        void audioAnnouncementPage
            .showView(
                "detail",
                {
                    source,
                    direction:
                        "up"
                }
            );

        return true;
    }

    function renderAudioSettings() {
        if (!audioSettingsDialog) return;

        audioSpeechVolume.value =
            String(audioSettings.speechVolume);
        audioToneVolume.value =
            String(audioSettings.toneVolume);
        audioMasterVelocity.value =
            String(audioSettings.masterVelocity);
        audioSpeechVelocity.value =
            String(audioSettings.speechVelocity);
        audioToneVelocity.value =
            String(audioSettings.toneVelocity);
        if (audioInstrument) {
            audioInstrument.value =
                audioSettings.instrument;
        }
        if (audioVoice) {
            const selection =
                getAudioVoiceSelection();

            audioVoice.value =
                encodeAudioVoiceSelection(
                    selection.provider,
                    selection.voice
                );
        }
        audioFormalTime.checked =
            audioSettings.formalTime === true;

        audioSpeechVolumeValue.textContent =
            Math.round(audioSettings.speechVolume * 100) + "%";
        audioToneVolumeValue.textContent =
            Math.round(audioSettings.toneVolume * 100) + "%";
        audioMasterVelocityValue.textContent =
            audioSettings.masterVelocity.toFixed(2) + "×";
        audioSpeechVelocityValue.textContent =
            formatAudioVelocityPercent(
                audioSettings.speechVelocity,
                AUDIO_SPEECH_VELOCITY_MAX
            );
        audioToneVelocityValue.textContent =
            formatAudioVelocityPercent(
                audioSettings.toneVelocity,
                AUDIO_TONE_VELOCITY_MAX
            );

        for (
            const input of
            document.querySelectorAll(
                "#audioSettingsDialog [data-audio-master], #audioAnnouncementsDialog [data-audio-master]"
            )
        ) {
            input.checked =
                audioSettings.masters[
                    input.dataset.audioMaster
                ] !== false;
        }

        for (
            const input of
            audioAnnouncementEventList
                ?.querySelectorAll(
                    "[data-audio-announcement-enabled]"
                ) ||
            []
        ) {
            input.checked =
                audioSettings.rows[
                    input.dataset
                        .audioAnnouncementEnabled
                ]?.enabled !== false;
        }

        for (
            const row of
            document.querySelectorAll(
                "#audioSettingsDialog [data-audio-announcement], #audioAnnouncementsDialog [data-audio-announcement]"
            )
        ) {
            const key =
                row.dataset.audioAnnouncement;
            const state =
                row ===
                    audioAnnouncementMobileAttributeRow &&
                audioAnnouncementDraft?.announcement ===
                    key
                    ? audioAnnouncementDraft.row
                    : audioSettings.rows[key];
            if (!state) continue;

            const rowMaster =
                row.querySelector(
                    "[data-audio-row-master]"
                );

            if (rowMaster) {
                rowMaster.checked =
                    state.enabled !== false;
            }

            for (const input of row.querySelectorAll("[data-audio-layer]")) {
                const layer =
                    input.dataset.audioLayer;
                input.checked =
                    state[layer] !== -1;
                const supportedLayers =
                    announcementDefinition(
                        key
                    )?.layers;

                input.disabled =
                    state.enabled === false ||
                    (
                        audioSettings.masters[
                            layer
                        ] === false &&
                        !announcementOverridesMaster(
                            key,
                            layer
                        )
                    ) ||
                    (
                        Array.isArray(
                            supportedLayers
                        ) &&
                        !supportedLayers.includes(
                            layer
                        )
                    );
            }
        }

        const selectedAnnouncement =
            selectedAudioAnnouncement();
        const selectedState =
            selectedAudioAnnouncementState();

        for (
            const control of
            audioAnnouncementMobileOverrides
                ?.querySelectorAll(
                    "[data-audio-custom-setting]"
                ) ||
            []
        ) {
            const property =
                control.dataset
                    .audioCustomSetting;
            const enabled =
                control.querySelector(
                    "[data-audio-custom-enabled]"
                );
            const slider =
                control.querySelector(
                    "[data-audio-custom-value]"
                );
            const output =
                control.querySelector(
                    "[data-audio-custom-output]"
                );

            if (
                !property ||
                !enabled ||
                !slider ||
                !output
            ) {
                continue;
            }

            const hasCustom =
                Boolean(
                    selectedState?.custom &&
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            selectedState.custom,
                            property
                        )
                );

            const value =
                hasCustom
                    ? selectedState
                        .custom[property]
                    : audioSettings[
                        property
                    ];

            enabled.checked =
                hasCustom;
            slider.disabled =
                !hasCustom;
            slider.value =
                String(value);

            const prefix =
                hasCustom
                    ? ""
                    : "Global ";

            output.textContent =
                property.endsWith(
                    "Volume"
                )
                    ? prefix +
                        Math.round(
                            Number(value) *
                                100
                        ) +
                        "%"
                    : property ===
                        "speechVelocity"
                        ? prefix +
                            formatAudioVelocityPercent(
                                value,
                                AUDIO_SPEECH_VELOCITY_MAX
                            )
                        : property ===
                            "toneVelocity"
                            ? prefix +
                                formatAudioVelocityPercent(
                                    value,
                                    AUDIO_TONE_VELOCITY_MAX
                                )
                            : prefix +
                                String(value);
        }
    }

    function shiftMasterVelocity(value) {
        const next =
            Math.max(
                0.5,
                Math.min(
                    4,
                    Number(value)
                )
            );

        if (!Number.isFinite(next)) return;

        const delta =
            next -
            audioSettings.masterVelocity;

        audioSettings.masterVelocity =
            next;
        audioSettings.speechVelocity =
            Math.max(
                AUDIO_SPEECH_VELOCITY_MIN,
                Math.min(
                    AUDIO_SPEECH_VELOCITY_MAX,
                    audioSettings.speechVelocity +
                        delta
                )
            );
        audioSettings.toneVelocity =
            Math.max(
                0.5,
                Math.min(
                    1.5,
                    audioSettings.toneVelocity +
                        delta
                )
            );
    }

    buildAudioAnnouncementRows();
    bindAudioSettingsBoundary();
    refreshAudioSettingsBoundary();
    void populateAudioVoiceOptions();
    void populateAudioInstrumentOptions();
    renderAudioSettings();
    applyAudioOutputSettings();

    audioSettingsDialog?.addEventListener(
        "opening",
        () => {
            refreshAudioSettingsBoundary();
            void populateAudioVoiceOptions();
            void populateAudioInstrumentOptions();
            renderAudioSettings();
        }
    );

    audioAnnouncementsDialog?.addEventListener(
        "opening",
        () => {
            refreshAudioSettingsBoundary();
            discardAudioAnnouncementDraft();

            audioAnnouncementPage
                ?.reset?.();
            audioAnnouncementMobileAttributeRow
                ?.removeAttribute(
                    "data-audio-announcement"
                );
            if (audioAnnouncementMobileAttributeRow) {
                audioAnnouncementMobileAttributeRow.hidden =
                    true;
            }
            if (audioAnnouncementMobileOverrides) {
                audioAnnouncementMobileOverrides.hidden =
                    true;
            }

            renderAudioSettings();
        }
    );

    function openAudioAnnouncementsEditor(
        selection,
        source
    ) {
        const caller =
            audioSettingsDialog?.open
                ? {
                    type: "dialog",
                    element:
                        audioSettingsDialog
                }
                : undefined;

        if (caller) {
            pushUIReturnFrame(
                caller
            );
        }

        const opened =
            openDialogElement(
                audioAnnouncementsDialog,
                {
                    reason:
                        "audio-announcements"
                }
            );

        if (
            !opened &&
            caller
        ) {
            popUIReturnFrame(
                caller
            );

            return false;
        }

        if (
            opened &&
            selection
        ) {
            requestAnimationFrame(
                () =>
                    showAudioAnnouncementMobileDetail(
                        selection,
                        source
                    )
            );
        }

        return opened;
    }

    audioAnnouncementsOpen
        ?.addEventListener(
            "click",
            event => {
                openAudioAnnouncementsEditor(
                    undefined,
                    event.currentTarget
                );
            }
        );

    audioAnnouncementRows
        ?.addEventListener(
            "click",
            event => {
                const detailButton =
                    event.target
                        ?.closest?.(
                            "[data-audio-announcement-desktop-detail]"
                        );

                if (!detailButton) {
                    return;
                }

                openAudioAnnouncementsEditor(
                    detailButton.dataset
                        .audioAnnouncementDesktopDetail,
                    detailButton
                );
            }
        );

    audioAnnouncementEventList
        ?.addEventListener(
            "click",
            event => {
                const choice =
                    event.target
                        ?.closest?.(
                            "[data-audio-announcement-select]"
                        );

                if (!choice) {
                    return;
                }

                showAudioAnnouncementMobileDetail(
                    choice.dataset
                        .audioAnnouncementSelect,
                    choice
                );
            }
        );

    audioAnnouncementBack
        ?.addEventListener(
            "click",
            () => {
                discardAudioAnnouncementDraft();
                renderAudioSettings();

                void audioAnnouncementPage
                    ?.back?.();
            }
        );

    audioAnnouncementPreview
        ?.addEventListener(
            "click",
            async () => {
                const announcement =
                    selectedAudioAnnouncement();
                const row =
                    selectedAudioAnnouncementState();
                const audio =
                    globalThis.WMOFAudio;

                if (
                    !announcement ||
                    !row ||
                    !audio
                ) {
                    return;
                }

                const label =
                    AUDIO_ANNOUNCEMENTS
                        .find(
                            ([key]) =>
                                key ===
                                announcement
                        )?.[1] ||
                    "Announcement";
                const output =
                    audioAnnouncementOutput(
                        announcement,
                        row
                    );
                const chimeEnabled =
                    row.enabled !== false &&
                    row.chime !== -1 &&
                    audioSettings.masters.chime !==
                        false;
                const speechEnabled =
                    row.enabled !== false &&
                    row.summary !== -1 &&
                    audioSettings.masters.summary !==
                        false;

                let chimePlayed =
                    false;

                if (chimeEnabled) {
                    try {
                        const song =
                            await audio.startSong?.(
                                announcementSongName(
                                    announcement
                                ),
                                {
                                    bpm: 180,
                                    includeTones: true,
                                    includeSpeech: false,
                                    toneVolume:
                                        output.toneVolume,
                                    toneVelocity:
                                        output.toneVelocity,
                                    speechVolume:
                                        output.speechVolume,
                                    speechVelocity:
                                        output.speechVelocity
                                }
                            );

                        chimePlayed =
                            Boolean(
                                song?.hasChime
                            );

                        if (
                            speechEnabled &&
                            chimePlayed
                        ) {
                            const speechStartDelayMs =
                                Math.max(
                                    0,
                                    Number(
                                        song
                                            ?.chimeEndsInMs
                                    ) ||
                                    0
                                ) +
                                Math.max(
                                    0,
                                    output.speechDelayMs
                                );

                            setTimeout(
                                () =>
                                    audio.speak?.(
                                        label,
                                        {
                                            speechVolume:
                                                output.speechVolume,
                                            speechVelocity:
                                                output.speechVelocity
                                        }
                                    ),
                                speechStartDelayMs
                            );
                        }
                    }
                    catch (error) {
                        console.warn(
                            "Announcement has no preview chime:",
                            announcement,
                            error
                        );
                    }
                }

                if (
                    speechEnabled &&
                    !chimePlayed
                ) {
                    audio.speak?.(
                        label,
                        {
                            speechVolume:
                                output.speechVolume,
                            speechVelocity:
                                output.speechVelocity
                        }
                    );
                }
            }
        );

    audioAnnouncementApplyCustom
        ?.addEventListener(
            "click",
            () => {
                const draft =
                    audioAnnouncementDraft;

                if (!draft) {
                    return;
                }

                audioSettings.rows[
                    draft.announcement
                ] =
                    cloneAudioAnnouncementRow(
                        draft.row
                    );

                saveAudioSettings();
                beginAudioAnnouncementDraft(
                    draft.announcement
                );
                renderAudioSettings();
            }
        );

    audioAnnouncementResetCustom
        ?.addEventListener(
            "click",
            () => {
                const state =
                    selectedAudioAnnouncementState();

                if (!state) {
                    return;
                }

                delete state.custom;
                renderAudioSettings();
            }
        );

    audioAnnouncementCancelCustom
        ?.addEventListener(
            "click",
            () => {
                const announcement =
                    selectedAudioAnnouncement();

                if (!announcement) {
                    return;
                }

                beginAudioAnnouncementDraft(
                    announcement
                );
                renderAudioSettings();
            }
        );

    const handleAudioSettingsInput =
        event => {
            const target =
                event.target;

            if (
                target ===
                    audioInstrument ||
                target ===
                    audioVoice
            ) {
                return;
            }

            const customControl =
                target.closest?.(
                    "[data-audio-custom-setting]"
                );

            if (customControl) {
                const announcement =
                    audioAnnouncementMobileAttributeRow
                        ?.dataset
                        .audioAnnouncement;
                const state =
                    audioAnnouncementDraft?.announcement ===
                        announcement
                        ? audioAnnouncementDraft.row
                        : undefined;
                const property =
                    customControl.dataset
                        .audioCustomSetting;
                const enabled =
                    customControl.querySelector(
                        "[data-audio-custom-enabled]"
                    );
                const slider =
                    customControl.querySelector(
                        "[data-audio-custom-value]"
                    );

                if (
                    !state ||
                    !property ||
                    !enabled ||
                    !slider
                ) {
                    return;
                }

                if (
                    target.matches?.(
                        "[data-audio-custom-enabled]"
                    )
                ) {
                    if (target.checked) {
                        state.custom ||=
                            {};
                        state.custom[property] =
                            Number(
                                slider.value ||
                                audioSettings[
                                    property
                                ]
                            );
                    }
                    else if (state.custom) {
                        delete state
                            .custom[
                                property
                            ];

                        if (
                            !Object.keys(
                                state.custom
                            ).length
                        ) {
                            delete state.custom;
                        }
                    }
                }
                else if (
                    target.matches?.(
                        "[data-audio-custom-value]"
                    )
                ) {
                    if (!enabled.checked) {
                        return;
                    }

                    state.custom ||=
                        {};
                    state.custom[property] =
                        Number(
                            target.value
                        );
                }

                renderAudioSettings();
                return;
            }

            if (target === audioSpeechVolume) {
                audioSettings.speechVolume =
                    Number(target.value);
            }
            else if (target === audioToneVolume) {
                audioSettings.toneVolume =
                    Number(target.value);
            }
            else if (target === audioMasterVelocity) {
                shiftMasterVelocity(
                    target.value
                );
            }
            else if (target === audioSpeechVelocity) {
                audioSettings.speechVelocity =
                    Number(target.value);
            }
            else if (target === audioToneVelocity) {
                audioSettings.toneVelocity =
                    Number(target.value);
            }
            else if (target === audioFormalTime) {
                audioSettings.formalTime =
                    target.checked;
            }
            else if (target.matches?.("[data-audio-master]")) {
                audioSettings.masters[
                    target.dataset.audioMaster
                ] =
                    target.checked;
            }
            else if (
                target.matches?.(
                    "[data-audio-announcement-enabled]"
                )
            ) {
                const state =
                    audioSettings.rows[
                        target.dataset
                            .audioAnnouncementEnabled
                    ];

                if (state) {
                    state.enabled =
                        target.checked;
                }
            }
            else {
                const row =
                    target.closest?.(
                        "[data-audio-announcement]"
                    );
                const rowAnnouncement =
                    row?.dataset
                        .audioAnnouncement;
                const isDraftRow =
                    row ===
                        audioAnnouncementMobileAttributeRow &&
                    audioAnnouncementDraft?.announcement ===
                        rowAnnouncement;
                const state =
                    isDraftRow
                        ? audioAnnouncementDraft.row
                        : audioSettings.rows[
                            rowAnnouncement
                        ];

                if (
                    state &&
                    target.matches?.(
                        "[data-audio-row-master]"
                    )
                ) {
                    state.enabled =
                        target.checked;
                }
                else if (
                    state &&
                    target.matches?.(
                        "[data-audio-layer]"
                    )
                ) {
                    // Only this table toggles persistent user-disabled state.
                    state[
                        target.dataset.audioLayer
                    ] =
                        target.checked
                            ? 0
                            : -1;
                }
            }

            renderAudioSettings();
            applyAudioOutputSettings();

            const selectedDraftRow =
                target.closest?.(
                    "#audioAnnouncementMobileAttributeRow"
                );

            if (!selectedDraftRow) {
                saveAudioSettings();
            }
        };

    audioSettingsForm
        ?.addEventListener(
            "input",
            handleAudioSettingsInput
        );

    audioAnnouncementsForm
        ?.addEventListener(
            "input",
            handleAudioSettingsInput
        );

    audioVoice
        ?.addEventListener(
            "change",
            () => {
                const selection =
                    decodeAudioVoiceSelection(
                        audioVoice.value
                    );

                audioSettings.voices[
                    AUDIO_LANGUAGE
                ] = selection;

                saveAudioSettings();
                applyAudioOutputSettings();
            }
        );

    globalThis
        .WMOFVoiceCatalog
        ?.onChanged?.(
            () =>
                void populateAudioVoiceOptions()
        );

    audioInstrument
        ?.addEventListener(
            "change",
            () => {
                audioSettings.instrument =
                    audioInstrument.value;

                saveAudioSettings();

                audioInstrument.disabled =
                    true;

                requestAnimationFrame(
                    () =>
                        globalThis.location
                            ?.reload?.()
                );
            }
        );

    audioSettingsReset?.addEventListener(
        "click",
        () => {
            audioSettings =
                defaultAudioSettings();
            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();
        }
    );

    audioSettingsForm?.addEventListener(
        "submit",
        saveAudioSettings
    );

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
        if (button === toggleSyncGoalButton) return;
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

    function totalScopeLabel() {
        switch (getTripLogRange()) {
            case "day":
                return "Day";
            case "week":
                return "Week";
            case "pay-period":
                return "Check";
            case "month":
                return "Month";
            case "year":
                return "Year";
            case "custom":
            default:
                return "Total";
        }
    }

    function userFacingTotalText(value) {
        const text =
            String(value ?? "");
        const label =
            totalScopeLabel();

        return label === "Total"
            ? text
            : text.replace(
                /\bTotal\b/g,
                label
            );
    }

    function setTripLogRange(
        value,
        {
            persist = true,
            notify = true
        } = {}
    ) {
        const previousRange =
            getTripLogRange();
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

        if (
            notify &&
            range !== previousRange
        ) {
            void confirmInformationalChange(
                "range-change",
                "Viewing " +
                    totalScopeLabel()
            );
        }

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
        syncScopeUI();
        renderClockTimerUIState(
            clockTimer.uiState
        );
        refreshAutoGoalDialog();
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
        const appRect = app.getBoundingClientRect();
        const style = getComputedStyle(app);
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const height = tripLogButton?.offsetHeight || 74;
        const visualViewport =
            globalThis.visualViewport;
        const viewportLeft =
            visualViewport?.offsetLeft ??
            0;
        const viewportTop =
            visualViewport?.offsetTop ??
            0;
        const viewportRight =
            viewportLeft +
            (
                visualViewport?.width ??
                globalThis.innerWidth
            );
        const viewportBottom =
            viewportTop +
            (
                visualViewport?.height ??
                globalThis.innerHeight
            );
        const left =
            Math.max(
                appRect.left +
                    paddingLeft,
                viewportLeft
            );
        const right =
            Math.min(
                appRect.right -
                    paddingRight,
                viewportRight
            );
        const top =
            Math.max(
                appRect.top +
                    paddingTop,
                viewportTop
            );
        const bottom =
            Math.min(
                appRect.bottom -
                    paddingBottom,
                viewportBottom
            );
        const rect = {
            left,
            top,
            right,
            bottom,
            width:
                Math.max(
                    0,
                    right - left
                ),
            height:
                Math.max(
                    0,
                    bottom - top
                )
        };

        return {
            rect,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            height,
            left,
            width: rect.width
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

    function getSpeechMicTop() {
        const metrics =
            getAppContentMetrics();

        const appStyle =
            getComputedStyle(
                app
            );
        const micRowHeight =
            Number.parseFloat(
                appStyle.getPropertyValue(
                    "--speech-mic-row-height"
                )
            ) ||
            0;

        const fallbackMicTop =
            metrics.rect.bottom -
            metrics.paddingBottom -
            micRowHeight;

        const hostTop =
            Number(
                speechMicBar
                    ?.getBoundingClientRect?.()
                    ?.top
            );

        const micTop =
            Number.isFinite(
                hostTop
            )
                ? hostTop
                : fallbackMicTop;

        const safeTop =
            Number(
                speechMicBar
                    ?.getSafeTop?.()
            );

        const speechTop =
            Number.isFinite(
                safeTop
            )
                ? safeTop
                : micTop;

        return Math.max(
            metrics.rect.top,
            speechTop
        );
    }

    function getTripLogBottomRect() {
        const metrics =
            getAppContentMetrics();

        return {
            left: metrics.left,
            top:
                getSpeechMicTop() -
                metrics.height,
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
            getSpeechMicTop();

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

    function refreshTripLogBoundaryLayout() {
        if (
            !tripLogBody ||
            tripLogBody.hidden ||
            app.dataset
                .tripListState !==
                "open"
        ) {
            return false;
        }

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
        positionTripLogCloseButton(
            topRect
        );

        return true;
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

    speechMicBar
        ?.addEventListener(
            "speech-surface-boundary-change",
            refreshTripLogBoundaryLayout
        );

    globalThis.addEventListener(
        "resize",
        refreshTripLogBoundaryLayout,
        {
            passive: true
        }
    );

    globalThis.visualViewport
        ?.addEventListener(
            "resize",
            refreshTripLogBoundaryLayout,
            {
                passive: true
            }
        );

    globalThis.visualViewport
        ?.addEventListener(
            "scroll",
            refreshTripLogBoundaryLayout,
            {
                passive: true
            }
        );

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
    let tripLogLiveProjectionMilliseconds;

    function tripLogLiveEffectiveMilliseconds(
        summary =
            clockTimer.getSummarySnapshot?.(
                new Date()
            )
    ) {
        const trip =
            summary?.trip;

        if (
            !tripIsLive() ||
            !trip?.available
        ) {
            return undefined;
        }

        const counted =
            trip.countedTimeElapsedMilliseconds;

        const allotted =
            trip.allottedTimeMilliseconds;

        if (
            !Number.isSafeInteger(counted) ||
            counted < 0
        ) {
            return undefined;
        }

        return (
            Number.isSafeInteger(allotted) &&
            allotted >= 0
        )
            ? Math.max(
                allotted,
                counted
            )
            : counted;
    }

    function refreshTripLogLiveProjection(
        summary,
        {
            force = false
        } = {}
    ) {
        const next =
            tripLogLiveEffectiveMilliseconds(
                summary
            );

        const changed =
            next !==
                tripLogLiveProjectionMilliseconds;

        tripLogLiveProjectionMilliseconds =
            next;

        if (
            tripLogView &&
            (
                force ||
                changed
            )
        ) {
            tripLogView.rerender();
        }

        return changed;
    }

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
            numberPad:options=>openValueEditor(options,"touch"),
            request:async (id,change)=>{
                const result=await clockTimer.tripEditorRequest(id,change);
                if(change){
                    if (
                        endTimeGoalOverride &&
                        String(id) === String(clockTimer.currentTripId)
                    ) {
                        recalculateEndTimeGoalOverride();
                    }
                    renderTripActionState();
                    renderSyncGoalsState();
                    updateSummaryValues();
                }
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
                    allottedTimeMilliseconds:summary.allottedTimeMilliseconds,
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

        const anchorBottom =
            target.top +
            fullHeight;

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

                        const linear =
                            elapsed /
                            fullDuration;

                        const progress =
                            linear < .5
                                ? 2 *
                                    linear *
                                    linear
                                : 1 -
                                    Math.pow(
                                        -2 *
                                            linear +
                                            2,
                                        2
                                    ) /
                                    2;

                        const visible =
                            opening
                                ? progress
                                : 1 -
                                    progress;

                        const height =
                            fullHeight *
                            visible;

                        setFloatingTripLogBodyRect({
                            left:
                                target.left,
                            top:
                                anchorBottom -
                                height,
                            width:
                                fullWidth,
                            height
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
            const sourceRect = tripLogButton.getBoundingClientRect();
            setFloatingTripLogRect(sourceRect);
            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${topRect.top - sourceRect.top}px)`
            );
        }
        else {
            setFloatingTripLogRect(topRect);
            const distance = topRect.top + topRect.height + 8;
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
            left:
                bodyRect.left,
            top:
                bodyRect.top +
                bodyRect.height,
            width:
                bodyRect.width,
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
            const destination = getTripLogBottomRect();
            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${destination.top - topRect.top}px)`,
                TRIP_LIST_BUTTON_TRANSITION_DURATION
            );
            setFloatingTripLogRect(destination);
        }
        else {
            const distance = topRect.top + topRect.height + 8;
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


    function syncGoalRequirements() {
        try {
            const requirements =
                clockTimer
                    .calculateTotalGoalRequirements
                    ?.();

            return (
                requirements &&
                typeof requirements ===
                    "object"
            )
                ? requirements
                : undefined;
        }
        catch {
            return undefined;
        }
    }

    function getSyncRuntimeState() {
        if (
            normalizedConnectionStatus() ===
                "offline"
        ) {
            return "offline";
        }

        if (!getSyncGoalsState()) {
            return "off";
        }

        if (!tripIsLive()) {
            return "ready";
        }

        const requirements =
            syncGoalRequirements();

        return (
            Number.isFinite(
                Number(
                    requirements?.tripGoal
                )
            ) &&
            Number(
                requirements?.tripGoal
            ) > 0 &&
            Number.isFinite(
                Number(
                    requirements
                        ?.adjustedTimeElapsed
                )
            ) &&
            Number(
                requirements
                    ?.adjustedTimeElapsed
            ) > 0
        )
            ? "active"
            : "time-blocked";
    }

    function currentCalculatedSyncGoal() {
        const requirements =
            syncGoalRequirements();

        const requiredGoal =
            Number(
                requirements?.tripGoal
            );

        if (
            Number.isFinite(
                requiredGoal
            ) &&
            requiredGoal > 0
        ) {
            return requiredGoal;
        }

        const calculatedGoal =
            Number(
                clockTimer
                    .calculatedTripGoal
            );

        return (
            Number.isFinite(
                calculatedGoal
            ) &&
            calculatedGoal > 0
        )
            ? calculatedGoal
            : undefined;
    }

    function syncGoalMatches(
        left,
        right
    ) {
        return (
            Number.isFinite(left) &&
            Number.isFinite(right) &&
            Math.abs(left - right) <
                1e-9
        );
    }

    function setSyncAnnouncementBaseline(
        state =
            getSyncRuntimeState()
    ) {
        syncAnnouncementState =
            state;

        syncAnnouncementGoal =
            state === "active"
                ? currentCalculatedSyncGoal()
                : undefined;

        return state;
    }

    function announceCalculatedSyncGoal(
        {
            force = false
        } = {}
    ) {
        const goal =
            currentCalculatedSyncGoal();

        if (
            !Number.isFinite(goal) ||
            goal <= 0
        ) {
            return false;
        }

        if (
            !force &&
            syncGoalMatches(
                syncAnnouncementGoal,
                goal
            )
        ) {
            return false;
        }

        syncAnnouncementGoal =
            goal;

        return confirmInformationalChange(
            "sync-goal",
            "Sync Goal " +
                formatSummaryPercent(
                    goal
                )
        );
    }

    function announceSyncRuntimeState(
        {
            force = false,
            preferCalculatedGoal =
                false,
            forceCalculatedGoal =
                false
        } = {}
    ) {
        const state =
            getSyncRuntimeState();

        const previous =
            syncAnnouncementState;

        const changed =
            previous !== state;

        syncAnnouncementState =
            state;

        if (state !== "active") {
            syncAnnouncementGoal =
                undefined;
        }

        if (
            !force &&
            !changed &&
            !(
                state === "active" &&
                preferCalculatedGoal
            )
        ) {
            return false;
        }

        if (state === "offline") {
            if (!getSyncGoalsState()) {
                return false;
            }

            return confirmInformationalChange(
                "sync-state",
                "Cannot sync offline"
            );
        }

        if (state === "off") {
            return confirmInformationalChange(
                "sync-state",
                "Sync Off"
            );
        }

        if (
            state ===
                "time-blocked"
        ) {
            return confirmInformationalChange(
                "sync-state",
                "Not enough time to sync"
            );
        }

        if (state === "active") {
            if (
                preferCalculatedGoal ||
                previous ===
                    "time-blocked"
            ) {
                return announceCalculatedSyncGoal({
                    force:
                        forceCalculatedGoal
                });
            }

            if (force || changed) {
                return confirmInformationalChange(
                    "sync-state",
                    "Sync On"
                );
            }

            return false;
        }

        if (
            state === "ready" &&
            (force || changed)
        ) {
            return confirmInformationalChange(
                "sync-state",
                "Sync On"
            );
        }

        return false;
    }

    function renderSyncGoalsState(
        renderedScope = getRenderedGoalScope()
    ) {
        const state=renderedScope&&typeof renderedScope==="object"?renderedScope:clockTimer.uiState;
        if(renderedScope&&typeof renderedScope==="object")renderedScope=state.effective_goal_type;
        const enabled =
            getSyncGoalsState();

        const runtimeState =
            getSyncRuntimeState();

        const idle =
            runtimeState ===
                "ready";

        for (const element of [toggleSyncGoalButton, syncGoalsMenuIcon]) {
            if (!element) continue;
            ensureSyncOfflineOverlay(element);
            element.dataset.syncRuntimeState =
                runtimeState;
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
                    toggleSyncMenuButton,
                    toggleSyncGoalButton
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

        if (toggleSyncGoalButton) {
            const calculable =
                runtimeState ===
                    "active";
            ensureSyncOfflineOverlay(toggleSyncGoalButton);
            toggleSyncGoalButton.classList.toggle("sync-calculable",calculable);
            toggleSyncGoalButton.hidden =
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

        if (
            enabled &&
            endTimeGoalOverride
        ) {
            endTimeGoalOverride =
                undefined;

            renderEndTimeGoalLock();
        }

        syncPreferenceChangeInProgress =
            true;

        try {
            clockTimer.configure({
                auto_goal: enabled
            });
        }
        finally {
            syncPreferenceChangeInProgress =
                false;
        }

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
        setSyncAnnouncementBaseline();
        queueSummaryRefresh();

        return enabled;
    }

    // sync-offline-icon-state-v1
    function getSyncVisualElements() {
        return [
            syncGoalsMenuIcon,
            toggleSyncGoalButton
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

        let offlineCloud =
            overlay.querySelector(
                ":scope > .sync-offline-cloud"
            );

        if (!offlineCloud) {
            offlineCloud =
                document.createElement("span");
            offlineCloud.className =
                "sync-offline-cloud";
            overlay.append(offlineCloud);
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
                    toggleSyncGoalButton
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

        const legacyClockFont =
            typeof source.clockFont === "string"
                ? source.clockFont
                : (
                    typeof source.timeFont === "string" &&
                    source.timeFont !==
                        GRAPHICAL_DEFAULTS.clockFont
                        ? source.timeFont
                        : typeof source.hourFont === "string"
                            ? source.hourFont
                            : typeof source.timeFont === "string"
                                ? source.timeFont
                                : undefined
                );

        for (
            const [key, fallback] of
                Object.entries(GRAPHICAL_DEFAULTS)
        ) {
            const candidate =
                key === "clockFont" &&
                legacyClockFont !== undefined
                    ? legacyClockFont
                    : Object.prototype.hasOwnProperty.call(
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

    function syncConnectionUI(connected) {
        speechTrainingConnectionAvailable =
            Boolean(connected);
        profileMenuButton.hidden = !connected;
        const permissions =
            Number(
                signedInProfile?.permissions
            ) || 0;

        const canCreateUsers =
            connected &&
            Boolean(
                permissions &
                (
                    1 |
                    PERMISSION_SUPERUSER
                )
            );

        const canManageTokens =
            connected &&
            Boolean(
                permissions &
                ACCESS_TOKEN_PERMISSION_MASK
            );

        const canUseDeveloperTools =
            connected &&
            Boolean(
                permissions &
                DEVELOPER_MENU_PERMISSION_MASK
            );

        const canUseSpeechEditor =
            canUseDeveloperTools &&
            Boolean(
                permissions &
                SPEECH_EDITOR_PERMISSION_MASK
            );

        const canViewLiveStreams =
            connected &&
            Boolean(
                permissions &
                (
                    PERMISSION_VIEW_LIVE_STREAMS |
                    PERMISSION_SUPERUSER
                )
            );

        const canLookupUsers =
            connected &&
            Boolean(
                permissions &
                (
                    PERMISSION_LOOKUP_USERS |
                    PERMISSION_SUPERUSER
                )
            );

        const showAdmin =
            canCreateUsers ||
            canManageTokens ||
            canLookupUsers;

        $("#adminMenuGroup").hidden =
            !showAdmin;

        $("#newUserButton").hidden =
            !canCreateUsers;

        $("#accessTokensButton").hidden =
            !canManageTokens;

        $("#liveStreamButton").hidden =
            !(
                canViewLiveStreams &&
                canLookupUsers
            );

        $("#liveStreamViewerSection").hidden =
            !canViewLiveStreams;

        $("#speechToolsGroup").hidden =
            false;

        $("#speechTrainingButton").hidden =
            false;

        $("#speechEditorButton").hidden =
            !canUseSpeechEditor;

        $("#speechTimingButton").hidden =
            !canUseDeveloperTools;

        $("#developerDocsButton").hidden =
            !canUseDeveloperTools;

        $("#sqlConsoleButton").hidden =
            !canUseDeveloperTools;

        if (!showAdmin) {
            $("#adminSubmenu").hidden =
                true;

            $("#adminMenuButton")
                .setAttribute(
                    "aria-expanded",
                    "false"
                );
        }

        if (!canUseDeveloperTools) {
            $("#speechEditorButton").hidden =
                true;
            $("#speechTimingButton").hidden =
                true;
            $("#developerDocsButton").hidden =
                true;
            $("#sqlConsoleButton").hidden =
                true;
        }
        authButton.textContent = connected ? "Logout" : "Login";
        authButton.classList.toggle("logout-button", connected);

        if (connected) {
            menuLogoutSlot?.append(authButton);
        } else {
            menuAccountRow?.append(authButton);
        }

        syncSpeechTrainingControls();

        void syncAutomaticLivePublisher();
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
                animation: undefined,
                generation: 0,
                running: false,
                targetState: getState()
            };
            cloudIconTransitions.set(element, controller);
        }

        controller.targetState = nextState;

        if (!animate) {
            controller.generation += 1;
            controller.animation?.cancel();
            controller.animation = undefined;
            controller.running = false;
            element.style.transform = "";
            applyState(nextState);
            return;
        }

        if (controller.running || getState() === controller.targetState) {
            return;
        }

        controller.running = true;
        const generation =
            controller.generation;

        void (async () => {
            try {
                const halfDuration =
                    CONNECTION_UI_TRANSITION_DURATION /
                    2;

                while (
                    generation ===
                        controller.generation &&
                    getState() !==
                        controller.targetState
                ) {
                    controller.animation =
                        element.animate(
                            [
                                {
                                    transform:
                                        "rotateY(0deg)"
                                },
                                {
                                    transform:
                                        "rotateY(90deg)"
                                }
                            ],
                            {
                                duration:
                                    halfDuration,
                                easing:
                                    "linear",
                                fill:
                                    "forwards"
                            }
                        );

                    try {
                        await controller
                            .animation
                            .finished;
                    }
                    catch {
                        return;
                    }

                    if (
                        generation !==
                        controller.generation
                    ) {
                        return;
                    }

                    /*
                     * The face is invisible at 90 degrees. Apply the
                     * newest requested state here, so rapid state
                     * changes retarget the same flip instead of
                     * cancelling/restarting it and causing a jerk.
                     */
                    applyState(
                        controller
                            .targetState
                    );

                    element.style.transform =
                        "rotateY(-90deg)";

                    controller.animation
                        .cancel();

                    controller.animation =
                        element.animate(
                            [
                                {
                                    transform:
                                        "rotateY(-90deg)"
                                },
                                {
                                    transform:
                                        "rotateY(0deg)"
                                }
                            ],
                            {
                                duration:
                                    halfDuration,
                                easing:
                                    "linear",
                                fill:
                                    "forwards"
                            }
                        );

                    try {
                        await controller
                            .animation
                            .finished;
                    }
                    catch {
                        return;
                    }

                    if (
                        generation !==
                        controller.generation
                    ) {
                        return;
                    }

                    element.style.transform =
                        "";

                    controller.animation
                        .cancel();

                    controller.animation =
                        undefined;

                    /*
                     * If the requested state changed during the
                     * reveal half, loop through another complete
                     * hidden-midpoint flip. Never swap a visible
                     * face in place.
                     */
                }
            }
            finally {
                if (
                    generation ===
                    controller.generation
                ) {
                    controller.running =
                        false;
                    element.style.transform =
                        "";
                    controller.animation
                        ?.cancel();
                    controller.animation =
                        undefined;

                    if (
                        getState() !==
                        controller.targetState
                    ) {
                        setCloudIconVisualState(
                            element,
                            getState,
                            applyState,
                            controller
                                .targetState,
                            {
                                animate: true
                            }
                        );
                    }
                }
            }
        })();
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

    function setOkAllowed(
        context,
        allowed
    ) {
        if (!context) {
            return false;
        }

        const next =
            allowed === true;

        if (
            context.allowOk ===
                next
        ) {
            return next;
        }

        context.allowOk =
            next;

        emitUIEvent(
            context,
            "okStatusChanged",
            {
                okAllowed:
                    next
            }
        );

        return next;
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
        speechMicBar
            ?.promoteTopLayer?.();

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
        if (
            popover &&
            typeof popover.isOpen ===
                "boolean"
        ) {
            return popover.isOpen;
        }

        try {
            return Boolean(
                popover
                    ?.matches?.(
                        ":popover-open"
                    )
            );
        }
        catch {
            return false;
        }
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

    document.addEventListener(
        "toggle",
        event => {
            if (
                event.target !== speechMicBar &&
                event.newState === "open"
            ) {
                queueMicrotask(
                    () =>
                        speechMicBar
                            ?.promoteTopLayer?.()
                );
            }
        },
        true
    );

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
        const trigger = event.target.closest?.("[data-dialog], [popovertarget]");
        const sourcePopover = trigger?.closest?.("[popover]");
        if (sourcePopover && trigger !== $("#menuButton")) {
            sourcePopover.classList.add("popover-immediate-close");
        }
    }, true);

    loginDialog.addEventListener("opening", () => {
        loginDialogFullyOpen = false;
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

    loginDialog.addEventListener("closing", event => {
        if (!loginConfirmedThisLoad && !speechEditorPreview) {
            event.preventDefault();
            return;
        }
        loginDialogFullyOpen = false;
    });

    loginDialog.addEventListener("cancel", event => {
        if (!loginConfirmedThisLoad && !speechEditorPreview) {
            event.preventDefault();
        }
    });

    function showConnectionRetryLoginDialog() {
        clearTimeout(loginPromptTimeout);
        loginPromptTimeout = undefined;

        if (speechEditorPreview) {
            return false;
        }

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
        if (speechEditorPreview) return false;

        if (loginDialog.open) return;
        const opened = openDialogElement(loginDialog, {
            duration: CONNECTION_UI_TRANSITION_DURATION,
            reason: "initial-login"
        });
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
            if (!speechEditorPreview && !loginDialog.open) {
                showInitialLoginDialog();
            }
            return;
        }

        if (loginConfirmedThisLoad && loginDialog.open) {
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
                ? totalScopeLabel()
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

        const temporarilyVisible =
            endTimeGoalLockFlashTimer !== undefined;

        const hidden =
            !endTimeGoalOverride ||
            (
                !temporarilyVisible &&
                clockTimer.renderedTimeMode !==
                    "calculated-end"
            );

        const visibilityChanged =
            lock.hidden !== hidden;

        lock.hidden = hidden;
        lock.setAttribute(
            "aria-pressed",
            String(Boolean(endTimeGoalOverride))
        );

        if (!hidden && visibilityChanged) {
            requestAnimationFrame(
                alignStatusIcons
            );
        }
    }

    function endTimeGoalLockedForMode() {
        return Boolean(
            endTimeGoalOverride
        );
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
        if (!endTimeGoalOverride) return false;
        endTimeGoalOverride = undefined;
        clockTimer.configure({
            calculated_trip_goal: null,
            calculated_total_goal: null,
            calculated_goal_source: null
        });
        renderEndTimeGoalLock();
        queueSummaryRefresh();
        return true;
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

    function recalculateEndTimeGoalOverride() {
        const deadline =
            endTimeGoalOverride?.deadline;

        if (
            !(deadline instanceof Date) ||
            Number.isNaN(deadline.getTime()) ||
            deadline.getTime() <= Date.now() ||
            !tripIsLive()
        ) {
            return false;
        }

        const currentSummary =
            clockTimer.getSummarySnapshot?.(
                new Date()
            );

        const summary =
            clockTimer.getSummarySnapshot?.(
                deadline
            );

        const goals = {
            trip:
                goalForDeadline(
                    summary,
                    "trip",
                    currentSummary,
                    deadline
                ),
            total:
                goalForDeadline(
                    summary,
                    "total",
                    currentSummary,
                    deadline
                )
        };

        if (
            !Number.isFinite(goals.trip) ||
            goals.trip <= 0 ||
            !Number.isFinite(goals.total) ||
            goals.total <= 0
        ) {
            return false;
        }

        clockTimer.configure({
            auto_goal: false,
            calculated_trip_goal:
                percentGoalAttribute(
                    goals.trip
                ),
            calculated_total_goal:
                percentGoalAttribute(
                    goals.total
                ),
            calculated_goal_source:
                "end-time"
        });

        queueSummaryRefresh();

        return true;
    }

    function applyEndTimeGoalOverride(target) {
        const deadline =
            target instanceof Date
                ? new Date(target.getTime())
                : new Date(target);

        if (
            !tripIsLive() ||
            Number.isNaN(deadline.getTime()) ||
            deadline.getTime() <= Date.now()
        ) {
            return false;
        }

        endTimeGoalOverride = {
            deadline
        };

        if (!recalculateEndTimeGoalOverride()) {
            endTimeGoalOverride =
                undefined;

            return false;
        }

        applyRenderedTimeMode(
            "calculated-end"
        );

        renderEndTimeGoalLock();

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

    function formatActualPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? `${(numeric * 100).toFixed(2)}%`
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
        standardLabel.textContent =
            userFacingTotalText(
                state.standard_time_header_text
            );
        if (state.time_header_short_text) {
            const full = document.createElement("span");
            full.className = "summary-label-full";
            full.textContent =
                userFacingTotalText(
                    state.time_header_text
                );
            const short = document.createElement("span");
            short.className = "summary-label-short";
            short.textContent = state.time_header_short_text;
            renderedLabel.classList.add("summary-label-responsive");
            renderedLabel.replaceChildren(full, short);
        }
        else {
            renderedLabel.textContent =
                userFacingTotalText(
                    state.time_header_text
                );
        }
        $("#standardTimeValue").textContent = state.standard_time_component.text;
        $("#renderedTimeValue").textContent = state.time_component.text;
        $("#currentPercentValue").textContent = state.current_percent_component.text;
        $("#goalPercentValue").textContent = state.goal_component.text;
        $("#goalPercentValue").setAttribute(
            "aria-label",
            state.goal_type === "auto"
                ? "Choose Trip or " + totalScopeLabel() + " goal"
                : state.goal_type === "total"
                    ? "Edit " + totalScopeLabel() + " goal"
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
        const actions=document.createElement('div');actions.className='dialog-actions two-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent=(editing||capture)?'Cancel':'Close';cancel.addEventListener('click',()=>dialog.close());actions.append(cancel);if(editing||capture){const save=document.createElement('button');save.type='submit';save.className='primary-action';save.textContent='Save';actions.append(save);form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await globalThis.WMOFActions.saveDownDetails(tripId,intervalKey,{notes:notes.value,image:selectedImage,deleteImage});dialog.close();}catch(error){let alert=form.querySelector('[role=alert]');if(!alert){alert=document.createElement('p');alert.className='trip-log-error';alert.setAttribute('role','alert');body.append(alert);}alert.textContent=error.message;}finally{save.disabled=false;}});}form.append(actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{stopCamera();if(selectedImageUrl)URL.revokeObjectURL(selectedImageUrl);dialog.remove();},{once:true});dialog.showModal();
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
        target.toggleAttribute("hide-overtime", !Boolean(settings.showOvertime));
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
            "--clock-timer-overtime-color": settings.overtimeColor,
            "--clock-timer-latency-color": settings.latencyColor,
            "--clock-timer-hour-hand-length": settings.hourHandLength,
            "--clock-timer-hour-hand-color": settings.hourHandColor,
            "--clock-timer-minute-hand-length": settings.minuteHandLength,
            "--clock-timer-minute-hand-color": settings.minuteHandColor,
            "--clock-timer-second-hand-length": settings.secondHandLength,
            "--clock-timer-second-hand-color": settings.secondHandColor,
            "--clock-timer-hour-font": settings.clockFont,
            "--clock-timer-time-font": settings.clockFont,
            "--clock-timer-time-color": settings.timeColor,
            "--clock-timer-tick-color": settings.hourColor,
            "--clock-timer-border-color": settings.borderColor
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
            const overtimeColor = settings.overtimeColor || GRAPHICAL_DEFAULTS.overtimeColor;
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
            paletteRoot.style.setProperty("--timer-overtime-color", overtimeColor);
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
            overtimeColor: text("overtimeColor"),
            latencyColor: text("latencyColor"),
            showTolerance:
                getToleranceCheckboxValue(
                    form.elements.showTolerance
                ),
            showOvertime: form.elements.showOvertime.checked,
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
            hourHandColor: text("hourHandColor"),
            minuteHandLength: text("minuteHandLength"),
            minuteHandColor: text("minuteHandColor"),
            secondHandLength: text("secondHandLength"),
            secondHandColor: text("secondHandColor"),
            clockFont: text("clockFont"),
            hourColor: text("hourColor"),
            timeColor: text("timeColor"),
            borderColor: text("borderColor")
        };
    }

    const GENERIC_CLOCK_FONTS =
        new Set([
            "serif",
            "sans-serif",
            "monospace",
            "cursive",
            "fantasy",
            "system-ui",
            "ui-serif",
            "ui-sans-serif",
            "ui-monospace",
            "ui-rounded"
        ]);

    function splitClockFontList(value) {
        return String(value || "")
            .split(",")
            .map(font =>
                font.trim()
                    .replace(/^(['"])(.*)\1$/, "$2")
                    .trim()
            )
            .filter(Boolean);
    }

    function serializeClockFontList(fonts) {
        return fonts
            .map(font => String(font || "").trim())
            .filter(Boolean)
            .join(", ");
    }

    function clockFontCanRender(font) {
        const normalized =
            String(font || "")
                .trim();

        if (!normalized) return false;

        if (
            GENERIC_CLOCK_FONTS.has(
                normalized.toLowerCase()
            )
        ) {
            return true;
        }

        if (!document.fonts?.check) {
            return true;
        }

        const escaped =
            normalized.replace(
                /[\\"]/g,
                "\\$&"
            );

        try {
            return document.fonts.check(
                `16px "${escaped}"`
            );
        }
        catch {
            return false;
        }
    }

    function getFirstRenderableClockFont(fonts) {
        return (
            fonts.find(
                clockFontCanRender
            ) ||
            fonts[0] ||
            "sans-serif"
        );
    }

    function syncClockFontPicker(form) {
        const picker =
            form?.querySelector(
                "[data-clock-font-picker]"
            );

        const control =
            form?.elements?.clockFont;

        if (!picker || !control) return;

        const fonts =
            splitClockFontList(
                control.value
            );

        const normalizedFonts =
            fonts.length > 0
                ? fonts
                : ["sans-serif"];

        if (fonts.length === 0) {
            control.value =
                serializeClockFontList(
                    normalizedFonts
                );
        }

        const active =
            getFirstRenderableClockFont(
                normalizedFonts
            );

        const activeText =
            picker.querySelector(
                "[data-clock-font-active]"
            );

        if (activeText) {
            activeText.textContent =
                active;
            activeText.style.fontFamily =
                serializeClockFontList([
                    active,
                    "sans-serif"
                ]);
        }

        const list =
            picker.querySelector(
                "[data-clock-font-options]"
            );

        if (!list) return;

        list.replaceChildren();

        for (
            const [index, font] of
                normalizedFonts.entries()
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "clock-font-option";

            if (font === active) {
                row.dataset.activeFont =
                    "true";
            }

            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "clock-font-option-name";

            name.textContent =
                font;

            name.style.fontFamily =
                serializeClockFontList([
                    font,
                    "sans-serif"
                ]);

            const available =
                document.createElement(
                    "span"
                );

            available.className =
                "clock-font-option-state";

            available.textContent =
                font === active
                    ? "Active"
                    : clockFontCanRender(font)
                        ? "Available"
                        : "Unavailable";

            const remove =
                document.createElement(
                    "button"
                );

            remove.type =
                "button";

            remove.className =
                "clock-font-remove";

            remove.dataset.fontIndex =
                String(index);

            remove.setAttribute(
                "aria-label",
                `Remove ${font}`
            );

            remove.textContent =
                "×";

            row.append(
                name,
                available,
                remove
            );

            list.appendChild(
                row
            );
        }
    }

    function installClockFontPicker() {
        const form =
            $("#graphicalSettingsForm");

        const picker =
            form?.querySelector(
                "[data-clock-font-picker]"
            );

        const control =
            form?.elements?.clockFont;

        if (!form || !picker || !control) {
            return;
        }

        const trigger =
            picker.querySelector(
                "[data-clock-font-trigger]"
            );

        const menu =
            picker.querySelector(
                "[data-clock-font-menu]"
            );

        const addButton =
            picker.querySelector(
                "[data-clock-font-add]"
            );

        const editor =
            picker.querySelector(
                "[data-clock-font-editor]"
            );

        const input =
            picker.querySelector(
                "[data-clock-font-input]"
            );

        const confirm =
            picker.querySelector(
                "[data-clock-font-confirm]"
            );

        const cancel =
            picker.querySelector(
                "[data-clock-font-cancel]"
            );

        const closeEditor = () => {
            if (editor) editor.hidden = true;
            if (addButton) addButton.hidden = false;
            if (input) input.value = "";
        };

        const closeMenu = () => {
            if (menu) menu.hidden = true;
            trigger?.setAttribute(
                "aria-expanded",
                "false"
            );
            closeEditor();
        };

        const commitFonts = fonts => {
            control.value =
                serializeClockFontList(
                    fonts.length > 0
                        ? fonts
                        : ["sans-serif"]
                );

            syncClockFontPicker(
                form
            );

            control.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        };

        trigger?.addEventListener(
            "click",
            () => {
                const opening =
                    menu?.hidden !== false;

                if (menu) menu.hidden = !opening;

                trigger.setAttribute(
                    "aria-expanded",
                    String(opening)
                );

                if (!opening) {
                    closeEditor();
                }
            }
        );

        addButton?.addEventListener(
            "click",
            () => {
                addButton.hidden = true;
                if (editor) editor.hidden = false;
                input?.focus();
            }
        );

        const addFont = () => {
            const font =
                String(
                    input?.value || ""
                ).trim();

            if (!font) return;

            const fonts =
                splitClockFontList(
                    control.value
                );

            if (
                !fonts.some(
                    existing =>
                        existing.toLowerCase() ===
                            font.toLowerCase()
                )
            ) {
                fonts.unshift(
                    font
                );
            }

            commitFonts(
                fonts
            );

            closeEditor();
        };

        confirm?.addEventListener(
            "click",
            addFont
        );

        cancel?.addEventListener(
            "click",
            closeEditor
        );

        input?.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addFont();
                }
                else if (
                    event.key === "Escape"
                ) {
                    event.preventDefault();
                    closeEditor();
                }
            }
        );

        picker.addEventListener(
            "click",
            event => {
                const remove =
                    event.target.closest(
                        ".clock-font-remove"
                    );

                if (!remove) return;

                const index =
                    Number(
                        remove.dataset.fontIndex
                    );

                const fonts =
                    splitClockFontList(
                        control.value
                    );

                if (
                    Number.isInteger(index) &&
                    index >= 0 &&
                    index < fonts.length
                ) {
                    fonts.splice(
                        index,
                        1
                    );

                    commitFonts(
                        fonts
                    );
                }
            }
        );

        document.addEventListener(
            "pointerdown",
            event => {
                if (
                    !menu ||
                    menu.hidden ||
                    picker.contains(
                        event.target
                    )
                ) {
                    return;
                }

                closeMenu();
            },
            true
        );

        syncClockFontPicker(
            form
        );
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
        syncClockFontPicker(form);
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
            ["trip", 5],
            [settings.showEarlyStart ? "earlystart" : "trip", 10],
            ["break", 10],
            [settings.showBreakBuffer ? "buffer" : "break", 10],
            ["lunch", 15],
            ["down", 10],
            ["approval-surplus", 5],
            ["approval-deficit", 5],
            [settings.showOvertime ? "overtime" : "trip", 5],
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
            speechRecognition: "settingsHelpSpeechRecognition",
            syncGoals: "settingsHelpSyncGoals",
            tolerance: "settingsHelpTolerance",
            toleranceColor: "settingsHelpTolerance",
            overtimeColor: "settingsHelpOvertime",
            latency: "settingsHelpLatency",
            latencyColor: "settingsHelpLatency",
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

        title.textContent =
            template?.dataset.helpTitle ||
            definition?.title ||
            "Help";

        if (template) {
            body.replaceChildren(
                template.content.cloneNode(true)
            );
            appendGraphicalHelpState(
                definition,
                body
            );
        }
        else if (definition) {
            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                definition.text;

            body.replaceChildren(
                paragraph
            );

            appendGraphicalHelpState(
                definition,
                body
            );
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

    function getGraphicalSettingsLayout() {
        const groups =
            graphicalDialog.querySelector(
                ".graphical-settings-grid > .settings-groups"
            );

        const preview =
            graphicalDialog.querySelector(
                ".graphical-settings-grid > .clock-preview"
            );

        const categories =
            Array.from(
                graphicalDialog.querySelectorAll(
                    ".settings-category"
                )
            );

        return {
            groups,
            preview,
            categories
        };
    }

    function graphicalRectsOverlap(first, second) {
        return (
            first.right > second.left &&
            first.left < second.right &&
            first.bottom > second.top &&
            first.top < second.bottom
        );
    }

    function updateGraphicalPreviewOverlap({
        immediate = false
    } = {}) {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        if (!groups || !preview) return;

        const applyOverlap = () => {
            if (!graphicalDialog.open) {
                preview.classList.remove(
                    "has-settings-overlap"
                );
                return;
            }

            const previewRect =
                preview.getBoundingClientRect();

            const groupsRect =
                groups.getBoundingClientRect();

            const visiblePreviewRect = {
                top: Math.max(
                    previewRect.top,
                    groupsRect.top
                ),
                right: Math.min(
                    previewRect.right,
                    groupsRect.right
                ),
                bottom: Math.min(
                    previewRect.bottom,
                    groupsRect.bottom
                ),
                left: Math.max(
                    previewRect.left,
                    groupsRect.left
                )
            };

            const hasVisiblePreviewArea =
                visiblePreviewRect.right >
                    visiblePreviewRect.left &&
                visiblePreviewRect.bottom >
                    visiblePreviewRect.top;

            const overlaps =
                hasVisiblePreviewArea &&
                categories.some(
                    category => {
                        const rect =
                            category.getBoundingClientRect();

                        return (
                            rect.width > 0 &&
                            rect.height > 0 &&
                            graphicalRectsOverlap(
                                rect,
                                visiblePreviewRect
                            )
                        );
                    }
                );

            preview.classList.toggle(
                "has-settings-overlap",
                overlaps
            );
        };

        if (!immediate) {
            applyOverlap();
            return;
        }

        const previousTransition =
            preview.style.transition;

        preview.style.transition =
            "none";

        applyOverlap();

        void preview.offsetWidth;

        if (previousTransition) {
            preview.style.transition =
                previousTransition;
        }
        else {
            preview.style.removeProperty(
                "transition"
            );
        }
    }

    function scheduleGraphicalPreviewOverlap() {
        if (graphicalPreviewAnimationFrame) return;

        graphicalPreviewAnimationFrame =
            requestAnimationFrame(
                () => {
                    graphicalPreviewAnimationFrame =
                        undefined;

                    updateGraphicalPreviewOverlap();
                }
            );
    }

    function cancelGraphicalDetailsAnimation(category) {
        const state =
            graphicalDetailsAnimations.get(
                category
            );

        if (!state) return;

        state.heightAnimation?.cancel();
        state.contentAnimation?.cancel();

        graphicalDetailsAnimations.delete(
            category
        );
    }

    function finishGraphicalCategoryAnimation(
        category,
        shouldOpen,
        token
    ) {
        const state =
            graphicalDetailsAnimations.get(
                category
            );

        if (!state || state.token !== token) {
            return;
        }

        state.heightAnimation?.cancel();
        state.contentAnimation?.cancel();

        if (!shouldOpen) {
            category.open = false;
        }

        category.style.removeProperty(
            "height"
        );

        category.classList.remove(
            "is-opening",
            "is-closing"
        );

        graphicalDetailsAnimations.delete(
            category
        );

        scheduleGraphicalPreviewOverlap();
    }

    function followGraphicalDetailsAnimation(
        animation,
        token,
        category
    ) {
        const tick = () => {
            const state =
                graphicalDetailsAnimations.get(
                    category
                );

            if (
                !state ||
                state.token !== token ||
                (
                    animation.playState !== "running" &&
                    animation.playState !== "pending"
                )
            ) {
                updateGraphicalPreviewOverlap();
                return;
            }

            updateGraphicalPreviewOverlap();

            requestAnimationFrame(
                tick
            );
        };

        requestAnimationFrame(
            tick
        );
    }

    function animateGraphicalCategory(
        category,
        shouldOpen
    ) {
        const summary =
            category.querySelector(
                ":scope > summary"
            );

        const content =
            category.querySelector(
                ":scope > .settings-category-content"
            );

        if (!summary || !content) return;

        const existing =
            graphicalDetailsAnimations.get(
                category
            );

        const currentlyTargetedOpen =
            existing?.shouldOpen ??
            category.open;

        if (
            currentlyTargetedOpen === shouldOpen &&
            existing
        ) {
            return;
        }

        const startHeight =
            category.getBoundingClientRect()
                .height;

        const renderedContentOpacity =
            Number.parseFloat(
                getComputedStyle(
                    content
                ).opacity
            );

        const wasOpen =
            category.open;

        cancelGraphicalDetailsAnimation(
            category
        );

        category.style.removeProperty(
            "height"
        );

        category.classList.remove(
            "is-opening",
            "is-closing"
        );

        if (shouldOpen) {
            category.open = true;
            category.classList.add(
                "is-opening"
            );
        }
        else {
            category.classList.add(
                "is-closing"
            );
        }

        const categoryStyle =
            getComputedStyle(
                category
            );

        const borderHeight =
            (
                Number.parseFloat(
                    categoryStyle.borderTopWidth
                ) || 0
            ) +
            (
                Number.parseFloat(
                    categoryStyle.borderBottomWidth
                ) || 0
            );

        const endHeight =
            shouldOpen
                ? category.getBoundingClientRect()
                    .height
                : summary.getBoundingClientRect()
                    .height + borderHeight;

        const reducedMotion =
            typeof matchMedia === "function" &&
            matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;

        const duration =
            reducedMotion
                ? 0
                : GRAPHICAL_DETAILS_DURATION;

        if (
            duration === 0 ||
            typeof category.animate !== "function"
        ) {
            category.open =
                shouldOpen;

            category.style.removeProperty(
                "height"
            );

            category.classList.remove(
                "is-opening",
                "is-closing"
            );

            updateGraphicalPreviewOverlap({
                immediate: true
            });

            return;
        }

        category.style.height =
            `${startHeight}px`;

        const startOpacity =
            shouldOpen && !wasOpen
                ? 0
                : Number.isFinite(
                    renderedContentOpacity
                )
                    ? renderedContentOpacity
                    : 1;

        const token =
            Symbol(
                "graphical-details-animation"
            );

        const heightAnimation =
            category.animate(
                [
                    {
                        height:
                            `${startHeight}px`
                    },
                    {
                        height:
                            `${endHeight}px`
                    }
                ],
                {
                    duration,
                    easing:
                        "cubic-bezier(.2,.8,.2,1)",
                    fill: "both"
                }
            );

        const contentAnimation =
            content.animate(
                [
                    {
                        opacity:
                            startOpacity
                    },
                    {
                        opacity:
                            shouldOpen
                                ? 1
                                : 0
                    }
                ],
                {
                    duration:
                        Math.min(
                            duration,
                            150
                        ),
                    easing: "ease-out",
                    fill: "both"
                }
            );

        graphicalDetailsAnimations.set(
            category,
            {
                token,
                shouldOpen,
                heightAnimation,
                contentAnimation
            }
        );

        followGraphicalDetailsAnimation(
            heightAnimation,
            token,
            category
        );

        heightAnimation.finished
            .then(
                () =>
                    finishGraphicalCategoryAnimation(
                        category,
                        shouldOpen,
                        token
                    )
            )
            .catch(
                () => {}
            );
    }

    function toggleGraphicalCategory(
        category
    ) {
        const categories =
            getGraphicalSettingsLayout()
                .categories;

        const state =
            graphicalDetailsAnimations.get(
                category
            );

        const shouldOpen =
            !(
                state?.shouldOpen ??
                category.open
            );

        if (shouldOpen) {
            for (const other of categories) {
                if (other === category) continue;

                const otherState =
                    graphicalDetailsAnimations.get(
                        other
                    );

                if (
                    otherState?.shouldOpen ??
                    other.open
                ) {
                    animateGraphicalCategory(
                        other,
                        false
                    );
                }
            }
        }

        animateGraphicalCategory(
            category,
            shouldOpen
        );
    }

    function resetGraphicalSettingsAccordion() {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        if (graphicalPreviewAnimationFrame) {
            cancelAnimationFrame(
                graphicalPreviewAnimationFrame
            );

            graphicalPreviewAnimationFrame =
                undefined;
        }

        for (const category of categories) {
            cancelGraphicalDetailsAnimation(
                category
            );

            category.open = false;

            category.style.removeProperty(
                "height"
            );

            category.classList.remove(
                "is-opening",
                "is-closing"
            );
        }

        if (groups) {
            groups.scrollTop = 0;
        }

        preview?.classList.remove(
            "has-settings-overlap"
        );
    }

    function installGraphicalSettingsAccordion() {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        for (const category of categories) {
            const summary =
                category.querySelector(
                    ":scope > summary"
                );

            summary?.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    toggleGraphicalCategory(
                        category
                    );
                }
            );
        }

        groups?.addEventListener(
            "scroll",
            scheduleGraphicalPreviewOverlap,
            {
                passive: true
            }
        );

        window.addEventListener(
            "resize",
            scheduleGraphicalPreviewOverlap,
            {
                passive: true
            }
        );

        if (
            typeof ResizeObserver ===
            "function"
        ) {
            graphicalPreviewResizeObserver =
                new ResizeObserver(
                    scheduleGraphicalPreviewOverlap
                );

            if (groups) {
                graphicalPreviewResizeObserver.observe(
                    groups
                );
            }

            if (preview) {
                graphicalPreviewResizeObserver.observe(
                    preview
                );
            }

            for (const category of categories) {
                graphicalPreviewResizeObserver.observe(
                    category
                );
            }
        }

        graphicalDialog.addEventListener(
            "opening",
            resetGraphicalSettingsAccordion
        );

        graphicalDialog.addEventListener(
            "closed",
            resetGraphicalSettingsAccordion
        );

        graphicalDialog.addEventListener(
            "opened",
            () => {
                resetGraphicalSettingsAccordion();

                requestAnimationFrame(
                    () => {
                        applyGraphicalSettings(
                            settingsFromForm(
                                $("#graphicalSettingsForm")
                            ),
                            clockPreview
                        );

                        requestAnimationFrame(
                            () => {
                                clockPreview
                                    ?.refreshLayout?.();

                                updateGraphicalPreviewOverlap({
                                    immediate: true
                                });
                            }
                        );
                    }
                );
            }
        );

        resetGraphicalSettingsAccordion();
    }

    installGraphicalHelpButtons();
    installGraphicalSettingsAccordion();
    installClockFontPicker();
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

    function hasSpeechDeveloperAccess() {
        const permissions =
            Number(
                signedInProfile
                    ?.permissions
            ) || 0;

        return Boolean(
            permissions &
            DEVELOPER_MENU_PERMISSION_MASK
        );
    }

    function canResolveSpeechTrainingDivergence() {
        const permissions =
            Number(
                signedInProfile
                    ?.permissions
            ) || 0;

        return Boolean(
            permissions &
            PERMISSION_DEVELOPER
        );
    }

    function isSpeechTrainingDeveloperPreviewOnly() {
        const permissions =
            Number(
                signedInProfile
                    ?.permissions
            ) || 0;

        return Boolean(
            permissions &
            PERMISSION_DEVELOPER_PREVIEW
        ) &&
            !Boolean(
                permissions &
                PERMISSION_DEVELOPER
            );
    }

    function normalizeSpeechTrainingPhrase(
        value
    ) {
        return String(
            value ||
            ""
        )
            .toLocaleLowerCase()
            .replace(
                /<[^>]+>/g,
                " "
            )
            .replace(
                /[^\p{L}\p{N}\s]/gu,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    function speechTrainingEnglishSoftOmission(
        observed,
        expected
    ) {
        if (
            !observed ||
            !expected ||
            observed ===
                expected
        ) {
            return false;
        }

        const weakConsonants =
            new Set([
                "s",
                "z",
                "f",
                "v",
                "h"
            ]);

        const weakFinalConsonants =
            new Set([
                ...weakConsonants,
                "t",
                "d"
            ]);

        if (
            expected.length ===
                observed.length +
                    1
        ) {
            for (
                let index = 0;
                index < expected.length;
                index++
            ) {
                if (
                    expected.slice(
                        0,
                        index
                    ) +
                        expected.slice(
                            index +
                                1
                        ) !==
                    observed
                ) {
                    continue;
                }

                const omitted =
                    expected[
                        index
                    ];

                if (
                    weakConsonants.has(
                        omitted
                    )
                ) {
                    return true;
                }

                if (
                    index ===
                        expected.length -
                            1 &&
                    weakFinalConsonants
                        .has(
                            omitted
                        )
                ) {
                    return true;
                }
            }
        }

        const softClusters = [
            "sh",
            "th",
            "ph",
            "wh"
        ];

        return softClusters.some(
            cluster =>
                (
                    expected.startsWith(
                        cluster
                    ) &&
                    observed ===
                        expected.slice(
                            cluster.length
                        )
                ) ||
                (
                    expected.endsWith(
                        cluster
                    ) &&
                    observed ===
                        expected.slice(
                            0,
                            -cluster.length
                        )
                )
        );
    }

    function speechTrainingTokenBelongsToFamily(
        observed,
        expected
    ) {
        if (observed === expected) {
            return true;
        }

        const lexicalFamilies = [
            new Set([
                "ok",
                "okay"
            ]),
            new Set([
                "sync",
                "sink",
                "sin"
            ])
        ];

        if (
            lexicalFamilies.some(
                family =>
                    family.has(
                        observed
                    ) &&
                    family.has(
                        expected
                    )
            )
        ) {
            return true;
        }

        const singularPluralPair =
            (
                observed + "s" ===
                    expected ||
                expected + "s" ===
                    observed
            ) ||
            (
                observed + "es" ===
                    expected ||
                expected + "es" ===
                    observed
            );

        if (singularPluralPair) {
            return true;
        }

        return speechTrainingEnglishSoftOmission(
            observed,
            expected
        );
    }

    function speechTrainingExpectedPhraseMatches(
        observed,
        candidate
    ) {
        const heard =
            normalizeSpeechTrainingPhrase(
                observed
            );

        const template =
            String(
                candidate ||
                ""
            )
                .toLocaleLowerCase()
                .trim();

        if (!heard || !template) {
            return false;
        }

        const placeholders = [];
        const protectedTemplate =
            template.replace(
                /<[^>]+>/g,
                value => {
                    const token =
                        "__wmof_placeholder_" +
                        placeholders.length +
                        "__";

                    placeholders.push(
                        token
                    );

                    return token;
                }
            );

        const normalizedTemplate =
            protectedTemplate
                .replace(
                    /[^\p{L}\p{N}_\s]/gu,
                    " "
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (!normalizedTemplate) {
            return false;
        }

        const heardTokens =
            heard
                .split(
                    " "
                )
                .filter(
                    Boolean
                );

        const templateTokens =
            normalizedTemplate
                .split(
                    " "
                )
                .filter(
                    Boolean
                );

        if (
            !placeholders.length &&
            heardTokens.length !==
                templateTokens.length
        ) {
            return false;
        }

        if (!placeholders.length) {
            return templateTokens
                .every(
                    (
                        token,
                        index
                    ) =>
                        speechTrainingTokenBelongsToFamily(
                            heardTokens[
                                index
                            ],
                            token
                        )
                );
        }

        const placeholderSet =
            new Set(
                placeholders
            );

        const visit =
            (
                templateIndex,
                heardIndex
            ) => {
                if (
                    templateIndex >=
                        templateTokens
                            .length
                ) {
                    return (
                        heardIndex ===
                        heardTokens.length
                    );
                }

                const token =
                    templateTokens[
                        templateIndex
                    ];

                if (
                    placeholderSet.has(
                        token
                    )
                ) {
                    for (
                        let next =
                            heardIndex +
                            1;
                        next <=
                            heardTokens.length;
                        next++
                    ) {
                        if (
                            visit(
                                templateIndex +
                                    1,
                                next
                            )
                        ) {
                            return true;
                        }
                    }

                    return false;
                }

                if (
                    heardIndex >=
                        heardTokens.length ||
                    !speechTrainingTokenBelongsToFamily(
                        heardTokens[
                            heardIndex
                        ],
                        token
                    )
                ) {
                    return false;
                }

                return visit(
                    templateIndex +
                        1,
                    heardIndex +
                        1
                );
            };

        return visit(
            0,
            0
        );
    }

    function speechTrainingPhraseWasExpected(
        observed,
        target =
            speechTrainingTarget
    ) {
        if (
            !observed ||
            !target
        ) {
            return false;
        }

        const candidates =
            [
                ...new Set(
                    [
                        ...(
                            Array.isArray(
                                target
                                    .expectedPhrases
                            )
                                ? target
                                    .expectedPhrases
                                : []
                        ),
                        target.required,
                        target.phrase,
                        target.display
                    ].filter(
                        Boolean
                    )
                )
            ];

        return candidates.some(
            candidate =>
                speechTrainingExpectedPhraseMatches(
                    observed,
                    candidate
                )
        );
    }

    function speechTrainingTargetMatchesCommand(
        target,
        element
    ) {
        if (!target || !element) {
            return false;
        }

        const commandId =
            element.dataset
                ?.speechEditorId;

        if (
            target.commandId &&
            commandId
        ) {
            return (
                target.commandId ===
                commandId
            );
        }

        const commandKey =
            element.dataset
                ?.speechSystemCommand;

        if (
            target.commandKey &&
            commandKey
        ) {
            return (
                target.commandKey ===
                commandKey
            );
        }

        const pattern =
            element
                .getAttribute?.(
                    "speech-pattern"
                ) ||
            "";

        return Boolean(
            target.pattern &&
            pattern &&
            target.pattern ===
                pattern
        );
    }

    function normalizeSpeechTrainingObserved(
        observed,
        outcome
    ) {
        const raw =
            String(
                observed ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        const live =
            String(
                outcome
                    ?.lastLiveTranscript ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (
            raw &&
            live &&
            raw !== live
        ) {
            const doubled =
                (
                    live +
                    " " +
                    live
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (
                raw
                    .toLocaleLowerCase() ===
                doubled
                    .toLocaleLowerCase()
            ) {
                return {
                    observed:
                        live,
                    rawObserved:
                        raw,
                    normalizedFinalArtifact:
                        true
                };
            }
        }

        return {
            observed:
                raw,
            rawObserved:
                raw,
            normalizedFinalArtifact:
                false
        };
    }

    function speechTrainingResultPresentation(
        result
    ) {
        switch (
            result?.state
        ) {
            case "accepted":
                return {
                    symbol:
                        "✓",
                    label:
                        "Current model accepted"
                };
            case "model-miss":
                return {
                    symbol:
                        "✓",
                    label:
                        "Current model rejected"
                };
            case "divergence":
                return {
                    symbol:
                        "×",
                    label:
                        "Current model rejected · divergence"
                };
            default:
                return {
                    symbol:
                        "",
                    label:
                        "Discarded · unusable input"
                };
        }
    }

    function speechTrainingSameTarget(
        left,
        right
    ) {
        return Boolean(
            left &&
            right &&
            left.source ===
                right.source &&
            left.category ===
                right.category &&
            left.card ===
                right.card &&
            left.phrase ===
                right.phrase
        );
    }

    function updateSpeechTrainingCount() {
        speechTrainingUtteranceCount =
            speechTrainingResultsHistory
                .filter(
                    result =>
                        result.state !==
                            "discarded" &&
                        speechTrainingSameTarget(
                            result.target,
                            speechTrainingTarget
                        )
                )
                .length;

        if (speechTrainingCount) {
            speechTrainingCount
                .textContent =
                String(
                    speechTrainingUtteranceCount
                );
        }
    }

    function setSpeechTrainingHeardResult(
        result
    ) {
        if (speechTrainingHeard) {
            speechTrainingHeard
                .textContent =
                "Heard: " +
                (
                    result?.observed ||
                    "—"
                );
        }

        if (!speechTrainingHeardStatus) {
            return;
        }

        if (!result) {
            speechTrainingHeardStatus
                .hidden =
                true;
            speechTrainingHeardStatus
                .textContent =
                "";
            speechTrainingHeardStatus
                .removeAttribute(
                    "data-result"
                );
            return;
        }

        const presentation =
            speechTrainingResultPresentation(
                result
            );

        speechTrainingHeardStatus.hidden =
            false;
        speechTrainingHeardStatus
            .dataset
            .result =
            result.state;
        speechTrainingHeardStatus
            .textContent =
            presentation.symbol;
        speechTrainingHeardStatus
            .setAttribute(
                "aria-label",
                presentation.label
            );
        speechTrainingHeardStatus.title =
            presentation.label;
    }

    function speechTrainingReviewLabel(
        result
    ) {
        if (
            result.divergenceStatus ===
                "approved"
        ) {
            return "Approved as phrase";
        }

        if (
            result.divergenceStatus ===
                "merged"
        ) {
            return "Merged with existing phrase";
        }

        return isSpeechTrainingDeveloperPreviewOnly()
            ? "Pending developer review · read only"
            : "Pending developer review";
    }

    async function reviewSpeechTrainingDivergence(
        result,
        decision
    ) {
        if (
            !result ||
            result.state !==
                "divergence" ||
            !canResolveSpeechTrainingDivergence()
        ) {
            return false;
        }

        if (
            decision ===
                "purge" &&
            !result.contributionId
        ) {
            return removeSpeechTrainingResult(
                result
            );
        }

        if (!result.contributionId) {
            result.divergenceStatus =
                decision ===
                    "approve"
                    ? "approved"
                    : "merged";
            result.reviewDecision =
                decision;
            renderSpeechTrainingResults();
            return true;
        }

        const csrf =
            await ensureSpeechTrainingCsrfToken();

        const response =
            await fetch(
                API_BASE +
                "api/speech-corrections/?language=en-US",
                {
                    method:
                        "POST",
                    credentials:
                        "same-origin",
                    cache:
                        "no-store",
                    headers: {
                        "Accept":
                            "application/json",
                        "Content-Type":
                            "application/json",
                        "X-CSRF-Token":
                            csrf
                    },
                    body:
                        JSON.stringify({
                            action:
                                "divergence-review",
                            language:
                                "en-US",
                            decision,
                            ids: [
                                result
                                    .contributionId
                            ]
                        })
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to review divergent speech training."
            );
        }

        if (decision === "purge") {
            const index =
                speechTrainingResultsHistory
                    .indexOf(
                        result
                    );

            if (index >= 0) {
                speechTrainingResultsHistory
                    .splice(
                        index,
                        1
                    );
            }
        }
        else {
            result.divergenceStatus =
                decision ===
                    "approve"
                    ? "approved"
                    : "merged";
        }

        renderSpeechTrainingResults();
        updateSpeechTrainingCount();

        return true;
    }

    async function removeSpeechTrainingResult(
        result
    ) {
        if (!result) {
            return false;
        }

        if (result.contributionId) {
            const csrf =
                await ensureSpeechTrainingCsrfToken();

            const response =
                await fetch(
                    API_BASE +
                    "api/speech-corrections/?language=en-US",
                    {
                        method:
                            "DELETE",
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers: {
                            "Accept":
                                "application/json",
                            "Content-Type":
                                "application/json",
                            "X-CSRF-Token":
                                csrf
                        },
                        body:
                            JSON.stringify({
                                action:
                                    "contribution",
                                language:
                                    "en-US",
                                id:
                                    result
                                        .contributionId,
                                reason:
                                    "Deleted from in-app speech training results"
                            })
                    }
                );

            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to delete speech training run."
                );
            }
        }

        const pendingIndex =
            speechTrainingPendingSamples
                .indexOf(
                    result
                );

        if (pendingIndex >= 0) {
            speechTrainingPendingSamples
                .splice(
                    pendingIndex,
                    1
                );
        }

        const historyIndex =
            speechTrainingResultsHistory
                .indexOf(
                    result
                );

        if (historyIndex >= 0) {
            speechTrainingResultsHistory
                .splice(
                    historyIndex,
                    1
                );
        }

        renderSpeechTrainingResults();
        updateSpeechTrainingCount();

        return true;
    }

    function renderSpeechTrainingResults() {
        if (speechTrainingResultsCount) {
            speechTrainingResultsCount
                .textContent =
                String(
                    speechTrainingResultsHistory
                        .length
                );
        }

        if (!speechTrainingResultsList) {
            return;
        }

        speechTrainingResultsList
            .replaceChildren();

        for (
            const result of
            [
                ...speechTrainingResultsHistory
            ].reverse()
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "speech-training-result";
            row.dataset.result =
                result.state;

            const presentation =
                speechTrainingResultPresentation(
                    result
                );

            const icon =
                document.createElement(
                    "span"
                );

            icon.className =
                "speech-training-result-icon";
            icon.dataset.result =
                result.state;
            icon.textContent =
                presentation.symbol;
            icon.setAttribute(
                "aria-label",
                presentation.label
            );

            const copy =
                document.createElement(
                    "span"
                );

            copy.className =
                "speech-training-result-copy";

            const heard =
                document.createElement(
                    "strong"
                );

            heard.textContent =
                result.observed ||
                "Bad input";

            const target =
                document.createElement(
                    "span"
                );

            target.textContent =
                "Expected: " +
                (
                    result.target
                        ?.display ||
                    result.target
                        ?.phrase ||
                    "command"
                );

            copy.append(
                heard,
                target
            );

            const state =
                document.createElement(
                    "span"
                );

            state.className =
                "speech-training-result-state";
            state.textContent =
                presentation.label;

            const remove =
                document.createElement(
                    "button"
                );

            remove.type =
                "button";
            remove.className =
                "speech-training-result-remove";
            remove.title =
                "Delete this training run";
            remove.setAttribute(
                "aria-label",
                "Delete this training run"
            );

            remove.addEventListener(
                "click",
                () => {
                    remove.disabled =
                        true;

                    void removeSpeechTrainingResult(
                        result
                    )
                        .catch(
                            error => {
                                remove.disabled =
                                    false;
                                console.error(
                                    error
                                );
                                setSpeechTrainingPrompt(
                                    "error",
                                    "Error"
                                );
                            }
                        );
                }
            );

            row.append(
                icon,
                copy,
                state,
                remove
            );

            if (
                result.state ===
                    "divergence"
            ) {
                const review =
                    document.createElement(
                        "div"
                    );

                review.className =
                    "speech-training-result-review";

                const label =
                    document.createElement(
                        "span"
                    );

                label.textContent =
                    speechTrainingReviewLabel(
                        result
                    );

                review.append(
                    label
                );

                if (
                    canResolveSpeechTrainingDivergence() &&
                    ![
                        "approved",
                        "merged"
                    ].includes(
                        result
                            .divergenceStatus
                    )
                ) {
                    for (
                        const [
                            decision,
                            text
                        ] of [
                            [
                                "approve",
                                "Approve phrase"
                            ],
                            [
                                "merge",
                                "Merge"
                            ],
                            [
                                "purge",
                                "Purge"
                            ]
                        ]
                    ) {
                        const button =
                            document.createElement(
                                "button"
                            );

                        button.type =
                            "button";
                        button.dataset
                            .decision =
                            decision;
                        button.textContent =
                            text;

                        button.addEventListener(
                            "click",
                            () => {
                                button.disabled =
                                    true;

                                void reviewSpeechTrainingDivergence(
                                    result,
                                    decision
                                )
                                    .catch(
                                        error => {
                                            button.disabled =
                                                false;
                                            console.error(
                                                error
                                            );
                                        }
                                    );
                            }
                        );

                        review.append(
                            button
                        );
                    }
                }

                row.append(
                    review
                );
            }

            speechTrainingResultsList
                .append(
                    row
                );
        }
    }

    function clearSpeechTrainingResults() {
        speechTrainingResultsHistory
            .splice(
                0,
                speechTrainingResultsHistory
                    .length
            );

        speechTrainingOutcomeByUtterance
            .clear();

        renderSpeechTrainingResults();
        updateSpeechTrainingCount();
        setSpeechTrainingHeardResult();

        if (speechTrainingResults) {
            speechTrainingResults.open =
                false;
        }
    }

    function finalizeSpeechTrainingResult(
        telemetry
    ) {
        const utteranceId =
            telemetry.utteranceId ??
            telemetry.event
                ?.id ??
            telemetry.event
                ?.utteranceId;

        if (
            utteranceId ===
                undefined ||
            speechTrainingSeenUtterances
                .has(
                    utteranceId
                )
        ) {
            return false;
        }

        speechTrainingSeenUtterances
            .add(
                utteranceId
            );

        const rawObserved =
            String(
                telemetry.heard ||
                telemetry.event
                    ?.transcript ||
                telemetry.transcript ||
                ""
            ).trim();

        const outcome =
            speechTrainingOutcomeByUtterance
                .get(
                    utteranceId
                ) ||
            {};

        const normalizedObserved =
            normalizeSpeechTrainingObserved(
                rawObserved,
                outcome
            );

        const observed =
            normalizedObserved
                .observed;

        speechTrainingOutcomeByUtterance
            .delete(
                utteranceId
            );

        const modelAccepted =
            Boolean(
                outcome.matchedExpected
            );

        const expected =
            observed
                ? speechTrainingPhraseWasExpected(
                    observed,
                    speechTrainingTarget
                )
                : false;

        const state =
            !observed
                ? "discarded"
                : modelAccepted
                    ? "accepted"
                    : expected
                        ? "model-miss"
                        : "divergence";

        const result = {
            utteranceId,
            target: {
                ...speechTrainingTarget,
                expectedPhrases:
                    [
                        ...(
                            speechTrainingTarget
                                ?.expectedPhrases ||
                            []
                        )
                    ]
            },
            observed,
            rawObserved:
                normalizedObserved
                    .rawObserved,
            normalizedFinalArtifact:
                normalizedObserved
                    .normalizedFinalArtifact,
            state,
            expected,
            modelAccepted,
            divergenceStatus:
                state ===
                    "divergence"
                    ? "pending"
                    : undefined,
            pipeline:
                globalThis
                    .SpeechMenu
                    ?.pipeline,
            runtimeRevision:
                globalThis
                    .SherpaRecognizer
                    ?.runtimeRevision,
            capturedAt:
                Date.now()
        };

        speechTrainingResultsHistory
            .push(
                result
            );

        if (
            state !==
                "discarded"
        ) {
            speechTrainingPendingSamples
                .push(
                    result
                );
        }

        setSpeechTrainingHeardResult(
            result
        );
        renderSpeechTrainingResults();
        updateSpeechTrainingCount();

        return true;
    }

    function syncSpeechTrainingControls() {
        if (speechTrainingButton) {
            const unavailable =
                !signedInProfile ||
                !speechTrainingConnectionAvailable;

            speechTrainingButton.disabled =
                unavailable ||
                speechTrainingActive;

            speechTrainingButton.setAttribute(
                "aria-pressed",
                String(
                    inAppSpeechTrainingEnabled
                )
            );

            speechTrainingButton.title =
                speechTrainingActive
                    ? "Stop active training before disabling Speech Training"
                    : unavailable
                        ? "Sign in and connect to use Speech Training"
                        : inAppSpeechTrainingEnabled
                            ? "Disable Speech Training"
                            : "Enable Speech Training";
        }

        if (speechRecognitionButton) {
            speechRecognitionButton.disabled =
                !speechRecognitionLanguageAvailable ||
                speechTrainingActive;
        }

        syncSpeechTrainingStartButton();
    }

    function syncSpeechTrainingStartButton() {
        if (!speechTrainingStartStop) {
            return;
        }

        const speechMenu =
            globalThis.SpeechMenu;

        const muted =
            Boolean(
                speechMenu?.muted
            );

        const ready =
            inAppSpeechTrainingEnabled &&
            Boolean(
                speechTrainingTarget
            ) &&
            Boolean(
                speechMenu?.started
            ) &&
            !muted;

        speechTrainingStartStop.disabled =
            speechTrainingActive
                ? false
                : !ready;

        speechTrainingStartStop.textContent =
            speechTrainingActive
                ? "Stop"
                : "Start";

        speechTrainingStartStop.dataset.active =
            String(
                speechTrainingActive
            );

        if (
            !speechTrainingActive &&
            inAppSpeechTrainingEnabled
        ) {
            setSpeechTrainingPrompt(
                muted
                    ? "muted"
                    : speechTrainingTarget
                        ? "ready"
                        : "select",
                muted
                    ? "Muted"
                    : speechTrainingTarget
                        ? "Ready"
                        : "Select"
            );
        }
    }

    function showSpeechTrainingWidget({
        promote = false
    } = {}) {
        if (!speechTrainingWidget) {
            return false;
        }

        speechTrainingWidget.hidden =
            false;

        try {
            const open =
                speechTrainingWidget.matches(
                    ":popover-open"
                );

            if (
                open &&
                promote
            ) {
                speechTrainingWidget
                    .classList
                    .add(
                        "popover-immediate-close"
                    );

                speechTrainingWidget
                    .hidePopover?.();

                speechTrainingWidget
                    .showPopover?.();

                requestAnimationFrame(
                    () =>
                        speechTrainingWidget
                            .classList
                            .remove(
                                "popover-immediate-close"
                            )
                );
            }
            else if (!open) {
                speechTrainingWidget
                    .showPopover?.();
            }
        }
        catch {}

        return true;
    }

    function hideSpeechTrainingWidget() {
        if (!speechTrainingWidget) {
            return false;
        }

        try {
            if (
                speechTrainingWidget.matches(
                    ":popover-open"
                )
            ) {
                speechTrainingWidget
                    .hidePopover?.();
            }
        }
        catch {}

        speechTrainingWidget.hidden =
            true;

        return true;
    }

    function setSpeechTrainingPrompt(
        state,
        label
    ) {
        if (!speechTrainingWidget) {
            return;
        }

        speechTrainingWidget.dataset.prompt =
            state || "ready";

        if (speechTrainingPrompt) {
            speechTrainingPrompt.textContent =
                label ||
                state ||
                "Ready";
        }
    }

    function resetSpeechTrainingTarget({
        clearSelection = true
    } = {}) {
        speechTrainingTarget =
            undefined;
        speechTrainingUtteranceCount =
            0;
        speechTrainingSeenUtterances
            .clear();

        if (speechTrainingPhrase) {
            speechTrainingPhrase.textContent =
                "Select a command";
        }

        setSpeechTrainingHeardResult();
        speechTrainingOutcomeByUtterance
            .clear();
        updateSpeechTrainingCount();

        if (clearSelection) {
            speechMicBar
                ?.clearTrainingTarget?.();
        }

        syncSpeechTrainingStartButton();
    }

    function syncAdaptiveSpeechTimingRate() {
        return globalThis
            .SpeechMenu
            ?.setSpeechTimingTtsRate?.(
                audioSettings
                    .speechVelocity
            );
    }

    function speechTimingFormatMs(
        value
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? Math.round(number) +
                " ms"
            : "—";
    }

    function renderSpeechTimingTool() {
        if (!speechTimingDialog) {
            return false;
        }

        const snapshot =
            globalThis
                .SpeechMenu
                ?.speechTimingSnapshot;

        if (!snapshot) {
            if (
                speechTimingValues
                    .stream
            ) {
                speechTimingValues
                    .stream
                    .textContent =
                    "Speech runtime not loaded";
            }

            return false;
        }

        const baseline =
            snapshot.baseline ||
            {};
        const trip =
            snapshot.trip ||
            {};
        const recognition =
            snapshot.recognition ||
            {};
        const baselineDeviation =
            Number.isFinite(
                Number(
                    baseline
                        .continuationPauseVarianceMs2
                )
            )
                ? Math.sqrt(
                    Number(
                        baseline
                            .continuationPauseVarianceMs2
                    )
                )
                : undefined;
        const tripDeviation =
            Number.isFinite(
                Number(
                    trip
                        .continuationPauseVarianceMs2
                )
            )
                ? Math.sqrt(
                    Number(
                        trip
                            .continuationPauseVarianceMs2
                    )
                )
                : undefined;

        speechTimingValues
            .speechRate
            .textContent =
            Number(
                snapshot
                    .estimatedSpeechRate ||
                1
            )
                .toFixed(2) +
            "×";

        speechTimingValues
            .grace
            .textContent =
            speechTimingFormatMs(
                snapshot
                    .continuationPauseBoundaryMs
            );

        speechTimingValues
            .dispatchDelay
            .textContent =
            speechTimingFormatMs(
                snapshot
                    .continuationDispatchDelayMs
            );

        speechTimingValues
            .ttsRate
            .textContent =
            Number(
                snapshot
                    .ttsRate ||
                1
            )
                .toFixed(2) +
            "×";

        speechTimingValues
            .ttsAdjustment
            .textContent =
            (
                Number(
                    snapshot
                        .ttsPriorFactor ||
                    1
                ) *
                100
            )
                .toFixed(0) +
            "%";

        speechTimingValues
            .confidence
            .textContent =
            (
                Number(
                    snapshot
                        .continuationConfidence ||
                    0
                ) *
                100
            )
                .toFixed(0) +
            "%";

        speechTimingValues
            .tripMean
            .textContent =
            speechTimingFormatMs(
                trip
                    .continuationPauseMeanMs
            );
        speechTimingValues
            .tripDeviation
            .textContent =
            speechTimingFormatMs(
                tripDeviation
            );
        speechTimingValues
            .tripSamples
            .textContent =
            String(
                trip
                    .continuationPauseSamples ||
                0
            );

        speechTimingValues
            .baselineMean
            .textContent =
            speechTimingFormatMs(
                baseline
                    .continuationPauseMeanMs
            );
        speechTimingValues
            .baselineDeviation
            .textContent =
            speechTimingFormatMs(
                baselineDeviation
            );
        speechTimingValues
            .baselineSamples
            .textContent =
            String(
                baseline
                    .continuationPauseSamples ||
                0
            );

        speechTimingValues
            .stream
            .textContent =
            recognition.transcript
                ? (
                    "Stream " +
                    String(
                        recognition
                            .streamDepth ||
                        1
                    ) +
                    ": " +
                    recognition
                        .transcript +
                    (
                        recognition
                            .canContinue
                            ? "  • continuation"
                            : recognition
                                .exact
                                ? "  • terminal"
                                : "  • partial"
                    )
                )
                : "Idle";

        const recent =
            Array.isArray(
                snapshot.recentPauses
            )
                ? snapshot
                    .recentPauses
                    .slice(-8)
                    .reverse()
                : [];

        speechTimingValues
            .recent
            .replaceChildren(
                ...(
                    recent.length
                        ? recent.map(
                            entry => {
                                const item =
                                    document
                                        .createElement(
                                            "li"
                                        );

                                item.textContent =
                                    Math.round(
                                        Number(
                                            entry
                                                .milliseconds
                                        ) ||
                                        0
                                    ) +
                                    " ms · " +
                                    (
                                        entry
                                            .type ===
                                            "separation"
                                            ? "new stream"
                                            : "continuation"
                                    ) +
                                    " · " +
                                    String(
                                        entry
                                            .source ||
                                        "speech"
                                    );

                                return item;
                            }
                        )
                        : [
                            Object.assign(
                                document
                                    .createElement(
                                        "li"
                                    ),
                                {
                                    textContent:
                                        "No continuation pauses observed this trip."
                                }
                            )
                        ]
                )
            );

        return true;
    }

    async function loadSpeechTimingProfile() {
        if (!signedInProfile) {
            return false;
        }

        await ensureSpeechRuntime();

        const response =
            await fetch(
                API_BASE +
                    "api/speech-timing/",
                {
                    credentials:
                        "same-origin",
                    cache:
                        "no-store",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load speech timing profile."
            );
        }

        globalThis
            .SpeechMenu
            ?.configureSpeechTimingProfile?.(
                data.profile ||
                {}
            );

        syncAdaptiveSpeechTimingRate();
        renderSpeechTimingTool();

        return true;
    }

    async function persistSpeechTimingProfile(
        profile
    ) {
        if (
            !signedInProfile ||
            !profile
        ) {
            return false;
        }

        const csrf =
            await ensureSpeechTrainingCsrfToken();

        const response =
            await fetch(
                API_BASE +
                    "api/speech-timing/",
                {
                    method:
                        "PUT",
                    credentials:
                        "same-origin",
                    cache:
                        "no-store",
                    headers: {
                        "Accept":
                            "application/json",
                        "Content-Type":
                            "application/json",
                        "X-CSRF-Token":
                            csrf
                    },
                    body:
                        JSON.stringify({
                            continuationPauseMeanMs:
                                profile
                                    .continuationPauseMeanMs,
                            continuationPauseVarianceMs2:
                                profile
                                    .continuationPauseVarianceMs2,
                            continuationPauseSamples:
                                profile
                                    .continuationPauseSamples,
                            streamSeparationMeanMs:
                                profile
                                    .streamSeparationMeanMs,
                            streamSeparationVarianceMs2:
                                profile
                                    .streamSeparationVarianceMs2,
                            streamSeparationSamples:
                                profile
                                    .streamSeparationSamples
                        })
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to save speech timing profile."
            );
        }

        globalThis
            .SpeechMenu
            ?.configureSpeechTimingProfile?.(
                data.profile ||
                profile
            );

        renderSpeechTimingTool();

        return true;
    }

    function startSpeechTimingToolUpdates() {
        clearInterval(
            speechTimingRenderTimer
        );

        renderSpeechTimingTool();

        speechTimingRenderTimer =
            setInterval(
                renderSpeechTimingTool,
                100
            );
    }

    function stopSpeechTimingToolUpdates() {
        clearInterval(
            speechTimingRenderTimer
        );
        speechTimingRenderTimer =
            undefined;
    }

    speechTimingDialog
        ?.addEventListener(
            "close",
            stopSpeechTimingToolUpdates
        );

    document.addEventListener(
        "speech-runtime-ready",
        () => {
            syncAdaptiveSpeechTimingRate();

            if (tripIsLive()) {
                globalThis
                    .SpeechMenu
                    ?.beginSpeechTimingTrip?.();
            }

            if (
                speechTimingDialog
                    ?.open
            ) {
                renderSpeechTimingTool();
            }
        }
    );

    async function ensureSpeechTrainingCsrfToken() {
        if (speechTrainingCsrfToken) {
            return speechTrainingCsrfToken;
        }

        const response =
            await fetch(
                API_BASE +
                "api/users/",
                {
                    credentials:
                        "same-origin",
                    cache:
                        "no-store",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (
            !response.ok ||
            typeof data.csrfToken !==
                "string" ||
            data.csrfToken.length <
                32
        ) {
            throw new Error(
                data.message ||
                "Unable to authorize speech training."
            );
        }

        speechTrainingCsrfToken =
            data.csrfToken;

        return speechTrainingCsrfToken;
    }

    async function persistInAppSpeechTrainingSample(
        sample
    ) {
        const target =
            sample?.target;

        const observed =
            String(
                sample?.observed ||
                ""
            ).trim();

        if (
            !target ||
            !observed
        ) {
            throw new Error(
                "The pending speech training sample is invalid."
            );
        }

        if (!signedInProfile) {
            throw new Error(
                "Sign in to commit pending speech training."
            );
        }

        const csrf =
            await ensureSpeechTrainingCsrfToken();

        const commandIdentity =
            target.commandId ||
            target.commandKey ||
            target.card ||
            "command";

        const componentKey =
            (
                target.source ===
                    "mic-bar"
                    ? "system:speech-controls"
                    : (
                        "app:" +
                        String(
                            target.category ||
                            "settings"
                        ) +
                        ":" +
                        String(
                            target.card ||
                            "default"
                        )
                    )
            ).slice(
                0,
                500
            );

        const phraseKey =
            (
                String(
                    commandIdentity
                ) +
                ":" +
                String(
                    target.phrase ||
                    target.display ||
                    ""
                )
            ).slice(
                0,
                500
            );

        const response =
            await fetch(
                API_BASE +
                "api/speech-corrections/?language=en-US",
                {
                    method:
                        "POST",
                    credentials:
                        "same-origin",
                    cache:
                        "no-store",
                    headers: {
                        "Accept":
                            "application/json",
                        "Content-Type":
                            "application/json",
                        "X-CSRF-Token":
                            csrf
                    },
                    body:
                        JSON.stringify({
                            action:
                                "sample",
                            language:
                                "en-US",
                            componentKey,
                            phraseKey,
                            phrase:
                                target.display ||
                                target.phrase,
                            canonical:
                                target.phrase ||
                                target.display,
                            observed,
                            source:
                                "manual",
                            trainingStyle:
                                "in-app",
                            pipeline:
                                sample.pipeline ||
                                globalThis
                                    .SpeechMenu
                                    ?.pipeline,
                            runtimeRevision:
                                sample.runtimeRevision ||
                                globalThis
                                    .SherpaRecognizer
                                    ?.runtimeRevision,
                            metadata: {
                                trainingTargetSource:
                                    target.source,
                                commandId:
                                    target.commandId ||
                                    null,
                                commandKey:
                                    target.commandKey ||
                                    null,
                                expectedPhrases:
                                    target.expectedPhrases ||
                                    [],
                                trainingResultState:
                                    sample.state ||
                                    null,
                                modelAccepted:
                                    Boolean(
                                        sample.modelAccepted
                                    ),
                                expected:
                                    Boolean(
                                        sample.expected
                                    ),
                                rawObserved:
                                    sample.rawObserved ||
                                    sample.observed ||
                                    null,
                                normalizedFinalArtifact:
                                    Boolean(
                                        sample.normalizedFinalArtifact
                                    ),
                                divergenceStatus:
                                    sample.divergenceStatus ||
                                    null
                            }
                        })
                }
            );

        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to save speech training sample."
            );
        }

        return data;
    }

    function clearPendingSpeechTrainingSamples() {
        speechTrainingPendingSamples
            .splice(
                0,
                speechTrainingPendingSamples
                    .length
            );

        return true;
    }

    async function commitPendingSpeechTrainingSamples() {
        while (
            speechTrainingPendingSamples
                .length
        ) {
            const sample =
                speechTrainingPendingSamples[
                    0
                ];

            const persisted =
                await persistInAppSpeechTrainingSample(
                    sample
                );

            sample.contributionId =
                persisted
                    ?.contribution
                    ?.id ||
                persisted
                    ?.sample
                    ?.id ||
                sample.contributionId;
            sample.committed =
                true;

            renderSpeechTrainingResults();

            speechTrainingPendingSamples
                .shift();

            if (
                speechTrainingPendingSamples
                    .length
            ) {
                renderPendingSpeechTrainingMessage();
            }
        }

        return true;
    }

    function pendingSpeechTrainingTargetLabel() {
        const target =
            speechTrainingPendingSamples[
                0
            ]?.target ||
            speechTrainingTarget;

        return (
            target?.display ||
            target?.phrase ||
            "this phrase"
        );
    }

    function renderPendingSpeechTrainingMessage(
        reason =
            speechTrainingPendingReason ||
            "exit"
    ) {
        const count =
            speechTrainingPendingSamples
                .length;

        if (
            !count ||
            !speechTrainingPendingMessage
        ) {
            return false;
        }

        const suffix =
            count === 1
                ? "utterance"
                : "utterances";

        speechTrainingPendingMessage
            .textContent =
            count +
            " pending " +
            suffix +
            " for “" +
            pendingSpeechTrainingTargetLabel() +
            "”. " +
            (
                reason ===
                    "switch"
                    ? "Commit or discard them before changing phrases."
                    : "Commit or discard them before leaving Speech Training."
            );

        return true;
    }

    function finishPendingSpeechTrainingDecision(
        result
    ) {
        const resolve =
            speechTrainingPendingDecisionResolve;

        speechTrainingPendingDecisionResolve =
            undefined;
        speechTrainingPendingDecision =
            undefined;
        speechTrainingPendingBusy =
            false;
        speechTrainingPendingReason =
            undefined;

        if (speechTrainingPendingDialog?.open) {
            closeDialog(
                speechTrainingPendingDialog,
                {
                    reason:
                        "speech-training-pending-" +
                        result
                }
            );
        }

        speechMicBar.trainingLocked =
            speechTrainingActive;

        resolve?.(
            result
        );
    }

    function promptPendingSpeechTrainingSamples(
        reason
    ) {
        if (
            !speechTrainingPendingSamples
                .length
        ) {
            return Promise.resolve(
                "none"
            );
        }

        if (
            speechTrainingPendingDecision
        ) {
            return speechTrainingPendingDecision;
        }

        speechTrainingPendingReason =
            reason;

        renderPendingSpeechTrainingMessage(
            reason
        );

        if (speechTrainingPendingError) {
            speechTrainingPendingError.hidden =
                true;
            speechTrainingPendingError.textContent =
                "";
        }

        speechTrainingPendingBusy =
            false;

        speechTrainingPendingCancel.disabled =
            false;
        speechTrainingPendingDiscard.disabled =
            false;
        speechTrainingPendingCommit.disabled =
            false;

        speechMicBar.trainingLocked =
            true;

        openDialogElement(
            speechTrainingPendingDialog,
            {
                reason:
                    "speech-training-pending"
            }
        );

        speechTrainingPendingDecision =
            new Promise(
                resolve => {
                    speechTrainingPendingDecisionResolve =
                        resolve;
                }
            );

        return speechTrainingPendingDecision;
    }

    async function enableInAppSpeechTraining() {
        if (
            speechTrainingActive ||
            !signedInProfile ||
            !speechTrainingConnectionAvailable
        ) {
            return false;
        }

        await ensureSpeechRuntime();

        const started =
            await enableSpeechRecognitionRuntime();

        if (!started) {
            throw new Error(
                "Speech recognition is unavailable."
            );
        }

        setSpeechButtonState(
            true,
            Boolean(
                globalThis
                    .SpeechMenu
                    ?.muted
            )
        );
        setSpeechLayoutState(
            true
        );

        inAppSpeechTrainingEnabled =
            true;

        speechMicBar.trainingMode =
            true;
        speechMicBar.trainingLocked =
            false;

        clearSpeechTrainingResults();
        resetSpeechTrainingTarget();

        globalThis.SpeechMenu
            ?.extrapolatePhrases?.();

        await speechMicBar
            ?.showOptions?.(
                globalThis
                    .SpeechMenu
                    ?.phraseGroups ||
                []
            );

        if (speechTrainingTarget) {
            showSpeechTrainingWidget();
        }

        mainMenu
            ?.hidePopover?.();

        syncSpeechTrainingControls();

        return true;
    }

    async function disableInAppSpeechTraining({
        promptPending = true
    } = {}) {
        if (speechTrainingActive) {
            return false;
        }

        if (
            promptPending &&
            speechTrainingPendingSamples
                .length
        ) {
            const decision =
                await promptPendingSpeechTrainingSamples(
                    "exit"
                );

            if (decision === "cancel") {
                return false;
            }
        }

        inAppSpeechTrainingEnabled =
            false;

        clearTimeout(
            speechTrainingPromptTimer
        );

        speechTrainingPromptTimer =
            undefined;

        speechMicBar.trainingActive =
            false;
        speechMicBar.trainingLocked =
            false;
        speechMicBar.trainingMode =
            false;

        void speechMicBar
            ?.hideOptions?.();

        if (speechTrainingWidget) {
            hideSpeechTrainingWidget();
            speechTrainingWidget.style.left =
                "";
            speechTrainingWidget.style.top =
                "";
            speechTrainingWidget.style.bottom =
                "";
            speechTrainingWidget.style.transform =
                "";
        }

        resetSpeechTrainingTarget({
            clearSelection:
                false
        });

        clearPendingSpeechTrainingSamples();

        syncSpeechTrainingControls();

        return true;
    }

    function startInAppSpeechTraining() {
        const speechMenu =
            globalThis.SpeechMenu;

        if (
            !inAppSpeechTrainingEnabled ||
            speechTrainingActive ||
            !speechTrainingTarget ||
            !speechMenu?.started ||
            speechMenu.muted
        ) {
            syncSpeechTrainingStartButton();
            return false;
        }

        clearTimeout(
            speechTrainingPromptTimer
        );

        speechTrainingSeenUtterances
            .clear();

        speechTrainingExecutionBeforeStart =
            speechMenu.executionEnabled;

        speechMenu.executionEnabled =
            false;

        speechTrainingActive =
            true;
        speechMicBar.trainingLocked =
            true;
        speechMicBar.trainingActive =
            true;

        setSpeechTrainingPrompt(
            "speak",
            "Speak"
        );

        syncSpeechTrainingControls();

        return true;
    }

    function stopInAppSpeechTraining({
        forced = false
    } = {}) {
        if (!speechTrainingActive) {
            if (forced) {
                void disableInAppSpeechTraining();
            }

            return false;
        }

        clearTimeout(
            speechTrainingPromptTimer
        );

        speechTrainingPromptTimer =
            undefined;

        speechTrainingActive =
            false;
        speechMicBar.trainingActive =
            false;
        speechMicBar.trainingLocked =
            false;

        if (globalThis.SpeechMenu) {
            globalThis.SpeechMenu
                .executionEnabled =
                speechTrainingExecutionBeforeStart;
        }

        setSpeechTrainingPrompt(
            globalThis.SpeechMenu
                ?.muted
                ? "muted"
                : "ready",
            globalThis.SpeechMenu
                ?.muted
                ? "Muted"
                : "Ready"
        );

        syncSpeechTrainingControls();

        if (forced) {
            void disableInAppSpeechTraining();
        }

        return true;
    }

    function openSpeechTrainingEditorMode() {
        if (
            !signedInProfile ||
            !hasSpeechDeveloperAccess()
        ) {
            return false;
        }

        const opened =
            window.open(
                API_BASE +
                "api/admin/speech-editor/?training=1",
                "wmofSpeechEditor"
            );

        if (!opened) {
            throw new Error(
                "The Speech Editor training window was blocked by the browser."
            );
        }

        return true;
    }

    function openDialog(id, { fromPopover = false, reason = "user" } = {}) {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return false;

        const caller = fromPopover && popoverIsOpen(mainMenu)
            ? { type: "popover", element: mainMenu }
            : undefined;
        if (caller) pushUIReturnFrame(caller);

        const opened = openDialogElement(dialog, {
            duration: 250,
            reason
        });

        if (
            opened &&
            dialog === graphicalDialog
        ) {
            updateGraphicalPreviewOverlap({
                immediate: true
            });
        }

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

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scopeToggle,
            event:
                "pointerup",
            name:
                "cycleGoalModePointerUp",
            action:
                "cycleGoalMode"
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

    const toggleRenderedTimeButton = $("#toggleRenderedTimeButton");

    function cancelRenderedTimeLongPress() {
        clearTimeout(renderedTimeLongPressTimer);
        renderedTimeLongPressTimer = undefined;
    }

    toggleRenderedTimeButton.addEventListener("pointerdown", event => {
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

    toggleRenderedTimeButton.addEventListener(
        "pointerup",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "toggleRenderedTimePointerUp",
                () => {
                    cancelRenderedTimeLongPress();

                    if (
                        renderedTimeLongPressed
                    ) {
                        renderedTimeLongPressed =
                            false;

                        return false;
                    }

                    return globalThis
                        .WMOFActions
                        .toggleRenderedTime();
                }
            )
    );

    for (const type of ["pointercancel", "pointerleave"]) {
        toggleRenderedTimeButton.addEventListener(type, cancelRenderedTimeLongPress);
    }

    toggleRenderedTimeButton.addEventListener("contextmenu", event => event.preventDefault());

    $("#endTimeGoalLock")?.addEventListener("click", event => {
        event.stopPropagation();

        globalThis
            .WMOFActions
            .releaseEndTimeGoal();
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
            globalThis
                .WMOFActions
                .toggleTimerMode();

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
                globalThis
                    .WMOFActions
                    .toggleTimerType();
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

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                toggleSyncMenuButton,
            event:
                "click",
            name:
                "toggleMenuSyncClick",
            action:
                "toggleSync",
            preventDefault:
                true
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                toggleSyncGoalButton,
            event:
                "click",
            name:
                "toggleGoalSyncClick",
            action:
                "toggleSync",
            preventDefault:
                true
        });

    tripListMenuButton?.addEventListener(
        "click",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "openTripLogMenuClick",
                () => {
                    mainMenu
                        ?.hidePopover?.();

                    return globalThis
                        .WMOFActions
                        .openTripLog(
                            "menu"
                        );
                }
            )
    );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                tripLogButton,
            event:
                "click",
            name:
                "openTripLogButtonClick",
            action:
                "openTripLog",
            args:
                () => [
                    "button"
                ]
        });

    tripLogSettingsButton?.addEventListener("click", () => {
        tripLogSettingsVisible = !tripLogSettingsVisible;
        tripLogSettingsButton.setAttribute("aria-expanded", String(tripLogSettingsVisible));
        tripLogSettingsButton.setAttribute("aria-label", tripLogSettingsVisible ? "Hide Trip Log settings" : "Show Trip Log settings");
        tripLogView?.setSettingsVisible(tripLogSettingsVisible);
    });
    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                tripLogCloseButton,
            event:
                "click",
            name:
                "closeTripLogClick",
            action:
                "closeTripLog",
            args:
                () => [
                    "close"
                ]
        });

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

    $("#graphicalSettingsForm").addEventListener(
        "submit",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "saveGraphicalSettingsSubmit",
                event => {
                    event.preventDefault();

                    const form =
                        event.currentTarget;

                    syncMilitaryToggleForTimeFormat(
                        form
                    );

                    syncTimeFormatForMilitaryToggle(
                        form
                    );

                    globalThis
                        .WMOFActions
                        .updateGraphicalSettings(
                            settingsFromForm(
                                form
                            )
                        );

                    void closeDialogWithReturn(
                        graphicalDialog,
                        {
                            reason:
                                "graphical-settings-save"
                        }
                    ).catch(
                        () => {}
                    );
                }
            )
    );

    $("#resetGraphicalSettings").addEventListener("click", () => fillGraphicalForm({ ...GRAPHICAL_DEFAULTS }));

    $("#stateSettingsForm").addEventListener(
        "submit",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "saveStateSettingsSubmit",
                event => {
                    event.preventDefault();

                    globalThis
                        .WMOFActions
                        .changeLateBreakBehavior(
                            event
                                .currentTarget
                                .elements
                                .lateBreakBehavior
                                .value
                        );

                    void closeDialogWithReturn(
                        stateDialog,
                        {
                            reason:
                                "state-settings-save"
                        }
                    ).catch(
                        () => {}
                    );
                }
            )
    );

    // Fullscreen must begin inside the Login click's user activation.
    function enterPortraitFullscreen() {
        if (fullscreenLoginAttempt || speechEditorPreview) return;

        const fullscreen = document.fullscreenElement
            ? Promise.resolve()
            : document.documentElement.requestFullscreen?.();

        fullscreenLoginAttempt = Promise.resolve(fullscreen)
            .then(async () => {
                if (document.fullscreenElement && screen.orientation?.lock) {
                    await screen.orientation.lock("portrait");
                }
            })
            .catch(error => {
                console.warn("Portrait fullscreen is unavailable:", error);
            })
            .finally(() => {
                // The fullscreen element may be placed above an existing
                // modal in the top layer. Keep Login in front until it succeeds.
                if (document.fullscreenElement && loginDialog.open &&
                    !loginConfirmedThisLoad) {
                    loginDialog.close();
                    loginDialog.showModal();
                    $("#loginUsername")?.focus({preventScroll: true});
                }
                fullscreenLoginAttempt = undefined;
            });
    }

    $("#loginButton").addEventListener("click", enterPortraitFullscreen);

    $("#loginForm").addEventListener(
        "submit",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "connectUserSubmit",
                async event => {
                    event.preventDefault();
                    enterPortraitFullscreen();

                    const error =
                        $("#loginError");

                    error.textContent =
                        "";

                    try {
                        await globalThis
                            .WMOFActions
                            .connectUser(
                                $("#loginUsername")
                                    .value,
                                $("#loginPassword")
                                    .value
                            );
                    }
                    catch (failure) {
                        error.textContent =
                            failure
                                ?.message ||
                            "Unable to login.";
                    }
                }
            )
    );

    authButton.addEventListener(
        "pointerup",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "changeAuthenticationPointerUp",
                async () => {
                    if (
                        clockTimer
                            .networkStatus !==
                            "online"
                    ) {
                        clearTimeout(
                            loginPromptTimeout
                        );

                        loginPromptTimeout =
                            undefined;

                        openDialog(
                            "loginDialog",
                            {
                                fromPopover:
                                    true,
                                reason:
                                    "popover-handoff"
                            }
                        );

                        return;
                    }

                    try {
                        await globalThis
                            .WMOFActions
                            .disconnectUser();
                    }
                    catch {}
                }
            )
    );

    let speechBuildTimer;

    function runSpeechBuildAnimation(
        open
    ) {
        const button =
            $("#speechMenuButton");

        clearTimeout(
            speechBuildTimer
        );

        button
            ?.classList
            .remove(
                "speech-build-active"
            );

        if (!open || !button) {
            return;
        }

        void button.offsetWidth;

        button
            .classList
            .add(
                "speech-build-active"
            );

        speechBuildTimer =
            setTimeout(
                () => {
                    button
                        .classList
                        .remove(
                            "speech-build-active"
                        );
                },
                1050
            );
    }

    mainMenu
        ?.addEventListener(
            "parentopening",
            event => {
                if (
                    event.detail
                        ?.button
                        ?.id ===
                    "speechMenuButton"
                ) {
                    runSpeechBuildAnimation(
                        true
                    );
                }
            }
        );

    mainMenu
        ?.addEventListener(
            "parentclosing",
            event => {
                if (
                    event.detail
                        ?.button
                        ?.id ===
                    "speechMenuButton"
                ) {
                    runSpeechBuildAnimation(
                        false
                    );
                }
            }
        );

    $("#newUserButton").addEventListener("click", () => {mainMenu?.hidePopover?.();$("#newUserFrame").src=`${API_BASE}api/admin/new-user/`;openDialog("newUserDialog",{fromPopover:true,reason:"admin-new-user"});});

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#accessTokensButton"),
            event:
                "click",
            name:
                "openAccessTokensClick",
            action:
                "openAccessTokens",
            preventDefault:
                true
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#speechEditorButton"),
            event:
                "click",
            name:
                "openSpeechEditorClick",
            action:
                "openSpeechEditor",
            preventDefault:
                true
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#speechTrainingButton"),
            event:
                "click",
            name:
                "openSpeechTrainingClick",
            action:
                "openSpeechTraining",
            preventDefault:
                true
        });

    $("#speechTrainingInAppChoice")
        ?.addEventListener(
            "click",
            async () => {
                closeDialog(
                    speechTrainingChoiceDialog,
                    {
                        reason:
                            "speech-training-in-app"
                    }
                );

                try {
                    await enableInAppSpeechTraining();
                }
                catch (error) {
                    console.error(error);
                }
            }
        );

    $("#speechTrainingEditorChoice")
        ?.addEventListener(
            "click",
            () => {
                closeDialog(
                    speechTrainingChoiceDialog,
                    {
                        reason:
                            "speech-training-editor"
                    }
                );

                openSpeechTrainingEditorMode();
            }
        );

    const setPendingSpeechTrainingButtonsDisabled =
        disabled => {
            speechTrainingPendingCancel.disabled =
                Boolean(disabled);
            speechTrainingPendingDiscard.disabled =
                Boolean(disabled);
            speechTrainingPendingCommit.disabled =
                Boolean(disabled);
        };

    speechTrainingPendingDialog
        ?.addEventListener(
            "cancel",
            event => {
                event.preventDefault();

                if (
                    !speechTrainingPendingBusy
                ) {
                    finishPendingSpeechTrainingDecision(
                        "cancel"
                    );
                }
            }
        );

    speechTrainingPendingCommit
        ?.addEventListener(
            "click",
            async () => {
                if (
                    speechTrainingPendingBusy
                ) {
                    return;
                }

                speechTrainingPendingBusy =
                    true;

                setPendingSpeechTrainingButtonsDisabled(
                    true
                );

                if (speechTrainingPendingError) {
                    speechTrainingPendingError.hidden =
                        true;
                    speechTrainingPendingError.textContent =
                        "";
                }

                try {
                    await commitPendingSpeechTrainingSamples();

                    finishPendingSpeechTrainingDecision(
                        "commit"
                    );
                }
                catch (error) {
                    speechTrainingPendingBusy =
                        false;

                    setPendingSpeechTrainingButtonsDisabled(
                        false
                    );

                    if (speechTrainingPendingError) {
                        speechTrainingPendingError.hidden =
                            false;
                        speechTrainingPendingError.textContent =
                            error?.message ||
                            "Unable to commit pending speech training.";
                    }
                }
            }
        );

    speechTrainingPendingDiscard
        ?.addEventListener(
            "click",
            () => {
                if (
                    speechTrainingPendingBusy
                ) {
                    return;
                }

                clearPendingSpeechTrainingSamples();

                finishPendingSpeechTrainingDecision(
                    "discard"
                );
            }
        );

    speechTrainingPendingCancel
        ?.addEventListener(
            "click",
            () => {
                if (
                    speechTrainingPendingBusy
                ) {
                    return;
                }

                finishPendingSpeechTrainingDecision(
                    "cancel"
                );
            }
        );

    speechTrainingStartStop
        ?.addEventListener(
            "click",
            () => {
                if (speechTrainingActive) {
                    stopInAppSpeechTraining();
                    return;
                }

                startInAppSpeechTraining();
            }
        );

    speechMicBar
        ?.addEventListener(
            "speech-options-opened",
            () => {
                if (
                    inAppSpeechTrainingEnabled &&
                    speechTrainingTarget
                ) {
                    showSpeechTrainingWidget({
                        promote: true
                    });
                }
            }
        );

    speechMicBar
        ?.addEventListener(
            "speech-training-target-requested",
            event => {
                if (
                    !inAppSpeechTrainingEnabled ||
                    speechTrainingActive
                ) {
                    event.preventDefault();
                    return;
                }

                const requested =
                    event.detail;

                const current =
                    speechTrainingTarget;

                const sameTarget =
                    current &&
                    requested &&
                    current.source ===
                        requested.source &&
                    current.category ===
                        requested.category &&
                    current.card ===
                        requested.card &&
                    current.phrase ===
                        requested.phrase;

                if (
                    sameTarget ||
                    !current ||
                    !speechTrainingPendingSamples
                        .length
                ) {
                    return;
                }

                event.preventDefault();

                if (
                    speechTrainingPendingDecision
                ) {
                    return;
                }

                void (
                    async () => {
                        const decision =
                            await promptPendingSpeechTrainingSamples(
                                "switch"
                            );

                        if (
                            decision ===
                                "cancel"
                        ) {
                            return;
                        }

                        speechMicBar
                            ?.selectTrainingTarget?.(
                                requested
                            );
                    }
                )();
            }
        );

    speechMicBar
        ?.addEventListener(
            "speech-training-target-selected",
            event => {
                if (
                    !inAppSpeechTrainingEnabled ||
                    speechTrainingActive
                ) {
                    return;
                }

                speechTrainingTarget = {
                    ...event.detail
                };

                showSpeechTrainingWidget({
                    promote: true
                });

                speechTrainingSeenUtterances
                    .clear();
                speechTrainingOutcomeByUtterance
                    .clear();

                if (speechTrainingPhrase) {
                    speechTrainingPhrase
                        .textContent =
                        speechTrainingTarget
                            .display ||
                        speechTrainingTarget
                            .phrase ||
                        "Command";
                }

                setSpeechTrainingHeardResult();
                updateSpeechTrainingCount();
                syncSpeechTrainingStartButton();
            }
        );

    speechMicBar
        ?.addEventListener(
            "speech-training-telemetry",
            event => {
                if (!inAppSpeechTrainingEnabled) {
                    return;
                }

                const telemetry =
                    event.detail ||
                    {};

                speechTrainingWidget
                    ?.dispatchEvent(
                        new CustomEvent(
                            "speech-training-metrics",
                            {
                                bubbles: true,
                                detail: {
                                    ...telemetry
                                }
                            }
                        )
                    );

                if (
                    telemetry.type ===
                        "muted" ||
                    telemetry.type ===
                        "unmuted" ||
                    telemetry.type ===
                        "started" ||
                    telemetry.type ===
                        "listeningResumed"
                ) {
                    syncSpeechTrainingStartButton();
                }

                if (!speechTrainingActive) {
                    return;
                }

                const utteranceId =
                    telemetry.utteranceId ??
                    telemetry.event
                        ?.id ??
                    telemetry.event
                        ?.utteranceId;

                const transcript =
                    String(
                        telemetry.heard ||
                        telemetry.event
                            ?.transcript ||
                        telemetry.transcript ||
                        ""
                    ).trim();

                if (
                    transcript &&
                    speechTrainingHeard
                ) {
                    speechTrainingHeard
                        .textContent =
                        "Heard: " +
                        transcript;
                }

                if (
                    telemetry.type ===
                        "utteranceTranscriptChanged" &&
                    telemetry.event
                        ?.isFinal !==
                            true &&
                    utteranceId !==
                        undefined &&
                    transcript
                ) {
                    const outcome =
                        speechTrainingOutcomeByUtterance
                            .get(
                                utteranceId
                            ) ||
                        {
                            matchedExpected:
                                false,
                            lastLiveTranscript:
                                ""
                        };

                    outcome
                        .lastLiveTranscript =
                        transcript;

                    speechTrainingOutcomeByUtterance
                        .set(
                            utteranceId,
                            outcome
                        );
                }

                if (
                    telemetry.type ===
                        "utteranceStarted"
                ) {
                    if (
                        utteranceId !==
                            undefined
                    ) {
                        speechTrainingOutcomeByUtterance
                            .set(
                                utteranceId,
                                {
                                    matchedExpected:
                                        false,
                                    lastLiveTranscript:
                                        ""
                                }
                            );
                    }

                    clearTimeout(
                        speechTrainingPromptTimer
                    );

                    setSpeechTrainingPrompt(
                        "speak",
                        "Speak"
                    );

                    return;
                }

                if (
                    telemetry.type ===
                        "speechCommandMatched" &&
                    utteranceId !==
                        undefined
                ) {
                    const outcome =
                        speechTrainingOutcomeByUtterance
                            .get(
                                utteranceId
                            ) ||
                        {
                            matchedExpected:
                                false
                        };

                    if (
                        speechTrainingTargetMatchesCommand(
                            speechTrainingTarget,
                            telemetry.event
                                ?.commandElement
                        )
                    ) {
                        outcome.matchedExpected =
                            true;
                    }

                    speechTrainingOutcomeByUtterance
                        .set(
                            utteranceId,
                            outcome
                        );

                    return;
                }

                if (
                    telemetry.type ===
                        "utteranceTranscribed"
                ) {
                    return;
                }

                if (
                    telemetry.type ===
                        "utteranceFinished"
                ) {
                    clearTimeout(
                        speechTrainingPromptTimer
                    );

                    setSpeechTrainingPrompt(
                        "pause",
                        "Pause"
                    );

                    speechTrainingPromptTimer =
                        setTimeout(
                            () => {
                                if (
                                    speechTrainingActive &&
                                    !globalThis
                                        .SpeechMenu
                                        ?.muted
                                ) {
                                    setSpeechTrainingPrompt(
                                        "speak",
                                        "Speak"
                                    );
                                }
                            },
                            650
                        );

                    return;
                }

                if (
                    ![
                        "utteranceCommitted",
                        "utteranceUnrecognized"
                    ].includes(
                        telemetry.type
                    )
                ) {
                    return;
                }

                finalizeSpeechTrainingResult(
                    telemetry
                );
            }
        );

    if (speechTrainingDragHandle) {
        let drag;

        const move =
            event => {
                if (
                    !drag ||
                    event.pointerId !==
                        drag.pointerId
                ) {
                    return;
                }

                const width =
                    speechTrainingWidget
                        .offsetWidth;

                const height =
                    speechTrainingWidget
                        .offsetHeight;

                const left =
                    Math.max(
                        4,
                        Math.min(
                            window.innerWidth -
                                width -
                                4,
                            event.clientX -
                                drag.offsetX
                        )
                    );

                const top =
                    Math.max(
                        4,
                        Math.min(
                            window.innerHeight -
                                height -
                                4,
                            event.clientY -
                                drag.offsetY
                        )
                    );

                speechTrainingWidget
                    .style
                    .setProperty(
                        "left",
                        left + "px"
                    );

                speechTrainingWidget
                    .style
                    .setProperty(
                        "top",
                        top + "px"
                    );

                speechTrainingWidget
                    .style
                    .setProperty(
                        "bottom",
                        "auto"
                    );

                speechTrainingWidget
                    .style
                    .setProperty(
                        "transform",
                        "none"
                    );
            };

        const finish =
            event => {
                if (
                    !drag ||
                    event.pointerId !==
                        drag.pointerId
                ) {
                    return;
                }

                try {
                    speechTrainingDragHandle
                        .releasePointerCapture(
                            event.pointerId
                        );
                }
                catch {}

                drag =
                    undefined;
            };

        speechTrainingDragHandle
            .addEventListener(
                "pointerdown",
                event => {
                    if (
                        speechTrainingWidget
                            ?.hidden
                    ) {
                        return;
                    }

                    const rect =
                        speechTrainingWidget
                            .getBoundingClientRect();

                    drag = {
                        pointerId:
                            event.pointerId,
                        offsetX:
                            event.clientX -
                            rect.left,
                        offsetY:
                            event.clientY -
                            rect.top
                    };

                    speechTrainingWidget
                        .style
                        .setProperty(
                            "left",
                            rect.left +
                                "px"
                        );

                    speechTrainingWidget
                        .style
                        .setProperty(
                            "top",
                            rect.top +
                                "px"
                        );

                    speechTrainingWidget
                        .style
                        .setProperty(
                            "bottom",
                            "auto"
                        );

                    speechTrainingWidget
                        .style
                        .setProperty(
                            "transform",
                            "none"
                        );

                    speechTrainingDragHandle
                        .setPointerCapture(
                            event.pointerId
                        );
                }
            );

        speechTrainingDragHandle
            .addEventListener(
                "pointermove",
                move
            );

        speechTrainingDragHandle
            .addEventListener(
                "pointerup",
                finish
            );

        speechTrainingDragHandle
            .addEventListener(
                "pointercancel",
                finish
            );
    }

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#speechTimingButton"),
            event:
                "click",
            name:
                "openSpeechTimingClick",
            action:
                "openSpeechTiming",
            preventDefault:
                true
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#developerDocsButton"),
            event:
                "click",
            name:
                "openDeveloperDocsClick",
            action:
                "openDeveloperDocs",
            preventDefault:
                true
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#sqlConsoleButton"),
            event:
                "click",
            name:
                "openSqlConsoleClick",
            action:
                "openSqlConsole",
            preventDefault:
                true
        });

    $("#profileForm").addEventListener(
        "submit",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "saveProfileSubmit",
                event => {
                    event.preventDefault();

                    globalThis
                        .WMOFActions
                        .saveProfileData(
                            Object.fromEntries(
                                new FormData(
                                    event
                                        .currentTarget
                                )
                            )
                        );

                    void closeDialogWithReturn(
                        profileDialog,
                        {
                            reason:
                                "profile-save"
                        }
                    ).catch(
                        () => {}
                    );
                }
            )
    );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#resetPasswordButton"),
            event:
                "click",
            name:
                "requestPasswordResetClick",
            action:
                "requestPasswordReset"
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

    function installNumberPadSpeechCommands() {
        if (
            !numberPadDialog
                ?.isConnected ||
            !englishSpeech ||
            typeof installSpeechCommand !==
                "function"
        ) {
            return false;
        }

        installSpeechCommand(
            "voice",
            "switchNumberPadToVoice",
            numberPadDialog,
            false
        );

        globalThis
            .SpeechMenu
            ?.refresh?.();

        return true;
    }

    function installVoiceEntrySpeechCommands() {
        if (
            !voiceEntrySurface
                ?.isConnected ||
            !englishSpeech ||
            typeof installSpeechCommand !==
                "function"
        ) {
            return false;
        }

        for (
            const key of [
                "keypadValue",
                "voiceEntryConfirm",
                "voiceEntryCancel",
                "voiceEntryTouch",
                "voiceEntryDefer"
            ]
        ) {
            const valueCommand =
                key ===
                    "keypadValue";

            const command =
                installSpeechCommand(
                    key,
                    "handleVoiceEntrySpeech",
                    voiceEntrySurface,
                    false,
                    ...(
                        valueCommand
                            ? [
                                "keypad",
                                "spokenValue"
                            ]
                            : []
                    )
                );

            if (!command) {
                continue;
            }

            command.dataset
                .speechTarget =
                "#voiceEntrySurface";

            if (valueCommand) {
                command.setAttribute(
                    "speech-open-ended",
                    ""
                );
                command.dataset
                    .speechOptionsPhrase =
                    "<spokenValue>";
            }
        }

        globalThis
            .SpeechMenu
            ?.refresh?.();

        return true;
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
                numberPadReset = $("#numberPadReset");
                numberPadCancel = $("#numberPadCancel");
                numberPadConfirm = $("#numberPadConfirm");
                numberPadVoice = $("#numberPadVoice");
                numberPadContext = $("#numberPadContext");
                numberPadReadout = $("#numberPadReadout");
                numberPadDate = $("#numberPadDate");
                numberPadDateRow = $("#numberPadDateRow");
                numberPadAM = $("#numberPadAM");
                numberPadPM = $("#numberPadPM");
                bindNumberPadEvents();
                setOkAllowed(
                    numberPadDialog,
                    false
                );

                installNumberPadSpeechCommands();
            })().catch(error => {
                numberPadLoadPromise = undefined;
                throw error;
            });
        }
        await numberPadLoadPromise;
    }

    function durationValueToRawDigits(
        milliseconds
    ) {
        if (
            !Number.isSafeInteger(
                milliseconds
            ) ||
            milliseconds < 0
        ) {
            return "";
        }

        const totalSeconds =
            Math.floor(
                milliseconds /
                1000
            );

        const hours =
            Math.floor(
                totalSeconds /
                3600
            );

        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                60
            );

        const seconds =
            totalSeconds %
            60;

        if (hours > 0) {
            return (
                String(hours) +
                String(minutes)
                    .padStart(2, "0") +
                String(seconds)
                    .padStart(2, "0")
            );
        }

        return (
            String(minutes) +
            String(seconds)
                .padStart(2, "0")
        );
    }

    function canonicalClockTimerDuration(
        milliseconds
    ) {
        if (
            !Number.isSafeInteger(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        return formatTimelineMilliseconds(
            milliseconds
        );
    }

    function displayClockTimerDuration(
        milliseconds
    ) {
        if (
            !Number.isSafeInteger(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return "";
        }

        return (
            EnglishDurationParser
                ?.format?.(
                    milliseconds
                ) ||
            formatTimelineMilliseconds(
                milliseconds
            ) ||
            ""
        );
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

        return (
            String(
                Number(
                    parts.hoursText ||
                    0
                )
            ) +
            ":" +
            String(
                Number(
                    parts.minutesText
                )
            ).padStart(
                2,
                "0"
            ) +
            ":" +
            parts.secondsText
        );
    }

    function timeDigitsValid(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return false;
        return Number(parts.minutesText) < 60 && Number(parts.secondsText) < 60;
    }

    function timeDigitsToMilliseconds(raw) {
        const parts = splitTimeDigits(raw);

        if (
            !parts ||
            Number(parts.minutesText) >= 60 ||
            Number(parts.secondsText) >= 60
        ) {
            return undefined;
        }

        const milliseconds =
            (
                Number(parts.hoursText || 0) * 3600 +
                Number(parts.minutesText) * 60 +
                Number(parts.secondsText)
            ) * 1000;

        return Number.isSafeInteger(milliseconds)
            ? milliseconds
            : undefined;
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
            return totalScopeLabel() + " Percent";
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

        numberPadClear.dataset.action =
            "clear";
        numberPadClear.setAttribute(
            "aria-label",
            "Clear"
        );

        numberPadReset?.setAttribute(
            "aria-label",
            "Reset"
        );

        numberPadCancel?.setAttribute(
            "aria-label",
            "Cancel"
        );

        const valid = numberPadValueValid();
        const startsTrip = Boolean(numberPadState.startsTripOnConfirm);
        const confirmAction = startsTrip ? "start" : "confirm";
        numberPadConfirm.dataset.action = confirmAction;
        numberPadConfirm.setAttribute(
            "aria-label",
            startsTrip ? "Start Trip" : "Confirm"
        );
        numberPadConfirm.disabled = !valid;

        setOkAllowed(
            numberPadDialog,
            !numberPadConfirm.disabled
        );

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

    let numberPadAmbientTone;
    let numberPadAmbientToneGeneration = 0;
    const activeNumberPadTouchTones =
        new Map();

    function startNumberPadAmbientTone() {
        const generation =
            ++numberPadAmbientToneGeneration;

        numberPadAmbientTone
            ?.stop?.();
        numberPadAmbientTone =
            undefined;

        void globalThis
            .WMOFAudio
            ?.startFrequencies?.(
                [350, 440],
                {
                    waveform: "square",
                    volume: 0.01,
                    reason:
                        "number-pad-ambient",
                }
            )
            .then(
                handle => {
                    if (
                        generation !==
                        numberPadAmbientToneGeneration
                    ) {
                        handle
                            ?.stop?.();
                        return;
                    }

                    numberPadAmbientTone =
                        handle;
                }
            )
            .catch(
                error =>
                    console.error(
                        "Number pad ambient tone failed:",
                        error
                    )
            );
    }

    function stopNumberPadAmbientTone() {
        numberPadAmbientToneGeneration++;
        numberPadAmbientTone
            ?.stop?.();
        numberPadAmbientTone =
            undefined;
    }

    function stopNumberPadTouchTone(
        button
    ) {
        const state =
            activeNumberPadTouchTones
                .get(
                    button
                );

        if (!state) {
            return;
        }

        state.released =
            true;

        state.handle
            ?.stop?.();

        activeNumberPadTouchTones
            .delete(
                button
            );
    }

    function stopAllNumberPadAudio() {
        stopNumberPadAmbientTone();

        for (
            const button of
            Array.from(
                activeNumberPadTouchTones
                    .keys()
            )
        ) {
            stopNumberPadTouchTone(
                button
            );
        }
    }

    function createNumberPadState({
        mode,
        source,
        initialValue = "",
        tripDefaults,
        startsTripOnConfirm = false,
        role = "root",
        workflow,
        cancelTarget,
        confirmTarget,
        backTarget,
        onConfirm,
        onCancel,
        title,
        allowEmpty = false
    } = {}) {
        if (
            typeof confirmTarget !== "string" ||
            !confirmTarget.trim() ||
            typeof cancelTarget !== "string" ||
            !cancelTarget.trim()
        ) {
            throw new TypeError(
                "Input requires explicit confirmTarget and cancelTarget."
            );
        }

        const normalizedMode =
            mode === "percent"
                ? "percent"
                : mode === "absolute"
                    ? "absolute"
                    : "duration";
        const normalizedRole =
            role === "trip-settings-field"
                ? "trip-settings-field"
                : "root";

        let initial;
        let initialDate;
        let initialMeridiem;

        if (normalizedMode === "absolute") {
            const absolute =
                getAbsolutePadInitial(
                    initialValue,
                    tripDefaults?.creationDate
                );

            initial = absolute.digits;
            initialDate = absolute.date;
            initialMeridiem = absolute.meridiem;
        }
        else {
            initial =
                normalizedMode === "percent"
                    ? normalizePercentDigits(
                        initialValue
                    )
                    : durationValueToRawDigits(
                        Number.isSafeInteger(initialValue)
                            ? initialValue
                            : parseTimelineTime(
                                initialValue
                            )
                    );
        }

        const state = {
            mode: normalizedMode,
            onConfirm,
            onCancel,
            source,
            title:
                title ||
                getNumberPadTitle(
                    source
                ),
            initial,
            pending: initial,
            initialDate,
            pendingDate: initialDate,
            initialMeridiem,
            meridiem: initialMeridiem,
            replaceOnNextDigit:
                source !== "new-trip",
            persistence:
                source === "new-trip"
                    ? "pending"
                    : normalizedConnectionStatus(),
            connectionPresentation:
                source === "new-trip"
                    ? "initial"
                    : "settled",
            connectionStatusToken:
                ++numberPadConnectionSequence,
            tripDefaults,
            startsTripOnConfirm:
                Boolean(
                    startsTripOnConfirm
                ),
            role: normalizedRole,
            workflow:
                workflow ||
                (
                    source === "new-trip"
                        ? "new-trip"
                        : tripIsLive()
                            ? "edit-trip"
                            : null
                ),
            cancelTarget,
            confirmTarget,
            backTarget,
            everEdited: false,
            allowEmpty:
                Boolean(
                    allowEmpty
                )
        };

        if (
            source === "new-trip" &&
            state.persistence === "pending"
        ) {
            state.connectionAnimationStartedAt =
                performance.now();
        }

        return state;
    }

    function resolveValueEditorInputMode(
        inputMode
    ) {
        if (
            inputMode === "voice" ||
            inputMode === "touch"
        ) {
            return inputMode;
        }

        return globalThis
            .SpeechMenu
            ?.executionContext
                ? "voice"
                : "touch";
    }

    async function openTouchValueEditor(
        state,
        {
            preparationPromise,
            duration = 250,
            signal
        } = {}
    ) {
        if (signal?.aborted) {
            return false;
        }

        await ensureNumberPadLoaded();

        if (signal?.aborted) {
            return false;
        }

        numberPadState = state;
        refreshNumberPad();
        mainMenu?.hidePopover?.();

        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration,
                reason:
                    `number-pad:${state.source}`
            });
        }

        requestAnimationFrame(
            () => {
                if (
                    tripTransitionOverlayIsVisible()
                ) {
                    promoteTripTransitionOverlay();
                }

                syncTripTransitionEditorLayout();
            }
        );

        queueMicrotask(
            () =>
                speechMicBar
                    ?.promoteTopLayer?.()
        );

        startNumberPadAmbientTone();

        if (state.source === "new-trip") {
            void settleInitialNumberPadConnection(
                state,
                preparationPromise ??
                    Promise.resolve()
            );
        }

        return true;
    }

    async function openValueEditor(
        options = {},
        inputMode
    ) {
        if (options.signal?.aborted) {
            return false;
        }

        const state =
            createNumberPadState(
                options
            );

        const mode =
            resolveValueEditorInputMode(
                inputMode
            );

        if (mode === "voice") {
            return openVoiceValueEditor(
                state,
                {
                    signal:
                        options.signal
                }
            );
        }

        return openTouchValueEditor(
            state,
            options
        );
    }

    function openNumberPad(
        options = {}
    ) {
        return openValueEditor(
            options
        );
    }

    function voiceEntryCopyForMode(mode) {
        if (mode === "percent") {
            return {
                prompt: "Say Percent",
                example: "Example: “eighty-five percent”"
            };
        }

        if (mode === "absolute") {
            return {
                prompt: "Say Time",
                example: "Example: “eight thirty A M”"
            };
        }

        return {
            prompt: "Say Duration",
            example: "Example: “five minutes”"
        };
    }

    function voiceEntryDescriptor(
        state = numberPadState
    ) {
        if (!state) {
            return "";
        }

        const source =
            String(
                state.source ||
                ""
            );
        const title =
            String(
                state.title ||
                ""
            ).trim();

        if (
            state.startsTripOnConfirm ||
            source === "new-trip"
        ) {
            return "Standard Time";
        }

        if (source === "trip-goal") {
            return "Trip Percent Goal";
        }

        if (source === "total-goal") {
            return (
                totalScopeLabel() +
                " Percent Goal"
            );
        }

        if (
            source === "end-time-goal" ||
            source === "end-time"
        ) {
            return "End Time";
        }

        if (source === "creation-time") {
            return "Creation Time";
        }

        if (source === "scheduled-start") {
            return "Scheduled Start";
        }

        if (source === "actual-start") {
            return "Actual Start";
        }

        if (source === "standard-time") {
            return "Standard Time";
        }

        if (state.mode === "percent") {
            if (/percent/i.test(title)) {
                return title;
            }

            if (/goal/i.test(title)) {
                return title.replace(
                    /goal/i,
                    "Percent Goal"
                );
            }

            return (
                title
                    ? title + " Percent"
                    : "Percent"
            );
        }

        return (
            title ||
            (
                state.mode === "absolute"
                    ? "Time"
                    : "Duration"
            )
        );
    }

    function voiceEntryPromptForState(
        state = numberPadState
    ) {
        const descriptor =
            voiceEntryDescriptor(
                state
            );

        return descriptor
            ? "Say " + descriptor
            : voiceEntryCopyForMode(
                state?.mode
            ).prompt;
    }

    function voiceEntryInvalidPrompt(
        state = numberPadState
    ) {
        const descriptor =
            voiceEntryDescriptor(
                state
            );

        return descriptor
            ? "Say a Valid " +
                descriptor
            : "Say a Valid Value";
    }

    function voiceEntryActionCopy(
        state = numberPadState
    ) {
        const title =
            String(
                state?.title ||
                "value"
            ).trim() ||
            "value";
        const source =
            String(
                state?.source ||
                ""
            );

        if (state?.startsTripOnConfirm) {
            return {
                ok: "start the trip",
                cancel: "cancel the new trip"
            };
        }

        if (source === "trip-goal") {
            return {
                ok: "set the Trip goal",
                cancel: "keep the current Trip goal"
            };
        }

        if (source === "total-goal") {
            const scopeLabel =
                totalScopeLabel();

            return {
                ok:
                    `set the ${scopeLabel} goal`,
                cancel:
                    `keep the current ${scopeLabel} goal`
            };
        }

        if (
            source === "end-time-goal" ||
            source === "end-time"
        ) {
            return {
                ok: "set the End Time",
                cancel: "keep the current End Time"
            };
        }

        if (source === "creation-time") {
            return {
                ok: "set the Creation Time",
                cancel: "keep the current Creation Time"
            };
        }

        if (source === "scheduled-start") {
            return {
                ok: "set the Scheduled Start",
                cancel: "keep the current Scheduled Start"
            };
        }

        if (source === "actual-start") {
            return {
                ok: "set the Actual Start",
                cancel: "keep the current Actual Start"
            };
        }

        if (source === "standard-time") {
            return {
                ok: "set the Standard Time",
                cancel: "keep the current Standard Time"
            };
        }

        if (
            state?.role ===
                "trip-settings-field"
        ) {
            return {
                ok:
                    `set ${title}`,
                cancel:
                    `keep the current ${title}`
            };
        }

        if (state?.onConfirm) {
            return {
                ok:
                    `apply ${title}`,
                cancel:
                    "go back without changes"
            };
        }

        return {
            ok:
                `save ${title}`,
            cancel:
                "go back without changes"
        };
    }

    function pulseVoiceEntryInstructions() {
        if (!voiceEntryInstructions) {
            return;
        }

        voiceEntryInstructions
            .classList
            .remove(
                "is-attention"
            );

        void voiceEntryInstructions
            .offsetWidth;

        voiceEntryInstructions
            .classList
            .add(
                "is-attention"
            );
    }

    function voiceEntryIsVisible() {
        if (
            !voiceEntrySurface ||
            voiceEntrySurface.hidden
        ) {
            return false;
        }

        try {
            return (
                voiceEntrySurface
                    .matches(
                        ":popover-open"
                    ) ||
                !voiceEntrySurface
                    .hasAttribute(
                        "popover"
                    )
            );
        }
        catch {
            return !voiceEntrySurface.hidden;
        }
    }

    function numberPadIsVisible() {
        return Boolean(
            numberPadDialog
                ?.open &&
            !numberPadDialog
                .classList
                .contains(
                    "dialog-closing"
                )
        );
    }

    function tripTransitionOverlayIsVisible() {
        return Boolean(
            tripTransitionOverlay &&
            !tripTransitionOverlay.hidden &&
            tripTransitionOverlay
                .classList
                .contains(
                    "is-visible"
                )
        );
    }

    function resetTripTransitionEditorLayout() {
        voiceEntrySurface
            ?.style
            .removeProperty(
                "--voice-entry-summary-shift-y"
            );

        numberPadDialog
            ?.style
            .removeProperty(
                "--number-pad-summary-shift-y"
            );
        numberPadDialog
            ?.style
            .removeProperty(
                "--number-pad-summary-scale"
            );

        tripTransitionOverlay
            ?.style
            .removeProperty(
                "--trip-transition-summary-shift-y"
            );
        tripTransitionOverlay
            ?.style
            .removeProperty(
                "--trip-transition-summary-max-height"
            );
        tripTransitionOverlay
            ?.classList
            .remove(
                "has-voice-entry",
                "has-number-pad"
            );
    }

    function promoteTripTransitionOverlay() {
        if (
            !tripTransitionOverlayIsVisible() ||
            !tripTransitionOverlay
                ?.hasAttribute(
                    "popover"
                )
        ) {
            return false;
        }

        try {
            if (
                tripTransitionOverlay
                    .matches(
                        ":popover-open"
                    )
            ) {
                tripTransitionOverlay
                    .hidePopover?.();
            }

            tripTransitionOverlay.hidden =
                false;
            tripTransitionOverlay
                .showPopover?.();

            return true;
        }
        catch {
            return false;
        }
    }

    function syncTripTransitionEditorLayout(
        active =
            tripTransitionOverlayIsVisible()
    ) {
        if (
            !tripTransitionOverlay ||
            !active
        ) {
            resetTripTransitionEditorLayout();
            return false;
        }

        const voiceVisible =
            voiceEntryIsVisible();
        const numberPadVisible =
            !voiceVisible &&
            numberPadIsVisible();

        if (
            !voiceVisible &&
            !numberPadVisible
        ) {
            resetTripTransitionEditorLayout();
            return false;
        }

        const type =
            voiceVisible
                ? "voice"
                : "number-pad";
        const editor =
            voiceVisible
                ? voiceEntrySurface
                : numberPadDialog;
        const viewportHeight =
            Math.max(
                0,
                Number(
                    globalThis
                        .visualViewport
                        ?.height
                ) ||
                globalThis.innerHeight ||
                document
                    .documentElement
                    .clientHeight ||
                0
            );
        const panel =
            tripTransitionOverlay
                .querySelector(
                    ".trip-transition-overlay-panel"
                );
        const editorHeight =
            Math.ceil(
                editor?.offsetHeight ||
                editor
                    ?.getBoundingClientRect()
                    .height ||
                0
            );
        const naturalSummaryHeight =
            Math.ceil(
                panel?.scrollHeight ||
                panel?.offsetHeight ||
                0
            );
        const gap =
            type === "number-pad"
                ? 12
                : 16;

        if (
            !viewportHeight ||
            !editorHeight ||
            !naturalSummaryHeight
        ) {
            return false;
        }

        let editorScale =
            1;
        let maxSummaryHeight;

        if (type === "number-pad") {
            const preferredSummaryHeight =
                Math.min(
                    naturalSummaryHeight,
                    Math.max(
                        72,
                        viewportHeight *
                            0.26
                    )
                );
            const editorRoom =
                Math.max(
                    1,
                    viewportHeight -
                        preferredSummaryHeight -
                        gap * 3
                );

            editorScale =
                Math.min(
                    1,
                    Math.max(
                        0.4,
                        editorRoom /
                            editorHeight
                    )
                );

            const scaledEditorHeight =
                editorHeight *
                editorScale;

            maxSummaryHeight =
                Math.max(
                    64,
                    viewportHeight -
                        scaledEditorHeight -
                        gap * 3
                );
        }
        else {
            maxSummaryHeight =
                Math.max(
                    96,
                    viewportHeight -
                        editorHeight -
                        gap * 3
                );
        }

        const summaryHeight =
            Math.min(
                naturalSummaryHeight,
                maxSummaryHeight
            );
        const scaledEditorHeight =
            editorHeight *
            editorScale;
        const stackHeight =
            summaryHeight +
            gap +
            scaledEditorHeight;
        const stackTop =
            Math.max(
                gap,
                (
                    viewportHeight -
                    stackHeight
                ) /
                    2
            );
        const viewportCenter =
            viewportHeight /
            2;
        const summaryCenter =
            stackTop +
            summaryHeight /
                2;
        const editorCenter =
            stackTop +
            summaryHeight +
            gap +
            scaledEditorHeight /
                2;

        tripTransitionOverlay
            .classList
            .toggle(
                "has-voice-entry",
                type === "voice"
            );
        tripTransitionOverlay
            .classList
            .toggle(
                "has-number-pad",
                type === "number-pad"
            );
        tripTransitionOverlay
            .style
            .setProperty(
                "--trip-transition-summary-max-height",
                `${Math.floor(
                    maxSummaryHeight
                )}px`
            );
        tripTransitionOverlay
            .style
            .setProperty(
                "--trip-transition-summary-shift-y",
                `${Math.round(
                    summaryCenter -
                    viewportCenter
                )}px`
            );

        if (type === "voice") {
            voiceEntrySurface
                .style
                .setProperty(
                    "--voice-entry-summary-shift-y",
                    `${Math.round(
                        editorCenter -
                            viewportCenter
                    )}px`
                );
        }
        else {
            numberPadDialog
                .style
                .setProperty(
                    "--number-pad-summary-shift-y",
                    `${Math.round(
                        editorCenter -
                            viewportCenter
                    )}px`
                );
            numberPadDialog
                .style
                .setProperty(
                    "--number-pad-summary-scale",
                    String(
                        editorScale
                    )
                );
        }

        return true;
    }

    function renderVoiceEntry({
        prompt,
        example,
        value,
        attention = false
    } = {}) {
        if (!voiceEntrySurface) {
            return false;
        }

        voiceEntryTitle.textContent =
            voiceEntryDescriptor(
                numberPadState
            ) ||
            numberPadState?.title ||
            "Voice Entry";

        const copy =
            voiceEntryCopyForMode(
                numberPadState?.mode
            );

        voiceEntryPrompt.textContent =
            prompt ||
            voiceEntryPromptForState(
                numberPadState
            ) ||
            copy.prompt;
        voiceEntryExample.textContent =
            example ||
            copy.example;

        const actionCopy =
            voiceEntryActionCopy();

        if (voiceEntryOkAction) {
            voiceEntryOkAction.textContent =
                actionCopy.ok;
        }

        if (voiceEntryCancelAction) {
            voiceEntryCancelAction.textContent =
                actionCopy.cancel;
        }

        voiceEntryInstructions
            ?.classList
            .toggle(
                "is-ready",
                numberPadValueValid()
            );

        if (attention) {
            pulseVoiceEntryInstructions();
        }

        const hasValue =
            typeof value === "string" &&
            value.trim();

        voiceEntryValue.hidden =
            !hasValue;
        voiceEntryValue.textContent =
            hasValue
                ? value
                : "";

        return true;
    }

    function announceVoiceEntryPrompt() {
        const prompt =
            voiceEntryPromptForState(
                numberPadState
            );

        if (!prompt) {
            return false;
        }

        return Boolean(
            globalThis
                .WMOFAudio
                ?.speak?.(
                    prompt
                )
        );
    }

    function speakVoiceEntryFeedback(
        spokenValue,
        action,
        sequence
    ) {
        const value =
            String(
                spokenValue ||
                ""
            ).trim();
        const okAction =
            String(
                action ||
                ""
            ).trim();
        const audio =
            globalThis.WMOFAudio;

        if (
            !value ||
            !okAction ||
            !audio?.speak
        ) {
            return false;
        }

        return Boolean(
            audio.speak(
                value,
                {
                    onEnd:
                        () => {
                            setTimeout(
                                () => {
                                    if (
                                        sequence !==
                                            voiceEntryFeedbackSequence ||
                                        !voiceEntryState
                                    ) {
                                        return;
                                    }

                                    audio.speak(
                                        "Say OK to " +
                                            okAction
                                    );
                                },
                                220
                            );
                        }
                }
            )
        );
    }

    function hideVoiceEntrySurface() {
        voiceEntryFeedbackSequence++;

        syncTripTransitionEditorLayout(
            false
        );

        clearTimeout(
            voiceEntryAcceptTimer
        );
        voiceEntryAcceptTimer =
            undefined;

        try {
            if (
                voiceEntrySurface
                    ?.matches?.(
                        ":popover-open"
                    )
            ) {
                voiceEntrySurface
                    .hidePopover?.();
            }
        }
        catch {}

        if (voiceEntrySurface) {
            voiceEntrySurface.hidden =
                true;
        }

        if (
            globalThis.SpeechMenu
        ) {
            if (
                voiceEntryExecutionBeforeOpen !==
                    undefined
            ) {
                globalThis.SpeechMenu
                    .executionEnabled =
                    voiceEntryExecutionBeforeOpen;
            }

            if (
                voiceEntrySystemExecutionBeforeOpen !==
                    undefined
            ) {
                globalThis.SpeechMenu
                    .systemExecutionPassthrough =
                    voiceEntrySystemExecutionBeforeOpen;
            }
        }

        voiceEntryExecutionBeforeOpen =
            undefined;
        voiceEntrySystemExecutionBeforeOpen =
            undefined;
        voiceEntryHandledUtteranceId =
            undefined;
        voiceEntryState =
            undefined;
    }

    async function closeVoiceEntry({
        cancel = false,
        destination
    } = {}) {
        if (
            !voiceEntryState ||
            !numberPadState
        ) {
            return false;
        }

        const state =
            numberPadState;

        hideVoiceEntrySurface();

        const closed =
            await closeNumberPad({
                destination:
                    destination ??
                    (
                        cancel
                            ? state.cancelTarget
                            : state.confirmTarget
                    ),
                discardPrepared:
                    cancel,
                allowChanged:
                    true,
                immediate:
                    true
            });

        resetNumberPad();

        return closed;
    }

    async function switchNumberPadToVoice() {
        if (
            !numberPadState ||
            !numberPadDialog
                ?.open
        ) {
            return false;
        }

        const snapshot = {
            ...numberPadState
        };

        stopAllNumberPadAudio();

        preserveNumberPadStateOnClose =
            true;

        if (
            !closeDialog(
                numberPadDialog,
                {
                    reason:
                        "number-pad-switch-voice",
                    immediate:
                        true
                }
            )
        ) {
            preserveNumberPadStateOnClose =
                false;

            return false;
        }

        return openVoiceValueEditor(
            snapshot
        );
    }

    async function switchVoiceEntryToTouch() {
        if (
            !voiceEntryState ||
            !numberPadState
        ) {
            return false;
        }

        const snapshot = {
            ...numberPadState
        };

        hideVoiceEntrySurface();

        await restoreNumberPadState(
            snapshot,
            {
                duration: 0
            }
        );

        return true;
    }

    function parseVoiceEntryTranscript(
        transcript,
        {
            signal
        } = {}
    ) {
        if (signal?.aborted) {
            return false;
        }
        if (!numberPadState) {
            return false;
        }

        const text =
            String(
                transcript ||
                ""
            )
                .trim();

        if (!text) {
            return false;
        }

        const command =
            text.toLowerCase();

        if (
            /^(?:cancel|close)$/
                .test(command)
        ) {
            return closeVoiceEntry({
                cancel: true
            });
        }

        if (
            /^(?:touch|keypad|number pad)$/
                .test(command)
        ) {
            return switchVoiceEntryToTouch();
        }

        if (
            numberPadState.source ===
                "new-trip"
        ) {
            const readyAtMatch =
                command.match(
                    /^at\s+(.+)$/
                );

            if (readyAtMatch) {
                const spokenTime =
                    readyAtMatch[1];

                hideVoiceEntrySurface();
                resetNumberPad();

                void Promise
                    .resolve(
                        actions
                            .scheduleStartAt(
                                spokenTime,
                                {
                                    fromReadyContinuation:
                                        true
                                }
                            )
                    )
                    .catch(
                        () => {}
                    );

                return true;
            }

            if (
                command ===
                    "defer trip"
            ) {
                void actions
                    .deferTrip();

                return true;
            }
        }

        if (
            /^(?:ok|okay)$/
                .test(command)
        ) {
            if (!numberPadValueValid()) {
                renderVoiceEntry({
                    prompt:
                        voiceEntryInvalidPrompt()
                });

                return false;
            }

            return (async () => {
                try {
                    if (
                        !await commitNumberPad(
                            signal
                        ) ||
                        signal?.aborted
                    ) {
                        return false;
                    }

                    await closeVoiceEntry({
                        cancel: false
                    });

                    return !signal?.aborted;
                }
                catch {
                    if (!signal?.aborted) {
                        renderVoiceEntry({
                            prompt:
                                "Say a Valid Value"
                        });
                    }

                    return false;
                }
            })();
        }

        let display;
        let spokenFeedback =
            text;

        if (
            numberPadState.mode ===
                "percent"
        ) {
            const percent =
                EnglishSpeechValuePreprocessor
                    .parse(
                        text,
                        "percent"
                    );

            if (
                !Number.isInteger(
                    percent
                ) ||
                percent <= 0
            ) {
                return false;
            }

            numberPadState.pending =
                String(
                    percent
                );
            display =
                numberPadState.pending +
                "%";
        }
        else if (
            numberPadState.mode ===
                "absolute"
        ) {
            const parts =
                EnglishSpeechValuePreprocessor
                    .parse(
                        text,
                        "clock-parts"
                    );

            if (!parts) {
                return false;
            }

            let meridiem =
                numberPadState
                    .meridiem;

            if (parts.meridiem) {
                meridiem =
                    parts.meridiem
                        .toUpperCase();
            }
            else if (
                parts.hour > 12
            ) {
                meridiem =
                    undefined;
            }

            const hour =
                meridiem &&
                parts.hour > 12
                    ? (
                        parts.hour %
                            12 ||
                        12
                    )
                    : parts.hour;

            const pending =
                absoluteDigits(
                    hour,
                    parts.minute,
                    0
                );

            if (
                !absoluteDigitsValid(
                    pending,
                    meridiem
                )
            ) {
                return false;
            }

            numberPadState.pending =
                pending;
            numberPadState.meridiem =
                meridiem;

            if (parts.day) {
                const date =
                    new Date();

                if (
                    parts.day ===
                        "tomorrow"
                ) {
                    date.setDate(
                        date.getDate() +
                            1
                    );
                }

                numberPadState
                    .pendingDate =
                    formatDateInput(
                        date
                    );
            }

            display =
                renderAbsoluteDigits(
                    numberPadState.pending
                ) +
                (
                    numberPadState
                        .meridiem
                        ? " " +
                            numberPadState
                                .meridiem
                        : ""
                );
        }
        else {
            const duration =
                EnglishSpeechValuePreprocessor
                    .parse(
                        text,
                        "duration"
                    );

            if (
                !Number.isFinite(
                    duration
                ) ||
                duration <= 0
            ) {
                return false;
            }

            numberPadState.pending =
                durationValueToRawDigits(
                    duration
                );

            if (
                !timeDigitsValid(
                    numberPadState.pending
                )
            ) {
                return false;
            }

            display =
                renderTimeDigits(
                    numberPadState.pending
                );
            spokenFeedback =
                formatGoalFailureDuration(
                    duration
                );
        }

        numberPadState.replaceOnNextDigit =
            false;
        numberPadState.everEdited =
            numberPadHasChanges();

        if (!numberPadValueValid()) {
            renderVoiceEntry({
                prompt:
                    "Say a Valid Value",
                example:
                    voiceEntryCopyForMode(
                        numberPadState.mode
                    ).example
            });

            return false;
        }

        const actionCopy =
            voiceEntryActionCopy();
        const feedbackSequence =
            ++voiceEntryFeedbackSequence;

        clearTimeout(
            voiceEntryAcceptTimer
        );

        renderVoiceEntry({
            prompt:
                display,
            value:
                display,
            attention:
                true
        });

        voiceEntryAcceptTimer =
            setTimeout(
                () => {
                    if (
                        feedbackSequence !==
                            voiceEntryFeedbackSequence ||
                        !voiceEntryState
                    ) {
                        return;
                    }

                    renderVoiceEntry({
                        prompt:
                            "Say OK to " +
                            actionCopy.ok,
                        value:
                            display,
                        attention:
                            true
                    });
                },
                360
            );

        speakVoiceEntryFeedback(
            spokenFeedback,
            actionCopy.ok,
            feedbackSequence
        );

        return true;
    }

    async function openVoiceValueEditor(
        state,
        {
            signal
        } = {}
    ) {
        if (
            signal?.aborted ||
            !voiceEntrySurface
        ) {
            return false;
        }

        numberPadState =
            state;

        voiceEntryState = {
            source:
                numberPadState.source,
            openedAt:
                performance.now()
        };

        voiceEntryHandledUtteranceId =
            undefined;

        if (
            globalThis.SpeechMenu
        ) {
            voiceEntryExecutionBeforeOpen =
                globalThis.SpeechMenu
                    .executionEnabled;
            voiceEntrySystemExecutionBeforeOpen =
                globalThis.SpeechMenu
                    .systemExecutionPassthrough;
            globalThis.SpeechMenu
                .systemExecutionPassthrough =
                true;
            globalThis.SpeechMenu
                .executionEnabled =
                false;
        }

        renderVoiceEntry({
            attention:
                numberPadValueValid()
        });

        voiceEntrySurface.hidden =
            false;

        try {
            if (
                !voiceEntrySurface
                    .matches(
                        ":popover-open"
                    )
            ) {
                voiceEntrySurface
                    .showPopover?.();
            }
        }
        catch {}

        queueMicrotask(
            () =>
                speechMicBar
                    ?.promoteTopLayer?.()
        );

        requestAnimationFrame(
            () => {
                syncTripTransitionEditorLayout();
                announceVoiceEntryPrompt();
            }
        );

        return true;
    }

    function openVoiceEntry(
        options = {}
    ) {
        return openValueEditor(
            options,
            "voice"
        );
    }

    voiceEntryCancel
        ?.addEventListener(
            "click",
            () => {
                void closeVoiceEntry({
                    cancel: true
                });
            }
        );

    voiceEntryTouch
        ?.addEventListener(
            "click",
            () => {
                void switchVoiceEntryToTouch();
            }
        );

    function voiceEntryTranscriptIsSystemCommand(
        transcript
    ) {
        const normalized =
            String(
                transcript ||
                ""
            )
                .toLocaleLowerCase()
                .trim()
                .replace(
                    /\s+/g,
                    " "
                );

        if (!normalized) {
            return false;
        }

        return Boolean(
            globalThis
                .SpeechMenu
                ?.phraseGroups
                ?.some(
                    group =>
                        group.modal ===
                            "system" &&
                        group.phrases
                            ?.some(
                                phrase =>
                                    !String(
                                        phrase
                                    )
                                        .includes(
                                            "<"
                                        ) &&
                                    String(
                                        phrase
                                    )
                                        .toLocaleLowerCase()
                                        .trim()
                                        .replace(
                                            /\s+/g,
                                            " "
                                        ) ===
                                        normalized
                            )
                )
        );
    }

    function pipeVoiceEntryTranscript(
        event
    ) {
        if (!voiceEntryState) {
            return;
        }

        const detail =
            event?.detail ||
            {};

        const utteranceId =
            detail.id ??
            detail.utteranceId;

        if (
            utteranceId !==
                undefined &&
            utteranceId ===
                voiceEntryHandledUtteranceId
        ) {
            return;
        }

        const transcript =
            String(
                detail.transcript ||
                ""
            ).trim();

        if (!transcript) {
            return;
        }

        if (
            voiceEntryTranscriptIsSystemCommand(
                transcript
            )
        ) {
            return;
        }

        const handled =
            parseVoiceEntryTranscript(
                transcript
            );

        if (
            utteranceId !==
                undefined
        ) {
            voiceEntryHandledUtteranceId =
                utteranceId;
        }

        if (handled) {
            return;
        }

        renderVoiceEntry({
            prompt:
                "Say a Valid Value"
        });
    }

    function bindVoiceEntryTranscriptPipe() {
        if (
            voiceEntryTranscriptPipeBound
        ) {
            return true;
        }

        const events =
            globalThis
                .SpeechMenu
                ?.events;

        if (!events) {
            return false;
        }

        events.addEventListener(
            "utteranceTranscribed",
            pipeVoiceEntryTranscript
        );

        events.addEventListener(
            "utteranceCommitted",
            pipeVoiceEntryTranscript
        );

        voiceEntryTranscriptPipeBound =
            true;

        return true;
    }

    document.addEventListener(
        "speech-runtime-ready",
        bindVoiceEntryTranscriptPipe
    );

    bindVoiceEntryTranscriptPipe();

    const refreshVoiceEntrySummaryLayout =
        () => {
            if (
                tripTransitionOverlayIsVisible()
            ) {
                syncTripTransitionEditorLayout(
                    true
                );
            }
        };

    globalThis.addEventListener(
        "resize",
        refreshVoiceEntrySummaryLayout,
        {
            passive: true
        }
    );
    globalThis
        .visualViewport
        ?.addEventListener(
            "resize",
            refreshVoiceEntrySummaryLayout,
            {
                passive: true
            }
        );

    globalThis.WMOFVoiceEntry =
        Object.freeze({
            open:
                options =>
                    openVoiceEntry(
                        options
                    ),
            close:
                () =>
                    closeVoiceEntry({
                        cancel: true
                    }),
            switchToTouch:
                switchVoiceEntryToTouch,
            get active() {
                return Boolean(
                    voiceEntryState
                );
            }
        });

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

        queueMicrotask(
            () =>
                speechMicBar
                    ?.promoteTopLayer?.()
        );

        startNumberPadAmbientTone();
    }

    function resetNumberPad() {
        numberPadState = undefined;
        if (numberPadDisplay) numberPadDisplay.textContent = "";
        if (numberPadContext) numberPadContext.textContent = "Number Pad";
        if (numberPadDate) numberPadDate.value = "";
        if (numberPadClear) {
            numberPadClear.dataset.action = "clear";
            numberPadClear.setAttribute("aria-label", "Clear");
        }
        numberPadReset?.setAttribute("aria-label", "Reset");
        numberPadCancel?.setAttribute("aria-label", "Cancel");
        if (numberPadConfirm) {
            numberPadConfirm.dataset.action = "confirm";
            numberPadConfirm.setAttribute("aria-label", "Confirm");
            numberPadConfirm.disabled = true;
        }

        setOkAllowed(
            numberPadDialog,
            false
        );
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
            immediate: immediate || ["trip-settings", "scheduled-start"].includes(target)
        })) {
            if (target === "trip-settings" && tripSettingsDialog.open) {
                closeDialog(tripSettingsDialog, {
                    reason: "number-pad-return:rollback",
                    immediate: true
                });
            }
            return false;
        }

        if (target === "scheduled-start") {
            showScheduledStartDialog({resolution: scheduledStartNeedsResolution});
        }

        if (target === "home") {
            if (state.role === "trip-settings-field") {
                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
            }
            if (discardPrepared && state.workflow === "new-trip") {
                tripDraft = undefined;
                releaseNewTripWorkflow();
                renderDeferredTrip();
                tripStartsNowState = undefined;
                tripSettingsSession = undefined;
                resetTripSettingsNavigation();
                clockTimer.discardPreparedTrip?.().catch?.(() => {});
            }
        }
        return true;
    }

    async function cancelNumberPad() {
        if (!numberPadState) {
            return false;
        }

        const destination =
            numberPadState.cancelTarget;

        if (!destination) {
            return false;
        }

        return closeNumberPad({
            destination,
            discardPrepared:
                true,
            allowChanged:
                true
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

    function getEffectivePercentGoal(scope) {
        let state;

        try {
            state =
                clockTimer.getUIState?.(
                    new Date()
                ) ||
                clockTimer.uiState;
        }
        catch {
            state =
                clockTimer.uiState;
        }

        const component =
            scope === "total"
                ? state?.total_goal_component
                : state?.trip_goal_component;
        const value =
            Number(
                component?.value
            );

        return Number.isFinite(value) &&
            value > 0
                ? value
                : undefined;
    }

    function getConfiguredGoalDisplay(scope) {
        const effective =
            getEffectivePercentGoal(
                scope
            );

        if (
            Number.isFinite(
                effective
            )
        ) {
            return formatSummaryPercent(
                effective,
                "100%"
            );
        }

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
        const effective =
            getEffectivePercentGoal(
                scope
            );

        if (
            Number.isFinite(
                effective
            )
        ) {
            return percentGoalAttribute(
                effective
            );
        }

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

            const option =
                autoTotalGoalValue.closest(
                    "[data-auto-goal-scope='total']"
                );
            const label =
                option?.querySelector(
                    "span"
                );
            if (label) {
                label.textContent =
                    "Your " +
                    totalScopeLabel() +
                    " Goal";
            }
        }

        const lockedScopes = new Set(endTimeGoalOverride?.scopes || []);
        for (const button of autoGoalDialog.querySelectorAll("[data-auto-goal-scope]")) {
            const scope = button.dataset.autoGoalScope === "total" ? "total" : "trip";
            const locked = lockedScopes.has(scope);
            const scopeLabel =
                scope === "total"
                    ? totalScopeLabel()
                    : "Trip";
            button.disabled = locked;
            button.setAttribute(
                "aria-label",
                locked
                    ? `${scopeLabel} goal locked to End Time`
                    : `Edit ${scopeLabel} goal`
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

    async function commitNumberPad(
        signal
    ) {
        if (
            signal?.aborted ||
            !numberPadState ||
            !numberPadValueValid()
        ) {
            return false;
        }
        const state = { ...numberPadState };

        if (
            !numberPadHasChanges() &&
            !state.startsTripOnConfirm
        ) {
            return true;
        }

        if (state.onConfirm) {
            const value =
                !state.pending
                    ? undefined
                    : state.mode === "absolute"
                        ? new Date(`${state.pendingDate}T${String(absoluteHour24(state)).padStart(2,"0")}:${String(splitAbsoluteDigits(state.pending).minute).padStart(2,"0")}:${String(splitAbsoluteDigits(state.pending).second).padStart(2,"0")}`).toISOString()
                        : state.mode === "percent"
                            ? Number(state.pending)
                            : timeDigitsToMilliseconds(
                                state.pending
                            );
            const confirmed =
                await state.onConfirm(value) !==
                    false;

            return (
                !signal?.aborted &&
                confirmed
            );
        }
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

        const durationMilliseconds =
            state.pending
                ? timeDigitsToMilliseconds(
                    state.pending
                )
                : undefined;
        if (
            durationMilliseconds ===
                undefined &&
            !state.allowEmpty
        ) {
            return false;
        }
        if (tripSettingsSession && state.source === "standard-time") {
            tripSettingsSession.values.standardTimeMilliseconds =
                durationMilliseconds;
            refreshTripSettingsValues();
            return true;
        }
        stagedStandardTimeMilliseconds =
            durationMilliseconds;

        if (!tripIsLive() && tripDraft) {
            tripDraft.standardTimeMilliseconds =
                durationMilliseconds;
            if (state.source === "standard-time") {
                syncDraftStandardTimeReturnFrame(
                    durationMilliseconds
                );
            }
            if (state.startsTripOnConfirm) {
                return startTripDraft();
            }
            return true;
        }

        if (state.startsTripOnConfirm) {
            tripDraft = {
                ...(state.tripDefaults || {}),
                standardTimeMilliseconds:
                    durationMilliseconds
            };
            return startTripDraft();
        }

        if (clockTimer.standardTimeMilliseconds !== undefined) {
            if (
                !Number.isSafeInteger(
                    durationMilliseconds
                ) ||
                durationMilliseconds <= 0
            ) {
                return false;
            }

            clockTimer.standardTimeMilliseconds =
                durationMilliseconds;

            if (
                clockTimer.standardTimeMilliseconds !==
                    durationMilliseconds
            ) {
                return false;
            }
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

    function backspaceNumberPadPendingValue() {
        if (
            !numberPadState ||
            !numberPadState.pending
        ) {
            return false;
        }

        numberPadState.pending =
            String(
                numberPadState.pending
            ).slice(
                0,
                -1
            );
        numberPadState.replaceOnNextDigit =
            false;
        numberPadState.everEdited =
            true;
        refreshNumberPad();

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
        const timerState =
            clockTimer
                ?.uiState;

        if (
            typeof timerState
                ?.trip_active ===
                "boolean"
        ) {
            return timerState
                .trip_active;
        }

        return (
            clockTimer
                ?.status ===
                "running" ||
            app.dataset
                .tripState ===
                "running"
        );
    }

    function syncDraftStandardTimeReturnFrame(
        standardTimeMilliseconds
    ) {
        const state = getTripSettingsReturnNumberPadState();
        if (!state || state.source !== "new-trip") return;
        const digits = durationValueToRawDigits(
            standardTimeMilliseconds
        );
        state.initial = digits;
        state.pending = digits;
        state.replaceOnNextDigit = false;
        state.startsTripOnConfirm = true;
    }

    function tripDraftFutureStartDate(draft = tripDraft) {
        const date = parseDateInput(draft?.creationDate);
        const timeline = parseTimelineTime(draft?.scheduledStart);
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

    function cancelScheduledStartSpeechPrompt() {
        clearTimeout(
            scheduledStartSpeechPromptTimer
        );

        scheduledStartSpeechPromptTimer =
            undefined;
    }

    function scheduleScheduledStartSpeechPrompt() {
        cancelScheduledStartSpeechPrompt();

        const draft =
            tripDraft;

        if (!draft) {
            return false;
        }

        scheduledStartSpeechPromptTimer =
            setTimeout(
                () => {
                    scheduledStartSpeechPromptTimer =
                        undefined;

                    if (
                        !scheduledStartDialog
                            ?.open ||
                        tripDraft !==
                            draft
                    ) {
                        return;
                    }

                    const hasStandardTime =
                        Number.isSafeInteger(
                            draft
                                .standardTimeMilliseconds
                        ) &&
                        draft
                            .standardTimeMilliseconds >
                            0;

                    globalThis
                        .WMOFAudio
                        ?.speak?.(
                            hasStandardTime
                                ? "Say Start to start early"
                                : "Say standard time"
                        );
                },
                180
            );

        return true;
    }

    function armScheduledStartAutoFromVoice() {
        if (
            !tripDraft ||
            !tripDraftHasFutureStart(
                tripDraft
            )
        ) {
            return false;
        }

        scheduledStartAutoArmed =
            true;
        scheduledStartAuto.checked =
            true;

        return true;
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
        else tripDraft.startTime = formatTimelineMilliseconds(parseTimelineTime(tripDraft.scheduledStart));
        stopScheduledStartTicker();
        scheduledStartAutoArmed = false;
        scheduledStartNeedsResolution = false;
        if (!await startTripDraft()) return false;
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-trip-start"});
        return true;
    }

    function updateScheduledStartDialog() {
        const scheduled = tripDraftFutureStartDate();
        const remaining = scheduled ? scheduled.getTime() - Date.now() : 0;
        const military =
            clockTimer.getAttribute(
                "military-time"
            ) !==
                "false";
        let scheduledTimeLabel =
            "---";

        if (
            scheduled &&
            !Number.isNaN(
                scheduled.getTime()
            )
        ) {
            const hours =
                scheduled.getHours();
            const minutes =
                String(
                    scheduled.getMinutes()
                )
                    .padStart(
                        2,
                        "0"
                    );
            const seconds =
                String(
                    scheduled.getSeconds()
                )
                    .padStart(
                        2,
                        "0"
                    );

            scheduledTimeLabel =
                military
                    ? (
                        String(hours)
                            .padStart(
                                2,
                                "0"
                            ) +
                        ":" +
                        minutes +
                        ":" +
                        seconds
                    )
                    : (
                        String(
                            hours %
                                12 ||
                            12
                        ) +
                        ":" +
                        minutes +
                        ":" +
                        seconds +
                        " " +
                        (
                            hours >=
                                12
                                ? "PM"
                                : "AM"
                        )
                    );
        }

        scheduledStartCountdownLabel.textContent =
            "Time Until " +
            scheduledTimeLabel;
        scheduledStartCountdown.textContent =
            (
                remaining <
                    0
                    ? "-"
                    : ""
            ) +
            formatDuration(
                Math.abs(
                    remaining
                )
            );
        scheduledStartStandardValue.textContent =
            displayClockTimerDuration(
                tripDraft
                    ?.standardTimeMilliseconds
            ) ||
            "---";
        const scheduledTimeReached = remaining <= 0;
        const canStart = tripDraftCanStart(tripDraft);
        if (scheduledTimeReached && scheduledStartAutoArmed && canStart) {
            scheduledStartAutoArmed = false;
            scheduledStartAuto.checked = false;
            scheduledStartAuto.disabled = true;
            void globalThis
                .WMOFActions
                .startScheduledTrip(
                    "scheduled"
                );
            return;
        }
        if (scheduledTimeReached) {
            scheduledStartAutoArmed = false;
            scheduledStartAuto.checked = false;
        }
        scheduledStartAuto.disabled = scheduledTimeReached;
        const missingRequiredStandard = scheduledTimeReached && !canStart;
        scheduledStartNow.disabled = missingRequiredStandard;
        scheduledStartOnTime.disabled = missingRequiredStandard;
        if (missingRequiredStandard) {
            scheduledStartNeedsResolution = true;
            if (!scheduledStartStandard.classList.contains("needs-value")) flagScheduledStandardTime();
            return;
        }
    }

    function showScheduledStartDialog({resolution=false}={}) {
        scheduledStartNeedsResolution = Boolean(resolution);
        scheduledStartAutoOption.hidden = resolution;
        scheduledStartCancel.hidden = resolution;
        scheduledStartOnTime.hidden = !resolution;
        scheduledStartNow.hidden = false;
        scheduledStartAuto.checked = scheduledStartAutoArmed;
        scheduledStartAuto.disabled = false;
        scheduledStartNow.disabled = false;
        scheduledStartOnTime.disabled = false;
        scheduledStartMessage.hidden = true;
        scheduledStartStandard.classList.remove("needs-value");
        updateScheduledStartDialog();
        stopScheduledStartTicker();
        scheduledStartTicker = setInterval(updateScheduledStartDialog, 250);
        if (!scheduledStartDialog.open) openDialogElement(scheduledStartDialog, {reason:resolution?"scheduled-start-resolution":"early-start"});
        scheduleScheduledStartSpeechPrompt();
    }

    function cancelScheduledStartPrompt() {
        cancelScheduledStartSpeechPrompt();
        scheduledStartAutoArmed = false;
        scheduledStartNeedsResolution = false;
        stopScheduledStartTicker();
        releaseNewTripWorkflow();
        if (scheduledStartDialog.open) closeDialog(scheduledStartDialog, {reason:"scheduled-start-cancel"});
    }

    scheduledStartAuto.addEventListener(
        "change",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "changeScheduledStartAutoInput",
                () =>
                    globalThis
                        .WMOFActions
                        .changeScheduledStartAuto(
                            scheduledStartAuto
                                .checked
                        )
            )
    );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scheduledStartNow,
            event:
                "click",
            name:
                "startScheduledTripNowClick",
            action:
                "startScheduledTrip",
            args:
                () => [
                    "now"
                ]
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scheduledStartOnTime,
            event:
                "click",
            name:
                "startScheduledTripOnTimeClick",
            action:
                "startScheduledTrip",
            args:
                () => [
                    "scheduled"
                ]
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scheduledStartCancel,
            event:
                "click",
            name:
                "cancelScheduledStartClick",
            action:
                "cancelScheduledStart"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scheduledStartClose,
            event:
                "click",
            name:
                "closeScheduledStartClick",
            action:
                "cancelScheduledStart"
        });

    scheduledStartDialog.addEventListener(
        "cancel",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "cancelScheduledStartDialog",
                event => {
                    event.preventDefault();

                    return globalThis
                        .WMOFActions
                        .cancelScheduledStart();
                }
            )
    );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                scheduledStartStandard,
            event:
                "click",
            name:
                "openScheduledStandardTimeEditorClick",
            action:
                "openScheduledStandardTimeEditor"
        });

    function tripDraftCanStart(draft = tripDraft) {
        if (!draft || !parseDateInput(draft.creationDate)) return false;
        const standardTimeMilliseconds =
            draft.standardTimeMilliseconds;
        const creationTime = parseTimelineTime(draft.creationTime);
        const scheduledStart = parseTimelineTime(draft.scheduledStart);
        const actualStart = parseTimelineTime(draft.startTime);
        return (
            (
                draft.deferred ||
                (
                    Number.isSafeInteger(
                        standardTimeMilliseconds
                    ) &&
                    standardTimeMilliseconds > 0
                )
            ) &&
            Number.isFinite(creationTime) && creationTime >= 0 && creationTime < 24 * 60 * 60 * 1000 &&
            (draft.deferred || (Number.isFinite(scheduledStart) && scheduledStart >= 0 &&
            Number.isFinite(actualStart) && actualStart >= 0))
        );
    }

    async function startTripDraft() {
        const draft = tripDraft;
        if (draft?.deferred) return false;

        if (
            draft
                ?.completedTripResetPromise
        ) {
            await draft
                .completedTripResetPromise;

            if (tripDraft !== draft) {
                return false;
            }
        }

        const standardTimeMilliseconds =
            draft?.standardTimeMilliseconds;

        if (
            !Number.isSafeInteger(
                standardTimeMilliseconds
            ) ||
            standardTimeMilliseconds <= 0 ||
            !tripDraftCanStart(draft)
        ) {
            return false;
        }

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

        if (
            draft
                .endStartTransition ===
                true &&
            draft
                .startTimeSetToNow ===
                true
        ) {
            // The 5-note transition normally preloads one suppression for
            // the upcoming Start Trip cue. If Actual Start is pushed to Now,
            // cancel that one-shot suppression so the normal start chime is
            // allowed to play as the second chime.
            cancelSemanticDisable(
                "chime"
            );
        }

        await clockTimer.start({
            standardTimeMilliseconds,
            creationDate: draft.creationDate,
            nonProduction: draft.nonProduction === true,
            creationTime: draft.creationTime,
            scheduledStart: draft.scheduledStart,
            startTime: draft.startTime
        });
        if (draft.creationDate && clockTimer.creationDate !== draft.creationDate) {
            clockTimer.creationDate = draft.creationDate;
        }

        stagedStandardTimeMilliseconds =
            standardTimeMilliseconds;
        tripDraft = undefined;
        releaseNewTripWorkflow();
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
            standardTimeMilliseconds: live
                ? clockTimer.standardTimeMilliseconds
                : draft.standardTimeMilliseconds,
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
            values: cloneTripSettingsValues(values),
            startTimeSetToNow: false
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
            standardTimeMilliseconds: values.standardTimeMilliseconds,
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
            standardTimeMilliseconds: values.standardTimeMilliseconds,
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
                standardTimeMilliseconds: values.standardTimeMilliseconds,
                creationTime: values.creationTime,
                creationDate: values.creationDate,
                scheduledStart: values.scheduledStart,
                startTime: values.startTime,
                syncGoals: Boolean(values.syncGoals),
                startTimeSetToNow:
                    tripSettingsSession
                        ?.startTimeSetToNow ===
                    true
            });
            return true;
        }

        try {
            if (clockTimer.creationDate !== values.creationDate) clockTimer.creationDate = values.creationDate;
            if (clockTimer.creationTime !== values.creationTime) clockTimer.creationTime = values.creationTime;
            if (clockTimer.scheduledStart !== values.scheduledStart) clockTimer.scheduledStart = values.scheduledStart;
            if (clockTimer.startTime !== values.startTime) clockTimer.startTime = values.startTime;
            if (
                clockTimer.standardTimeMilliseconds !==
                    values.standardTimeMilliseconds
            ) {
                const standardTimeMilliseconds =
                    values.standardTimeMilliseconds;

                if (
                    !Number.isSafeInteger(
                        standardTimeMilliseconds
                    ) ||
                    standardTimeMilliseconds <= 0
                ) {
                    return false;
                }

                clockTimer.standardTimeMilliseconds =
                    standardTimeMilliseconds;
            }
            clockTimer.nonProduction = values.nonProduction === true;
            clockTimer.configure({auto_goal: Boolean(values.syncGoals)});
            stagedStandardTimeMilliseconds =
                values.standardTimeMilliseconds ??
                stagedStandardTimeMilliseconds;
            return true;
        }
        catch {
            return false;
        }
    }

    function syncTripSettingsCallerAfterSave() {
        const state = getTripSettingsReturnNumberPadState();
        const standardTimeMilliseconds =
            tripSettingsSession
                ?.values
                ?.standardTimeMilliseconds;
        if (
            !state ||
            state.source !== "standard-time" ||
            !Number.isSafeInteger(
                standardTimeMilliseconds
            )
        ) {
            return;
        }
        const digits = durationValueToRawDigits(
            standardTimeMilliseconds
        );
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
                : displayClockTimerDuration(
                    settingsValues
                        ?.standardTimeMilliseconds
                ) || "---"
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
        if (field === "standard-time") return values.standardTimeMilliseconds;
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
            allowEmpty: field === "standard-time" && !live && tripDraftHasFutureStart(tripDefaults),
            duration: 0
        });
    }

    async function applyTripFieldSpeechValue(
        field,
        spokenValue
    ) {
        if (
            !tripSettingsDialog
                .open
        ) {
            return false;
        }

        try {
            const opened =
                await openTripFieldNumberPad(
                    field
                );

            if (
                !opened ||
                !voiceEntryState ||
                !numberPadState
            ) {
                return false;
            }

            if (
                !parseVoiceEntryTranscript(
                    spokenValue
                ) ||
                !numberPadValueValid()
            ) {
                await closeVoiceEntry({
                    cancel: true
                });

                return false;
            }

            if (
                !await commitNumberPad()
            ) {
                return false;
            }

            await closeVoiceEntry({
                cancel: false
            });

            return true;
        }
        catch {
            if (voiceEntryState) {
                await closeVoiceEntry({
                    cancel: true
                }).catch(
                    () => {}
                );
            }

            return false;
        }
    }

    function bindNumberPadEvents() {
        const backspace =
            $("#numberPadBackspace");

        backspace.addEventListener(
            "pointerup",
            globalThis
                .WMOFInteractionFunctions
                .define(
                    "backspaceNumberPadPointerUp",
                    () =>
                        globalThis
                            .WMOFActions
                            .backspaceNumberPadValue()
                )
        );

        backspace.addEventListener(
            "click",
            globalThis
                .WMOFInteractionFunctions
                .define(
                    "backspaceNumberPadKeyboardClick",
                    event => {
                        if (
                            event.detail ===
                            0
                        ) {
                            return globalThis
                                .WMOFActions
                                .backspaceNumberPadValue();
                        }

                        return false;
                    }
                )
        );

        numberPadDialog
            .querySelectorAll(
                "[data-touch-tone]"
            )
            .forEach(
                button => {
                    button.addEventListener(
                        "pointerdown",
                        event => {
                            stopNumberPadTouchTone(
                                button
                            );

                            if (
                                button.disabled ||
                                button.hasAttribute(
                                    "disabled"
                                )
                            ) {
                                return;
                            }

                            button
                                .setPointerCapture?.(
                                    event.pointerId
                                );

                            const state = {
                                released: false,
                                handle: undefined
                            };

                            activeNumberPadTouchTones
                                .set(
                                    button,
                                    state
                                );

                            const frequencies =
                                String(
                                    button.dataset
                                        .touchTone ||
                                    ""
                                )
                                    .split(",")
                                    .map(Number);

                            void globalThis
                                .WMOFAudio
                                ?.startFrequencies?.(
                                    frequencies,
                                    {
                                        waveform:
                                            "square",
                                        volume: 1,
                                        reason:
                                            "number-pad",
                                    }
                                )
                                .then(
                                    handle => {
                                        if (
                                            state.released
                                        ) {
                                            handle
                                                ?.stop?.();
                                            return;
                                        }

                                        state.handle =
                                            handle;
                                    }
                                )
                                .catch(
                                    error =>
                                        console.error(
                                            "Number pad tone failed:",
                                            error
                                        )
                                );
                        }
                    );

                    for (
                        const type of
                        [
                            "pointerup",
                            "pointercancel",
                            "pointerleave",
                            "lostpointercapture"
                        ]
                    ) {
                        button.addEventListener(
                            type,
                            () =>
                                stopNumberPadTouchTone(
                                    button
                                )
                        );
                    }
                }
            );

        numberPadDialog
            .querySelectorAll(
                "[data-number]"
            )
            .forEach(
                button => {
                    globalThis
                        .WMOFInteractionFunctions
                        .bindAction({
                            element:
                                button,
                            event:
                                "pointerup",
                            name:
                                "enterNumberPadDigit" +
                                button.dataset
                                    .number +
                                "PointerUp",
                            action:
                                "enterNumberPadDigit",
                            args:
                                () => [
                                    button.dataset
                                        .number
                                ]
                        });
                }
            );

        [
            numberPadAM,
            numberPadPM
        ].forEach(
            button => {
                globalThis
                    .WMOFInteractionFunctions
                    .bindAction({
                        element:
                            button,
                        event:
                            "pointerup",
                        name:
                            "setNumberPad" +
                            button.dataset
                                .meridiem +
                            "PointerUp",
                        action:
                            "setNumberPadMeridiem",
                        args:
                            () => [
                                button.dataset
                                    .meridiem
                            ]
                    });
            }
        );

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadDate,
                event:
                    "input",
                name:
                    "changeNumberPadDateInput",
                action:
                    "changeNumberPadDate",
                args:
                    () => [
                        numberPadDate
                            .value
                    ]
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadSettings,
                event:
                    "pointerup",
                name:
                    "openNumberPadSettingsPointerUp",
                action:
                    "openNumberPadSettings"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadConnection,
                event:
                    "pointerup",
                name:
                    "resumeNumberPadConnectionPointerUp",
                action:
                    "resumeNumberPadConnection"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadVoice,
                event:
                    "pointerup",
                name:
                    "switchNumberPadToVoicePointerUp",
                action:
                    "switchNumberPadToVoice"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadConfirm,
                event:
                    "pointerup",
                name:
                    "confirmNumberPadPointerUp",
                action:
                    "confirmNumberPad"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadClear,
                event:
                    "pointerup",
                name:
                    "clearNumberPadPointerUp",
                action:
                    "clearNumberPadValue"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadReset,
                event:
                    "pointerup",
                name:
                    "resetNumberPadPointerUp",
                action:
                    "resetNumberPadValue"
            });

        globalThis
            .WMOFInteractionFunctions
            .bindAction({
                element:
                    numberPadCancel,
                event:
                    "pointerup",
                name:
                    "cancelNumberPadPointerUp",
                action:
                    "cancelNumberPadEdit"
            });

        numberPadDialog.addEventListener(
            "cancel",
            globalThis
                .WMOFInteractionFunctions
                .define(
                    "cancelNumberPadDialog",
                    event => {
                        event.preventDefault();

                        return globalThis
                            .WMOFActions
                            .cancelNumberPadEdit();
                    }
                )
        );

        numberPadDialog.addEventListener("close", () => {
            stopAllNumberPadAudio();
            syncTripTransitionEditorLayout(
                false
            );

            if (
                preserveNumberPadStateOnClose
            ) {
                preserveNumberPadStateOnClose =
                    false;

                return;
            }

            resetNumberPad();
        });


    }

    tripSettingsDialog.addEventListener("opening", () => {
        refreshTripSettingsValues();
    });

    tripSettingsCloud.addEventListener(
        "click",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "resumeTripSettingsConnectionClick",
                () => {
                    if (
                        tripSettingsCloud
                            .dataset
                            .networkStatus !==
                                "offline" ||
                        connectionCloudPhase !==
                            "settled"
                    ) {
                        return false;
                    }

                    return globalThis
                        .WMOFActions
                        .resumeConnection(
                            "trip-settings"
                        );
                }
            )
    );

    tripSettingsDialog
        .querySelectorAll(
            "[data-trip-time-field]"
        )
        .forEach(
            button => {
                globalThis
                    .WMOFInteractionFunctions
                    .bindAction({
                        element:
                            button,
                        event:
                            "pointerup",
                        name:
                            "openTrip" +
                            String(
                                button.dataset
                                    .tripTimeField ||
                                "Time"
                            )
                                .replace(
                                    /[^A-Za-z0-9]+(.)/g,
                                    (
                                        match,
                                        character
                                    ) =>
                                        character
                                            ?.toUpperCase() ||
                                        ""
                                ) +
                            "EditorPointerUp",
                        action:
                            "openTripTimeEditor",
                        args:
                            () => [
                                button.dataset
                                    .tripTimeField
                            ]
                    });
            }
        );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                tripSetStartsNow,
            event:
                "pointerup",
            name:
                "toggleTripStartsNowPointerUp",
            action:
                "toggleTripStartsNow"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                tripSetStartsNowCancel,
            event:
                "pointerup",
            name:
                "cancelTripStartsNowPointerUp",
            action:
                "cancelTripStartsNow"
        });

    tripStartNowToggles.forEach(
        button => {
            globalThis
                .WMOFInteractionFunctions
                .bindAction({
                    element:
                        button,
                    event:
                        "pointerup",
                    name:
                        "toggleTripStartsNow" +
                        (
                            button.dataset
                                .tripStartNowTarget ===
                                "scheduled-start"
                                ? "Scheduled"
                                : "Actual"
                        ) +
                        "PointerUp",
                    action:
                        "toggleTripStartsNowTarget",
                    args:
                        () => [
                            button.dataset
                                .tripStartNowTarget
                        ]
                });
        }
    );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#tripProductive"),
            event:
                "change",
            name:
                "changeTripProductiveInput",
            action:
                "changeTripProductive",
            args:
                event => [
                    event.target
                        .checked
                ]
        });

    function renderDeferredTrip() {
        const button = $("#newTripButton");
        button.classList.toggle("has-deferred-trip", Boolean(tripDraft?.deferred));
        button.title = tripDraft?.deferred ? "Resume deferred trip" : "New Trip";
    }

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#tripDefer"),
            event:
                "change",
            name:
                "changeTripDeferredInput",
            action:
                "changeTripDeferred",
            args:
                event => [
                    event.target
                        .checked
                ]
        });

    tripSettingsForm.addEventListener(
        "submit",
        globalThis
            .WMOFInteractionFunctions
            .define(
                "saveTripSettingsSubmit",
                event => {
                    event.preventDefault();

                    const result =
                        globalThis
                            .WMOFActions
                            .saveTripSettings();

                    result
                        ?.catch?.(
                            () => {}
                        );

                    return result;
                }
            )
    );

    function resumedTripStarts(draft, moment) {
        const base = parseDateInput(draft.creationDate);
        const days = (Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate()) -
            Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86400000;
        const elapsed = days * 86400000 + ((moment.getHours() * 60 + moment.getMinutes()) * 60 + moment.getSeconds()) * 1000 + moment.getMilliseconds();
        const time = formatTimelineMilliseconds(elapsed);
        return { scheduledStart: draft.scheduledStart ?? draft.creationTime, startTime: time };
    }

    async function beginNewTripWorkflow({
        initialValue,
        tripMoment,
        signal,
        inputMode,
        endStartTransition = false,
        completedTripResetPromise
    } = {}) {
        if (signal?.aborted) {
            return false;
        }

        const resetPromise =
            completedTripResetPromise;

        if (
            clockTimer.status ===
                "stopped" &&
            !resetPromise
        ) {
            await clockTimer
                .resetCompletedTrip();

            if (signal?.aborted) {
                return false;
            }
        }

        const previousTripDraft =
            tripDraft;

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
        let initialStandardTimeMilliseconds;

        if (
            initialValue !==
                undefined &&
            initialValue !==
                null
        ) {
            initialStandardTimeMilliseconds =
                Number.isSafeInteger(
                    initialValue
                )
                    ? initialValue
                    : typeof initialValue ===
                        "string" &&
                        initialValue.trim()
                        ? parseTimelineTime(
                            initialValue
                        )
                        : undefined;
        }
        else if (
            clockTimer.status !==
                "stopped"
        ) {
            initialStandardTimeMilliseconds =
                stagedStandardTimeMilliseconds;
        }
        tripDraft = deferredDraft ? {
            ...deferredDraft,
            deferred: false,
            endStartTransition:
                Boolean(
                    endStartTransition
                ),
            ...resumedTripStarts(deferredDraft, moment)
        } : {
            ...tripDefaults,
            standardTimeMilliseconds:
                initialStandardTimeMilliseconds,
            lateBreakBehavior: tripPreferences.lateBreakBehavior,
            syncGoals: tripPreferences.syncGoals,
            endStartTransition:
                Boolean(
                    endStartTransition
                )
        };

        if (
            resetPromise &&
            tripDraft
        ) {
            tripDraft
                .completedTripResetPromise =
                resetPromise;
        }

        renderDeferredTrip();
        let preparationPromise;
        try {
            preparationPromise = Promise
                .resolve(
                    resetPromise
                )
                .then(
                    () =>
                        deferredDraft
                            ? {
                                pending:
                                    true
                            }
                            : clockTimer
                                .prepareTrip({
                                    timeout:
                                        5000,
                                    at:
                                        moment
                                })
                )
                .catch(() => ({
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

        const opened =
            await openValueEditor(
                {
                    mode: "time",
                    source: "new-trip",
                    initialValue:
                        deferredDraft
                            ? tripDraft.standardTimeMilliseconds
                            : initialStandardTimeMilliseconds,
                    preparationPromise,
                    tripDefaults:
                        tripDraft,
                    startsTripOnConfirm:
                        true,
                    role: "root",
                    workflow: "new-trip",
                    cancelTarget: "home",
                    confirmTarget: "home",
                    duration:
                        endStartTransition
                            ? 0
                            : 250,
                    signal
                },
                inputMode
            );

        if (
            !opened &&
            signal?.aborted
        ) {
            tripDraft =
                previousTripDraft;

            renderDeferredTrip();
        }

        return opened;
    }

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#newTripButton"),
            event:
                "pointerup",
            name:
                "openStartMenuPointerUp",
            action:
                "openStartMenu"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                endTripButton,
            event:
                "pointerup",
            name:
                "endTripPointerUp",
            action:
                "endTrip"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                breakButton,
            event:
                "pointerup",
            name:
                "openBreakMenuPointerUp",
            action:
                "openBreakMenu"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                downButton,
            event:
                "pointerup",
            name:
                "startDownTimePointerUp",
            action:
                "startDownTime"
        });

    downDetailsButton.addEventListener("pointerup", () => {
        const reference=activeDownReference();
        if(reference?.tripId&&reference.intervalKey)void openDownDetailsModal(reference.tripId,reference.intervalKey,{editing:true,capture:true});
    });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                downBreakButton,
            event:
                "pointerup",
            name:
                "openDownBreakMenuPointerUp",
            action:
                "openBreakMenu",
            args:
                () => [
                    "down-break"
                ]
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                downResumeButton,
            event:
                "pointerup",
            name:
                "resumeTripPointerUp",
            action:
                "resumeTrip"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                downCancelButton,
            event:
                "pointerup",
            name:
                "cancelDownTimePointerUp",
            action:
                "cancelDownTime"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#cancelDownConfirmYes"),
            event:
                "click",
            name:
                "confirmCancelDownTimeClick",
            action:
                "confirmCancelDownTime"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#cancelDownConfirmNo"),
            event:
                "click",
            name:
                "continueDownTimeClick",
            action:
                "continueDownTime"
        });

    breakDialog
        .querySelectorAll(
            "[data-break-type]"
        )
        .forEach(
            button => {
                globalThis
                    .WMOFInteractionFunctions
                    .bindAction({
                        element:
                            button,
                        event:
                            "click",
                        name:
                            "startBreak" +
                            String(
                                button.dataset
                                    .breakType ||
                                "Type"
                            )
                                .replace(
                                    /[^A-Za-z0-9]+(.)/g,
                                    (
                                        match,
                                        character
                                    ) =>
                                        character
                                            ?.toUpperCase() ||
                                        ""
                                ) +
                            "Click",
                        action:
                            "startBreak",
                        args:
                            () => [
                                button.dataset
                                    .breakType
                            ],
                        preventDefault:
                            true
                    });
            }
        );

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#standardTimeButton"),
            event:
                "pointerup",
            name:
                "openStandardTimeSettingsPointerUp",
            action:
                "openStandardTimeSettings"
        });

    globalThis
        .WMOFInteractionFunctions
        .bindAction({
            element:
                $("#goalPercentValue"),
            event:
                "pointerup",
            name:
                "openGoalEditorPointerUp",
            action:
                "openGoalEditor"
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

    async function endCurrentIntervalOrTrip(
        transactionTime =
            speechTransactionDate(),
        {
            signal
        } = {}
    ) {
        if (signal?.aborted) {
            return false;
        }
        const effectiveTime =
            transactionTime instanceof Date &&
            !Number.isNaN(
                transactionTime.getTime()
            )
                ? new Date(
                    transactionTime.getTime()
                )
                : new Date();

        const interval =
            clockTimer.getActiveIntervalState
                ?.(
                    effectiveTime
                );

        const intervalType =
            String(
                interval?.intervalType ||
                ""
            )
                .toLowerCase();

        if (
            intervalType === "break" ||
            intervalType === "lunch"
        ) {
            await clockTimer.endInterval(
                transactionTime
            );

            if (signal?.aborted) {
                return false;
            }

            updateSummaryValues();
            renderTripActionState();
            return;
        }

        if (intervalType === "down") {
            await clockTimer.endInterval(
                transactionTime
            );

            if (signal?.aborted) {
                return false;
            }

            renderTripActionState();
            return;
        }

        // A Ready transition is one atomic wall-clock boundary: the
        // completed trip stops at the exact millisecond the next trip starts.
        // Store the boundary as an immutable number so neither async work nor a
        // Date object mutation can make the two sides drift apart.
        const transitionTimestamp =
            effectiveTime.getTime();

        endingIntoNewTrip =
            true;

        // Suppress exactly the next ordinary chime: the legacy 3-note
        // End Trip cue emitted by tripEnded.
        incrementSemanticDisable(
            "chime"
        );

        const stopPromise =
            clockTimer.stop(
                new Date(
                    transitionTimestamp
                )
            );

        if (
            clockTimer.status !==
                "stopped"
        ) {
            try {
                await stopPromise;
            }
            finally {
                endingIntoNewTrip =
                    false;
            }

            return false;
        }

        if (signal?.aborted) {
            endingIntoNewTrip =
                false;
            return false;
        }

        const completedTripResetPromise =
            Promise
                .resolve(
                    stopPromise
                )
                .finally(
                    () => {
                        endingIntoNewTrip =
                            false;
                    }
                )
                .then(
                    () =>
                        clockTimer
                            .resetCompletedTrip()
                );

        completedTripResetPromise
            .catch(
                error =>
                    console.error(
                        "Completed trip reset failed:",
                        error
                    )
            );

        const opened =
            await beginNewTripWorkflow({
                initialValue: "",
                tripMoment:
                    new Date(
                        transitionTimestamp
                    ),
                inputMode:
                    speechRecognitionEnabled()
                        ? "voice"
                        : "touch",
                endStartTransition: true,
                completedTripResetPromise,
                signal
            });

        const speech =
            pendingEndStartTripSpeech;

        pendingEndStartTripSpeech =
            undefined;

        if (signal?.aborted) {
            return false;
        }

        if (
            opened &&
            tripDraftUsesEndStartTransition()
        ) {
            const endChimeEnabled =
                audioCellUserEnabled(
                    "trip-ended",
                    "chime"
                );
            const startChimeEnabled =
                audioCellUserEnabled(
                    "trip-started",
                    "chime"
                );
            const audio =
                globalThis.WMOFAudio;
            let transitionSong;

            if (
                endChimeEnabled &&
                startChimeEnabled
            ) {
                transitionSong =
                    "trip-transition";
            }
            else if (endChimeEnabled) {
                transitionSong =
                    "trip-ended";
            }
            else if (startChimeEnabled) {
                transitionSong =
                    "trip-started";
            }

            const transitionSpeechOutput =
                audioAnnouncementOutput(
                    "trip-ended"
                );
            const transitionChimeAllowed =
                Boolean(
                    transitionSong &&
                    consumeSemanticAction(
                        "chime"
                    )
                );
            const reserveStartChime =
                transitionChimeAllowed &&
                startChimeEnabled;

            if (reserveStartChime) {
                // Reserve this immediately so a very fast Start action cannot
                // consume its own chime before the queued transition begins.
                incrementSemanticDisable(
                    "chime"
                );
            }

            void runSemanticAnnouncement(
                "trip-ended",
                async () => {
                    let transitionChimePlayed =
                        false;

                    if (
                        transitionChimeAllowed &&
                        audio?.startSong
                    ) {
                        try {
                            const song =
                                await audio
                                    .startSong(
                                        transitionSong,
                                        {
                                            bpm: 180,
                                            includeSpeech:
                                                false
                                        }
                                    );

                            transitionChimePlayed =
                                Boolean(
                                    song?.hasChime
                                );

                            await song
                                ?.finished;

                            if (
                                transitionChimePlayed
                            ) {
                                await waitForAnnouncementDelay(
                                    transitionSpeechOutput
                                        .speechDelayMs
                                );
                            }
                        }
                        catch (error) {
                            console.error(
                                "Audio playback failed:",
                                transitionSong,
                                error
                            );
                        }
                    }

                    if (
                        reserveStartChime &&
                        !transitionChimePlayed
                    ) {
                        cancelSemanticDisable(
                            "chime"
                        );
                    }

                    if (speech) {
                        await speakSemanticAndWait(
                            audio,
                            speech,
                            {
                                speechVolume:
                                    transitionSpeechOutput
                                        .speechVolume,
                                speechVelocity:
                                    transitionSpeechOutput
                                        .speechVelocity
                            }
                        );
                    }

                    return true;
                },
                {
                    exclusive:
                        announcementSpeechIgnoresMaster(
                            "trip-ended"
                        )
                }
            )
                .catch(
                    error =>
                        console.error(
                            "Trip transition announcement failed:",
                            error
                        )
                );
        }
        else if (speech) {
            void playSemanticSongThenSpeak(
                "trip-ended",
                speech
            );
        }
    }

    let speechBreakPromptState;

    function openSpeechBreakPrompt(
        mode
    ) {
        const dialog =
            $("#speechBreakConfirmDialog");
        const title =
            $("#speechBreakConfirmTitle");
        const message =
            $("#speechBreakConfirmMessage");

        if (
            !dialog ||
            !title ||
            !message
        ) {
            return false;
        }

        if (mode === "start") {
            title.textContent =
                "Start Break";
            message.textContent =
                "Is this a lunch?";

            speechBreakPromptState = {
                mode: "start"
            };
        }
        else if (mode === "end") {
            const active =
                clockTimer
                    .getActiveIntervalState
                    ?.(
                        new Date()
                    );
            const type =
                String(
                    active?.intervalType ||
                    ""
                )
                    .toLowerCase();

            if (
                type !== "break" &&
                type !== "lunch"
            ) {
                return false;
            }

            const label =
                type === "lunch"
                    ? "Lunch"
                    : "Break";

            title.textContent =
                `End ${label}`;
            message.textContent =
                `Are you ready to end your ${label.toLowerCase()}?`;

            speechBreakPromptState = {
                mode: "end",
                intervalType:
                    type
            };
        }
        else {
            return false;
        }

        return openDialog(
            "speechBreakConfirmDialog",
            {
                reason:
                    `speech-break-${mode}`
            }
        );
    }

    function clearSpeechBreakPrompt() {
        speechBreakPromptState =
            undefined;
    }

    async function startBreakInterval(
        kind,
        transactionTime =
            speechTransactionDate()
    ) {
        const configs = {
            break: { type: "break", lengthMilliseconds: 15 * 60 * 1000, attributes: { breakType: "break" } },
            lunch: { type: "lunch", lengthMilliseconds: 30 * 60 * 1000, attributes: { breakType: "lunch" } },
            "short-break": { type: "break", lengthMilliseconds: 10 * 60 * 1000, attributes: { breakType: "short" } }
        };
        const config = configs[kind];
        if (!config) return false;

        const lookupTime =
            transactionTime instanceof Date &&
            !Number.isNaN(
                transactionTime.getTime()
            )
                ? transactionTime
                : new Date();

        const active =
            clockTimer
                .getActiveIntervalState
                ?.(
                    lookupTime
                );

        if (
            String(
                active?.intervalType ||
                ""
            )
                .toLowerCase() ===
                "down"
        ) {
            const ended =
                await clockTimer
                    .endInterval(
                        transactionTime,
                        {
                            suppressTripResumed:
                                true
                        }
                    );

            updateSummaryValues();
            renderTripActionState();

            if (!ended) {
                return false;
            }
        }

        const result =
            await clockTimer
                .startInterval(
                    config.type,
                    config.lengthMilliseconds,
                    config.attributes,
                    2 * 60 * 1000 + 30 * 1000,
                    2 * 60 * 1000 + 30 * 1000,
                    transactionTime
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
        syncNewTripButtonAvailability();

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
        else if (
            endTimeGoalOverride &&
            String(
                clockTimer
                    .getActiveIntervalState?.(
                        event.detail?.now
                    )
                    ?.intervalType ||
                ""
            )
                .trim()
                .toLowerCase() ===
                    "down"
        ) {
            recalculateEndTimeGoalOverride();
        }

        renderTripActionState(
            event.detail?.now
        );

        void announceSyncRuntimeState();

        refreshTripLogLiveProjection(
            event.detail?.summary
        );
    });

    clockTimer.addEventListener("uiStateChanged", event => {
        renderClockTimerUIState(event.detail);
    });

    clockTimer.addEventListener("started", event => {
        setTripControlState(true);
        renderSyncGoalsState();

        void announceSyncRuntimeState({
            force: true
        });
    });

    clockTimer.addEventListener(
        "stopped",
        () => {
            renderSyncGoalsState();

            // Trip End is deliberately silent for Sync. Keep the baseline
            // accurate so a later transition is compared with the ready state.
            setSyncAnnouncementBaseline();
        }
    );

    clockTimer.addEventListener(
        "goalChanged",
        () => {
            renderSyncGoalsState();

            void announceSyncRuntimeState({
                preferCalculatedGoal:
                    true
            });
        }
    );

    clockTimer.addEventListener(
        "syncGoalRecalculated",
        event => {
            renderSyncGoalsState();

            if (
                event.detail?.source ===
                    "start" ||
                syncPreferenceChangeInProgress ||
                normalizedConnectionStatus() ===
                    "offline"
            ) {
                setSyncAnnouncementBaseline();
                return;
            }

            const syncOperation =
                event.detail?.operation ===
                    "sync";

            void announceSyncRuntimeState({
                force:
                    syncOperation,
                preferCalculatedGoal:
                    true,
                forceCalculatedGoal:
                    syncOperation
            });
        }
    );


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
        if (endTimeGoalOverride) {
            recalculateEndTimeGoalOverride();
        }

        renderTripActionState();

        void announceSyncRuntimeState({
            preferCalculatedGoal:
                true
        });
    });

    clockTimer.addEventListener("intervalEnded", () => {
        if (endTimeGoalOverride) {
            recalculateEndTimeGoalOverride();
        }

        renderTripActionState();

        void announceSyncRuntimeState({
            preferCalculatedGoal:
                true
        });
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

    const endTimeGoalRecalculationEvents = [
        "standardTimeChanged",
        "creationDateChanged",
        "creationTimeChanged",
        "scheduledStartChanged",
        "startTimeChanged",
        "intervalExtended",
        "intervalApprovalToggled",
        "intervalApprovalChanged",
        "intervalDeleted"
    ];

    for (const eventName of endTimeGoalRecalculationEvents) {
        clockTimer.addEventListener(
            eventName,
            () => {
                if (endTimeGoalOverride) {
                    recalculateEndTimeGoalOverride();
                }
            }
        );
    }



    for (const eventName of summaryRefreshEvents) {
        clockTimer.addEventListener(eventName, queueSummaryRefresh);
    }

    for (
        const eventName of
            [
                "started",
                "goalChanged",
                "renderedPercentGoalChanged",
                "goalFail",
                "goalChangeFailed",
                "standardTimeChanged"
            ]
    ) {
        clockTimer.addEventListener(
            eventName,
            () =>
                refreshTripLogLiveProjection(
                    undefined,
                    {
                        force: true
                    }
                )
        );
    }

    clockTimer.addEventListener("cleared", () => {
        tripLogLiveProjectionMilliseconds =
            undefined;
        releaseEndTimeGoalOverride();
        setTripControlState(false);
        setSyncAnnouncementBaseline();
        stagedStandardTimeMilliseconds =
            undefined;
        updateSummaryValues();
    });

    clockTimer.addEventListener("percentModeChanged", () => {
        syncScopeUI(true);
        queueSummaryRefresh();
        refreshTripLogLiveProjection(
            undefined,
            {
                force: true
            }
        );
    });

    clockTimer.addEventListener("renderedTimeModeChanged", () => {
        safeStorageSet(STORAGE.renderedTimeMode, clockTimer.renderedTimeMode);
        queueSummaryRefresh();
    });

    clockTimer.addEventListener("networkStatusChanged", () => {
        renderSyncGoalsState();

        void announceSyncRuntimeState();

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
        for(const icon of [toggleSyncGoalButton,$(".deferred-trip-icon"),$("#endTimeGoalLock")]) {
            if(!icon || icon.hidden) continue;
            const parent=icon.offsetParent;if(!parent) continue;
            icon.style.left=`${center-parent.getBoundingClientRect().left-parent.clientLeft-icon.offsetWidth/2}px`;
            icon.style.right="auto";
        }
    }
    const statusIconObserver=new ResizeObserver(()=>requestAnimationFrame(alignStatusIcons));
    for(const element of [scopeConnectionButton,toggleSyncGoalButton,$("#newTripButton"),$(".deferred-trip-icon"),$("#endTimeGoalLock")]) if(element) statusIconObserver.observe(element);

    // Semantic ClockTimer event integration points.
    // Notification layers use nestable disable counts so callers can suppress
    // one layer temporarily without disturbing another caller's suppression.
    const semanticDisableCounts = {
        chime: 0,
        summary: 0,
        details: 0
    };

    function setSemanticDisable(
        layer,
        value
    ) {
        if (
            !Object.hasOwn(
                semanticDisableCounts,
                layer
            )
        ) {
            throw new RangeError(
                "Unknown semantic notification layer: " +
                    layer
            );
        }

        const next =
            Number(value);

        if (
            !Number.isInteger(next) ||
            next < -1
        ) {
            throw new TypeError(
                "Semantic disable values must be -1 or a non-negative integer."
            );
        }

        semanticDisableCounts[layer] =
            next;

        return next;
    }

    function incrementSemanticDisable(
        layer
    ) {
        if (
            semanticDisableCounts[
                layer
            ] < 0
        ) {
            return -1;
        }

        semanticDisableCounts[layer] +=
            1;

        return semanticDisableCounts[layer];
    }

    function consumeSemanticAction(
        layer
    ) {
        const state =
            semanticDisableCounts[
                layer
            ];

        if (
            state === undefined
        ) {
            throw new RangeError(
                "Unknown semantic notification layer: " +
                    layer
            );
        }

        if (
            state === 0
        ) {
            return true;
        }

        if (
            state > 0
        ) {
            semanticDisableCounts[layer] =
                state - 1;
        }

        return false;
    }

    function cancelSemanticDisable(
        layer
    ) {
        const state =
            semanticDisableCounts[
                layer
            ];

        if (
            state === undefined
        ) {
            throw new RangeError(
                "Unknown semantic notification layer: " +
                    layer
            );
        }

        if (
            state > 0
        ) {
            semanticDisableCounts[layer] =
                state - 1;
        }

        return semanticDisableCounts[layer];
    }

    globalThis.WMOFSemanticNotifications =
        Object.freeze({
            setDisable:
                setSemanticDisable,
            incrementDisable:
                incrementSemanticDisable,
            consumeAction:
                consumeSemanticAction,
            cancelDisable:
                cancelSemanticDisable,
            get disableCounts() {
                return {
                    ...semanticDisableCounts
                };
            }
        });

    function consumeAnnouncementAction(
        announcement,
        layer,
        options
    ) {
        if (hamburgerAnnouncementSilent) {
            return {
                perform: false,
                userDisabled: false,
                runtimeSuppressed: true,
                menuSuppressed: true
            };
        }

        if (
            !audioCellUserEnabled(
                announcement,
                layer,
                options
            )
        ) {
            return {
                perform: false,
                userDisabled: true,
                runtimeSuppressed: false
            };
        }

        const before =
            semanticDisableCounts[layer];
        const perform =
            consumeSemanticAction(layer);

        return {
            perform,
            userDisabled: false,
            runtimeSuppressed:
                !perform && before > 0
        };
    }

    function reserveSemanticEvent(event, purpose) {
        const detail = event.detail;
        void detail;
        void purpose;
    }

    let semanticSpeechChain;
    let semanticSpeechSequence = 0;
    const activeSemanticAnnouncements =
        new Set();
    let exclusiveSemanticAnnouncementTail =
        Promise.resolve();
    let exclusiveSemanticAnnouncementPending =
        0;

    function reserveSemanticSpeech() {
        if (!semanticSpeechChain) {
            const chain = {
                last: 0
            };

            semanticSpeechChain =
                chain;

            queueMicrotask(
                () => {
                    if (
                        semanticSpeechChain ===
                            chain
                    ) {
                        semanticSpeechChain =
                            undefined;
                    }
                }
            );
        }

        const chain =
            semanticSpeechChain;
        const token =
            ++semanticSpeechSequence;

        chain.last =
            token;

        return () =>
            chain.last ===
                token;
    }

    function waitForAnnouncementDelay(
        milliseconds
    ) {
        const delay =
            Math.max(
                0,
                Number(
                    milliseconds
                ) ||
                0
            );

        return delay > 0
            ? new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        delay
                    )
            )
            : Promise.resolve();
    }

    function speakSemantic(
        audio,
        speech,
        options,
        guard,
        delayMs = 0
    ) {
        const run =
            () => {
                if (
                    guard &&
                    guard() === false
                ) {
                    return;
                }

                audio?.speak?.(
                    speech,
                    options
                );
            };

        if (
            delayMs > 0
        ) {
            setTimeout(
                run,
                delayMs
            );
            return;
        }

        queueMicrotask(
            run
        );
    }

    function speakSemanticAndWait(
        audio,
        speech,
        options,
        guard
    ) {
        if (
            guard &&
            guard() === false
        ) {
            return Promise.resolve(
                false
            );
        }

        if (
            !audio?.speak ||
            !String(
                speech ||
                ""
            ).trim()
        ) {
            return Promise.resolve(
                false
            );
        }

        return new Promise(
            resolve => {
                let settled =
                    false;

                const finish =
                    () => {
                        if (settled) {
                            return;
                        }

                        settled =
                            true;

                        resolve(
                            true
                        );
                    };

                const started =
                    audio.speak(
                        speech,
                        {
                            ...(options || {}),
                            onEnd:
                                finish,
                            onError:
                                finish
                        }
                    );

                if (!started) {
                    finish();
                }
            }
        );
    }

    function trackSemanticAnnouncement(
        task
    ) {
        activeSemanticAnnouncements
            .add(
                task
            );

        task.then(
            () =>
                activeSemanticAnnouncements
                    .delete(
                        task
                    ),
            () =>
                activeSemanticAnnouncements
                    .delete(
                        task
                    )
        );

        return task;
    }

    function runSemanticAnnouncement(
        announcement,
        playback,
        {
            exclusive = false
        } = {}
    ) {
        if (
            typeof playback !==
                "function"
        ) {
            return Promise.resolve(
                false
            );
        }

        if (exclusive) {
            exclusiveSemanticAnnouncementPending++;

            const previousExclusive =
                exclusiveSemanticAnnouncementTail
                    .catch(
                        () => {}
                    );
            const activeBefore =
                [
                    ...activeSemanticAnnouncements
                ];

            const task =
                previousExclusive
                    .then(
                        async () => {
                            if (
                                activeBefore
                                    .length
                            ) {
                                await Promise
                                    .allSettled(
                                        activeBefore
                                    );
                            }

                            return playback();
                        }
                    );

            exclusiveSemanticAnnouncementTail =
                task
                    .catch(
                        error => {
                            console.error(
                                "Exclusive announcement playback failed:",
                                announcement,
                                error
                            );
                        }
                    )
                    .finally(
                        () => {
                            exclusiveSemanticAnnouncementPending =
                                Math.max(
                                    0,
                                    exclusiveSemanticAnnouncementPending -
                                        1
                                );
                        }
                    );

            return task;
        }

        const blocker =
            exclusiveSemanticAnnouncementPending >
                0
                ? exclusiveSemanticAnnouncementTail
                    .catch(
                        () => {}
                    )
                : Promise.resolve();

        return trackSemanticAnnouncement(
            blocker.then(
                playback
            )
        );
    }

    function playSemanticSong(name, options = {}) {
        const audio =
            globalThis.WMOFAudio;
        const chime =
            consumeAnnouncementAction(
                name,
                "chime"
            );
        const summary =
            consumeAnnouncementAction(
                name,
                "summary"
            );

        if (
            (!chime.perform && !summary.perform) ||
            !audio?.startSong
        ) {
            return Promise.resolve(
                false
            );
        }

        const output =
            audioAnnouncementOutput(
                name
            );
        const speechGuard =
            summary.perform
                ? reserveSemanticSpeech()
                : undefined;
        const exclusive =
            announcementSpeechIgnoresMaster(
                name
            );

        return runSemanticAnnouncement(
            name,
            async () => {
                try {
                    const song =
                        await audio
                            .startSong(
                                announcementSongName(
                                    name
                                ),
                                {
                                    bpm: 180,
                                    includeTones:
                                        chime.perform,
                                    includeSpeech:
                                        summary.perform,
                                    speechGuard,
                                    speechVolume:
                                        output.speechVolume,
                                    toneVolume:
                                        output.toneVolume,
                                    speechVelocity:
                                        output.speechVelocity,
                                    toneVelocity:
                                        output.toneVelocity,
                                    speechDelayMs:
                                        chime.perform
                                            ? output.speechDelayMs
                                            : 0,
                                    ...options
                                }
                            );

                    await song
                        ?.finished;

                    return Boolean(
                        song
                    );
                }
                catch (error) {
                    console.error(
                        "Audio playback failed:",
                        name,
                        error
                    );

                    return false;
                }
            },
            {
                exclusive
            }
        );
    }

    function playSemanticSongThenSpeak(
        name,
        speech,
        options = {}
    ) {
        const audio =
            globalThis.WMOFAudio;
        const chime =
            consumeAnnouncementAction(
                name,
                "chime"
            );

        const output =
            audioAnnouncementOutput(
                name
            );
        const speechGuard =
            speech
                ? reserveSemanticSpeech()
                : undefined;
        const exclusive =
            announcementSpeechIgnoresMaster(
                name
            );

        return runSemanticAnnouncement(
            name,
            async () => {
                let played =
                    false;

                if (
                    chime.perform &&
                    audio?.startSong
                ) {
                    try {
                        const song =
                            await audio
                                .startSong(
                                    announcementSongName(
                                        name
                                    ),
                                    {
                                        bpm: 180,
                                        speechVolume:
                                            output.speechVolume,
                                        toneVolume:
                                            output.toneVolume,
                                        speechVelocity:
                                            output.speechVelocity,
                                        toneVelocity:
                                            output.toneVelocity,
                                        ...options,
                                        includeSpeech:
                                            false
                                    }
                                );

                        played =
                            Boolean(
                                song?.hasChime
                            );

                        await song
                            ?.finished;

                        if (played) {
                            await waitForAnnouncementDelay(
                                output
                                    .speechDelayMs
                            );
                        }
                    }
                    catch (error) {
                        console.error(
                            "Audio playback failed:",
                            name,
                            error
                        );
                    }
                }

                if (
                    speech &&
                    audio?.speak
                ) {
                    await speakSemanticAndWait(
                        audio,
                        speech,
                        {
                            speechVolume:
                                output.speechVolume,
                            speechVelocity:
                                output.speechVelocity
                        },
                        speechGuard
                    );
                }

                return {
                    played,
                    chime
                };
            },
            {
                exclusive
            }
        );
    }

    // Early/late announcements are about the timing gain or loss for
    // the current trip event. They intentionally never use summary.total.
    function tripTimingSpeech(
        detail,
        lead,
        disposition,
        announcement
    ) {
        const milliseconds =
            Number(
                detail
                    ?.timeDifferenceMilliseconds
            );

        const parts = [];

        if (
            consumeAnnouncementAction(
                announcement,
                "summary"
            ).perform
        ) {
            parts.push(
                lead + "."
            );
        }

        if (
            Number.isFinite(
                milliseconds
            ) &&
            consumeAnnouncementAction(
                announcement,
                "details"
            ).perform
        ) {
            parts.push(
                formatGoalFailureDuration(
                    Math.abs(
                        milliseconds
                    )
                ) +
                " " +
                disposition +
                "."
            );
        }

        return parts.join(
            " "
        );
    }

    function formatSpokenPercent(
        value
    ) {
        const percent =
            Math.round(
                Number(value) *
                    100
            );

        if (!Number.isFinite(percent)) {
            return "";
        }

        return (
            goalFailureNumberWords(
                percent
            ) +
            " percent"
        );
    }

    function renderedGoalLabel(
        detail
    ) {
        const summary =
            detail?.summary;
        const scope =
            String(
                summary?.scope ||
                ""
            ).toLowerCase();
        const selected =
            summary?.selected ||
            (
                scope === "total"
                    ? summary?.total
                    : summary?.trip
            );
        const percentGoal =
            Number(
                selected?.percentGoal
            );
        const roundedPercent =
            Number.isFinite(percentGoal)
                ? Math.round(
                    percentGoal * 100
                )
                : undefined;

        if (
            scope === "standard" ||
            roundedPercent === 100
        ) {
            return "Standard Goal";
        }

        if (!Number.isFinite(roundedPercent)) {
            return "";
        }

        const type =
            scope === "total"
                ? totalScopeLabel()
                : "Trip";

        return (
            type +
            " Goal " +
            goalFailureNumberWords(
                roundedPercent
            ) +
            " percent"
        );
    }

    function renderedGoalRemainingMilliseconds(
        detail
    ) {
        const summary =
            detail?.summary;
        const scope =
            String(
                summary?.scope ||
                ""
            ).toLowerCase();
        const selected =
            summary?.selected ||
            (
                scope === "total"
                    ? summary?.total
                    : summary?.trip
            );
        const standard =
            Number(
                selected?.standardTimeMilliseconds
            );
        const counted =
            Number(
                selected?.countedTimeElapsedMilliseconds
            );
        const percentGoal =
            Number(
                selected?.percentGoal
            );
        const allowanceCredit =
            Number(
                selected?.allowanceCreditMilliseconds ??
                0
            );

        if (
            !Number.isFinite(standard) ||
            !Number.isFinite(counted) ||
            !Number.isFinite(percentGoal) ||
            percentGoal <= 0
        ) {
            return undefined;
        }

        return Math.round(
            standard /
                percentGoal +
            (
                Number.isFinite(allowanceCredit)
                    ? allowanceCredit
                    : 0
            ) -
            counted
        );
    }

    function tripStartGoalDetailSpeech(
        detail
    ) {
        const remaining =
            renderedGoalRemainingMilliseconds(
                detail
            );
        const label =
            renderedGoalLabel(
                detail
            );

        if (
            !Number.isFinite(remaining) ||
            remaining <= 0 ||
            !label
        ) {
            return "";
        }

        return (
            formatGoalFailureDuration(
                remaining
            ) +
            " until " +
            label +
            "."
        );
    }

    function tripEndTotalSpeech(
        detail
    ) {
        const total =
            detail?.summary?.total;
        const countedPercent =
            Number(
                total?.countedPercent
            );
        const parts = [];
        const summary =
            consumeAnnouncementAction(
                "trip-ended",
                "summary"
            );
        const details =
            consumeAnnouncementAction(
                "trip-ended",
                "details"
            );

        if (summary.perform) {
            parts.push(
                "Trip ended."
            );

            if (
                Number.isFinite(
                    countedPercent
                )
            ) {
                parts.push(
                    totalScopeLabel() + " percent: " +
                        formatSpokenPercent(
                            countedPercent
                        ) +
                        "."
                );
            }
        }

        if (details.perform) {
            const remaining =
                renderedGoalRemainingMilliseconds(
                    detail
                );
            const label =
                renderedGoalLabel(
                    detail
                );

            if (
                Number.isFinite(remaining) &&
                label
            ) {
                if (remaining > 0) {
                    parts.push(
                        formatGoalFailureDuration(
                            remaining
                        ) +
                        " banked toward " +
                        label +
                        "."
                    );
                }
                else if (remaining < 0) {
                    parts.push(
                        formatGoalFailureDuration(
                            Math.abs(
                                remaining
                            )
                        ) +
                        " over " +
                        label +
                        "."
                    );
                }
            }
        }

        return parts.join(" ");
    }

    let lunchClockCueState;

    function clearLunchClockCueState() {
        if (!lunchClockCueState) {
            return;
        }

        clearTimeout(
            lunchClockCueState.clockOutTimer
        );
        clearTimeout(
            lunchClockCueState.clockInTimer
        );

        lunchClockCueState =
            undefined;
    }

    function scheduleLunchClockCues(detail = {}) {
        clearLunchClockCueState();

        const isLunch =
            detail.isLunch === true ||
            String(
                detail.breakType ||
                detail.intervalType ||
                ""
            )
                .toLowerCase() ===
                "lunch";

        if (!isLunch) {
            return;
        }

        const clockOutAt =
            new Date(
                detail.startTime
            ).getTime();

        const clockInAt =
            new Date(
                detail.endTime
            ).getTime();

        const state = {
            clockOutAt,
            clockInAt,
            clockOutFired: false,
            clockInFired: false,
            clockOutTimer: undefined,
            clockInTimer: undefined
        };

        lunchClockCueState =
            state;

        const fireClockOut =
            () => {
                if (
                    lunchClockCueState !==
                        state ||
                    state.clockOutFired
                ) {
                    return;
                }

                state.clockOutFired =
                    true;

                playSemanticSong(
                    "lunch-clock-out",
                    {
                        bpm: 120
                    }
                );
            };

        const fireClockIn =
            () => {
                if (
                    lunchClockCueState !==
                        state ||
                    state.clockInFired
                ) {
                    return;
                }

                state.clockInFired =
                    true;

                playSemanticSong(
                    "lunch-clock-in",
                    {
                        bpm: 120
                    }
                );
            };

        if (
            Number.isFinite(
                clockOutAt
            )
        ) {
            state.clockOutTimer =
                setTimeout(
                    fireClockOut,
                    Math.max(
                        0,
                        clockOutAt -
                            Date.now()
                    )
                );
        }

        if (
            Number.isFinite(
                clockInAt
            )
        ) {
            state.clockInTimer =
                setTimeout(
                    fireClockIn,
                    Math.max(
                        0,
                        clockInAt -
                            Date.now()
                    )
                );
        }
    }

    function finishLunchClockCues(detail = {}) {
        const state =
            lunchClockCueState;

        if (!state) {
            return;
        }

        clearTimeout(
            state.clockOutTimer
        );
        clearTimeout(
            state.clockInTimer
        );

        const endedAt =
            new Date(
                detail.actualEndTime ||
                detail.endTime ||
                Date.now()
            ).getTime();

        if (
            state.clockOutFired &&
            !state.clockInFired &&
            (
                !Number.isFinite(
                    state.clockInAt
                ) ||
                !Number.isFinite(
                    endedAt
                ) ||
                endedAt <
                    state.clockInAt
            )
        ) {
            state.clockInFired =
                true;

            playSemanticSong(
                "lunch-clock-in",
                {
                    bpm: 120
                }
            );
        }

        lunchClockCueState =
            undefined;
    }

    let endingIntoNewTrip =
        false;

    let pendingEndStartTripSpeech;

    function tripDraftUsesEndStartTransition() {
        return (
            tripDraft
                ?.endStartTransition ===
            true
        );
    }




    function formatTripTransitionMoment(
        value
    ) {
        const date =
            value instanceof Date
                ? new Date(
                    value.getTime()
                )
                : new Date(
                    value
                );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "---";
        }

        const military =
            clockTimer.getAttribute(
                "military-time"
            ) !==
                "false";
        const minutes =
            String(
                date.getMinutes()
            )
                .padStart(
                    2,
                    "0"
                );
        const seconds =
            String(
                date.getSeconds()
            )
                .padStart(
                    2,
                    "0"
                );

        if (military) {
            return (
                String(
                    date.getHours()
                )
                    .padStart(
                        2,
                        "0"
                    ) +
                ":" +
                minutes +
                ":" +
                seconds
            );
        }

        const hours =
            date.getHours();

        return (
            String(
                hours %
                    12 ||
                12
            ) +
            ":" +
            minutes +
            ":" +
            seconds +
            " " +
            (
                hours >=
                    12
                    ? "PM"
                    : "AM"
            )
        );
    }

    function formatTripTransitionDuration(
        value
    ) {
        const milliseconds =
            Number(
                value
            );

        if (
            !Number.isFinite(
                milliseconds
            )
        ) {
            return "---";
        }

        return formatDuration(
            Math.abs(
                milliseconds
            )
        );
    }

    function tripTransitionRow(
        label,
        value
    ) {
        const text =
            String(
                value ??
                ""
            )
                .trim();

        if (
            !text ||
            text ===
                "---"
        ) {
            return undefined;
        }

        return {
            label,
            value:
                text
        };
    }

    function renderTripTransitionOverlayItem(
        item
    ) {
        if (
            !tripTransitionOverlay ||
            !tripTransitionOverlayTitle ||
            !tripTransitionOverlayDetails
        ) {
            tripTransitionOverlayActive =
                false;
            return;
        }

        tripTransitionOverlayTitle.textContent =
            item.title;
        tripTransitionOverlayDetails
            .replaceChildren(
                ...item.rows
                    .map(
                        row => {
                            const element =
                                document.createElement(
                                    "div"
                                );
                            const label =
                                document.createElement(
                                    "span"
                                );
                            const value =
                                document.createElement(
                                    "code"
                                );

                            element.className =
                                "trip-transition-overlay-row";
                            label.textContent =
                                row.label;
                            value.textContent =
                                row.value;

                            element.append(
                                label,
                                value
                            );

                            return element;
                        }
                    )
            );

        tripTransitionOverlay.hidden =
            false;

        try {
            if (
                tripTransitionOverlay
                    .hasAttribute(
                        "popover"
                    ) &&
                !tripTransitionOverlay
                    .matches(
                        ":popover-open"
                    )
            ) {
                tripTransitionOverlay
                    .showPopover?.();
            }
        }
        catch {}

        requestAnimationFrame(
            () => {
                tripTransitionOverlay
                    .classList
                    .add(
                        "is-visible"
                    );

                syncTripTransitionEditorLayout(
                    true
                );
            }
        );

        clearTimeout(
            tripTransitionOverlayTimer
        );
        clearTimeout(
            tripTransitionOverlayHideTimer
        );

        tripTransitionOverlayTimer =
            setTimeout(
                () => {
                    syncTripTransitionEditorLayout(
                        false
                    );

                    tripTransitionOverlay
                        .classList
                        .remove(
                            "is-visible"
                        );

                    tripTransitionOverlayHideTimer =
                        setTimeout(
                            () => {
                                try {
                                    if (
                                        tripTransitionOverlay
                                            .matches?.(
                                                ":popover-open"
                                            )
                                    ) {
                                        tripTransitionOverlay
                                            .hidePopover?.();
                                    }
                                }
                                catch {}

                                tripTransitionOverlay.hidden =
                                    true;
                                tripTransitionOverlayActive =
                                    false;

                                const next =
                                    tripTransitionOverlayQueue
                                        .shift();

                                if (next) {
                                    tripTransitionOverlayActive =
                                        true;
                                    renderTripTransitionOverlayItem(
                                        next
                                    );
                                }
                            },
                            280
                        );
                },
                7000
            );
    }

    function enqueueTripTransitionOverlay(
        title,
        rows
    ) {
        const item = {
            title,
            rows:
                rows.filter(
                    Boolean
                )
        };

        if (
            tripTransitionOverlayActive
        ) {
            tripTransitionOverlayQueue
                .push(
                    item
                );
            return;
        }

        tripTransitionOverlayActive =
            true;

        renderTripTransitionOverlayItem(
            item
        );
    }

    function showTripEndTransitionOverlay(
        detail
    ) {
        const total =
            detail?.summary?.total;
        const countedPercent =
            Number(
                total?.countedPercent
            );
        const remaining =
            renderedGoalRemainingMilliseconds(
                detail
            );
        const goalLabel =
            renderedGoalLabel(
                detail
            );
        const rows = [];

        if (
            Number.isFinite(
                countedPercent
            )
        ) {
            rows.push(
                tripTransitionRow(
                    totalScopeLabel() +
                        " Percent",
                    formatActualPercent(
                        countedPercent
                    )
                )
            );
        }

        if (
            Number.isFinite(
                remaining
            ) &&
            goalLabel
        ) {
            if (
                remaining >
                0
            ) {
                rows.push(
                    tripTransitionRow(
                        "Banked Toward " +
                            goalLabel,
                        formatTripTransitionDuration(
                            remaining
                        )
                    )
                );
            }
            else if (
                remaining <
                0
            ) {
                rows.push(
                    tripTransitionRow(
                        "Over " +
                            goalLabel,
                        formatTripTransitionDuration(
                            remaining
                        )
                    )
                );
            }
        }

        enqueueTripTransitionOverlay(
            "Trip Ended",
            rows
        );
    }

    async function onTripStarted(event) {
        globalThis
            .SpeechMenu
            ?.beginSpeechTimingTrip?.();

        reserveSemanticEvent(
            event,
            "Trip started on time"
        );

        const audio =
            globalThis.WMOFAudio;
        const chime =
            consumeAnnouncementAction(
                "trip-started",
                "chime"
            );
        const summary =
            consumeAnnouncementAction(
                "trip-started",
                "summary"
            );
        const details =
            consumeAnnouncementAction(
                "trip-started",
                "details"
            );
        const parts = [];

        if (summary.perform) {
            parts.push(
                chime.runtimeSuppressed &&
                !chime.userDisabled
                    ? "Trip in Progress."
                    : "Trip started."
            );
        }

        if (details.perform) {
            const detailSpeech =
                tripStartGoalDetailSpeech(
                    event.detail
                );

            if (detailSpeech) {
                parts.push(
                    detailSpeech
                );
            }
        }

        const output =
            audioAnnouncementOutput(
                "trip-started"
            );
        const speechGuard =
            parts.length
                ? reserveSemanticSpeech()
                : undefined;

        return runSemanticAnnouncement(
            "trip-started",
            async () => {
                let chimePlayed =
                    false;

                if (
                    chime.perform &&
                    audio?.startSong
                ) {
                    try {
                        const song =
                            await audio
                                .startSong(
                                    "trip-started",
                                    {
                                        bpm: 180,
                                        includeSpeech:
                                            false,
                                        speechVolume:
                                            output.speechVolume,
                                        toneVolume:
                                            output.toneVolume,
                                        speechVelocity:
                                            output.speechVelocity,
                                        toneVelocity:
                                            output.toneVelocity
                                    }
                                );

                        chimePlayed =
                            Boolean(
                                song?.hasChime
                            );

                        await song
                            ?.finished;

                        if (chimePlayed) {
                            await waitForAnnouncementDelay(
                                output
                                    .speechDelayMs
                            );
                        }
                    }
                    catch (error) {
                        console.error(
                            "Audio playback failed:",
                            "trip-started",
                            error
                        );
                    }
                }

                if (
                    parts.length &&
                    audio?.speak
                ) {
                    await speakSemanticAndWait(
                        audio,
                        parts.join(" "),
                        {
                            speechVolume:
                                output.speechVolume,
                            speechVelocity:
                                output.speechVelocity
                        },
                        speechGuard
                    );
                }

                return true;
            },
            {
                exclusive:
                    announcementSpeechIgnoresMaster(
                        "trip-started"
                    )
            }
        );
    }

    function onTripStartedEarly(event) {
        globalThis
            .SpeechMenu
            ?.beginSpeechTimingTrip?.();

        reserveSemanticEvent(event, "Trip started early");

        void playSemanticSongThenSpeak(
            "trip-started-early",
            tripTimingSpeech(
                event.detail,
                "Trip started early",
                "saved",
                "trip-started-early"
            )
        );
    }

    function onTripStartedLate(event) {
        globalThis
            .SpeechMenu
            ?.beginSpeechTimingTrip?.();

        reserveSemanticEvent(event, "Trip started late");

        void playSemanticSongThenSpeak(
            "trip-started-late",
            tripTimingSpeech(
                event.detail,
                "Trip started late",
                "lost",
                "trip-started-late"
            )
        );
    }

    function onBreakStarted(event) {
        reserveSemanticEvent(event, "Break or lunch started");

        const breakType =
            String(
                event.detail?.breakType ||
                event.detail?.intervalType ||
                ""
            ).toLowerCase();

        playSemanticSong(
            breakType === "lunch"
                ? "lunch-started"
                : breakType === "short"
                    ? "short-break-started"
                    : "break-started"
        );

        scheduleLunchClockCues(
            event.detail
        );
    }

    function onBreakEndedEarly(event) {
        reserveSemanticEvent(event, "Break or lunch manually ended before the auto-restart boundary");
        void playSemanticSongThenSpeak(
            "trip-resumed-early",
            tripTimingSpeech(
                event.detail,
                "Trip resumed early",
                "saved",
                "trip-resumed-early"
            )
        );
        finishLunchClockCues(
            event.detail
        );
    }

    function onBreakEndedAutomatically(event) {
        reserveSemanticEvent(event, "Break or lunch automatically ended at the end-buffer boundary");
        playSemanticSong("trip-resumed-automatically");
        finishLunchClockCues(
            event.detail
        );
    }

    function onBreakEndedLate(event) {
        reserveSemanticEvent(event, "Break or lunch manually ended after the end-buffer boundary");
        void playSemanticSongThenSpeak(
            "trip-resumed-after-break",
            tripTimingSpeech(
                event.detail,
                "Trip resumed",
                "lost",
                "trip-resumed-after-break"
            )
        );
        finishLunchClockCues(
            event.detail
        );
    }

    function onDownTimeStarted(event) {
        reserveSemanticEvent(event, "Down time started");
        playSemanticSong("down-time-started");
    }

    function onTripResumed(event) {
        reserveSemanticEvent(
            event,
            event.detail
                ?.suppressAnnouncement
                ? "Trip resumed from down time during an interval handoff"
                : "Trip resumed from down time"
        );

        if (
            event.detail
                ?.suppressAnnouncement
        ) {
            return;
        }

        playSemanticSong(
            "trip-resumed-from-down"
        );
    }

    function onTripEnded(event) {
        const speechTimingProfile =
            globalThis
                .SpeechMenu
                ?.finishSpeechTimingTrip?.();

        if (speechTimingProfile) {
            void persistSpeechTimingProfile(
                speechTimingProfile
            ).catch(
                error =>
                    console.warn(
                        "Speech timing profile was not saved:",
                        error
                    )
            );
        }

        showTripEndTransitionOverlay(
            event.detail
        );

        reserveSemanticEvent(event, "Trip ended");

        const speech =
            tripEndTotalSpeech(
                event.detail
            );

        if (
            endingIntoNewTrip
        ) {
            pendingEndStartTripSpeech =
                speech;

            // The direct end->start workflow preloads one chime suppression.
            // Attempting the ordinary End Trip cue here consumes that slot,
            // so the legacy 3-note cue is skipped without special casing the
            // audio helper itself.
            consumeSemanticAction(
                "chime"
            );

            return;
        }

        void playSemanticSongThenSpeak(
            "trip-ended",
            speech
        );
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

    function goalFailureNumberWords(
        value
    ) {
        const number =
            Math.max(
                0,
                Math.round(
                    Number(value)
                )
            );

        if (!Number.isFinite(number)) {
            return "";
        }

        const small = [
            "zero", "one", "two", "three", "four",
            "five", "six", "seven", "eight", "nine",
            "ten", "eleven", "twelve", "thirteen",
            "fourteen", "fifteen", "sixteen",
            "seventeen", "eighteen", "nineteen"
        ];

        const tens = [
            "", "", "twenty", "thirty", "forty",
            "fifty", "sixty", "seventy",
            "eighty", "ninety"
        ];

        const underThousand =
            number => {
                if (number < 20) {
                    return small[number];
                }

                if (number < 100) {
                    const remainder =
                        number % 10;

                    return (
                        tens[
                            Math.floor(
                                number / 10
                            )
                        ] +
                        (
                            remainder
                                ? "-" +
                                    small[
                                        remainder
                                    ]
                                : ""
                        )
                    );
                }

                const remainder =
                    number % 100;

                return (
                    small[
                        Math.floor(
                            number / 100
                        )
                    ] +
                    " hundred" +
                    (
                        remainder
                            ? " and " +
                                underThousand(
                                    remainder
                                )
                            : ""
                    )
                );
            };

        if (number < 1000) {
            return underThousand(
                number
            );
        }

        if (number < 1000000) {
            const thousands =
                Math.floor(
                    number / 1000
                );

            const remainder =
                number % 1000;

            return (
                goalFailureNumberWords(
                    thousands
                ) +
                " thousand" +
                (
                    remainder
                        ? " " +
                            underThousand(
                                remainder
                            )
                        : ""
                )
            );
        }

        return String(number);
    }

    function formatGoalFailureDuration(
        milliseconds
    ) {
        const totalSeconds =
            Math.max(
                0,
                Math.round(
                    Number(milliseconds) /
                        1000
                )
            );

        const hours =
            Math.floor(
                totalSeconds /
                    3600
            );

        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                    60
            );

        const seconds =
            totalSeconds %
                60;

        if (audioSettings.formalTime) {
            const formalParts = [];

            if (hours > 0) {
                formalParts.push(
                    goalFailureNumberWords(hours) +
                    (hours === 1 ? " hour" : " hours")
                );
            }

            if (minutes > 0) {
                formalParts.push(
                    goalFailureNumberWords(minutes) +
                    (minutes === 1 ? " minute" : " minutes")
                );
            }

            if (seconds > 0 || !formalParts.length) {
                formalParts.push(
                    goalFailureNumberWords(seconds) +
                    (seconds === 1 ? " second" : " seconds")
                );
            }

            if (formalParts.length === 1) {
                return formalParts[0];
            }

            return (
                formalParts
                    .slice(0, -1)
                    .join(", ") +
                " and " +
                formalParts[
                    formalParts.length - 1
                ]
            );
        }

        if (seconds > 0) {
            const positionalPart =
                value =>
                    value === 0
                        ? "oh oh"
                        : value < 10
                            ? "oh " +
                                goalFailureNumberWords(
                                    value
                                )
                            : goalFailureNumberWords(
                                value
                            );

            if (hours > 0) {
                return (
                    goalFailureNumberWords(
                        hours
                    ) +
                    " " +
                    positionalPart(
                        minutes
                    ) +
                    " " +
                    positionalPart(
                        seconds
                    )
                );
            }

            if (minutes > 0) {
                return (
                    goalFailureNumberWords(
                        minutes
                    ) +
                    " " +
                    positionalPart(
                        seconds
                    )
                );
            }
        }

        const parts = [];

        if (hours > 0) {
            parts.push(
                hours === 1
                    ? "an hour"
                    : goalFailureNumberWords(
                        hours
                    ) +
                        " hours"
            );
        }

        if (minutes > 0) {
            parts.push(
                goalFailureNumberWords(
                    minutes
                ) +
                " minute" +
                (
                    minutes === 1
                        ? ""
                        : "s"
                )
            );
        }

        if (
            seconds > 0 ||
            !parts.length
        ) {
            parts.push(
                goalFailureNumberWords(
                    seconds
                ) +
                " second" +
                (
                    seconds === 1
                        ? ""
                        : "s"
                )
            );
        }

        if (parts.length < 2) {
            return parts[0];
        }

        if (
            hours > 0 &&
            minutes > 0 &&
            seconds === 0 &&
            parts.length === 2
        ) {
            const minuteNumber =
                goalFailureNumberWords(
                    minutes
                );

            const minuteSyllables =
                minuteNumber
                    .toLowerCase()
                    .replace(
                        /[^a-z\s-]/g,
                        ""
                    )
                    .split(
                        /[\s-]+/
                    )
                    .filter(Boolean)
                    .reduce(
                        (total, word) => {
                            const normalized =
                                word
                                    .replace(
                                        /(?:e|es|ed)$/,
                                        ""
                                    );
                            const groups =
                                normalized.match(
                                    /[aeiouy]+/g
                                );
                            return (
                                total +
                                Math.max(
                                    1,
                                    groups?.length ||
                                        0
                                )
                            );
                        },
                        0
                    );
            const omitAnd =
                minutes > 9 &&
                minuteSyllables > 1;

            return (
                parts[0] +
                (
                    omitAnd
                        ? " "
                        : " and "
                ) +
                minuteNumber
            );
        }

        if (
            hours > 0 &&
            seconds > 0
        ) {
            if (minutes === 0) {
                return (
                    parts[0] +
                    " " +
                    goalFailureNumberWords(
                        seconds
                    ) +
                    (
                        seconds === 1
                            ? " second"
                            : " seconds"
                    )
                );
            }

            return (
                parts[0] +
                " " +
                goalFailureNumberWords(
                    minutes
                ) +
                " and " +
                goalFailureNumberWords(
                    seconds
                )
            );
        }

        return (
            parts
                .slice(
                    0,
                    -1
                )
                .join(", ") +
            " and " +
            parts[
                parts.length - 1
            ]
        );
    }

    function buildGoalFailureSpeech(
        detail = {}
    ) {
        const goals =
            Array.isArray(detail.goals)
                ? detail.goals
                : [];

        const percentMode =
            normalizePercentMode(
                clockTimer.percentMode
            );

        const announcedGoals =
            percentMode === "trip"
                ? goals.filter(
                    goal =>
                        goal?.type ===
                            "standard" ||
                        goal?.type ===
                            "trip"
                )
                : percentMode === "total"
                    ? goals.filter(
                        goal =>
                            goal?.type ===
                                "standard" ||
                            goal?.type ===
                                "total"
                    )
                    : goals;

        const standardFailed =
            announcedGoals.some(
                goal =>
                    goal?.type ===
                        "standard"
            );

        const belowStandardFailed =
            announcedGoals.some(
                goal => {
                    const percent =
                        Number(
                            goal?.percent
                        );

                    return (
                        goal?.type !==
                            "standard" &&
                        Number.isFinite(
                            percent
                        ) &&
                        percent < 1
                    );
                }
            );

        const summarySentences = [];

        // In fixed Trip/Total modes, crossing Standard is its own temporal
        // boundary announcement. Do not combine it with the fixed goal.
        if (
            standardFailed &&
            (
                percentMode === "trip" ||
                percentMode === "total"
            )
        ) {
            summarySentences.push(
                "Standard Goal Failed."
            );
        }
        else {
            if (standardFailed) {
                summarySentences.push(
                    "Standard Goal Failed."
                );
            }

            for (const goal of announcedGoals) {
                if (
                    goal?.type ===
                        "trip"
                ) {
                    summarySentences.push(
                        "Trip Goal Failed."
                    );
                }
                else if (
                    goal?.type ===
                        "total"
                ) {
                    summarySentences.push(
                        totalScopeLabel() + " Goal Failed."
                    );
                }
            }
        }

        const detailSentences = [];
        const fallback =
            detail.fallback;

        if (fallback) {
            const type =
                String(
                    fallback.type ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            const percent =
                Number(
                    fallback.percent
                );

            const remainingMilliseconds =
                Number(
                    fallback
                        .remainingMilliseconds
                );

            if (
                percentMode === "auto" &&
                Number.isFinite(
                    remainingMilliseconds
                ) &&
                (
                    type === "standard" ||
                    type === "trip" ||
                    type === "total"
                )
            ) {
                const roundedPercent =
                    Number.isFinite(percent)
                        ? Math.round(
                            percent * 100
                        )
                        : undefined;

                const useStandardLabel =
                    type === "standard" ||
                    roundedPercent === 100;

                const label =
                    useStandardLabel
                        ? "Standard"
                        : type === "trip"
                            ? "Trip"
                            : totalScopeLabel();

                const percentText =
                    !useStandardLabel &&
                    Number.isFinite(
                        roundedPercent
                    )
                        ? " " +
                            goalFailureNumberWords(
                                roundedPercent
                            ) +
                            " percent"
                        : "";

                detailSentences.push(
                    `${formatGoalFailureDuration(
                        remainingMilliseconds
                    )} until ${label} Goal${percentText}.`
                );
            }
        }

        if (belowStandardFailed) {
            detailSentences.push(
                "Overtime in progress."
            );
        }

        const spoken = [];

        if (
            summarySentences.length &&
            consumeAnnouncementAction(
                "goal-failed",
                "summary"
            ).perform
        ) {
            spoken.push(
                ...summarySentences
            );
        }

        if (
            detailSentences.length &&
            consumeAnnouncementAction(
                "goal-failed",
                "details"
            ).perform
        ) {
            spoken.push(
                ...detailSentences
            );
        }

        return spoken.join(
            " "
        );
    }

    async function speakGoalFailure(
        detail
    ) {
        const audio =
            globalThis
                .WMOFAudio;

        const speech =
            buildGoalFailureSpeech(
                detail
            );
        const chime =
            consumeAnnouncementAction(
                "goal-failed",
                "chime"
            );

        return runSemanticAnnouncement(
            "goal-failed",
            async () => {
                if (
                    chime.perform &&
                    audio?.startSong
                ) {
                    try {
                        const song =
                            await audio
                                .startSong(
                                    "goal-failed",
                                    {
                                        bpm: 100
                                    }
                                );

                        await song
                            ?.finished;
                    }
                    catch (
                        error
                    ) {
                        console.error(
                            "Audio playback failed:",
                            "goal-failed",
                            error
                        );
                    }
                }

                if (speech) {
                    await speakSemanticAndWait(
                        audio,
                        speech
                    );
                }

                return true;
            }
        );
    }

    function onGoalFail(event) {
        reserveSemanticEvent(
            event,
            "One or more goals failed"
        );

        void speakGoalFailure(
            event.detail
        );
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

        void loadSpeechTimingProfile()
            .catch(
                error =>
                    console.warn(
                        "Speech timing profile was not loaded:",
                        error
                    )
            );

        reserveSemanticEvent(event, "ClockTimer connected");
    }

    function onDisconnected(event) {
        if (event.detail?.source === "disconnect") {
            if (speechTrainingActive) {
                stopInAppSpeechTraining({
                    forced: true
                });
            } else if (inAppSpeechTrainingEnabled) {
                disableInAppSpeechTraining();
            }

            signedInProfile = undefined;
            identityContext
                ?.clear?.();
            userLookup
                ?.sync?.();

            void liveTripStream
                ?.close?.()
                .catch(
                    () => {}
                );
            speechTrainingCsrfToken = undefined;
            globalThis
                .SpeechMenu
                ?.resetSpeechTimingTrip?.();
            for (const id of ["profileUsername", "firstName", "lastName", "preferredName"]) $("#" + id).value = "";
            syncSpeechTrainingControls();
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
        goalFail: onGoalFail,
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

    globalThis
        .WMOFSpeechProcessingFunctions
        .define(
            "normalizeSpeechValue",
            (
                text,
                {
                    field,
                    kind,
                    pattern,
                    provisional
                }
            ) => {
                if (kind === "keypad") {
                    if (
                        (
                            !numberPadDialog
                                ?.open &&
                            !voiceEntryState
                        ) ||
                        !numberPadState
                    ) {
                        return text;
                    }

                    kind =
                        numberPadState.mode ===
                            "absolute"
                            ? "clock-parts"
                            : numberPadState.mode ===
                                "percent"
                                ? "percent"
                                : "duration";
                }

                if (
                    !field ||
                    !pattern
                ) {
                    return text;
                }

                const match =
                    new RegExp(
                        pattern,
                        "i"
                    )
                        .exec(text);

                const phrase =
                    match?.groups
                        ?.[field];

                if (
                    typeof phrase !==
                        "string"
                ) {
                    return text;
                }

                const normalized =
                    EnglishSpeechValuePreprocessor
                        .normalize(
                            phrase,
                            kind
                        );

                if (
                    normalized ===
                        undefined
                ) {
                    return provisional ? false : text;
                }

                const start =
                    match.index +
                    match[0]
                        .lastIndexOf(
                            phrase
                        );

                return (
                    text.slice(
                        0,
                        start
                    ) +
                    normalized +
                    text.slice(
                        start +
                            phrase.length
                    )
                );
            }
        );

    let pendingSpeechReady;
    const SPEECH_READY_CONTINUATION_WINDOW =
        1800;

    const cancelPendingSpeechReady =
        () => {
            const changed =
                pendingSpeechReady !==
                    undefined;

            if (changed) {
                clearTimeout(
                    pendingSpeechReady
                );
            }

            pendingSpeechReady =
                undefined;

            if (changed) {
                refreshSpeechCommandContext();
            }
        };

    const armSpeechReadyContinuation =
        () => {
            cancelPendingSpeechReady();

            pendingSpeechReady =
                setTimeout(
                    () => {
                        pendingSpeechReady =
                            undefined;
                        refreshSpeechCommandContext();
                    },
                    SPEECH_READY_CONTINUATION_WINDOW
                );

            refreshSpeechCommandContext();
        };

    const openStartMenuWorkflow =
        ({
            preserveSpeechContinuation =
                false,
            inputMode
        } = {}) => {
            if (
                tripIsLive() ||
                $("#newTripButton")
                    ?.disabled
            ) {
                return false;
            }

            if (
                !preserveSpeechContinuation
            ) {
                cancelPendingSpeechReady();
            }

            const signal =
                globalThis
                    .WMOFActionFunctions
                    ?.invocationContext
                    ?.signal;

            const speechWorkflow =
                inputMode ===
                    "voice";

            if (speechWorkflow) {
                lockNewTripWorkflow();
            }

            return Promise
                .resolve(
                    beginNewTripWorkflow({
                        tripMoment:
                            new Date(),
                        signal,
                        inputMode
                    })
                )
                .then(
                    result => {
                        const aborted =
                            Boolean(
                                signal?.aborted
                            );

                        if (
                            speechWorkflow &&
                            (
                                aborted ||
                                result === false
                            )
                        ) {
                            releaseNewTripWorkflow();
                        }

                        return aborted
                            ? true
                            : result !== false;
                    }
                )
                .catch(
                    () => {
                        if (speechWorkflow) {
                            releaseNewTripWorkflow();
                        }

                        return Boolean(
                            signal?.aborted
                        );
                    }
                );
        };

    const closeActiveSpeechSurface =
        async () => {
            const interruptedAction =
                globalThis
                    .WMOFActionFunctions
                    ?.invocationContext
                    ?.interruptedAction;

            if (
                speechMicBar
                    ?.optionsOpen
            ) {
                void speechMicBar
                    .hideOptions?.();

                return true;
            }

            const popover =
                [
                    ...document
                        .querySelectorAll(
                            "[popover]"
                        )
                ]
                    .filter(
                        element =>
                            element !==
                                speechMicBar &&
                            popoverIsOpen(
                                element
                            )
                    )
                    .at(-1);

            if (popover) {
                if (
                    popover.id ===
                    "graphicalHelpPopover"
                ) {
                    await closeSettingsHelpPopover();
                }
                else {
                    popover.hidePopover?.();
                }

                return true;
            }

            const dialog =
                [
                    ...document
                        .querySelectorAll(
                            "dialog[open]"
                        )
                ].at(-1);

            if (!dialog) {
                if (
                    getTripListState() ===
                        "open"
                ) {
                    await closeTripList(
                        "speech-close"
                    );

                    return true;
                }

                return Boolean(
                    interruptedAction
                );
            }

            if (
                dialog ===
                numberPadDialog
            ) {
                return cancelNumberPad();
            }

            if (
                dialog ===
                tripSettingsDialog
            ) {
                return cancelTripSettingsDialog(
                    "speech-close"
                );
            }

            if (
                dialog ===
                scheduledStartDialog
            ) {
                cancelScheduledStartPrompt();

                return true;
            }

            return closeDialogWithReturn(
                dialog,
                {
                    reason:
                        "speech-close"
                }
            );
        };

    globalThis
        .WMOFSpeechAvailability =
        Object.freeze({
            canStartTrip() {
                return (
                    !tripIsLive() &&
                    !$("#newTripButton")
                        ?.disabled
                );
            },

            canUseReady() {
                if (!tripIsLive()) {
                    return (
                        !$("#newTripButton")
                            ?.disabled
                    );
                }

                const type =
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            )
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase();

                return ![
                    "break",
                    "lunch",
                    "down"
                ].includes(
                    type
                );
            },

            canContinueStartAt() {
                return (
                    (
                        pendingSpeechReady !==
                            undefined ||
                        newTripWorkflowLocked
                    ) &&
                    !tripIsLive()
                );
            },

            canUseInformational() {
                return tripIsLive();
            },

            canOpenBreakMenu() {
                return !breakButton?.disabled;
            },

            canStartDownTime() {
                const activeIntervalType =
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            )
                            ?.intervalType ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    activeIntervalType !==
                        "down" &&
                    !downButton?.disabled
                );
            },

            canOpenBreakEndMenu() {
                const type =
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            )
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase();

                return (
                    type === "break" ||
                    type === "lunch"
                );
            },

            canResumeTrip() {
                const type =
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            )
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase();

                return (
                    type === "down" ||
                    type === "break" ||
                    type === "lunch"
                );
            },

            canCancelDownTime() {
                return Boolean(
                    downCancelButton &&
                    !downCancelButton.hidden &&
                    !downCancelButton.disabled &&
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            )
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase() ===
                        "down"
                );
            },

            canLockEndTime() {
                return tripIsLive();
            },

            canOpenTripLog() {
                return (
                    getTripListState() !==
                    "open"
                );
            },

            canCloseTripLog() {
                return (
                    getTripListState() ===
                    "open"
                );
            },

            canDeferTrip() {
                return Boolean(
                    numberPadDialog?.open &&
                    numberPadState
                        ?.workflow ===
                        "new-trip" &&
                    tripDraft
                );
            },

            canToggleRenderedTime() {
                return tripIsLive();
            },

            canCloseSurface() {
                if (
                    globalThis
                        .WMOFActionFunctions
                        ?.isInterruptGroupActive?.(
                            "primary-surface"
                        )
                ) {
                    return true;
                }

                if (
                    speechMicBar
                        ?.optionsOpen
                ) {
                    return true;
                }

                if (
                    [
                        ...document
                            .querySelectorAll(
                                "dialog[open]"
                            )
                    ].length
                ) {
                    return true;
                }

                if (
                    getTripListState() ===
                        "open"
                ) {
                    return true;
                }

                return [
                    ...document
                        .querySelectorAll(
                            "[popover]"
                        )
                ].some(
                    element =>
                        element !==
                            speechMicBar &&
                        popoverIsOpen(
                            element
                        )
                );
            }
        });

    const dictateSpeechMetric =
        (
            label,
            value,
            {
                spokenValue,
                codeValue =
                    false
            } = {}
        ) => {
            const displayValue =
                String(
                    value ??
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (!displayValue) {
                return false;
            }

            const labelText =
                String(
                    label ||
                    ""
                )
                    .trim();
            const response =
                (
                    labelText +
                    " " +
                    displayValue
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();
            const speechValue =
                String(
                    spokenValue ??
                    displayValue
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();
            const spokenResponse =
                (
                    labelText +
                    " " +
                    speechValue
                )
                    .replace(
                        /%/g,
                        " percent"
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            globalThis
                .WMOFAudio
                ?.speak?.(
                    spokenResponse
                );

            return {
                speechResponse: {
                    type:
                        "dictation",
                    value:
                        response,
                    display:
                        codeValue
                            ? {
                                prefix:
                                    labelText,
                                code:
                                    displayValue
                            }
                            : undefined
                }
            };
        };

    const confirmInformationalChange =
        async (
            announcement,
            value,
            {
                spokenValue,
                responseDisplay,
                useGlobalAudioSettings =
                    false,
                ignoreSummaryMaster =
                    false
            } = {}
        ) => {
            const response =
                String(
                    value ??
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (!response) {
                return false;
            }

            const spokenResponse =
                String(
                    spokenValue ??
                    response
                )
                    .replace(
                        /%/g,
                        " percent"
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            const audio =
                globalThis
                    .WMOFAudio;
            const chime =
                consumeAnnouncementAction(
                    announcement,
                    "chime"
                );
            const summary =
                consumeAnnouncementAction(
                    announcement,
                    "summary",
                    {
                        ignoreMaster:
                            ignoreSummaryMaster
                    }
                );
            const output =
                audioAnnouncementOutput(
                    announcement,
                    useGlobalAudioSettings
                        ? {}
                        : undefined
                );
            const speechGuard =
                summary.perform
                    ? reserveSemanticSpeech()
                    : undefined;

            const exclusive =
                announcementSpeechIgnoresMaster(
                    announcement,
                    {
                        ignoreSummaryMaster
                    }
                );

            void runSemanticAnnouncement(
                announcement,
                async () => {
                    let chimePlayed =
                        false;

                    if (
                        chime.perform &&
                        audio?.startSong
                    ) {
                        try {
                            const cue =
                                await audio
                                    .startSong(
                                        announcementSongName(
                                            announcement
                                        ),
                                        {
                                            bpm: 120,
                                            includeSpeech:
                                                false,
                                            speechVolume:
                                                output.speechVolume,
                                            toneVolume:
                                                output.toneVolume,
                                            speechVelocity:
                                                output.speechVelocity,
                                            toneVelocity:
                                                output.toneVelocity
                                        }
                                    );

                            chimePlayed =
                                Boolean(
                                    cue?.hasChime
                                );

                            await cue
                                ?.finished;

                            if (chimePlayed) {
                                await waitForAnnouncementDelay(
                                    output
                                        .speechDelayMs
                                );
                            }
                        }
                        catch (
                            error
                        ) {
                            console.warn(
                                "Informational announcement cue failed:",
                                error
                            );
                        }
                    }

                    if (
                        summary.perform &&
                        audio?.speak
                    ) {
                        await speakSemanticAndWait(
                            audio,
                            spokenResponse,
                            {
                                speechVolume:
                                    output.speechVolume,
                                speechVelocity:
                                    output.speechVelocity
                            },
                            speechGuard
                        );
                    }

                    return true;
                },
                {
                    exclusive
                }
            )
                .catch(
                    error =>
                        console.warn(
                            "Informational announcement playback failed:",
                            announcement,
                            error
                        )
                );

            return {
                speechResponse: {
                    type:
                        "dictation",
                    value:
                        response,
                    display:
                        responseDisplay
                }
            };
        };

    const confirmSettingChange =
        (
            value,
            options
        ) =>
            confirmInformationalChange(
                "setting-change",
                value,
                options
            );

    const changeGlobalAudioRate =
        deltaPercent => {
            audioSettings.speechVelocity =
                stepAudioVelocity(
                    audioSettings
                        .speechVelocity,
                    AUDIO_SPEECH_VELOCITY_MIN,
                    AUDIO_SPEECH_VELOCITY_MAX,
                    deltaPercent
                );
            audioSettings.toneVelocity =
                stepAudioVelocity(
                    audioSettings
                        .toneVelocity,
                    AUDIO_TONE_VELOCITY_MIN,
                    AUDIO_TONE_VELOCITY_MAX,
                    deltaPercent
                );

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                "Speech Rate " +
                    formatAudioVelocityPercent(
                        audioSettings
                            .speechVelocity,
                        AUDIO_SPEECH_VELOCITY_MAX
                    ),
                {
                    useGlobalAudioSettings:
                        true
                }
            );
        };

    const setGlobalAudioRatePercent =
        percent => {
            const value =
                EnglishSpeechValuePreprocessor
                    .parse(
                        percent,
                        "percent"
                    );

            if (
                !Number.isFinite(value) ||
                value < 0 ||
                value > 100
            ) {
                return false;
            }

            audioSettings.speechVelocity =
                audioVelocityAtPercent(
                    value,
                    AUDIO_SPEECH_VELOCITY_MIN,
                    AUDIO_SPEECH_VELOCITY_MAX
                );
            audioSettings.toneVelocity =
                audioVelocityAtPercent(
                    value,
                    AUDIO_TONE_VELOCITY_MIN,
                    AUDIO_TONE_VELOCITY_MAX
                );

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                "Speech Rate " +
                    formatAudioVelocityPercent(
                        audioSettings
                            .speechVelocity,
                        AUDIO_SPEECH_VELOCITY_MAX
                    ),
                {
                    useGlobalAudioSettings:
                        true
                }
            );
        };

    const setMasterSpeech =
        enabled => {
            const next =
                Boolean(enabled);

            audioSettings.masters.summary =
                next;
            audioSettings.masters.details =
                next;

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                next
                    ? "Speech On"
                    : "Speech Off",
                {
                    useGlobalAudioSettings:
                        true,
                    ignoreSummaryMaster:
                        true
                }
            );
        };

    const setMasterChime =
        enabled => {
            audioSettings.masters.chime =
                Boolean(enabled);

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                audioSettings.masters.chime
                    ? "Chime On"
                    : "Chime Off",
                {
                    useGlobalAudioSettings:
                        true
                }
            );
        };

    const changeGlobalAudioVolume =
        deltaPercent => {
            audioSettings.speechVolume =
                stepAudioVolume(
                    audioSettings
                        .speechVolume,
                    deltaPercent
                );
            audioSettings.toneVolume =
                stepAudioVolume(
                    audioSettings
                        .toneVolume,
                    deltaPercent
                );

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                "Speech Volume " +
                    Math.round(
                        audioSettings
                            .speechVolume *
                        100
                    ) +
                    "%",
                {
                    useGlobalAudioSettings:
                        true
                }
            );
        };

    const setGlobalAudioVolumePercent =
        percent => {
            const value =
                EnglishSpeechValuePreprocessor
                    .parse(
                        percent,
                        "percent"
                    );

            if (
                !Number.isFinite(value) ||
                value < 0 ||
                value > 100
            ) {
                return false;
            }

            audioSettings.speechVolume =
                audioVolumeAtPercent(
                    value
                );
            audioSettings.toneVolume =
                audioVolumeAtPercent(
                    value
                );

            renderAudioSettings();
            applyAudioOutputSettings();
            saveAudioSettings();

            return confirmSettingChange(
                "Speech Volume " +
                    Math.round(
                        audioSettings
                            .speechVolume *
                        100
                    ) +
                    "%",
                {
                    useGlobalAudioSettings:
                        true
                }
            );
        };

    const goalPercentForScope =
        scope => {
            let summary;

            try {
                summary =
                    clockTimer
                        .getSummarySnapshot?.(
                            new Date()
                        );
            }
            catch {
                return undefined;
            }

            const value =
                summary?.[
                    scope
                ]?.percentGoal;

            return Number.isFinite(
                Number(value)
            )
                ? formatSummaryPercent(
                    value
                )
                : undefined;
        };

    const setGoalPercentValue =
        async (
            scope,
            percent
        ) => {
            const normalizedScope =
                String(
                    scope ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            const value =
                EnglishSpeechValuePreprocessor
                    .parse(
                        percent,
                        "percent"
                    );

            if (
                ![
                    "trip",
                    "total"
                ].includes(
                    normalizedScope
                ) ||
                !Number.isFinite(
                    value
                ) ||
                value <= 0
            ) {
                return false;
            }

            if (
                (
                    endTimeGoalOverride
                        ?.scopes ||
                    []
                ).includes(
                    normalizedScope
                )
            ) {
                flashEndTimeGoalLock();

                return false;
            }

            const before =
                goalPercentForScope(
                    normalizedScope
                );

            const state =
                clockTimer.configure({
                    [
                        normalizedScope ===
                            "total"
                            ? "total_goal"
                            : "trip_goal"
                    ]:
                        `${value}%`
                });

            renderClockTimerUIState(
                state
            );
            refreshAutoGoalDialog();
            queueSummaryRefresh();

            const after =
                goalPercentForScope(
                    normalizedScope
                );

            if (
                !after ||
                before ===
                    after
            ) {
                return true;
            }

            const label =
                normalizedScope ===
                    "total"
                    ? totalScopeLabel()
                    : "Trip";

            return confirmInformationalChange(
                "goal-change",
                label +
                    " Goal Set to " +
                    after
            );
        };

    const actions =
        globalThis.WMOFActions;

    globalThis
        .WMOFActionFunctions
        .defineAll({
            changeStandardTime(
                timeValue
            ) {
                const duration =
                    EnglishSpeechValuePreprocessor
                        .parse(
                            timeValue,
                            "duration"
                        );

                const formatted =
                    EnglishDurationParser
                        .formatCanonical(
                            duration
                        );
                const displayFormatted =
                    EnglishDurationParser
                        .format(
                            duration
                        );

                if (
                    !formatted ||
                    !displayFormatted
                ) {
                    return false;
                }

                if (
                    (scheduledStartDialog.open ||
                        (globalThis.SpeechMenu?.executionContext?.chain === true &&
                         globalThis.SpeechMenu.executionContext.chainContext === "scheduled-start")) &&
                    !scheduledStartStandard.disabled &&
                    tripDraft
                ) {
                    const previous =
                        tripDraft
                            .standardTimeMilliseconds;
                    const voiceSet =
                        Boolean(
                            globalThis
                                .SpeechMenu
                                ?.executionContext
                        );

                    tripDraft.standardTimeMilliseconds =
                        duration;

                    cancelScheduledStartSpeechPrompt();

                    scheduledStartStandard
                        .classList
                        .remove(
                            "needs-value"
                        );

                    scheduledStartMessage.hidden =
                        true;

                    if (voiceSet) {
                        armScheduledStartAutoFromVoice();
                    }

                    updateScheduledStartDialog();
                    scheduleScheduledStartSpeechPrompt();

                    return previous ===
                        duration
                        ? true
                        : confirmSettingChange(
                            "Standard Time Set to " +
                            displayFormatted,
                            {
                                spokenValue:
                                    "Standard Time Set to " +
                                    formatGoalFailureDuration(
                                        duration
                                    ),
                                responseDisplay: {
                                    prefix:
                                        "Standard Time Set to",
                                    code:
                                        displayFormatted
                                }
                            }
                        );
                }

                const editButton =
                    tripSettingsDialog
                        .querySelector(
                            '[data-trip-time-field="standard-time"]'
                        );

                if (
                    tripSettingsDialog.open &&
                    editButton &&
                    !editButton.disabled
                ) {
                    const session =
                        tripSettingsSession ||
                        beginTripSettingsSession();

                    if (!session) {
                        return false;
                    }

                    const previous =
                        session.values
                            .standardTimeMilliseconds;

                    session.values
                        .standardTimeMilliseconds =
                        duration;

                    refreshTripSettingsValues();

                    return previous ===
                        duration
                        ? true
                        : confirmSettingChange(
                            "Standard Time Set to " +
                            displayFormatted,
                            {
                                spokenValue:
                                    "Standard Time Set to " +
                                    formatGoalFailureDuration(
                                        duration
                                    ),
                                responseDisplay: {
                                    prefix:
                                        "Standard Time Set to",
                                    code:
                                        displayFormatted
                                }
                            }
                        );
                }

                return false;
            },

            handleVoiceEntrySpeech() {
                return parseVoiceEntryTranscript(
                    globalThis
                        .SpeechMenu
                        ?.executionContext
                        ?.transcript,
                    {
                        signal:
                            currentActionSignal()
                    }
                );
            },

            openStartMenu() {
                return openStartMenuWorkflow();
            },

            async prepareReadyAction() {
                const signal =
                    currentActionSignal();

                if (tripIsLive()) {
                    return endCurrentIntervalOrTrip(
                        speechTransactionDate(),
                        {
                            signal
                        }
                    );
                }

                armSpeechReadyContinuation();

                return openStartMenuWorkflow({
                    preserveSpeechContinuation:
                        true,
                    inputMode:
                        "voice"
                });
            },

            prepareStartMenu() {
                armSpeechReadyContinuation();

                return openStartMenuWorkflow({
                    preserveSpeechContinuation:
                        true,
                    inputMode:
                        "voice"
                });
            },

            disableSpeechRecognition() {
                return disableSpeechRecognitionRuntime();
            },

            setSpeechMaster() {
                const transcript =
                    String(
                        globalThis
                            .SpeechMenu
                            ?.executionContext
                            ?.transcript ||
                        ""
                    )
                        .trim()
                        .toLocaleLowerCase();

                if (transcript === "speech on") {
                    return setMasterSpeech(
                        true
                    );
                }

                if (transcript === "speech off") {
                    return setMasterSpeech(
                        false
                    );
                }

                return false;
            },

            setChimeMaster() {
                const transcript =
                    String(
                        globalThis
                            .SpeechMenu
                            ?.executionContext
                            ?.transcript ||
                        ""
                    )
                        .trim()
                        .toLocaleLowerCase();

                if (transcript === "chime on") {
                    return setMasterChime(
                        true
                    );
                }

                if (transcript === "chime off") {
                    return setMasterChime(
                        false
                    );
                }

                return false;
            },

            setAudioRatePercent(
                percent
            ) {
                return setGlobalAudioRatePercent(
                    percent
                );
            },

            setAudioVolumePercent(
                percent
            ) {
                return setGlobalAudioVolumePercent(
                    percent
                );
            },

            changeAudioRateFaster() {
                return changeGlobalAudioRate(
                    AUDIO_PERCENT_STEP
                );
            },

            changeAudioRateSlower() {
                return changeGlobalAudioRate(
                    -AUDIO_PERCENT_STEP
                );
            },

            changeAudioVolumeLouder() {
                return changeGlobalAudioVolume(
                    AUDIO_PERCENT_STEP
                );
            },

            changeAudioVolumeSofter() {
                return changeGlobalAudioVolume(
                    -AUDIO_PERCENT_STEP
                );
            },

            openSpeechOptions() {
                if (
                    speechMicBar
                        ?.optionsOpen
                ) {
                    return true;
                }

                if (
                    speechMicBar
                        ?.optionsCollapsed
                ) {
                    return Boolean(
                        speechMicBar
                            .expandOptions?.()
                    );
                }

                globalThis
                    .SpeechMenu
                    ?.extrapolatePhrases?.();

                return Boolean(
                    speechMicBar
                        ?.showOptions?.(
                            globalThis
                                .SpeechMenu
                                ?.phraseGroups ||
                            []
                        )
                );
            },

            closeActiveSurface() {
                return closeActiveSpeechSurface();
            },

            handleSpeechRuntimeStarted() {
                setSpeechButtonState(
                    true,
                    false
                );

                setSpeechLayoutState(
                    true
                );

                return true;
            },

            handleSpeechRuntimeStopped() {
                cancelPendingSpeechReady();

                setSpeechButtonState(
                    false,
                    false
                );

                setSpeechLayoutState(
                    false
                );

                if (speechTrainingActive) {
                    stopInAppSpeechTraining({
                        forced:
                            true
                    });
                }

                syncSpeechTrainingControls();

                return true;
            },

            handleSpeechRuntimeMuted(
                muted = true
            ) {
                setSpeechButtonState(
                    true,
                    Boolean(
                        muted
                    )
                );

                syncSpeechTrainingControls();

                return true;
            },

            handleSpeechUtteranceStarted() {
                void globalThis
                    .WMOFPresentationSetters
                    ?.dismissSpeechResponse?.({
                        fast:
                            true
                    });

                return true;
            },

            async scheduleStartAt(
                spokenTime,
                {
                    fromReadyContinuation =
                        false
                } = {}
            ) {
                const continuingReady =
                    fromReadyContinuation &&
                    (
                        pendingSpeechReady !==
                            undefined ||
                        newTripWorkflowLocked
                    );

                if (
                    tripIsLive() ||
                    (
                        $("#newTripButton")
                            ?.disabled &&
                        !continuingReady
                    )
                ) {
                    cancelPendingSpeechReady();
                    return false;
                }

                cancelPendingSpeechReady();
                lockNewTripWorkflow();

                let scheduledWorkflowOpened =
                    false;

                try {
                    if (
                        continuingReady &&
                        numberPadDialog
                            ?.open &&
                        numberPadState
                            ?.workflow ===
                            "new-trip" &&
                        numberPadState
                            ?.role ===
                            "root"
                    ) {
                        await closeNumberPad({
                            discardPrepared:
                                false,
                            allowChanged:
                                true,
                            immediate:
                                true,
                            destination:
                                "home"
                        });
                    }

                    const now =
                        new Date();

                    const target =
                        EnglishSpeechValuePreprocessor
                            .parse(
                                spokenTime,
                                "clock",
                                {
                                    baseDate:
                                        now,
                                    preferFuture:
                                        true
                                }
                            );

                    if (!target) {
                        return false;
                    }

                    if (
                        clockTimer.status ===
                            "stopped"
                    ) {
                        await clockTimer
                            .resetCompletedTrip();
                    }

                    const defaults =
                        getTripMomentDefaults(
                            now
                        );

                    if (!defaults) {
                        return false;
                    }

                    const scheduledStart =
                        formatTimelineDateTime(
                            target,
                            defaults
                                .creationDate
                        );

                    const preferences =
                        getTripPreferences();

                    if (!scheduledStart) {
                        return false;
                    }

                    uiReturnStack.length =
                        0;

                    resetTripSettingsNavigation();

                    tripSettingsSession =
                        undefined;

                    tripStartsNowState =
                        undefined;

                    tripDraft = {
                        ...defaults,
                        standardTimeMilliseconds:
                            undefined,
                        scheduledStart,
                        startTime:
                            scheduledStart,
                        lateBreakBehavior:
                            preferences
                                .lateBreakBehavior,
                        syncGoals:
                            preferences
                                .syncGoals
                    };

                    renderDeferredTrip();

                    try {
                        await clockTimer
                            .prepareTrip({
                                timeout:
                                    5000,
                                at: now
                            });
                    }
                    catch {}

                    showScheduledStartDialog();

                    scheduledWorkflowOpened =
                        true;

                    return true;
                }
                finally {
                    if (
                        !scheduledWorkflowOpened
                    ) {
                        releaseNewTripWorkflow();
                    }
                }
            },

            continueStartAt(
                spokenTime
            ) {
                if (
                    !globalThis
                        .WMOFSpeechAvailability
                        .canContinueStartAt()
                ) {
                    return false;
                }

                return actions
                    .scheduleStartAt(
                        spokenTime,
                        {
                            fromReadyContinuation:
                                true
                        }
                    );
            },

            openBreakMenu(
                reason = "break"
            ) {
                if (
                    breakButton?.disabled
                ) {
                    return false;
                }

                breakDialog
                    .querySelectorAll(
                        ".speech-focused"
                    )
                    .forEach(
                        item =>
                            item.classList
                                .remove(
                                    "speech-focused"
                                )
                    );

                setOkAllowed(
                    breakDialog,
                    false
                );

                return openDialog(
                    "breakDialog",
                    {
                        reason
                    }
                );
            },

            chooseBreakType(
                breakChoice
            ) {
                if (
                    !breakDialog.open &&
                    !(globalThis.SpeechMenu?.executionContext?.chain === true &&
                      globalThis.SpeechMenu.executionContext.chainContext === "break-choice")
                ) {
                    return false;
                }

                const kind =
                    ({
                        "10":
                            "short-break",
                        short:
                            "short-break",
                        "15":
                            "break",
                        break:
                            "break",
                        long:
                            "break",
                        lunch:
                            "lunch"
                    })[
                        String(
                            breakChoice
                        )
                            .toLowerCase()
                    ];

                const button =
                    breakDialog
                        .querySelector(
                            `[data-break-type="${kind}"]`
                        );

                if (!button || button.disabled) {
                    return false;
                }

                breakDialog
                    .querySelectorAll(
                        ".speech-focused"
                    )
                    .forEach(
                        item =>
                            item.classList
                                .remove(
                                    "speech-focused"
                                )
                    );

                button.classList.add(
                    "speech-focused"
                );

                button.focus();

                setOkAllowed(
                    breakDialog,
                    true
                );

                return true;
            },

            async confirmBreakType() {
                const transactionTime =
                    speechTransactionDate();

                const button =
                    breakDialog
                        .querySelector(
                            "[data-break-type].speech-focused"
                        );

                if (
                    (!breakDialog.open &&
                     !(globalThis.SpeechMenu?.executionContext?.chain === true &&
                       globalThis.SpeechMenu.executionContext.chainContext === "break-confirm")) ||
                    !button || button.disabled
                ) {
                    return false;
                }

                const kind =
                    button.dataset
                        .breakType;

                setOkAllowed(
                    breakDialog,
                    false
                );

                closeDialog(
                    breakDialog,
                    {
                        reason:
                            "break-type-selected"
                    }
                );

                return startBreakInterval(
                    kind,
                    transactionTime
                );
            },

            async startBreak(
                kind
            ) {
                const transactionTime =
                    speechTransactionDate();

                if (!kind) {
                    return false;
                }

                if (breakDialog.open) {
                    closeDialog(
                        breakDialog,
                        {
                            reason:
                                "break-type-selected"
                        }
                    );
                }

                return startBreakInterval(
                    kind,
                    transactionTime
                );
            },

            async startDownTime() {
                const transactionTime =
                    speechTransactionDate();
                const activeIntervalType =
                    String(
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                transactionTime
                            )
                            ?.intervalType ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                if (
                    activeIntervalType ===
                        "down" ||
                    downButton?.disabled
                ) {
                    return false;
                }

                const result =
                    await clockTimer
                        .startInterval(
                            "down",
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            transactionTime
                        );

                if (result) {
                    renderTripActionState();
                }

                return Boolean(
                    result
                );
            },

            openBreakEndMenu() {
                return openSpeechBreakPrompt(
                    "end"
                );
            },

            async resumeTrip() {
                const transactionTime =
                    speechTransactionDate();

                const result =
                    await clockTimer
                        .endInterval(
                            transactionTime
                        );

                renderTripActionState();

                return Boolean(
                    result
                );
            },

            async endTrip() {
                const transactionTime =
                    speechTransactionDate();
                const signal =
                    currentActionSignal();

                return endCurrentIntervalOrTrip(
                    transactionTime,
                    {
                        signal
                    }
                );
            },

            cancelDownTime() {
                const active =
                    clockTimer
                        .getActiveIntervalState
                        ?.(
                            new Date()
                        );

                if (
                    String(
                        active
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase() !==
                        "down"
                ) {
                    return false;
                }

                const dialog =
                    $("#cancelDownConfirmDialog");

                if (!dialog) {
                    return false;
                }

                const prompt =
                    "Press/Say OK to Delete your down time";

                setOkAllowed(
                    dialog,
                    true
                );

                const opened =
                    openDialog(
                        "cancelDownConfirmDialog",
                        {
                            reason:
                                "cancel-down"
                        }
                    );

                if (!opened) {
                    setOkAllowed(
                        dialog,
                        false
                    );
                }

                if (
                    opened &&
                    globalThis
                        .SpeechMenu
                        ?.executionContext
                ) {
                    globalThis
                        .WMOFAudio
                        ?.speak?.(
                            prompt
                        );
                }

                return Boolean(
                    opened
                );
            },

            async confirmCancelDownTime() {
                const dialog =
                    $("#cancelDownConfirmDialog");

                if (!dialog?.open) {
                    return false;
                }

                const active =
                    clockTimer
                        .getActiveIntervalState
                        ?.(
                            new Date()
                        );

                if (
                    String(
                        active
                            ?.intervalType ||
                        ""
                    )
                        .toLowerCase() !==
                        "down"
                ) {
                    setOkAllowed(
                        dialog,
                        false
                    );

                    closeDialog(
                        dialog,
                        {
                            reason:
                                "cancel-down-invalid"
                        }
                    );

                    return false;
                }

                const transactionTime =
                    speechTransactionDate();

                setOkAllowed(
                    dialog,
                    false
                );

                closeDialog(
                    dialog,
                    {
                        reason:
                            "cancel-down-confirmed"
                    }
                );

                const result =
                    await clockTimer
                        .cancelInterval(
                            transactionTime
                        );

                updateSummaryValues();
                renderTripActionState();

                return Boolean(
                    result
                );
            },

            continueDownTime() {
                const dialog =
                    $("#cancelDownConfirmDialog");

                if (!dialog?.open) {
                    return false;
                }

                setOkAllowed(
                    dialog,
                    false
                );

                closeDialog(
                    dialog,
                    {
                        reason:
                            "cancel-down-declined"
                    }
                );

                return true;
            },

            readTripGoal() {
                return dictateSpeechMetric(
                    "Trip Goal",
                    goalPercentForScope(
                        "trip"
                    )
                );
            },

            readTotalGoal() {
                return dictateSpeechMetric(
                    totalScopeLabel() + " Goal",
                    goalPercentForScope(
                        "total"
                    )
                );
            },

            setTripGoal(
                percent
            ) {
                return setGoalPercentValue(
                    "trip",
                    percent
                );
            },

            setTotalGoal(
                percent
            ) {
                return setGoalPercentValue(
                    "total",
                    percent
                );
            },

            changeGoal(
                percent,
                goalScope
            ) {
                const normalizedScope =
                    String(
                        goalScope ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const rangeByScope = {
                    day: "day",
                    week: "week",
                    check: "pay-period",
                    month: "month",
                    year: "year"
                };

                if (
                    normalizedScope ===
                        "trip"
                ) {
                    applyScope(
                        "trip"
                    );

                    return setGoalPercentValue(
                        "trip",
                        percent
                    );
                }

                if (
                    normalizedScope ===
                        "total"
                ) {
                    applyScope(
                        "total"
                    );

                    return setGoalPercentValue(
                        "total",
                        percent
                    );
                }

                const range =
                    rangeByScope[
                        normalizedScope
                    ];

                if (!range) {
                    return false;
                }

                setTripLogRange(
                    range
                );
                applyScope(
                    "total"
                );

                return setGoalPercentValue(
                    "total",
                    percent
                );
            },

            readGoalMode() {
                const mode =
                    normalizePercentMode(
                        clockTimer
                            .percentMode
                    );

                const label =
                    mode === "total"
                        ? totalScopeLabel()
                        : mode.charAt(0)
                            .toUpperCase() +
                            mode.slice(1);

                return dictateSpeechMetric(
                    label,
                    "Mode"
                );
            },

            changeGoalMode(
                goalMode
            ) {
                const mode =
                    String(
                        goalMode ||
                        ""
                    )
                        .trim()
                        .toLowerCase();
                const rangeByMode = {
                    day: "day",
                    week: "week",
                    check: "pay-period",
                    month: "month",
                    year: "year"
                };
                const requestedRange =
                    rangeByMode[
                        mode
                    ];
                const requestedMode =
                    requestedRange
                        ? "total"
                        : mode;

                if (
                    !PERCENT_MODES
                        .includes(
                            requestedMode
                        )
                ) {
                    return false;
                }

                const previousMode =
                    normalizePercentMode(
                        clockTimer
                            .percentMode
                    );
                const previousRange =
                    getTripLogRange();

                if (requestedRange) {
                    setTripLogRange(
                        requestedRange
                    );
                }

                const appliedMode =
                    applyScope(
                        requestedMode
                    );

                syncScopeUI(true);
                renderClockTimerUIState(
                    clockTimer.uiState
                );
                refreshAutoGoalDialog();
                queueSummaryRefresh();

                if (
                    appliedMode !==
                    requestedMode
                ) {
                    return false;
                }

                const rangeChanged =
                    getTripLogRange() !==
                    previousRange;
                const modeChanged =
                    previousMode !==
                    appliedMode;

                if (
                    !rangeChanged &&
                    !modeChanged
                ) {
                    return true;
                }

                const label =
                    appliedMode ===
                        "total"
                        ? totalScopeLabel()
                        : appliedMode
                            .charAt(0)
                            .toUpperCase() +
                            appliedMode
                                .slice(1);

                return confirmSettingChange(
                    label +
                    " Mode"
                );
            },

            cycleGoalMode() {
                const current =
                    PERCENT_MODES
                        .indexOf(
                            normalizePercentMode(
                                clockTimer
                                    .percentMode
                            )
                        );

                const next =
                    PERCENT_MODES[
                        (
                            current +
                            1
                        ) %
                        PERCENT_MODES
                            .length
                    ];

                const applied =
                    applyScope(
                        next
                    );

                const label =
                    applied ===
                        "total"
                        ? totalScopeLabel()
                        : applied
                            .charAt(0)
                            .toUpperCase() +
                            applied
                                .slice(1);

                return confirmSettingChange(
                    label +
                    " Mode"
                );
            },

            readSyncStatus() {
                return confirmSettingChange(
                    getSyncGoalsState()
                        ? "Sync On"
                        : "Sync Off"
                );
            },

            toggleSync(
                syncState
            ) {
                if (
                    normalizedConnectionStatus() ===
                        "offline"
                ) {
                    animateOfflineClouds();

                    return confirmSettingChange(
                        "Cannot sync offline"
                    );
                }

                const current =
                    getSyncGoalsState();

                let enabled;

                if (
                    syncState ===
                        undefined ||
                    syncState ===
                        null ||
                    String(
                        syncState
                    )
                        .trim() ===
                        ""
                ) {
                    enabled =
                        !current;
                }
                else if (
                    typeof syncState ===
                        "boolean"
                ) {
                    enabled =
                        syncState;
                }
                else {
                    const requested =
                        String(
                            syncState
                        )
                            .trim()
                            .toLowerCase();

                    if (
                        [
                            "on",
                            "true",
                            "enabled",
                            "enable"
                        ].includes(
                            requested
                        )
                    ) {
                        enabled =
                            true;
                    }
                    else if (
                        [
                            "off",
                            "false",
                            "disabled",
                            "disable"
                        ].includes(
                            requested
                        )
                    ) {
                        enabled =
                            false;
                    }
                    else {
                        return false;
                    }
                }

                try {
                    setSyncGoals(
                        enabled
                    );
                }
                catch {
                    return confirmSettingChange(
                        "Sync Fail"
                    );
                }

                animateSyncGoalsIcons();

                const applied =
                    getSyncGoalsState();

                if (
                    applied !==
                        enabled
                ) {
                    return confirmSettingChange(
                        "Sync Fail"
                    );
                }

                if (
                    current ===
                    enabled
                ) {
                    return true;
                }

                return confirmSettingChange(
                    enabled
                        ? "Sync On"
                        : "Sync Off"
                );
            },

            lockEndTime(
                spokenTime
            ) {
                if (!tripIsLive()) {
                    return false;
                }

                const target =
                    EnglishSpeechValuePreprocessor
                        .parse(
                            spokenTime,
                            "clock",
                            {
                                baseDate:
                                    new Date(),
                                preferFuture:
                                    true
                            }
                        );

                const previousDeadline =
                    endTimeGoalOverride
                        ?.deadline
                        ?.getTime?.();

                if (
                    !target ||
                    !applyEndTimeGoalOverride(
                        target
                    )
                ) {
                    return false;
                }

                if (
                    previousDeadline ===
                    target.getTime()
                ) {
                    return true;
                }

                const label =
                    target
                        .toLocaleTimeString(
                            undefined,
                            {
                                hour:
                                    "numeric",
                                minute:
                                    "2-digit"
                            }
                        );

                return confirmSettingChange(
                    "End Time Locked to " +
                    label,
                    {
                        responseDisplay: {
                            prefix:
                                "End Time Locked to",
                            code:
                                label
                        }
                    }
                );
            },

            openTripLog(
                source = "speech"
            ) {
                if (
                    getTripListState() !==
                        "open"
                ) {
                    void openTripList(
                        source
                    );
                }

                return true;
            },

            closeTripLog(
                source = "speech"
            ) {
                if (
                    getTripListState() ===
                        "open"
                ) {
                    void closeTripList(
                        source
                    );
                }

                return true;
            },

            deferTrip() {
                if (
                    (
                        !numberPadDialog
                            ?.open &&
                        !voiceEntryState
                    ) ||
                    numberPadState
                        ?.workflow !==
                        "new-trip" ||
                    !tripDraft
                ) {
                    return false;
                }

                tripDraft.deferred =
                    true;

                tripDraft.standardTimeMilliseconds =
                    undefined;

                releaseNewTripWorkflow();
                renderDeferredTrip();

                if (voiceEntryState) {
                    void closeVoiceEntry({
                        cancel: false,
                        destination:
                            "home"
                    });
                }
                else {
                    void closeNumberPad({
                        discardPrepared:
                            false,
                        allowChanged:
                            true,
                        immediate:
                            true,
                        destination:
                            "home"
                    });
                }

                return true;
            },

            readEndTime() {
                let rendered;

                try {
                    rendered =
                        clockTimer
                            .getRenderedTime?.(
                                "calculated-end",
                                new Date()
                            );
                }
                catch {
                    return false;
                }

                if (
                    typeof rendered !==
                        "string" ||
                    !rendered
                ) {
                    return false;
                }

                return dictateSpeechMetric(
                    "End Time",
                    rendered,
                    {
                        codeValue:
                            true
                    }
                );
            },

            readTimeRemaining() {
                let rendered;

                try {
                    rendered =
                        clockTimer
                            .getRenderedTime?.(
                                "remaining",
                                new Date()
                            );
                }
                catch {
                    return false;
                }

                if (
                    typeof rendered !==
                        "string" ||
                    !rendered
                ) {
                    return false;
                }

                const overBy =
                    rendered
                        .startsWith(
                            "-"
                        );
                const absoluteRendered =
                    overBy
                        ? rendered.slice(1)
                        : rendered;
                const remainingMilliseconds =
                    parseTimelineTime(
                        absoluteRendered
                    );

                if (
                    !Number.isFinite(
                        remainingMilliseconds
                    )
                ) {
                    return false;
                }

                const spokenDuration =
                    formatGoalFailureDuration(
                        remainingMilliseconds
                    );
                const spokenValue =
                    overBy
                        ? "Over by " +
                            spokenDuration
                        : spokenDuration;

                return confirmSettingChange(
                    rendered,
                    {
                        spokenValue,
                        responseDisplay: {
                            code:
                                rendered
                        }
                    }
                );
            },

            readRenderedTime(
                timeMode
            ) {
                const value =
                    String(
                        timeMode ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const mode =
                    value.includes(
                        "end"
                    )
                        ? "calculated-end"
                        : value.includes(
                            "elapsed"
                        )
                            ? "elapsed"
                            : value.includes(
                                "remaining"
                            )
                                ? "remaining"
                                : undefined;

                if (!mode) {
                    return false;
                }

                let state;

                try {
                    state =
                        clockTimer
                            .getEffectiveTimeState?.(
                                new Date()
                            );
                }
                catch {
                    return false;
                }

                if (
                    !state ||
                    state.mode !==
                        mode ||
                    !state.available
                ) {
                    return false;
                }

                return dictateSpeechMetric(
                    state.label,
                    state.text,
                    {
                        spokenValue:
                            mode ===
                                "calculated-end" ||
                            !Number.isFinite(
                                state.value
                            )
                                ? undefined
                                : formatGoalFailureDuration(
                                    Math.abs(
                                        state.value
                                    )
                                ),
                        codeValue:
                            true
                    }
                );
            },

            toggleRenderedTime(
                timeMode
            ) {
                let next;

                if (
                    timeMode ===
                        undefined ||
                    timeMode ===
                        null ||
                    String(
                        timeMode
                    )
                        .trim() ===
                        ""
                ) {
                    const index =
                        RENDERED_TIME_MODES
                            .indexOf(
                                clockTimer
                                    .renderedTimeMode
                            );

                    next =
                        RENDERED_TIME_MODES[
                            (
                                index +
                                1
                            ) %
                            RENDERED_TIME_MODES
                                .length
                        ];
                }
                else {
                    const value =
                        String(
                            timeMode
                        )
                            .trim()
                            .toLowerCase();

                    next =
                        value.includes(
                            "end"
                        )
                            ? "calculated-end"
                            : value.includes(
                                "elapsed"
                            )
                                ? "elapsed"
                                : value.includes(
                                    "remaining"
                                )
                                    ? "remaining"
                                    : value;

                    if (
                        !RENDERED_TIME_MODES
                            .includes(
                                next
                            )
                    ) {
                        return false;
                    }
                }

                const previous =
                    clockTimer
                        .renderedTimeMode;

                applyRenderedTimeMode(
                    next
                );

                if (
                    previous ===
                    next
                ) {
                    return true;
                }

                let announcement;

                if (
                    next ===
                        "calculated-end"
                ) {
                    announcement =
                        "Showing End Time";
                }
                else if (
                    next ===
                        "elapsed"
                ) {
                    announcement =
                        "Showing Elapsed Time";
                }
                else {
                    let effectiveTimeState;

                    try {
                        effectiveTimeState =
                            clockTimer
                                .getEffectiveTimeState?.(
                                    new Date()
                                );
                    }
                    catch {}

                    announcement =
                        effectiveTimeState
                            ?.label ===
                            "Banked Time"
                            ? "Showing Banked Time"
                            : effectiveTimeState
                                ?.label ===
                                "Time Over"
                                ? "Showing Time Over"
                                : "Showing Time Left";
                }

                return confirmSettingChange(
                    announcement
                );
            },

            openStandardTimeSettings() {
                let summary;

                try {
                    summary =
                        clockTimer
                            .getSummarySnapshot
                            ?.(
                                new Date()
                            );
                }
                catch {}

                if (
                    !tripIsLive() ||
                    summary?.scope ===
                        "total"
                ) {
                    return false;
                }

                resetTripSettingsNavigation();

                return openTripSettingsDialog(
                    "summary-standard-time",
                    {
                        focusField:
                            "standard-time"
                    }
                );
            },

            openGoalEditor() {
                if (
                    endTimeGoalLockedForMode()
                ) {
                    flashEndTimeGoalLock();

                    return false;
                }

                if (
                    clockTimer.percentMode ===
                        "auto"
                ) {
                    openAutoGoalDialog();

                    return true;
                }

                void openPercentGoalNumberPad(
                    clockTimer
                        .percentMode ===
                        "total"
                        ? "total"
                        : "trip"
                ).catch(
                    () => {}
                );

                return true;
            },

            async confirmBreakPromptYes() {
                const transactionTime =
                    speechTransactionDate();

                const dialog =
                    $("#speechBreakConfirmDialog");
                const state =
                    speechBreakPromptState;

                if (
                    !dialog?.open ||
                    !state
                ) {
                    return false;
                }

                closeDialog(
                    dialog,
                    {
                        reason:
                            "speech-break-yes"
                    }
                );

                clearSpeechBreakPrompt();

                if (
                    state.mode ===
                    "start"
                ) {
                    return startBreakInterval(
                        "lunch",
                        transactionTime
                    );
                }

                if (
                    state.mode ===
                    "end"
                ) {
                    await endCurrentIntervalOrTrip(
                        transactionTime
                    );
                    return true;
                }

                return false;
            },

            async confirmBreakPromptNo() {
                const dialog =
                    $("#speechBreakConfirmDialog");
                const state =
                    speechBreakPromptState;

                if (
                    !dialog?.open ||
                    !state
                ) {
                    return false;
                }

                closeDialog(
                    dialog,
                    {
                        reason:
                            "speech-break-no"
                    }
                );

                clearSpeechBreakPrompt();

                if (
                    state.mode ===
                    "start"
                ) {
                    return startBreakInterval(
                        "break"
                    );
                }

                return state.mode ===
                    "end";
            },

            cancelBreakPrompt() {
                const dialog =
                    $("#speechBreakConfirmDialog");

                if (!dialog?.open) {
                    return false;
                }

                closeDialog(
                    dialog,
                    {
                        reason:
                            "speech-break-cancel"
                    }
                );

                clearSpeechBreakPrompt();

                return true;
            },

            updateGraphicalSettings(
                settings
            ) {
                const normalized =
                    saveGraphicalSettings(
                        settings
                    );

                applyGraphicalSettings(
                    normalized
                );

                return normalized;
            },

            changeLateBreakBehavior(
                value
            ) {
                const preferences = {
                    ...getTripPreferences(),
                    lateBreakBehavior:
                        value ===
                            "autoRestartTrip"
                            ? "autoRestartTrip"
                            : "showLateWindow"
                };

                saveTripPreferences(
                    preferences
                );

                if (
                    !tripIsLive() &&
                    !tripDraft
                ) {
                    clockTimer
                        .intervalElapsedBehavior =
                        "startLatency";

                    clockTimer
                        .autoRestartTripAfterLateBreak =
                        preferences
                            .lateBreakBehavior ===
                        "autoRestartTrip";
                }

                return preferences;
            },

            async connectUser(
                username,
                password
            ) {
                if (
                    normalizedConnectionStatus() ===
                        "offline"
                ) {
                    animateOfflineClouds();
                }

                loginPending = true;

                try {
                    const result =
                        await clockTimer
                            .connect(
                                String(
                                    username ||
                                    ""
                                )
                                    .trim(),
                                String(
                                    password ||
                                    ""
                                )
                            );

                    if (
                        !result
                            ?.connected
                    ) {
                        throw new Error(
                            "Login failed."
                        );
                    }

                    deliberatelyLoggedOut =
                        false;

                    safeStorageSet(
                        "wmof.deliberatelyLoggedOut",
                        "false"
                    );

                    populateProfile(
                        result.user
                    );
                    loginConfirmedThisLoad = true;

                    for (
                        let index =
                            uiReturnStack
                                .length -
                            1;
                        index >= 0;
                        index -= 1
                    ) {
                        if (
                            uiReturnStack[
                                index
                            ]?.type ===
                                "popover" &&
                            uiReturnStack[
                                index
                            ]?.element ===
                                mainMenu
                        ) {
                            uiReturnStack
                                .splice(
                                    index,
                                    1
                                );
                        }
                    }

                    hidePopoverForHandoff(
                        mainMenu
                    );

                    syncNetworkStatusUI({
                        login:
                            true
                    });

                    return result;
                }
                finally {
                    loginPending =
                        false;
                }
            },

            openAccessTokens() {
                const permissions =
                    Number(
                        signedInProfile
                            ?.permissions
                    ) ||
                    0;

                if (
                    !(
                        permissions &
                        ACCESS_TOKEN_PERMISSION_MASK
                    )
                ) {
                    throw new Error(
                        "Grant Token Access permission is required."
                    );
                }

                const opened =
                    window.open(
                        API_BASE +
                        "api/admin/access-tokens/?console=1",
                        "wmofAccessTokens"
                    );

                if (!opened) {
                    throw new Error(
                        "The Access Tokens window was blocked by the browser."
                    );
                }

                mainMenu
                    ?.hidePopover?.();

                return true;
            },

            openSpeechTraining() {
                if (
                    !signedInProfile ||
                    !speechTrainingConnectionAvailable
                ) {
                    return false;
                }

                if (speechTrainingActive) {
                    return false;
                }

                mainMenu
                    ?.hidePopover?.();

                if (inAppSpeechTrainingEnabled) {
                    return disableInAppSpeechTraining();
                }

                if (
                    hasSpeechDeveloperAccess()
                ) {
                    openDialogElement(
                        speechTrainingChoiceDialog,
                        {
                            reason:
                                "speech-training-choice"
                        }
                    );

                    return true;
                }

                void enableInAppSpeechTraining()
                    .catch(
                        error =>
                            console.error(
                                error
                            )
                    );

                return true;
            },

            async openSpeechTiming() {
                const permissions =
                    Number(
                        signedInProfile
                            ?.permissions
                    ) ||
                    0;

                if (
                    !(
                        permissions &
                        DEVELOPER_MENU_PERMISSION_MASK
                    )
                ) {
                    throw new Error(
                        "Developer or Developer Preview permission is required."
                    );
                }

                await ensureSpeechRuntime();
                syncAdaptiveSpeechTimingRate();

                mainMenu
                    ?.hidePopover?.();

                const opened =
                    openDialogElement(
                        speechTimingDialog,
                        {
                            reason:
                                "speech-timing"
                        }
                    );

                if (opened) {
                    startSpeechTimingToolUpdates();
                }

                return opened;
            },

            async openSpeechEditor() {
                const permissions =
                    Number(
                        signedInProfile
                            ?.permissions
                    ) ||
                    0;

                if (
                    !(
                        permissions &
                        SPEECH_EDITOR_PERMISSION_MASK
                    )
                ) {
                    throw new Error(
                        "Developer or Developer Preview permission is required."
                    );
                }

                const target =
                    "wmofSpeechEditor";

                const editorWindow =
                    window.open(
                        "",
                        target
                    );

                if (!editorWindow) {
                    throw new Error(
                        "The Speech Editor window was blocked by the browser."
                    );
                }

                try {
                    const response =
                        await fetch(
                            API_BASE +
                            "api/users/",
                            {
                                credentials:
                                    "same-origin",
                                cache:
                                    "no-store",
                                headers: {
                                    "Accept":
                                        "application/json"
                                }
                            }
                        );

                    const data =
                        await response.json();

                    if (
                        !response.ok ||
                        typeof data
                            .csrfToken !==
                            "string" ||
                        data.csrfToken
                            .length <
                            32
                    ) {
                        throw new Error(
                            data.message ||
                            "A valid WMOF CSRF token is required."
                        );
                    }

                    const form =
                        document
                            .createElement(
                                "form"
                            );

                    form.method =
                        "POST";

                    form.action =
                        API_BASE +
                        "api/admin/speech-editor/";

                    form.target =
                        target;

                    const token =
                        document
                            .createElement(
                                "input"
                            );

                    token.type =
                        "hidden";

                    token.name =
                        "csrf_token";

                    token.value =
                        data.csrfToken;

                    form.append(
                        token
                    );

                    document.body
                        .append(
                            form
                        );

                    form.submit();
                    form.remove();

                    mainMenu
                        ?.hidePopover?.();

                    return true;
                }
                catch (
                    error
                ) {
                    try {
                        editorWindow
                            .close();
                    }
                    catch {}

                    throw error;
                }
            },

            openDeveloperDocs() {
                const permissions =
                    Number(
                        signedInProfile
                            ?.permissions
                    ) ||
                    0;

                if (
                    !(
                        permissions &
                        DEVELOPER_MENU_PERMISSION_MASK
                    )
                ) {
                    throw new Error(
                        "Developer or Developer Preview permission is required."
                    );
                }

                const opened =
                    window.open(
                        API_BASE +
                        "api/docs/",
                        "wmofDeveloperDocs"
                    );

                if (!opened) {
                    throw new Error(
                        "The Developer Docs window was blocked by the browser."
                    );
                }

                mainMenu
                    ?.hidePopover?.();

                return true;
            },

            openSqlConsole() {
                const opened =
                    window.open(
                        API_BASE +
                        "api/admin/sql/?console=1",
                        "wmofSqlConsole"
                    );

                if (!opened) {
                    throw new Error(
                        "The Database Access window was blocked by the browser."
                    );
                }

                mainMenu
                    ?.hidePopover?.();

                return true;
            },

            async disconnectUser() {
                mainMenu
                    ?.hidePopover?.();

                if (speechTrainingActive) {
                    return false;
                }

                if (
                    inAppSpeechTrainingEnabled
                ) {
                    const exited =
                        await disableInAppSpeechTraining();

                    if (!exited) {
                        return false;
                    }
                }

                deliberatelyLoggedOut =
                    true;
                loginConfirmedThisLoad = false;

                safeStorageSet(
                    "wmof.deliberatelyLoggedOut",
                    "true"
                );

                clearTimeout(
                    loginPromptTimeout
                );

                let remoteDestroyed =
                    false;

                try {
                    const result =
                        await clockTimer
                            .disconnect();

                    remoteDestroyed =
                        Boolean(
                            result?.remote
                        );

                    if (!remoteDestroyed) {
                        const sessionResponse =
                            await fetch(
                                API_BASE +
                                "api/users/",
                                {
                                    credentials:
                                        "same-origin",
                                    cache:
                                        "no-store",
                                    headers: {
                                        "Accept":
                                            "application/json"
                                    }
                                }
                            );

                        if (
                            sessionResponse
                                .status ===
                            401
                        ) {
                            remoteDestroyed =
                                true;
                        }
                        else {
                            const sessionData =
                                await sessionResponse
                                    .json();

                            if (
                                !sessionResponse
                                    .ok ||
                                typeof sessionData
                                    .csrfToken !==
                                    "string"
                            ) {
                                throw new Error(
                                    sessionData
                                        .message ||
                                    "Unable to destroy the WMOF session."
                                );
                            }

                            const logoutResponse =
                                await fetch(
                                    API_BASE +
                                    "api/users/",
                                    {
                                        method:
                                            "POST",
                                        credentials:
                                            "same-origin",
                                        cache:
                                            "no-store",
                                        headers: {
                                            "Accept":
                                                "application/json",
                                            "Content-Type":
                                                "application/json",
                                            "X-CSRF-Token":
                                                sessionData
                                                    .csrfToken
                                        },
                                        body:
                                            JSON.stringify({
                                                action:
                                                    "disconnect"
                                            })
                                    }
                                );

                            if (
                                !logoutResponse
                                    .ok
                            ) {
                                const logoutData =
                                    await logoutResponse
                                        .json()
                                        .catch(
                                            () => ({})
                                        );

                                throw new Error(
                                    logoutData
                                        .message ||
                                    "Unable to destroy the WMOF session."
                                );
                            }

                            remoteDestroyed =
                                true;
                        }
                    }
                }
                finally {
                    syncNetworkStatusUI();
                }

                if (!remoteDestroyed) {
                    throw new Error(
                        "The WMOF server session was not destroyed."
                    );
                }

                return true;
            },

            saveProfileData(
                values
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "wmof:profile-save",
                        {
                            detail:
                                values &&
                                typeof values ===
                                    "object"
                                    ? values
                                    : {}
                        }
                    )
                );

                return true;
            },

            requestPasswordReset() {
                window.dispatchEvent(
                    new CustomEvent(
                        "wmof:reset-password-request",
                        {
                            detail: {
                                apiBase:
                                    API_BASE
                            }
                        }
                    )
                );

                return true;
            },

            changeScheduledStartAuto(
                enabled
            ) {
                scheduledStartAutoArmed =
                    Boolean(enabled);

                scheduledStartAuto.checked =
                    scheduledStartAutoArmed;

                updateScheduledStartDialog();

                return scheduledStartAutoArmed;
            },

            async startScheduledTrip(
                mode = "scheduled"
            ) {
                return beginScheduledTrip(
                    mode === "now"
                        ? "now"
                        : "scheduled"
                );
            },

            async startScheduledTripEarly() {
                if (
                    !scheduledStartDialog
                        .open ||
                    scheduledStartNow
                        .disabled ||
                    !tripDraftCanStart(
                        tripDraft
                    )
                ) {
                    return false;
                }

                return beginScheduledTrip(
                    "now"
                );
            },

            cancelScheduledStart() {
                cancelScheduledStartPrompt();

                return true;
            },

            openScheduledStandardTimeEditor() {
                if (
                    scheduledStartDialog
                        .open
                ) {
                    closeDialog(
                        scheduledStartDialog,
                        {
                            reason:
                                "scheduled-standard-edit",
                            immediate:
                                true
                        }
                    );
                }

                void openNumberPad({
                    mode:
                        "time",
                    source:
                        "standard-time",
                    initialValue:
                        tripDraft
                            ?.standardTimeMilliseconds,
                    role:
                        "trip-settings-field",
                    workflow:
                        "new-trip",
                    cancelTarget:
                        "scheduled-start",
                    confirmTarget:
                        "scheduled-start",
                    backTarget:
                        "scheduled-start",
                    duration:
                        0,
                    allowEmpty:
                        true,
                    onConfirm:
                        durationMilliseconds => {
                            if (
                                !tripDraft
                            ) {
                                return false;
                            }

                            if (
                                durationMilliseconds !==
                                    undefined &&
                                (
                                    !Number.isSafeInteger(
                                        durationMilliseconds
                                    ) ||
                                    durationMilliseconds <= 0
                                )
                            ) {
                                return false;
                            }

                            const voiceSet =
                                Boolean(
                                    voiceEntryState &&
                                    voiceEntryState
                                        .source ===
                                        "standard-time"
                                );

                            tripDraft
                                .standardTimeMilliseconds =
                                durationMilliseconds;

                            if (
                                voiceSet &&
                                Number.isSafeInteger(
                                    durationMilliseconds
                                ) &&
                                durationMilliseconds > 0
                            ) {
                                armScheduledStartAutoFromVoice();
                            }

                            return true;
                        }
                }).catch(
                    () =>
                        showScheduledStartDialog({
                            resolution:
                                scheduledStartNeedsResolution
                        })
                );

                return true;
            },

            clearNumberPadValue() {
                eraseNumberPadPendingValue();

                return Boolean(
                    numberPadState
                );
            },

            backspaceNumberPadValue() {
                return backspaceNumberPadPendingValue();
            },

            resetNumberPadValue() {
                resetNumberPadPendingValue();

                return Boolean(
                    numberPadState
                );
            },

            enterNumberPadDigit(
                digit
            ) {
                if (!numberPadState) {
                    return false;
                }

                const value =
                    String(
                        digit ||
                        ""
                    );

                if (
                    !/^\d$/.test(
                        value
                    )
                ) {
                    return false;
                }

                const previousPending =
                    numberPadState
                        .pending;

                if (
                    numberPadState
                        .replaceOnNextDigit
                ) {
                    numberPadState.pending =
                        "";

                    numberPadState
                        .replaceOnNextDigit =
                        false;
                }

                const candidate =
                    numberPadState
                        .pending +
                    value;

                if (
                    numberPadState
                        .mode ===
                        "absolute" &&
                    candidate.length >
                        6
                ) {
                    return false;
                }

                numberPadState.pending =
                    candidate;

                if (
                    candidate !==
                    previousPending
                ) {
                    numberPadState
                        .everEdited =
                        true;
                }

                refreshNumberPad();

                return true;
            },

            setNumberPadMeridiem(
                value
            ) {
                changeNumberPadMeridiem(
                    value
                );

                return Boolean(
                    numberPadState
                );
            },

            changeNumberPadDate(
                value
            ) {
                if (
                    !numberPadState ||
                    numberPadState
                        .mode !==
                        "absolute"
                ) {
                    return false;
                }

                const next =
                    String(
                        value ||
                        ""
                    );

                if (
                    numberPadState
                        .pendingDate !==
                    next
                ) {
                    numberPadState
                        .everEdited =
                        true;
                }

                numberPadState
                    .pendingDate =
                    next;

                refreshNumberPad();

                return true;
            },

            switchNumberPadToVoice() {
                void switchNumberPadToVoice()
                    .catch(
                        () => {}
                    );

                return true;
            },

            async confirmNumberPad() {
                const signal =
                    currentActionSignal();

                if (
                    signal?.aborted ||
                    !numberPadState ||
                    numberPadConfirm
                        .disabled
                ) {
                    return false;
                }

                try {
                    if (
                        await commitNumberPad(
                            signal
                        )
                    ) {
                        if (signal?.aborted) {
                            return false;
                        }

                        const destination =
                            numberPadState
                                ?.confirmTarget;

                        if (!destination) {
                            return false;
                        }

                        await closeNumberPad({
                            discardPrepared:
                                false,
                            allowChanged:
                                true,
                            destination
                        });

                        return !signal?.aborted;
                    }
                }
                catch {
                    if (numberPadState) {
                        numberPadState
                            .persistence =
                            "offline";

                        refreshNumberPad();
                    }
                }

                return false;
            },

            runNumberPadClear() {
                eraseNumberPadPendingValue();

                return Boolean(
                    numberPadState
                );
            },

            async resumeNumberPadConnection(
                source = "number-pad"
            ) {
                if (
                    !numberPadState ||
                    numberPadState
                        .mode ===
                        "percent" ||
                    numberPadSettingsArea
                        .dataset
                        .persistence !==
                        "offline"
                ) {
                    return false;
                }

                await resumeConnectionFromCloud({
                    source
                });

                return true;
            },

            openNumberPadSettings() {
                if (
                    !numberPadState ||
                    numberPadState
                        .mode ===
                        "percent" ||
                    numberPadState
                        .role ===
                        "trip-settings-field"
                ) {
                    return false;
                }

                if (
                    tripDraft &&
                    numberPadState
                        .source ===
                        "new-trip" &&
                    numberPadValueValid()
                ) {
                    const standardTimeMilliseconds =
                        timeDigitsToMilliseconds(
                            numberPadState
                                .pending
                        );

                    if (
                        Number.isSafeInteger(
                            standardTimeMilliseconds
                        )
                    ) {
                        tripDraft
                            .standardTimeMilliseconds =
                            standardTimeMilliseconds;
                    }
                }

                const returnState = {
                    ...numberPadState
                };

                setTripSettingsReturnToNumberPad(
                    returnState
                );

                if (
                    !openTripSettingsDialog(
                        "number-pad-settings",
                        {
                            duration:
                                0
                        }
                    )
                ) {
                    resetTripSettingsNavigation();

                    return false;
                }

                void closeNumberPad({
                    discardPrepared:
                        false,
                    allowChanged:
                        true,
                    immediate:
                        true,
                    destination:
                        "none"
                })
                    .then(
                        closed => {
                            if (closed) {
                                return;
                            }

                            resetTripSettingsNavigation();

                            closeDialog(
                                tripSettingsDialog,
                                {
                                    reason:
                                        "number-pad-settings:rollback",
                                    immediate:
                                        true
                                }
                            );
                        }
                    )
                    .catch(
                        () => {
                            resetTripSettingsNavigation();
                        }
                    );

                return true;
            },

            async cancelNumberPadEdit() {
                try {
                    return Boolean(
                        await cancelNumberPad()
                    );
                }
                catch {
                    return false;
                }
            },

            async saveDownDetails(
                tripId,
                intervalKey,
                {
                    notes = "",
                    image,
                    deleteImage =
                        false
                } = {}
            ) {
                const payload =
                    new FormData();

                payload.set(
                    "notes",
                    String(
                        notes ||
                        ""
                    )
                );

                if (image) {
                    payload.set(
                        "image",
                        image
                    );
                }

                if (deleteImage) {
                    payload.set(
                        "deleteImage",
                        "1"
                    );
                }

                await clockTimer
                    .downDetailsRequest(
                        tripId,
                        intervalKey,
                        payload
                    );

                if (
                    !tripLogBody.hidden
                ) {
                    await dispatchTripListRequest(
                        "down-details"
                    );
                }

                return true;
            },

            resumeConnection(
                source = "app"
            ) {
                void resumeConnectionFromCloud({
                    source:
                        String(
                            source ||
                            "app"
                        )
                }).catch(
                    () => {}
                );

                return true;
            },

            releaseEndTimeGoal() {
                releaseEndTimeGoalOverride();

                return true;
            },

            toggleTimerType() {
                return toggleClockTimerTypeFromTap();
            },

            toggleTimerMode() {
                return toggleClockTimerElapsedRemaining();
            },

            openTripStandardTimeEditor() {
                return actions
                    .openTripTimeEditor(
                        "standard-time"
                    );
            },

            openTripScheduledStartEditor() {
                return actions
                    .openTripTimeEditor(
                        "scheduled-start"
                    );
            },

            openTripActualStartEditor() {
                return actions
                    .openTripTimeEditor(
                        "actual-start"
                    );
            },

            openTripCreationTimeEditor() {
                return actions
                    .openTripTimeEditor(
                        "creation-time"
                    );
            },

            changeScheduledStart(
                spokenTime
            ) {
                return applyTripFieldSpeechValue(
                    "scheduled-start",
                    spokenTime
                );
            },

            changeActualStart(
                spokenTime
            ) {
                return applyTripFieldSpeechValue(
                    "actual-start",
                    spokenTime
                );
            },

            changeCreationTime(
                spokenTime
            ) {
                return applyTripFieldSpeechValue(
                    "creation-time",
                    spokenTime
                );
            },

            async openTripTimeEditor(
                field
            ) {
                const button =
                    tripSettingsDialog
                        .querySelector(
                            `[data-trip-time-field="${field}"]`
                        );

                if (
                    !button ||
                    button.disabled
                ) {
                    return false;
                }

                try {
                    await openTripFieldNumberPad(
                        field
                    );

                    if (
                        !numberPadDialog
                            ?.open &&
                        !voiceEntryState
                    ) {
                        return false;
                    }

                    if (
                        !closeDialog(
                            tripSettingsDialog,
                            {
                                reason:
                                    `trip-settings:${field}`,
                                immediate:
                                    true
                            }
                        )
                    ) {
                        if (voiceEntryState) {
                            await closeVoiceEntry({
                                cancel: true,
                                destination:
                                    "none"
                            });
                        }
                        else {
                            await closeNumberPad({
                                discardPrepared:
                                    false,
                                allowChanged:
                                    true,
                                immediate:
                                    true,
                                destination:
                                    "none"
                            });
                        }
                    }

                    return true;
                }
                catch {
                    return false;
                }
            },

            toggleTripStartsNow() {
                if (
                    !tripDraft ||
                    tripIsLive()
                ) {
                    return false;
                }

                if (
                    !tripSettingsSession
                ) {
                    beginTripSettingsSession();
                }

                const values =
                    tripSettingsSession
                        ?.values;

                if (!values) {
                    return false;
                }

                if (
                    !tripStartsNowState
                ) {
                    const now =
                        new Date();

                    const value =
                        formatTimelineDateTime(
                            now,
                            values
                                .creationDate
                        );

                    if (!value) {
                        return false;
                    }

                    const label =
                        formatTripTimeOnly(
                            value,
                            values
                                .creationDate
                        );

                    if (
                        !label ||
                        label === "---"
                    ) {
                        return false;
                    }

                    tripStartsNowState = {
                        value,
                        label,
                        snapshot: {
                            scheduledStart:
                                values
                                    .scheduledStart,
                            startTime:
                                values
                                    .startTime
                        },
                        scheduled:
                            false,
                        actual:
                            false
                    };

                    syncTripStartsNowUI();

                    return true;
                }

                beginTripStartsNowExit();

                return true;
            },

            cancelTripStartsNow() {
                if (
                    !tripStartsNowState
                ) {
                    return false;
                }

                const values =
                    tripSettingsSession
                        ?.values;

                const snapshot =
                    tripStartsNowState
                        .snapshot;

                if (
                    values &&
                    snapshot
                ) {
                    if (
                        tripStartsNowState
                            .scheduled
                    ) {
                        values
                            .scheduledStart =
                            snapshot
                                .scheduledStart;
                    }

                    if (
                        tripStartsNowState
                            .actual
                    ) {
                        values
                            .startTime =
                            snapshot
                                .startTime;

                        tripSettingsSession
                            .startTimeSetToNow =
                            false;
                    }
                }

                beginTripStartsNowExit();

                return true;
            },

            toggleTripStartsNowTarget(
                target
            ) {
                if (
                    !tripStartsNowState
                ) {
                    return false;
                }

                const values =
                    tripSettingsSession
                        ?.values;

                const snapshot =
                    tripStartsNowState
                        .snapshot;

                if (
                    !values ||
                    !snapshot
                ) {
                    return false;
                }

                const scheduled =
                    target ===
                    "scheduled-start";

                const key =
                    scheduled
                        ? "scheduled"
                        : "actual";

                const selected =
                    !tripStartsNowState[
                        key
                    ];

                tripStartsNowState[
                    key
                ] =
                    selected;

                if (scheduled) {
                    values.scheduledStart =
                        selected
                            ? tripStartsNowState
                                .value
                            : snapshot
                                .scheduledStart;
                }
                else {
                    values.startTime =
                        selected
                            ? tripStartsNowState
                                .value
                            : snapshot
                                .startTime;

                    if (
                        tripSettingsSession
                    ) {
                        tripSettingsSession
                            .startTimeSetToNow =
                            selected;
                    }
                }

                refreshTripSettingsValues();

                return selected;
            },

            changeTripProductive(
                productive
            ) {
                const session =
                    tripSettingsSession ||
                    beginTripSettingsSession();

                if (!session) {
                    return false;
                }

                session.values
                    .nonProduction =
                    !Boolean(
                        productive
                    );

                return true;
            },

            changeTripDeferred(
                deferred
            ) {
                const session =
                    tripSettingsSession ||
                    beginTripSettingsSession();

                if (
                    !session ||
                    session.live
                ) {
                    return false;
                }

                const values =
                    session.values;

                const enabled =
                    Boolean(
                        deferred
                    );

                if (enabled) {
                    session
                        .preDeferredValues =
                        cloneTripSettingsValues(
                            values
                        );

                    values.scheduledStart =
                        values.creationTime;

                    values.startTime =
                        undefined;

                    tripStartsNowState =
                        undefined;

                    tripStartsNowExiting =
                        false;
                }
                else {
                    if (
                        session
                            .preDeferredValues
                    ) {
                        Object.assign(
                            values,
                            cloneTripSettingsValues(
                                session
                                    .preDeferredValues
                            )
                        );
                    }

                    session
                        .preDeferredValues =
                        undefined;
                }

                values.deferred =
                    enabled;

                tripStartsNowState =
                    undefined;

                refreshTripSettingsValues();

                return true;
            },

            async saveTripSettings() {
                if (
                    !tripSettingsSession
                ) {
                    beginTripSettingsSession();
                }

                const startingDraft =
                    Boolean(
                        tripDraft &&
                        !tripIsLive()
                    );

                if (
                    !applyTripSettingsSession()
                ) {
                    refreshTripSettingsValues();

                    return false;
                }

                if (startingDraft) {
                    if (
                        tripDraft.deferred
                    ) {
                        releaseNewTripWorkflow();

                        tripStartsNowState =
                            undefined;

                        tripSettingsSession =
                            undefined;

                        if (
                            numberPadDialog
                                ?.open
                        ) {
                            await closeNumberPad({
                                discardPrepared:
                                    false,
                                allowChanged:
                                    true,
                                immediate:
                                    true,
                                destination:
                                    "home"
                            });
                        }

                        uiReturnStack.length =
                            0;

                        resetTripSettingsNavigation();

                        closeDialog(
                            tripSettingsDialog,
                            {
                                reason:
                                    "trip-settings-defer"
                            }
                        );

                        renderDeferredTrip();

                        return true;
                    }

                    if (
                        tripDraftHasFutureStart(
                            tripDraft
                        )
                    ) {
                        tripStartsNowState =
                            undefined;

                        tripSettingsSession =
                            undefined;

                        resetTripSettingsNavigation();

                        closeDialog(
                            tripSettingsDialog,
                            {
                                reason:
                                    "trip-settings-scheduled",
                                immediate:
                                    true
                            }
                        );

                        showScheduledStartDialog();

                        return true;
                    }

                    try {
                        if (
                            !await startTripDraft()
                        ) {
                            restoreDraftFromTripSettingsOriginal();

                            refreshTripSettingsValues();

                            return false;
                        }
                    }
                    catch {
                        restoreDraftFromTripSettingsOriginal();

                        refreshTripSettingsValues();

                        return false;
                    }

                    tripStartsNowState =
                        undefined;

                    tripSettingsSession =
                        undefined;

                    resetTripSettingsNavigation();

                    closeDialog(
                        tripSettingsDialog,
                        {
                            reason:
                                "trip-settings-start"
                        }
                    );

                    return true;
                }

                syncTripSettingsCallerAfterSave();

                await clockTimer
                    .persistCurrentTrip();

                tripStartsNowState =
                    undefined;

                tripSettingsSession =
                    undefined;

                await closeTripSettingsToNavigation(
                    "trip-settings-save"
                );

                return true;
            },

        });

    for (
        const actionName of
        [
            "openStartMenu",
            "prepareReadyAction",
            "prepareStartMenu",
            "closeActiveSurface",
            "endTrip"
        ]
    ) {
        globalThis
            .WMOFActionFunctions
            .setMetadata(
                actionName,
                {
                    interruptGroup:
                        "primary-surface"
                }
            );
    }

    for (
        const actionName of
        [
            "handleVoiceEntrySpeech",
            "confirmNumberPad",
            "cancelNumberPadEdit"
        ]
    ) {
        globalThis
            .WMOFActionFunctions
            .setMetadata(
                actionName,
                {
                    interruptGroup:
                        "value-editor"
                }
            );
    }

    globalThis
        .WMOFActionFunctions
        .setMetadata(
            "readSyncStatus",
            {
                parameters: []
            }
        );

    globalThis
        .WMOFActionFunctions
        .setMetadata(
            "toggleSync",
            {
                parameters: [
                    {
                        name: "syncState",
                        type: "choice",
                        optional: true,
                        values: [
                            "on",
                            "off"
                        ]
                    }
                ]
            }
        );

    globalThis
        .WMOFActionFunctions
        .setMetadata(
            "toggleRenderedTime",
            {
                parameters: [
                    {
                        name: "timeMode",
                        type: "choice",
                        optional: true,
                        values:
                            RENDERED_TIME_MODES
                                .slice()
                    }
                ]
            }
        );

    globalThis
        .WMOFActionFunctions
        .setContextProvider(
            () => {
                let summary;
                let activeInterval;

                try {
                    summary =
                        clockTimer
                            .getSummarySnapshot
                            ?.(
                                new Date()
                            );
                }
                catch {}

                try {
                    activeInterval =
                        clockTimer
                            .getActiveIntervalState
                            ?.(
                                new Date()
                            );
                }
                catch {}

                return {
                    currentTrip: {
                        id:
                            clockTimer
                                .currentTripId,
                        status:
                            clockTimer
                                .status,
                        summary:
                            summary?.trip
                    },
                    activeInterval:
                        activeInterval ||
                        null,
                    renderedTime: {
                        mode:
                            clockTimer
                                .renderedTimeMode
                    },
                    sync: {
                        enabled:
                            getSyncGoalsState(),
                        connection:
                            normalizedConnectionStatus()
                    },
                    goal: {
                        mode:
                            normalizePercentMode(
                                clockTimer
                                    .percentMode
                            )
                    }
                };
            }
        );


    function ensureSpeechMenu(
        container = document.body,
        modalMode
    ) {
        if (
            modalMode === "top-level"
        ) {
            const topLevel =
                document.getElementById(
                    "speechTopLevelMenu"
                );

            if (topLevel) {
                return topLevel;
            }
        }

        const selector =
            modalMode
                ? `speech-menu[speech-modal="${modalMode}"]`
                : "speech-menu:not([speech-modal])";

        let menu;

        try {
            menu =
                [
                    ...container.children
                ].find(
                    element =>
                        element.matches?.(
                            selector
                        )
                );
        }
        catch {}

        if (menu) {
            return menu;
        }

        menu =
            document.createElement(
                "speech-menu"
            );

        menu.dataset.speechRuntimeMenu =
            "true";

        if (modalMode) {
            menu.setAttribute(
                "speech-modal",
                modalMode
            );
        }

        container.append(menu);
        return menu;
    }

    void (async () => {
        try {
            await ensureSpeechRuntime();
            bindVoiceEntryTranscriptPipe();
        }
        catch (error) {
            console.error(error);
            return;
        }

        const englishLanguage = globalThis.WMOFLanguages?.["en-US"];
        englishSpeech =
            englishLanguage?.speech;

        installSpeechCommand =
            (key, actionName, container = document.body, modal = true, valueKind, valueField) => {
            const pattern = englishSpeech?.commands?.[key];
            if (!pattern) return;
            const modalMode =
                modal === true
                    ? "top-level"
                    : modal === "default"
                        ? "default"
                        : undefined;
            const speechMenu =
                ensureSpeechMenu(
                    container,
                    modalMode
                );

            const editorId =
                `builtin:${key}:${container.id || "page"}`;

            let element =
                [
                    ...speechMenu
                        .querySelectorAll(
                            ":scope > speech-command[data-speech-editor-id]"
                        )
                ]
                    .find(
                        candidate =>
                            candidate.dataset
                                .speechEditorId ===
                            editorId
                    );

            if (!element) {
                element =
                    document.createElement(
                        "speech-command"
                    );

                element.dataset
                    .speechEditorId =
                    editorId;

                speechMenu.append(
                    element
                );
            }
            const speechTargets = {
                readyAt:"#newTripButton", ready:"#newTripButton",
                breakStart:"#breakButton", down:"#downButton", breakEnd:"#breakButton",
                resume:"#downResumeButton",
                changeGoal:"#goalPercentValue",
                sync:"#toggleSyncMenuButton,#toggleSyncGoalButton", syncStatus:"#toggleSyncMenuButton,#toggleSyncGoalButton", howLong:"#toggleRenderedTimeButton", when:"#toggleRenderedTimeButton", lockEndTime:"#toggleRenderedTimeButton", showTripLog:"#tripListMenuButton",
                hideTripLog:"#tripListMenuButton", deferTrip:"#tripDefer", renderedTimeMode:"#toggleRenderedTimeButton",
                breakChoice:"#breakDialog [data-break-type]", confirm:"#breakDialog [data-break-type]",
                yes:"#speechBreakConfirmYes", no:"#speechBreakConfirmNo", cancel:"#speechBreakConfirmCancel",
                standardTimeEditor:'#tripSettingsDialog [data-trip-time-field="standard-time"]',
                scheduledStartEditor:'#tripSettingsDialog [data-trip-time-field="scheduled-start"]',
                scheduledStart:'#tripSettingsDialog [data-trip-time-field="scheduled-start"]',
                actualStartEditor:'#tripSettingsDialog [data-trip-time-field="actual-start"]',
                actualStart:'#tripSettingsDialog [data-trip-time-field="actual-start"]',
                creationTimeEditor:'#tripSettingsDialog [data-trip-time-field="creation-time"]',
                creationTime:'#tripSettingsDialog [data-trip-time-field="creation-time"]',
                scheduledStartNow:"#scheduledStartNow"
            };

            const speechOptionGroups = {
                tripGoal: "goals",
                totalGoal: "goals",
                changeGoal: "goals",
                readGoalMode: "mode",
                goalMode: "mode",
                readRenderedTime: "time",
                renderedTimeMode: "time"
            };

            const speechIntents = {
                confirm: "confirm",
                cancel: "cancel"
            };

            const speechChainContexts = {
                breakChoice:
                    "break-choice",
                confirm:
                    "break-confirm",
                scheduledStartNow:
                    "scheduled-start"
            };

            const speechChainNext = {
                readyAt:
                    "scheduled-start",
                breakStart:
                    "break-choice",
                breakChoice:
                    "break-confirm"
            };

            const speechOptionCategories = {
                readyAt: "trip-actions",
                readyAtContinuation: "trip-actions",
                ready: "trip-actions",
                breakStart: "trip-actions",
                down: "trip-actions",
                breakEnd: "trip-actions",
                resume: "trip-actions",
                tripGoal: "goals",
                totalGoal: "goals",
                changeGoal: "goals",
                readGoalMode: "informational",
                goalMode: "settings",
                readRenderedTime: "informational",
                sync: "settings",
                syncStatus: "informational",
                howLong: "informational",
                when: "informational",
                lockEndTime: "settings",
                showTripLog: "trip-actions",
                hideTripLog: "trip-actions",
                deferTrip: "trip-actions",
                renderedTimeMode: "settings",
                breakChoice: "trip-actions",
                confirm: "trip-actions",
                yes: "trip-actions",
                no: "trip-actions",
                cancel: "trip-actions",
                standardTimeEditor: "settings",
                scheduledStartEditor: "settings",
                scheduledStart: "settings",
                actualStartEditor: "settings",
                actualStart: "settings",
                creationTimeEditor: "settings",
                creationTime: "settings",
                scheduledStartNow: "trip-actions"
            };

            if (speechTargets[key]) {
                element.dataset.speechTarget =
                    speechTargets[key];
            }
            else {
                delete element.dataset.speechTarget;
            }

            const speechAvailability = {
                readyAt:
                    "WMOFSpeechAvailability.canStartTrip",
                ready:
                    "WMOFSpeechAvailability.canUseReady",
                readyAtContinuation:
                    "WMOFSpeechAvailability.canContinueStartAt",
                breakStart:
                    "WMOFSpeechAvailability.canOpenBreakMenu",
                down:
                    "WMOFSpeechAvailability.canStartDownTime",
                breakEnd:
                    "WMOFSpeechAvailability.canOpenBreakEndMenu",
                resume:
                    "WMOFSpeechAvailability.canResumeTrip",
                lockEndTime:
                    "WMOFSpeechAvailability.canLockEndTime",
                showTripLog:
                    "WMOFSpeechAvailability.canOpenTripLog",
                hideTripLog:
                    "WMOFSpeechAvailability.canCloseTripLog",
                deferTrip:
                    "WMOFSpeechAvailability.canDeferTrip",
                renderedTimeMode:
                    "WMOFSpeechAvailability.canToggleRenderedTime",
                cancel:
                    "WMOFSpeechAvailability.canCloseSurface"
            };

            const availability =
                speechAvailability[
                    key
                ] ||
                (
                    speechOptionCategories[
                        key
                    ] ===
                        "informational"
                        ? "WMOFSpeechAvailability.canUseInformational"
                        : ""
                );

            if (availability) {
                element.setAttribute(
                    "speech-available",
                    availability
                );
            }
            else {
                element.removeAttribute(
                    "speech-available"
                );
            }

            if (speechIntents[key]) {
                element.dataset.speechIntent =
                    speechIntents[key];
            }
            else {
                delete element.dataset.speechIntent;
            }
            if (speechOptionGroups[key]) {
                element.dataset.speechOptionsGroup =
                    speechOptionGroups[key];
            }
            element.dataset.speechOptionsCategory =
                speechOptionCategories[key] ||
                "settings";

            if (speechChainContexts[key]) {
                element.setAttribute(
                    "speech-chain-context",
                    speechChainContexts[key]
                );
            }
            else {
                element.removeAttribute(
                    "speech-chain-context"
                );
            }

            if (speechChainNext[key]) {
                element.setAttribute(
                    "speech-chain-next",
                    speechChainNext[key]
                );
            }
            else {
                element.removeAttribute(
                    "speech-chain-next"
                );
            }

            element.setAttribute("speech-pattern", pattern);
            element.setAttribute("speech-function", `WMOFActions.${actionName}`);
            if (valueKind && valueField) {
                element.setAttribute("speech-preproc", "WMOFSpeechProcessing.normalizeSpeechValue");
                element.setAttribute("speech-preproc-context", valueKind);
                element.setAttribute("speech-preproc-field", valueField);
            }

            return element;
        };
        if (englishSpeech) {
            for (const element of [scheduledStartStandard, tripSettingsDialog.querySelector('[data-trip-time-field="standard-time"]')]) {
                if (!element) continue;
                element.dataset.speechEditorId = `builtin:standardTime:${element.id || "trip-settings"}`;

                if (element === scheduledStartStandard) {
                    element.setAttribute(
                        "speech-chain-context",
                        "scheduled-start"
                    );
                }
                else {
                    element.removeAttribute(
                        "speech-chain-context"
                    );
                }
                element.dataset.speechTarget = element.id ? `#${element.id}` : '#tripSettingsDialog [data-trip-time-field="standard-time"]';
                element.dataset.speechOptionsCategory =
                    "settings";
                element.setAttribute("speech-pattern", englishSpeech.commands.standardTime);
                element.setAttribute("speech-function", "WMOFActions.changeStandardTime");
                element.setAttribute("speech-preproc", "WMOFSpeechProcessing.normalizeSpeechValue");
                element.setAttribute("speech-preproc-context", "duration");
                element.setAttribute("speech-preproc-field", "timeValue");
            }
            for (const [key, fn] of [
                ["readyAt","scheduleStartAt"], ["readyAtContinuation","continueStartAt"], ["ready","prepareReadyAction"], ["breakStart","openBreakMenu"], ["down","startDownTime"],
                ["breakEnd","openBreakEndMenu"], ["resume","resumeTrip"],
                ["tripGoal","readTripGoal"], ["totalGoal","readTotalGoal"],
                ["changeGoal","changeGoal"],
                ["readGoalMode","readGoalMode"], ["goalMode","changeGoalMode"],
                ["readRenderedTime","readRenderedTime"],
                ["sync","toggleSync"], ["syncStatus","readSyncStatus"], ["howLong","readTimeRemaining"], ["when","readEndTime"], ["lockEndTime","lockEndTime"], ["showTripLog","openTripLog"],
                ["hideTripLog","closeTripLog"], ["deferTrip","deferTrip"], ["renderedTimeMode","toggleRenderedTime"]
            ]) {
                const typedValues = {
                    readyAt:["clock","spokenTime"], readyAtContinuation:["clock","spokenTime"],
                    changeGoal:["percent","percent"],
                    lockEndTime:["clock","spokenTime"]
                };
                installSpeechCommand(key, fn, document.body, true, ...(typedValues[key] || []));
            }
            installSpeechCommand("breakChoice", "chooseBreakType", breakDialog, false);
            installSpeechCommand("confirm", "confirmBreakType", breakDialog, false);

            const earlyStartStandardEditorCommand =
                installSpeechCommand(
                    "standardTimeEditor",
                    "openScheduledStandardTimeEditor",
                    scheduledStartDialog,
                    false
                );

            if (
                earlyStartStandardEditorCommand
            ) {
                earlyStartStandardEditorCommand
                    .dataset
                    .speechTarget =
                    "#scheduledStartStandard";
            }

            installSpeechCommand(
                "scheduledStartNow",
                "startScheduledTripEarly",
                scheduledStartDialog,
                false
            );

            installSpeechCommand(
                "standardTimeEditor",
                "openTripStandardTimeEditor",
                tripSettingsDialog,
                false
            );
            installSpeechCommand(
                "scheduledStartEditor",
                "openTripScheduledStartEditor",
                tripSettingsDialog,
                false
            );
            installSpeechCommand(
                "scheduledStart",
                "changeScheduledStart",
                tripSettingsDialog,
                false,
                "clock",
                "spokenTime"
            );
            installSpeechCommand(
                "actualStartEditor",
                "openTripActualStartEditor",
                tripSettingsDialog,
                false
            );
            installSpeechCommand(
                "actualStart",
                "changeActualStart",
                tripSettingsDialog,
                false,
                "clock",
                "spokenTime"
            );
            installSpeechCommand(
                "creationTimeEditor",
                "openTripCreationTimeEditor",
                tripSettingsDialog,
                false
            );
            installSpeechCommand(
                "creationTime",
                "changeCreationTime",
                tripSettingsDialog,
                false,
                "clock",
                "spokenTime"
            );

            installSpeechCommand("confirm", "saveTripSettings", tripSettingsDialog, false);
            installSpeechCommand("cancel", "closeActiveSurface", document.body, "default");
            installNumberPadSpeechCommands();
            installVoiceEntrySpeechCommands();
            speechMicBar
                ?.setSystemSpeechPatterns?.({
                    wake:
                        englishSpeech
                            .wakePhrase,
                    sleep:
                        englishSpeech
                            .sleepPhrase,
                    off:
                        englishSpeech
                            .offPhrase
                });
            SpeechMenu.refresh();
        }

        speechRecognitionLanguageAvailable =
            Boolean(
                englishSpeech
            );

        syncSpeechTrainingControls();

        speechMicBar?.addEventListener(
            "started",
            () =>
                actions
                    .handleSpeechRuntimeStarted()
        );

        speechMicBar?.addEventListener(
            "utteranceStarted",
            () =>
                actions
                    .handleSpeechUtteranceStarted()
        );

        speechMicBar?.addEventListener(
            "stopped",
            () =>
                actions
                    .handleSpeechRuntimeStopped()
        );

        speechMicBar?.addEventListener(
            "speechCaptureEnded",
            () =>
                actions
                    .handleSpeechRuntimeStopped()
        );

        speechMicBar?.addEventListener(
            "muted",
            () =>
                actions
                    .handleSpeechRuntimeMuted(
                        true
                    )
        );

        speechMicBar?.addEventListener(
            "unmuted",
            () =>
                actions
                    .handleSpeechRuntimeMuted(
                        false
                    )
        );

        if (
            englishSpeech &&
            !globalThis.SpeechMenu
                ?.started
        ) {
            speechActivationPending =
                true;
            setSpeechButtonState(
                true,
                false
            );
            setSpeechLayoutState(
                true
            );

            try {
                const started =
                    await globalThis
                        .SpeechMenu
                        ?.start?.(
                            englishLanguage
                                ?.speechRecognitionLanguage ||
                            "en-US"
                        );

                if (!started) {
                    setSpeechButtonState(
                        false,
                        false
                    );
                    setSpeechLayoutState(
                        false
                    );
                }
            }
            catch (error) {
                console.error(
                    error
                );
                setSpeechButtonState(
                    false,
                    false
                );
                setSpeechLayoutState(
                    false
                );
            }
            finally {
                speechActivationPending =
                    false;
            }
        }

        const speechBreakConfirmDialog =
            $("#speechBreakConfirmDialog");

        for (
            const [
                id,
                action,
                name
            ] of [
                [
                    "speechBreakConfirmYes",
                    "confirmBreakPromptYes",
                    "confirmBreakPromptYesClick"
                ],
                [
                    "speechBreakConfirmNo",
                    "confirmBreakPromptNo",
                    "confirmBreakPromptNoClick"
                ],
                [
                    "speechBreakConfirmCancel",
                    "cancelBreakPrompt",
                    "cancelBreakPromptClick"
                ]
            ]
        ) {
            globalThis
                .WMOFInteractionFunctions
                .bindAction({
                    element:
                        $("#" + id),
                    event:
                        "click",
                    name,
                    action
                });
        }

        speechBreakConfirmDialog
            ?.addEventListener(
                "close",
                clearSpeechBreakPrompt
            );

        if (
            englishSpeech &&
            speechBreakConfirmDialog
        ) {
            installSpeechCommand(
                "yes",
                "confirmBreakPromptYes",
                speechBreakConfirmDialog,
                false
            );

            installSpeechCommand(
                "no",
                "confirmBreakPromptNo",
                speechBreakConfirmDialog,
                false
            );

            installSpeechCommand(
                "cancel",
                "cancelBreakPrompt",
                speechBreakConfirmDialog,
                false
            );

            SpeechMenu.refresh();
        }

    })();

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
    setSyncAnnouncementBaseline();
    applyScope(safeStorageGet(STORAGE.percentMode) || "trip", false);
    applyRenderedTimeMode(safeStorageGet(STORAGE.renderedTimeMode) || "remaining", false);
    updateSummaryValues();
    syncNetworkStatusUI({ startup: true });
    showInitialLoginDialog();
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
