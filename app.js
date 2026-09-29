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
    const AUDIO_SPEECH_VELOCITY_MAX = 4;
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
        indicatorSymbol: "â–²",
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
            text: "Radial Overflow preserves the clockâ€™s normal minute scale. The ring starts at the minute mark where the trip began, follows the clock face, and continues into additional rings when the timeframe exceeds the available circle. Radial Fitted starts at the top of the clock and visually compresses the entire trip timeframe into one complete ring, with each range sized in proportion to its share of the trip."
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
        toleranceColor: {title: "B-Game Color", text: "You aimed above 100%. B-Game shows the time after you miss that goal while youâ€™re still above 100%.", stateControl: "showTolerance", stateText: {true: "B-Game is shown.", false: "That time is shown as Trip time.", undefined: "B-Game appears after you enter that portion of the trip."}},
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
        "2026-09-29-responsive-1";

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
                " Â· "
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
                "â€”"
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
            "â€”";

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
                    "â€”"
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
                "â€”";
            liveStreamRemoteTime.textContent =
                "â€”";
            liveStreamRemoteGoal.textContent =
                "â€”";
            liveStreamRemoteSpeech.textContent =
                "â€”";
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
                            "â€”";
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
                                "Connectingâ€¦";

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

    let initialLoginSuppressed =
        speechEditorPreview;
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
    let endTimeGoalLockFlashTimer;
    let syncNetworkStatus;
    let syncOfflineTransitionSequence = 0;
    let syncAnnouncementState;
    let syncAnnouncementGoal;
    let syncPreferenceChangeInProgress =
        false;

    const CONNECTION_INDICATOR_MINIMUM = 1000;
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
            clamp(value.speechVelocity, 0.5, 4, 1);
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
                    0.5,
                    4
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
                label + " â€º";

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
                        "â€º";

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
            audioSettings.masterVelocity.toFixed(2) + "Ã—";
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
                0.5,
                Math.min(
                    4,
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

        // In phone landscape the pinned button lives in the header.
        if (window.matchMedia(
            "(orientation: landscape) and (min-width: 600px) and (max-height: 520px)"
        ).matches) {
            return {
                left: metrics.rect.right - metrics.paddingRight - 108,
                top: metrics.rect.top + metrics.paddingTop,
                width: 108,
                height: 44
            };
        }

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
            if (!tripLogBody.querySelector('.trip-log-settings')) tripLogBody.textContent = "Loading tripsâ€¦";
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
        if (speechEditorPreview) {
            initialLoginAttemptPending =
                false;

            return false;
        }

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
        const label=document.createElement('label');label.textContent='Notes';const notes=document.createElement('textarea');notes.maxLength=10000;notes.placeholder='Describe the cause of the down timeâ€¦';notes.value=data.notes||'';notes.readOnly=!editing&&!capture;label.append(notes);body.append(label);
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
                "Ã—";

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
                        "âœ“",
                    label:
                        "Current model accepted"
                };
            case "model-miss":
                return {
                    symbol:
                        "âœ“",
                    label:
                        "Current model rejected"
                };
            case "divergence":
                return {
                    symbol:
                        "Ã—",
                    label:
                        "Current model rejected Â· divergence"
                };
            default:
                return {
                    symbol:
                        "",
                    label:
                        "Discarded Â· unusable input"
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
                    "â€”"
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
            ? "Pending developer review Â· read only"
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
            : "â€”";
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
            "Ã—";

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
            "Ã—";

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
                            ? "  â€¢ continuation"
                            : recognition
                                .exact
                                ? "  â€¢ terminal"
                                : "  â€¢ partial"
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
                                    " ms Â· " +
                                    (
                                        entry
                                            .type ===
                                            "separation"
                                            ? "new stream"
                                            : "continuation"
                                    ) +
                                    " Â· " +
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
            " for â€œ" +
            pendingSpeechTrainingTargetLabel() +
            "â€. " +
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
    ÷Þ4Ñ¼­zÊ&ŠÛ^uÑ¥½¸É•…Ñ•9Õµ‰•ÉA…‘MÑ…Ñ”¡ì(€€€€€€€µ½‘”°(€€€€€€€Í½ÕÉ”°(€€€€€€€¥¹¥Ñ¥…±Y…±Õ”€ô€ˆˆ°(€€€€€€€ÑÉ¥Á•™…Õ±ÑÌ°(€€€€€€€ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´€ô™…±Í”°(€€€€€€€É½±”€ô€‰É½½Ðˆ°(€€€€€€€Ý½É­™±½Ü°(€€€€€€€…¹•±Q…É•Ð°(€€€€€€€½¹™¥ÉµQ…É•Ð°(€€€€€€€‰…­Q…É•Ð°(€€€€€€€½¹½¹™¥É´°(€€€€€€€½¹…¹•°°(€€€€€€€Ñ¥Ñ±”°(€€€€€€€…±±½ÝµÁÑä€ô™…±Í”(€€€ô€ôíô¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€ÑåÁ•½˜½¹™¥ÉµQ…É•Ð€„ôô€‰ÍÑÉ¥¹œˆñð(€€€€€€€€€€€€…½¹™¥ÉµQ…É•Ð¹ÑÉ¥´ ¤ñð(€€€€€€€€€€€ÑåÁ•½˜…¹•±Q…É•Ð€„ôô€‰ÍÑÉ¥¹œˆñð(€€€€€€€€€€€€……¹•±Q…É•Ð¹ÑÉ¥´ ¤(€€€€€€€€¤ì(€€€€€€€€€€€Ñ¡É½Ü¹•ÜQåÁ•ÉÉ½È (€€€€€€€€€€€€€€€€‰%¹ÁÕÐÉ•ÅÕ¥É•Ì•áÁ±¥¥Ð½¹™¥ÉµQ…É•Ð…¹…¹•±Q…É•Ð¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¹½Éµ…±¥é•‘5½‘”€ô(€€€€€€€€€€€µ½‘”€ôôô€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€ü€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€èµ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€€€€€ü€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€€€€€è€‰‘ÕÉ…Ñ¥½¸ˆì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•‘I½±”€ô(€€€€€€€€€€€É½±”€ôôô€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ(€€€€€€€€€€€€€€€€ü€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ(€€€€€€€€€€€€€€€€è€‰É½½Ðˆì((€€€€€€€±•Ð¥¹¥Ñ¥…°ì(€€€€€€€±•Ð¥¹¥Ñ¥…±…Ñ”ì(€€€€€€€±•Ð¥¹¥Ñ¥…±5•É¥‘¥•´ì((€€€€€€€¥˜€¡¹½Éµ…±¥é•‘5½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ¤ì(€€€€€€€€€€€½¹ÍÐ…‰Í½±ÕÑ”€ô(€€€€€€€€€€€€€€€•Ñ‰Í½±ÕÑ•A…‘%¹¥Ñ¥…° (€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”°(€€€€€€€€€€€€€€€€€€€ÑÉ¥Á•™…Õ±ÑÌü¹É•…Ñ¥½¹…Ñ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹¥Ñ¥…°€ô…‰Í½±ÕÑ”¹‘¥¥ÑÌì(€€€€€€€€€€€¥¹¥Ñ¥…±…Ñ”€ô…‰Í½±ÕÑ”¹‘…Ñ”ì(€€€€€€€€€€€¥¹¥Ñ¥…±5•É¥‘¥•´€ô…‰Í½±ÕÑ”¹µ•É¥‘¥•´ì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€¥¹¥Ñ¥…°€ô(€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘5½‘”€ôôô€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€ü¹½Éµ…±¥é•A•É•¹Ñ¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€è‘ÕÉ…Ñ¥½¹Y…±Õ•Q½I…Ý¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È¡¥¹¥Ñ¥…±Y…±Õ”¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…Ñ”€ôì(€€€€€€€€€€€µ½‘”è¹½Éµ…±¥é•‘5½‘”°(€€€€€€€€€€€½¹½¹™¥É´°(€€€€€€€€€€€½¹…¹•°°(€€€€€€€€€€€Í½ÕÉ”°(€€€€€€€€€€€Ñ¥Ñ±”è(€€€€€€€€€€€€€€€Ñ¥Ñ±”ñð(€€€€€€€€€€€€€€€•Ñ9Õµ‰•ÉA…‘Q¥Ñ±” (€€€€€€€€€€€€€€€€€€€Í½ÕÉ”(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€¥¹¥Ñ¥…°°(€€€€€€€€€€€Á•¹‘¥¹œè¥¹¥Ñ¥…°°(€€€€€€€€€€€¥¹¥Ñ¥…±…Ñ”°(€€€€€€€€€€€Á•¹‘¥¹…Ñ”è¥¹¥Ñ¥…±…Ñ”°(€€€€€€€€€€€¥¹¥Ñ¥…±5•É¥‘¥•´°(€€€€€€€€€€€µ•É¥‘¥•´è¥¹¥Ñ¥…±5•É¥‘¥•´°(€€€€€€€€€€€É•Á±…•=¹9•áÑ¥¥Ðè(€€€€€€€€€€€€€€€Í½ÕÉ”€„ôô€‰¹•ÜµÑÉ¥Àˆ°(€€€€€€€€€€€Á•ÉÍ¥ÍÑ•¹”è(€€€€€€€€€€€€€€€Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€ü€‰Á•¹‘¥¹œˆ(€€€€€€€€€€€€€€€€€€€€è¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤°(€€€€€€€€€€€½¹¹•Ñ¥½¹AÉ•Í•¹Ñ…Ñ¥½¸è(€€€€€€€€€€€€€€€Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€ü€‰¥¹¥Ñ¥…°ˆ(€€€€€€€€€€€€€€€€€€€€è€‰Í•ÑÑ±•ˆ°(€€€€€€€€€€€½¹¹•Ñ¥½¹MÑ…ÑÕÍQ½­•¸è(€€€€€€€€€€€€€€€€¬­¹Õµ‰•ÉA…‘½¹¹•Ñ¥½¹M•ÅÕ•¹”°(€€€€€€€€€€€ÑÉ¥Á•™…Õ±ÑÌ°(€€€€€€€€€€€ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´è(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€É½±”è¹½Éµ…±¥é•‘I½±”°(€€€€€€€€€€€Ý½É­™±½Üè(€€€€€€€€€€€€€€€Ý½É­™±½Üñð(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€èÑÉ¥Á%Í1¥Ù” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰•‘¥ÐµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è¹Õ±°(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€…¹•±Q…É•Ð°(€€€€€€€€€€€½¹™¥ÉµQ…É•Ð°(€€€€€€€€€€€‰…­Q…É•Ð°(€€€€€€€€€€€•Ù•É‘¥Ñ•è™…±Í”°(€€€€€€€€€€€…±±½ÝµÁÑäè(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€…±±½ÝµÁÑä(€€€€€€€€€€€€€€€€¤(€€€€€€€ôì((€€€€€€€¥˜€ (€€€€€€€€€€€Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ€˜˜(€€€€€€€€€€€ÍÑ…Ñ”¹Á•ÉÍ¥ÍÑ•¹”€ôôô€‰Á•¹‘¥¹œˆ(€€€€€€€€¤ì(€€€€€€€€€€€ÍÑ…Ñ”¹½¹¹•Ñ¥½¹¹¥µ…Ñ¥½¹MÑ…ÉÑ•‘Ð€ô(€€€€€€€€€€€€€€€Á•É™½Éµ…¹”¹¹½Ü ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í½±Ù•Y…±Õ•‘¥Ñ½É%¹ÁÕÑ5½‘” (€€€€€€€¥¹ÁÕÑ5½‘”(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€¥¹ÁÕÑ5½‘”€ôôô€‰Ù½¥”ˆñð(€€€€€€€€€€€¥¹ÁÕÑ5½‘”€ôôô€‰Ñ½Õ ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸¥¹ÁÕÑ5½‘”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€ü€‰Ù½¥”ˆ(€€€€€€€€€€€€€€€€è€‰Ñ½Õ ˆì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹Q½Õ¡Y…±Õ•‘¥Ñ½È (€€€€€€€ÍÑ…Ñ”°(€€€€€€€ì(€€€€€€€€€€€ÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”°(€€€€€€€€€€€‘ÕÉ…Ñ¥½¸€ô€ÈÔÀ°(€€€€€€€€€€€Í¥¹…°(€€€€€€€ô€ôíô(€€€€¤ì(€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€…Ý…¥Ð•¹ÍÕÉ•9Õµ‰•ÉA…‘1½…‘• ¤ì((€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”€ôÍÑ…Ñ”ì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€€€€€µ…¥¹5•¹Ôü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘¥…±½œ¹½Á•¸¤ì(€€€€€€€€€€€½Á•¹¥…±½±•µ•¹Ð¡¹Õµ‰•ÉA…‘¥…±½œ°ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸°(€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÈµÁ…è‘íÍÑ…Ñ”¹Í½ÕÉ•õ€(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%ÍY¥Í¥‰±” ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÁÉ½µ½Ñ•QÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ ¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬ (€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€ü¹ÁÉ½µ½Ñ•Q½Á1…å•Èü¸ ¤(€€€€€€€€¤ì((€€€€€€€ÍÑ…ÉÑ9Õµ‰•ÉA…‘µ‰¥•¹ÑQ½¹” ¤ì((€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ¤ì(€€€€€€€€€€€Ù½¥Í•ÑÑ±•%¹¥Ñ¥…±9Õµ‰•ÉA…‘½¹¹•Ñ¥½¸ (€€€€€€€€€€€€€€€ÍÑ…Ñ”°(€€€€€€€€€€€€€€€ÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”€üü(€€€€€€€€€€€€€€€€€€€AÉ½µ¥Í”¹É•Í½±Ù” ¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹Y…±Õ•‘¥Ñ½È (€€€€€€€½ÁÑ¥½¹Ì€ôíô°(€€€€€€€¥¹ÁÕÑ5½‘”(€€€€¤ì(€€€€€€€¥˜€¡½ÁÑ¥½¹Ì¹Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€É•…Ñ•9Õµ‰•ÉA…‘MÑ…Ñ” (€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐµ½‘”€ô(€€€€€€€€€€€É•Í½±Ù•Y…±Õ•‘¥Ñ½É%¹ÁÕÑ5½‘” (€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡µ½‘”€ôôô€‰Ù½¥”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸½Á•¹Y½¥•Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€€€€€ÍÑ…Ñ”°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€Í¥¹…°è(€€€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì¹Í¥¹…°(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸½Á•¹Q½Õ¡Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€ÍÑ…Ñ”°(€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹9Õµ‰•ÉA… (€€€€€€€½ÁÑ¥½¹Ì€ôíô(€€€€¤ì(€€€€€€€É•ÑÕÉ¸½Á•¹Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉå½Áå½É5½‘”¡µ½‘”¤ì(€€€€€€€¥˜€¡µ½‘”€ôôô€‰Á•É•¹Ðˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ÁÉ½µÁÐè€‰M…äA•É•¹Ðˆ°(€€€€€€€€€€€€€€€•á…µÁ±”è€‰á…µÁ±”èƒŠq•¥¡Ñäµ™¥Ù”Á•É•¹ÓŠtˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡µ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ÁÉ½µÁÐè€‰M…äQ¥µ”ˆ°(€€€€€€€€€€€€€€€•á…µÁ±”è€‰á…µÁ±”èƒŠq•¥¡ÐÑ¡¥ÉÑä7Štˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ÁÉ½µÁÐè€‰M…äÕÉ…Ñ¥½¸ˆ°(€€€€€€€€€€€•á…µÁ±”è€‰á…µÁ±”èƒŠq™¥Ù”µ¥¹ÕÑ•ÏŠtˆ(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉå•ÍÉ¥ÁÑ½È (€€€€€€€ÍÑ…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€¤ì(€€€€€€€¥˜€ …ÍÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô((€€€€€€€½¹ÍÐÍ½ÕÉ”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Í½ÕÉ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Ñ¥Ñ±”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´ñð(€€€€€€€€€€€Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰MÑ…¹‘…ÉQ¥µ”ˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰ÑÉ¥Àµ½…°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰QÉ¥ÀA•É•¹Ð½…°ˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰Ñ½Ñ…°µ½…°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬(€€€€€€€€€€€€€€€€ˆA•É•¹Ð½…°ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€Í½ÕÉ”€ôôô€‰•¹µÑ¥µ”µ½…°ˆñð(€€€€€€€€€€€Í½ÕÉ”€ôôô€‰•¹µÑ¥µ”ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰¹Q¥µ”ˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰É•…Ñ¥½¸Q¥µ”ˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰M¡•‘Õ±•MÑ…ÉÐˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰…ÑÕ…°µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰ÑÕ…°MÑ…ÉÐˆì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰MÑ…¹‘…ÉQ¥µ”ˆì(€€€€€€€ô((€€€€€€€¥˜€¡ÍÑ…Ñ”¹µ½‘”€ôôô€‰Á•É•¹Ðˆ¤ì(€€€€€€€€€€€¥˜€ ½Á•É•¹Ð½¤¹Ñ•ÍÐ¡Ñ¥Ñ±”¤¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ¥Ñ±”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ ½½…°½¤¹Ñ•ÍÐ¡Ñ¥Ñ±”¤¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ¥Ñ±”¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€½½…°½¤°(€€€€€€€€€€€€€€€€€€€€‰A•É•¹Ð½…°ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€Ñ¥Ñ±”(€€€€€€€€€€€€€€€€€€€€üÑ¥Ñ±”€¬€ˆA•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€è€‰A•É•¹Ðˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€Ñ¥Ñ±”ñð(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€ÍÑ…Ñ”¹µ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€€€€€ü€‰Q¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€è€‰ÕÉ…Ñ¥½¸ˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉåAÉ½µÁÑ½ÉMÑ…Ñ” (€€€€€€€ÍÑ…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€¤ì(€€€€€€€½¹ÍÐ‘•ÍÉ¥ÁÑ½È€ô(€€€€€€€€€€€Ù½¥•¹ÑÉå•ÍÉ¥ÁÑ½È (€€€€€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸‘•ÍÉ¥ÁÑ½È(€€€€€€€€€€€€ü€‰M…ä€ˆ€¬‘•ÍÉ¥ÁÑ½È(€€€€€€€€€€€€èÙ½¥•¹ÑÉå½Áå½É5½‘” (€€€€€€€€€€€€€€€ÍÑ…Ñ”ü¹µ½‘”(€€€€€€€€€€€€¤¹ÁÉ½µÁÐì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉå%¹Ù…±¥‘AÉ½µÁÐ (€€€€€€€ÍÑ…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€¤ì(€€€€€€€½¹ÍÐ‘•ÍÉ¥ÁÑ½È€ô(€€€€€€€€€€€Ù½¥•¹ÑÉå•ÍÉ¥ÁÑ½È (€€€€€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸‘•ÍÉ¥ÁÑ½È(€€€€€€€€€€€€ü€‰M…ä„Y…±¥€ˆ€¬(€€€€€€€€€€€€€€€‘•ÍÉ¥ÁÑ½È(€€€€€€€€€€€€è€‰M…ä„Y…±¥Y…±Õ”ˆì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉåÑ¥½¹½Áä (€€€€€€€ÍÑ…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÑ…Ñ”ü¹Ñ¥Ñ±”ñð(€€€€€€€€€€€€€€€€‰Ù…±Õ”ˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤ñð(€€€€€€€€€€€€‰Ù…±Õ”ˆì(€€€€€€€½¹ÍÐÍ½ÕÉ”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÑ…Ñ”ü¹Í½ÕÉ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡ÍÑ…Ñ”ü¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰ÍÑ…ÉÐÑ¡”ÑÉ¥Àˆ°(€€€€€€€€€€€€€€€…¹•°è€‰…¹•°Ñ¡”¹•ÜÑÉ¥Àˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰ÑÉ¥Àµ½…°ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”QÉ¥À½…°ˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹ÐQÉ¥À½…°ˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰Ñ½Ñ…°µ½…°ˆ¤ì(€€€€€€€€€€€½¹ÍÐÍ½Á•1…‰•°€ô(€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è(€€€€€€€€€€€€€€€€€€€Í•ÐÑ¡”€‘íÍ½Á•1…‰•±ô½…±€°(€€€€€€€€€€€€€€€…¹•°è(€€€€€€€€€€€€€€€€€€€­••ÀÑ¡”ÕÉÉ•¹Ð€‘íÍ½Á•1…‰•±ô½…±€(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€Í½ÕÉ”€ôôô€‰•¹µÑ¥µ”µ½…°ˆñð(€€€€€€€€€€€Í½ÕÉ”€ôôô€‰•¹µÑ¥µ”ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”¹Q¥µ”ˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹Ð¹Q¥µ”ˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”É•…Ñ¥½¸Q¥µ”ˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹ÐÉ•…Ñ¥½¸Q¥µ”ˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”M¡•‘Õ±•MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹ÐM¡•‘Õ±•MÑ…ÉÐˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰…ÑÕ…°µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”ÑÕ…°MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹ÐÑÕ…°MÑ…ÉÐˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡Í½ÕÉ”€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è€‰Í•ÐÑ¡”MÑ…¹‘…ÉQ¥µ”ˆ°(€€€€€€€€€€€€€€€…¹•°è€‰­••ÀÑ¡”ÕÉÉ•¹ÐMÑ…¹‘…ÉQ¥µ”ˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”ü¹É½±”€ôôô(€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è(€€€€€€€€€€€€€€€€€€€Í•Ð€‘íÑ¥Ñ±•õ€°(€€€€€€€€€€€€€€€…¹•°è(€€€€€€€€€€€€€€€€€€€­••ÀÑ¡”ÕÉÉ•¹Ð€‘íÑ¥Ñ±•õ€(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€¡ÍÑ…Ñ”ü¹½¹½¹™¥É´¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€½¬è(€€€€€€€€€€€€€€€€€€€…ÁÁ±ä€‘íÑ¥Ñ±•õ€°(€€€€€€€€€€€€€€€…¹•°è(€€€€€€€€€€€€€€€€€€€€‰¼‰…¬Ý¥Ñ¡½ÕÐ¡…¹•Ìˆ(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€½¬è(€€€€€€€€€€€€€€€Í…Ù”€‘íÑ¥Ñ±•õ€°(€€€€€€€€€€€…¹•°è(€€€€€€€€€€€€€€€€‰¼‰…¬Ý¥Ñ¡½ÕÐ¡…¹•Ìˆ(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸ÁÕ±Í•Y½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì ¤ì(€€€€€€€¥˜€ …Ù½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€Ù½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì(€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰¥Ìµ…ÑÑ•¹Ñ¥½¸ˆ(€€€€€€€€€€€€¤ì((€€€€€€€Ù½¥Ù½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì(€€€€€€€€€€€€¹½™™Í•Ñ]¥‘Ñ ì((€€€€€€€Ù½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì(€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹…‘ (€€€€€€€€€€€€€€€€‰¥Ìµ…ÑÑ•¹Ñ¥½¸ˆ(€€€€€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉå%ÍY¥Í¥‰±” ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÕÉ™…”ñð(€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”¹¡¥‘‘•¸(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€ÑÉäì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€¹µ…Ñ¡•Ì (€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€¹¡…ÍÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€€€€€‰Á½Á½Ù•Èˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€É•ÑÕÉ¸€…Ù½¥•¹ÑÉåMÕÉ™…”¹¡¥‘‘•¸ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸¹Õµ‰•ÉA…‘%ÍY¥Í¥‰±” ¤ì(€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€ü¹½Á•¸€˜˜(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€¹½¹Ñ…¥¹Ì (€€€€€€€€€€€€€€€€€€€€‰‘¥…±½œµ±½Í¥¹œˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%ÍY¥Í¥‰±” ¤ì(€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä€˜˜(€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä¹¡¥‘‘•¸€˜˜(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€¹½¹Ñ…¥¹Ì (€€€€€€€€€€€€€€€€€€€€‰¥ÌµÙ¥Í¥‰±”ˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í•ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ ¤ì(€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€ü¹ÍÑå±”(€€€€€€€€€€€€¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÙ½¥”µ•¹ÑÉäµÍÕµµ…ÉäµÍ¡¥™Ðµäˆ(€€€€€€€€€€€€¤ì((€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€ü¹ÍÑå±”(€€€€€€€€€€€€¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µ¹Õµ‰•ÈµÁ…µÍÕµµ…ÉäµÍ¡¥™Ðµäˆ(€€€€€€€€€€€€¤ì(€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€ü¹ÍÑå±”(€€€€€€€€€€€€¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µ¹Õµ‰•ÈµÁ…µÍÕµµ…ÉäµÍ…±”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€ü¹ÍÑå±”(€€€€€€€€€€€€¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µÍÕµµ…ÉäµÍ¡¥™Ðµäˆ(€€€€€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€ü¹ÍÑå±”(€€€€€€€€€€€€¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µÍÕµµ…Éäµµ…àµ¡•¥¡Ðˆ(€€€€€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€ü¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€‰¡…ÌµÙ½¥”µ•¹ÑÉäˆ°(€€€€€€€€€€€€€€€€‰¡…Ìµ¹Õµ‰•ÈµÁ…ˆ(€€€€€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÁÉ½µ½Ñ•QÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%ÍY¥Í¥‰±” ¤ñð(€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€ü¹¡…ÍÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰Á½Á½Ù•Èˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€ÑÉäì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹µ…Ñ¡•Ì (€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹¡¥‘•A½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä¹¡¥‘‘•¸€ô(€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€¹Í¡½ÝA½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€…Ñ¥Ù”€ô(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%ÍY¥Í¥‰±” ¤(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…äñð(€€€€€€€€€€€€……Ñ¥Ù”(€€€€€€€€¤ì(€€€€€€€€€€€É•Í•ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÙ½¥•Y¥Í¥‰±”€ô(€€€€€€€€€€€Ù½¥•¹ÑÉå%ÍY¥Í¥‰±” ¤ì(€€€€€€€½¹ÍÐ¹Õµ‰•ÉA…‘Y¥Í¥‰±”€ô(€€€€€€€€€€€€…Ù½¥•Y¥Í¥‰±”€˜˜(€€€€€€€€€€€¹Õµ‰•ÉA…‘%ÍY¥Í¥‰±” ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù½¥•Y¥Í¥‰±”€˜˜(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘Y¥Í¥‰±”(€€€€€€€€¤ì(€€€€€€€€€€€É•Í•ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€Ù½¥•Y¥Í¥‰±”(€€€€€€€€€€€€€€€€ü€‰Ù½¥”ˆ(€€€€€€€€€€€€€€€€è€‰¹Õµ‰•ÈµÁ…ˆì(€€€€€€€½¹ÍÐ•‘¥Ñ½È€ô(€€€€€€€€€€€Ù½¥•Y¥Í¥‰±”(€€€€€€€€€€€€€€€€üÙ½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€è¹Õµ‰•ÉA…‘¥…±½œì(€€€€€€€½¹ÍÐÙ¥•ÝÁ½ÉÑ!•¥¡Ð€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹Ù¥ÍÕ…±Y¥•ÝÁ½ÉÐ(€€€€€€€€€€€€€€€€€€€€€€€€ü¹¡•¥¡Ð(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹¥¹¹•É!•¥¡Ðñð(€€€€€€€€€€€€€€€‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€¹‘½Õµ•¹Ñ±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€¹±¥•¹Ñ!•¥¡Ðñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÁ…¹•°€ô(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€ˆ¹ÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µ½Ù•É±…äµÁ…¹•°ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ•‘¥Ñ½É!•¥¡Ð€ô(€€€€€€€€€€€5…Ñ ¹•¥° (€€€€€€€€€€€€€€€•‘¥Ñ½Èü¹½™™Í•Ñ!•¥¡Ðñð(€€€€€€€€€€€€€€€•‘¥Ñ½È(€€€€€€€€€€€€€€€€€€€€ü¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤(€€€€€€€€€€€€€€€€€€€€¹¡•¥¡Ðñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ¹…ÑÕÉ…±MÕµµ…Éå!•¥¡Ð€ô(€€€€€€€€€€€5…Ñ ¹•¥° (€€€€€€€€€€€€€€€Á…¹•°ü¹ÍÉ½±±!•¥¡Ðñð(€€€€€€€€€€€€€€€Á…¹•°ü¹½™™Í•Ñ!•¥¡Ðñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ…À€ô(€€€€€€€€€€€ÑåÁ”€ôôô€‰¹Õµ‰•ÈµÁ…ˆ(€€€€€€€€€€€€€€€€ü€ÄÈ(€€€€€€€€€€€€€€€€è€ÄØì((€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù¥•ÝÁ½ÉÑ!•¥¡Ðñð(€€€€€€€€€€€€…•‘¥Ñ½É!•¥¡Ðñð(€€€€€€€€€€€€…¹…ÑÕÉ…±MÕµµ…Éå!•¥¡Ð(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€±•Ð•‘¥Ñ½ÉM…±”€ô(€€€€€€€€€€€€Äì(€€€€€€€±•Ðµ…áMÕµµ…Éå!•¥¡Ðì((€€€€€€€¥˜€¡ÑåÁ”€ôôô€‰¹Õµ‰•ÈµÁ…ˆ¤ì(€€€€€€€€€€€½¹ÍÐÁÉ•™•ÉÉ•‘MÕµµ…Éå!•¥¡Ð€ô(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€¹…ÑÕÉ…±MÕµµ…Éå!•¥¡Ð°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€ÜÈ°(€€€€€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€¨(€€€€€€€€€€€€€€€€€€€€€€€€€€€€À¸ÈØ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ•‘¥Ñ½ÉI½½´€ô(€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•ÉÉ•‘MÕµµ…Éå!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€…À€¨€Ì(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€•‘¥Ñ½ÉM…±”€ô(€€€€€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À¸Ð°(€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½ÉI½½´€¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É!•¥¡Ð(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÍ…±•‘‘¥Ñ½É!•¥¡Ð€ô(€€€€€€€€€€€€€€€•‘¥Ñ½É!•¥¡Ð€¨(€€€€€€€€€€€€€€€•‘¥Ñ½ÉM…±”ì((€€€€€€€€€€€µ…áMÕµµ…Éå!•¥¡Ð€ô(€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€ØÐ°(€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€Í…±•‘‘¥Ñ½É!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€…À€¨€Ì(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€µ…áMÕµµ…Éå!•¥¡Ð€ô(€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€äØ°(€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€€€€€…À€¨€Ì(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÕµµ…Éå!•¥¡Ð€ô(€€€€€€€€€€€5…Ñ ¹µ¥¸ (€€€€€€€€€€€€€€€¹…ÑÕÉ…±MÕµµ…Éå!•¥¡Ð°(€€€€€€€€€€€€€€€µ…áMÕµµ…Éå!•¥¡Ð(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍ…±•‘‘¥Ñ½É!•¥¡Ð€ô(€€€€€€€€€€€•‘¥Ñ½É!•¥¡Ð€¨(€€€€€€€€€€€•‘¥Ñ½ÉM…±”ì(€€€€€€€½¹ÍÐÍÑ…­!•¥¡Ð€ô(€€€€€€€€€€€ÍÕµµ…Éå!•¥¡Ð€¬(€€€€€€€€€€€…À€¬(€€€€€€€€€€€Í…±•‘‘¥Ñ½É!•¥¡Ðì(€€€€€€€½¹ÍÐÍÑ…­Q½À€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€…À°(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€´(€€€€€€€€€€€€€€€€€€€ÍÑ…­!•¥¡Ð(€€€€€€€€€€€€€€€€¤€¼(€€€€€€€€€€€€€€€€€€€€È(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÙ¥•ÝÁ½ÉÑ•¹Ñ•È€ô(€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ!•¥¡Ð€¼(€€€€€€€€€€€€Èì(€€€€€€€½¹ÍÐÍÕµµ…Éå•¹Ñ•È€ô(€€€€€€€€€€€ÍÑ…­Q½À€¬(€€€€€€€€€€€ÍÕµµ…Éå!•¥¡Ð€¼(€€€€€€€€€€€€€€€€Èì(€€€€€€€½¹ÍÐ•‘¥Ñ½É•¹Ñ•È€ô(€€€€€€€€€€€ÍÑ…­Q½À€¬(€€€€€€€€€€€ÍÕµµ…Éå!•¥¡Ð€¬(€€€€€€€€€€€…À€¬(€€€€€€€€€€€Í…±•‘‘¥Ñ½É!•¥¡Ð€¼(€€€€€€€€€€€€€€€€Èì((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹Ñ½±” (€€€€€€€€€€€€€€€€‰¡…ÌµÙ½¥”µ•¹ÑÉäˆ°(€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰Ù½¥”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹Ñ½±” (€€€€€€€€€€€€€€€€‰¡…Ìµ¹Õµ‰•ÈµÁ…ˆ°(€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰¹Õµ‰•ÈµÁ…ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€¹ÍÑå±”(€€€€€€€€€€€€¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µÍÕµµ…Éäµµ…àµ¡•¥¡Ðˆ°(€€€€€€€€€€€€€€€€‘í5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€µ…áMÕµµ…Éå!•¥¡Ð(€€€€€€€€€€€€€€€€¥õÁá€(€€€€€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€¹ÍÑå±”(€€€€€€€€€€€€¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µÍÕµµ…ÉäµÍ¡¥™Ðµäˆ°(€€€€€€€€€€€€€€€€‘í5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éå•¹Ñ•È€´(€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ•¹Ñ•È(€€€€€€€€€€€€€€€€¥õÁá€(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡ÑåÁ”€ôôô€‰Ù½¥”ˆ¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€¹ÍÑå±”(€€€€€€€€€€€€€€€€¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€€€€€ˆ´µÙ½¥”µ•¹ÑÉäµÍÕµµ…ÉäµÍ¡¥™Ðµäˆ°(€€€€€€€€€€€€€€€€€€€€‘í5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É•¹Ñ•È€´(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ•¹Ñ•È(€€€€€€€€€€€€€€€€€€€€¥õÁá€(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€¹ÍÑå±”(€€€€€€€€€€€€€€€€¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€€€€€ˆ´µ¹Õµ‰•ÈµÁ…µÍÕµµ…ÉäµÍ¡¥™Ðµäˆ°(€€€€€€€€€€€€€€€€€€€€‘í5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É•¹Ñ•È€´(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù¥•ÝÁ½ÉÑ•¹Ñ•È(€€€€€€€€€€€€€€€€€€€€¥õÁá€(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€¹ÍÑå±”(€€€€€€€€€€€€€€€€¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€€€€€ˆ´µ¹Õµ‰•ÈµÁ…µÍÕµµ…ÉäµÍ…±”ˆ°(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½ÉM…±”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€ÁÉ½µÁÐ°(€€€€€€€•á…µÁ±”°(€€€€€€€Ù…±Õ”°(€€€€€€€…ÑÑ•¹Ñ¥½¸€ô™…±Í”(€€€ô€ôíô¤ì(€€€€€€€¥˜€ …Ù½¥•¹ÑÉåMÕÉ™…”¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€Ù½¥•¹ÑÉåQ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€Ù½¥•¹ÑÉå•ÍÉ¥ÁÑ½È (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€¤ñð(€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”ü¹Ñ¥Ñ±”ñð(€€€€€€€€€€€€‰Y½¥”¹ÑÉäˆì((€€€€€€€½¹ÍÐ½Áä€ô(€€€€€€€€€€€Ù½¥•¹ÑÉå½Áå½É5½‘” (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”ü¹µ½‘”(€€€€€€€€€€€€¤ì((€€€€€€€Ù½¥•¹ÑÉåAÉ½µÁÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€ÁÉ½µÁÐñð(€€€€€€€€€€€Ù½¥•¹ÑÉåAÉ½µÁÑ½ÉMÑ…Ñ” (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€¤ñð(€€€€€€€€€€€½Áä¹ÁÉ½µÁÐì(€€€€€€€Ù½¥•¹ÑÉåá…µÁ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€•á…µÁ±”ñð(€€€€€€€€€€€½Áä¹•á…µÁ±”ì((€€€€€€€½¹ÍÐ…Ñ¥½¹½Áä€ô(€€€€€€€€€€€Ù½¥•¹ÑÉåÑ¥½¹½Áä ¤ì((€€€€€€€¥˜€¡Ù½¥•¹ÑÉå=­Ñ¥½¸¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉå=­Ñ¥½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€…Ñ¥½¹½Áä¹½¬ì(€€€€€€€ô((€€€€€€€¥˜€¡Ù½¥•¹ÑÉå…¹•±Ñ¥½¸¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉå…¹•±Ñ¥½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€…Ñ¥½¹½Áä¹…¹•°ì(€€€€€€€ô((€€€€€€€Ù½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì(€€€€€€€€€€€€ü¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€¹Ñ½±” (€€€€€€€€€€€€€€€€‰¥ÌµÉ•…‘äˆ°(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡…ÑÑ•¹Ñ¥½¸¤ì(€€€€€€€€€€€ÁÕ±Í•Y½¥•¹ÑÉå%¹ÍÑÉÕÑ¥½¹Ì ¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¡…ÍY…±Õ”€ô(€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ”€ôôô€‰ÍÑÉ¥¹œˆ€˜˜(€€€€€€€€€€€Ù…±Õ”¹ÑÉ¥´ ¤ì((€€€€€€€Ù½¥•¹ÑÉåY…±Õ”¹¡¥‘‘•¸€ô(€€€€€€€€€€€€…¡…ÍY…±Õ”ì(€€€€€€€Ù½¥•¹ÑÉåY…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¡…ÍY…±Õ”(€€€€€€€€€€€€€€€€üÙ…±Õ”(€€€€€€€€€€€€€€€€è€ˆˆì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹¹½Õ¹•Y½¥•¹ÑÉåAÉ½µÁÐ ¤ì(€€€€€€€½¹ÍÐÁÉ½µÁÐ€ô(€€€€€€€€€€€Ù½¥•¹ÑÉåAÉ½µÁÑ½ÉMÑ…Ñ” (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ …ÁÉ½µÁÐ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼(€€€€€€€€€€€€€€€€ü¹ÍÁ•…¬ü¸ (€€€€€€€€€€€€€€€€€€€ÁÉ½µÁÐ(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÁ•…­Y½¥•¹ÑÉå••‘‰…¬ (€€€€€€€ÍÁ½­•¹Y…±Õ”°(€€€€€€€…Ñ¥½¸°(€€€€€€€Í•ÅÕ•¹”(€€€€¤ì(€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ½­Ñ¥½¸€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€…Ñ¥½¸ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤ì(€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì¹]5=Õ‘¥¼ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù…±Õ”ñð(€€€€€€€€€€€€…½­Ñ¥½¸ñð(€€€€€€€€€€€€……Õ‘¥¼ü¹ÍÁ•…¬(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€…Õ‘¥¼¹ÍÁ•…¬ (€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€½¹¹è(€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÅÕ•¹”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉå••‘‰…­M•ÅÕ•¹”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼¹ÍÁ•…¬ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰M…ä=,Ñ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½­Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÈÈÀ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¡¥‘•Y½¥•¹ÑÉåMÕÉ™…” ¤ì(€€€€€€€Ù½¥•¹ÑÉå••‘‰…­M•ÅÕ•¹”¬¬ì((€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€€€€€™…±Í”(€€€€€€€€¤ì((€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€Ù½¥•¹ÑÉå•ÁÑQ¥µ•È(€€€€€€€€¤ì(€€€€€€€Ù½¥•¹ÑÉå•ÁÑQ¥µ•È€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€ÑÉäì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€ü¹µ…Ñ¡•Ìü¸ (€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€¹¡¥‘•A½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€…Ñ íô((€€€€€€€¥˜€¡Ù½¥•¹ÑÉåMÕÉ™…”¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”¹¡¥‘‘•¸€ô(€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€¤ì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåá•ÕÑ¥½¹	•™½É•=Á•¸€„ôô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€¹•á•ÕÑ¥½¹¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåá•ÕÑ¥½¹	•™½É•=Á•¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMåÍÑ•µá•ÕÑ¥½¹	•™½É•=Á•¸€„ôô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€¹ÍåÍÑ•µá•ÕÑ¥½¹A…ÍÍÑ¡É½Õ €ô(€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMåÍÑ•µá•ÕÑ¥½¹	•™½É•=Á•¸ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€Ù½¥•¹ÑÉåá•ÕÑ¥½¹	•™½É•=Á•¸€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€Ù½¥•¹ÑÉåMåÍÑ•µá•ÕÑ¥½¹	•™½É•=Á•¸€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€Ù½¥•¹ÑÉå!…¹‘±•‘UÑÑ•É…¹•%€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€Ù½¥•¹ÑÉåMÑ…Ñ”€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€…¹•°€ô™…±Í”°(€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸(€€€ô€ôíô¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”ì((€€€€€€€¡¥‘•Y½¥•¹ÑÉåMÕÉ™…” ¤ì((€€€€€€€½¹ÍÐ±½Í•€ô(€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸€üü(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÍÑ…Ñ”¹…¹•±Q…É•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÍÑ…Ñ”¹½¹™¥ÉµQ…É•Ð(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€…¹•°°(€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€ô¤ì((€€€€€€€É•Í•Ñ9Õµ‰•ÉA… ¤ì((€€€€€€€É•ÑÕÉ¸±½Í•ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÍÝ¥Ñ¡9Õµ‰•ÉA…‘Q½Y½¥” ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€ü¹½Á•¸(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ôì(€€€€€€€€€€€€¸¸¹¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€ôì((€€€€€€€ÍÑ½Á±±9Õµ‰•ÉA…‘Õ‘¥¼ ¤ì((€€€€€€€ÁÉ•Í•ÉÙ•9Õµ‰•ÉA…‘MÑ…Ñ•=¹±½Í”€ô(€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…±½Í•¥…±½œ (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€‰¹Õµ‰•ÈµÁ…µÍÝ¥Ñ µÙ½¥”ˆ°(€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€ÁÉ•Í•ÉÙ•9Õµ‰•ÉA…‘MÑ…Ñ•=¹±½Í”€ô(€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸½Á•¹Y½¥•Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€Í¹…ÁÍ¡½Ð(€€€€€€€€¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÍÝ¥Ñ¡Y½¥•¹ÑÉåQ½Q½Õ  ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ôì(€€€€€€€€€€€€¸¸¹¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€ôì((€€€€€€€¡¥‘•Y½¥•¹ÑÉåMÕÉ™…” ¤ì((€€€€€€€…Ý…¥ÐÉ•ÍÑ½É•9Õµ‰•ÉA…‘MÑ…Ñ” (€€€€€€€€€€€Í¹…ÁÍ¡½Ð°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è€À(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸Á…ÉÍ•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ (€€€€€€€ÑÉ…¹ÍÉ¥ÁÐ°(€€€€€€€ì(€€€€€€€€€€€Í¥¹…°(€€€€€€€ô€ôíô(€€€€¤ì(€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÑ•áÐ€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÑÉ…¹ÍÉ¥ÁÐñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€¥˜€ …Ñ•áÐ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½µµ…¹€ô(€€€€€€€€€€€Ñ•áÐ¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€½x üé…¹•±ñ±½Í”¤¼(€€€€€€€€€€€€€€€€¹Ñ•ÍÐ¡½µµ…¹¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€…¹•°èÑÉÕ”(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€€½x üéÑ½Õ¡ñ­•åÁ…‘ñ¹Õµ‰•ÈÁ…¤¼(€€€€€€€€€€€€€€€€¹Ñ•ÍÐ¡½µµ…¹¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÍÝ¥Ñ¡Y½¥•¹ÑÉåQ½Q½Õ  ¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Í½ÕÉ”€ôôô(€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆ(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÉ•…‘åÑ5…Ñ €ô(€€€€€€€€€€€€€€€½µµ…¹¹µ…Ñ  (€€€€€€€€€€€€€€€€€€€€½y…ÑqÌ¬ ¸¬¤¼(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡É•…‘åÑ5…Ñ ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍÁ½­•¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€É•…‘åÑ5…Ñ¡lÅtì((€€€€€€€€€€€€€€€¡¥‘•Y½¥•¹ÑÉåMÕÉ™…” ¤ì(€€€€€€€€€€€€€€€É•Í•Ñ9Õµ‰•ÉA… ¤ì((€€€€€€€€€€€€€€€Ù½¥AÉ½µ¥Í”(€€€€€€€€€€€€€€€€€€€€¹É•Í½±Ù” (€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•MÑ…ÉÑÐ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™É½µI•…‘å½¹Ñ¥¹Õ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€½µµ…¹€ôôô(€€€€€€€€€€€€€€€€€€€€‰‘•™•ÈÑÉ¥Àˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ù½¥…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹‘•™•ÉQÉ¥À ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€€½x üé½­ñ½­…ä¤¼(€€€€€€€€€€€€€€€€¹Ñ•ÍÐ¡½µµ…¹¤(€€€€€€€€¤ì(€€€€€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤¤ì(€€€€€€€€€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉå%¹Ù…±¥‘AÉ½µÁÐ ¤(€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸€¡…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€……Ý…¥Ð½µµ¥Ñ9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€…¹•°è™…±Í”(€€€€€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€…Í¥¹…°ü¹…‰½ÉÑ•ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€¥˜€ …Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰M…ä„Y…±¥Y…±Õ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ ¤ì(€€€€€€€ô((€€€€€€€±•Ð‘¥ÍÁ±…äì(€€€€€€€±•ÐÍÁ½­•¹••‘‰…¬€ô(€€€€€€€€€€€Ñ•áÐì((€€€€€€€¥˜€ (€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Ñ•áÐ°(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í%¹Ñ••È (€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€Á•É•¹Ð€ðô€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€‘¥ÍÁ±…ä€ô(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€¬(€€€€€€€€€€€€€€€€ˆ”ˆì(€€€€€€€ô(€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÁ…ÉÑÌ€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Ñ•áÐ°(€€€€€€€€€€€€€€€€€€€€€€€€‰±½¬µÁ…ÉÑÌˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ …Á…ÉÑÌ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€±•Ðµ•É¥‘¥•´€ô(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¹µ•É¥‘¥•´ì((€€€€€€€€€€€¥˜€¡Á…ÉÑÌ¹µ•É¥‘¥•´¤ì(€€€€€€€€€€€€€€€µ•É¥‘¥•´€ô(€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹µ•É¥‘¥•´(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½UÁÁ•É…Í” ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€Á…ÉÑÌ¹¡½ÕÈ€ø€ÄÈ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€µ•É¥‘¥•´€ô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ¡½ÕÈ€ô(€€€€€€€€€€€€€€€µ•É¥‘¥•´€˜˜(€€€€€€€€€€€€€€€Á…ÉÑÌ¹¡½ÕÈ€ø€ÄÈ(€€€€€€€€€€€€€€€€€€€€ü€ (€€€€€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹¡½ÕÈ€”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÄÈñð(€€€€€€€€€€€€€€€€€€€€€€€€ÄÈ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€èÁ…ÉÑÌ¹¡½ÕÈì((€€€€€€€€€€€½¹ÍÐÁ•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€…‰Í½±ÕÑ•¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€¡½ÕÈ°(€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹µ¥¹ÕÑ”°(€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€……‰Í½±ÕÑ•¥¥ÑÍY…±¥ (€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹œ°(€€€€€€€€€€€€€€€€€€€µ•É¥‘¥•´(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€Á•¹‘¥¹œì(€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ•É¥‘¥•´€ô(€€€€€€€€€€€€€€€µ•É¥‘¥•´ì((€€€€€€€€€€€¥˜€¡Á…ÉÑÌ¹‘…ä¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘…Ñ”€ô(€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹‘…ä€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½µ½ÉÉ½Üˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€‘…Ñ”¹Í•Ñ…Ñ” (€€€€€€€€€€€€€€€€€€€€€€€‘…Ñ”¹•Ñ…Ñ” ¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹…Ñ”€ô(€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ…Ñ•%¹ÁÕÐ (€€€€€€€€€€€€€€€€€€€€€€€‘…Ñ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€‘¥ÍÁ±…ä€ô(€€€€€€€€€€€€€€€É•¹‘•É‰Í½±ÕÑ•¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹µ•É¥‘¥•´(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ•É¥‘¥•´(€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€½¹ÍÐ‘ÕÉ…Ñ¥½¸€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Ñ•áÐ°(€€€€€€€€€€€€€€€€€€€€€€€€‰‘ÕÉ…Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸€ðô€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹Y…±Õ•Q½I…Ý¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…Ñ¥µ•¥¥ÑÍY…±¥ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€‘¥ÍÁ±…ä€ô(€€€€€€€€€€€€€€€É•¹‘•ÉQ¥µ•¥¥ÑÌ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ÍÁ½­•¹••‘‰…¬€ô(€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô(€€€€€€€€€€€™…±Í”ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹•Ù•É‘¥Ñ•€ô(€€€€€€€€€€€¹Õµ‰•ÉA…‘!…Í¡…¹•Ì ¤ì((€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤¤ì(€€€€€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€€€€€€‰M…ä„Y…±¥Y…±Õ”ˆ°(€€€€€€€€€€€€€€€•á…µÁ±”è(€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉå½Áå½É5½‘” (€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”(€€€€€€€€€€€€€€€€€€€€¤¹•á…µÁ±”(€€€€€€€€€€€ô¤ì((€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…Ñ¥½¹½Áä€ô(€€€€€€€€€€€Ù½¥•¹ÑÉåÑ¥½¹½Áä ¤ì(€€€€€€€½¹ÍÐ™••‘‰…­M•ÅÕ•¹”€ô(€€€€€€€€€€€€¬­Ù½¥•¹ÑÉå••‘‰…­M•ÅÕ•¹”ì((€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€Ù½¥•¹ÑÉå•ÁÑQ¥µ•È(€€€€€€€€¤ì((€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€‘¥ÍÁ±…ä°(€€€€€€€€€€€Ù…±Õ”è(€€€€€€€€€€€€€€€‘¥ÍÁ±…ä°(€€€€€€€€€€€…ÑÑ•¹Ñ¥½¸è(€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€ô¤ì((€€€€€€€Ù½¥•¹ÑÉå•ÁÑQ¥µ•È€ô(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€™••‘‰…­M•ÅÕ•¹”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉå••‘‰…­M•ÅÕ•¹”ñð(€€€€€€€€€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰M…ä=,Ñ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¹½Áä¹½¬°(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…ä°(€€€€€€€€€€€€€€€€€€€€€€€…ÑÑ•¹Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€ÌØÀ(€€€€€€€€€€€€¤ì((€€€€€€€ÍÁ•…­Y½¥•¹ÑÉå••‘‰…¬ (€€€€€€€€€€€ÍÁ½­•¹••‘‰…¬°(€€€€€€€€€€€…Ñ¥½¹½Áä¹½¬°(€€€€€€€€€€€™••‘‰…­M•ÅÕ•¹”(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸½Á•¹Y½¥•Y…±Õ•‘¥Ñ½È (€€€€€€€ÍÑ…Ñ”°(€€€€€€€ì(€€€€€€€€€€€Í¥¹…°(€€€€€€€ô€ôíô(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•ñð(€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”€ô(€€€€€€€€€€€ÍÑ…Ñ”ì((€€€€€€€Ù½¥•¹ÑÉåMÑ…Ñ”€ôì(€€€€€€€€€€€Í½ÕÉ”è(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Í½ÕÉ”°(€€€€€€€€€€€½Á•¹•‘Ðè(€€€€€€€€€€€€€€€Á•É™½Éµ…¹”¹¹½Ü ¤(€€€€€€€ôì((€€€€€€€Ù½¥•¹ÑÉå!…¹‘±•‘UÑÑ•É…¹•%€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€¥˜€ (€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉåá•ÕÑ¥½¹	•™½É•=Á•¸€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€¹•á•ÕÑ¥½¹¹…‰±•ì(€€€€€€€€€€€Ù½¥•¹ÑÉåMåÍÑ•µá•ÕÑ¥½¹	•™½É•=Á•¸€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€¹ÍåÍÑ•µá•ÕÑ¥½¹A…ÍÍÑ¡É½Õ ì(€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€¹ÍåÍÑ•µá•ÕÑ¥½¹A…ÍÍÑ¡É½Õ €ô(€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€¹•á•ÕÑ¥½¹¹…‰±•€ô(€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€ô((€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€…ÑÑ•¹Ñ¥½¸è(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤(€€€€€€€ô¤ì((€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”¹¡¥‘‘•¸€ô(€€€€€€€€€€€™…±Í”ì((€€€€€€€ÑÉäì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€¹µ…Ñ¡•Ì (€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÕÉ™…”(€€€€€€€€€€€€€€€€€€€€¹Í¡½ÝA½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€…Ñ íô((€€€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬ (€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€ü¹ÁÉ½µ½Ñ•Q½Á1…å•Èü¸ ¤(€€€€€€€€¤ì((€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ ¤ì(€€€€€€€€€€€€€€€…¹¹½Õ¹•Y½¥•¹ÑÉåAÉ½µÁÐ ¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹Y½¥•¹ÑÉä (€€€€€€€½ÁÑ¥½¹Ì€ôíô(€€€€¤ì(€€€€€€€É•ÑÕÉ¸½Á•¹Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€½ÁÑ¥½¹Ì°(€€€€€€€€€€€€‰Ù½¥”ˆ(€€€€€€€€¤ì(€€€ô((€€€Ù½¥•¹ÑÉå…¹•°(€€€€€€€€ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€Ù½¥±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€…¹•°èÑÉÕ”(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€Ù½¥•¹ÑÉåQ½Õ (€€€€€€€€ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€Ù½¥ÍÝ¥Ñ¡Y½¥•¹ÑÉåQ½Q½Õ  ¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€™Õ¹Ñ¥½¸Ù½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑ%ÍMåÍÑ•µ½µµ…¹ (€€€€€€€ÑÉ…¹ÍÉ¥ÁÐ(€€€€¤ì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÑÉ…¹ÍÉ¥ÁÐñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ½1½…±•1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ …¹½Éµ…±¥é•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€ü¹Á¡É…Í•É½ÕÁÌ(€€€€€€€€€€€€€€€€ü¹Í½µ” (€€€€€€€€€€€€€€€€€€€É½ÕÀ€ôø(€€€€€€€€€€€€€€€€€€€€€€€É½ÕÀ¹µ½‘…°€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍåÍÑ•´ˆ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€É½ÕÀ¹Á¡É…Í•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Í½µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½…±•1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Á¥Á•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ (€€€€€€€•Ù•¹Ð(€€€€¤ì(€€€€€€€¥˜€ …Ù½¥•¹ÑÉåMÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‘•Ñ…¥°€ô(€€€€€€€€€€€•Ù•¹Ðü¹‘•Ñ…¥°ñð(€€€€€€€€€€€íôì((€€€€€€€½¹ÍÐÕÑÑ•É…¹•%€ô(€€€€€€€€€€€‘•Ñ…¥°¹¥€üü(€€€€€€€€€€€‘•Ñ…¥°¹ÕÑÑ•É…¹•%ì((€€€€€€€¥˜€ (€€€€€€€€€€€ÕÑÑ•É…¹•%€„ôô(€€€€€€€€€€€€€€€Õ¹‘•™¥¹•€˜˜(€€€€€€€€€€€ÕÑÑ•É…¹•%€ôôô(€€€€€€€€€€€€€€€Ù½¥•¹ÑÉå!…¹‘±•‘UÑÑ•É…¹•%(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐÑÉ…¹ÍÉ¥ÁÐ€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€‘•Ñ…¥°¹ÑÉ…¹ÍÉ¥ÁÐñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤ì((€€€€€€€¥˜€ …ÑÉ…¹ÍÉ¥ÁÐ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€Ù½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑ%ÍMåÍÑ•µ½µµ…¹ (€€€€€€€€€€€€€€€ÑÉ…¹ÍÉ¥ÁÐ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¡…¹‘±•€ô(€€€€€€€€€€€Á…ÉÍ•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ (€€€€€€€€€€€€€€€ÑÉ…¹ÍÉ¥ÁÐ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€ÕÑÑ•É…¹•%€„ôô(€€€€€€€€€€€€€€€Õ¹‘•™¥¹•(€€€€€€€€¤ì(€€€€€€€€€€€Ù½¥•¹ÑÉå!…¹‘±•‘UÑÑ•É…¹•%€ô(€€€€€€€€€€€€€€€ÕÑÑ•É…¹•%ì(€€€€€€€ô((€€€€€€€¥˜€¡¡…¹‘±•¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€É•¹‘•ÉY½¥•¹ÑÉä¡ì(€€€€€€€€€€€ÁÉ½µÁÐè(€€€€€€€€€€€€€€€€‰M…ä„Y…±¥Y…±Õ”ˆ(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰¥¹‘Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á” ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€Ù½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á•	½Õ¹(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ•Ù•¹ÑÌ€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€ü¹•Ù•¹ÑÌì((€€€€€€€¥˜€ …•Ù•¹ÑÌ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€•Ù•¹ÑÌ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÕÑÑ•É…¹•QÉ…¹ÍÉ¥‰•ˆ°(€€€€€€€€€€€Á¥Á•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ(€€€€€€€€¤ì((€€€€€€€•Ù•¹ÑÌ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÕÑÑ•É…¹•½µµ¥ÑÑ•ˆ°(€€€€€€€€€€€Á¥Á•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ(€€€€€€€€¤ì((€€€€€€€Ù½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á•	½Õ¹€ô(€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰ÍÁ•• µÉÕ¹Ñ¥µ”µÉ•…‘äˆ°(€€€€€€€‰¥¹‘Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á”(€€€€¤ì((€€€‰¥¹‘Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á” ¤ì((€€€½¹ÍÐÉ•™É•Í¡Y½¥•¹ÑÉåMÕµµ…Éå1…å½ÕÐ€ô(€€€€€€€€ ¤€ôøì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%ÍY¥Í¥‰±” ¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ôì((€€€±½‰…±Q¡¥Ì¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰É•Í¥é”ˆ°(€€€€€€€É•™É•Í¡Y½¥•¹ÑÉåMÕµµ…Éå1…å½ÕÐ°(€€€€€€€ì(€€€€€€€€€€€Á…ÍÍ¥Ù”èÑÉÕ”(€€€€€€€ô(€€€€¤ì(€€€±½‰…±Q¡¥Ì(€€€€€€€€¹Ù¥ÍÕ…±Y¥•ÝÁ½ÉÐ(€€€€€€€€ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰É•Í¥é”ˆ°(€€€€€€€€€€€É•™É•Í¡Y½¥•¹ÑÉåMÕµµ…Éå1…å½ÕÐ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Á…ÍÍ¥Ù”èÑÉÕ”(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì¹]5=Y½¥•¹ÑÉä€ô(€€€€€€€=‰©•Ð¹™É••é”¡ì(€€€€€€€€€€€½Á•¸è(€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì€ôø(€€€€€€€€€€€€€€€€€€€½Á•¹Y½¥•¹ÑÉä (€€€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€±½Í”è(€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€…¹•°èÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤°(€€€€€€€€€€€ÍÝ¥Ñ¡Q½Q½Õ è(€€€€€€€€€€€€€€€ÍÝ¥Ñ¡Y½¥•¹ÑÉåQ½Q½Õ °(€€€€€€€€€€€•Ð…Ñ¥Ù” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€…Íå¹Œ™Õ¹Ñ¥½¸É•ÍÑ½É•9Õµ‰•ÉA…‘MÑ…Ñ”¡Í¹…ÁÍ¡½Ð°ì‘ÕÉ…Ñ¥½¸€ô€Àô€ôíô¤ì(€€€€€€€¥˜€ …Í¹…ÁÍ¡½Ð¤É•ÑÕÉ¸ì(€€€€€€€…Ý…¥Ð•¹ÍÕÉ•9Õµ‰•ÉA…‘1½…‘• ¤ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”€ôì€¸¸¹Í¹…ÁÍ¡½Ðôì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘¥…±½œ¹½Á•¸¤ì(€€€€€€€€€€€½Á•¹¥…±½±•µ•¹Ð¡¹Õµ‰•ÉA…‘¥…±½œ°ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸°(€€€€€€€€€€€€€€€É•…Í½¸è€‰ÑÉ¥ÀµÍ•ÑÑ¥¹ÌµÉ•ÑÕÉ¸ˆ(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬ (€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€ü¹ÁÉ½µ½Ñ•Q½Á1…å•Èü¸ ¤(€€€€€€€€¤ì((€€€€€€€ÍÑ…ÉÑ9Õµ‰•ÉA…‘µ‰¥•¹ÑQ½¹” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í•Ñ9Õµ‰•ÉA… ¤ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘¥ÍÁ±…ä¤¹Õµ‰•ÉA…‘¥ÍÁ±…ä¹Ñ•áÑ½¹Ñ•¹Ð€ô€ˆˆì(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘½¹Ñ•áÐ¤¹Õµ‰•ÉA…‘½¹Ñ•áÐ¹Ñ•áÑ½¹Ñ•¹Ð€ô€‰9Õµ‰•ÈA…ˆì(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘…Ñ”¤¹Õµ‰•ÉA…‘…Ñ”¹Ù…±Õ”€ô€ˆˆì(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘±•…È¤ì(€€€€€€€€€€€¹Õµ‰•ÉA…‘±•…È¹‘…Ñ…Í•Ð¹…Ñ¥½¸€ô€‰±•…Èˆì(€€€€€€€€€€€¹Õµ‰•ÉA…‘±•…È¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‰±•…Èˆ¤ì(€€€€€€€ô(€€€€€€€¹Õµ‰•ÉA…‘I•Í•Ðü¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‰I•Í•Ðˆ¤ì(€€€€€€€¹Õµ‰•ÉA…‘…¹•°ü¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‰…¹•°ˆ¤ì(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘½¹™¥É´¤ì(€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹™¥É´¹‘…Ñ…Í•Ð¹…Ñ¥½¸€ô€‰½¹™¥É´ˆì(€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹™¥É´¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‰½¹™¥É´ˆ¤ì(€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹™¥É´¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€€€ô((€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ°(€€€€€€€€€€€™…±Í”(€€€€€€€€¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€‘¥Í…É‘AÉ•Á…É•€ôÑÉÕ”°(€€€€€€€…±±½Ý¡…¹•€ô™…±Í”°(€€€€€€€¥µµ•‘¥…Ñ”€ô™…±Í”°(€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸(€€€ô€ôíô¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”ì(€€€€€€€¥˜€ …ÍÑ…Ñ”¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€¥˜€ ……±±½Ý¡…¹•€˜˜¹Õµ‰•ÉA…‘!…Í¡…¹•Ì ¤¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍÐÑ…É•Ð€ô‘•ÍÑ¥¹…Ñ¥½¸€üüÍÑ…Ñ”¹…¹•±Q…É•Ð€üü€‰¡½µ”ˆì(€€€€€€€¥˜€¡ÍÑ…Ñ”¹½¹…¹•°€˜˜‘¥Í…É‘AÉ•Á…É•¤ÍÑ…Ñ”¹½¹…¹•° ¤ì(€€€€€€€¥˜€¡Ñ…É•Ð€ôôô€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ¤ì(€€€€€€€€€€€¥˜€ …ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¤‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€€€€€¥˜€ …½Á•¹QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ ‰¹Õµ‰•ÈµÁ…µÉ•ÑÕÉ¸ˆ°ì‘ÕÉ…Ñ¥½¸è€Àô¤¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘¥…±½œü¹½Á•¸€˜˜€…±½Í•¥…±½œ¡¹Õµ‰•ÉA…‘¥…±½œ°ì(€€€€€€€€€€€É•…Í½¸è€‰¹Õµ‰•ÈµÁ…ˆ°(€€€€€€€€€€€¥µµ•‘¥…Ñ”è¥µµ•‘¥…Ñ”ñðl‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ°€‰Í¡•‘Õ±•µÍÑ…ÉÐ‰t¹¥¹±Õ‘•Ì¡Ñ…É•Ð¤(€€€€€€€ô¤¤ì(€€€€€€€€€€€¥˜€¡Ñ…É•Ð€ôôô€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ€˜˜ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹½Á•¸¤ì(€€€€€€€€€€€€€€€±½Í•¥…±½œ¡ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°ì(€€€€€€€€€€€€€€€€€€€É•…Í½¸è€‰¹Õµ‰•ÈµÁ…µÉ•ÑÕÉ¸éÉ½±±‰…¬ˆ°(€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”èÑÉÕ”(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¥˜€¡Ñ…É•Ð€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€Í¡½ÝM¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¡íÉ•Í½±ÕÑ¥½¸èÍ¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¹ô¤ì(€€€€€€€ô((€€€€€€€¥˜€¡Ñ…É•Ð€ôôô€‰¡½µ”ˆ¤ì(€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹É½±”€ôôô€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ¤ì(€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜€¡‘¥Í…É‘AÉ•Á…É•€˜˜ÍÑ…Ñ”¹Ý½É­™±½Ü€ôôô€‰¹•ÜµÑÉ¥Àˆ¤ì(€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì(€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€€€€€€€€€±½­Q¥µ•È¹‘¥Í…É‘AÉ•Á…É•‘QÉ¥Àü¸ ¤¹…Ñ ü¸  ¤€ôøíô¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸…¹•±9Õµ‰•ÉA… ¤ì(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‘•ÍÑ¥¹…Ñ¥½¸€ô(€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹…¹•±Q…É•Ðì((€€€€€€€¥˜€ …‘•ÍÑ¥¹…Ñ¥½¸¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸°(€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑA•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ”¡Í½Á”¤ì(€€€€€€€É•ÑÕÉ¸Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€ü€‰Ñ½Ñ…°µ½…°ˆ(€€€€€€€€€€€€è€‰ÑÉ¥Àµ½…°ˆì(€€€ô((€€€™Õ¹Ñ¥½¸Á…ÉÍ•A•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ”¡É…Ü¤ì(€€€€€€€¥˜€¡ÑåÁ•½˜É…Ü€„ôô€‰ÍÑÉ¥¹œˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô((€€€€€€€±•ÐÑ•áÐ€ô(€€€€€€€€€€€É…Ü¹ÑÉ¥´ ¤ì((€€€€€€€¥˜€ …Ñ•áÐ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô((€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€Ñ•áÐ¹•¹‘Í]¥Ñ  ˆ”ˆ¤ì((€€€€€€€¥˜€¡Á•É•¹Ð¤ì(€€€€€€€€€€€Ñ•áÐ€ôÑ•áÐ¹Í±¥” À°€´Ä¤¹ÑÉ¥´ ¤ì(€€€€€€€ô((€€€€€€€±•ÐÙ…±Õ”€ô(€€€€€€€€€€€9Õµ‰•È¡Ñ•áÐ¤ì((€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤ñðÙ…±Õ”€ðô€À¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô((€€€€€€€¥˜€¡Á•É•¹Ð¤ì(€€€€€€€€€€€Ù…±Õ”€¼ô€ÄÀÀì(€€€€€€€ô(€€€€€€€•±Í”¥˜€¡Ù…±Õ”€ø€Ä¸Ô¤ì(€€€€€€€€€€€Ù…±Õ”€¼ô€ÄÀÀì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤€˜˜Ù…±Õ”€ø€À(€€€€€€€€€€€€üÙ…±Õ”(€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ™™•Ñ¥Ù•A•É•¹Ñ½…°¡Í½Á”¤ì(€€€€€€€±•ÐÍÑ…Ñ”ì((€€€€€€€ÑÉäì(€€€€€€€€€€€ÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€±½­Q¥µ•È¹•ÑU%MÑ…Ñ”ü¸ (€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€±½­Q¥µ•È¹Õ¥MÑ…Ñ”ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€ÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€±½­Q¥µ•È¹Õ¥MÑ…Ñ”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½µÁ½¹•¹Ð€ô(€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€üÍÑ…Ñ”ü¹Ñ½Ñ…±}½…±}½µÁ½¹•¹Ð(€€€€€€€€€€€€€€€€èÍÑ…Ñ”ü¹ÑÉ¥Á}½…±}½µÁ½¹•¹Ðì(€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€½µÁ½¹•¹Ðü¹Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤€˜˜(€€€€€€€€€€€Ù…±Õ”€ø€À(€€€€€€€€€€€€€€€€üÙ…±Õ”(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸•Ñ½¹™¥ÕÉ•‘½…±¥ÍÁ±…ä¡Í½Á”¤ì(€€€€€€€½¹ÍÐ•™™•Ñ¥Ù”€ô(€€€€€€€€€€€•Ñ™™•Ñ¥Ù•A•É•¹Ñ½…° (€€€€€€€€€€€€€€€Í½Á”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€•™™•Ñ¥Ù”(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™½Éµ…ÑMÕµµ…ÉåA•É•¹Ð (€€€€€€€€€€€€€€€•™™•Ñ¥Ù”°(€€€€€€€€€€€€€€€€ˆÄÀÀ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…ÑÑÉ¥‰ÕÑ”€ô(€€€€€€€€€€€•ÑA•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ”¡Í½Á”¤ì((€€€€€€€¥˜€ …±½­Q¥µ•È¹¡…ÍÑÑÉ¥‰ÕÑ”¡…ÑÑÉ¥‰ÕÑ”¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆÄÀÀ”ˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸™½Éµ…ÑMÕµµ…ÉåA•É•¹Ð (€€€€€€€€€€€Á…ÉÍ•A•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€±½­Q¥µ•È¹•ÑÑÑÉ¥‰ÕÑ”¡…ÑÑÉ¥‰ÕÑ”¤(€€€€€€€€€€€€¤°(€€€€€€€€€€€€ˆÄÀÀ”ˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑA•É•¹Ñ½…±Y…±Õ”¡Í½Á”¤ì(€€€€€€€½¹ÍÐ•™™•Ñ¥Ù”€ô(€€€€€€€€€€€•Ñ™™•Ñ¥Ù•A•É•¹Ñ½…° (€€€€€€€€€€€€€€€Í½Á”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€•™™•Ñ¥Ù”(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸Á•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€•™™•Ñ¥Ù”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ…ÑÑÉ¥‰ÕÑ”€ô(€€€€€€€€€€€•ÑA•É•¹Ñ½…±ÑÑÉ¥‰ÕÑ”¡Í½Á”¤ì((€€€€€€€½¹ÍÐÉ…Ü€ô(€€€€€€€€€€€±½­Q¥µ•È¹•ÑÑÑÉ¥‰ÕÑ”¡…ÑÑÉ¥‰ÕÑ”¤ì((€€€€€€€É•ÑÕÉ¸É…Ü€˜˜É…Ü¹ÑÉ¥´ ¤(€€€€€€€€€€€€üÉ…Ü(€€€€€€€€€€€€è€ˆÄÀÀ”ˆì(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡ÕÑ½½…±¥…±½œ ¤ì(€€€€€€€¥˜€ ……ÕÑ½½…±¥…±½œ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜€¡…ÕÑ½QÉ¥Á½…±Y…±Õ”¤ì(€€€€€€€€€€€…ÕÑ½QÉ¥Á½…±Y…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€•Ñ½¹™¥ÕÉ•‘½…±¥ÍÁ±…ä ‰ÑÉ¥Àˆ¤ì(€€€€€€€ô((€€€€€€€¥˜€¡…ÕÑ½Q½Ñ…±½…±Y…±Õ”¤ì(€€€€€€€€€€€…ÕÑ½Q½Ñ…±½…±Y…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€•Ñ½¹™¥ÕÉ•‘½…±¥ÍÁ±…ä ‰Ñ½Ñ…°ˆ¤ì((€€€€€€€€€€€½¹ÍÐ½ÁÑ¥½¸€ô(€€€€€€€€€€€€€€€…ÕÑ½Q½Ñ…±½…±Y…±Õ”¹±½Í•ÍÐ (€€€€€€€€€€€€€€€€€€€€‰m‘…Ñ„µ…ÕÑ¼µ½…°µÍ½Á”ôÑ½Ñ…°tˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€½ÁÑ¥½¸ü¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€‰ÍÁ…¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥˜€¡±…‰•°¤ì(€€€€€€€€€€€€€€€±…‰•°¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€‰e½ÕÈ€ˆ€¬(€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ½…°ˆì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐ±½­•‘M½Á•Ì€ô¹•ÜM•Ð¡•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”ü¹Í½Á•Ìñðmt¤ì(€€€€€€€™½È€¡½¹ÍÐ‰ÕÑÑ½¸½˜…ÕÑ½½…±¥…±½œ¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µ…ÕÑ¼µ½…°µÍ½Á•tˆ¤¤ì(€€€€€€€€€€€½¹ÍÐÍ½Á”€ô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÕÑ½½…±M½Á”€ôôô€‰Ñ½Ñ…°ˆ€ü€‰Ñ½Ñ…°ˆ€è€‰ÑÉ¥Àˆì(€€€€€€€€€€€½¹ÍÐ±½­•€ô±½­•‘M½Á•Ì¹¡…Ì¡Í½Á”¤ì(€€€€€€€€€€€½¹ÍÐÍ½Á•1…‰•°€ô(€€€€€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€€€€€è€‰QÉ¥Àˆì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô±½­•ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€‰…É¥„µ±…‰•°ˆ°(€€€€€€€€€€€€€€€±½­•(€€€€€€€€€€€€€€€€€€€€ü€‘íÍ½Á•1…‰•±ô½…°±½­•Ñ¼¹Q¥µ•€(€€€€€€€€€€€€€€€€€€€€è‘¥Ð€‘íÍ½Á•1…‰•±ô½…±€(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹ÕÑ½½…±¥…±½œ ¤ì(€€€€€€€¥˜€ ……ÕÑ½½…±¥…±½œ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•™É•Í¡ÕÑ½½…±¥…±½œ ¤ì((€€€€€€€É•ÑÕÉ¸½Á•¹¥…±½±•µ•¹Ð (€€€€€€€€€€€…ÕÑ½½…±¥…±½œ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è€ÈÔÀ°(€€€€€€€€€€€€€€€É•…Í½¸è€‰…ÕÑ¼µ½…°ˆ(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹A•É•¹Ñ½…±9Õµ‰•ÉA…¡Í½Á”¤ì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•‘M½Á”€ô(€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€è€‰ÑÉ¥Àˆì((€€€€€€€É•ÑÕÉ¸½Á•¹9Õµ‰•ÉA…¡ì(€€€€€€€€€€€µ½‘”è€‰Á•É•¹Ðˆ°(€€€€€€€€€€€Í½ÕÉ”è(€€€€€€€€€€€€€€€€‘í¹½Éµ…±¥é•‘M½Á•ôµ½…±€°(€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”è(€€€€€€€€€€€€€€€•ÑA•É•¹Ñ½…±Y…±Õ” (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€É½±”è€‰É½½Ðˆ°(€€€€€€€€€€€Ý½É­™±½Üè(€€€€€€€€€€€€€€€ÑÉ¥Á%Í1¥Ù” ¤(€€€€€€€€€€€€€€€€€€€€ü€‰•‘¥ÐµÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€è¹Õ±°°(€€€€€€€€€€€…¹•±Q…É•Ðè€‰¡½µ”ˆ°(€€€€€€€€€€€½¹™¥ÉµQ…É•Ðè€‰¡½µ”ˆ(€€€€€€€ô¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸½µµ¥Ñ9Õµ‰•ÉA… (€€€€€€€Í¥¹…°(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€½¹ÍÐÍÑ…Ñ”€ôì€¸¸¹¹Õµ‰•ÉA…‘MÑ…Ñ”ôì((€€€€€€€¥˜€ (€€€€€€€€€€€€…¹Õµ‰•ÉA…‘!…Í¡…¹•Ì ¤€˜˜(€€€€€€€€€€€€…ÍÑ…Ñ”¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€¥˜€¡ÍÑ…Ñ”¹½¹½¹™¥É´¤ì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€…ÍÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€€€€€üÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€€€€€€èÍÑ…Ñ”¹µ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü¹•Ü…Ñ”¡€‘íÍÑ…Ñ”¹Á•¹‘¥¹…Ñ•õP‘íMÑÉ¥¹œ¡…‰Í½±ÕÑ•!½ÕÈÈÐ¡ÍÑ…Ñ”¤¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡ÍÁ±¥Ñ‰Í½±ÕÑ•¥¥ÑÌ¡ÍÑ…Ñ”¹Á•¹‘¥¹œ¤¹µ¥¹ÕÑ”¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡ÍÁ±¥Ñ‰Í½±ÕÑ•¥¥ÑÌ¡ÍÑ…Ñ”¹Á•¹‘¥¹œ¤¹Í•½¹¤¹Á…‘MÑ…ÉÐ È°ˆÀˆ¥õ€¤¹Ñ½%M=MÑÉ¥¹œ ¤(€€€€€€€€€€€€€€€€€€€€€€€€èÍÑ…Ñ”¹µ½‘”€ôôô€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü9Õµ‰•È¡ÍÑ…Ñ”¹Á•¹‘¥¹œ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÑ¥µ•¥¥ÑÍQ½5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ½¹™¥Éµ•€ô(€€€€€€€€€€€€€€€…Ý…¥ÐÍÑ…Ñ”¹½¹½¹™¥É´¡Ù…±Õ”¤€„ôô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€…Í¥¹…°ü¹…‰½ÉÑ•€˜˜(€€€€€€€€€€€€€€€½¹™¥Éµ•(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€¥˜€¡ÍÑ…Ñ”¹µ½‘”€ôôô€‰Á•É•¹Ðˆ¤ì(€€€€€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€€€€€9Õµ‰•È¡ÍÑ…Ñ”¹Á•¹‘¥¹œ¤ì((€€€€€€€€€€€½¹ÍÐ…ÑÑÉ¥‰ÕÑ”€ô(€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰Ñ½Ñ…°µ½…°ˆ(€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…°µ½…°ˆ(€€€€€€€€€€€€€€€€€€€€è€‰ÑÉ¥Àµ½…°ˆì((€€€€€€€€€€€±½­Q¥µ•È¹½¹™¥ÕÉ”¡ì(€€€€€€€€€€€€€€€m…ÑÑÉ¥‰ÕÑ”€ôôô€‰Ñ½Ñ…°µ½…°ˆ€ü€‰Ñ½Ñ…±}½…°ˆ€è€‰ÑÉ¥Á}½…°‰tè(€€€€€€€€€€€€€€€€€€€€‘íÁ•É•¹Ñô•€(€€€€€€€€€€€ô¤ì((€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€¥˜€¡ÍÑ…Ñ”¹µ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ¤ì(€€€€€€€€€€€¥˜€¡ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€˜˜l‰É•…Ñ¥½¸µÑ¥µ”ˆ°€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°€‰…ÑÕ…°µÍÑ…ÉÐ‰t¹¥¹±Õ‘•Ì¡ÍÑ…Ñ”¹Í½ÕÉ”¤¤ì(€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¹Ù…±Õ•Ìì(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”°ìÉ•…Ñ¥½¸èÑÉÕ”ô¤¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹É•…Ñ¥½¹…Ñ”€ôÍÑ…Ñ”¹Á•¹‘¥¹…Ñ”ì(€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”¤¤ì(€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤€˜˜ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌ¤ì(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”°ìÉ•…Ñ¥½¸èÑÉÕ”ô¤¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌ¹É•…Ñ¥½¹Q¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌ¹É•…Ñ¥½¹…Ñ”€ôÍÑ…Ñ”¹Á•¹‘¥¹…Ñ”ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”¤¤ì(€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌ¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰…ÑÕ…°µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌ¹ÍÑ…ÉÑQ¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”°ìÉ•…Ñ¥½¸èÑÉÕ”ô¤¤ì(€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Á•¹‘¥¹…Ñ”€„ôô±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€ôÍÑ…Ñ”¹Á•¹‘¥¹…Ñ”ì(€€€€€€€€€€€€€€€€€€€¥˜€¡±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€„ôôÍÑ…Ñ”¹Á•¹‘¥¹…Ñ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€±½­Q¥µ•È¹É•…Ñ¥½¹Q¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸±½­Q¥µ•È¹É•…Ñ¥½¹Q¥µ”€ôôôÙ…±Õ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÑ¥µ•±¥¹”€ô…‰Í½±ÕÑ•Q¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡ÍÑ…Ñ”¤ì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡Ñ¥µ•±¥¹”¤ì(€€€€€€€€€€€¥˜€ …Ù…±Õ”¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€€€€€±½­Q¥µ•È¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸±½­Q¥µ•È¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôôôÙ…±Õ”ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰…ÑÕ…°µÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…ÉÑQ¥µ”€ôÙ…±Õ”ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸±½­Q¥µ•È¹ÍÑ…ÉÑQ¥µ”€ôôôÙ…±Õ”ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€üÑ¥µ•¥¥ÑÍQ½5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€¥˜€ (€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ôôô(€€€€€€€€€€€€€€€Õ¹‘•™¥¹•€˜˜(€€€€€€€€€€€€…ÍÑ…Ñ”¹…±±½ÝµÁÑä(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€¥˜€¡ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€˜˜ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¹Ù…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô(€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ìì((€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤€˜˜ÑÉ¥ÁÉ…™Ð¤ì(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹Í½ÕÉ”€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤ì(€€€€€€€€€€€€€€€Íå¹É…™ÑMÑ…¹‘…É‘Q¥µ•I•ÑÕÉ¹É…µ” (€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜€¡ÍÑ…Ñ”¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑQÉ¥ÁÉ…™Ð ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€¥˜€¡ÍÑ…Ñ”¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´¤ì(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€ôì(€€€€€€€€€€€€€€€€¸¸¸¡ÍÑ…Ñ”¹ÑÉ¥Á•™…Õ±ÑÌñðíô¤°(€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìè(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€ôì(€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑQÉ¥ÁÉ…™Ð ¤ì(€€€€€€€ô((€€€€€€€¥˜€¡±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€„ôôÕ¹‘•™¥¹•¤ì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ðô€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ìì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€„ôô(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸•É…Í•9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”¤É•ÑÕÉ¸ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô€ˆˆì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ•É¥‘¥•´€ôÕ¹‘•™¥¹•ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô™…±Í”ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹•Ù•É‘¥Ñ•€ôÑÉÕ”ì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰…­ÍÁ…•9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ(€€€€€€€€€€€€¤¹Í±¥” (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€´Ä(€€€€€€€€€€€€¤ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô(€€€€€€€€€€€™…±Í”ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹•Ù•É‘¥Ñ•€ô(€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í•Ñ9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”¤É•ÑÕÉ¸ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô¹Õµ‰•ÉA…‘MÑ…Ñ”¹¥¹¥Ñ¥…°ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹…Ñ”€ô¹Õµ‰•ÉA…‘MÑ…Ñ”¹¥¹¥Ñ¥…±…Ñ”ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ•É¥‘¥•´€ô¹Õµ‰•ÉA…‘MÑ…Ñ”¹¥¹¥Ñ¥…±5•É¥‘¥•´ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô¹Õµ‰•ÉA…‘MÑ…Ñ”¹Í½ÕÉ”€„ôô€‰¹•ÜµÑÉ¥Àˆì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸¡…¹•9Õµ‰•ÉA…‘5•É¥‘¥•´¡¹•áÐ¤ì(€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”ñð¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”€„ôô€‰…‰Í½±ÕÑ”ˆ¤É•ÑÕÉ¸ì(€€€€€€€¥˜€¡¹•áÐ€„ôô€‰4ˆ€˜˜¹•áÐ€„ôô€‰A4ˆ¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐÁ…ÉÑÌ€ôÍÁ±¥Ñ‰Í½±ÕÑ•¥¥ÑÌ¡¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ¤ì(€€€€€€€¥˜€ …Á…ÉÑÌ¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÌ€ô¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ•É¥‘¥•´ì(€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍY…±Õ”€ôìÁ•¹‘¥¹œè¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ°µ•É¥‘¥•´èÁÉ•Ù¥½ÕÌôì(€€€€€€€½¹ÍÐÑ…É•Ð€ôÁÉ•Ù¥½ÕÌ€ôôô¹•áÐ€ü¹Õ±°€è¹•áÐì(€€€€€€€±•Ð¡½ÕÈ€ôÁ…ÉÑÌ¹¡½ÕÈì(€€€€€€€¥˜€¡ÁÉ•Ù¥½ÕÌ€˜˜€…Ñ…É•Ð¤ì(€€€€€€€€€€€¡½ÕÈ€ô¡½ÕÈ€”€ÄÈ€¬€¡ÁÉ•Ù¥½ÕÌ€ôôô€‰A4ˆ€ü€ÄÈ€è€À¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜€¡Ñ…É•Ð¤ì(€€€€€€€€€€€¡½ÕÈ€ô¡½ÕÈ€”€ÄÈñð€ÄÈì(€€€€€€€ô(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ•É¥‘¥•´€ôÑ…É•Ðì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô…‰Í½±ÕÑ•¥¥ÑÌ¡¡½ÕÈ°Á…ÉÑÌ¹µ¥¹ÕÑ”°Á…ÉÑÌ¹Í•½¹¤ì(€€€€€€€¥˜€ ……‰Í½±ÕÑ•Y…±Õ•ÍÅÕ…°¡ÁÉ•Ù¥½ÕÍY…±Õ”°¹Õµ‰•ÉA…‘MÑ…Ñ”¤¤¹Õµ‰•ÉA…‘MÑ…Ñ”¹•Ù•É‘¥Ñ•€ôÑÉÕ”ì(€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô™…±Í”ì(€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑQÉ¥ÁQ¥µ•¥ÍÁ±…ä¡Ù…±Õ”°É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€½¹ÍÐµ¥±±¥Í•½¹‘Ì€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡Ù…±Õ”¤ì(€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡µ¥±±¥Í•½¹‘Ì¤¤É•ÑÕÉ¸€ˆ´´´ˆì(€€€€€€€½¹ÍÐ‰…Í”€ôÁ…ÉÍ•…Ñ•%¹ÁÕÐ¡É•…Ñ¥½¹…Ñ”¤ñð•ÑQÉ¥Á	…Í•…Ñ” ¤ì(€€€€€€€½¹ÍÐ‘…Ñ”€ô¹•Ü…Ñ”¡‰…Í”¹•ÑQ¥µ” ¤€¬µ¥±±¥Í•½¹‘Ì¤ì(€€€€€€€½¹ÍÐµ¥±¥Ñ…Éä€ô±½­Q¥µ•È¹•ÑÑÑÉ¥‰ÕÑ” ‰µ¥±¥Ñ…ÉäµÑ¥µ”ˆ¤€„ôô€‰™…±Í”ˆì(€€€€€€€½¹ÍÐÑ¥µ”€ôµ¥±¥Ñ…Éä(€€€€€€€€€€€€ü€‘íMÑÉ¥¹œ¡‘…Ñ”¹•Ñ!½ÕÉÌ ¤¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5¥¹ÕÑ•Ì ¤¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡‘…Ñ”¹•ÑM•½¹‘Ì ¤¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥õ€(€€€€€€€€€€€€è€‘í‘…Ñ”¹•Ñ!½ÕÉÌ ¤€”€ÄÈñð€ÄÉôè‘íMÑÉ¥¹œ¡‘…Ñ”¹•Ñ5¥¹ÕÑ•Ì ¤¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡‘…Ñ”¹•ÑM•½¹‘Ì ¤¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ô€‘í‘…Ñ”¹•Ñ!½ÕÉÌ ¤€øô€ÄÈ€ü€‰A4ˆ€è€‰4‰õ€ì(€€€€€€€½¹ÍÐ‘…Ñ•Q•áÐ€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ð¡Õ¹‘•™¥¹•°ì(€€€€€€€€€€€µ½¹Ñ è€‰Í¡½ÉÐˆ°(€€€€€€€€€€€‘…äè€‰¹Õµ•É¥Œˆ°(€€€€€€€€€€€å•…Èè€‰¹Õµ•É¥Œˆ(€€€€€€€ô¤¹™½Éµ…Ð¡‘…Ñ”¤ì(€€€€€€€É•ÑÕÉ¸€‘íÑ¥µ•ôƒ
Ü€‘í‘…Ñ•Q•áÑõ€ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑQÉ¥ÁM•ÑÑ¥¹ÍA…‘M¹…ÁÍ¡½Ð ¤ì(€€€€€€€É•ÑÕÉ¸•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹9Õµ‰•ÉA…‘MÑ…Ñ” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑQÉ¥ÁM•ÑÑ¥¹ÍA•¹‘¥¹¥•±¡Í¹…ÁÍ¡½Ð€ô•ÑQÉ¥ÁM•ÑÑ¥¹ÍA…‘M¹…ÁÍ¡½Ð ¤¤ì(€€€€€€€¥˜€ …Í¹…ÁÍ¡½Ð¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€¥˜€¡Í¹…ÁÍ¡½Ð¹Í½ÕÉ”€ôôô€‰¹•ÜµÑÉ¥ÀˆñðÍ¹…ÁÍ¡½Ð¹Í½ÕÉ”€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆì(€€€€€€€ô(€€€€€€€¥˜€¡l‰É•…Ñ¥½¸µÑ¥µ”ˆ°€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°€‰…ÑÕ…°µÍÑ…ÉÐ‰t¹¥¹±Õ‘•Ì¡Í¹…ÁÍ¡½Ð¹Í½ÕÉ”¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸Í¹…ÁÍ¡½Ð¹Í½ÕÉ”ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑQÉ¥ÁM•ÑÑ¥¹ÍA•¹‘¥¹Y…±Õ”¡Í¹…ÁÍ¡½Ð¤ì(€€€€€€€¥˜€ …Í¹…ÁÍ¡½Ð¤É•ÑÕÉ¸€ˆ´´´ˆì(€€€€€€€¥˜€¡Í¹…ÁÍ¡½Ð¹µ½‘”€ôôô€‰…‰Í½±ÕÑ”ˆ¤ì(€€€€€€€€€€€½¹ÍÐÁ…ÉÑÌ€ôÍÁ±¥Ñ‰Í½±ÕÑ•¥¥ÑÌ¡Í¹…ÁÍ¡½Ð¹Á•¹‘¥¹œ¤ì(€€€€€€€€€€€½¹ÍÐ‘…Ñ”€ôÁ…ÉÍ•…Ñ•%¹ÁÕÐ¡Í¹…ÁÍ¡½Ð¹Á•¹‘¥¹…Ñ”¤ì(€€€€€€€€€€€¥˜€ …Á…ÉÑÌñð€…‘…Ñ”¤É•ÑÕÉ¸€ˆ´´´ˆì(€€€€€€€€€€€½¹ÍÐÑ¥µ”€ôÍ¹…ÁÍ¡½Ð¹µ•É¥‘¥•´(€€€€€€€€€€€€€€€€ü€‘íÁ…ÉÑÌ¹¡½ÕÉôè‘íMÑÉ¥¹œ¡Á…ÉÑÌ¹µ¥¹ÕÑ”¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡Á…ÉÑÌ¹Í•½¹¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ô€‘íÍ¹…ÁÍ¡½Ð¹µ•É¥‘¥•µõ€(€€€€€€€€€€€€€€€€è€‘íMÑÉ¥¹œ¡Á…ÉÑÌ¹¡½ÕÈ¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡Á…ÉÑÌ¹µ¥¹ÕÑ”¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥ôè‘íMÑÉ¥¹œ¡Á…ÉÑÌ¹Í•½¹¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥õ€ì(€€€€€€€€€€€½¹ÍÐ‘…Ñ•Q•áÐ€ô¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ð¡Õ¹‘•™¥¹•°ì(€€€€€€€€€€€€€€€µ½¹Ñ è€‰Í¡½ÉÐˆ°(€€€€€€€€€€€€€€€‘…äè€‰¹Õµ•É¥Œˆ°(€€€€€€€€€€€€€€€å•…Èè€‰¹Õµ•É¥Œˆ(€€€€€€€€€€€ô¤¹™½Éµ…Ð¡‘…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‘íÑ¥µ•ôƒ
Ü€‘í‘…Ñ•Q•áÑõ€ì(€€€€€€€ô(€€€€€€€¥˜€¡Í¹…ÁÍ¡½Ð¹µ½‘”€ôôô€‰‘ÕÉ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Í¹…ÁÍ¡½Ð¹Á•¹‘¥¹œ€üÉ•¹‘•ÉQ¥µ•¥¥ÑÌ¡Í¹…ÁÍ¡½Ð¹Á•¹‘¥¹œ¤€è€ˆ´´´ˆì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸€ˆ´´´ˆì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€½¹ÍÐÑ¥µ•ÉMÑ…Ñ”€ô(€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€ü¹Õ¥MÑ…Ñ”ì((€€€€€€€¥˜€ (€€€€€€€€€€€ÑåÁ•½˜Ñ¥µ•ÉMÑ…Ñ”(€€€€€€€€€€€€€€€€ü¹ÑÉ¥Á}…Ñ¥Ù”€ôôô(€€€€€€€€€€€€€€€€‰‰½½±•…¸ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ñ¥µ•ÉMÑ…Ñ”(€€€€€€€€€€€€€€€€¹ÑÉ¥Á}…Ñ¥Ù”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€ü¹ÍÑ…ÑÕÌ€ôôô(€€€€€€€€€€€€€€€€‰ÉÕ¹¹¥¹œˆñð(€€€€€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€¹ÑÉ¥ÁMÑ…Ñ”€ôôô(€€€€€€€€€€€€€€€€‰ÉÕ¹¹¥¹œˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹É…™ÑMÑ…¹‘…É‘Q¥µ•I•ÑÕÉ¹É…µ” (€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹9Õµ‰•ÉA…‘MÑ…Ñ” ¤ì(€€€€€€€¥˜€ …ÍÑ…Ñ”ñðÍÑ…Ñ”¹Í½ÕÉ”€„ôô€‰¹•ÜµÑÉ¥Àˆ¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐ‘¥¥ÑÌ€ô‘ÕÉ…Ñ¥½¹Y…±Õ•Q½I…Ý¥¥ÑÌ (€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€¤ì(€€€€€€€ÍÑ…Ñ”¹¥¹¥Ñ¥…°€ô‘¥¥ÑÌì(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹œ€ô‘¥¥ÑÌì(€€€€€€€ÍÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô™…±Í”ì(€€€€€€€ÍÑ…Ñ”¹ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´€ôÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁÉ…™ÑÕÑÕÉ•MÑ…ÉÑ…Ñ”¡‘É…™Ð€ôÑÉ¥ÁÉ…™Ð¤ì(€€€€€€€½¹ÍÐ‘…Ñ”€ôÁ…ÉÍ•…Ñ•%¹ÁÕÐ¡‘É…™Ðü¹É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€½¹ÍÐÑ¥µ•±¥¹”€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ðü¹Í¡•‘Õ±•‘MÑ…ÉÐ¤ì(€€€€€€€¥˜€ …‘…Ñ”ñð€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ñ¥µ•±¥¹”¤¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€É•ÑÕÉ¸¹•Ü…Ñ”¡‘…Ñ”¹•ÑQ¥µ” ¤€¬Ñ¥µ•±¥¹”¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ¡‘É…™Ð€ôÑÉ¥ÁÉ…™Ð°¹½Ü€ô¹•Ü…Ñ” ¤¤ì(€€€€€€€½¹ÍÐÍÑ…ÉÐ€ôÑÉ¥ÁÉ…™ÑÕÑÕÉ•MÑ…ÉÑ…Ñ”¡‘É…™Ð¤ì(€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÐ¥¹ÍÑ…¹•½˜…Ñ”€˜˜ÍÑ…ÉÐ¹•ÑQ¥µ” ¤€ø¹½Ü¹•ÑQ¥µ” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™ÕÑÕÉ•QÉ¥Á±½­%½¸¡‘…Ñ”¤ì(€€€€€€€½¹ÍÐ•¹Ñ•É`€ô€ÄÀ¸Ô°•¹Ñ•Éd€ô€ÄÌì(€€€€€€€½¹ÍÐÁ½¥¹Ð€ô€¡ÑÕÉ¸°±•¹Ñ ¤€ôøì(€€€€€€€€€€€½¹ÍÐ…¹±”€ôÑÕÉ¸€¨5…Ñ ¹A$€¨€È€´5…Ñ ¹A$€¼€Èì(€€€€€€€€€€€É•ÑÕÉ¸m•¹Ñ•É`€¬5…Ñ ¹½Ì¡…¹±”¤€¨±•¹Ñ °•¹Ñ•Éd€¬5…Ñ ¹Í¥¸¡…¹±”¤€¨±•¹Ñ¡tì(€€€€€€€ôì(€€€€€€€½¹ÍÐµ¥¹ÕÑ•QÕÉ¸€ô‘…Ñ”¹•Ñ5¥¹ÕÑ•Ì ¤€¼€ØÀì(€€€€€€€½¹ÍÐ¡½ÕÉQÕÉ¸€ô€¡‘…Ñ”¹•Ñ!½ÕÉÌ ¤€”€ÄÈ€¬µ¥¹ÕÑ•QÕÉ¸¤€¼€ÄÈì(€€€€€€€½¹ÍÐm¡½ÕÉ`±¡½ÕÉet€ôÁ½¥¹Ð¡¡½ÕÉQÕÉ¸°€Ì¸È¤ì(€€€€€€€½¹ÍÐmµ¥¹ÕÑ•`±µ¥¹ÕÑ•et€ôÁ½¥¹Ð¡µ¥¹ÕÑ•QÕÉ¸°€Ð¸Ø¤ì(€€€€€€€É•ÑÕÉ¸€ñÍÙœÙ¥•Ý	½àôˆÀ€À€ÈÐ€ÈÐˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆøñ¥É±”àôˆ‘í•¹Ñ•Éaôˆäôˆ‘í•¹Ñ•ÉeôˆÈôˆØ¸Ôˆ¼øñÁ…Ñ ô‰4‘í•¹Ñ•Éaô€‘í•¹Ñ•Éeõ0‘í¡½ÕÉ`¹Ñ½¥á• È¥ô€‘í¡½ÕÉd¹Ñ½¥á• È¥õ4‘í•¹Ñ•Éaô€‘í•¹Ñ•Éeõ0‘íµ¥¹ÕÑ•`¹Ñ½¥á• È¥ô€‘íµ¥¹ÕÑ•d¹Ñ½¥á• È¥õ4ÄÔ¸à€Ô¸Ù„à¸Ü€à¸Ü€À€À€Ä€Ì¸È€Ô¸Ý4Ää¸Ø€à¸Õ°´¸Ø€È¸à´È¸à´¸Øˆ¼øð½ÍÙœù€ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁÉ…™Ñ…¹I•ÅÕ•ÍÑMÑ…ÉÐ¡‘É…™Ð€ôÑÉ¥ÁÉ…™Ð¤ì(€€€€€€€¥˜€¡ÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ¡‘É…™Ð¤¤É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€¥˜€ …‘É…™Ðñð‘É…™Ð¹‘•™•ÉÉ•ñð€…ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ¡‘É…™Ð¤¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€½¹ÍÐÉ•…Ñ¥½¹Q¥µ”€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹É•…Ñ¥½¹Q¥µ”¤ì(€€€€€€€½¹ÍÐÍ¡•‘Õ±•‘MÑ…ÉÐ€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐ¤ì(€€€€€€€½¹ÍÐ…ÑÕ…±MÑ…ÉÐ€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹ÍÑ…ÉÑQ¥µ”¤ì(€€€€€€€É•ÑÕÉ¸	½½±•…¸¡Á…ÉÍ•…Ñ•%¹ÁÕÐ¡‘É…™Ð¹É•…Ñ¥½¹…Ñ”¤¤€˜˜(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•…Ñ¥½¹Q¥µ”¤€˜˜É•…Ñ¥½¹Q¥µ”€øô€À€˜˜É•…Ñ¥½¹Q¥µ”€ð€àØÐÀÀÀÀÀ€˜˜(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡•‘Õ±•‘MÑ…ÉÐ¤€˜˜Í¡•‘Õ±•‘MÑ…ÉÐ€øô€À€˜˜(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡…ÑÕ…±MÑ…ÉÐ¤€˜˜…ÑÕ…±MÑ…ÉÐ€øô€Àì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÑ½ÁM¡•‘Õ±•‘MÑ…ÉÑQ¥­•È ¤ì(€€€€€€€±•…É%¹Ñ•ÉÙ…°¡Í¡•‘Õ±•‘MÑ…ÉÑQ¥­•È¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑQ¥­•È€ôÕ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹•±M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÑQ¥µ•È(€€€€€€€€¤ì((€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÑQ¥µ•È€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±•M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì(€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì((€€€€€€€½¹ÍÐ‘É…™Ð€ô(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ðì((€€€€€€€¥˜€ …‘É…™Ð¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÑQ¥µ•È€ô(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÑQ¥µ•È€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸ñð(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐ¡…ÍMÑ…¹‘…É‘Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÁ•…¬ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…ÍMÑ…¹‘…É‘Q¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰M…äMÑ…ÉÐÑ¼ÍÑ…ÉÐ•…É±äˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰M…äÍÑ…¹‘…ÉÑ¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€ÄàÀ(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸…ÉµM¡•‘Õ±•‘MÑ…ÉÑÕÑ½É½µY½¥” ¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ðñð(€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ (€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô(€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹¡•­•€ô(€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸™±…M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ” ¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰¹••‘ÌµÙ…±Õ”ˆ¤ì(€€€€€€€Ù½¥Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¹½™™Í•Ñ]¥‘Ñ ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¹±…ÍÍ1¥ÍÐ¹…‘ ‰¹••‘ÌµÙ…±Õ”ˆ¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ5•ÍÍ…”¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ5•ÍÍ…”¹Ñ•áÑ½¹Ñ•¹Ð€ô€‰¹Ñ•ÈMÑ…¹‘…ÉQ¥µ”‰•™½É”ÍÑ…ÉÑ¥¹œÑ¡”ÑÉ¥À¸ˆì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸‰•¥¹M¡•‘Õ±•‘QÉ¥À¡µ½‘”¤ì(€€€€€€€¥˜€ …ÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ¡ÑÉ¥ÁÉ…™Ð¤¤ì(€€€€€€€€€€€™±…M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€¥˜€¡µ½‘”€ôôô€‰¹½Üˆ¤=‰©•Ð¹…ÍÍ¥¸¡ÑÉ¥ÁÉ…™Ð°É•ÍÕµ•‘QÉ¥ÁMÑ…ÉÑÌ¡ÑÉ¥ÁÉ…™Ð°¹•Ü…Ñ” ¤¤¤ì(€€€€€€€•±Í”ÑÉ¥ÁÉ…™Ð¹ÍÑ…ÉÑQ¥µ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡Á…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡ÑÉ¥ÁÉ…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐ¤¤ì(€€€€€€€ÍÑ½ÁM¡•‘Õ±•‘MÑ…ÉÑQ¥­•È ¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¸€ô™…±Í”ì(€€€€€€€¥˜€ ……Ý…¥ÐÍÑ…ÉÑQÉ¥ÁÉ…™Ð ¤¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€¥˜€¡Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¹½Á•¸¤±½Í•¥…±½œ¡Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°íÉ•…Í½¸è‰Í¡•‘Õ±•µÑÉ¥ÀµÍÑ…ÉÐ‰ô¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸ÕÁ‘…Ñ•M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì(€€€€€€€½¹ÍÐÍ¡•‘Õ±•€ôÑÉ¥ÁÉ…™ÑÕÑÕÉ•MÑ…ÉÑ…Ñ” ¤ì(€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹œ€ôÍ¡•‘Õ±•€üÍ¡•‘Õ±•¹•ÑQ¥µ” ¤€´…Ñ”¹¹½Ü ¤€è€Àì(€€€€€€€½¹ÍÐµ¥±¥Ñ…Éä€ô(€€€€€€€€€€€±½­Q¥µ•È¹•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€‰µ¥±¥Ñ…ÉäµÑ¥µ”ˆ(€€€€€€€€€€€€¤€„ôô(€€€€€€€€€€€€€€€€‰™…±Í”ˆì(€€€€€€€±•ÐÍ¡•‘Õ±•‘Q¥µ•1…‰•°€ô(€€€€€€€€€€€€ˆ´´´ˆì((€€€€€€€¥˜€ (€€€€€€€€€€€Í¡•‘Õ±•€˜˜(€€€€€€€€€€€€…9Õµ‰•È¹¥Í9…8 (€€€€€€€€€€€€€€€Í¡•‘Õ±•¹•ÑQ¥µ” ¤(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ¡½ÕÉÌ€ô(€€€€€€€€€€€€€€€Í¡•‘Õ±•¹•Ñ!½ÕÉÌ ¤ì(€€€€€€€€€€€½¹ÍÐµ¥¹ÕÑ•Ì€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•¹•Ñ5¥¹ÕÑ•Ì ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÍ•½¹‘Ì€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•¹•ÑM•½¹‘Ì ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€Í¡•‘Õ±•‘Q¥µ•1…‰•°€ô(€€€€€€€€€€€€€€€µ¥±¥Ñ…Éä(€€€€€€€€€€€€€€€€€€€€ü€ (€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ¡¡½ÕÉÌ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€è€ (€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¡½ÕÉÌ€”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÄÈñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÄÈ(€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¡½ÕÉÌ€øô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÄÈ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰A4ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰4ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ½Õ¹Ñ‘½Ý¹1…‰•°¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€‰Q¥µ”U¹Ñ¥°€ˆ€¬(€€€€€€€€€€€Í¡•‘Õ±•‘Q¥µ•1…‰•°ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ½Õ¹Ñ‘½Ý¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ€ð(€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€€€€€ü€ˆ´ˆ(€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€¤€¬(€€€€€€€€€€€™½Éµ…ÑÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€5…Ñ ¹…‰Ì (€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É‘Y…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€‘¥ÍÁ±…å±½­Q¥µ•ÉÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€ˆ´´´ˆì(€€€€€€€½¹ÍÐÍ¡•‘Õ±•‘Q¥µ•I•…¡•€ôÉ•µ…¥¹¥¹œ€ðô€Àì(€€€€€€€½¹ÍÐ…¹MÑ…ÉÐ€ôÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ¡ÑÉ¥ÁÉ…™Ð¤ì(€€€€€€€¥˜€¡Í¡•‘Õ±•‘Q¥µ•I•…¡•€˜˜Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€˜˜…¹MÑ…ÉÐ¤ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô™…±Í”ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹¡•­•€ô™…±Í”ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€€€€€€€€€Ù½¥±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥À (€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€¥˜€¡Í¡•‘Õ±•‘Q¥µ•I•…¡•¤ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô™…±Í”ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹¡•­•€ô™…±Í”ì(€€€€€€€ô(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹‘¥Í…‰±•€ôÍ¡•‘Õ±•‘Q¥µ•I•…¡•ì(€€€€€€€½¹ÍÐµ¥ÍÍ¥¹I•ÅÕ¥É•‘MÑ…¹‘…É€ôÍ¡•‘Õ±•‘Q¥µ•I•…¡•€˜˜€……¹MÑ…ÉÐì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Ü¹‘¥Í…‰±•€ôµ¥ÍÍ¥¹I•ÅÕ¥É•‘MÑ…¹‘…Éì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ=¹Q¥µ”¹‘¥Í…‰±•€ôµ¥ÍÍ¥¹I•ÅÕ¥É•‘MÑ…¹‘…Éì(€€€€€€€¥˜€¡µ¥ÍÍ¥¹I•ÅÕ¥É•‘MÑ…¹‘…É¤ì(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¸€ôÑÉÕ”ì(€€€€€€€€€€€¥˜€ …Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¹••‘ÌµÙ…±Õ”ˆ¤¤™±…M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½ÝM¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¡íÉ•Í½±ÕÑ¥½¸õ™…±Í•ôõíô¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¸€ô	½½±•…¸¡É•Í½±ÕÑ¥½¸¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½=ÁÑ¥½¸¹¡¥‘‘•¸€ôÉ•Í½±ÕÑ¥½¸ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ…¹•°¹¡¥‘‘•¸€ôÉ•Í½±ÕÑ¥½¸ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ=¹Q¥µ”¹¡¥‘‘•¸€ô€…É•Í½±ÕÑ¥½¸ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Ü¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹¡•­•€ôÍ¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Ü¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ=¹Q¥µ”¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ5•ÍÍ…”¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ‰¹••‘ÌµÙ…±Õ”ˆ¤ì(€€€€€€€ÕÁ‘…Ñ•M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì(€€€€€€€ÍÑ½ÁM¡•‘Õ±•‘MÑ…ÉÑQ¥­•È ¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑQ¥­•È€ôÍ•Ñ%¹Ñ•ÉÙ…°¡ÕÁ‘…Ñ•M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°€ÈÔÀ¤ì(€€€€€€€¥˜€ …Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¹½Á•¸¤½Á•¹¥…±½±•µ•¹Ð¡Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°íÉ•…Í½¸éÉ•Í½±ÕÑ¥½¸ü‰Í¡•‘Õ±•µÍÑ…ÉÐµÉ•Í½±ÕÑ¥½¸ˆè‰•…É±äµÍÑ…ÉÐ‰ô¤ì(€€€€€€€Í¡•‘Õ±•M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹•±M¡•‘Õ±•‘MÑ…ÉÑAÉ½µÁÐ ¤ì(€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô™…±Í”ì(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¸€ô™…±Í”ì(€€€€€€€ÍÑ½ÁM¡•‘Õ±•‘MÑ…ÉÑQ¥­•È ¤ì(€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€¥˜€¡Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¹½Á•¸¤±½Í•¥…±½œ¡Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°íÉ•…Í½¸è‰Í¡•‘Õ±•µÍÑ…ÉÐµ…¹•°‰ô¤ì(€€€ô((€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰¡…¹”ˆ°(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€‰¡…¹•M¡•‘Õ±•‘MÑ…ÉÑÕÑ½%¹ÁÕÐˆ°(€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹¡…¹•M¡•‘Õ±•‘MÑ…ÉÑÕÑ¼ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¡•­•(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤(€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Ü°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Á9½Ý±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Àˆ°(€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€‰¹½Üˆ(€€€€€€€€€€€€€€€t(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ=¹Q¥µ”°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Á=¹Q¥µ•±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Àˆ°(€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€t(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ…¹•°°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰…¹•±M¡•‘Õ±•‘MÑ…ÉÑ±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰…¹•±M¡•‘Õ±•‘MÑ…ÉÐˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ±½Í”°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰±½Í•M¡•‘Õ±•‘MÑ…ÉÑ±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰…¹•±M¡•‘Õ±•‘MÑ…ÉÐˆ(€€€€€€€ô¤ì((€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰…¹•°ˆ°(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€‰…¹•±M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œˆ°(€€€€€€€€€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹…¹•±M¡•‘Õ±•‘MÑ…ÉÐ ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ•‘¥Ñ½É±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èˆ(€€€€€€€ô¤ì((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ¡‘É…™Ð€ôÑÉ¥ÁÉ…™Ð¤ì(€€€€€€€¥˜€ …‘É…™Ðñð€…Á…ÉÍ•…Ñ•%¹ÁÕÐ¡‘É…™Ð¹É•…Ñ¥½¹…Ñ”¤¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€½¹ÍÐÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€‘É…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€½¹ÍÐÉ•…Ñ¥½¹Q¥µ”€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹É•…Ñ¥½¹Q¥µ”¤ì(€€€€€€€½¹ÍÐÍ¡•‘Õ±•‘MÑ…ÉÐ€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐ¤ì(€€€€€€€½¹ÍÐ…ÑÕ…±MÑ…ÉÐ€ôÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ”¡‘É…™Ð¹ÍÑ…ÉÑQ¥µ”¤ì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€ (€€€€€€€€€€€€€€€‘É…™Ð¹‘•™•ÉÉ•ñð(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ø€À(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•…Ñ¥½¹Q¥µ”¤€˜˜É•…Ñ¥½¹Q¥µ”€øô€À€˜˜É•…Ñ¥½¹Q¥µ”€ð€ÈÐ€¨€ØÀ€¨€ØÀ€¨€ÄÀÀÀ€˜˜(€€€€€€€€€€€€¡‘É…™Ð¹‘•™•ÉÉ•ñð€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡Í¡•‘Õ±•‘MÑ…ÉÐ¤€˜˜Í¡•‘Õ±•‘MÑ…ÉÐ€øô€À€˜˜(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡…ÑÕ…±MÑ…ÉÐ¤€˜˜…ÑÕ…±MÑ…ÉÐ€øô€À¤¤(€€€€€€€€¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÍÑ…ÉÑQÉ¥ÁÉ…™Ð ¤ì(€€€€€€€½¹ÍÐ‘É…™Ð€ôÑÉ¥ÁÉ…™Ðì(€€€€€€€¥˜€¡‘É…™Ðü¹‘•™•ÉÉ•¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€¥˜€ (€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€ü¹½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”(€€€€€€€€¤ì(€€€€€€€€€€€…Ý…¥Ð‘É…™Ð(€€€€€€€€€€€€€€€€¹½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”ì((€€€€€€€€€€€¥˜€¡ÑÉ¥ÁÉ…™Ð€„ôô‘É…™Ð¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€‘É…™Ðü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì((€€€€€€€¥˜€ (€€€€€€€€€€€€…9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ñð(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ðô€Àñð(€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ¡‘É…™Ð¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€±½­Q¥µ•È¹½¹™¥ÕÉ”¡í…ÕÑ½}½…°è	½½±•…¸¡‘É…™Ð¹Íå¹½…±Ì¥ô¤ì(€€€€€€€±½­Q¥µ•È¹¥¹Ñ•ÉÙ…±±…ÁÍ•‘	•¡…Ù¥½È€ô€‰ÍÑ…ÉÑ1…Ñ•¹äˆì(€€€€€€€±½­Q¥µ•È¹…ÕÑ½I•ÍÑ…ÉÑQÉ¥Á™Ñ•É1…Ñ•	É•…¬€ô(€€€€€€€€€€€‘É…™Ð¹±…Ñ•	É•…­	•¡…Ù¥½È€ôôô€‰…ÕÑ½I•ÍÑ…ÉÑQÉ¥Àˆì((€€€€€€€¥˜€¡‘É…™Ð¹Íå¹½…±Ì¤ì(€€€€€€€€€€€½¹ÍÐ…±•¹‘…È€ô…Ý…¥ÐÉ•Í½±Ù•QÉ¥Á1½…±•¹‘…È ¤ì(€€€€€€€€€€€½¹ÍÐÝ¥¹‘½Ü€ô…±•¹‘…ÉI…¹”¹ÑÉ¥Á]¥¹‘½Ü¡…±•¹‘…È¤ì(€€€€€€€€€€€ÑÉäì…Ý…¥ÐÕÁ‘…Ñ•QÉ¥ÁQ½Ñ…±Ì¡Ý¥¹‘½Ü¤ìô(€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì¥˜€ …•ÉÉ½È¹±½­Q¥µ•É=™™±¥¹”¤Ñ¡É½Ü•ÉÉ½Èìô(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€¹•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸€ôôô(€€€€€€€€€€€€€€€ÑÉÕ”€˜˜(€€€€€€€€€€€‘É…™Ð(€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Ü€ôôô(€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(€€€€€€€€€€€€¼¼Q¡”€Ôµ¹½Ñ”ÑÉ…¹Í¥Ñ¥½¸¹½Éµ…±±äÁÉ•±½…‘Ì½¹”ÍÕÁÁÉ•ÍÍ¥½¸™½È(€€€€€€€€€€€€¼¼Ñ¡”ÕÁ½µ¥¹œMÑ…ÉÐQÉ¥ÀÕ”¸%˜ÑÕ…°MÑ…ÉÐ¥ÌÁÕÍ¡•Ñ¼9½Ü°(€€€€€€€€€€€€¼¼…¹•°Ñ¡…Ð½¹”µÍ¡½ÐÍÕÁÁÉ•ÍÍ¥½¸Í¼Ñ¡”¹½Éµ…°ÍÑ…ÉÐ¡¥µ”¥Ì(€€€€€€€€€€€€¼¼…±±½Ý•Ñ¼Á±…ä…ÌÑ¡”Í•½¹¡¥µ”¸(€€€€€€€€€€€…¹•±M•µ…¹Ñ¥¥Í…‰±” (€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€…Ý…¥Ð±½­Q¥µ•È¹ÍÑ…ÉÐ¡ì(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€É•…Ñ¥½¹…Ñ”è‘É…™Ð¹É•…Ñ¥½¹…Ñ”°(€€€€€€€€€€€¹½¹AÉ½‘ÕÑ¥½¸è‘É…™Ð¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”°(€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”è‘É…™Ð¹É•…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐè‘É…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”è‘É…™Ð¹ÍÑ…ÉÑQ¥µ”(€€€€€€€ô¤ì(€€€€€€€¥˜€¡‘É…™Ð¹É•…Ñ¥½¹…Ñ”€˜˜±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€„ôô‘É…™Ð¹É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€€€€€±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€ô‘É…™Ð¹É•…Ñ¥½¹…Ñ”ì(€€€€€€€ô((€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€ÑÉ¥ÁÉ…™Ð€ôÕ¹‘•™¥¹•ì(€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì(€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬¹±•¹Ñ €ô€Àì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô(((€€€™Õ¹Ñ¥½¸±½¹•QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì¡Ù…±Õ•Ì¤ì(€€€€€€€É•ÑÕÉ¸Ù…±Õ•Ì€üì€¸¸¹Ù…±Õ•Ìô€èÕ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑÕÉÉ•¹ÑQÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€½¹ÍÐ±¥Ù”€ôÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€½¹ÍÐ‘É…™Ð€ô€…±¥Ù”€üÑÉ¥ÁÉ…™Ð€èÕ¹‘•™¥¹•ì(€€€€€€€¥˜€ …±¥Ù”€˜˜€…‘É…™Ð¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìè±¥Ù”(€€€€€€€€€€€€€€€€ü±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€è‘É…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”è±¥Ù”€ü€¡±½­Q¥µ•È¹É•…Ñ¥½¹Q¥µ”ñð€ˆˆ¤€è€¡‘É…™Ð¹É•…Ñ¥½¹Q¥µ”ñð€ˆˆ¤°(€€€€€€€€€€€É•…Ñ¥½¹…Ñ”è±¥Ù”€ü€¡±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”ñð€ˆˆ¤€è€¡‘É…™Ð¹É•…Ñ¥½¹…Ñ”ñð€ˆˆ¤°(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐè±¥Ù”€ü€¡±½­Q¥µ•È¹Í¡•‘Õ±•‘MÑ…ÉÐñð€ˆˆ¤€è€¡‘É…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐñð€ˆˆ¤°(€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”è±¥Ù”€ü€¡±½­Q¥µ•È¹ÍÑ…ÉÑQ¥µ”ñð€ˆˆ¤€è€¡‘É…™Ð¹ÍÑ…ÉÑQ¥µ”ñð€ˆˆ¤°(€€€€€€€€€€€‘•™•ÉÉ•è€…±¥Ù”€˜˜	½½±•…¸¡‘É…™Ð¹‘•™•ÉÉ•¤°(€€€€€€€€€€€¹½¹AÉ½‘ÕÑ¥½¸è±¥Ù”€ü±½­Q¥µ•È¹¹½¹AÉ½‘ÕÑ¥½¸€è‘É…™Ð¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”°(€€€€€€€€€€€Íå¹½…±Ìè±¥Ù”(€€€€€€€€€€€€€€€€ü	½½±•…¸¡±½­Q¥µ•È¹…ÕÑ½Må¹QÉ¥Á½…°¤(€€€€€€€€€€€€€€€€è	½½±•…¸¡‘É…™Ð¹Íå¹½…±Ì¤(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€¥˜€¡ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¤É•ÑÕÉ¸ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ô•ÑÕÉÉ•¹ÑQÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€¥˜€ …Ù…±Õ•Ì¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôì(€€€€€€€€€€€±¥Ù”èÑÉ¥Á%Í1¥Ù” ¤°(€€€€€€€€€€€½É¥¥¹…°è±½¹•QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì¡Ù…±Õ•Ì¤°(€€€€€€€€€€€Ù…±Õ•Ìè±½¹•QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì¡Ù…±Õ•Ì¤°(€€€€€€€€€€€ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Üè™…±Í”(€€€€€€€ôì(€€€€€€€É•ÑÕÉ¸ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑQÉ¥ÁM•ÑÑ¥¹Í…¹‘¥‘…Ñ•É…™Ð ¤ì(€€€€€€€¥˜€ …ÑÉ¥ÁÉ…™Ð¤É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ìì(€€€€€€€¥˜€ …Ù…±Õ•Ì¤É•ÑÕÉ¸ÑÉ¥ÁÉ…™Ðì(€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€¸¸¹ÑÉ¥ÁÉ…™Ð°(€€€€€€€€€€€‘•™•ÉÉ•è	½½±•…¸¡Ù…±Õ•Ì¹‘•™•ÉÉ•¤°(€€€€€€€€€€€¹½¹AÉ½‘ÕÑ¥½¸èÙ…±Õ•Ì¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”°(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘ÌèÙ…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”èÙ…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€É•…Ñ¥½¹…Ñ”èÙ…±Õ•Ì¹É•…Ñ¥½¹…Ñ”°(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐèÙ…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”èÙ…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”°(€€€€€€€€€€€Íå¹½…±Ìè	½½±•…¸¡Ù…±Õ•Ì¹Íå¹½…±Ì¤(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑQÉ¥ÁQ¥µ•=¹±ä¡Ù…±Õ”°É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€½¹ÍÐ™½Éµ…ÑÑ•€ô™½Éµ…ÑQÉ¥ÁQ¥µ•¥ÍÁ±…ä¡Ù…±Õ”°É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€É•ÑÕÉ¸™½Éµ…ÑÑ•€ôôô€ˆ´´´ˆ€ü™½Éµ…ÑÑ•€è™½Éµ…ÑÑ•¹ÍÁ±¥Ð ˆƒ
Ü€ˆ¥lÁtì(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹QÉ¥ÁMÑ…ÉÑÍ9½Ý	ÕÑÑ½¹½¹Ñ•¹Ð¡…Ñ¥Ù”¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝMÑ…ÉÑ½Áäñð(€€€€€€€€€€€€…ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝY…±Õ•½Áäñð(€€€€€€€€€€€€…ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý9½Ý1…‰•°ñð(€€€€€€€€€€€€…ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝQ¥µ•ÍÑ…µÁ1…‰•°(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜€¡…Ñ¥Ù”€˜˜ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”ü¹±…‰•°¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝQ¥µ•ÍÑ…µÁ1…‰•°¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¹±…‰•°ì(€€€€€€€ô(€€€€€€€•±Í”¥˜€ …ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝQ¥µ•ÍÑ…µÁ1…‰•°¹Ñ•áÑ½¹Ñ•¹Ð€ô€ˆˆì(€€€€€€€ô((€€€€€€€€¼¼1…å½ÕÐÝ¥‘Ñ¡ÌÍÑ…äÕ¹Í…±•Ý¡¥±”Ñ¡”‘¥…±½œ…¹¥µ…Ñ•Ì¥¹Ñ¼Ù¥•Ü¸(€€€€€€€½¹ÍÐµ•…ÍÕÉ•1…‰•°€ô±…‰•°€ôøì(€€€€€€€€€€€½¹ÍÐÁÉ½‰”€ô‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð ‰ÍÁ…¸ˆ¤ì(€€€€€€€€€€€ÁÉ½‰”¹Ñ•áÑ½¹Ñ•¹Ð€ô±…‰•°¹Ñ•áÑ½¹Ñ•¹Ðì(€€€€€€€€€€€ÁÉ½‰”¹ÍÑå±”¹ÍÍQ•áÐ€ô€‰Á½Í¥Ñ¥½¸é…‰Í½±ÕÑ”íÙ¥Í¥‰¥±¥Ñäé¡¥‘‘•¸íÁ½¥¹Ñ•Èµ•Ù•¹ÑÌé¹½¹”íÝ¥‘Ñ éµ…àµ½¹Ñ•¹ÐíÝ¡¥Ñ”µÍÁ…”é¹½ÝÉ…Àí™½¹Ðé¥¹¡•É¥Ðìˆì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹…ÁÁ•¹¡ÁÉ½‰”¤ì(€€€€€€€€€€€½¹ÍÐÝ¥‘Ñ €ôÁÉ½‰”¹ÍÉ½±±]¥‘Ñ ì(€€€€€€€€€€€ÁÉ½‰”¹É•µ½Ù” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Ý¥‘Ñ ì(€€€€€€€ôì(€€€€€€€½¹ÍÐ™Õ±±]¥‘Ñ €ô€…ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝÑ¥½¹Ì¹±…ÍÍ1¥ÍÐ¹½¹Ñ…¥¹Ì ‰¥ÌµÍ•±•Ñ¥¹œˆ¤€˜˜(€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œì(€€€€€€€½¹ÍÐÍÑ…ÉÑ]¥‘Ñ €ô™Õ±±]¥‘Ñ €üµ•…ÍÕÉ•1…‰•°¡ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝMÑ…ÉÑ½Áä¤€è€Àì(€€€€€€€½¹ÍÐ¹½Ý]¥‘Ñ €ô™Õ±±]¥‘Ñ €üµ•…ÍÕÉ•1…‰•°¡ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý9½Ý1…‰•°¤€è€Àì(€€€€€€€½¹ÍÐÑ¥µ•ÍÑ…µÁ]¥‘Ñ €ô(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝQ¥µ•ÍÑ…µÁ1…‰•°¹ÍÉ½±±]¥‘Ñ ì((€€€€€€€¥˜€¡ÍÑ…ÉÑ]¥‘Ñ €ø€À¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥Àµ¹½ÜµÍÑ…ÉÐµ½ÁäµÝ¥‘Ñ ˆ°(€€€€€€€€€€€€€€€€‘íÍÑ…ÉÑ]¥‘Ñ¡õÁá€(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€¥˜€¡¹½Ý]¥‘Ñ €ø€À¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥Àµ¹½Üµ¹½ÜµÝ¥‘Ñ ˆ°(€€€€€€€€€€€€€€€€‘í¹½Ý]¥‘Ñ¡õÁá€(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€¥˜€¡Ñ¥µ•ÍÑ…µÁ]¥‘Ñ €ø€À¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹ÍÑå±”¹Í•ÑAÉ½Á•ÉÑä (€€€€€€€€€€€€€€€€ˆ´µÑÉ¥Àµ¹½ÜµÑ¥µ•ÍÑ…µÀµÝ¥‘Ñ ˆ°(€€€€€€€€€€€€€€€€‘íÑ¥µ•ÍÑ…µÁ]¥‘Ñ¡õÁá€(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý9½Ý1…‰•°¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µ¡¥‘‘•¸ˆ°(€€€€€€€€€€€MÑÉ¥¹œ¡…Ñ¥Ù”¤(€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝQ¥µ•ÍÑ…µÁ1…‰•°¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µ¡¥‘‘•¸ˆ°(€€€€€€€€€€€MÑÉ¥¹œ ……Ñ¥Ù”¤(€€€€€€€€¤ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€‰…É¥„µ±…‰•°ˆ°(€€€€€€€€€€€…Ñ¥Ù”€˜˜ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”ü¹±…‰•°(€€€€€€€€€€€€€€€€üM•ÐQ¼€‘íÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¹±…‰•±õ€(€€€€€€€€€€€€€€€€è€‰M•ÐM¡•‘Õ±•½ÑÕ…°MÑ…ÉÐÑ¼9½Üˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹QÉ¥ÁMÑ…ÉÑÍ9½ÝU$ ¤ì(€€€€€€€½¹ÍÐ‘É…™Ð€ô€…ÑÉ¥Á%Í1¥Ù” ¤€üÑÉ¥ÁÉ…™Ð€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐ…Ñ¥Ù”€ô	½½±•…¸¡‘É…™Ð€˜˜ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¤ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ìì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝÑ¥½¹Ì¹¡¥‘‘•¸€ô€…‘É…™Ðì(€€€€€€€€¼¼5•…ÍÕÉ”Ñ¡”±…‰•±Ì‰•™½É”¡…¹¥¹œ±…å½ÕÐÍ¼•Ù•ÉäÑÉ…¹Í¥Ñ¥½¸ÍÑ…ÉÑÌÑ½•Ñ¡•È¸(€€€€€€€Íå¹QÉ¥ÁMÑ…ÉÑÍ9½Ý	ÕÑÑ½¹½¹Ñ•¹Ð¡…Ñ¥Ù”¤ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝÑ¥½¹Ì¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÍ•±•Ñ¥¹œˆ°…Ñ¥Ù”¤ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½ÝÑ¥½¹Ì¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥Ìµ•á¥Ñ¥¹œˆ°ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ¤ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý…¹•°¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý…¹•°¹‘¥Í…‰±•€ô€……Ñ¥Ù”ì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý…¹•°¹Ñ…‰%¹‘•à€ô…Ñ¥Ù”€ü€À€è€´Äì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý…¹•°¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°MÑÉ¥¹œ ……Ñ¥Ù”¤¤ì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¥ÌµÍ•ÑÑ¥¹œµÍÑ…ÉÑÌµ¹½Üˆ°…Ñ¥Ù”¤ì((€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹ÅÕ•ÉåM•±•Ñ½É±° ˆ¹ÑÉ¥ÀµÑ¥µ”µ•‘¥Ðˆ¤¹™½É… ¡‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€‰ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Ñ…‰%¹‘•à€ô…Ñ¥Ù”€ü€´Ä€è€Àì(€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°MÑÉ¥¹œ¡…Ñ¥Ù”¤¤ì(€€€€€€€ô¤ì((€€€€€€€ÑÉ¥ÁMÑ…ÉÑ9½ÝQ½±•Ì¹™½É… ¡‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€½¹ÍÐ­•ä€ô‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÑÉ¥ÁMÑ…ÉÑ9½ÝQ…É•Ð€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€ü€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€€è€‰…ÑÕ…°ˆì(€€€€€€€€€€€½¹ÍÐÍ•±•Ñ•€ô	½½±•…¸¡…Ñ¥Ù”€˜˜ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ•m­•åt¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Ñ…‰%¹‘•à€ô…Ñ¥Ù”€ü€À€è€´Äì(€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ¡¥‘‘•¸ˆ°MÑÉ¥¹œ ……Ñ¥Ù”¤¤ì(€€€€€€€€€€€‰ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ôÍ•±•Ñ•€ü€‹ŠrLˆ€è€ˆ´ˆì(€€€€€€€€€€€‰ÕÑÑ½¸¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µÁÉ•ÍÍ•ˆ°MÑÉ¥¹œ¡Í•±•Ñ•¤¤ì(€€€€€€€ô¤ì((€€€€€€€¥˜€ ……Ñ¥Ù”¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹‘¥Í…‰±•€ô(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€‘É…™Ð€˜˜(€€€€€€€€€€€€€€€€€€€€…Á…ÉÍ•…Ñ•%¹ÁÕÐ (€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ìü¹É•…Ñ¥½¹…Ñ”ñð(€€€€€€€€€€€€€€€€€€€€€€€‘É…™Ð¹É•…Ñ¥½¹…Ñ”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹‘¥Í…‰±•€ô(€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¹Í¡•‘Õ±•€˜˜(€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¹…ÑÕ…°ì(€€€ô((€€€™Õ¹Ñ¥½¸™¥¹¥Í¡QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ¡ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥ÑQ¥µ•È¤ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥ÑQ¥µ•È€ôÕ¹‘•™¥¹•ì(€€€€€€€¥˜€ …ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ¤É•ÑÕÉ¸ì((€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ€ô™…±Í”ì(€€€€€€€¥˜€ …ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”¤Íå¹QÉ¥ÁMÑ…ÉÑÍ9½ÝU$ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰•¥¹QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì(€€€€€€€¥˜€ …ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”ñðÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ¤É•ÑÕÉ¸ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ¡ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥ÑQ¥µ•È¤ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ€ôÑÉÕ”ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì((€€€€€€€½¹ÍÐ¡…¹‘±•QÉ…¹Í¥Ñ¥½¹¹€ô•Ù•¹Ð€ôøì(€€€€€€€€€€€¥˜€¡•Ù•¹Ð¹Ñ…É•Ð€„ôôÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Üñð•Ù•¹Ð¹ÁÉ½Á•ÉÑå9…µ”€„ôô€‰™±•àµ‰…Í¥Ìˆ¤É•ÑÕÉ¸ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È ‰ÑÉ…¹Í¥Ñ¥½¹•¹ˆ°¡…¹‘±•QÉ…¹Í¥Ñ¥½¹¹¤ì(€€€€€€€€€€€™¥¹¥Í¡QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì(€€€€€€€ôì(€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÑÉ…¹Í¥Ñ¥½¹•¹ˆ°¡…¹‘±•QÉ…¹Í¥Ñ¥½¹¹¤ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥ÑQ¥µ•È€ôÍ•ÑQ¥µ•½ÕÐ  ¤€ôøì(€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È ‰ÑÉ…¹Í¥Ñ¥½¹•¹ˆ°¡…¹‘±•QÉ…¹Í¥Ñ¥½¹¹¤ì(€€€€€€€€€€€™¥¹¥Í¡QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì(€€€€€€€ô°QI%A}MQIQ}QI9M%Q%=9}UIQ%=8€¬€ÔÀ¤ì((€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•ÍÑ½É•É…™ÑÉ½µQÉ¥ÁM•ÑÑ¥¹Í=É¥¥¹…° ¤ì(€€€€€€€¥˜€ …ÑÉ¥ÁÉ…™ÐñðÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹±¥Ù”ñð€…ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹½É¥¥¹…°¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¹½É¥¥¹…°ì(€€€€€€€=‰©•Ð¹…ÍÍ¥¸¡ÑÉ¥ÁÉ…™Ð°ì(€€€€€€€€€€€‘•™•ÉÉ•è	½½±•…¸¡Ù…±Õ•Ì¹‘•™•ÉÉ•¤°(€€€€€€€€€€€¹½¹AÉ½‘ÕÑ¥½¸èÙ…±Õ•Ì¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”°(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘ÌèÙ…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”èÙ…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€É•…Ñ¥½¹…Ñ”èÙ…±Õ•Ì¹É•…Ñ¥½¹…Ñ”°(€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐèÙ…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”èÙ…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”°(€€€€€€€€€€€Íå¹½…±Ìè	½½±•…¸¡Ù…±Õ•Ì¹Íå¹½…±Ì¤(€€€€€€€ô¤ì(€€€ô((€€€™Õ¹Ñ¥½¸…ÁÁ±åQÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€½¹ÍÐÍ•ÍÍ¥½¸€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ì(€€€€€€€¥˜€ …Í•ÍÍ¥½¸¤É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÍ•ÍÍ¥½¸¹Ù…±Õ•Ìì((€€€€€€€¥˜€ …Í•ÍÍ¥½¸¹±¥Ù”¤ì(€€€€€€€€€€€¥˜€ …ÑÉ¥ÁÉ…™Ð¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€=‰©•Ð¹…ÍÍ¥¸¡ÑÉ¥ÁÉ…™Ð°ì(€€€€€€€€€€€€€€€‘•™•ÉÉ•è	½½±•…¸¡Ù…±Õ•Ì¹‘•™•ÉÉ•¤°(€€€€€€€€€€€€€€€¹½¹AÉ½‘ÕÑ¥½¸èÙ…±Õ•Ì¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”°(€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘ÌèÙ…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”èÙ…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€€€€€É•…Ñ¥½¹…Ñ”èÙ…±Õ•Ì¹É•…Ñ¥½¹…Ñ”°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐèÙ…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”èÙ…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”°(€€€€€€€€€€€€€€€Íå¹½…±Ìè	½½±•…¸¡Ù…±Õ•Ì¹Íå¹½…±Ì¤°(€€€€€€€€€€€€€€€ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Üè(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Ü€ôôô(€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€ÑÉäì(€€€€€€€€€€€¥˜€¡±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€„ôôÙ…±Õ•Ì¹É•…Ñ¥½¹…Ñ”¤±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”€ôÙ…±Õ•Ì¹É•…Ñ¥½¹…Ñ”ì(€€€€€€€€€€€¥˜€¡±½­Q¥µ•È¹É•…Ñ¥½¹Q¥µ”€„ôôÙ…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”¤±½­Q¥µ•È¹É•…Ñ¥½¹Q¥µ”€ôÙ…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”ì(€€€€€€€€€€€¥˜€¡±½­Q¥µ•È¹Í¡•‘Õ±•‘MÑ…ÉÐ€„ôôÙ…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ¤±½­Q¥µ•È¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôÙ…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐì(€€€€€€€€€€€¥˜€¡±½­Q¥µ•È¹ÍÑ…ÉÑQ¥µ”€„ôôÙ…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”¤±½­Q¥µ•È¹ÍÑ…ÉÑQ¥µ”€ôÙ…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”ì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€„ôô(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ðô€À(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€ô(€€€€€€€€€€€±½­Q¥µ•È¹¹½¹AÉ½‘ÕÑ¥½¸€ôÙ…±Õ•Ì¹¹½¹AÉ½‘ÕÑ¥½¸€ôôôÑÉÕ”ì(€€€€€€€€€€€±½­Q¥µ•È¹½¹™¥ÕÉ”¡í…ÕÑ½}½…°è	½½±•…¸¡Ù…±Õ•Ì¹Íå¹½…±Ì¥ô¤ì(€€€€€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€üü(€€€€€€€€€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸Íå¹QÉ¥ÁM•ÑÑ¥¹Í…±±•É™Ñ•ÉM…Ù” ¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹9Õµ‰•ÉA…‘MÑ…Ñ” ¤ì(€€€€€€€½¹ÍÐÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€ü¹Ù…±Õ•Ì(€€€€€€€€€€€€€€€€ü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÍÑ…Ñ”ñð(€€€€€€€€€€€ÍÑ…Ñ”¹Í½ÕÉ”€„ôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆñð(€€€€€€€€€€€€…9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€½¹ÍÐ‘¥¥ÑÌ€ô‘ÕÉ…Ñ¥½¹Y…±Õ•Q½I…Ý¥¥ÑÌ (€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€¤ì(€€€€€€€¥˜€ …‘¥¥ÑÌ¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐ¡…¹•€ô‘¥¥ÑÌ€„ôôÍÑ…Ñ”¹¥¹¥Ñ¥…°ì(€€€€€€€ÍÑ…Ñ”¹Á•¹‘¥¹œ€ô‘¥¥ÑÌì(€€€€€€€ÍÑ…Ñ”¹É•Á±…•=¹9•áÑ¥¥Ð€ô™…±Í”ì(€€€€€€€ÍÑ…Ñ”¹•Ù•É‘¥Ñ•€ô	½½±•…¸¡ÍÑ…Ñ”¹•Ù•É‘¥Ñ•ñð¡…¹•¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸±½Í•QÉ¥ÁM•ÑÑ¥¹ÍQ½9…Ù¥…Ñ¥½¸¡É•…Í½¸¤ì(€€€€€€€½¹ÍÐÉ•ÑÕÉ¹MÑ…Ñ”€ô•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹9Õµ‰•ÉA…‘MÑ…Ñ” ¤ì(€€€€€€€¥˜€¡É•ÑÕÉ¹MÑ…Ñ”¤ì(€€€€€€€€€€€…Ý…¥ÐÉ•ÍÑ½É•9Õµ‰•ÉA…‘MÑ…Ñ”¡É•ÑÕÉ¹MÑ…Ñ”°ì‘ÕÉ…Ñ¥½¸è€Àô¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ±½Í•€ô±½Í•¥…±½œ¡ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°ì(€€€€€€€€€€€É•…Í½¸°(€€€€€€€€€€€¥µµ•‘¥…Ñ”è	½½±•…¸¡É•ÑÕÉ¹MÑ…Ñ”¤(€€€€€€€ô¤ì(€€€€€€€¥˜€ …±½Í•¤ì(€€€€€€€€€€€¥˜€¡É•ÑÕÉ¹MÑ…Ñ”€˜˜¹Õµ‰•ÉA…‘¥…±½œü¹½Á•¸¤ì(€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è™…±Í”°(€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•èÑÉÕ”°(€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”èÑÉÕ”°(€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è€‰¹½¹”ˆ(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸…¹•±QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¡É•…Í½¸€ô€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ…¹•°ˆ¤ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôÕ¹‘•™¥¹•ì(€€€€€€€É•ÑÕÉ¸±½Í•QÉ¥ÁM•ÑÑ¥¹ÍQ½9…Ù¥…Ñ¥½¸¡É•…Í½¸¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€Íå¹QÉ¥ÁM•ÑÑ¥¹Í±½Õ ¤ì(€€€€€€€½¹ÍÐ±¥Ù”€ôÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€½¹ÍÐ‘É…™Ð€ô€…±¥Ù”€üÑÉ¥ÁÉ…™Ð€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐÍ•ÑÑ¥¹ÍY…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ìñð•ÑÕÉÉ•¹ÑQÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€¥˜€¡Í•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•¤Í•ÑÑ¥¹ÍY…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ€ôÍ•ÑÑ¥¹ÍY…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”ì(€€€€€€€½¹ÍÐÉ•…Ñ¥½¹…Ñ”€ôÍ•ÑÑ¥¹ÍY…±Õ•Ìü¹É•…Ñ¥½¹…Ñ”ñð‘É…™Ðü¹É•…Ñ¥½¹…Ñ”ñð±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôì(€€€€€€€€€€€€‰É•…Ñ¥½¸µÑ¥µ”ˆèÍ•ÑÑ¥¹ÍY…±Õ•Ì(€€€€€€€€€€€€€€€€ü™½Éµ…ÑQÉ¥ÁQ¥µ•¥ÍÁ±…ä¡Í•ÑÑ¥¹ÍY…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”°É•…Ñ¥½¹…Ñ”¤(€€€€€€€€€€€€€€€€è€ˆ´´´ˆ°(€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆèÍ•ÑÑ¥¹ÍY…±Õ•Ì(€€€€€€€€€€€€€€€€ü™½Éµ…ÑQÉ¥ÁQ¥µ•¥ÍÁ±…ä¡Í•ÑÑ¥¹ÍY…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ°É•…Ñ¥½¹…Ñ”¤(€€€€€€€€€€€€€€€€è€ˆ´´´ˆ°(€€€€€€€€€€€€‰…ÑÕ…°µÍÑ…ÉÐˆèÍ•ÑÑ¥¹ÍY…±Õ•Ì(€€€€€€€€€€€€€€€€ü™½Éµ…ÑQÉ¥ÁQ¥µ•¥ÍÁ±…ä¡Í•ÑÑ¥¹ÍY…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”°É•…Ñ¥½¹…Ñ”¤(€€€€€€€€€€€€€€€€è€ˆ´´´ˆ°(€€€€€€€€€€€€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆèÍ•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•(€€€€€€€€€€€€€€€€ü€ˆ´´´ˆ(€€€€€€€€€€€€€€€€è‘¥ÍÁ±…å±½­Q¥µ•ÉÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€Í•ÑÑ¥¹ÍY…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤ñð€ˆ´´´ˆ(€€€€€€€ôì((€€€€€€€€ ˆÑÉ¥ÁÉ•…Ñ¥½¹Q¥µ”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÙ…±Õ•Íl‰É•…Ñ¥½¸µÑ¥µ”‰tì(€€€€€€€€ ˆÑÉ¥ÁM¡•‘Õ±•‘MÑ…ÉÐˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÙ…±Õ•Íl‰Í¡•‘Õ±•µÍÑ…ÉÐ‰tì(€€€€€€€€ ˆÑÉ¥ÁÑÕ…±MÑ…ÉÐˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÙ…±Õ•Íl‰…ÑÕ…°µÍÑ…ÉÐ‰tì(€€€€€€€€ ˆÑÉ¥ÁMÑ…¹‘…É‘Q¥µ”ˆ¤¹Ñ•áÑ½¹Ñ•¹Ð€ôÙ…±Õ•Íl‰ÍÑ…¹‘…ÉµÑ¥µ”‰tì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±‘tˆ¤¹™½É… ¡‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•€ô€ …±¥Ù”€˜˜€…‘É…™Ð¤ñð€¡Í•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•€˜˜l‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ°€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°€‰…ÑÕ…°µÍÑ…ÉÐ‰t¹¥¹±Õ‘•Ì¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹ÑÉ¥ÁQ¥µ•¥•±¤¤ì(€€€€€€€ô¤ì(€€€€€€€€ ˆÑÉ¥ÁAÉ½‘ÕÑ¥Ù”ˆ¤¹¡•­•€ô€…Í•ÑÑ¥¹ÍY…±Õ•Ìü¹¹½¹AÉ½‘ÕÑ¥½¸ì(€€€€€€€€ ˆÑÉ¥Á•™•Èˆ¤¹¡•­•€ô	½½±•…¸¡Í•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•¤ì(€€€€€€€€ ˆÑÉ¥Á•™•Èˆ¤¹‘¥Í…‰±•€ô±¥Ù”ñð€…‘É…™Ðì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍQ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô‘É…™Ð€ü€‰9•ÜQÉ¥ÀM•ÑÑ¥¹Ìˆ€è€‰‘¥ÐQÉ¥ÀM•ÑÑ¥¹Ìˆì(€€€€€€€½¹ÍÐ™ÕÑÕÉ•QÉ¥À€ô	½½±•…¸¡‘É…™Ð€˜˜€…Í•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•€˜˜ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ¡•ÑQÉ¥ÁM•ÑÑ¥¹Í…¹‘¥‘…Ñ•É…™Ð ¤¤¤ì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹‘…Ñ…Í•Ð¹™ÕÑÕÉ•QÉ¥À€ôMÑÉ¥¹œ¡™ÕÑÕÉ•QÉ¥À¤ì(€€€€€€€¥˜€¡™ÕÑÕÉ•QÉ¥À¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹¥¹¹•É!Q50€ô™ÕÑÕÉ•QÉ¥Á±½­%½¸¡ÑÉ¥ÁÉ…™ÑÕÑÕÉ•MÑ…ÉÑ…Ñ”¡•ÑQÉ¥ÁM•ÑÑ¥¹Í…¹‘¥‘…Ñ•É…™Ð ¤¤¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°€‰I•Ù¥•Ü™ÕÑÕÉ”ÑÉ¥ÀÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Ñ¥Ñ±”€ô€‰ÕÑÕÉ”ÑÉ¥Àˆì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Ñ•áÑ½¹Ñ•¹Ð€ôÍ•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•€ü€‰•™•Èˆ€è‘É…™Ð€ü€‰MÑ…ÉÐQÉ¥Àˆ€è€‰M…Ù”ˆì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ±…‰•°ˆ°ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Ñ•áÑ½¹Ñ•¹Ð¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” ‰Ñ¥Ñ±”ˆ¤ì(€€€€€€€ô(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹Ù…±Õ”€ô‘É…™Ð€ü€‰ÍÑ…ÉÐˆ€è€‰Í…Ù”ˆì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍAÉ¥µ…Éä¹‘¥Í…‰±•€ô	½½±•…¸¡‘É…™Ð€˜˜€…ÑÉ¥ÁÉ…™Ñ…¹I•ÅÕ•ÍÑMÑ…ÉÐ¡•ÑQÉ¥ÁM•ÑÑ¥¹Í…¹‘¥‘…Ñ•É…™Ð ¤¤¤ì(€€€€€€€Íå¹QÉ¥ÁMÑ…ÉÑÍ9½ÝU$ ¤ì(€€€€€€€¥˜€¡Í•ÑÑ¥¹ÍY…±Õ•Ìü¹‘•™•ÉÉ•¤ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü¹‘¥Í…‰±•€ôÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸‘É…ÝÑÑ•¹Ñ¥½¹Q½QÉ¥Á¥•±¡™¥•±¤ì(€€€€€€€¥˜€ …™¥•±¤É•ÑÕÉ¸™…±Í”ì(€€€€€€€½¹ÍÐÉ½Ü€ôl¸¸¹ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹ÅÕ•ÉåM•±•Ñ½É±° ‰m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µÉ½Ýtˆ¥t(€€€€€€€€€€€€¹™¥¹¡…¹‘¥‘…Ñ”€ôø…¹‘¥‘…Ñ”¹‘…Ñ…Í•Ð¹ÑÉ¥ÁQ¥µ•I½Ü€ôôô™¥•±¤ì(€€€€€€€¥˜€ …É½Ü¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€ÑÉ¥Á¥•±‘ÑÑ•¹Ñ¥½¹¹¥µ…Ñ¥½¹Ì¹•Ð¡É½Ü¤ü¹…¹•° ¤ì(€€€€€€€½¹ÍÐÍÑå±”€ô•Ñ½µÁÕÑ•‘MÑå±”¡É½Ü¤ì(€€€€€€€½¹ÍÐ‰…Í•M¡…‘½Ü€ôÍÑå±”¹‰½áM¡…‘½Ü€˜˜ÍÑå±”¹‰½áM¡…‘½Ü€„ôô€‰¹½¹”ˆ(€€€€€€€€€€€€üÍÑå±”¹‰½áM¡…‘½Ü(€€€€€€€€€€€€è€‰¹½¹”ˆì(€€€€€€€½¹ÍÐÁÕ±Í•M¡…‘½Ü€ô‰…Í•M¡…‘½Ü€ôôô€‰¹½¹”ˆ(€€€€€€€€€€€€ü€ˆÀ€À€À€ÍÁàÉˆ ÈÔÔ€ÄäÐ€ÌÈ€¼€Ôà”¤°€À€À€ÈÁÁàÉˆ ÈÔÔ€ÄäÐ€ÌÈ€¼€ÈÐ”¤ˆ(€€€€€€€€€€€€è€‘í‰…Í•M¡…‘½Ýô°€À€À€À€ÍÁàÉˆ ÈÔÔ€ÄäÐ€ÌÈ€¼€Ôà”¤°€À€À€ÈÁÁàÉˆ ÈÔÔ€ÄäÐ€ÌÈ€¼€ÈÐ”¥€ì(€€€€€€€½¹ÍÐ…¹¥µ…Ñ¥½¸€ôÉ½Ü¹…¹¥µ…Ñ”¡l(€€€€€€€€€€€ì½™™Í•Ðè€À°Í…±”è€ˆÄˆ°‰½áM¡…‘½Üè‰…Í•M¡…‘½Üô°(€€€€€€€€€€€ì½™™Í•Ðè€À¸Ìà°Í…±”è€ˆÄ¸ÀÄÈˆ°‰½áM¡…‘½ÜèÁÕ±Í•M¡…‘½Üô°(€€€€€€€€€€€ì½™™Í•Ðè€Ä°Í…±”è€ˆÄˆ°‰½áM¡…‘½Üè‰…Í•M¡…‘½Üô(€€€€€€€t°ì(€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è€àÀÀ°(€€€€€€€€€€€•…Í¥¹œè€‰•…Í”µ¥¸µ½ÕÐˆ(€€€€€€€ô¤ì(€€€€€€€ÑÉ¥Á¥•±‘ÑÑ•¹Ñ¥½¹¹¥µ…Ñ¥½¹Ì¹Í•Ð¡É½Ü°…¹¥µ…Ñ¥½¸¤ì(€€€€€€€…¹¥µ…Ñ¥½¸¹™¥¹¥Í¡•(€€€€€€€€€€€€¹…Ñ   ¤€ôøíô¤(€€€€€€€€€€€€¹™¥¹…±±ä  ¤€ôøì(€€€€€€€€€€€€€€€¥˜€¡ÑÉ¥Á¥•±‘ÑÑ•¹Ñ¥½¹¹¥µ…Ñ¥½¹Ì¹•Ð¡É½Ü¤€ôôô…¹¥µ…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€ÑÉ¥Á¥•±‘ÑÑ•¹Ñ¥½¹¹¥µ…Ñ¥½¹Ì¹‘•±•Ñ”¡É½Ü¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô¤ì(€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ (€€€€€€€É•…Í½¸€ô€‰¹Õµ‰•ÈµÁ…µÍ•ÑÑ¥¹Ìˆ°(€€€€€€€ì‘ÕÉ…Ñ¥½¸€ô€ÈÔÀ°™½ÕÍ¥•±ô€ôíô(€€€€¤ì(€€€€€€€½¹ÍÐ•á¥ÍÑ¥¹M•ÍÍ¥½¸€ô	½½±•…¸¡ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸¤ì(€€€€€€€¥˜€ …•á¥ÍÑ¥¹M•ÍÍ¥½¸¤‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€¥˜€¡ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹½Á•¸¤ì(€€€€€€€€€€€¥˜€¡™½ÕÍ¥•±¤ì(€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôø‘É…ÝÑÑ•¹Ñ¥½¹Q½QÉ¥Á¥•±¡™½ÕÍ¥•±¤¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½Á•¹•€ô½Á•¹¥…±½±•µ•¹Ð¡ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°ì‘ÕÉ…Ñ¥½¸°É•…Í½¸ô¤ì(€€€€€€€¥˜€¡½Á•¹•¤Íå¹QÉ¥ÁMÑ…ÉÑÍ9½ÝU$ ¤ì(€€€€€€€¥˜€ …½Á•¹•€˜˜€…•á¥ÍÑ¥¹M•ÍÍ¥½¸¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€ô(€€€€€€€¥˜€¡½Á•¹•€˜˜™½ÕÍ¥•±¤ì(€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰½Á•¹•ˆ°€ ¤€ôøì(€€€€€€€€€€€€€€€‘É…ÝÑÑ•¹Ñ¥½¹Q½QÉ¥Á¥•±¡™½ÕÍ¥•±¤ì(€€€€€€€€€€€ô°ì½¹”èÑÉÕ”ô¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸½Á•¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸•ÑQÉ¥Á¥•±‘Y…±Õ”¡™¥•±¤ì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ìñð•ÑÕÉÉ•¹ÑQÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€¥˜€ …Ù…±Õ•Ì¤É•ÑÕÉ¸€ˆˆì(€€€€€€€¥˜€¡™¥•±€ôôô€‰É•…Ñ¥½¸µÑ¥µ”ˆ¤É•ÑÕÉ¸Ù…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”ñð€ˆˆì(€€€€€€€¥˜€¡™¥•±€ôôô€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ¤É•ÑÕÉ¸Ù…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐñð€ˆˆì(€€€€€€€¥˜€¡™¥•±€ôôô€‰…ÑÕ…°µÍÑ…ÉÐˆ¤É•ÑÕÉ¸Ù…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”ñð€ˆˆì(€€€€€€€¥˜€¡™¥•±€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ¤É•ÑÕÉ¸Ù…±Õ•Ì¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€ô((€€€™Õ¹Ñ¥½¸½Á•¹QÉ¥Á¥•±‘9Õµ‰•ÉA…¡™¥•±¤ì(€€€€€€€¥˜€¡ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ì¹‘•™•ÉÉ•€˜˜l‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°€‰…ÑÕ…°µÍÑ…ÉÐ‰t¹¥¹±Õ‘•Ì¡™¥•±¤¤É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” ¤ì(€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤€˜˜€…ÑÉ¥ÁÉ…™Ð¤É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” ¤ì(€€€€€€€½¹ÍÐ±¥Ù”€ôÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€½¹ÍÐ…‰Í½±ÕÑ”€ô™¥•±€„ôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆì(€€€€€€€½¹ÍÐÙ…±Õ•Ì€ôÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ü¹Ù…±Õ•Ìñð•ÑÕÉÉ•¹ÑQÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€€€€€½¹ÍÐÑÉ¥Á•™…Õ±ÑÌ€ô±¥Ù”(€€€€€€€€€€€€üìÉ•…Ñ¥½¹…Ñ”èÙ…±Õ•Ìü¹É•…Ñ¥½¹…Ñ”ñð±½­Q¥µ•È¹É•…Ñ¥½¹…Ñ”ô(€€€€€€€€€€€€è•ÑQÉ¥ÁM•ÑÑ¥¹Í…¹‘¥‘…Ñ•É…™Ð ¤ì(€€€€€€€É•ÑÕÉ¸½Á•¹9Õµ‰•ÉA…¡ì(€€€€€€€€€€€µ½‘”è…‰Í½±ÕÑ”€ü€‰…‰Í½±ÕÑ”ˆ€è€‰Ñ¥µ”ˆ°(€€€€€€€€€€€Í½ÕÉ”è™¥•±°(€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”è•ÑQÉ¥Á¥•±‘Y…±Õ”¡™¥•±¤°(€€€€€€€€€€€ÑÉ¥Á•™…Õ±ÑÌ°(€€€€€€€€€€€ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´è™…±Í”°(€€€€€€€€€€€É½±”è€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ°(€€€€€€€€€€€Ý½É­™±½Üè±¥Ù”€ü€‰•‘¥ÐµÑÉ¥Àˆ€è€‰¹•ÜµÑÉ¥Àˆ°(€€€€€€€€€€€…¹•±Q…É•Ðè€‰¡½µ”ˆ°(€€€€€€€€€€€½¹™¥ÉµQ…É•Ðè€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€‰…­Q…É•Ðè€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€…±±½ÝµÁÑäè™¥•±€ôôô€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ€˜˜€…±¥Ù”€˜˜ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ¡ÑÉ¥Á•™…Õ±ÑÌ¤°(€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è€À(€€€€€€€ô¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸…ÁÁ±åQÉ¥Á¥•±‘MÁ••¡Y…±Õ” (€€€€€€€™¥•±°(€€€€€€€ÍÁ½­•¹Y…±Õ”(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ(€€€€€€€€€€€€€€€€¹½Á•¸(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€ÑÉäì(€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€…Ý…¥Ð½Á•¹QÉ¥Á¥•±‘9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€™¥•±(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…½Á•¹•ñð(€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”ñð(€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…Á…ÉÍ•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ (€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€…¹•°èÑÉÕ”(€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€……Ý…¥Ð½µµ¥Ñ9Õµ‰•ÉA… ¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€…Ý…¥Ð±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€…¹•°è™…±Í”(€€€€€€€€€€€ô¤ì((€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€¥˜€¡Ù½¥•¹ÑÉåMÑ…Ñ”¤ì(€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€…¹•°èÑÉÕ”(€€€€€€€€€€€€€€€ô¤¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸‰¥¹‘9Õµ‰•ÉA…‘Ù•¹ÑÌ ¤ì(€€€€€€€½¹ÍÐ‰…­ÍÁ…”€ô(€€€€€€€€€€€€ ˆ¹Õµ‰•ÉA…‘	…­ÍÁ…”ˆ¤ì((€€€€€€€‰…­ÍÁ…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€€€€€‰‰…­ÍÁ…•9Õµ‰•ÉA…‘A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‰…­ÍÁ…•9Õµ‰•ÉA…‘Y…±Õ” ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€‰…­ÍÁ…”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€€€€€‰‰…­ÍÁ…•9Õµ‰•ÉA…‘-•å‰½…É‘±¥¬ˆ°(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‰…­ÍÁ…•9Õµ‰•ÉA…‘Y…±Õ” ¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€‰m‘…Ñ„µÑ½Õ µÑ½¹•tˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹™½É…  (€€€€€€€€€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•É‘½Ý¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ½Á9Õµ‰•ÉA…‘Q½Õ¡Q½¹” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹¡…ÍÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Í…‰±•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹Á½¥¹Ñ•É%(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍÑ…Ñ”€ôì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•±•…Í•è™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±”èÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•9Õµ‰•ÉA…‘Q½Õ¡Q½¹•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í•Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ™É•ÅÕ•¹¥•Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½Õ¡Q½¹”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ±¥Ð ˆ°ˆ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ…À¡9Õµ‰•È¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…ÉÑÉ•ÅÕ•¹¥•Ìü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™É•ÅÕ•¹¥•Ì°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ý…Ù•™½É´è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÅÕ…É”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½±Õµ”è€Ä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹Õµ‰•ÈµÁ…ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±”€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹É•±•…Í•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ½Àü¸ ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹¡…¹‘±”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¹‘±”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰9Õµ‰•ÈÁ…Ñ½¹”™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€™½È€ (€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÑåÁ”½˜(€€€€€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•É…¹•°ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•É±•…Ù”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±½ÍÑÁ½¥¹Ñ•É…ÁÑÕÉ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ½Á9Õµ‰•ÉA…‘Q½Õ¡Q½¹” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€‰m‘…Ñ„µ¹Õµ‰•Étˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€¹™½É…  (€€€€€€€€€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¹Ñ•É9Õµ‰•ÉA…‘¥¥Ðˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¹Õµ‰•È€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¹Ñ•É9Õµ‰•ÉA…‘¥¥Ðˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¹Õµ‰•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€l(€€€€€€€€€€€¹Õµ‰•ÉA…‘4°(€€€€€€€€€€€¹Õµ‰•ÉA…‘A4(€€€€€€€t¹™½É…  (€€€€€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í•Ñ9Õµ‰•ÉA…ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ•É¥‘¥•´€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í•Ñ9Õµ‰•ÉA…‘5•É¥‘¥•´ˆ°(€€€€€€€€€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ•É¥‘¥•´(€€€€€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘…Ñ”°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰¥¹ÁÕÐˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰¡…¹•9Õµ‰•ÉA…‘…Ñ•%¹ÁÕÐˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰¡…¹•9Õµ‰•ÉA…‘…Ñ”ˆ°(€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ù…±Õ”(€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘M•ÑÑ¥¹Ì°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰½Á•¹9Õµ‰•ÉA…‘M•ÑÑ¥¹ÍA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰½Á•¹9Õµ‰•ÉA…‘M•ÑÑ¥¹Ìˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹¹•Ñ¥½¸°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰É•ÍÕµ•9Õµ‰•ÉA…‘½¹¹•Ñ¥½¹A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰É•ÍÕµ•9Õµ‰•ÉA…‘½¹¹•Ñ¥½¸ˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘Y½¥”°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰ÍÝ¥Ñ¡9Õµ‰•ÉA…‘Q½Y½¥•A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰ÍÝ¥Ñ¡9Õµ‰•ÉA…‘Q½Y½¥”ˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹™¥É´°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ9Õµ‰•ÉA…‘A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ9Õµ‰•ÉA…ˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘±•…È°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰±•…É9Õµ‰•ÉA…‘A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰±•…É9Õµ‰•ÉA…‘Y…±Õ”ˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘I•Í•Ð°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰É•Í•Ñ9Õµ‰•ÉA…‘A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰É•Í•Ñ9Õµ‰•ÉA…‘Y…±Õ”ˆ(€€€€€€€€€€€ô¤ì((€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘…¹•°°(€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€‰…¹•±9Õµ‰•ÉA…‘A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰…¹•±9Õµ‰•ÉA…‘‘¥Ðˆ(€€€€€€€€€€€ô¤ì((€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰…¹•°ˆ°(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€€€€€‰…¹•±9Õµ‰•ÉA…‘¥…±½œˆ°(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…¹•±9Õµ‰•ÉA…‘‘¥Ð ¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±½Í”ˆ°€ ¤€ôøì(€€€€€€€€€€€ÍÑ½Á±±9Õµ‰•ÉA…‘Õ‘¥¼ ¤ì(€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÁÉ•Í•ÉÙ•9Õµ‰•ÉA…‘MÑ…Ñ•=¹±½Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ÁÉ•Í•ÉÙ•9Õµ‰•ÉA…‘MÑ…Ñ•=¹±½Í”€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•Í•Ñ9Õµ‰•ÉA… ¤ì(€€€€€€€ô¤ì(((€€€ô((€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰½Á•¹¥¹œˆ°€ ¤€ôøì(€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì(€€€ô¤ì((€€€ÑÉ¥ÁM•ÑÑ¥¹Í±½Õ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰±¥¬ˆ°(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€‰É•ÍÕµ•QÉ¥ÁM•ÑÑ¥¹Í½¹¹•Ñ¥½¹±¥¬ˆ°(€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í±½Õ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¹•ÑÝ½É­MÑ…ÑÕÌ€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆñð(€€€€€€€€€€€€€€€€€€€€€€€½¹¹•Ñ¥½¹±½Õ‘A¡…Í”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í•ÑÑ±•ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹É•ÍÕµ•½¹¹•Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€¤ì((€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ(€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€‰m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±‘tˆ(€€€€€€€€¤(€€€€€€€€¹™½É…  (€€€€€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥Àˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥ÁQ¥µ•¥•±ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Q¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½myµi„µèÀ´åt¬ ¸¤½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ…Ñ °(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ñ½UÁÁ•É…Í” ¤ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Ñ½ÉA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥ÁQ¥µ•¥•±(€€€€€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ü°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½ÝA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½Üˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑMÑ…ÉÑÍ9½Ý…¹•°°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰…¹•±QÉ¥ÁMÑ…ÉÑÍ9½ÝA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰…¹•±QÉ¥ÁMÑ…ÉÑÍ9½Üˆ(€€€€€€€ô¤ì((€€€ÑÉ¥ÁMÑ…ÉÑ9½ÝQ½±•Ì¹™½É…  (€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½Üˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥ÁMÑ…ÉÑ9½ÝQ…É•Ð€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰M¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰ÑÕ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€‰A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½ÝQ…É•Ðˆ°(€€€€€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥ÁMÑ…ÉÑ9½ÝQ…É•Ð(€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆÑÉ¥ÁAÉ½‘ÕÑ¥Ù”ˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰¡…¹”ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰¡…¹•QÉ¥ÁAÉ½‘ÕÑ¥Ù•%¹ÁÕÐˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰¡…¹•QÉ¥ÁAÉ½‘ÕÑ¥Ù”ˆ°(€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€•Ù•¹Ð€ôøl(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹Ñ…É•Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹¡•­•(€€€€€€€€€€€€€€€t(€€€€€€€ô¤ì((€€€™Õ¹Ñ¥½¸É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì(€€€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô€ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤ì(€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹Ñ½±” ‰¡…Ìµ‘•™•ÉÉ•µÑÉ¥Àˆ°	½½±•…¸¡ÑÉ¥ÁÉ…™Ðü¹‘•™•ÉÉ•¤¤ì(€€€€€€€‰ÕÑÑ½¸¹Ñ¥Ñ±”€ôÑÉ¥ÁÉ…™Ðü¹‘•™•ÉÉ•€ü€‰I•ÍÕµ”‘•™•ÉÉ•ÑÉ¥Àˆ€è€‰9•ÜQÉ¥Àˆì(€€€ô((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆÑÉ¥Á•™•Èˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰¡…¹”ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰¡…¹•QÉ¥Á•™•ÉÉ•‘%¹ÁÕÐˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰¡…¹•QÉ¥Á•™•ÉÉ•ˆ°(€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€•Ù•¹Ð€ôøl(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹Ñ…É•Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹¡•­•(€€€€€€€€€€€€€€€t(€€€€€€€ô¤ì((€€€ÑÉ¥ÁM•ÑÑ¥¹Í½É´¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰ÍÕ‰µ¥Ðˆ°(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€€€€€‰Í…Ù•QÉ¥ÁM•ÑÑ¥¹ÍMÕ‰µ¥Ðˆ°(€€€€€€€€€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í…Ù•QÉ¥ÁM•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð(€€€€€€€€€€€€€€€€€€€€€€€€ü¹…Ñ ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ðì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€¤ì((€€€™Õ¹Ñ¥½¸É•ÍÕµ•‘QÉ¥ÁMÑ…ÉÑÌ¡‘É…™Ð°µ½µ•¹Ð¤ì(€€€€€€€½¹ÍÐ‰…Í”€ôÁ…ÉÍ•…Ñ•%¹ÁÕÐ¡‘É…™Ð¹É•…Ñ¥½¹…Ñ”¤ì(€€€€€€€½¹ÍÐ‘…åÌ€ô€¡…Ñ”¹UQ¡µ½µ•¹Ð¹•ÑÕ±±e•…È ¤°µ½µ•¹Ð¹•Ñ5½¹Ñ  ¤°µ½µ•¹Ð¹•Ñ…Ñ” ¤¤€´(€€€€€€€€€€€…Ñ”¹UQ¡‰…Í”¹•ÑÕ±±e•…È ¤°‰…Í”¹•Ñ5½¹Ñ  ¤°‰…Í”¹•Ñ…Ñ” ¤¤¤€¼€àØÐÀÀÀÀÀì(€€€€€€€½¹ÍÐ•±…ÁÍ•€ô‘…åÌ€¨€àØÐÀÀÀÀÀ€¬€ ¡µ½µ•¹Ð¹•Ñ!½ÕÉÌ ¤€¨€ØÀ€¬µ½µ•¹Ð¹•Ñ5¥¹ÕÑ•Ì ¤¤€¨€ØÀ€¬µ½µ•¹Ð¹•ÑM•½¹‘Ì ¤¤€¨€ÄÀÀÀ€¬µ½µ•¹Ð¹•Ñ5¥±±¥Í•½¹‘Ì ¤ì(€€€€€€€½¹ÍÐÑ¥µ”€ô™½Éµ…ÑQ¥µ•±¥¹•5¥±±¥Í•½¹‘Ì¡•±…ÁÍ•¤ì(€€€€€€€É•ÑÕÉ¸ìÍ¡•‘Õ±•‘MÑ…ÉÐè‘É…™Ð¹Í¡•‘Õ±•‘MÑ…ÉÐ€üü‘É…™Ð¹É•…Ñ¥½¹Q¥µ”°ÍÑ…ÉÑQ¥µ”èÑ¥µ”ôì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸‰•¥¹9•ÝQÉ¥Á]½É­™±½Ü¡ì(€€€€€€€¥¹¥Ñ¥…±Y…±Õ”°(€€€€€€€ÑÉ¥Á5½µ•¹Ð°(€€€€€€€Í¥¹…°°(€€€€€€€¥¹ÁÕÑ5½‘”°(€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸€ô™…±Í”°(€€€€€€€½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”(€€€ô€ôíô¤ì(€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐÉ•Í•ÑAÉ½µ¥Í”€ô(€€€€€€€€€€€½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”ì((€€€€€€€¥˜€ (€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…ÑÕÌ€ôôô(€€€€€€€€€€€€€€€€‰ÍÑ½ÁÁ•ˆ€˜˜(€€€€€€€€€€€€…É•Í•ÑAÉ½µ¥Í”(€€€€€€€€¤ì(€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€¹É•Í•Ñ½µÁ±•Ñ•‘QÉ¥À ¤ì((€€€€€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍQÉ¥ÁÉ…™Ð€ô(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ðì((€€€€€€€½¹ÍÐ‘•™•ÉÉ•‘É…™Ð€ôÑÉ¥ÁÉ…™Ðü¹‘•™•ÉÉ•€üÑÉ¥ÁÉ…™Ð€èÕ¹‘•™¥¹•ì(€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬¹±•¹Ñ €ô€Àì(€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ôÕ¹‘•™¥¹•ì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐµ½µ•¹Ð€ôÑÉ¥Á5½µ•¹Ð¥¹ÍÑ…¹•½˜…Ñ”€˜˜€…9Õµ‰•È¹¥Í9…8¡ÑÉ¥Á5½µ•¹Ð¹•ÑQ¥µ” ¤¤(€€€€€€€€€€€€ü¹•Ü…Ñ”¡ÑÉ¥Á5½µ•¹Ð¹•ÑQ¥µ” ¤¤(€€€€€€€€€€€€è¹•Ü…Ñ” ¤ì(€€€€€€€½¹ÍÐÑÉ¥Á•™…Õ±ÑÌ€ô•ÑQÉ¥Á5½µ•¹Ñ•™…Õ±ÑÌ¡µ½µ•¹Ð¤ì(€€€€€€€½¹ÍÐÑÉ¥ÁAÉ•™•É•¹•Ì€ô•ÑQÉ¥ÁAÉ•™•É•¹•Ì ¤ì(€€€€€€€±•Ð¥¹¥Ñ¥…±MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì((€€€€€€€¥˜€ (€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”€„ôô(€€€€€€€€€€€€€€€Õ¹‘•™¥¹•€˜˜(€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”€„ôô(€€€€€€€€€€€€€€€¹Õ±°(€€€€€€€€¤ì(€€€€€€€€€€€¥¹¥Ñ¥…±MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€ü¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€€€€€èÑåÁ•½˜¥¹¥Ñ¥…±Y…±Õ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€üÁ…ÉÍ•Q¥µ•±¥¹•Q¥µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€ô(€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…ÑÕÌ€„ôô(€€€€€€€€€€€€€€€€‰ÍÑ½ÁÁ•ˆ(€€€€€€€€¤ì(€€€€€€€€€€€¥¹¥Ñ¥…±MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€ô(€€€€€€€ÑÉ¥ÁÉ…™Ð€ô‘•™•ÉÉ•‘É…™Ð€üì(€€€€€€€€€€€€¸¸¹‘•™•ÉÉ•‘É…™Ð°(€€€€€€€€€€€‘•™•ÉÉ•è™…±Í”°(€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸è(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸(€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€¸¸¹É•ÍÕµ•‘QÉ¥ÁMÑ…ÉÑÌ¡‘•™•ÉÉ•‘É…™Ð°µ½µ•¹Ð¤(€€€€€€€ô€èì(€€€€€€€€€€€€¸¸¹ÑÉ¥Á•™…Õ±ÑÌ°(€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìè(€€€€€€€€€€€€€€€¥¹¥Ñ¥…±MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€±…Ñ•	É•…­	•¡…Ù¥½ÈèÑÉ¥ÁAÉ•™•É•¹•Ì¹±…Ñ•	É•…­	•¡…Ù¥½È°(€€€€€€€€€€€Íå¹½…±ÌèÑÉ¥ÁAÉ•™•É•¹•Ì¹Íå¹½…±Ì°(€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸è(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸(€€€€€€€€€€€€€€€€¤(€€€€€€€ôì((€€€€€€€¥˜€ (€€€€€€€€€€€É•Í•ÑAÉ½µ¥Í”€˜˜(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€¤ì(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€¹½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”€ô(€€€€€€€€€€€€€€€É•Í•ÑAÉ½µ¥Í”ì(€€€€€€€ô((€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì(€€€€€€€±•ÐÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”ì(€€€€€€€ÑÉäì(€€€€€€€€€€€ÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”€ôAÉ½µ¥Í”(€€€€€€€€€€€€€€€€¹É•Í½±Ù” (€€€€€€€€€€€€€€€€€€€É•Í•ÑAÉ½µ¥Í”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€‘•™•ÉÉ•‘É…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹œè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ•Á…É•QÉ¥À¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•½ÕÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÔÀÀÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹…Ñ   ¤€ôø€¡ì(€€€€€€€€€€€€€€€€€€€Á•ÉÍ¥ÍÑ•è™…±Í”°(€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹œèÑÉÕ”°(€€€€€€€€€€€€€€€€€€€É•…Í½¸è€‰½™™±¥¹”ˆ(€€€€€€€€€€€€€€€ô¤¤ì(€€€€€€€ô(€€€€€€€…Ñ ì(€€€€€€€€€€€ÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”€ôAÉ½µ¥Í”¹É•Í½±Ù”¡ì(€€€€€€€€€€€€€€€Á•ÉÍ¥ÍÑ•è™…±Í”°(€€€€€€€€€€€€€€€Á•¹‘¥¹œèÑÉÕ”°(€€€€€€€€€€€€€€€É•…Í½¸è€‰½™™±¥¹”ˆ(€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€…Ý…¥Ð½Á•¹Y…±Õ•‘¥Ñ½È (€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€µ½‘”è€‰Ñ¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€Í½ÕÉ”è€‰¹•ÜµÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€‘•™•ÉÉ•‘É…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÑÉ¥ÁÉ…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è¥¹¥Ñ¥…±MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€€€€€€€€€ÁÉ•Á…É…Ñ¥½¹AÉ½µ¥Í”°(€€€€€€€€€€€€€€€€€€€ÑÉ¥Á•™…Õ±ÑÌè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð°(€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑÍQÉ¥Á=¹½¹™¥É´è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€É½±”è€‰É½½Ðˆ°(€€€€€€€€€€€€€€€€€€€Ý½É­™±½Üè€‰¹•ÜµÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€…¹•±Q…É•Ðè€‰¡½µ”ˆ°(€€€€€€€€€€€€€€€€€€€½¹™¥ÉµQ…É•Ðè€‰¡½µ”ˆ°(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€À(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€ÈÔÀ°(€€€€€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…½Á•¹•€˜˜(€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•(€€€€€€€€¤ì(€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€ô(€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍQÉ¥ÁÉ…™Ðì((€€€€€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸½Á•¹•ì(€€€ô((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹MÑ…ÉÑ5•¹ÕA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹MÑ…ÉÑ5•¹Ôˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰•¹‘QÉ¥ÁA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰•¹‘QÉ¥Àˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€‰É•…­	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹	É•…­5•¹ÕA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹	É•…­5•¹Ôˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€‘½Ý¹	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ½Ý¹Q¥µ•A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ½Ý¹Q¥µ”ˆ(€€€€€€€ô¤ì((€€€‘½Ý¹•Ñ…¥±Í	ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•ÉÕÀˆ°€ ¤€ôøì(€€€€€€€½¹ÍÐÉ•™•É•¹”õ…Ñ¥Ù•½Ý¹I•™•É•¹” ¤ì(€€€€€€€¥˜¡É•™•É•¹”ü¹ÑÉ¥Á%˜™É•™•É•¹”¹¥¹Ñ•ÉÙ…±-•ä¥Ù½¥½Á•¹½Ý¹•Ñ…¥±Í5½‘…°¡É•™•É•¹”¹ÑÉ¥Á%±É•™•É•¹”¹¥¹Ñ•ÉÙ…±-•ä±í•‘¥Ñ¥¹œéÑÉÕ”±…ÁÑÕÉ”éÑÉÕ•ô¤ì(€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€‘½Ý¹	É•…­	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹½Ý¹	É•…­5•¹ÕA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹	É•…­5•¹Ôˆ°(€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸µ‰É•…¬ˆ(€€€€€€€€€€€€€€€t(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€‘½Ý¹I•ÍÕµ•	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰É•ÍÕµ•QÉ¥ÁA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰É•ÍÕµ•QÉ¥Àˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€‘½Ý¹…¹•±	ÕÑÑ½¸°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰…¹•±½Ý¹Q¥µ•A½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰…¹•±½Ý¹Q¥µ”ˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆ…¹•±½Ý¹½¹™¥Éµe•Ìˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½¹™¥Éµ…¹•±½Ý¹Q¥µ•±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½¹™¥Éµ…¹•±½Ý¹Q¥µ”ˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆ…¹•±½Ý¹½¹™¥Éµ9¼ˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½¹Ñ¥¹Õ•½Ý¹Q¥µ•±¥¬ˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½¹Ñ¥¹Õ•½Ý¹Q¥µ”ˆ(€€€€€€€ô¤ì((€€€‰É•…­¥…±½œ(€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€‰m‘…Ñ„µ‰É•…¬µÑåÁ•tˆ(€€€€€€€€¤(€€€€€€€€¹™½É…  (€€€€€€€€€€€‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸°(€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ	É•…¬ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‰É•…­QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰QåÁ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½myµi„µèÀ´åt¬ ¸¤½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ…Ñ °(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…É…Ñ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ñ½UÁÁ•É…Í” ¤ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ	É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€…ÉÌè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøl(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‰É•…­QåÁ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•Ù•¹Ñ•™…Õ±Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆÍÑ…¹‘…É‘Q¥µ•	ÕÑÑ½¸ˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹MÑ…¹‘…É‘Q¥µ•M•ÑÑ¥¹ÍA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹MÑ…¹‘…É‘Q¥µ•M•ÑÑ¥¹Ìˆ(€€€€€€€ô¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€ ˆ½…±A•É•¹ÑY…±Õ”ˆ¤°(€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€¹…µ”è(€€€€€€€€€€€€€€€€‰½Á•¹½…±‘¥Ñ½ÉA½¥¹Ñ•ÉUÀˆ°(€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€‰½Á•¹½…±‘¥Ñ½Èˆ(€€€€€€€ô¤ì((€€€…ÕÑ½½…±¥…±½œ(€€€€€€€€ü¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€‰m‘…Ñ„µ…ÕÑ¼µ½…°µÍ½Á•tˆ(€€€€€€€€¤(€€€€€€€€¹™½É… ¡‰ÕÑÑ½¸€ôøì(€€€€€€€€€€€‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€€€€€‰Á½¥¹Ñ•ÉÕÀˆ°(€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½Á”€ô(€€€€€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹…ÕÑ½½…±M½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰ÑÉ¥Àˆì((€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€…ÕÑ½½…±¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÕÑ¼µ½…°µÍ•±•Ñ•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”èÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Ù½¥½Á•¹A•É•¹Ñ½…±9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€€€€€Í½Á”(€€€€€€€€€€€€€€€€€€€€¤¹…Ñ   ¤€ôøíô¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ô¤ì((€€€™Õ¹Ñ¥½¸™½Éµ…Ñ%¹Ñ•ÉÙ…±±½¬¡µ¥±±¥Í•½¹‘Ì¤ì(€€€€€€€½¹ÍÐ¹Õµ•É¥Œ€ô9Õµ‰•È¡µ¥±±¥Í•½¹‘Ì¤ì(€€€€€€€½¹ÍÐ¹•…Ñ¥Ù”€ô9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹Õµ•É¥Œ¤€˜˜¹Õµ•É¥Œ€ð€Àì(€€€€€€€½¹ÍÐÑ½Ñ…±M•½¹‘Ì€ô5…Ñ ¹™±½½È¡5…Ñ ¹…‰Ì¡¹Õµ•É¥Œ¤€¼€ÄÀÀÀ¤ñð€Àì(€€€€€€€½¹ÍÐµ¥¹ÕÑ•Ì€ô5…Ñ ¹™±½½È¡Ñ½Ñ…±M•½¹‘Ì€¼€ØÀ¤ì(€€€€€€€½¹ÍÐÍ•½¹‘Ì€ôÑ½Ñ…±M•½¹‘Ì€”€ØÀì(€€€€€€€É•ÑÕÉ¸€‘í¹•…Ñ¥Ù”€ü€ˆ´ˆ€è€ˆ‰ô‘íµ¥¹ÕÑ•Íôè‘íMÑÉ¥¹œ¡Í•½¹‘Ì¤¹Á…‘MÑ…ÉÐ È°€ˆÀˆ¥õ€ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•Ñ¹‘QÉ¥Á	ÕÑÑ½¹%¹Ñ•ÉÙ…±A…±•ÑÑ”¡¥¹Ñ•ÉÙ…±QåÁ”¤ì(€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ô(€€€€€€€€€€€MÑÉ¥¹œ¡¥¹Ñ•ÉÙ…±QåÁ”ñð€ˆˆ¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€¥˜€¡¹½Éµ…±¥é•€ôôô€‰‰É•…¬ˆ¤ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹‰…­É½Õ¹€ô(€€€€€€€€€€€€€€€€‰Ù…È ´µÑ¥µ•Èµ‰É•…¬µ½±½È°€ŒÀÀÅ”ØÀ¤ˆì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½±½È€ô(€€€€€€€€€€€€€€€€‰Ù…È ´µÑ¥µ•Èµ‰É•…¬µÑ•áÐµ½±½È°€™™™™™˜¤ˆì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜€¡¹½Éµ…±¥é•€ôôô€‰±Õ¹ ˆ¤ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹‰…­É½Õ¹€ô(€€€€€€€€€€€€€€€€‰Ù…È ´µÑ¥µ•Èµ±Õ¹ µ½±½È°€™™ŒÈÈÀ¤ˆì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹½±½È€ô(€€€€€€€€€€€€€€€€‰Ù…È ´µÑ¥µ•Èµ±Õ¹ µÑ•áÐµ½±½È°€ŒÀÀÀÀÀÀ¤ˆì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€‰‰…­É½Õ¹ˆ(€€€€€€€€¤ì(€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹ÍÑå±”¹É•µ½Ù•AÉ½Á•ÉÑä (€€€€€€€€€€€€‰½±½Èˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ”¡¹½Ü€ô¹•Ü…Ñ” ¤¤ì(€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì(€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤¤ì(€€€€€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹¥¹Ñ•ÉÙ…±MÑ…Ñ”€ô€‰¹½¹”ˆì(€€€€€€€€€€€‘½Ý¹QÉ¥Á½¹ÑÉ½±Ì¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€ÑÉ¥ÁÑ¥½¹I½Ü¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€Í•Ñ¹‘QÉ¥Á	ÕÑÑ½¹%¹Ñ•ÉÙ…±A…±•ÑÑ” ¤ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‰¹QÉ¥Àˆì(€€€€€€€€€€€ÑÉ¥ÁÑ¥½¹I½Ü¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€‰É•…­	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€‘½Ý¹	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¥¹ÍÑ…¹Ð€ô¹½Ü¥¹ÍÑ…¹•½˜…Ñ”€˜˜€…9Õµ‰•È¹¥Í9…8¡¹½Ü¹•ÑQ¥µ” ¤¤(€€€€€€€€€€€€ü¹½Ü(€€€€€€€€€€€€è¹•Ü…Ñ” ¤ì(€€€€€€€½¹ÍÐ¥¹Ñ•ÉÙ…°€ô±½­Q¥µ•È¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”ü¸¡¥¹ÍÑ…¹Ð¤ì(€€€€€€€½¹ÍÐ¥¹Ñ•ÉÙ…±QåÁ”€ôMÑÉ¥¹œ¡¥¹Ñ•ÉÙ…°ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€¥˜€¡¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰‘½Ý¸ˆ¤ì(€€€€€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹¥¹Ñ•ÉÙ…±MÑ…Ñ”€ô€‰‘½Ý¸ˆì(€€€€€€€€€€€Í•Ñ¹‘QÉ¥Á	ÕÑÑ½¹%¹Ñ•ÉÙ…±A…±•ÑÑ” ¤ì(€€€€€€€€€€€‘½Ý¹±…ÁÍ•‘Y…±Õ”¹Ù…±Õ”€ô™½Éµ…ÑÕÉ…Ñ¥½¸¡¥¹Ñ•ÉÙ…°¹•±…ÁÍ•‘5¥±±¥Í•½¹‘Ì¤(€€€€€€€€€€€€€€€€¹É•Á±…” ½xÀ üõqè¤¼°€ˆˆ¤ì(€€€€€€€€€€€‘½Ý¹±…ÁÍ•‘Y…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô‘½Ý¹±…ÁÍ•‘Y…±Õ”¹Ù…±Õ”ì(€€€€€€€€€€€‘½Ý¹QÉ¥Á½¹ÑÉ½±Ì¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€ÑÉ¥ÁÑ¥½¹I½Ü¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€‘½Ý¹QÉ¥Á½¹ÑÉ½±Ì¹¡¥‘‘•¸€ôÑÉÕ”ì((€€€€€€€¥˜€¡¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰‰É•…¬ˆñð¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰±Õ¹ ˆ¤ì(€€€€€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹¥¹Ñ•ÉÙ…±MÑ…Ñ”€ô€‰‰É•…¬ˆì(€€€€€€€€€€€…Ñ¥Ù•QÉ¥Á½¹ÑÉ½±Ì¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹‘¥Í…‰±•€ô™…±Í”ì(€€€€€€€€€€€Í•Ñ¹‘QÉ¥Á	ÕÑÑ½¹%¹Ñ•ÉÙ…±A…±•ÑÑ” (€€€€€€€€€€€€€€€¥¹Ñ•ÉÙ…±QåÁ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ±…‰•°€ô¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰±Õ¹ ˆ€ü€‰1Õ¹ ˆ€è€‰	É•…¬ˆì(€€€€€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€¹€‘í±…‰•±ô€è€‘í™½Éµ…Ñ%¹Ñ•ÉÙ…±±½¬¡¥¹Ñ•ÉÙ…°¹É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì¥õ€ì(€€€€€€€€€€€ÑÉ¥ÁÑ¥½¹I½Ü¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€‰É•…­	ÕÑÑ½¸¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€‘½Ý¹	ÕÑÑ½¸¹¡¥‘‘•¸€ôÑÉÕ”ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹¥¹Ñ•ÉÙ…±MÑ…Ñ”€ô€‰¹½Éµ…°ˆì(€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€Í•Ñ¹‘QÉ¥Á	ÕÑÑ½¹%¹Ñ•ÉÙ…±A…±•ÑÑ” ¤ì(€€€€€€€•¹‘QÉ¥Á	ÕÑÑ½¸¹Ñ•áÑ½¹Ñ•¹Ð€ô€‰¹QÉ¥Àˆì(€€€€€€€ÑÉ¥ÁÑ¥½¹I½Ü¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€‰É•…­	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€€€€€‘½Ý¹	ÕÑÑ½¸¹¡¥‘‘•¸€ô™…±Í”ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸•¹‘ÕÉÉ•¹Ñ%¹Ñ•ÉÙ…±=ÉQÉ¥À (€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤°(€€€€€€€ì(€€€€€€€€€€€Í¥¹…°(€€€€€€€ô€ôíô(€€€€¤ì(€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô(€€€€€€€½¹ÍÐ•™™•Ñ¥Ù•Q¥µ”€ô(€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”¥¹ÍÑ…¹•½˜…Ñ”€˜˜(€€€€€€€€€€€€…9Õµ‰•È¹¥Í9…8 (€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”¹•ÑQ¥µ” ¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€ü¹•Ü…Ñ” (€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”¹•ÑQ¥µ” ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è¹•Ü…Ñ” ¤ì((€€€€€€€½¹ÍÐ¥¹Ñ•ÉÙ…°€ô(€€€€€€€€€€€±½­Q¥µ•È¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€•™™•Ñ¥Ù•Q¥µ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ¥¹Ñ•ÉÙ…±QåÁ”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€¥¹Ñ•ÉÙ…°ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰‰É•…¬ˆñð(€€€€€€€€€€€¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰±Õ¹ ˆ(€€€€€€€€¤ì(€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È¹•¹‘%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€¥˜€¡¥¹Ñ•ÉÙ…±QåÁ”€ôôô€‰‘½Ý¸ˆ¤ì(€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È¹•¹‘%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€€¼¼I•…‘äÑÉ…¹Í¥Ñ¥½¸¥Ì½¹”…Ñ½µ¥ŒÝ…±°µ±½¬‰½Õ¹‘…ÉäèÑ¡”(€€€€€€€€¼¼½µÁ±•Ñ•ÑÉ¥ÀÍÑ½ÁÌ…ÐÑ¡”•á…Ðµ¥±±¥Í•½¹Ñ¡”¹•áÐÑÉ¥ÀÍÑ…ÉÑÌ¸(€€€€€€€€¼¼MÑ½É”Ñ¡”‰½Õ¹‘…Éä…Ì…¸¥µµÕÑ…‰±”¹Õµ‰•ÈÍ¼¹•¥Ñ¡•È…Íå¹ŒÝ½É¬¹½È„(€€€€€€€€¼¼…Ñ”½‰©•ÐµÕÑ…Ñ¥½¸…¸µ…­”Ñ¡”ÑÝ¼Í¥‘•Ì‘É¥™Ð…Á…ÉÐ¸(€€€€€€€½¹ÍÐÑÉ…¹Í¥Ñ¥½¹Q¥µ•ÍÑ…µÀ€ô(€€€€€€€€€€€•™™•Ñ¥Ù•Q¥µ”¹•ÑQ¥µ” ¤ì((€€€€€€€•¹‘¥¹%¹Ñ½9•ÝQÉ¥À€ô(€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€¼¼MÕÁÁÉ•ÍÌ•á…Ñ±äÑ¡”¹•áÐ½É‘¥¹…Éä¡¥µ”èÑ¡”±•…ä€Ìµ¹½Ñ”(€€€€€€€€¼¼¹QÉ¥ÀÕ”•µ¥ÑÑ•‰äÑÉ¥Á¹‘•¸(€€€€€€€¥¹É•µ•¹ÑM•µ…¹Ñ¥¥Í…‰±” (€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€¤ì((€€€€€€€½¹ÍÐÍÑ½ÁAÉ½µ¥Í”€ô(€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ½À (€€€€€€€€€€€€€€€¹•Ü…Ñ” (€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹Q¥µ•ÍÑ…µÀ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…ÑÕÌ€„ôô(€€€€€€€€€€€€€€€€‰ÍÑ½ÁÁ•ˆ(€€€€€€€€¤ì(€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€…Ý…¥ÐÍÑ½ÁAÉ½µ¥Í”ì(€€€€€€€€€€€ô(€€€€€€€€€€€™¥¹…±±äì(€€€€€€€€€€€€€€€•¹‘¥¹%¹Ñ½9•ÝQÉ¥À€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€•¹‘¥¹%¹Ñ½9•ÝQÉ¥À€ô(€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”€ô(€€€€€€€€€€€AÉ½µ¥Í”(€€€€€€€€€€€€€€€€¹É•Í½±Ù” (€€€€€€€€€€€€€€€€€€€ÍÑ½ÁAÉ½µ¥Í”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹™¥¹…±±ä (€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€•¹‘¥¹%¹Ñ½9•ÝQÉ¥À€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Í•Ñ½µÁ±•Ñ•‘QÉ¥À ¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”(€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰½µÁ±•Ñ•ÑÉ¥ÀÉ•Í•Ð™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€…Ý…¥Ð‰•¥¹9•ÝQÉ¥Á]½É­™±½Ü¡ì(€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”è€ˆˆ°(€€€€€€€€€€€€€€€ÑÉ¥Á5½µ•¹Ðè(€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹Q¥µ•ÍÑ…µÀ(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”è(€€€€€€€€€€€€€€€€€€€ÍÁ••¡I•½¹¥Ñ¥½¹¹…‰±• ¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Ù½¥”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Ñ½Õ ˆ°(€€€€€€€€€€€€€€€•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸èÑÉÕ”°(€€€€€€€€€€€€€€€½µÁ±•Ñ•‘QÉ¥ÁI•Í•ÑAÉ½µ¥Í”°(€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€ô¤ì((€€€€€€€½¹ÍÐÍÁ•• €ô(€€€€€€€€€€€Á•¹‘¥¹¹‘MÑ…ÉÑQÉ¥ÁMÁ•• ì((€€€€€€€Á•¹‘¥¹¹‘MÑ…ÉÑQÉ¥ÁMÁ•• €ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€½Á•¹•€˜˜(€€€€€€€€€€€ÑÉ¥ÁÉ…™ÑUÍ•Í¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸ ¤(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ•¹‘¡¥µ•¹…‰±•€ô(€€€€€€€€€€€€€€€…Õ‘¥½•±±UÍ•É¹…‰±• (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÍÑ…ÉÑ¡¥µ•¹…‰±•€ô(€€€€€€€€€€€€€€€…Õ‘¥½•±±UÍ•É¹…‰±• (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì¹]5=Õ‘¥¼ì(€€€€€€€€€€€±•ÐÑÉ…¹Í¥Ñ¥½¹M½¹œì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€•¹‘¡¥µ•¹…‰±•€˜˜(€€€€€€€€€€€€€€€ÍÑ…ÉÑ¡¥µ•¹…‰±•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ€ô(€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸ˆì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”¥˜€¡•¹‘¡¥µ•¹…‰±•¤ì(€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ€ô(€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”¥˜€¡ÍÑ…ÉÑ¡¥µ•¹…‰±•¤ì(€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ€ô(€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÑÉ…¹Í¥Ñ¥½¹MÁ••¡=ÕÑÁÕÐ€ô(€€€€€€€€€€€€€€€…Õ‘¥½¹¹½Õ¹•µ•¹Ñ=ÕÑÁÕÐ (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÑÉ…¹Í¥Ñ¥½¹¡¥µ•±±½Ý•€ô(€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ€˜˜(€€€€€€€€€€€€€€€€€€€½¹ÍÕµ•M•µ…¹Ñ¥Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÉ•Í•ÉÙ•MÑ…ÉÑ¡¥µ”€ô(€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹¡¥µ•±±½Ý•€˜˜(€€€€€€€€€€€€€€€ÍÑ…ÉÑ¡¥µ•¹…‰±•ì((€€€€€€€€€€€¥˜€¡É•Í•ÉÙ•MÑ…ÉÑ¡¥µ”¤ì(€€€€€€€€€€€€€€€€¼¼I•Í•ÉÙ”Ñ¡¥Ì¥µµ•‘¥…Ñ•±äÍ¼„Ù•Éä™…ÍÐMÑ…ÉÐ…Ñ¥½¸…¹¹½Ð(€€€€€€€€€€€€€€€€¼¼½¹ÍÕµ”¥ÑÌ½Ý¸¡¥µ”‰•™½É”Ñ¡”ÅÕ•Õ•ÑÉ…¹Í¥Ñ¥½¸‰•¥¹Ì¸(€€€€€€€€€€€€€€€¥¹É•µ•¹ÑM•µ…¹Ñ¥¥Í…‰±” (€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€Ù½¥ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€±•ÐÑÉ…¹Í¥Ñ¥½¹¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹¡¥µ•±±½Ý•€˜˜(€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄàÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•MÁ•• è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í½¹œü¹¡…Í¡¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ½¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹¡¥µ•A±…å•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÝ…¥Ñ½É¹¹½Õ¹•µ•¹Ñ•±…ä (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹MÁ••¡=ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡•±…å5Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Õ‘¥¼Á±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹M½¹œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€É•Í•ÉÙ•MÑ…ÉÑ¡¥µ”€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€…ÑÉ…¹Í¥Ñ¥½¹¡¥µ•A±…å•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€…¹•±M•µ…¹Ñ¥¥Í…‰±” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€¡ÍÁ•• ¤ì(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ•• °(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹MÁ••¡=ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í¥Ñ¥½¹MÁ••¡=ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€•á±ÕÍ¥Ù”è(€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑMÁ••¡%¹½É•Í5…ÍÑ•È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰QÉ¥ÀÑÉ…¹Í¥Ñ¥½¸…¹¹½Õ¹•µ•¹Ð™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜€¡ÍÁ•• ¤ì(€€€€€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€€€€€ÍÁ•• (€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€ô((€€€±•ÐÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”ì((€€€™Õ¹Ñ¥½¸½Á•¹MÁ••¡	É•…­AÉ½µÁÐ (€€€€€€€µ½‘”(€€€€¤ì(€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ¤ì(€€€€€€€½¹ÍÐÑ¥Ñ±”€ô(€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥ÉµQ¥Ñ±”ˆ¤ì(€€€€€€€½¹ÍÐµ•ÍÍ…”€ô(€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ5•ÍÍ…”ˆ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…‘¥…±½œñð(€€€€€€€€€€€€…Ñ¥Ñ±”ñð(€€€€€€€€€€€€…µ•ÍÍ…”(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€¥˜€¡µ½‘”€ôôô€‰ÍÑ…ÉÐˆ¤ì(€€€€€€€€€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€‰MÑ…ÉÐ	É•…¬ˆì(€€€€€€€€€€€µ•ÍÍ…”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€‰%ÌÑ¡¥Ì„±Õ¹ üˆì((€€€€€€€€€€€ÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”€ôì(€€€€€€€€€€€€€€€µ½‘”è€‰ÍÑ…ÉÐˆ(€€€€€€€€€€€ôì(€€€€€€€ô(€€€€€€€•±Í”¥˜€¡µ½‘”€ôôô€‰•¹ˆ¤ì(€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”€ô(€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€…Ñ¥Ù”ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÑåÁ”€„ôô€‰‰É•…¬ˆ€˜˜(€€€€€€€€€€€€€€€ÑåÁ”€„ôô€‰±Õ¹ ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰±Õ¹ ˆ(€€€€€€€€€€€€€€€€€€€€ü€‰1Õ¹ ˆ(€€€€€€€€€€€€€€€€€€€€è€‰	É•…¬ˆì((€€€€€€€€€€€Ñ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€¹€‘í±…‰•±õ€ì(€€€€€€€€€€€µ•ÍÍ…”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€É”å½ÔÉ•…‘äÑ¼•¹å½ÕÈ€‘í±…‰•°¹Ñ½1½Ý•É…Í” ¥ôý€ì((€€€€€€€€€€€ÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”€ôì(€€€€€€€€€€€€€€€µ½‘”è€‰•¹ˆ°(€€€€€€€€€€€€€€€¥¹Ñ•ÉÙ…±QåÁ”è(€€€€€€€€€€€€€€€€€€€ÑåÁ”(€€€€€€€€€€€ôì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸½Á•¹¥…±½œ (€€€€€€€€€€€€‰ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€ÍÁ•• µ‰É•…¬´‘íµ½‘•õ€(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸±•…ÉMÁ••¡	É•…­AÉ½µÁÐ ¤ì(€€€€€€€ÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÍÑ…ÉÑ	É•…­%¹Ñ•ÉÙ…° (€€€€€€€­¥¹°(€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤(€€€€¤ì(€€€€€€€½¹ÍÐ½¹™¥Ì€ôì(€€€€€€€€€€€‰É•…¬èìÑåÁ”è€‰‰É•…¬ˆ°±•¹Ñ¡5¥±±¥Í•½¹‘Ìè€ÄÔ€¨€ØÀ€¨€ÄÀÀÀ°…ÑÑÉ¥‰ÕÑ•Ìèì‰É•…­QåÁ”è€‰‰É•…¬ˆôô°(€€€€€€€€€€€±Õ¹ èìÑåÁ”è€‰±Õ¹ ˆ°±•¹Ñ¡5¥±±¥Í•½¹‘Ìè€ÌÀ€¨€ØÀ€¨€ÄÀÀÀ°…ÑÑÉ¥‰ÕÑ•Ìèì‰É•…­QåÁ”è€‰±Õ¹ ˆôô°(€€€€€€€€€€€€‰Í¡½ÉÐµ‰É•…¬ˆèìÑåÁ”è€‰‰É•…¬ˆ°±•¹Ñ¡5¥±±¥Í•½¹‘Ìè€ÄÀ€¨€ØÀ€¨€ÄÀÀÀ°…ÑÑÉ¥‰ÕÑ•Ìèì‰É•…­QåÁ”è€‰Í¡½ÉÐˆôô(€€€€€€€ôì(€€€€€€€½¹ÍÐ½¹™¥œ€ô½¹™¥Ím­¥¹‘tì(€€€€€€€¥˜€ …½¹™¥œ¤É•ÑÕÉ¸™…±Í”ì((€€€€€€€½¹ÍÐ±½½­ÕÁQ¥µ”€ô(€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”¥¹ÍÑ…¹•½˜…Ñ”€˜˜(€€€€€€€€€€€€…9Õµ‰•È¹¥Í9…8 (€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”¹•ÑQ¥µ” ¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€üÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€è¹•Ü…Ñ” ¤ì((€€€€€€€½¹ÍÐ…Ñ¥Ù”€ô(€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€±½½­ÕÁQ¥µ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€…Ñ¥Ù”ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€ôôô(€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ•¹‘•€ô(€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€¹•¹‘%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÕÁÁÉ•ÍÍQÉ¥ÁI•ÍÕµ•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€€€€€¥˜€ …•¹‘•¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑ%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€½¹™¥œ¹ÑåÁ”°(€€€€€€€€€€€€€€€€€€€½¹™¥œ¹±•¹Ñ¡5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€€€€€€€€€½¹™¥œ¹…ÑÑÉ¥‰ÕÑ•Ì°(€€€€€€€€€€€€€€€€€€€€È€¨€ØÀ€¨€ÄÀÀÀ€¬€ÌÀ€¨€ÄÀÀÀ°(€€€€€€€€€€€€€€€€€€€€È€¨€ØÀ€¨€ÄÀÀÀ€¬€ÌÀ€¨€ÄÀÀÀ°(€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€É•ÑÕÉ¸	½½±•…¸¡É•ÍÕ±Ð¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ”¡ÉÕ¹¹¥¹œ¤ì(€€€€€€€½¹ÍÐ¹•áÑQÉ¥ÁMÑ…Ñ”€ô(€€€€€€€€€€€ÉÕ¹¹¥¹œ€ü€‰ÉÕ¹¹¥¹œˆ€è€‰É•…‘äˆì(€€€€€€€½¹ÍÐÍÑ…Ñ•¡…¹•€ô(€€€€€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹ÑÉ¥ÁMÑ…Ñ”€„ôô¹•áÑQÉ¥ÁMÑ…Ñ”ì((€€€€€€€¥˜€¡ÍÑ…Ñ•¡…¹•¤ì(€€€€€€€€€€€…ÁÀ¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…Ñ”µÍ¹…Àˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€Ù½¥…ÁÀ¹½™™Í•Ñ!•¥¡Ðì(€€€€€€€ô((€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹ÑÉ¥ÁMÑ…Ñ”€ô¹•áÑQÉ¥ÁMÑ…Ñ”ì(€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹ÍÑ…Ñ”€ô±½­Q¥µ•È¹ÍÑ…ÑÕÌì(€€€€€€€…Ñ¥Ù•QÉ¥Á½¹ÑÉ½±Ì¹¡¥‘‘•¸€ô€…ÉÕ¹¹¥¹œì(€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€€€€€Íå¹9•ÝQÉ¥Á	ÕÑÑ½¹Ù…¥±…‰¥±¥Ñä ¤ì((€€€€€€€¥˜€¡ÍÑ…Ñ•¡…¹•¤ì(€€€€€€€€€€€Ù½¥…ÁÀ¹½™™Í•Ñ!•¥¡Ðì(€€€€€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”  ¤€ôøì(€€€€€€€€€€€€€€€…ÁÀ¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…Ñ”µÍ¹…Àˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô¤ì(€€€€€€€ô(€€€ô((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰…‘•¹•Q¥¬ˆ°•Ù•¹Ð€ôøì(€€€€€€€¥˜€ (€€€€€€€€€€€•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”ü¹‘•…‘±¥¹”¥¹ÍÑ…¹•½˜…Ñ”€˜˜(€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹¹½Ü¥¹ÍÑ…¹•½˜…Ñ”€˜˜(€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°¹¹½Ü¹•ÑQ¥µ” ¤€øô•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”¹‘•…‘±¥¹”¹•ÑQ¥µ” ¤(€€€€€€€€¤ì(€€€€€€€€€€€É•±•…Í•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€ô(€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”€˜˜(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹¹½Ü(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•…±Õ±…Ñ•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€ô((€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹¹½Ü(€€€€€€€€¤ì((€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ” ¤ì((€€€€€€€É•™É•Í¡QÉ¥Á1½1¥Ù•AÉ½©•Ñ¥½¸ (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹ÍÕµµ…Éä(€€€€€€€€¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Õ¥MÑ…Ñ•¡…¹•ˆ°•Ù•¹Ð€ôøì(€€€€€€€É•¹‘•É±½­Q¥µ•ÉU%MÑ…Ñ”¡•Ù•¹Ð¹‘•Ñ…¥°¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÍÑ…ÉÑ•ˆ°•Ù•¹Ð€ôøì(€€€€€€€Í•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ”¡ÑÉÕ”¤ì(€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ”¡ì(€€€€€€€€€€€™½É”èÑÉÕ”(€€€€€€€ô¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰ÍÑ½ÁÁ•ˆ°(€€€€€€€€ ¤€ôøì(€€€€€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€€€€€€¼¼QÉ¥À¹¥Ì‘•±¥‰•É…Ñ•±äÍ¥±•¹Ð™½ÈMå¹Œ¸-••ÀÑ¡”‰…Í•±¥¹”(€€€€€€€€€€€€¼¼…ÕÉ…Ñ”Í¼„±…Ñ•ÈÑÉ…¹Í¥Ñ¥½¸¥Ì½µÁ…É•Ý¥Ñ Ñ¡”É•…‘äÍÑ…Ñ”¸(€€€€€€€€€€€Í•ÑMå¹¹¹½Õ¹•µ•¹Ñ	…Í•±¥¹” ¤ì(€€€€€€€ô(€€€€¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰½…±¡…¹•ˆ°(€€€€€€€€ ¤€ôøì(€€€€€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ”¡ì(€€€€€€€€€€€€€€€ÁÉ•™•É…±Õ±…Ñ•‘½…°è(€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€‰Íå¹½…±I•…±Õ±…Ñ•ˆ°(€€€€€€€•Ù•¹Ð€ôøì(€€€€€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹Í½ÕÉ”€ôôô(€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÐˆñð(€€€€€€€€€€€€€€€Íå¹AÉ•™•É•¹•¡…¹•%¹AÉ½É•ÍÌñð(€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤€ôôô(€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Í•ÑMå¹¹¹½Õ¹•µ•¹Ñ	…Í•±¥¹” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÍå¹=Á•É…Ñ¥½¸€ô(€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹½Á•É…Ñ¥½¸€ôôô(€€€€€€€€€€€€€€€€€€€€‰Íå¹Œˆì((€€€€€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ”¡ì(€€€€€€€€€€€€€€€™½É”è(€€€€€€€€€€€€€€€€€€€Íå¹=Á•É…Ñ¥½¸°(€€€€€€€€€€€€€€€ÁÉ•™•É…±Õ±…Ñ•‘½…°è(€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€™½É•…±Õ±…Ñ•‘½…°è(€€€€€€€€€€€€€€€€€€€Íå¹=Á•É…Ñ¥½¸(€€€€€€€€€€€ô¤ì(€€€€€€€ô(€€€€¤ì(((€€€™Õ¹Ñ¥½¸…¹¥µ…Ñ•½Ý¹Q¥µ•±½­QÉ…¹Í¥Ñ¥½¸ ¤ì(€€€€€€€±½­Q¥µ•È¹ÍÁ¥¸ü¸¡ì(€€€€€€€€€€€É½Ñ…Ñ¥½¹Ìè€Ä°(€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è€ˆÄ¸ÕÌˆ(€€€€€€€ô¤ì(€€€ô(((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘½Ý¹Q¥µ•MÑ…ÉÑ•ˆ°€ ¤€ôøì(€€€€€€€…ÁÀ¹‘…Ñ…Í•Ð¹¥¹Ñ•ÉÙ…±MÑ…Ñ”€ô€‰‘½Ý¸ˆì(€€€€€€€…¹¥µ…Ñ•½Ý¹Q¥µ•±½­QÉ…¹Í¥Ñ¥½¸ ¤ì(€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰‘½Ý¹Q¥µ•¹‘•ˆ°€ ¤€ôøì(€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€€€€€…¹¥µ…Ñ•½Ý¹Q¥µ•±½­QÉ…¹Í¥Ñ¥½¸ ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÑÉ¥ÁÕÑ½µ…Ñ¥…±±åI•ÍÑ…ÉÑ•ˆ°€ ¤€ôøì(€€€€€€€Í•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ”¡ÑÉÕ”¤ì(€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¥¹Ñ•ÉÙ…±MÑ…ÉÑ•ˆ°€ ¤€ôøì(€€€€€€€¥˜€¡•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”¤ì(€€€€€€€€€€€É•…±Õ±…Ñ•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€ô((€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ”¡ì(€€€€€€€€€€€ÁÉ•™•É…±Õ±…Ñ•‘½…°è(€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€ô¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¥¹Ñ•ÉÙ…±¹‘•ˆ°€ ¤€ôøì(€€€€€€€¥˜€¡•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”¤ì(€€€€€€€€€€€É•…±Õ±…Ñ•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€ô((€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ”¡ì(€€€€€€€€€€€ÁÉ•™•É…±Õ±…Ñ•‘½…°è(€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€ô¤ì(€€€ô¤ì((€€€½¹ÍÐÍÕµµ…ÉåI•™É•Í¡Ù•¹ÑÌ€ôl(€€€€€€€€‰ÑÉ¥Á1½…‘•ˆ°(€€€€€€€€‰±•…É•ˆ°(€€€€€€€€‰½…±¡…¹•ˆ°(€€€€€€€€‰É•¹‘•É•‘A•É•¹Ñ½…±¡…¹•ˆ°(€€€€€€€€‰ÍÑ…¹‘…É‘Q¥µ•¡…¹•ˆ°(€€€€€€€€‰É•…Ñ¥½¹…Ñ•¡…¹•ˆ°(€€€€€€€€‰É•…Ñ¥½¹Q¥µ•¡…¹•ˆ°(€€€€€€€€‰Í¡•‘Õ±•‘MÑ…ÉÑ¡…¹•ˆ°(€€€€€€€€‰ÍÑ…ÉÑQ¥µ•¡…¹•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±MÑ…ÉÑ•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±¹‘•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±±…ÁÍ•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±áÑ•¹‘•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±ÁÁÉ½Ù…±Q½±•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±ÁÁÉ½Ù…±¡…¹•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±•±•Ñ•ˆ°(€€€€€€€€‰½…±¡…¹•…¥±•ˆ(€€€tì((€€€½¹ÍÐ•¹‘Q¥µ•½…±I•…±Õ±…Ñ¥½¹Ù•¹ÑÌ€ôl(€€€€€€€€‰ÍÑ…¹‘…É‘Q¥µ•¡…¹•ˆ°(€€€€€€€€‰É•…Ñ¥½¹…Ñ•¡…¹•ˆ°(€€€€€€€€‰É•…Ñ¥½¹Q¥µ•¡…¹•ˆ°(€€€€€€€€‰Í¡•‘Õ±•‘MÑ…ÉÑ¡…¹•ˆ°(€€€€€€€€‰ÍÑ…ÉÑQ¥µ•¡…¹•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±áÑ•¹‘•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±ÁÁÉ½Ù…±Q½±•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±ÁÁÉ½Ù…±¡…¹•ˆ°(€€€€€€€€‰¥¹Ñ•ÉÙ…±•±•Ñ•ˆ(€€€tì((€€€™½È€¡½¹ÍÐ•Ù•¹Ñ9…µ”½˜•¹‘Q¥µ•½…±I•…±Õ±…Ñ¥½¹Ù•¹ÑÌ¤ì(€€€€€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€•Ù•¹Ñ9…µ”°(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€¡•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”¤ì(€€€€€€€€€€€€€€€€€€€É•…±Õ±…Ñ•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((((€€€™½È€¡½¹ÍÐ•Ù•¹Ñ9…µ”½˜ÍÕµµ…ÉåI•™É•Í¡Ù•¹ÑÌ¤ì(€€€€€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ù•¹Ñ9…µ”°ÅÕ•Õ•MÕµµ…ÉåI•™É•Í ¤ì(€€€ô((€€€™½È€ (€€€€€€€½¹ÍÐ•Ù•¹Ñ9…µ”½˜(€€€€€€€€€€€l(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€‰½…±¡…¹•ˆ°(€€€€€€€€€€€€€€€€‰É•¹‘•É•‘A•É•¹Ñ½…±¡…¹•ˆ°(€€€€€€€€€€€€€€€€‰½…±…¥°ˆ°(€€€€€€€€€€€€€€€€‰½…±¡…¹•…¥±•ˆ°(€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…É‘Q¥µ•¡…¹•ˆ(€€€€€€€€€€€t(€€€€¤ì(€€€€€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€•Ù•¹Ñ9…µ”°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥Á1½1¥Ù•AÉ½©•Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€™½É”èÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±•…É•ˆ°€ ¤€ôøì(€€€€€€€ÑÉ¥Á1½1¥Ù•AÉ½©•Ñ¥½¹5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€É•±•…Í•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì(€€€€€€€Í•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ”¡™…±Í”¤ì(€€€€€€€Í•ÑMå¹¹¹½Õ¹•µ•¹Ñ	…Í•±¥¹” ¤ì(€€€€€€€ÍÑ…•‘MÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á•É•¹Ñ5½‘•¡…¹•ˆ°€ ¤€ôøì(€€€€€€€Íå¹M½Á•U$¡ÑÉÕ”¤ì(€€€€€€€ÅÕ•Õ•MÕµµ…ÉåI•™É•Í  ¤ì(€€€€€€€É•™É•Í¡QÉ¥Á1½1¥Ù•AÉ½©•Ñ¥½¸ (€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€™½É”èÑÉÕ”(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰É•¹‘•É•‘Q¥µ•5½‘•¡…¹•ˆ°€ ¤€ôøì(€€€€€€€Í…™•MÑ½É…•M•Ð¡MQ=I¹É•¹‘•É•‘Q¥µ•5½‘”°±½­Q¥µ•È¹É•¹‘•É•‘Q¥µ•5½‘”¤ì(€€€€€€€ÅÕ•Õ•MÕµµ…ÉåI•™É•Í  ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰¹•ÑÝ½É­MÑ…ÑÕÍ¡…¹•ˆ°€ ¤€ôøì(€€€€€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€Ù½¥…¹¹½Õ¹•Må¹IÕ¹Ñ¥µ•MÑ…Ñ” ¤ì((€€€€€€€½¹ÍÐ½¹¹•Ñ¥½¹MÑ…Ñ”€ô(€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”€üü(€€€€€€€€€€€•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹9Õµ‰•ÉA…‘MÑ…Ñ” ¤ì(€€€€€€€½¹ÍÐÁ¡…Í”€ô½¹¹•Ñ¥½¹MÑ…Ñ”ü¹½¹¹•Ñ¥½¹AÉ•Í•¹Ñ…Ñ¥½¸ì(€€€€€€€¥˜€ (€€€€€€€€€€€½¹¹•Ñ¥½¹MÑ…Ñ”ü¹½¹¹•Ñ¥½¹MÑ…ÑÕÍQ½­•¸€˜˜(€€€€€€€€€€€€…l‰¥¹¥Ñ¥…°ˆ°€‰É•ÑÉäˆ°€‰…Ý…¥Ñ¥¹œµ±½¥¸‰t¹¥¹±Õ‘•Ì¡Á¡…Í”¤(€€€€€€€€¤ì(€€€€€€€€€€€ÕÁ‘…Ñ•9Õµ‰•ÉA…‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ (€€€€€€€€€€€€€€€½¹¹•Ñ¥½¹MÑ…Ñ”¹½¹¹•Ñ¥½¹MÑ…ÑÕÍQ½­•¸°(€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤°(€€€€€€€€€€€€€€€ìÁÉ•Í•¹Ñ…Ñ¥½¸è€‰±½Õµ™…‘”ˆô(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€Íå¹9•ÑÝ½É­MÑ…ÑÕÍU$¡ì±½¥¸è±½¥¹A•¹‘¥¹œô¤ì(€€€€€€€ÅÕ•Õ•MÕµµ…ÉåI•™É•Í  ¤ì(€€€ô¤ì((€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰ÑÉ¥Á1½…‘•ˆ°€ ¤€ôøÍ•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ” …l‰É•…‘äˆ°‰ÍÑ½ÁÁ•‰t¹¥¹±Õ‘•Ì¡±½­Q¥µ•È¹ÍÑ…ÑÕÌ¤¤¤ì(€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰…Ñ¥Ù•QÉ¥ÁI•ÍÑ½É•ˆ°•Ù•¹Ð€ôøì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô•Ù•¹Ð¹‘•Ñ…¥°ü¹ÍÑ…Ñ”ñð±½­Q¥µ•È¹Õ¥MÑ…Ñ”ì(€€€€€€€¥˜€¡ÍÑ…Ñ”¤É•¹‘•É±½­Q¥µ•ÉU%MÑ…Ñ”¡ÍÑ…Ñ”¤ì(€€€€€€€Í•ÑQÉ¥Á½¹ÑÉ½±MÑ…Ñ”¡	½½±•…¸¡ÍÑ…Ñ”ü¹ÑÉ¥Á}…Ñ¥Ù”¤¤ì(€€€ô¤ì(€€€™½È€¡½¹ÍÐ•Ù•¹Ð½˜l‰¥¹Ñ•ÉÙ…±MÑ…ÉÑ•ˆ°‰¥¹Ñ•ÉÙ…±¹‘•ˆ°‰¥¹Ñ•ÉÙ…±•±•Ñ•ˆ°‰ÍÑ½ÁÁ•ˆ°‰±•…É•ˆ°‰½µÁ±•Ñ•‘QÉ¥ÁÍMå¹•‰t¤ì(€€€€€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ù•¹Ð° ¤ôùí¥˜¡•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤ôôô‰½Á•¸ˆ¤Ù½¥‘¥ÍÁ…Ñ¡QÉ¥Á1¥ÍÑI•ÅÕ•ÍÐ ‰ÑÉ¥Àµ¡…¹”ˆ¤íô¤ì(€€€ô(€€€Í•Ñ%¹Ñ•ÉÙ…°  ¤ôùì(€€€€€€€¥˜¡ÑÉ¥Á%Í1¥Ù” ¤€˜˜•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤ôôô‰½Á•¸ˆ€˜˜ÑÉ¥Á1½Y¥•Ü€˜˜€…ÑÉ¥Á1½Y¥•Ü¹•‘¥Ñ½È€˜˜€…¹Õµ‰•ÉA…‘¥…±½œü¹½Á•¸€˜˜(€€€€€€€€€€€€ …ÑÉ¥Á1½	½‘ä¹½¹Ñ…¥¹Ì¡‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ð¤ñð‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ðü¹µ…Ñ¡•Ì ‰ÍÕµµ…Éäˆ¤¤€˜˜(€€€€€€€€€€€€…ÑÉ¥Á1½	½‘ä¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ÑÉ¥Àµ±½œµµ•¹Ôµ…Ñ¥½¹Ìé¹½Ð¡m¡¥‘‘•¹t¤ˆ¤¤ì(€€€€€€€€€€€ÑÉ¥Á1½Y¥•Ü¹É•¹‘•È¡íÑÉ¥ÁÌéÑÉ¥Á1½Y¥•Ü¹ÑÉ¥ÁÌ°½™™±¥¹”éÑÉ¥Á1½Y¥•Ü¹½™™±¥¹”°¥¹½µÁ±•Ñ”éÑÉ¥Á1½Y¥•Ü¹¥¹½µÁ±•Ñ”°±½¥¹I•ÅÕ¥É•éÑÉ¥Á1½Y¥•Ü¹±½¥¹I•ÅÕ¥É•‘ô±ÑÉ¥Á1½Y¥•Ü¹…±•¹‘…È¤ì(€€€€€€€ô(€€€ô°ÄÀÀÀ¤ì((€€€™Õ¹Ñ¥½¸…±¥¹MÑ…ÑÕÍ%½¹Ì ¤ì(€€€€€€€¥˜€ …Í½Á•½¹¹•Ñ¥½¹	ÕÑÑ½¸ñðÍ½Á•½¹¹•Ñ¥½¹	ÕÑÑ½¸¹¡¥‘‘•¸¤É•ÑÕÉ¸ì(€€€€€€€½¹ÍÐÉ•™•É•¹”õÍ½Á•½¹¹•Ñ¥½¹	ÕÑÑ½¸¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤í½¹ÍÐ•¹Ñ•ÈõÉ•™•É•¹”¹±•™Ð­É•™•É•¹”¹Ý¥‘Ñ ¼Èì(€€€€€€€™½È¡½¹ÍÐ¥½¸½˜mÑ½±•Må¹½…±	ÕÑÑ½¸° ˆ¹‘•™•ÉÉ•µÑÉ¥Àµ¥½¸ˆ¤° ˆ•¹‘Q¥µ•½…±1½¬ˆ¥t¤ì(€€€€€€€€€€€¥˜ …¥½¸ñð¥½¸¹¡¥‘‘•¸¤½¹Ñ¥¹Õ”ì(€€€€€€€€€€€½¹ÍÐÁ…É•¹Ðõ¥½¸¹½™™Í•ÑA…É•¹Ðí¥˜ …Á…É•¹Ð¤½¹Ñ¥¹Õ”ì(€€€€€€€€€€€¥½¸¹ÍÑå±”¹±•™Ðõ€‘í•¹Ñ•ÈµÁ…É•¹Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤¹±•™ÐµÁ…É•¹Ð¹±¥•¹Ñ1•™Ðµ¥½¸¹½™™Í•Ñ]¥‘Ñ ¼ÉõÁá€ì(€€€€€€€€€€€¥½¸¹ÍÑå±”¹É¥¡Ðô‰…ÕÑ¼ˆì(€€€€€€€ô(€€€ô(€€€½¹ÍÐÍÑ…ÑÕÍ%½¹=‰Í•ÉÙ•Èõ¹•ÜI•Í¥é•=‰Í•ÉÙ•È  ¤ôùÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ”¡…±¥¹MÑ…ÑÕÍ%½¹Ì¤¤ì(€€€™½È¡½¹ÍÐ•±•µ•¹Ð½˜mÍ½Á•½¹¹•Ñ¥½¹	ÕÑÑ½¸±Ñ½±•Må¹½…±	ÕÑÑ½¸° ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤° ˆ¹‘•™•ÉÉ•µÑÉ¥Àµ¥½¸ˆ¤° ˆ•¹‘Q¥µ•½…±1½¬ˆ¥t¤¥˜¡•±•µ•¹Ð¤ÍÑ…ÑÕÍ%½¹=‰Í•ÉÙ•È¹½‰Í•ÉÙ”¡•±•µ•¹Ð¤ì((€€€€¼¼M•µ…¹Ñ¥Œ±½­Q¥µ•È•Ù•¹Ð¥¹Ñ•É…Ñ¥½¸Á½¥¹ÑÌ¸(€€€€¼¼9½Ñ¥™¥…Ñ¥½¸±…å•ÉÌÕÍ”¹•ÍÑ…‰±”‘¥Í…‰±”½Õ¹ÑÌÍ¼…±±•ÉÌ…¸ÍÕÁÁÉ•ÍÌ(€€€€¼¼½¹”±…å•ÈÑ•µÁ½É…É¥±äÝ¥Ñ¡½ÕÐ‘¥ÍÑÕÉ‰¥¹œ…¹½Ñ¡•È…±±•ÈÌÍÕÁÁÉ•ÍÍ¥½¸¸(€€€½¹ÍÐÍ•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÌ€ôì(€€€€€€€¡¥µ”è€À°(€€€€€€€ÍÕµµ…Éäè€À°(€€€€€€€‘•Ñ…¥±Ìè€À(€€€ôì((€€€™Õ¹Ñ¥½¸Í•ÑM•µ…¹Ñ¥¥Í…‰±” (€€€€€€€±…å•È°(€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…=‰©•Ð¹¡…Í=Ý¸ (€€€€€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÌ°(€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€Ñ¡É½Ü¹•ÜI…¹•ÉÉ½È (€€€€€€€€€€€€€€€€‰U¹­¹½Ý¸Í•µ…¹Ñ¥Œ¹½Ñ¥™¥…Ñ¥½¸±…å•Èè€ˆ€¬(€€€€€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¹•áÐ€ô(€€€€€€€€€€€9Õµ‰•È¡Ù…±Õ”¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…9Õµ‰•È¹¥Í%¹Ñ••È¡¹•áÐ¤ñð(€€€€€€€€€€€¹•áÐ€ð€´Ä(€€€€€€€€¤ì(€€€€€€€€€€€Ñ¡É½Ü¹•ÜQåÁ•ÉÉ½È (€€€€€€€€€€€€€€€€‰M•µ…¹Ñ¥Œ‘¥Í…‰±”Ù…±Õ•ÌµÕÍÐ‰”€´Ä½È„¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••È¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Ét€ô(€€€€€€€€€€€¹•áÐì((€€€€€€€É•ÑÕÉ¸¹•áÐì(€€€ô((€€€™Õ¹Ñ¥½¸¥¹É•µ•¹ÑM•µ…¹Ñ¥¥Í…‰±” (€€€€€€€±…å•È(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍl(€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€t€ð€À(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€´Äì(€€€€€€€ô((€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Ét€¬ô(€€€€€€€€€€€€Äì((€€€€€€€É•ÑÕÉ¸Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Étì(€€€ô((€€€™Õ¹Ñ¥½¸½¹ÍÕµ•M•µ…¹Ñ¥Ñ¥½¸ (€€€€€€€±…å•È(€€€€¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍl(€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€tì((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”€ôôôÕ¹‘•™¥¹•(€€€€€€€€¤ì(€€€€€€€€€€€Ñ¡É½Ü¹•ÜI…¹•ÉÉ½È (€€€€€€€€€€€€€€€€‰U¹­¹½Ý¸Í•µ…¹Ñ¥Œ¹½Ñ¥™¥…Ñ¥½¸±…å•Èè€ˆ€¬(€€€€€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”€ôôô€À(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”€ø€À(€€€€€€€€¤ì(€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Ét€ô(€€€€€€€€€€€€€€€ÍÑ…Ñ”€´€Äì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€ô((€€€™Õ¹Ñ¥½¸…¹•±M•µ…¹Ñ¥¥Í…‰±” (€€€€€€€±…å•È(€€€€¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍl(€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€tì((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”€ôôôÕ¹‘•™¥¹•(€€€€€€€€¤ì(€€€€€€€€€€€Ñ¡É½Ü¹•ÜI…¹•ÉÉ½È (€€€€€€€€€€€€€€€€‰U¹­¹½Ý¸Í•µ…¹Ñ¥Œ¹½Ñ¥™¥…Ñ¥½¸±…å•Èè€ˆ€¬(€€€€€€€€€€€€€€€€€€€±…å•È(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”€ø€À(€€€€€€€€¤ì(€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Ét€ô(€€€€€€€€€€€€€€€ÍÑ…Ñ”€´€Äì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Étì(€€€ô((€€€±½‰…±Q¡¥Ì¹]5=M•µ…¹Ñ¥9½Ñ¥™¥…Ñ¥½¹Ì€ô(€€€€€€€=‰©•Ð¹™É••é”¡ì(€€€€€€€€€€€Í•Ñ¥Í…‰±”è(€€€€€€€€€€€€€€€Í•ÑM•µ…¹Ñ¥¥Í…‰±”°(€€€€€€€€€€€¥¹É•µ•¹Ñ¥Í…‰±”è(€€€€€€€€€€€€€€€¥¹É•µ•¹ÑM•µ…¹Ñ¥¥Í…‰±”°(€€€€€€€€€€€½¹ÍÕµ•Ñ¥½¸è(€€€€€€€€€€€€€€€½¹ÍÕµ•M•µ…¹Ñ¥Ñ¥½¸°(€€€€€€€€€€€…¹•±¥Í…‰±”è(€€€€€€€€€€€€€€€…¹•±M•µ…¹Ñ¥¥Í…‰±”°(€€€€€€€€€€€•Ð‘¥Í…‰±•½Õ¹ÑÌ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€¸¸¹Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÌ(€€€€€€€€€€€€€€€ôì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€™Õ¹Ñ¥½¸½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€±…å•È°(€€€€€€€½ÁÑ¥½¹Ì(€€€€¤ì(€€€€€€€¥˜€¡¡…µ‰ÕÉ•É¹¹½Õ¹•µ•¹ÑM¥±•¹Ð¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€Á•É™½É´è™…±Í”°(€€€€€€€€€€€€€€€ÕÍ•É¥Í…‰±•è™…±Í”°(€€€€€€€€€€€€€€€ÉÕ¹Ñ¥µ•MÕÁÁÉ•ÍÍ•èÑÉÕ”°(€€€€€€€€€€€€€€€µ•¹ÕMÕÁÁÉ•ÍÍ•èÑÉÕ”(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€€……Õ‘¥½•±±UÍ•É¹…‰±• (€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€±…å•È°(€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€Á•É™½É´è™…±Í”°(€€€€€€€€€€€€€€€ÕÍ•É¥Í…‰±•èÑÉÕ”°(€€€€€€€€€€€€€€€ÉÕ¹Ñ¥µ•MÕÁÁÉ•ÍÍ•è™…±Í”(€€€€€€€€€€€ôì(€€€€€€€ô((€€€€€€€½¹ÍÐ‰•™½É”€ô(€€€€€€€€€€€Í•µ…¹Ñ¥¥Í…‰±•½Õ¹ÑÍm±…å•Étì(€€€€€€€½¹ÍÐÁ•É™½É´€ô(€€€€€€€€€€€½¹ÍÕµ•M•µ…¹Ñ¥Ñ¥½¸¡±…å•È¤ì((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€Á•É™½É´°(€€€€€€€€€€€ÕÍ•É¥Í…‰±•è™…±Í”°(€€€€€€€€€€€ÉÕ¹Ñ¥µ•MÕÁÁÉ•ÍÍ•è(€€€€€€€€€€€€€€€€…Á•É™½É´€˜˜‰•™½É”€ø€À(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°ÁÕÉÁ½Í”¤ì(€€€€€€€½¹ÍÐ‘•Ñ…¥°€ô•Ù•¹Ð¹‘•Ñ…¥°ì(€€€€€€€Ù½¥‘•Ñ…¥°ì(€€€€€€€Ù½¥ÁÕÉÁ½Í”ì(€€€ô((€€€±•ÐÍ•µ…¹Ñ¥MÁ••¡¡…¥¸ì(€€€±•ÐÍ•µ…¹Ñ¥MÁ••¡M•ÅÕ•¹”€ô€Àì(€€€½¹ÍÐ…Ñ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑÌ€ô(€€€€€€€¹•ÜM•Ð ¤ì(€€€±•Ð•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑQ…¥°€ô(€€€€€€€AÉ½µ¥Í”¹É•Í½±Ù” ¤ì(€€€±•Ð•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑA•¹‘¥¹œ€ô(€€€€€€€€Àì((€€€™Õ¹Ñ¥½¸É•Í•ÉÙ•M•µ…¹Ñ¥MÁ••  ¤ì(€€€€€€€¥˜€ …Í•µ…¹Ñ¥MÁ••¡¡…¥¸¤ì(€€€€€€€€€€€½¹ÍÐ¡…¥¸€ôì(€€€€€€€€€€€€€€€±…ÍÐè€À(€€€€€€€€€€€ôì((€€€€€€€€€€€Í•µ…¹Ñ¥MÁ••¡¡…¥¸€ô(€€€€€€€€€€€€€€€¡…¥¸ì((€€€€€€€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬ (€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€Í•µ…¹Ñ¥MÁ••¡¡…¥¸€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€¡…¥¸(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€Í•µ…¹Ñ¥MÁ••¡¡…¥¸€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¡…¥¸€ô(€€€€€€€€€€€Í•µ…¹Ñ¥MÁ••¡¡…¥¸ì(€€€€€€€½¹ÍÐÑ½­•¸€ô(€€€€€€€€€€€€¬­Í•µ…¹Ñ¥MÁ••¡M•ÅÕ•¹”ì((€€€€€€€¡…¥¸¹±…ÍÐ€ô(€€€€€€€€€€€Ñ½­•¸ì((€€€€€€€É•ÑÕÉ¸€ ¤€ôø(€€€€€€€€€€€¡…¥¸¹±…ÍÐ€ôôô(€€€€€€€€€€€€€€€Ñ½­•¸ì(€€€ô((€€€™Õ¹Ñ¥½¸Ý…¥Ñ½É¹¹½Õ¹•µ•¹Ñ•±…ä (€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€¤ì(€€€€€€€½¹ÍÐ‘•±…ä€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸‘•±…ä€ø€À(€€€€€€€€€€€€ü¹•ÜAÉ½µ¥Í” (€€€€€€€€€€€€€€€É•Í½±Ù”€ôø(€€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€€€€€É•Í½±Ù”°(€€€€€€€€€€€€€€€€€€€€€€€‘•±…ä(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€èAÉ½µ¥Í”¹É•Í½±Ù” ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÁ•…­M•µ…¹Ñ¥Œ (€€€€€€€…Õ‘¥¼°(€€€€€€€ÍÁ•• °(€€€€€€€½ÁÑ¥½¹Ì°(€€€€€€€Õ…É°(€€€€€€€‘•±…å5Ì€ô€À(€€€€¤ì(€€€€€€€½¹ÍÐÉÕ¸€ô(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Õ…É€˜˜(€€€€€€€€€€€€€€€€€€€Õ…É ¤€ôôô™…±Í”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÁ•…¬ü¸ (€€€€€€€€€€€€€€€€€€€ÍÁ•• °(€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ôì((€€€€€€€¥˜€ (€€€€€€€€€€€‘•±…å5Ì€ø€À(€€€€€€€€¤ì(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€ÉÕ¸°(€€€€€€€€€€€€€€€‘•±…å5Ì(€€€€€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬ (€€€€€€€€€€€ÉÕ¸(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€…Õ‘¥¼°(€€€€€€€ÍÁ•• °(€€€€€€€½ÁÑ¥½¹Ì°(€€€€€€€Õ…É(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€Õ…É€˜˜(€€€€€€€€€€€Õ…É ¤€ôôô™…±Í”(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” (€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€€……Õ‘¥¼ü¹ÍÁ•…¬ñð(€€€€€€€€€€€€…MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÁ•• ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹ÑÉ¥´ ¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” (€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸¹•ÜAÉ½µ¥Í” (€€€€€€€€€€€É•Í½±Ù”€ôøì(€€€€€€€€€€€€€€€±•ÐÍ•ÑÑ±•€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€½¹ÍÐ™¥¹¥Í €ô(€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡Í•ÑÑ±•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€Í•ÑÑ±•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€€€€€€€€€É•Í½±Ù” (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€½¹ÍÐÍÑ…ÉÑ•€ô(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼¹ÍÁ•…¬ (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ•• °(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¸¸¸¡½ÁÑ¥½¹Ìñðíô¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¹è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™¥¹¥Í °(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÉÉ½Èè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™¥¹¥Í (€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …ÍÑ…ÉÑ•¤ì(€€€€€€€€€€€€€€€€€€€™¥¹¥Í  ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ…­M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€Ñ…Í¬(€€€€¤ì(€€€€€€€…Ñ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑÌ(€€€€€€€€€€€€¹…‘ (€€€€€€€€€€€€€€€Ñ…Í¬(€€€€€€€€€€€€¤ì((€€€€€€€Ñ…Í¬¹Ñ¡•¸ (€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑÌ(€€€€€€€€€€€€€€€€€€€€¹‘•±•Ñ” (€€€€€€€€€€€€€€€€€€€€€€€Ñ…Í¬(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑÌ(€€€€€€€€€€€€€€€€€€€€¹‘•±•Ñ” (€€€€€€€€€€€€€€€€€€€€€€€Ñ…Í¬(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸Ñ…Í¬ì(€€€ô((€€€™Õ¹Ñ¥½¸ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€Á±…å‰…¬°(€€€€€€€ì(€€€€€€€€€€€•á±ÕÍ¥Ù”€ô™…±Í”(€€€€€€€ô€ôíô(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€ÑåÁ•½˜Á±…å‰…¬€„ôô(€€€€€€€€€€€€€€€€‰™Õ¹Ñ¥½¸ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” (€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡•á±ÕÍ¥Ù”¤ì(€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑA•¹‘¥¹œ¬¬ì((€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍá±ÕÍ¥Ù”€ô(€€€€€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑQ…¥°(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù•	•™½É”€ô(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€¸¸¹…Ñ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑÌ(€€€€€€€€€€€€€€€tì((€€€€€€€€€€€½¹ÍÐÑ…Í¬€ô(€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍá±ÕÍ¥Ù”(€€€€€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•	•™½É”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±•¹Ñ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐAÉ½µ¥Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…±±M•ÑÑ±• (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•	•™½É”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Á±…å‰…¬ ¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑQ…¥°€ô(€€€€€€€€€€€€€€€Ñ…Í¬(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰á±ÕÍ¥Ù”…¹¹½Õ¹•µ•¹ÐÁ±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹™¥¹…±±ä (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑA•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑA•¹‘¥¹œ€´(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•ÑÕÉ¸Ñ…Í¬ì(€€€€€€€ô((€€€€€€€½¹ÍÐ‰±½­•È€ô(€€€€€€€€€€€•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑA•¹‘¥¹œ€ø(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€ü•á±ÕÍ¥Ù•M•µ…¹Ñ¥¹¹½Õ¹•µ•¹ÑQ…¥°(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€èAÉ½µ¥Í”¹É•Í½±Ù” ¤ì((€€€€€€€É•ÑÕÉ¸ÑÉ…­M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€‰±½­•È¹Ñ¡•¸ (€€€€€€€€€€€€€€€Á±…å‰…¬(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Á±…åM•µ…¹Ñ¥M½¹œ¡¹…µ”°½ÁÑ¥½¹Ì€ôíô¤ì(€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì¹]5=Õ‘¥¼ì(€€€€€€€½¹ÍÐ¡¥µ”€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€ …¡¥µ”¹Á•É™½É´€˜˜€…ÍÕµµ…Éä¹Á•É™½É´¤ñð(€€€€€€€€€€€€……Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”¹É•Í½±Ù” (€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ½ÕÑÁÕÐ€ô(€€€€€€€€€€€…Õ‘¥½¹¹½Õ¹•µ•¹Ñ=ÕÑÁÕÐ (€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÁ••¡Õ…É€ô(€€€€€€€€€€€ÍÕµµ…Éä¹Á•É™½É´(€€€€€€€€€€€€€€€€üÉ•Í•ÉÙ•M•µ…¹Ñ¥MÁ••  ¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐ•á±ÕÍ¥Ù”€ô(€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑMÁ••¡%¹½É•Í5…ÍÑ•È (€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑM½¹9…µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄàÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•Q½¹•Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•MÁ•• è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éä¹Á•É™½É´°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Õ…É°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡•±…å5Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü½ÕÑÁÕÐ¹ÍÁ••¡•±…å5Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€À°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¸¸¹½ÁÑ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ½¹œ(€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€Í½¹œ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Õ‘¥¼Á±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€•á±ÕÍ¥Ù”(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€¹…µ”°(€€€€€€€ÍÁ•• °(€€€€€€€½ÁÑ¥½¹Ì€ôíô(€€€€¤ì(€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì¹]5=Õ‘¥¼ì(€€€€€€€½¹ÍÐ¡¥µ”€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ½ÕÑÁÕÐ€ô(€€€€€€€€€€€…Õ‘¥½¹¹½Õ¹•µ•¹Ñ=ÕÑÁÕÐ (€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÁ••¡Õ…É€ô(€€€€€€€€€€€ÍÁ•• (€€€€€€€€€€€€€€€€üÉ•Í•ÉÙ•M•µ…¹Ñ¥MÁ••  ¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€½¹ÍÐ•á±ÕÍ¥Ù”€ô(€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑMÁ••¡%¹½É•Í5…ÍÑ•È (€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€±•ÐÁ±…å•€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´€˜˜(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑM½¹9…µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄàÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¸¸¹½ÁÑ¥½¹Ì°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•MÁ•• è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€Á±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í½¹œü¹¡…Í¡¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ½¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡Á±…å•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÝ…¥Ñ½É¹¹½Õ¹•µ•¹Ñ•±…ä (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡•±…å5Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Õ‘¥¼Á±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÁ•• €˜˜(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÁ•…¬(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼°(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ•• °(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Õ…É(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€Á±…å•°(€€€€€€€€€€€€€€€€€€€¡¥µ”(€€€€€€€€€€€€€€€ôì(€€€€€€€€€€€ô°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€•á±ÕÍ¥Ù”(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€€¼¼…É±ä½±…Ñ”…¹¹½Õ¹•µ•¹ÑÌ…É”…‰½ÕÐÑ¡”Ñ¥µ¥¹œ…¥¸½È±½ÍÌ™½È(€€€€¼¼Ñ¡”ÕÉÉ•¹ÐÑÉ¥À•Ù•¹Ð¸Q¡•ä¥¹Ñ•¹Ñ¥½¹…±±ä¹•Ù•ÈÕÍ”ÍÕµµ…Éä¹Ñ½Ñ…°¸(€€€™Õ¹Ñ¥½¸ÑÉ¥ÁQ¥µ¥¹MÁ••  (€€€€€€€‘•Ñ…¥°°(€€€€€€€±•…°(€€€€€€€‘¥ÍÁ½Í¥Ñ¥½¸°(€€€€€€€…¹¹½Õ¹•µ•¹Ð(€€€€¤ì(€€€€€€€½¹ÍÐµ¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€€€€€€€€€ü¹Ñ¥µ•¥™™•É•¹•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐÁ…ÉÑÌ€ômtì((€€€€€€€¥˜€ (€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ(€€€€€€€€€€€€¤¹Á•É™½É´(€€€€€€€€¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€±•…€¬€ˆ¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€‰‘•Ñ…¥±Ìˆ(€€€€€€€€€€€€¤¹Á•É™½É´(€€€€€€€€¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€5…Ñ ¹…‰Ì (€€€€€€€€€€€€€€€€€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€‘¥ÍÁ½Í¥Ñ¥½¸€¬(€€€€€€€€€€€€€€€€ˆ¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸Á…ÉÑÌ¹©½¥¸ (€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑMÁ½­•¹A•É•¹Ð (€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€9Õµ‰•È¡Ù…±Õ”¤€¨(€€€€€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡Á•É•¹Ð¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€ˆÁ•É•¹Ðˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É•‘½…±1…‰•° (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€‘•Ñ…¥°ü¹ÍÕµµ…Éäì(€€€€€€€½¹ÍÐÍ½Á”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÕµµ…Éäü¹Í½Á”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹Ñ½1½Ý•É…Í” ¤ì(€€€€€€€½¹ÍÐÍ•±•Ñ•€ô(€€€€€€€€€€€ÍÕµµ…Éäü¹Í•±•Ñ•ñð(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€üÍÕµµ…Éäü¹Ñ½Ñ…°(€€€€€€€€€€€€€€€€€€€€èÍÕµµ…Éäü¹ÑÉ¥À(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÁ•É•¹Ñ½…°€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Í•±•Ñ•ü¹Á•É•¹Ñ½…°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÉ½Õ¹‘•‘A•É•¹Ð€ô(€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡Á•É•¹Ñ½…°¤(€€€€€€€€€€€€€€€€ü5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€Á•É•¹Ñ½…°€¨€ÄÀÀ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì((€€€€€€€¥˜€ (€€€€€€€€€€€Í½Á”€ôôô€‰ÍÑ…¹‘…Éˆñð(€€€€€€€€€€€É½Õ¹‘•‘A•É•¹Ð€ôôô€ÄÀÀ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€‰MÑ…¹‘…É½…°ˆì(€€€€€€€ô((€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡É½Õ¹‘•‘A•É•¹Ð¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô((€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€è€‰QÉ¥Àˆì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€ÑåÁ”€¬(€€€€€€€€€€€€ˆ½…°€ˆ€¬(€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€É½Õ¹‘•‘A•É•¹Ð(€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€ˆÁ•É•¹Ðˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•É•‘½…±I•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€‘•Ñ…¥°ü¹ÍÕµµ…Éäì(€€€€€€€½¹ÍÐÍ½Á”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€ÍÕµµ…Éäü¹Í½Á”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹Ñ½1½Ý•É…Í” ¤ì(€€€€€€€½¹ÍÐÍ•±•Ñ•€ô(€€€€€€€€€€€ÍÕµµ…Éäü¹Í•±•Ñ•ñð(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Í½Á”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€üÍÕµµ…Éäü¹Ñ½Ñ…°(€€€€€€€€€€€€€€€€€€€€èÍÕµµ…Éäü¹ÑÉ¥À(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÑ…¹‘…É€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Í•±•Ñ•ü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ½Õ¹Ñ•€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Í•±•Ñ•ü¹½Õ¹Ñ•‘Q¥µ•±…ÁÍ•‘5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÁ•É•¹Ñ½…°€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Í•±•Ñ•ü¹Á•É•¹Ñ½…°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ…±±½Ý…¹•É•‘¥Ð€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Í•±•Ñ•ü¹…±±½Ý…¹•É•‘¥Ñ5¥±±¥Í•½¹‘Ì€üü(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÍÑ…¹‘…É¤ñð(€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡½Õ¹Ñ•¤ñð(€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡Á•É•¹Ñ½…°¤ñð(€€€€€€€€€€€Á•É•¹Ñ½…°€ðô€À(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸5…Ñ ¹É½Õ¹ (€€€€€€€€€€€ÍÑ…¹‘…É€¼(€€€€€€€€€€€€€€€Á•É•¹Ñ½…°€¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡…±±½Ý…¹•É•‘¥Ð¤(€€€€€€€€€€€€€€€€€€€€ü…±±½Ý…¹•É•‘¥Ð(€€€€€€€€€€€€€€€€€€€€è€À(€€€€€€€€€€€€¤€´(€€€€€€€€€€€½Õ¹Ñ•(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁMÑ…ÉÑ½…±•Ñ…¥±MÁ••  (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹œ€ô(€€€€€€€€€€€É•¹‘•É•‘½…±I•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€É•¹‘•É•‘½…±1…‰•° (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•µ…¥¹¥¹œ¤ñð(€€€€€€€€€€€É•µ…¥¹¥¹œ€ðô€Àñð(€€€€€€€€€€€€…±…‰•°(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€ˆÕ¹Ñ¥°€ˆ€¬(€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€ˆ¸ˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥Á¹‘Q½Ñ…±MÁ••  (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐÑ½Ñ…°€ô(€€€€€€€€€€€‘•Ñ…¥°ü¹ÍÕµµ…Éäü¹Ñ½Ñ…°ì(€€€€€€€½¹ÍÐ½Õ¹Ñ•‘A•É•¹Ð€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Ñ½Ñ…°ü¹½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÁ…ÉÑÌ€ômtì(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ‘•Ñ…¥±Ì€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€€€€€€‰‘•Ñ…¥±Ìˆ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡ÍÕµµ…Éä¹Á•É™½É´¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€‰QÉ¥À•¹‘•¸ˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬€ˆÁ•É•¹Ðè€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑMÁ½­•¹A•É•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€¥˜€¡‘•Ñ…¥±Ì¹Á•É™½É´¤ì(€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹œ€ô(€€€€€€€€€€€€€€€É•¹‘•É•‘½…±I•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€É•¹‘•É•‘½…±1…‰•° (€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•µ…¥¹¥¹œ¤€˜˜(€€€€€€€€€€€€€€€±…‰•°(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€¡É•µ…¥¹¥¹œ€ø€À¤ì(€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ‰…¹­•Ñ½Ý…É€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”¥˜€¡É•µ…¥¹¥¹œ€ð€À¤ì(€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹…‰Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ½Ù•È€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸Á…ÉÑÌ¹©½¥¸ ˆ€ˆ¤ì(€€€ô((€€€±•Ð±Õ¹¡±½­Õ•MÑ…Ñ”ì((€€€™Õ¹Ñ¥½¸±•…É1Õ¹¡±½­Õ•MÑ…Ñ” ¤ì(€€€€€€€¥˜€ …±Õ¹¡±½­Õ•MÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”¹±½­=ÕÑQ¥µ•È(€€€€€€€€¤ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”¹±½­%¹Q¥µ•È(€€€€€€€€¤ì((€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡•‘Õ±•1Õ¹¡±½­Õ•Ì¡‘•Ñ…¥°€ôíô¤ì(€€€€€€€±•…É1Õ¹¡±½­Õ•MÑ…Ñ” ¤ì((€€€€€€€½¹ÍÐ¥Í1Õ¹ €ô(€€€€€€€€€€€‘•Ñ…¥°¹¥Í1Õ¹ €ôôôÑÉÕ”ñð(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€‘•Ñ…¥°¹‰É•…­QåÁ”ñð(€€€€€€€€€€€€€€€‘•Ñ…¥°¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€ôôô(€€€€€€€€€€€€€€€€‰±Õ¹ ˆì((€€€€€€€¥˜€ …¥Í1Õ¹ ¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ±½­=ÕÑÐ€ô(€€€€€€€€€€€¹•Ü…Ñ” (€€€€€€€€€€€€€€€‘•Ñ…¥°¹ÍÑ…ÉÑQ¥µ”(€€€€€€€€€€€€¤¹•ÑQ¥µ” ¤ì((€€€€€€€½¹ÍÐ±½­%¹Ð€ô(€€€€€€€€€€€¹•Ü…Ñ” (€€€€€€€€€€€€€€€‘•Ñ…¥°¹•¹‘Q¥µ”(€€€€€€€€€€€€¤¹•ÑQ¥µ” ¤ì((€€€€€€€½¹ÍÐÍÑ…Ñ”€ôì(€€€€€€€€€€€±½­=ÕÑÐ°(€€€€€€€€€€€±½­%¹Ð°(€€€€€€€€€€€±½­=ÕÑ¥É•è™…±Í”°(€€€€€€€€€€€±½­%¹¥É•è™…±Í”°(€€€€€€€€€€€±½­=ÕÑQ¥µ•ÈèÕ¹‘•™¥¹•°(€€€€€€€€€€€±½­%¹Q¥µ•ÈèÕ¹‘•™¥¹•(€€€€€€€ôì((€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”€ô(€€€€€€€€€€€ÍÑ…Ñ”ì((€€€€€€€½¹ÍÐ™¥É•±½­=ÕÐ€ô(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­=ÕÑ¥É•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­=ÕÑ¥É•€ô(€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ (€€€€€€€€€€€€€€€€€€€€‰±Õ¹ µ±½¬µ½ÕÐˆ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄÈÀ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ôì((€€€€€€€½¹ÍÐ™¥É•±½­%¸€ô(€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹¥É•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹¥É•€ô(€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ (€€€€€€€€€€€€€€€€€€€€‰±Õ¹ µ±½¬µ¥¸ˆ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄÈÀ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ôì((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€±½­=ÕÑÐ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€ÍÑ…Ñ”¹±½­=ÕÑQ¥µ•È€ô(€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€™¥É•±½­=ÕÐ°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€±½­=ÕÑÐ€´(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€±½­%¹Ð(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹Q¥µ•È€ô(€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€™¥É•±½­%¸°(€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€±½­%¹Ð€´(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€ô((€€€™Õ¹Ñ¥½¸™¥¹¥Í¡1Õ¹¡±½­Õ•Ì¡‘•Ñ…¥°€ôíô¤ì(€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”ì((€€€€€€€¥˜€ …ÍÑ…Ñ”¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€ÍÑ…Ñ”¹±½­=ÕÑQ¥µ•È(€€€€€€€€¤ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹Q¥µ•È(€€€€€€€€¤ì((€€€€€€€½¹ÍÐ•¹‘•‘Ð€ô(€€€€€€€€€€€¹•Ü…Ñ” (€€€€€€€€€€€€€€€‘•Ñ…¥°¹…ÑÕ…±¹‘Q¥µ”ñð(€€€€€€€€€€€€€€€‘•Ñ…¥°¹•¹‘Q¥µ”ñð(€€€€€€€€€€€€€€€…Ñ”¹¹½Ü ¤(€€€€€€€€€€€€¤¹•ÑQ¥µ” ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…Ñ”¹±½­=ÕÑ¥É•€˜˜(€€€€€€€€€€€€…ÍÑ…Ñ”¹±½­%¹¥É•€˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹Ð(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€•¹‘•‘Ð(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€•¹‘•‘Ð€ð(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹Ð(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€ÍÑ…Ñ”¹±½­%¹¥É•€ô(€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ (€€€€€€€€€€€€€€€€‰±Õ¹ µ±½¬µ¥¸ˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€‰Á´è€ÄÈÀ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€±Õ¹¡±½­Õ•MÑ…Ñ”€ô(€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€ô((€€€±•Ð•¹‘¥¹%¹Ñ½9•ÝQÉ¥À€ô(€€€€€€€™…±Í”ì((€€€±•ÐÁ•¹‘¥¹¹‘MÑ…ÉÑQÉ¥ÁMÁ•• ì((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁÉ…™ÑUÍ•Í¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸ ¤ì(€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€ü¹•¹‘MÑ…ÉÑQÉ…¹Í¥Ñ¥½¸€ôôô(€€€€€€€€€€€ÑÉÕ”(€€€€€€€€¤ì(€€€ô(((((€€€™Õ¹Ñ¥½¸™½Éµ…ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹5½µ•¹Ð (€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€½¹ÍÐ‘…Ñ”€ô(€€€€€€€€€€€Ù…±Õ”¥¹ÍÑ…¹•½˜…Ñ”(€€€€€€€€€€€€€€€€ü¹•Ü…Ñ” (€€€€€€€€€€€€€€€€€€€Ù…±Õ”¹•ÑQ¥µ” ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€è¹•Ü…Ñ” (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í9…8 (€€€€€€€€€€€€€€€‘…Ñ”¹•ÑQ¥µ” ¤(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆ´´´ˆì(€€€€€€€ô((€€€€€€€½¹ÍÐµ¥±¥Ñ…Éä€ô(€€€€€€€€€€€±½­Q¥µ•È¹•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€‰µ¥±¥Ñ…ÉäµÑ¥µ”ˆ(€€€€€€€€€€€€¤€„ôô(€€€€€€€€€€€€€€€€‰™…±Í”ˆì(€€€€€€€½¹ÍÐµ¥¹ÕÑ•Ì€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€‘…Ñ”¹•Ñ5¥¹ÕÑ•Ì ¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍ•½¹‘Ì€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€‘…Ñ”¹•ÑM•½¹‘Ì ¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€¥˜€¡µ¥±¥Ñ…Éä¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€‘…Ñ”¹•Ñ!½ÕÉÌ ¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹Á…‘MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€€È°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÀˆ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì€¬(€€€€€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐ¡½ÕÉÌ€ô(€€€€€€€€€€€‘…Ñ”¹•Ñ!½ÕÉÌ ¤ì((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€¡½ÕÉÌ€”(€€€€€€€€€€€€€€€€€€€€ÄÈñð(€€€€€€€€€€€€€€€€ÄÈ(€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€µ¥¹ÕÑ•Ì€¬(€€€€€€€€€€€€ˆèˆ€¬(€€€€€€€€€€€Í•½¹‘Ì€¬(€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€¡½ÕÉÌ€øô(€€€€€€€€€€€€€€€€€€€€ÄÈ(€€€€€€€€€€€€€€€€€€€€ü€‰A4ˆ(€€€€€€€€€€€€€€€€€€€€è€‰4ˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹ÕÉ…Ñ¥½¸ (€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€½¹ÍÐµ¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆ´´´ˆì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸™½Éµ…ÑÕÉ…Ñ¥½¸ (€€€€€€€€€€€5…Ñ ¹…‰Ì (€€€€€€€€€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹I½Ü (€€€€€€€±…‰•°°(€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€½¹ÍÐÑ•áÐ€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€Ù…±Õ”€üü(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€€…Ñ•áÐñð(€€€€€€€€€€€Ñ•áÐ€ôôô(€€€€€€€€€€€€€€€€ˆ´´´ˆ(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€Ù…±Õ”è(€€€€€€€€€€€€€€€Ñ•áÐ(€€€€€€€ôì(€€€ô((€€€™Õ¹Ñ¥½¸É•¹‘•ÉQÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%Ñ•´ (€€€€€€€¥Ñ•´(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…äñð(€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åQ¥Ñ±”ñð(€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å•Ñ…¥±Ì(€€€€€€€€¤ì(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åÑ¥Ù”€ô(€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åQ¥Ñ±”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€¥Ñ•´¹Ñ¥Ñ±”ì(€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å•Ñ…¥±Ì(€€€€€€€€€€€€¹É•Á±…•¡¥±‘É•¸ (€€€€€€€€€€€€€€€€¸¸¹¥Ñ•´¹É½ÝÌ(€€€€€€€€€€€€€€€€€€€€¹µ…À (€€€€€€€€€€€€€€€€€€€€€€€É½Ü€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ•±•µ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Øˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ…¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½‘”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð¹±…ÍÍ9…µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÑÉ…¹Í¥Ñ¥½¸µ½Ù•É±…äµÉ½Üˆì(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É½Ü¹±…‰•°ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”¹Ñ•áÑ½¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É½Ü¹Ù…±Õ”ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð¹…ÁÁ•¹ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸•±•µ•¹Ðì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä¹¡¥‘‘•¸€ô(€€€€€€€€€€€™…±Í”ì((€€€€€€€ÑÉäì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹¡…ÍÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€€€€€‰Á½Á½Ù•Èˆ(€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€…ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹µ…Ñ¡•Ì (€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹Í¡½ÝA½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€ô(€€€€€€€ô(€€€€€€€…Ñ íô((€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€€€€€¹…‘ (€€€€€€€€€€€€€€€€€€€€€€€€‰¥ÌµÙ¥Í¥‰±”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åQ¥µ•È(€€€€€€€€¤ì(€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å!¥‘•Q¥µ•È(€€€€€€€€¤ì((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åQ¥µ•È€ô(€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€Íå¹QÉ¥ÁQÉ…¹Í¥Ñ¥½¹‘¥Ñ½É1…å½ÕÐ (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¥ÌµÙ¥Í¥‰±”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å!¥‘•Q¥µ•È€ô(€€€€€€€€€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ…Ñ¡•Ìü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆéÁ½Á½Ù•Èµ½Á•¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¡¥‘•A½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä¹¡¥‘‘•¸€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åÑ¥Ù”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¹•áÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åEÕ•Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡¥™Ð ¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡¹•áÐ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åÑ¥Ù”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%Ñ•´ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÈàÀ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€ÜÀÀÀ(€€€€€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸•¹ÅÕ•Õ•QÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä (€€€€€€€Ñ¥Ñ±”°(€€€€€€€É½ÝÌ(€€€€¤ì(€€€€€€€½¹ÍÐ¥Ñ•´€ôì(€€€€€€€€€€€Ñ¥Ñ±”°(€€€€€€€€€€€É½ÝÌè(€€€€€€€€€€€€€€€É½ÝÌ¹™¥±Ñ•È (€€€€€€€€€€€€€€€€€€€	½½±•…¸(€€€€€€€€€€€€€€€€¤(€€€€€€€ôì((€€€€€€€¥˜€ (€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åÑ¥Ù”(€€€€€€€€¤ì(€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åEÕ•Õ”(€€€€€€€€€€€€€€€€¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€¥Ñ•´(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…åÑ¥Ù”€ô(€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€É•¹‘•ÉQÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…å%Ñ•´ (€€€€€€€€€€€¥Ñ•´(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸Í¡½ÝQÉ¥Á¹‘QÉ…¹Í¥Ñ¥½¹=Ù•É±…ä (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐÑ½Ñ…°€ô(€€€€€€€€€€€‘•Ñ…¥°ü¹ÍÕµµ…Éäü¹Ñ½Ñ…°ì(€€€€€€€½¹ÍÐ½Õ¹Ñ•‘A•É•¹Ð€ô(€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€Ñ½Ñ…°ü¹½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹œ€ô(€€€€€€€€€€€É•¹‘•É•‘½…±I•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ½…±1…‰•°€ô(€€€€€€€€€€€É•¹‘•É•‘½…±1…‰•° (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÉ½ÝÌ€ômtì((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€É½ÝÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹I½Ü (€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆA•É•¹Ðˆ°(€€€€€€€€€€€€€€€€€€€™½Éµ…ÑÑÕ…±A•É•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€½Õ¹Ñ•‘A•É•¹Ð(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€½…±1…‰•°(€€€€€€€€¤ì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ€ø(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É½ÝÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹I½Ü (€€€€€€€€€€€€€€€€€€€€€€€€‰	…¹­•Q½Ý…É€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€½…±1…‰•°°(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ€ð(€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É½ÝÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁQÉ…¹Í¥Ñ¥½¹I½Ü (€€€€€€€€€€€€€€€€€€€€€€€€‰=Ù•È€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€½…±1…‰•°°(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑQÉ¥ÁQÉ…¹Í¥Ñ¥½¹ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€•¹ÅÕ•Õ•QÉ¥ÁQÉ…¹Í¥Ñ¥½¹=Ù•É±…ä (€€€€€€€€€€€€‰QÉ¥À¹‘•ˆ°(€€€€€€€€€€€É½ÝÌ(€€€€€€€€¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸½¹QÉ¥ÁMÑ…ÉÑ•¡•Ù•¹Ð¤ì(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€ü¹‰•¥¹MÁ••¡Q¥µ¥¹QÉ¥Àü¸ ¤ì((€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð (€€€€€€€€€€€•Ù•¹Ð°(€€€€€€€€€€€€‰QÉ¥ÀÍÑ…ÉÑ•½¸Ñ¥µ”ˆ(€€€€€€€€¤ì((€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì¹]5=Õ‘¥¼ì(€€€€€€€½¹ÍÐ¡¥µ”€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ‘•Ñ…¥±Ì€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€‰‘•Ñ…¥±Ìˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÁ…ÉÑÌ€ômtì((€€€€€€€¥˜€¡ÍÕµµ…Éä¹Á•É™½É´¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€¡¥µ”¹ÉÕ¹Ñ¥µ•MÕÁÁÉ•ÍÍ•€˜˜(€€€€€€€€€€€€€€€€…¡¥µ”¹ÕÍ•É¥Í…‰±•(€€€€€€€€€€€€€€€€€€€€ü€‰QÉ¥À¥¸AÉ½É•ÍÌ¸ˆ(€€€€€€€€€€€€€€€€€€€€è€‰QÉ¥ÀÍÑ…ÉÑ•¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡‘•Ñ…¥±Ì¹Á•É™½É´¤ì(€€€€€€€€€€€½¹ÍÐ‘•Ñ…¥±MÁ•• €ô(€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑ½…±•Ñ…¥±MÁ••  (€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡‘•Ñ…¥±MÁ•• ¤ì(€€€€€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€‘•Ñ…¥±MÁ•• (€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐ½ÕÑÁÕÐ€ô(€€€€€€€€€€€…Õ‘¥½¹¹½Õ¹•µ•¹Ñ=ÕÑÁÕÐ (€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐÍÁ••¡Õ…É€ô(€€€€€€€€€€€Á…ÉÑÌ¹±•¹Ñ (€€€€€€€€€€€€€€€€üÉ•Í•ÉÙ•M•µ…¹Ñ¥MÁ••  ¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì((€€€€€€€É•ÑÕÉ¸ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€±•Ð¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´€˜˜(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄàÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•MÁ•• è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í½¹œü¹¡…Í¡¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ½¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡¡¥µ•A±…å•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÝ…¥Ñ½É¹¹½Õ¹•µ•¹Ñ•±…ä (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡•±…å5Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Õ‘¥¼Á±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹±•¹Ñ €˜˜(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÁ•…¬(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼°(€€€€€€€€€€€€€€€€€€€€€€€Á…ÉÑÌ¹©½¥¸ ˆ€ˆ¤°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Õ…É(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€•á±ÕÍ¥Ù”è(€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑMÁ••¡%¹½É•Í5…ÍÑ•È (€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥ÁMÑ…ÉÑ•‘…É±ä¡•Ù•¹Ð¤ì(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€ü¹‰•¥¹MÁ••¡Q¥µ¥¹QÉ¥Àü¸ ¤ì((€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰QÉ¥ÀÍÑ…ÉÑ••…É±äˆ¤ì((€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•µ•…É±äˆ°(€€€€€€€€€€€ÑÉ¥ÁQ¥µ¥¹MÁ••  (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°°(€€€€€€€€€€€€€€€€‰QÉ¥ÀÍÑ…ÉÑ••…É±äˆ°(€€€€€€€€€€€€€€€€‰Í…Ù•ˆ°(€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•µ•…É±äˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥ÁMÑ…ÉÑ•‘1…Ñ”¡•Ù•¹Ð¤ì(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€ü¹‰•¥¹MÁ••¡Q¥µ¥¹QÉ¥Àü¸ ¤ì((€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰QÉ¥ÀÍÑ…ÉÑ•±…Ñ”ˆ¤ì((€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•µ±…Ñ”ˆ°(€€€€€€€€€€€ÑÉ¥ÁQ¥µ¥¹MÁ••  (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°°(€€€€€€€€€€€€€€€€‰QÉ¥ÀÍÑ…ÉÑ•±…Ñ”ˆ°(€€€€€€€€€€€€€€€€‰±½ÍÐˆ°(€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍÑ…ÉÑ•µ±…Ñ”ˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹	É•…­MÑ…ÉÑ•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰	É•…¬½È±Õ¹ ÍÑ…ÉÑ•ˆ¤ì((€€€€€€€½¹ÍÐ‰É•…­QåÁ”€ô(€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹‰É•…­QåÁ”ñð(€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€¤¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ (€€€€€€€€€€€‰É•…­QåÁ”€ôôô€‰±Õ¹ ˆ(€€€€€€€€€€€€€€€€ü€‰±Õ¹ µÍÑ…ÉÑ•ˆ(€€€€€€€€€€€€€€€€è‰É•…­QåÁ”€ôôô€‰Í¡½ÉÐˆ(€€€€€€€€€€€€€€€€€€€€ü€‰Í¡½ÉÐµ‰É•…¬µÍÑ…ÉÑ•ˆ(€€€€€€€€€€€€€€€€€€€€è€‰‰É•…¬µÍÑ…ÉÑ•ˆ(€€€€€€€€¤ì((€€€€€€€Í¡•‘Õ±•1Õ¹¡±½­Õ•Ì (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹	É•…­¹‘•‘…É±ä¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰	É•…¬½È±Õ¹ µ…¹Õ…±±ä•¹‘•‰•™½É”Ñ¡”…ÕÑ¼µÉ•ÍÑ…ÉÐ‰½Õ¹‘…Éäˆ¤ì(€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€‰ÑÉ¥ÀµÉ•ÍÕµ•µ•…É±äˆ°(€€€€€€€€€€€ÑÉ¥ÁQ¥µ¥¹MÁ••  (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°°(€€€€€€€€€€€€€€€€‰QÉ¥ÀÉ•ÍÕµ••…É±äˆ°(€€€€€€€€€€€€€€€€‰Í…Ù•ˆ°(€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÉ•ÍÕµ•µ•…É±äˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡1Õ¹¡±½­Õ•Ì (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹	É•…­¹‘•‘ÕÑ½µ…Ñ¥…±±ä¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰	É•…¬½È±Õ¹ …ÕÑ½µ…Ñ¥…±±ä•¹‘•…ÐÑ¡”•¹µ‰Õ™™•È‰½Õ¹‘…Éäˆ¤ì(€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ ‰ÑÉ¥ÀµÉ•ÍÕµ•µ…ÕÑ½µ…Ñ¥…±±äˆ¤ì(€€€€€€€™¥¹¥Í¡1Õ¹¡±½­Õ•Ì (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹	É•…­¹‘•‘1…Ñ”¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰	É•…¬½È±Õ¹ µ…¹Õ…±±ä•¹‘•…™Ñ•ÈÑ¡”•¹µ‰Õ™™•È‰½Õ¹‘…Éäˆ¤ì(€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€‰ÑÉ¥ÀµÉ•ÍÕµ•µ…™Ñ•Èµ‰É•…¬ˆ°(€€€€€€€€€€€ÑÉ¥ÁQ¥µ¥¹MÁ••  (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°°(€€€€€€€€€€€€€€€€‰QÉ¥ÀÉ•ÍÕµ•ˆ°(€€€€€€€€€€€€€€€€‰±½ÍÐˆ°(€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÉ•ÍÕµ•µ…™Ñ•Èµ‰É•…¬ˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€™¥¹¥Í¡1Õ¹¡±½­Õ•Ì (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹½Ý¹Q¥µ•MÑ…ÉÑ•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰½Ý¸Ñ¥µ”ÍÑ…ÉÑ•ˆ¤ì(€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ ‰‘½Ý¸µÑ¥µ”µÍÑ…ÉÑ•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥ÁI•ÍÕµ•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð (€€€€€€€€€€€•Ù•¹Ð°(€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€€€€€€€€€ü¹ÍÕÁÁÉ•ÍÍ¹¹½Õ¹•µ•¹Ð(€€€€€€€€€€€€€€€€ü€‰QÉ¥ÀÉ•ÍÕµ•™É½´‘½Ý¸Ñ¥µ”‘ÕÉ¥¹œ…¸¥¹Ñ•ÉÙ…°¡…¹‘½™˜ˆ(€€€€€€€€€€€€€€€€è€‰QÉ¥ÀÉ•ÍÕµ•™É½´‘½Ý¸Ñ¥µ”ˆ(€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€€€€€€€€€ü¹ÍÕÁÁÉ•ÍÍ¹¹½Õ¹•µ•¹Ð(€€€€€€€€¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€Á±…åM•µ…¹Ñ¥M½¹œ (€€€€€€€€€€€€‰ÑÉ¥ÀµÉ•ÍÕµ•µ™É½´µ‘½Ý¸ˆ(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥Á¹‘•¡•Ù•¹Ð¤ì(€€€€€€€½¹ÍÐÍÁ••¡Q¥µ¥¹AÉ½™¥±”€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡MÁ••¡Q¥µ¥¹QÉ¥Àü¸ ¤ì((€€€€€€€¥˜€¡ÍÁ••¡Q¥µ¥¹AÉ½™¥±”¤ì(€€€€€€€€€€€Ù½¥Á•ÉÍ¥ÍÑMÁ••¡Q¥µ¥¹AÉ½™¥±” (€€€€€€€€€€€€€€€ÍÁ••¡Q¥µ¥¹AÉ½™¥±”(€€€€€€€€€€€€¤¹…Ñ  (€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€½¹Í½±”¹Ý…É¸ (€€€€€€€€€€€€€€€€€€€€€€€€‰MÁ•• Ñ¥µ¥¹œÁÉ½™¥±”Ý…Ì¹½ÐÍ…Ù•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€Í¡½ÝQÉ¥Á¹‘QÉ…¹Í¥Ñ¥½¹=Ù•É±…ä (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì((€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰QÉ¥À•¹‘•ˆ¤ì((€€€€€€€½¹ÍÐÍÁ•• €ô(€€€€€€€€€€€ÑÉ¥Á¹‘Q½Ñ…±MÁ••  (€€€€€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€•¹‘¥¹%¹Ñ½9•ÝQÉ¥À(€€€€€€€€¤ì(€€€€€€€€€€€Á•¹‘¥¹¹‘MÑ…ÉÑQÉ¥ÁMÁ•• €ô(€€€€€€€€€€€€€€€ÍÁ•• ì((€€€€€€€€€€€€¼¼Q¡”‘¥É•Ð•¹´ùÍÑ…ÉÐÝ½É­™±½ÜÁÉ•±½…‘Ì½¹”¡¥µ”ÍÕÁÁÉ•ÍÍ¥½¸¸(€€€€€€€€€€€€¼¼ÑÑ•µÁÑ¥¹œÑ¡”½É‘¥¹…Éä¹QÉ¥ÀÕ”¡•É”½¹ÍÕµ•ÌÑ¡…ÐÍ±½Ð°(€€€€€€€€€€€€¼¼Í¼Ñ¡”±•…ä€Ìµ¹½Ñ”Õ”¥ÌÍ­¥ÁÁ•Ý¥Ñ¡½ÕÐÍÁ•¥…°…Í¥¹œÑ¡”(€€€€€€€€€€€€¼¼…Õ‘¥¼¡•±Á•È¥ÑÍ•±˜¸(€€€€€€€€€€€½¹ÍÕµ•M•µ…¹Ñ¥Ñ¥½¸ (€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€Ù½¥Á±…åM•µ…¹Ñ¥M½¹Q¡•¹MÁ•…¬ (€€€€€€€€€€€€‰ÑÉ¥Àµ•¹‘•ˆ°(€€€€€€€€€€€ÍÁ•• (€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹Q½Ñ…±½…±M•Ð¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰Q½Ñ…°½…°•áÁ±¥¥Ñ±äÍ•Ðˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥Á½…±M•Ð¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰QÉ¥À½…°•áÁ±¥¥Ñ±äÍ•Ðˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹QÉ¥Á½…±ÕÑ½µ…Ñ¥…±±åM•Ð¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰QÉ¥À½…°‘•É¥Ù•…ÕÑ½µ…Ñ¥…±±äˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€Ù…±Õ”(€€€€¤ì(€€€€€€€½¹ÍÐ¹Õµ‰•È€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€9Õµ‰•È¡Ù…±Õ”¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹Õµ‰•È¤¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ˆˆì(€€€€€€€ô((€€€€€€€½¹ÍÐÍµ…±°€ôl(€€€€€€€€€€€€‰é•É¼ˆ°€‰½¹”ˆ°€‰ÑÝ¼ˆ°€‰Ñ¡É•”ˆ°€‰™½ÕÈˆ°(€€€€€€€€€€€€‰™¥Ù”ˆ°€‰Í¥àˆ°€‰Í•Ù•¸ˆ°€‰•¥¡Ðˆ°€‰¹¥¹”ˆ°(€€€€€€€€€€€€‰Ñ•¸ˆ°€‰•±•Ù•¸ˆ°€‰ÑÝ•±Ù”ˆ°€‰Ñ¡¥ÉÑ••¸ˆ°(€€€€€€€€€€€€‰™½ÕÉÑ••¸ˆ°€‰™¥™Ñ••¸ˆ°€‰Í¥áÑ••¸ˆ°(€€€€€€€€€€€€‰Í•Ù•¹Ñ••¸ˆ°€‰•¥¡Ñ••¸ˆ°€‰¹¥¹•Ñ••¸ˆ(€€€€€€€tì((€€€€€€€½¹ÍÐÑ•¹Ì€ôl(€€€€€€€€€€€€ˆˆ°€ˆˆ°€‰ÑÝ•¹Ñäˆ°€‰Ñ¡¥ÉÑäˆ°€‰™½ÉÑäˆ°(€€€€€€€€€€€€‰™¥™Ñäˆ°€‰Í¥áÑäˆ°€‰Í•Ù•¹Ñäˆ°(€€€€€€€€€€€€‰•¥¡Ñäˆ°€‰¹¥¹•Ñäˆ(€€€€€€€tì((€€€€€€€½¹ÍÐÕ¹‘•ÉQ¡½ÕÍ…¹€ô(€€€€€€€€€€€¹Õµ‰•È€ôøì(€€€€€€€€€€€€€€€¥˜€¡¹Õµ‰•È€ð€ÈÀ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Íµ…±±m¹Õµ‰•Étì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡¹Õµ‰•È€ð€ÄÀÀ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹‘•È€ô(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•È€”€ÄÀì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€Ñ•¹Íl(€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•È€¼€ÄÀ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€t€¬(€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ´ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Íµ…±±l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹‘•È€ô(€€€€€€€€€€€€€€€€€€€¹Õµ‰•È€”€ÄÀÀì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€Íµ…±±l(€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•È€¼€ÄÀÀ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€t€¬(€€€€€€€€€€€€€€€€€€€€ˆ¡Õ¹‘É•ˆ€¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ…¹€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•ÉQ¡½ÕÍ…¹ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ôì((€€€€€€€¥˜€¡¹Õµ‰•È€ð€ÄÀÀÀ¤ì(€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•ÉQ¡½ÕÍ…¹ (€€€€€€€€€€€€€€€¹Õµ‰•È(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡¹Õµ‰•È€ð€ÄÀÀÀÀÀÀ¤ì(€€€€€€€€€€€½¹ÍÐÑ¡½ÕÍ…¹‘Ì€ô(€€€€€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€€€€¹Õµ‰•È€¼€ÄÀÀÀ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹‘•È€ô(€€€€€€€€€€€€€€€¹Õµ‰•È€”€ÄÀÀÀì((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€Ñ¡½ÕÍ…¹‘Ì(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆÑ¡½ÕÍ…¹ˆ€¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•ÉQ¡½ÕÍ…¹ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹‘•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸MÑÉ¥¹œ¡¹Õµ‰•È¤ì(€€€ô((€€€™Õ¹Ñ¥½¸™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€µ¥±±¥Í•½¹‘Ì(€€€€¤ì(€€€€€€€½¹ÍÐÑ½Ñ…±M•½¹‘Ì€ô(€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€9Õµ‰•È¡µ¥±±¥Í•½¹‘Ì¤€¼(€€€€€€€€€€€€€€€€€€€€€€€€ÄÀÀÀ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ¡½ÕÉÌ€ô(€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€Ñ½Ñ…±M•½¹‘Ì€¼(€€€€€€€€€€€€€€€€€€€€ÌØÀÀ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐµ¥¹ÕÑ•Ì€ô(€€€€€€€€€€€5…Ñ ¹™±½½È (€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M•½¹‘Ì€”(€€€€€€€€€€€€€€€€€€€€ÌØÀÀ(€€€€€€€€€€€€€€€€¤€¼(€€€€€€€€€€€€€€€€€€€€ØÀ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐÍ•½¹‘Ì€ô(€€€€€€€€€€€Ñ½Ñ…±M•½¹‘Ì€”(€€€€€€€€€€€€€€€€ØÀì((€€€€€€€¥˜€¡…Õ‘¥½M•ÑÑ¥¹Ì¹™½Éµ…±Q¥µ”¤ì(€€€€€€€€€€€½¹ÍÐ™½Éµ…±A…ÉÑÌ€ômtì((€€€€€€€€€€€¥˜€¡¡½ÕÉÌ€ø€À¤ì(€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì¡¡½ÕÉÌ¤€¬(€€€€€€€€€€€€€€€€€€€€¡¡½ÕÉÌ€ôôô€Ä€ü€ˆ¡½ÕÈˆ€è€ˆ¡½ÕÉÌˆ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡µ¥¹ÕÑ•Ì€ø€À¤ì(€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì¡µ¥¹ÕÑ•Ì¤€¬(€€€€€€€€€€€€€€€€€€€€¡µ¥¹ÕÑ•Ì€ôôô€Ä€ü€ˆµ¥¹ÕÑ”ˆ€è€ˆµ¥¹ÕÑ•Ìˆ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡Í•½¹‘Ì€ø€Àñð€…™½Éµ…±A…ÉÑÌ¹±•¹Ñ ¤ì(€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì¡Í•½¹‘Ì¤€¬(€€€€€€€€€€€€€€€€€€€€¡Í•½¹‘Ì€ôôô€Ä€ü€ˆÍ•½¹ˆ€è€ˆÍ•½¹‘Ìˆ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡™½Éµ…±A…ÉÑÌ¹±•¹Ñ €ôôô€Ä¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™½Éµ…±A…ÉÑÍlÁtì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÌ(€€€€€€€€€€€€€€€€€€€€¹Í±¥” À°€´Ä¤(€€€€€€€€€€€€€€€€€€€€¹©½¥¸ ˆ°€ˆ¤€¬(€€€€€€€€€€€€€€€€ˆ…¹€ˆ€¬(€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÍl(€€€€€€€€€€€€€€€€€€€™½Éµ…±A…ÉÑÌ¹±•¹Ñ €´€Ä(€€€€€€€€€€€€€€€t(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡Í•½¹‘Ì€ø€À¤ì(€€€€€€€€€€€½¹ÍÐÁ½Í¥Ñ¥½¹…±A…ÉÐ€ô(€€€€€€€€€€€€€€€Ù…±Õ”€ôø(€€€€€€€€€€€€€€€€€€€Ù…±Õ”€ôôô€À(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰½ ½ ˆ(€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”€ð€ÄÀ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰½ €ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡¡½ÕÉÌ€ø€À¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€¡½ÕÉÌ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€Á½Í¥Ñ¥½¹…±A…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€Á½Í¥Ñ¥½¹…±A…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡µ¥¹ÕÑ•Ì€ø€À¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€Á½Í¥Ñ¥½¹…±A…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÁ…ÉÑÌ€ômtì((€€€€€€€¥˜€¡¡½ÕÉÌ€ø€À¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€¡½ÕÉÌ€ôôô€Ä(€€€€€€€€€€€€€€€€€€€€ü€‰…¸¡½ÕÈˆ(€€€€€€€€€€€€€€€€€€€€è½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€¡½ÕÉÌ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€ˆ¡½ÕÉÌˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡µ¥¹ÕÑ•Ì€ø€À¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆµ¥¹ÕÑ”ˆ€¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì€ôôô€Ä(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Ìˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€Í•½¹‘Ì€ø€Àñð(€€€€€€€€€€€€…Á…ÉÑÌ¹±•¹Ñ (€€€€€€€€¤ì(€€€€€€€€€€€Á…ÉÑÌ¹ÁÕÍ  (€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆÍ•½¹ˆ€¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì€ôôô€Ä(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Ìˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€¡Á…ÉÑÌ¹±•¹Ñ €ð€È¤ì(€€€€€€€€€€€É•ÑÕÉ¸Á…ÉÑÍlÁtì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€¡½ÕÉÌ€ø€À€˜˜(€€€€€€€€€€€µ¥¹ÕÑ•Ì€ø€À€˜˜(€€€€€€€€€€€Í•½¹‘Ì€ôôô€À€˜˜(€€€€€€€€€€€Á…ÉÑÌ¹±•¹Ñ €ôôô€È(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐµ¥¹ÕÑ•9Õµ‰•È€ô(€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐµ¥¹ÕÑ•Må±±…‰±•Ì€ô(€€€€€€€€€€€€€€€µ¥¹ÕÑ•9Õµ‰•È(€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½my„µéqÌµt½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÍÁ±¥Ð (€€€€€€€€€€€€€€€€€€€€€€€€½mqÌµt¬¼(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹™¥±Ñ•È¡	½½±•…¸¤(€€€€€€€€€€€€€€€€€€€€¹É•‘Õ” (€€€€€€€€€€€€€€€€€€€€€€€€¡Ñ½Ñ…°°Ý½É¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ý½É(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ üé•ñ•Íñ•¤¼°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ½ÕÁÌ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•¹µ…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½m…•¥½Õåt¬½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½Ñ…°€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹µ…à (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É½ÕÁÌü¹±•¹Ñ ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ½µ¥Ñ¹€ô(€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì€ø€ä€˜˜(€€€€€€€€€€€€€€€µ¥¹ÕÑ•Må±±…‰±•Ì€ø€Äì((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€Á…ÉÑÍlÁt€¬(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€½µ¥Ñ¹(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€ˆ…¹€ˆ(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€µ¥¹ÕÑ•9Õµ‰•È(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€¡½ÕÉÌ€ø€À€˜˜(€€€€€€€€€€€Í•½¹‘Ì€ø€À(€€€€€€€€¤ì(€€€€€€€€€€€¥˜€¡µ¥¹ÕÑ•Ì€ôôô€À¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€Á…ÉÑÍlÁt€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì€ôôô€Ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆÍ•½¹ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€ˆÍ•½¹‘Ìˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€Á…ÉÑÍlÁt€¬(€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ•Ì(€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€ˆ…¹€ˆ€¬(€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€Á…ÉÑÌ(€€€€€€€€€€€€€€€€¹Í±¥” (€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€´Ä(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹©½¥¸ ˆ°€ˆ¤€¬(€€€€€€€€€€€€ˆ…¹€ˆ€¬(€€€€€€€€€€€Á…ÉÑÍl(€€€€€€€€€€€€€€€Á…ÉÑÌ¹±•¹Ñ €´€Ä(€€€€€€€€€€€t(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸‰Õ¥±‘½…±…¥±ÕÉ•MÁ••  (€€€€€€€‘•Ñ…¥°€ôíô(€€€€¤ì(€€€€€€€½¹ÍÐ½…±Ì€ô(€€€€€€€€€€€ÉÉ…ä¹¥ÍÉÉ…ä¡‘•Ñ…¥°¹½…±Ì¤(€€€€€€€€€€€€€€€€ü‘•Ñ…¥°¹½…±Ì(€€€€€€€€€€€€€€€€èmtì((€€€€€€€½¹ÍÐÁ•É•¹Ñ5½‘”€ô(€€€€€€€€€€€¹½Éµ…±¥é•A•É•¹Ñ5½‘” (€€€€€€€€€€€€€€€±½­Q¥µ•È¹Á•É•¹Ñ5½‘”(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ…¹¹½Õ¹•‘½…±Ì€ô(€€€€€€€€€€€Á•É•¹Ñ5½‘”€ôôô€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€ü½…±Ì¹™¥±Ñ•È (€€€€€€€€€€€€€€€€€€€½…°€ôø(€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…Éˆñð(€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€èÁ•É•¹Ñ5½‘”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€ü½…±Ì¹™¥±Ñ•È (€€€€€€€€€€€€€€€€€€€€€€€½…°€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…Éˆñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€è½…±Ìì((€€€€€€€½¹ÍÐÍÑ…¹‘…É‘…¥±•€ô(€€€€€€€€€€€…¹¹½Õ¹•‘½…±Ì¹Í½µ” (€€€€€€€€€€€€€€€½…°€ôø(€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…Éˆ(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐ‰•±½ÝMÑ…¹‘…É‘…¥±•€ô(€€€€€€€€€€€…¹¹½Õ¹•‘½…±Ì¹Í½µ” (€€€€€€€€€€€€€€€½…°€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹Á•É•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…Éˆ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð€ð€Ä(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì((€€€€€€€½¹ÍÐÍÕµµ…ÉåM•¹Ñ•¹•Ì€ômtì((€€€€€€€€¼¼%¸™¥á•QÉ¥À½Q½Ñ…°µ½‘•Ì°É½ÍÍ¥¹œMÑ…¹‘…É¥Ì¥ÑÌ½Ý¸Ñ•µÁ½É…°(€€€€€€€€¼¼‰½Õ¹‘…Éä…¹¹½Õ¹•µ•¹Ð¸¼¹½Ð½µ‰¥¹”¥ÐÝ¥Ñ Ñ¡”™¥á•½…°¸(€€€€€€€¥˜€ (€€€€€€€€€€€ÍÑ…¹‘…É‘…¥±•€˜˜(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Á•É•¹Ñ5½‘”€ôôô€‰ÑÉ¥Àˆñð(€€€€€€€€€€€€€€€Á•É•¹Ñ5½‘”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€€€€€€€€€ÍÕµµ…ÉåM•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€‰MÑ…¹‘…É½…°…¥±•¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€•±Í”ì(€€€€€€€€€€€¥˜€¡ÍÑ…¹‘…É‘…¥±•¤ì(€€€€€€€€€€€€€€€ÍÕµµ…ÉåM•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…É½…°…¥±•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€™½È€¡½¹ÍÐ½…°½˜…¹¹½Õ¹•‘½…±Ì¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÍÕµµ…ÉåM•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€€€€€‰QÉ¥À½…°…¥±•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€€€€€½…°ü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÍÕµµ…ÉåM•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬€ˆ½…°…¥±•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐ‘•Ñ…¥±M•¹Ñ•¹•Ì€ômtì(€€€€€€€½¹ÍÐ™…±±‰…¬€ô(€€€€€€€€€€€‘•Ñ…¥°¹™…±±‰…¬ì((€€€€€€€¥˜€¡™…±±‰…¬¤ì(€€€€€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€™…±±‰…¬¹ÑåÁ”ñð(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€½¹ÍÐÁ•É•¹Ð€ô(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€™…±±‰…¬¹Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€™…±±‰…¬(€€€€€€€€€€€€€€€€€€€€€€€€¹É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€Á•É•¹Ñ5½‘”€ôôô€‰…ÕÑ¼ˆ€˜˜(€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰ÍÑ…¹‘…Éˆñð(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰ÑÉ¥Àˆñð(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÉ½Õ¹‘•‘A•É•¹Ð€ô(€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡Á•É•¹Ð¤(€€€€€€€€€€€€€€€€€€€€€€€€ü5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð€¨€ÄÀÀ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€½¹ÍÐÕÍ•MÑ…¹‘…É‘1…‰•°€ô(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰ÍÑ…¹‘…Éˆñð(€€€€€€€€€€€€€€€€€€€É½Õ¹‘•‘A•É•¹Ð€ôôô€ÄÀÀì((€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€ÕÍ•MÑ…¹‘…É‘1…‰•°(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰MÑ…¹‘…Éˆ(€€€€€€€€€€€€€€€€€€€€€€€€èÑåÁ”€ôôô€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰QÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÑ½Ñ…±M½Á•1…‰•° ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÁ•É•¹ÑQ•áÐ€ô(€€€€€€€€€€€€€€€€€€€€…ÕÍ•MÑ…¹‘…É‘1…‰•°€˜˜(€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€€€€€É½Õ¹‘•‘A•É•¹Ð(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€½…±…¥±ÕÉ•9Õµ‰•É]½É‘Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É½Õ¹‘•‘A•É•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆÁ•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆì((€€€€€€€€€€€€€€€‘•Ñ…¥±M•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€€€€€‘í™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¥ôÕ¹Ñ¥°€‘í±…‰•±ô½…°‘íÁ•É•¹ÑQ•áÑô¹€(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€¥˜€¡‰•±½ÝMÑ…¹‘…É‘…¥±•¤ì(€€€€€€€€€€€‘•Ñ…¥±M•¹Ñ•¹•Ì¹ÁÕÍ  (€€€€€€€€€€€€€€€€‰=Ù•ÉÑ¥µ”¥¸ÁÉ½É•ÍÌ¸ˆ(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹ÍÐÍÁ½­•¸€ômtì((€€€€€€€¥˜€ (€€€€€€€€€€€ÍÕµµ…ÉåM•¹Ñ•¹•Ì¹±•¹Ñ €˜˜(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ(€€€€€€€€€€€€¤¹Á•É™½É´(€€€€€€€€¤ì(€€€€€€€€€€€ÍÁ½­•¸¹ÁÕÍ  (€€€€€€€€€€€€€€€€¸¸¹ÍÕµµ…ÉåM•¹Ñ•¹•Ì(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€¥˜€ (€€€€€€€€€€€‘•Ñ…¥±M•¹Ñ•¹•Ì¹±•¹Ñ €˜˜(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€€€€€€‰‘•Ñ…¥±Ìˆ(€€€€€€€€€€€€¤¹Á•É™½É´(€€€€€€€€¤ì(€€€€€€€€€€€ÍÁ½­•¸¹ÁÕÍ  (€€€€€€€€€€€€€€€€¸¸¹‘•Ñ…¥±M•¹Ñ•¹•Ì(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€É•ÑÕÉ¸ÍÁ½­•¸¹©½¥¸ (€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€¤ì(€€€ô((€€€…Íå¹Œ™Õ¹Ñ¥½¸ÍÁ•…­½…±…¥±ÕÉ” (€€€€€€€‘•Ñ…¥°(€€€€¤ì(€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼ì((€€€€€€€½¹ÍÐÍÁ•• €ô(€€€€€€€€€€€‰Õ¥±‘½…±…¥±ÕÉ•MÁ••  (€€€€€€€€€€€€€€€‘•Ñ…¥°(€€€€€€€€€€€€¤ì(€€€€€€€½¹ÍÐ¡¥µ”€ô(€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€É•ÑÕÉ¸ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´€˜˜(€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ½¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄÀÀ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ½¹œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ € (€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Õ‘¥¼Á±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½…°µ™…¥±•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡ÍÁ•• ¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼°(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ•• (€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹½…±…¥°¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð (€€€€€€€€€€€•Ù•¹Ð°(€€€€€€€€€€€€‰=¹”½Èµ½É”½…±Ì™…¥±•ˆ(€€€€€€€€¤ì((€€€€€€€Ù½¥ÍÁ•…­½…±…¥±ÕÉ” (€€€€€€€€€€€•Ù•¹Ð¹‘•Ñ…¥°(€€€€€€€€¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹A•É•¹Ñ5½‘•¡…¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰A•É•¹ÐÍ½Á”µ½‘”¡…¹•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹½…±ÕÑ½µ…Ñ¥…±±å‘©ÕÍÑ•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰!¥¡•È…ÕÑ½µ…Ñ¥Œ½…°‰•…µ”Õ¹…ÑÑ…¥¹…‰±”…¹Ñ¡”É•¹‘•É•½…°…‘©ÕÍÑ•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹MÑ…¹‘…É‘Q¥µ•¡…¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰MÑ…¹‘…ÉÑ¥µ”¡…¹•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹É•…Ñ¥½¹Q¥µ•¡…¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰É•…Ñ¥½¸Ñ¥µ”¡…¹•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹M¡•‘Õ±•‘MÑ…ÉÑ¡…¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰M¡•‘Õ±•ÍÑ…ÉÐ¡…¹•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹ÑÕ…±MÑ…ÉÑ¡…¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰ÑÕ…°ÍÑ…ÉÐ¡…¹•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹…±•¹‘…ÉIÕ±•Í1½…‘•¡•Ù•¹Ð¤ì(€€€€€€€¥˜€¡•Ù•¹Ð¹‘•Ñ…¥°¹…±•¹‘…ÉÌü¹±•¹Ñ ¤…±•¹‘…ÉI…¹•Ì¹Í•Ñ…Ñ…‰…Í•I•½É‘Ì¡•Ù•¹Ð¹‘•Ñ…¥°¹…±•¹‘…ÉÌ¤ì(€€€€€€€É•™É•Í¡QÉ¥Á1½M•±•Ñ¥½¸ ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹½¹¹•Ñ•¡•Ù•¹Ð¤ì(€€€€€€€Á½ÁÕ±…Ñ•AÉ½™¥±”¡•Ù•¹Ð¹‘•Ñ…¥°ü¹ÕÍ•È¤ì((€€€€€€€Ù½¥±½…‘MÁ••¡Q¥µ¥¹AÉ½™¥±” ¤(€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€½¹Í½±”¹Ý…É¸ (€€€€€€€€€€€€€€€€€€€€€€€€‰MÁ•• Ñ¥µ¥¹œÁÉ½™¥±”Ý…Ì¹½Ð±½…‘•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì((€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰±½­Q¥µ•È½¹¹•Ñ•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹¥Í½¹¹•Ñ•¡•Ù•¹Ð¤ì(€€€€€€€¥˜€¡•Ù•¹Ð¹‘•Ñ…¥°ü¹Í½ÕÉ”€ôôô€‰‘¥Í½¹¹•Ðˆ¤ì(€€€€€€€€€€€¥˜€¡ÍÁ••¡QÉ…¥¹¥¹Ñ¥Ù”¤ì(€€€€€€€€€€€€€€€ÍÑ½Á%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ¡ì(€€€€€€€€€€€€€€€€€€€™½É•èÑÉÕ”(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô•±Í”¥˜€¡¥¹ÁÁMÁ••¡QÉ…¥¹¥¹¹…‰±•¤ì(€€€€€€€€€€€€€€€‘¥Í…‰±•%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ ¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€Í¥¹•‘%¹AÉ½™¥±”€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€¥‘•¹Ñ¥Ñå½¹Ñ•áÐ(€€€€€€€€€€€€€€€€ü¹±•…Èü¸ ¤ì(€€€€€€€€€€€ÕÍ•É1½½­ÕÀ(€€€€€€€€€€€€€€€€ü¹Íå¹Œü¸ ¤ì((€€€€€€€€€€€Ù½¥±¥Ù•QÉ¥ÁMÑÉ•…´(€€€€€€€€€€€€€€€€ü¹±½Í”ü¸ ¤(€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ÍÁ••¡QÉ…¥¹¥¹ÍÉ™Q½­•¸€ôÕ¹‘•™¥¹•ì(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€ü¹É•Í•ÑMÁ••¡Q¥µ¥¹QÉ¥Àü¸ ¤ì(€€€€€€€€€€€™½È€¡½¹ÍÐ¥½˜l‰ÁÉ½™¥±•UÍ•É¹…µ”ˆ°€‰™¥ÉÍÑ9…µ”ˆ°€‰±…ÍÑ9…µ”ˆ°€‰ÁÉ•™•ÉÉ•‘9…µ”‰t¤€ ˆŒˆ€¬¥¤¹Ù…±Õ”€ô€ˆˆì(€€€€€€€€€€€Íå¹MÁ••¡QÉ…¥¹¥¹½¹ÑÉ½±Ì ¤ì(€€€€€€€ô(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰±½­Q¥µ•È‘¥Í½¹¹•Ñ•ˆ¤ì(€€€ô((€€€™Õ¹Ñ¥½¸½¹É•…Ñ•ÍMå¹•¡•Ù•¹Ð¤ì(€€€€€€€É•Í•ÉÙ•M•µ…¹Ñ¥Ù•¹Ð¡•Ù•¹Ð°€‰I•½¹¹•ÐÉ•™É•Í¡•…É•…Ñ”‘…Ñ„…¹Ñ¡”…É•…Ñ”Í¹…ÁÍ¡½Ð¡…¹•ˆ¤ì(€€€ô((€€€½¹ÍÐÍ•µ…¹Ñ¥±½­Q¥µ•É!…¹‘±•ÉÌ€ôì(€€€€€€€ÑÉ¥ÁMÑ…ÉÑ•è½¹QÉ¥ÁMÑ…ÉÑ•°(€€€€€€€ÑÉ¥ÁMÑ…ÉÑ•‘…É±äè½¹QÉ¥ÁMÑ…ÉÑ•‘…É±ä°(€€€€€€€ÑÉ¥ÁMÑ…ÉÑ•‘1…Ñ”è½¹QÉ¥ÁMÑ…ÉÑ•‘1…Ñ”°(€€€€€€€‰É•…­MÑ…ÉÑ•è½¹	É•…­MÑ…ÉÑ•°(€€€€€€€‰É•…­¹‘•‘…É±äè½¹	É•…­¹‘•‘…É±ä°(€€€€€€€‰É•…­¹‘•‘ÕÑ½µ…Ñ¥…±±äè½¹	É•…­¹‘•‘ÕÑ½µ…Ñ¥…±±ä°(€€€€€€€‰É•…­¹‘•‘1…Ñ”è½¹	É•…­¹‘•‘1…Ñ”°(€€€€€€€‘½Ý¹Q¥µ•MÑ…ÉÑ•è½¹½Ý¹Q¥µ•MÑ…ÉÑ•°(€€€€€€€ÑÉ¥ÁI•ÍÕµ•è½¹QÉ¥ÁI•ÍÕµ•°(€€€€€€€ÑÉ¥Á¹‘•è½¹QÉ¥Á¹‘•°(€€€€€€€Ñ½Ñ…±½…±M•Ðè½¹Q½Ñ…±½…±M•Ð°(€€€€€€€ÑÉ¥Á½…±M•Ðè½¹QÉ¥Á½…±M•Ð°(€€€€€€€ÑÉ¥Á½…±ÕÑ½µ…Ñ¥…±±åM•Ðè½¹QÉ¥Á½…±ÕÑ½µ…Ñ¥…±±åM•Ð°(€€€€€€€½…±…¥°è½¹½…±…¥°°(€€€€€€€Á•É•¹Ñ5½‘•¡…¹•è½¹A•É•¹Ñ5½‘•¡…¹•°(€€€€€€€½…±ÕÑ½µ…Ñ¥…±±å‘©ÕÍÑ•è½¹½…±ÕÑ½µ…Ñ¥…±±å‘©ÕÍÑ•°(€€€€€€€ÍÑ…¹‘…É‘Q¥µ•¡…¹•è½¹MÑ…¹‘…É‘Q¥µ•¡…¹•°(€€€€€€€É•…Ñ¥½¹Q¥µ•¡…¹•è½¹É•…Ñ¥½¹Q¥µ•¡…¹•°(€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¡…¹•è½¹M¡•‘Õ±•‘MÑ…ÉÑ¡…¹•°(€€€€€€€…ÑÕ…±MÑ…ÉÑ¡…¹•è½¹ÑÕ…±MÑ…ÉÑ¡…¹•°(€€€€€€€…±•¹‘…ÉIÕ±•Í1½…‘•è½¹…±•¹‘…ÉIÕ±•Í1½…‘•°(€€€€€€€½¹¹•Ñ•è½¹½¹¹•Ñ•°(€€€€€€€‘¥Í½¹¹•Ñ•è½¹¥Í½¹¹•Ñ•°(€€€€€€€…É•…Ñ•ÍMå¹•è½¹É•…Ñ•ÍMå¹•(€€€ôì((€€€™½È€¡½¹ÍÐm•Ù•¹Ñ9…µ”°¡…¹‘±•Ét½˜=‰©•Ð¹•¹ÑÉ¥•Ì¡Í•µ…¹Ñ¥±½­Q¥µ•É!…¹‘±•ÉÌ¤¤ì(€€€€€€€±½­Q¥µ•È¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È¡•Ù•¹Ñ9…µ”°¡…¹‘±•È¤ì(€€€ô((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=MÁ••¡AÉ½•ÍÍ¥¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‘•™¥¹” (€€€€€€€€€€€€‰¹½Éµ…±¥é•MÁ••¡Y…±Õ”ˆ°(€€€€€€€€€€€€ (€€€€€€€€€€€€€€€Ñ•áÐ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€™¥•±°(€€€€€€€€€€€€€€€€€€€­¥¹°(€€€€€€€€€€€€€€€€€€€Á…ÑÑ•É¸(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤€ôøì(€€€€€€€€€€€€€€€¥˜€¡­¥¹€ôôô€‰­•åÁ…ˆ¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ•áÐì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€­¥¹€ô(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰±½¬µÁ…ÉÑÌˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è¹Õµ‰•ÉA…‘MÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰‘ÕÉ…Ñ¥½¸ˆì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…™¥•±ñð(€€€€€€€€€€€€€€€€€€€€…Á…ÑÑ•É¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ•áÐì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐµ…Ñ €ô(€€€€€€€€€€€€€€€€€€€¹•ÜI•áÀ (€€€€€€€€€€€€€€€€€€€€€€€Á…ÑÑ•É¸°(€€€€€€€€€€€€€€€€€€€€€€€€‰¤ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹•á•Œ¡Ñ•áÐ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÁ¡É…Í”€ô(€€€€€€€€€€€€€€€€€€€µ…Ñ ü¹É½ÕÁÌ(€€€€€€€€€€€€€€€€€€€€€€€€ü¹m™¥•±‘tì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Á¡É…Í”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ•áÐì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ô(€€€€€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€€€€€¹¹½Éµ…±¥é” (€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€­¥¹(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•€ôôô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ•áÐì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÍÑ…ÉÐ€ô(€€€€€€€€€€€€€€€€€€€µ…Ñ ¹¥¹‘•à€¬(€€€€€€€€€€€€€€€€€€€µ…Ñ¡lÁt(€€€€€€€€€€€€€€€€€€€€€€€€¹±…ÍÑ%¹‘•á=˜ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€Ñ•áÐ¹Í±¥” (€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÐ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•€¬(€€€€€€€€€€€€€€€€€€€Ñ•áÐ¹Í±¥” (€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÐ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€Á¡É…Í”¹±•¹Ñ (€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±•ÐÁ•¹‘¥¹MÁ••¡I•…‘äì(€€€½¹ÍÐMA!}Ie}=9Q%9UQ%=9}]%9=\€ô(€€€€€€€€ÄàÀÀì((€€€½¹ÍÐ…¹•±A•¹‘¥¹MÁ••¡I•…‘ä€ô(€€€€€€€€ ¤€ôøì(€€€€€€€€€€€½¹ÍÐ¡…¹•€ô(€€€€€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€„ôô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€¥˜€¡¡…¹•¤ì(€€€€€€€€€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€ô(€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€¥˜€¡¡…¹•¤ì(€€€€€€€€€€€€€€€É•™É•Í¡MÁ••¡½µµ…¹‘½¹Ñ•áÐ ¤ì(€€€€€€€€€€€ô(€€€€€€€ôì((€€€½¹ÍÐ…ÉµMÁ••¡I•…‘å½¹Ñ¥¹Õ…Ñ¥½¸€ô(€€€€€€€€ ¤€ôøì(€€€€€€€€€€€…¹•±A•¹‘¥¹MÁ••¡I•…‘ä ¤ì((€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€ô(€€€€€€€€€€€€€€€Í•ÑQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€€€€€€€€€É•™É•Í¡MÁ••¡½µµ…¹‘½¹Ñ•áÐ ¤ì(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€MA!}Ie}=9Q%9UQ%=9}]%9=\(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•™É•Í¡MÁ••¡½µµ…¹‘½¹Ñ•áÐ ¤ì(€€€€€€€ôì((€€€½¹ÍÐ½Á•¹MÑ…ÉÑ5•¹Õ]½É­™±½Ü€ô(€€€€€€€€¡ì(€€€€€€€€€€€ÁÉ•Í•ÉÙ•MÁ••¡½¹Ñ¥¹Õ…Ñ¥½¸€ô(€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€¥¹ÁÕÑ5½‘”(€€€€€€€ô€ôíô¤€ôøì(€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÑÉ¥Á%Í1¥Ù” ¤ñð(€€€€€€€€€€€€€€€€ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€€€€€€€€€ü¹‘¥Í…‰±•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…ÁÉ•Í•ÉÙ•MÁ••¡½¹Ñ¥¹Õ…Ñ¥½¸(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€…¹•±A•¹‘¥¹MÁ••¡I•…‘ä ¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÍ¥¹…°€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ù½…Ñ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€ü¹Í¥¹…°ì((€€€€€€€€€€€½¹ÍÐÍÁ••¡]½É­™±½Ü€ô(€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€‰Ù½¥”ˆì((€€€€€€€€€€€¥˜€¡ÍÁ••¡]½É­™±½Ü¤ì(€€€€€€€€€€€€€€€±½­9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸AÉ½µ¥Í”(€€€€€€€€€€€€€€€€¹É•Í½±Ù” (€€€€€€€€€€€€€€€€€€€‰•¥¹9•ÝQÉ¥Á]½É­™±½Ü¡ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥Á5½µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤°(€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°°(€€€€€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”(€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð€ôøì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ…‰½ÉÑ•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡]½É­™±½Ü€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…‰½ÉÑ•ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð€ôôô™…±Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸…‰½ÉÑ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÉ•ÍÕ±Ð€„ôô™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡ÍÁ••¡]½É­™±½Ü¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐ±½Í•Ñ¥Ù•MÁ••¡MÕÉ™…”€ô(€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€½¹ÍÐ¥¹Ñ•ÉÉÕÁÑ•‘Ñ¥½¸€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ù½…Ñ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÉÕÁÑ•‘Ñ¥½¸ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€ü¹½ÁÑ¥½¹Í=Á•¸(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ù½¥ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€¹¡¥‘•=ÁÑ¥½¹Ìü¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÁ½Á½Ù•È€ô(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€¸¸¹‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰mÁ½Á½Ù•Étˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€¹™¥±Ñ•È (€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€Á½Á½Ù•É%Í=Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹…Ð ´Ä¤ì((€€€€€€€€€€€¥˜€¡Á½Á½Ù•È¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Á½Á½Ù•È¹¥€ôôô(€€€€€€€€€€€€€€€€€€€€‰É…Á¡¥…±!•±ÁA½Á½Ù•Èˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•M•ÑÑ¥¹Í!•±ÁA½Á½Ù•È ¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€Á½Á½Ù•È¹¡¥‘•A½Á½Ù•Èü¸ ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€¸¸¹‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥…±½m½Á•¹tˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€t¹…Ð ´Ä¤ì((€€€€€€€€€€€¥˜€ …‘¥…±½œ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•QÉ¥Á1¥ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ±½Í”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¥¹Ñ•ÉÉÕÁÑ•‘Ñ¥½¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€‘¥…±½œ€ôôô(€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…¹•±9Õµ‰•ÉA… ¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€‘¥…±½œ€ôôô(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…¹•±QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ±½Í”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€‘¥…±½œ€ôôô(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÑAÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸±½Í•¥…±½]¥Ñ¡I•ÑÕÉ¸ (€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ±½Í”ˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=MÁ••¡Ù…¥±…‰¥±¥Ñä€ô(€€€€€€€=‰©•Ð¹™É••é”¡ì(€€€€€€€€€€€…¹MÑ…ÉÑQÉ¥À ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á%Í1¥Ù” ¤€˜˜(€€€€€€€€€€€€€€€€€€€€„ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€€€€€€€€€€€€€ü¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹UÍ•I•…‘ä ¤ì(€€€€€€€€€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€„ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€…l(€€€€€€€€€€€€€€€€€€€€‰‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€‰±Õ¹ ˆ°(€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€€€€€€€€t¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€ÑåÁ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹½¹Ñ¥¹Õ•MÑ…ÉÑÐ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ñð(€€€€€€€€€€€€€€€€€€€€€€€¹•ÝQÉ¥Á]½É­™±½Ý1½­•(€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á%Í1¥Ù” ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹UÍ•%¹™½Éµ…Ñ¥½¹…° ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹=Á•¹	É•…­5•¹Ô ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€…‰É•…­	ÕÑÑ½¸ü¹‘¥Í…‰±•ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹MÑ…ÉÑ½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù•%¹Ñ•ÉÙ…±QåÁ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•%¹Ñ•ÉÙ…±QåÁ”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ€˜˜(€€€€€€€€€€€€€€€€€€€€…‘½Ý¹	ÕÑÑ½¸ü¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹=Á•¹	É•…­¹‘5•¹Ô ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰‰É•…¬ˆñð(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰±Õ¹ ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹I•ÍÕµ•QÉ¥À ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑåÁ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰‘½Ý¸ˆñð(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰‰É•…¬ˆñð(€€€€€€€€€€€€€€€€€€€ÑåÁ”€ôôô€‰±Õ¹ ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹…¹•±½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€‘½Ý¹…¹•±	ÕÑÑ½¸€˜˜(€€€€€€€€€€€€€€€€€€€€…‘½Ý¹…¹•±	ÕÑÑ½¸¹¡¥‘‘•¸€˜˜(€€€€€€€€€€€€€€€€€€€€…‘½Ý¹…¹•±	ÕÑÑ½¸¹‘¥Í…‰±•€˜˜(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹1½­¹‘Q¥µ” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹=Á•¹QÉ¥Á1½œ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€„ôô(€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹±½Í•QÉ¥Á1½œ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹•™•ÉQÉ¥À ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œü¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ý½É­™±½Ü€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆ€˜˜(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹Q½±•I•¹‘•É•‘Q¥µ” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉ¥Á%Í1¥Ù” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹±½Í•MÕÉ™…” ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥Í%¹Ñ•ÉÉÕÁÑÉ½ÕÁÑ¥Ù”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÁÉ¥µ…ÉäµÍÕÉ™…”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€€€€€ü¹½ÁÑ¥½¹Í=Á•¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€€¸¸¹‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥…±½m½Á•¹tˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€t¹±•¹Ñ (€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸l(€€€€€€€€€€€€€€€€€€€€¸¸¹‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰mÁ½Á½Ù•Étˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€t¹Í½µ” (€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð€ôø(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È€˜˜(€€€€€€€€€€€€€€€€€€€€€€€Á½Á½Ù•É%Í=Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€ô¤ì((€€€½¹ÍÐ‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ€ô(€€€€€€€€ (€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”°(€€€€€€€€€€€€€€€½‘•Y…±Õ”€ô(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€ô€ôíô(€€€€€€€€¤€ôøì(€€€€€€€€€€€½¹ÍÐ‘¥ÍÁ±…åY…±Õ”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Ù…±Õ”€üü(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€€€€€¥˜€ …‘¥ÍÁ±…åY…±Õ”¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ±…‰•±Q•áÐ€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€±…‰•°ñð(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì(€€€€€€€€€€€½¹ÍÐÉ•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€±…‰•±Q•áÐ€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…åY…±Õ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì(€€€€€€€€€€€½¹ÍÐÍÁ••¡Y…±Õ”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”€üü(€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…åY…±Õ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì(€€€€€€€€€€€½¹ÍÐÍÁ½­•¹I•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€±…‰•±Q•áÐ€¬(€€€€€€€€€€€€€€€€€€€€ˆ€ˆ€¬(€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y…±Õ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€¼”½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÁ•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼(€€€€€€€€€€€€€€€€ü¹ÍÁ•…¬ü¸ (€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹I•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ÍÁ••¡I•ÍÁ½¹Í”èì(€€€€€€€€€€€€€€€€€€€ÑåÁ”è(€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Ñ…Ñ¥½¸ˆ°(€€€€€€€€€€€€€€€€€€€Ù…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í”°(€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…äè(€€€€€€€€€€€€€€€€€€€€€€€½‘•Y…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™¥àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•±Q•áÐ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…åY…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ôì(€€€€€€€ôì((€€€½¹ÍÐ½¹™¥Éµ%¹™½Éµ…Ñ¥½¹…±¡…¹”€ô(€€€€€€€…Íå¹Œ€ (€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”°(€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…ä°(€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ì€ô(€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€¥¹½É•MÕµµ…Éå5…ÍÑ•È€ô(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€ô€ôíô(€€€€€€€€¤€ôøì(€€€€€€€€€€€½¹ÍÐÉ•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Ù…±Õ”€üü(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€€€€€¥˜€ …É•ÍÁ½¹Í”¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÍÁ½­•¹I•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”€üü(€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€¼”½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÁ•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹É•Á±…” (€€€€€€€€€€€€€€€€€€€€€€€€½qÌ¬½œ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆ€ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤ì((€€€€€€€€€€€½¹ÍÐ…Õ‘¥¼€ô(€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼ì(€€€€€€€€€€€½¹ÍÐ¡¥µ”€ô(€€€€€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€€‰¡¥µ”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÍÕµµ…Éä€ô(€€€€€€€€€€€€€€€½¹ÍÕµ•¹¹½Õ¹•µ•¹ÑÑ¥½¸ (€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€€‰ÍÕµµ…Éäˆ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€¥¹½É•5…ÍÑ•Èè(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹½É•MÕµµ…Éå5…ÍÑ•È(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐ½ÕÑÁÕÐ€ô(€€€€€€€€€€€€€€€…Õ‘¥½¹¹½Õ¹•µ•¹Ñ=ÕÑÁÕÐ (€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€üíô(€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÍÁ••¡Õ…É€ô(€€€€€€€€€€€€€€€ÍÕµµ…Éä¹Á•É™½É´(€€€€€€€€€€€€€€€€€€€€üÉ•Í•ÉÙ•M•µ…¹Ñ¥MÁ••  ¤(€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì((€€€€€€€€€€€½¹ÍÐ•á±ÕÍ¥Ù”€ô(€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑMÁ••¡%¹½É•Í5…ÍÑ•È (€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€¥¹½É•MÕµµ…Éå5…ÍÑ•È(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€Ù½¥ÉÕ¹M•µ…¹Ñ¥¹¹½Õ¹•µ•¹Ð (€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€…Íå¹Œ€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€±•Ð¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€¡¥µ”¹Á•É™½É´€˜˜(€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÑ…ÉÑM½¹œ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÕ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑM½¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹ÑM½¹9…µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á´è€ÄÈÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹±Õ‘•MÁ•• è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ½¹•Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹Ñ½¹•Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¡¥µ•A±…å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ”ü¹¡…Í¡¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹™¥¹¥Í¡•ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡¡¥µ•A±…å•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÝ…¥Ñ½É¹¹½Õ¹•µ•¹Ñ•±…ä (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡•±…å5Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ñ € (€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹Ý…É¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰%¹™½Éµ…Ñ¥½¹…°…¹¹½Õ¹•µ•¹ÐÕ”™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éä¹Á•É™½É´€˜˜(€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼ü¹ÍÁ•…¬(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍÁ•…­M•µ…¹Ñ¥¹‘]…¥Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥¼°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹I•ÍÁ½¹Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y½±Õµ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Y•±½¥Ñäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÕÑÁÕÐ¹ÍÁ••¡Y•±½¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Õ…É(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€•á±ÕÍ¥Ù”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹Ý…É¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰%¹™½Éµ…Ñ¥½¹…°…¹¹½Õ¹•µ•¹ÐÁ±…å‰…¬™…¥±•èˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€ÍÁ••¡I•ÍÁ½¹Í”èì(€€€€€€€€€€€€€€€€€€€ÑåÁ”è(€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Ñ…Ñ¥½¸ˆ°(€€€€€€€€€€€€€€€€€€€Ù…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í”°(€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…äè(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…ä(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ôì(€€€€€€€ôì((€€€½¹ÍÐ½¹™¥ÉµM•ÑÑ¥¹¡…¹”€ô(€€€€€€€€ (€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€¤€ôø(€€€€€€€€€€€½¹™¥Éµ%¹™½Éµ…Ñ¥½¹…±¡…¹” (€€€€€€€€€€€€€€€€‰Í•ÑÑ¥¹œµ¡…¹”ˆ°(€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€½ÁÑ¥½¹Ì(€€€€€€€€€€€€¤ì((€€€½¹ÍÐ¡…¹•±½‰…±Õ‘¥½I…Ñ”€ô(€€€€€€€‘•±Ñ…A•É•¹Ð€ôøì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹ÍÁ••¡Y•±½¥Ñä€ô(€€€€€€€€€€€€€€€ÍÑ•ÁÕ‘¥½Y•±½¥Ñä (€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5%8°(€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5`°(€€€€€€€€€€€€€€€€€€€‘•±Ñ…A•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹Ñ½¹•Y•±½¥Ñä€ô(€€€€€€€€€€€€€€€ÍÑ•ÁÕ‘¥½Y•±½¥Ñä (€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½¹•Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€U%=}Q=9}Y1=%Qe}5%8°(€€€€€€€€€€€€€€€€€€€U%=}Q=9}Y1=%Qe}5`°(€€€€€€€€€€€€€€€€€€€‘•±Ñ…A•É•¹Ð(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€‰MÁ•• I…Ñ”€ˆ€¬(€€€€€€€€€€€€€€€€€€€™½Éµ…ÑÕ‘¥½Y•±½¥ÑåA•É•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5`(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐÍ•Ñ±½‰…±Õ‘¥½I…Ñ•A•É•¹Ð€ô(€€€€€€€Á•É•¹Ð€ôøì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤ñð(€€€€€€€€€€€€€€€Ù…±Õ”€ð€Àñð(€€€€€€€€€€€€€€€Ù…±Õ”€ø€ÄÀÀ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹ÍÁ••¡Y•±½¥Ñä€ô(€€€€€€€€€€€€€€€…Õ‘¥½Y•±½¥ÑåÑA•É•¹Ð (€€€€€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5%8°(€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5`(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹Ñ½¹•Y•±½¥Ñä€ô(€€€€€€€€€€€€€€€…Õ‘¥½Y•±½¥ÑåÑA•É•¹Ð (€€€€€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€€€€€U%=}Q=9}Y1=%Qe}5%8°(€€€€€€€€€€€€€€€€€€€U%=}Q=9}Y1=%Qe}5`(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€‰MÁ•• I…Ñ”€ˆ€¬(€€€€€€€€€€€€€€€€€€€™½Éµ…ÑÕ‘¥½Y•±½¥ÑåA•É•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y•±½¥Ñä°(€€€€€€€€€€€€€€€€€€€€€€€U%=}MA!}Y1=%Qe}5`(€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐÍ•Ñ5…ÍÑ•ÉMÁ•• €ô(€€€€€€€•¹…‰±•€ôøì(€€€€€€€€€€€½¹ÍÐ¹•áÐ€ô(€€€€€€€€€€€€€€€	½½±•…¸¡•¹…‰±•¤ì((€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹µ…ÍÑ•ÉÌ¹ÍÕµµ…Éä€ô(€€€€€€€€€€€€€€€¹•áÐì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹µ…ÍÑ•ÉÌ¹‘•Ñ…¥±Ì€ô(€€€€€€€€€€€€€€€¹•áÐì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€€€€€ü€‰MÁ•• =¸ˆ(€€€€€€€€€€€€€€€€€€€€è€‰MÁ•• =™˜ˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€¥¹½É•MÕµµ…Éå5…ÍÑ•Èè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐÍ•Ñ5…ÍÑ•É¡¥µ”€ô(€€€€€€€•¹…‰±•€ôøì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹µ…ÍÑ•ÉÌ¹¡¥µ”€ô(€€€€€€€€€€€€€€€	½½±•…¸¡•¹…‰±•¤ì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹µ…ÍÑ•ÉÌ¹¡¥µ”(€€€€€€€€€€€€€€€€€€€€ü€‰¡¥µ”=¸ˆ(€€€€€€€€€€€€€€€€€€€€è€‰¡¥µ”=™˜ˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐ¡…¹•±½‰…±Õ‘¥½Y½±Õµ”€ô(€€€€€€€‘•±Ñ…A•É•¹Ð€ôøì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹ÍÁ••¡Y½±Õµ”€ô(€€€€€€€€€€€€€€€ÍÑ•ÁÕ‘¥½Y½±Õµ” (€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€‘•±Ñ…A•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹Ñ½¹•Y½±Õµ”€ô(€€€€€€€€€€€€€€€ÍÑ•ÁÕ‘¥½Y½±Õµ” (€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½¹•Y½±Õµ”°(€€€€€€€€€€€€€€€€€€€‘•±Ñ…A•É•¹Ð(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€‰MÁ•• Y½±Õµ”€ˆ€¬(€€€€€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y½±Õµ”€¨(€€€€€€€€€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ”ˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐÍ•Ñ±½‰…±Õ‘¥½Y½±Õµ•A•É•¹Ð€ô(€€€€€€€Á•É•¹Ð€ôøì(€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ù…±Õ”¤ñð(€€€€€€€€€€€€€€€Ù…±Õ”€ð€Àñð(€€€€€€€€€€€€€€€Ù…±Õ”€ø€ÄÀÀ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹ÍÁ••¡Y½±Õµ”€ô(€€€€€€€€€€€€€€€…Õ‘¥½Y½±Õµ•ÑA•É•¹Ð (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì¹Ñ½¹•Y½±Õµ”€ô(€€€€€€€€€€€€€€€…Õ‘¥½Y½±Õµ•ÑA•É•¹Ð (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€É•¹‘•ÉÕ‘¥½M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€…ÁÁ±åÕ‘¥½=ÕÑÁÕÑM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€Í…Ù•Õ‘¥½M•ÑÑ¥¹Ì ¤ì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€‰MÁ•• Y½±Õµ”€ˆ€¬(€€€€€€€€€€€€€€€€€€€5…Ñ ¹É½Õ¹ (€€€€€€€€€€€€€€€€€€€€€€€…Õ‘¥½M•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Y½±Õµ”€¨(€€€€€€€€€€€€€€€€€€€€€€€€ÄÀÀ(€€€€€€€€€€€€€€€€€€€€¤€¬(€€€€€€€€€€€€€€€€€€€€ˆ”ˆ°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€ÕÍ•±½‰…±Õ‘¥½M•ÑÑ¥¹Ìè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐ½…±A•É•¹Ñ½ÉM½Á”€ô(€€€€€€€Í½Á”€ôøì(€€€€€€€€€€€±•ÐÍÕµµ…Éäì((€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€ÍÕµµ…Éä€ô(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑMÕµµ…ÉåM¹…ÁÍ¡½Ðü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Õ¹‘•™¥¹•ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€ÍÕµµ…Éäü¹l(€€€€€€€€€€€€€€€€€€€Í½Á”(€€€€€€€€€€€€€€€tü¹Á•É•¹Ñ½…°ì((€€€€€€€€€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€9Õµ‰•È¡Ù…±Õ”¤(€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€ü™½Éµ…ÑMÕµµ…ÉåA•É•¹Ð (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€ôì((€€€½¹ÍÐÍ•Ñ½…±A•É•¹ÑY…±Õ”€ô(€€€€€€€…Íå¹Œ€ (€€€€€€€€€€€Í½Á”°(€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€¤€ôøì(€€€€€€€€€€€½¹ÍÐ¹½Éµ…±¥é•‘M½Á”€ô(€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€Í½Á”ñð(€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€…l(€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€t¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€Ù…±Õ”€ðô€À(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Í½Á•Ìñð(€€€€€€€€€€€€€€€€€€€mt(€€€€€€€€€€€€€€€€¤¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€™±…Í¡¹‘Q¥µ•½…±1½¬ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ‰•™½É”€ô(€€€€€€€€€€€€€€€½…±A•É•¹Ñ½ÉM½Á” (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€±½­Q¥µ•È¹½¹™¥ÕÉ”¡ì(€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…±}½…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰ÑÉ¥Á}½…°ˆ(€€€€€€€€€€€€€€€€€€€tè(€€€€€€€€€€€€€€€€€€€€€€€€‘íÙ…±Õ•ô•€(€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€É•¹‘•É±½­Q¥µ•ÉU%MÑ…Ñ” (€€€€€€€€€€€€€€€ÍÑ…Ñ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€É•™É•Í¡ÕÑ½½…±¥…±½œ ¤ì(€€€€€€€€€€€ÅÕ•Õ•MÕµµ…ÉåI•™É•Í  ¤ì((€€€€€€€€€€€½¹ÍÐ…™Ñ•È€ô(€€€€€€€€€€€€€€€½…±A•É•¹Ñ½ÉM½Á” (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€……™Ñ•Èñð(€€€€€€€€€€€€€€€‰•™½É”€ôôô(€€€€€€€€€€€€€€€€€€€…™Ñ•È(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€€€€€è€‰QÉ¥Àˆì((€€€€€€€€€€€É•ÑÕÉ¸½¹™¥Éµ%¹™½Éµ…Ñ¥½¹…±¡…¹” (€€€€€€€€€€€€€€€€‰½…°µ¡…¹”ˆ°(€€€€€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€€€€€€€€€ˆ½…°M•ÐÑ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€…™Ñ•È(€€€€€€€€€€€€¤ì(€€€€€€€ôì((€€€½¹ÍÐ…Ñ¥½¹Ì€ô(€€€€€€€±½‰…±Q¡¥Ì¹]5=Ñ¥½¹Ìì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹‘•™¥¹•±°¡ì(€€€€€€€€€€€¡…¹•MÑ…¹‘…É‘Q¥µ” (€€€€€€€€€€€€€€€Ñ¥µ•Y…±Õ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘ÕÉ…Ñ¥½¸€ô(€€€€€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•Y…±Õ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘ÕÉ…Ñ¥½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐ™½Éµ…ÑÑ•€ô(€€€€€€€€€€€€€€€€€€€¹±¥Í¡ÕÉ…Ñ¥½¹A…ÉÍ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹™½Éµ…Ñ…¹½¹¥…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘¥ÍÁ±…å½Éµ…ÑÑ•€ô(€€€€€€€€€€€€€€€€€€€¹±¥Í¡ÕÉ…Ñ¥½¹A…ÉÍ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹™½Éµ…Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…™½Éµ…ÑÑ•ñð(€€€€€€€€€€€€€€€€€€€€…‘¥ÍÁ±…å½Éµ…ÑÑ•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€€…Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É(€€€€€€€€€€€€€€€€€€€€€€€€¹‘¥Í…‰±•€˜˜(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÌ€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ½¥•M•Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸ì((€€€€€€€€€€€€€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É(€€€€€€€€€€€€€€€€€€€€€€€€¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹••‘ÌµÙ…±Õ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ5•ÍÍ…”¹¡¥‘‘•¸€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€€€€€¥˜€¡Ù½¥•M•Ð¤ì(€€€€€€€€€€€€€€€€€€€€€€€…ÉµM¡•‘Õ±•‘MÑ…ÉÑÕÑ½É½µY½¥” ¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€ÕÁ‘…Ñ•M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•M¡•‘Õ±•‘MÑ…ÉÑMÁ••¡AÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÁÉ•Ù¥½ÕÌ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€üÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€è½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…å½Éµ…ÑÑ•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…äèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™¥àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…å½Éµ…ÑÑ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ•‘¥Ñ	ÕÑÑ½¸€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰ÍÑ…¹‘…ÉµÑ¥µ”‰tœ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€•‘¥Ñ	ÕÑÑ½¸€˜˜(€€€€€€€€€€€€€€€€€€€€…•‘¥Ñ	ÕÑÑ½¸¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ñð(€€€€€€€€€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …Í•ÍÍ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÌ€ô(€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸¹Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì((€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸¹Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸ì((€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÁÉ•Ù¥½ÕÌ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€üÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€è½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…å½Éµ…ÑÑ•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…äèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™¥àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰MÑ…¹‘…ÉQ¥µ”M•ÐÑ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥ÍÁ±…å½Éµ…ÑÑ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹‘±•Y½¥•¹ÑÉåMÁ••  ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Á…ÉÍ•Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÐ (€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÑÉ…¹ÍÉ¥ÁÐ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹ÑÑ¥½¹M¥¹…° ¤(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹MÑ…ÉÑ5•¹Ô ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹MÑ…ÉÑ5•¹Õ]½É­™±½Ü ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÁÉ•Á…É•I•…‘åÑ¥½¸ ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍ¥¹…°€ô(€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹ÑÑ¥½¹M¥¹…° ¤ì((€€€€€€€€€€€€€€€¥˜€¡ÑÉ¥Á%Í1¥Ù” ¤¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸•¹‘ÕÉÉ•¹Ñ%¹Ñ•ÉÙ…±=ÉQÉ¥À (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…ÉµMÁ••¡I•…‘å½¹Ñ¥¹Õ…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹MÑ…ÉÑ5•¹Õ]½É­™±½Ü¡ì(€€€€€€€€€€€€€€€€€€€ÁÉ•Í•ÉÙ•MÁ••¡½¹Ñ¥¹Õ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€‰Ù½¥”ˆ(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€ÁÉ•Á…É•MÑ…ÉÑ5•¹Ô ¤ì(€€€€€€€€€€€€€€€…ÉµMÁ••¡I•…‘å½¹Ñ¥¹Õ…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹MÑ…ÉÑ5•¹Õ]½É­™±½Ü¡ì(€€€€€€€€€€€€€€€€€€€ÁÉ•Í•ÉÙ•MÁ••¡½¹Ñ¥¹Õ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€‰Ù½¥”ˆ(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€‘¥Í…‰±•MÁ••¡I•½¹¥Ñ¥½¸ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Í…‰±•MÁ••¡I•½¹¥Ñ¥½¹IÕ¹Ñ¥µ” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•ÑMÁ••¡5…ÍÑ•È ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹ÍÉ¥ÁÐ€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÑÉ…¹ÍÉ¥ÁÐñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½…±•1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€¥˜€¡ÑÉ…¹ÍÉ¥ÁÐ€ôôô€‰ÍÁ•• ½¸ˆ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ5…ÍÑ•ÉMÁ••  (€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡ÑÉ…¹ÍÉ¥ÁÐ€ôôô€‰ÍÁ•• ½™˜ˆ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ5…ÍÑ•ÉMÁ••  (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•Ñ¡¥µ•5…ÍÑ•È ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹ÍÉ¥ÁÐ€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÑÉ…¹ÍÉ¥ÁÐñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½…±•1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€¥˜€¡ÑÉ…¹ÍÉ¥ÁÐ€ôôô€‰¡¥µ”½¸ˆ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ5…ÍÑ•É¡¥µ” (€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡ÑÉ…¹ÍÉ¥ÁÐ€ôôô€‰¡¥µ”½™˜ˆ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ5…ÍÑ•É¡¥µ” (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•ÑÕ‘¥½I…Ñ•A•É•¹Ð (€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ±½‰…±Õ‘¥½I…Ñ•A•É•¹Ð (€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•ÑÕ‘¥½Y½±Õµ•A•É•¹Ð (€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ±½‰…±Õ‘¥½Y½±Õµ•A•É•¹Ð (€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•Õ‘¥½I…Ñ•…ÍÑ•È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¡…¹•±½‰…±Õ‘¥½I…Ñ” (€€€€€€€€€€€€€€€€€€€U%=}AI9Q}MQ@(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•Õ‘¥½I…Ñ•M±½Ý•È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¡…¹•±½‰…±Õ‘¥½I…Ñ” (€€€€€€€€€€€€€€€€€€€€µU%=}AI9Q}MQ@(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•Õ‘¥½Y½±Õµ•1½Õ‘•È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¡…¹•±½‰…±Õ‘¥½Y½±Õµ” (€€€€€€€€€€€€€€€€€€€U%=}AI9Q}MQ@(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•Õ‘¥½Y½±Õµ•M½™Ñ•È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸¡…¹•±½‰…±Õ‘¥½Y½±Õµ” (€€€€€€€€€€€€€€€€€€€€µU%=}AI9Q}MQ@(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹MÁ••¡=ÁÑ¥½¹Ì ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€€€€€ü¹½ÁÑ¥½¹Í=Á•¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€€€€€ü¹½ÁÑ¥½¹Í½±±…ÁÍ•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•áÁ…¹‘=ÁÑ¥½¹Ìü¸ ¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹•áÑÉ…Á½±…Ñ•A¡É…Í•Ìü¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Í¡½Ý=ÁÑ¥½¹Ìü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Á¡É…Í•É½ÕÁÌñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€mt(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€±½Í•Ñ¥Ù•MÕÉ™…” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸±½Í•Ñ¥Ù•MÁ••¡MÕÉ™…” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•MÑ…ÉÑ• ¤ì(€€€€€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Í•ÑMÁ••¡1…å½ÕÑMÑ…Ñ” (€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•MÑ½ÁÁ• ¤ì(€€€€€€€€€€€€€€€…¹•±A•¹‘¥¹MÁ••¡I•…‘ä ¤ì((€€€€€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Í•ÑMÁ••¡1…å½ÕÑMÑ…Ñ” (€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€¡ÍÁ••¡QÉ…¥¹¥¹Ñ¥Ù”¤ì(€€€€€€€€€€€€€€€€€€€ÍÑ½Á%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ¡ì(€€€€€€€€€€€€€€€€€€€€€€€™½É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Íå¹MÁ••¡QÉ…¥¹¥¹½¹ÑÉ½±Ì ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•5ÕÑ• (€€€€€€€€€€€€€€€µÕÑ•€ôÑÉÕ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€µÕÑ•(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Íå¹MÁ••¡QÉ…¥¹¥¹½¹ÑÉ½±Ì ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹‘±•MÁ••¡UÑÑ•É…¹•MÑ…ÉÑ• ¤ì(€€€€€€€€€€€€€€€Ù½¥±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€¹]5=AÉ•Í•¹Ñ…Ñ¥½¹M•ÑÑ•ÉÌ(€€€€€€€€€€€€€€€€€€€€ü¹‘¥Íµ¥ÍÍMÁ••¡I•ÍÁ½¹Í”ü¸¡ì(€€€€€€€€€€€€€€€€€€€€€€€™…ÍÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍ¡•‘Õ±•MÑ…ÉÑÐ (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€™É½µI•…‘å½¹Ñ¥¹Õ…Ñ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€ô€ôíô(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ½¹Ñ¥¹Õ¥¹I•…‘ä€ô(€€€€€€€€€€€€€€€€€€€™É½µI•…‘å½¹Ñ¥¹Õ…Ñ¥½¸€˜˜(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€Á•¹‘¥¹MÁ••¡I•…‘ä€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ñð(€€€€€€€€€€€€€€€€€€€€€€€¹•ÝQÉ¥Á]½É­™±½Ý1½­•(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑÉ¥Á%Í1¥Ù” ¤ñð(€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€ ˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹‘¥Í…‰±•€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€…½¹Ñ¥¹Õ¥¹I•…‘ä(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…¹•±A•¹‘¥¹MÁ••¡I•…‘ä ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…¹•±A•¹‘¥¹MÁ••¡I•…‘ä ¤ì(€€€€€€€€€€€€€€€±½­9•ÝQÉ¥Á]½É­™±½Ü ¤ì((€€€€€€€€€€€€€€€±•ÐÍ¡•‘Õ±•‘]½É­™±½Ý=Á•¹•€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€½¹Ñ¥¹Õ¥¹I•…‘ä€˜˜(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ý½É­™±½Ü€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹É½±”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰É½½Ðˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¡½µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐ¹½Ü€ô(€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÑ…É•Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±½¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…Í•…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Ü°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•ÉÕÑÕÉ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …Ñ…É•Ð¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È¹ÍÑ…ÑÕÌ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ½ÁÁ•ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•Í•Ñ½µÁ±•Ñ•‘QÉ¥À ¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐ‘•™…Õ±ÑÌ€ô(€€€€€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á5½µ•¹Ñ•™…Õ±ÑÌ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Ü(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …‘•™…Õ±ÑÌ¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ¡•‘Õ±•‘MÑ…ÉÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑQ¥µ•±¥¹•…Ñ•Q¥µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ð°(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•™…Õ±ÑÌ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•…Ñ¥½¹…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÁÉ•™•É•¹•Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€•ÑQÉ¥ÁAÉ•™•É•¹•Ì ¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …Í¡•‘Õ±•‘MÑ…ÉÐ¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬¹±•¹Ñ €ô(€€€€€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€ôì(€€€€€€€€€€€€€€€€€€€€€€€€¸¸¹‘•™…Õ±ÑÌ°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€€€€€€€€€€€€€±…Ñ•	É•…­	•¡…Ù¥½Èè(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•É•¹•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±…Ñ•	É•…­	•¡…Ù¥½È°(€€€€€€€€€€€€€€€€€€€€€€€Íå¹½…±Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•É•¹•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Íå¹½…±Ì(€€€€€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì((€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ•Á…É•QÉ¥À¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•½ÕÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÔÀÀÀ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ðè¹½Ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€€€€€Í¡½ÝM¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì((€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘]½É­™±½Ý=Á•¹•€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€™¥¹…±±äì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…Í¡•‘Õ±•‘]½É­™±½Ý=Á•¹•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°((€€€€€€€€€€€½¹Ñ¥¹Õ•MÑ…ÉÑÐ (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=MÁ••¡Ù…¥±…‰¥±¥Ñä(€€€€€€€€€€€€€€€€€€€€€€€€¹…¹½¹Ñ¥¹Õ•MÑ…ÉÑÐ ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•MÑ…ÉÑÐ (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€™É½µI•…‘å½¹Ñ¥¹Õ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹	É•…­5•¹Ô (€€€€€€€€€€€€€€€É•…Í½¸€ô€‰‰É•…¬ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€‰É•…­	ÕÑÑ½¸ü¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€‰É•…­¥…±½œ(€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€ˆ¹ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹™½É…  (€€€€€€€€€€€€€€€€€€€€€€€¥Ñ•´€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥Ñ•´¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹¥…±½œ (€€€€€€€€€€€€€€€€€€€€‰‰É•…­¥…±½œˆ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡½½Í•	É•…­QåÁ” (€€€€€€€€€€€€€€€‰É•…­¡½¥”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…‰É•…­¥…±½œ¹½Á•¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ­¥¹€ô(€€€€€€€€€€€€€€€€€€€€¡ì(€€€€€€€€€€€€€€€€€€€€€€€€ˆÄÀˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡½ÉÐµ‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€Í¡½ÉÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡½ÉÐµ‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÄÔˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€‰É•…¬è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€±½¹œè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€±Õ¹ è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±Õ¹ ˆ(€€€€€€€€€€€€€€€€€€€ô¥l(€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€‰É•…­¡½¥”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤(€€€€€€€€€€€€€€€€€€€tì((€€€€€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€m‘…Ñ„µ‰É•…¬µÑåÁ”ôˆ‘í­¥¹‘ô‰u€(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …‰ÕÑÑ½¸¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€‰É•…­¥…±½œ(€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€ˆ¹ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹™½É…  (€€€€€€€€€€€€€€€€€€€€€€€¥Ñ•´€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥Ñ•´¹±…ÍÍ1¥ÍÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•µ½Ù” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹±…ÍÍ1¥ÍÐ¹…‘ (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹™½ÕÌ ¤ì((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ°(€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹™¥Éµ	É•…­QåÁ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì((€€€€€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰m‘…Ñ„µ‰É•…¬µÑåÁ•t¹ÍÁ•• µ™½ÕÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…‰É•…­¥…±½œ¹½Á•¸ñð(€€€€€€€€€€€€€€€€€€€€…‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ­¥¹€ô(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹‰É•…­QåÁ”ì((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µÑåÁ”µÍ•±•Ñ•ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑ	É•…­%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€­¥¹°(€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍÑ…ÉÑ	É•…¬ (€€€€€€€€€€€€€€€­¥¹(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì((€€€€€€€€€€€€€€€¥˜€ …­¥¹¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡‰É•…­¥…±½œ¹½Á•¸¤ì(€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€‰É•…­¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µÑåÁ”µÍ•±•Ñ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑ	É•…­%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€­¥¹°(€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍÑ…ÉÑ½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù•%¹Ñ•ÉÙ…±QåÁ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•%¹Ñ•ÉÙ…±QåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆñð(€€€€€€€€€€€€€€€€€€€‘½Ý¹	ÕÑÑ½¸ü¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑ%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€¡É•ÍÕ±Ð¤ì(€€€€€€€€€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹	É•…­¹‘5•¹Ô ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹MÁ••¡	É•…­AÉ½µÁÐ (€€€€€€€€€€€€€€€€€€€€‰•¹ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÉ•ÍÕµ•QÉ¥À ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹•¹‘%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ•¹‘QÉ¥À ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍ¥¹…°€ô(€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹ÑÑ¥½¹M¥¹…° ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸•¹‘ÕÉÉ•¹Ñ%¹Ñ•ÉÙ…±=ÉQÉ¥À (€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹•±½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”€ô(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆ…¹•±½Ý¹½¹™¥Éµ¥…±½œˆ¤ì((€€€€€€€€€€€€€€€¥˜€ …‘¥…±½œ¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÁÉ½µÁÐ€ô(€€€€€€€€€€€€€€€€€€€€‰AÉ•ÍÌ½M…ä=,Ñ¼•±•Ñ”å½ÕÈ‘½Ý¸Ñ¥µ”ˆì((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€€€€€½Á•¹¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€‰…¹•±½Ý¹½¹™¥Éµ¥…±½œˆ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…¹•°µ‘½Ý¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …½Á•¹•¤ì(€€€€€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€½Á•¹•€˜˜(€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€ü¹•á•ÕÑ¥½¹½¹Ñ•áÐ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹]5=Õ‘¥¼(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÁ•…¬ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ½µÁÐ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€½Á•¹•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹™¥Éµ…¹•±½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆ…¹•±½Ý¹½¹™¥Éµ¥…±½œˆ¤ì((€€€€€€€€€€€€€€€¥˜€ …‘¥…±½œü¹½Á•¸¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ…Ñ¥Ù”€ô(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹¥¹Ñ•ÉÙ…±QåÁ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…¹•°µ‘½Ý¸µ¥¹Ù…±¥ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…¹•°µ‘½Ý¸µ½¹™¥Éµ•ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹…¹•±%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€€€€€€€€€€€€€É•¹‘•ÉQÉ¥ÁÑ¥½¹MÑ…Ñ” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½¹Ñ¥¹Õ•½Ý¹Q¥µ” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆ…¹•±½Ý¹½¹™¥Éµ¥…±½œˆ¤ì((€€€€€€€€€€€€€€€¥˜€ …‘¥…±½œü¹½Á•¸¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Í•Ñ=­±±½Ý• (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…¹•°µ‘½Ý¸µ‘•±¥¹•ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘QÉ¥Á½…° ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ (€€€€€€€€€€€€€€€€€€€€‰QÉ¥À½…°ˆ°(€€€€€€€€€€€€€€€€€€€½…±A•É•¹Ñ½ÉM½Á” (€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘Q½Ñ…±½…° ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ (€€€€€€€€€€€€€€€€€€€Ñ½Ñ…±M½Á•1…‰•° ¤€¬€ˆ½…°ˆ°(€€€€€€€€€€€€€€€€€€€½…±A•É•¹Ñ½ÉM½Á” (€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•ÑQÉ¥Á½…° (€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ½…±A•É•¹ÑY…±Õ” (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•ÑQ½Ñ…±½…° (€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ½…±A•É•¹ÑY…±Õ” (€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ°(€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•½…° (€€€€€€€€€€€€€€€Á•É•¹Ð°(€€€€€€€€€€€€€€€½…±M½Á”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ¹½Éµ…±¥é•‘M½Á”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€½…±M½Á”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€½¹ÍÐÉ…¹•	åM½Á”€ôì(€€€€€€€€€€€€€€€€€€€‘…äè€‰‘…äˆ°(€€€€€€€€€€€€€€€€€€€Ý••¬è€‰Ý••¬ˆ°(€€€€€€€€€€€€€€€€€€€¡•¬è€‰Á…äµÁ•É¥½ˆ°(€€€€€€€€€€€€€€€€€€€µ½¹Ñ è€‰µ½¹Ñ ˆ°(€€€€€€€€€€€€€€€€€€€å•…Èè€‰å•…Èˆ(€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…ÁÁ±åM½Á” (€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ½…±A•É•¹ÑY…±Õ” (€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…ÁÁ±åM½Á” (€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ½…±A•É•¹ÑY…±Õ” (€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ°(€€€€€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÉ…¹”€ô(€€€€€€€€€€€€€€€€€€€É…¹•	åM½Á•l(€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘M½Á”(€€€€€€€€€€€€€€€€€€€tì((€€€€€€€€€€€€€€€¥˜€ …É…¹”¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Í•ÑQÉ¥Á1½I…¹” (€€€€€€€€€€€€€€€€€€€É…¹”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€…ÁÁ±åM½Á” (€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•Ñ½…±A•É•¹ÑY…±Õ” (€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ°(€€€€€€€€€€€€€€€€€€€Á•É•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘½…±5½‘” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐµ½‘”€ô(€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•A•É•¹Ñ5½‘” (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•É•¹Ñ5½‘”(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€µ½‘”€ôôô€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€€€€€€€€€èµ½‘”¹¡…ÉÐ À¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½UÁÁ•É…Í” ¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½‘”¹Í±¥” Ä¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ (€€€€€€€€€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€€€€€€€€€€‰5½‘”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•½…±5½‘” (€€€€€€€€€€€€€€€½…±5½‘”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐµ½‘”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€½…±5½‘”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÉ…¹•	å5½‘”€ôì(€€€€€€€€€€€€€€€€€€€‘…äè€‰‘…äˆ°(€€€€€€€€€€€€€€€€€€€Ý••¬è€‰Ý••¬ˆ°(€€€€€€€€€€€€€€€€€€€¡•¬è€‰Á…äµÁ•É¥½ˆ°(€€€€€€€€€€€€€€€€€€€µ½¹Ñ è€‰µ½¹Ñ ˆ°(€€€€€€€€€€€€€€€€€€€å•…Èè€‰å•…Èˆ(€€€€€€€€€€€€€€€ôì(€€€€€€€€€€€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•‘I…¹”€ô(€€€€€€€€€€€€€€€€€€€É…¹•	å5½‘•l(€€€€€€€€€€€€€€€€€€€€€€€µ½‘”(€€€€€€€€€€€€€€€€€€€tì(€€€€€€€€€€€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•‘5½‘”€ô(€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•‘I…¹”(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€èµ½‘”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…AI9Q}5=L(€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•‘5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍ5½‘”€ô(€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•A•É•¹Ñ5½‘” (€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•É•¹Ñ5½‘”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍI…¹”€ô(€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1½I…¹” ¤ì((€€€€€€€€€€€€€€€¥˜€¡É•ÅÕ•ÍÑ•‘I…¹”¤ì(€€€€€€€€€€€€€€€€€€€Í•ÑQÉ¥Á1½I…¹” (€€€€€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•‘I…¹”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ…ÁÁ±¥•‘5½‘”€ô(€€€€€€€€€€€€€€€€€€€…ÁÁ±åM½Á” (€€€€€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•‘5½‘”(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€Íå¹M½Á•U$¡ÑÉÕ”¤ì(€€€€€€€€€€€€€€€É•¹‘•É±½­Q¥µ•ÉU%MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È¹Õ¥MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•™É•Í¡ÕÑ½½…±¥…±½œ ¤ì(€€€€€€€€€€€€€€€ÅÕ•Õ•MÕµµ…ÉåI•™É•Í  ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•‘5½‘”€„ôô(€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•‘5½‘”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÉ…¹•¡…¹•€ô(€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1½I…¹” ¤€„ôô(€€€€€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍI…¹”ì(€€€€€€€€€€€€€€€½¹ÍÐµ½‘•¡…¹•€ô(€€€€€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍ5½‘”€„ôô(€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•‘5½‘”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…É…¹•¡…¹•€˜˜(€€€€€€€€€€€€€€€€€€€€…µ½‘•¡…¹•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•‘5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€€€€€€€€€è…ÁÁ±¥•‘5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¡…ÉÐ À¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½UÁÁ•É…Í” ¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•‘5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í±¥” Ä¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€€€€€€€€€ˆ5½‘”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€å±•½…±5½‘” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÕÉÉ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€AI9Q}5=L(€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹‘•á=˜ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•A•É•¹Ñ5½‘” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•É•¹Ñ5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐ¹•áÐ€ô(€€€€€€€€€€€€€€€€€€€AI9Q}5=Ml(€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹Ð€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€€€€€€€€€€€€€¤€”(€€€€€€€€€€€€€€€€€€€€€€€AI9Q}5=L(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±•¹Ñ (€€€€€€€€€€€€€€€€€€€tì((€€€€€€€€€€€€€€€½¹ÍÐ…ÁÁ±¥•€ô(€€€€€€€€€€€€€€€€€€€…ÁÁ±åM½Á” (€€€€€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€üÑ½Ñ…±M½Á•1…‰•° ¤(€€€€€€€€€€€€€€€€€€€€€€€€è…ÁÁ±¥•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¡…ÉÐ À¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½UÁÁ•É…Í” ¤€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í±¥” Ä¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€±…‰•°€¬(€€€€€€€€€€€€€€€€€€€€ˆ5½‘”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘Må¹MÑ…ÑÕÌ ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€•ÑMå¹½…±ÍMÑ…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Må¹Œ=¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Må¹Œ=™˜ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•Må¹Œ (€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…¹¥µ…Ñ•=™™±¥¹•±½Õ‘Ì ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€€€€€‰…¹¹½ÐÍå¹Œ½™™±¥¹”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÕÉÉ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€•ÑMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€€€€€€€€€±•Ð•¹…‰±•ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ñð(€€€€€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€¹Õ±°ñð(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€•¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€€€€€€…ÕÉÉ•¹Ðì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Íå¹MÑ…Ñ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰‰½½±•…¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€•¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÅÕ•ÍÑ•€ô(€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Íå¹MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉÕ”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¹…‰±•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¹…‰±”ˆ(€€€€€€€€€€€€€€€€€€€€€€€t¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€•¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½™˜ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰™…±Í”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Í…‰±•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Í…‰±”ˆ(€€€€€€€€€€€€€€€€€€€€€€€t¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÅÕ•ÍÑ•(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€•¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€Í•ÑMå¹½…±Ì (€€€€€€€€€€€€€€€€€€€€€€€•¹…‰±•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€€€€€‰Må¹Œ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…¹¥µ…Ñ•Må¹½…±Í%½¹Ì ¤ì((€€€€€€€€€€€€€€€½¹ÍÐ…ÁÁ±¥•€ô(€€€€€€€€€€€€€€€€€€€•ÑMå¹½…±ÍMÑ…Ñ” ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€…ÁÁ±¥•€„ôô(€€€€€€€€€€€€€€€€€€€€€€€•¹…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€€€€€‰Må¹Œ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹Ð€ôôô(€€€€€€€€€€€€€€€€€€€•¹…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€•¹…‰±•(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Må¹Œ=¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Må¹Œ=™˜ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€±½­¹‘Q¥µ” (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ …ÑÉ¥Á%Í1¥Ù” ¤¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÑ…É•Ð€ô(€€€€€€€€€€€€€€€€€€€¹±¥Í¡MÁ••¡Y…±Õ•AÉ•ÁÉ½•ÍÍ½È(€€€€€€€€€€€€€€€€€€€€€€€€¹Á…ÉÍ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰±½¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…Í•…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•ÉÕÑÕÉ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍ•…‘±¥¹”€ô(€€€€€€€€€€€€€€€€€€€•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘”(€€€€€€€€€€€€€€€€€€€€€€€€ü¹‘•…‘±¥¹”(€€€€€€€€€€€€€€€€€€€€€€€€ü¹•ÑQ¥µ”ü¸ ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…Ñ…É•Ðñð(€€€€€€€€€€€€€€€€€€€€……ÁÁ±å¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” (€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ð(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍ•…‘±¥¹”€ôôô(€€€€€€€€€€€€€€€€€€€Ñ…É•Ð¹•ÑQ¥µ” ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€Ñ…É•Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½…±•Q¥µ•MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡½ÕÈè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹Õµ•É¥Œˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ¥¹ÕÑ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆÈµ‘¥¥Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€€‰¹Q¥µ”1½­•Ñ¼€ˆ€¬(€€€€€€€€€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…äèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™¥àè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹Q¥µ”1½­•Ñ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹QÉ¥Á1½œ (€€€€€€€€€€€€€€€Í½ÕÉ”€ô€‰ÍÁ•• ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ù½¥½Á•¹QÉ¥Á1¥ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€Í½ÕÉ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€±½Í•QÉ¥Á1½œ (€€€€€€€€€€€€€€€Í½ÕÉ”€ô€‰ÍÁ•• ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€•ÑQÉ¥Á1¥ÍÑMÑ…Ñ” ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½Á•¸ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ù½¥±½Í•QÉ¥Á1¥ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€Í½ÕÉ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€‘•™•ÉQÉ¥À ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ý½É­™±½Ü€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆñð(€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð¹‘•™•ÉÉ•€ô(€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì(€€€€€€€€€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì((€€€€€€€€€€€€€€€¥˜€¡Ù½¥•¹ÑÉåMÑ…Ñ”¤ì(€€€€€€€€€€€€€€€€€€€Ù½¥±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€…¹•°è™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¡½µ”ˆ(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€Ù½¥±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¡½µ”ˆ(€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘¹‘Q¥µ” ¤ì(€€€€€€€€€€€€€€€±•ÐÉ•¹‘•É•ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€É•¹‘•É•€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑI•¹‘•É•‘Q¥µ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…±Õ±…Ñ•µ•¹ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜É•¹‘•É•€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆñð(€€€€€€€€€€€€€€€€€€€€…É•¹‘•É•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ (€€€€€€€€€€€€€€€€€€€€‰¹Q¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€É•¹‘•É•°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€½‘•Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘Q¥µ•I•µ…¥¹¥¹œ ¤ì(€€€€€€€€€€€€€€€±•ÐÉ•¹‘•É•ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€É•¹‘•É•€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑI•¹‘•É•‘Q¥µ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰É•µ…¥¹¥¹œˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜É•¹‘•É•€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆñð(€€€€€€€€€€€€€€€€€€€€…É•¹‘•É•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ½Ù•É	ä€ô(€€€€€€€€€€€€€€€€€€€É•¹‘•É•(€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑÍ]¥Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆ´ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ…‰Í½±ÕÑ•I•¹‘•É•€ô(€€€€€€€€€€€€€€€€€€€½Ù•É	ä(€€€€€€€€€€€€€€€€€€€€€€€€üÉ•¹‘•É•¹Í±¥” Ä¤(€€€€€€€€€€€€€€€€€€€€€€€€èÉ•¹‘•É•ì(€€€€€€€€€€€€€€€½¹ÍÐÉ•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€Á…ÉÍ•Q¥µ•±¥¹•Q¥µ” (€€€€€€€€€€€€€€€€€€€€€€€…‰Í½±ÕÑ•I•¹‘•É•(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÍÁ½­•¹ÕÉ…Ñ¥½¸€ô(€€€€€€€€€€€€€€€€€€€™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€É•µ…¥¹¥¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍÁ½­•¹Y…±Õ”€ô(€€€€€€€€€€€€€€€€€€€½Ù•É	ä(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰=Ù•È‰ä€ˆ€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹ÕÉ…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€èÍÁ½­•¹ÕÉ…Ñ¥½¸ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€É•¹‘•É•°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”°(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÁ½¹Í•¥ÍÁ±…äèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•¹‘•É•(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•…‘I•¹‘•É•‘Q¥µ” (€€€€€€€€€€€€€€€Ñ¥µ•5½‘”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•5½‘”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€½¹ÍÐµ½‘”€ô(€€€€€€€€€€€€€€€€€€€Ù…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€‰•¹ˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰…±Õ±…Ñ•µ•¹ˆ(€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•±…ÁÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰•±…ÁÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰É•µ…¥¹¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰É•µ…¥¹¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€¥˜€ …µ½‘”¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±•ÐÍÑ…Ñ”ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ñ™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÍÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹µ½‘”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€µ½‘”ñð(€€€€€€€€€€€€€€€€€€€€…ÍÑ…Ñ”¹…Ù…¥±…‰±”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Ñ…Ñ•MÁ••¡5•ÑÉ¥Œ (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹±…‰•°°(€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Ñ•áÐ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…±Õ±…Ñ•µ•¹ˆñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥Í¥¹¥Ñ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÕ¹‘•™¥¹•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è™½Éµ…Ñ½…±…¥±ÕÉ•ÕÉ…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€5…Ñ ¹…‰Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤°(€€€€€€€€€€€€€€€€€€€€€€€½‘•Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•I•¹‘•É•‘Q¥µ” (€€€€€€€€€€€€€€€Ñ¥µ•5½‘”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€±•Ð¹•áÐì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Ñ¥µ•5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ñð(€€€€€€€€€€€€€€€€€€€Ñ¥µ•5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€¹Õ±°ñð(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•5½‘”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ¥¹‘•à€ô(€€€€€€€€€€€€€€€€€€€€€€€I9I}Q%5}5=L(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹‘•á=˜ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•¹‘•É•‘Q¥µ•5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¹•áÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€I9I}Q%5}5=Ml(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€”(€€€€€€€€€€€€€€€€€€€€€€€€€€€I9I}Q%5}5=L(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±•¹Ñ (€€€€€€€€€€€€€€€€€€€€€€€tì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ½1½Ý•É…Í” ¤ì((€€€€€€€€€€€€€€€€€€€¹•áÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¹ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰…±Õ±…Ñ•µ•¹ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•±…ÁÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰•±…ÁÍ•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰É•µ…¥¹¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰É•µ…¥¹¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÙ…±Õ”ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…I9I}Q%5}5=L(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹±Õ‘•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÌ€ô(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹É•¹‘•É•‘Q¥µ•5½‘”ì((€€€€€€€€€€€€€€€…ÁÁ±åI•¹‘•É•‘Q¥µ•5½‘” (€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÌ€ôôô(€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±•Ð…¹¹½Õ¹•µ•¹Ðì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹•áÐ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰…±Õ±…Ñ•µ•¹ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰M¡½Ý¥¹œ¹Q¥µ”ˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”¥˜€ (€€€€€€€€€€€€€€€€€€€¹•áÐ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰•±…ÁÍ•ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰M¡½Ý¥¹œ±…ÁÍ•Q¥µ”ˆì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€±•Ð•™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”ì((€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€•™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ñ™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€•™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹±…‰•°€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰	…¹­•Q¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰M¡½Ý¥¹œ	…¹­•Q¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è•™™•Ñ¥Ù•Q¥µ•MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹±…‰•°€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Q¥µ”=Ù•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰M¡½Ý¥¹œQ¥µ”=Ù•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰M¡½Ý¥¹œQ¥µ”1•™Ðˆì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸½¹™¥ÉµM•ÑÑ¥¹¡…¹” (€€€€€€€€€€€€€€€€€€€…¹¹½Õ¹•µ•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹MÑ…¹‘…É‘Q¥µ•M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€€€€€±•ÐÍÕµµ…Éäì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éä€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑMÕµµ…ÉåM¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á%Í1¥Ù” ¤ñð(€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éäü¹Í½Á”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ (€€€€€€€€€€€€€€€€€€€€‰ÍÕµµ…ÉäµÍÑ…¹‘…ÉµÑ¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€™½ÕÍ¥•±è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹½…±‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€•¹‘Q¥µ•½…±1½­•‘½É5½‘” ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€™±…Í¡¹‘Q¥µ•½…±1½¬ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È¹Á•É•¹Ñ5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰…ÕÑ¼ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½Á•¹ÕÑ½½…±¥…±½œ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Ù½¥½Á•¹A•É•¹Ñ½…±9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹Á•É•¹Ñ5½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Ñ…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰ÑÉ¥Àˆ(€€€€€€€€€€€€€€€€¤¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹™¥Éµ	É•…­AÉ½µÁÑe•Ì ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑÉ…¹Í…Ñ¥½¹Q¥µ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¹Í…Ñ¥½¹…Ñ” ¤ì((€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…‘¥…±½œü¹½Á•¸ñð(€€€€€€€€€€€€€€€€€€€€…ÍÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ‰É•…¬µå•Ìˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±•…ÉMÁ••¡	É•…­AÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑ	É•…­%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€‰±Õ¹ ˆ°(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€‰•¹ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð•¹‘ÕÉÉ•¹Ñ%¹Ñ•ÉÙ…±=ÉQÉ¥À (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ…¹Í…Ñ¥½¹Q¥µ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹™¥Éµ	É•…­AÉ½µÁÑ9¼ ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡	É•…­AÉ½µÁÑMÑ…Ñ”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…‘¥…±½œü¹½Á•¸ñð(€€€€€€€€€€€€€€€€€€€€…ÍÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ‰É•…¬µ¹¼ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±•…ÉMÁ••¡	É•…­AÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÍÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…ÉÑ	É•…­%¹Ñ•ÉÙ…° (€€€€€€€€€€€€€€€€€€€€€€€€‰‰É•…¬ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÍÑ…Ñ”¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€‰•¹ˆì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹•±	É•…­AÉ½µÁÐ ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‘¥…±½œ€ô(€€€€€€€€€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ¤ì((€€€€€€€€€€€€€€€¥˜€ …‘¥…±½œü¹½Á•¸¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€‘¥…±½œ°(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ‰É•…¬µ…¹•°ˆ(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±•…ÉMÁ••¡	É•…­AÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€ÕÁ‘…Ñ•É…Á¡¥…±M•ÑÑ¥¹Ì (€€€€€€€€€€€€€€€Í•ÑÑ¥¹Ì(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ¹½Éµ…±¥é•€ô(€€€€€€€€€€€€€€€€€€€Í…Ù•É…Á¡¥…±M•ÑÑ¥¹Ì (€€€€€€€€€€€€€€€€€€€€€€€Í•ÑÑ¥¹Ì(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€…ÁÁ±åÉ…Á¡¥…±M•ÑÑ¥¹Ì (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸¹½Éµ…±¥é•ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•1…Ñ•	É•…­	•¡…Ù¥½È (€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁÉ•™•É•¹•Ì€ôì(€€€€€€€€€€€€€€€€€€€€¸¸¹•ÑQÉ¥ÁAÉ•™•É•¹•Ì ¤°(€€€€€€€€€€€€€€€€€€€±…Ñ•	É•…­	•¡…Ù¥½Èè(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÕÑ½I•ÍÑ…ÉÑQÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰…ÕÑ½I•ÍÑ…ÉÑQÉ¥Àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰Í¡½Ý1…Ñ•]¥¹‘½Üˆ(€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€Í…Ù•QÉ¥ÁAÉ•™•É•¹•Ì (€€€€€€€€€€€€€€€€€€€ÁÉ•™•É•¹•Ì(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á%Í1¥Ù” ¤€˜˜(€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹¥¹Ñ•ÉÙ…±±…ÁÍ•‘	•¡…Ù¥½È€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑ1…Ñ•¹äˆì((€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€¹…ÕÑ½I•ÍÑ…ÉÑQÉ¥Á™Ñ•É1…Ñ•	É•…¬€ô(€€€€€€€€€€€€€€€€€€€€€€€ÁÉ•™•É•¹•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±…Ñ•	É•…­	•¡…Ù¥½È€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰…ÕÑ½I•ÍÑ…ÉÑQÉ¥Àˆì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÁÉ•™•É•¹•Ìì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹¹•ÑUÍ•È (€€€€€€€€€€€€€€€ÕÍ•É¹…µ”°(€€€€€€€€€€€€€€€Á…ÍÍÝ½É(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…¹¥µ…Ñ•=™™±¥¹•±½Õ‘Ì ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€±½¥¹A•¹‘¥¹œ€ôÑÉÕ”ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½¹¹•Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÕÍ•É¹…µ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÑÉ¥´ ¤°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á…ÍÍÝ½Éñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…É•ÍÕ±Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½¹¹•Ñ•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰1½¥¸™…¥±•¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€‘•±¥‰•É…Ñ•±å1½•‘=ÕÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€€€€€Í…™•MÑ½É…•M•Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½˜¹‘•±¥‰•É…Ñ•±å1½•‘=ÕÐˆ°(€€€€€€€€€€€€€€€€€€€€€€€€‰™…±Í”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Á½ÁÕ±…Ñ•AÉ½™¥±” (€€€€€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ð¹ÕÍ•È(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€™½È€ (€€€€€€€€€€€€€€€€€€€€€€€±•Ð¥¹‘•à€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±•¹Ñ €´(€€€€€€€€€€€€€€€€€€€€€€€€€€€€Äì(€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à€øô€Àì(€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à€´ô€Ä(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…­l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à(€€€€€€€€€€€€€€€€€€€€€€€€€€€tü¹ÑåÁ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Á½Á½Ù•Èˆ€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…­l(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à(€€€€€€€€€€€€€€€€€€€€€€€€€€€tü¹•±•µ•¹Ð€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ±¥” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•à°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ä(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¡¥‘•A½Á½Ù•É½É!…¹‘½™˜ (€€€€€€€€€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Íå¹9•ÑÝ½É­MÑ…ÑÕÍU$¡ì(€€€€€€€€€€€€€€€€€€€€€€€±½¥¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸É•ÍÕ±Ðì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€™¥¹…±±äì(€€€€€€€€€€€€€€€€€€€±½¥¹A•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹•ÍÍQ½­•¹Ì ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁ•Éµ¥ÍÍ¥½¹Ì€ô(€€€€€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€€€€€Í¥¹•‘%¹AÉ½™¥±”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Á•Éµ¥ÍÍ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€„ (€€€€€€€€€€€€€€€€€€€€€€€Á•Éµ¥ÍÍ¥½¹Ì€˜(€€€€€€€€€€€€€€€€€€€€€€€MM}Q=-9}AI5%MM%=9}5M,(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰É…¹ÐQ½­•¸•ÍÌÁ•Éµ¥ÍÍ¥½¸¥ÌÉ•ÅÕ¥É•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½…‘µ¥¸½…•ÍÌµÑ½­•¹Ì¼ý½¹Í½±”ôÄˆ°(€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½™•ÍÍQ½­•¹Ìˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …½Á•¹•¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Q¡”•ÍÌQ½­•¹ÌÝ¥¹‘½ÜÝ…Ì‰±½­•‰äÑ¡”‰É½ÝÍ•È¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹MÁ••¡QÉ…¥¹¥¹œ ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…Í¥¹•‘%¹AÉ½™¥±”ñð(€€€€€€€€€€€€€€€€€€€€…ÍÁ••¡QÉ…¥¹¥¹½¹¹•Ñ¥½¹Ù…¥±…‰±”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡ÍÁ••¡QÉ…¥¹¥¹Ñ¥Ù”¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€¥˜€¡¥¹ÁÁMÁ••¡QÉ…¥¹¥¹¹…‰±•¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸‘¥Í…‰±•%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¡…ÍMÁ••¡•Ù•±½Á•É•ÍÌ ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½Á•¹¥…±½±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡QÉ…¥¹¥¹¡½¥•¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µÑÉ…¥¹¥¹œµ¡½¥”ˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Ù½¥•¹…‰±•%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ ¤(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½Á•¹MÁ••¡Q¥µ¥¹œ ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁ•Éµ¥ÍÍ¥½¹Ì€ô(€€€€€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€€€€€Í¥¹•‘%¹AÉ½™¥±”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Á•Éµ¥ÍÍ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€„ (€€€€€€€€€€€€€€€€€€€€€€€Á•Éµ¥ÍÍ¥½¹Ì€˜(€€€€€€€€€€€€€€€€€€€€€€€Y1=AI}59U}AI5%MM%=9}5M,(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰•Ù•±½Á•È½È•Ù•±½Á•ÈAÉ•Ù¥•ÜÁ•Éµ¥ÍÍ¥½¸¥ÌÉ•ÅÕ¥É•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…Ý…¥Ð•¹ÍÕÉ•MÁ••¡IÕ¹Ñ¥µ” ¤ì(€€€€€€€€€€€€€€€Íå¹‘…ÁÑ¥Ù•MÁ••¡Q¥µ¥¹I…Ñ” ¤ì((€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€€€€€½Á•¹¥…±½±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€ÍÁ••¡Q¥µ¥¹¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µÑ¥µ¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€¡½Á•¹•¤ì(€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑMÁ••¡Q¥µ¥¹Q½½±UÁ‘…Ñ•Ì ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸½Á•¹•ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½Á•¹MÁ••¡‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁ•Éµ¥ÍÍ¥½¹Ì€ô(€€€€€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€€€€€Í¥¹•‘%¹AÉ½™¥±”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Á•Éµ¥ÍÍ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€„ (€€€€€€€€€€€€€€€€€€€€€€€Á•Éµ¥ÍÍ¥½¹Ì€˜(€€€€€€€€€€€€€€€€€€€€€€€MA!}%Q=I}AI5%MM%=9}5M,(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰•Ù•±½Á•È½È•Ù•±½Á•ÈAÉ•Ù¥•ÜÁ•Éµ¥ÍÍ¥½¸¥ÌÉ•ÅÕ¥É•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÑ…É•Ð€ô(€€€€€€€€€€€€€€€€€€€€‰Ýµ½™MÁ••¡‘¥Ñ½Èˆì((€€€€€€€€€€€€€€€½¹ÍÐ•‘¥Ñ½É]¥¹‘½Ü€ô(€€€€€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ°(€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ð(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …•‘¥Ñ½É]¥¹‘½Ü¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Q¡”MÁ•• ‘¥Ñ½ÈÝ¥¹‘½ÜÝ…Ì‰±½­•‰äÑ¡”‰É½ÝÍ•È¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð™•Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½ÕÍ•ÉÌ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•‘•¹Ñ¥…±Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í…µ”µ½É¥¥¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¡”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹¼µÍÑ½É”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•…‘•ÉÌèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•ÁÐˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐ‘…Ñ„€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…É•ÍÁ½¹Í”¹½¬ñð(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜‘…Ñ„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÉ™Q½­•¸€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆñð(€€€€€€€€€€€€€€€€€€€€€€€‘…Ñ„¹ÍÉ™Q½­•¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±•¹Ñ €ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÌÈ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€‘…Ñ„¹µ•ÍÍ…”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Ù…±¥]5=MIÑ½­•¸¥ÌÉ•ÅÕ¥É•¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐ™½É´€ô(€€€€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰™½É´ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€™½É´¹µ•Ñ¡½€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰A=MPˆì((€€€€€€€€€€€€€€€€€€€™½É´¹…Ñ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½…‘µ¥¸½ÍÁ•• µ•‘¥Ñ½È¼ˆì((€€€€€€€€€€€€€€€€€€€™½É´¹Ñ…É•Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€Ñ…É•Ðì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÑ½­•¸€ô(€€€€€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¥¹ÁÕÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Ñ½­•¸¹ÑåÁ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰¡¥‘‘•¸ˆì((€€€€€€€€€€€€€€€€€€€Ñ½­•¸¹¹…µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÉ™}Ñ½­•¸ˆì((€€€€€€€€€€€€€€€€€€€Ñ½­•¸¹Ù…±Õ”€ô(€€€€€€€€€€€€€€€€€€€€€€€‘…Ñ„¹ÍÉ™Q½­•¸ì((€€€€€€€€€€€€€€€€€€€™½É´¹…ÁÁ•¹ (€€€€€€€€€€€€€€€€€€€€€€€Ñ½­•¸(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹‰½‘ä(€€€€€€€€€€€€€€€€€€€€€€€€¹…ÁÁ•¹ (€€€€€€€€€€€€€€€€€€€€€€€€€€€™½É´(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€™½É´¹ÍÕ‰µ¥Ð ¤ì(€€€€€€€€€€€€€€€€€€€™½É´¹É•µ½Ù” ¤ì((€€€€€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ € (€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É]¥¹‘½Ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹±½Í” ¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü•ÉÉ½Èì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹•Ù•±½Á•É½Ì ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁ•Éµ¥ÍÍ¥½¹Ì€ô(€€€€€€€€€€€€€€€€€€€9Õµ‰•È (€€€€€€€€€€€€€€€€€€€€€€€Í¥¹•‘%¹AÉ½™¥±”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹Á•Éµ¥ÍÍ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€„ (€€€€€€€€€€€€€€€€€€€€€€€Á•Éµ¥ÍÍ¥½¹Ì€˜(€€€€€€€€€€€€€€€€€€€€€€€Y1=AI}59U}AI5%MM%=9}5M,(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰•Ù•±½Á•È½È•Ù•±½Á•ÈAÉ•Ù¥•ÜÁ•Éµ¥ÍÍ¥½¸¥ÌÉ•ÅÕ¥É•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½‘½Ì¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½™•Ù•±½Á•É½Ìˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …½Á•¹•¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Q¡”•Ù•±½Á•È½ÌÝ¥¹‘½ÜÝ…Ì‰±½­•‰äÑ¡”‰É½ÝÍ•È¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹MÅ±½¹Í½±” ¤ì(€€€€€€€€€€€€€€€½¹ÍÐ½Á•¹•€ô(€€€€€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹½Á•¸ (€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½…‘µ¥¸½ÍÅ°¼ý½¹Í½±”ôÄˆ°(€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½™MÅ±½¹Í½±”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …½Á•¹•¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Q¡”…Ñ…‰…Í”•ÍÌÝ¥¹‘½ÜÝ…Ì‰±½­•‰äÑ¡”‰É½ÝÍ•È¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ‘¥Í½¹¹•ÑUÍ•È ¤ì(€€€€€€€€€€€€€€€µ…¥¹5•¹Ô(€€€€€€€€€€€€€€€€€€€€ü¹¡¥‘•A½Á½Ù•Èü¸ ¤ì((€€€€€€€€€€€€€€€¥˜€¡ÍÁ••¡QÉ…¥¹¥¹Ñ¥Ù”¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¥¹ÁÁMÁ••¡QÉ…¥¹¥¹¹…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ•á¥Ñ•€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð‘¥Í…‰±•%¹ÁÁMÁ••¡QÉ…¥¹¥¹œ ¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …•á¥Ñ•¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€‘•±¥‰•É…Ñ•±å1½•‘=ÕÐ€ô(€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì((€€€€€€€€€€€€€€€Í…™•MÑ½É…•M•Ð (€€€€€€€€€€€€€€€€€€€€‰Ýµ½˜¹‘•±¥‰•É…Ñ•±å1½•‘=ÕÐˆ°(€€€€€€€€€€€€€€€€€€€€‰ÑÉÕ”ˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±•…ÉQ¥µ•½ÕÐ (€€€€€€€€€€€€€€€€€€€±½¥¹AÉ½µÁÑQ¥µ•½ÕÐ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€±•ÐÉ•µ½Ñ••ÍÑÉ½å•€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹‘¥Í½¹¹•Ð ¤ì((€€€€€€€€€€€€€€€€€€€É•µ½Ñ••ÍÑÉ½å•€ô(€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÍÕ±Ðü¹É•µ½Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …É•µ½Ñ••ÍÑÉ½å•¤ì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ•ÍÍ¥½¹I•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð™•Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½ÕÍ•ÉÌ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•‘•¹Ñ¥…±Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í…µ”µ½É¥¥¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¡”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹¼µÍÑ½É”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•…‘•ÉÌèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•ÁÐˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¹I•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÑÕÌ€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÐÀÄ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ½Ñ••ÍÑÉ½å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ•ÍÍ¥½¹…Ñ„€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥ÐÍ•ÍÍ¥½¹I•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹©Í½¸ ¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Í•ÍÍ¥½¹I•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½¬ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Í•ÍÍ¥½¹…Ñ„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÉ™Q½­•¸€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑÉ¥¹œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¹…Ñ„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ•ÍÍ…”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰U¹…‰±”Ñ¼‘•ÍÑÉ½äÑ¡”]5=Í•ÍÍ¥½¸¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ±½½ÕÑI•ÍÁ½¹Í”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð™•Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€A%}	M€¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…Á¤½ÕÍ•ÉÌ¼ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µ•Ñ¡½è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰A=MPˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•‘•¹Ñ¥…±Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í…µ”µ½É¥¥¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¡”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹¼µÍÑ½É”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•…‘•ÉÌèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•ÁÐˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½¹Ñ•¹ÐµQåÁ”ˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÁÁ±¥…Ñ¥½¸½©Í½¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰`µMIµQ½­•¸ˆè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¹…Ñ„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÉ™Q½­•¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½‘äè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€)M=8¹ÍÑÉ¥¹¥™ä¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰‘¥Í½¹¹•Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…±½½ÕÑI•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½¬(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ±½½ÕÑ…Ñ„€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½½ÕÑI•ÍÁ½¹Í”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹©Í½¸ ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôø€¡íô¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±½½ÕÑ…Ñ„(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹µ•ÍÍ…”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰U¹…‰±”Ñ¼‘•ÍÑÉ½äÑ¡”]5=Í•ÍÍ¥½¸¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•µ½Ñ••ÍÑÉ½å•€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€™¥¹…±±äì(€€€€€€€€€€€€€€€€€€€Íå¹9•ÑÝ½É­MÑ…ÑÕÍU$ ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ …É•µ½Ñ••ÍÑÉ½å•¤ì(€€€€€€€€€€€€€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Q¡”]5=Í•ÉÙ•ÈÍ•ÍÍ¥½¸Ý…Ì¹½Ð‘•ÍÑÉ½å•¸ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í…Ù•AÉ½™¥±•…Ñ„ (€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹‘¥ÍÁ…Ñ¡Ù•¹Ð (€€€€€€€€€€€€€€€€€€€¹•ÜÕÍÑ½µÙ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½˜éÁÉ½™¥±”µÍ…Ù”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ•½˜Ù…±Õ•Ì€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½‰©•Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÙ…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€èíô(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•ÅÕ•ÍÑA…ÍÍÝ½É‘I•Í•Ð ¤ì(€€€€€€€€€€€€€€€Ý¥¹‘½Ü¹‘¥ÍÁ…Ñ¡Ù•¹Ð (€€€€€€€€€€€€€€€€€€€¹•ÜÕÍÑ½µÙ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰Ýµ½˜éÉ•Í•ÐµÁ…ÍÍÝ½ÉµÉ•ÅÕ•ÍÐˆ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•Ñ…¥°èì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…Á¥	…Í”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€A%}	M(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•M¡•‘Õ±•‘MÑ…ÉÑÕÑ¼ (€€€€€€€€€€€€€€€•¹…‰±•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•€ô(€€€€€€€€€€€€€€€€€€€	½½±•…¸¡•¹…‰±•¤ì((€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ¼¹¡•­•€ô(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•ì((€€€€€€€€€€€€€€€ÕÁ‘…Ñ•M¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸Í¡•‘Õ±•‘MÑ…ÉÑÕÑ½Éµ•ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥À (€€€€€€€€€€€€€€€µ½‘”€ô€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰•¥¹M¡•‘Õ±•‘QÉ¥À (€€€€€€€€€€€€€€€€€€€µ½‘”€ôôô€‰¹½Üˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰¹½Üˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Á…É±ä ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹½Á•¸ñð(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Ü(€€€€€€€€€€€€€€€€€€€€€€€€¹‘¥Í…‰±•ñð(€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ñ…¹MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸‰•¥¹M¡•‘Õ±•‘QÉ¥À (€€€€€€€€€€€€€€€€€€€€‰¹½Üˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÐ ¤ì(€€€€€€€€€€€€€€€…¹•±M¡•‘Õ±•‘MÑ…ÉÑAÉ½µÁÐ ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ•‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹½Á•¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…¹‘…Éµ•‘¥Ðˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Ù½¥½Á•¹9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€µ½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€‰Ñ¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€Í½ÕÉ”è(€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€¥¹¥Ñ¥…±Y…±Õ”è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì°(€€€€€€€€€€€€€€€€€€€É½±”è(€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ°(€€€€€€€€€€€€€€€€€€€Ý½É­™±½Üè(€€€€€€€€€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆ°(€€€€€€€€€€€€€€€€€€€…¹•±Q…É•Ðè(€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€€€€½¹™¥ÉµQ…É•Ðè(€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€€€€‰…­Q…É•Ðè(€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€À°(€€€€€€€€€€€€€€€€€€€…±±½ÝµÁÑäè(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€½¹½¹™¥É´è(€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ðô€À(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ½¥•M•Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÑ…Ñ”€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í½ÕÉ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ìì((€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù½¥•M•Ð€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¹5¥±±¥Í•½¹‘Ì€ø€À(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÉµM¡•‘Õ±•‘MÑ…ÉÑÕÑ½É½µY½¥” ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô¤¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€Í¡½ÝM¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•Í½±ÕÑ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9••‘ÍI•Í½±ÕÑ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€±•…É9Õµ‰•ÉA…‘Y…±Õ” ¤ì(€€€€€€€€€€€€€€€•É…Í•9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€‰…­ÍÁ…•9Õµ‰•ÉA…‘Y…±Õ” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸‰…­ÍÁ…•9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•Í•Ñ9Õµ‰•ÉA…‘Y…±Õ” ¤ì(€€€€€€€€€€€€€€€É•Í•Ñ9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€•¹Ñ•É9Õµ‰•ÉA…‘¥¥Ð (€€€€€€€€€€€€€€€‘¥¥Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ …¹Õµ‰•ÉA…‘MÑ…Ñ”¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€‘¥¥Ðñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€„½yq¼¹Ñ•ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÁÉ•Ù¥½ÕÍA•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹œì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…•=¹9•áÑ¥¥Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆì((€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹É•Á±…•=¹9•áÑ¥¥Ð€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ…¹‘¥‘…Ñ”€ô(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹œ€¬(€€€€€€€€€€€€€€€€€€€Ù…±Õ”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰…‰Í½±ÕÑ”ˆ€˜˜(€€€€€€€€€€€€€€€€€€€…¹‘¥‘…Ñ”¹±•¹Ñ €ø(€€€€€€€€€€€€€€€€€€€€€€€€Ø(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”¹Á•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€…¹‘¥‘…Ñ”ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€…¹‘¥‘…Ñ”€„ôô(€€€€€€€€€€€€€€€€€€€ÁÉ•Ù¥½ÕÍA•¹‘¥¹œ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹•Ù•É‘¥Ñ•€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Í•Ñ9Õµ‰•ÉA…‘5•É¥‘¥•´ (€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¡…¹•9Õµ‰•ÉA…‘5•É¥‘¥•´ (€€€€€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•9Õµ‰•ÉA…‘…Ñ” (€€€€€€€€€€€€€€€Ù…±Õ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹µ½‘”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰…‰Í½±ÕÑ”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐ¹•áÐ€ô(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹…Ñ”€„ôô(€€€€€€€€€€€€€€€€€€€¹•áÐ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹•Ù•É‘¥Ñ•€ô(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹…Ñ”€ô(€€€€€€€€€€€€€€€€€€€¹•áÐì((€€€€€€€€€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€ÍÝ¥Ñ¡9Õµ‰•ÉA…‘Q½Y½¥” ¤ì(€€€€€€€€€€€€€€€Ù½¥ÍÝ¥Ñ¡9Õµ‰•ÉA…‘Q½Y½¥” ¤(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½¹™¥Éµ9Õµ‰•ÉA… ¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍ¥¹…°€ô(€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹ÑÑ¥½¹M¥¹…° ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Í¥¹…°ü¹…‰½ÉÑ•ñð(€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘½¹™¥É´(€€€€€€€€€€€€€€€€€€€€€€€€¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð½µµ¥Ñ9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¥¹…°(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡Í¥¹…°ü¹…‰½ÉÑ•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ‘•ÍÑ¥¹…Ñ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½¹™¥ÉµQ…É•Ðì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€ …‘•ÍÑ¥¹…Ñ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€…Í¥¹…°ü¹…‰½ÉÑ•ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€¥˜€¡¹Õµ‰•ÉA…‘MÑ…Ñ”¤ì(€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•ÉÍ¥ÍÑ•¹”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆì((€€€€€€€€€€€€€€€€€€€€€€€É•™É•Í¡9Õµ‰•ÉA… ¤ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€ÉÕ¹9Õµ‰•ÉA…‘±•…È ¤ì(€€€€€€€€€€€€€€€•É…Í•9Õµ‰•ÉA…‘A•¹‘¥¹Y…±Õ” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÉ•ÍÕµ•9Õµ‰•ÉA…‘½¹¹•Ñ¥½¸ (€€€€€€€€€€€€€€€Í½ÕÉ”€ô€‰¹Õµ‰•ÈµÁ…ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘M•ÑÑ¥¹ÍÉ•„(€€€€€€€€€€€€€€€€€€€€€€€€¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€¹Á•ÉÍ¥ÍÑ•¹”€„ôô(€€€€€€€€€€€€€€€€€€€€€€€€‰½™™±¥¹”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…Ý…¥ÐÉ•ÍÕµ•½¹¹•Ñ¥½¹É½µ±½Õ¡ì(€€€€€€€€€€€€€€€€€€€Í½ÕÉ”(€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹9Õµ‰•ÉA…‘M•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘MÑ…Ñ”ñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹µ½‘”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰Á•É•¹Ðˆñð(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹É½±”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ™¥•±ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€˜˜(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Í½ÕÉ”€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰¹•ÜµÑÉ¥Àˆ€˜˜(€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘Y…±Õ•Y…±¥ ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€Ñ¥µ•¥¥ÑÍQ½5¥±±¥Í•½¹‘Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•¹‘¥¹œ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€9Õµ‰•È¹¥ÍM…™•%¹Ñ••È (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•5¥±±¥Í•½¹‘Ìì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÉ•ÑÕÉ¹MÑ…Ñ”€ôì(€€€€€€€€€€€€€€€€€€€€¸¸¹¹Õµ‰•ÉA…‘MÑ…Ñ”(€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€Í•ÑQÉ¥ÁM•ÑÑ¥¹ÍI•ÑÕÉ¹Q½9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¹MÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…½Á•¹QÉ¥ÁM•ÑÑ¥¹Í¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€‰¹Õµ‰•ÈµÁ…µÍ•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘ÕÉ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€À(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Ù½¥±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€€€€€¹Ñ¡•¸ (€€€€€€€€€€€€€€€€€€€€€€€±½Í•€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡±½Í•¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹Õµ‰•ÈµÁ…µÍ•ÑÑ¥¹ÌéÉ½±±‰…¬ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¹…Ñ  (€€€€€€€€€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ…¹•±9Õµ‰•ÉA…‘‘¥Ð ¤ì(€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð…¹•±9Õµ‰•ÉA… ¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍ…Ù•½Ý¹•Ñ…¥±Ì (€€€€€€€€€€€€€€€ÑÉ¥Á%°(€€€€€€€€€€€€€€€¥¹Ñ•ÉÙ…±-•ä°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€¹½Ñ•Ì€ô€ˆˆ°(€€€€€€€€€€€€€€€€€€€¥µ…”°(€€€€€€€€€€€€€€€€€€€‘•±•Ñ•%µ…”€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€ô€ôíô(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÁ…å±½…€ô(€€€€€€€€€€€€€€€€€€€¹•Ü½Éµ…Ñ„ ¤ì((€€€€€€€€€€€€€€€Á…å±½…¹Í•Ð (€€€€€€€€€€€€€€€€€€€€‰¹½Ñ•Ìˆ°(€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€¹½Ñ•Ìñð(€€€€€€€€€€€€€€€€€€€€€€€€ˆˆ(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€¡¥µ…”¤ì(€€€€€€€€€€€€€€€€€€€Á…å±½…¹Í•Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰¥µ…”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€¥µ…”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡‘•±•Ñ•%µ…”¤ì(€€€€€€€€€€€€€€€€€€€Á…å±½…¹Í•Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰‘•±•Ñ•%µ…”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€ˆÄˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€¹‘½Ý¹•Ñ…¥±ÍI•ÅÕ•ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥Á%°(€€€€€€€€€€€€€€€€€€€€€€€¥¹Ñ•ÉÙ…±-•ä°(€€€€€€€€€€€€€€€€€€€€€€€Á…å±½…(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á1½	½‘ä¹¡¥‘‘•¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð‘¥ÍÁ…Ñ¡QÉ¥Á1¥ÍÑI•ÅÕ•ÍÐ (€€€€€€€€€€€€€€€€€€€€€€€€‰‘½Ý¸µ‘•Ñ…¥±Ìˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•ÍÕµ•½¹¹•Ñ¥½¸ (€€€€€€€€€€€€€€€Í½ÕÉ”€ô€‰…ÁÀˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Ù½¥É•ÍÕµ•½¹¹•Ñ¥½¹É½µ±½Õ¡ì(€€€€€€€€€€€€€€€€€€€Í½ÕÉ”è(€€€€€€€€€€€€€€€€€€€€€€€MÑÉ¥¹œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í½ÕÉ”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰…ÁÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€ô¤¹…Ñ  (€€€€€€€€€€€€€€€€€€€€ ¤€ôøíô(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€É•±•…Í•¹‘Q¥µ•½…° ¤ì(€€€€€€€€€€€€€€€É•±•…Í•¹‘Q¥µ•½…±=Ù•ÉÉ¥‘” ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•Q¥µ•ÉQåÁ” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ½±•±½­Q¥µ•ÉQåÁ•É½µQ…À ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•Q¥µ•É5½‘” ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ½±•±½­Q¥µ•É±…ÁÍ•‘I•µ…¥¹¥¹œ ¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹QÉ¥ÁMÑ…¹‘…É‘Q¥µ•‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…ÉµÑ¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹QÉ¥ÁM¡•‘Õ±•‘MÑ…ÉÑ‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹QÉ¥ÁÑÕ…±MÑ…ÉÑ‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰…ÑÕ…°µÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€½Á•¹QÉ¥ÁÉ•…Ñ¥½¹Q¥µ•‘¥Ñ½È ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€‰É•…Ñ¥½¸µÑ¥µ”ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•M¡•‘Õ±•‘MÑ…ÉÐ (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…ÁÁ±åQÉ¥Á¥•±‘MÁ••¡Y…±Õ” (€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•ÑÕ…±MÑ…ÉÐ (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…ÁÁ±åQÉ¥Á¥•±‘MÁ••¡Y…±Õ” (€€€€€€€€€€€€€€€€€€€€‰…ÑÕ…°µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•É•…Ñ¥½¹Q¥µ” (€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸…ÁÁ±åQÉ¥Á¥•±‘MÁ••¡Y…±Õ” (€€€€€€€€€€€€€€€€€€€€‰É•…Ñ¥½¸µÑ¥µ”ˆ°(€€€€€€€€€€€€€€€€€€€ÍÁ½­•¹Q¥µ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹Œ½Á•¹QÉ¥ÁQ¥µ•‘¥Ñ½È (€€€€€€€€€€€€€€€™¥•±(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐ‰ÕÑÑ½¸€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½È (€€€€€€€€€€€€€€€€€€€€€€€€€€€m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ôˆ‘í™¥•±‘ô‰u€(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…‰ÕÑÑ½¸ñð(€€€€€€€€€€€€€€€€€€€‰ÕÑÑ½¸¹‘¥Í…‰±•(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð½Á•¹QÉ¥Á¥•±‘9Õµ‰•ÉA… (€€€€€€€€€€€€€€€€€€€€€€€™¥•±(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€…Ù½¥•¹ÑÉåMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÀµÍ•ÑÑ¥¹Ìè‘í™¥•±‘õ€°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡Ù½¥•¹ÑÉåMÑ…Ñ”¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•Y½¥•¹ÑÉä¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹•°èÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¹½¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½Ü ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁÉ…™Ðñð(€€€€€€€€€€€€€€€€€€€ÑÉ¥Á%Í1¥Ù” ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ù…±Õ•Ìì((€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ•Ì¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ¹½Ü€ô(€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ”€ô(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑQ¥µ•±¥¹•…Ñ•Q¥µ” (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Ü°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•…Ñ¥½¹…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ …Ù…±Õ”¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€½¹ÍÐ±…‰•°€ô(€€€€€€€€€€€€€€€€€€€€€€€™½Éµ…ÑQÉ¥ÁQ¥µ•=¹±ä (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•…Ñ¥½¹…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€…±…‰•°ñð(€€€€€€€€€€€€€€€€€€€€€€€±…‰•°€ôôô€ˆ´´´ˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ôì(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”°(€€€€€€€€€€€€€€€€€€€€€€€±…‰•°°(€€€€€€€€€€€€€€€€€€€€€€€Í¹…ÁÍ¡½Ðèì(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐè(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•‘MÑ…ÉÐ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÉÑQ¥µ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ”(€€€€€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€…ÑÕ…°è(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€ôì((€€€€€€€€€€€€€€€€€€€Íå¹QÉ¥ÁMÑ…ÉÑÍ9½ÝU$ ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…¹•±QÉ¥ÁMÑ…ÉÑÍ9½Ü ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ù…±Õ•Ìì((€€€€€€€€€€€€€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Í¹…ÁÍ¡½Ðì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì€˜˜(€€€€€€€€€€€€€€€€€€€Í¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•‘MÑ…ÉÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•‘MÑ…ÉÐì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…ÑÕ…°(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ”ì((€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Ü€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ð ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€Ñ½±•QÉ¥ÁMÑ…ÉÑÍ9½ÝQ…É•Ð (€€€€€€€€€€€€€€€Ñ…É•Ð(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€ü¹Ù…±Õ•Ìì((€€€€€€€€€€€€€€€½¹ÍÐÍ¹…ÁÍ¡½Ð€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€¹Í¹…ÁÍ¡½Ðì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…Ù…±Õ•Ìñð(€€€€€€€€€€€€€€€€€€€€…Í¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÍ¡•‘Õ±•€ô(€€€€€€€€€€€€€€€€€€€Ñ…É•Ð€ôôô(€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆì((€€€€€€€€€€€€€€€½¹ÍÐ­•ä€ô(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰Í¡•‘Õ±•ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€‰…ÑÕ…°ˆì((€€€€€€€€€€€€€€€½¹ÍÐÍ•±•Ñ•€ô(€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ•l(€€€€€€€€€€€€€€€€€€€€€€€­•ä(€€€€€€€€€€€€€€€€€€€tì((€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ•l(€€€€€€€€€€€€€€€€€€€­•ä(€€€€€€€€€€€€€€€t€ô(€€€€€€€€€€€€€€€€€€€Í•±•Ñ•ì((€€€€€€€€€€€€€€€¥˜€¡Í¡•‘Õ±•¤ì(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÍ¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í¡•‘Õ±•‘MÑ…ÉÐì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ù…±Õ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èÍ¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ”ì((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÉÑQ¥µ•M•ÑQ½9½Ü€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•ì(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•±•Ñ•ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•QÉ¥ÁAÉ½‘ÕÑ¥Ù” (€€€€€€€€€€€€€€€ÁÉ½‘ÕÑ¥Ù”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍ•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ñð(€€€€€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì((€€€€€€€€€€€€€€€¥˜€ …Í•ÍÍ¥½¸¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Í•ÍÍ¥½¸¹Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€¹¹½¹AÉ½‘ÕÑ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€…	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€ÁÉ½‘ÕÑ¥Ù”(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€¡…¹•QÉ¥Á•™•ÉÉ• (€€€€€€€€€€€€€€€‘•™•ÉÉ•(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€½¹ÍÐÍ•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ñð(€€€€€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…Í•ÍÍ¥½¸ñð(€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸¹±¥Ù”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÙ…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸¹Ù…±Õ•Ìì((€€€€€€€€€€€€€€€½¹ÍÐ•¹…‰±•€ô(€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€‘•™•ÉÉ•(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€¡•¹…‰±•¤ì(€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ••™•ÉÉ•‘Y…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€±½¹•QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹Í¡•‘Õ±•‘MÑ…ÉÐ€ô(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹É•…Ñ¥½¹Q¥µ”ì((€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì¹ÍÑ…ÉÑQ¥µ”€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½Ýá¥Ñ¥¹œ€ô(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ••™•ÉÉ•‘Y…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€=‰©•Ð¹…ÍÍ¥¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ì°(€€€€€€€€€€€€€€€€€€€€€€€€€€€±½¹•QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ••™•ÉÉ•‘Y…±Õ•Ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€Í•ÍÍ¥½¸(€€€€€€€€€€€€€€€€€€€€€€€€¹ÁÉ••™•ÉÉ•‘Y…±Õ•Ì€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Ù…±Õ•Ì¹‘•™•ÉÉ•€ô(€€€€€€€€€€€€€€€€€€€•¹…‰±•ì((€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€€€€€…Íå¹ŒÍ…Ù•QÉ¥ÁM•ÑÑ¥¹Ì ¤ì(€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€…ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€‰•¥¹QÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€½¹ÍÐÍÑ…ÉÑ¥¹É…™Ð€ô(€€€€€€€€€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð€˜˜(€€€€€€€€€€€€€€€€€€€€€€€€…ÑÉ¥Á%Í1¥Ù” ¤(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€……ÁÁ±åQÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸ ¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€¥˜€¡ÍÑ…ÉÑ¥¹É…™Ð¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð¹‘•™•ÉÉ•(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•±•…Í•9•ÝQÉ¥Á]½É­™±½Ü ¤ì((€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Õµ‰•ÉA…‘¥…±½œ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹½Á•¸(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•9Õµ‰•ÉA…¡ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…É‘AÉ•Á…É•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…±±½Ý¡…¹•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘•ÍÑ¥¹…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰¡½µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€€€€Õ¥I•ÑÕÉ¹MÑ…¬¹±•¹Ñ €ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€Àì((€€€€€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ìµ‘•™•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•¹‘•É•™•ÉÉ•‘QÉ¥À ¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ñ!…ÍÕÑÕÉ•MÑ…ÉÐ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁÉ…™Ð(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹ÌµÍ¡•‘Õ±•ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥µµ•‘¥…Ñ”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€€€€€Í¡½ÝM¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ ¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€……Ý…¥ÐÍÑ…ÉÑQÉ¥ÁÉ…™Ð ¤(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÍÑ½É•É…™ÑÉ½µQÉ¥ÁM•ÑÑ¥¹Í=É¥¥¹…° ¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€…Ñ ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÍÑ½É•É…™ÑÉ½µQÉ¥ÁM•ÑÑ¥¹Í=É¥¥¹…° ¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•™É•Í¡QÉ¥ÁM•ÑÑ¥¹ÍY…±Õ•Ì ¤ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸™…±Í”ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€€€€€É•Í•ÑQÉ¥ÁM•ÑÑ¥¹Í9…Ù¥…Ñ¥½¸ ¤ì((€€€€€€€€€€€€€€€€€€€±½Í•¥…±½œ (€€€€€€€€€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•…Í½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹ÌµÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€Íå¹QÉ¥ÁM•ÑÑ¥¹Í…±±•É™Ñ•ÉM…Ù” ¤ì((€€€€€€€€€€€€€€€…Ý…¥Ð±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€¹Á•ÉÍ¥ÍÑÕÉÉ•¹ÑQÉ¥À ¤ì((€€€€€€€€€€€€€€€ÑÉ¥ÁMÑ…ÉÑÍ9½ÝMÑ…Ñ”€ô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹ÍM•ÍÍ¥½¸€ô(€€€€€€€€€€€€€€€€€€€Õ¹‘•™¥¹•ì((€€€€€€€€€€€€€€€…Ý…¥Ð±½Í•QÉ¥ÁM•ÑÑ¥¹ÍQ½9…Ù¥…Ñ¥½¸ (€€€€€€€€€€€€€€€€€€€€‰ÑÉ¥ÀµÍ•ÑÑ¥¹ÌµÍ…Ù”ˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì(€€€€€€€€€€€ô°((€€€€€€€ô¤ì((€€€™½È€ (€€€€€€€½¹ÍÐ…Ñ¥½¹9…µ”½˜(€€€€€€€l(€€€€€€€€€€€€‰½Á•¹MÑ…ÉÑ5•¹Ôˆ°(€€€€€€€€€€€€‰ÁÉ•Á…É•I•…‘åÑ¥½¸ˆ°(€€€€€€€€€€€€‰ÁÉ•Á…É•MÑ…ÉÑ5•¹Ôˆ°(€€€€€€€€€€€€‰±½Í•Ñ¥Ù•MÕÉ™…”ˆ°(€€€€€€€€€€€€‰•¹‘QÉ¥Àˆ(€€€€€€€t(€€€€¤ì(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹Í•Ñ5•Ñ…‘…Ñ„ (€€€€€€€€€€€€€€€…Ñ¥½¹9…µ”°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€¥¹Ñ•ÉÉÕÁÑÉ½ÕÀè(€€€€€€€€€€€€€€€€€€€€€€€€‰ÁÉ¥µ…ÉäµÍÕÉ™…”ˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€ô((€€€™½È€ (€€€€€€€½¹ÍÐ…Ñ¥½¹9…µ”½˜(€€€€€€€l(€€€€€€€€€€€€‰¡…¹‘±•Y½¥•¹ÑÉåMÁ•• ˆ°(€€€€€€€€€€€€‰½¹™¥Éµ9Õµ‰•ÉA…ˆ°(€€€€€€€€€€€€‰…¹•±9Õµ‰•ÉA…‘‘¥Ðˆ(€€€€€€€t(€€€€¤ì(€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€¹Í•Ñ5•Ñ…‘…Ñ„ (€€€€€€€€€€€€€€€…Ñ¥½¹9…µ”°(€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€¥¹Ñ•ÉÉÕÁÑÉ½ÕÀè(€€€€€€€€€€€€€€€€€€€€€€€€‰Ù…±Õ”µ•‘¥Ñ½Èˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤ì(€€€ô((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹Í•Ñ5•Ñ…‘…Ñ„ (€€€€€€€€€€€€‰É•…‘Må¹MÑ…ÑÕÌˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Á…É…µ•Ñ•ÉÌèmt(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹Í•Ñ5•Ñ…‘…Ñ„ (€€€€€€€€€€€€‰Ñ½±•Må¹Œˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Á…É…µ•Ñ•ÉÌèl(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è€‰Íå¹MÑ…Ñ”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”è€‰¡½¥”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹…°èÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ìèl(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½¸ˆ°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰½™˜ˆ(€€€€€€€€€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€t(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹Í•Ñ5•Ñ…‘…Ñ„ (€€€€€€€€€€€€‰Ñ½±•I•¹‘•É•‘Q¥µ”ˆ°(€€€€€€€€€€€ì(€€€€€€€€€€€€€€€Á…É…µ•Ñ•ÉÌèl(€€€€€€€€€€€€€€€€€€€ì(€€€€€€€€€€€€€€€€€€€€€€€¹…µ”è€‰Ñ¥µ•5½‘”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”è€‰¡½¥”ˆ°(€€€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹…°èÑÉÕ”°(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ•Ìè(€€€€€€€€€€€€€€€€€€€€€€€€€€€I9I}Q%5}5=L(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í±¥” ¤(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€t(€€€€€€€€€€€ô(€€€€€€€€¤ì((€€€±½‰…±Q¡¥Ì(€€€€€€€€¹]5=Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€¹Í•Ñ½¹Ñ•áÑAÉ½Ù¥‘•È (€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€±•ÐÍÕµµ…Éäì(€€€€€€€€€€€€€€€±•Ð…Ñ¥Ù•%¹Ñ•ÉÙ…°ì((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éä€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑMÕµµ…ÉåM¹…ÁÍ¡½Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•%¹Ñ•ÉÙ…°€ô(€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•ÑÑ¥Ù•%¹Ñ•ÉÙ…±MÑ…Ñ”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•Ü…Ñ” ¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…Ñ íô((€€€€€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹ÑQÉ¥Àèì(€€€€€€€€€€€€€€€€€€€€€€€¥è(€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÕÉÉ•¹ÑQÉ¥Á%°(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ…ÑÕÌè(€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÑ…ÑÕÌ°(€€€€€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éäè(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÕµµ…Éäü¹ÑÉ¥À(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•%¹Ñ•ÉÙ…°è(€€€€€€€€€€€€€€€€€€€€€€€…Ñ¥Ù•%¹Ñ•ÉÙ…°ñð(€€€€€€€€€€€€€€€€€€€€€€€¹Õ±°°(€€€€€€€€€€€€€€€€€€€É•¹‘•É•‘Q¥µ”èì(€€€€€€€€€€€€€€€€€€€€€€€µ½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹É•¹‘•É•‘Q¥µ•5½‘”(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€Íå¹Œèì(€€€€€€€€€€€€€€€€€€€€€€€•¹…‰±•è(€€€€€€€€€€€€€€€€€€€€€€€€€€€•ÑMå¹½…±ÍMÑ…Ñ” ¤°(€€€€€€€€€€€€€€€€€€€€€€€½¹¹•Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•‘½¹¹•Ñ¥½¹MÑ…ÑÕÌ ¤(€€€€€€€€€€€€€€€€€€€ô°(€€€€€€€€€€€€€€€€€€€½…°èì(€€€€€€€€€€€€€€€€€€€€€€€µ½‘”è(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½Éµ…±¥é•A•É•¹Ñ5½‘” (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±½­Q¥µ•È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Á•É•¹Ñ5½‘”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€ôì(€€€€€€€€€€€ô(€€€€€€€€¤ì(((€€€™Õ¹Ñ¥½¸•¹ÍÕÉ•MÁ••¡5•¹Ô (€€€€€€€½¹Ñ…¥¹•È€ô‘½Õµ•¹Ð¹‰½‘ä°(€€€€€€€µ½‘…±5½‘”(€€€€¤ì(€€€€€€€¥˜€ (€€€€€€€€€€€µ½‘…±5½‘”€ôôô€‰Ñ½Àµ±•Ù•°ˆ(€€€€€€€€¤ì(€€€€€€€€€€€½¹ÍÐÑ½Á1•Ù•°€ô(€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% (€€€€€€€€€€€€€€€€€€€€‰ÍÁ••¡Q½Á1•Ù•±5•¹Ôˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡Ñ½Á1•Ù•°¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸Ñ½Á1•Ù•°ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÍ•±•Ñ½È€ô(€€€€€€€€€€€µ½‘…±5½‘”(€€€€€€€€€€€€€€€€üÍÁ•• µµ•¹ÕmÍÁ•• µµ½‘…°ôˆ‘íµ½‘…±5½‘•ô‰u€(€€€€€€€€€€€€€€€€è€‰ÍÁ•• µµ•¹Ôé¹½Ð¡mÍÁ•• µµ½‘…±t¤ˆì((€€€€€€€±•Ðµ•¹Ôì((€€€€€€€ÑÉäì(€€€€€€€€€€€µ•¹Ô€ô(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€¸¸¹½¹Ñ…¥¹•È¹¡¥±‘É•¸(€€€€€€€€€€€€€€€t¹™¥¹ (€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð€ôø(€€€€€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð¹µ…Ñ¡•Ìü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ½È(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤ì(€€€€€€€ô(€€€€€€€…Ñ íô((€€€€€€€¥˜€¡µ•¹Ô¤ì(€€€€€€€€€€€É•ÑÕÉ¸µ•¹Ôì(€€€€€€€ô((€€€€€€€µ•¹Ô€ô(€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€‰ÍÁ•• µµ•¹Ôˆ(€€€€€€€€€€€€¤ì((€€€€€€€µ•¹Ô¹‘…Ñ…Í•Ð¹ÍÁ••¡IÕ¹Ñ¥µ•5•¹Ô€ô(€€€€€€€€€€€€‰ÑÉÕ”ˆì((€€€€€€€¥˜€¡µ½‘…±5½‘”¤ì(€€€€€€€€€€€µ•¹Ô¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€‰ÍÁ•• µµ½‘…°ˆ°(€€€€€€€€€€€€€€€µ½‘…±5½‘”(€€€€€€€€€€€€¤ì(€€€€€€€ô((€€€€€€€½¹Ñ…¥¹•È¹…ÁÁ•¹¡µ•¹Ô¤ì(€€€€€€€É•ÑÕÉ¸µ•¹Ôì(€€€ô((€€€Ù½¥€¡…Íå¹Œ€ ¤€ôøì(€€€€€€€ÑÉäì(€€€€€€€€€€€…Ý…¥Ð•¹ÍÕÉ•MÁ••¡IÕ¹Ñ¥µ” ¤ì(€€€€€€€€€€€‰¥¹‘Y½¥•¹ÑÉåQÉ…¹ÍÉ¥ÁÑA¥Á” ¤ì(€€€€€€€ô(€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È¡•ÉÉ½È¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô((€€€€€€€½¹ÍÐ•¹±¥Í¡1…¹Õ…”€ô±½‰…±Q¡¥Ì¹]5=1…¹Õ…•Ìü¹l‰•¸µUL‰tì(€€€€€€€•¹±¥Í¡MÁ•• €ô(€€€€€€€€€€€•¹±¥Í¡1…¹Õ…”ü¹ÍÁ•• ì((€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹€ô(€€€€€€€€€€€€¡­•ä°…Ñ¥½¹9…µ”°½¹Ñ…¥¹•È€ô‘½Õµ•¹Ð¹‰½‘ä°µ½‘…°€ôÑÉÕ”°Ù…±Õ•-¥¹°Ù…±Õ•¥•±¤€ôøì(€€€€€€€€€€€½¹ÍÐÁ…ÑÑ•É¸€ô•¹±¥Í¡MÁ•• ü¹½µµ…¹‘Ìü¹m­•åtì(€€€€€€€€€€€¥˜€ …Á…ÑÑ•É¸¤É•ÑÕÉ¸ì(€€€€€€€€€€€½¹ÍÐµ½‘…±5½‘”€ô(€€€€€€€€€€€€€€€µ½‘…°€ôôôÑÉÕ”(€€€€€€€€€€€€€€€€€€€€ü€‰Ñ½Àµ±•Ù•°ˆ(€€€€€€€€€€€€€€€€€€€€èµ½‘…°€ôôô€‰‘•™…Õ±Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰‘•™…Õ±Ðˆ(€€€€€€€€€€€€€€€€€€€€€€€€èÕ¹‘•™¥¹•ì(€€€€€€€€€€€½¹ÍÐÍÁ••¡5•¹Ô€ô(€€€€€€€€€€€€€€€•¹ÍÕÉ•MÁ••¡5•¹Ô (€€€€€€€€€€€€€€€€€€€½¹Ñ…¥¹•È°(€€€€€€€€€€€€€€€€€€€µ½‘…±5½‘”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€½¹ÍÐ•‘¥Ñ½É%€ô(€€€€€€€€€€€€€€€‰Õ¥±Ñ¥¸è‘í­•åôè‘í½¹Ñ…¥¹•È¹¥ñð€‰Á…”‰õ€ì((€€€€€€€€€€€±•Ð•±•µ•¹Ð€ô(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€¸¸¹ÍÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€¹ÅÕ•ÉåM•±•Ñ½É±° (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ˆéÍ½Á”€øÍÁ•• µ½µµ…¹‘m‘…Ñ„µÍÁ•• µ•‘¥Ñ½Èµ¥‘tˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€t(€€€€€€€€€€€€€€€€€€€€¹™¥¹ (€€€€€€€€€€€€€€€€€€€€€€€…¹‘¥‘…Ñ”€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹‘¥‘…Ñ”¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡‘¥Ñ½É%€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É%(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ …•±•µ•¹Ð¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€‘½Õµ•¹Ð¹É•…Ñ•±•µ•¹Ð (€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ½µµ…¹ˆ(€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡‘¥Ñ½É%€ô(€€€€€€€€€€€€€€€€€€€•‘¥Ñ½É%ì((€€€€€€€€€€€€€€€ÍÁ••¡5•¹Ô¹…ÁÁ•¹ (€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€½¹ÍÐÍÁ••¡Q…É•ÑÌ€ôì(€€€€€€€€€€€€€€€É•…‘åÐèˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ°É•…‘äèˆ¹•ÝQÉ¥Á	ÕÑÑ½¸ˆ°(€€€€€€€€€€€€€€€‰É•…­MÑ…ÉÐèˆ‰É•…­	ÕÑÑ½¸ˆ°‘½Ý¸èˆ‘½Ý¹	ÕÑÑ½¸ˆ°‰É•…­¹èˆ‰É•…­	ÕÑÑ½¸ˆ°(€€€€€€€€€€€€€€€É•ÍÕµ”èˆ‘½Ý¹I•ÍÕµ•	ÕÑÑ½¸ˆ°(€€€€€€€€€€€€€€€¡…¹•½…°èˆ½…±A•É•¹ÑY…±Õ”ˆ°(€€€€€€€€€€€€€€€Íå¹ŒèˆÑ½±•Må¹5•¹Õ	ÕÑÑ½¸°Ñ½±•Må¹½…±	ÕÑÑ½¸ˆ°Íå¹MÑ…ÑÕÌèˆÑ½±•Må¹5•¹Õ	ÕÑÑ½¸°Ñ½±•Må¹½…±	ÕÑÑ½¸ˆ°¡½Ý1½¹œèˆÑ½±•I•¹‘•É•‘Q¥µ•	ÕÑÑ½¸ˆ°Ý¡•¸èˆÑ½±•I•¹‘•É•‘Q¥µ•	ÕÑÑ½¸ˆ°±½­¹‘Q¥µ”èˆÑ½±•I•¹‘•É•‘Q¥µ•	ÕÑÑ½¸ˆ°Í¡½ÝQÉ¥Á1½œèˆÑÉ¥Á1¥ÍÑ5•¹Õ	ÕÑÑ½¸ˆ°(€€€€€€€€€€€€€€€¡¥‘•QÉ¥Á1½œèˆÑÉ¥Á1¥ÍÑ5•¹Õ	ÕÑÑ½¸ˆ°‘•™•ÉQÉ¥ÀèˆÑÉ¥Á•™•Èˆ°É•¹‘•É•‘Q¥µ•5½‘”èˆÑ½±•I•¹‘•É•‘Q¥µ•	ÕÑÑ½¸ˆ°(€€€€€€€€€€€€€€€‰É•…­¡½¥”èˆ‰É•…­¥…±½œm‘…Ñ„µ‰É•…¬µÑåÁ•tˆ°½¹™¥É´èˆ‰É•…­¥…±½œm‘…Ñ„µ‰É•…¬µÑåÁ•tˆ°(€€€€€€€€€€€€€€€å•ÌèˆÍÁ••¡	É•…­½¹™¥Éµe•Ìˆ°¹¼èˆÍÁ••¡	É•…­½¹™¥Éµ9¼ˆ°…¹•°èˆÍÁ••¡	É•…­½¹™¥Éµ…¹•°ˆ°(€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•‘¥Ñ½ÈèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰ÍÑ…¹‘…ÉµÑ¥µ”‰tœ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ‘¥Ñ½ÈèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰Í¡•‘Õ±•µÍÑ…ÉÐ‰tœ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰Í¡•‘Õ±•µÍÑ…ÉÐ‰tœ°(€€€€€€€€€€€€€€€…ÑÕ…±MÑ…ÉÑ‘¥Ñ½ÈèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰…ÑÕ…°µÍÑ…ÉÐ‰tœ°(€€€€€€€€€€€€€€€…ÑÕ…±MÑ…ÉÐèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰…ÑÕ…°µÍÑ…ÉÐ‰tœ°(€€€€€€€€€€€€€€€É•…Ñ¥½¹Q¥µ•‘¥Ñ½ÈèœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰É•…Ñ¥½¸µÑ¥µ”‰tœ°(€€€€€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”èœÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰É•…Ñ¥½¸µÑ¥µ”‰tœ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½ÜèˆÍ¡•‘Õ±•‘MÑ…ÉÑ9½Üˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐÍÁ••¡=ÁÑ¥½¹É½ÕÁÌ€ôì(€€€€€€€€€€€€€€€ÑÉ¥Á½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€Ñ½Ñ…±½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€¡…¹•½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€É•…‘½…±5½‘”è€‰µ½‘”ˆ°(€€€€€€€€€€€€€€€½…±5½‘”è€‰µ½‘”ˆ°(€€€€€€€€€€€€€€€É•…‘I•¹‘•É•‘Q¥µ”è€‰Ñ¥µ”ˆ°(€€€€€€€€€€€€€€€É•¹‘•É•‘Q¥µ•5½‘”è€‰Ñ¥µ”ˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐÍÁ••¡%¹Ñ•¹ÑÌ€ôì(€€€€€€€€€€€€€€€½¹™¥É´è€‰½¹™¥É´ˆ°(€€€€€€€€€€€€€€€…¹•°è€‰…¹•°ˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐÍÁ••¡¡…¥¹½¹Ñ•áÑÌ€ôì(€€€€€€€€€€€€€€€‰É•…­¡½¥”è(€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µ¡½¥”ˆ°(€€€€€€€€€€€€€€€½¹™¥É´è(€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µ½¹™¥É´ˆ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Üè(€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐÍÁ••¡¡…¥¹9•áÐ€ôì(€€€€€€€€€€€€€€€É•…‘åÐè(€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ°(€€€€€€€€€€€€€€€‰É•…­MÑ…ÉÐè(€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µ¡½¥”ˆ°(€€€€€€€€€€€€€€€‰É•…­¡½¥”è(€€€€€€€€€€€€€€€€€€€€‰‰É•…¬µ½¹™¥É´ˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐÍÁ••¡=ÁÑ¥½¹…Ñ•½É¥•Ì€ôì(€€€€€€€€€€€€€€€É•…‘åÐè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€É•…‘åÑ½¹Ñ¥¹Õ…Ñ¥½¸è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€É•…‘äè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€‰É•…­MÑ…ÉÐè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€‘½Ý¸è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€‰É•…­¹è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€É•ÍÕµ”è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€ÑÉ¥Á½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€Ñ½Ñ…±½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€¡…¹•½…°è€‰½…±Ìˆ°(€€€€€€€€€€€€€€€É•…‘½…±5½‘”è€‰¥¹™½Éµ…Ñ¥½¹…°ˆ°(€€€€€€€€€€€€€€€½…±5½‘”è€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€É•…‘I•¹‘•É•‘Q¥µ”è€‰¥¹™½Éµ…Ñ¥½¹…°ˆ°(€€€€€€€€€€€€€€€Íå¹Œè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€Íå¹MÑ…ÑÕÌè€‰¥¹™½Éµ…Ñ¥½¹…°ˆ°(€€€€€€€€€€€€€€€¡½Ý1½¹œè€‰¥¹™½Éµ…Ñ¥½¹…°ˆ°(€€€€€€€€€€€€€€€Ý¡•¸è€‰¥¹™½Éµ…Ñ¥½¹…°ˆ°(€€€€€€€€€€€€€€€±½­¹‘Q¥µ”è€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€Í¡½ÝQÉ¥Á1½œè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€¡¥‘•QÉ¥Á1½œè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€‘•™•ÉQÉ¥Àè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€É•¹‘•É•‘Q¥µ•5½‘”è€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€‰É•…­¡½¥”è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€½¹™¥É´è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€å•Ìè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€¹¼è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€…¹•°è€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ°(€€€€€€€€€€€€€€€ÍÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ‘¥Ñ½Èè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÐè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€…ÑÕ…±MÑ…ÉÑ‘¥Ñ½Èè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€…ÑÕ…±MÑ…ÉÐè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€É•…Ñ¥½¹Q¥µ•‘¥Ñ½Èè€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€É•…Ñ¥½¹Q¥µ”è€‰Í•ÑÑ¥¹Ìˆ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ9½Üè€‰ÑÉ¥Àµ…Ñ¥½¹Ìˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€¥˜€¡ÍÁ••¡Q…É•ÑÍm­•åt¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡Q…É•Ð€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡Q…É•ÑÍm­•åtì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡Q…É•Ðì(€€€€€€€€€€€ô((€€€€€€€€€€€½¹ÍÐÍÁ••¡Ù…¥±…‰¥±¥Ñä€ôì(€€€€€€€€€€€€€€€É•…‘åÐè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹MÑ…ÉÑQÉ¥Àˆ°(€€€€€€€€€€€€€€€É•…‘äè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹UÍ•I•…‘äˆ°(€€€€€€€€€€€€€€€É•…‘åÑ½¹Ñ¥¹Õ…Ñ¥½¸è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹½¹Ñ¥¹Õ•MÑ…ÉÑÐˆ°(€€€€€€€€€€€€€€€‰É•…­MÑ…ÉÐè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹=Á•¹	É•…­5•¹Ôˆ°(€€€€€€€€€€€€€€€‘½Ý¸è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹MÑ…ÉÑ½Ý¹Q¥µ”ˆ°(€€€€€€€€€€€€€€€‰É•…­¹è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹=Á•¹	É•…­¹‘5•¹Ôˆ°(€€€€€€€€€€€€€€€É•ÍÕµ”è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹I•ÍÕµ•QÉ¥Àˆ°(€€€€€€€€€€€€€€€±½­¹‘Q¥µ”è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹1½­¹‘Q¥µ”ˆ°(€€€€€€€€€€€€€€€Í¡½ÝQÉ¥Á1½œè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹=Á•¹QÉ¥Á1½œˆ°(€€€€€€€€€€€€€€€¡¥‘•QÉ¥Á1½œè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹±½Í•QÉ¥Á1½œˆ°(€€€€€€€€€€€€€€€‘•™•ÉQÉ¥Àè(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹•™•ÉQÉ¥Àˆ°(€€€€€€€€€€€€€€€É•¹‘•É•‘Q¥µ•5½‘”è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹Q½±•I•¹‘•É•‘Q¥µ”ˆ°(€€€€€€€€€€€€€€€…¹•°è(€€€€€€€€€€€€€€€€€€€€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹±½Í•MÕÉ™…”ˆ(€€€€€€€€€€€ôì((€€€€€€€€€€€½¹ÍÐ…Ù…¥±…‰¥±¥Ñä€ô(€€€€€€€€€€€€€€€ÍÁ••¡Ù…¥±…‰¥±¥Ñål(€€€€€€€€€€€€€€€€€€€­•ä(€€€€€€€€€€€€€€€tñð(€€€€€€€€€€€€€€€€ (€€€€€€€€€€€€€€€€€€€ÍÁ••¡=ÁÑ¥½¹…Ñ•½É¥•Íl(€€€€€€€€€€€€€€€€€€€€€€€­•ä(€€€€€€€€€€€€€€€€€€€t€ôôô(€€€€€€€€€€€€€€€€€€€€€€€€‰¥¹™½Éµ…Ñ¥½¹…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€ü€‰]5=MÁ••¡Ù…¥±…‰¥±¥Ñä¹…¹UÍ•%¹™½Éµ…Ñ¥½¹…°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€è€ˆˆ(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€¡…Ù…¥±…‰¥±¥Ñä¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ…Ù…¥±…‰±”ˆ°(€€€€€€€€€€€€€€€€€€€…Ù…¥±…‰¥±¥Ñä(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ…Ù…¥±…‰±”ˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡ÍÁ••¡%¹Ñ•¹ÑÍm­•åt¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡%¹Ñ•¹Ð€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡%¹Ñ•¹ÑÍm­•åtì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€‘•±•Ñ”•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡%¹Ñ•¹Ðì(€€€€€€€€€€€ô(€€€€€€€€€€€¥˜€¡ÍÁ••¡=ÁÑ¥½¹É½ÕÁÍm­•åt¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡=ÁÑ¥½¹ÍÉ½ÕÀ€ô(€€€€€€€€€€€€€€€€€€€ÍÁ••¡=ÁÑ¥½¹É½ÕÁÍm­•åtì(€€€€€€€€€€€ô(€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡=ÁÑ¥½¹Í…Ñ•½Éä€ô(€€€€€€€€€€€€€€€ÍÁ••¡=ÁÑ¥½¹…Ñ•½É¥•Ím­•åtñð(€€€€€€€€€€€€€€€€‰Í•ÑÑ¥¹Ìˆì((€€€€€€€€€€€¥˜€¡ÍÁ••¡¡…¥¹½¹Ñ•áÑÍm­•åt¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ½¹Ñ•áÐˆ°(€€€€€€€€€€€€€€€€€€€ÍÁ••¡¡…¥¹½¹Ñ•áÑÍm­•åt(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ½¹Ñ•áÐˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€¥˜€¡ÍÁ••¡¡…¥¹9•áÑm­•åt¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ¹•áÐˆ°(€€€€€€€€€€€€€€€€€€€ÍÁ••¡¡…¥¹9•áÑm­•åt(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ¹•áÐˆ(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁ…ÑÑ•É¸ˆ°Á…ÑÑ•É¸¤ì(€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µ™Õ¹Ñ¥½¸ˆ°]5=Ñ¥½¹Ì¸‘í…Ñ¥½¹9…µ•õ€¤ì(€€€€€€€€€€€¥˜€¡Ù…±Õ•-¥¹€˜˜Ù…±Õ•¥•±¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œˆ°€‰]5=MÁ••¡AÉ½•ÍÍ¥¹œ¹¹½Éµ…±¥é•MÁ••¡Y…±Õ”ˆ¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œµ½¹Ñ•áÐˆ°Ù…±Õ•-¥¹¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œµ™¥•±ˆ°Ù…±Õ•¥•±¤ì(€€€€€€€€€€€ô((€€€€€€€€€€€É•ÑÕÉ¸•±•µ•¹Ðì(€€€€€€€ôì(€€€€€€€¥˜€¡•¹±¥Í¡MÁ•• ¤ì(€€€€€€€€€€€™½È€¡½¹ÍÐ•±•µ•¹Ð½˜mÍ¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É°ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰ÍÑ…¹‘…ÉµÑ¥µ”‰tœ¥t¤ì(€€€€€€€€€€€€€€€¥˜€ …•±•µ•¹Ð¤½¹Ñ¥¹Õ”ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡‘¥Ñ½É%€ô‰Õ¥±Ñ¥¸éÍÑ…¹‘…É‘Q¥µ”è‘í•±•µ•¹Ð¹¥ñð€‰ÑÉ¥ÀµÍ•ÑÑ¥¹Ì‰õ€ì((€€€€€€€€€€€€€€€¥˜€¡•±•µ•¹Ð€ôôôÍ¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…É¤ì(€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ½¹Ñ•áÐˆ°(€€€€€€€€€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•µÍÑ…ÉÐˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±Í”ì(€€€€€€€€€€€€€€€€€€€•±•µ•¹Ð¹É•µ½Ù•ÑÑÉ¥‰ÕÑ” (€€€€€€€€€€€€€€€€€€€€€€€€‰ÍÁ•• µ¡…¥¸µ½¹Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡Q…É•Ð€ô•±•µ•¹Ð¹¥€ü€Œ‘í•±•µ•¹Ð¹¥‘õ€€è€œÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œm‘…Ñ„µÑÉ¥ÀµÑ¥µ”µ™¥•±ô‰ÍÑ…¹‘…ÉµÑ¥µ”‰tœì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÍÁ••¡=ÁÑ¥½¹Í…Ñ•½Éä€ô(€€€€€€€€€€€€€€€€€€€€‰Í•ÑÑ¥¹Ìˆì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁ…ÑÑ•É¸ˆ°•¹±¥Í¡MÁ•• ¹½µµ…¹‘Ì¹ÍÑ…¹‘…É‘Q¥µ”¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µ™Õ¹Ñ¥½¸ˆ°€‰]5=Ñ¥½¹Ì¹¡…¹•MÑ…¹‘…É‘Q¥µ”ˆ¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œˆ°€‰]5=MÁ••¡AÉ½•ÍÍ¥¹œ¹¹½Éµ…±¥é•MÁ••¡Y…±Õ”ˆ¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œµ½¹Ñ•áÐˆ°€‰‘ÕÉ…Ñ¥½¸ˆ¤ì(€€€€€€€€€€€€€€€•±•µ•¹Ð¹Í•ÑÑÑÉ¥‰ÕÑ” ‰ÍÁ•• µÁÉ•ÁÉ½Œµ™¥•±ˆ°€‰Ñ¥µ•Y…±Õ”ˆ¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€™½È€¡½¹ÍÐm­•ä°™¹t½˜l(€€€€€€€€€€€€€€€l‰É•…‘åÐˆ°‰Í¡•‘Õ±•MÑ…ÉÑÐ‰t°l‰É•…‘åÑ½¹Ñ¥¹Õ…Ñ¥½¸ˆ°‰½¹Ñ¥¹Õ•MÑ…ÉÑÐ‰t°l‰É•…‘äˆ°‰ÁÉ•Á…É•I•…‘åÑ¥½¸‰t°l‰‰É•…­MÑ…ÉÐˆ°‰½Á•¹	É•…­5•¹Ô‰t°l‰‘½Ý¸ˆ°‰ÍÑ…ÉÑ½Ý¹Q¥µ”‰t°(€€€€€€€€€€€€€€€l‰‰É•…­¹ˆ°‰½Á•¹	É•…­¹‘5•¹Ô‰t°l‰É•ÍÕµ”ˆ°‰É•ÍÕµ•QÉ¥À‰t°(€€€€€€€€€€€€€€€l‰ÑÉ¥Á½…°ˆ°‰É•…‘QÉ¥Á½…°‰t°l‰Ñ½Ñ…±½…°ˆ°‰É•…‘Q½Ñ…±½…°‰t°(€€€€€€€€€€€€€€€l‰¡…¹•½…°ˆ°‰¡…¹•½…°‰t°(€€€€€€€€€€€€€€€l‰É•…‘½…±5½‘”ˆ°‰É•…‘½…±5½‘”‰t°l‰½…±5½‘”ˆ°‰¡…¹•½…±5½‘”‰t°(€€€€€€€€€€€€€€€l‰É•…‘I•¹‘•É•‘Q¥µ”ˆ°‰É•…‘I•¹‘•É•‘Q¥µ”‰t°(€€€€€€€€€€€€€€€l‰Íå¹Œˆ°‰Ñ½±•Må¹Œ‰t°l‰Íå¹MÑ…ÑÕÌˆ°‰É•…‘Må¹MÑ…ÑÕÌ‰t°l‰¡½Ý1½¹œˆ°‰É•…‘Q¥µ•I•µ…¥¹¥¹œ‰t°l‰Ý¡•¸ˆ°‰É•…‘¹‘Q¥µ”‰t°l‰±½­¹‘Q¥µ”ˆ°‰±½­¹‘Q¥µ”‰t°l‰Í¡½ÝQÉ¥Á1½œˆ°‰½Á•¹QÉ¥Á1½œ‰t°(€€€€€€€€€€€€€€€l‰¡¥‘•QÉ¥Á1½œˆ°‰±½Í•QÉ¥Á1½œ‰t°l‰‘•™•ÉQÉ¥Àˆ°‰‘•™•ÉQÉ¥À‰t°l‰É•¹‘•É•‘Q¥µ•5½‘”ˆ°‰Ñ½±•I•¹‘•É•‘Q¥µ”‰t(€€€€€€€€€€€t¤ì(€€€€€€€€€€€€€€€½¹ÍÐÑåÁ•‘Y…±Õ•Ì€ôì(€€€€€€€€€€€€€€€€€€€É•…‘åÐél‰±½¬ˆ°‰ÍÁ½­•¹Q¥µ”‰t°É•…‘åÑ½¹Ñ¥¹Õ…Ñ¥½¸él‰±½¬ˆ°‰ÍÁ½­•¹Q¥µ”‰t°(€€€€€€€€€€€€€€€€€€€¡…¹•½…°él‰Á•É•¹Ðˆ°‰Á•É•¹Ð‰t°(€€€€€€€€€€€€€€€€€€€±½­¹‘Q¥µ”él‰±½¬ˆ°‰ÍÁ½­•¹Q¥µ”‰t(€€€€€€€€€€€€€€€ôì(€€€€€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹¡­•ä°™¸°‘½Õµ•¹Ð¹‰½‘ä°ÑÉÕ”°€¸¸¸¡ÑåÁ•‘Y…±Õ•Ím­•åtñðmt¤¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ ‰‰É•…­¡½¥”ˆ°€‰¡½½Í•	É•…­QåÁ”ˆ°‰É•…­¥…±½œ°™…±Í”¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ ‰½¹™¥É´ˆ°€‰½¹™¥Éµ	É•…­QåÁ”ˆ°‰É•…­¥…±½œ°™…±Í”¤ì((€€€€€€€€€€€½¹ÍÐ•…É±åMÑ…ÉÑMÑ…¹‘…É‘‘¥Ñ½É½µµ…¹€ô(€€€€€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€€€€€‰½Á•¹M¡•‘Õ±•‘MÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥˜€ (€€€€€€€€€€€€€€€•…É±åMÑ…ÉÑMÑ…¹‘…É‘‘¥Ñ½É½µµ…¹(€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€•…É±åMÑ…ÉÑMÑ…¹‘…É‘‘¥Ñ½É½µµ…¹(€€€€€€€€€€€€€€€€€€€€¹‘…Ñ…Í•Ð(€€€€€€€€€€€€€€€€€€€€¹ÍÁ••¡Q…É•Ð€ô(€€€€€€€€€€€€€€€€€€€€ˆÍ¡•‘Õ±•‘MÑ…ÉÑMÑ…¹‘…Éˆì(€€€€€€€€€€€ô((€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•‘MÑ…ÉÑ9½Üˆ°(€€€€€€€€€€€€€€€€‰ÍÑ…ÉÑM¡•‘Õ±•‘QÉ¥Á…É±äˆ°(€€€€€€€€€€€€€€€Í¡•‘Õ±•‘MÑ…ÉÑ¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰ÍÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥ÁMÑ…¹‘…É‘Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•‘MÑ…ÉÑ‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥ÁM¡•‘Õ±•‘MÑ…ÉÑ‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰Í¡•‘Õ±•‘MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€‰¡…¹•M¡•‘Õ±•‘MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€‰±½¬ˆ°(€€€€€€€€€€€€€€€€‰ÍÁ½­•¹Q¥µ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰…ÑÕ…±MÑ…ÉÑ‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥ÁÑÕ…±MÑ…ÉÑ‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰…ÑÕ…±MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€€‰¡…¹•ÑÕ…±MÑ…ÉÐˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€‰±½¬ˆ°(€€€€€€€€€€€€€€€€‰ÍÁ½­•¹Q¥µ”ˆ(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰É•…Ñ¥½¹Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€€‰½Á•¹QÉ¥ÁÉ•…Ñ¥½¹Q¥µ•‘¥Ñ½Èˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰É•…Ñ¥½¹Q¥µ”ˆ°(€€€€€€€€€€€€€€€€‰¡…¹•É•…Ñ¥½¹Q¥µ”ˆ°(€€€€€€€€€€€€€€€ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€‰±½¬ˆ°(€€€€€€€€€€€€€€€€‰ÍÁ½­•¹Q¥µ”ˆ(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ ‰½¹™¥É´ˆ°€‰Í…Ù•QÉ¥ÁM•ÑÑ¥¹Ìˆ°ÑÉ¥ÁM•ÑÑ¥¹Í¥…±½œ°™…±Í”¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ ‰…¹•°ˆ°€‰±½Í•Ñ¥Ù•MÕÉ™…”ˆ°‘½Õµ•¹Ð¹‰½‘ä°€‰‘•™…Õ±Ðˆ¤ì(€€€€€€€€€€€¥¹ÍÑ…±±9Õµ‰•ÉA…‘MÁ••¡½µµ…¹‘Ì ¤ì(€€€€€€€€€€€¥¹ÍÑ…±±Y½¥•¹ÑÉåMÁ••¡½µµ…¹‘Ì ¤ì(€€€€€€€€€€€ÍÁ••¡5¥	…È(€€€€€€€€€€€€€€€€ü¹Í•ÑMåÍÑ•µMÁ••¡A…ÑÑ•É¹Ìü¸¡ì(€€€€€€€€€€€€€€€€€€€Ý…­”è(€€€€€€€€€€€€€€€€€€€€€€€•¹±¥Í¡MÁ•• (€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ý…­•A¡É…Í”°(€€€€€€€€€€€€€€€€€€€Í±••Àè(€€€€€€€€€€€€€€€€€€€€€€€•¹±¥Í¡MÁ•• (€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Í±••ÁA¡É…Í”°(€€€€€€€€€€€€€€€€€€€½™˜è(€€€€€€€€€€€€€€€€€€€€€€€•¹±¥Í¡MÁ•• (€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹½™™A¡É…Í”(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€MÁ••¡5•¹Ô¹É•™É•Í  ¤ì(€€€€€€€ô((€€€€€€€ÍÁ••¡I•½¹¥Ñ¥½¹1…¹Õ…•Ù…¥±…‰±”€ô(€€€€€€€€€€€	½½±•…¸ (€€€€€€€€€€€€€€€•¹±¥Í¡MÁ•• (€€€€€€€€€€€€¤ì((€€€€€€€Íå¹MÁ••¡QÉ…¥¹¥¹½¹ÑÉ½±Ì ¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÍÑ…ÉÑ•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•MÑ…ÉÑ• ¤(€€€€€€€€¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÕÑÑ•É…¹•MÑ…ÉÑ•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡UÑÑ•É…¹•MÑ…ÉÑ• ¤(€€€€€€€€¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÍÑ½ÁÁ•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•MÑ½ÁÁ• ¤(€€€€€€€€¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰ÍÁ••¡…ÁÑÕÉ•¹‘•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•MÑ½ÁÁ• ¤(€€€€€€€€¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰µÕÑ•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•5ÕÑ• (€€€€€€€€€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€ÍÁ••¡5¥	…Èü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€‰Õ¹µÕÑ•ˆ°(€€€€€€€€€€€€ ¤€ôø(€€€€€€€€€€€€€€€…Ñ¥½¹Ì(€€€€€€€€€€€€€€€€€€€€¹¡…¹‘±•MÁ••¡IÕ¹Ñ¥µ•5ÕÑ• (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€•¹±¥Í¡MÁ•• €˜˜(€€€€€€€€€€€€…±½‰…±Q¡¥Ì¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€ü¹ÍÑ…ÉÑ•(€€€€€€€€¤ì(€€€€€€€€€€€ÍÁ••¡Ñ¥Ù…Ñ¥½¹A•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€ÑÉÕ”ì(€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€ÑÉÕ”°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì(€€€€€€€€€€€Í•ÑMÁ••¡1…å½ÕÑMÑ…Ñ” (€€€€€€€€€€€€€€€ÑÉÕ”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€ÑÉäì(€€€€€€€€€€€€€€€½¹ÍÐÍÑ…ÉÑ•€ô(€€€€€€€€€€€€€€€€€€€…Ý…¥Ð±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€€€€€€€€€¹MÁ••¡5•¹Ô(€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÑ…ÉÐü¸ (€€€€€€€€€€€€€€€€€€€€€€€€€€€•¹±¥Í¡1…¹Õ…”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü¹ÍÁ••¡I•½¹¥Ñ¥½¹1…¹Õ…”ñð(€€€€€€€€€€€€€€€€€€€€€€€€€€€€‰•¸µULˆ(€€€€€€€€€€€€€€€€€€€€€€€€¤ì((€€€€€€€€€€€€€€€¥˜€ …ÍÑ…ÉÑ•¤ì(€€€€€€€€€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€Í•ÑMÁ••¡1…å½ÕÑMÑ…Ñ” (€€€€€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€ô(€€€€€€€€€€€…Ñ €¡•ÉÉ½È¤ì(€€€€€€€€€€€€€€€½¹Í½±”¹•ÉÉ½È (€€€€€€€€€€€€€€€€€€€•ÉÉ½È(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Í•ÑMÁ••¡	ÕÑÑ½¹MÑ…Ñ” (€€€€€€€€€€€€€€€€€€€™…±Í”°(€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€Í•ÑMÁ••¡1…å½ÕÑMÑ…Ñ” (€€€€€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€™¥¹…±±äì(€€€€€€€€€€€€€€€ÍÁ••¡Ñ¥Ù…Ñ¥½¹A•¹‘¥¹œ€ô(€€€€€€€€€€€€€€€€€€€™…±Í”ì(€€€€€€€€€€€ô(€€€€€€€ô((€€€€€€€½¹ÍÐÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ€ô(€€€€€€€€€€€€ ˆÍÁ••¡	É•…­½¹™¥Éµ¥…±½œˆ¤ì((€€€€€€€™½È€ (€€€€€€€€€€€½¹ÍÐl(€€€€€€€€€€€€€€€¥°(€€€€€€€€€€€€€€€…Ñ¥½¸°(€€€€€€€€€€€€€€€¹…µ”(€€€€€€€€€€€t½˜l(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€‰ÍÁ••¡	É•…­½¹™¥Éµe•Ìˆ°(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑe•Ìˆ°(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑe•Í±¥¬ˆ(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€‰ÍÁ••¡	É•…­½¹™¥Éµ9¼ˆ°(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑ9¼ˆ°(€€€€€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑ9½±¥¬ˆ(€€€€€€€€€€€€€€€t°(€€€€€€€€€€€€€€€l(€€€€€€€€€€€€€€€€€€€€‰ÍÁ••¡	É•…­½¹™¥Éµ…¹•°ˆ°(€€€€€€€€€€€€€€€€€€€€‰…¹•±	É•…­AÉ½µÁÐˆ°(€€€€€€€€€€€€€€€€€€€€‰…¹•±	É•…­AÉ½µÁÑ±¥¬ˆ(€€€€€€€€€€€€€€€t(€€€€€€€€€€€t(€€€€€€€€¤ì(€€€€€€€€€€€±½‰…±Q¡¥Ì(€€€€€€€€€€€€€€€€¹]5=%¹Ñ•É…Ñ¥½¹Õ¹Ñ¥½¹Ì(€€€€€€€€€€€€€€€€¹‰¥¹‘Ñ¥½¸¡ì(€€€€€€€€€€€€€€€€€€€•±•µ•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€ ˆŒˆ€¬¥¤°(€€€€€€€€€€€€€€€€€€€•Ù•¹Ðè(€€€€€€€€€€€€€€€€€€€€€€€€‰±¥¬ˆ°(€€€€€€€€€€€€€€€€€€€¹…µ”°(€€€€€€€€€€€€€€€€€€€…Ñ¥½¸(€€€€€€€€€€€€€€€ô¤ì(€€€€€€€ô((€€€€€€€ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ(€€€€€€€€€€€€ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È (€€€€€€€€€€€€€€€€‰±½Í”ˆ°(€€€€€€€€€€€€€€€±•…ÉMÁ••¡	É•…­AÉ½µÁÐ(€€€€€€€€€€€€¤ì((€€€€€€€¥˜€ (€€€€€€€€€€€•¹±¥Í¡MÁ•• €˜˜(€€€€€€€€€€€ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ(€€€€€€€€¤ì(€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰å•Ìˆ°(€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑe•Ìˆ°(€€€€€€€€€€€€€€€ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰¹¼ˆ°(€€€€€€€€€€€€€€€€‰½¹™¥Éµ	É•…­AÉ½µÁÑ9¼ˆ°(€€€€€€€€€€€€€€€ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€¥¹ÍÑ…±±MÁ••¡½µµ…¹ (€€€€€€€€€€€€€€€€‰…¹•°ˆ°(€€€€€€€€€€€€€€€€‰…¹•±	É•…­AÉ½µÁÐˆ°(€€€€€€€€€€€€€€€ÍÁ••¡	É•…­½¹™¥Éµ¥…±½œ°(€€€€€€€€€€€€€€€™…±Í”(€€€€€€€€€€€€¤ì((€€€€€€€€€€€MÁ••¡5•¹Ô¹É•™É•Í  ¤ì(€€€€€€€ô((€€€ô¤ ¤ì((€€€½¹ÍÐÉ…Á¡¥…±M•ÑÑ¥¹Ì€ô•ÑÉ…Á¡¥…±M•ÑÑ¥¹Ì ¤ì(€€€½¹ÍÐÑÉ¥ÁAÉ•™•É•¹•Ì€ô•ÑQÉ¥ÁAÉ•™•É•¹•Ì ¤ì(€€€…ÁÀ¹‘…Ñ…Í•Ð¹ÑÉ¥Á1¥ÍÑMÑ…Ñ”€ô€‰±½Í•ˆì(€€€ÑÉ¥Á1½	ÕÑÑ½¸ü¹Í•ÑÑÑÉ¥‰ÕÑ” ‰…É¥„µ•áÁ…¹‘•ˆ°€‰™…±Í”ˆ¤ì(€€€Í•ÑQÉ¥Á1½A¥¹¹• (€€€€€€€•ÑMÑ½É•‘QÉ¥Á1½A¥¹¹• ¤°(€€€€€€€ìÁ•ÉÍ¥ÍÐè™…±Í”ô(€€€€¤ì((€€€¥˜€ (€€€€€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÑÉ¥Á1½MÑ…ÉÑÕÀ€ôôô(€€€€€€€€€€€€‰Õ¹Á¥¹¹•ˆ(€€€€¤ì(€€€€€€€É•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€€ ¤€ôøÉ•ÅÕ•ÍÑ¹¥µ…Ñ¥½¹É…µ” (€€€€€€€€€€€€€€€€ ¤€ôøì(€€€€€€€€€€€€€€€€€€€‘•±•Ñ”‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹‘…Ñ…Í•Ð¹ÑÉ¥Á1½MÑ…ÉÑÕÀì(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€¤(€€€€€€€€¤ì(€€€ô((€€€…ÁÁ±åÉ…Á¡¥…±M•ÑÑ¥¹Ì¡É…Á¡¥…±M•ÑÑ¥¹Ì¤ì(€€€™¥±±É…Á¡¥…±½É´¡É…Á¡¥…±M•ÑÑ¥¹Ì¤ì(€€€™¥±±QÉ¥ÁAÉ•™•É•¹•Í½É´¡ÑÉ¥ÁAÉ•™•É•¹•Ì¤ì(€€€Í•ÑQÉ¥ÁAÉ½‘ÕÑ¥½¹¥±Ñ•È¡Í…™•MÑ½É…••Ð ‰Ýµ½˜¹ÑÉ¥ÁAÉ½‘ÕÑ¥½¹¥±Ñ•Èˆ¤ñð€‰…±°ˆ°í¹½Ñ¥™äé™…±Í•ô¤ì(€€€Í•ÑQÉ¥Á1½I…¹” (€€€€€€€•ÑQÉ¥Á1½I…¹” ¤°(€€€€€€€ì(€€€€€€€€€€€Á•ÉÍ¥ÍÐè™…±Í”°(€€€€€€€€€€€¹½Ñ¥™äè™…±Í”(€€€€€€€ô(€€€€¤ì(€€€±½­Q¥µ•È¹¥¹Ñ•ÉÙ…±±…ÁÍ•‘	•¡…Ù¥½È€ô€‰ÍÑ…ÉÑ1…Ñ•¹äˆì(€€€±½­Q¥µ•È¹…ÕÑ½I•ÍÑ…ÉÑQÉ¥Á™Ñ•É1…Ñ•	É•…¬€ô(€€€€€€€ÑÉ¥ÁAÉ•™•É•¹•Ì¹±…Ñ•	É•…­	•¡…Ù¥½È€ôôô€‰…ÕÑ½I•ÍÑ…ÉÑQÉ¥Àˆì(€€€±½­Q¥µ•È¹½¹™¥ÕÉ”¡ì(€€€€€€€…ÕÑ½}½…°èÑÉ¥ÁAÉ•™•É•¹•Ì¹Íå¹½…±Ì(€€€ô¤ì(€€€É•¹‘•ÉMå¹½…±ÍMÑ…Ñ” ¤ì(€€€Í•ÑMå¹¹¹½Õ¹•µ•¹Ñ	…Í•±¥¹” ¤ì(€€€…ÁÁ±åM½Á”¡Í…™•MÑ½É…••Ð¡MQ=I¹Á•É•¹Ñ5½‘”¤ñð€‰ÑÉ¥Àˆ°™…±Í”¤ì(€€€…ÁÁ±åI•¹‘•É•‘Q¥µ•5½‘”¡Í…™•MÑ½É…••Ð¡MQ=I¹É•¹‘•É•‘Q¥µ•5½‘”¤ñð€‰É•µ…¥¹¥¹œˆ°™…±Í”¤ì(€€€ÕÁ‘…Ñ•MÕµµ…ÉåY…±Õ•Ì ¤ì(€€€Íå¹9•ÑÝ½É­MÑ…ÑÕÍU$¡ìÍÑ…ÉÑÕÀèÑÉÕ”ô¤ì(€€€Ù½¥€¡…Íå¹Œ€ ¤€ôøì(€€€€€€€ÑÉäì(€€€€€€€€€€€½¹ÍÐÉ•ÍÁ½¹Í”€ô…Ý…¥Ð™•Ñ ¡¹•ÜUI0 ‰…Á¤½…±•¹‘…È¼ýÉ•ÍÕ±ÐõÉ•½É‘Ìˆ°A%}	M¤°íÉ•‘•¹Ñ¥…±Ìè‰Í…µ”µ½É¥¥¸ˆ°¡•…‘•ÉÌéí•ÁÐè‰…ÁÁ±¥…Ñ¥½¸½©Í½¸‰õô¤ì(€€€€€€€€€€€½¹ÍÐ‘…Ñ„€ô…Ý…¥ÐÉ•ÍÁ½¹Í”¹©Í½¸ ¤ì(€€€€€€€€€€€¥˜€ …É•ÍÁ½¹Í”¹½¬¤Ñ¡É½Ü¹•ÜÉÉ½È¡‘…Ñ„¹µ•ÍÍ…”ñð€‰…±•¹‘…È±½½­ÕÀ™…¥±•¸ˆ¤ì(€€€€€€€€€€€…±•¹‘…ÉI…¹•Ì¹Í•Ñ…Ñ…‰…Í•I•½É‘Ì¡‘…Ñ„¹…±•¹‘…ÉÌ¤ì(€€€€€€€€€€€É•™É•Í¡QÉ¥Á1½M•±•Ñ¥½¸ ¤ì(€€€€€€€ô…Ñ €¡•ÉÉ½È¤ìÍ¡½ÝQÉ¥ÁI…¹•ÉÉ½È¡•ÉÉ½È¹µ•ÍÍ…”ñð€‰…±•¹‘…È±½½­ÕÀ™…¥±•¸ˆ¤ìô(€€€ô¤ ¤ì)ô¤ ¤ì(