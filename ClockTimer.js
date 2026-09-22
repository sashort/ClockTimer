(() => {
    class ClockTimerUIState {
        constructor(values = {}) {
            Object.assign(this, values);
            Object.freeze(this);
        }
    }

    class ClockTimer extends HTMLElement {
        static observedAttributes = [
            "trip-goal",
            "total-goal",
            "percent-mode",
            "timer-type",
            "timer-mode",
            "military-time",
            "time-format",
            "date-format",
            "visible-hours",
            "tick-marks",
            "indicator-symbol",
            "grayscale",
            "grayscale-ramp"
        ];

        static #HOUR =
            60 * 60 * 1000;

        static #DAY =
            24 * ClockTimer.#HOUR;

        static #REFERENCE_DIAMETER =
            320;

        static #BASE_METRICS =
            Object.freeze({
                activeRingWidth: 12,
                inactiveRingWidth: 6,
                borderWidth: 5,
                hourFontSize: 24,
                timeFontSize: 48,
                hourHandWidth: 5,
                minuteHandWidth: 4,
                secondHandWidth: 2,
                indicatorSymbolSize: 12,
                tickInset: 6.4,
                tickWidth: 1.12,
                tickLength: 5.12,
                majorTickWidth: 1.76,
                majorTickLength: 9.6,
                numberInset: 9.6
            });

        #shadowRoot;

        #clockFace;

        #ringLayer;

        #faceBackground;

        #faceBackgroundFrame;

        #hostTransparencyStyle;

        #hostBackgroundOverride =
            false;

        #hostBackgroundInlineValue =
            "";

        #hostBackgroundInlinePriority =
            "";

        #timeElement;

        #timeOutlineSignature;

        #dateElement;

        #hourLayer;

        #numberRing;

        #tickRing;

        #tickGeometryFrame;

        #tickMarkLayer;

        #indicatorRing;

        #indicatorTrack;

        #indicatorSymbol;

        #indicatorFrame;

        #indicatorStartFrame;

        #indicatorHandoffFrozen =
            false;

        #indicatorHandoffTimeout;

        #ringLayerHandoffTimeout;

        #tickMarkTimeout;

        #handLayer;

        #handRing;

        #hourHand;

        #minuteHand;

        #secondHand;

        #secondHandAngle;

        #secondHandTickAnimation;

        #handStartTimeout;

        #hoursRenderFrame;

        #responsiveMetricsFrame;

        #sizeObserver;

        #handsStarted =
            false;

        #displayTimeout;

        #tickTimeout;

        #creationTime;

        #creationMilliseconds;

        #tripId;

        #preparedTrip;

        #pendingTripEvents =
            [];

        #completedTripQueue = [];
        #syncUserId;
        #completedTripsRestored = false;
        #completedTripSyncPromise;

        #replayingTripEvents =
            false;

        #connectionState =
            "offline";

        #csrfToken;

        #apiBase =
            "api";

        #scheduledStart;

        #scheduledStartMilliseconds;

        #standardTime;

        #standardDuration;

        #originalStartArguments;

        #renderedPercentGoal =
            1;

        #percentMode =
            "auto";

        #renderedTimeMode =
            "remaining";

        #renderedTime;

        #renderedPercentGoalSourceOverride;

        #percentModeChangeContext;

        #semanticGoalSetSource;

        #aggregateReconnectPending =
            false;

        #aggregateReconnectSnapshot;

        #tripTotals;

        #externalStandardTime;

        #externalCountedTime;

        #uiState;

        #uiStateName = "ready";

        #uiPreviousState = null;

        #uiStateEnteredAt = new Date();

        #uiTransitionId = 0;

        #uiTransitionStartedAt = new Date();

        #configuring = false;

        #totalGoalNotPossibleState =
            false;

        #tripAddedToAggregate =
            false;

        #nonProduction =
            false;

        #nonProductionFilter =
            "none";

        #productionFilter;

        #autoSyncTripGoal =
            false;

        #matchedTripGoal;

        #tripGoalMissedState =
            false;

        #totalGoalMissedState =
            false;

        #eventsReady =
            false;

        #showTolerance =
            true;

        #intervalElapsedBehavior =
            "startLatency";

        #keepAspectRatio =
            true;

        #autoRestartTripAfterLateBreak =
            false;

        #toleranceTransitionState;

        #startedAtEpoch;

        #creationDateOverride;

        #ringAnchor;

        #rings =
            new Map();

        #borderRing;

        #overtimeRanges =
            new Map();

        #remainingRanges =
            new Map();

        #timerModeTransitionAnimations =
            new Set();

        #timeRangeTimingAnimations =
            new Map();

        #timerModeTransitionToken =
            0;

        #timerType =
            "radial-overflow";

        #timerTypeTransitionToken =
            0;

        #timerTypeTransitioning =
            false;

        #timerTypeTransitionBuilding =
            false;

        #timerTypeTransitionState;

        #timerTypeIndicatorFrozen =
            false;

        #waveRing;

        #waveRange;

        #waveResumeTimeout;

        #waveResumeToken =
            0;

        #waveSuppressed =
            false;

        #stateChangeVisualState;

        #stateChangeWaveRing;

        #stateChangeWaveRange;

        #stateChangeWaveTimeout;

        #elapsedRange;

        #tripEnd;

        #standardEnd;

        #calculatedEnd;

        #calculatedEndTime;

        #toleranceEnd;

        #started =
            false;

        #tickAlignmentMilliseconds;

        #insertedRanges =
            [];

        #openEndedRange;

        #openEndedLastTick;

        #overwriteRanges =
            [];

        #openOverwriteRange;

        #openOverwriteLastTick;

        #pendingIntervalRecord;

        #preserveInsertedOnClear =
            false;

        #starting =
            false;

        #spinAnimation;

        #spinScaleAnimation;

        #spinFrozenTimeFontSize;

        #spinPreviousTimeInlineFontSize;

        #spinPreviousTimeInlineFontPriority;

        #grayscaleAnimation;

        constructor() {
            super();

            this.#shadowRoot =
                this.attachShadow({
                    mode: "closed"
                });

            const style =
                document.createElement(
                    "style"
                );

            style.textContent = `
                @property --clock-timer-spin-duration {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 750ms;
                }

                @property --clock-timer-spin-scale-speed {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 125ms;
                }

                @property --clock-timer-spin-scale-factor {
                    syntax: "<number>";
                    inherits: true;
                    initial-value: 0.95;
                }

                @property --clock-timer-grayscale {
                    syntax: "<percentage>";
                    inherits: true;
                    initial-value: 100%;
                }

                @property --clock-timer-grayscale-ramp {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 333ms;
                }

                :host {

                    --clock-timer-tick-inset:
                        clamp(5px, 2cqi, 10px);

                    --clock-timer-tick-width:
                        clamp(1px, 0.35cqi, 1.5px);

                    --clock-timer-tick-length:
                        clamp(4px, 1.6cqi, 7px);

                    --clock-timer-major-tick-width:
                        clamp(1.5px, 0.55cqi, 2.5px);

                    --clock-timer-major-tick-length:
                        clamp(8px, 3cqi, 13px);

                    --clock-timer-tick-color:
                        currentColor;

                    --clock-timer-tick-shadow:
                        0 0 1px rgb(0 0 0 / 35%);

                    --clock-timer-ring-resize-duration:
                        333ms;

                    position: relative;

                    display: block;

                    inline-size:
                        min(100cqw, 100cqh);

                    block-size:
                        min(100cqw, 100cqh);

                    aspect-ratio:
                        1 / 1;

                    place-self:
                        center;

                    margin:
                        auto;

                    box-sizing:
                        border-box;

                    padding:
                        2px;

                    overflow:
                        hidden;

                    isolation:
                        isolate;

                    perspective:
                        var(--clock-timer-spin-perspective, 800px);

                    container-type:
                        size;

                    clip-path:
                        ellipse(
                            50% 50%
                            at
                            50% 50%
                        );
                }

                :host([data-clock-timer-free-aspect-ratio]) {
                    inline-size: 100%;
                    block-size: 100%;
                    aspect-ratio: auto;
                    margin: 0;
                }

                #clock-face {
                    position: absolute;

                    transform-style: preserve-3d;

                    inset: 0;

                    width: 100%;
                    height: 100%;

                    isolation:
                        isolate;

                    pointer-events:
                        none;
                }

                #face-background {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    z-index: -1;
                    pointer-events: none;
                }

                #rings {
                    position: absolute;

                    inset: 0;

                    width: 100%;
                    height: 100%;

                    z-index: 0;

                    isolation:
                        isolate;

                    pointer-events:
                        none;
                }

                ::slotted(ring-container) {
                    position: absolute;

                    display: block;

                    box-sizing:
                        border-box;

                    background:
                        transparent !important;

                    pointer-events:
                        none;
                }

                #tick-marks,
                #hand-layer,
                #indicator-ring {
                    transition-property:
                        inset;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        );

                    transition-timing-function:
                        linear;
                }

                :host([hide-hour-hand]) .hour-hand,
                :host([hide-minute-hand]) .minute-hand,
                :host([hide-second-hand]) .second-hand {
                    display: none !important;
                }

                #hand-layer {
                    opacity: 0;

                    transition-property:
                        inset, opacity;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        ),
                        1500ms;

                    transition-timing-function:
                        linear, linear;
                }

                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

                    opacity: 0;

                    transition-property:
                        inset, opacity;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        ),
                        1500ms;

                    transition-timing-function:
                        linear, linear;

                    pointer-events:
                        none;
                }

                .tick-mark-track {
                    position: absolute;

                    inset: 0;

                    transform:
                        rotate(
                            var(--clock-timer-tick-angle)
                        );

                    transform-origin:
                        50% 50%;

                    pointer-events:
                        none;
                }

                .tick-mark {
                    position: absolute;

                    top: 0;
                    left: 50%;

                    width:
                        var(
                            --clock-timer-tick-width
                        );

                    height:
                        var(
                            --clock-timer-tick-length
                        );

                    border-radius:
                        clamp(0px, 0.15cqi, 1px);

                    background:
                        var(
                            --clock-timer-tick-color
                        );

                    box-shadow:
                        var(
                            --clock-timer-tick-shadow
                        );

                    transform:
                        translateX(-50%);

                    transform-origin:
                        50% 0;

                    pointer-events:
                        none;
                }

                .tick-mark.major {
                    width:
                        var(
                            --clock-timer-major-tick-width
                        );

                    height:
                        var(
                            --clock-timer-major-tick-length
                        );
                }

                #indicator-ring {
                    position: absolute;
                    inset: 0;
                    z-index: 25;
                    pointer-events: none;
                    opacity: 0;
                    transition-property: opacity;
                    transition-duration: var(--clock-timer-ring-resize-duration);
                    transition-timing-function: linear;
                }

                #indicator-track {
                    position: absolute;
                    inset: 0;
                    transform: rotate(0deg);
                    transform-origin: 50% 50%;
                    pointer-events: none;
                }

                #indicator-symbol {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    display: block;
                    width: max-content;
                    height: max-content;
                    line-height: 1;
                    font-size: var(--clock-timer-indicator-symbol-size, 12px);
                    color: var(--clock-timer-indicator-symbol-color, white);
                    text-shadow: var(--clock-timer-indicator-symbol-shadow, 0 0 2px rgb(0 0 0 / 50%));
                    transform: translateX(-50%);
                    transform-origin: 50% 50%;
                    pointer-events: none;
                }

                #indicator-symbol::before {
                    content: none;
                }

                #time-layer {
                    position: absolute;

                    inset: 0;

                    display: grid;

                    place-items:
                        center;

                    z-index: 100;

                    pointer-events:
                        none;
                }

                #date[hidden] {
                    display: none !important;
                }

                #date,
                #time {
                    display:
                        inline-block;

                    box-sizing:
                        border-box;

                    width:
                        fit-content;

                    height:
                        fit-content;

                    max-width:
                        100%;

                    max-height:
                        100%;

                    place-self:
                        center;

                    background:
                        transparent;

                    line-height: 1;

                    white-space:
                        nowrap;

                    pointer-events:
                        none;
                }

                #date {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform:
                        translate(
                            -50%,
                            calc(
                                -50% -
                                var(
                                    --clock-timer-auto-date-offset,
                                    2rem
                                )
                            )
                        );
                    text-align: center;
                    font-family:
                        var(
                            --clock-timer-date-font,
                            var(
                                --clock-timer-time-font,
                                inherit
                            )
                        );
                    font-size:
                        var(
                            --clock-timer-date-font-size,
                            var(
                                --clock-timer-auto-date-font-size,
                                0.75rem
                            )
                        );
                }

                #time {
                    font-family:
                        var(
                            --clock-timer-time-font,
                            inherit
                        );

                    font-size:
                        var(
                            --clock-timer-time-font-size,
                            var(
                                --clock-timer-auto-time-font-size,
                                1rem
                            )
                        );

                    color:
                        var(
                            --clock-timer-time-color,
                            currentColor
                        );

                    -webkit-text-stroke:
                        var(
                            --clock-timer-time-outline-width,
                            0px
                        )
                        var(
                            --clock-timer-time-outline-color,
                            transparent
                        );

                    text-shadow:
                        var(
                            --clock-timer-time-outline-shadow,
                            none
                        );
                }
            `;

            this.#hostTransparencyStyle =
                document.createElement(
                    "style"
                );

            this.#hostTransparencyStyle.textContent =
                `:host { background-color: transparent !important; }`;

            const clockFace =
                document.createElement(
                    "div"
                );

            this.#clockFace =
                clockFace;

            clockFace.id =
                "clock-face";

            this.#faceBackground =
                document.createElement(
                    "div"
                );

            this.#faceBackground.id =
                "face-background";

            const ringLayer =
                document.createElement(
                    "div"
                );

            this.#ringLayer =
                ringLayer;

            ringLayer.id =
                "rings";

            const ringSlot =
                document.createElement(
                    "slot"
                );

            ringLayer.appendChild(
                ringSlot
            );

            this.#tickMarkLayer =
                document.createElement(
                    "div"
                );

            this.#tickMarkLayer.id =
                "tick-marks";

            this.#tickMarkLayer.setAttribute(
                "part",
                "tick-marks"
            );

            this.#indicatorRing =
                document.createElement(
                    "div"
                );

            this.#indicatorRing.id =
                "indicator-ring";

            this.#indicatorTrack =
                document.createElement(
                    "div"
                );

            this.#indicatorTrack.id =
                "indicator-track";

            this.#indicatorSymbol =
                document.createElement(
                    "span"
                );

            this.#indicatorSymbol.id =
                "indicator-symbol";

            this.#indicatorSymbol.setAttribute(
                "part",
                "indicator-symbol"
            );

            this.#syncIndicatorSymbolContent();

            this.#indicatorTrack.appendChild(
                this.#indicatorSymbol
            );

            this.#indicatorRing.appendChild(
                this.#indicatorTrack
            );

            const timeLayer =
                document.createElement(
                    "div"
                );

            timeLayer.id =
                "time-layer";

            this.#dateElement =
                document.createElement(
                    "div"
                );

            this.#dateElement.id =
                "date";

            this.#dateElement.hidden =
                !this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.setAttribute(
                "part",
                "date"
            );

            this.#timeElement =
                document.createElement(
                    "div"
                );

            this.#timeElement.id =
                "time";

            this.#timeElement.setAttribute(
                "part",
                "time"
            );

            timeLayer.append(
                this.#dateElement,
                this.#timeElement
            );

            this.#handLayer =
                document.createElement(
                    "div"
                );

            this.#handLayer.id =
                "hand-layer";

            this.#handLayer.clockTimerHandLayer =
                "";

            this.#handLayer.style.position =
                "absolute";

            this.#handLayer.style.inset =
                "0";

            this.#handLayer.style.width =
                "100%";

            this.#handLayer.style.height =
                "100%";

            this.#handLayer.style.boxSizing =
                "border-box";

            this.#handLayer.style.pointerEvents =
                "none";

            this.#handLayer.style.overflow =
                "visible";

            this.#handLayer.style.zIndex =
                "30";

            this.#hourHand =
                this.#createHand(
                    "hour"
                );

            this.#minuteHand =
                this.#createHand(
                    "minute"
                );

            this.#secondHand =
                this.#createHand(
                    "second"
                );

            this.#handLayer.append(
                this.#hourHand,
                this.#minuteHand,
                this.#secondHand
            );

            clockFace.append(
                this.#faceBackground,
                ringLayer,
                this.#tickMarkLayer,
                this.#indicatorRing,
                this.#handLayer,
                timeLayer
            );

            this.#shadowRoot.append(
                style,
                this.#hostTransparencyStyle,
                clockFace
            );
        }

        #getTimingDetail(actualTime, scheduledTime) {
            if (
                !Number.isFinite(actualTime) ||
                !Number.isFinite(scheduledTime)
            ) {
                return {
                    timing: "unscheduled",
                    early: false,
                    late: false,
                    onTime: false,
                    timeDifferenceMilliseconds: null
                };
            }

            const difference =
                actualTime - scheduledTime;

            return {
                timing:
                    difference < 0
                        ? "early"
                        : difference > 0
                            ? "late"
                            : "on-time",
                early: difference < 0,
                late: difference > 0,
                onTime: difference === 0,
                timeDifferenceMilliseconds:
                    Math.abs(difference)
            };
        }

        #getSemanticIntervalEventName(type, phase) {
            const normalized =
                String(type ?? "")
                    .trim()
                    .toLowerCase();

            if (phase === "started") {
                if (normalized === "break" || normalized === "lunch") {
                    return "breakStarted";
                }

                if (normalized === "down") {
                    return "downTimeStarted";
                }
            }

            if (phase === "ended" && normalized === "down") {
                return "tripResumed";
            }

            return undefined;
        }

        #getSemanticIntervalDetail(record, detail = {}) {
            const attributes =
                record?.otherAttributes &&
                typeof record.otherAttributes === "object"
                    ? { ...record.otherAttributes }
                    : {};

            const intervalType =
                String(record?.type ?? "")
                    .trim()
                    .toLowerCase();

            let breakType;
            for (const [name, value] of Object.entries(attributes)) {
                if (name.toLowerCase() === "breaktype") {
                    breakType = value;
                    break;
                }
            }

            if (breakType === undefined) {
                if (intervalType === "lunch") {
                    breakType = "lunch";
                }
                else if (intervalType === "break") {
                    breakType = "break";
                }
            }

            return {
                ...detail,
                intervalType: record?.type,
                breakType:
                    breakType === undefined
                        ? undefined
                        : String(breakType),
                isLunch:
                    intervalType === "lunch",
                attributes
            };
        }

        #emitSemanticIntervalStarted(record, detail = {}) {
            const eventName =
                this.#getSemanticIntervalEventName(
                    record?.type,
                    "started"
                );

            if (!eventName) {
                return true;
            }

            return this.#emitClockTimerEvent(
                eventName,
                this.#getSemanticIntervalDetail(
                    record,
                    detail
                )
            );
        }

        #emitSemanticIntervalEnded(
            record,
            detail = {},
            {
                automaticRestart = false,
                actualEnd,
                boundary
            } = {}
        ) {
            const intervalType =
                String(record?.type ?? "")
                    .trim()
                    .toLowerCase();

            if (intervalType === "break" || intervalType === "lunch") {
                const deadline =
                    Number.isFinite(boundary)
                        ? boundary
                        : this.#getPendingIntervalElapsedBoundary(
                            record
                        );

                let eventName;
                let completion;

                if (automaticRestart) {
                    eventName =
                        "breakEndedAutomatically";
                    completion =
                        "automatic";
                }
                else if (
                    Number.isFinite(actualEnd) &&
                    Number.isFinite(deadline) &&
                    actualEnd > deadline
                ) {
                    eventName =
                        "breakEndedLate";
                    completion =
                        "late";
                }
                else {
                    eventName =
                        "breakEndedEarly";
                    completion =
                        "early";
                }

                return this.#emitClockTimerEvent(
                    eventName,
                    this.#getSemanticIntervalDetail(
                        record,
                        {
                            ...detail,
                            completion,
                            automaticRestart,
                            endBufferEndTime:
                                this.#timelineToISO(
                                    deadline
                                )
                        }
                    )
                );
            }

            if (intervalType === "down") {
                const semanticDetail =
                    this.#getSemanticIntervalDetail(
                        record,
                        {
                            ...detail,
                            resumedFrom: "down"
                        }
                    );

                // Compatibility event retained for lower-level observers.
                this.#emitClockTimerEvent(
                    "downTimeEnded",
                    semanticDetail
                );

                return this.#emitClockTimerEvent(
                    "tripResumed",
                    semanticDetail
                );
            }

            return true;
        }

        #emitClockTimerEvent(name, detail = {}, { cancelable = false } = {}) {
            if (!this.#eventsReady) {
                return true;
            }

            const result = this.dispatchEvent(new CustomEvent(name, {
                detail: {
                    ...detail,
                    connected: this.#connectionState === "connected",
                    networkStatus: this.networkStatus
                },
                bubbles: true,
                composed: true,
                cancelable
            }));

            if (!this.#configuring && name !== "uiStateChanged") {
                this.#emitUIState(name, detail?.summary);
            }

            return result;
        }

        #transitionName(eventName) {
            const names = {
                cadenceTick: "tick",
                started: "trip_started",
                tripStarted: "trip_started",
                tripStartedEarly: "trip_started_early",
                tripStartedLate: "trip_started_late",
                tripResumed: "trip_resumed",
                activeTripRestored: "active_trip_restored",
                breakStarted: "break_started",
                breakEndedEarly: "break_ended",
                breakEndedAutomatically: "break_ended",
                breakEndedLate: "break_ended",
                downTimeStarted: "down_started",
                intervalStarted: "interval_started",
                intervalEnded: "interval_ended",
                cleared: "trip_ended",
                prepared: "trip_deferred",
                percentModeChanged: "configured",
                renderedTimeModeChanged: "configured",
                goalChanged: "configured"
            };
            return names[eventName] || eventName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
        }

        #currentUIStateName(now = new Date()) {
            const interval = this.getActiveIntervalState?.(now);
            const type = String(interval?.intervalType || "").trim().toLowerCase();
            if (["break", "lunch", "down", "buffer"].includes(type)) return type;
            if (this.#hasStartProperties()) return this.#started ? "running" : "deferred";
            if (this.#preparedTrip) return "deferred";
            return "ready";
        }

        #component(text, value, date = null, available = true) {
            return Object.freeze({
                text: available && typeof text === "string" && text ? text : "---",
                value: available && Number.isFinite(value) ? value : null,
                date: available && date instanceof Date && !Number.isNaN(date.getTime())
                    ? new Date(date.getTime())
                    : null,
                available: Boolean(available)
            });
        }

        #renderedTimeType() {
            return this.#renderedTimeMode === "elapsed"
                ? "calculated_start_time"
                : this.#renderedTimeMode === "calculated-end"
                    ? "calculated_end_time"
                    : "time_remaining";
        }

        #renderedDate(text, now) {
            if (this.#renderedTimeMode !== "calculated-end" || typeof text !== "string") return null;
            const match = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
            if (!match) return null;
            const date = new Date(now.getTime());
            date.setHours(Number(match[1]), Number(match[2]), Number(match[3]), 0);
            if (date.getTime() < now.getTime() - 1000) date.setDate(date.getDate() + 1);
            return date;
        }

        #renderedTimeValue(text, selected, date) {
            if (date instanceof Date) return date.getTime();
            if (this.#renderedTimeMode === "elapsed") {
                return Number(selected?.countedTimeElapsedMilliseconds);
            }
            if (typeof text !== "string") return NaN;
            const normalized = text.replace(/[⁺⁻]$/u, "");
            const match = normalized.match(/^(-)?(?:(\d+):)?(\d{1,2}):(\d{2})$/);
            if (!match) return NaN;
            const value = ((Number(match[2] || 0) * 60 + Number(match[3])) * 60 + Number(match[4])) * 1000;
            return match[1] ? -value : value;
        }

        #actionClock(milliseconds) {
            const numeric = Number(milliseconds);
            const negative = Number.isFinite(numeric) && numeric < 0;
            const seconds = Math.floor(Math.abs(numeric) / 1000) || 0;
            return `${negative ? "-" : ""}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        }

        getUIState(now = new Date(), options = {}) {
            const summary = options.summary?.selected ? options.summary : this.#buildSummarySnapshot(now);
            const state = this.#currentUIStateName(now);
            const scope = summary.scope || (this.#percentMode === "total" ? "total" : "trip");
            const selected = scope === "total" ? summary.total : scope === "trip" ? summary.trip : summary.selected;
            const scopeLabel = scope === "total" ? "Total" : "Trip";
            const suffix = this.#renderedTimeMode === "elapsed"
                ? "Time Elapsed"
                : this.#renderedTimeMode === "calculated-end"
                    ? "End Time"
                    : "Time Remaining";
            const interval = this.getActiveIntervalState?.(now);
            const standardText = selected?.standardTime;
            const rawRenderedText = selected?.renderedTime;
            const renderedText =
                typeof rawRenderedText === "string" &&
                (this.#renderedTimeMode === "remaining" || this.#renderedTimeMode === "elapsed") &&
                interval?.open === false
                    ? `${rawRenderedText}${this.#renderedTimeMode === "remaining" ? "⁺" : "⁻"}`
                    : rawRenderedText;
            const renderedDate = this.#renderedDate(renderedText, now);
            const countedPercent = Number(selected?.countedPercent);
            const ordinaryGoal = scope === "standard"
                ? Number(this.#getTripGoal())
                : Number(selected?.percentGoal);
            const goal = this.#percentMode === "auto" && this.#autoSyncTripGoal
                ? Number(this.#renderedPercentGoal)
                : ordinaryGoal;
            const intervalType = String(interval?.intervalType || "").trim().toLowerCase();
            const tripActive = this.#hasStartProperties();
            const creationDate = this.#getJSONCreationDate();
            const startMilliseconds = this.#getStartTimeMilliseconds();
            const tripStartDate = creationDate instanceof Date && Number.isFinite(startMilliseconds)
                ? new Date(creationDate.getTime() + startMilliseconds)
                : null;
            const timedPause = intervalType === "break" || intervalType === "lunch";
            const downPause = intervalType === "down";
            const normalActions = !timedPause && !downPause;
            const primaryAction = intervalType === "down"
                ? {action: "resume_trip", text: `Resume Trip : ${this.#actionClock(interval?.elapsedMilliseconds)}`, visible: true, enabled: true}
                : intervalType === "break" || intervalType === "lunch"
                    ? {action: "end_interval", text: `End ${intervalType === "lunch" ? "Lunch" : "Break"} : ${this.#actionClock(interval?.remainingMilliseconds)}`, visible: true, enabled: true}
                    : {action: "end_trip", text: "End Trip", visible: tripActive, enabled: tripActive};
            const availableActions = Object.freeze({
                start_trip: !tripActive,
                end_trip: tripActive && normalActions,
                resume_trip: downPause,
                end_interval: timedPause,
                start_break: tripActive && !timedPause,
                start_down: tripActive && normalActions,
                edit_trip: tripActive
            });
            const controls = Object.freeze({
                active_trip_visible: tripActive,
                trip_action_row_visible: tripActive && normalActions,
                break_visible: tripActive && normalActions,
                down_visible: tripActive && normalActions,
                primary_action: Object.freeze(primaryAction)
            });
            const values = {
                state,
                state_class: `clock-timer-state-${state}`,
                previous_state: options.previousState ?? this.#uiPreviousState,
                transition: options.transition || "snapshot",
                transition_phase: options.phase || "settled",
                transition_id: options.transitionId ?? this.#uiTransitionId,
                state_entered_at: new Date(this.#uiStateEnteredAt.getTime()),
                transition_started_at: new Date(this.#uiTransitionStartedAt.getTime()),
                transition_ended_at: options.phase === "active" ? null : new Date(now.getTime()),
                changed_fields: Object.freeze([...(options.changedFields || [])]),
                timestamp: new Date(now.getTime()),
                rendered_time_type: this.#renderedTimeType(),
                goal_type: this.#percentMode,
                effective_goal_type: scope,
                auto_goal_active: this.#percentMode === "auto" && this.#autoSyncTripGoal,
                standard_time_header_text: `${scopeLabel} Standard Time`,
                standard_time_component: this.#component(
                    standardText,
                    Number(selected?.standardTimeMilliseconds),
                    null,
                    typeof standardText === "string" && Boolean(standardText)
                ),
                time_header_text: scope === "standard" ? `Standard ${suffix}` : `${scopeLabel} ${suffix}`,
                time_header_short_text: scope === "standard" ? `Std. ${suffix}` : null,
                time_component: this.#component(
                    renderedText,
                    this.#renderedTimeValue(renderedText, selected, renderedDate),
                    renderedDate,
                    typeof renderedText === "string" && Boolean(renderedText)
                ),
                current_percent_component: this.#component(
                    Number.isFinite(countedPercent) ? `${Math.round(countedPercent * 100)}%` : undefined,
                    countedPercent,
                    null,
                    Number.isFinite(countedPercent)
                ),
                goal_component: this.#component(
                    Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : undefined,
                    goal,
                    null,
                    Number.isFinite(goal) && goal > 0
                ),
                trip_goal_component: this.#component(
                    `${Math.round(this.#getTripGoal() * 100)}%`, this.#getTripGoal(), null,
                    Number.isFinite(this.#getTripGoal()) && this.#getTripGoal() > 0
                ),
                total_goal_component: this.#component(
                    `${Math.round(this.#getTotalGoal() * 100)}%`, this.#getTotalGoal(), null,
                    Number.isFinite(this.#getTotalGoal()) && this.#getTotalGoal() > 0
                ),
                active_interval_type: interval?.open === false ? null : (interval?.intervalType || null),
                trip_active: tripActive,
                trip_start_component: this.#component(
                    this.startTime,
                    tripStartDate?.getTime(),
                    tripStartDate,
                    tripStartDate instanceof Date && !Number.isNaN(tripStartDate.getTime())
                ),
                paused: ["break", "lunch", "down", "buffer"].includes(state),
                available_actions: availableActions,
                controls
            };
            return new ClockTimerUIState(values);
        }

        get uiState() {
            return this.#uiState || this.getUIState();
        }

        #emitUIState(eventName, summary) {
            const now = summary?.now instanceof Date ? summary.now : new Date();
            const state = this.#currentUIStateName(now);
            const changedState = state !== this.#uiStateName;
            if (changedState) {
                this.#uiPreviousState = this.#uiStateName;
                this.#uiStateName = state;
                this.#uiStateEnteredAt = new Date(now.getTime());
                this.#uiTransitionId += 1;
                this.#uiTransitionStartedAt = new Date(now.getTime());
            }
            const transition = this.#transitionName(eventName);
            const previous = this.#uiState;
            const active = this.getUIState(now, {
                summary,
                previousState: this.#uiPreviousState,
                transition,
                phase: changedState ? "active" : "settled",
                transitionId: this.#uiTransitionId
            });
            const comparable = ["state", "rendered_time_type", "goal_type", "effective_goal_type",
                "standard_time_component", "time_component", "current_percent_component", "goal_component"];
            const changedFields = comparable.filter(key =>
                JSON.stringify(previous?.[key]) !== JSON.stringify(active[key]));
            this.#uiState = new ClockTimerUIState({...active, changed_fields: Object.freeze(changedFields)});
            this.dispatchEvent(new CustomEvent("uiStateChanged", {
                detail: this.#uiState,
                bubbles: true,
                composed: true
            }));
            if (changedState) queueMicrotask(() => {
                if (this.#uiStateName !== state) return;
                this.#uiState = this.getUIState(new Date(), {
                    previousState: this.#uiPreviousState,
                    transition,
                    phase: "settled",
                    transitionId: this.#uiTransitionId,
                    changedFields: []
                });
                this.dispatchEvent(new CustomEvent("uiStateChanged", {
                    detail: this.#uiState,
                    bubbles: true,
                    composed: true
                }));
            });
        }

        connectedCallback() {
            if (!this.#completedTripsRestored) {
                this.#completedTripsRestored = true;
                const key = this.getAttribute("offline-trip-storage-key");
                if (key) {
                    try {
                        const saved = JSON.parse(localStorage.getItem(key) || "[]");
                        if (Array.isArray(saved)) {
                            this.#completedTripQueue = saved.filter(trip =>
                                trip?.payload?.clientToken && Array.isArray(trip.events));
                        }
                    } catch {}
                }
            }
            this.#captureFaceBackground();

            this.toggleAttribute(
                "data-clock-timer-free-aspect-ratio",
                !this.#keepAspectRatio
            );

            this.#ensureAttributes();

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (
                RingContainerClass
            ) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                this.#ensureBorderRing();

                this.#ensureTickRing();

                this.#ensureHandRing();

                this.#ensureNumberRing();

                this.#ensurePermanentRingOrder();
            }
            finally {
                if (
                    RingContainerClass
                ) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            this.#syncHandGeometry();

            this.#startFaceBackgroundTracking();

            this.#startHandAnimations();

            this.#startSizeObserver();

            this.#scheduleHourRender();

            this.#updateTickMarks();

            this.#startDisplayTimer();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            this.#eventsReady = true;
        }

        disconnectedCallback() {
            this.#stopTickTimer();

            this.#stopDisplayTimer();

            this.#stopTickMarkTimer();

            this.#stopTickGeometryTracking();

            this.#stopHandAnimations();

            this.#stopSizeObserver();

            this.#stopFaceBackgroundTracking();

            this.#cancelTimerTypeTransition(
                false
            );

            this.#cancelWaveResumeDelay();

            this.#cancelTimerModeTransition();
            this.#cancelTimeRangeTimingAnimations();

            this.#spinAnimation
                ?.cancel();

            this.#spinAnimation =
                undefined;

            this.#restoreTimeFontAfterSpin();

            this.#grayscaleAnimation
                ?.cancel();

            this.#grayscaleAnimation =
                undefined;

            if (this.#indicatorFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorFrame);
                this.#indicatorFrame = undefined;
            }

            if (this.#indicatorStartFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorStartFrame);
                this.#indicatorStartFrame = undefined;
            }

            if (
                this.#indicatorHandoffTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#indicatorHandoffTimeout
                );

                this.#indicatorHandoffTimeout =
                    undefined;
            }

            this.#indicatorHandoffFrozen =
                false;

            if (
                this.#ringLayerHandoffTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#ringLayerHandoffTimeout
                );

                this.#ringLayerHandoffTimeout =
                    undefined;
            }

            for (
                const ring of
                    this.#rings.values()
            ) {
                ring.style.removeProperty(
                    "z-index"
                );
            }

            if (
                this.#handStartTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#handStartTimeout
                );

                this.#handStartTimeout =
                    undefined;
            }

            if (
                this.#hoursRenderFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#hoursRenderFrame
                );

                this.#hoursRenderFrame =
                    undefined;
            }
        }

        attributeChangedCallback(
            name,
            oldValue,
            newValue
        ) {
            if (
                oldValue ===
                    newValue
            ) {
                return;
            }

            switch (name) {
                case "timer-type":
                    this.#handleTimerTypeChange(
                        oldValue,
                        newValue
                    );
                    break;

                case "timer-mode":
                    this.#handleTimerModeChange(
                        oldValue,
                        newValue
                    );
                    break;

                case "percent-mode": {
                    const normalized =
                        this.#normalizePercentMode(
                            newValue
                        );

                    if (newValue !== normalized) {
                        this.setAttribute(
                            "percent-mode",
                            normalized
                        );
                        break;
                    }

                    const previousMode =
                        this.#percentMode;

                    this.#percentMode =
                        normalized;

                    if (previousMode !== normalized) {
                        const context =
                            this.#percentModeChangeContext;

                        const source =
                            context?.source ??
                            "user";

                        this.#emitClockTimerEvent(
                            "percentModeChanged",
                            {
                                attribute: "percent-mode",
                                previousValue: previousMode,
                                value: normalized,
                                source,
                                reason: context?.reason ?? null,
                                userInitiated:
                                    source === "user"
                            }
                        );

                        if (
                            context?.recalculate ===
                                false
                        ) {
                            break;
                        }

                        this.#handleTripGoalChange(
                            source === "start"
                                ? "start"
                                : source === "user"
                                    ? "user"
                                    : "automatic"
                        );
                    }
                    break;
                }

                case "trip-goal":
                case "total-goal": {
                    const semanticSource =
                        this.#semanticGoalSetSource ??
                        this.#renderedPercentGoalSourceOverride ??
                        "user";

                    this.#emitClockTimerEvent("goalChanged", {
                        goal: name === "trip-goal" ? "trip" : "total",
                        attribute: name,
                        previousValue: oldValue,
                        value: newValue,
                        tripGoal: this.#getTripGoal(),
                        totalGoal: this.#getTotalGoal(),
                        source: semanticSource
                    });

                    if (newValue !== null) {
                        const semanticName =
                            name === "total-goal"
                                ? "totalGoalSet"
                                : semanticSource === "user"
                                    ? "tripGoalSet"
                                    : "tripGoalAutomaticallySet";

                        this.#emitClockTimerEvent(
                            semanticName,
                            {
                                previousValue: oldValue,
                                value: newValue,
                                tripGoal: this.#getTripGoal(),
                                totalGoal: this.#getTotalGoal(),
                                source: semanticSource,
                                userInitiated:
                                    semanticSource === "user"
                            }
                        );
                    }

                    const goalUpdateSource =
                        this.#renderedPercentGoalSourceOverride ??
                        (
                            semanticSource === "user"
                                ? "user"
                                : "automatic"
                        );

                    this.#handleTripGoalChange(
                        goalUpdateSource
                    );
                    break;
                }

                case "military-time":
                    this.#normalizeMilitaryTime();

                    this.#normalizeFormat();

                    this.#scheduleHourRender();

                    this.#updateDisplay(
                        new Date()
                    );

                    break;

                case "time-format":
                    this.#normalizeFormat();

                    this.#updateDisplay(
                        new Date()
                    );

                    break;

                case "date-format":
                    this.#updateDisplay(
                        new Date()
                    );

                    break;

                case "visible-hours":
                    this.#scheduleHourRender();
                    break;

                case "tick-marks":
                    this.#updateTickMarks();
                    break;

                case "indicator-symbol":
                    this.#syncIndicatorSymbolContent();
                    this.#scheduleIndicatorSymbolUpdate();
                    break;

                case "grayscale":
                case "grayscale-ramp":
                    this.#runGrayscale();
                    break;
            }
        }

        #getJSONCreationDate() {
            if (
                this.#creationDateOverride instanceof Date &&
                !Number.isNaN(
                    this.#creationDateOverride.getTime()
                )
            ) {
                return new Date(
                    this.#creationDateOverride.getTime()
                );
            }

            if (
                !Number.isFinite(
                    this.#startedAtEpoch
                )
            ) {
                return undefined;
            }

            const date =
                new Date(
                    this.#startedAtEpoch
                );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return undefined;
            }

            return new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );
        }

        #formatJSONDate(
            date,
            includeTime = false
        ) {
            if (
                !(date instanceof Date) ||
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return undefined;
            }

            const pad =
                (value, length = 2) =>
                    String(value).padStart(
                        length,
                        "0"
                    );

            const dateText =
                `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

            if (!includeTime) {
                return dateText;
            }

            return `${dateText} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
        }

        #formatJSONTimelineTime(
            milliseconds,
            creationDate
        ) {
            if (
                !Number.isFinite(milliseconds) ||
                !(creationDate instanceof Date) ||
                Number.isNaN(
                    creationDate.getTime()
                )
            ) {
                return undefined;
            }

            return this.#formatJSONDate(
                new Date(
                    creationDate.getTime() +
                    milliseconds
                ),
                true
            );
        }

        #getJSONRangeAttributes(range) {
            const excluded =
                new Set([
                    "start-time",
                    "end-time",
                    "range-length",
                    "slot"
                ]);

            const attributes = {};

            for (
                const attribute of
                    range.attributes
            ) {
                if (
                    excluded.has(
                        attribute.name.toLowerCase()
                    )
                ) {
                    continue;
                }

                attributes[attribute.name] =
                    attribute.value;
            }

            return attributes;
        }

        #getJSONComparableAttributes(range) {
            const attributes =
                this.#getJSONRangeAttributes(
                    range
                );

            return Object.entries(attributes)
                .sort(
                    ([aName, aValue], [bName, bValue]) =>
                        aName.localeCompare(bName) ||
                        aValue.localeCompare(bValue)
                );
        }

        #JSONAttributesMatch(
            left,
            right
        ) {
            if (left.length !== right.length) {
                return false;
            }

            return left.every(
                (entry, index) =>
                    entry[0] === right[index][0] &&
                    entry[1] === right[index][1]
            );
        }

        #getJSONCustomRanges() {
            const reserved =
                new Set([
                    "trip",
                    "tolerance",
                    "overtime",
                    "earlystart",
                    "latency",
                    "end-buffer-extension",
                    "elapsed",
                    "discrepancy",
                    "approval-surplus",
                    "approval-deficit"
                ]);

            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range => {
                            if (
                                range.timeRangeExiting === true
                            ) {
                                return false;
                            }

                            const type =
                                range.getAttribute(
                                    "type"
                                )?.trim();

                            return (
                                Boolean(type) &&
                                !reserved.has(type)
                            );
                        }
                    )
                    .map(
                        range => ({
                            range,
                            start:
                                Number(
                                    range.clockTimerStart
                                ),
                            end:
                                Number(
                                    range.clockTimerEnd
                                ),
                            attributes:
                                this.#getJSONRangeAttributes(
                                    range
                                ),
                            comparableAttributes:
                                this.#getJSONComparableAttributes(
                                    range
                                )
                        })
                    )
                    .filter(
                        item =>
                            Number.isFinite(item.start) &&
                            Number.isFinite(item.end) &&
                            item.end > item.start
                    )
                    .sort(
                        (a, b) =>
                            a.start - b.start ||
                            a.end - b.end
                    );

            const merged = [];

            for (const item of ranges) {
                const previous =
                    merged[
                        merged.length - 1
                    ];

                if (
                    previous &&
                    previous.end === item.start &&
                    this.#JSONAttributesMatch(
                        previous.comparableAttributes,
                        item.comparableAttributes
                    )
                ) {
                    previous.end =
                        item.end;

                    continue;
                }

                merged.push({
                    ...item
                });
            }

            return merged;
        }

        #getJSONTerminalTime() {
            if (
                this.#started &&
                Number.isFinite(
                    this.#calculatedEndTime
                )
            ) {
                return this.#calculatedEndTime;
            }

            const ends =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.timeRangeExiting !== true &&
                            range.getAttribute(
                                "type"
                            ) !== "elapsed"
                    )
                    .map(
                        range =>
                            Number(
                                range.clockTimerEnd
                            )
                    )
                    .filter(Number.isFinite);

            if (ends.length > 0) {
                return Math.max(
                    ...ends
                );
            }

            return Number.isFinite(
                this.#calculatedEndTime
            )
                ? this.#calculatedEndTime
                : undefined;
        }

        toJSON() {
            const creationDate =
                this.#getJSONCreationDate();

            const result = {
                tripId:
                    this.#tripId,
                creationDate:
                    this.creationDate,
                standardTime:
                    this.standardTime,
                scheduledStart:
                    this.scheduledStart,
                nonProduction:
                    this.#nonProduction,
                nonProductionFilter:
                    this.#nonProductionFilter,
                records: []
            };

            if (!creationDate) {
                return result;
            }

            const records = [];

            const addRecord =
                (
                    milliseconds,
                    value
                ) => {
                    const timestamp =
                        this.#formatJSONTimelineTime(
                            milliseconds,
                            creationDate
                        );

                    if (!timestamp) {
                        return;
                    }

                    records.push({
                        milliseconds,
                        record: {
                            [timestamp]: value
                        }
                    });
                };

            const start =
                this.#getStartTimeMilliseconds();

            if (
                Number.isFinite(
                    start
                )
            ) {
                addRecord(
                    start,
                    {
                        type: "start"
                    }
                );
            }

            const customRanges =
                this.#getJSONCustomRanges();

            for (
                let index = 0;
                index < customRanges.length;
                index++
            ) {
                const item =
                    customRanges[index];

                addRecord(
                    item.start,
                    {
                        ...item.attributes
                    }
                );

                const next =
                    customRanges[
                        index + 1
                    ];

                if (
                    !next ||
                    next.start !== item.end
                ) {
                    addRecord(
                        item.end,
                        {
                            type: "resume"
                        }
                    );
                }
            }

            const terminal =
                this.#getJSONTerminalTime();

            if (
                Number.isFinite(
                    terminal
                )
            ) {
                records.splice(
                    0,
                    records.length,
                    ...records.filter(
                        item => {
                            const value =
                                Object.values(
                                    item.record
                                )[0];

                            return !(
                                item.milliseconds === terminal &&
                                value?.type === "resume"
                            );
                        }
                    )
                );

                addRecord(
                    terminal,
                    {
                        type: "end"
                    }
                );
            }

            records.sort(
                (a, b) =>
                    a.milliseconds - b.milliseconds
            );

            result.records =
                records.map(
                    item =>
                        item.record
                );

            return result;
        }


        get showTolerance() {
            return this.#showTolerance;
        }

        set showTolerance(value) {
            let normalized;

            if (value === undefined) {
                normalized = undefined;
            }
            else if (typeof value === "boolean") {
                normalized = value;
            }
            else if (typeof value === "string") {
                const text =
                    value.trim().toLowerCase();

                if (text === "true") {
                    normalized = true;
                }
                else if (text === "false") {
                    normalized = false;
                }
                else {
                    return;
                }
            }
            else {
                return;
            }

            if (normalized === this.#showTolerance) {
                return;
            }

            this.#showTolerance =
                normalized;

            if (
                !this.#started ||
                this.#renderedPercentGoal <= 1
            ) {
                return;
            }

            this.#transitionShowTolerance();
        }

        #normalizeIntervalElapsedBehavior(
            value,
            fallback = undefined
        ) {
            if (typeof value !== "string") {
                return fallback;
            }

            const normalized =
                value.trim().toLowerCase();

            if (normalized === "startlatency") {
                return "startLatency";
            }

            if (normalized === "extendboundary") {
                return "extendBoundary";
            }

            if (normalized === "extendinterval") {
                return "extendInterval";
            }

            if (normalized === "rollover") {
                return "rollover";
            }

            return fallback;
        }

        get intervalElapsedBehavior() {
            return this.#intervalElapsedBehavior;
        }

        set intervalElapsedBehavior(value) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "intervalElapsedBehavior must be a string."
                );
            }

            const normalized =
                this.#normalizeIntervalElapsedBehavior(
                    value
                );

            if (!normalized) {
                throw new RangeError(
                    "intervalElapsedBehavior must be startLatency, extendBoundary, extendInterval, or rollover."
                );
            }

            if (
                normalized ===
                    this.#intervalElapsedBehavior
            ) {
                return;
            }

            const previousValue =
                this.#intervalElapsedBehavior;

            this.#intervalElapsedBehavior =
                normalized;

            this.#emitClockTimerEvent(
                "intervalElapsedBehaviorChanged",
                {
                    previousValue,
                    value: normalized
                }
            );

            if (this.#hasStartProperties()) {
                this.#queueTripEvent(
                    "trip.interval-elapsed-behavior-changed",
                    new Date(),
                    {
                        value:
                            normalized
                    }
                );

                this.#scheduleTripEventSync();
            }
        }

        #cloneAggregateSnapshot(value) {
            if (!value || typeof value !== "object") {
                return undefined;
            }

            try {
                return JSON.parse(
                    JSON.stringify(value)
                );
            }
            catch {
                return undefined;
            }
        }

        #getAggregateSnapshotChanges(previous, current) {
            if (!previous || !current) {
                return undefined;
            }

            const keys = [
                "startTime",
                "endTime",
                "tripCount",
                "standardTimeMilliseconds",
                "actualTimeMilliseconds",
                "countedTimeMilliseconds",
                "nonProductionFilter",
                "aggregateBreakdown"
            ];

            const changes = {};

            for (const key of keys) {
                const before = previous[key];
                const after = current[key];

                if (
                    JSON.stringify(before) !==
                    JSON.stringify(after)
                ) {
                    changes[key] = {
                        previous: before,
                        value: after
                    };
                }
            }

            return Object.keys(changes).length > 0
                ? changes
                : undefined;
        }

        #emitAggregateReconnectSyncIfChanged() {
            if (!this.#aggregateReconnectPending) {
                return false;
            }

            const previous =
                this.#aggregateReconnectSnapshot;

            const current =
                this.#cloneAggregateSnapshot(
                    this.#tripTotals
                );

            const changes =
                this.#getAggregateSnapshotChanges(
                    previous,
                    current
                );

            this.#aggregateReconnectPending =
                false;

            this.#aggregateReconnectSnapshot =
                undefined;

            if (!changes) {
                return false;
            }

            this.#emitClockTimerEvent(
                "aggregatesSynced",
                {
                    source: "reconnect",
                    previous,
                    current,
                    changes
                }
            );

            return true;
        }

        async #refreshAggregateSnapshotAfterReconnect() {
            if (!this.#aggregateReconnectPending) {
                return false;
            }

            const totals =
                this.#tripTotals;

            if (
                !totals ||
                typeof totals.startTime !== "string" ||
                typeof totals.endTime !== "string"
            ) {
                this.#aggregateReconnectPending =
                    false;

                this.#aggregateReconnectSnapshot =
                    undefined;

                return false;
            }

            // Compare the server refresh against the aggregate snapshot the user
            // actually sees immediately before synchronization. Offline work may
            // have changed the cached totals since the connection was lost.
            this.#aggregateReconnectSnapshot =
                this.#cloneAggregateSnapshot(
                    totals
                );

            try {
                await this.calculateTripTotals(
                    totals.startTime,
                    totals.endTime
                );

                return true;
            }
            catch {
                // Aggregate refresh is supplementary to reconnect/persistence.
                // A failed refresh must not make an otherwise successful sync fail.
                return false;
            }
        }

        #setConnected(csrfToken, detail = {}) {
            if (detail.user?.id !== undefined) this.#syncUserId = detail.user.id;
            const previousNetworkStatus =
                this.networkStatus;

            const wasConnected =
                this.#connectionState ===
                    "connected";

            this.#csrfToken =
                csrfToken;

            this.#connectionState =
                "connected";

            this.#emitClockTimerEvent("calendarRulesLoaded", {calendars: detail.calendars ?? []});

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
        }

        #connectionFailed(source, error) {
            this.#emitClockTimerEvent(
                "connectionFailed",
                {
                    source,
                    message:
                        error instanceof Error
                            ? error.message
                            : String(error ?? "Connection failed.")
                }
            );
        }

        #setOffline(detail = {}) {
            const previousNetworkStatus =
                this.networkStatus;

            const wasConnected =
                this.#connectionState ===
                    "connected";

            if (wasConnected) {
                this.#aggregateReconnectPending =
                    true;

                this.#aggregateReconnectSnapshot =
                    this.#cloneAggregateSnapshot(
                        this.#tripTotals
                    );
            }

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
        }

        #apiURL(endpoint, query) {
            const path =
                `${String(this.#apiBase).replace(/\/+$/, "")}/${endpoint}/`;

            if (!query || typeof query !== "object") {
                return path;
            }

            const parameters =
                new URLSearchParams();

            for (const [name, value] of Object.entries(query)) {
                if (value === undefined || value === null) {
                    continue;
                }

                parameters.set(
                    name,
                    String(value)
                );
            }

            const text =
                parameters.toString();

            return text
                ? `${path}?${text}`
                : path;
        }

        async #fetchRequest(url, options = {}) {
            return fetch(url, options)
                .then(
                    async response => ({
                        response,
                        body:
                            await response
                                .json()
                                .catch(() => ({}))
                    })
                )
                .catch(
                    cause => ({
                        response: undefined,
                        body: {
                            error:
                                cause?.name === "AbortError"
                                    ? "aborted"
                                    : "fetch_failed",
                            message:
                                cause?.name === "AbortError"
                                    ? "The request was aborted."
                                    : "The API is unavailable."
                        },
                        cause
                    })
                );
        }

        async #apiRequest(endpoint, { method = "GET", body, csrf = false, query, signal } = {}) {
            const headers = { "Accept": "application/json" };
            const multipart=typeof FormData!=="undefined"&&body instanceof FormData;
            if (body !== undefined&&!multipart) {
                headers["Content-Type"] = "application/json";
            }
            if (csrf) {
                if (!this.#csrfToken) {
                    const error = new Error("A CSRF token is required.");
                    error.clockTimerOffline = true;
                    throw error;
                }
                headers["X-CSRF-Token"] = this.#csrfToken;
            }

            const result =
                await this.#fetchRequest(
                    this.#apiURL(endpoint, query),
                    {
                        method,
                        credentials: "same-origin",
                        headers,
                        body:
                            body === undefined
                                ? undefined
                                : multipart?body:JSON.stringify(body),
                        signal
                    }
                );

            const response =
                result.response;

            const data =
                result.body || {};

            if (!response) {
                if (data.error === "aborted") {
                    throw result.cause ??
                        new DOMException(
                            data.message || "The request was aborted.",
                            "AbortError"
                        );
                }

                this.#setOffline({
                    source: "api",
                    reason: "unavailable"
                });

                const error =
                    new Error(
                        data.message ||
                            "The API is unavailable.",
                        {
                            cause: result.cause
                        }
                    );

                error.clockTimerOffline =
                    true;

                throw error;
            }

            if (!response.ok) {
                const error = new Error(
                    data.message || `API request failed (${response.status}).`
                );
                if (response.status === 401 || data.error === "invalid_csrf") {
                    this.#setOffline({
                        source: "api",
                        reason:
                            response.status === 401
                                ? "unauthorized"
                                : "invalid-csrf"
                    });
                    error.clockTimerOffline = true;
                }
                throw error;
            }
            return data;
        }

        async #resumeSession() {
            try {
                const data =
                    await this.#apiRequest(
                        "users"
                    );

                if (
                    typeof data.csrfToken !== "string" ||
                    data.csrfToken.length < 32
                ) {
                    throw new Error(
                        "The API did not return a CSRF token."
                    );
                }

                this.#setConnected(
                    data.csrfToken,
                    {
                        source: "resume",
                        user: data.user,
                        calendars: data.calendars
                    }
                );

                return true;
            }
            catch (error) {
                this.#setOffline({
                    source: "resume",
                    reason: "failed"
                });

                this.#connectionFailed(
                    "resume",
                    error
                );

                return false;
            }
        }

        async #ensureConnected() {
            if (this.#connectionState === "connected" && this.#csrfToken) {
                return true;
            }
            return this.#resumeSession();
        }

        #timelineToISO(milliseconds) {
            const creationDate = this.#getJSONCreationDate();
            if (!creationDate || !Number.isFinite(milliseconds)) {
                return undefined;
            }
            return new Date(creationDate.getTime() + milliseconds).toISOString();
        }

        #createTripEventClientToken() {
            return (
                globalThis.crypto?.randomUUID?.() ??
                "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                    /[xy]/g,
                    character => {
                        const random =
                            Math.floor(
                                Math.random() * 16
                            );

                        const value =
                            character === "x"
                                ? random
                                : (random & 0x3) | 0x8;

                        return value.toString(16);
                    }
                )
            );
        }

        #parseTripEventTimestamp(value) {
            if (value instanceof Date) {
                return new Date(
                    value.getTime()
                );
            }

            let candidate =
                String(value ?? "").trim();

            if (
                /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(
                    candidate
                )
            ) {
                candidate =
                    candidate.replace(
                        " ",
                        "T"
                    ) + "Z";
            }

            const date =
                new Date(candidate);

            if (Number.isNaN(date.getTime())) {
                throw new TypeError(
                    "Trip event timestamp is invalid."
                );
            }

            return date;
        }

        #queueTripEvent(
            event,
            timestamp,
            value = null,
            {
                record,
                assignIntervalId = false,
                removeRecordOnSync = false
            } = {}
        ) {
            if (this.#replayingTripEvents) {
                return undefined;
            }

            const name =
                String(event ?? "").trim();

            if (!name) {
                throw new TypeError(
                    "Trip event name is required."
                );
            }

            const date =
                timestamp instanceof Date
                    ? new Date(timestamp.getTime())
                    : new Date(timestamp);

            if (Number.isNaN(date.getTime())) {
                throw new TypeError(
                    "Trip event timestamp must be a valid date/time."
                );
            }

            const queued = {
                event:
                    name,
                timestamp:
                    date.toISOString(),
                value:
                    value ?? null,
                clientToken:
                    this.#createTripEventClientToken(),
                record,
                assignIntervalId:
                    Boolean(assignIntervalId),
                removeRecordOnSync:
                    Boolean(removeRecordOnSync),
                synced:
                    false
            };

            this.#pendingTripEvents.push(
                queued
            );

            return queued;
        }

        async #syncTripEvents() {
            await this.#syncCompletedTrips();
            const pending =
                this.#pendingTripEvents.filter(
                    event =>
                        event.synced !== true
                );

            if (pending.length === 0) {
                return;
            }

            const tripId =
                await this.#ensureTripPersisted();

            for (const event of pending) {
                const data =
                    await this.#apiRequest(
                        "trip-events",
                        {
                            method: "POST",
                            csrf: true,
                            body: {
                                tripId,
                                event:
                                    event.event,
                                timestamp:
                                    event.timestamp,
                                value:
                                    event.value,
                                clientToken:
                                    event.clientToken
                            }
                        }
                    );

                const eventId =
                    Number(
                        data.eventId
                    );

                if (
                    !Number.isInteger(eventId) ||
                    eventId < 1
                ) {
                    throw new Error(
                        "The API returned an invalid trip event id."
                    );
                }

                event.id =
                    eventId;

                // A queued stop is not fully synced until both its event and
                // the trip's aggregate timing row have reached the server.
                // Keep it pending if this PATCH fails so reconnect can retry.
                if (event.event === "trip.stopped") {
                    await this.#apiRequest("trips", {
                        method: "PATCH",
                        csrf: true,
                        body: {
                            tripId,
                            action: "stop",
                            endTime: event.timestamp,
                            standardTimeMilliseconds:
                                event.value.standardTimeMilliseconds,
                            countedTimeMilliseconds:
                                event.value.countedTimeMilliseconds
                        }
                    });
                }

                event.synced =
                    true;

                if (
                    event.assignIntervalId &&
                    event.record
                ) {
                    this.#assignIntervalDatabaseId(
                        event.record,
                        eventId
                    );
                }

                if (
                    event.removeRecordOnSync &&
                    event.record
                ) {
                    event.record.clockTimerDeleteSynced =
                        true;

                    this.#insertedRanges =
                        this.#insertedRanges.filter(
                            candidate =>
                                candidate !==
                                    event.record
                        );
                }
            }

            this.#pendingTripEvents =
                this.#pendingTripEvents.filter(
                    event =>
                        event.synced !== true
                );
        }

        #saveCompletedTrips() {
            const key = this.getAttribute("offline-trip-storage-key");
            if (!key) return true;
            try {
                localStorage.setItem(key, JSON.stringify(this.#completedTripQueue));
                return true;
            } catch {
                return false;
            }
        }

        #localLogEvents(snapshot) {
            let intervalKey;
            return snapshot.records.map((record, index) => {
                const [time, value] = Object.entries(record)[0];
                const timestamp = new Date(time.replace(" ", "T")).toISOString();
                let event;
                if (value.type === "start") event = "trip.started";
                else if (value.type === "end") event = "trip.stopped";
                else if (value.type === "resume") event = "interval.ended";
                else { event = "interval.started"; intervalKey = `local-${index}`; }
                return {id: `local-${index}`, event, timestamp, value: {...value, intervalKey}};
            });
        }

        getLocalTripLog() {
            const trips = this.#completedTripQueue
                .filter(trip => !trip.deleted && (this.#syncUserId === undefined || trip.userId === undefined || trip.userId === this.#syncUserId))
                .map(trip => ({...trip.log, id: trip.tripId || `offline-${trip.payload.clientToken}`,
                    buffered: true, events: trip.log?.events || trip.events}));
            if (this.#hasStartProperties()) {
                const payload = this.#tripPersistencePayload();
                const summary = this.#buildSummarySnapshot(new Date()).trip;
                trips.push({id: this.#tripId || `offline-${this.#preparedTrip?.clientToken || "active"}`,
                    ...payload, running: this.#started, buffered: this.networkStatus === "offline",
                    actualTimeMilliseconds: summary.countedTimeElapsedMilliseconds,
                    countedTimeMilliseconds: summary.countedTimeElapsedMilliseconds,
                    events: this.#localLogEvents(this.toJSON()).filter(event => event.event !== "trip.stopped")});
            }
            return trips;
        }

        calculateOfflineTripTotals(trips, startTime, endTime) {
            const production = this.#emptyTripAggregateSummary();
            const nonProduction = [];
            for (const trip of trips) {
                const start = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(trip.startTime) ? trip.startTime : trip.startTime.replace(" ", "T") + "Z");
                if (trip.running || Number(trip.id) === this.#tripId ||
                    start < Date.parse(startTime) || start >= Date.parse(endTime)) continue;
                if (trip.nonProduction) nonProduction.push(trip);
                else this.#addTripAggregateSummary(production, {...trip, tripCount: 1});
            }
            const breakdown = this.#buildAggregateBreakdown(production, nonProduction);
            this.#tripTotals = {startTime, endTime,
                ...this.#composeAggregateSummary(breakdown, this.#nonProductionFilter),
                nonProductionFilter: this.#nonProductionFilter, aggregateBreakdown: breakdown};
            this.#handleTripGoalChange(this.#renderedPercentGoalSourceOverride ?? "user");
            return this.#tripTotals;
        }

        async #syncCompletedTrips() {
            if (this.#completedTripSyncPromise) return this.#completedTripSyncPromise;
            this.#completedTripSyncPromise = this.#flushCompletedTrips();
            try { await this.#completedTripSyncPromise; }
            finally { this.#completedTripSyncPromise = undefined; }
        }

        async #flushCompletedTrips() {
            let uploaded = false;
            for (const trip of [...this.#completedTripQueue]) {
                if (trip.userId !== undefined && trip.userId !== this.#syncUserId) continue;
                trip.userId = this.#syncUserId;
                this.#saveCompletedTrips();
                if (!Number.isInteger(trip.tripId)) {
                    const data = await this.#apiRequest("trips", {
                        method: "POST", csrf: true, body: trip.payload
                    });
                    trip.tripId = Number(data.tripId);
                    if (!Number.isInteger(trip.tripId) || trip.tripId < 1) {
                        throw new Error("The API returned an invalid trip id.");
                    }
                } else if (trip.pending) {
                    await this.#apiRequest("trips", {
                        method: "PATCH", csrf: true,
                        body: {tripId: trip.tripId, action: "start", ...trip.payload}
                    });
                }
                trip.pending = false;
                this.#saveCompletedTrips();
                for (const event of trip.events) {
                    if (event.synced) continue;
                    const data = await this.#apiRequest("trip-events", {
                        method: "POST", csrf: true,
                        body: {tripId: trip.tripId, event: event.event,
                            timestamp: event.timestamp, value: event.value,
                            clientToken: event.clientToken}
                    });
                    if (!Number.isInteger(Number(data.eventId)) || Number(data.eventId) < 1) {
                        throw new Error("The API returned an invalid trip event id.");
                    }
                    if (event.event === "trip.stopped") {
                        await this.#apiRequest("trips", {
                            method: "PATCH", csrf: true,
                            body: {tripId: trip.tripId, action: "stop",
                                endTime: event.timestamp,
                                standardTimeMilliseconds: event.value.standardTimeMilliseconds,
                                countedTimeMilliseconds: event.value.countedTimeMilliseconds}
                        });
                    }
                    event.synced = true;
                    this.#saveCompletedTrips();
                }
                if (trip.deleted) {
                    try {
                        const editor = await this.#apiRequest("trip-editor", {query:{tripId:trip.tripId}});
                        await this.#apiRequest("trip-editor", {method:"POST",csrf:true,body:{
                            tripId:trip.tripId,operation:"delete-trip",revision:editor.revision
                        }});
                    }
                    catch (error) {
                        if (Number(error?.status) !== 404) throw error;
                    }
                }
                this.#completedTripQueue = this.#completedTripQueue.filter(item => item !== trip);
                this.#saveCompletedTrips();
                uploaded = true;
            }
            if (uploaded) this.#emitClockTimerEvent("completedTripsSynced", {synced: true});
        }

        #scheduleTripEventSync() {
            if (
                this.#replayingTripEvents ||
                this.#connectionState !==
                    "connected"
            ) {
                return;
            }

            void this.#protectedSync(
                async () => {
                    await this.#syncTripEvents();
                }
            ).catch(() => {});
        }

        #tripPersistencePayload() {
            const timelineNow = this.#getSummaryTimelineNow(new Date());
            const startTime = this.#timelineToISO(this.#getElapsedStartTimeMilliseconds());
            const endTime = this.#timelineToISO(this.#calculatedEndTime);
            const standardTimeMilliseconds =
                Math.round(
                    this.#standardDuration
                );
            const countedTimeMilliseconds =
                Math.round(
                    this.#getCountedTimeElapsed(timelineNow)
                );

            if (
                !startTime ||
                !endTime ||
                !Number.isInteger(standardTimeMilliseconds) ||
                standardTimeMilliseconds < 1
            ) {
                throw new Error("The trip does not have persistable timing data.");
            }

            const payload = {
                startTime,
                endTime,
                standardTimeMilliseconds,
                countedTimeMilliseconds,
                nonProduction:
                    this.#nonProduction
            };

            if (typeof this.#preparedTrip?.clientToken === "string") {
                payload.clientToken =
                    this.#preparedTrip.clientToken;
            }

            return payload;
        }

        #assignIntervalDatabaseId(record, intervalId) {
            const numeric = Number(intervalId);
            if (!Number.isInteger(numeric) || numeric < 1) {
                throw new Error("The API returned an invalid interval id.");
            }
            record.intervalId = numeric;
            record.otherAttributes = {
                ...(record.otherAttributes ?? {}),
                "interval-id": String(numeric)
            };
            for (const range of this.#getManagedTimeRanges()) {
                if (range.clockTimerInserted === record.id) {
                    this.#ensureIntervalIdAttribute(range, numeric);
                }
            }
        }

        async #ensureTripPersisted() {
            if (Number.isInteger(this.#tripId) && this.#tripId > 0) {
                if (
                    this.#preparedTrip?.pending === true &&
                    Number(this.#preparedTrip.tripId) === this.#tripId
                ) {
                    await this.#apiRequest("trips", {
                        method: "PATCH",
                        csrf: true,
                        body: {
                            tripId: this.#tripId,
                            action: "start",
                            ...this.#tripPersistencePayload()
                        }
                    });
                    this.#preparedTrip.pending = false;
                    this.#preparedTrip.persisted = true;
                }
                return this.#tripId;
            }
            const data = await this.#apiRequest("trips", {
                method: "POST",
                csrf: true,
                body: this.#tripPersistencePayload()
            });
            const tripId = Number(data.tripId);
            if (!Number.isInteger(tripId) || tripId < 1) {
                throw new Error("The API returned an invalid trip id.");
            }
            this.#tripId = tripId;
            if (this.#preparedTrip) {
                this.#preparedTrip.tripId = tripId;
                this.#preparedTrip.persisted = true;
                this.#preparedTrip.pending = false;
            }
            if (this.#originalStartArguments) {
                this.#originalStartArguments.tripId = tripId;
            }
            return tripId;
        }

        async #protectedSync(action) {
            if (!(await this.#ensureConnected())) {
                return false;
            }
            try {
                await action();
                await this.#refreshAggregateSnapshotAfterReconnect();
                return true;
            }
            catch (error) {
                if (error?.clockTimerOffline) {
                    return false;
                }
                throw error;
            }
        }

        #mutationResult(synced, record) {
            return {
                synced: Boolean(synced),
                connected:
                    this.#connectionState ===
                        "connected",
                tripId: Number.isInteger(this.#tripId) ? this.#tripId : undefined,
                intervalId: Number.isInteger(Number(record?.intervalId))
                    ? Number(record.intervalId)
                    : undefined,
                intervalKey:
                    record?.clockTimerEventKey
            };
        }

        #normalizeTripTotalsDateTime(
            value,
            name
        ) {
            let candidate =
                value;

            if (typeof candidate === "string") {
                candidate =
                    candidate.trim();

                if (!candidate) {
                    throw new TypeError(
                        `${name} must be a date/time.`
                    );
                }

                if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
                    throw new TypeError(
                        `${name} must include a time.`
                    );
                }

                if (/^\d{4}-\d{2}-\d{2}\s/.test(candidate)) {
                    candidate =
                        candidate.replace(
                            " ",
                            "T"
                        );
                }
            }

            const date =
                value instanceof Date
                    ? new Date(
                        value.getTime()
                    )
                    : new Date(candidate);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                throw new RangeError(
                    `${name} must be a valid date/time.`
                );
            }

            return date;
        }

        #emptyTripAggregateSummary() {
            return {
                tripCount: 0,
                standardTimeMilliseconds: 0,
                actualTimeMilliseconds: 0,
                countedTimeMilliseconds: 0
            };
        }

        #normalizeTripAggregateSummary(
            value,
            name
        ) {
            const tripCount =
                Number(value?.tripCount);

            const standardTimeMilliseconds =
                Number(
                    value?.standardTimeMilliseconds
                );

            const actualTimeMilliseconds =
                Number(
                    value?.actualTimeMilliseconds
                );

            const countedTimeMilliseconds =
                Number(
                    value?.countedTimeMilliseconds ?? 0
                );

            if (
                !Number.isInteger(tripCount) ||
                tripCount < 0 ||
                !Number.isFinite(standardTimeMilliseconds) ||
                standardTimeMilliseconds < 0 ||
                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds < 0 ||
                !Number.isFinite(countedTimeMilliseconds) ||
                countedTimeMilliseconds < 0
            ) {
                throw new Error(
                    `The API returned invalid ${name} aggregate data.`
                );
            }

            return {
                tripCount,
                standardTimeMilliseconds,
                actualTimeMilliseconds,
                countedTimeMilliseconds
            };
        }

        #addTripAggregateSummary(
            target,
            source
        ) {
            target.tripCount +=
                source.tripCount;

            target.standardTimeMilliseconds +=
                source.standardTimeMilliseconds;

            target.actualTimeMilliseconds +=
                source.actualTimeMilliseconds;

            target.countedTimeMilliseconds +=
                source.countedTimeMilliseconds ?? 0;

            return target;
        }

        #buildAggregateBreakdown(
            production,
            nonProductionTrips
        ) {
            const normalizedProduction =
                this.#normalizeTripAggregateSummary(
                    production,
                    "production"
                );

            if (!Array.isArray(nonProductionTrips)) {
                throw new Error(
                    "The API returned invalid non-production aggregate data."
                );
            }

            const trips =
                nonProductionTrips.map(
                    trip => {
                        const standardTimeMilliseconds =
                            Number(
                                trip?.standardTimeMilliseconds
                            );

                        const actualTimeMilliseconds =
                            Number(
                                trip?.actualTimeMilliseconds
                            );

                        const countedTimeMilliseconds =
                            Number(
                                trip?.countedTimeMilliseconds ?? 0
                            );

                        if (
                            !Number.isFinite(standardTimeMilliseconds) ||
                            standardTimeMilliseconds < 0 ||
                            !Number.isFinite(actualTimeMilliseconds) ||
                            actualTimeMilliseconds <= 0 ||
                            !Number.isFinite(countedTimeMilliseconds) ||
                            countedTimeMilliseconds < 0
                        ) {
                            throw new Error(
                                "The API returned invalid non-production trip aggregate data."
                            );
                        }

                        return {
                            standardTimeMilliseconds,
                            actualTimeMilliseconds,
                            countedTimeMilliseconds
                        };
                    }
                );

            const all =
                this.#emptyTripAggregateSummary();

            const helpful =
                this.#emptyTripAggregateSummary();

            const nonHelpful =
                this.#emptyTripAggregateSummary();

            const productive =
                this.#emptyTripAggregateSummary();

            const productionRatio =
                normalizedProduction.tripCount > 0 &&
                normalizedProduction.standardTimeMilliseconds > 0 &&
                normalizedProduction.actualTimeMilliseconds > 0
                    ? normalizedProduction.standardTimeMilliseconds /
                        normalizedProduction.actualTimeMilliseconds
                    : undefined;

            for (const trip of trips) {
                const summary = {
                    tripCount: 1,
                    standardTimeMilliseconds:
                        trip.standardTimeMilliseconds,
                    actualTimeMilliseconds:
                        trip.actualTimeMilliseconds,
                    countedTimeMilliseconds:
                        trip.countedTimeMilliseconds
                };

                this.#addTripAggregateSummary(
                    all,
                    summary
                );

                const tripRatio =
                    trip.standardTimeMilliseconds /
                    trip.actualTimeMilliseconds;

                const isHelpful =
                    Number.isFinite(productionRatio) &&
                    tripRatio > productionRatio;

                this.#addTripAggregateSummary(
                    isHelpful
                        ? helpful
                        : nonHelpful,
                    summary
                );

                if (tripRatio >= 1) {
                    this.#addTripAggregateSummary(
                        productive,
                        summary
                    );
                }
            }

            return {
                production: {
                    ...normalizedProduction
                },
                nonProduction: {
                    all,
                    helpful,
                    nonHelpful,
                    productive,
                    trips
                }
            };
        }

        #normalizeAggregateBreakdown(
            value
        ) {
            return this.#buildAggregateBreakdown(
                value?.production,
                value?.nonProduction?.trips
            );
        }

        #composeAggregateSummary(
            breakdown,
            filter = this.#nonProductionFilter
        ) {
            if (this.#productionFilter === "productive") return { ...breakdown.production };
            if (this.#productionFilter === "non-productive") return { ...breakdown.nonProduction.all };
            if (this.#productionFilter === "all") filter = "all";
            const result = {
                ...breakdown.production
            };

            const extra =
                filter === "all"
                    ? breakdown.nonProduction.all
                    : filter === "helpful"
                        ? breakdown.nonProduction.helpful
                        : filter === "productive"
                            ? breakdown.nonProduction.productive
                            : undefined;

            if (extra) {
                this.#addTripAggregateSummary(
                    result,
                    extra
                );
            }

            return result;
        }

        #hasUsableAggregateSnapshot() {
            const totals =
                this.#tripTotals;

            return Boolean(
                totals &&
                typeof totals.startTime === "string" &&
                typeof totals.endTime === "string" &&
                totals.aggregateBreakdown &&
                Number.isInteger(totals.tripCount) &&
                totals.tripCount >= 0 &&
                Number.isFinite(
                    totals.standardTimeMilliseconds
                ) &&
                totals.standardTimeMilliseconds >= 0 &&
                Number.isFinite(
                    totals.actualTimeMilliseconds
                ) &&
                totals.actualTimeMilliseconds >= 0 &&
                Number.isFinite(
                    totals.countedTimeMilliseconds
                ) &&
                totals.countedTimeMilliseconds >= 0
            );
        }

        #canSelectTotalMode() {
            return this.#hasUsableAggregateSnapshot();
        }

        #recomposeCachedTripTotals(
            filter = this.#nonProductionFilter
        ) {
            if (!this.#hasUsableAggregateSnapshot()) {
                return false;
            }

            const breakdown =
                this.#buildAggregateBreakdown(
                    this.#tripTotals.aggregateBreakdown.production,
                    this.#tripTotals.aggregateBreakdown.nonProduction.trips
                );

            const selected =
                this.#composeAggregateSummary(
                    breakdown,
                    filter
                );

            this.#tripTotals = {
                startTime:
                    this.#tripTotals.startTime,
                endTime:
                    this.#tripTotals.endTime,
                ...selected,
                nonProductionFilter:
                    filter,
                aggregateBreakdown:
                    breakdown
            };

            return true;
        }

        #addCompletedTripToCachedTotals({
            startTime,
            standardTimeMilliseconds,
            actualTimeMilliseconds,
            countedTimeMilliseconds,
            nonProduction
        }) {
            if (
                !this.#hasUsableAggregateSnapshot() ||
                typeof startTime !== "string" ||
                !Number.isFinite(standardTimeMilliseconds) ||
                standardTimeMilliseconds <= 0 ||
                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds <= 0 ||
                !Number.isFinite(countedTimeMilliseconds) ||
                countedTimeMilliseconds < 0
            ) {
                return false;
            }

            const tripStart =
                Date.parse(startTime);

            const windowStart =
                Date.parse(
                    this.#tripTotals.startTime
                );

            const windowEnd =
                Date.parse(
                    this.#tripTotals.endTime
                );

            if (
                !Number.isFinite(tripStart) ||
                !Number.isFinite(windowStart) ||
                !Number.isFinite(windowEnd) ||
                tripStart < windowStart ||
                tripStart > windowEnd
            ) {
                return false;
            }

            const production = {
                ...this.#tripTotals.aggregateBreakdown.production
            };

            const nonProductionTrips =
                this.#tripTotals.aggregateBreakdown.nonProduction.trips
                    .map(
                        trip => ({
                            ...trip
                        })
                    );

            if (nonProduction) {
                nonProductionTrips.push({
                    standardTimeMilliseconds,
                    actualTimeMilliseconds,
                    countedTimeMilliseconds
                });
            }
            else {
                this.#addTripAggregateSummary(
                    production,
                    {
                        tripCount: 1,
                        standardTimeMilliseconds,
                        actualTimeMilliseconds,
                        countedTimeMilliseconds
                    }
                );
            }

            const breakdown =
                this.#buildAggregateBreakdown(
                    production,
                    nonProductionTrips
                );

            const selected =
                this.#composeAggregateSummary(
                    breakdown,
                    this.#nonProductionFilter
                );

            this.#tripTotals = {
                startTime:
                    this.#tripTotals.startTime,
                endTime:
                    this.#tripTotals.endTime,
                ...selected,
                nonProductionFilter:
                    this.#nonProductionFilter,
                aggregateBreakdown:
                    breakdown
            };

            return true;
        }

        #invalidateAggregateSnapshot(
            source = "automatic"
        ) {
            if (!this.#tripTotals) {
                return;
            }

            this.#tripTotals =
                undefined;

            this.#handleTripGoalChange(
                source
            );
        }

        async calculateTripTotals(
            startTime,
            endTime
        ) {
            const start =
                this.#normalizeTripTotalsDateTime(
                    startTime,
                    "startTime"
                );

            const end =
                this.#normalizeTripTotalsDateTime(
                    endTime,
                    "endTime"
                );

            if (
                end.getTime() <=
                    start.getTime()
            ) {
                throw new RangeError(
                    "endTime must be later than startTime."
                );
            }

            const normalizedStart =
                start.toISOString();

            const normalizedEnd =
                end.toISOString();

            const criteriaChanged =
                Boolean(
                    this.#tripTotals &&
                    (
                        this.#tripTotals.startTime !==
                            normalizedStart ||
                        this.#tripTotals.endTime !==
                            normalizedEnd
                    )
                );

            if (!(await this.#ensureConnected())) {
                if (criteriaChanged) {
                    this.#invalidateAggregateSnapshot(
                        "automatic"
                    );
                }

                const error =
                    new Error(
                        "ClockTimer is offline."
                    );

                error.clockTimerOffline =
                    true;

                throw error;
            }

            await this.#syncCompletedTrips();

            const query = {
                startTime:
                    normalizedStart,
                endTime:
                    normalizedEnd,
                nonProductionFilter:
                    this.#nonProductionFilter
            };

            if (
                Number.isInteger(
                    this.#tripId
                ) &&
                this.#tripId > 0
            ) {
                query.excludeTripId =
                    this.#tripId;
            }

            let data;

            try {
                data =
                    await this.#apiRequest(
                        "trips",
                        { query }
                    );
            }
            catch (error) {
                if (
                    criteriaChanged &&
                    error?.clockTimerOffline
                ) {
                    this.#invalidateAggregateSnapshot(
                        "automatic"
                    );
                }

                throw error;
            }

            const breakdown =
                this.#normalizeAggregateBreakdown(
                    data.aggregateBreakdown
                );

            const selected =
                this.#composeAggregateSummary(
                    breakdown,
                    this.#nonProductionFilter
                );

            this.#tripTotals = {
                startTime:
                    normalizedStart,
                endTime:
                    normalizedEnd,
                ...selected,
                nonProductionFilter:
                    this.#nonProductionFilter,
                aggregateBreakdown:
                    breakdown
            };

            this.#emitAggregateReconnectSyncIfChanged();

            this.#handleTripGoalChange(
                this.#renderedPercentGoalSourceOverride ??
                "user"
            );

            return {
                ...this.#tripTotals,
                aggregateBreakdown: {
                    production: {
                        ...breakdown.production
                    },
                    nonProduction: {
                        all: {
                            ...breakdown.nonProduction.all
                        },
                        helpful: {
                            ...breakdown.nonProduction.helpful
                        },
                        nonHelpful: {
                            ...breakdown.nonProduction.nonHelpful
                        },
                        productive: {
                            ...breakdown.nonProduction.productive
                        },
                        trips:
                            breakdown.nonProduction.trips.map(
                                trip => ({
                                    ...trip
                                })
                            )
                    }
                }
            };
        }

        calculateTripGoalFromTotal(
            standardTime = this.#standardTime
        ) {
            let standardDuration =
                this.#standardDuration;

            if (
                standardTime !== this.#standardTime ||
                !Number.isFinite(standardDuration)
            ) {
                try {
                    standardDuration =
                        this.#validateDurationTime(
                            standardTime,
                            "standardTime"
                        ).total;
                }
                catch {
                    return null;
                }
            }

            const result =
                this.#calculateTripGoalFromTotalDuration(
                    standardDuration
                );

            return Number.isFinite(result.tripGoal)
                ? result.tripGoal
                : null;
        }

        calculateTotalGoalRequirements() {
            return {
                ...this.#calculateTotalGoalRequirements()
            };
        }

        calculateGoalRequirements() {
            return {
                ...this.#calculateGoalRequirements()
            };
        }

        #goalChangeFailure(reason) {
            const result = {
                applied: false,
                connected:
                    this.#connectionState ===
                        "connected",
                ...this.#emptyGoalRequirements(),
                reason
            };

            this.#emitClockTimerEvent("goalChangeFailed", {
                ...result,
                tripGoal: this.#getTripGoal(),
                totalGoal: this.#getTotalGoal()
            });

            return result;
        }

        setTripGoalToTotalGoal() {
            const reason =
                this.#getTotalGoalRequirementFailureReason();

            if (reason) {
                return this.#goalChangeFailure(reason);
            }

            const requirements =
                this.#calculateTotalGoalRequirements({
                    allowMissed: true
                });

            if (
                !Number.isFinite(requirements.tripGoal) ||
                requirements.tripGoal <= 0
            ) {
                return this.#goalChangeFailure("insufficient-time");
            }

            const previousMatchedTripGoal =
                this.#matchedTripGoal;

            this.#matchedTripGoal =
                requirements.tripGoal;

            this.#handleTripGoalChange(
                this.#renderedPercentGoalSourceOverride === "start"
                    ? "start"
                    : "automatic"
            );

            if (
                previousMatchedTripGoal !==
                    this.#matchedTripGoal
            ) {
                this.#emitClockTimerEvent(
                    "tripGoalAutomaticallySet",
                    {
                        previousValue:
                            Number.isFinite(previousMatchedTripGoal)
                                ? `${previousMatchedTripGoal * 100}%`
                                : null,
                        value:
                            `${this.#matchedTripGoal * 100}%`,
                        tripGoal:
                            this.#getTripGoal(),
                        userTripGoal:
                            this.#getUserTripGoal(),
                        matchedTripGoal:
                            this.#matchedTripGoal,
                        totalGoal:
                            this.#getTotalGoal(),
                        source:
                            "automatic-total",
                        userInitiated:
                            false
                    }
                );
            }

            return {
                applied: true,
                connected:
                    this.#connectionState ===
                        "connected",
                ...requirements,
                reason: null
            };
        }

        async resumeConnection() {
            const connected =
                await this.#ensureConnected();

            if (!connected) {
                return false;
            }

            try {
                await this.#syncCompletedTrips();
                if (this.#hasStartProperties()) {
                    await this.#ensureTripPersisted();
                    await this.#syncTripEvents();
                }
                else {
                    await this.restoreActiveTrip();
                }

                await this.#refreshAggregateSnapshotAfterReconnect();
            }
            catch (error) {
                if (error?.clockTimerOffline) {
                    return false;
                }

                throw error;
            }

            return true;
        }

        async connect(username, password) {
            if (typeof username !== "string" || username.trim() === "" || typeof password !== "string") {
                throw new TypeError("username and password are required.");
            }

            let data;

            try {
                data = await this.#apiRequest("users", {
                    method: "POST",
                    body: { action: "connect", username: username.trim(), password }
                });

                if (
                    typeof data.csrfToken !== "string" ||
                    data.csrfToken.length < 32
                ) {
                    throw new Error(
                        "The API did not return a CSRF token."
                    );
                }
            }
            catch (error) {
                this.#setOffline({
                    source: "connect",
                    reason: "failed"
                });

                this.#connectionFailed(
                    "connect",
                    error
                );

                throw error;
            }

            this.#setConnected(
                data.csrfToken,
                {
                    source: "connect",
                    user: data.user,
                    calendars: data.calendars
                }
            );

            await this.#syncCompletedTrips();
            if (this.#hasStartProperties()) {
                await this.#ensureTripPersisted();
                await this.#syncTripEvents();
            }
            else {
                await this.restoreActiveTrip();
            }

            await this.#refreshAggregateSnapshotAfterReconnect();

            return { connected: true, user: data.user };
        }

        async restoreActiveTrip() {
            if (this.#hasStartProperties()) {
                return {
                    restored: false,
                    reason: "local-active-trip",
                    tripId: this.#tripId,
                    state: this.uiState
                };
            }
            if (this.#connectionState !== "connected") {
                return {restored: false, reason: "offline", tripId: null, state: this.uiState};
            }
            const data = await this.#apiRequest("trips", {query: {result: "active"}});
            const tripId = Number(data?.activeTripId);
            if (!Number.isInteger(tripId) || tripId < 1) {
                this.#emitUIState("activeTripChecked");
                return {restored: false, reason: "none", tripId: null, state: this.uiState};
            }
            await this.loadTrip(tripId);
            const state = this.getUIState(new Date(), {
                previousState: "ready",
                transition: "active_trip_restored",
                phase: "settled",
                transitionId: this.#uiTransitionId
            });
            this.#uiState = state;
            this.#emitClockTimerEvent("activeTripRestored", {tripId, state});
            return {restored: true, reason: null, tripId, state: this.uiState};
        }

        async disconnect() {
            const wasConnected =
                this.#connectionState === "connected" &&
                Boolean(this.#csrfToken);

            let remote = false;

            try {
                if (wasConnected) {
                    await this.#apiRequest("users", {
                        method: "POST",
                        csrf: true,
                        body: { action: "disconnect" }
                    });
                    remote = true;
                }
            }
            catch (error) {
                if (!error?.clockTimerOffline) {
                    throw error;
                }
            }
            finally {
                this.#setOffline({
                    source: "disconnect",
                    remote
                });
            }

            return {
                connected: false,
                remote
            };
        }

        async prepareTrip({ timeout = 5000, at } = {}) {
            const timeoutMilliseconds = Number(timeout);
            if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
                throw new RangeError("timeout must be a positive number of milliseconds.");
            }

            const now = at === undefined
                ? new Date()
                : at instanceof Date
                    ? new Date(at.getTime())
                    : new Date(at);
            if (Number.isNaN(now.getTime())) {
                throw new TypeError("at must be a valid Date or date-time value.");
            }
            const time = this.#dateToStandardTime(now);
            const clientToken =
                globalThis.crypto?.randomUUID?.() ??
                "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                    /[xy]/g,
                    character => {
                        const random =
                            Math.floor(Math.random() * 16);
                        const value =
                            character === "x"
                                ? random
                                : (random & 0x3) | 0x8;
                        return value.toString(16);
                    }
                );

            const prepared = {
                clientToken,
                creationTime: time,
                scheduledStart: time,
                startTime: time,
                creationDate: now.toISOString(),
                tripId: undefined,
                persisted: false,
                pending: true,
                reason: this.#connectionState === "connected" ? "pending" : "offline"
            };

            this.#preparedTrip = prepared;
            if (this.#eventsReady) this.#emitUIState("prepared");

            if (this.#connectionState !== "connected") {
                return { ...prepared };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

            try {
                const data = await this.#apiRequest("trips", {
                    method: "POST",
                    csrf: true,
                    signal: controller.signal,
                    body: {
                        action: "prepare",
                        startTime: now.toISOString(),
                        clientToken
                    }
                });

                const tripId = Number(data.tripId);
                if (!Number.isInteger(tripId) || tripId < 1) {
                    throw new Error("The API returned an invalid trip id.");
                }

                if (this.#preparedTrip?.clientToken === clientToken) {
                    this.#preparedTrip.tripId = tripId;
                    this.#preparedTrip.persisted = true;
                    this.#preparedTrip.pending = true;
                    this.#preparedTrip.reason = "online";
                    this.#tripId = tripId;
                }

                return {
                    ...prepared,
                    tripId,
                    persisted: true,
                    pending: true,
                    reason: "online"
                };
            }
            catch (error) {
                const reason = error?.name === "AbortError" ? "timeout" : "offline";
                if (this.#preparedTrip?.clientToken === clientToken) {
                    this.#preparedTrip.persisted = false;
                    this.#preparedTrip.reason = reason;
                }
                return {
                    ...prepared,
                    persisted: false,
                    reason
                };
            }
            finally {
                clearTimeout(timeoutId);
            }
        }

        async discardPreparedTrip() {
            const prepared = this.#preparedTrip;
            if (!prepared) return { discarded: false, persisted: false };

            this.#preparedTrip = undefined;
            if (!this.#hasStartProperties()) {
                this.#tripId = undefined;
            }

            if (this.#connectionState !== "connected") {
                return { discarded: true, persisted: false };
            }

            try {
                const body = prepared.clientToken
                    ? { clientToken: prepared.clientToken }
                    : { tripId: Number(prepared.tripId) };
                await this.#apiRequest("trips", {
                    method: "DELETE",
                    csrf: true,
                    body
                });
                return { discarded: true, persisted: true };
            }
            catch {
                return { discarded: true, persisted: false };
            }
        }

        async loadTrip(tripId) {
            const numericTripId =
                Number(tripId);

            if (
                !Number.isInteger(
                    numericTripId
                ) ||
                numericTripId < 1
            ) {
                throw new TypeError(
                    "tripId must be a positive integer."
                );
            }

            if (!(await this.#ensureConnected())) {
                const error =
                    new Error(
                        "ClockTimer is offline."
                    );

                error.clockTimerOffline =
                    true;

                throw error;
            }

            const data =
                await this.#apiRequest(
                    "trip-events",
                    {
                        query: {
                            tripId:
                                numericTripId
                        }
                    }
                );

            const events =
                Array.isArray(data.events)
                    ? [...data.events]
                    : [];

            events.sort(
                (left, right) => {
                    const leftTime =
                        this.#parseTripEventTimestamp(
                            left?.timestamp
                        ).getTime();

                    const rightTime =
                        this.#parseTripEventTimestamp(
                            right?.timestamp
                        ).getTime();

                    return (
                        leftTime -
                            rightTime ||
                        Number(left?.id ?? 0) -
                            Number(right?.id ?? 0)
                    );
                }
            );

            const startedEvent =
                events.find(
                    event =>
                        event?.event ===
                            "trip.started"
                );

            if (!startedEvent) {
                throw new Error(
                    "The trip does not contain a trip.started event."
                );
            }

            const startedValue =
                startedEvent.value;

            if (
                !startedValue ||
                typeof startedValue !==
                    "object" ||
                typeof startedValue.standardTime !==
                    "string"
            ) {
                throw new Error(
                    "The trip.started event is invalid."
                );
            }

            const previousEventsReady =
                this.#eventsReady;

            this.#eventsReady =
                false;

            this.#replayingTripEvents =
                true;

            this.#stopTickTimer();

            try {
                this.#pendingTripEvents =
                    [];

                // Replay replaces the current local model without stopping the persisted trip.
                this.#started = false;
                this.#clearLocal();

                if (
                    typeof startedValue.intervalElapsedBehavior ===
                        "string"
                ) {
                    this.#intervalElapsedBehavior =
                        this.#normalizeIntervalElapsedBehavior(
                            startedValue.intervalElapsedBehavior,
                            this.#intervalElapsedBehavior
                        );
                }

                this.#autoRestartTripAfterLateBreak =
                    startedValue.autoRestartTripAfterLateBreak ===
                        true;

                const startResult =
                    this.#startLocal({
                        tripId:
                            numericTripId,
                        standardTime:
                            startedValue.standardTime,
                        creationTime:
                            startedValue.creationTime,
                        startTime:
                            startedValue.startTime,
                        scheduledStart:
                            startedValue.scheduledStart,
                        nonProduction:
                            startedValue.nonProduction ===
                                true
                    });

                if (!startResult) {
                    throw new Error(
                        "The trip.started event could not be replayed."
                    );
                }

                this.#tripId =
                    numericTripId;

                if (
                    typeof startedValue.creationAnchor ===
                        "string"
                ) {
                    const creationAnchor =
                        this.#parseTripEventTimestamp(
                            startedValue.creationAnchor
                        );

                    this.#creationDateOverride =
                        creationAnchor;
                }

                for (const event of events) {
                    if (
                        event === startedEvent ||
                        event?.event ===
                            "trip.started"
                    ) {
                        continue;
                    }

                    const value =
                        event?.value &&
                        typeof event.value ===
                            "object"
                            ? event.value
                            : {};

                    const eventDate =
                        this.#parseTripEventTimestamp(
                            event?.timestamp
                        );

                    switch (event?.event) {
                        case "interval.started": {
                            const inserted =
                                this.#startIntervalLocal(
                                    value.type,
                                    value.length ??
                                        undefined,
                                    value.attributes ??
                                        {},
                                    value.startBuffer ??
                                        undefined,
                                    value.endBuffer ??
                                        undefined,
                                    eventDate
                                );

                            if (!inserted) {
                                throw new Error(
                                    "An interval.started event could not be replayed."
                                );
                            }

                            const record =
                                this.#insertedRanges.find(
                                    candidate =>
                                        candidate.id ===
                                            inserted.clockTimerInserted
                                );

                            if (!record) {
                                throw new Error(
                                    "A replayed interval record could not be resolved."
                                );
                            }

                            record.clockTimerEventKey =
                                String(
                                    value.intervalKey ??
                                    ("event-" + event.id)
                                );

                            const eventId =
                                Number(
                                    event.id
                                );

                            if (
                                Number.isInteger(
                                    eventId
                                ) &&
                                eventId > 0
                            ) {
                                this.#assignIntervalDatabaseId(
                                    record,
                                    eventId
                                );
                            }

                            break;
                        }

                        case "interval.elapsed": {
                            const intervalKey =
                                String(
                                    value.intervalKey ??
                                        ""
                                );

                            const record =
                                this.#insertedRanges.find(
                                    candidate =>
                                        candidate.clockTimerEventKey ===
                                            intervalKey
                                );

                            if (!record) {
                                throw new Error(
                                    "An interval.elapsed event references an unknown interval."
                                );
                            }

                            const previousBehavior =
                                this.#intervalElapsedBehavior;

                            const behavior =
                                this.#normalizeIntervalElapsedBehavior(
                                    value.behavior,
                                    previousBehavior
                                );

                            this.#intervalElapsedBehavior =
                                behavior;

                            this.#pendingIntervalRecord =
                                record;

                            record.clockTimerElapsedDispatched =
                                false;

                            try {
                                const timeline =
                                    this.#dateToTimelineTime(
                                        eventDate
                                    );

                                if (
                                    !this.#updateIntervalElapsed(
                                        timeline
                                    )
                                ) {
                                    throw new Error(
                                        "An interval.elapsed event could not be replayed."
                                    );
                                }
                            }
                            finally {
                                this.#intervalElapsedBehavior =
                                    previousBehavior;
                            }

                            break;
                        }

                        case "interval.ended": {
                            const intervalKey =
                                String(
                                    value.intervalKey ??
                                        ""
                                );

                            const record =
                                this.#insertedRanges.find(
                                    candidate =>
                                        candidate.clockTimerEventKey ===
                                            intervalKey
                                );

                            if (!record) {
                                throw new Error(
                                    "An interval.ended event references an unknown interval."
                                );
                            }

                            if (
                                this.#pendingIntervalRecord !==
                                    record &&
                                this.#openEndedRange !==
                                    record
                            ) {
                                this.#pendingIntervalRecord =
                                    record;
                            }

                            if (
                                !this.#endIntervalLocal(
                                    eventDate
                                )
                            ) {
                                throw new Error(
                                    "An interval.ended event could not be replayed."
                                );
                            }

                            break;
                        }

                        case "interval.approval-changed": {
                            const intervalKey =
                                String(
                                    value.intervalKey ??
                                        ""
                                );

                            const record =
                                this.#insertedRanges.find(
                                    candidate =>
                                        candidate.clockTimerEventKey ===
                                            intervalKey
                                );

                            if (!record) {
                                throw new Error(
                                    "An interval approval event references an unknown interval."
                                );
                            }

                            const previousDuration =
                                this.#getIntervalEffectiveDuration(
                                    record
                                );

                            this.#setIntervalApprovalAttributes(
                                record,
                                value.state,
                                value.value
                            );

                            const nextDuration =
                                this.#getIntervalEffectiveDuration(
                                    record
                                );

                            if (
                                Number.isFinite(
                                    previousDuration
                                ) &&
                                Number.isFinite(
                                    nextDuration
                                )
                            ) {
                                this.#adjustCalculatedEndTime(
                                    nextDuration -
                                        previousDuration
                                );
                            }

                            break;
                        }

                        case "interval.deleted": {
                            const intervalKey =
                                String(
                                    value.intervalKey ??
                                        ""
                                );

                            const record =
                                this.#insertedRanges.find(
                                    candidate =>
                                        candidate.clockTimerEventKey ===
                                            intervalKey
                                );

                            if (!record) {
                                break;
                            }

                            record.clockTimerPendingDelete =
                                true;

                            if (
                                this.#pendingIntervalRecord ===
                                    record
                            ) {
                                this.#pendingIntervalRecord =
                                    undefined;
                            }

                            this.#insertedRanges =
                                this.#insertedRanges.filter(
                                    candidate =>
                                        candidate !==
                                            record
                                );

                            break;
                        }

                        case "trip.interval-elapsed-behavior-changed":
                            if (
                                typeof value.value ===
                                    "string"
                            ) {
                                this.intervalElapsedBehavior =
                                    value.value;
                            }
                            break;

                        case "trip.auto-restart-after-late-break-changed":
                            this.autoRestartTripAfterLateBreak =
                                value.value === true;
                            break;

                        case "trip.standard-time-changed":
                            if (typeof value.nonProduction === "boolean") this.#nonProduction = value.nonProduction;
                            this.standardTime =
                                value.value;
                            break;

                        case "trip.creation-date-changed":
                            if (
                                typeof value.creationAnchor ===
                                    "string"
                            ) {
                                this.#creationDateOverride =
                                    this.#parseTripEventTimestamp(
                                        value.creationAnchor
                                    );
                            }
                            else {
                                this.creationDate =
                                    value.value;
                            }
                            break;

                        case "trip.creation-time-changed":
                            this.creationTime =
                                value.value;
                            break;

                        case "trip.scheduled-start-changed":
                            this.scheduledStart =
                                value.value;
                            break;

                        case "trip.start-time-changed":
                            this.startTime =
                                value.value;
                            break;

                        case "trip.stopped": {
                            const stopTimeline =
                                this.#dateToTimelineTime(
                                    eventDate
                                );

                            if (
                                !Number.isFinite(
                                    stopTimeline
                                ) ||
                                !this.#stopLocal(
                                    this.#formatTimelineTime(
                                        stopTimeline
                                    ),
                                    stopTimeline
                                )
                            ) {
                                throw new Error(
                                    "The trip.stopped event could not be replayed."
                                );
                            }

                            break;
                        }
                    }
                }

                this.#renderAllInsertedRanges();

                if (!this.#started) {
                    this.#refreshRingLayout(
                        this.#getSummaryTimelineNow(
                            new Date()
                        ),
                        {
                            refreshTickMarks:
                                true
                        }
                    );
                }
            }
            catch (error) {
                this.#clearLocal();

                this.#tripId =
                    undefined;

                throw error;
            }
            finally {
                this.#replayingTripEvents =
                    false;

                this.#eventsReady =
                    previousEventsReady;
            }

            if (this.#started) {
                this.#tick();
            }

            if (this.#needsTick()) {
                this.#startTickTimer();
            }

            const summary =
                this.#buildSummarySnapshot(
                    new Date()
                );

            this.#emitClockTimerEvent(
                "tripLoaded",
                {
                    tripId:
                        numericTripId,
                    eventCount:
                        events.length,
                    summary
                }
            );

            return {
                tripId:
                    numericTripId,
                eventCount:
                    events.length,
                summary
            };
        }

        async start(options = {}) {
            if (options === null || typeof options !== "object" || Array.isArray(options)) {
                throw new TypeError("start options must be an object.");
            }

            const tripTotalsWindow =
                this.#tripTotals &&
                typeof this.#tripTotals.startTime === "string" &&
                typeof this.#tripTotals.endTime === "string"
                    ? {
                        startTime: this.#tripTotals.startTime,
                        endTime: this.#tripTotals.endTime
                    }
                    : undefined;

            const prepared = this.#preparedTrip;
            const { tripId: ignoredTripId, ...localOptions } = options;
            if (prepared) {
                if (localOptions.creationTime === undefined) localOptions.creationTime = prepared.creationTime;
                if (localOptions.startTime === undefined) localOptions.startTime = prepared.startTime;
                if (localOptions.scheduledStart === undefined) localOptions.scheduledStart = prepared.scheduledStart ?? prepared.startTime;
            }
            const preparedTripId = Number.isInteger(Number(prepared?.tripId)) && Number(prepared.tripId) > 0
                ? Number(prepared.tripId)
                : undefined;
            const localResult = this.#startLocal({ ...localOptions, tripId: preparedTripId });
            if (!localResult) {
                throw new Error("The trip could not be started.");
            }
            this.#tripId = preparedTripId;
            if (options.creationDate !== undefined) this.creationDate = options.creationDate;
            this.#pendingIntervalRecord = undefined;

            const startEventTimeline =
                this.#getStartTimeMilliseconds();

            const startEventTime =
                this.#timelineToISO(
                    startEventTimeline
                ) ??
                new Date().toISOString();

            this.#queueTripEvent(
                "trip.started",
                startEventTime,
                {
                    standardTime:
                        this.#standardTime,
                    creationTime:
                        this.#creationTime,
                    scheduledStart:
                        this.#formatStandardTime(this.#scheduledStartMilliseconds),
                    startTime:
                        this.#formatStandardTime(
                            startEventTimeline
                        ),
                    creationAnchor:
                        this.#getJSONCreationDate()
                            ?.toISOString?.(),
                    nonProduction:
                        this.#nonProduction,
                    intervalElapsedBehavior:
                        this.#intervalElapsedBehavior,
                    autoRestartTripAfterLateBreak:
                        this.#autoRestartTripAfterLateBreak
                }
            );

            let synced = false;
            if (this.#connectionState === "connected") {
                try {
                    await this.#ensureTripPersisted();
                    await this.#syncTripEvents();
                    synced = true;
                }
                catch (error) {
                    if (!error?.clockTimerOffline) {
                        throw error;
                    }
                }
            }

            if (synced && prepared && this.#preparedTrip === prepared) {
                this.#preparedTrip = undefined;
            }

            if (this.#autoSyncTripGoal) {
                const previousRenderedPercentGoalSourceOverride =
                    this.#renderedPercentGoalSourceOverride;

                this.#renderedPercentGoalSourceOverride =
                    "start";

                try {
                    if (
                        tripTotalsWindow &&
                        this.#connectionState === "connected"
                    ) {
                        try {
                            await this.calculateTripTotals(
                                tripTotalsWindow.startTime,
                                tripTotalsWindow.endTime
                            );
                        }
                        catch {}
                    }

                    this.setTripGoalToTotalGoal();
                }
                finally {
                    this.#renderedPercentGoalSourceOverride =
                        previousRenderedPercentGoalSourceOverride;
                }
            }

            const result = this.#mutationResult(synced);
            const actualStartTime =
                this.#getStartTimeMilliseconds();
            const scheduledStartTime =
                this.#scheduledStartMilliseconds;

            const summary = this.#buildSummarySnapshot(new Date());
            const timing =
                this.#getTimingDetail(
                    actualStartTime,
                    scheduledStartTime
                );

            const startedDetail = {
                ...result,
                summary,
                ...timing,
                actualStartTime:
                    this.#timelineToISO(
                        actualStartTime
                    ),
                scheduledStartTime:
                    this.#timelineToISO(
                        scheduledStartTime
                    ),
                nonProduction:
                    this.#nonProduction
            };

            this.#emitClockTimerEvent(
                "started",
                startedDetail
            );

            this.#emitClockTimerEvent(
                timing.early
                    ? "tripStartedEarly"
                    : timing.late
                        ? "tripStartedLate"
                        : "tripStarted",
                startedDetail
            );

            return result;
        }

        async stop(stopTime = this.#dateToStandardTime(new Date())) {
            const parsed = this.#validateClockTime(stopTime, "stopTime");
            const stopTimeline = this.#resolveNear(parsed.total, this.#getCurrentTimelineTime());
            const persistedEnd = this.#timelineToISO(stopTimeline);
            const aggregateStartTimeline =
                this.#getElapsedStartTimeMilliseconds();
            const aggregateStartTime =
                this.#timelineToISO(
                    aggregateStartTimeline
                );
            const aggregateStandardTime =
                this.#standardDuration;
            const aggregateCountedTime =
                this.#getCountedTimeElapsed(
                    stopTimeline
                );
            const aggregateNonProduction =
                this.#nonProduction;

            this.#checkGoalMisses(stopTimeline);
            const localResult = this.#stopLocal(stopTime);
            if (!localResult || !persistedEnd) {
                throw new Error("The trip could not be stopped.");
            }
            this.#matchedTripGoal = undefined;
            this.#handleTripGoalChange("automatic");
            this.#pendingIntervalRecord = undefined;

            if (
                !this.#tripAddedToAggregate &&
                Number.isFinite(
                    aggregateStartTimeline
                )
            ) {
                this.#addCompletedTripToCachedTotals({
                    startTime:
                        aggregateStartTime,
                    standardTimeMilliseconds:
                        aggregateStandardTime,
                    actualTimeMilliseconds:
                        stopTimeline -
                        aggregateStartTimeline,
                    countedTimeMilliseconds:
                        aggregateCountedTime,
                    nonProduction:
                        aggregateNonProduction
                });

                this.#tripAddedToAggregate =
                    true;
            }

            this.#queueTripEvent(
                "trip.stopped",
                persistedEnd,
                {
                    standardTimeMilliseconds:
                        Math.round(
                            this.#standardDuration
                        ),
                    countedTimeMilliseconds:
                        Math.round(
                            aggregateCountedTime
                        )
                }
            );

            const synced = await this.#protectedSync(async () => {
                await this.#syncTripEvents();
            });
            const result = this.#mutationResult(synced);
            const summary = this.#buildSummarySnapshot(new Date());
            const stoppedDetail = {
                ...result,
                summary,
                stopTime: persistedEnd
            };

            this.#emitClockTimerEvent(
                "stopped",
                stoppedDetail
            );

            this.#emitClockTimerEvent(
                "tripEnded",
                stoppedDetail
            );

            return result;
        }

        async resetCompletedTrip() {
            if (this.#started || !this.#hasStartProperties()) {
                throw new Error("Only a completed trip can be reset.");
            }
            // Upload when possible, but keep completed work separate from the
            // next trip so ending offline can still reset the main clock.
            const synced = await this.#protectedSync(async () => {
                await this.#ensureTripPersisted();
                await this.#syncTripEvents();
            });
            if (!synced) {
                const payload = this.#tripPersistencePayload();
                payload.clientToken ??= this.#createTripEventClientToken();
                const summary = this.#buildSummarySnapshot(new Date()).trip;
                this.#completedTripQueue.push({
                    userId: this.#syncUserId,
                    tripId: this.#tripId,
                    pending: this.#preparedTrip?.pending === true,
                    payload,
                    log: {...payload,
                        actualTimeMilliseconds: summary.actualTimeElapsedMilliseconds,
                        countedTimeMilliseconds: summary.countedTimeElapsedMilliseconds,
                        events: this.#localLogEvents(this.toJSON())},
                    events: this.#pendingTripEvents.map(({event, timestamp, value, clientToken, synced}) =>
                        ({event, timestamp, value, clientToken, synced}))
                });
                if (!this.#saveCompletedTrips()) {
                    this.#completedTripQueue.pop();
                    throw new Error("The completed trip could not be buffered locally. Free browser storage and try again.");
                }
            }
            const tripId = this.#tripId;
            if (!this.#clearLocal()) throw new Error("The completed trip could not be reset.");
            this.#tripId = undefined;
            this.#preparedTrip = undefined;
            if (this.#eventsReady) this.#emitUIState("preparedTripDiscarded");
            this.#pendingIntervalRecord = undefined;
            this.#pendingTripEvents = [];
            const result = {synced, connected: this.#connectionState === "connected", tripId, intervalId: undefined};
            this.#emitClockTimerEvent("cleared", result);
            return result;
        }

        async clear() {
            const oldTripId = this.#tripId;
            const connected = this.#connectionState === "connected";
            const proceed = this.#emitClockTimerEvent("clearing", {
                tripId: Number.isInteger(oldTripId) ? oldTripId : undefined
            }, {
                cancelable: !connected
            });

            if (!proceed) {
                return {
                    synced: false,
                    connected:
                        this.#connectionState ===
                            "connected",
                    tripId: Number.isInteger(oldTripId) ? oldTripId : undefined,
                    intervalId: undefined,
                    canceled: true
                };
            }

            let synced = false;

            if (this.#hasStartProperties()) {
                synced = await this.#protectedSync(async () => {
                    const tripId = await this.#ensureTripPersisted();
                    await this.#syncTripEvents();
                    await this.#apiRequest("trips", {
                        method: "DELETE",
                        csrf: true,
                        body: { tripId }
                    });
                });
            }

            const localResult = this.#clearLocal();
            if (!localResult) {
                throw new Error("The trip could not be cleared.");
            }
            const resultTripId = this.#tripId ?? oldTripId;
            this.#tripId = undefined;
            this.#pendingIntervalRecord = undefined;
            this.#pendingTripEvents =
                [];
            const result = {
                synced,
                connected:
                    this.#connectionState ===
                        "connected",
                tripId: Number.isInteger(resultTripId) ? resultTripId : undefined,
                intervalId: undefined
            };
            this.#emitClockTimerEvent("cleared", result);
            return result;
        }

        async startInterval(
            type,
            length,
            attributes,
            startBuffer,
            endBuffer
        ) {
            const localResult =
                this.#startIntervalLocal(
                    type,
                    length,
                    attributes,
                    startBuffer,
                    endBuffer
                );

            if (!localResult) {
                throw new Error("The interval could not be started.");
            }

            const insertedId =
                localResult?.clockTimerInserted;

            const record =
                insertedId !== undefined
                    ? this.#insertedRanges.find(
                        candidate =>
                            candidate.id ===
                                insertedId
                    )
                    : undefined;

            if (!record) {
                throw new Error("The interval record could not be resolved.");
            }

            if (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#tripTotals
            ) {
                this.#handleTripGoalChange();
            }

            record.clockTimerEventKey ??=
                this.#createTripEventClientToken();

            const intervalEventTime =
                this.#timelineToISO(
                    Number(
                        record.clockTimerBufferedStartTimeline
                    )
                ) ??
                record.startDate?.toISOString?.() ??
                new Date().toISOString();

            this.#queueTripEvent(
                "interval.started",
                intervalEventTime,
                {
                    intervalKey:
                        record.clockTimerEventKey,
                    type:
                        record.type,
                    length:
                        length ?? null,
                    startBuffer:
                        startBuffer ?? null,
                    endBuffer:
                        endBuffer ?? null,
                    attributes:
                        attributes &&
                        typeof attributes === "object" &&
                        !Array.isArray(attributes)
                            ? {
                                ...attributes
                            }
                            : {}
                },
                {
                    record,
                    assignIntervalId:
                        true
                }
            );

            const synced = await this.#protectedSync(async () => {
                await this.#ensureTripPersisted();
                await this.#syncTripEvents();
            });

            const result =
                this.#mutationResult(
                    synced,
                    record
                );

            const startBufferRecord =
                this.#getIntervalBufferRecord(
                    record,
                    "start"
                );

            const endBufferRecord =
                this.#getIntervalBufferRecord(
                    record,
                    "end"
                );

            this.#checkGoalMisses(
                this.#getCurrentTimelineTime()
            );

            const intervalStartedDetail = {
                ...result,
                type: record.type,
                startTime: record.startDate?.toISOString?.(),
                endTime: record.endDate?.toISOString?.(),
                startBufferIntervalId:
                    Number.isInteger(
                        Number(
                            startBufferRecord?.intervalId
                        )
                    )
                        ? Number(
                            startBufferRecord.intervalId
                        )
                        : undefined,
                endBufferIntervalId:
                    Number.isInteger(
                        Number(
                            endBufferRecord?.intervalId
                        )
                    )
                        ? Number(
                            endBufferRecord.intervalId
                        )
                        : undefined
            };

            this.#emitClockTimerEvent(
                "intervalStarted",
                intervalStartedDetail
            );

            this.#emitSemanticIntervalStarted(
                record,
                intervalStartedDetail
            );

            return result;
        }

        async endInterval() {
            const nowDate = new Date();
            const now = this.#getCurrentTimelineTime(nowDate);
            const current = this.#getCurrentInterval(now);
            const pending = this.#pendingIntervalRecord;
            const record =
                pending ??
                (current?.source === "inserted"
                    ? current.record
                    : undefined);
            const elapsedBoundary =
                Number(
                    record?.clockTimerElapsedBoundaryTimeline
                );

            const recordType =
                String(
                    record?.type ?? ""
                ).trim().toLowerCase();

            const bufferedScheduledEnd =
                record &&
                (
                    recordType === "break" ||
                    recordType === "lunch"
                )
                    ? this.#getPendingIntervalElapsedBoundary(
                        record
                    )
                    : undefined;

            const scheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            elapsedBoundary
                        )
                            ? elapsedBoundary
                            : Number.isFinite(
                                bufferedScheduledEnd
                            )
                                ? bufferedScheduledEnd
                                : this.#getIntervalRecordEnd(
                                    record
                                )
                    )
                    : undefined;
            const lifecycleScheduledEnd =
                record
                    ? (
                        Number.isFinite(
                            bufferedScheduledEnd
                        )
                            ? bufferedScheduledEnd
                            : Number.isFinite(
                                Number(
                                    record.clockTimerExtensionOriginalEndTimeline
                                )
                            )
                                ? Number(
                                    record.clockTimerExtensionOriginalEndTimeline
                                )
                                : this.#getIntervalRecordEnd(
                                    record
                                )
                    )
                    : undefined;

            const endedEarly =
                Number.isFinite(scheduledEnd) &&
                now < scheduledEnd;

            const localResult = this.#endIntervalLocal();
            if (!localResult) {
                throw new Error("The interval could not be ended.");
            }

            // Early closed-interval persistence is handled by
            // #endBufferedPendingInterval so an end-buffer can remain
            // scheduled while the factual actual-end is stored separately.

            if (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#tripTotals
            ) {
                this.#handleTripGoalChange();
            }

            record.clockTimerEventKey ??=
                this.#createTripEventClientToken();

            this.#queueTripEvent(
                "interval.ended",
                nowDate,
                {
                    intervalKey:
                        record.clockTimerEventKey,
                    reason:
                        "manual"
                }
            );

            const synced = await this.#protectedSync(async () => {
                await this.#ensureTripPersisted();
                await this.#syncTripEvents();
            });
            const result = this.#mutationResult(synced, record);
            this.#checkGoalMisses(this.#getCurrentTimelineTime());

            const intervalEndedDetail = {
                ...result,
                ...this.#getTimingDetail(
                    now,
                    scheduledEnd
                ),
                type: record?.type,
                startTime: record?.startDate?.toISOString?.(),
                endTime: record?.clockTimerPersistenceEnd ?? record?.endDate?.toISOString?.(),
                actualEndTime:
                    this.#timelineToISO(now),
                scheduledEndTime:
                    this.#timelineToISO(
                        scheduledEnd
                    ),
                automaticRestart: false,
                endReason: "manual"
            };

            this.#emitClockTimerEvent(
                "intervalEnded",
                intervalEndedDetail
            );

            const lifecycleTiming =
                this.#getTimingDetail(
                    now,
                    lifecycleScheduledEnd
                );

            this.#emitSemanticIntervalEnded(
                record,
                {
                    ...intervalEndedDetail,
                    ...lifecycleTiming,
                    scheduledEndTime:
                        this.#timelineToISO(
                            lifecycleScheduledEnd
                        )
                },
                {
                    automaticRestart: false,
                    actualEnd: now
                }
            );

            return result;
        }

        async toggleIntervalApproval(
            interval
        ) {
            const record =
                this.#resolveIntervalApprovalRecord(
                    interval
                );

            const current =
                this.#getIntervalApprovalState(
                    record
                );

            return this.#commitIntervalApproval(
                record,
                current.state === "approved"
                    ? "unapproved"
                    : "approved",
                current.value,
                "intervalApprovalToggled"
            );
        }

        async setIntervalApproval(
            interval,
            value
        ) {
            const record =
                this.#resolveIntervalApprovalRecord(
                    interval
                );

            const current =
                this.#getIntervalApprovalState(
                    record
                );

            const normalized =
                this.#normalizeIntervalApprovalDuration(
                    value
                );

            if (
                current.value ===
                    normalized.value
            ) {
                return {
                    ...this.#mutationResult(
                        true,
                        record
                    ),
                    state:
                        current.state,
                    value:
                        current.value,
                    effectiveDurationMilliseconds:
                        this.#getIntervalEffectiveDuration(
                            record
                        ),
                    calculatedEndTime:
                        this.#timelineToISO(
                            this.#calculatedEndTime
                        )
                };
            }

            return this.#commitIntervalApproval(
                record,
                current.state,
                normalized.value,
                "intervalApprovalChanged"
            );
        }

        async deleteInterval(
            interval
        ) {
            const record =
                this.#resolveIntervalApprovalRecord(
                    interval
                );

            return this.#commitIntervalDeletion(
                record
            );
        }

        #configurationDuration(value, name) {
            if (value === null) return undefined;
            if (Number.isFinite(value) && value >= 0) return Number(value);
            if (typeof value === "string") {
                const text = value.trim();
                const match = text.match(/^(\d+):(\d{2}):(\d{2})$/);
                if (match && Number(match[2]) < 60 && Number(match[3]) < 60) {
                    return (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
                }
            }
            throw new TypeError(`${name} must be milliseconds or h:mm:ss.`);
        }

        #configurationGoal(value, name) {
            if (value === null) return null;
            const parsed = this.#parseGoalValue(String(value), NaN);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                throw new TypeError(`${name} must be a positive ratio or percentage.`);
            }
            return `${Number((parsed * 100).toFixed(6))}%`;
        }

        configure(configuration = {}) {
            if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
                throw new TypeError("configuration must be an object.");
            }
            const has = key => Object.prototype.hasOwnProperty.call(configuration, key);
            const renderedKey = has("rendered_time_type") ? "rendered_time_type" :
                has("renderedTimeType") ? "renderedTimeType" : null;
            const aliases = {
                calculated_start_time: "elapsed",
                calculated_end_time: "calculated-end",
                "calculated_end time": "calculated-end",
                time_remaining: "remaining"
            };
            this.#configuring = true;
            try {
                if (renderedKey) {
                    const rendered = aliases[String(configuration[renderedKey]).trim().toLowerCase()];
                    if (!rendered) throw new RangeError("rendered_time_type is invalid.");
                    this.renderedTimeMode = rendered;
                }
                if (has("goal_type")) this.percentMode = configuration.goal_type;
                if (has("auto_goal")) this.autoSyncTripGoal = Boolean(configuration.auto_goal);
                if (has("trip_goal")) {
                    const value = this.#configurationGoal(configuration.trip_goal, "trip_goal");
                    if (value === null) this.removeAttribute("trip-goal");
                    else this.setAttribute("trip-goal", value);
                }
                if (has("total_goal")) {
                    const value = this.#configurationGoal(configuration.total_goal, "total_goal");
                    if (value === null) this.removeAttribute("total-goal");
                    else this.setAttribute("total-goal", value);
                }
                if (has("external_standard_time")) {
                    this.#externalStandardTime = this.#configurationDuration(
                        configuration.external_standard_time, "external_standard_time");
                }
                if (has("external_counted_time")) {
                    this.#externalCountedTime = this.#configurationDuration(
                        configuration.external_counted_time, "external_counted_time");
                }
                if (has("external_standard_time") || has("external_counted_time")) {
                    this.#handleTripGoalChange("user");
                }
            }
            finally {
                this.#configuring = false;
            }
            this.#emitUIState("configured");
            return this.uiState;
        }

        getSummarySnapshot(now = new Date()) {
            if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
                throw new TypeError("now must be a valid Date.");
            }
            return this.#buildSummarySnapshot(now);
        }

        get autoRestartTripAfterLateBreak() {
            return this.#autoRestartTripAfterLateBreak;
        }

        set autoRestartTripAfterLateBreak(value) {
            const normalized =
                Boolean(value);

            if (
                normalized ===
                    this.#autoRestartTripAfterLateBreak
            ) {
                return;
            }

            this.#autoRestartTripAfterLateBreak =
                normalized;

            if (this.#hasStartProperties()) {
                this.#queueTripEvent(
                    "trip.auto-restart-after-late-break-changed",
                    new Date(),
                    {
                        value:
                            normalized
                    }
                );

                this.#scheduleTripEventSync();
            }
        }

        getActiveIntervalState(now = new Date()) {
            if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
                throw new TypeError("now must be a valid Date.");
            }

            const timelineNow = this.#getCurrentTimelineTime(now);
            const current = this.#getCurrentInterval(timelineNow);
            let record = current?.record;
            let currentType = current?.type;
            let intervalType = current?.type;
            let phase = current?.type;
            let start = current?.start;
            let end = current?.end;
            let open = current?.open === true;

            if (record?.clockTimerBufferedIntervalRecordId) {
                const buffered = this.#insertedRanges.find(
                    candidate => candidate.id === record.clockTimerBufferedIntervalRecordId
                );
                if (buffered) {
                    intervalType = buffered.type;
                    phase = `${record.clockTimerBufferPosition || "buffer"}-buffer`;
                    record = buffered;
                }
            }

            if (!current && this.#pendingIntervalRecord) {
                record = this.#pendingIntervalRecord;
                currentType = "latency";
                intervalType = record.type;
                phase = record.clockTimerElapsedDispatched === true ? "latency" : "pending";
                start = this.#dateToTimelineTime(record.startDate);
                end = Number(record.clockTimerElapsedBoundaryTimeline);
                if (!Number.isFinite(end)) {
                    end = this.#getPendingIntervalElapsedBoundary(record);
                }
                open = false;
            }

            if (!record || !Number.isFinite(start)) {
                return undefined;
            }

            if (
                intervalType === "break" ||
                intervalType === "lunch"
            ) {
                const bufferedEnd =
                    this.#getPendingIntervalElapsedBoundary(
                        record
                    );

                if (Number.isFinite(bufferedEnd)) {
                    end = bufferedEnd;
                }
            }

            const elapsedMilliseconds = Math.max(0, timelineNow - start);
            const remainingMilliseconds = Number.isFinite(end)
                ? end - timelineNow
                : undefined;

            return {
                intervalId: Number.isInteger(Number(record.intervalId))
                    ? Number(record.intervalId)
                    : undefined,
                intervalKey:
                    record.clockTimerEventKey,
                type: currentType,
                intervalType: String(intervalType || currentType || "").trim(),
                phase: String(phase || currentType || "").trim(),
                open,
                startTime: this.#timelineToISO(start),
                boundaryTime: Number.isFinite(end) ? this.#timelineToISO(end) : undefined,
                elapsedMilliseconds,
                remainingMilliseconds
            };
        }

        get state() {
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

        get keepAspectRatio() {
            return this.#keepAspectRatio;
        }

        set keepAspectRatio(value) {
            const next =
                Boolean(
                    value
                );

            if (
                next ===
                    this.#keepAspectRatio
            ) {
                return;
            }

            this.#keepAspectRatio =
                next;

            this.toggleAttribute(
                "data-clock-timer-free-aspect-ratio",
                !next
            );

            this.#syncHandGeometry();
            this.#syncTickMarkGeometry();
            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();
            this.#scheduleResponsiveMetrics();

            if (
                this.#handsStarted &&
                this.isConnected
            ) {
                this.#synchronizeHands(
                    new Date()
                );
            }

            this.#refreshTimeRangeVisualGeometry();
        }

        get percentMode() {
            return this.#percentMode;
        }

        set percentMode(value) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "percentMode must be a string."
                );
            }

            const normalized =
                value.trim().toLowerCase();

            if (
                !new Set([
                    "trip",
                    "total",
                    "auto"
                ]).has(normalized)
            ) {
                throw new RangeError(
                    "percentMode must be trip, total, or auto."
                );
            }

            this.setAttribute(
                "percent-mode",
                normalized
            );
        }

        get renderedPercentGoal() {
            return this.#renderedPercentGoal;
        }

        get renderedPercentGoalScope() {
            return this.#getRenderedPercentScope();
        }

        get renderedTimeMode() {
            return this.#renderedTimeMode;
        }

        set renderedTimeMode(value) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "renderedTimeMode must be a string."
                );
            }

            const normalized =
                value.trim().toLowerCase();

            if (
                !new Set([
                    "remaining",
                    "elapsed",
                    "calculated-end"
                ]).has(normalized)
            ) {
                throw new RangeError(
                    "renderedTimeMode must be remaining, elapsed, or calculated-end."
                );
            }

            if (
                normalized ===
                    this.#renderedTimeMode
            ) {
                return;
            }

            const previousValue =
                this.#renderedTimeMode;

            const now =
                new Date();

            const renderedTime =
                this.#calculateRenderedTime(
                    now,
                    normalized
                );

            this.#renderedTimeMode =
                normalized;

            this.#renderedTime =
                renderedTime;

            this.#emitClockTimerEvent(
                "renderedTimeModeChanged",
                {
                    previousValue,
                    value: normalized,
                    userInitiated: true,
                    renderedTime
                }
            );

            this.#updateDisplay(
                now
            );
        }

        get renderedTime() {
            return this.#renderedTime;
        }

        get nonProduction() {
            return this.#nonProduction;
        }

        get nonProductionFilter() {
            return this.#nonProductionFilter;
        }

        set nonProduction(value) {
            if (typeof value !== "boolean") throw new TypeError("nonProduction must be a boolean.");
            if (value === this.#nonProduction) return;
            this.#nonProduction = value;
            if (this.#hasStartProperties() && !this.#replayingTripEvents) {
                this.#queueTripEvent("trip.standard-time-changed", new Date(), {value:this.standardTime,nonProduction:value});
                this.#scheduleTripEventSync();
            }
        }

        get productionFilter() { return this.#productionFilter; }
        set productionFilter(value) {
            if (!["all","productive","non-productive"].includes(value)) throw new RangeError("Unknown Trip Filter.");
            this.#productionFilter = value;
            if (this.#hasUsableAggregateSnapshot()) this.#recomposeCachedTripTotals();
            this.#handleTripGoalChange("user");
        }

        get currentTripId() { return this.#tripId; }

        async persistCurrentTrip() {
            if (!(await this.#ensureConnected())) throw new Error("Connect before saving trip settings.");
            await this.#ensureTripPersisted();
            await this.#syncTripEvents();
            await this.#apiRequest("trips", {method:"PATCH",csrf:true,body:{
                tripId:this.#tripId,action:"start",...this.#tripPersistencePayload()
            }});
        }

        async tripEditorRequest(tripId, change) {
            const buffered = this.#completedTripQueue.find(trip =>
                String(trip.tripId || `offline-${trip.payload.clientToken}`) === String(tripId));
            if (buffered && this.#connectionState !== "connected") {
                const response = () => ({
                    tripId,
                    events: buffered.log?.events || [],
                    settings: {
                        creationAnchor: buffered.payload.creationAnchor,
                        standardTime: buffered.payload.standardTime,
                        creationTime: buffered.payload.creationTime,
                        scheduledStart: buffered.payload.scheduledStart,
                        startTime: buffered.payload.startTime,
                        nonProduction: buffered.payload.nonProduction === true
                    },
                    revision: `offline-${buffered.payload.clientToken}`
                });
                if (!change) return response();
                if (change.operation === "delete-trip") {
                    buffered.deleted = true;
                    if (!this.#saveCompletedTrips()) throw new Error("The offline edit could not be saved.");
                    return {tripId, deleted: true, queued: true, offline: true};
                }
                if (change.operation === "entries") {
                    const working = JSON.parse(JSON.stringify(buffered));
                    const applyEntry = edit => {
                        const display = working.log.events || [];
                        const entry = edit.entry || {};
                        const selected = display.find(event => String(event.id) === String(entry.eventId));
                        if (edit.operation === "entry" && selected && (selected.event === "trip.started" || selected.event === "trip.stopped")) {
                            const previousTimestamp=selected.timestamp,raw=working.events.find(event=>event.event===selected.event&&event.timestamp===previousTimestamp);
                            selected.timestamp=entry.start;if(raw)raw.timestamp=entry.start;return;
                        }
                        const key = entry.intervalKey || selected?.value?.intervalKey || `offline-edit-${Date.now()}-${Math.random()}`;
                        const findRaw = event => event.event === "interval.started" &&
                            (event.value?.intervalKey === key || event.timestamp === selected?.timestamp);
                        const originalRaw = working.events.find(findRaw);
                        const rawKey = originalRaw?.value?.intervalKey || key;
                        if (edit.operation === "delete-entry") {
                            working.log.events = display.filter(event => event.value?.intervalKey !== key);
                            working.events = working.events.filter(event => event.value?.intervalKey !== rawKey);
                        } else if (edit.operation === "add-entry") {
                            const started = {id:`offline-edit-${Date.now()}-${Math.random()}`,event:"interval.started",timestamp:entry.start,value:{type:entry.type,length:entry.length,intervalKey:key}};
                            working.log.events.push(started);
                            working.events.push({event:started.event,timestamp:started.timestamp,value:{...started.value},clientToken:this.#createTripEventClientToken(),synced:false});
                            if (entry.end) {const ended={id:`${started.id}-end`,event:"interval.ended",timestamp:entry.end,value:{intervalKey:key}};working.log.events.push(ended);working.events.push({event:ended.event,timestamp:ended.timestamp,value:{...ended.value},clientToken:this.#createTripEventClientToken(),synced:false});}
                        } else if (edit.operation === "entry" && selected) {
                            selected.timestamp=entry.start;Object.assign(selected.value,{type:entry.type,length:entry.length,intervalKey:key});
                            if(originalRaw){originalRaw.timestamp=entry.start;Object.assign(originalRaw.value,{type:entry.type,length:entry.length});}
                            const ended=display.find(event=>event.event==="interval.ended"&&event.value?.intervalKey===key),rawEnded=working.events.find(event=>event.event==="interval.ended"&&event.value?.intervalKey===rawKey);
                            if(entry.end&&ended)ended.timestamp=entry.end;if(entry.end&&rawEnded)rawEnded.timestamp=entry.end;
                        } else throw new Error("Entry changed. Reopen the trip.");
                    };
                    for (const edit of change.changes || []) applyEntry(edit);
                    Object.assign(buffered, working);
                    if (!this.#saveCompletedTrips()) throw new Error("The offline edit could not be saved.");
                    return {...response(), offline:true};
                }
                if (change.operation === "settings") {
                    Object.assign(buffered.payload, change.settings);
                    Object.assign(buffered.log, change.settings);
                    const seconds = String(change.settings.standardTime || "").split(":")
                        .reduce((sum, part) => sum * 60 + Number(part || 0), 0);
                    if (Number.isFinite(seconds)) {
                        buffered.log.standardTimeMilliseconds = seconds * 1000;
                        buffered.payload.standardTimeMilliseconds = seconds * 1000;
                        const stopped = buffered.events.find(event => event.event === "trip.stopped");
                        if (stopped) stopped.value.standardTimeMilliseconds = seconds * 1000;
                    }
                    const start = buffered.events.find(event => event.event === "trip.started");
                    if (start) Object.assign(start.value, change.settings);
                }
                else {
                    const display = buffered.log.events || [];
                    const entry = change.entry || {};
                    const selected = display.find(event => String(event.id) === String(entry.eventId));
                    const key = entry.intervalKey || selected?.value?.intervalKey || `offline-edit-${Date.now()}`;
                    const findRaw = event => event.event === "interval.started" &&
                        (event.value?.intervalKey === key || event.timestamp === selected?.timestamp);
                    const originalRaw = buffered.events.find(findRaw);
                    const rawKey = originalRaw?.value?.intervalKey || key;
                    if (change.operation === "delete-entry") {
                        buffered.log.events = display.filter(event => event.value?.intervalKey !== key);
                        buffered.events = buffered.events.filter(event => event.value?.intervalKey !== rawKey);
                    }
                    else if (change.operation === "add-entry") {
                        const started = {id:`offline-edit-${Date.now()}`,event:"interval.started",timestamp:entry.start,
                            value:{type:entry.type,length:entry.length,intervalKey:key}};
                        buffered.log.events.push(started);
                        buffered.events.push({event:started.event,timestamp:started.timestamp,value:{...started.value},
                            clientToken:this.#createTripEventClientToken(),synced:false});
                        if (entry.end) {
                            const ended = {id:`offline-edit-${Date.now()}-end`,event:"interval.ended",timestamp:entry.end,value:{intervalKey:key}};
                            buffered.log.events.push(ended);
                            buffered.events.push({event:ended.event,timestamp:ended.timestamp,value:{...ended.value},
                                clientToken:this.#createTripEventClientToken(),synced:false});
                        }
                    }
                    else if (change.operation === "entry" && selected) {
                        selected.timestamp = entry.start;
                        Object.assign(selected.value, {type:entry.type,length:entry.length,intervalKey:key});
                        const raw = originalRaw;
                        if (raw) {raw.timestamp=entry.start;Object.assign(raw.value,{type:entry.type,length:entry.length});}
                        const ended = display.find(event => event.event === "interval.ended" && event.value?.intervalKey === key);
                        const rawEnded = buffered.events.find(event => event.event === "interval.ended" && event.value?.intervalKey === rawKey);
                        if (entry.end && ended) ended.timestamp=entry.end;
                        if (entry.end && rawEnded) rawEnded.timestamp=entry.end;
                    }
                }
                if (!this.#saveCompletedTrips()) throw new Error("The offline edit could not be saved.");
                return {...response(), offline: true};
            }
            if (!(await this.#ensureConnected())) throw new Error("Connect before editing trips.");
            const active = Number(tripId) === this.#tripId && this.#hasStartProperties();
            if (active && change) this.#stopTickTimer();
            try {
            if (active) { await this.#ensureTripPersisted(); await this.#syncTripEvents(); }
            const result = await this.#apiRequest("trip-editor", change ? {
                method:"POST",csrf:true,body:{tripId,...change}
            } : {query:{tripId}});
            if (change && active) {
                if (change.operation === "delete-trip") {
                    this.#started=false;this.#clearLocal();this.#tripId=undefined;this.#pendingTripEvents=[];this.#preparedTrip=undefined;
                    this.#emitClockTimerEvent("cleared",{tripId,connected:true,synced:true});
                }
                else {
                    const auto = this.autoSyncTripGoal;
                    const goal = this.getAttribute("trip-goal");
                    await this.loadTrip(tripId);
                    this.autoSyncTripGoal = auto;
                    if (goal) this.setAttribute("trip-goal",goal);
                    if (auto) this.setTripGoalToTotalGoal();
                }
            }
            return result;
            } finally {if(active && change && this.#needsTick()) this.#startTickTimer();}
        }

        async downDetailsRequest(tripId,intervalKey,change) {
            if (!(await this.#ensureConnected())) throw new Error("Connect to save Down details.");
            if(change instanceof FormData){change.set("tripId",String(tripId));change.set("intervalKey",String(intervalKey));return this.#apiRequest("down-details",{method:"POST",csrf:true,body:change});}
            return this.#apiRequest("down-details",{query:{tripId,intervalKey}});
        }

        set nonProductionFilter(value) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "nonProductionFilter must be a string."
                );
            }

            const normalized =
                value.trim().toLowerCase();

            if (
                !new Set([
                    "all",
                    "helpful",
                    "productive",
                    "none"
                ]).has(normalized)
            ) {
                throw new RangeError(
                    "nonProductionFilter must be all, helpful, productive, or none."
                );
            }

            if (
                normalized ===
                    this.#nonProductionFilter
            ) {
                return;
            }

            this.#nonProductionFilter =
                normalized;

            if (
                this.#hasUsableAggregateSnapshot()
            ) {
                this.#recomposeCachedTripTotals(
                    normalized
                );
            }
            else if (this.#tripTotals) {
                this.#tripTotals =
                    undefined;
            }

            this.#handleTripGoalChange(
                "user"
            );
        }

        get hasAggregateData() {
            return this.#hasUsableAggregateSnapshot();
        }

        get hasAggregateTrips() {
            return Boolean(
                this.#hasUsableAggregateSnapshot() &&
                this.#tripTotals.tripCount > 0 &&
                this.#tripTotals.standardTimeMilliseconds > 0 &&
                this.#tripTotals.actualTimeMilliseconds > 0
            );
        }

        get autoSyncTripGoal() {
            return this.#autoSyncTripGoal;
        }

        set autoSyncTripGoal(value) {
            if (typeof value !== "boolean") {
                throw new TypeError(
                    "autoSyncTripGoal must be a boolean."
                );
            }

            if (value === this.#autoSyncTripGoal) {
                return;
            }

            this.#autoSyncTripGoal =
                value;

            if (!value) {
                this.#matchedTripGoal =
                    undefined;
            }

            if (this.#hasStartProperties()) {
                this.#handleTripGoalChange(
                    "user"
                );
            }
        }

        get status() {
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
        }

        get originalStandardTime() {
            return this.#originalStartArguments
                ?.standardTime;
        }

        get originalCreationTime() {
            return this.#originalStartArguments
                ?.creationTime;
        }

        get originalScheduledStart() {
            return this.#originalStartArguments
                ?.scheduledStart;
        }

        get originalStartTime() {
            return this.#originalStartArguments
                ?.startTime;
        }

        get creationDate() {
            return this.#formatJSONDate(
                this.#getJSONCreationDate()
            );
        }

        set creationDate(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let next;

            if (value instanceof Date) {
                if (Number.isNaN(value.getTime())) {
                    return;
                }
                next = new Date(
                    value.getFullYear(),
                    value.getMonth(),
                    value.getDate()
                );
            }
            else if (typeof value === "string") {
                const match =
                    value.trim().match(
                        /^(\d{4})-(\d{2})-(\d{2})$/
                    );

                if (!match) {
                    return;
                }

                next = new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3])
                );

                if (
                    next.getFullYear() !== Number(match[1]) ||
                    next.getMonth() !== Number(match[2]) - 1 ||
                    next.getDate() !== Number(match[3])
                ) {
                    return;
                }
            }
            else {
                return;
            }

            const previousValue =
                this.creationDate;

            const nextValue =
                this.#formatJSONDate(next);

            if (nextValue === previousValue) {
                return;
            }

            if (
                !this.#emitClockTimerEvent(
                    "creationDateChanging",
                    {
                        previousValue,
                        value: nextValue
                    },
                    { cancelable: true }
                )
            ) {
                return;
            }

            this.#creationDateOverride =
                next;

            this.#emitClockTimerEvent(
                "creationDateChanged",
                {
                    previousValue,
                    value: nextValue,
                    summary:
                        this.#buildSummarySnapshot(
                            new Date()
                        )
                }
            );

            this.#queueTripEvent(
                "trip.creation-date-changed",
                new Date(),
                {
                    value:
                        nextValue,
                    creationAnchor:
                        next.toISOString()
                }
            );

            this.#scheduleTripEventSync();
        }

        get standardTime() {
            return this.#standardTime;
        }

        set standardTime(value) {
            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateDurationTime(
                        value,
                        "standardTime"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousValue =
                this.#standardTime;

            const previousDuration =
                this.#standardDuration;

            const nextValue =
                this.#formatStandardTime(
                    parsed.total
                );

            if (nextValue === previousValue) {
                return;
            }

            const proceed =
                this.#emitClockTimerEvent(
                    "standardTimeChanging",
                    {
                        previousValue,
                        value: nextValue,
                        standardTimeMilliseconds: parsed.total
                    },
                    {
                        cancelable: true
                    }
                );

            if (!proceed) {
                return;
            }

            this.#standardTime =
                nextValue;

            this.#standardDuration =
                parsed.total;

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousDuration
                )
            ) {
                this.#calculatedEndTime +=
                    parsed.total -
                    previousDuration;
            }

            if (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#tripTotals
            ) {
                this.#handleTripGoalChange();
            }

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#emitClockTimerEvent(
                "standardTimeChanged",
                {
                    previousValue,
                    value: this.#standardTime,
                    standardTimeMilliseconds: this.#standardDuration,
                    summary: this.#buildSummarySnapshot(new Date())
                }
            );

            this.#queueTripEvent(
                "trip.standard-time-changed",
                new Date(),
                {
                    value:
                        this.#standardTime
                }
            );

            this.#scheduleTripEventSync();
        }

        get creationTime() {
            return this.#creationTime;
        }

        set creationTime(value) {
            const previousValue =
                this.creationTime;

            if (
                !this.#emitClockTimerEvent(
                    "creationTimeChanging",
                    {
                        previousValue,
                        value
                    },
                    { cancelable: true }
                )
            ) {
                return;
            }

            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "creationTime"
                    );
            }
            catch {
                return;
            }

            this.#creationTime =
                this.#formatStandardTime(
                    parsed.total,
                    { clock: true }
                );

            this.#creationMilliseconds =
                parsed.total;


            const currentValue =
                this.creationTime;

            if (currentValue !== previousValue) {
                this.#emitClockTimerEvent(
                    "creationTimeChanged",
                    {
                        previousValue,
                        value: currentValue,
                        summary:
                            this.#buildSummarySnapshot(
                                new Date()
                            )
                    }
                );

                this.#queueTripEvent(
                    "trip.creation-time-changed",
                    new Date(),
                    {
                        value:
                            currentValue
                    }
                );

                this.#scheduleTripEventSync();
            }
        }

        get scheduledStart() {
            return this.#scheduledStart;
        }

        set scheduledStart(value) {
            const previousValue =
                this.scheduledStart;

            if (
                !this.#emitClockTimerEvent(
                    "scheduledStartChanging",
                    {
                        previousValue,
                        value
                    },
                    { cancelable: true }
                )
            ) {
                return;
            }

            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "scheduledStart"
                    );
            }
            catch {
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            const previousScheduledStart =
                this.#scheduledStartMilliseconds;

            const milliseconds =
                this.#resolveNear(
                    parsed.total,
                    this.#creationMilliseconds
                );

            this.#scheduledStartMilliseconds =
                milliseconds;

            this.#scheduledStart =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                Number.isFinite(
                    this.#calculatedEndTime
                ) &&
                Number.isFinite(
                    previousScheduledStart
                )
            ) {
                this.#calculatedEndTime +=
                    milliseconds -
                    previousScheduledStart;
            }

            this.#tickAlignmentMilliseconds =
                this.#millisecondsComponent(
                    milliseconds
                );

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );

            this.#stopTickTimer();

            if (this.#needsTick()) {
                this.#scheduleNextTick();
            }


            const currentValue =
                this.scheduledStart;

            if (currentValue !== previousValue) {
                this.#emitClockTimerEvent(
                    "scheduledStartChanged",
                    {
                        previousValue,
                        value: currentValue,
                        summary:
                            this.#buildSummarySnapshot(
                                new Date()
                            )
                    }
                );

                this.#queueTripEvent(
                    "trip.scheduled-start-changed",
                    new Date(),
                    {
                        value:
                            currentValue
                    }
                );

                this.#scheduleTripEventSync();
            }
        }

        get startTime() {
            if (!this.#hasStartProperties()) {
                return undefined;
            }

            const milliseconds =
                this.#getStartTimeMilliseconds();

            return Number.isFinite(milliseconds)
                ? this.#formatTimelineTime(
                    milliseconds
                )
                : undefined;
        }

        set startTime(value) {
            const previousValue =
                this.startTime;

            if (
                !this.#emitClockTimerEvent(
                    "startTimeChanging",
                    {
                        previousValue,
                        value
                    },
                    { cancelable: true }
                )
            ) {
                return;
            }

            if (!this.#hasStartProperties()) {
                return;
            }

            let parsed;

            try {
                parsed =
                    this.#validateClockTime(
                        value,
                        "startTime"
                    );
            }
            catch {
                return;
            }

            const milliseconds =
                this.#resolveNear(
                    parsed.total,
                    this.#scheduledStartMilliseconds
                );

            this.#refreshAfterStartPropertyChange(
                milliseconds
            );


            const currentValue =
                this.startTime;

            if (currentValue !== previousValue) {
                this.#emitClockTimerEvent(
                    "startTimeChanged",
                    {
                        previousValue,
                        value: currentValue,
                        summary:
                            this.#buildSummarySnapshot(
                                new Date()
                            )
                    }
                );

                this.#emitClockTimerEvent(
                    "actualStartChanged",
                    {
                        previousValue,
                        value: currentValue,
                        summary:
                            this.#buildSummarySnapshot(
                                new Date()
                            )
                    }
                );

                this.#queueTripEvent(
                    "trip.start-time-changed",
                    new Date(),
                    {
                        value:
                            currentValue
                    }
                );

                this.#scheduleTripEventSync();
            }
        }

        #refreshAfterStartPropertyChange(
            startTimeMilliseconds =
                this.#getStartTimeMilliseconds()
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            this.#reconcilePlannedRanges({
                startTimeMilliseconds
            });

            this.#removeOvertimeRanges();

            let now;

            if (this.#started) {
                now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(
                    now
                );

                this.#updateOvertimeRanges(
                    now
                );

                this.#updateRemainingRanges(
                    now
                );
            }

            this.#reapplyOverwriteRanges();

            this.#refreshRingLayout(
                this.#started
                    ? now
                    : startTimeMilliseconds,
                { refreshTickMarks: true }
            );
        }

        #hasStartProperties() {
            return (
                this.#standardTime !== undefined &&
                this.#creationTime !== undefined &&
                this.#scheduledStart !== undefined
            );
        }

        #getStartTimeMilliseconds() {
            if (!this.#hasStartProperties()) {
                return undefined;
            }

            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerPlanned !==
                                undefined
                    );

            const earlyStarts =
                ranges
                    .filter(
                        range =>
                            range.getAttribute(
                                "type"
                            ) === "earlystart"
                    )
                    .map(
                        range =>
                            Number(
                                range.clockTimerStart
                            )
                    )
                    .filter(Number.isFinite);

            if (earlyStarts.length > 0) {
                return Math.min(
                    ...earlyStarts
                );
            }

            const latencyEnds =
                ranges
                    .filter(
                        range =>
                            range.getAttribute(
                                "type"
                            ) === "latency"
                    )
                    .map(
                        range =>
                            Number(
                                range.clockTimerEnd
                            )
                    )
                    .filter(Number.isFinite);

            if (latencyEnds.length > 0) {
                return Math.max(
                    ...latencyEnds
                );
            }

            return this.#scheduledStartMilliseconds;
        }

        #stopLocal(
            stopTime = this.#dateToStandardTime(
                new Date()
            ),
            referenceTimeline =
                this.#getCurrentTimelineTime()
        ) {
            const parsed =
                this.#validateClockTime(
                    stopTime,
                    "stopTime"
                );

            stopTime =
                this.#resolveNear(
                    parsed.total,
                    referenceTimeline
                );

            this.#stopTickTimer();

            const openRecord =
                this.#openEndedRange;

            if (openRecord) {
                const openStart =
                    this.#dateToTimelineTime(
                        openRecord.startDate
                    );

                if (
                    Number.isFinite(openStart) &&
                    stopTime >= openStart
                ) {
                    const previous =
                        Number.isFinite(
                            this.#openEndedLastTick
                        )
                            ? this.#openEndedLastTick
                            : openStart;

                    if (stopTime > previous) {
                        this.#extendCalculatedEndTime(
                            stopTime - previous,
                            openRecord.type
                        );
                    }

                    openRecord.openEnded =
                        false;

                    openRecord.rangeLength =
                        Math.max(
                            0,
                            stopTime - openStart
                        );

                    openRecord.endDate =
                        new Date(
                            openRecord.startDate.getTime() +
                            openRecord.rangeLength
                        );

                    this.#openEndedRange =
                        undefined;

                    this.#openEndedLastTick =
                        undefined;

                    this.#renderAllInsertedRanges();
                }
            }

            this.#started =
                false;

            const ranges =
                Array.from(
                    this.querySelectorAll(
                        "time-range"
                    )
                )
                    .filter(
                        range =>
                            range.getAttribute(
                                "type"
                            ) !== "elapsed"
                    )
                    .map(
                        range => ({
                            range,
                            start:
                                Number(
                                    range.clockTimerStart
                                ),
                            end:
                                Number(
                                    range.clockTimerEnd
                                )
                        })
                    )
                    .filter(
                        item =>
                            Number.isFinite(
                                item.start
                            ) &&
                            Number.isFinite(
                                item.end
                            )
                    )
                    .sort(
                        (a, b) =>
                            a.start - b.start ||
                            a.end - b.end
                    );

            let current;

            for (const item of ranges) {
                if (
                    item.start < stopTime &&
                    stopTime <= item.end
                ) {
                    current =
                        item;
                }
            }

            if (current) {
                this.#setRangeEnd(
                    current.range,
                    stopTime
                );
            }

            for (const elapsedRange of
                this.querySelectorAll(
                    'time-range[type="elapsed"]'
                )) {
                this.#pauseRangeAnimation(elapsedRange);

                elapsedRange.remove();
            }

            this.#elapsedRange =
                undefined;

            this.#removeWaveRange();

            for (
                const [ringIndex, range] of
                    this.#overtimeRanges
            ) {
                if (!range.isConnected) {
                    this.#overtimeRanges.delete(
                        ringIndex
                    );
                }
            }

            if (
                this.#openEndedRange &&
                !this.#openEndedRange.isConnected
            ) {
                this.#openEndedRange =
                    undefined;
            }

            this.#openEndedLastTick =
                stopTime;

            const openOverwrite =
                this.#openOverwriteRange;

            if (openOverwrite) {
                const previous =
                    Number.isFinite(
                        this.#openOverwriteLastTick
                    )
                        ? this.#openOverwriteLastTick
                        : openOverwrite.start;

                if (stopTime > previous) {
                    const net =
                        this.#getOverwriteCalculatedEndDelta(
                            previous,
                            stopTime,
                            openOverwrite.type
                        );

                    this.#adjustCalculatedEndTime(
                        net
                    );

                    this.#applyOverwriteMask(
                        previous,
                        stopTime
                    );

                    this.#renderOverwriteRecord({
                        ...openOverwrite,
                        start: previous,
                        end: stopTime,
                        openEnded: false
                    });
                }

                openOverwrite.openEnded =
                    false;

                openOverwrite.end =
                    Math.max(
                        openOverwrite.start,
                        stopTime
                    );

                this.#openOverwriteRange =
                    undefined;

                this.#openOverwriteLastTick =
                    undefined;
            }

            this.#scheduleIndicatorSymbolUpdate();

            return this;
        }

        spin({
            rotations = 1,
            duration,
            scaleSpeed,
            spinScaleFactor
        } = {}) {
            const normalizedRotations =
                Number(rotations);

            if (
                !Number.isFinite(normalizedRotations) ||
                normalizedRotations <= 0
            ) {
                throw new RangeError(
                    "rotations must be a finite number greater than zero."
                );
            }

            if (duration !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    duration,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (scaleSpeed !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    scaleSpeed,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (spinScaleFactor !== undefined) {
                const normalizedSpinScaleFactor =
                    Number(spinScaleFactor);

                if (
                    !Number.isFinite(normalizedSpinScaleFactor) ||
                    normalizedSpinScaleFactor <= 0
                ) {
                    throw new RangeError(
                        "spinScaleFactor must be a finite number greater than zero."
                    );
                }
            }

            this.#runSpin(
                normalizedRotations,
                duration,
                scaleSpeed,
                spinScaleFactor
            );

            return this;
        }

        #parseCSSTimeMilliseconds(value, { throwOnInvalid = false } = {}) {
            if (typeof value !== "string") {
                if (throwOnInvalid) {
                    throw new TypeError(
                        "duration must be a CSS time string."
                    );
                }

                return undefined;
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^([+]?(?:\d+(?:\.\d+)?|\.\d+))(ms|s)$/i
                );

            if (!match) {
                if (throwOnInvalid) {
                    throw new TypeError(
                        "duration must be a valid CSS time using ms or s."
                    );
                }

                return undefined;
            }

            const amount =
                Number(match[1]);

            const milliseconds =
                match[2].toLowerCase() === "s"
                    ? amount * 1000
                    : amount;

            if (
                !Number.isFinite(milliseconds) ||
                milliseconds <= 0
            ) {
                if (throwOnInvalid) {
                    throw new RangeError(
                        "duration must be greater than zero."
                    );
                }

                return undefined;
            }

            return milliseconds;
        }

        #getSpinDurationMilliseconds(duration) {
            if (duration !== undefined) {
                return this.#parseCSSTimeMilliseconds(
                    duration,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            const computed =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-spin-duration"
                    )
                    .trim();

            return this.#parseCSSTimeMilliseconds(
                computed
            ) ?? 750;
        }

        #getSpinScaleSpeedMilliseconds(scaleSpeed) {
            if (scaleSpeed !== undefined) {
                return this.#parseCSSTimeMilliseconds(
                    scaleSpeed,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            const computed =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-spin-scale-speed"
                    )
                    .trim();

            return this.#parseCSSTimeMilliseconds(
                computed
            ) ?? 125;
        }

        #getSpinScaleFactor(spinScaleFactor) {
            if (spinScaleFactor !== undefined) {
                return Number(spinScaleFactor);
            }

            const computed =
                Number(
                    getComputedStyle(this)
                        .getPropertyValue(
                            "--clock-timer-spin-scale-factor"
                        )
                        .trim()
                );

            return Number.isFinite(computed) &&
                computed > 0
                    ? computed
                    : 0.95;
        }

        #freezeTimeFontForSpin() {
            if (
                !this.#timeElement ||
                this.#spinFrozenTimeFontSize !==
                    undefined
            ) {
                return;
            }

            const computedFontSize =
                getComputedStyle(
                    this.#timeElement
                ).fontSize;

            if (!computedFontSize) {
                return;
            }

            this.#spinPreviousTimeInlineFontSize =
                this.#timeElement.style.getPropertyValue(
                    "font-size"
                );

            this.#spinPreviousTimeInlineFontPriority =
                this.#timeElement.style.getPropertyPriority(
                    "font-size"
                );

            this.#spinFrozenTimeFontSize =
                computedFontSize;

            this.#timeElement.style.setProperty(
                "font-size",
                computedFontSize,
                "important"
            );
        }

        #restoreTimeFontAfterSpin() {
            if (
                !this.#timeElement ||
                this.#spinFrozenTimeFontSize ===
                    undefined
            ) {
                return;
            }

            if (this.#spinPreviousTimeInlineFontSize) {
                this.#timeElement.style.setProperty(
                    "font-size",
                    this.#spinPreviousTimeInlineFontSize,
                    this.#spinPreviousTimeInlineFontPriority ||
                        ""
                );
            }
            else {
                this.#timeElement.style.removeProperty(
                    "font-size"
                );
            }

            this.#spinFrozenTimeFontSize =
                undefined;

            this.#spinPreviousTimeInlineFontSize =
                undefined;

            this.#spinPreviousTimeInlineFontPriority =
                undefined;
        }

        #runSpin(
            rotations,
            duration,
            scaleSpeed,
            spinScaleFactor
        ) {
            const perRotationDuration =
                this.#getSpinDurationMilliseconds(
                    duration
                );

            this.#freezeTimeFontForSpin();

            if (
                this.#responsiveMetricsFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#responsiveMetricsFrame
                );

                this.#responsiveMetricsFrame =
                    undefined;
            }

            this.#spinAnimation
                ?.cancel();

            this.#spinScaleAnimation
                ?.cancel();

            const totalDuration =
                perRotationDuration *
                rotations;

            const requestedScaleDuration =
                this.#getSpinScaleSpeedMilliseconds(
                    scaleSpeed
                );

            const scaleDuration =
                Math.min(
                    requestedScaleDuration,
                    totalDuration / 2
                );

            const scaleOffset =
                totalDuration > 0
                    ? scaleDuration /
                        totalDuration
                    : 0.5;

            const scaleFactor =
                this.#getSpinScaleFactor(
                    spinScaleFactor
                );

            const spinAnimation =
                this.animate(
                    [
                        {
                            offset: 0,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        },
                        {
                            offset: 0.5,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(90deg)"
                        },
                        {
                            offset: 0.5,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(-90deg)"
                        },
                        {
                            offset: 1,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        }
                    ],
                    {
                        duration:
                            perRotationDuration,
                        iterations:
                            rotations,
                        easing: "ease-in-out"
                    }
                );

            const scaleAnimation =
                this.animate(
                    [
                        {
                            offset: 0,
                            scale: "1",
                            easing: "ease-out"
                        },
                        {
                            offset:
                                scaleOffset,
                            scale:
                                String(scaleFactor)
                        },
                        {
                            offset:
                                1 - scaleOffset,
                            scale: "0.95",
                            easing: "ease-in"
                        },
                        {
                            offset: 1,
                            scale: "1"
                        }
                    ],
                    {
                        duration:
                            totalDuration,
                        fill: "forwards"
                    }
                );

            this.#spinAnimation =
                spinAnimation;

            this.#spinScaleAnimation =
                scaleAnimation;

            Promise.allSettled([
                spinAnimation.finished,
                scaleAnimation.finished
            ]).then(() => {
                if (
                    this.#spinAnimation !==
                        spinAnimation ||
                    this.#spinScaleAnimation !==
                        scaleAnimation
                ) {
                    return;
                }

                this.#spinAnimation =
                    undefined;

                this.#spinScaleAnimation =
                    undefined;

                scaleAnimation.cancel();

                this.#restoreTimeFontAfterSpin();

                this.#scheduleResponsiveMetrics();
            });
        }

        #parseGrayscalePercentage(value) {
            if (typeof value !== "string") {
                return undefined;
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^([+]?(?:\d+(?:\.\d+)?|\.\d+))%$/
                );

            if (!match) {
                return undefined;
            }

            const percentage =
                Number(match[1]);

            if (
                !Number.isFinite(percentage) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return undefined;
            }

            return percentage;
        }

        #parseGrayscaleRampMilliseconds(value) {
            if (typeof value !== "string") {
                return undefined;
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^([+]?(?:\d+(?:\.\d+)?|\.\d+))(ms|s)$/i
                );

            if (!match) {
                return undefined;
            }

            const amount =
                Number(match[1]);

            const milliseconds =
                match[2].toLowerCase() === "s"
                    ? amount * 1000
                    : amount;

            if (
                !Number.isFinite(milliseconds) ||
                milliseconds < 0
            ) {
                return undefined;
            }

            return milliseconds;
        }

        #getGrayscalePercentage() {
            if (!this.hasAttribute("grayscale")) {
                return 0;
            }

            const attributeValue =
                this.#parseGrayscalePercentage(
                    this.getAttribute("grayscale")
                );

            if (attributeValue !== undefined) {
                return attributeValue;
            }

            const cssValue =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-grayscale"
                    )
                    .trim();

            return this.#parseGrayscalePercentage(
                cssValue
            ) ?? 100;
        }

        #getGrayscaleRampMilliseconds() {
            const attributeValue =
                this.#parseGrayscaleRampMilliseconds(
                    this.getAttribute("grayscale-ramp")
                );

            if (attributeValue !== undefined) {
                return attributeValue;
            }

            const cssValue =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-grayscale-ramp"
                    )
                    .trim();

            return this.#parseGrayscaleRampMilliseconds(
                cssValue
            ) ?? 333;
        }

        #runGrayscale() {
            if (!this.#clockFace) {
                return;
            }

            const percentage =
                this.#getGrayscalePercentage();

            const targetFilter =
                `grayscale(${percentage}%)`;

            if (!this.isConnected) {
                this.#grayscaleAnimation
                    ?.cancel();

                this.#grayscaleAnimation =
                    undefined;

                this.style.filter =
                    targetFilter;

                return;
            }

            const duration =
                this.#getGrayscaleRampMilliseconds();

            const currentFilter =
                getComputedStyle(
                    this
                ).filter || "none";

            this.#grayscaleAnimation
                ?.cancel();

            this.style.filter =
                currentFilter;

            if (duration <= 0) {
                this.#grayscaleAnimation =
                    undefined;

                this.style.filter =
                    targetFilter;

                return;
            }

            const animation =
                this.animate(
                    [
                        {
                            filter: currentFilter
                        },
                        {
                            filter: targetFilter
                        }
                    ],
                    {
                        duration,
                        easing: "linear",
                        fill: "forwards"
                    }
                );

            this.#grayscaleAnimation =
                animation;

            animation.finished
                .then(() => {
                    if (
                        this.#grayscaleAnimation !==
                            animation
                    ) {
                        return;
                    }

                    this.style.filter =
                        targetFilter;

                    animation.cancel();

                    this.#grayscaleAnimation =
                        undefined;
                })
                .catch(() => {});
        }

        #startLocal({
            tripId,
            standardTime,
            creationTime,
            startTime,
            scheduledStart,
            nonProduction = false
        } = {}) {
            try {
                if (
                    tripId !== undefined &&
                    (
                        !Number.isInteger(tripId) ||
                        tripId < 1
                    )
                ) {
                    throw new TypeError(
                        "tripId must be a positive integer when supplied."
                    );
                }

                if (typeof nonProduction !== "boolean") {
                    throw new TypeError(
                        "nonProduction must be a boolean."
                    );
                }

                this.#validateDurationTime(
                    standardTime,
                    "standardTime"
                );

                if (creationTime !== undefined) {
                    this.#validateClockTime(
                        creationTime,
                        "creationTime"
                    );
                }

                if (scheduledStart !== undefined) {
                    this.#validateClockTime(
                        scheduledStart,
                        "scheduledStart"
                    );
                }

                if (startTime !== undefined) {
                    this.#validateClockTime(
                        startTime,
                        "startTime"
                    );
                }
            }
            catch {
                return false;
            }

            const suppliedStartArguments = {
                tripId,
                standardTime,
                creationTime,
                startTime,
                scheduledStart,
                nonProduction
            };

            this.#preserveInsertedOnClear =
                true;

            try {
                this.#clearLocal();
            }
            finally {
                this.#preserveInsertedOnClear =
                    false;
            }

            this.#tripId =
                tripId;

            this.#nonProduction =
                nonProduction;

            const standard =
                this.#validateDurationTime(
                    standardTime,
                    "standardTime"
                );

            if (
                creationTime ===
                    undefined
            ) {
                creationTime =
                    this.#dateToStandardTime(
                        new Date()
                    );
            }

            const creation =
                this.#validateClockTime(
                    creationTime,
                    "creationTime"
                );

            creationTime =
                this.#formatStandardTime(
                    creation.total,
                    {
                        clock: true
                    }
                );

            this.#creationTime =
                creationTime;

            this.#creationMilliseconds =
                creation.total;

            this.#ringAnchor =
                creation.total;

            this.#creationDateOverride =
                undefined;

            this.#startedAtEpoch =
                Date.now();

            if (
                scheduledStart ===
                    undefined
            ) {
                scheduledStart =
                    creationTime;
            }

            const scheduled =
                this.#validateClockTime(
                    scheduledStart,
                    "scheduledStart"
                );

            this.#scheduledStartMilliseconds =
                this.#resolveNear(
                    scheduled.total,
                    this.#creationMilliseconds
                );

            this.#scheduledStart =
                this.#formatTimelineTime(
                    this.#scheduledStartMilliseconds
                );

            let startTimeMilliseconds =
                this.#scheduledStartMilliseconds;

            if (
                startTime !==
                    undefined
            ) {
                const parsedStart =
                    this.#validateClockTime(
                        startTime,
                        "startTime"
                    );

                startTimeMilliseconds =
                    this.#resolveNear(
                        parsedStart.total,
                        this.#scheduledStartMilliseconds
                    );
            }

            this.#standardTime =
                this.#formatStandardTime(
                    standard.total
                );

            this.#standardDuration =
                standard.total;

            this.#calculatedEndTime =
                this.#scheduledStartMilliseconds +
                this.#standardDuration;

            const previousRenderedPercentGoal =
                this.#renderedPercentGoal;

            const renderedGoalChanged =
                this.#setRenderedPercentGoal(
                    this.#calculateRenderedPercentGoal(),
                    "start",
                    {
                        emit: false
                    }
                );

            this.#started =
                true;

            this.#tripAddedToAggregate =
                false;

            this.#totalGoalNotPossibleState =
                false;

            if (
                !Number.isFinite(
                    this.#tickAlignmentMilliseconds
                )
            ) {
                this.#tickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        this.#scheduledStartMilliseconds
                    );
            }

            this.#setIndicatorSymbolVisible(false);

            this.#starting =
                true;

            try {
                this.#buildPlannedRanges(
                    startTimeMilliseconds
                );

                this.#renderAllInsertedRanges();

                this.#snapTimerRangeAngles();
            }
            finally {
                this.#starting =
                    false;
            }

            const startNow =
                this.#getCurrentTimelineTime();

            this.#updateTotalGoalNotPossibleState(
                "start",
                startNow
            );

            if (renderedGoalChanged) {
                this.#emitRenderedPercentGoalChange(
                    previousRenderedPercentGoal,
                    this.#renderedPercentGoal,
                    "start"
                );
            }

            this.#refreshRingLayout(
                startNow,
                {
                    refreshTickMarks: true
                }
            );

            this.#tick();

            this.#animateStartedRingWidths();

            if (this.#indicatorStartFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorStartFrame);
            }

            this.#indicatorStartFrame = requestAnimationFrame(() => {
                this.#indicatorStartFrame = requestAnimationFrame(() => {
                    this.#indicatorStartFrame = undefined;
                    this.#updateIndicatorSymbol();
                });
            });

            this.#stopTickTimer();
            this.#scheduleNextTick();

            this.#originalStartArguments = {
                ...suppliedStartArguments
            };
            this.#tripGoalMissedState = false;
            this.#totalGoalMissedState = false;

            return new Date();
        }

        #cloneInsertedRecords(records) {
            return records.map(record => ({
                ...record,
                startDate:
                    new Date(
                        record.startDate.getTime()
                    ),
                endDate:
                    record.endDate
                        ? new Date(
                            record.endDate.getTime()
                        )
                        : undefined,
                otherAttributes: {
                    ...(record.otherAttributes ?? {})
                },
                preservedAttributes:
                    (record.preservedAttributes ?? [])
                        .map(snapshot => ({
                            ...snapshot,
                            attributes: {
                                ...(snapshot.attributes ?? {})
                            }
                        }))
            }));
        }

        #typeExtendsCalculatedEndTime(type) {
            return !new Set([
                "trip",
                "earlystart",
                "latency",
                "overtime",
                "remaining",
                "discrepancy",
                "approval-surplus",
                "approval-deficit"
            ]).has(
                String(type).trim()
            );
        }

        #extendCalculatedEndTime(
            duration,
            type
        ) {
            if (
                !Number.isFinite(
                    this.#calculatedEndTime
                ) ||
                !Number.isFinite(duration) ||
                duration <= 0 ||
                !this.#typeExtendsCalculatedEndTime(
                    type
                )
            ) {
                return;
            }

            this.#calculatedEndTime +=
                duration;
        }

        #insert({
            type,
            startTime,
            endTime,
            rangeLength,
            otherAttributes
        } = {}) {
            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    ""
            ) {
                return;
            }

            if (
                this.#openEndedRange
            ) {
                return;
            }

            if (
                otherAttributes !==
                    undefined &&
                (
                    otherAttributes ===
                        null ||
                    typeof otherAttributes !==
                        "object" ||
                    Array.isArray(
                        otherAttributes
                    )
                )
            ) {
                return;
            }

            let startDate;

            try {
                startDate =
                    startTime ===
                        undefined
                        ? new Date()
                        : this.#parseInsertDateTime(
                            startTime,
                            "startTime"
                        );
            }
            catch {
                return;
            }

            let endDate;

            if (
                endTime !==
                    undefined
            ) {
                try {
                    endDate =
                        this.#parseInsertDateTime(
                            endTime,
                            "endTime"
                        );
                }
                catch {
                    return;
                }
            }

            let duration;

            if (
                rangeLength !==
                    undefined
            ) {
                try {
                    duration =
                        this.#parseInsertRangeLength(
                            rangeLength
                        );
                }
                catch {
                    return;
                }
            }

            if (
                endDate &&
                endDate.getTime() <
                    startDate.getTime()
            ) {
                return;
            }

            if (
                endDate &&
                duration !==
                    undefined &&
                endDate.getTime() -
                    startDate.getTime() !==
                    duration
            ) {
                return;
            }

            if (
                !endDate &&
                duration !==
                    undefined
            ) {
                endDate =
                    new Date(
                        startDate.getTime() +
                        duration
                    );
            }

            if (
                endDate &&
                duration ===
                    undefined
            ) {
                duration =
                    endDate.getTime() -
                    startDate.getTime();
            }

            const record = {
                id:
                    `${Date.now()}-${Math.random()}`,
                type:
                    type.trim(),
                clockTimerGrowthMode:
                    !endDate &&
                    duration === undefined
                        ? "displace"
                        : "fixed",
                startDate:
                    new Date(
                        startDate.getTime()
                    ),
                endDate:
                    endDate
                        ? new Date(
                            endDate.getTime()
                        )
                        : undefined,
                rangeLength:
                    duration,
                openEnded:
                    !endDate &&
                    duration ===
                        undefined,
                otherAttributes:
                    otherAttributes
                        ? {
                            ...otherAttributes
                        }
                        : {},
                preservedAttributes:
                    []
            };

            this.#ensureIntervalRecordId(
                record
            );

            if (
                record.openEnded === true &&
                this.#isIntervalType(
                    record.type
                )
            ) {
                record.clockTimerApprovalManaged =
                    true;
            }

            const startTimeline =
                this.#dateToTimelineTime(
                    record.startDate
                );

            this.#ensureInsertionAnchor(
                startTimeline
            );

            if (
                Number.isFinite(
                    record.rangeLength
                )
            ) {
                this.#shiftRangesAfter(
                    startTimeline,
                    record.rangeLength,
                    record
                );
            }

            this.#insertedRanges.push(
                record
            );

            if (
                Number.isFinite(
                    record.rangeLength
                )
            ) {
                this.#extendCalculatedEndTime(
                    record.rangeLength,
                    record.type
                );
            }

            if (
                record.openEnded
            ) {
                this.#openEndedRange =
                    record;

                this.#openEndedLastTick =
                    startTimeline;
            }

            this.#tickAlignmentMilliseconds =
                record.startDate.getMilliseconds();

            this.#renderAllInsertedRanges();

            const insertedElement =
                this.#getManagedTimeRanges()
                    .find(
                        candidate =>
                            candidate.clockTimerInserted ===
                                record.id
                    );

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return insertedElement;
        }

        #overwrite({
            type,
            startTime,
            endTime,
            rangeLength
        } = {}) {
            const explicitStart =
                startTime !== undefined &&
                startTime !== null;

            const hasEnd =
                endTime !== undefined;

            const hasLength =
                rangeLength !== undefined;

            const openEnded =
                !hasEnd &&
                !hasLength;

            if (
                typeof type !== "string" ||
                type.trim() === ""
            ) {
                return;
            }

            if (
                openEnded &&
                !this.#hasStartProperties()
            ) {
                return;
            }

            if (this.#openOverwriteRange) {
                return;
            }

            const reference =
                this.#getCurrentTimelineTime();

            let start;

            try {
                if (explicitStart) {
                    const parsedStart =
                        this.#validateClockTime(
                            startTime,
                            "startTime"
                        );

                    start =
                        this.#resolveNear(
                            parsedStart.total,
                            reference
                        );
                }
                else {
                    start = reference;
                }
            }
            catch {
                return;
            }

            let end;
            let duration;

            if (hasEnd) {
                try {
                    const parsedEnd =
                        this.#validateClockTime(
                            endTime,
                            "endTime"
                        );

                    end =
                        this.#resolveNear(
                            parsedEnd.total,
                            start
                        );
                }
                catch {
                    return;
                }
            }

            if (hasLength) {
                try {
                    duration =
                        this.#validateDurationTime(
                            rangeLength,
                            "rangeLength"
                        ).total;
                }
                catch {
                    return;
                }
            }

            if (
                Number.isFinite(end) &&
                end <= start
            ) {
                return;
            }

            if (
                Number.isFinite(end) &&
                Number.isFinite(duration) &&
                end - start !== duration
            ) {
                return;
            }

            if (
                !Number.isFinite(end) &&
                Number.isFinite(duration)
            ) {
                end =
                    start + duration;
            }

            if (
                Number.isFinite(end) &&
                !Number.isFinite(duration)
            ) {
                duration =
                    end - start;
            }

            const record = {
                id:
                    `overwrite-${Date.now()}-${Math.random()}`,
                type:
                    type.trim(),
                clockTimerGrowthMode:
                    openEnded
                        ? "overwrite"
                        : "fixed",
                start,
                end:
                    Number.isFinite(end)
                        ? end
                        : undefined,
                openEnded
            };

            this.#ensureIntervalRecordId(
                record
            );

            if (openEnded) {
                this.#overwriteRanges.push(
                    record
                );

                this.#openOverwriteRange =
                    record;

                this.#openOverwriteLastTick =
                    start;

                this.#tickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        start
                    );

                this.#renderOverwriteRecord(
                    record
                );

                const overwriteElement =
                    this.#getManagedTimeRanges()
                        .find(
                            candidate =>
                                candidate.clockTimerOverwrite ===
                                    record.id
                        );

                this.#refreshRingLayout(
                    start,
                    { refreshTickMarks: true }
                );

                this.#stopTickTimer();
                this.#scheduleNextTick();

                return overwriteElement;
            }

            const net =
                this.#getOverwriteCalculatedEndDelta(
                    start,
                    end,
                    record.type
                );

            this.#adjustCalculatedEndTime(
                net
            );

            this.#trimOverwriteRecords(
                start,
                end
            );

            this.#overwriteRanges.push(
                record
            );

            this.#applyOverwriteMask(
                start,
                end
            );

            this.#renderOverwriteRecord(
                record
            );

            const overwriteElement =
                this.#getManagedTimeRanges()
                    .find(
                        candidate =>
                            candidate.clockTimerOverwrite ===
                                record.id
                    );

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : start,
                { refreshTickMarks: true }
            );

            return overwriteElement;
        }

        #adjustCalculatedEndTime(delta) {
            if (
                !Number.isFinite(
                    this.#calculatedEndTime
                ) ||
                !Number.isFinite(delta) ||
                delta === 0
            ) {
                return;
            }

            this.#calculatedEndTime +=
                delta;
        }

        #getOverwriteCalculatedEndDelta(
            start,
            end,
            type
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return 0;
            }

            let delta =
                this.#typeExtendsCalculatedEndTime(
                    type
                )
                    ? end - start
                    : 0;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.getAttribute("type") ===
                        "elapsed" ||
                    range.timeRangeExiting === true
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd)
                ) {
                    continue;
                }

                const overlap =
                    Math.max(
                        0,
                        Math.min(end, rangeEnd) -
                        Math.max(start, rangeStart)
                    );

                if (
                    overlap > 0 &&
                    this.#typeExtendsCalculatedEndTime(
                        range.getAttribute("type")
                    )
                ) {
                    delta -= overlap;
                }
            }

            return delta;
        }

        #copyClockTimerRangeState(
            source,
            target
        ) {
            for (const key of Object.keys(source)) {
                if (
                    !key.startsWith("clockTimer") ||
                    key === "clockTimerStart" ||
                    key === "clockTimerEnd"
                ) {
                    continue;
                }

                target[key] =
                    source[key];
            }
        }

        #splitRangeForOverwrite(
            range,
            leftStart,
            leftEnd,
            rightStart,
            rightEnd
        ) {
            if (
                typeof range.split !==
                    "function"
            ) {
                return;
            }

            const preserveRangeLength =
                range.hasAttribute(
                    "range-length"
                );

            const splitRanges =
                range.split(
                    this.#formatTimelineTime(
                        leftEnd
                    ),
                    true
                );

            if (
                !Array.isArray(splitRanges) ||
                splitRanges.length < 2
            ) {
                return;
            }

            const left =
                splitRanges[0];

            const right =
                splitRanges[
                    splitRanges.length - 1
                ];

            this.#copyClockTimerRangeState(
                range,
                right
            );

            this.#setRangeTiming(
                left,
                leftStart,
                leftEnd,
                preserveRangeLength
            );

            this.#setRangeTiming(
                right,
                rightStart,
                rightEnd,
                preserveRangeLength
            );

            const ring =
                this.#ensureRing(
                    this.#getTimerRingIndex(
                        rightStart
                    )
                );

            if (
                right.parentElement !==
                    ring
            ) {
                ring.appendChild(
                    right
                );
            }
        }

        #applyOverwriteMask(
            start,
            end
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return;
            }

            const ranges =
                Array.from(
                    this.#getManagedTimeRanges()
                );

            for (const range of ranges) {
                if (
                    range.getAttribute("type") ===
                        "elapsed" ||
                    range.clockTimerOverwrite !==
                        undefined ||
                    range.timeRangeExiting === true
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd) ||
                    rangeEnd <= start ||
                    rangeStart >= end
                ) {
                    continue;
                }

                if (
                    start <= rangeStart &&
                    rangeEnd <= end
                ) {
                    if (
                        typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                    ) {
                        this.#releaseTimeRangeTimingAnimation(
                            range
                        );

                        this.#removeRangeAnimated(range,{
                            collapseTo: "start"
                        });
                    }
                    else {
                        range.remove();
                    }

                    continue;
                }

                const preserveRangeLength =
                    range.hasAttribute(
                        "range-length"
                    );

                if (
                    rangeStart < start &&
                    end < rangeEnd
                ) {
                    this.#splitRangeForOverwrite(
                        range,
                        rangeStart,
                        start,
                        end,
                        rangeEnd
                    );

                    continue;
                }

                if (
                    rangeStart < start &&
                    start < rangeEnd
                ) {
                    this.#setRangeTiming(
                        range,
                        rangeStart,
                        start,
                        preserveRangeLength
                    );

                    continue;
                }

                if (
                    rangeStart < end &&
                    end < rangeEnd
                ) {
                    this.#setRangeTiming(
                        range,
                        end,
                        rangeEnd,
                        preserveRangeLength
                    );
                }
            }
        }

        #trimOverwriteRecords(
            start,
            end
        ) {
            const next = [];

            for (
                const record of
                    this.#overwriteRanges
            ) {
                if (
                    record.openEnded ||
                    !Number.isFinite(record.end) ||
                    record.end <= start ||
                    record.start >= end
                ) {
                    next.push(record);
                    continue;
                }

                if (
                    start <= record.start &&
                    record.end <= end
                ) {
                    continue;
                }

                if (
                    record.start < start &&
                    end < record.end
                ) {
                    next.push({
                        ...record,
                        end: start
                    });

                    next.push({
                        ...record,
                        id:
                            `overwrite-${Date.now()}-${Math.random()}`,
                        start: end
                    });

                    continue;
                }

                if (
                    record.start < start
                ) {
                    next.push({
                        ...record,
                        end: start
                    });

                    continue;
                }

                next.push({
                    ...record,
                    start: end
                });
            }

            this.#overwriteRanges =
                next;

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerOverwrite !==
                                    undefined
                        )
            ) {
                range.remove();
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                this.#applyOverwriteMask(
                    record.start,
                    record.end
                );

                this.#renderOverwriteRecord(
                    record
                );
            }
        }

        #renderOverwriteRecord(record) {
            const end =
                record.openEnded
                    ? this.#openOverwriteLastTick
                    : record.end;

            if (
                !Number.isFinite(end) ||
                end <= record.start
            ) {
                return;
            }

            let cursor =
                record.start;

            while (cursor < end) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentEnd =
                    Math.min(
                        end,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const range =
                    this.#createTimeRange(
                        record.type,
                        cursor,
                        segmentEnd,
                        { dynamic: true }
                    );

                delete range.clockTimerDynamic;

                range.clockTimerOverwrite =
                    record.id;

                this.#ensureIntervalIdAttribute(
                    range,
                    record.intervalId
                );

                range.timeRangeFullEntry =
                    true;

                ring.appendChild(
                    range
                );

                cursor =
                    segmentEnd;
            }
        }

        #syncOverwriteRangeElements(
            record,
            effectiveEnd
        ) {
            if (
                !record ||
                !Number.isFinite(record.start) ||
                !Number.isFinite(effectiveEnd) ||
                effectiveEnd <= record.start
            ) {
                return;
            }

            const existing =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerOverwrite ===
                                record.id &&
                            range.timeRangeExiting !==
                                true
                    )
                    .sort(
                        (a, b) =>
                            Number(a.clockTimerStart) -
                            Number(b.clockTimerStart)
                    );

            let cursor =
                record.start;

            let index =
                0;

            while (cursor < effectiveEnd) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentEnd =
                    Math.min(
                        effectiveEnd,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                let range =
                    existing[index];

                if (!range) {
                    range =
                        this.#createTimeRange(
                            record.type,
                            cursor,
                            segmentEnd,
                            { dynamic: true }
                        );

                    delete range.clockTimerDynamic;

                    range.clockTimerOverwrite =
                        record.id;

                    range.timeRangeFullEntry =
                        true;

                    ring.appendChild(
                        range
                    );
                }
                else {
                    if (
                        range.parentElement !==
                            ring
                    ) {
                        ring.appendChild(
                            range
                        );
                    }

                    this.#setRangeTiming(
                        range,
                        cursor,
                        segmentEnd
                    );
                }

                this.#ensureIntervalIdAttribute(
                    range,
                    record.intervalId
                );

                cursor =
                    segmentEnd;

                index++;
            }

            for (
                ;
                index < existing.length;
                index++
            ) {
                const range =
                    existing[index];

                if (
                    typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#removeRangeAnimated(range,{
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #reapplyOverwriteRanges() {
            if (this.#overwriteRanges.length === 0) {
                return;
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                const end =
                    record.openEnded
                        ? this.#openOverwriteLastTick
                        : record.end;

                if (
                    Number.isFinite(end) &&
                    end > record.start
                ) {
                    this.#applyOverwriteMask(
                        record.start,
                        end
                    );

                    // Reconciliation may replace planned TimeRanges. Keep the
                    // overwrite record authoritative by restoring/synchronizing
                    // its visual segments after the mask is applied.
                    this.#syncOverwriteRangeElements(
                        record,
                        end
                    );
                }
            }
        }

        #updateOpenOverwriteRange(
            nowDate
        ) {
            this.#updateOpenOverwriteRangeTo(
                this.#getCurrentTimelineTime(
                    nowDate
                )
            );
        }

        #updateOpenOverwriteRangeTo(now) {
            const record =
                this.#openOverwriteRange;

            if (
                !record ||
                !Number.isFinite(now)
            ) {
                return;
            }

            const previous =
                Number.isFinite(
                    this.#openOverwriteLastTick
                )
                    ? this.#openOverwriteLastTick
                    : record.start;

            if (now <= previous) {
                return;
            }

            const net =
                this.#getOverwriteCalculatedEndDelta(
                    previous,
                    now,
                    record.type
                );

            this.#adjustCalculatedEndTime(
                net
            );

            this.#applyOverwriteMask(
                previous,
                now
            );

            this.#openOverwriteLastTick =
                now;

            record.end =
                now;

            this.#syncOverwriteRangeElements(
                record,
                now
            );
        }

        #getReservedRangeTypes() {
            return new Set([
                "trip",
                "tolerance",
                "overtime",
                "earlystart",
                "latency",
                "end-buffer-extension",
                "elapsed",
                "remaining",
                "wave",
                "discrepancy",
                "approval-surplus",
                "approval-deficit"
            ]);
        }

        #getProtectedRangeTypes() {
            return this.#getReservedRangeTypes();
        }

        #isIntervalType(
            type
        ) {
            if (
                typeof type !==
                    "string"
            ) {
                return false;
            }

            const normalized =
                type.trim();

            if (!normalized) {
                return false;
            }

            return !this.#getReservedRangeTypes()
                .has(
                    normalized.toLowerCase()
                );
        }

        #getIntervalIdFromAttributes(
            attributes
        ) {
            if (
                !attributes ||
                typeof attributes !== "object"
            ) {
                return undefined;
            }

            for (const [name, value] of Object.entries(attributes)) {
                if (String(name).toLowerCase() !== "interval-id") {
                    continue;
                }

                const numeric = Number(value);
                return Number.isInteger(numeric) && numeric > 0
                    ? numeric
                    : undefined;
            }

            return undefined;
        }

        #ensureIntervalRecordId(
            record
        ) {
            if (
                !record ||
                !this.#isIntervalType(record.type)
            ) {
                return undefined;
            }

            const intervalId = Number(
                record.intervalId ??
                this.#getIntervalIdFromAttributes(record.otherAttributes)
            );

            if (!Number.isInteger(intervalId) || intervalId < 1) {
                delete record.intervalId;
                if (record.otherAttributes) {
                    for (const name of Object.keys(record.otherAttributes)) {
                        if (name.toLowerCase() === "interval-id") {
                            delete record.otherAttributes[name];
                        }
                    }
                }
                return undefined;
            }

            record.intervalId = intervalId;
            record.otherAttributes = {
                ...(record.otherAttributes ?? {}),
                "interval-id": String(intervalId)
            };
            return intervalId;
        }

        #ensureIntervalIdAttribute(
            range,
            intervalId
        ) {
            if (
                !range ||
                range.localName !== "time-range" ||
                !this.#isIntervalType(range.getAttribute("type"))
            ) {
                return undefined;
            }

            const numeric = Number(intervalId);
            if (!Number.isInteger(numeric) || numeric < 1) {
                range.removeAttribute("interval-id");
                return undefined;
            }

            range.setAttribute("interval-id", String(numeric));
            return numeric;
        }

        #shiftPlannedRangesAfter(
            cutoff,
            delta
        ) {
            if (
                !Number.isFinite(cutoff) ||
                !Number.isFinite(delta) ||
                delta === 0
            ) {
                return;
            }

            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerPlanned !==
                                undefined &&
                            range.timeRangeExiting !==
                                true
                    );

            for (const range of ranges) {
                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= cutoff
                ) {
                    continue;
                }

                if (start >= cutoff) {
                    this.#replaceRangeWithSegments(
                        range,
                        [[
                            start + delta,
                            end + delta
                        ]]
                    );

                    continue;
                }

                this.#replaceRangeWithSegments(
                    range,
                    [
                        [
                            start,
                            cutoff
                        ],
                        [
                            cutoff + delta,
                            end + delta
                        ]
                    ]
                );
            }
        }

        #getOverwriteCalculatedEndDeltaForRebuild(
            start,
            end,
            type
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return 0;
            }

            let delta =
                this.#typeExtendsCalculatedEndTime(
                    type
                )
                    ? end - start
                    : 0;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.getAttribute("type") ===
                        "elapsed" ||
                    range.clockTimerOverwrite !==
                        undefined ||
                    range.timeRangeExiting === true
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd)
                ) {
                    continue;
                }

                const overlap =
                    Math.max(
                        0,
                        Math.min(end, rangeEnd) -
                        Math.max(start, rangeStart)
                    );

                if (
                    overlap > 0 &&
                    this.#typeExtendsCalculatedEndTime(
                        range.getAttribute("type")
                    )
                ) {
                    delta -= overlap;
                }
            }

            return delta;
        }

        #rebuildAfterRangeDeletion() {
            if (!this.#hasStartProperties()) {
                this.#refreshRingLayout(
                    undefined,
                    { refreshTickMarks: true }
                );
                return;
            }

            const startTimeMilliseconds =
                this.#getStartTimeMilliseconds();

            this.#reconcilePlannedRanges({
                startTimeMilliseconds
            });

            this.#calculatedEndTime =
                this.#scheduledStartMilliseconds +
                this.#standardDuration;

            const inserted =
                [...this.#insertedRanges]
                    .sort(
                        (a, b) =>
                            this.#dateToTimelineTime(
                                a.startDate
                            ) -
                            this.#dateToTimelineTime(
                                b.startDate
                            )
                    );

            for (const record of inserted) {
                const start =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                const end =
                    record.openEnded
                        ? this.#openEndedLastTick
                        : (
                            record.endDate
                                ? this.#dateToTimelineTime(
                                    record.endDate
                                )
                                : undefined
                        );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    continue;
                }

                const duration =
                    this.#getIntervalEffectiveDuration(
                        record
                    );

                this.#extendCalculatedEndTime(
                    duration,
                    record.type
                );

                this.#shiftPlannedRangesAfter(
                    start,
                    duration
                );

                this.#shiftScheduleMarkers(
                    start,
                    duration
                );
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                const end =
                    record.openEnded
                        ? this.#openOverwriteLastTick
                        : record.end;

                if (
                    !Number.isFinite(record.start) ||
                    !Number.isFinite(end) ||
                    end <= record.start
                ) {
                    continue;
                }

                this.#adjustCalculatedEndTime(
                    this.#getOverwriteCalculatedEndDeltaForRebuild(
                        record.start,
                        end,
                        record.type
                    )
                );
            }

            this.#removeOvertimeRanges();

            let now;

            if (this.#started) {
                now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(
                    now
                );

                this.#updateOvertimeRanges(
                    now
                );

                this.#updateRemainingRanges(
                    now
                );
            }

            this.#reapplyOverwriteRanges();

            this.#rebuildOvertimeRangeMap();

            this.#refreshRingLayout(
                this.#started
                    ? now
                    : startTimeMilliseconds,
                { refreshTickMarks: true }
            );
        }

        #delete(timeRange) {
            if (
                !timeRange ||
                timeRange.localName !==
                    "time-range"
            ) {
                return false;
            }

            const ring =
                timeRange.parentElement;

            if (
                !ring ||
                ring.localName !==
                    "ring-container" ||
                ring.parentElement !== this
            ) {
                return false;
            }

            const type =
                String(
                    timeRange.getAttribute(
                        "type"
                    ) ?? ""
                ).trim();

            if (["discrepancy", "approval-surplus", "approval-deficit"].includes(type)) {
                throw new Error(
                    "discrepancy ranges are derived and cannot be modified."
                );
            }

            if (
                this.#getProtectedRangeTypes()
                    .has(type)
            ) {
                return false;
            }

            const insertedId =
                timeRange.clockTimerInserted;

            const overwriteId =
                timeRange.clockTimerOverwrite;

            if (insertedId !== undefined) {
                const record =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id === insertedId
                    );

                if (
                    record &&
                    this.#isIntervalApprovalManaged(
                        record
                    ) &&
                    record.openEnded !==
                        true
                ) {
                    void this.#commitIntervalDeletion(
                        record
                    );

                    return new Date();
                }

                this.#insertedRanges =
                    this.#insertedRanges.filter(
                        candidate =>
                            candidate.id !== insertedId
                    );

                if (
                    this.#openEndedRange === record
                ) {
                    this.#openEndedRange =
                        undefined;

                    this.#openEndedLastTick =
                        undefined;
                }

                for (
                    const range of
                        this.#getManagedTimeRanges()
                            .filter(
                                candidate =>
                                    candidate.clockTimerInserted ===
                                        insertedId
                            )
                ) {
                    range.remove();
                }

                this.#removeDiscrepancyRangesForRecord(
                    record
                );
            }
            else if (overwriteId !== undefined) {
                const record =
                    this.#overwriteRanges.find(
                        candidate =>
                            candidate.id === overwriteId
                    );

                this.#overwriteRanges =
                    this.#overwriteRanges.filter(
                        candidate =>
                            candidate.id !== overwriteId
                    );

                if (
                    this.#openOverwriteRange === record
                ) {
                    this.#openOverwriteRange =
                        undefined;

                    this.#openOverwriteLastTick =
                        undefined;
                }

                for (
                    const range of
                        this.#getManagedTimeRanges()
                            .filter(
                                candidate =>
                                    candidate.clockTimerOverwrite ===
                                        overwriteId
                            )
                ) {
                    range.remove();
                }
            }
            else {
                timeRange.remove();
            }

            this.#rebuildAfterRangeDeletion();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }
            else {
                this.#stopTickTimer();
            }

            return new Date();
        }

        #parseIntervalLength(
            value
        ) {
            if (
                typeof value !==
                    "string"
            ) {
                throw new TypeError(
                    "length must be a string in m:ss[.ms] format."
                );
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/
                );

            if (!match) {
                throw new TypeError(
                    "length must match m:ss[.ms]."
                );
            }

            const minutes =
                Number(match[1]);

            const seconds =
                Number(match[2]);

            const milliseconds =
                match[3] === undefined
                    ? 0
                    : Number(
                        match[3].padEnd(
                            3,
                            "0"
                        )
                    );

            const total =
                minutes * 60 * 1000 +
                seconds * 1000 +
                milliseconds;

            if (
                !Number.isFinite(total) ||
                total <= 0
            ) {
                throw new RangeError(
                    "length must be greater than zero."
                );
            }

            return total;
        }

        #normalizeIntervalAttributes(
            attributes
        ) {
            if (attributes === undefined) {
                return {};
            }

            if (
                attributes === null ||
                typeof attributes !==
                    "object" ||
                Array.isArray(attributes)
            ) {
                throw new TypeError(
                    "attributes must be an object of attribute-name/value pairs."
                );
            }

            const normalized = {};

            const probe =
                document.createElement(
                    "span"
                );

            for (
                const [key, value] of
                    Object.entries(attributes)
            ) {
                const name =
                    String(key);

                probe.setAttribute(
                    name,
                    String(value)
                );

                normalized[name] =
                    String(value);
            }

            return normalized;
        }

        #findIntervalAttribute(
            record,
            attributeName
        ) {
            const attributes =
                record?.otherAttributes ?? {};

            const target =
                String(
                    attributeName
                ).toLowerCase();

            for (
                const [name, value] of
                    Object.entries(attributes)
            ) {
                if (
                    String(name).toLowerCase() ===
                        target
                ) {
                    return {
                        name,
                        value:
                            String(value)
                    };
                }
            }

            return undefined;
        }

        #isIntervalApprovalManaged(record) {
            return Boolean(
                record &&
                (
                    record.clockTimerApprovalManaged ===
                        true ||
                    this.#findIntervalAttribute(
                        record,
                        "approved"
                    ) ||
                    this.#findIntervalAttribute(
                        record,
                        "unapproved"
                    )
                )
            );
        }

        #getIntervalApprovalState(record) {
            if (!record) {
                return undefined;
            }

            const approved =
                this.#findIntervalAttribute(
                    record,
                    "approved"
                );

            const unapproved =
                this.#findIntervalAttribute(
                    record,
                    "unapproved"
                );

            if (approved && unapproved) {
                throw new Error(
                    "A closed interval must have exactly one of approved or unapproved."
                );
            }

            const entry =
                approved ??
                unapproved;

            if (!entry) {
                return undefined;
            }

            let duration;

            try {
                duration =
                    this.#parseInsertRangeLength(
                        entry.value
                    );
            }
            catch {
                throw new RangeError(
                    "approved/unapproved must be a human-readable duration in [h:]m:ss[.ms] format."
                );
            }

            return {
                state:
                    approved
                        ? "approved"
                        : "unapproved",
                value:
                    entry.value,
                duration
            };
        }

        #getIntervalActualDuration(record) {
            if (!record) {
                return undefined;
            }

            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            if (!Number.isFinite(start)) {
                return undefined;
            }

            let end;

            if (record.openEnded === true) {
                end =
                    record ===
                        this.#openEndedRange &&
                    Number.isFinite(
                        this.#openEndedLastTick
                    )
                        ? this.#openEndedLastTick
                        : start;
            }
            else {
                end =
                    this.#getIntervalRecordEnd(
                        record
                    );
            }

            if (
                !Number.isFinite(end) ||
                end < start
            ) {
                return undefined;
            }

            return end - start;
        }

        #getIntervalEffectiveDuration(record) {
            if (
                record?.clockTimerPendingDelete ===
                    true
            ) {
                return 0;
            }

            const actual =
                this.#getIntervalActualDuration(
                    record
                );

            if (!Number.isFinite(actual)) {
                return undefined;
            }

            if (
                !this.#isIntervalApprovalManaged(
                    record
                ) ||
                record.openEnded === true
            ) {
                return actual;
            }

            const approval =
                this.#getIntervalApprovalState(
                    record
                );

            if (!approval) {
                return actual;
            }

            return approval.state ===
                "approved"
                ? approval.duration
                : 0;
        }

        #formatSignedIntervalDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const rounded =
                Math.round(
                    milliseconds
                );

            return `${rounded < 0 ? "-" : "+"}${this.#formatStandardTime(Math.abs(rounded))}`;
        }

        #normalizeIntervalApprovalDuration(
            value
        ) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "approval duration must be a string in [h:]m:ss[.ms] format."
                );
            }

            let duration;

            try {
                duration =
                    this.#parseInsertRangeLength(
                        value.trim()
                    );
            }
            catch {
                throw new RangeError(
                    "approval duration must be a human-readable duration in [h:]m:ss[.ms] format."
                );
            }

            return {
                duration,
                value:
                    this.#formatStandardTime(
                        duration
                    )
            };
        }

        #setIntervalApprovalAttributes(
            record,
            state,
            value
        ) {
            if (
                state !== "approved" &&
                state !== "unapproved"
            ) {
                throw new RangeError(
                    "approval state must be approved or unapproved."
                );
            }

            const attributes = {
                ...(record.otherAttributes ?? {})
            };

            for (const name of Object.keys(attributes)) {
                const normalized =
                    name.toLowerCase();

                if (
                    normalized === "approved" ||
                    normalized === "unapproved"
                ) {
                    delete attributes[name];
                }
            }

            attributes[state] =
                String(value);

            record.otherAttributes =
                attributes;

            record.clockTimerApprovalManaged =
                true;
        }

        #initializeClosedIntervalApproval(
            record
        ) {
            if (
                !record ||
                record.openEnded === true ||
                !this.#isIntervalApprovalManaged(
                    record
                )
            ) {
                return false;
            }

            if (
                this.#getIntervalApprovalState(
                    record
                )
            ) {
                return false;
            }

            const duration =
                this.#getIntervalActualDuration(
                    record
                );

            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return false;
            }

            this.#setIntervalApprovalAttributes(
                record,
                "approved",
                this.#formatStandardTime(
                    duration
                )
            );

            record.clockTimerApprovalInitialized =
                true;

            return true;
        }

        #resolveIntervalApprovalRecord(
            target
        ) {
            if (
                target?.localName ===
                    "time-range" &&
                ["discrepancy", "approval-surplus", "approval-deficit"].includes(target.getAttribute("type"))
            ) {
                throw new Error(
                    "discrepancy ranges are derived and cannot be modified."
                );
            }

            let record;

            if (
                target?.localName ===
                    "time-range"
            ) {
                const localId =
                    target.clockTimerInserted;

                record =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id ===
                                localId
                    );
            }
            else if (
                Number.isInteger(
                    Number(target)
                ) &&
                Number(target) > 0
            ) {
                const intervalId =
                    Number(target);

                record =
                    this.#insertedRanges.find(
                        candidate =>
                            Number(
                                candidate.intervalId
                            ) === intervalId
                    );
            }
            else if (typeof target === "string") {
                record =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id === target
                    );
            }

            if (!record) {
                throw new RangeError(
                    "The interval could not be resolved."
                );
            }

            if (
                record.openEnded === true ||
                !this.#isIntervalApprovalManaged(
                    record
                ) ||
                !this.#getIntervalApprovalState(
                    record
                )
            ) {
                throw new Error(
                    "Only a previously open interval that has been closed can be approved or unapproved."
                );
            }

            return record;
        }

        #reapplyIntervalScheduleShifts() {
            const records =
                [...this.#insertedRanges]
                    .sort(
                        (left, right) =>
                            this.#dateToTimelineTime(
                                left.startDate
                            ) -
                            this.#dateToTimelineTime(
                                right.startDate
                            )
                    );

            for (const record of records) {
                if (
                    !this.#typeExtendsCalculatedEndTime(
                        record.type
                    )
                ) {
                    continue;
                }

                const start =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                const duration =
                    this.#getIntervalEffectiveDuration(
                        record
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(duration) ||
                    duration <= 0
                ) {
                    continue;
                }

                this.#shiftPlannedRangesAfter(
                    start,
                    duration
                );

                this.#shiftScheduleMarkers(
                    start,
                    duration
                );
            }
        }

        async #commitIntervalApproval(
            record,
            nextState,
            nextValue,
            eventName
        ) {
            const previous =
                this.#getIntervalApprovalState(
                    record
                );

            if (!previous) {
                throw new Error(
                    "The interval does not have approval state."
                );
            }

            const previousEffectiveDuration =
                this.#getIntervalEffectiveDuration(
                    record
                );

            const previousCalculatedEndTime =
                this.#calculatedEndTime;

            this.#setIntervalApprovalAttributes(
                record,
                nextState,
                nextValue
            );

            const next =
                this.#getIntervalApprovalState(
                    record
                );

            const effectiveDuration =
                this.#getIntervalEffectiveDuration(
                    record
                );

            if (
                Number.isFinite(previousEffectiveDuration) &&
                Number.isFinite(effectiveDuration)
            ) {
                this.#adjustCalculatedEndTime(
                    effectiveDuration -
                    previousEffectiveDuration
                );
            }

            const preparedRenderedPercentGoal =
                this.#calculateRenderedPercentGoal();

            const detail = {
                ...this.#mutationResult(
                    false,
                    record
                ),
                previousState:
                    previous.state,
                state:
                    next.state,
                previousValue:
                    previous.value,
                value:
                    next.value,
                previousEffectiveDurationMilliseconds:
                    previousEffectiveDuration,
                effectiveDurationMilliseconds:
                    effectiveDuration,
                previousCalculatedEndTime:
                    this.#timelineToISO(
                        previousCalculatedEndTime
                    ),
                calculatedEndTime:
                    this.#timelineToISO(
                        this.#calculatedEndTime
                    ),
                preparedRenderedPercentGoal,
                userInitiated: true
            };

            this.#emitClockTimerEvent(
                eventName,
                detail
            );

            if (this.#started) {
                this.#handleTripGoalChange(
                    "user"
                );
            }

            if (
                previous.state !==
                    next.state
            ) {
                if (
                    next.state ===
                        "unapproved"
                ) {
                    this.#collapseIntervalApprovalVisualGroup(
                        record
                    );
                }
                else {
                    this.#animateIntervalApprovalGroupIn(
                        record
                    );
                }
            }
            else if (
                next.state ===
                    "approved"
            ) {
                this.#transitionIntervalApprovalValueVisual(
                    record
                );
            }

            if (this.#started) {
                const now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(
                    now
                );

                this.#updateOvertimeRanges(
                    now
                );

                this.#updateRemainingRanges(
                    now
                );

                this.#updateDisplay(
                    new Date()
                );

                this.#checkGoalMisses(
                    now
                );

                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks: true
                    }
                );
            }

            record.clockTimerEventKey ??=
                this.#createTripEventClientToken();

            this.#queueTripEvent(
                "interval.approval-changed",
                new Date(),
                {
                    intervalKey:
                        record.clockTimerEventKey,
                    state:
                        next.state,
                    value:
                        next.value
                }
            );

            const synced =
                await this.#protectedSync(
                    async () => {
                        await this.#ensureTripPersisted();
                        await this.#syncTripEvents();
                    }
                );

            return {
                ...this.#mutationResult(
                    synced,
                    record
                ),
                state:
                    next.state,
                value:
                    next.value,
                effectiveDurationMilliseconds:
                    effectiveDuration,
                calculatedEndTime:
                    this.#timelineToISO(
                        this.#calculatedEndTime
                    )
            };
        }

        async #commitIntervalDeletion(
            record
        ) {
            if (
                record.clockTimerPendingDelete ===
                    true
            ) {
                throw new Error(
                    "The interval is already pending deletion."
                );
            }

            const approval =
                this.#getIntervalApprovalState(
                    record
                );

            const previousEffectiveDuration =
                this.#getIntervalEffectiveDuration(
                    record
                );

            const previousCalculatedEndTime =
                this.#calculatedEndTime;

            const persisted =
                Number.isInteger(
                    Number(record.intervalId)
                ) &&
                Number(record.intervalId) > 0;

            record.clockTimerPendingDelete =
                true;

            if (
                Number.isFinite(
                    previousEffectiveDuration
                )
            ) {
                this.#adjustCalculatedEndTime(
                    -previousEffectiveDuration
                );
            }

            const preparedRenderedPercentGoal =
                this.#calculateRenderedPercentGoal();

            if (!persisted) {
                this.#insertedRanges =
                    this.#insertedRanges.filter(
                        candidate =>
                            candidate !== record
                    );
            }

            if (
                this.#pendingIntervalRecord ===
                    record
            ) {
                this.#pendingIntervalRecord =
                    undefined;
            }

            const detail = {
                ...this.#mutationResult(
                    false,
                    record
                ),
                state:
                    approval?.state,
                value:
                    approval?.value,
                previousEffectiveDurationMilliseconds:
                    previousEffectiveDuration,
                effectiveDurationMilliseconds: 0,
                previousCalculatedEndTime:
                    this.#timelineToISO(
                        previousCalculatedEndTime
                    ),
                calculatedEndTime:
                    this.#timelineToISO(
                        this.#calculatedEndTime
                    ),
                preparedRenderedPercentGoal,
                persisted,
                pendingSync:
                    persisted,
                irreversible:
                    !persisted,
                userInitiated: true
            };

            this.#emitClockTimerEvent(
                "intervalDeleted",
                detail
            );

            if (this.#started) {
                this.#handleTripGoalChange(
                    "user"
                );
            }

            this.#collapseIntervalApprovalVisualGroup(
                record
            );

            if (this.#started) {
                const now =
                    this.#getCurrentTimelineTime();

                this.#updateElapsedRange(now);
                this.#updateOvertimeRanges(now);
                this.#updateRemainingRanges(now);
                this.#updateDisplay(new Date());
                this.#checkGoalMisses(now);
                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks: true
                    }
                );
            }

            record.clockTimerEventKey ??=
                this.#createTripEventClientToken();

            this.#queueTripEvent(
                "interval.deleted",
                new Date(),
                {
                    intervalKey:
                        record.clockTimerEventKey
                },
                {
                    record,
                    removeRecordOnSync:
                        true
                }
            );

            let synced =
                false;

            synced =
                await this.#protectedSync(
                    async () => {
                        await this.#ensureTripPersisted();
                        await this.#syncTripEvents();
                    }
                );

            if (synced) {
                record.clockTimerDeleteSynced =
                    true;

                this.#insertedRanges =
                    this.#insertedRanges.filter(
                        candidate =>
                            candidate !== record
                    );
            }

            return {
                ...this.#mutationResult(
                    synced,
                    record
                ),
                deleted: true,
                persisted,
                pendingSync:
                    persisted &&
                    !synced,
                irreversible:
                    !persisted,
                calculatedEndTime:
                    this.#timelineToISO(
                        this.#calculatedEndTime
                    )
            };
        }

        #getCurrentInterval(
            now
        ) {
            if (!Number.isFinite(now)) {
                return undefined;
            }

            let current;
            let currentStart =
                -Infinity;

            const consider = (
                source,
                record,
                type,
                start,
                end,
                open
            ) => {
                if (
                    !this.#isIntervalType(type) ||
                    !Number.isFinite(start) ||
                    start > now ||
                    (
                        !open &&
                        (
                            !Number.isFinite(end) ||
                            end <= now
                        )
                    ) ||
                    start < currentStart
                ) {
                    return;
                }

                currentStart =
                    start;

                current = {
                    source,
                    record,
                    type:
                        String(type).trim(),
                    start,
                    end,
                    open
                };
            };

            for (
                const record of
                    this.#insertedRanges
            ) {
                if (
                    record.clockTimerPendingDelete ===
                        true ||
                    record.clockTimerExplicitlyEnded ===
                        true
                ) {
                    continue;
                }

                const start =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                const open =
                    record.openEnded ===
                        true;

                let end;

                if (!open) {
                    if (
                        Number.isFinite(
                            record.rangeLength
                        )
                    ) {
                        end =
                            start +
                            record.rangeLength;
                    }
                    else if (record.endDate) {
                        end =
                            this.#dateToTimelineTime(
                                record.endDate
                            );
                    }
                }

                consider(
                    "inserted",
                    record,
                    record.type,
                    start,
                    end,
                    open
                );
            }

            for (
                const record of
                    this.#overwriteRanges
            ) {
                consider(
                    "overwrite",
                    record,
                    record.type,
                    record.start,
                    record.end,
                    record.openEnded === true
                );
            }

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.clockTimerInserted !==
                        undefined ||
                    range.clockTimerOverwrite !==
                        undefined ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                consider(
                    "range",
                    range,
                    range.getAttribute(
                        "type"
                    ),
                    Number(
                        range.clockTimerStart
                    ),
                    Number(
                        range.clockTimerEnd
                    ),
                    false
                );
            }

            return current;
        }

        #closeOpenIntervalAt(
            nowDate,
            interval
        ) {
            if (
                !interval?.open ||
                !(nowDate instanceof Date) ||
                Number.isNaN(
                    nowDate.getTime()
                )
            ) {
                return false;
            }

            if (
                interval.source ===
                    "inserted"
            ) {
                const record =
                    interval.record;

                if (
                    record !==
                        this.#openEndedRange
                ) {
                    return false;
                }

                const endTimeline =
                    this.#dateToTimelineTime(
                        nowDate
                    );

                this.#updateOpenEndedRange(
                    nowDate
                );

                record.openEnded =
                    false;

                record.clockTimerGrowthMode =
                    "fixed";

                record.endDate =
                    new Date(
                        nowDate.getTime()
                    );

                record.rangeLength =
                    Math.max(
                        0,
                        endTimeline -
                        this.#dateToTimelineTime(
                            record.startDate
                        )
                    );

                this.#initializeClosedIntervalApproval(
                    record
                );

                this.#openEndedRange =
                    undefined;

                this.#openEndedLastTick =
                    undefined;

                this.#renderAllInsertedRanges();

                return true;
            }

            if (
                interval.source ===
                    "overwrite"
            ) {
                const record =
                    interval.record;

                if (
                    record !==
                        this.#openOverwriteRange
                ) {
                    return false;
                }

                const endTimeline =
                    this.#getCurrentTimelineTime(
                        nowDate
                    );

                this.#updateOpenOverwriteRange(
                    nowDate
                );

                record.openEnded =
                    false;

                record.clockTimerGrowthMode =
                    "fixed";

                record.end =
                    Math.max(
                        record.start,
                        endTimeline
                    );

                this.#openOverwriteRange =
                    undefined;

                this.#openOverwriteLastTick =
                    undefined;

                return true;
            }

            return false;
        }

        #getIntervalRecordEnd(record) {
            if (!record || record.openEnded === true) {
                return undefined;
            }

            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            if (!Number.isFinite(start)) {
                return undefined;
            }

            if (Number.isFinite(record.rangeLength)) {
                return start + record.rangeLength;
            }

            if (
                record.endDate instanceof Date &&
                !Number.isNaN(record.endDate.getTime())
            ) {
                return this.#dateToTimelineTime(
                    record.endDate
                );
            }

            return undefined;
        }

        #getCurrentReplaceableRange(now) {
            if (!Number.isFinite(now)) {
                return undefined;
            }

            const ring =
                this.#rings.get(
                    this.#getTimerRingIndex(now)
                );

            if (!ring) {
                return undefined;
            }

            let current;
            let currentStart =
                -Infinity;

            for (
                const range of
                    ring.querySelectorAll(
                        ":scope > time-range"
                    )
            ) {
                if (
                    range.hasAttribute("overlapping") ||
                    range.timeRangeExiting === true
                ) {
                    continue;
                }

                const start =
                    Number(range.clockTimerStart);

                const end =
                    Number(range.clockTimerEnd);

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    current = range;
                    currentStart = start;
                }
            }

            return current;
        }

        #getIntervalBufferRecord(
            record,
            position
        ) {
            const id =
                position === "start"
                    ? record?.clockTimerStartBufferRecordId
                    : position === "end"
                        ? record?.clockTimerEndBufferRecordId
                        : undefined;

            if (id === undefined) {
                return undefined;
            }

            return this.#insertedRanges.find(
                candidate =>
                    candidate.id === id &&
                    candidate.type === "buffer"
            );
        }

        #getPendingIntervalElapsedBoundary(
            record
        ) {
            const endBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "end"
                );

            const bufferedEnd =
                this.#getIntervalRecordEnd(
                    endBuffer
                );

            if (Number.isFinite(bufferedEnd)) {
                return bufferedEnd;
            }

            const storedBufferedEnd =
                Number(
                    record?.clockTimerBufferedEndTimeline
                );

            if (Number.isFinite(storedBufferedEnd)) {
                return storedBufferedEnd;
            }

            return this.#getIntervalRecordEnd(
                record
            );
        }

        #getIntervalElapsedBoundaryType(
            record
        ) {
            return this.#getIntervalBufferRecord(
                record,
                "end"
            )
                ? "end-buffer"
                : "interval";
        }

        #dispatchIntervalElapsed(
            record,
            boundary,
            now
        ) {
            const boundaryType =
                this.#getIntervalElapsedBoundaryType(
                    record
                );

            const defaultBehavior =
                this.#intervalElapsedBehavior;

            let behavior =
                defaultBehavior;

            const detail = {
                connected:
                    this.#connectionState ===
                        "connected",
                intervalId:
                    Number.isInteger(
                        Number(
                            record?.intervalId
                        )
                    )
                        ? Number(
                            record.intervalId
                        )
                        : undefined,
                intervalType:
                    record?.type,
                boundaryType,
                boundaryTime:
                    this.#timelineToISO(
                        boundary
                    ),
                intervalEndTime:
                    this.#timelineToISO(
                        this.#getIntervalRecordEnd(
                            record
                        )
                    ),
                currentTime:
                    this.#timelineToISO(
                        now
                    ),
                defaultBehavior
            };

            Object.defineProperty(
                detail,
                "behavior",
                {
                    enumerable: true,
                    configurable: false,
                    get: () => behavior,
                    set: value => {
                        const normalized =
                            this.#normalizeIntervalElapsedBehavior(
                                value
                            );

                        if (!normalized) {
                            throw new RangeError(
                                "intervalElapsed behavior must be startLatency, extendBoundary, extendInterval, or rollover."
                            );
                        }

                        behavior =
                            normalized;
                    }
                }
            );

            if (this.#eventsReady) {
                this.dispatchEvent(
                    new CustomEvent(
                        "intervalElapsed",
                        {
                            detail,
                            bubbles: true,
                            composed: true
                        }
                    )
                );
            }

            return {
                defaultBehavior,
                behavior,
                overridden:
                    behavior !==
                        defaultBehavior,
                boundaryType:
                    detail.boundaryType
            };
        }

        #startIntervalExtension(
            record,
            boundary,
            now,
            decision
        ) {
            if (
                !record ||
                !Number.isFinite(boundary) ||
                !Number.isFinite(now)
            ) {
                return false;
            }

            const intervalEnd =
                this.#getIntervalRecordEnd(
                    record
                );

            const endBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "end"
                );

            const extensionTarget =
                endBuffer
                    ? "end-buffer"
                    : "interval";

            record.clockTimerExtensionOriginalEndTimeline =
                intervalEnd;

            record.clockTimerExtensionBoundaryTimeline =
                boundary;

            record.clockTimerExtensionTarget =
                extensionTarget;

            let extensionRecord =
                record;

            if (endBuffer) {
                const inserted =
                    this.#insert({
                        type:
                            "end-buffer-extension",
                        startTime:
                            this.#formatTimelineTime(
                                boundary
                            ),
                        otherAttributes: {}
                    });

                if (!inserted) {
                    return false;
                }

                extensionRecord =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id ===
                                inserted.clockTimerInserted
                    );

                if (!extensionRecord) {
                    return false;
                }

                extensionRecord.clockTimerGeneratedEndBufferExtension =
                    true;

                extensionRecord.clockTimerIntervalExtensionFor =
                    record.id;

                record.clockTimerExtensionRecordId =
                    extensionRecord.id;
            }
            else {
                record.clockTimerExtensionOriginalEndDate =
                    record.endDate instanceof Date
                        ? new Date(
                            record.endDate.getTime()
                        )
                        : undefined;

                record.clockTimerExtensionOriginalRangeLength =
                    record.rangeLength;

                record.openEnded =
                    true;

                record.clockTimerGrowthMode =
                    "displace";

                record.endDate =
                    undefined;

                record.rangeLength =
                    undefined;

                this.#openEndedRange =
                    record;

                this.#openEndedLastTick =
                    boundary;

                this.#syncOpenEndedRangeElements(
                    record,
                    boundary
                );
            }

            record.clockTimerExtensionActive =
                true;

            if (now > boundary) {
                this.#updateOpenEndedRangeTo(
                    now
                );
            }

            this.#emitClockTimerEvent(
                "intervalExtended",
                {
                    intervalId:
                        Number.isInteger(
                            Number(
                                record.intervalId
                            )
                        )
                            ? Number(
                                record.intervalId
                            )
                            : undefined,
                    intervalType:
                        record.type,
                    boundaryType:
                        decision.boundaryType,
                    boundaryTime:
                        this.#timelineToISO(
                            boundary
                        ),
                    extensionTarget,
                    extensionType:
                        extensionTarget ===
                            "end-buffer"
                            ? "end-buffer-extension"
                            : record.type,
                    extensionStartTime:
                        this.#timelineToISO(
                            boundary
                        ),
                    currentTime:
                        this.#timelineToISO(
                            now
                        ),
                    defaultBehavior:
                        decision.defaultBehavior,
                    behavior:
                        decision.behavior,
                    overridden:
                        decision.overridden,
                    calculatedEndTime:
                        this.#timelineToISO(
                            this.#calculatedEndTime
                        )
                }
            );

            return true;
        }

        #finishIntervalExtension(
            record,
            now
        ) {
            if (
                !record?.clockTimerExtensionActive ||
                !Number.isFinite(now)
            ) {
                return false;
            }

            const extensionTarget =
                record.clockTimerExtensionTarget;

            const extensionRecord =
                extensionTarget ===
                    "end-buffer"
                    ? this.#insertedRanges.find(
                        candidate =>
                            candidate.id ===
                                record.clockTimerExtensionRecordId
                    )
                    : record;

            if (
                !extensionRecord ||
                this.#openEndedRange !==
                    extensionRecord
            ) {
                return false;
            }

            this.#updateOpenEndedRangeTo(
                now
            );

            const extensionStart =
                this.#dateToTimelineTime(
                    extensionRecord.startDate
                );

            if (!Number.isFinite(extensionStart)) {
                return false;
            }

            extensionRecord.openEnded =
                false;

            extensionRecord.clockTimerGrowthMode =
                "fixed";

            extensionRecord.rangeLength =
                Math.max(
                    0,
                    now - extensionStart
                );

            extensionRecord.endDate =
                new Date(
                    extensionRecord.startDate.getTime() +
                        extensionRecord.rangeLength
                );

            this.#openEndedRange =
                undefined;

            this.#openEndedLastTick =
                undefined;

            record.clockTimerExtensionActive =
                false;

            record.clockTimerExplicitlyEnded =
                true;

            record.clockTimerExplicitEndTimeline =
                extensionTarget ===
                    "interval"
                    ? now
                    : record.clockTimerExtensionOriginalEndTimeline;

            if (extensionTarget === "interval") {
                record.clockTimerPersistenceEnd =
                    this.#timelineToISO(
                        now
                    );
            }

            this.#pendingIntervalRecord =
                undefined;

            this.#renderAllInsertedRanges();

            return true;
        }

        #updateIntervalElapsed(now) {
            const record =
                this.#pendingIntervalRecord;

            if (!record || !Number.isFinite(now)) {
                return false;
            }

            let boundary =
                Number(
                    record.clockTimerElapsedBoundaryTimeline
                );

            if (!Number.isFinite(boundary)) {
                boundary =
                    this.#getPendingIntervalElapsedBoundary(
                        record
                    );
            }

            if (
                !Number.isFinite(boundary) ||
                now < boundary
            ) {
                return false;
            }

            let decision;

            if (
                record.clockTimerElapsedDispatched !==
                    true
            ) {
                record.clockTimerElapsedBoundaryTimeline =
                    boundary;

                decision =
                    this.#dispatchIntervalElapsed(
                        record,
                        boundary,
                        now
                    );

                record.clockTimerElapsedDispatched =
                    true;
                record.clockTimerElapsedDefaultBehavior =
                    decision.defaultBehavior;
                record.clockTimerElapsedBehavior =
                    decision.behavior;
                record.clockTimerElapsedOverridden =
                    decision.overridden;
                record.clockTimerElapsedBoundaryType =
                    decision.boundaryType;

                record.clockTimerEventKey ??=
                    this.#createTripEventClientToken();

                this.#queueTripEvent(
                    "interval.elapsed",
                    this.#timelineToISO(
                        now
                    ) ??
                        new Date(),
                    {
                        intervalKey:
                            record.clockTimerEventKey,
                        boundaryType:
                            decision.boundaryType,
                        boundaryTime:
                            this.#timelineToISO(
                                boundary
                            ),
                        defaultBehavior:
                            decision.defaultBehavior,
                        behavior:
                            decision.behavior,
                        overridden:
                            decision.overridden ===
                                true
                    }
                );

                this.#scheduleTripEventSync();
            }
            else {
                decision = {
                    defaultBehavior:
                        record.clockTimerElapsedDefaultBehavior ??
                            this.#intervalElapsedBehavior,
                    behavior:
                        record.clockTimerElapsedBehavior ??
                            this.#intervalElapsedBehavior,
                    overridden:
                        record.clockTimerElapsedOverridden ===
                            true,
                    boundaryType:
                        record.clockTimerElapsedBoundaryType ??
                            this.#getIntervalElapsedBoundaryType(
                                record
                            )
                };
            }

            const extendInterval =
                decision.behavior === "extendBoundary" ||
                (
                    decision.behavior ===
                        "extendInterval" &&
                    decision.boundaryType ===
                        "interval"
                );

            if (extendInterval) {
                if (
                    record.clockTimerExtensionActive ===
                        true
                ) {
                    return true;
                }

                return this.#startIntervalExtension(
                    record,
                    boundary,
                    now,
                    decision
                );
            }

            if (decision.behavior === "rollover") {
                return true;
            }

            const intervalEnd =
                Number.isFinite(
                    record.clockTimerExtensionOriginalEndTimeline
                )
                    ? record.clockTimerExtensionOriginalEndTimeline
                    : this.#getIntervalRecordEnd(
                        record
                    );

            const activeLatency =
                this.#openOverwriteRange;

            if (
                activeLatency?.openEnded === true &&
                activeLatency.type === "latency" &&
                activeLatency.clockTimerIntervalLatency ===
                    record.id
            ) {
                return true;
            }

            const current =
                this.#getCurrentReplaceableRange(
                    now
                );
            if (!current) {
                return false;
            }

            if (
                current.getAttribute("type") !==
                    "trip"
            ) {
                return false;
            }

            const replacement =
                this.#overwrite({
                    type: "latency",
                    startTime:
                        this.#formatTimelineTime(
                            boundary
                        )
                });
            if (!replacement) {
                return false;
            }

            const latencyRecord =
                this.#openOverwriteRange;

            if (
                !latencyRecord ||
                latencyRecord.type !== "latency"
            ) {
                return false;
            }

            latencyRecord.clockTimerIntervalLatency =
                record.id;

            replacement.clockTimerIntervalLatency =
                record.id;

            this.#updateOpenOverwriteRangeTo(
                now
            );

            this.#emitClockTimerEvent(
                "latencyStarted",
                {
                    intervalId:
                        Number.isInteger(
                            Number(
                                record.intervalId
                            )
                        )
                            ? Number(
                                record.intervalId
                            )
                            : undefined,
                    intervalType:
                        record.type,
                    boundaryType:
                        decision.boundaryType,
                    boundaryTime:
                        this.#timelineToISO(
                            boundary
                        ),
                    intervalEndTime:
                        this.#timelineToISO(
                            intervalEnd
                        ),
                    latencyEligibleTime:
                        this.#timelineToISO(
                            boundary
                        ),
                    latencyStartTime:
                        this.#timelineToISO(
                            now
                        ),
                    defaultBehavior:
                        decision.defaultBehavior,
                    behavior:
                        "startLatency",
                    overridden:
                        decision.overridden
                }
            );


            if (
                this.#autoRestartTripAfterLateBreak &&
                decision.boundaryType === "end-buffer" &&
                ["break", "lunch"].includes(String(record.type).toLowerCase())
            ) {
                const lifecycleScheduledEnd =
                    Number.isFinite(
                        Number(
                            record.clockTimerExtensionOriginalEndTimeline
                        )
                    )
                        ? Number(
                            record.clockTimerExtensionOriginalEndTimeline
                        )
                        : this.#getIntervalRecordEnd(
                            record
                        );

                if (this.#endPendingInterval(now)) {
                    const lifecycleTiming =
                        this.#getTimingDetail(
                            now,
                            lifecycleScheduledEnd
                        );

                    const intervalEndedDetail = {
                        ...this.#mutationResult(
                            false,
                            record
                        ),
                        ...lifecycleTiming,
                        completion:
                            lifecycleTiming.timing,
                        type: record.type,
                        startTime:
                            record.startDate?.toISOString?.(),
                        endTime:
                            this.#timelineToISO(now),
                        actualEndTime:
                            this.#timelineToISO(now),
                        scheduledEndTime:
                            this.#timelineToISO(
                                lifecycleScheduledEnd
                            ),
                        automaticRestart: true,
                        endReason: "automatic-restart"
                    };

                    this.#emitClockTimerEvent(
                        "intervalEnded",
                        intervalEndedDetail
                    );

                    record.clockTimerEventKey ??=
                        this.#createTripEventClientToken();

                    this.#queueTripEvent(
                        "interval.ended",
                        this.#timelineToISO(
                            now
                        ) ??
                            new Date(),
                        {
                            intervalKey:
                                record.clockTimerEventKey,
                            reason:
                                "automatic-restart"
                        }
                    );

                    this.#scheduleTripEventSync();

                    this.#emitSemanticIntervalEnded(
                        record,
                        intervalEndedDetail,
                        {
                            automaticRestart: true,
                            actualEnd: now,
                            boundary
                        }
                    );

                    this.#emitClockTimerEvent("tripAutomaticallyRestarted", {
                        intervalId: Number.isInteger(Number(record.intervalId))
                            ? Number(record.intervalId)
                            : undefined,
                        intervalType: record.type,
                        boundaryType: decision.boundaryType,
                        boundaryTime: this.#timelineToISO(boundary),
                        restartTime: this.#timelineToISO(now)
                    });
                    return true;
                }
            }
            return true;
        }

        #endBufferedPendingInterval(
            record,
            now
        ) {
            if (
                !record ||
                record.openEnded === true ||
                !Number.isFinite(now)
            ) {
                return false;
            }

            const mainStart =
                this.#dateToTimelineTime(
                    record.startDate
                );

            const mainEnd =
                this.#getIntervalRecordEnd(
                    record
                );

            const endBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "end"
                );

            const endBufferEnd =
                this.#getIntervalRecordEnd(
                    endBuffer
                );

            const storedBufferedEnd =
                Number(
                    record.clockTimerBufferedEndTimeline
                );

            const earlyStartEnd =
                Number.isFinite(endBufferEnd)
                    ? endBufferEnd
                    : Number.isFinite(storedBufferedEnd) &&
                        storedBufferedEnd > mainEnd
                        ? storedBufferedEnd
                        : mainEnd;

            if (
                !Number.isFinite(mainStart) ||
                !Number.isFinite(mainEnd) ||
                !Number.isFinite(earlyStartEnd) ||
                now >= earlyStartEnd
            ) {
                return false;
            }

            const previousCalculatedEndTime =
                this.#calculatedEndTime;

            const actualEnd =
                this.#timelineToISO(
                    now
                );

            const scheduledEnd =
                this.#timelineToISO(
                    mainEnd
                );

            const bufferedEnd =
                this.#timelineToISO(
                    earlyStartEnd
                );

            record.otherAttributes = {
                ...(record.otherAttributes ?? {}),
                "clock-timer-scheduled-end":
                    scheduledEnd,
                "clock-timer-buffered-end":
                    bufferedEnd,
                "clock-timer-actual-end":
                    actualEnd,
                "clock-timer-early-start-end":
                    bufferedEnd
            };

            record.clockTimerActualEndTimeline =
                now;

            record.clockTimerEarlyStartEndTimeline =
                earlyStartEnd;

            if (
                now > mainStart &&
                now < mainEnd
            ) {
                record.clockTimerPersistenceEnd =
                    actualEnd;
            }

            const startBuffer =
                this.#getIntervalBufferRecord(
                    record,
                    "start"
                );

            const linked =
                [
                    startBuffer,
                    record,
                    endBuffer
                ].filter(Boolean);

            for (const candidate of linked) {
                const start =
                    this.#dateToTimelineTime(
                        candidate.startDate
                    );

                const end =
                    this.#getIntervalRecordEnd(
                        candidate
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end)
                ) {
                    continue;
                }

                candidate.clockTimerExplicitlyEnded =
                    true;

                candidate.clockTimerExplicitEndTimeline =
                    Math.min(
                        end,
                        Math.max(
                            start,
                            now
                        )
                    );
            }

            record.clockTimerExplicitEndTimeline =
                Math.min(
                    mainEnd,
                    Math.max(
                        mainStart,
                        now
                    )
                );

            this.#pendingIntervalRecord =
                undefined;

            this.#renderAllInsertedRanges({
                animateRemoval: false
            });

            let replacement;

            try {
                replacement =
                    this.#overwrite({
                        type: "earlystart",
                        startTime:
                            this.#formatTimelineTime(
                                now
                            ),
                        endTime:
                            this.#formatTimelineTime(
                                earlyStartEnd
                            )
                    });
            }
            finally {
                this.#calculatedEndTime =
                    previousCalculatedEndTime;
            }

            if (!replacement) {
                return false;
            }

            if (this.#needsTick()) {
                this.#startTickTimer();
            }
            else {
                this.#stopTickTimer();
            }

            return true;
        }

        #endPendingInterval(now) {
            const record =
                this.#pendingIntervalRecord;

            if (!record || !Number.isFinite(now)) {
                return false;
            }

            if (
                this.#endBufferedPendingInterval(
                    record,
                    now
                )
            ) {
                return true;
            }

            if (
                record.clockTimerExtensionActive ===
                    true
            ) {
                return this.#finishIntervalExtension(
                    record,
                    now
                );
            }

            const end =
                this.#getIntervalRecordEnd(
                    record
                );

            if (!Number.isFinite(end)) {
                return false;
            }

            if (now < end) {
                const replacement =
                    this.#replaceToNext(
                        "earlystart"
                    );

                if (!replacement) {
                    return false;
                }

                record.clockTimerExplicitlyEnded = true;
                record.clockTimerExplicitEndTimeline = now;
                this.#pendingIntervalRecord = undefined;
                return true;
            }

            this.#updateIntervalElapsed(now);

            if (
                record.clockTimerExtensionActive ===
                    true
            ) {
                return this.#finishIntervalExtension(
                    record,
                    now
                );
            }

            this.#checkGoalMisses(now);

            const activeLatency =
                this.#openOverwriteRange;

            if (
                activeLatency?.openEnded === true &&
                activeLatency.type === "latency" &&
                activeLatency.clockTimerIntervalLatency ===
                    record.id
            ) {
                this.#updateOpenOverwriteRangeTo(
                    now
                );

                activeLatency.openEnded = false;
                activeLatency.clockTimerGrowthMode =
                    "fixed";
                activeLatency.end = Math.max(
                    activeLatency.start,
                    now
                );

                this.#openOverwriteRange =
                    undefined;
                this.#openOverwriteLastTick =
                    undefined;
            }

            const current =
                this.#getCurrentReplaceableRange(now);

            if (
                !activeLatency &&
                current?.getAttribute("type") ===
                    "latency" &&
                current.clockTimerIntervalLatency ===
                    record.id
            ) {
                this.#replaceToNext("trip");
            }

            record.clockTimerExplicitlyEnded = true;
            record.clockTimerExplicitEndTimeline = end;
            this.#pendingIntervalRecord = undefined;
            return true;
        }

        #startIntervalLocal(
            type,
            length,
            attributes,
            startBuffer,
            endBuffer,
            at = new Date()
        ) {
            let intervalType;
            let duration;
            let startBufferDuration;
            let endBufferDuration;
            let normalizedAttributes;

            try {
                if (
                    typeof type !==
                        "string" ||
                    type.trim() ===
                        ""
                ) {
                    return false;
                }

                intervalType =
                    type.trim();

                if (
                    !this.#isIntervalType(
                        intervalType
                    )
                ) {
                    return false;
                }

                if (length !== undefined) {
                    duration =
                        this.#parseIntervalLength(
                            length
                        );
                }

                if (startBuffer !== undefined) {
                    startBufferDuration =
                        this.#parseIntervalLength(
                            startBuffer
                        );
                }

                if (endBuffer !== undefined) {
                    endBufferDuration =
                        this.#parseIntervalLength(
                            endBuffer
                        );
                }

                if (
                    (
                        startBufferDuration !== undefined ||
                        endBufferDuration !== undefined
                    ) &&
                    duration === undefined
                ) {
                    return false;
                }

                normalizedAttributes =
                    this.#normalizeIntervalAttributes(
                        attributes
                    );

                for (
                    const name of
                        Object.keys(normalizedAttributes)
                ) {
                    if (
                        name.toLowerCase() ===
                            "interval-id"
                    ) {
                        delete normalizedAttributes[name];
                    }
                }
            }
            catch {
                return false;
            }

            if (!this.#started) {
                return false;
            }

            const nowDate =
                at instanceof Date
                    ? new Date(
                        at.getTime()
                    )
                    : new Date(at);

            if (
                Number.isNaN(
                    nowDate.getTime()
                )
            ) {
                return false;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            if (this.#pendingIntervalRecord) {
                return false;
            }

            const currentInterval =
                this.#getCurrentInterval(
                    now
                );

            if (
                currentInterval &&
                !currentInterval.open
            ) {
                return false;
            }

            if (
                currentInterval?.open &&
                !this.#closeOpenIntervalAt(
                    nowDate,
                    currentInterval
                )
            ) {
                return false;
            }

            let activeEarlyStartOverwrite;

            if (Number.isFinite(duration)) {
                activeEarlyStartOverwrite =
                    this.#overwriteRanges.find(
                        record =>
                            record.type ===
                                "earlystart" &&
                            record.openEnded !==
                                true &&
                            Number.isFinite(
                                record.start
                            ) &&
                            Number.isFinite(
                                record.end
                            ) &&
                            record.start <=
                                now &&
                            now <
                                record.end
                    );
            }

            if (activeEarlyStartOverwrite) {
                this.#trimOverwriteRecords(
                    now,
                    activeEarlyStartOverwrite.end
                );
            }

            let cursor =
                now;

            let startBufferRecord;

            if (Number.isFinite(startBufferDuration)) {
                const startBufferElement =
                    this.#insert({
                        type: "buffer",
                        startTime:
                            this.#formatTimelineTime(
                                cursor
                            ),
                        rangeLength:
                            this.#formatStandardTime(
                                startBufferDuration
                            ),
                        otherAttributes: {}
                    });

                if (!startBufferElement) {
                    return false;
                }

                startBufferRecord =
                    this.#insertedRanges.find(
                        record =>
                            record.id ===
                                startBufferElement.clockTimerInserted
                    );

                cursor +=
                    startBufferDuration;
            }

            const rangeLength =
                duration === undefined
                    ? undefined
                    : this.#formatStandardTime(
                        duration
                    );

            const inserted =
                this.#insert({
                    type:
                        intervalType,
                    startTime:
                        this.#formatTimelineTime(
                            cursor
                        ),
                    rangeLength,
                    otherAttributes:
                        normalizedAttributes
                });

            if (!inserted) {
                return false;
            }

            const record =
                this.#insertedRanges.find(
                    candidate =>
                        candidate.id ===
                            inserted.clockTimerInserted
                );

            if (!record) {
                return false;
            }

            let endBufferRecord;

            if (Number.isFinite(endBufferDuration)) {
                const explicitEnd =
                    cursor +
                    duration;

                const endBufferElement =
                    this.#insert({
                        type: "buffer",
                        startTime:
                            this.#formatTimelineTime(
                                explicitEnd
                            ),
                        rangeLength:
                            this.#formatStandardTime(
                                endBufferDuration
                            ),
                        otherAttributes: {}
                    });

                if (!endBufferElement) {
                    return false;
                }

                endBufferRecord =
                    this.#insertedRanges.find(
                        candidate =>
                            candidate.id ===
                                endBufferElement.clockTimerInserted
                    );
            }

            if (startBufferRecord) {
                startBufferRecord.clockTimerBufferPosition =
                    "start";

                startBufferRecord.clockTimerBufferedIntervalRecordId =
                    record.id;

                record.clockTimerStartBufferRecordId =
                    startBufferRecord.id;
            }

            if (endBufferRecord) {
                endBufferRecord.clockTimerBufferPosition =
                    "end";

                endBufferRecord.clockTimerBufferedIntervalRecordId =
                    record.id;

                record.clockTimerEndBufferRecordId =
                    endBufferRecord.id;
            }

            if (Number.isFinite(duration)) {
                record.clockTimerBufferedStartTimeline =
                    now;

                const scheduledEndTimeline =
                    cursor +
                    duration;

                record.clockTimerBufferedEndTimeline =
                    scheduledEndTimeline +
                    (
                        Number.isFinite(
                            endBufferDuration
                        )
                            ? endBufferDuration
                            : 0
                    );

                record.otherAttributes = {
                    ...(record.otherAttributes ?? {}),
                    "clock-timer-scheduled-end":
                        this.#timelineToISO(
                            scheduledEndTimeline
                        ),
                    "clock-timer-buffered-end":
                        this.#timelineToISO(
                            record.clockTimerBufferedEndTimeline
                        )
                };

                this.#pendingIntervalRecord =
                    record;
            }

            return inserted;
        }

        #endIntervalLocal(
            at = new Date()
        ) {
            if (!this.#started) {
                return false;
            }

            const nowDate =
                at instanceof Date
                    ? new Date(
                        at.getTime()
                    )
                    : new Date(at);

            if (
                Number.isNaN(
                    nowDate.getTime()
                )
            ) {
                return false;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const interval =
                this.#getCurrentInterval(
                    now
                );

            if (
                !interval &&
                !this.#pendingIntervalRecord
            ) {
                return false;
            }

            if (this.#pendingIntervalRecord) {
                return this.#endPendingInterval(now);
            }

            if (interval.open) {
                return this.#closeOpenIntervalAt(
                    nowDate,
                    interval
                );
            }

            return false;
        }

        #replaceWithNext() {
            if (
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const ringIndex =
                this.#getTimerRingIndex(
                    now
                );

            const ring =
                this.#rings.get(
                    ringIndex
                );

            if (!ring) {
                return;
            }

            let currentRange;
            let currentStart =
                -Infinity;

            let nextRange;
            let nextStart =
                Infinity;

            for (
                const range of
                    ring.querySelectorAll(
                        ":scope > time-range"
                    )
            ) {
                if (
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                let start =
                    Number(
                        range.clockTimerStart
                    );

                if (
                    !Number.isFinite(
                        start
                    )
                ) {
                    const startTime =
                        range.getAttribute(
                            "start-time"
                        );

                    if (
                        typeof startTime !==
                            "string"
                    ) {
                        continue;
                    }

                    let parsed;

                    try {
                        parsed =
                            this.#parseStandardTime(
                                startTime,
                                {
                                    duration: false,
                                    name: "start-time"
                                }
                            );
                    }
                    catch {
                        continue;
                    }

                    start =
                        this.#resolveNear(
                            parsed.total,
                            now
                        );
                }

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }

                if (
                    start < now ||
                    start >= nextStart
                ) {
                    continue;
                }

                nextRange =
                    range;

                nextStart =
                    start;
            }

            if (!nextRange) {
                return;
            }

            this.#extendCalculatedEndTime(
                nextStart - now,
                nextRange.getAttribute(
                    "type"
                )
            );

            if (currentRange) {
                delete currentRange.clockTimerOverwriteType;
            }

            this.#setRangeStart(
                nextRange,
                now
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return nextRange;
        }

        #replaceToNext(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const ringIndex =
                this.#getTimerRingIndex(
                    now
                );

            const ring =
                this.#rings.get(
                    ringIndex
                );

            if (!ring) {
                return;
            }

            let currentRange;
            let currentStart =
                -Infinity;
            let currentEnd;

            for (
                const range of
                    ring.querySelectorAll(
                        ":scope > time-range"
                    )
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;

                    currentEnd =
                        end;
                }
            }

            if (
                !currentRange ||
                !Number.isFinite(
                    currentEnd
                ) ||
                currentEnd <= now
            ) {
                return;
            }

            delete currentRange.clockTimerOverwriteType;

            this.#setRangeEnd(
                currentRange,
                now
            );

            const replacementType =
                type.trim();

            this.#extendCalculatedEndTime(
                currentEnd - now,
                replacementType
            );

            const replacement =
                this.#createTimeRange(
                    replacementType,
                    now,
                    currentEnd,
                    {
                        dynamic: true
                    }
                );

            replacement.setAttribute(
                "data-time-range-full-entry",
                ""
            );

            ring.insertBefore(
                replacement,
                currentRange.nextSibling
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return replacement;
        }

        #replaceWithPrevious() {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (!this.#started) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            let currentRange;
            let currentStart =
                -Infinity;

            let previousRange;
            let previousEnd =
                -Infinity;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }

                if (
                    Number.isFinite(end) &&
                    end <= now &&
                    end > previousEnd
                ) {
                    previousRange =
                        range;

                    previousEnd =
                        end;
                }
            }

            if (
                !currentRange ||
                !previousRange ||
                previousEnd >= now
            ) {
                return;
            }

            this.#extendCalculatedEndTime(
                now - previousEnd,
                previousRange.getAttribute(
                    "type"
                )
            );

            this.#setRangeEnd(
                previousRange,
                now
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (this.#needsTick()) {
                this.#startTickTimer();
            }

            return previousRange;
        }

        #replaceToPrevious(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            let currentRange;
            let currentStart =
                -Infinity;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.hasAttribute(
                        "overlapping"
                    ) ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    start <= now &&
                    end > now &&
                    start > currentStart
                ) {
                    currentRange =
                        range;

                    currentStart =
                        start;
                }
            }

            if (
                !currentRange ||
                !Number.isFinite(
                    currentStart
                ) ||
                currentStart >= now
            ) {
                return;
            }

            const ring =
                currentRange.parentElement;

            if (!ring) {
                return;
            }

            this.#setRangeStart(
                currentRange,
                now
            );

            const replacementType =
                type.trim();

            this.#extendCalculatedEndTime(
                now - currentStart,
                replacementType
            );

            const replacement =
                this.#createTimeRange(
                    replacementType,
                    currentStart,
                    now,
                    {
                        dynamic: true
                    }
                );

            replacement.setAttribute(
                "data-time-range-full-entry",
                ""
            );

            ring.insertBefore(
                replacement,
                currentRange
            );

            this.#tickAlignmentMilliseconds =
                nowDate.getMilliseconds();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return replacement;
        }

        #clearLocal() {
            if (!this.#hasStartProperties()) {
                return false;
            }

            if (this.#started) {
                return false;
            }

            this.#cancelToleranceTransition();
            this.#cancelStateChangeVisuals(false);

            this.#stopTickTimer();
            this.#cancelTimeRangeTimingAnimations();
            this.#setIndicatorSymbolVisible(false);

            this.#creationTime =
                undefined;

            this.#creationMilliseconds =
                undefined;

            this.#scheduledStart =
                undefined;

            this.#scheduledStartMilliseconds =
                undefined;

            this.#standardTime =
                undefined;

            this.#standardDuration =
                undefined;

            this.#originalStartArguments =
                undefined;

            this.#nonProduction =
                false;

            this.#startedAtEpoch =
                undefined;

            this.#creationDateOverride =
                undefined;

            this.#ringAnchor =
                undefined;

            this.#tripEnd =
                undefined;

            this.#standardEnd =
                undefined;

            this.#calculatedEnd =
                undefined;

            this.#calculatedEndTime =
                undefined;

            this.#toleranceEnd =
                undefined;

            this.#elapsedRange =
                undefined;

            this.#overtimeRanges.clear();

            this.#remainingRanges.clear();

            this.#removeWaveRange();

            this.#rings.clear();

            this.#started =
                false;

            this.#matchedTripGoal =
                undefined;

            if (!this.#preserveInsertedOnClear) {
                this.#setRenderedPercentGoal(
                    1,
                    "user"
                );
            }

            this.#tripGoalMissedState = false;
            this.#totalGoalMissedState = false;

            this.#tickAlignmentMilliseconds =
                undefined;

            if (
                !this.#preserveInsertedOnClear
            ) {
                this.#insertedRanges =
                    [];

                this.#openEndedRange =
                    undefined;

                this.#openEndedLastTick =
                    undefined;
            }

            this.#overwriteRanges =
                [];

            this.#openOverwriteRange =
                undefined;

            this.#openOverwriteLastTick =
                undefined;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (
                RingContainerClass
            ) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                const duration =
                    this.#getRangeAnimationDuration();

                for (
                    const ring of
                        this.#getTimerRings()
                ) {
                    for (
                        const range of
                            ring.querySelectorAll(
                                ":scope > time-range"
                            )
                    ) {
                        if (
                            typeof this.#getRangeRenderer(range)?.snapRangeGeometry === "function"
                        ) {
                            this.#snapRangeGeometry(range);
                        }
                    }

                    delete ring.clockTimerRing;

                    ring.clockTimerExitingRing =
                        true;

                    ring.resizeDuration =
                        `${duration}ms`;

                    ring.setAttribute(
                        "width",
                        "0px"
                    );

                    setTimeout(
                        () => ring.remove(),
                        duration
                    );
                }

                this.#ensureBorderRing();

                this.#ensureTickRing();

                this.#ensureHandRing();

                this.#ensureNumberRing();

                this.#ensurePermanentRingOrder();
            }
            finally {
                if (
                    RingContainerClass
                ) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            this.#refreshRingLayout(
                undefined,
                {
                    refreshTickMarks: true
                }
            );

            return new Date();
        }

        #ensureAttributes() {
            if (
                !this.hasAttribute(
                    "timer-type"
                )
            ) {
                this.setAttribute(
                    "timer-type",
                    "radial-overflow"
                );
            }
            else {
                this.#timerType =
                    this.#normalizeTimerType();
            }

            if (
                !this.hasAttribute(
                    "timer-mode"
                )
            ) {
                this.setAttribute(
                    "timer-mode",
                    "elapsed"
                );
            }
            else {
                this.#normalizeTimerMode();
            }

            if (
                !this.hasAttribute(
                    "percent-mode"
                )
            ) {
                this.setAttribute(
                    "percent-mode",
                    "auto"
                );
            }

            if (
                !this.hasAttribute(
                    "military-time"
                )
            ) {
                this.setAttribute(
                    "military-time",
                    "true"
                );
            }
            else {
                this.#normalizeMilitaryTime();
            }

            if (
                !this.hasAttribute(
                    "time-format"
                )
            ) {
                this.setAttribute(
                    "time-format",
                    this.#getDefaultFormat()
                );
            }
            else {
                this.#normalizeFormat();
            }
        }

        #getTimerType() {
            return this.#timerType;
        }

        #normalizeTimerType() {
            const raw =
                this.getAttribute(
                    "timer-type"
                );

            const normalized =
                typeof raw === "string" &&
                raw.trim().toLowerCase() ===
                    "radial-fitted"
                    ? "radial-fitted"
                    : "radial-overflow";

            if (raw !== normalized) {
                this.setAttribute(
                    "timer-type",
                    normalized
                );
            }

            return normalized;
        }

        #handleTimerTypeChange(
            oldValue,
            newValue
        ) {
            const timerType =
                this.#normalizeTimerType();

            if (newValue !== timerType) {
                return;
            }

            const previousType =
                this.#timerType;

            this.#timerType =
                timerType;

            if (
                previousType === timerType ||
                !this.isConnected
            ) {
                return;
            }

            this.#transitionTimerType(
                previousType,
                timerType
            );
        }

        #getTimerTypeRangeSnapshotSignature(
            snapshot
        ) {
            const attributes =
                snapshot.attributes
                    .map(
                        ([name, value]) => [
                            name,
                            value
                        ]
                    )
                    .sort(
                        (a, b) =>
                            a[0].localeCompare(
                                b[0]
                            ) ||
                            a[1].localeCompare(
                                b[1]
                            )
                    );

            const state =
                Object.entries(
                    snapshot.state
                )
                    .map(
                        ([name, value]) => [
                            name,
                            typeof value === "object" &&
                            value !== null
                                ? JSON.stringify(
                                    value
                                )
                                : String(
                                    value
                                )
                        ]
                    )
                    .sort(
                        (a, b) =>
                            a[0].localeCompare(
                                b[0]
                            ) ||
                            a[1].localeCompare(
                                b[1]
                            )
                    );

            return JSON.stringify({
                attributes,
                state,
                rangeLength:
                    snapshot.hasRangeLength
            });
        }

        #captureTimerTypeRangeSnapshots(
            rings
        ) {
            const snapshots = [];

            for (const ring of rings) {
                for (const range of ring.children) {
                    if (
                        range.localName !==
                            "time-range" ||
                        range.timeRangeExiting ===
                            true ||
                        this.#isTimerTypeTransitionVisualRange(
                            range
                        )
                    ) {
                        continue;
                    }

                    const start =
                        Number(
                            range.clockTimerStart
                        );

                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    if (!Number.isFinite(start)) {
                        continue;
                    }

                    const attributes =
                        Array.from(
                            range.attributes
                        )
                            .filter(
                                attribute =>
                                    ![
                                        "start-time",
                                        "end-time",
                                        "range-length",
                                        "ignore-overlaps",
                                        "timer-mode-transitioning",
                                        "slot"
                                    ].includes(
                                        attribute.name.toLowerCase()
                                    )
                            )
                            .map(
                                attribute => [
                                    attribute.name,
                                    attribute.value
                                ]
                            );

                    const state = {};

                    for (
                        const key of
                            Object.keys(range)
                    ) {
                        if (
                            !key.startsWith(
                                "clockTimer"
                            ) ||
                            key ===
                                "clockTimerStart" ||
                            key ===
                                "clockTimerEnd"
                        ) {
                            continue;
                        }

                        state[key] =
                            range[key];
                    }

                    const snapshot = {
                        start,
                        end:
                            Number.isFinite(end)
                                ? end
                                : undefined,
                        attributes,
                        state,
                        hasRangeLength:
                            range.hasAttribute(
                                "range-length"
                            )
                    };

                    snapshot.signature =
                        this.#getTimerTypeRangeSnapshotSignature(
                            snapshot
                        );

                    snapshots.push(
                        snapshot
                    );
                }
            }

            snapshots.sort(
                (a, b) =>
                    a.start - b.start ||
                    (
                        Number.isFinite(a.end)
                            ? a.end
                            : Infinity
                    ) -
                    (
                        Number.isFinite(b.end)
                            ? b.end
                            : Infinity
                    ) ||
                    a.signature.localeCompare(
                        b.signature
                    )
            );

            const merged = [];

            for (const snapshot of snapshots) {
                const previous =
                    merged[
                        merged.length - 1
                    ];

                if (
                    previous &&
                    previous.signature ===
                        snapshot.signature &&
                    Number.isFinite(
                        previous.end
                    ) &&
                    Number.isFinite(
                        snapshot.end
                    ) &&
                    previous.end ===
                        snapshot.start
                ) {
                    previous.end =
                        snapshot.end;

                    continue;
                }

                merged.push({
                    ...snapshot,
                    attributes:
                        snapshot.attributes.map(
                            entry => [
                                ...entry
                            ]
                        ),
                    state: {
                        ...snapshot.state
                    }
                });
            }

            return merged;
        }

        #appendTimerTypeTransitionRange(
            snapshot,
            start,
            end,
            ring
        ) {
            const range =
                document.createElement(
                    "time-range"
                );

            for (
                const [name, value] of
                    snapshot.attributes
            ) {
                range.setAttribute(
                    name,
                    value
                );
            }

            range.setAttribute(
                "ignore-overlaps",
                ""
            );

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            if (Number.isFinite(end)) {
                range.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        end
                    )
                );

                if (
                    snapshot.hasRangeLength
                ) {
                    range.setAttribute(
                        "range-length",
                        this.#formatStandardTime(
                            end - start
                        )
                    );
                }
            }

            range.clockTimerStart =
                String(start);

            if (Number.isFinite(end)) {
                range.clockTimerEnd =
                    String(end);
            }

            for (
                const [key, value] of
                    Object.entries(
                        snapshot.state
                    )
            ) {
                range[key] = value;
            }

            range.timeRangeFullEntry =
                true;

            ring.appendChild(
                range
            );

            this.#prepareTimerTypeTransitionVisualRange(
                range
            );

            return range;
        }

        #renderTimerTypeRangeSnapshots(
            snapshots
        ) {
            const ranges = [];

            for (const snapshot of snapshots) {
                if (
                    !Number.isFinite(
                        snapshot.end
                    ) ||
                    snapshot.end <=
                        snapshot.start
                ) {
                    const ring =
                        this.#ensureRing(
                            this.#getTimerRingIndex(
                                snapshot.start
                            )
                        );

                    ranges.push(
                        this.#appendTimerTypeTransitionRange(
                            snapshot,
                            snapshot.start,
                            undefined,
                            ring
                        )
                    );

                    continue;
                }

                let cursor =
                    snapshot.start;

                while (
                    cursor < snapshot.end
                ) {
                    const ringIndex =
                        this.#getTimerRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getTimerRingEnd(
                            ringIndex
                        );

                    const segmentEnd =
                        Math.min(
                            snapshot.end,
                            ringEnd
                        );

                    if (
                        !Number.isFinite(
                            segmentEnd
                        ) ||
                        segmentEnd <= cursor
                    ) {
                        break;
                    }

                    const ring =
                        this.#ensureRing(
                            ringIndex
                        );

                    ranges.push(
                        this.#appendTimerTypeTransitionRange(
                            snapshot,
                            cursor,
                            segmentEnd,
                            ring
                        )
                    );

                    cursor =
                        segmentEnd;
                }
            }

            return ranges;
        }

        #rebuildTimerTypeRangeReferences() {
            this.#elapsedRange =
                undefined;

            this.#remainingRanges.clear();
            this.#overtimeRanges.clear();

            let elapsedEnd =
                -Infinity;

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (
                    range.clockTimerElapsed !==
                        undefined
                ) {
                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    if (
                        Number.isFinite(end) &&
                        end > elapsedEnd
                    ) {
                        this.#elapsedRange =
                            range;

                        elapsedEnd =
                            end;
                    }
                }

                if (
                    Number.isFinite(ringIndex) &&
                    range.clockTimerRemaining !==
                        undefined
                ) {
                    this.#remainingRanges.set(
                        ringIndex,
                        range
                    );
                }

                if (
                    Number.isFinite(ringIndex) &&
                    range.clockTimerOvertime !==
                        undefined
                ) {
                    this.#overtimeRanges.set(
                        ringIndex,
                        range
                    );
                }
            }
        }

        #getTimerTypeTransitionReferenceTime(
            snapshots
        ) {
            if (this.#started) {
                return this.#getCurrentTimelineTime();
            }

            let reference;

            for (const snapshot of snapshots) {
                if (
                    Number.isFinite(
                        snapshot.end
                    ) &&
                    (
                        !Number.isFinite(
                            reference
                        ) ||
                        snapshot.end > reference
                    )
                ) {
                    reference =
                        snapshot.end;
                }
            }

            if (Number.isFinite(reference)) {
                return reference;
            }

            if (
                Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return this.#scheduledStartMilliseconds;
            }

            return snapshots.find(
                snapshot =>
                    Number.isFinite(
                        snapshot.start
                    )
            )?.start;
        }

        #resolveTimerTypeTransitionLength(
            value,
            context = this
        ) {
            if (
                typeof value === "number" &&
                Number.isFinite(value)
            ) {
                return value;
            }

            const text =
                String(
                    value ?? "0px"
                ).trim();

            if (!text) {
                return 0;
            }

            const measure =
                document.createElement(
                    "div"
                );

            measure.style.position =
                "absolute";

            measure.style.visibility =
                "hidden";

            measure.style.pointerEvents =
                "none";

            measure.style.marginLeft =
                text;

            const parent =
                context?.appendChild
                    ? context
                    : this;

            parent.appendChild(
                measure
            );

            const resolved =
                Number.parseFloat(
                    getComputedStyle(
                        measure
                    ).marginLeft
                );

            measure.remove();

            return Number.isFinite(
                resolved
            )
                ? resolved
                : 0;
        }

        #getTimerTypeTransitionMargin(
            ring,
            side
        ) {
            const value =
                side === "inner"
                    ? (
                        ring.innerMargin ??
                        ring.margin ??
                        "0px"
                    )
                    : (
                        ring.outerMargin ??
                        ring.margin ??
                        "0px"
                    );

            return this.#resolveTimerTypeTransitionLength(
                value,
                ring
            );
        }

        #collapseTimerTypeTransitionMargins(
            first,
            second
        ) {
            return (
                Math.max(
                    0,
                    first,
                    second
                ) +
                Math.min(
                    0,
                    first,
                    second
                )
            );
        }

        #calculateTimerTypeTargetGeometry(
            newRings
        ) {
            const newRingSet =
                new Set(
                    newRings
                );

            const geometry =
                new Map();

            let previous;

            for (
                const ring of
                    Array.from(
                        this.children
                    ).filter(
                        element =>
                            element.localName ===
                                "ring-container" &&
                            element.clockTimerLayoutDetached !==
                                true
                    )
            ) {
                const widthValue =
                    newRingSet.has(ring)
                        ? (
                            ring.clockTimerTargetWidth ??
                            ring.width ??
                            "0px"
                        )
                        : (
                            ring.width ??
                            "0px"
                        );

                const width =
                    Math.max(
                        0,
                        this.#resolveTimerTypeTransitionLength(
                            widthValue,
                            ring
                        )
                    );

                const insetValue =
                    ring.inset;

                let inset;

                if (
                    insetValue !== null &&
                    insetValue !== undefined &&
                    String(
                        insetValue
                    ).trim().toLowerCase() !==
                        "auto"
                ) {
                    inset =
                        this.#resolveTimerTypeTransitionLength(
                            insetValue,
                            ring
                        );
                }
                else if (!previous) {
                    inset =
                        this.#getTimerTypeTransitionMargin(
                            ring,
                            "outer"
                        ) +
                        width / 2;
                }
                else {
                    inset =
                        previous.inset +
                        previous.width / 2 +
                        this.#collapseTimerTypeTransitionMargins(
                            previous.innerMargin,
                            this.#getTimerTypeTransitionMargin(
                                ring,
                                "outer"
                            )
                        ) +
                        width / 2;
                }

                const entry = {
                    inset,
                    width,
                    widthValue,
                    innerMargin:
                        this.#getTimerTypeTransitionMargin(
                            ring,
                            "inner"
                        )
                };

                geometry.set(
                    ring,
                    entry
                );

                previous =
                    entry;
            }

            return geometry;
        }

        #isTimerRingOutsideBorder(
            ring
        ) {
            if (
                ring?.hasAttribute?.(
                    "active"
                )
            ) {
                return true;
            }

            if (
                !this.#borderRing ||
                this.#borderRing.parentElement !==
                    this
            ) {
                return false;
            }

            const children =
                Array.from(
                    this.children
                );

            const ringIndex =
                children.indexOf(
                    ring
                );

            const borderIndex =
                children.indexOf(
                    this.#borderRing
                );

            return (
                ringIndex !== -1 &&
                borderIndex !== -1 &&
                ringIndex < borderIndex
            );
        }

        #getTimerTypeRingAnimationDuration(
            ring
        ) {
            const base =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.resizeDuration ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            const filter =
                String(
                    ring?.resizeFilter ??
                    "none"
                ).trim().toLowerCase();

            if (
                filter === "none" ||
                ring?.filterRamp === false
            ) {
                return Math.max(
                    0,
                    base
                );
            }

            const front =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.filterRampFront ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            const end =
                TemporalFormat.cssTimeToMilliseconds(
                    String(
                        ring?.filterRampEnd ??
                        "0ms"
                    ).trim()
                ) ?? 0;

            return Math.max(
                0,
                front + base + end
            );
        }

        #snapTimerTypeRings(
            rings
        ) {
            for (
                const ring of
                    new Set(rings)
            ) {
                if (
                    ring?.isConnected &&
                    typeof ring.snapGeometry ===
                        "function"
                ) {
                    ring.snapGeometry();
                }
            }
        }

        #getIndicatorTrackAngle() {
            if (!this.#indicatorTrack) {
                return 0;
            }

            const normalize =
                angle =>
                    (
                        (
                            angle % 360
                        ) +
                        360
                    ) % 360;

            const transform =
                getComputedStyle(
                    this.#indicatorTrack
                ).transform;

            if (
                transform &&
                transform !== "none"
            ) {
                try {
                    const matrix =
                        new DOMMatrixReadOnly(
                            transform
                        );

                    const angle =
                        Math.atan2(
                            matrix.b,
                            matrix.a
                        ) *
                        180 /
                        Math.PI;

                    if (Number.isFinite(angle)) {
                        return normalize(
                            angle
                        );
                    }
                }
                catch {
                    // Fall through to the inline transform.
                }
            }

            const match =
                this.#indicatorTrack.style.transform
                    .match(
                        /rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i
                    );

            return match
                ? normalize(
                    Number(match[1])
                )
                : 0;
        }

        #getIndicatorAngleForTime(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds(
                        milliseconds
                    );

                if (!bounds) {
                    return undefined;
                }

                return Math.max(
                    0,
                    Math.min(
                        360,
                        (
                            (
                                milliseconds -
                                bounds.start
                            ) /
                            bounds.duration
                        ) *
                        360
                    )
                );
            }

            const millisecondsIntoHour =
                (
                    milliseconds %
                        ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) %
                ClockTimer.#HOUR;

            return (
                millisecondsIntoHour /
                ClockTimer.#HOUR
            ) *
            360;
        }

        #getTimerTypeIndicatorTopInset() {
            if (!this.#indicatorRing) {
                return 0;
            }

            const top =
                Number.parseFloat(
                    getComputedStyle(
                        this.#indicatorRing
                    ).top
                );

            if (Number.isFinite(top)) {
                return top;
            }

            const inset =
                Number.parseFloat(
                    this.#indicatorRing.style.inset
                );

            return Number.isFinite(inset)
                ? inset
                : 0;
        }

        #getTimerTypeIndicatorShadow(
            visible
        ) {
            return visible
                ? "drop-shadow(0 2px 2px rgb(0 0 0 / 80%)) drop-shadow(0 0 5px rgb(0 0 0 / 65%))"
                : "drop-shadow(0 2px 2px rgb(0 0 0 / 0%)) drop-shadow(0 0 5px rgb(0 0 0 / 0%))";
        }

        #setTimerTypeIndicatorTransitionLayer(
            active
        ) {
            if (!this.#indicatorRing) {
                return;
            }

            if (active) {
                this.#indicatorRing.style.zIndex =
                    "2147483647";

                return;
            }

            this.#indicatorRing.style.removeProperty(
                "z-index"
            );
        }

        #getTimerTypeIndicatorSymbolHeight() {
            if (!this.#indicatorSymbol) {
                return 0;
            }

            const computedHeight =
                Number.parseFloat(
                    getComputedStyle(
                        this.#indicatorSymbol
                    ).height
                );

            if (
                Number.isFinite(computedHeight) &&
                computedHeight > 0
            ) {
                return computedHeight;
            }

            const renderedHeight =
                this.#indicatorSymbol
                    .getBoundingClientRect()
                    .height;

            return Number.isFinite(renderedHeight)
                ? renderedHeight
                : 0;
        }

        #getTimerTypeIndicatorTickCenter(
            state
        ) {
            if (
                !this.hasAttribute(
                    "tick-marks"
                ) ||
                !this.#tickMarkLayer ||
                this.#tickMarkLayer.childElementCount ===
                    0
            ) {
                return undefined;
            }

            let tickInset;

            const target =
                state.targetGeometry
                    ?.get(
                        this.#tickRing
                    );

            if (
                target &&
                Number.isFinite(
                    target.inset
                )
            ) {
                tickInset =
                    target.inset;
            }

            if (!Number.isFinite(tickInset)) {
                tickInset =
                    Number.parseFloat(
                        getComputedStyle(
                            this.#tickMarkLayer
                        ).top
                    );
            }

            if (!Number.isFinite(tickInset)) {
                return undefined;
            }

            let tickLength = 0;

            for (
                const mark of
                    this.#tickMarkLayer.querySelectorAll(
                        ".tick-mark"
                    )
            ) {
                const height =
                    Number.parseFloat(
                        getComputedStyle(
                            mark
                        ).height
                    );

                if (Number.isFinite(height)) {
                    tickLength =
                        Math.max(
                            tickLength,
                            height
                        );
                }
            }

            if (tickLength <= 0) {
                return undefined;
            }

            return (
                tickInset +
                tickLength / 2
            );
        }

        #retargetTimerTypeIndicatorToTicks(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol ||
                !this.#indicatorRing
            ) {
                return;
            }

            const center =
                this.#getTimerTypeIndicatorTickCenter(
                    state
                );

            if (!Number.isFinite(center)) {
                return;
            }

            const baseInset =
                this.#getTimerTypeIndicatorTopInset();

            const symbolHeight =
                this.#getTimerTypeIndicatorSymbolHeight();

            if (symbolHeight <= 0) {
                return;
            }

            state.indicatorInwardCenter =
                center;

            state.indicatorInwardDistance =
                Math.max(
                    0,
                    center -
                    baseInset -
                    symbolHeight / 2
                );
        }

        #isTimerTypeTransitionVisualRange(
            range
        ) {
            const type =
                range?.getAttribute?.(
                    "type"
                );

            return (
                type === "elapsed" ||
                type === "remaining" ||
                type === "wave"
            );
        }

        #prepareTimerTypeTransitionVisualRange(
            range,
            state =
                this.#timerTypeTransitionState
        ) {
            if (
                !state ||
                state.borderHandoff === true ||
                state.visualFadeStarted ||
                !range?.isConnected ||
                !this.#isTimerTypeTransitionVisualRange(
                    range
                )
            ) {
                return;
            }

            if (!state.visualFadeRanges) {
                state.visualFadeRanges =
                    new Set();
            }

            if (
                range.clockTimerTypeTransitionOpacityState ===
                    undefined
            ) {
                range.clockTimerTypeTransitionOpacityState = {
                    target:
                        this.#getRangeOpacity(
                            range
                        ),
                    inlineValue:
                        range.style.getPropertyValue(
                            "opacity"
                        ),
                    inlinePriority:
                        range.style.getPropertyPriority(
                            "opacity"
                        ),
                    displayInlineValue:
                        range.style.getPropertyValue(
                            "display"
                        ),
                    displayInlinePriority:
                        range.style.getPropertyPriority(
                            "display"
                        )
                };
            }

            range.style.setProperty(
                "opacity",
                "0"
            );

            range.style.setProperty(
                "display",
                "none",
                "important"
            );

            state.visualFadeRanges.add(
                range
            );
        }

        #restoreTimerTypeTransitionVisualRange(
            range
        ) {
            if (!range) {
                return;
            }

            const opacityState =
                range.clockTimerTypeTransitionOpacityState;

            if (!opacityState) {
                range.style.removeProperty(
                    "opacity"
                );

                return;
            }

            if (opacityState.inlineValue) {
                range.style.setProperty(
                    "opacity",
                    opacityState.inlineValue,
                    opacityState.inlinePriority ??
                        ""
                );
            }
            else {
                range.style.removeProperty(
                    "opacity"
                );
            }

            if (opacityState.displayInlineValue) {
                range.style.setProperty(
                    "display",
                    opacityState.displayInlineValue,
                    opacityState.displayInlinePriority ??
                        ""
                );
            }
            else {
                range.style.removeProperty(
                    "display"
                );
            }

            delete range.clockTimerTypeTransitionOpacityState;
        }

        #stripTimerTypeTransitionOldVisualRanges(
            rings
        ) {
            for (const ring of rings) {
                for (
                    const range of
                        Array.from(
                            ring.children
                        )
                ) {
                    if (
                        range.localName !==
                            "time-range" ||
                        !this.#isTimerTypeTransitionVisualRange(
                            range
                        )
                    ) {
                        continue;
                    }

                    range.remove();
                }
            }

            this.#elapsedRange =
                undefined;

            this.#remainingRanges.clear();

            this.#removeWaveRange();
        }

        #finishTimerTypeTransitionVisualFade(
            state
        ) {
            if (!state) {
                return;
            }

            for (
                const animation of
                    state.visualFadeAnimations ??
                        []
            ) {
                animation.cancel();
            }

            state.visualFadeAnimations
                ?.clear();

            for (
                const range of
                    state.visualFadeRanges ??
                        []
            ) {
                this.#restoreTimerTypeTransitionVisualRange(
                    range
                );
            }

            state.visualFadeRanges
                ?.clear();
        }

        #startTimerTypeTransitionVisualFade(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState ||
                state.visualFadeStarted
            ) {
                return;
            }

            for (
                const ring of
                    state.newRings
            ) {
                if (!ring.isConnected) {
                    continue;
                }

                for (
                    const range of
                        ring.children
                ) {
                    this.#prepareTimerTypeTransitionVisualRange(
                        range,
                        state
                    );
                }
            }

            if (
                this.#waveRange?.isConnected
            ) {
                this.#prepareTimerTypeTransitionVisualRange(
                    this.#waveRange,
                    state
                );
            }

            state.visualFadeStarted =
                true;

            state.visualFadeAnimations =
                new Set();

            for (
                const range of
                    state.visualFadeRanges ??
                        []
            ) {
                if (!range.isConnected) {
                    continue;
                }

                const opacityState =
                    range.clockTimerTypeTransitionOpacityState;

                const target =
                    Number.isFinite(
                        opacityState?.target
                    )
                        ? Math.min(
                            1,
                            Math.max(
                                0,
                                opacityState.target
                            )
                        )
                        : 1;

                range.style.setProperty(
                    "opacity",
                    "0"
                );

                if (opacityState?.displayInlineValue) {
                    range.style.setProperty(
                        "display",
                        opacityState.displayInlineValue,
                        opacityState.displayInlinePriority ??
                            ""
                    );
                }
                else {
                    range.style.removeProperty(
                        "display"
                    );
                }

                if (
                    typeof range.animate !==
                        "function"
                ) {
                    this.#restoreTimerTypeTransitionVisualRange(
                        range
                    );

                    continue;
                }

                const animation =
                    range.animate(
                        [
                            { opacity: "0" },
                            {
                                opacity:
                                    String(
                                        target
                                    )
                            }
                        ],
                        {
                            duration: 750,
                            easing:
                                "ease-in-out",
                            fill: "both"
                        }
                    );

                state.visualFadeAnimations.add(
                    animation
                );

                animation.finished.then(
                    () => {
                        state.visualFadeAnimations
                            ?.delete(
                                animation
                            );

                        this.#restoreTimerTypeTransitionVisualRange(
                            range
                        );

                        animation.cancel();
                    },
                    () => {}
                );
            }
        }

        #scheduleTimerTypeTransitionRelease(
            state,
            duration = 750
        ) {
            if (
                state.indicatorOutwardTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.indicatorOutwardTimeout
                );
            }

            state.indicatorOutwardTimeout =
                setTimeout(
                    () => {
                        state.indicatorOutwardTimeout =
                            undefined;

                        if (
                            state !==
                                this.#timerTypeTransitionState
                        ) {
                            return;
                        }

                        this.#releaseTimerTypeIndicator(
                            state
                        );
                    },
                    Math.max(
                        0,
                        duration
                    )
                );
        }

        #prepareTimerTypeIndicatorInward(
            state
        ) {
            if (
                !state.indicatorUsed ||
                !this.#indicatorSymbol ||
                !this.#indicatorRing
            ) {
                return;
            }

            const baseInset =
                this.#getTimerTypeIndicatorTopInset();

            let inwardTip;

            for (
                const ring of
                    state.oldRings
            ) {
                if (
                    !ring.hasAttribute(
                        "active"
                    )
                ) {
                    continue;
                }

                const geometry =
                    state.oldGeometry.get(
                        ring
                    );

                if (!geometry) {
                    continue;
                }

                const innerEdge =
                    geometry.inset +
                    geometry.width / 2;

                if (
                    Number.isFinite(innerEdge) &&
                    (
                        !Number.isFinite(inwardTip) ||
                        innerEdge > inwardTip
                    )
                ) {
                    inwardTip =
                        innerEdge;
                }
            }

            state.indicatorInwardTip =
                Number.isFinite(inwardTip)
                    ? inwardTip
                    : baseInset;

            state.indicatorInwardDistance =
                Math.max(
                    0,
                    state.indicatorInwardTip -
                    baseInset
                );
        }

        #startTimerTypeIndicatorInward(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState ||
                !state.indicatorUsed ||
                !this.#indicatorSymbol
            ) {
                return;
            }

            const duration =
                state.timing?.inward ??
                750;

            const distance =
                Number.isFinite(
                    state.indicatorInwardDistance
                )
                    ? state.indicatorInwardDistance
                    : 0;

            const startTransform =
                "translateX(-50%) translateY(0px)";

            const endTransform =
                `translateX(-50%) translateY(${distance}px)`;

            const transparentShadow =
                this.#getTimerTypeIndicatorShadow(
                    false
                );

            const heavyShadow =
                this.#getTimerTypeIndicatorShadow(
                    true
                );

            if (
                typeof this.#indicatorSymbol.animate !==
                    "function"
            ) {
                this.#indicatorSymbol.style.transform =
                    endTransform;

                this.#indicatorSymbol.style.filter =
                    heavyShadow;

                return;
            }

            const animation =
                this.#indicatorSymbol.animate(
                    [
                        {
                            transform:
                                startTransform,
                            filter:
                                transparentShadow
                        },
                        {
                            transform:
                                endTransform,
                            filter:
                                heavyShadow
                        }
                    ],
                    {
                        duration,
                        easing:
                            "ease-in-out",
                        fill: "both"
                    }
                );

            state.indicatorInwardAnimation =
                animation;

            animation.finished.then(
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState
                    ) {
                        return;
                    }

                    this.#indicatorSymbol.style.transform =
                        endTransform;

                    this.#indicatorSymbol.style.filter =
                        heavyShadow;

                    animation.cancel();

                    state.indicatorInwardAnimation =
                        undefined;
                },
                () => {}
            );
        }

        #startTimerTypeIndicatorCatchup(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            const indicatorAvailable =
                state.indicatorUsed &&
                this.hasAttribute(
                    "indicator-symbol"
                ) &&
                this.#started &&
                Boolean(
                    this.#indicatorTrack
                );

            if (!indicatorAvailable) {
                return;
            }

            const duration =
                state.timing?.sweep ??
                750;

            const startAngle =
                this.#getIndicatorTrackAngle();

            const targetTime =
                this.#getCurrentTimelineTime(
                    new Date(
                        Date.now() +
                        duration
                    )
                );

            const targetAngle =
                this.#getIndicatorAngleForTime(
                    targetTime
                );

            if (
                !Number.isFinite(
                    targetAngle
                )
            ) {
                return;
            }

            const delta =
                (
                    targetAngle -
                    startAngle +
                    360
                ) %
                360;

            const endAngle =
                startAngle +
                delta;

            if (
                typeof this.#indicatorTrack.animate !==
                    "function" ||
                delta === 0
            ) {
                this.#indicatorTrack.style.transform =
                    `rotate(${targetAngle}deg)`;

                return;
            }

            const animation =
                this.#indicatorTrack.animate(
                    [
                        {
                            transform:
                                `rotate(${startAngle}deg)`
                        },
                        {
                            transform:
                                `rotate(${endAngle}deg)`
                        }
                    ],
                    {
                        duration,
                        easing:
                            "ease-in-out",
                        fill: "both"
                    }
                );

            state.indicatorTrackAnimation =
                animation;

            animation.finished.then(
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState
                    ) {
                        return;
                    }

                    this.#indicatorTrack.style.transform =
                        `rotate(${targetAngle}deg)`;

                    animation.cancel();

                    state.indicatorTrackAnimation =
                        undefined;
                },
                () => {}
            );
        }

        #startTimerTypeIndicatorOutwardMotion(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            const indicatorAvailable =
                state.indicatorUsed &&
                this.hasAttribute(
                    "indicator-symbol"
                ) &&
                this.#started &&
                Boolean(
                    this.#indicatorSymbol
                );

            if (!indicatorAvailable) {
                return;
            }

            const duration =
                state.timing?.reveal ??
                750;

            const distance =
                Number.isFinite(
                    state.indicatorInwardDistance
                )
                    ? state.indicatorInwardDistance
                    : 0;

            const startTransform =
                `translateX(-50%) translateY(${distance}px)`;

            const endTransform =
                "translateX(-50%) translateY(0px)";

            const heavyShadow =
                this.#getTimerTypeIndicatorShadow(
                    true
                );

            const transparentShadow =
                this.#getTimerTypeIndicatorShadow(
                    false
                );

            this.#timerTypeIndicatorFrozen =
                false;

            this.#indicatorSymbol.style.transform =
                startTransform;

            this.#indicatorSymbol.style.filter =
                heavyShadow;

            if (
                typeof this.#indicatorSymbol.animate !==
                    "function"
            ) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );

                return;
            }

            const animation =
                this.#indicatorSymbol.animate(
                    [
                        {
                            transform:
                                startTransform,
                            filter:
                                heavyShadow
                        },
                        {
                            transform:
                                endTransform,
                            filter:
                                transparentShadow
                        }
                    ],
                    {
                        duration,
                        easing:
                            "ease-in-out",
                        fill: "both"
                    }
                );

            state.indicatorOutwardAnimation =
                animation;

            animation.finished.then(
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState
                    ) {
                        return;
                    }

                    this.#indicatorSymbol.style.removeProperty(
                        "transform"
                    );

                    this.#indicatorSymbol.style.removeProperty(
                        "filter"
                    );

                    animation.cancel();

                    state.indicatorOutwardAnimation =
                        undefined;
                },
                () => {}
            );
        }

        #clearTimerTypePhaseTimeout(
            state
        ) {
            if (
                state?.phaseTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.phaseTimeout
                );

                state.phaseTimeout =
                    undefined;
            }
        }

        #removeTimerTypeTransitionWave(
            state
        ) {
            if (!state) {
                return;
            }

            state.transitionWaveOpacityAnimation
                ?.cancel();

            state.transitionWaveOpacityAnimation =
                undefined;

            state.transitionWaveRange?.remove();
            state.transitionWaveRing?.remove();

            state.transitionWaveRange =
                undefined;

            state.transitionWaveRing =
                undefined;
        }

        #prepareTimerTypeBorderHandoff(
            state
        ) {
            const border =
                this.#ensureBorderRing();

            if (!border) {
                return;
            }

            const renderedInset =
                this.#resolveTimerTypeTransitionLength(
                    border.renderedInset ??
                    border.inset ??
                    "0px",
                    border
                );

            const renderedWidth =
                Math.max(
                    0,
                    this.#resolveTimerTypeTransitionLength(
                        border.renderedWidth ??
                        border.width ??
                        "0px",
                        border
                    )
                );

            state.borderRing =
                border;

            state.borderOriginalInset =
                border.inset;

            state.borderOriginalWidth =
                border.width;

            state.borderOriginalResizeDuration =
                border.resizeDuration;

            state.borderNormalGeometry = {
                inset:
                    renderedInset,
                width:
                    renderedWidth
            };

            state.borderTargetGeometry =
                state.targetGeometry.get(
                    border
                ) ?? {
                    inset:
                        renderedInset,
                    width:
                        renderedWidth,
                    widthValue:
                        border.width ??
                        `${renderedWidth}px`
                };

            let outerRing;
            let outerGeometry;
            let outerEdge =
                Infinity;

            for (
                const [ring, geometry] of
                    state.oldGeometry
            ) {
                const edge =
                    geometry.inset -
                    geometry.width / 2;

                if (edge < outerEdge) {
                    outerEdge =
                        edge;

                    outerRing =
                        ring;

                    outerGeometry =
                        geometry;
                }
            }

            state.borderExpandedGeometry = {
                inset:
                    renderedInset,
                width:
                    Math.max(
                        renderedWidth,
                        outerGeometry?.width ??
                            renderedWidth
                    )
            };

            border.resizeDuration =
                "0ms";

            border.inset =
                `${renderedInset}px`;

            border.width =
                `${renderedWidth}px`;

            border.snapGeometry?.();

            if (
                !this.#started ||
                !this.#ringLayer
            ) {
                return;
            }

            const sourceRing =
                state.oldRings.find(
                    ring =>
                        ring.hasAttribute(
                            "active"
                        )
                ) ??
                outerRing ??
                state.oldRings[0] ??
                border;

            const waveRing =
                document.createElement(
                    "ring-container"
                );

            waveRing.id =
                "timer-type-transition-wave-ring";

            waveRing.clockTimerInternalTimerTypeWave =
                "";

            this.#configureInternalVisualRing(
                waveRing,
                sourceRing,
                120
            );

            waveRing.resizeDuration =
                "0ms";

            waveRing.inset =
                `${renderedInset}px`;

            waveRing.width =
                `${renderedWidth}px`;

            waveRing.snapGeometry?.();

            this.#ringLayer.appendChild(
                waveRing
            );

            let start =
                Number.isFinite(
                    state.referenceTime
                )
                    ? state.referenceTime
                    : (
                        Number.isFinite(
                            this.#scheduledStartMilliseconds
                        )
                            ? this.#scheduledStartMilliseconds
                            : Date.now()
                    );

            start -=
                (
                    start %
                        ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) %
                ClockTimer.#HOUR;

            const end =
                start +
                ClockTimer.#HOUR;

            const range =
                document.createElement(
                    "time-range"
                );

            range.setAttribute(
                "type",
                "wave"
            );

            range.setAttribute(
                "timer-type-transition-wave",
                ""
            );

            range.setAttribute(
                "overlapping",
                ""
            );

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            range.setAttribute(
                "end-time",
                this.#formatTimelineTime(
                    end
                )
            );

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);

            range.clockTimerInternalTimerTypeWave =
                "";

            range.timeRangeFullEntry =
                true;

            range.style.clipPath =
                "none";

            range.style.opacity =
                "0";

            range.style.setProperty(
                "--timer-type-transition-wave-play-state",
                "paused"
            );

            waveRing.appendChild(
                range
            );

            state.transitionWaveRing =
                waveRing;

            state.transitionWaveRange =
                range;
        }

        #prepareTimerTypeNormalWave(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            state.holdNormalWave =
                true;

            this.#waveSuppressed =
                false;

            this.#syncWaveRange();

            if (this.#waveRange) {
                this.#waveRange.style.opacity =
                    "0";

                this.#waveRange.style.setProperty(
                    "--elapsed-wave-play-state",
                    "paused"
                );
            }
        }

        #startTimerTypeTransitionHold(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            this.#clearTimerTypePhaseTimeout(
                state
            );

            state.phase =
                "inward";

            for (
                const ring of
                    state.oldRings
            ) {
                const geometry =
                    state.oldGeometry.get(
                        ring
                    );

                if (
                    ring.isConnected &&
                    geometry
                ) {
                    ring.inset =
                        `${geometry.collapseInset}px`;

                    ring.width =
                        "0px";

                    ring.snapGeometry?.();
                }

                ring.remove();
            }

            state.oldRings =
                [];

            if (state.borderRing) {
                const expanded =
                    state.borderExpandedGeometry;

                state.borderRing.inset =
                    `${expanded.inset}px`;

                state.borderRing.width =
                    `${expanded.width}px`;

                state.borderRing.snapGeometry?.();
            }

            if (
                state.transitionWaveRing
            ) {
                const expanded =
                    state.borderExpandedGeometry;

                state.transitionWaveRing.inset =
                    `${expanded.inset}px`;

                state.transitionWaveRing.width =
                    `${expanded.width}px`;

                state.transitionWaveRing.snapGeometry?.();
            }

            this.#startTimerTypeIndicatorInward(
                state
            );

            state.phaseTimeout =
                setTimeout(
                    () => {
                        state.phaseTimeout =
                            undefined;

                        this.#startTimerTypeTransitionSweep(
                            state
                        );
                    },
                    state.timing?.inward ??
                        750
                );
        }

        #startTimerTypeTransitionSweep(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            this.#clearTimerTypePhaseTimeout(
                state
            );

            state.phase =
                "sweep";

            this.#startTimerTypeIndicatorCatchup(
                state
            );

            state.phaseTimeout =
                setTimeout(
                    () => {
                        state.phaseTimeout =
                            undefined;

                        this.#startTimerTypeIndicatorOutward(
                            state
                        );
                    },
                    state.timing?.sweep ??
                        750
                );
        }

        #startTimerTypeIndicatorOutward(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            this.#clearTimerTypePhaseTimeout(
                state
            );

            state.phase =
                "reveal";

            const duration =
                state.timing?.reveal ??
                750;

            this.#prepareTimerTypeNormalWave(
                state
            );

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (
                        !ring.isConnected ||
                        !target
                    ) {
                        continue;
                    }

                    if (
                        !state.newRingResizeDurations.has(
                            ring
                        )
                    ) {
                        state.newRingResizeDurations.set(
                            ring,
                            ring.resizeDuration
                        );
                    }

                    ring.resizeDuration =
                        `${duration}ms`;

                    ring.inset =
                        `${target.inset}px`;

                    ring.width =
                        target.widthValue;
                }

                if (state.borderRing) {
                    const target =
                        state.borderTargetGeometry;

                    state.borderRing.resizeDuration =
                        `${duration}ms`;

                    state.borderRing.inset =
                        `${target.inset}px`;

                    state.borderRing.width =
                        target.widthValue ??
                        `${target.width}px`;
                }

                if (
                    state.transitionWaveRing
                ) {
                    const target =
                        state.borderTargetGeometry;

                    state.transitionWaveRing.resizeDuration =
                        `${duration}ms`;

                    state.transitionWaveRing.inset =
                        `${target.inset}px`;

                    state.transitionWaveRing.width =
                        target.widthValue ??
                        `${target.width}px`;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            if (
                state.transitionWaveRange
            ) {
                state.transitionWaveOpacityAnimation
                    ?.cancel();

                if (
                    typeof state.transitionWaveRange.animate ===
                        "function"
                ) {
                    const animation =
                        state.transitionWaveRange.animate(
                            [
                                { opacity: "1" },
                                { opacity: "0" }
                            ],
                            {
                                duration,
                                easing:
                                    "ease-in-out",
                                fill: "both"
                            }
                        );

                    state.transitionWaveOpacityAnimation =
                        animation;
                }
                else {
                    state.transitionWaveRange.style.opacity =
                        "0";
                }
            }

            this.#startTimerTypeIndicatorOutwardMotion(
                state
            );

            const refresh =
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState ||
                        state.phase !==
                            "reveal"
                    ) {
                        state.geometryFrame =
                            undefined;

                        return;
                    }

                    const now =
                        this.#started
                            ? this.#getCurrentTimelineTime()
                            : state.referenceTime;

                    if (
                        this.#getTimerType() ===
                            "radial-fitted"
                    ) {
                        this.#refreshRadialFittedLayouts(
                            now,
                            {
                                suspendLayout:
                                    false
                            }
                        );
                    }

                    this.#syncWaveRange();

                    state.geometryFrame =
                        requestAnimationFrame(
                            refresh
                        );
                };

            state.geometryFrame =
                requestAnimationFrame(
                    refresh
                );

            state.phaseTimeout =
                setTimeout(
                    () => {
                        state.phaseTimeout =
                            undefined;

                        this.#finishTimerTypeTransition(
                            state
                        );
                    },
                    duration
                );
        }

        #finishTimerTypeTransition(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            this.#clearTimerTypePhaseTimeout(
                state
            );

            if (
                state.geometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.geometryFrame
                );

                state.geometryFrame =
                    undefined;
            }

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (
                        !ring.isConnected ||
                        !target
                    ) {
                        continue;
                    }

                    ring.inset =
                        `${target.inset}px`;

                    ring.width =
                        target.widthValue;

                    ring.snapGeometry?.();

                    ring.inset =
                        undefined;

                    ring.snapGeometry?.();

                    if (
                        state.newRingResizeDurations.has(
                            ring
                        )
                    ) {
                        ring.resizeDuration =
                            state.newRingResizeDurations.get(
                                ring
                            );
                    }

                    delete ring.clockTimerTargetWidth;
                    delete ring.clockTimerTransitionNew;

                    ring.style.removeProperty(
                        "z-index"
                    );
                }

                if (state.borderRing) {
                    const target =
                        state.borderTargetGeometry;

                    state.borderRing.resizeDuration =
                        "0ms";

                    state.borderRing.inset =
                        `${target.inset}px`;

                    state.borderRing.width =
                        target.widthValue ??
                        `${target.width}px`;

                    state.borderRing.snapGeometry?.();

                    state.borderRing.inset =
                        state.borderOriginalInset;

                    state.borderRing.width =
                        state.borderOriginalWidth;

                    state.borderRing.snapGeometry?.();

                    state.borderRing.resizeDuration =
                        state.borderOriginalResizeDuration;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            this.#removeTimerTypeTransitionWave(
                state
            );

            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (
                state.indicatorTrackAnimation
            ) {
                const angle =
                    this.#getIndicatorTrackAngle();

                state.indicatorTrackAnimation.cancel();

                this.#indicatorTrack.style.transform =
                    `rotate(${angle}deg)`;

                state.indicatorTrackAnimation =
                    undefined;
            }

            if (this.#indicatorSymbol) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );
            }

            this.#timerTypeIndicatorFrozen =
                false;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            state.ringsFinished =
                true;

            state.phase =
                "quiet";

            this.#timerTypeTransitioning =
                false;

            const now =
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : state.referenceTime;

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks:
                        true
                }
            );

            this.#syncWaveRange();
            this.#updateIndicatorSymbol();

            this.#scheduleWaveResumeAfterTimerTypeTransition(
                state
            );
        }

        #releaseTimerTypeIndicator(
            state
        ) {
            this.#finishTimerTypeTransition(
                state
            );
        }

        #cancelTimerTypeTransition(
            commit = true
        ) {
            const state =
                this.#timerTypeTransitionState;

            this.#timerTypeTransitionToken++;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            if (!state) {
                this.#timerTypeTransitioning =
                    false;

                this.#timerTypeIndicatorFrozen =
                    false;

                return;
            }

            this.#clearTimerTypePhaseTimeout(
                state
            );

            if (
                state.startFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.startFrame
                );

                state.startFrame =
                    undefined;
            }

            if (
                state.geometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.geometryFrame
                );

                state.geometryFrame =
                    undefined;
            }

            if (
                state.collapseFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.collapseFrame
                );

                state.collapseFrame =
                    undefined;
            }

            if (
                state.cleanupTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.cleanupTimeout
                );

                state.cleanupTimeout =
                    undefined;
            }

            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (
                state.indicatorTrackAnimation
            ) {
                const angle =
                    this.#getIndicatorTrackAngle();

                state.indicatorTrackAnimation.cancel();

                if (this.#indicatorTrack) {
                    this.#indicatorTrack.style.transform =
                        `rotate(${angle}deg)`;
                }

                state.indicatorTrackAnimation =
                    undefined;
            }

            this.#removeTimerTypeTransitionWave(
                state
            );

            if (this.#indicatorSymbol) {
                this.#indicatorSymbol.style.removeProperty(
                    "transform"
                );

                this.#indicatorSymbol.style.removeProperty(
                    "filter"
                );
            }

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                if (commit) {
                    for (
                        const ring of
                            state.oldRings
                    ) {
                        const geometry =
                            state.oldGeometry.get(
                                ring
                            );

                        if (
                            ring.isConnected &&
                            geometry
                        ) {
                            ring.resizeDuration =
                                "0ms";

                            ring.inset =
                                `${geometry.collapseInset}px`;

                            ring.width =
                                "0px";

                            ring.snapGeometry?.();
                        }

                        ring.remove();
                    }

                    for (
                        const ring of
                            state.newRings
                    ) {
                        const target =
                            state.targetGeometry.get(
                                ring
                            );

                        if (
                            ring.isConnected &&
                            target
                        ) {
                            ring.resizeDuration =
                                "0ms";

                            ring.inset =
                                `${target.inset}px`;

                            ring.width =
                                target.widthValue;

                            ring.snapGeometry?.();

                            ring.inset =
                                undefined;

                            ring.snapGeometry?.();
                        }

                        if (
                            state.newRingResizeDurations.has(
                                ring
                            )
                        ) {
                            ring.resizeDuration =
                                state.newRingResizeDurations.get(
                                    ring
                                );
                        }

                        delete ring.clockTimerTargetWidth;
                        delete ring.clockTimerTransitionNew;

                        ring.style.removeProperty(
                            "z-index"
                        );
                    }
                }

                if (state.borderRing) {
                    state.borderRing.resizeDuration =
                        "0ms";

                    state.borderRing.inset =
                        state.borderOriginalInset;

                    state.borderRing.width =
                        state.borderOriginalWidth;

                    state.borderRing.snapGeometry?.();

                    state.borderRing.resizeDuration =
                        state.borderOriginalResizeDuration;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            state.holdNormalWave =
                false;

            this.#waveSuppressed =
                false;

            if (this.#waveRange) {
                this.#waveRange.style.removeProperty(
                    "opacity"
                );

                this.#waveRange.style.removeProperty(
                    "--elapsed-wave-play-state"
                );
            }

            this.#timerTypeTransitionState =
                undefined;

            this.#timerTypeTransitioning =
                false;

            this.#timerTypeTransitionBuilding =
                false;

            this.#timerTypeIndicatorFrozen =
                false;

            if (
                commit &&
                this.isConnected
            ) {
                const now =
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined;

                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks:
                            true
                    }
                );

                this.#syncWaveRange();
            }
        }

        #startTimerTypeRingAnimations(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            state.startFrame =
                undefined;

            state.phase =
                "collapse";

            const duration =
                state.timing?.collapse ??
                333;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (
                    const ring of
                        state.oldRings
                ) {
                    const geometry =
                        state.oldGeometry.get(
                            ring
                        );

                    if (!geometry) {
                        continue;
                    }

                    ring.resizeDuration =
                        `${duration}ms`;

                    ring.inset =
                        `${geometry.collapseInset}px`;

                    ring.width =
                        "0px";
                }

                if (state.borderRing) {
                    const expanded =
                        state.borderExpandedGeometry;

                    state.borderRing.resizeDuration =
                        `${duration}ms`;

                    state.borderRing.inset =
                        `${expanded.inset}px`;

                    state.borderRing.width =
                        `${expanded.width}px`;
                }

                if (
                    state.transitionWaveRing
                ) {
                    const expanded =
                        state.borderExpandedGeometry;

                    state.transitionWaveRing.resizeDuration =
                        `${duration}ms`;

                    state.transitionWaveRing.inset =
                        `${expanded.inset}px`;

                    state.transitionWaveRing.width =
                        `${expanded.width}px`;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            if (
                state.transitionWaveRange
            ) {
                const sweepDuration =
                    (
                        state.timing?.collapse ??
                        333
                    ) +
                    (
                        state.timing?.inward ??
                        750
                    ) +
                    (
                        state.timing?.sweep ??
                        750
                    );

                state.transitionWaveRange.style.setProperty(
                    "--timer-type-transition-wave-duration",
                    `${sweepDuration}ms`
                );

                state.transitionWaveRange.style.setProperty(
                    "--timer-type-transition-wave-play-state",
                    "running"
                );

                state.transitionWaveOpacityAnimation
                    ?.cancel();

                if (
                    typeof state.transitionWaveRange.animate ===
                        "function"
                ) {
                    state.transitionWaveOpacityAnimation =
                        state.transitionWaveRange.animate(
                            [
                                { opacity: "0" },
                                { opacity: "1" }
                            ],
                            {
                                duration,
                                easing:
                                    "ease-in-out",
                                fill: "both"
                            }
                        );
                }
                else {
                    state.transitionWaveRange.style.opacity =
                        "1";
                }
            }

            state.phaseTimeout =
                setTimeout(
                    () => {
                        state.phaseTimeout =
                            undefined;

                        if (
                            state.transitionWaveRange
                        ) {
                            state.transitionWaveRange.style.opacity =
                                "1";

                            state.transitionWaveOpacityAnimation
                                ?.cancel();

                            state.transitionWaveOpacityAnimation =
                                undefined;
                        }

                        this.#startTimerTypeTransitionHold(
                            state
                        );
                    },
                    duration
                );
        }

        #transitionTimerType(
            previousType,
            timerType
        ) {
            this.#cancelTimerTypeTransition(
                true
            );

            this.#cancelTimerModeTransition();
            this.#cancelTimeRangeTimingAnimations();

            this.#cancelWaveResumeDelay();

            this.#waveSuppressed =
                true;

            this.#removeWaveRange();

            const oldRings =
                this.#getTimerRings()
                    .filter(
                        ring =>
                            ring.isConnected
                    );

            if (oldRings.length === 0) {
                this.#waveSuppressed =
                    false;

                const now =
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined;

                this.#refreshRingLayout(
                    now,
                    {
                        refreshTickMarks:
                            true
                    }
                );

                this.#syncWaveRange();

                return;
            }

            const snapshots =
                this.#captureTimerTypeRangeSnapshots(
                    oldRings
                );

            const token =
                ++this.#timerTypeTransitionToken;

            const state = {
                token,
                borderHandoff:
                    true,
                previousType,
                timerType,
                oldRings:
                    [...oldRings],
                newRings: [],
                oldGeometry:
                    new Map(),
                targetGeometry:
                    new Map(),
                newRingResizeDurations:
                    new Map(),
                referenceTime:
                    this.#getTimerTypeTransitionReferenceTime(
                        snapshots
                    ),
                indicatorUsed:
                    this.hasAttribute(
                        "indicator-symbol"
                    ) &&
                    this.#started &&
                    Boolean(
                        this.#indicatorSymbol
                    ),
                ringsFinished:
                    false,
                holdNormalWave:
                    false,
                timing: {
                    collapse: 333,
                    inward: 750,
                    sweep: 750,
                    reveal: 750,
                    quiet: 2000
                }
            };

            this.#timerTypeTransitionState =
                state;

            this.#timerTypeTransitioning =
                true;

            this.#timerTypeIndicatorFrozen =
                state.indicatorUsed;

            this.#setTimerTypeIndicatorTransitionLayer(
                state.indicatorUsed
            );

            if (
                this.#indicatorHandoffTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#indicatorHandoffTimeout
                );

                this.#indicatorHandoffTimeout =
                    undefined;
            }

            this.#indicatorHandoffFrozen =
                false;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (const ring of oldRings) {
                    const inset =
                        this.#resolveTimerTypeTransitionLength(
                            ring.renderedInset ??
                            ring.inset ??
                            "0px",
                            ring
                        );

                    const width =
                        Math.max(
                            0,
                            this.#resolveTimerTypeTransitionLength(
                                ring.renderedWidth ??
                                ring.width ??
                                "0px",
                                ring
                            )
                        );

                    const towardBorder =
                        this.#isTimerRingOutsideBorder(
                            ring
                        )
                            ? 1
                            : -1;

                    state.oldGeometry.set(
                        ring,
                        {
                            inset,
                            width,
                            collapseInset:
                                inset +
                                towardBorder *
                                width / 2
                        }
                    );

                    ring.clockTimerExitingRing =
                        true;

                    ring.clockTimerLayoutDetached =
                        true;

                    ring.inset =
                        `${inset}px`;

                    ring.width =
                        `${width}px`;

                    for (
                        const range of
                            ring.children
                    ) {
                        if (
                            range.localName ===
                                "time-range"
                        ) {
                            range.timeRangeExiting =
                                true;
                        }
                    }
                }

                this.#prepareTimerTypeIndicatorInward(
                    state
                );

                this.#rings =
                    new Map();

                this.#elapsedRange =
                    undefined;

                this.#remainingRanges.clear();
                this.#overtimeRanges.clear();

                if (
                    timerType ===
                        "radial-overflow" &&
                    !this.#hasStartProperties()
                ) {
                    const earliest =
                        snapshots
                            .map(
                                snapshot =>
                                    snapshot.start
                            )
                            .filter(
                                Number.isFinite
                            )
                            .sort(
                                (a, b) =>
                                    a - b
                            )[0];

                    if (Number.isFinite(earliest)) {
                        this.#ringAnchor =
                            earliest -
                            (
                                (
                                    earliest %
                                        ClockTimer.#HOUR +
                                    ClockTimer.#HOUR
                                ) %
                                ClockTimer.#HOUR
                            );
                    }
                }

                this.#timerTypeTransitionBuilding =
                    true;

                this.#renderTimerTypeRangeSnapshots(
                    snapshots
                );

                this.#rebuildTimerTypeRangeReferences();

                if (this.#started) {
                    const visualReference =
                        Number.isFinite(
                            state.referenceTime
                        )
                            ? state.referenceTime
                            : this.#getCurrentTimelineTime();

                    this.#updateElapsedRange(
                        visualReference
                    );

                    this.#updateRemainingRanges(
                        visualReference
                    );
                }

                const reference =
                    Number.isFinite(
                        state.referenceTime
                    )
                        ? state.referenceTime
                        : this.#scheduledStartMilliseconds;

                if (
                    Number.isFinite(reference) &&
                    this.#rings.size > 0
                ) {
                    this.#reorderRings(
                        reference
                    );
                }

                state.newRings =
                    Array.from(
                        this.#rings.values()
                    );

                for (
                    const ring of
                        state.newRings
                ) {
                    ring.clockTimerTransitionNew =
                        true;
                }

                state.targetGeometry =
                    this.#calculateTimerTypeTargetGeometry(
                        state.newRings
                    );

                this.#retargetTimerTypeIndicatorToTicks(
                    state
                );

                for (
                    const ring of
                        state.newRings
                ) {
                    const target =
                        state.targetGeometry.get(
                            ring
                        );

                    if (!target) {
                        continue;
                    }

                    const outside =
                        this.#isTimerRingOutsideBorder(
                            ring
                        );

                    const initialInset =
                        target.inset +
                        (
                            outside
                                ? target.width / 2
                                : -target.width / 2
                        );

                    state.newRingResizeDurations.set(
                        ring,
                        ring.resizeDuration
                    );

                    ring.resizeDuration =
                        "0ms";

                    ring.inset =
                        `${initialInset}px`;

                    ring.width =
                        "0px";
                }

                this.#prepareTimerTypeBorderHandoff(
                    state
                );
            }
            finally {
                this.#timerTypeTransitionBuilding =
                    false;

                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            this.#snapTimerTypeRings([
                ...oldRings,
                ...Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container"
                )
            ]);

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    state.referenceTime,
                    {
                        suspendLayout:
                            false
                    }
                );
            }

            this.#updateIndicatorSymbol();

            state.startFrame =
                requestAnimationFrame(
                    () =>
                        this.#startTimerTypeRingAnimations(
                            state
                        )
                );
        }


        #getStateChangeActiveRing() {
            const rings =
                Array.from(
                    this.#rings.values()
                ).filter(
                    ring =>
                        ring?.isConnected &&
                        ring.clockTimerExitingRing !==
                            true
                );

            const active =
                rings.find(
                    ring =>
                        ring.hasAttribute(
                            "active"
                        )
                );

            if (active) {
                return active;
            }

            if (this.#started) {
                const now =
                    this.#getCurrentTimelineTime();

                if (Number.isFinite(now)) {
                    const ring =
                        this.#rings.get(
                            this.#getTimerRingIndex(
                                now
                            )
                        );

                    if (ring?.isConnected) {
                        return ring;
                    }
                }
            }

            return rings[0];
        }

        #removeStateChangeWave() {
            if (
                this.#stateChangeWaveTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#stateChangeWaveTimeout
                );

                this.#stateChangeWaveTimeout =
                    undefined;
            }

            this.#stateChangeWaveRange?.remove();
            this.#stateChangeWaveRing?.remove();

            this.#stateChangeWaveRange =
                undefined;

            this.#stateChangeWaveRing =
                undefined;
        }

        #configureInternalVisualRing(
            ring,
            sourceRing,
            zIndex
        ) {
            ring.style.position =
                "absolute";

            ring.style.inset =
                "0";

            ring.style.width =
                "100%";

            ring.style.height =
                "100%";

            ring.style.zIndex =
                String(zIndex);

            ring.style.pointerEvents =
                "none";

            ring.style.background =
                "transparent";

            ring.resizeDuration =
                "0ms";

            ring.resizeFilter =
                "none";

            ring.reorderFilter =
                "none";

            ring.connectFilter =
                "none";

            ring.disconnectFilter =
                "none";

            ring.filterRamp =
                false;

            ring.filterRampFront =
                "0ms";

            ring.filterRampEnd =
                "0ms";

            ring.filterRampConnect =
                "0ms";

            ring.filterRampDisconnect =
                "0ms";

            ring.clockTimerRing =
                "";

            ring.clockTimerRingIndex =
                sourceRing?.clockTimerRingIndex ??
                "";

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            this.#syncInternalVisualRingGeometry(
                ring,
                sourceRing
            );
        }

        #syncInternalVisualRingGeometry(
            ring,
            sourceRing
        ) {
            if (
                !ring ||
                !sourceRing
            ) {
                return;
            }

            const inset =
                sourceRing.renderedInset ??
                sourceRing.getAttribute(
                    "inset"
                ) ??
                sourceRing.inset ??
                "0px";

            const width =
                sourceRing.renderedWidth ??
                sourceRing.getAttribute(
                    "width"
                ) ??
                sourceRing.width ??
                "0px";

            ring.clockTimerRingIndex =
                sourceRing.clockTimerRingIndex ??
                "";

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            ring.inset =
                String(inset);

            ring.width =
                String(width);

            ring.snapGeometry?.();
        }

        #positionStateChangeWaveRing(
            ring,
            sourceRing
        ) {
            if (
                !ring ||
                !sourceRing
            ) {
                return;
            }

            const renderedInset =
                Number.parseFloat(
                    sourceRing.renderedInset ??
                    sourceRing.inset ??
                    sourceRing.getAttribute(
                        "inset"
                    ) ??
                    "0"
                );

            const renderedWidth =
                Number.parseFloat(
                    sourceRing.renderedWidth ??
                    sourceRing.width ??
                    sourceRing.getAttribute(
                        "width"
                    ) ??
                    "0"
                );

            const targetWidthValue =
                sourceRing.clockTimerTargetWidth ??
                sourceRing.width ??
                sourceRing.getAttribute(
                    "width"
                ) ??
                sourceRing.renderedWidth ??
                "0px";

            const targetWidth =
                this.#resolveTimerTypeTransitionLength(
                    targetWidthValue,
                    sourceRing
                );

            if (
                !Number.isFinite(renderedInset) ||
                !Number.isFinite(renderedWidth) ||
                !Number.isFinite(targetWidth) ||
                targetWidth <= 0
            ) {
                this.#syncInternalVisualRingGeometry(
                    ring,
                    sourceRing
                );

                return;
            }

            const outerEdge =
                renderedInset -
                renderedWidth / 2;

            const targetInset =
                outerEdge +
                targetWidth / 2;

            ring.clockTimerRingIndex =
                sourceRing.clockTimerRingIndex ??
                "";

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            ring.inset =
                `${targetInset}px`;

            ring.width =
                `${targetWidth}px`;

            ring.toggleAttribute(
                "active",
                sourceRing.hasAttribute(
                    "active"
                )
            );

            ring.snapGeometry?.();
        }

        #startStateChangeWave() {
            this.#removeStateChangeWave();

            if (
                !this.#started ||
                !this.#ringLayer
            ) {
                return;
            }

            const sourceRing =
                this.#getStateChangeActiveRing();

            if (!sourceRing) {
                return;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.id =
                "state-change-wave-ring";

            ring.clockTimerInternalStateChangeWave =
                "";

            this.#configureInternalVisualRing(
                ring,
                sourceRing,
                110
            );

            this.#ringLayer.appendChild(
                ring
            );

            this.#positionStateChangeWaveRing(
                ring,
                sourceRing
            );

            let start;
            let end;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds(
                        this.#getCurrentTimelineTime()
                    );

                start =
                    bounds?.start;

                end =
                    bounds?.end;
            }
            else {
                const ringIndex =
                    Number(
                        sourceRing.clockTimerRingIndex
                    );

                if (Number.isFinite(ringIndex)) {
                    start =
                        this.#getTimerRingStart(
                            ringIndex
                        );

                    end =
                        this.#getTimerRingEnd(
                            ringIndex
                        );
                }
            }

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                start =
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                        ? this.#scheduledStartMilliseconds
                        : 0;

                end =
                    start +
                    ClockTimer.#HOUR;
            }

            const range =
                document.createElement(
                    "time-range"
                );

            range.setAttribute(
                "type",
                "wave"
            );

            range.setAttribute(
                "state-change-wave",
                ""
            );

            range.setAttribute(
                "overlapping",
                ""
            );

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            range.setAttribute(
                "end-time",
                this.#formatTimelineTime(
                    end
                )
            );

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);

            range.clockTimerInternalStateChangeWave =
                "";

            range.timeRangeFullEntry =
                true;

            range.style.clipPath =
                "none";

            ring.appendChild(
                range
            );

            this.#stateChangeWaveRing =
                ring;

            this.#stateChangeWaveRange =
                range;

            this.#stateChangeWaveTimeout =
                setTimeout(
                    () => {
                        this.#stateChangeWaveTimeout =
                            undefined;

                        if (
                            this.#stateChangeWaveRange ===
                                range
                        ) {
                            this.#removeStateChangeWave();
                        }
                    },
                    750
                );
        }

        #removeNormalStateVisualRanges() {
            for (
                const range of
                    Array.from(
                        this.querySelectorAll(
                            ":scope > ring-container > time-range.elapsed, :scope > ring-container > time-range.remaining"
                        )
                    )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            this.#elapsedRange =
                undefined;

            this.#remainingRanges.clear();

            this.#removeWaveRange();
        }

        #getStateChangeRangeTiming(
            range,
            timestamp = performance.now()
        ) {
            const animation =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (
                animation &&
                Number.isFinite(animation.fromStart) &&
                Number.isFinite(animation.fromEnd) &&
                Number.isFinite(animation.targetStart) &&
                Number.isFinite(animation.targetEnd)
            ) {
                const duration =
                    Number(animation.duration);

                const progress =
                    !Number.isFinite(duration) ||
                    duration <= 0
                        ? 1
                        : animation.startedAt ===
                            undefined
                            ? 0
                            : Math.min(
                                1,
                                Math.max(
                                    0,
                                    (
                                        timestamp -
                                        animation.startedAt
                                    ) /
                                    duration
                                )
                            );

                return {
                    start:
                        animation.fromStart +
                        (
                            animation.targetStart -
                            animation.fromStart
                        ) *
                        progress,
                    end:
                        animation.fromEnd +
                        (
                            animation.targetEnd -
                            animation.fromEnd
                        ) *
                        progress
                };
            }

            return {
                start:
                    Number(
                        range.clockTimerStart
                    ),
                end:
                    Number(
                        range.clockTimerEnd
                    )
            };
        }

        #getStateChangeFittedBounds(
            timestamp = performance.now()
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return undefined;
            }

            for (
                const animation of
                    this.#timeRangeTimingAnimations.values()
            ) {
                const from =
                    animation.fromFittedBounds;

                const target =
                    animation.targetFittedBounds;

                if (
                    !from ||
                    !target ||
                    !Number.isFinite(from.start) ||
                    !Number.isFinite(from.end) ||
                    !Number.isFinite(target.start) ||
                    !Number.isFinite(target.end)
                ) {
                    continue;
                }

                const duration =
                    Number(animation.duration);

                const progress =
                    !Number.isFinite(duration) ||
                    duration <= 0
                        ? 1
                        : animation.startedAt ===
                            undefined
                            ? 0
                            : Math.min(
                                1,
                                Math.max(
                                    0,
                                    (
                                        timestamp -
                                        animation.startedAt
                                    ) /
                                    duration
                                )
                            );

                const start =
                    from.start +
                    (
                        target.start -
                        from.start
                    ) *
                    progress;

                const end =
                    from.end +
                    (
                        target.end -
                        from.end
                    ) *
                    progress;

                if (end > start) {
                    return {
                        start,
                        end,
                        duration:
                            end - start
                    };
                }
            }

            return this.#getRadialFittedBounds(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined
            );
        }

        #getStateChangeVisibleSegments(
            timestamp = performance.now()
        ) {
            const byRing =
                new Map();

            const ignoredTypes =
                new Set([
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
                    range.timeRangeExiting ===
                        true ||
                    range.clockTimerStateChangeOverlay !==
                        undefined ||
                    ignoredTypes.has(
                        range.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                const sourceRing =
                    range.parentElement;

                if (
                    !sourceRing ||
                    !sourceRing.isConnected ||
                    sourceRing.clockTimerExitingRing ===
                        true ||
                    sourceRing.clockTimerLayoutDetached ===
                        true
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(
                        range
                    );

                const opacity =
                    Number.parseFloat(
                        style.opacity
                    );

                if (
                    style.display === "none" ||
                    style.visibility === "hidden" ||
                    (
                        Number.isFinite(opacity) &&
                        opacity <= 0
                    )
                ) {
                    continue;
                }

                const timing =
                    this.#getStateChangeRangeTiming(
                        range,
                        timestamp
                    );

                if (
                    !Number.isFinite(timing.start) ||
                    !Number.isFinite(timing.end) ||
                    timing.end <= timing.start
                ) {
                    continue;
                }

                if (!byRing.has(sourceRing)) {
                    byRing.set(
                        sourceRing,
                        []
                    );
                }

                byRing.get(sourceRing).push({
                    start: timing.start,
                    end: timing.end
                });
            }

            const segments = [];

            for (
                const [sourceRing, entries] of
                    byRing
            ) {
                entries.sort(
                    (a, b) =>
                        a.start - b.start ||
                        a.end - b.end
                );

                let current;

                for (const entry of entries) {
                    if (
                        current &&
                        entry.start <=
                            current.end + 0.0001
                    ) {
                        current.end =
                            Math.max(
                                current.end,
                                entry.end
                            );

                        continue;
                    }

                    current = {
                        sourceRing,
                        start: entry.start,
                        end: entry.end
                    };

                    segments.push(
                        current
                    );
                }
            }

            segments.sort(
                (a, b) =>
                    Number(
                        a.sourceRing.clockTimerRingIndex
                    ) -
                    Number(
                        b.sourceRing.clockTimerRingIndex
                    ) ||
                    a.start - b.start
            );

            return segments;
        }

        #getStateChangeFinalCoverage() {
            if (!this.#started) {
                return [];
            }

            const now =
                this.#getCurrentTimelineTime();

            if (!Number.isFinite(now)) {
                return [];
            }

            const mode =
                this.#getTimerMode();

            if (mode === "elapsed") {
                const ringIndex =
                    this.#getTimerRingIndex(
                        now
                    );

                const sourceRing =
                    this.#rings.get(
                        ringIndex
                    );

                const start =
                    this.#getTimerRingStart(
                        ringIndex
                    );

                if (
                    sourceRing?.isConnected &&
                    Number.isFinite(start) &&
                    now > start
                ) {
                    return [{
                        sourceRing,
                        start,
                        end: now
                    }];
                }

                return [];
            }

            const visibleEnd =
                this.#getLatestTimerEnd();

            if (
                !Number.isFinite(visibleEnd) ||
                visibleEnd <= now
            ) {
                return [];
            }

            const coverage = [];
            let cursor = now;

            while (cursor < visibleEnd) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const sourceRing =
                    this.#rings.get(
                        ringIndex
                    );

                const ringEnd =
                    this.#getTimerRingEnd(
                        ringIndex
                    );

                const end =
                    Math.min(
                        visibleEnd,
                        ringEnd
                    );

                if (
                    !sourceRing?.isConnected ||
                    !Number.isFinite(end) ||
                    end <= cursor
                ) {
                    break;
                }

                coverage.push({
                    sourceRing,
                    start: cursor,
                    end
                });

                cursor = end;
            }

            return coverage;
        }

        #splitStateChangeOverlaySegments(
            visibleSegments,
            fadeStarted
        ) {
            if (!fadeStarted) {
                return visibleSegments.map(
                    segment => ({
                        ...segment,
                        role: "hold"
                    })
                );
            }

            const coverage =
                this.#getStateChangeFinalCoverage();

            const pieces = [];

            for (const segment of visibleSegments) {
                const matches =
                    coverage
                        .filter(
                            item =>
                                item.sourceRing ===
                                    segment.sourceRing &&
                                item.end >
                                    segment.start &&
                                item.start <
                                    segment.end
                        )
                        .map(
                            item => ({
                                start:
                                    Math.max(
                                        segment.start,
                                        item.start
                                    ),
                                end:
                                    Math.min(
                                        segment.end,
                                        item.end
                                    )
                            })
                        )
                        .sort(
                            (a, b) =>
                                a.start - b.start
                        );

                let cursor =
                    segment.start;

                for (const match of matches) {
                    if (match.start > cursor) {
                        pieces.push({
                            sourceRing:
                                segment.sourceRing,
                            start: cursor,
                            end: match.start,
                            role: "fade"
                        });
                    }

                    if (match.end > match.start) {
                        pieces.push({
                            sourceRing:
                                segment.sourceRing,
                            start: match.start,
                            end: match.end,
                            role: "keep"
                        });
                    }

                    cursor =
                        Math.max(
                            cursor,
                            match.end
                        );
                }

                if (cursor < segment.end) {
                    pieces.push({
                        sourceRing:
                            segment.sourceRing,
                        start: cursor,
                        end: segment.end,
                        role: "fade"
                    });
                }
            }

            return pieces;
        }

        #removeStateChangeOverlayRing(
            state,
            sourceRing
        ) {
            const record =
                state.overlayRings.get(
                    sourceRing
                );

            if (!record) {
                return;
            }

            for (const range of record.ranges) {
                this.#resumeRangeRendering(range);
            }

            record.ring.remove();

            state.overlayRings.delete(
                sourceRing
            );
        }

        #ensureStateChangeOverlayRing(
            state,
            sourceRing
        ) {
            let record =
                state.overlayRings.get(
                    sourceRing
                );

            if (record) {
                this.#syncInternalVisualRingGeometry(
                    record.ring,
                    sourceRing
                );

                return record;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerInternalStateChangeOverlay =
                "";

            this.#configureInternalVisualRing(
                ring,
                sourceRing,
                100
            );

            this.#ringLayer.appendChild(
                ring
            );

            record = {
                ring,
                ranges: []
            };

            state.overlayRings.set(
                sourceRing,
                record
            );

            return record;
        }

        #syncStateChangeOverlayRecord(
            state,
            sourceRing,
            pieces,
            timestamp
        ) {
            const record =
                this.#ensureStateChangeOverlayRing(
                    state,
                    sourceRing
                );

            const fittedBounds =
                this.#getStateChangeFittedBounds(
                    timestamp
                );

            const fadeProgress =
                state.fadeStartedAt ===
                    undefined
                    ? 0
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.fadeStartedAt
                            ) /
                            750
                        )
                    );

            for (
                let index = 0;
                index < pieces.length;
                index++
            ) {
                const piece =
                    pieces[index];

                let range =
                    record.ranges[index];

                if (!range) {
                    range =
                        this.#createTimeRange(
                            state.mode,
                            piece.start,
                            piece.end,
                            {
                                dynamic: true
                            }
                        );

                    range.clockTimerStateChangeOverlay =
                        "";

                    range.timeRangeFullEntry =
                        true;

                    range.style.zIndex =
                        "100";

                    this.#suspendRangeRendering(range);

                    try {
                        record.ring.appendChild(
                            range
                        );
                    }
                    catch (error) {
                        this.#resumeRangeRendering(range);

                        throw error;
                    }

                    record.ranges.push(
                        range
                    );
                }

                this.#setRangeTiming(
                    range,
                    piece.start,
                    piece.end,
                    range.hasAttribute(
                        "range-length"
                    )
                );

                range.clockTimerStart =
                    String(piece.start);

                range.clockTimerEnd =
                    String(piece.end);

                const ringIndex =
                    Number(
                        sourceRing.clockTimerRingIndex
                    );

                const origin =
                    this.#getTimerType() ===
                        "radial-fitted"
                        ? fittedBounds?.start
                        : (
                            Number.isFinite(ringIndex)
                                ? this.#getTimerRingStart(
                                    ringIndex
                                )
                                : undefined
                        );

                const layout =
                    this.#calculateTimeRangeLayout(
                        range,
                        piece.start,
                        piece.end,
                        origin,
                        fittedBounds
                    );

                if (layout) {
                    this.#applyTimeRangeLayout(
                        range,
                        layout,
                        true
                    );
                }

                if (piece.role === "fade") {
                    const targetOpacity =
                        Number.isFinite(
                            range.clockTimerStateChangeOpacity
                        )
                            ? range.clockTimerStateChangeOpacity
                            : this.#getRangeOpacity(
                                range
                            );

                    range.clockTimerStateChangeOpacity =
                        targetOpacity;

                    range.style.opacity =
                        String(
                            Math.max(
                                0,
                                targetOpacity *
                                    (1 - fadeProgress)
                            )
                        );
                }
                else {
                    delete range.clockTimerStateChangeOpacity;

                    range.style.removeProperty(
                        "opacity"
                    );
                }
            }

            while (
                record.ranges.length >
                    pieces.length
            ) {
                const range =
                    record.ranges.pop();

                this.#resumeRangeRendering(range);

                range.remove();
            }
        }

        #syncStateChangeVisuals(
            state,
            timestamp = performance.now()
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                !state.activated
            ) {
                return;
            }

            const semanticCoverageOnly =
                state.timerTypeTransition ===
                    true;

            const visible =
                semanticCoverageOnly
                    ? this.#getStateChangeFinalCoverage()
                    : this.#getStateChangeVisibleSegments(
                        timestamp
                    );

            const pieces =
                semanticCoverageOnly
                    ? visible.map(
                        segment => ({
                            ...segment,
                            role:
                                state.fadeStartedAt ===
                                    undefined
                                    ? "hold"
                                    : "keep"
                        })
                    )
                    : this.#splitStateChangeOverlaySegments(
                        visible,
                        state.fadeStartedAt !==
                            undefined
                    );

            const byRing =
                new Map();

            for (const piece of pieces) {
                if (!byRing.has(piece.sourceRing)) {
                    byRing.set(
                        piece.sourceRing,
                        []
                    );
                }

                byRing.get(piece.sourceRing).push(
                    piece
                );
            }

            for (
                const sourceRing of
                    Array.from(
                        state.overlayRings.keys()
                    )
            ) {
                if (
                    !sourceRing.isConnected ||
                    !byRing.has(sourceRing)
                ) {
                    this.#removeStateChangeOverlayRing(
                        state,
                        sourceRing
                    );
                }
            }

            for (
                const [sourceRing, ringPieces] of
                    byRing
            ) {
                this.#syncStateChangeOverlayRecord(
                    state,
                    sourceRing,
                    ringPieces,
                    timestamp
                );
            }
        }

        #stepStateChangeVisuals(
            state,
            timestamp
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            state.frame =
                undefined;

            if (!this.isConnected) {
                this.#cancelStateChangeVisuals(
                    false
                );

                return;
            }

            if (
                Number.isFinite(
                    state.totalDuration
                )
            ) {
                const elapsed =
                    timestamp -
                    state.startedAt;

                const fadeAt =
                    Math.max(
                        0,
                        state.totalDuration -
                        750
                    );

                if (
                    state.fadeStartedAt ===
                        undefined &&
                    elapsed >= fadeAt
                ) {
                    state.fadeStartedAt =
                        state.startedAt +
                        fadeAt;
                }

                if (
                    elapsed >=
                        state.totalDuration
                ) {
                    if (
                        state.fadeStartedAt ===
                            undefined
                    ) {
                        state.fadeStartedAt =
                            timestamp -
                            750;
                    }

                    this.#syncStateChangeVisuals(
                        state,
                        timestamp
                    );

                    this.#finishStateChangeVisuals(
                        state
                    );

                    return;
                }
            }

            this.#syncStateChangeVisuals(
                state,
                timestamp
            );

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepStateChangeVisuals(
                            state,
                            nextTimestamp
                        )
                );
        }

        #beginStateChangeVisuals() {
            if (
                !this.#started ||
                !this.isConnected
            ) {
                return undefined;
            }

            this.#cancelStateChangeVisuals(
                false
            );

            this.#startStateChangeWave();
            this.#removeNormalStateVisualRanges();

            const state = {
                mode:
                    this.#getTimerMode(),
                startedAt:
                    performance.now(),
                activated:
                    false,
                frame:
                    undefined,
                fadeStartedAt:
                    undefined,
                totalDuration:
                    undefined,
                overlayRings:
                    new Map()
            };

            this.#stateChangeVisualState =
                state;

            return state;
        }

        #activateStateChangeVisuals(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                state.activated
            ) {
                return;
            }

            state.mode =
                this.#getTimerMode();

            state.activated =
                true;

            this.#syncStateChangeVisuals(
                state
            );

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepStateChangeVisuals(
                            state,
                            timestamp
                        )
                );
        }

        #setStateChangeVisualDuration(
            state,
            duration
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            state.totalDuration =
                Math.max(
                    750,
                    Number.isFinite(duration)
                        ? duration
                        : 0
                );
        }

        #startStateChangeVisualFade(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state ||
                state.fadeStartedAt !==
                    undefined
            ) {
                return;
            }

            state.fadeStartedAt =
                performance.now();
        }

        #getStateChangeAnimationDuration() {
            return Math.max(
                this.#getRangeAnimationDuration(),
                0,
                ...this.#getTimerRings().map(
                    ring =>
                        this.#getTimerTypeRingAnimationDuration(
                            ring
                        )
                )
            );
        }

        #finishStateChangeVisuals(
            state
        ) {
            if (
                !state ||
                this.#stateChangeVisualState !==
                    state
            ) {
                return;
            }

            if (state.frame !== undefined) {
                cancelAnimationFrame(
                    state.frame
                );

                state.frame =
                    undefined;
            }

            for (
                const sourceRing of
                    Array.from(
                        state.overlayRings.keys()
                    )
            ) {
                this.#removeStateChangeOverlayRing(
                    state,
                    sourceRing
                );
            }

            this.#removeStateChangeWave();

            this.#stateChangeVisualState =
                undefined;

            if (!this.#started) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime();

            this.#updateElapsedRange(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#syncWaveRange();

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    now,
                    {
                        suspendLayout: false
                    }
                );
            }
        }

        #cancelStateChangeVisuals(
            restore = true
        ) {
            const state =
                this.#stateChangeVisualState;

            if (state?.frame !== undefined) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            if (state) {
                for (
                    const sourceRing of
                        Array.from(
                            state.overlayRings.keys()
                        )
                ) {
                    this.#removeStateChangeOverlayRing(
                        state,
                        sourceRing
                    );
                }
            }

            this.#removeStateChangeWave();

            this.#stateChangeVisualState =
                undefined;

            if (
                !restore ||
                !this.#started
            ) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime();

            this.#updateElapsedRange(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#syncWaveRange();
        }

        #getTimerMode() {
            return this.getAttribute(
                "timer-mode"
            ) === "remaining"
                ? "remaining"
                : "elapsed";
        }

        #normalizeTimerMode() {
            const raw =
                this.getAttribute(
                    "timer-mode"
                );

            const normalized =
                typeof raw === "string" &&
                raw.trim().toLowerCase() ===
                    "remaining"
                    ? "remaining"
                    : "elapsed";

            if (raw !== normalized) {
                this.setAttribute(
                    "timer-mode",
                    normalized
                );
            }

            return normalized;
        }

        #getTimerModeTransitionStart() {
            if (this.#started) {
                return this.#getCurrentTimelineTime();
            }

            let start;

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
            ) {
                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    (
                        !Number.isFinite(start) ||
                        end > start
                    )
                ) {
                    start = end;
                }
            }

            return start;
        }

        #cancelTimerModeTransition() {
            const currentOpacity =
                new Map();

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed, time-range.remaining"
                    )
            ) {
                const opacity =
                    Number.parseFloat(
                        getComputedStyle(
                            range
                        ).opacity
                    );

                if (Number.isFinite(opacity)) {
                    currentOpacity.set(
                        range,
                        opacity
                    );
                }
            }

            this.#timerModeTransitionToken++;

            for (
                const animation of
                    this.#timerModeTransitionAnimations
            ) {
                animation.cancel();
            }

            this.#timerModeTransitionAnimations.clear();

            for (
                const range of
                    this.querySelectorAll(
                        "time-range[timer-mode-transitioning]"
                    )
            ) {
                range.removeAttribute(
                    "timer-mode-transitioning"
                );
            }

            return currentOpacity;
        }

        #getRangeOpacity(range) {
            const value =
                Number.parseFloat(
                    getComputedStyle(
                        range
                    ).opacity
                );

            return Number.isFinite(value)
                ? Math.min(
                    1,
                    Math.max(
                        0,
                        value
                    )
                )
                : 1;
        }

        #animateTimerModeRange(
            range,
            fromOpacity,
            toOpacity
        ) {
            if (
                !range?.isConnected ||
                typeof range.animate !==
                    "function"
            ) {
                return undefined;
            }

            const animation =
                range.animate(
                    [
                        {
                            opacity:
                                String(
                                    fromOpacity
                                )
                        },
                        {
                            opacity:
                                String(
                                    toOpacity
                                )
                        }
                    ],
                    {
                        duration: 333,
                        easing: "ease-in-out",
                        fill: "both"
                    }
                );

            this.#timerModeTransitionAnimations.add(
                animation
            );

            return animation;
        }

        #applyTimerModeState(
            mode
        ) {
            const start =
                this.#getTimerModeTransitionStart();

            if (
                Number.isFinite(
                    start
                )
            ) {
                this.#updateRemainingRanges(
                    start
                );
            }

            this.#syncWaveRange();

            for (
                const ring of
                    this.#getTimerRings()
            ) {
                ring.refreshLayerLayout?.({
                    animate:
                        false
                });
            }
        }

        #transitionTimerMode(
            previousMode,
            mode
        ) {
            this.#cancelTimerModeTransition();

            const start =
                this.#getTimerModeTransitionStart();

            if (
                Number.isFinite(
                    start
                )
            ) {
                this.#updateRemainingRanges(
                    start
                );
            }

            this.#syncWaveRange();

            for (
                const ring of
                    this.#getTimerRings()
            ) {
                ring.refreshLayerLayout?.({
                    animate:
                        true,

                    duration:
                        333
                });
            }
        }

        #handleTimerModeChange(
            oldValue,
            newValue
        ) {
            const mode =
                this.#normalizeTimerMode();

            if (newValue !== mode) {
                return;
            }

            this.#cancelTimerModeTransition();

            if (
                !this.#started ||
                !this.isConnected
            ) {
                this.#applyTimerModeState(
                    mode
                );

                return;
            }

            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                750
            );
        }

        #findWaveSourceRange() {
            if (
                this.#started &&
                this.#elapsedRange?.isConnected
            ) {
                return this.#elapsedRange;
            }

            if (
                this.#getTimerMode() !==
                    "remaining"
            ) {
                return undefined;
            }

            let selected;
            let selectedEnd =
                -Infinity;

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
            ) {
                if (!range.isConnected) {
                    continue;
                }

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    end > selectedEnd
                ) {
                    selected = range;
                    selectedEnd = end;
                }
            }

            return selected;
        }

        #ensureWaveRing(
            sourceRing
        ) {
            if (
                !sourceRing ||
                sourceRing.localName !==
                    "ring-container" ||
                !this.#ringLayer
            ) {
                return undefined;
            }

            if (!this.#waveRing) {
                const ring =
                    document.createElement(
                        "ring-container"
                    );

                ring.id =
                    "progress-wave-ring";

                ring.clockTimerInternalWave =
                    "";

                ring.style.position =
                    "absolute";

                ring.style.inset =
                    "0";

                ring.style.width =
                    "100%";

                ring.style.height =
                    "100%";

                ring.style.zIndex =
                    "100";

                ring.style.pointerEvents =
                    "none";

                ring.style.background =
                    "transparent";

                ring.resizeDuration =
                    "0ms";

                ring.resizeFilter =
                    "none";

                ring.reorderFilter =
                    "none";

                ring.connectFilter =
                    "none";

                ring.disconnectFilter =
                    "none";

                ring.filterRamp =
                    false;

                ring.filterRampFront =
                    "0ms";

                ring.filterRampEnd =
                    "0ms";

                ring.filterRampConnect =
                    "0ms";

                ring.filterRampDisconnect =
                    "0ms";

                this.#ringLayer.appendChild(
                    ring
                );

                this.#waveRing =
                    ring;
            }

            const ring =
                this.#waveRing;

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            ring.style.display =
                "block";

            ring.clockTimerRing =
                "";

            ring.clockTimerRingIndex =
                sourceRing.clockTimerRingIndex ??
                "";

            const inset =
                sourceRing.renderedInset ??
                sourceRing.getAttribute(
                    "inset"
                ) ??
                "0px";

            const width =
                sourceRing.renderedWidth ??
                sourceRing.getAttribute(
                    "width"
                ) ??
                "0px";

            if (
                ring.getAttribute(
                    "inset"
                ) !== inset
            ) {
                ring.setAttribute(
                    "inset",
                    inset
                );
            }

            if (
                ring.getAttribute(
                    "width"
                ) !== width
            ) {
                ring.setAttribute(
                    "width",
                    width
                );
            }

            ring.toggleAttribute(
                "active",
                sourceRing.hasAttribute(
                    "active"
                )
            );

            return ring;
        }

        #removeWaveRange() {
            if (this.#waveRange) {
                this.#waveRange.remove();
                this.#waveRange =
                    undefined;
            }

            if (this.#waveRing) {
                this.#waveRing.style.display =
                    "none";
            }
        }

        #cancelWaveResumeDelay({ restore = true } = {}) {
            if (
                this.#waveResumeTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#waveResumeTimeout
                );

                this.#waveResumeTimeout =
                    undefined;
            }

            this.#waveResumeToken++;

            if (restore) {
                this.#waveSuppressed =
                    false;
            }
        }

        #scheduleWaveResumeAfterTimerTypeTransition(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            if (
                this.#waveResumeTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#waveResumeTimeout
                );
            }

            const token =
                ++this.#waveResumeToken;

            state.holdNormalWave =
                true;

            this.#waveSuppressed =
                false;

            this.#waveResumeTimeout =
                setTimeout(
                    () => {
                        this.#waveResumeTimeout =
                            undefined;

                        if (
                            token !==
                                this.#waveResumeToken ||
                            state !==
                                this.#timerTypeTransitionState
                        ) {
                            return;
                        }

                        state.holdNormalWave =
                            false;

                        this.#waveSuppressed =
                            false;

                        if (
                            this.#started &&
                            this.isConnected
                        ) {
                            this.#syncWaveRange();
                        }

                        if (this.#waveRange) {
                            this.#waveRange.style.removeProperty(
                                "opacity"
                            );

                            this.#waveRange.style.removeProperty(
                                "--elapsed-wave-play-state"
                            );
                        }

                        this.#timerTypeTransitionState =
                            undefined;

                        this.#updateIndicatorSymbol();
                    },
                    state.timing?.quiet ??
                        2000
                );
        }

        #syncWaveRange() {
            if (this.#waveSuppressed) {
                this.#removeWaveRange();
                return;
            }
            if (this.#stateChangeVisualState) {
                this.#removeWaveRange();
                return;
            }

            const source =
                this.#findWaveSourceRange();

            if (!source) {
                this.#removeWaveRange();
                return;
            }

            const start =
                Number(
                    source.clockTimerStart
                );

            const end =
                Number(
                    source.clockTimerEnd
                );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                this.#removeWaveRange();
                return;
            }

            const ring =
                this.#ensureWaveRing(
                    source.parentElement
                );

            if (!ring) {
                this.#removeWaveRange();
                return;
            }

            let range =
                this.#waveRange;

            if (
                !range ||
                range.parentElement !== ring
            ) {
                range =
                    document.createElement(
                        "time-range"
                    );

                range.setAttribute(
                    "type",
                    "wave"
                );

                range.setAttribute(
                    "overlapping",
                    ""
                );

                range.setAttribute(
                    "start-time",
                    this.#formatTimelineTime(
                        start
                    )
                );

                range.setAttribute(
                    "end-time",
                    this.#formatTimelineTime(
                        end
                    )
                );

                range.clockTimerStart =
                    String(start);

                range.clockTimerEnd =
                    String(end);

                range.clockTimerInternalWave =
                    "";

                range.timeRangeFullEntry =
                    true;

                const transitionState =
                    this.#timerTypeTransitionState;

                if (
                    transitionState?.borderHandoff ===
                        true &&
                    transitionState.holdNormalWave ===
                        true
                ) {
                    range.style.opacity =
                        "0";

                    range.style.setProperty(
                        "--elapsed-wave-play-state",
                        "paused"
                    );
                }

                ring.appendChild(
                    range
                );

                this.#waveRange =
                    range;
            }
            else {
                this.#setRangeTiming(
                    range,
                    start,
                    end,
                    range.hasAttribute(
                        "range-length"
                    )
                );
            }

            const transitionState =
                this.#timerTypeTransitionState;

            if (
                transitionState?.borderHandoff ===
                    true &&
                transitionState.holdNormalWave ===
                    true
            ) {
                range.style.opacity =
                    "0";

                range.style.setProperty(
                    "--elapsed-wave-play-state",
                    "paused"
                );
            }

            this.#prepareTimerTypeTransitionVisualRange(
                range
            );
        }

        #ensureBorderRing() {
            if (
                this.#borderRing &&
                this.#borderRing.parentElement ===
                    this
            ) {
                return this.#borderRing;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerBorder =
                "";

            ring.setAttribute(
                "width",
                "var(--clock-timer-border-width, clamp(1px, 1cqi, 5px))"
            );

            const borderFill =
                document.createElement(
                    "div"
                );

            borderFill.clockTimerBorderFill =
                "";

            borderFill.style.position =
                "absolute";

            borderFill.style.inset =
                "0";

            borderFill.style.width =
                "100%";

            borderFill.style.height =
                "100%";

            borderFill.style.minWidth =
                "0";

            borderFill.style.minHeight =
                "0";

            borderFill.style.boxSizing =
                "border-box";

            borderFill.style.background =
                "var(--clock-timer-border-color, black)";

            borderFill.style.pointerEvents =
                "none";

            ring.appendChild(
                borderFill
            );

            this.#borderRing =
                ring;

            this.appendChild(
                ring
            );

            return ring;
        }

        #ensureHandRing() {
            if (
                this.#handRing &&
                this.#handRing.parentElement ===
                    this
            ) {
                return this.#handRing;
            }

            this.#stopHandAnimations();

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerHands =
                "";

            ring.setAttribute(
                "geometry-only",
                ""
            );

            ring.setAttribute(
                "width",
                "0px"
            );

            ring.resizeFilter =
                "none";

            ring.reorderFilter =
                "none";

            ring.connectFilter =
                "none";

            ring.disconnectFilter =
                "none";

            ring.filterRamp =
                false;

            this.#handRing =
                ring;

            this.appendChild(
                ring
            );

            return ring;
        }

        #createHand(
            type
        ) {
            const hand =
                document.createElement(
                    "div"
                );

            hand.clockTimerHand =
                type;

            hand.className =
                `${type}-hand`;

            hand.setAttribute(
                "part",
                `${type}-hand`
            );

            hand.style.position =
                "absolute";

            hand.style.top =
                "50%";

            hand.style.left =
                "50%";

            hand.style.pointerEvents =
                "none";

            hand.style.transformOrigin =
                "50% 100%";

            hand.style.transform =
                "translate(-50%, -100%) rotate(0deg)";

            return hand;
        }

        #ensureTickRing() {
            if (
                this.#tickRing &&
                this.#tickRing.parentElement ===
                    this
            ) {
                return this.#tickRing;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerTicks =
                "";

            ring.setAttribute(
                "geometry-only",
                ""
            );

            ring.setAttribute(
                "width",
                "0px"
            );

            ring.setAttribute(
                "outer-margin",
                "var(--clock-timer-tick-inset, clamp(5px, 2cqi, 10px))"
            );

            ring.resizeFilter =
                "none";

            ring.reorderFilter =
                "none";

            ring.connectFilter =
                "none";

            ring.disconnectFilter =
                "none";

            ring.filterRamp =
                false;

            this.#tickRing =
                ring;

            this.appendChild(
                ring
            );

            return ring;
        }

        #getRingInset(
            targetRing
        ) {
            let outerInset =
                "0px";

            const rings =
                Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container" &&
                        element.clockTimerExitingRing !==
                            true
                );

            for (
                const ring of
                    rings
            ) {
                const width =
                    ring.width ?? "0px";

                const outerMargin =
                    ring.outerMargin ?? "0px";

                const innerMargin =
                    ring.innerMargin ?? "0px";

                if (
                    ring ===
                        targetRing
                ) {
                    return outerInset;
                }

                const inset =
                    `calc(${outerInset} + ${outerMargin})`;

                outerInset =
                    `calc(${inset} + ${width} + ${innerMargin})`;
            }

            return "0px";
        }

        #getTickInset() {
            return this.#getRingInset(
                this.#tickRing
            );
        }

        #getEffectiveRenderDiameter() {
            const rect =
                this.getBoundingClientRect();

            const diameter =
                Math.min(
                    rect.width,
                    rect.height
                );

            return (
                Number.isFinite(diameter) &&
                diameter > 0
            )
                ? diameter
                : undefined;
        }

        #syncHandGeometry() {
            this.#ensureHandRing();

            const insetValue =
                this.#getRingInset(
                    this.#handRing
                );

            const diameter =
                this.#getEffectiveRenderDiameter();

            let inset =
                Number.parseFloat(
                    this.#handRing
                        ?.renderedInset
                );

            if (!Number.isFinite(inset)) {
                inset =
                    this.#resolveTimerTypeTransitionLength(
                        insetValue,
                        this.#handRing
                    );
            }

            if (
                Number.isFinite(diameter) &&
                Number.isFinite(inset)
            ) {
                const handDiameter =
                    Math.max(
                        0,
                        diameter -
                            Math.max(
                                0,
                                inset
                            ) * 2
                    );

                this.#handLayer.style.inset =
                    "auto";

                this.#handLayer.style.top =
                    "50%";

                this.#handLayer.style.left =
                    "50%";

                this.#handLayer.style.width =
                    `${handDiameter}px`;

                this.#handLayer.style.height =
                    `${handDiameter}px`;

                this.#handLayer.style.transform =
                    "translate(-50%, -50%)";

                return;
            }

            this.#handLayer.style.inset =
                insetValue;

            this.#handLayer.style.top =
                "";

            this.#handLayer.style.left =
                "";

            this.#handLayer.style.width =
                "";

            this.#handLayer.style.height =
                "";

            this.#handLayer.style.transform =
                "";
        }

        #syncTickMarkGeometry() {
            this.#ensureTickRing();

            const inset =
                this.#getTickInset();

            this.#tickMarkLayer.style.left =
                "";

            this.#tickMarkLayer.style.top =
                "";

            this.#tickMarkLayer.style.width =
                "";

            this.#tickMarkLayer.style.height =
                "";

            this.#tickMarkLayer.style.inset =
                inset;
        }

        #startTickGeometryTracking() {
            if (
                this.#tickGeometryFrame !==
                    undefined
            ) {
                return;
            }

            const update =
                () => {
                    this.#tickGeometryFrame =
                        undefined;

                    if (
                        !this.isConnected ||
                        !this.hasAttribute(
                            "tick-marks"
                        )
                    ) {
                        return;
                    }

                    this.#syncTickMarkGeometry();

                    this.#tickGeometryFrame =
                        requestAnimationFrame(
                            update
                        );
                };

            this.#syncTickMarkGeometry();

            this.#tickGeometryFrame =
                requestAnimationFrame(
                    update
                );
        }

        #stopTickGeometryTracking() {
            if (
                this.#tickGeometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#tickGeometryFrame
                );

                this.#tickGeometryFrame =
                    undefined;
            }

            this.#tickMarkLayer.style.removeProperty(
                "left"
            );

            this.#tickMarkLayer.style.removeProperty(
                "top"
            );

            this.#tickMarkLayer.style.removeProperty(
                "width"
            );

            this.#tickMarkLayer.style.removeProperty(
                "height"
            );

            this.#tickMarkLayer.style.removeProperty(
                "inset"
            );
        }

        #parseContrastColor(
            value
        ) {
            const text =
                String(value ?? "")
                    .trim()
                    .toLowerCase();

            if (!text) {
                return undefined;
            }

            if (text === "transparent") {
                return {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 0
                };
            }

            const hex =
                text.match(
                    /^#([0-9a-f]{3,8})$/i
                );

            if (hex) {
                let value =
                    hex[1];

                if (
                    value.length === 3 ||
                    value.length === 4
                ) {
                    value =
                        Array.from(value)
                            .map(
                                digit =>
                                    `${digit}${digit}`
                            )
                            .join("");
                }

                if (
                    value.length === 6 ||
                    value.length === 8
                ) {
                    return {
                        r: Number.parseInt(
                            value.slice(0, 2),
                            16
                        ),
                        g: Number.parseInt(
                            value.slice(2, 4),
                            16
                        ),
                        b: Number.parseInt(
                            value.slice(4, 6),
                            16
                        ),
                        a:
                            value.length === 8
                                ? Number.parseInt(
                                    value.slice(6, 8),
                                    16
                                ) / 255
                                : 1
                    };
                }
            }

            if (
                text.startsWith("rgb(") ||
                text.startsWith("rgba(")
            ) {
                const values =
                    text.match(
                        /-?\d*\.?\d+%?/g
                    ) ?? [];

                if (values.length >= 3) {
                    const channel =
                        raw => {
                            const percent =
                                raw.endsWith("%");

                            const number =
                                Number.parseFloat(raw);

                            if (!Number.isFinite(number)) {
                                return undefined;
                            }

                            return Math.max(
                                0,
                                Math.min(
                                    255,
                                    percent
                                        ? number * 2.55
                                        : number
                                )
                            );
                        };

                    const r =
                        channel(values[0]);

                    const g =
                        channel(values[1]);

                    const b =
                        channel(values[2]);

                    if (
                        r === undefined ||
                        g === undefined ||
                        b === undefined
                    ) {
                        return undefined;
                    }

                    let a =
                        1;

                    if (values[3] !== undefined) {
                        const alphaPercent =
                            values[3].endsWith("%");

                        const alpha =
                            Number.parseFloat(
                                values[3]
                            );

                        if (Number.isFinite(alpha)) {
                            a =
                                Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        alphaPercent
                                            ? alpha / 100
                                            : alpha
                                    )
                                );
                        }
                    }

                    return {
                        r,
                        g,
                        b,
                        a
                    };
                }
            }

            return undefined;
        }

        #contrastLuminance(
            color
        ) {
            const channel =
                value => {
                    const normalized =
                        value / 255;

                    return normalized <= 0.04045
                        ? normalized / 12.92
                        : Math.pow(
                            (
                                normalized +
                                0.055
                            ) / 1.055,
                            2.4
                        );
                };

            return (
                0.2126 * channel(color.r) +
                0.7152 * channel(color.g) +
                0.0722 * channel(color.b)
            );
        }

        #contrastRatio(
            left,
            right
        ) {
            const leftLuminance =
                this.#contrastLuminance(
                    left
                );

            const rightLuminance =
                this.#contrastLuminance(
                    right
                );

            const lighter =
                Math.max(
                    leftLuminance,
                    rightLuminance
                );

            const darker =
                Math.min(
                    leftLuminance,
                    rightLuminance
                );

            return (
                lighter + 0.05
            ) / (
                darker + 0.05
            );
        }

        #getEffectiveContrastBackground() {
            const faceColor =
                this.#parseContrastColor(
                    getComputedStyle(
                        this.#faceBackground
                    ).backgroundColor
                );

            if (
                faceColor &&
                faceColor.a >= 0.95
            ) {
                return faceColor;
            }

            let element =
                this;

            while (element) {
                const color =
                    this.#parseContrastColor(
                        getComputedStyle(
                            element
                        ).backgroundColor
                    );

                if (
                    color &&
                    color.a >= 0.95
                ) {
                    return color;
                }

                element =
                    element.parentElement;
            }

            return faceColor?.a > 0
                ? faceColor
                : {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 1
                };
        }

        #getVisibleHandContrastColors() {
            const hands = [
                [
                    this.#hourHand,
                    "hide-hour-hand"
                ],
                [
                    this.#minuteHand,
                    "hide-minute-hand"
                ],
                [
                    this.#secondHand,
                    "hide-second-hand"
                ]
            ];

            const colors = [];

            for (
                const [
                    hand,
                    hiddenAttribute
                ] of hands
            ) {
                if (
                    !hand ||
                    this.hasAttribute(
                        hiddenAttribute
                    )
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(
                        hand
                    );

                if (
                    style.display === "none" ||
                    style.visibility === "hidden" ||
                    Number.parseFloat(
                        style.opacity || "1"
                    ) <= 0
                ) {
                    continue;
                }

                const color =
                    this.#parseContrastColor(
                        style.backgroundColor
                    );

                if (
                    color &&
                    color.a > 0
                ) {
                    colors.push(
                        color
                    );
                }
            }

            return colors;
        }

        #updateTimeOutlineContrast() {
            if (!this.#timeElement) {
                return;
            }

            const timeStyle =
                getComputedStyle(
                    this.#timeElement
                );

            const timeColor =
                this.#parseContrastColor(
                    timeStyle.color
                );

            const background =
                this.#getEffectiveContrastBackground();

            if (
                !timeColor ||
                !background
            ) {
                return;
            }

            const handColors =
                this.#getVisibleHandContrastColors();

            // Contrast is intentionally evaluated only as main-time color
            // versus each visual surface independently. Hand colors are never
            // compared with the background or with each other.
            const surfaces = [
                background,
                ...handColors
            ];

            const fontSize =
                Number.parseFloat(
                    timeStyle.fontSize
                );

            const fontWeight =
                Number.parseInt(
                    timeStyle.fontWeight,
                    10
                );

            const largeText =
                Number.isFinite(fontSize) &&
                (
                    fontSize >= 24 ||
                    (
                        fontSize >= 18.66 &&
                        Number.isFinite(fontWeight) &&
                        fontWeight >= 700
                    )
                );

            const threshold =
                largeText
                    ? 3
                    : 4.5;

            const contrastValues =
                surfaces.map(
                    surface =>
                        this.#contrastRatio(
                            timeColor,
                            surface
                        )
                );

            const problematic =
                surfaces.filter(
                    (
                        surface,
                        index
                    ) =>
                        contrastValues[index] <
                            threshold
                );

            const signature =
                JSON.stringify({
                    timeColor,
                    surfaces,
                    fontSize,
                    fontWeight,
                    threshold,
                    problematicCount:
                        problematic.length
                });

            if (
                signature ===
                    this.#timeOutlineSignature
            ) {
                return;
            }

            this.#timeOutlineSignature =
                signature;

            if (problematic.length === 0) {
                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-width",
                    "0px"
                );

                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-color",
                    "transparent"
                );

                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-shadow",
                    "none"
                );

                return;
            }

            const candidates = [
                {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 1
                },
                {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 1
                }
            ];

            let best =
                candidates[0];

            let bestScore =
                -Infinity;

            let bestAverage =
                -Infinity;

            for (const candidate of candidates) {
                const candidateContrasts = [
                    this.#contrastRatio(
                        candidate,
                        timeColor
                    ),
                    ...problematic.map(
                        surface =>
                            this.#contrastRatio(
                                candidate,
                                surface
                            )
                    )
                ];

                const score =
                    Math.min(
                        ...candidateContrasts
                    );

                const average =
                    candidateContrasts.reduce(
                        (
                            total,
                            value
                        ) =>
                            total + value,
                        0
                    ) /
                    candidateContrasts.length;

                if (
                    score > bestScore ||
                    (
                        score === bestScore &&
                        average > bestAverage
                    )
                ) {
                    best =
                        candidate;

                    bestScore =
                        score;

                    bestAverage =
                        average;
                }
            }

            const outlineColor =
                `rgb(${best.r} ${best.g} ${best.b})`;

            const outlineWidth =
                Number.isFinite(fontSize)
                    ? Math.max(
                        1,
                        Math.min(
                            2.5,
                            fontSize * 0.04
                        )
                    )
                    : 1.5;

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-width",
                `${outlineWidth}px`
            );

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-color",
                outlineColor
            );

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-shadow",
                `0 0 ${Math.max(1, outlineWidth * 0.8)}px ${outlineColor}`
            );
        }

        #captureFaceBackground() {
            if (!this.#faceBackground) {
                return;
            }

            this.#syncFaceBackgroundFromExternalCSS();
        }

        #syncFaceBackgroundFromExternalCSS() {
            if (!this.#faceBackground) {
                return;
            }

            const transparencySheet =
                this.#hostTransparencyStyle
                    ?.sheet;

            if (transparencySheet) {
                transparencySheet.disabled =
                    true;
            }

            let backgroundColor;

            try {
                backgroundColor =
                    getComputedStyle(this)
                        .backgroundColor;
            }
            finally {
                if (transparencySheet) {
                    transparencySheet.disabled =
                        false;
                }
            }

            this.#faceBackground.style.backgroundColor =
                backgroundColor;

            this.#updateTimeOutlineContrast();
        }
        #syncFaceBackgroundGeometry() {
            if (!this.#faceBackground || !this.#borderRing) {
                return;
            }

            const inset = Number.parseFloat(
                this.#borderRing.renderedInset
            );

            const width = Number.parseFloat(
                this.#borderRing.renderedWidth
            );

            if (!Number.isFinite(inset) || !Number.isFinite(width)) {
                return;
            }

            const innerEdge = Math.max(0, inset + width / 2);
            this.#faceBackground.style.inset = `${innerEdge}px`;
        }

        #startFaceBackgroundTracking() {
            if (this.#faceBackgroundFrame !== undefined) {
                return;
            }

            const update = () => {
                this.#faceBackgroundFrame = undefined;

                if (!this.isConnected) {
                    return;
                }

                this.#syncFaceBackgroundFromExternalCSS();
                this.#syncFaceBackgroundGeometry();
                this.#faceBackgroundFrame = requestAnimationFrame(update);
            };

            this.#syncFaceBackgroundFromExternalCSS();
            this.#syncFaceBackgroundGeometry();
            this.#faceBackgroundFrame = requestAnimationFrame(update);
        }

        #stopFaceBackgroundTracking() {
            if (this.#faceBackgroundFrame !== undefined) {
                cancelAnimationFrame(this.#faceBackgroundFrame);
                this.#faceBackgroundFrame = undefined;
            }

            this.style.removeProperty(
                "background-color"
            );
        }

        #ensureNumberRing() {
            if (
                this.#numberRing &&
                this.#numberRing.parentElement ===
                    this
            ) {
                return this.#numberRing;
            }

            const ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerNumbers =
                "";

            ring.setAttribute(
                "geometry-only",
                ""
            );

            ring.setAttribute(
                "width",
                "0px"
            );

            ring.setAttribute(
                "outer-margin",
                "var(--clock-timer-number-inset, clamp(4px, 3cqi, 16px))"
            );

            ring.resizeFilter =
                "none";

            ring.reorderFilter =
                "none";

            ring.connectFilter =
                "none";

            ring.disconnectFilter =
                "none";

            ring.filterRamp =
                false;

            const numberLayer =
                document.createElement(
                    "div"
                );

            numberLayer.clockTimerNumberLayer =
                "";

            numberLayer.style.position =
                "absolute";

            numberLayer.style.inset =
                "0";

            numberLayer.style.width =
                "100%";

            numberLayer.style.height =
                "100%";

            numberLayer.style.boxSizing =
                "border-box";

            numberLayer.style.pointerEvents =
                "none";

            numberLayer.style.overflow =
                "visible";

            numberLayer.style.zIndex =
                "20";

            numberLayer.style.fontFamily =
                "var(--clock-timer-hour-font, inherit)";

            numberLayer.style.fontSize =
                "var(--clock-timer-hour-font-size, var(--clock-timer-auto-hour-font-size, 1rem))";

            ring.appendChild(
                numberLayer
            );

            this.#numberRing =
                ring;

            this.#hourLayer =
                numberLayer;

            this.appendChild(
                ring
            );

            return ring;
        }

        #ensurePermanentRingOrder() {
            const borderRing =
                this.#ensureBorderRing();

            const tickRing =
                this.#ensureTickRing();

            const handRing =
                this.#ensureHandRing();

            const numberRing =
                this.#ensureNumberRing();

            const timerRings =
                Array.from(
                    this.children
                ).filter(
                    child =>
                        child.localName ===
                            "ring-container" &&
                        child.clockTimerRing !==
                            undefined &&
                        child.clockTimerExitingRing !==
                            true
                );

            if (
                timerRings.length >
                    0
            ) {
                return;
            }

            const order = [
                borderRing,
                tickRing,
                handRing,
                numberRing
            ];

            const managed =
                new Set(
                    order
                );

            const current =
                Array.from(
                    this.children
                ).filter(
                    child =>
                        managed.has(
                            child
                        )
                );

            const orderChanged =
                current.length !==
                    order.length ||
                order.some(
                    (
                        ring,
                        index
                    ) =>
                        current[index] !==
                            ring
                );

            if (
                !orderChanged
            ) {
                return;
            }

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (
                RingContainerClass &&
                typeof RingContainerClass.reorder ===
                    "function"
            ) {
                RingContainerClass.reorder(
                    ...order
                );

                return;
            }

            this.append(
                ...order
            );
        }

        #getTickMarkMode() {
            const value =
                this.getAttribute(
                    "tick-marks"
                );

            if (
                value === null
            ) {
                return undefined;
            }

            const normalized =
                value.trim();

            const rollingOffsetMatch =
                normalized.match(
                    /^\+\/-(\d+(?:\.\d+)?)$/
                );

            if (rollingOffsetMatch) {
                const value =
                    Number(
                        rollingOffsetMatch[1]
                    );

                if (
                    Number.isFinite(value) &&
                    value > 0
                ) {
                    return {
                        type: "rolling-offset",
                        value
                    };
                }
            }

            if (
                normalized === ""
            ) {
                return {
                    type: "fixed",
                    value: 1
                };
            }

            const rollingMatch =
                normalized.match(
                    /^(\[|\()(\d+)(\]|\))$/
                );

            if (rollingMatch) {
                const value =
                    Number(
                        rollingMatch[2]
                    );

                if (
                    Number.isInteger(value) &&
                    value > 0
                ) {
                    return {
                        type: "rolling-groups",
                        value,
                        includeBoundaries:
                            rollingMatch[1] === "[" &&
                            rollingMatch[3] === "]"
                    };
                }

                return undefined;
            }

            if (
                /^\d+$/.test(
                    normalized
                )
            ) {
                const value =
                    Number(
                        normalized
                    );

                if (
                    Number.isInteger(value) &&
                    value >= 1 &&
                    value <= 60
                ) {
                    return {
                        type: "fixed",
                        value
                    };
                }
            }

            return undefined;
        }

        #getTickMarkSeconds(
            mode,
            now
        ) {
            if (
                mode.type === "fixed"
            ) {
                const seconds = [];

                for (
                    let second = 0;
                    second < 60;
                    second += mode.value
                ) {
                    seconds.push(
                        second
                    );
                }

                return seconds;
            }

            const currentSecond =
                now.getSeconds();

            if (
                mode.type === "rolling-offset"
            ) {
                const seconds = [];

                const wholeSecondRadius =
                    Math.floor(
                        mode.value
                    );

                for (
                    let offset = -wholeSecondRadius;
                    offset <= wholeSecondRadius;
                    offset++
                ) {
                    seconds.push(
                        (
                            currentSecond +
                            offset +
                            60
                        ) % 60
                    );
                }

                return seconds;
            }

            const groupCount =
                Math.max(
                    1,
                    Math.ceil(
                        mode.value /
                        5
                    )
                );

            const currentGroup =
                Math.floor(
                    currentSecond /
                    5
                );

            const startGroup =
                currentGroup -
                Math.floor(
                    (
                        groupCount -
                        1
                    ) /
                    2
                );

            const startSecond =
                startGroup *
                5;

            const endSecond =
                startSecond +
                groupCount *
                5;

            const firstSecond =
                mode.includeBoundaries
                    ? startSecond
                    : startSecond + 1;

            const lastSecond =
                mode.includeBoundaries
                    ? endSecond
                    : endSecond - 1;

            const seconds = [];

            for (
                let second = firstSecond;
                second <= lastSecond;
                second++
            ) {
                seconds.push(
                    (
                        second % 60 +
                        60
                    ) % 60
                );
            }

            return seconds;
        }

        #createTickMark(
            second
        ) {
            const track =
                document.createElement(
                    "div"
                );

            track.className =
                "tick-mark-track";

            track.clockTimerTickSecond =
                String(
                    second
                );

            track.style.setProperty(
                "--clock-timer-tick-angle",
                `${second * 6}deg`
            );

            const mark =
                document.createElement(
                    "div"
                );

            const major =
                second % 5 ===
                    0;

            mark.className =
                major
                    ? "tick-mark major"
                    : "tick-mark";

            mark.setAttribute(
                "part",
                major
                    ? "tick-mark major-tick-mark"
                    : "tick-mark"
            );

            track.appendChild(
                mark
            );

            return track;
        }

        #fadeTickMarkIn(
            track
        ) {
            track.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration: 1000 / 3,
                    easing: "linear",
                    fill: "both"
                }
            );
        }

        #fadeTickMarkOut(
            track
        ) {
            track.clockTimerTickExiting =
                "";

            const opacity =
                getComputedStyle(
                    track
                ).opacity;

            track.animate(
                [
                    { opacity },
                    { opacity: 0 }
                ],
                {
                    duration: 1000 / 3,
                    easing: "linear",
                    fill: "forwards"
                }
            ).finished
                .finally(
                    () => track.remove()
                );
        }

        #updateTickMarks(
            now = new Date()
        ) {
            this.#stopTickMarkTimer();

            const mode =
                this.#getTickMarkMode();

            if (!mode) {
                this.#tickMarkLayer.replaceChildren();
                this.#stopTickGeometryTracking();
                return;
            }

            this.#startTickGeometryTracking();

            const seconds =
                this.#getTickMarkSeconds(
                    mode,
                    now
                );

            const rolling =
                mode.type !== "fixed";

            if (!rolling) {
                const fragment =
                    document.createDocumentFragment();

                for (
                    const second of seconds
                ) {
                    fragment.appendChild(
                        this.#createTickMark(
                            second
                        )
                    );
                }

                this.#tickMarkLayer.replaceChildren(
                    fragment
                );

                return;
            }

            const desired =
                new Set(
                    seconds.map(
                        second =>
                            String(second)
                    )
                );

            const existing =
                new Map();

            for (
                const track of
                    Array.from(
                        this.#tickMarkLayer.children
                    )
            ) {
                if (
                    track.hasAttribute(
                        "data-clock-timer-tick-exiting"
                    )
                ) {
                    continue;
                }

                const second =
                    track.clockTimerTickSecond;

                if (
                    second !== undefined
                ) {
                    existing.set(
                        second,
                        track
                    );
                }
            }

            for (
                const [second, track] of
                    existing
            ) {
                if (
                    !desired.has(
                        second
                    )
                ) {
                    existing.delete(
                        second
                    );

                    this.#fadeTickMarkOut(
                        track
                    );
                }
            }

            for (
                const second of seconds
            ) {
                const key =
                    String(second);

                let track =
                    existing.get(
                        key
                    );

                if (!track) {
                    track =
                        this.#createTickMark(
                            second
                        );

                    this.#tickMarkLayer.appendChild(
                        track
                    );

                    this.#fadeTickMarkIn(
                        track
                    );
                }
                else {
                    this.#tickMarkLayer.appendChild(
                        track
                    );
                }
            }

            if (
                this.isConnected
            ) {
                const millisecondsToNextSecond =
                    now.getMilliseconds() === 0
                        ? 1000
                        : 1000 -
                            now.getMilliseconds();

                this.#tickMarkTimeout =
                    setTimeout(
                        () => {
                            this.#tickMarkTimeout =
                                undefined;

                            this.#updateTickMarks(
                                new Date()
                            );
                        },
                        millisecondsToNextSecond
                    );
            }
        }

        #stopTickMarkTimer() {
            if (
                this.#tickMarkTimeout ===
                    undefined
            ) {
                return;
            }

            clearTimeout(
                this.#tickMarkTimeout
            );

            this.#tickMarkTimeout =
                undefined;
        }

        #scheduleHourRender() {
            if (
                this.#hoursRenderFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#hoursRenderFrame
                );
            }

            this.#hoursRenderFrame =
                requestAnimationFrame(
                    () => {
                        this.#hoursRenderFrame =
                            undefined;

                        if (
                            !this.isConnected
                        ) {
                            return;
                        }

                        this.#syncHandGeometry();

                        this.#renderHours();

                        this.#scheduleResponsiveMetrics();
                    }
                );
        }


        #refreshTimeRangeVisualGeometry() {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined,
                    {
                        suspendLayout:
                            !this.#timerTypeTransitioning
                    }
                );

                return;
            }

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    typeof this.#getRangeRenderer(range)?.refreshRangeGeometry === "function"
                ) {
                    this.#refreshRangeGeometry(range);
                }
            }
        }

        #startSizeObserver() {
            this.#stopSizeObserver();

            if (
                typeof ResizeObserver ===
                    "function"
            ) {
                this.#sizeObserver =
                    new ResizeObserver(
                        () => {
                            this.#scheduleResponsiveMetrics();
                            this.#scheduleIndicatorSymbolUpdate();

                            this.#refreshTimeRangeVisualGeometry();
                        }
                    );

                this.#sizeObserver.observe(
                    this
                );
            }

            this.#scheduleResponsiveMetrics();
        }

        #stopSizeObserver() {
            this.#sizeObserver
                ?.disconnect();

            this.#sizeObserver =
                undefined;

            if (
                this.#responsiveMetricsFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#responsiveMetricsFrame
                );

                this.#responsiveMetricsFrame =
                    undefined;
            }
        }

        #scheduleResponsiveMetrics() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            if (
                this.#responsiveMetricsFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#responsiveMetricsFrame
                );
            }

            this.#responsiveMetricsFrame =
                requestAnimationFrame(
                    () => {
                        this.#responsiveMetricsFrame =
                            undefined;

                        if (
                            !this.isConnected ||
                            this.#spinAnimation
                        ) {
                            return;
                        }

                        this.#updateResponsiveMetrics();
                    }
                );
        }

        #updateResponsiveMetrics() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            const diameter =
                this.#getEffectiveRenderDiameter();

            if (!Number.isFinite(diameter)) {
                return;
            }

            const scale =
                diameter /
                ClockTimer.#REFERENCE_DIAMETER;

            const metrics =
                ClockTimer.#BASE_METRICS;

            const scaled =
                value =>
                    Math.max(
                        0,
                        value * scale
                    );

            const setLength =
                (name, value) => {
                    this.style.setProperty(
                        name,
                        `${scaled(value)}px`
                    );
                };

            setLength(
                "--clock-timer-active-ring-width",
                metrics.activeRingWidth
            );

            setLength(
                "--clock-timer-inactive-ring-width",
                metrics.inactiveRingWidth
            );

            setLength(
                "--clock-timer-border-width",
                metrics.borderWidth
            );

            setLength(
                "--clock-timer-hour-font-size",
                metrics.hourFontSize
            );

            setLength(
                "--clock-timer-hour-hand-width",
                metrics.hourHandWidth
            );

            setLength(
                "--clock-timer-minute-hand-width",
                metrics.minuteHandWidth
            );

            setLength(
                "--clock-timer-second-hand-width",
                metrics.secondHandWidth
            );

            setLength(
                "--clock-timer-indicator-symbol-size",
                metrics.indicatorSymbolSize
            );

            setLength(
                "--clock-timer-tick-inset",
                metrics.tickInset
            );

            setLength(
                "--clock-timer-tick-width",
                metrics.tickWidth
            );

            setLength(
                "--clock-timer-tick-length",
                metrics.tickLength
            );

            setLength(
                "--clock-timer-major-tick-width",
                metrics.majorTickWidth
            );

            setLength(
                "--clock-timer-major-tick-length",
                metrics.majorTickLength
            );

            setLength(
                "--clock-timer-number-inset",
                metrics.numberInset
            );

            const baseTimeSize =
                scaled(
                    metrics.timeFontSize
                );

            this.style.setProperty(
                "--clock-timer-time-font-size",
                `${baseTimeSize}px`
            );

            const text =
                this.#timeElement.textContent ??
                "";

            let fittedSize =
                baseTimeSize;

            if (text) {
                const computed =
                    getComputedStyle(
                        this.#timeElement
                    );

                const canvas =
                    document.createElement(
                        "canvas"
                    );

                const context =
                    canvas.getContext(
                        "2d"
                    );

                if (context) {
                    context.font =
                        computed.font;

                    const measuredWidth =
                        context.measureText(
                            text
                        ).width;

                    const targetWidth =
                        diameter * 0.66;

                    if (
                        Number.isFinite(measuredWidth) &&
                        measuredWidth > targetWidth &&
                        measuredWidth > 0
                    ) {
                        fittedSize =
                            Math.max(
                                1,
                                baseTimeSize *
                                    targetWidth /
                                    measuredWidth
                            );

                        this.style.setProperty(
                            "--clock-timer-time-font-size",
                            `${fittedSize}px`
                        );
                    }
                }
            }

            const dateVisible =
                this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.hidden =
                !dateVisible;

            if (dateVisible) {
                this.style.setProperty(
                    "--clock-timer-auto-date-font-size",
                    `${fittedSize * 0.38}px`
                );

                this.style.setProperty(
                    "--clock-timer-auto-date-offset",
                    `${fittedSize * 0.72}px`
                );
            }

            this.#syncHandGeometry();
            this.#syncTickMarkGeometry();
        }

        #captureRadialFittedTripGoalAnimation(
            now
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted" ||
                !this.#started
            ) {
                return;
            }

            const bounds =
                this.#getRadialFittedBounds(
                    now
                );

            if (!bounds) {
                return;
            }

            const timings =
                new Map();

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end < start
                ) {
                    continue;
                }

                timings.set(
                    range,
                    {
                        start,
                        end
                    }
                );
            }

            return {
                bounds: {
                    start:
                        bounds.start,
                    end:
                        bounds.end,
                    duration:
                        bounds.duration
                },
                timings
            };
        }

        #prepareRadialFittedTripGoalAnimation(
            snapshot,
            now
        ) {
            if (
                !snapshot ||
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return;
            }

            const targetBounds =
                this.#getRadialFittedBounds(
                    now
                );

            if (!targetBounds) {
                return;
            }

            const duration =
                this.#getRangeAnimationDuration();

            if (duration <= 0) {
                return;
            }



            const boundsChanged =
                snapshot.bounds.start !==
                    targetBounds.start ||
                snapshot.bounds.end !==
                    targetBounds.end;

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    !range.isConnected ||
                    range.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                const targetStart =
                    Number(
                        range.clockTimerStart
                    );

                const targetEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(targetStart) ||
                    !Number.isFinite(targetEnd) ||
                    targetEnd < targetStart
                ) {
                    continue;
                }

                const active =
                    this.#timeRangeTimingAnimations.get(
                        range
                    );

                if (active) {
                    if (boundsChanged) {
                        active.fromFittedBounds = {
                            ...snapshot.bounds
                        };

                        active.targetFittedBounds = {
                            start:
                                targetBounds.start,
                            end:
                                targetBounds.end,
                            duration:
                                targetBounds.duration
                        };

                        const targetLayout =
                            this.#calculateTimeRangeLayout(
                                range,
                                active.targetStart,
                                active.targetEnd,
                                active.originMilliseconds,
                                active.targetFittedBounds
                            );

                        if (targetLayout) {
                            active.targetLayout =
                                targetLayout;
                        }
                    }

                    continue;
                }

                const previous =
                    snapshot.timings.get(
                        range
                    );

                const timingChanged =
                    !previous ||
                    previous.start !==
                        targetStart ||
                    previous.end !==
                        targetEnd;

                if (
                    !boundsChanged &&
                    !timingChanged
                ) {
                    continue;
                }

                const fromStart =
                    previous?.start ??
                    targetStart;

                const fromEnd =
                    previous?.end ??
                    targetStart;

                const originMilliseconds =
                    targetBounds.start;

                const fromLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        fromStart,
                        fromEnd,
                        originMilliseconds,
                        snapshot.bounds
                    );

                const targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        targetStart,
                        targetEnd,
                        originMilliseconds,
                        targetBounds
                    );

                if (
                    !fromLayout ||
                    !targetLayout
                ) {
                    continue;
                }

                this.#suspendRangeRendering(range);

                this.#applyTimeRangeLayout(
                    range,
                    fromLayout
                );

                const state = {
                    fromStart,
                    fromEnd,
                    targetStart,
                    targetEnd,
                    originMilliseconds,
                    targetLayout,
                    fromFittedBounds: {
                        ...snapshot.bounds
                    },
                    targetFittedBounds: {
                        start:
                            targetBounds.start,
                        end:
                            targetBounds.end,
                        duration:
                            targetBounds.duration
                    },
                    pending:
                        undefined,
                    frame:
                        undefined,
                    startedAt:
                        undefined,
                    duration
                };

                this.#timeRangeTimingAnimations.set(
                    range,
                    state
                );

                state.frame =
                    requestAnimationFrame(
                        timestamp =>
                            this.#stepTimeRangeTimingAnimation(
                                range,
                                state,
                                timestamp
                            )
                    );
            }
        }

        #refreshMatchedTripGoal() {
            const previous =
                this.#matchedTripGoal;

            let next;

            if (
                this.#autoSyncTripGoal &&
                this.#started &&
                this.#hasStartProperties()
            ) {
                const requirements =
                    this.#calculateTotalGoalRequirements({
                        allowMissed: true
                    });

                if (
                    Number.isFinite(requirements.tripGoal) &&
                    requirements.tripGoal > 0
                ) {
                    next =
                        requirements.tripGoal;
                }
            }

            this.#matchedTripGoal =
                next;

            const changed =
                previous !== next;

            return changed;
        }

        #handleTripGoalChange(
            source =
                this.#renderedPercentGoalSourceOverride ??
                "automatic",
            {
                refreshMatchedGoal = true
            } = {}
        ) {

            if (refreshMatchedGoal) {
                this.#refreshMatchedTripGoal();
            }

            const goal =
                this.#calculateRenderedPercentGoal();

            const previousGoal =
                this.#renderedPercentGoal;

            const tripGoalAnimation =
                this.#captureRadialFittedTripGoalAnimation(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

            const counterclockwiseOvertimeRemoval =
                previousGoal < 1 &&
                goal >= 1;

            const renderedGoalChanged =
                this.#setRenderedPercentGoal(
                    goal,
                    source,
                    {
                        emit: false
                    }
                );

            if (
                !this.#started
            ) {
                this.#totalGoalNotPossibleState =
                    false;

                if (renderedGoalChanged) {
                    this.#emitRenderedPercentGoalChange(
                        previousGoal,
                        this.#renderedPercentGoal,
                        source
                    );
                }

                return;
            }

            const now =
                this.#getCurrentTimelineTime();

            this.#updateTotalGoalNotPossibleState(
                source,
                now
            );

            if (renderedGoalChanged) {
                this.#emitRenderedPercentGoalChange(
                    previousGoal,
                    this.#renderedPercentGoal,
                    source
                );
            }

            const stateChangeVisual =
                renderedGoalChanged
                    ? this.#beginStateChangeVisuals()
                    : undefined;

            this.#reconcilePlannedRanges({
                counterclockwiseOvertimeRemoval
            });

            this.#reapplyIntervalScheduleShifts();

            this.#removeOvertimeRanges();

            this.#updateElapsedRange(
                now
            );

            this.#updateOvertimeRanges(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#reapplyOverwriteRanges();

            this.#prepareRadialFittedTripGoalAnimation(
                tripGoalAnimation,
                now
            );

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks: true
                }
            );

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                this.#getStateChangeAnimationDuration()
            );

            this.#checkGoalMisses(now);
        }

        #getRangeAnimationDuration() {
            const raw =
                getComputedStyle(
                    this
                ).getPropertyValue(
                    "--clock-timer-ring-resize-duration"
                ).trim();

            return (
                TemporalFormat.cssTimeToMilliseconds(
                    raw
                ) ?? 333
            );
        }

        #timeRangeTimelineDate(
            milliseconds
        ) {
            const base =
                new Date(
                    2000,
                    0,
                    1,
                    0,
                    0,
                    0,
                    0
                );

            return new Date(
                base.getTime() +
                milliseconds
            );
        }

        #getRadialFittedBounds(
            now
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return undefined;
            }

            let start;
            let end;

            const ignoredTypes =
                new Set([
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.timeRangeExiting === true ||
                    ignoredTypes.has(
                        range.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(rangeStart) &&
                    (
                        !Number.isFinite(start) ||
                        rangeStart < start
                    )
                ) {
                    start =
                        rangeStart;
                }

                if (
                    Number.isFinite(rangeEnd) &&
                    (
                        !Number.isFinite(end) ||
                        rangeEnd > end
                    )
                ) {
                    end =
                        rangeEnd;
                }
            }

            if (!Number.isFinite(start)) {
                if (
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                ) {
                    start =
                        this.#scheduledStartMilliseconds;
                }
                else if (
                    Number.isFinite(
                        this.#ringAnchor
                    )
                ) {
                    start =
                        this.#ringAnchor;
                }
            }

            const liveToleranceUsesVisibleEnd =
                this.#renderedPercentGoal > 1 &&
                this.#started;

            if (
                !liveToleranceUsesVisibleEnd &&
                Number.isFinite(
                    this.#calculatedEndTime
                )
            ) {
                end =
                    Number.isFinite(end)
                        ? Math.max(
                            end,
                            this.#calculatedEndTime
                        )
                        : this.#calculatedEndTime;
            }

            const current =
                Number.isFinite(now)
                    ? now
                    : (
                        this.#started
                            ? this.#getCurrentTimelineTime()
                            : undefined
                    );

            const currentThreshold =
                !liveToleranceUsesVisibleEnd &&
                Number.isFinite(
                    this.#calculatedEndTime
                )
                    ? this.#calculatedEndTime
                    : end;

            if (
                Number.isFinite(current) &&
                Number.isFinite(currentThreshold) &&
                current >= currentThreshold
            ) {
                end =
                    Number.isFinite(end)
                        ? Math.max(
                            end,
                            current
                        )
                        : current;
            }

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return undefined;
            }

            return {
                start,
                end,
                duration:
                    end - start
            };
        }

        #refreshRadialFittedLayouts(
            now,
            {
                suspendLayout = true
            } = {}
        ) {
            if (
                this.#getTimerType() !==
                    "radial-fitted"
            ) {
                return;
            }

            const bounds =
                this.#getRadialFittedBounds(
                    now
                );

            if (!bounds) {
                return;
            }

            const ranges =
                this.#getTimerRanges()
                    .filter(
                        range =>
                            range.isConnected &&
                            range.timeRangeExiting !==
                                true
                    );

            if (
                this.#waveRange?.isConnected &&
                !ranges.includes(
                    this.#waveRange
                )
            ) {
                ranges.push(
                    this.#waveRange
                );
            }

            const suspended = [];

            try {
                for (
                    const range of
                        ranges
                ) {
                    const start =
                        Number(
                            range.clockTimerStart
                        );

                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    if (
                        !Number.isFinite(
                            start
                        ) ||
                        !Number.isFinite(
                            end
                        ) ||
                        end <= start
                    ) {
                        continue;
                    }

                    if (
                        this.#timeRangeTimingAnimations
                            .has(
                                range
                            )
                    ) {
                        continue;
                    }

                    if (suspendLayout) {
                        this.#suspendRangeRendering(
                            range
                        );

                        suspended.push(
                            range
                        );
                    }

                    const layout =
                        this.#calculateTimeRangeLayout(
                            range,
                            start,
                            end,
                            bounds.start,
                            bounds
                        );

                    if (layout) {
                        this.#applyTimeRangeLayout(
                            range,
                            layout,
                            true
                        );
                    }
                }
            }
            finally {
                for (
                    const range of
                        suspended
                ) {
                    this.#resumeRangeRendering(
                        range
                    );
                }
            }
        }

        #getTimeRangeOriginMilliseconds(
            range,
            fallbackStart
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds();

                if (bounds) {
                    return bounds.start;
                }
            }

            let earliest =
                Number.isFinite(
                    fallbackStart
                )
                    ? fallbackStart
                    : undefined;

            const parent =
                range?.parentElement;

            if (parent) {
                for (
                    const child of
                        parent.children
                ) {
                    if (
                        child.localName !==
                            "time-range" ||
                        child.timeRangeExiting ===
                            true
                    ) {
                        continue;
                    }

                    const start =
                        child === range &&
                        Number.isFinite(
                            fallbackStart
                        )
                            ? fallbackStart
                            : Number(
                                child.clockTimerStart
                            );

                    if (
                        Number.isFinite(start) &&
                        (
                            !Number.isFinite(earliest) ||
                            start < earliest
                        )
                    ) {
                        earliest =
                            start;
                    }
                }
            }

            if (!Number.isFinite(earliest)) {
                return 0;
            }

            return (
                Math.floor(
                    earliest /
                    ClockTimer.#HOUR
                ) *
                ClockTimer.#HOUR
            );
        }

        #getRangeRenderer(
            range
        ) {
            const renderer =
                range?.parentElement;

            return (
                renderer?.localName ===
                    "ring-container"
            )
                ? renderer
                : undefined;
        }

        #suspendRangeRendering(
            range
        ) {
            if (!range) {
                return;
            }

            const renderer =
                this.#getRangeRenderer(
                    range
                );

            if (
                typeof renderer
                    ?.suspendRangeRendering ===
                    "function"
            ) {
                renderer
                    .suspendRangeRendering(
                        range
                    );

                return;
            }

            range.clockTimerRangeRenderingSuspended =
                true;
        }

        #resumeRangeRendering(
            range
        ) {
            if (!range) {
                return;
            }

            const renderer =
                this.#getRangeRenderer(
                    range
                );

            if (
                typeof renderer
                    ?.resumeRangeRendering ===
                    "function"
            ) {
                renderer
                    .resumeRangeRendering(
                        range
                    );

                return;
            }

            delete range
                .clockTimerRangeRenderingSuspended;
        }

        #refreshRangeGeometry(
            range
        ) {
            return (
                this.#getRangeRenderer(
                    range
                )
                    ?.refreshRangeGeometry?.(
                        range
                    ) ??
                false
            );
        }

        #snapRangeGeometry(
            range
        ) {
            return (
                this.#getRangeRenderer(
                    range
                )
                    ?.snapRangeGeometry?.(
                        range
                    ) ??
                false
            );
        }

        #animateRangeFromCollapsed(
            range,
            value
        ) {
            return (
                this.#getRangeRenderer(
                    range
                )
                    ?.animateRangeFromCollapsed?.(
                        range,
                        value
                    ) ??
                false
            );
        }

        #removeRangeAnimated(
            range,
            options
        ) {
            const renderer =
                this.#getRangeRenderer(
                    range
                );

            if (
                typeof renderer
                    ?.removeRangeAnimated ===
                    "function"
            ) {
                return renderer
                    .removeRangeAnimated(
                        range,
                        options
                    );
            }

            range?.remove?.();

            return false;
        }

        #pauseRangeAnimation(
            range
        ) {
            this.#getRangeRenderer(
                range
            )
                ?.pauseRangeAnimation?.(
                    range
                );
        }

        #calculateTimeRangeLayout(
            range,
            start,
            end,
            originMilliseconds,
            fittedBounds
        ) {
            const renderer =
                this.#getRangeRenderer(
                    range
                );

            if (
                !renderer ||
                typeof renderer
                    .calculateRangeLayout !==
                    "function" ||
                !Number.isFinite(
                    start
                ) ||
                !Number.isFinite(
                    end
                ) ||
                end < start
            ) {
                return;
            }

            const bounds =
                this.#getTimerType() ===
                    "radial-fitted"
                    ? (
                        fittedBounds ??
                        this.#getRadialFittedBounds()
                    )
                    : undefined;

            return renderer
                .calculateRangeLayout(
                    range,
                    {
                        start,
                        end,
                        originMilliseconds,
                        fittedBounds:
                            bounds
                    }
                );
        }

        #applyTimeRangeLayout(
            range,
            layout,
            commit = false
        ) {
            const renderer =
                this.#getRangeRenderer(
                    range
                );

            if (
                !renderer ||
                typeof renderer
                    .applyRangeLayout !==
                    "function" ||
                !layout
            ) {
                return false;
            }

            return (
                renderer
                    .applyRangeLayout(
                        range,
                        layout,
                        {
                            commit
                        }
                    ) !== false
            );
        }

        #writeRangeTiming(
            range,
            start,
            end,
            preserveRangeLength = false
        ) {
            const startTime =
                this.#formatTimelineTime(
                    start
                );

            const endTime =
                this.#formatTimelineTime(
                    end
                );

            if (
                typeof range.transitionTo ===
                    "function"
            ) {
                range.transitionTo({
                    startTime,
                    endTime
                });
            }
            else {
                range.setAttribute(
                    "start-time",
                    startTime
                );

                range.setAttribute(
                    "end-time",
                    endTime
                );
            }

            if (preserveRangeLength) {
                range.setAttribute(
                    "range-length",
                    this.#formatStandardTime(
                        end - start
                    )
                );
            }
            else {
                range.removeAttribute(
                    "range-length"
                );
            }

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);
        }

        #finishTimeRangeTimingAnimation(
            range,
            state
        ) {

            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        state.targetStart,
                        state.targetEnd,
                        state.originMilliseconds
                    );

                if (targetLayout) {
                    state.targetLayout =
                        targetLayout;
                }
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout
            );

            const pending =
                state.pending;

            if (
                pending &&
                (
                    pending.start !==
                        state.targetStart ||
                    pending.end !==
                        state.targetEnd
                ) &&
                range.isConnected
            ) {
                state.pending =
                    undefined;

                state.fromStart =
                    state.targetStart;

                state.fromEnd =
                    state.targetEnd;

                if (
                    state.targetFittedBounds
                ) {
                    state.fromFittedBounds = {
                        ...state.targetFittedBounds
                    };
                }

                state.targetStart =
                    pending.start;

                state.targetEnd =
                    pending.end;

                state.originMilliseconds =
                    this.#getTimeRangeOriginMilliseconds(
                        range,
                        pending.start
                    );

                state.targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        pending.start,
                        pending.end,
                        state.originMilliseconds
                    );

                if (!state.targetLayout) {
                    this.#timeRangeTimingAnimations.delete(
                        range
                    );

                    this.#resumeRangeRendering(range);

                    this.#refreshRangeGeometry(range);
                    return;
                }

                state.startedAt =
                    undefined;

                state.duration =
                    this.#getRangeAnimationDuration();

                state.frame =
                    requestAnimationFrame(
                        timestamp =>
                            this.#stepTimeRangeTimingAnimation(
                                range,
                                state,
                                timestamp
                            )
                    );

                return;
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout,
                true
            );

            this.#timeRangeTimingAnimations.delete(
                range
            );

            this.#resumeRangeRendering(range);
        }

        #stepTimeRangeTimingAnimation(
            range,
            state,
            timestamp
        ) {
            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            if (!range.isConnected) {
                this.#timeRangeTimingAnimations.delete(
                    range
                );

                this.#resumeRangeRendering(range);

                return;
            }

            if (
                state.startedAt ===
                    undefined
            ) {
                state.startedAt =
                    timestamp;
            }

            const duration =
                Math.max(
                    0,
                    state.duration
                );

            const progress =
                duration <= 0
                    ? 1
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.startedAt
                            ) /
                            duration
                        )
                    );

            const currentStart =
                state.fromStart +
                (
                    state.targetStart -
                    state.fromStart
                ) *
                progress;

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            let fittedBounds;

            if (
                state.fromFittedBounds &&
                state.targetFittedBounds
            ) {
                const start =
                    state.fromFittedBounds.start +
                    (
                        state.targetFittedBounds.start -
                        state.fromFittedBounds.start
                    ) *
                    progress;

                const end =
                    state.fromFittedBounds.end +
                    (
                        state.targetFittedBounds.end -
                        state.fromFittedBounds.end
                    ) *
                    progress;

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    end > start
                ) {
                    fittedBounds = {
                        start,
                        end,
                        duration:
                            end - start
                    };
                }
            }

            const currentLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    currentStart,
                    currentEnd,
                    state.originMilliseconds,
                    fittedBounds
                );

            if (currentLayout) {
                this.#applyTimeRangeLayout(
                    range,
                    currentLayout
                );
            }

            if (progress >= 1) {
                state.frame =
                    undefined;

                this.#finishTimeRangeTimingAnimation(
                    range,
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepTimeRangeTimingAnimation(
                            range,
                            state,
                            nextTimestamp
                        )
                );
        }

        #releaseTimeRangeTimingAnimation(
            range
        ) {
            const state =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (!state) {
                return false;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            this.#timeRangeTimingAnimations.delete(
                range
            );

            this.#resumeRangeRendering(range);

            return true;
        }

        #cancelTimeRangeTimingAnimations() {

            for (
                const [range, state] of
                    this.#timeRangeTimingAnimations
            ) {
                if (
                    state.frame !==
                        undefined
                ) {
                    cancelAnimationFrame(
                        state.frame
                    );
                }

                this.#resumeRangeRendering(range);
            }

            this.#timeRangeTimingAnimations.clear();
        }

        #getToleranceRanges() {
            return this.#getManagedTimeRanges()
                .filter(
                    range =>
                        range.clockTimerPlanned !==
                            undefined &&
                        range.timeRangeExiting !==
                            true &&
                        range.getAttribute(
                            "type"
                        ) === "tolerance"
                );
        }

        #getCurrentTripRenderEnd() {
            let end;

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerPlanned !==
                                    undefined &&
                                range.timeRangeExiting !==
                                    true &&
                                range.getAttribute(
                                    "type"
                                ) === "trip"
                        )
            ) {
                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(rangeEnd) &&
                    (
                        !Number.isFinite(end) ||
                        rangeEnd > end
                    )
                ) {
                    end =
                        rangeEnd;
                }
            }

            return end;
        }

        #getCurrentToleranceRenderEnd() {
            let end;

            for (
                const range of
                    this.#getToleranceRanges()
            ) {
                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(rangeEnd) &&
                    (
                        !Number.isFinite(end) ||
                        rangeEnd > end
                    )
                ) {
                    end =
                        rangeEnd;
                }
            }

            return end;
        }

        #getToleranceTransitionSegments(
            tripEnd,
            toleranceEnd
        ) {
            const segments = [];

            if (
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                ) ||
                !Number.isFinite(tripEnd) ||
                tripEnd <= this.#scheduledStartMilliseconds
            ) {
                return segments;
            }

            const spans = [
                {
                    type: "trip",
                    start:
                        this.#scheduledStartMilliseconds,
                    end: tripEnd
                }
            ];

            if (
                Number.isFinite(toleranceEnd) &&
                toleranceEnd > tripEnd
            ) {
                spans.push({
                    type: "tolerance",
                    start: tripEnd,
                    end: toleranceEnd
                });
            }

            for (const span of spans) {
                let cursor =
                    span.start;

                while (cursor < span.end) {
                    const ringIndex =
                        this.#getTimerRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getTimerRingEnd(
                            ringIndex
                        );

                    const segmentEnd =
                        Math.min(
                            span.end,
                            ringEnd
                        );

                    if (
                        !Number.isFinite(segmentEnd) ||
                        segmentEnd <= cursor
                    ) {
                        break;
                    }

                    segments.push({
                        type: span.type,
                        ringIndex,
                        start: cursor,
                        end: segmentEnd
                    });

                    cursor =
                        segmentEnd;
                }
            }

            return segments;
        }

        #ringHasNonToleranceContent(
            ring
        ) {
            const removableTypes =
                new Set([
                    "tolerance",
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (const child of ring.children) {
                if (
                    child.localName !==
                        "time-range"
                ) {
                    return true;
                }

                if (
                    child.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                if (
                    removableTypes.has(
                        child.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                return true;
            }

            return false;
        }

        #removeToleranceTransitionRing(
            ring
        ) {
            if (!ring) {
                return false;
            }

            const ringIndex =
                Number(
                    ring.clockTimerRingIndex
                );

            for (
                const range of
                    Array.from(
                        ring.querySelectorAll(
                            ":scope > time-range"
                        )
                    )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                if (
                    this.#elapsedRange ===
                        range
                ) {
                    this.#elapsedRange =
                        undefined;
                }

                if (
                    this.#waveRange ===
                        range
                ) {
                    this.#waveRange =
                        undefined;
                }
            }

            for (
                const [
                    remainingIndex,
                    range
                ] of
                    this.#remainingRanges
            ) {
                if (
                    range.parentElement ===
                        ring ||
                    (
                        Number.isFinite(ringIndex) &&
                        remainingIndex ===
                            ringIndex
                    )
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#remainingRanges.delete(
                        remainingIndex
                    );
                }
            }

            if (
                this.#waveRing ===
                    ring
            ) {
                this.#waveRing =
                    undefined;

                this.#waveRange =
                    undefined;
            }

            ring.remove();

            if (
                Number.isFinite(ringIndex) &&
                this.#rings.get(
                    ringIndex
                ) === ring
            ) {
                this.#rings.delete(
                    ringIndex
                );
            }

            return true;
        }

        #getToleranceFadeOutRings(
            targetEnd
        ) {
            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
                        targetEnd
                    ).map(
                        segment =>
                            segment.ringIndex
                    )
                );

            const rings = [];

            for (
                const [ringIndex, ring] of
                    this.#rings
            ) {
                if (
                    finalRingIndexes.has(
                        ringIndex
                    ) ||
                    this.#ringHasNonToleranceContent(
                        ring
                    )
                ) {
                    continue;
                }

                const hasTolerance =
                    Array.from(
                        ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.clockTimerPlanned !==
                                undefined &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    );

                if (hasTolerance) {
                    rings.push(
                        ring
                    );
                }
            }

            return rings;
        }

        #startToleranceRingFade(
            state,
            ring,
            direction
        ) {
            if (
                !state ||
                !ring ||
                state.ringFades.has(
                    ring
                )
            ) {
                return;
            }

            ring.clockTimerToleranceTransitionHold =
                true;

            const targetOpacity =
                getComputedStyle(
                    ring
                ).opacity || "1";

            const fromOpacity =
                direction === "in"
                    ? "0"
                    : targetOpacity;

            const toOpacity =
                direction === "in"
                    ? targetOpacity
                    : "0";

            const fade = {
                ring,
                direction,
                animation: undefined,
                finished: false
            };

            state.ringFades.set(
                ring,
                fade
            );

            if (
                typeof ring.animate !==
                    "function"
            ) {
                fade.finished =
                    true;

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            const animation =
                ring.animate(
                    [
                        {
                            opacity:
                                fromOpacity
                        },
                        {
                            opacity:
                                toOpacity
                        }
                    ],
                    {
                        duration: 750,
                        easing: "linear",
                        fill: "both"
                    }
                );

            fade.animation =
                animation;

            animation.finished
                .then(
                    () => {
                        fade.finished =
                            true;

                        this.#maybeFinishToleranceTransition(
                            state
                        );
                    }
                )
                .catch(() => {});
        }

        #suspendToleranceTransitionRange(
            state,
            range
        ) {
            if (
                state.suspendedRanges.has(
                    range
                )
            ) {
                return;
            }

            this.#releaseTimeRangeTimingAnimation(
                range
            );

            this.#suspendRangeRendering(range);

            state.suspendedRanges.add(
                range
            );
        }

        #writeToleranceTransitionTiming(
            state,
            range,
            start,
            end
        ) {
            this.#suspendToleranceTransitionRange(
                state,
                range
            );

            const startTime =
                this.#formatTimelineTime(
                    start
                );

            const endTime =
                this.#formatTimelineTime(
                    end
                );

            if (
                range.getAttribute(
                    "start-time"
                ) !== startTime
            ) {
                range.setAttribute(
                    "start-time",
                    startTime
                );
            }

            if (
                range.getAttribute(
                    "end-time"
                ) !== endTime
            ) {
                range.setAttribute(
                    "end-time",
                    endTime
                );
            }

            range.removeAttribute(
                "range-length"
            );

            range.clockTimerStart =
                String(start);

            range.clockTimerEnd =
                String(end);
        }

        #syncToleranceTransitionRanges(
            state,
            tripEnd,
            toleranceEnd
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            state.currentTripEnd =
                tripEnd;

            state.currentEnd =
                toleranceEnd;

            const desired =
                this.#getToleranceTransitionSegments(
                    tripEnd,
                    toleranceEnd
                );

            const existing =
                new Map();

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerPlanned !==
                                    undefined &&
                                candidate.timeRangeExiting !==
                                    true &&
                                (
                                    candidate.getAttribute(
                                        "type"
                                    ) === "trip" ||
                                    candidate.getAttribute(
                                        "type"
                                    ) === "tolerance"
                                )
                        )
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (!Number.isFinite(ringIndex)) {
                    continue;
                }

                const key =
                    `${range.getAttribute("type")}:${ringIndex}`;

                if (!existing.has(key)) {
                    existing.set(
                        key,
                        range
                    );
                }
            }

            let layoutChanged =
                false;

            for (const target of desired) {
                let ring =
                    this.#rings.get(
                        target.ringIndex
                    );

                if (!ring) {
                    ring =
                        this.#ensureRing(
                            target.ringIndex
                        );

                    layoutChanged =
                        true;

                    this.#startToleranceRingFade(
                        state,
                        ring,
                        "in"
                    );
                }

                const key =
                    `${target.type}:${target.ringIndex}`;

                let range =
                    existing.get(
                        key
                    );

                if (range) {
                    existing.delete(
                        key
                    );
                }
                else {
                    range =
                        this.#createTimeRange(
                            target.type,
                            target.start,
                            target.end
                        );

                    range.timeRangeFullEntry =
                        true;

                    ring.appendChild(
                        range
                    );
                }

                this.#writeToleranceTransitionTiming(
                    state,
                    range,
                    target.start,
                    target.end
                );

                if (
                    this.#getTimerType() !==
                        "radial-fitted"
                ) {
                    const layout =
                        this.#calculateTimeRangeLayout(
                            range,
                            target.start,
                            target.end
                        );

                    if (layout) {
                        this.#applyTimeRangeLayout(
                            range,
                            layout,
                            true
                        );
                    }
                    else {
                        this.#snapRangeGeometry(range);
                    }
                }
            }

            for (const range of existing.values()) {
                state.suspendedRanges.delete(
                    range
                );

                this.#resumeRangeRendering(range);

                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            const visualEnd =
                Math.max(
                    tripEnd,
                    toleranceEnd
                );

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    visualEnd,
                    {
                        suspendLayout: false
                    }
                );
            }

            if (layoutChanged) {
                this.#refreshRingLayout(
                    visualEnd
                );
            }
        }

        #maybeFinishToleranceTransition(
            state
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state ||
                !state.endpointFinished
            ) {
                return;
            }

            for (const fade of state.ringFades.values()) {
                if (!fade.finished) {
                    return;
                }
            }

            this.#finishToleranceTransition(
                state
            );
        }

        #finishToleranceTransition(
            state
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );

                state.frame =
                    undefined;
            }

            this.#syncToleranceTransitionRanges(
                state,
                state.targetTripEnd,
                state.targetEnd
            );

            for (
                const range of
                    state.suspendedRanges
            ) {
                this.#resumeRangeRendering(range);
            }

            state.suspendedRanges.clear();

            for (const fade of state.ringFades.values()) {
                fade.animation?.cancel();

                delete fade.ring
                    .clockTimerToleranceTransitionHold;

                if (
                    fade.direction === "out" &&
                    !this.#ringHasNonToleranceContent(
                        fade.ring
                    ) &&
                    !Array.from(
                        fade.ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    )
                ) {
                    this.#removeToleranceTransitionRing(
                        fade.ring
                    );
                }
            }

            state.ringFades.clear();

            this.#toleranceTransitionState =
                undefined;

            this.#reconcilePlannedRanges();

            this.#removeEmptyRings();

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined,
                {
                    refreshTickMarks: true
                }
            );
        }

        #cancelToleranceTransition() {
            const state =
                this.#toleranceTransitionState;

            if (!state) {
                return;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            for (
                const range of
                    state.suspendedRanges
            ) {
                this.#resumeRangeRendering(range);
            }

            for (const fade of state.ringFades.values()) {
                fade.animation?.cancel();

                delete fade.ring
                    .clockTimerToleranceTransitionHold;
            }

            if (
                state.stateChangeVisual ===
                    this.#stateChangeVisualState
            ) {
                this.#cancelStateChangeVisuals(
                    false
                );
            }

            this.#toleranceTransitionState =
                undefined;
        }

        #stepToleranceTransition(
            state,
            timestamp
        ) {
            if (
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            if (
                !this.isConnected ||
                !this.#started
            ) {
                this.#cancelToleranceTransition();
                return;
            }

            if (
                state.startedAt ===
                    undefined
            ) {
                state.startedAt =
                    timestamp;
            }

            const progress =
                state.duration <= 0
                    ? 1
                    : Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.startedAt
                            ) /
                            state.duration
                        )
                    );

            const currentTripEnd =
                state.fromTripEnd +
                (
                    state.targetTripEnd -
                    state.fromTripEnd
                ) *
                progress;

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            this.#syncToleranceTransitionRanges(
                state,
                currentTripEnd,
                currentEnd
            );

            if (progress >= 1) {
                state.frame =
                    undefined;

                state.endpointFinished =
                    true;

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    nextTimestamp =>
                        this.#stepToleranceTransition(
                            state,
                            nextTimestamp
                        )
                );
        }

        #transitionShowTolerance() {
            this.#cancelToleranceTransition();

            const now =
                this.#getCurrentTimelineTime();

            if (
                !Number.isFinite(now) ||
                !Number.isFinite(
                    this.#calculatedEnd
                ) ||
                !Number.isFinite(
                    this.#standardEnd
                )
            ) {
                this.#reconcilePlannedRanges();
                return;
            }

            const clampToTolerance =
                value =>
                    Math.max(
                        this.#calculatedEnd,
                        Math.min(
                            this.#standardEnd,
                            value
                        )
                    );

            const renderedTripEnd =
                this.#getCurrentTripRenderEnd();

            const fromTripEnd =
                clampToTolerance(
                    Number.isFinite(renderedTripEnd)
                        ? renderedTripEnd
                        : (
                            this.#showTolerance === false
                                ? this.#standardEnd
                                : this.#calculatedEnd
                        )
                );

            const renderedToleranceEnd =
                this.#getCurrentToleranceRenderEnd();

            const fromEnd =
                Math.max(
                    fromTripEnd,
                    Number.isFinite(renderedToleranceEnd)
                        ? clampToTolerance(
                            renderedToleranceEnd
                        )
                        : fromTripEnd
                );

            const targetTripEnd =
                this.#showTolerance === false
                    ? this.#standardEnd
                    : this.#calculatedEnd;

            const targetEnd =
                this.#showTolerance === true
                    ? this.#standardEnd
                    : this.#showTolerance === false
                        ? this.#standardEnd
                        : clampToTolerance(
                            now
                        );

            if (
                fromTripEnd === targetTripEnd &&
                fromEnd === targetEnd
            ) {
                this.#reconcilePlannedRanges();

                this.#refreshRingLayout(
                    now,
                    { refreshTickMarks: true }
                );

                return;
            }

            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
                        targetTripEnd,
                        targetEnd
                    ).map(
                        segment =>
                            segment.ringIndex
                    )
                );

            const ringWillAppear =
                Array.from(
                    finalRingIndexes
                ).some(
                    ringIndex =>
                        !this.#rings.has(
                            ringIndex
                        )
                );

            const state = {
                fromTripEnd,
                targetTripEnd,
                fromEnd,
                targetEnd,
                currentTripEnd: fromTripEnd,
                currentEnd: fromEnd,
                duration:
                    ringWillAppear
                        ? 750
                        : this.#getRangeAnimationDuration(),
                startedAt: undefined,
                frame: undefined,
                endpointFinished: false,
                suspendedRanges:
                    new Set(),
                ringFades:
                    new Map()
            };

            state.stateChangeVisual =
                stateChangeVisual;

            this.#toleranceTransitionState =
                state;

            this.#syncToleranceTransitionRanges(
                state,
                fromTripEnd,
                fromEnd
            );

            this.#activateStateChangeVisuals(
                stateChangeVisual
            );

            this.#setStateChangeVisualDuration(
                stateChangeVisual,
                state.duration
            );

            if (state.duration <= 0) {
                state.endpointFinished =
                    true;

                this.#syncToleranceTransitionRanges(
                    state,
                    targetTripEnd,
                    targetEnd
                );

                this.#maybeFinishToleranceTransition(
                    state
                );

                return;
            }

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepToleranceTransition(
                            state,
                            timestamp
                        )
                );
        }

        #getToleranceRenderEnd(
            now = undefined
        ) {
            if (
                this.#renderedPercentGoal <= 1
            ) {
                return undefined;
            }

            const transitionEnd =
                this.#toleranceTransitionState
                    ?.currentEnd;

            const transitionTripEnd =
                this.#toleranceTransitionState
                    ?.currentTripEnd;

            if (
                Number.isFinite(transitionEnd) &&
                Number.isFinite(transitionTripEnd)
            ) {
                return transitionEnd >
                    transitionTripEnd
                    ? transitionEnd
                    : undefined;
            }

            if (!this.#started) {
                return this.#showTolerance === true
                    ? this.#standardEnd
                    : undefined;
            }

            if (this.#showTolerance === true) {
                return this.#standardEnd;
            }

            if (this.#showTolerance === false) {
                return undefined;
            }

            const current =
                Number.isFinite(now)
                    ? now
                    : this.#getCurrentTimelineTime();

            if (
                !Number.isFinite(current) ||
                current <= this.#calculatedEnd
            ) {
                return undefined;
            }

            return Math.min(
                current,
                this.#standardEnd
            );
        }

        #getPlannedSegments(
            startTimeMilliseconds =
                this.#getStartTimeMilliseconds()
        ) {
            const spans = [];

            if (
                startTimeMilliseconds !==
                    undefined &&
                this.#scheduledStartMilliseconds >
                    startTimeMilliseconds
            ) {
                spans.push({
                    type: "earlystart",
                    start: startTimeMilliseconds,
                    end: this.#scheduledStartMilliseconds
                });
            }

            if (
                startTimeMilliseconds !==
                    undefined &&
                startTimeMilliseconds >
                    this.#scheduledStartMilliseconds
            ) {
                spans.push({
                    type: "latency",
                    start: this.#scheduledStartMilliseconds,
                    end: startTimeMilliseconds
                });
            }

            const tripStart =
                this.#scheduledStartMilliseconds;

            this.#standardEnd =
                tripStart +
                this.#standardDuration;

            this.#calculatedEnd =
                tripStart +
                Math.round(
                    this.#standardDuration /
                    this.#renderedPercentGoal
                );

            if (this.#renderedPercentGoal > 1) {
                const transitionTripEnd =
                    this.#toleranceTransitionState
                        ?.currentTripEnd;

                const tripRenderEnd =
                    Number.isFinite(
                        transitionTripEnd
                    )
                        ? Math.max(
                            this.#calculatedEnd,
                            Math.min(
                                this.#standardEnd,
                                transitionTripEnd
                            )
                        )
                        : this.#showTolerance === false
                            ? this.#standardEnd
                            : this.#calculatedEnd;

                this.#tripEnd =
                    tripRenderEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                spans.push({
                    type: "trip",
                    start: tripStart,
                    end: tripRenderEnd
                });

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        tripRenderEnd
                ) {
                    spans.push({
                        type: "tolerance",
                        start: tripRenderEnd,
                        end: toleranceRenderEnd
                    });
                }
            }
            else {
                this.#tripEnd =
                    this.#standardEnd;

                this.#toleranceEnd =
                    undefined;

                spans.push({
                    type: "trip",
                    start: tripStart,
                    end: this.#standardEnd
                });

                if (this.#renderedPercentGoal < 1) {
                    spans.push({
                        type: "overtime",
                        start: this.#standardEnd,
                        end: this.#calculatedEnd
                    });
                }
            }

            const segments = [];

            for (const span of spans) {
                let cursor =
                    span.start;

                while (cursor < span.end) {
                    const ringIndex =
                        this.#getTimerRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getTimerRingEnd(ringIndex);

                    const segmentEnd =
                        Math.min(
                            span.end,
                            ringEnd
                        );

                    segments.push({
                        type: span.type,
                        start: cursor,
                        end: segmentEnd,
                        ringIndex
                    });

                    cursor =
                        segmentEnd;
                }
            }

            return segments;
        }

        #reconcilePlannedRanges({
            counterclockwiseOvertimeRemoval = false,
            startTimeMilliseconds
        } = {}) {
            const desired =
                this.#getPlannedSegments(
                    startTimeMilliseconds
                );

            const existing =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerPlanned !==
                                undefined &&
                            range.timeRangeExiting !==
                                true
                    );

            const unused =
                new Set(existing);

            for (const target of desired) {
                let match;
                let bestScore =
                    -Infinity;

                for (const candidate of unused) {
                    if (
                        candidate.getAttribute(
                            "type"
                        ) !== target.type
                    ) {
                        continue;
                    }

                    const candidateRing =
                        Number(
                            candidate.parentElement
                                ?.clockTimerRingIndex
                        );

                    if (
                        candidateRing !==
                            target.ringIndex
                    ) {
                        continue;
                    }

                    const oldStart =
                        Number(
                            candidate.clockTimerStart
                        );

                    const oldEnd =
                        Number(
                            candidate.clockTimerEnd
                        );

                    const overlap =
                        Number.isFinite(oldStart) &&
                        Number.isFinite(oldEnd)
                            ? Math.max(
                                0,
                                Math.min(oldEnd, target.end) -
                                Math.max(oldStart, target.start)
                            )
                            : 0;

                    const distance =
                        Number.isFinite(oldStart) &&
                        Number.isFinite(oldEnd)
                            ? Math.abs(oldStart - target.start) +
                                Math.abs(oldEnd - target.end)
                            : Number.MAX_SAFE_INTEGER;

                    const score =
                        overlap > 0
                            ? overlap
                            : -distance;

                    if (score > bestScore) {
                        bestScore = score;
                        match = candidate;
                    }
                }

                const ring =
                    this.#ensureRing(
                        target.ringIndex
                    );

                if (match) {
                    unused.delete(match);

                    this.#setRangeTiming(
                        match,
                        target.start,
                        target.end
                    );
                }
                else {
                    const range =
                        this.#createTimeRange(
                            target.type,
                            target.start,
                            target.end
                        );

                    this.#suspendRangeRendering(range);

                    try {
                        ring.appendChild(
                            range
                        );
                    }
                    finally {
                        this.#resumeRangeRendering(range);
                    }
                }
            }

            for (const range of unused) {
                if (
                    typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#removeRangeAnimated(range,{
                        collapseTo:
                            counterclockwiseOvertimeRemoval &&
                            range.getAttribute("type") ===
                                "overtime"
                                ? "start"
                                : "end"
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #snapTimerRangeAngles() {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined,
                    {
                        suspendLayout:
                            !this.#timerTypeTransitioning
                    }
                );

                return;
            }

            for (
                const range of
                    this.#getTimerRanges()
            ) {
                if (
                    typeof this.#getRangeRenderer(range)?.snapRangeGeometry === "function"
                ) {
                    this.#snapRangeGeometry(range);
                }
            }
        }

        #animateStartedRingWidths() {
            const duration =
                this.#getRangeAnimationDuration();

            const rings =
                this.#getTimerRings();

            if (rings.length === 0) {
                return;
            }

            requestAnimationFrame(
                () => {
                    for (const ring of rings) {
                        if (!ring.isConnected) {
                            continue;
                        }

                        ring.resizeDuration =
                            `${duration}ms`;

                        const targetWidth =
                            ring.clockTimerTargetWidth;

                        if (targetWidth) {
                            ring.setAttribute(
                                "width",
                                targetWidth
                            );

                            delete ring.clockTimerTargetWidth;
                        }
                    }
                }
            );
        }


        #getRangeMergeAttributes(range) {
            const ignored =
                new Set([
                    "type",
                    "start-time",
                    "end-time",
                    "range-length",
                    "slot"
                ]);

            return Array.from(
                range.attributes
            )
                .filter(
                    attribute =>
                        !ignored.has(
                            attribute.name.toLowerCase()
                        )
                )
                .map(
                    attribute => [
                        attribute.name,
                        attribute.value
                    ]
                )
                .sort(
                    (a, b) =>
                        a[0].localeCompare(b[0]) ||
                        a[1].localeCompare(b[1])
                );
        }

        #getRangeMergeClockTimerState(range) {
            return Object.keys(range)
                .filter(
                    key =>
                        key.startsWith(
                            "clockTimer"
                        ) &&
                        key !== "clockTimerStart" &&
                        key !== "clockTimerEnd"
                )
                .sort()
                .map(
                    key => [
                        key,
                        range[key]
                    ]
                );
        }

        #rangeMergeValuesMatch(
            left,
            right
        ) {
            if (left.length !== right.length) {
                return false;
            }

            return left.every(
                (entry, index) =>
                    entry[0] === right[index][0] &&
                    entry[1] === right[index][1]
            );
        }

        #rangesAreMergeIdentical(
            left,
            right
        ) {
            if (
                !left ||
                !right ||
                left === right ||
                left.localName !== "time-range" ||
                right.localName !== "time-range" ||
                left.parentElement !== right.parentElement ||
                left.parentElement?.localName !==
                    "ring-container" ||
                left.timeRangeExiting === true ||
                right.timeRangeExiting === true ||
                left.getAttribute("type") !==
                    right.getAttribute("type")
            ) {
                return false;
            }

            const leftEnd =
                Number(
                    left.clockTimerEnd
                );

            const rightStart =
                Number(
                    right.clockTimerStart
                );

            if (
                !Number.isFinite(leftEnd) ||
                !Number.isFinite(rightStart) ||
                leftEnd !== rightStart
            ) {
                return false;
            }

            if (
                !this.#rangeMergeValuesMatch(
                    this.#getRangeMergeAttributes(
                        left
                    ),
                    this.#getRangeMergeAttributes(
                        right
                    )
                )
            ) {
                return false;
            }

            return this.#rangeMergeValuesMatch(
                this.#getRangeMergeClockTimerState(
                    left
                ),
                this.#getRangeMergeClockTimerState(
                    right
                )
            );
        }

        #mergeAdjacentIdenticalRangesInRing(
            ring
        ) {
            if (
                !ring ||
                ring.localName !== "ring-container"
            ) {
                return false;
            }

            const ranges =
                Array.from(
                    ring.children
                )
                    .filter(
                        range =>
                            range.localName ===
                                "time-range" &&
                            range.timeRangeExiting !==
                                true
                    )
                    .sort(
                        (a, b) =>
                            Number(a.clockTimerStart) -
                                Number(b.clockTimerStart) ||
                            Number(a.clockTimerEnd) -
                                Number(b.clockTimerEnd)
                    );

            let changed =
                false;

            let index =
                0;

            while (
                index < ranges.length - 1
            ) {
                const left =
                    ranges[index];

                const right =
                    ranges[index + 1];

                if (
                    !this.#rangesAreMergeIdentical(
                        left,
                        right
                    )
                ) {
                    index++;
                    continue;
                }

                const start =
                    Number(
                        left.clockTimerStart
                    );

                const end =
                    Number(
                        right.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    index++;
                    continue;
                }

                const preserveRangeLength =
                    left.hasAttribute(
                        "range-length"
                    ) ||
                    right.hasAttribute(
                        "range-length"
                    );

                this.#setRangeTiming(
                    left,
                    start,
                    end,
                    preserveRangeLength
                );


                if (
                    right.timeRangeFullEntry ===
                        true
                ) {
                    left.timeRangeFullEntry =
                        true;
                }

                right.remove();

                ranges.splice(
                    index + 1,
                    1
                );

                changed =
                    true;
            }

            return changed;
        }

        #mergeAdjacentIdenticalRanges() {
            let changed =
                false;

            for (const ring of this.children) {
                if (
                    ring.localName !==
                        "ring-container" ||
                    ring.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                if (
                    this.#mergeAdjacentIdenticalRangesInRing(
                        ring
                    )
                ) {
                    changed =
                        true;
                }
            }

            return changed;
        }

        #getManagedTimeRanges() {
            const ranges = [];

            for (const child of this.children) {
                if (
                    child.localName !==
                        "ring-container" ||
                    child.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                for (const range of child.children) {
                    if (
                        range.localName ===
                            "time-range"
                    ) {
                        this.#ensureIntervalIdAttribute(
                            range
                        );

                        ranges.push(range);
                    }
                }
            }

            return ranges;
        }

        #getTimerRings() {
            return Array.from(
                this.children
            ).filter(
                child =>
                    child.localName ===
                        "ring-container" &&
                    child.clockTimerRing !==
                        undefined &&
                    child.clockTimerExitingRing !==
                        true
            );
        }

        #getTimerRanges() {
            const ranges = [];

            for (const ring of
                this.#getTimerRings()
            ) {
                for (const range of ring.children) {
                    if (
                        range.localName ===
                            "time-range"
                    ) {
                        ranges.push(range);
                    }
                }
            }

            return ranges;
        }

        #parseGoalValue(
            raw,
            fallback = 1
        ) {
            if (
                typeof raw !==
                    "string"
            ) {
                return fallback;
            }

            let text =
                raw.trim();

            if (!text) {
                return fallback;
            }

            const trailingPercent =
                text.endsWith(
                    "%"
                );

            if (trailingPercent) {
                text =
                    text.slice(
                        0,
                        -1
                    ).trim();
            }

            let value =
                Number(
                    text
                );

            if (
                !Number.isFinite(value) ||
                value <= 0
            ) {
                return fallback;
            }

            if (trailingPercent) {
                value /= 100;
            }
            else if (value > 1.5) {
                value /= 100;
            }

            return (
                Number.isFinite(value) &&
                value > 0
            )
                ? value
                : fallback;
        }

        #getUserTripGoal() {
            return this.#parseGoalValue(
                this.getAttribute(
                    "trip-goal"
                ),
                1
            );
        }

        #getTripGoal() {
            if (
                this.#autoSyncTripGoal &&
                Number.isFinite(this.#matchedTripGoal) &&
                this.#matchedTripGoal > 0
            ) {
                return this.#matchedTripGoal;
            }

            return this.#getUserTripGoal();
        }

        #getTotalGoal() {
            return this.#parseGoalValue(
                this.getAttribute(
                    "total-goal"
                ),
                1
            );
        }

        #emptyGoalRequirements() {
            return {
                tripGoal: null,
                adjustedTimeElapsed: null,
                adjustedEndTime: null
            };
        }

        #getIntervalSegments(
            startTime
        ) {
            if (!Number.isFinite(startTime)) {
                return undefined;
            }

            const segments = [];

            const approvalManagedIds =
                new Set(
                    this.#insertedRanges
                        .filter(
                            record =>
                                this.#isIntervalApprovalManaged(
                                    record
                                )
                        )
                        .map(
                            record =>
                                record.id
                        )
                );

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.timeRangeExiting === true ||
                    !this.#isIntervalType(
                        range.getAttribute(
                            "type"
                        )
                    ) ||
                    (
                        range.clockTimerInserted !==
                            undefined &&
                        approvalManagedIds.has(
                            range.clockTimerInserted
                        )
                    )
                ) {
                    continue;
                }

                const rangeStart =
                    Number(
                        range.clockTimerStart
                    );

                const rangeEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd) ||
                    rangeEnd <= rangeStart ||
                    rangeEnd <= startTime
                ) {
                    continue;
                }

                segments.push([
                    Math.max(
                        rangeStart,
                        startTime
                    ),
                    rangeEnd
                ]);
            }

            for (
                const record of
                    this.#insertedRanges
            ) {
                if (
                    !approvalManagedIds.has(
                        record.id
                    ) ||
                    !this.#isIntervalType(
                        record.type
                    )
                ) {
                    continue;
                }

                const rangeStart =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                const duration =
                    this.#getIntervalEffectiveDuration(
                        record
                    );

                const rangeEnd =
                    Number.isFinite(rangeStart) &&
                    Number.isFinite(duration)
                        ? rangeStart + duration
                        : undefined;

                if (
                    !Number.isFinite(rangeStart) ||
                    !Number.isFinite(rangeEnd) ||
                    rangeEnd <= rangeStart ||
                    rangeEnd <= startTime
                ) {
                    continue;
                }

                segments.push([
                    Math.max(
                        rangeStart,
                        startTime
                    ),
                    rangeEnd
                ]);
            }

            segments.sort(
                (left, right) =>
                    left[0] - right[0] ||
                    left[1] - right[1]
            );

            const merged = [];

            for (const segment of segments) {
                const previous =
                    merged[
                        merged.length - 1
                    ];

                if (
                    !previous ||
                    segment[0] > previous[1]
                ) {
                    merged.push([
                        segment[0],
                        segment[1]
                    ]);

                    continue;
                }

                previous[1] =
                    Math.max(
                        previous[1],
                        segment[1]
                    );
            }

            return merged;
        }

        #openIntervalBlocksAdjustedEnd(
            endTime
        ) {
            const record =
                this.#openEndedRange;

            const scheduledStart =
                this.#scheduledStartMilliseconds;

            if (
                !record ||
                !this.#isIntervalType(record.type) ||
                !Number.isFinite(scheduledStart) ||
                !(record.startDate instanceof Date) ||
                !Number.isFinite(endTime)
            ) {
                return false;
            }

            const intervalStart =
                this.#dateToTimelineTime(
                    record.startDate
                );

            return (
                Number.isFinite(intervalStart) &&
                Math.max(
                    intervalStart,
                    scheduledStart
                ) < endTime
            );
        }

        #calculateAdjustedEndTimeline(
            adjustedTimeElapsed
        ) {
            const scheduledStart =
                this.#scheduledStartMilliseconds;

            if (
                !Number.isFinite(scheduledStart) ||
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0
            ) {
                return undefined;
            }

            const segments =
                this.#getIntervalSegments(
                    scheduledStart
                );

            if (!segments) {
                return undefined;
            }

            let adjustedEnd =
                scheduledStart +
                adjustedTimeElapsed;

            if (
                this.#openIntervalBlocksAdjustedEnd(
                    adjustedEnd
                )
            ) {
                return undefined;
            }

            for (const [start, end] of segments) {
                if (start >= adjustedEnd) {
                    break;
                }

                adjustedEnd +=
                    end - start;

                if (
                    this.#openIntervalBlocksAdjustedEnd(
                        adjustedEnd
                    )
                ) {
                    return undefined;
                }
            }

            return adjustedEnd;
        }

        #requirementsFromAdjustedTime(
            adjustedTimeElapsed,
            tripGoal
        ) {
            const empty =
                this.#emptyGoalRequirements();

            if (
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0 ||
                !Number.isFinite(tripGoal) ||
                tripGoal <= 0
            ) {
                return empty;
            }

            const adjustedEndTimeline =
                this.#calculateAdjustedEndTimeline(
                    adjustedTimeElapsed
                );

            if (!Number.isFinite(adjustedEndTimeline)) {
                return empty;
            }

            const adjustedEndTime =
                this.#timelineToISO(
                    adjustedEndTimeline
                );

            if (!adjustedEndTime) {
                return empty;
            }

            return {
                tripGoal,
                adjustedTimeElapsed:
                    Math.round(
                        adjustedTimeElapsed
                    ),
                adjustedEndTime
            };
        }

        #getTotalGoalAdjustedTimeElapsed() {
            const totalGoal = this.#getTotalGoal();
            const totals = this.#tripTotals;

            if (!Number.isFinite(totalGoal) || totalGoal <= 0 || !totals ||
                !Number.isFinite(totals.standardTimeMilliseconds) ||
                !Number.isFinite(totals.actualTimeMilliseconds) ||
                !Number.isFinite(this.#standardDuration) || this.#standardDuration <= 0) {
                return undefined;
            }

            const adjusted =
                (totals.standardTimeMilliseconds + this.#standardDuration) /
                    totalGoal - totals.actualTimeMilliseconds;

            return Number.isFinite(adjusted) && adjusted > 0 ? adjusted : undefined;
        }

        #getTotalGoalImpossibility(
            now = this.#started
                ? this.#getCurrentTimelineTime()
                : undefined
        ) {
            const totalGoal =
                this.#getTotalGoal();

            const totals =
                this.#tripTotals;

            if (
                !this.#started ||
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0 ||
                !this.#hasUsableAggregateSnapshot() ||
                !totals ||
                !Number.isFinite(
                    this.#standardDuration
                ) ||
                this.#standardDuration <= 0 ||
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return {
                    impossible: false,
                    reason: null,
                    adjustedTimeElapsed: null,
                    deadline: undefined
                };
            }

            const adjustedTimeElapsed =
                (
                    totals.standardTimeMilliseconds +
                    this.#standardDuration
                ) /
                    totalGoal -
                totals.actualTimeMilliseconds;

            if (
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0
            ) {
                return {
                    impossible: true,
                    reason: "insufficient-time",
                    adjustedTimeElapsed:
                        Number.isFinite(adjustedTimeElapsed)
                            ? adjustedTimeElapsed
                            : null,
                    deadline: undefined
                };
            }

            const deadline =
                this.#calculateAdjustedEndTimeline(
                    adjustedTimeElapsed
                );

            if (!Number.isFinite(deadline)) {
                if (
                    this.#openEndedRange &&
                    this.#isIntervalType(
                        this.#openEndedRange.type
                    )
                ) {
                    return {
                        impossible: false,
                        reason: null,
                        adjustedTimeElapsed,
                        deadline: undefined
                    };
                }

                return {
                    impossible: true,
                    reason: "insufficient-time",
                    adjustedTimeElapsed,
                    deadline: undefined
                };
            }

            if (
                Number.isFinite(now) &&
                now > deadline
            ) {
                return {
                    impossible: true,
                    reason: "deadline-passed",
                    adjustedTimeElapsed,
                    deadline
                };
            }

            return {
                impossible: false,
                reason: null,
                adjustedTimeElapsed,
                deadline
            };
        }

        #updateTotalGoalNotPossibleState(
            source = "automatic",
            now = this.#started
                ? this.#getCurrentTimelineTime()
                : undefined
        ) {
            const state =
                this.#getTotalGoalImpossibility(
                    now
                );

            if (
                state.impossible &&
                !this.#totalGoalNotPossibleState
            ) {
                this.#emitClockTimerEvent(
                    "totalGoalNotPossible",
                    {
                        source,
                        goal:
                            this.#getTotalGoal(),
                        reason:
                            state.reason,
                        adjustedTimeElapsed:
                            Number.isFinite(
                                state.adjustedTimeElapsed
                            )
                                ? Math.round(
                                    state.adjustedTimeElapsed
                                )
                                : null,
                        deadline:
                            this.#timelineToISO(
                                state.deadline
                            ) ?? null,
                        currentTime:
                            this.#timelineToISO(
                                now
                            ) ?? null
                    }
                );
            }

            this.#totalGoalNotPossibleState =
                state.impossible;

            return state;
        }

        #checkGoalMisses(now) {
            if (!this.#started || !Number.isFinite(now)) {
                this.#tripGoalMissedState = false;
                this.#totalGoalMissedState = false;
                this.#totalGoalNotPossibleState = false;
                return;
            }

            this.#updateTotalGoalNotPossibleState(
                "automatic",
                now
            );

            if (
                this.#calculateRenderedPercentGoal() !==
                    this.#renderedPercentGoal
            ) {
                this.#handleTripGoalChange(
                    "automatic"
                );
            }

            const tripGoal = this.#getTripGoal();
            const tripAdjusted = Number.isFinite(tripGoal) && tripGoal > 0 &&
                Number.isFinite(this.#standardDuration)
                    ? this.#standardDuration / tripGoal
                    : undefined;
            const tripDeadline = Number.isFinite(tripAdjusted)
                ? this.#calculateAdjustedEndTimeline(tripAdjusted)
                : undefined;
            const tripMissed = Number.isFinite(tripDeadline) && now > tripDeadline;

            if (tripMissed && !this.#tripGoalMissedState) {
                const detail = {
                    goal: tripGoal,
                    deadline: this.#timelineToISO(tripDeadline),
                    currentTime: this.#timelineToISO(now)
                };

                this.#emitClockTimerEvent(
                    "tripGoalMissed",
                    detail
                );

                this.#emitClockTimerEvent(
                    "tripGoalFailed",
                    detail
                );
            }
            this.#tripGoalMissedState = tripMissed;

            const totalGoal = this.#getTotalGoal();
            const totalAdjusted = this.#getTotalGoalAdjustedTimeElapsed();
            const totalDeadline = Number.isFinite(totalAdjusted)
                ? this.#calculateAdjustedEndTimeline(totalAdjusted)
                : undefined;
            const totalGoalActive =
                this.#percentMode === "total" ||
                this.#autoSyncTripGoal ||
                this.hasAttribute("total-goal");

            const totalMissed = totalGoalActive &&
                Number.isFinite(totalDeadline) && now > totalDeadline;

            if (totalMissed && !this.#totalGoalMissedState) {
                const detail = {
                    goal: totalGoal,
                    deadline: this.#timelineToISO(totalDeadline),
                    currentTime: this.#timelineToISO(now)
                };

                this.#emitClockTimerEvent(
                    "totalGoalMissed",
                    detail
                );

                this.#emitClockTimerEvent(
                    "totalGoalFailed",
                    detail
                );
            }
            this.#totalGoalMissedState = totalMissed;
        }

        #calculateTripGoalRequirements({ allowMissed = false } = {}) {
            const tripGoal =
                this.#getTripGoal();

            if (
                !Number.isFinite(tripGoal) ||
                tripGoal <= 0 ||
                !Number.isFinite(this.#standardDuration) ||
                this.#standardDuration <= 0
            ) {
                return this.#emptyGoalRequirements();
            }

            const requirements =
                this.#requirementsFromAdjustedTime(
                    this.#standardDuration /
                        tripGoal,
                    tripGoal
                );

            if (
                !Number.isFinite(
                    requirements.tripGoal
                )
            ) {
                return this.#emptyGoalRequirements();
            }

            if (this.#started && !allowMissed) {
                const deadline =
                    this.#calculateAdjustedEndTimeline(
                        requirements.adjustedTimeElapsed
                    );

                const now =
                    this.#getCurrentTimelineTime();

                if (
                    !Number.isFinite(deadline) ||
                    (
                        Number.isFinite(now) &&
                        now > deadline
                    )
                ) {
                    return this.#emptyGoalRequirements();
                }
            }

            return requirements;
        }

        #getTotalGoalRequirementFailureReason() {
            const totalGoal =
                this.#getTotalGoal();

            if (
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0
            ) {
                return "missing-total-goal";
            }

            const totals =
                this.#tripTotals;

            if (
                !totals ||
                !Number.isFinite(totals.standardTimeMilliseconds) ||
                totals.standardTimeMilliseconds < 0 ||
                !Number.isFinite(totals.actualTimeMilliseconds) ||
                totals.actualTimeMilliseconds < 0
            ) {
                return "missing-trip-totals";
            }

            if (
                !Number.isFinite(this.#standardDuration) ||
                this.#standardDuration <= 0 ||
                !Number.isFinite(this.#scheduledStartMilliseconds)
            ) {
                return "missing-trip";
            }

            const combinedStandard =
                totals.standardTimeMilliseconds +
                this.#standardDuration;

            const adjustedTimeElapsed =
                combinedStandard /
                    totalGoal -
                totals.actualTimeMilliseconds;

            if (
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0
            ) {
                return "insufficient-time";
            }

            const adjustedEndTimeline =
                this.#calculateAdjustedEndTimeline(
                    adjustedTimeElapsed
                );

            if (!Number.isFinite(adjustedEndTimeline)) {
                if (
                    this.#openEndedRange &&
                    this.#isIntervalType(
                        this.#openEndedRange.type
                    )
                ) {
                    return "open-interval";
                }

                return "insufficient-time";
            }

            const now =
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined;

            if (
                Number.isFinite(now) &&
                adjustedEndTimeline < now
            ) {
                return "insufficient-time";
            }

            return null;
        }

        #calculateTripGoalFromTotalDuration(
            standardDuration = this.#standardDuration
        ) {
            const empty = {
                tripGoal: null,
                adjustedTimeElapsed: null
            };

            const totalGoal =
                this.#getTotalGoal();

            const totals =
                this.#tripTotals;

            if (
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0 ||
                !totals ||
                !Number.isFinite(
                    totals.standardTimeMilliseconds
                ) ||
                !Number.isFinite(
                    totals.actualTimeMilliseconds
                ) ||
                !Number.isFinite(standardDuration) ||
                standardDuration <= 0
            ) {
                return empty;
            }

            const combinedStandard =
                totals.standardTimeMilliseconds +
                standardDuration;

            const targetCombinedActual =
                combinedStandard /
                totalGoal;

            const targetAdjustedTimeElapsed =
                targetCombinedActual -
                totals.actualTimeMilliseconds;

            if (
                !Number.isFinite(targetAdjustedTimeElapsed) ||
                targetAdjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            const rawTripGoal =
                standardDuration /
                targetAdjustedTimeElapsed;

            if (
                !Number.isFinite(rawTripGoal) ||
                rawTripGoal <= 0
            ) {
                return empty;
            }

            const tripGoal =
                Math.ceil(
                    rawTripGoal * 100 - 1e-9
                ) / 100;

            const adjustedTimeElapsed =
                standardDuration /
                tripGoal;

            if (
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            return {
                tripGoal,
                adjustedTimeElapsed
            };
        }

        #calculateTotalGoalRequirements({ allowMissed = false } = {}) {
            const empty =
                this.#emptyGoalRequirements();

            if (
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return empty;
            }

            const calculated =
                this.#calculateTripGoalFromTotalDuration();

            if (
                !Number.isFinite(calculated.tripGoal) ||
                calculated.tripGoal <= 0 ||
                !Number.isFinite(
                    calculated.adjustedTimeElapsed
                ) ||
                calculated.adjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            const requirements =
                this.#requirementsFromAdjustedTime(
                    calculated.adjustedTimeElapsed,
                    calculated.tripGoal
                );

            if (
                !Number.isFinite(
                    requirements.tripGoal
                )
            ) {
                return empty;
            }

            const adjustedEndTimeline =
                this.#calculateAdjustedEndTimeline(
                    calculated.adjustedTimeElapsed
                );

            const now =
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined;

            if (
                !allowMissed &&
                Number.isFinite(now) &&
                Number.isFinite(adjustedEndTimeline) &&
                adjustedEndTimeline < now
            ) {
                return empty;
            }

            return requirements;
        }

        #getAutoGoalSelection() {
            const tripRequirements =
                this.#calculateTripGoalRequirements();

            const totalRequirements =
                this.hasAttribute("total-goal")
                    ? this.#calculateTotalGoalRequirements()
                    : this.#emptyGoalRequirements();

            const tripTime =
                Number(
                    tripRequirements.adjustedTimeElapsed
                );

            const totalTime =
                Number(
                    totalRequirements.adjustedTimeElapsed
                );

            const tripValid =
                Number.isFinite(tripTime) &&
                tripTime > 0;

            const totalValid =
                Number.isFinite(totalTime) &&
                totalTime > 0;

            const tripScope =
                (
                    this.#autoSyncTripGoal &&
                    Number.isFinite(this.#matchedTripGoal) &&
                    this.#matchedTripGoal > 0
                ) ||
                this.hasAttribute("trip-goal")
                    ? "trip"
                    : "standard";

            if (!tripValid) {
                return totalValid
                    ? {
                        scope: "total",
                        requirements: totalRequirements
                    }
                    : {
                        scope: "standard",
                        requirements:
                            this.#emptyGoalRequirements()
                    };
            }

            if (!totalValid) {
                return {
                    scope: tripScope,
                    requirements: tripRequirements
                };
            }

            if (
                totalTime < tripTime ||
                (
                    totalTime === tripTime &&
                    tripScope === "standard"
                )
            ) {
                return {
                    scope: "total",
                    requirements: totalRequirements
                };
            }

            return {
                scope: tripScope,
                requirements: tripRequirements
            };
        }

        #calculateGoalRequirements() {
            return this.#getAutoGoalSelection()
                .requirements;
        }

        #getRenderedPercentScope() {
            if (this.#percentMode === "trip") {
                return "trip";
            }

            if (this.#percentMode === "total") {
                return "total";
            }

            return this.#getAutoGoalSelection()
                .scope;
        }

        #normalizePercentMode(value) {
            const normalized =
                String(value ?? "auto")
                    .trim()
                    .toLowerCase();

            return new Set([
                "trip",
                "total",
                "auto"
            ]).has(normalized)
                ? normalized
                : "auto";
        }

        #setPercentModeAutomatically(
            value,
            reason,
            {
                recalculate = true
            } = {}
        ) {
            const normalized =
                this.#normalizePercentMode(
                    value
                );

            if (
                normalized ===
                    this.#percentMode &&
                this.getAttribute(
                    "percent-mode"
                ) === normalized
            ) {
                return false;
            }

            const previousContext =
                this.#percentModeChangeContext;

            this.#percentModeChangeContext = {
                source: "automatic",
                reason,
                recalculate
            };

            try {
                this.setAttribute(
                    "percent-mode",
                    normalized
                );
            }
            finally {
                this.#percentModeChangeContext =
                    previousContext;
            }

            return true;
        }

        #emitRenderedPercentGoalChange(
            previousValue,
            value,
            source
        ) {
            const detail = {
                previousValue,
                value,
                source,
                userInitiated:
                    source === "user",
                percentMode:
                    this.#percentMode,
                renderedPercentGoalScope:
                    this.#getRenderedPercentScope()
            };

            this.#emitClockTimerEvent(
                "renderedPercentGoalChanged",
                detail
            );

            if (
                this.#percentMode === "auto" &&
                source === "automatic" &&
                Number.isFinite(previousValue) &&
                Number.isFinite(value) &&
                value < previousValue
            ) {
                this.#emitClockTimerEvent(
                    "goalAutomaticallyAdjusted",
                    {
                        ...detail,
                        previousGoal: previousValue,
                        goal: value,
                        reason:
                            "higher-goal-no-longer-attainable"
                    }
                );
            }
        }

        #setRenderedPercentGoal(
            value,
            source = "automatic",
            {
                emit = true
            } = {}
        ) {
            const normalized =
                Number.isFinite(value) && value > 0
                    ? value
                    : 1;

            const previousValue =
                this.#renderedPercentGoal;

            if (previousValue === normalized) {
                return false;
            }

            this.#renderedPercentGoal =
                normalized;

            if (emit) {
                this.#emitRenderedPercentGoalChange(
                    previousValue,
                    normalized,
                    source
                );
            }

            return true;
        }

        #calculateRenderedPercentGoal() {
            let requirements;

            if (this.#percentMode === "trip") {
                requirements =
                    this.#calculateTripGoalRequirements({
                        allowMissed: true
                    });
            }
            else if (this.#percentMode === "total") {
                requirements =
                    this.#calculateTotalGoalRequirements({
                        allowMissed: true
                    });
            }
            else {
                requirements =
                    this.#calculateGoalRequirements();
            }

            const goal =
                Number(requirements?.tripGoal);

            return Number.isFinite(goal) && goal > 0
                ? goal
                : 1;
        }

        #parseInsertDateTime(
            value,
            name
        ) {
            if (typeof value !== "string") {
                throw new TypeError(
                    `${name} must be a string.`
                );
            }

            const text = value.trim();

            if (
                !/^(?:(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+)?(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:\s*(AM|PM))?$/i.test(
                    text
                )
            ) {
                throw new TypeError(
                    `${name} must match [yyyy/mm/dd h:m]m:ss[.ms][ AM/PM].`
                );
            }

            const date =
                TemporalFormat.parseDateTime(
                    text,
                    new Date()
                );

            if (!date) {
                throw new RangeError(
                    `${name} contains an invalid date or time.`
                );
            }

            return date;
        }

        #parseInsertRangeLength(
            value
        ) {
            if (typeof value !== "string") {
                throw new TypeError(
                    "rangeLength must be a string."
                );
            }

            const text = value.trim();

            if (
                !/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/.test(
                    text
                )
            ) {
                throw new TypeError(
                    "rangeLength must match [h:m]m:ss[.ms]."
                );
            }

            const total =
                TemporalFormat.durationToMilliseconds(
                    text
                );

            if (total === undefined) {
                throw new RangeError(
                    "rangeLength contains an invalid duration."
                );
            }

            if (total < 0) {
                throw new RangeError(
                    "rangeLength must not be negative."
                );
            }

            return total;
        }

        #dateToTimelineTime(
            date
        ) {
            const today =
                new Date();

            const midnightToday =
                new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                );

            const midnightDate =
                new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate()
                );

            const dayDifference =
                Math.round(
                    (
                        midnightDate.getTime() -
                        midnightToday.getTime()
                    ) /
                    ClockTimer.#DAY
                );

            const raw =
                date.getHours() * ClockTimer.#HOUR +
                date.getMinutes() * 60 * 1000 +
                date.getSeconds() * 1000 +
                date.getMilliseconds() +
                dayDifference * ClockTimer.#DAY;

            if (
                this.#started
            ) {
                return this.#resolveNear(
                    raw,
                    this.#getCurrentTimelineTime()
                );
            }

            return raw;
        }

        #ensureInsertionAnchor(
            start
        ) {
            if (
                Number.isFinite(
                    this.#ringAnchor
                )
            ) {
                return;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#ringAnchor =
                    start;

                return;
            }

            this.#ringAnchor =
                start -
                (
                    (
                        start % ClockTimer.#HOUR
                    ) +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;
        }

        #applyOtherAttributes(
            range,
            attributes
        ) {
            const protectedAttributes =
                new Set([
                    "type",
                    "start-time",
                    "end-time",
                    "range-length"
                ]);

            for (
                const [key, value] of
                    Object.entries(
                        attributes ?? {}
                    )
            ) {
                const name =
                    String(key);

                if (
                    protectedAttributes.has(
                        name.toLowerCase()
                    )
                ) {
                    continue;
                }

                range.setAttribute(
                    name,
                    String(value)
                );
            }
        }

        #getPreservedAttributes(
            range
        ) {
            const attributes = {};

            for (
                const attribute of
                    range.attributes
            ) {
                const name =
                    attribute.name.toLowerCase();

                if (
                    name === "start-time" ||
                    name === "end-time" ||
                    name === "range-length" ||
                    name === "slot"
                ) {
                    continue;
                }

                attributes[attribute.name] =
                    attribute.value;
            }

            return attributes;
        }

        #applyPreservedAttributes(
            range,
            attributes
        ) {
            const internalMutation =
                range.clockTimerInternalMutation === true;

            range.clockTimerInternalMutation = true;

            try {
                for (
                    const [name, value] of
                        Object.entries(
                            attributes ?? {}
                        )
                ) {
                    const normalizedName =
                        name.toLowerCase();

                    if (
                        normalizedName === "start-time" ||
                        normalizedName === "end-time" ||
                        normalizedName === "range-length"
                    ) {
                        continue;
                    }

                    range.setAttribute(
                        name,
                        value
                    );
                }
            }
            finally {
                if (!internalMutation) {
                    delete range.clockTimerInternalMutation;
                }
            }
        }

        #captureInsertedAttributes() {
            const grouped =
                new Map();

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerInserted !==
                                    undefined
                        )
            ) {
                const id =
                    range.clockTimerInserted;

                if (!id) {
                    continue;
                }

                if (!grouped.has(id)) {
                    grouped.set(id, []);
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                grouped.get(id).push({
                    start,
                    end,
                    attributes:
                        this.#getPreservedAttributes(
                            range
                        )
                });
            }

            for (
                const record of
                    this.#insertedRanges
            ) {
                const snapshots =
                    grouped.get(record.id);

                if (
                    snapshots &&
                    snapshots.length > 0
                ) {
                    record.preservedAttributes =
                        snapshots;
                }
            }
        }

        #setRangeTiming(
            range,
            start,
            end,
            preserveRangeLength = false
        ) {
            if (
                !range ||
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return false;
            }

            const previousStart =
                Number(
                    range.clockTimerStart
                );

            const previousEnd =
                Number(
                    range.clockTimerEnd
                );

            const rangeType =
                range.getAttribute(
                    "type"
                );

            if (
                rangeType === "remaining" ||
                rangeType === "wave"
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                this.#suspendRangeRendering(range);

                this.#writeRangeTiming(
                    range,
                    start,
                    end,
                    preserveRangeLength
                );

                const originMilliseconds =
                    this.#getTimeRangeOriginMilliseconds(
                        range,
                        start
                    );

                const targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        start,
                        end,
                        originMilliseconds
                    );

                if (targetLayout) {
                    this.#applyTimeRangeLayout(
                        range,
                        targetLayout,
                        true
                    );
                }

                this.#resumeRangeRendering(range);

                if (!targetLayout) {
                    this.#refreshRangeGeometry(range);
                }

                return true;
            }

            const active =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (active) {
                this.#writeRangeTiming(
                    range,
                    start,
                    end,
                    preserveRangeLength
                );

                active.pending =
                    start === active.targetStart &&
                    end === active.targetEnd
                        ? undefined
                        : {
                            start,
                            end,
                            preserveRangeLength
                        };

                return true;
            }

            const renderer =
                this.#getRangeRenderer(
                    range
                );

            const canManageAnimation =
                range.isConnected &&
                renderer &&
                typeof renderer
                    .suspendRangeRendering ===
                    "function" &&
                typeof renderer
                    .resumeRangeRendering ===
                    "function" &&
                typeof renderer
                    .calculateRangeLayout ===
                    "function" &&
                typeof renderer
                    .applyRangeLayout ===
                    "function";

            if (!canManageAnimation) {
                this.#writeRangeTiming(
                    range,
                    start,
                    end,
                    preserveRangeLength
                );

                return true;
            }

            this.#suspendRangeRendering(range);

            this.#writeRangeTiming(
                range,
                start,
                end,
                preserveRangeLength
            );

            const originMilliseconds =
                this.#getTimeRangeOriginMilliseconds(
                    range,
                    start
                );

            const targetLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    start,
                    end,
                    originMilliseconds
                );

            if (!targetLayout) {
                this.#resumeRangeRendering(range);

                this.#refreshRangeGeometry(range);
                return true;
            }

            if (
                !Number.isFinite(previousStart) ||
                !Number.isFinite(previousEnd) ||
                (
                    previousStart === start &&
                    previousEnd === end
                ) ||
                this.#starting ||
                this.#getRangeAnimationDuration() <= 0
            ) {
                this.#applyTimeRangeLayout(
                    range,
                    targetLayout,
                    true
                );

                this.#resumeRangeRendering(range);

                return true;
            }

            const fromLayout =
                this.#calculateTimeRangeLayout(
                    range,
                    previousStart,
                    previousEnd,
                    originMilliseconds
                );

            if (!fromLayout) {
                this.#applyTimeRangeLayout(
                    range,
                    targetLayout,
                    true
                );

                this.#resumeRangeRendering(range);

                return true;
            }

            this.#applyTimeRangeLayout(
                range,
                fromLayout
            );

            const state = {
                fromStart:
                    previousStart,
                fromEnd:
                    previousEnd,
                targetStart:
                    start,
                targetEnd:
                    end,
                originMilliseconds,
                targetLayout,
                pending:
                    undefined,
                frame:
                    undefined,
                startedAt:
                    undefined,
                duration:
                    this.#getRangeAnimationDuration()
            };

            this.#timeRangeTimingAnimations.set(
                range,
                state
            );

            state.frame =
                requestAnimationFrame(
                    timestamp =>
                        this.#stepTimeRangeTimingAnimation(
                            range,
                            state,
                            timestamp
                        )
                );

            return true;
        }

        #replaceRangeWithSegments(
            range,
            spans
        ) {
            const preserveRangeLength =
                range.hasAttribute(
                    "range-length"
                );

            const segments = [];

            for (
                const [
                    spanStart,
                    spanEnd
                ] of spans
            ) {
                if (
                    !Number.isFinite(spanStart) ||
                    !Number.isFinite(spanEnd) ||
                    spanEnd <= spanStart
                ) {
                    continue;
                }

                let cursor =
                    spanStart;

                while (
                    cursor < spanEnd
                ) {
                    const ringIndex =
                        this.#getTimerRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getTimerRingEnd(ringIndex);

                    const segmentEnd =
                        Math.min(
                            spanEnd,
                            ringEnd
                        );

                    segments.push({
                        start: cursor,
                        end: segmentEnd,
                        ringIndex
                    });

                    cursor =
                        segmentEnd;
                }
            }

            if (segments.length === 0) {
                range.remove();
                return;
            }

            if (segments.length > 1) {
                if (
                    typeof range.split !==
                        "function"
                ) {
                    return;
                }

                const sourceStart =
                    Number(
                        range.clockTimerStart
                    );

                const sourceEnd =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(sourceStart) ||
                    !Number.isFinite(sourceEnd) ||
                    sourceEnd <= sourceStart
                ) {
                    return;
                }

                const pieces = [
                    range
                ];

                let sourceCursor =
                    sourceStart;

                let currentPiece =
                    range;

                for (
                    let index = 0;
                    index < segments.length - 1;
                    index++
                ) {
                    const duration =
                        segments[index].end -
                        segments[index].start;

                    sourceCursor +=
                        duration;

                    const splitRanges =
                        currentPiece.split(
                            this.#formatTimelineTime(
                                sourceCursor
                            ),
                            true
                        );

                    if (
                        !Array.isArray(splitRanges) ||
                        splitRanges.length < 2
                    ) {
                        return;
                    }

                    const right =
                        splitRanges[
                            splitRanges.length - 1
                        ];

                    this.#copyClockTimerRangeState(
                        range,
                        right
                    );

                    pieces.push(
                        right
                    );

                    currentPiece =
                        right;
                }

                for (
                    let index = 0;
                    index < segments.length;
                    index++
                ) {
                    const piece =
                        pieces[index];

                    const entry =
                        segments[index];

                    this.#setRangeTiming(
                        piece,
                        entry.start,
                        entry.end,
                        preserveRangeLength
                    );

                    const ring =
                        this.#ensureRing(
                            entry.ringIndex
                        );

                    if (
                        piece.parentElement !==
                            ring
                    ) {
                        ring.appendChild(
                            piece
                        );
                    }
                }

                return;
            }

            const entry =
                segments[0];

            this.#setRangeTiming(
                range,
                entry.start,
                entry.end,
                preserveRangeLength
            );

            const ring =
                this.#ensureRing(
                    entry.ringIndex
                );

            if (
                range.parentElement !== ring
            ) {
                ring.appendChild(
                    range
                );
            }
        }

        #shiftExistingTimeRanges(
            cutoff,
            delta
        ) {
            const ranges =
                this.#getTimerRanges()
                    .filter(
                        range =>
                            range.clockTimerInserted ===
                                undefined
                    );

            for (
                const range of ranges
            ) {
                if (
                    range.getAttribute(
                        "type"
                    ) === "elapsed"
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= cutoff
                ) {
                    continue;
                }

                if (
                    start >= cutoff
                ) {
                    this.#replaceRangeWithSegments(
                        range,
                        [[
                            start + delta,
                            end + delta
                        ]]
                    );

                    continue;
                }

                this.#replaceRangeWithSegments(
                    range,
                    [
                        [
                            start,
                            cutoff
                        ],
                        [
                            cutoff + delta,
                            end + delta
                        ]
                    ]
                );
            }
        }

        #rebuildOvertimeRangeMap() {
            this.#overtimeRanges.clear();

            for (
                const range of
                    this.#getTimerRanges()
                        .filter(
                            range =>
                                range.clockTimerOvertime !==
                                    undefined
                        )
            ) {
                const start =
                    Number(
                        range.clockTimerStart
                    );

                if (
                    !Number.isFinite(start)
                ) {
                    continue;
                }

                this.#overtimeRanges.set(
                    this.#getTimerRingIndex(
                        start
                    ),
                    range
                );
            }
        }

        #removeInsertedSegments({
            animate = true
        } = {}) {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerInserted !==
                                    undefined
                        )
            ) {
                if (
                    animate &&
                    typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#removeRangeAnimated(range,{
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #getIntervalApprovalVisualRanges(
            record
        ) {
            if (!record) {
                return [];
            }

            return this.#getManagedTimeRanges()
                .filter(
                    range =>
                        range.timeRangeExiting !==
                            true &&
                        (
                            range.clockTimerInserted ===
                                record.id ||
                            range.clockTimerDiscrepancyFor ===
                                record.id
                        )
                );
        }

        #collapseIntervalApprovalVisualGroup(
            record,
            collapseTimeline = undefined
        ) {
            const start =
                Number.isFinite(
                    collapseTimeline
                )
                    ? collapseTimeline
                    : this.#dateToTimelineTime(
                        record?.startDate
                    );

            if (!Number.isFinite(start)) {
                return false;
            }

            const collapseTime =
                this.#formatTimelineTime(
                    start
                );

            for (
                const range of
                    this.#getIntervalApprovalVisualRanges(
                        record
                    )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.clockTimerInternalMutation =
                    true;

                try {
                    if (
                        typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                    ) {
                        this.#removeRangeAnimated(range,{
                            targetStart:
                                collapseTime,
                            targetEnd:
                                collapseTime
                        });
                    }
                    else {
                        range.remove();
                    }
                }
                finally {
                    delete range.clockTimerInternalMutation;
                }
            }

            return true;
        }

        #syncIntervalApprovalVisualAttributes(
            record
        ) {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerInserted ===
                                    record.id &&
                                candidate.timeRangeExiting !==
                                    true
                        )
            ) {
                range.clockTimerInternalMutation =
                    true;

                try {
                    this.#applyOtherAttributes(
                        range,
                        record.otherAttributes
                    );
                }
                finally {
                    delete range.clockTimerInternalMutation;
                }

                range.clockTimerApprovalReadOnly =
                    true;
            }
        }

        #transitionIntervalApprovalValueVisual(
            record
        ) {
            const approval =
                this.#getIntervalApprovalState(
                    record
                );

            if (
                !approval ||
                approval.state !== "approved"
            ) {
                return false;
            }

            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            const actualEnd =
                this.#getIntervalRecordEnd(
                    record
                );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(actualEnd) ||
                actualEnd <= start
            ) {
                return false;
            }

            const actualDuration =
                actualEnd - start;

            const renderedEnd =
                start +
                Math.min(
                    approval.duration,
                    actualDuration
                );

            const difference =
                approval.duration -
                actualDuration;

            const attachment =
                difference < 0
                    ? renderedEnd
                    : actualEnd;

            const attachmentTime =
                this.#formatTimelineTime(
                    attachment
                );

            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerDiscrepancyFor ===
                                    record.id &&
                                candidate.timeRangeExiting !==
                                    true
                        )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.clockTimerInternalMutation =
                    true;

                try {
                    this.#removeRangeAnimated(range,{
                        targetStart:
                            attachmentTime,
                        targetEnd:
                            attachmentTime
                    });
                }
                finally {
                    delete range.clockTimerInternalMutation;
                }
            }

            this.#syncOpenEndedRangeElements(
                record,
                renderedEnd
            );

            this.#syncIntervalApprovalVisualAttributes(
                record
            );

            if (difference === 0) {
                return true;
            }

            const discrepancyStart =
                difference < 0
                    ? renderedEnd
                    : actualEnd;

            const discrepancyEnd =
                difference < 0
                    ? actualEnd
                    : actualEnd + difference;

            this.#appendApprovalRangeSegments({
                record,
                type: difference < 0 ? "approval-deficit" : "approval-surplus",
                start:
                    discrepancyStart,
                end:
                    discrepancyEnd,
                attributes: {
                    difference:
                        this.#formatSignedIntervalDuration(
                            difference
                        )
                },
                discrepancy: true,
                animateFrom:
                    attachment
            });

            return true;
        }

        #animateIntervalApprovalGroupIn(
            record
        ) {
            const start =
                this.#dateToTimelineTime(
                    record?.startDate
                );

            const actualEnd =
                this.#getIntervalRecordEnd(
                    record
                );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(actualEnd)
            ) {
                return false;
            }

            return this.#renderApprovalManagedRecord(
                record,
                start,
                actualEnd,
                {
                    animateFromStart:
                        true
                }
            );
        }

        #removeDiscrepancyRangesForRecord(
            record
        ) {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            candidate =>
                                candidate.clockTimerDiscrepancyFor ===
                                    record.id
                        )
            ) {
                range.clockTimerInternalMutation =
                    true;

                try {
                    range.remove();
                }
                finally {
                    delete range.clockTimerInternalMutation;
                }
            }
        }

        #appendApprovalRangeSegments({
            record,
            type,
            start,
            end,
            attributes,
            discrepancy = false,
            animateFrom = undefined
        }) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return;
            }

            let cursor =
                start;

            while (cursor < end) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getTimerRingEnd(
                        ringIndex
                    );

                const segmentEnd =
                    Math.min(
                        end,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const range =
                    this.#createTimeRange(
                        type,
                        cursor,
                        segmentEnd,
                        {
                            dynamic: true
                        }
                    );

                delete range.clockTimerDynamic;

                if (
                    Number.isFinite(
                        animateFrom
                    )
                ) {
                    range.timeRangeFullEntry =
                        true;
                }

                if (discrepancy) {
                    range.clockTimerDiscrepancyFor =
                        record.id;

                    range.setAttribute(
                        "overlapping",
                        ""
                    );
                }
                else {
                    range.clockTimerInserted =
                        record.id;
                }

                this.#applyOtherAttributes(
                    range,
                    attributes
                );

                ring.appendChild(
                    range
                );

                if (discrepancy) {
                    range.clockTimerDerivedReadOnly =
                        true;
                }
                else if (
                    this.#isIntervalApprovalManaged(
                        record
                    )
                ) {
                    range.clockTimerApprovalReadOnly =
                        true;
                }

                if (
                    Number.isFinite(
                        animateFrom
                    ) &&
                    typeof this.#getRangeRenderer(range)?.animateRangeFromCollapsed === "function"
                ) {
                    range.clockTimerInternalMutation =
                        true;

                    try {
                        this.#animateRangeFromCollapsed(range,
                            this.#formatTimelineTime(
                                animateFrom
                            )
                        );
                    }
                    finally {
                        delete range.clockTimerInternalMutation;
                    }
                }

                cursor =
                    segmentEnd;
            }
        }

        #renderApprovalManagedRecord(
            record,
            start,
            actualEnd,
            {
                animateFromStart = false
            } = {}
        ) {
            if (
                !this.#isIntervalApprovalManaged(
                    record
                ) ||
                record.openEnded === true ||
                record.clockTimerPendingDelete ===
                    true
            ) {
                return false;
            }

            const approval =
                this.#getIntervalApprovalState(
                    record
                );

            if (!approval) {
                return false;
            }

            this.#removeDiscrepancyRangesForRecord(
                record
            );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(actualEnd) ||
                actualEnd <= start
            ) {
                return true;
            }

            if (
                approval.state ===
                    "unapproved"
            ) {
                return true;
            }

            const actualDuration =
                actualEnd - start;

            const renderedDuration =
                Math.min(
                    approval.duration,
                    actualDuration
                );

            const animateFrom =
                animateFromStart
                    ? start
                    : undefined;

            this.#appendApprovalRangeSegments({
                record,
                type:
                    record.type,
                start,
                end:
                    start +
                    renderedDuration,
                attributes:
                    record.otherAttributes,
                animateFrom
            });

            const difference =
                approval.duration -
                actualDuration;

            if (difference === 0) {
                return true;
            }

            const discrepancyStart =
                difference < 0
                    ? start + approval.duration
                    : actualEnd;

            const discrepancyEnd =
                difference < 0
                    ? actualEnd
                    : actualEnd + difference;

            this.#appendApprovalRangeSegments({
                record,
                type: difference < 0 ? "approval-deficit" : "approval-surplus",
                start:
                    discrepancyStart,
                end:
                    discrepancyEnd,
                attributes: {
                    difference:
                        this.#formatSignedIntervalDuration(
                            difference
                        )
                },
                discrepancy: true,
                animateFrom
            });

            return true;
        }

        #renderInsertedRecord(
            record
        ) {
            if (
                record?.clockTimerPendingDelete ===
                    true
            ) {
                return;
            }

            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            this.#ensureInsertionAnchor(
                start
            );

            const effectiveEnd =
                record.clockTimerExplicitlyEnded === true &&
                Number.isFinite(record.clockTimerExplicitEndTimeline)
                    ? record.clockTimerExplicitEndTimeline
                    : record.openEnded
                    ? (
                        Number.isFinite(
                            this.#openEndedLastTick
                        ) &&
                        this.#openEndedLastTick > start
                            ? this.#openEndedLastTick
                            : undefined
                    )
                    : (
                        record.endDate
                            ? this.#dateToTimelineTime(
                                record.endDate
                            )
                            : undefined
                    );

            if (
                this.#renderApprovalManagedRecord(
                    record,
                    start,
                    effectiveEnd
                )
            ) {
                return;
            }

            if (
                Number.isFinite(
                    effectiveEnd
                ) &&
                effectiveEnd < start
            ) {
                return;
            }

            if (
                !Number.isFinite(
                    effectiveEnd
                )
            ) {
                const ring =
                    this.#ensureRing(
                        this.#getTimerRingIndex(
                            start
                        )
                    );

                const range =
                    document.createElement(
                        "time-range"
                    );

                range.setAttribute(
                    "type",
                    record.type
                );

                range.setAttribute(
                    "start-time",
                    this.#formatTimelineTime(
                        start
                    )
                );

                if (this.#starting) {
                    range.timeRangeFullEntry =
                        true;
                }

                range.clockTimerStart =
                    String(start);

                range.clockTimerInserted =
                    record.id;

                this.#applyOtherAttributes(
                    range,
                    record.otherAttributes
                );

                ring.appendChild(range);

                return;
            }

            if (effectiveEnd === start) {
                const ring =
                    this.#ensureRing(
                        this.#getTimerRingIndex(
                            start
                        )
                    );

                const range =
                    this.#createTimeRange(
                        record.type,
                        start,
                        start,
                        {
                            dynamic: true
                        }
                    );

                delete range.clockTimerDynamic;

                range.clockTimerInserted =
                    record.id;

                this.#applyOtherAttributes(
                    range,
                    record.otherAttributes
                );

                ring.appendChild(range);

                return;
            }

            let cursor =
                start;

            while (
                cursor < effectiveEnd
            ) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentEnd =
                    Math.min(
                        effectiveEnd,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const range =
                    this.#createTimeRange(
                        record.type,
                        cursor,
                        segmentEnd,
                        {
                            dynamic: true
                        }
                    );

                delete range.clockTimerDynamic;

                range.clockTimerInserted =
                    record.id;

                this.#applyOtherAttributes(
                    range,
                    record.otherAttributes
                );

                ring.appendChild(range);

                cursor =
                    segmentEnd;
            }
        }

        #renderAllInsertedRanges({
            animateRemoval = true
        } = {}) {
            this.#captureInsertedAttributes();

            this.#removeInsertedSegments({
                animate: animateRemoval
            });

            for (
                const record of
                    this.#insertedRanges
            ) {
                this.#renderInsertedRecord(record);

                const rendered =
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerInserted ===
                                    record.id
                        );

                const snapshots =
                    record.preservedAttributes ?? [];

                for (
                    const range of
                        rendered
                ) {
                    const start =
                        Number(
                            range.clockTimerStart
                        );

                    const end =
                        Number(
                            range.clockTimerEnd
                        );

                    let best;
                    let bestOverlap =
                        -1;

                    for (
                        const snapshot of
                            snapshots
                    ) {
                        let overlap = 0;

                        if (
                            Number.isFinite(start) &&
                            Number.isFinite(end) &&
                            Number.isFinite(snapshot.start) &&
                            Number.isFinite(snapshot.end)
                        ) {
                            overlap =
                                Math.max(
                                    0,
                                    Math.min(end, snapshot.end) -
                                    Math.max(start, snapshot.start)
                                );
                        }
                        else if (
                            Number.isFinite(start) &&
                            Number.isFinite(snapshot.start) &&
                            start === snapshot.start
                        ) {
                            overlap = 1;
                        }

                        if (
                            overlap > bestOverlap
                        ) {
                            best =
                                snapshot;

                            bestOverlap =
                                overlap;
                        }
                    }

                    if (best) {
                        this.#applyPreservedAttributes(
                            range,
                            best.attributes
                        );
                    }

                    if (
                        this.#isIntervalApprovalManaged(
                            record
                        )
                    ) {
                        range.clockTimerInternalMutation =
                            true;

                        try {
                            this.#applyOtherAttributes(
                                range,
                                record.otherAttributes
                            );
                        }
                        finally {
                            delete range.clockTimerInternalMutation;
                        }

                        range.clockTimerApprovalReadOnly =
                            true;
                    }
                }
            }

            this.#reapplyOverwriteRanges();

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined
            );
        }

        #shiftScheduleMarkers(
            cutoff,
            delta
        ) {
            if (
                !this.#started ||
                !Number.isFinite(delta) ||
                delta === 0
            ) {
                return;
            }

            if (
                Number.isFinite(
                    this.#scheduledStartMilliseconds
                ) &&
                this.#scheduledStartMilliseconds >= cutoff
            ) {
                this.#scheduledStartMilliseconds += delta;

                this.#scheduledStart =
                    this.#formatTimelineTime(
                        this.#scheduledStartMilliseconds
                    );
            }

            if (
                Number.isFinite(this.#tripEnd) &&
                this.#tripEnd >= cutoff
            ) {
                this.#tripEnd += delta;
            }

            if (
                Number.isFinite(this.#standardEnd) &&
                this.#standardEnd >= cutoff
            ) {
                this.#standardEnd += delta;
            }

            if (
                Number.isFinite(this.#calculatedEnd) &&
                this.#calculatedEnd >= cutoff
            ) {
                this.#calculatedEnd += delta;
            }

            if (
                Number.isFinite(this.#toleranceEnd) &&
                this.#toleranceEnd >= cutoff
            ) {
                this.#toleranceEnd += delta;
            }
        }

        #shiftInsertedRangeElements(
            cutoff,
            delta,
            excludedRecord
        ) {
            const excludedId =
                excludedRecord?.id;

            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerInserted !==
                                undefined &&
                            range.clockTimerInserted !==
                                excludedId &&
                            range.timeRangeExiting !==
                                true
                    );

            for (const range of ranges) {
                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= cutoff
                ) {
                    continue;
                }

                if (start >= cutoff) {
                    this.#replaceRangeWithSegments(
                        range,
                        [[
                            start + delta,
                            end + delta
                        ]]
                    );

                    continue;
                }

                this.#replaceRangeWithSegments(
                    range,
                    [
                        [
                            start,
                            cutoff
                        ],
                        [
                            cutoff + delta,
                            end + delta
                        ]
                    ]
                );
            }
        }

        #shiftDisplacedOverwriteRecords(
            cutoff,
            delta
        ) {
            if (
                !Number.isFinite(cutoff) ||
                !Number.isFinite(delta) ||
                delta <= 0
            ) {
                return;
            }

            const next = [];

            for (
                const record of
                    this.#overwriteRanges
            ) {
                if (
                    record.openEnded === true ||
                    !Number.isFinite(record.start) ||
                    !Number.isFinite(record.end) ||
                    record.end <= cutoff
                ) {
                    next.push(record);
                    continue;
                }

                if (record.start >= cutoff) {
                    record.start += delta;
                    record.end += delta;

                    next.push(record);
                    continue;
                }

                const right = {
                    ...record,
                    id:
                        `overwrite-${Date.now()}-${Math.random()}`,
                    start:
                        cutoff + delta,
                    end:
                        record.end + delta,
                    clockTimerGrowthMode:
                        "fixed"
                };

                record.end =
                    cutoff;

                next.push(
                    record,
                    right
                );

                for (
                    const range of
                        this.#getManagedTimeRanges()
                ) {
                    if (
                        range.clockTimerOverwrite !==
                            record.id ||
                        range.timeRangeExiting ===
                            true
                    ) {
                        continue;
                    }

                    const rangeStart =
                        Number(
                            range.clockTimerStart
                        );

                    if (
                        Number.isFinite(rangeStart) &&
                        rangeStart >= right.start
                    ) {
                        range.clockTimerOverwrite =
                            right.id;
                    }
                }
            }

            this.#overwriteRanges =
                next;
        }

        #syncOpenEndedRangeElements(
            record,
            effectiveEnd
        ) {
            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            if (
                !Number.isFinite(start) ||
                !Number.isFinite(effectiveEnd) ||
                effectiveEnd <= start
            ) {
                return;
            }

            const existing =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.clockTimerInserted ===
                                record.id &&
                            range.timeRangeExiting !==
                                true
                    )
                    .sort(
                        (a, b) =>
                            Number(a.clockTimerStart) -
                            Number(b.clockTimerStart)
                    );

            let cursor =
                start;

            let index =
                0;

            while (cursor < effectiveEnd) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentEnd =
                    Math.min(
                        effectiveEnd,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                let range =
                    existing[index];

                if (!range) {
                    range =
                        this.#createTimeRange(
                            record.type,
                            cursor,
                            segmentEnd,
                            { dynamic: true }
                        );

                    delete range.clockTimerDynamic;

                    range.clockTimerInserted =
                        record.id;

                    this.#applyOtherAttributes(
                        range,
                        record.otherAttributes
                    );

                    ring.appendChild(
                        range
                    );
                }
                else {
                    if (
                        range.parentElement !==
                            ring
                    ) {
                        ring.appendChild(
                            range
                        );
                    }

                    this.#setRangeTiming(
                        range,
                        cursor,
                        segmentEnd
                    );
                }

                cursor =
                    segmentEnd;

                index++;
            }

            for (
                ;
                index < existing.length;
                index++
            ) {
                const range =
                    existing[index];

                if (
                    typeof this.#getRangeRenderer(range)?.removeRangeAnimated === "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#removeRangeAnimated(range,{
                        collapseTo: 'start'
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #shiftRangesAfter(
            cutoff,
            delta,
            excludedRecord,
            renderInserted = true
        ) {
            if (
                !Number.isFinite(delta) ||
                delta <= 0
            ) {
                return;
            }

            this.#captureInsertedAttributes();

            this.#shiftExistingTimeRanges(
                cutoff,
                delta
            );

            if (
                (
                    excludedRecord?.clockTimerGrowthMode ??
                        "fixed"
                ) === "displace"
            ) {
                this.#shiftDisplacedOverwriteRecords(
                    cutoff,
                    delta
                );
            }

            if (!renderInserted) {
                this.#shiftInsertedRangeElements(
                    cutoff,
                    delta,
                    excludedRecord
                );
            }

            for (
                const record of
                    this.#insertedRanges
            ) {
                if (
                    record === excludedRecord
                ) {
                    continue;
                }

                const start =
                    this.#dateToTimelineTime(
                        record.startDate
                    );

                if (start < cutoff) {
                    continue;
                }

                record.startDate =
                    new Date(
                        record.startDate.getTime() +
                        delta
                    );

                if (record.endDate) {
                    record.endDate =
                        new Date(
                            record.endDate.getTime() +
                            delta
                        );
                }

                if (
                    Array.isArray(
                        record.preservedAttributes
                    )
                ) {
                    for (
                        const snapshot of
                            record.preservedAttributes
                    ) {
                        if (
                            Number.isFinite(snapshot.start)
                        ) {
                            snapshot.start += delta;
                        }

                        if (
                            Number.isFinite(snapshot.end)
                        ) {
                            snapshot.end += delta;
                        }
                    }
                }
            }

            if (
                this.#started
            ) {
                this.#shiftScheduleMarkers(
                    cutoff,
                    delta
                );
            }

            this.#rebuildOvertimeRangeMap();
            this.#removeEmptyRings();

            if (renderInserted) {
                this.#renderAllInsertedRanges();
            }

            if (
                this.#started
            ) {
                this.#reorderRings(
                    this.#getCurrentTimelineTime()
                );
            }
        }

        #updateOpenEndedRangeTo(
            now
        ) {
            const record =
                this.#openEndedRange;

            if (
                !record ||
                !Number.isFinite(now)
            ) {
                return;
            }

            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            const previous =
                Number.isFinite(
                    this.#openEndedLastTick
                )
                    ? this.#openEndedLastTick
                    : start;

            if (now <= previous) {
                return;
            }

            const delta =
                now - previous;

            this.#extendCalculatedEndTime(
                delta,
                record.type
            );

            this.#openEndedLastTick =
                now;

            this.#shiftRangesAfter(
                previous,
                delta,
                record,
                false
            );

            this.#syncOpenEndedRangeElements(
                record,
                now
            );

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : now
            );
        }

        #updateOpenEndedRange(
            nowDate
        ) {
            this.#updateOpenEndedRangeTo(
                this.#dateToTimelineTime(
                    nowDate
                )
            );
        }

        #refreshRingLayout(
            now,
            {
                refreshTickMarks = false
            } = {}
        ) {
            this.#mergeAdjacentIdenticalRanges();

            const duration =
                this.#getRangeAnimationDuration();

            for (
                const ring of
                    this.querySelectorAll(
                        ":scope > ring-container"
                    )
            ) {
                if (
                    ring.clockTimerExitingRing ===
                        true
                ) {
                    continue;
                }

                ring.resizeDuration =
                    `${duration}ms`;
            }

            this.#removeEmptyRings();

            if (
                this.#started
            ) {
                const current =
                    Number.isFinite(
                        now
                    )
                        ? now
                        : this.#getCurrentTimelineTime();

                this.#reorderRings(
                    current
                );
            }
            else {
                this.#ensurePermanentRingOrder();
            }

            this.#scheduleHourRender();
            this.#scheduleIndicatorSymbolUpdate();
            this.#syncWaveRange();

            this.#refreshRadialFittedLayouts(
                now,
                {
                    suspendLayout:
                        !this.#timerTypeTransitioning
                }
            );

            if (
                !this.hasAttribute(
                    "tick-marks"
                )
            ) {
                return;
            }

            if (
                refreshTickMarks
            ) {
                this.#updateTickMarks(
                    new Date()
                );

                return;
            }

            this.#syncTickMarkGeometry();
        }

        #syncIndicatorSymbolContent() {
            if (!this.#indicatorSymbol) {
                return;
            }

            const symbol =
                this.getAttribute(
                    "indicator-symbol"
                );

            this.#indicatorSymbol.textContent =
                symbol === null ||
                symbol === ""
                    ? "▲"
                    : symbol;
        }

        #setIndicatorSymbolVisible(visible) {
            if (!this.#indicatorRing) {
                return;
            }

            this.#indicatorRing.style.opacity = visible ? "1" : "0";
        }

        #scheduleIndicatorSymbolUpdate() {
            if (this.#indicatorFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorFrame);
            }

            this.#indicatorFrame = requestAnimationFrame(() => {
                this.#indicatorFrame = undefined;
                this.#updateIndicatorSymbol();
            });
        }

        #getIndicatorRingMetrics(ring) {
            if (!ring || ring.localName !== "ring-container") {
                return undefined;
            }

            const inset = Number.parseFloat(
                ring.renderedInset ?? ring.inset ?? "0"
            );

            const width = Number.parseFloat(
                ring.renderedWidth ?? ring.width ?? "0"
            );

            if (!Number.isFinite(inset) || !Number.isFinite(width)) {
                return undefined;
            }

            return {
                inset,
                width,
                outer: inset - width / 2,
                inner: inset + width / 2
            };
        }

        #isIndicatorReferenceRingVisible(ring) {
            const metrics = this.#getIndicatorRingMetrics(ring);

            if (!metrics || metrics.width <= 0) {
                return false;
            }

            const style = getComputedStyle(ring);

            return style.display !== "none" &&
                style.visibility !== "hidden" &&
                Number.parseFloat(style.opacity || "1") > 0;
        }

        #getIndicatorBottomInset(activeRing, activeMetrics) {
            if (
                this.#borderRing &&
                this.#borderRing !== activeRing &&
                this.#isIndicatorReferenceRingVisible(this.#borderRing)
            ) {
                const metrics = this.#getIndicatorRingMetrics(this.#borderRing);

                if (metrics) {
                    return metrics.inner;
                }
            }

            const inactiveMetrics = this.#getTimerRings()
                .filter(ring =>
                    ring !== activeRing &&
                    !ring.hasAttribute("active") &&
                    !ring.clockTimerExitingRing
                )
                .map(ring => this.#getIndicatorRingMetrics(ring))
                .filter(Boolean)
                .sort((a, b) => a.outer - b.outer);

            if (inactiveMetrics.length > 0) {
                return inactiveMetrics[0].outer;
            }

            if (
                this.hasAttribute("tick-marks") &&
                this.#tickMarkLayer &&
                this.#tickMarkLayer.childElementCount > 0
            ) {
                const inset = Number.parseFloat(this.#getTickInset());

                if (Number.isFinite(inset)) {
                    return inset;
                }
            }

            if (
                this.#hourLayer &&
                this.#hourLayer.childElementCount > 0 &&
                this.#numberRing
            ) {
                const inset = Number.parseFloat(
                    this.#numberRing.renderedInset ??
                    this.#getRingInset(this.#numberRing)
                );

                if (Number.isFinite(inset)) {
                    return inset;
                }
            }

            return activeMetrics.inner;
        }

        #freezeIndicatorForRingHandoff(
            now
        ) {
            if (
                this.#indicatorHandoffFrozen ||
                !this.hasAttribute(
                    "indicator-symbol"
                ) ||
                !this.#started ||
                !this.#elapsedRange ||
                !Number.isFinite(now)
            ) {
                return;
            }

            const currentRing =
                this.#elapsedRange.parentElement;

            if (
                !currentRing ||
                currentRing.localName !==
                    "ring-container" ||
                !currentRing.hasAttribute(
                    "active"
                )
            ) {
                return;
            }

            const currentRingIndex =
                Number(
                    currentRing.clockTimerRingIndex
                );

            const nextRingIndex =
                this.#getTimerRingIndex(
                    now
                );

            if (
                !Number.isFinite(
                    currentRingIndex
                ) ||
                currentRingIndex ===
                    nextRingIndex
            ) {
                return;
            }

            const millisecondsIntoHour =
                (
                    now % ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;

            const boundaryAngle =
                (
                    millisecondsIntoHour /
                    ClockTimer.#HOUR
                ) * 360;

            this.#indicatorTrack.style.transform =
                `rotate(${boundaryAngle}deg)`;

            this.#setIndicatorSymbolVisible(
                true
            );

            this.#indicatorHandoffFrozen =
                true;

            if (
                this.#indicatorHandoffTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#indicatorHandoffTimeout
                );
            }

            const duration =
                this.#getRangeAnimationDuration();

            this.#indicatorHandoffTimeout =
                setTimeout(
                    () => {
                        this.#indicatorHandoffTimeout =
                            undefined;

                        this.#indicatorHandoffFrozen =
                            false;

                        this.#updateIndicatorSymbol();
                    },
                    Math.max(
                        0,
                        duration
                    )
                );
        }

        #updateIndicatorSymbol() {
            if (!this.#indicatorRing || !this.#indicatorTrack || !this.#indicatorSymbol) {
                return;
            }

            if (this.#indicatorHandoffFrozen) {
                this.#setIndicatorSymbolVisible(true);
                return;
            }

            if (
                this.#timerTypeIndicatorFrozen &&
                this.#timerTypeTransitionState
                    ?.indicatorUsed
            ) {
                this.#setIndicatorSymbolVisible(
                    true
                );

                return;
            }

            if (
                !this.hasAttribute(
                    "indicator-symbol"
                ) ||
                !this.#started
            ) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            let ring =
                this.#elapsedRange?.isConnected
                    ? this.#elapsedRange.parentElement
                    : undefined;

            let end =
                this.#elapsedRange?.isConnected
                    ? Number(
                        this.#elapsedRange.clockTimerEnd
                    )
                    : undefined;

            if (
                (
                    !ring ||
                    !Number.isFinite(end)
                ) &&
                this.#stateChangeVisualState
            ) {
                ring =
                    this.#getStateChangeActiveRing();

                end =
                    this.#getCurrentTimelineTime();
            }

            if (
                !ring ||
                ring.localName !==
                    "ring-container" ||
                !ring.hasAttribute(
                    "active"
                )
            ) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const ringIndex =
                Number(
                    ring.clockTimerRingIndex
                );

            if (!Number.isFinite(end) || !Number.isFinite(ringIndex)) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const normalizedAngle =
                this.#getIndicatorAngleForTime(
                    end
                );

            if (
                !Number.isFinite(
                    normalizedAngle
                )
            ) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const activeMetrics =
                this.#getIndicatorRingMetrics(ring);

            if (!activeMetrics) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const outerGap = 1;
            const topInset = Math.max(
                0,
                activeMetrics.outer + outerGap
            );

            let bottomInset =
                this.#getIndicatorBottomInset(
                    ring,
                    activeMetrics
                );

            if (
                !Number.isFinite(bottomInset) ||
                bottomInset <= topInset
            ) {
                bottomInset = activeMetrics.inner;
            }

            const radialSpan = Math.max(
                1,
                bottomInset - topInset
            );

            this.#indicatorRing.style.inset = `${topInset}px`;
            this.#indicatorSymbol.style.height = `${radialSpan}px`;
            this.#indicatorSymbol.style.fontSize = `${radialSpan}px`;

            if (!this.#timerTypeIndicatorFrozen) {
                this.#indicatorTrack.style.transform =
                    `rotate(${normalizedAngle}deg)`;
            }

            this.#setIndicatorSymbolVisible(!this.#starting);
        }

        #needsTick() {
            return (
                this.#started ||
                Boolean(
                    this.#openEndedRange
                ) ||
                Boolean(
                    this.#openOverwriteRange
                )
            );
        }

        #hasDisplacingOpenRange() {
            const record =
                this.#openEndedRange;

            if (
                !record ||
                record.openEnded !== true
            ) {
                return false;
            }

            return (
                record.clockTimerGrowthMode ??
                    "displace"
            ) === "displace";
        }

        #normalizeTickDate(
            date
        ) {
            const targetMilliseconds =
                Number.isFinite(
                    this.#tickAlignmentMilliseconds
                )
                    ? this.#millisecondsComponent(
                        this.#tickAlignmentMilliseconds
                    )
                    : 0;

            const currentMilliseconds =
                date.getMilliseconds();

            const elapsedPastCadence =
                (
                    currentMilliseconds -
                    targetMilliseconds +
                    1000
                ) % 1000;

            return new Date(
                date.getTime() -
                elapsedPastCadence
            );
        }

        #buildPlannedRanges(
            startTimeMilliseconds =
                this.#scheduledStartMilliseconds
        ) {
            if (
                !this.#started
            ) {
                return;
            }

            if (
                startTimeMilliseconds !==
                    undefined &&
                this.#scheduledStartMilliseconds >
                    startTimeMilliseconds
            ) {
                this.#createSpan(
                    "earlystart",
                    startTimeMilliseconds,
                    this.#scheduledStartMilliseconds
                );
            }

            if (
                startTimeMilliseconds !==
                    undefined &&
                startTimeMilliseconds >
                    this.#scheduledStartMilliseconds
            ) {
                this.#createSpan(
                    "latency",
                    this.#scheduledStartMilliseconds,
                    startTimeMilliseconds
                );
            }

            const tripStart =
                this.#scheduledStartMilliseconds;

            this.#standardEnd =
                tripStart +
                this.#standardDuration;

            this.#calculatedEnd =
                tripStart +
                Math.round(
                    this.#standardDuration /
                    this.#renderedPercentGoal
                );

            if (
                this.#renderedPercentGoal >
                    1
            ) {
                const tripRenderEnd =
                    this.#showTolerance === false
                        ? this.#standardEnd
                        : this.#calculatedEnd;

                this.#tripEnd =
                    tripRenderEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                this.#createSpan(
                    "trip",
                    tripStart,
                    tripRenderEnd
                );

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        tripRenderEnd
                ) {
                    this.#createSpan(
                        "tolerance",
                        tripRenderEnd,
                        toleranceRenderEnd
                    );
                }

                return;
            }

            this.#tripEnd =
                this.#standardEnd;

            this.#toleranceEnd =
                undefined;

            this.#createSpan(
                "trip",
                tripStart,
                this.#standardEnd
            );

            if (
                this.#renderedPercentGoal <
                    1
            ) {
                this.#createSpan(
                    "overtime",
                    this.#standardEnd,
                    this.#calculatedEnd
                );
            }
        }

        #createSpan(
            type,
            start,
            end
        ) {
            if (
                !Number.isFinite(
                    start
                ) ||
                !Number.isFinite(
                    end
                ) ||
                end <=
                    start
            ) {
                return [];
            }

            const ranges =
                [];

            let cursor =
                start;

            while (
                cursor <
                    end
            ) {
                const ringIndex =
                    this.#getTimerRingIndex(
                        cursor
                    );

                const ringStart =
                    this.#getTimerRingStart(
                        ringIndex
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentEnd =
                    Math.min(
                        end,
                        ringEnd
                    );

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const range =
                    this.#createTimeRange(
                        type,
                        cursor,
                        segmentEnd
                    );

                ring.appendChild(
                    range
                );

                ranges.push(
                    range
                );

                cursor =
                    segmentEnd;
            }

            return ranges;
        }

        #createTimeRange(
            type,
            start,
            end,
            {
                dynamic = false
            } = {}
        ) {
            const range =
                document.createElement(
                    "time-range"
                );

            range.setAttribute(
                "type",
                type
            );

            this.#ensureIntervalIdAttribute(
                range
            );

            if (
                type === "elapsed" ||
                type === "remaining"
            ) {
                range.classList.add(
                    type
                );

                range.setAttribute(
                    "overlapping",
                    ""
                );
            }

            range.setAttribute(
                "start-time",
                this.#formatTimelineTime(
                    start
                )
            );

            range.setAttribute(
                "end-time",
                this.#formatTimelineTime(
                    end
                )
            );

            range.clockTimerStart =
                String(
                    start
                );

            range.clockTimerEnd =
                String(
                    end
                );

            if (
                dynamic
            ) {
                range.clockTimerDynamic =
                    type;
            }
            else {
                range.clockTimerPlanned =
                    "";
            }

            return range;
        }

        #updateElapsedRange(
            now
        ) {
            if (
                !this.#started ||
                this.#stateChangeVisualState
            ) {
                return;
            }

            const ringIndex =
                this.#getTimerRingIndex(
                    now
                );

            const ringStart =
                this.#getTimerRingStart(
                    ringIndex
                );

            const ring =
                this.#ensureRing(
                    ringIndex
                );

            if (
                !this.#elapsedRange ||
                this.#elapsedRange.parentElement !==
                    ring
            ) {
                if (
                    now <=
                        ringStart
                ) {
                    this.#elapsedRange =
                        undefined;

                    return;
                }

                this.#elapsedRange =
                    this.#createTimeRange(
                        "elapsed",
                        ringStart,
                        now,
                        {
                            dynamic: true
                        }
                    );

                this.#elapsedRange.clockTimerElapsed =
                    "";

                ring.appendChild(
                    this.#elapsedRange
                );

                this.#prepareTimerTypeTransitionVisualRange(
                    this.#elapsedRange
                );

                return;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted" &&
                Number(
                    this.#elapsedRange.clockTimerStart
                ) !== ringStart
            ) {
                this.#setRangeStart(
                    this.#elapsedRange,
                    ringStart
                );
            }

            this.#setRangeEnd(
                this.#elapsedRange,
                now
            );

        }

        #getLatestTimerEnd() {
            let latest;

            const ignoredTypes =
                new Set([
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (
                const range of
                    this.querySelectorAll(
                        "ring-container > time-range"
                    )
            ) {
                if (
                    range.timeRangeExiting === true ||
                    ignoredTypes.has(
                        range.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    (
                        !Number.isFinite(latest) ||
                        end > latest
                    )
                ) {
                    latest = end;
                }
            }

            return latest;
        }

        #removeRemainingRanges() {
            for (
                const range of
                    this.#remainingRanges.values()
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            this.#remainingRanges.clear();
        }

        #updateRemainingRanges(
            start
        ) {
            if (this.#stateChangeVisualState) {
                return;
            }

            if (
                !Number.isFinite(
                    start
                )
            ) {
                this.#removeRemainingRanges();
                return;
            }

            const visibleTimerEnd =
                this.#getLatestTimerEnd();

            const latestEnd =
                this.#renderedPercentGoal > 1 &&
                this.#started
                    ? visibleTimerEnd
                    : (
                        Number.isFinite(
                            this.#calculatedEndTime
                        )
                            ? this.#calculatedEndTime
                            : visibleTimerEnd
                    );

            if (
                !Number.isFinite(latestEnd) ||
                latestEnd <= start
            ) {
                this.#removeRemainingRanges();
                return;
            }

            const firstRing =
                this.#getTimerRingIndex(
                    start
                );

            const lastRing =
                this.#getTimerRingIndex(
                    latestEnd - 0.0001
                );

            for (
                const [ringIndex, range] of
                    this.#remainingRanges
            ) {
                if (
                    ringIndex < firstRing ||
                    ringIndex > lastRing ||
                    !range.isConnected
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.remove();
                    this.#remainingRanges.delete(
                        ringIndex
                    );
                }
            }

            for (
                let ringIndex = firstRing;
                ringIndex <= lastRing;
                ringIndex++
            ) {
                const ringStart =
                    this.#getTimerRingStart(
                        ringIndex
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentStart =
                    Math.max(
                        start,
                        ringStart
                    );

                const segmentEnd =
                    Math.min(
                        latestEnd,
                        ringEnd
                    );

                if (segmentEnd <= segmentStart) {
                    continue;
                }

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                let range =
                    this.#remainingRanges.get(
                        ringIndex
                    );

                if (
                    !range ||
                    range.parentElement !== ring
                ) {
                    range =
                        this.#createTimeRange(
                            "remaining",
                            segmentStart,
                            segmentEnd,
                            {
                                dynamic: true
                            }
                        );

                    range.clockTimerRemaining =
                        "";

                    range.timeRangeFullEntry =
                        true;

                    ring.appendChild(
                        range
                    );

                    this.#prepareTimerTypeTransitionVisualRange(
                        range
                    );

                    this.#remainingRanges.set(
                        ringIndex,
                        range
                    );
                }
                else {
                    this.#setRangeTiming(
                        range,
                        segmentStart,
                        segmentEnd,
                        range.hasAttribute(
                            "range-length"
                        )
                    );
                }

                range.setAttribute(
                    "overlapping",
                    ""
                );
            }
        }

        #updateOvertimeRanges(
            now
        ) {
            if (
                !this.#started ||
                !Number.isFinite(
                    this.#standardEnd
                )
            ) {
                return;
            }

            if (
                now <=
                    this.#standardEnd
            ) {
                return;
            }

            const overtimeStart =
                this.#standardEnd;

            const firstRing =
                this.#getTimerRingIndex(
                    overtimeStart
                );

            const lastRing =
                this.#getTimerRingIndex(
                    now -
                    0.0001
                );

            for (
                let ringIndex =
                    firstRing;
                ringIndex <=
                    lastRing;
                ringIndex++
            ) {
                const ringStart =
                    this.#getTimerRingStart(
                        ringIndex
                    );

                const ringEnd =
                    this.#getTimerRingEnd(ringIndex);

                const segmentStart =
                    Math.max(
                        overtimeStart,
                        ringStart
                    );

                const segmentEnd =
                    Math.min(
                        now,
                        ringEnd
                    );

                if (
                    segmentEnd <=
                        segmentStart
                ) {
                    continue;
                }

                const ring =
                    this.#ensureRing(
                        ringIndex
                    );

                const overtimeRanges =
                    Array.from(
                        ring.querySelectorAll(
                            ':scope > time-range[type="overtime"]'
                        )
                    );

                let range =
                    overtimeRanges.find(
                        candidate => {
                            const start =
                                Number(
                                    candidate.clockTimerStart
                                );

                            const end =
                                Number(
                                    candidate.clockTimerEnd
                                );

                            return (
                                Number.isFinite(
                                    start
                                ) &&
                                Number.isFinite(
                                    end
                                ) &&
                                start <=
                                    segmentStart &&
                                end >=
                                    segmentStart
                            );
                        }
                    );

                if (!range) {
                    range =
                        overtimeRanges.find(
                            candidate => {
                                const start =
                                    Number(
                                        candidate.clockTimerStart
                                    );

                                return (
                                    Number.isFinite(
                                        start
                                    ) &&
                                    start >
                                        segmentStart
                                );
                            }
                        );
                }

                if (!range) {
                    range =
                        this.#createTimeRange(
                            "overtime",
                            segmentStart,
                            segmentEnd,
                            {
                                dynamic: true
                            }
                        );

                    range.clockTimerOvertime =
                        "";

                    ring.appendChild(
                        range
                    );
                }
                else {
                    const existingStart =
                        Number(
                            range.clockTimerStart
                        );

                    const existingEnd =
                        Number(
                            range.clockTimerEnd
                        );

                    if (
                        !Number.isFinite(
                            existingStart
                        ) ||
                        existingStart >
                            segmentStart
                    ) {
                        this.#setRangeStart(
                            range,
                            segmentStart
                        );
                    }

                    if (
                        !Number.isFinite(
                            existingEnd
                        ) ||
                        segmentEnd >
                            existingEnd
                    ) {
                        this.#setRangeEnd(
                            range,
                            segmentEnd
                        );
                    }
                }

                range.clockTimerOvertime =
                    "";

                this.#overtimeRanges.set(
                    ringIndex,
                    range
                );
            }
        }

        #setRangeStart(
            range,
            milliseconds
        ) {
            const end =
                Number(
                    range?.clockTimerEnd
                );

            if (
                Number.isFinite(end) &&
                end > milliseconds
            ) {
                return this.#setRangeTiming(
                    range,
                    milliseconds,
                    end,
                    range.hasAttribute(
                        "range-length"
                    )
                );
            }

            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "start-time"
                ) !== formatted
            ) {
                range.setAttribute(
                    "start-time",
                    formatted
                );
            }

            range.clockTimerStart =
                String(milliseconds);

            return true;
        }

        #setRangeEnd(
            range,
            milliseconds
        ) {
            const start =
                Number(
                    range?.clockTimerStart
                );

            if (
                Number.isFinite(start) &&
                milliseconds > start
            ) {
                return this.#setRangeTiming(
                    range,
                    start,
                    milliseconds,
                    range.hasAttribute(
                        "range-length"
                    )
                );
            }

            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "end-time"
                ) !== formatted
            ) {
                range.setAttribute(
                    "end-time",
                    formatted
                );
            }

            range.clockTimerEnd =
                String(milliseconds);

            return true;
        }

        #ensureRing(
            ringIndex
        ) {
            let ring =
                this.#rings.get(
                    ringIndex
                );

            if (ring) {
                return ring;
            }

            this.#ensureBorderRing();

            this.#ensureTickRing();

            this.#ensureHandRing();

            const numberRing =
                this.#ensureNumberRing();

            ring =
                document.createElement(
                    "ring-container"
                );

            ring.clockTimerRing =
                "";

            ring.clockTimerRingIndex =
                String(
                    ringIndex
                );

            ring.clockTimerExternalRangeLayout =
                this.#getTimerType() ===
                    "radial-fitted";

            const initialWidth =
                "var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))";

            if (
                this.#starting ||
                this.#timerTypeTransitionBuilding
            ) {
                ring.clockTimerTargetWidth =
                    initialWidth;

                ring.setAttribute(
                    "width",
                    "0px"
                );

                ring.resizeDuration =
                    `${this.#getRangeAnimationDuration()}ms`;
            }
            else {
                ring.setAttribute(
                    "width",
                    initialWidth
                );
            }

            this.#rings.set(
                ringIndex,
                ring
            );

            this.insertBefore(
                ring,
                numberRing
            );

            return ring;
        }

        #reorderRings(
            now
        ) {
            if (
                this.#timerTypeTransitioning &&
                !this.#timerTypeTransitionBuilding
            ) {
                return;
            }

            const borderRing =
                this.#ensureBorderRing();

            const tickRing =
                this.#ensureTickRing();

            const handRing =
                this.#ensureHandRing();

            const numberRing =
                this.#ensureNumberRing();

            if (
                this.#rings.size ===
                    0
            ) {
                this.#ensurePermanentRingOrder();

                return;
            }

            const activeIndex =
                this.#getTimerRingIndex(
                    now
                );

            const activeRing =
                this.#ensureRing(
                    activeIndex
                );

            const becomingInactiveRing =
                Array.from(
                    this.#rings.values()
                ).find(
                    ring =>
                        ring !== activeRing &&
                        ring.hasAttribute(
                            "active"
                        )
                );

            if (becomingInactiveRing) {
                if (
                    this.#ringLayerHandoffTimeout !==
                        undefined
                ) {
                    clearTimeout(
                        this.#ringLayerHandoffTimeout
                    );
                }

                for (
                    const ring of
                        this.#rings.values()
                ) {
                    ring.style.zIndex =
                        "0";
                }

                becomingInactiveRing.style.zIndex =
                    "1";

                activeRing.style.zIndex =
                    "2";

                const duration =
                    this.#getRangeAnimationDuration();

                this.#ringLayerHandoffTimeout =
                    setTimeout(
                        () => {
                            this.#ringLayerHandoffTimeout =
                                undefined;

                            for (
                                const ring of
                                    this.#rings.values()
                            ) {
                                ring.style.removeProperty(
                                    "z-index"
                                );
                            }
                        },
                        Math.max(
                            0,
                            duration
                        )
                    );
            }

            const inactive =
                Array.from(
                    this.#rings.entries()
                )
                .filter(
                    ([
                        ringIndex
                    ]) =>
                        ringIndex !==
                            activeIndex
                )
                .sort(
                    (
                        [a],
                        [b]
                    ) =>
                        b - a
                )
                .map(
                    ([
                        ,
                        ring
                    ]) =>
                        ring
                );

            for (
                const [
                    ringIndex,
                    ring
                ] of
                    this.#rings
            ) {
                const active =
                    ringIndex ===
                        activeIndex;

                const width =
                    active
                        ?
                        "var(--clock-timer-active-ring-width, clamp(4px, 2.5cqi, 12px))"
                        :
                        "var(--clock-timer-inactive-ring-width, clamp(2px, 1.25cqi, 6px))";

                if (
                    this.#starting ||
                    this.#timerTypeTransitionBuilding
                ) {
                    ring.clockTimerTargetWidth =
                        width;

                    if (
                        ring.width !== "0px"
                    ) {
                        ring.setAttribute(
                            "width",
                            "0px"
                        );
                    }
                }
                else if (
                    ring.width !==
                        width
                ) {
                    ring.setAttribute(
                        "width",
                        width
                    );
                }

                if (
                    active
                ) {
                    if (
                        !ring.hasAttribute(
                            "active"
                        )
                    ) {
                        ring.setAttribute(
                            "active",
                            ""
                        );
                    }
                }
                else if (
                    ring.hasAttribute(
                        "active"
                    )
                ) {
                    ring.removeAttribute(
                        "active"
                    );
                }
            }

            const order = [
                activeRing,
                borderRing,
                ...inactive,
                tickRing,
                handRing,
                numberRing
            ];

            const managed =
                new Set(
                    order
                );

            const currentOrder =
                Array.from(
                    this.children
                ).filter(
                    child =>
                        managed.has(
                            child
                        )
                );

            const orderChanged =
                currentOrder.length !==
                    order.length ||
                order.some(
                    (
                        ring,
                        index
                    ) =>
                        currentOrder[index] !==
                            ring
                );

            if (
                !orderChanged
            ) {
                return;
            }

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (
                RingContainerClass &&
                typeof RingContainerClass.reorder ===
                    "function"
            ) {
                RingContainerClass.reorder(
                    ...order
                );

                return;
            }

            for (
                const ring of
                    order
            ) {
                this.appendChild(
                    ring
                );
            }
        }

        #getTimerRingIndex(
            milliseconds
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                return 0;
            }

            return this.#getRingIndex(
                milliseconds
            );
        }

        #getTimerRingStart(
            ringIndex
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    this.#getRadialFittedBounds();

                if (bounds) {
                    return bounds.start;
                }

                if (
                    Number.isFinite(
                        this.#scheduledStartMilliseconds
                    )
                ) {
                    return this.#scheduledStartMilliseconds;
                }

                if (
                    Number.isFinite(
                        this.#ringAnchor
                    )
                ) {
                    return this.#ringAnchor;
                }

                return 0;
            }

            return this.#getRingStart(
                ringIndex
            );
        }

        #getTimerRingEnd(
            ringIndex
        ) {
            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                return Infinity;
            }

            return (
                this.#getRingStart(
                    ringIndex
                ) +
                ClockTimer.#HOUR
            );
        }

        #getRingIndex(
            milliseconds
        ) {
            return Math.floor(
                (
                    milliseconds -
                    this.#ringAnchor
                ) /
                    ClockTimer.#HOUR
            );
        }

        #getRingStart(
            ringIndex
        ) {
            return (
                this.#ringAnchor +
                ringIndex *
                    ClockTimer.#HOUR
            );
        }

        #removeEmptyRings() {
            for (
                const [
                    ringIndex,
                    ring
                ] of
                    this.#rings
            ) {
                if (
                    ring.children.length >
                        0 ||
                    ring.clockTimerToleranceTransitionHold ===
                        true
                ) {
                    continue;
                }

                ring.remove();

                this.#rings.delete(
                    ringIndex
                );
            }
        }

        #removePlannedRanges() {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerPlanned !==
                                    undefined
                        )
            ) {
                range.remove();
            }
        }

        #removeOvertimeRanges() {
            for (
                const range of
                    this.#overtimeRanges.values()
            ) {
                range.remove();
            }

            this.#overtimeRanges.clear();
        }

        #startDisplayTimer() {
            this.#stopDisplayTimer();

            const scheduleNext =
                () => {
                    if (
                        !this.isConnected
                    ) {
                        return;
                    }

                    const now =
                        new Date();

                    const milliseconds =
                        now.getMilliseconds();

                    const delay =
                        milliseconds ===
                            0
                            ?
                            1000
                            :
                            1000 -
                                milliseconds;

                    this.#displayTimeout =
                        setTimeout(
                            () => {
                                this.#displayTimeout =
                                    undefined;

                                if (
                                    !this.isConnected
                                ) {
                                    return;
                                }

                                const displayNow = new Date();

                                this.#synchronizeHands(
                                    displayNow
                                );

                                this.#updateDisplay(
                                    displayNow
                                );

                                if (!this.#needsTick()) {
                                    this.#emitCadenceTick(
                                        displayNow
                                    );
                                }

                                scheduleNext();
                            },
                            delay
                        );
                };

            this.#updateDisplay(
                new Date()
            );

            scheduleNext();
        }

        #stopDisplayTimer() {
            if (
                this.#displayTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#displayTimeout
                );

                this.#displayTimeout =
                    undefined;
            }
        }

        #startTickTimer() {
            this.#stopTickTimer();

            if (
                !this.#needsTick()
            ) {
                return;
            }

            this.#tick();

            this.#scheduleNextTick();
        }

        #scheduleNextTick() {
            if (!this.#needsTick()) {
                return;
            }

            const targetMilliseconds =
                Number.isFinite(
                    this.#tickAlignmentMilliseconds
                )
                    ? this.#millisecondsComponent(
                        this.#tickAlignmentMilliseconds
                    )
                    : 0;

            const currentMilliseconds =
                new Date().getMilliseconds();

            let delay =
                (
                    targetMilliseconds -
                    currentMilliseconds +
                    1000
                ) % 1000;

            if (delay === 0) {
                delay = 1000;
            }

            this.#tickTimeout =
                setTimeout(
                    () => {
                        this.#tickTimeout =
                            undefined;

                        if (!this.#needsTick()) {
                            return;
                        }

                        this.#tick();

                        this.#scheduleNextTick();
                    },
                    delay
                );
        }

        #stopTickTimer() {
            if (
                this.#tickTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#tickTimeout
                );

                this.#tickTimeout =
                    undefined;
            }
        }

        #processElapsedOverwriteRanges(
            now
        ) {
            const ranges =
                this.#getManagedTimeRanges()
                    .filter(
                        range =>
                            range.timeRangeExiting !== true &&
                            typeof range.clockTimerOverwriteType ===
                                "string" &&
                            range.clockTimerOverwriteType.trim() !==
                                ""
                    );

            for (const range of ranges) {
                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(end) ||
                    now < end
                ) {
                    continue;
                }

                const overwriteType =
                    range.clockTimerOverwriteType.trim();

                delete range.clockTimerOverwriteType;

                this.#overwrite({
                    type: overwriteType
                });
            }
        }

        #tick() {
            if (
                !this.#needsTick()
            ) {
                return;
            }

            const nowDate =
                this.#normalizeTickDate(
                    new Date()
                );

            this.#updateOpenEndedRange(
                nowDate
            );

            this.#updateOpenOverwriteRange(
                nowDate
            );

            if (
                !this.#started
            ) {
                this.#emitCadenceTick(
                    nowDate
                );
                return;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            if (
                this.#showTolerance === undefined &&
                this.#renderedPercentGoal > 1 &&
                !this.#toleranceTransitionState &&
                !this.#hasDisplacingOpenRange()
            ) {
                this.#reconcilePlannedRanges();
            }

            this.#updateIntervalElapsed(now);

            this.#processElapsedOverwriteRanges(
                now
            );

            this.#freezeIndicatorForRingHandoff(
                now
            );

            this.#ensureRing(
                this.#getTimerRingIndex(
                    now
                )
            );

            this.#updateElapsedRange(
                now
            );

            this.#updateOvertimeRanges(
                now
            );

            this.#updateRemainingRanges(
                now
            );

            this.#reapplyOverwriteRanges();

            this.#refreshRingLayout(
                now
            );

            this.#emitCadenceTick(
                nowDate
            );
        }

        #startHandAnimations() {
            this.#ensureHandRing();

            if (
                this.#handStartTimeout !==
                    undefined
            ) {
                clearTimeout(
                    this.#handStartTimeout
                );

                this.#handStartTimeout =
                    undefined;
            }

            this.#handsStarted = true;

            this.#synchronizeHands(
                new Date()
            );
        }

        #stopHandAnimations() {
            this.#secondHandTickAnimation
                ?.cancel();

            this.#secondHandTickAnimation =
                undefined;

            this.#secondHandAngle =
                undefined;

            if (this.#handLayer) {
                this.#handLayer.style.opacity =
                    "0";
            }

            if (this.#tickMarkLayer) {
                this.#tickMarkLayer.style.opacity =
                    "0";
            }

            this.#handsStarted =
                false;
        }

        #synchronizeHands(now = new Date()) {
            this.#ensureHandRing();

            const hours =
                now.getHours() %
                    12;

            const minutes =
                now.getMinutes();

            const seconds =
                now.getSeconds();

            const hourAngle =
                (
                    hours +
                    minutes / 60 +
                    seconds / 3600
                ) * 30;

            const minuteAngle =
                (
                    minutes +
                    seconds / 60
                ) * 6;

            const secondAngle =
                seconds * 6;

            this.#hourHand.style.transform =
                `translate(-50%, -100%) rotate(${hourAngle}deg)`;

            this.#minuteHand.style.transform =
                `translate(-50%, -100%) rotate(${minuteAngle}deg)`;

            const previousSecondAngle =
                Number.isFinite(
                    this.#secondHandAngle
                )
                    ? this.#secondHandAngle
                    : secondAngle;

            const secondAdvance =
                (
                    secondAngle -
                    previousSecondAngle +
                    360
                ) % 360;

            const settledSecondAngle =
                previousSecondAngle +
                secondAdvance;

            this.#secondHand.style.transform =
                `translate(-50%, -100%) rotate(${secondAngle}deg)`;

            this.#secondHandTickAnimation
                ?.cancel();

            if (
                secondAdvance > 0 &&
                !globalThis.matchMedia?.(
                    "(prefers-reduced-motion: reduce)"
                )?.matches
            ) {
                const animation =
                    this.#secondHand.animate(
                        [
                            {
                                transform:
                                    `translate(-50%, -100%) rotate(${previousSecondAngle}deg)`
                            },
                            {
                                offset: 0.78,
                                transform:
                                    `translate(-50%, -100%) rotate(${settledSecondAngle + 0.8}deg)`
                            },
                            {
                                transform:
                                    `translate(-50%, -100%) rotate(${settledSecondAngle}deg)`
                            }
                        ],
                        {
                            duration: 180,
                            easing: "ease-out"
                        }
                    );

                this.#secondHandTickAnimation =
                    animation;

                animation.finished
                    .catch(() => {})
                    .finally(() => {
                        if (
                            this.#secondHandTickAnimation ===
                                animation
                        ) {
                            this.#secondHandTickAnimation =
                                undefined;
                        }
                    });
            }

            this.#secondHandAngle =
                secondAngle;

            requestAnimationFrame(
                () => {
                    if (
                        this.#handsStarted &&
                        this.isConnected
                    ) {
                        if (this.#handLayer) {
                            this.#handLayer.style.opacity =
                                "1";
                        }

                        if (this.#tickMarkLayer) {
                            this.#tickMarkLayer.style.opacity =
                                "1";
                        }
                    }
                }
            );
        }

        #getElapsedStartTimeMilliseconds() {
            const candidates = [];

            if (Number.isFinite(this.#scheduledStartMilliseconds)) {
                candidates.push(this.#scheduledStartMilliseconds);
            }

            const relevantTypes = new Set([
                "earlystart",
                "latency",
                "trip",
                "overtime"
            ]);

            for (const range of this.#getManagedTimeRanges()) {
                if (
                    range.timeRangeExiting === true ||
                    !relevantTypes.has(
                        String(range.getAttribute("type") ?? "").trim().toLowerCase()
                    )
                ) {
                    continue;
                }

                const start = Number(range.clockTimerStart);
                if (Number.isFinite(start)) candidates.push(start);
            }

            return candidates.length > 0
                ? Math.min(...candidates)
                : this.#getStartTimeMilliseconds();
        }

        #getCountedTimeElapsed(timelineNow) {
            if (!Number.isFinite(timelineNow)) return 0;

            const countedTypes = new Set([
                "trip",
                "tolerance",
                "latency",
                "overtime",
                "approval-deficit"
            ]);
            const segments = [];

            for (const range of this.#getManagedTimeRanges()) {
                if (
                    range.timeRangeExiting === true ||
                    !countedTypes.has(
                        String(range.getAttribute("type") ?? "").trim().toLowerCase()
                    )
                ) {
                    continue;
                }

                const start = Number(range.clockTimerStart);
                const end = Number(range.clockTimerEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
                const clippedEnd = Math.min(end, timelineNow);
                if (clippedEnd > start) segments.push([start, clippedEnd]);
            }

            segments.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            let total = 0;
            let current;

            for (const segment of segments) {
                if (!current || segment[0] > current[1]) {
                    current = [...segment];
                    total += current[1] - current[0];
                    continue;
                }
                if (segment[1] > current[1]) {
                    total += segment[1] - current[1];
                    current[1] = segment[1];
                }
            }

            return Math.max(0, total);
        }

        #getSummaryTimelineNow(nowDate = new Date()) {
            if (
                !this.#started &&
                this.#hasStartProperties() &&
                Number.isFinite(this.#openEndedLastTick)
            ) {
                return this.#openEndedLastTick;
            }
            return this.#getCurrentTimelineTime(nowDate);
        }

        #getTripActualTimeElapsed(timelineNow) {
            const start = this.#getElapsedStartTimeMilliseconds();
            return Number.isFinite(start) && Number.isFinite(timelineNow)
                ? Math.max(0, timelineNow - start)
                : 0;
        }

        #getScopePercentGoal(scope) {
            const goal = scope === "total"
                ? this.#getTotalGoal()
                : this.#getTripGoal();
            return Number.isFinite(goal) && goal > 0 ? goal : undefined;
        }

        #formatSummaryEndTime(value) {
            if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
                return undefined;
            }

            value = new Date(
                value.getTime() -
                value.getMilliseconds()
            );

            return [
                value.getHours(),
                value.getMinutes(),
                value.getSeconds()
            ]
                .map(part => String(part).padStart(2, "0"))
                .join(":");
        }

        #getEarlyStartAllowanceCredit() {
            let total = 0;

            for (const record of this.#insertedRanges) {
                const type =
                    String(
                        record?.type ?? ""
                    ).trim().toLowerCase();

                if (
                    type !== "break" &&
                    type !== "lunch"
                ) {
                    continue;
                }

                let actualEnd =
                    Number(
                        record.clockTimerActualEndTimeline
                    );

                let earlyStartEnd =
                    Number(
                        record.clockTimerEarlyStartEndTimeline
                    );

                if (
                    !Number.isFinite(actualEnd) ||
                    !Number.isFinite(earlyStartEnd)
                ) {
                    const actualEndDate =
                        new Date(
                            record.otherAttributes?.[
                                "clock-timer-actual-end"
                            ] ?? NaN
                        );

                    const earlyStartEndDate =
                        new Date(
                            record.otherAttributes?.[
                                "clock-timer-early-start-end"
                            ] ?? NaN
                        );

                    if (
                        !Number.isNaN(
                            actualEndDate.getTime()
                        ) &&
                        !Number.isNaN(
                            earlyStartEndDate.getTime()
                        )
                    ) {
                        actualEnd =
                            actualEndDate.getTime();

                        earlyStartEnd =
                            earlyStartEndDate.getTime();
                    }
                }

                if (
                    Number.isFinite(actualEnd) &&
                    Number.isFinite(earlyStartEnd) &&
                    earlyStartEnd > actualEnd
                ) {
                    total +=
                        earlyStartEnd -
                        actualEnd;
                }
            }

            return total;
        }

        #getTotalSummary(timelineNow, nowDate) {
            const base = this.#hasUsableAggregateSnapshot()
                ? this.#tripTotals
                : undefined;

            if (
                !base &&
                !this.#hasStartProperties() &&
                !Number.isFinite(this.#externalStandardTime) &&
                !Number.isFinite(this.#externalCountedTime)
            ) return undefined;

            let standardTimeMilliseconds = Number(base?.standardTimeMilliseconds ?? 0);
            let actualTimeMilliseconds = Number(base?.actualTimeMilliseconds ?? 0);
            let countedTimeMilliseconds = Number(base?.countedTimeMilliseconds ?? 0);
            let allowanceCreditMilliseconds = 0;

            if (Number.isFinite(this.#externalStandardTime)) {
                standardTimeMilliseconds = this.#externalStandardTime;
            }
            if (Number.isFinite(this.#externalCountedTime)) {
                countedTimeMilliseconds = this.#externalCountedTime;
                actualTimeMilliseconds = this.#externalCountedTime;
            }

            if (this.#hasStartProperties() && this.#tripAddedToAggregate !== true) {
                standardTimeMilliseconds += Number(this.#standardDuration ?? 0);
                actualTimeMilliseconds += this.#getTripActualTimeElapsed(timelineNow);
                countedTimeMilliseconds += this.#getCountedTimeElapsed(timelineNow);
                allowanceCreditMilliseconds +=
                    this.#getEarlyStartAllowanceCredit();
            }

            const countedPercent = countedTimeMilliseconds > 0
                ? standardTimeMilliseconds / countedTimeMilliseconds
                : undefined;
            const percentGoal = this.#getScopePercentGoal("total");
            const allowedTimeMilliseconds =
                (
                    Number.isFinite(percentGoal) &&
                    percentGoal > 0
                        ? Math.round(
                            standardTimeMilliseconds /
                            percentGoal
                        )
                        : standardTimeMilliseconds
                ) +
                allowanceCreditMilliseconds;
            const remainingMilliseconds = allowedTimeMilliseconds - countedTimeMilliseconds;

            let renderedTime;
            if (!this.#hasStartProperties() &&
                standardTimeMilliseconds === 0 && actualTimeMilliseconds === 0 && countedTimeMilliseconds === 0) {
                renderedTime = undefined;
            }
            else if (this.#renderedTimeMode === "elapsed") {
                renderedTime = this.#formatElapsedRenderedDuration(countedTimeMilliseconds);
            }
            else if (this.#renderedTimeMode === "calculated-end") {
                let intervalAdjustmentMilliseconds = 0;

                const activeInterval =
                    this.getActiveIntervalState(
                        nowDate
                    );

                const activeIntervalType =
                    String(
                        activeInterval?.intervalType ?? ""
                    ).trim().toLowerCase();

                if (
                    (
                        activeIntervalType === "break" ||
                        activeIntervalType === "lunch"
                    ) &&
                    Number.isFinite(
                        activeInterval?.remainingMilliseconds
                    )
                ) {
                    intervalAdjustmentMilliseconds =
                        activeInterval.remainingMilliseconds;
                }

                renderedTime = this.#formatSummaryEndTime(
                    new Date(
                        nowDate.getTime() +
                        remainingMilliseconds +
                        intervalAdjustmentMilliseconds
                    )
                );
            }
            else {
                renderedTime = this.#formatRemainingRenderedDuration(
                    remainingMilliseconds
                );
            }

            return {
                standardTime: Number.isFinite(standardTimeMilliseconds) && standardTimeMilliseconds > 0
                    ? this.#formatStandardTime(Math.max(0, standardTimeMilliseconds), {includeHours: true})
                    : undefined,
                standardTimeMilliseconds,
                actualTimeElapsedMilliseconds: actualTimeMilliseconds,
                countedTimeElapsedMilliseconds: countedTimeMilliseconds,
                allowanceCreditMilliseconds,
                countedPercent,
                percentGoal,
                renderedTime,
                renderedTimeMode: this.#renderedTimeMode
            };
        }

        #buildSummarySnapshot(nowDate = new Date()) {
            const validNow =
                nowDate instanceof Date && !Number.isNaN(nowDate.getTime())
                    ? new Date(nowDate.getTime())
                    : new Date();
            const timelineNow = this.#getSummaryTimelineNow(validNow);
            const hasTrip = this.#hasStartProperties();
            const tripActualTimeElapsedMilliseconds = hasTrip
                ? this.#getTripActualTimeElapsed(timelineNow)
                : 0;
            const tripCountedTimeElapsedMilliseconds = hasTrip
                ? this.#getCountedTimeElapsed(timelineNow)
                : 0;
            const tripCountedPercent =
                tripCountedTimeElapsedMilliseconds > 0 &&
                Number.isFinite(this.#standardDuration)
                    ? this.#standardDuration / tripCountedTimeElapsedMilliseconds
                    : undefined;

            const trip = {
                available: hasTrip,
                standardTime: this.#standardTime,
                standardTimeMilliseconds: Number.isFinite(this.#standardDuration)
                    ? this.#standardDuration
                    : undefined,
                actualTimeElapsedMilliseconds: tripActualTimeElapsedMilliseconds,
                countedTimeElapsedMilliseconds: tripCountedTimeElapsedMilliseconds,
                countedPercent: tripCountedPercent,
                percentGoal: this.#getScopePercentGoal("trip"),
                renderedTime: hasTrip
                    ? (
                        this.#started
                            ? this.#calculateRenderedTime(validNow, this.#renderedTimeMode)
                            : this.#renderedTime
                    )
                    : undefined,
                renderedTimeMode: this.#renderedTimeMode
            };

            const total = this.#getTotalSummary(timelineNow, validNow);
            if (total) total.available = true;

            const scope =
                this.#getRenderedPercentScope();

            let selected;

            if (scope === "total") {
                selected = total;
            }
            else if (scope === "standard") {
                selected = {
                    ...trip,
                    percentGoal: 1
                };
            }
            else {
                selected = trip;
            }

            return {
                now: new Date(validNow.getTime()),
                timestamp: validNow.getTime(),
                timelineMilliseconds: timelineNow,
                scope,
                renderedTimeMode: this.#renderedTimeMode,
                trip,
                total,
                selected
            };
        }

        #emitCadenceTick(nowDate = new Date()) {
            const summary = this.#buildSummarySnapshot(nowDate);
            this.#emitClockTimerEvent("cadenceTick", {
                now: new Date(summary.now.getTime()),
                timestamp: summary.timestamp,
                cadenceMilliseconds: 1000,
                cadenceOffsetMilliseconds: Number.isFinite(this.#tickAlignmentMilliseconds)
                    ? this.#millisecondsComponent(this.#tickAlignmentMilliseconds)
                    : 0,
                tripCountedPercent: summary.trip.countedPercent,
                totalCountedPercent: summary.total?.countedPercent,
                tripCountedTimeElapsedMilliseconds:
                    summary.trip.countedTimeElapsedMilliseconds,
                totalCountedTimeElapsedMilliseconds:
                    summary.total?.countedTimeElapsedMilliseconds,
                summary
            });
        }

        #getCurrentTimelineTime(
            now = new Date()
        ) {
            if (
                this.#creationMilliseconds ===
                    undefined ||
                this.#startedAtEpoch ===
                    undefined
            ) {
                return (
                    now.getHours() *
                        ClockTimer.#HOUR
                ) +
                    (
                        now.getMinutes() *
                        60 *
                        1000
                    ) +
                    (
                        now.getSeconds() *
                        1000
                    ) +
                    now.getMilliseconds();
            }

            const raw =
                (
                    now.getHours() *
                        ClockTimer.#HOUR
                ) +
                (
                    now.getMinutes() *
                        60 *
                        1000
                ) +
                (
                    now.getSeconds() *
                        1000
                ) +
                now.getMilliseconds();

            const expected =
                this.#creationMilliseconds +
                (
                    now.getTime() -
                    this.#startedAtEpoch
                );

            const dayOffset =
                Math.round(
                    (
                        expected -
                        raw
                    ) /
                        ClockTimer.#DAY
                );

            return (
                raw +
                dayOffset *
                    ClockTimer.#DAY
            );
        }

        #resolveNear(
            rawMilliseconds,
            reference
        ) {
            // Explicit multi-day timeline values already include their day offset.
            if (rawMilliseconds >= ClockTimer.#DAY) return rawMilliseconds;
            const dayOffset =
                Math.round(
                    (
                        reference -
                        rawMilliseconds
                    ) /
                        ClockTimer.#DAY
                );

            return (
                rawMilliseconds +
                dayOffset *
                    ClockTimer.#DAY
            );
        }

        #validateClockTime(
            value,
            name = "time"
        ) {
            return this.#parseStandardTime(
                value,
                {
                    duration: false,
                    name
                }
            );
        }

        #validateDurationTime(
            value,
            name = "duration"
        ) {
            return this.#parseStandardTime(
                value,
                {
                    duration: true,
                    name
                }
            );
        }

        #parseStandardTime(
            value,
            {
                duration = false,
                name = "time"
            } = {}
        ) {
            if (
                typeof value !==
                    "string"
            ) {
                throw new TypeError(
                    `${name} must be a string in [h:]m[m]:ss[.ms] format.`
                );
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/
                );

            if (!match) {
                throw new TypeError(
                    `${name} must match [h:]m[m]:ss[.ms].`
                );
            }

            const hours =
                match[1] ===
                    undefined
                    ?
                    0
                    :
                    Number(
                        match[1]
                    );

            const minutes =
                Number(
                    match[2]
                );

            const seconds =
                Number(
                    match[3]
                );

            let milliseconds =
                0;

            if (
                match[4] !==
                    undefined
            ) {
                milliseconds =
                    Number(
                        match[4]
                            .padEnd(
                                3,
                                "0"
                            )
                    );
            }

            if (
                !Number.isInteger(
                    hours
                ) ||
                hours <
                    0
            ) {
                throw new RangeError(
                    `${name} contains an invalid hour value.`
                );
            }

            if (
                !Number.isInteger(
                    minutes
                ) ||
                minutes <
                    0 ||
                minutes >
                    59
            ) {
                throw new RangeError(
                    `${name} minutes must be between 0 and 59.`
                );
            }

            if (
                !Number.isInteger(
                    seconds
                ) ||
                seconds <
                    0 ||
                seconds >
                    59
            ) {
                throw new RangeError(
                    `${name} seconds must be between 0 and 59.`
                );
            }

            if (
                !duration &&
                name !== "startTime" && name !== "scheduledStart" &&
                hours >
                    23
            ) {
                throw new RangeError(
                    `${name} hours must be between 0 and 23.`
                );
            }

            const total =
                (
                    hours *
                    ClockTimer.#HOUR
                ) +
                (
                    minutes *
                    60 *
                    1000
                ) +
                (
                    seconds *
                    1000
                ) +
                milliseconds;

            if (
                duration &&
                total <=
                    0
            ) {
                throw new RangeError(
                    `${name} must be greater than zero.`
                );
            }

            return {
                hours,
                minutes,
                seconds,
                milliseconds,
                total
            };
        }

        #formatStandardTime(
            milliseconds,
            {
                clock = false,
                includeHours = false
            } = {}
        ) {
            if (
                !Number.isFinite(
                    milliseconds
                )
            ) {
                throw new TypeError(
                    "Cannot format an invalid time."
                );
            }

            let value =
                Math.round(
                    milliseconds
                );

            if (
                clock
            ) {
                value =
                    (
                        value %
                            ClockTimer.#DAY +
                        ClockTimer.#DAY
                    ) %
                    ClockTimer.#DAY;
            }

            const hours =
                Math.floor(
                    value /
                        ClockTimer.#HOUR
                );

            value %=
                ClockTimer.#HOUR;

            const minutes =
                Math.floor(
                    value /
                        (
                            60 *
                            1000
                        )
                );

            value %=
                60 *
                    1000;

            const seconds =
                Math.floor(
                    value /
                        1000
                );

            const millisecondsPart =
                value %
                    1000;

            let result;

            if (
                includeHours ||
                hours > 0
            ) {
                result =
                    `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
            }
            else {
                result =
                    `${minutes}:${String(seconds).padStart(2, "0")}`;
            }

            if (
                millisecondsPart !==
                    0
            ) {
                result +=
                    `.${String(millisecondsPart).padStart(3, "0")}`;
            }

            return result;
        }

        #formatTimelineTime(
            milliseconds
        ) {
            const value =
                (
                    Math.round(
                        milliseconds
                    ) %
                        ClockTimer.#DAY +
                    ClockTimer.#DAY
                ) %
                    ClockTimer.#DAY;

            const hours =
                Math.floor(
                    value /
                        ClockTimer.#HOUR
                );

            let remaining =
                value %
                    ClockTimer.#HOUR;

            const minutes =
                Math.floor(
                    remaining /
                        (
                            60 *
                            1000
                        )
                );

            remaining %=
                60 *
                    1000;

            const seconds =
                Math.floor(
                    remaining /
                        1000
                );

            const millisecondsPart =
                remaining %
                    1000;

            let result =
                `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

            if (
                millisecondsPart !==
                    0
            ) {
                result +=
                    `.${String(millisecondsPart).padStart(3, "0")}`;
            }

            return result;
        }

        #dateToStandardTime(
            date
        ) {
            const total =
                (
                    date.getHours() *
                        ClockTimer.#HOUR
                ) +
                (
                    date.getMinutes() *
                        60 *
                        1000
                ) +
                (
                    date.getSeconds() *
                        1000
                ) +
                date.getMilliseconds();

            return this.#formatStandardTime(
                total,
                {
                    clock: true
                }
            );
        }

        #millisecondsComponent(
            milliseconds
        ) {
            return (
                (
                    Math.round(
                        milliseconds
                    ) %
                        1000
                ) +
                1000
            ) %
                1000;
        }

        #normalizeMilitaryTime() {
            const value =
                this.getAttribute(
                    "military-time"
                );

            if (
                value !==
                    "true" &&
                value !==
                    "false"
            ) {
                this.setAttribute(
                    "military-time",
                    "true"
                );
            }
        }

        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm A"
                : "HHmm";
        }

        #normalizeFormat() {
            const value =
                this.getAttribute(
                    "time-format"
                );

            if (
                !this.#isValidFormat(
                    value
                )
            ) {
                const defaultFormat =
                    this.#getDefaultFormat();

                if (
                    value !==
                        defaultFormat
                ) {
                    this.setAttribute(
                        "time-format",
                        defaultFormat
                    );
                }
            }
        }

        #isValidFormat(
            value
        ) {
            const formatType =
                TemporalFormat.getFormatType(
                    value
                );

            if (
                !formatType ||
                formatType.type !== "time"
            ) {
                return false;
            }

            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            return formatType["time-type"] ===
                (military
                    ? "military"
                    : "12-hour");
        }

        #normalizeDateFormat(
            format
        ) {
            if (typeof format !== "string") {
                return undefined;
            }

            const text =
                format.trim();

            if (!text) {
                return undefined;
            }

            return TemporalFormat.normalizeDateFormat(
                text
            );
        }

        #getDateFormat() {
            return this.#normalizeDateFormat(
                this.getAttribute(
                    "date-format"
                )
            );
        }

        #formatClockDisplayTime(
            value
        ) {
            if (
                !(value instanceof Date) ||
                Number.isNaN(
                    value.getTime()
                )
            ) {
                return undefined;
            }

            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            const format =
                this.getAttribute(
                    "time-format"
                ) ??
                this.#getDefaultFormat();

            let result =
                TemporalFormat.formatTime(
                    value,
                    format,
                    military
                );

            if (
                result === undefined ||
                military
            ) {
                return result;
            }

            const pm =
                value.getHours() >= 12;

            const suffixes = {
                "a/p": pm ? "p" : "a",
                "A/P": pm ? "P" : "A",
                "AM/PM": pm ? "PM" : "AM",
                "A.M./P.M.": pm ? "P.M." : "A.M.",
                "am/pm": pm ? "pm" : "am",
                "a.m./p.m.": pm ? "p.m." : "a.m."
            };

            return result.replace(
                /(A\.M\.\/P\.M\.|a\.m\.\/p\.m\.|AM\/PM|am\/pm|A\/P|a\/p)/,
                token => suffixes[token]
            );
        }

        #getClosedIntervalSegments() {
            const segments = [];

            const openInsertedId =
                this.#openEndedRange?.id;

            const openOverwriteId =
                this.#openOverwriteRange?.id;

            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    range.timeRangeExiting === true ||
                    !this.#isIntervalType(
                        range.getAttribute(
                            "type"
                        )
                    ) ||
                    (
                        openInsertedId !== undefined &&
                        range.clockTimerInserted ===
                            openInsertedId
                    ) ||
                    (
                        openOverwriteId !== undefined &&
                        range.clockTimerOverwrite ===
                            openOverwriteId
                    )
                ) {
                    continue;
                }

                const start =
                    Number(
                        range.clockTimerStart
                    );

                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    continue;
                }

                segments.push([
                    start,
                    end
                ]);
            }

            segments.sort(
                (left, right) =>
                    left[0] - right[0] ||
                    left[1] - right[1]
            );

            const merged = [];

            for (const segment of segments) {
                const previous =
                    merged[
                        merged.length - 1
                    ];

                if (
                    !previous ||
                    segment[0] > previous[1]
                ) {
                    merged.push([
                        ...segment
                    ]);
                    continue;
                }

                previous[1] =
                    Math.max(
                        previous[1],
                        segment[1]
                    );
            }

            return merged;
        }

        #getClosedIntervalDuration(
            start,
            end
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {
                return 0;
            }

            let total =
                0;

            for (
                const [
                    intervalStart,
                    intervalEnd
                ] of
                    this.#getClosedIntervalSegments()
            ) {
                if (intervalEnd <= start) {
                    continue;
                }

                if (intervalStart >= end) {
                    break;
                }

                total +=
                    Math.max(
                        0,
                        Math.min(
                            end,
                            intervalEnd
                        ) -
                        Math.max(
                            start,
                            intervalStart
                        )
                    );
            }

            return total;
        }

        #getOpenIntervalDuration(
            start,
            end
        ) {
            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start ||
                !this.#openEndedRange?.openEnded
            ) {
                return 0;
            }

            const intervalStart =
                this.#dateToTimelineTime(
                    this.#openEndedRange.startDate
                );

            if (!Number.isFinite(intervalStart)) {
                return 0;
            }

            return Math.max(
                0,
                end -
                    Math.max(
                        start,
                        intervalStart
                    )
            );
        }

        #formatElapsedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const normalizedMilliseconds =
                Math.round(
                    milliseconds
                );

            const displayMilliseconds =
                normalizedMilliseconds % 1000 === 0
                    ? normalizedMilliseconds
                    : Math.ceil(
                        normalizedMilliseconds /
                        1000
                    ) * 1000;

            return this.#formatStandardTime(Math.abs(displayMilliseconds), {includeHours: true});
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const displayMilliseconds =
                Math.trunc(
                    milliseconds /
                    1000
                ) * 1000;

            const duration = this.#formatStandardTime(Math.abs(displayMilliseconds), {includeHours: true});

            return displayMilliseconds < 0
                ? `-${duration}`
                : duration;
        }

        #calculateRenderedTime(
            now,
            mode = this.#renderedTimeMode
        ) {
            if (
                !(now instanceof Date) ||
                Number.isNaN(
                    now.getTime()
                )
            ) {
                return undefined;
            }

            if (
                !this.#started ||
                !Number.isFinite(
                    this.#calculatedEnd
                ) ||
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return this.#formatClockDisplayTime(
                    now
                );
            }

            const synchronizedNow =
                this.#normalizeTickDate(
                    new Date(
                        now.getTime()
                    )
                );

            const timelineNow =
                this.#getCurrentTimelineTime(
                    synchronizedNow
                );

            if (!Number.isFinite(timelineNow)) {
                return undefined;
            }

            if (mode === "calculated-end") {
                const creationDate =
                    this.#getJSONCreationDate();

                if (!creationDate) {
                    return this.#formatSummaryEndTime(
                        synchronizedNow
                    );
                }

                const effectiveEnd =
                    timelineNow >
                        this.#calculatedEnd
                        ? timelineNow
                        : this.#calculatedEnd;

                return this.#formatSummaryEndTime(
                    new Date(
                        creationDate.getTime() +
                        effectiveEnd
                    )
                );
            }

            let milliseconds;

            if (mode === "elapsed") {
                const start =
                    this.#scheduledStartMilliseconds;

                const end =
                    Math.max(
                        start,
                        timelineNow
                    );

                milliseconds =
                    end -
                    start -
                    this.#getClosedIntervalDuration(
                        start,
                        end
                    ) -
                    this.#getOpenIntervalDuration(
                        start,
                        end
                    );
            }
            else {
                const difference =
                    this.#calculatedEnd -
                    timelineNow;

                if (difference >= 0) {
                    milliseconds =
                        difference -
                        this.#getClosedIntervalDuration(
                            timelineNow,
                            this.#calculatedEnd
                        );
                }
                else {
                    milliseconds =
                        difference +
                        this.#getClosedIntervalDuration(
                            this.#calculatedEnd,
                            timelineNow
                        );
                }
            }

            return mode === "elapsed"
                ? this.#formatElapsedRenderedDuration(
                    milliseconds
                )
                : this.#formatRemainingRenderedDuration(
                    milliseconds
                );
        }

        #updateDisplay(
            now
        ) {
            const dateFormat =
                this.#getDateFormat();

            const dateVisible =
                dateFormat !== undefined;

            this.#dateElement.hidden =
                !dateVisible;

            this.#dateElement.textContent =
                dateVisible
                    ? (
                        TemporalFormat.formatDate(
                            now,
                            dateFormat
                        ) ??
                        ""
                    )
                    : "";

            const result =
                this.#calculateRenderedTime(
                    now
                );

            if (result === undefined) {
                return;
            }

            this.#renderedTime =
                result;

            const displayTime =
                this.#formatClockDisplayTime(
                    now
                );

            if (displayTime === undefined) return;

            this.#timeElement.textContent =
                displayTime;

            this.#scheduleResponsiveMetrics();
        }

        #renderHours() {
            this.#ensureNumberRing();

            if (
                !this.#hourLayer
            ) {
                return;
            }

            this.#hourLayer
                .replaceChildren();

            const military =
                this.getAttribute(
                    "military-time"
                ) !==
                    "false";

            const currentHour =
                new Date()
                    .getHours();

            const afternoon =
                currentHour >=
                    12;

            const visible =
                this.#getVisibleHours();

            for (
                let physicalHour =
                    1;
                physicalHour <=
                    12;
                physicalHour++
            ) {
                let label =
                    physicalHour;

                if (
                    military
                ) {
                    if (
                        physicalHour ===
                            12
                    ) {
                        label =
                            afternoon
                                ?
                                12
                                :
                                0;
                    }
                    else {
                        label =
                            afternoon
                                ?
                                physicalHour +
                                    12
                                :
                                physicalHour;
                    }
                }

                if (
                    visible !==
                        null &&
                    !visible.has(
                        String(
                            label
                        )
                    ) &&
                    !visible.has(
                        String(
                            physicalHour
                        )
                    )
                ) {
                    continue;
                }

                const element =
                    document.createElement(
                        "div"
                    );

                element.className =
                    "hour-number";

                element.textContent =
                    String(
                        label
                    );

                element.clockTimerHour =
                    String(
                        physicalHour
                    );

                element.style.position =
                    "absolute";

                element.style.lineHeight =
                    "1";

                element.style.pointerEvents =
                    "none";

                element.style.whiteSpace =
                    "nowrap";

                element.style.transform =
                    "translate(-50%, -50%)";

                const angle =
                    physicalHour *
                    30 *
                    Math.PI /
                    180;

                const x =
                    50 +
                    Math.sin(
                        angle
                    ) *
                    50;

                const y =
                    50 -
                    Math.cos(
                        angle
                    ) *
                    50;

                element.style.left =
                    `${x}%`;

                element.style.top =
                    `${y}%`;

                this.#hourLayer.appendChild(
                    element
                );
            }
        }

        #getVisibleHours() {
            if (
                !this.hasAttribute(
                    "visible-hours"
                )
            ) {
                return null;
            }

            const value =
                this.getAttribute(
                    "visible-hours"
                ) ??
                "";

            const set =
                new Set();

            for (
                const item of
                    value.split(
                        ","
                    )
            ) {
                const text =
                    item.trim();

                if (text) {
                    set.add(
                        text
                    );
                }
            }

            return set;
        }
    }

    if (
        !customElements.get(
            "clock-timer"
        )
    ) {
        customElements.define(
            "clock-timer",
            ClockTimer
        );
    }

    if (!globalThis.ClockTimerUIState) {
        globalThis.ClockTimerUIState = ClockTimerUIState;
    }
})();
