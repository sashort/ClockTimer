(() => {
    class ClockTimer extends HTMLElement {
        static observedAttributes = [
            "percent-goal",
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

        static #DEFAULT_DATE_FORMAT =
            "yyyy-mm-dd";

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

        #hourHandAnimation;

        #minuteHandAnimation;

        #secondHandAnimation;

        #handStartTimeout;

        #hoursRenderFrame;

        #fontSizingFrame;

        #sizeObserver;

        #handsStarted =
            false;

        #displayTimeout;

        #tickTimeout;

        #creationTime;

        #creationMilliseconds;

        #tripId;

        #scheduledStart;

        #scheduledStartMilliseconds;

        #standardTime;

        #standardDuration;

        #originalStartArguments;

        #startResetState;

        #json;

        #restoringStartState =
            false;

        #percentGoal =
            1;

        #showTolerance =
            true;

        #loadingFromJSON =
            false;

        #toleranceTransitionState;

        #startedAtEpoch;

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

        #preserveInsertedOnClear =
            false;

        #starting =
            false;

        #updatesSuspended =
            false;

        #asyncOperationBuffer =
            [];

        #pendingTickAlignmentMilliseconds;

        #resumeTickAlignmentMilliseconds;

        #asyncResumePending =
            false;

        #processingAsyncBatch =
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

                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

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

        connectedCallback() {
            this.#captureFaceBackground();

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

                case "percent-goal":
                    if (
                        this.#updatesSuspended &&
                        !this.#processingAsyncBatch
                    ) {
                        this.#queueAsyncOperation({
                            type: "percent-goal"
                        });
                    }
                    else {
                        this.#handlePercentGoalChange();
                    }
                    break;

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
                    if (
                        this.#updatesSuspended &&
                        !this.#processingAsyncBatch
                    ) {
                        this.#queueAsyncOperation({
                            type: "grayscale"
                        });
                    }
                    else {
                        this.#runGrayscale();
                    }
                    break;
            }
        }

        #getJSONCreationDate() {
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
                    "overwrite"
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
                    "elapsed"
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

        fromJSON(json) {
            if (this.status !== "ready") {
                return false;
            }

            try {
                const jsonString =
                    typeof json === "string"
                        ? json
                        : JSON.stringify(
                            json
                        );

                const data =
                    typeof json === "string"
                        ? JSON.parse(json)
                        : json;

                if (
                    !data ||
                    typeof data !== "object" ||
                    Array.isArray(data) ||
                    data.tripId === null ||
                    !Number.isInteger(data.tripId) ||
                    typeof data.creationDate !== "string" ||
                    typeof data.standardTime !== "string" ||
                    typeof data.scheduledStart !== "string" ||
                    !Array.isArray(data.records)
                ) {
                    return false;
                }

                const creationMatch =
                    data.creationDate.match(
                        /^(\d{4})-(\d{2})-(\d{2})$/
                    );

                if (!creationMatch) {
                    return false;
                }

                const creationDate =
                    new Date(
                        Number(creationMatch[1]),
                        Number(creationMatch[2]) - 1,
                        Number(creationMatch[3])
                    );

                if (
                    creationDate.getFullYear() !== Number(creationMatch[1]) ||
                    creationDate.getMonth() !== Number(creationMatch[2]) - 1 ||
                    creationDate.getDate() !== Number(creationMatch[3])
                ) {
                    return false;
                }

                const parseTimestamp =
                    value => {
                        if (typeof value !== "string") {
                            return undefined;
                        }

                        const match =
                            value.match(
                                /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/
                            );

                        if (!match) {
                            return undefined;
                        }

                        const date =
                            new Date(
                                Number(match[1]),
                                Number(match[2]) - 1,
                                Number(match[3]),
                                Number(match[4]),
                                Number(match[5]),
                                Number(match[6]),
                                Number(match[7])
                            );

                        if (
                            date.getFullYear() !== Number(match[1]) ||
                            date.getMonth() !== Number(match[2]) - 1 ||
                            date.getDate() !== Number(match[3]) ||
                            date.getHours() !== Number(match[4]) ||
                            date.getMinutes() !== Number(match[5]) ||
                            date.getSeconds() !== Number(match[6]) ||
                            date.getMilliseconds() !== Number(match[7])
                        ) {
                            return undefined;
                        }

                        return date.getTime() - creationDate.getTime();
                    };

                const standard =
                    this.#validateDurationTime(
                        data.standardTime,
                        "standardTime"
                    );

                const scheduled =
                    this.#validateClockTime(
                        data.scheduledStart,
                        "scheduledStart"
                    );

                const reserved =
                    new Set([
                        "trip",
                        "tolerance",
                        "overtime",
                        "earlystart",
                        "latency",
                        "elapsed",
                        "remaining",
                        "wave"
                    ]);

                const excludedAttributes =
                    new Set([
                        "start-time",
                        "end-time",
                        "range-length",
                        "overwrite"
                    ]);

                const events = [];

                for (const record of data.records) {
                    if (
                        !record ||
                        typeof record !== "object" ||
                        Array.isArray(record)
                    ) {
                        return false;
                    }

                    const entries = Object.entries(record);

                    if (entries.length !== 1) {
                        return false;
                    }

                    const [time, value] = entries[0];
                    const milliseconds =
                        parseTimestamp(time);

                    if (
                        !Number.isFinite(milliseconds) ||
                        !value ||
                        typeof value !== "object" ||
                        Array.isArray(value) ||
                        typeof value.type !== "string" ||
                        !value.type.trim()
                    ) {
                        return false;
                    }

                    const type = value.type.trim();

                    if (
                        reserved.has(type) ||
                        ![
                            "start",
                            "resume",
                            "end"
                        ].includes(type) &&
                        Object.keys(value).some(
                            name =>
                                name !== "type" &&
                                excludedAttributes.has(
                                    name.toLowerCase()
                                )
                        )
                    ) {
                        return false;
                    }

                    const attributes = {};

                    for (const [name, attributeValue] of Object.entries(value)) {
                        if (name === "type") {
                            continue;
                        }

                        if (typeof attributeValue !== "string") {
                            return false;
                        }

                        attributes[name] = attributeValue;
                    }

                    events.push({
                        time,
                        milliseconds,
                        type,
                        attributes
                    });
                }

                events.sort(
                    (a, b) =>
                        a.milliseconds - b.milliseconds
                );

                const starts =
                    events.filter(
                        event => event.type === "start"
                    );

                const ends =
                    events.filter(
                        event => event.type === "end"
                    );

                if (
                    starts.length !== 1 ||
                    ends.length !== 1 ||
                    starts[0].milliseconds >= ends[0].milliseconds ||
                    events[0] !== starts[0] ||
                    events[events.length - 1] !== ends[0]
                ) {
                    return false;
                }

                for (let index = 1; index < events.length - 1; index++) {
                    if (
                        events[index].type === "start" ||
                        events[index].type === "end"
                    ) {
                        return false;
                    }
                }

                const lateStarts = [];

                for (let index = 1; index < events.length - 1; index++) {
                    const event = events[index];

                    if (["start", "resume", "end"].includes(event.type)) {
                        continue;
                    }

                    const allowedEntry =
                        Object.entries(event.attributes)
                            .find(([name]) =>
                                name.toLowerCase() === "allowed"
                            );

                    if (!allowedEntry) {
                        continue;
                    }

                    const allowedMinutes =
                        Number(allowedEntry[1]);

                    if (
                        !Number.isFinite(allowedMinutes) ||
                        allowedMinutes < 0
                    ) {
                        return false;
                    }

                    const next = events[index + 1];

                    if (next?.type !== "resume") {
                        continue;
                    }

                    const allowedEnd =
                        event.milliseconds +
                        allowedMinutes * 60 * 1000;

                    if (next.milliseconds > allowedEnd) {
                        lateStarts.push({
                            start: allowedEnd,
                            end: next.milliseconds
                        });
                    }
                }

                const startTimeMilliseconds =
                    starts[0].milliseconds;

                const terminal =
                    ends[0].milliseconds;

                const scheduledStartMilliseconds =
                    this.#resolveNear(
                        scheduled.total,
                        startTimeMilliseconds
                    );

                const creationMilliseconds =
                    (
                        startTimeMilliseconds % ClockTimer.#DAY +
                        ClockTimer.#DAY
                    ) % ClockTimer.#DAY;

                this.#tripId =
                    data.tripId;

                this.#creationMilliseconds =
                    creationMilliseconds;

                this.#creationTime =
                    this.#formatStandardTime(
                        creationMilliseconds,
                        { clock: true }
                    );

                this.#scheduledStartMilliseconds =
                    scheduledStartMilliseconds;

                this.#scheduledStart =
                    this.#formatTimelineTime(
                        scheduledStartMilliseconds
                    );

                this.#standardDuration =
                    standard.total;

                this.#standardTime =
                    this.#formatStandardTime(
                        standard.total
                    );

                this.#calculatedEndTime =
                    this.#scheduledStartMilliseconds +
                    this.#standardDuration;

                this.#percentGoal =
                    this.#getPercentGoal();

                this.#ringAnchor =
                    creationMilliseconds;

                this.#startedAtEpoch =
                    creationDate.getTime();

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

                this.#loadingFromJSON =
                    true;

                this.#started =
                    true;

                this.#starting =
                    true;

                try {
                    this.#buildPlannedRanges(
                        startTimeMilliseconds
                    );

                    const restoredCalculatedEndTime =
                        this.#calculatedEndTime;

                    const coverageEnd =
                        Math.max(
                            terminal,
                            restoredCalculatedEndTime ?? terminal
                        );

                    if (
                        Number.isFinite(this.#standardEnd) &&
                        coverageEnd > this.#standardEnd
                    ) {
                        this.#createSpan(
                            "overtime",
                            this.#standardEnd,
                            coverageEnd
                        );
                    }

                    this.#calculatedEndTime =
                        coverageEnd;

                    let elapsedCursor =
                        startTimeMilliseconds;

                    while (elapsedCursor < terminal) {
                        const ringIndex =
                            this.#getTimerRingIndex(
                                elapsedCursor
                            );

                        const segmentEnd =
                            Math.min(
                                terminal,
                                this.#getTimerRingEnd(ringIndex)
                            );

                        const ring =
                            this.#ensureRing(
                                ringIndex
                            );

                        const elapsedRange =
                            this.#createTimeRange(
                                "elapsed",
                                elapsedCursor,
                                segmentEnd
                            );

                        elapsedRange.setAttribute(
                            "overlapping",
                            ""
                        );

                        elapsedRange.clockTimerImportedElapsed =
                            "";

                        elapsedRange.timeRangeFullEntry =
                            true;

                        ring.appendChild(
                            elapsedRange
                        );

                        elapsedCursor =
                            segmentEnd;
                    }

                    for (let index = 1; index < events.length - 1; index++) {
                        const event = events[index];

                        if (event.type === "resume") {
                            continue;
                        }

                        const next = events[index + 1];

                        if (
                            !next ||
                            next.milliseconds <= event.milliseconds
                        ) {
                            return false;
                        }

                        let cursor =
                            event.milliseconds;

                        while (cursor < next.milliseconds) {
                            const ringIndex =
                                this.#getTimerRingIndex(cursor);

                            const segmentEnd =
                                Math.min(
                                    next.milliseconds,
                                    this.#getTimerRingEnd(ringIndex)
                                );

                            const ring =
                                this.#ensureRing(ringIndex);

                            const range =
                                this.#createTimeRange(
                                    event.type,
                                    cursor,
                                    segmentEnd
                                );

                            this.#applyOtherAttributes(
                                range,
                                event.attributes
                            );

                            ring.appendChild(range);

                            cursor = segmentEnd;
                        }
                    }

                    for (const lateStart of lateStarts) {
                        let cursor = lateStart.start;

                        while (cursor < lateStart.end) {
                            const ringIndex =
                                this.#getTimerRingIndex(cursor);

                            const segmentEnd =
                                Math.min(
                                    lateStart.end,
                                    this.#getTimerRingEnd(ringIndex)
                                );

                            const ring =
                                this.#ensureRing(ringIndex);

                            const range =
                                this.#createTimeRange(
                                    "latency",
                                    cursor,
                                    segmentEnd
                                );

                            range.setAttribute(
                                "overlapping",
                                ""
                            );

                            ring.appendChild(range);

                            cursor = segmentEnd;
                        }
                    }

                    if (
                        this.#getTimerMode() ===
                            "remaining"
                    ) {
                        this.#updateRemainingRanges(
                            terminal
                        );
                    }

                    this.#refreshRingLayout(
                        coverageEnd,
                        {
                            refreshTickMarks: true
                        }
                    );

                    this.#snapTimerRangeAngles();
                }
                finally {
                    this.#starting =
                        false;

                    this.#started =
                        false;

                    this.#loadingFromJSON =
                        false;
                }

                for (const ring of this.#rings.values()) {
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

                this.#refreshRingLayout(
                    Math.max(
                        terminal,
                        this.#calculatedEndTime ?? terminal
                    ),
                    {
                        refreshTickMarks: true
                    }
                );

                this.#originalStartArguments =
                    undefined;

                this.#startResetState =
                    undefined;

                this.#stopTickTimer();

                this.#json =
                    jsonString;

                return new Date();
            }
            catch {
                return false;
            }
        }

        get showTolerance() {
            return this.#showTolerance;
        }

        set showTolerance(value) {
            let normalized;

            if (typeof value === "boolean") {
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
                this.#percentGoal <= 1 ||
                this.#json !== undefined ||
                this.#loadingFromJSON
            ) {
                return;
            }

            this.#transitionShowTolerance();
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

            const previousDuration =
                this.#standardDuration;

            this.#standardTime =
                this.#formatStandardTime(
                    parsed.total
                );

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

            this.#refreshAfterStartPropertyChange(
                startTimeMilliseconds
            );
        }

        get creationTime() {
            return this.#creationTime;
        }

        set creationTime(value) {
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
        }

        get scheduledStart() {
            return this.#scheduledStart;
        }

        set scheduledStart(value) {
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

        suspendUpdate() {
            this.#updatesSuspended =
                true;

            return this;
        }

        resumeUpdate() {
            if (!this.#updatesSuspended) {
                return this;
            }

            if (
                Number.isFinite(
                    this.#pendingTickAlignmentMilliseconds
                )
            ) {
                this.#tickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        this.#pendingTickAlignmentMilliseconds
                    );

                this.#resumeTickAlignmentMilliseconds =
                    this.#tickAlignmentMilliseconds;
            }
            else {
                this.#resumeTickAlignmentMilliseconds =
                    undefined;
            }

            this.#pendingTickAlignmentMilliseconds =
                undefined;

            this.#updatesSuspended =
                false;

            this.#asyncResumePending =
                this.#asyncOperationBuffer.length > 0;

            this.#stopTickTimer();
            this.#scheduleNextTick();

            return this;
        }

        stop(
            stopTime = this.#dateToStandardTime(
                new Date()
            )
        ) {
            const parsed =
                this.#validateClockTime(
                    stopTime,
                    "stopTime"
                );

            stopTime =
                this.#resolveNear(
                    parsed.total,
                    this.#getCurrentTimelineTime()
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

            if (this.#updatesSuspended) {
                const cancelledTypes =
                    new Set([
                        "insert",
                        "overwrite",
                        "replaceWithNext",
                        "replaceToNext",
                        "replaceWithPrevious",
                        "replaceToPrevious"
                    ]);

                this.#asyncOperationBuffer =
                    this.#asyncOperationBuffer.filter(
                        operation =>
                            !cancelledTypes.has(
                                operation.type
                            )
                    );

                this.#asyncResumePending =
                    this.#asyncOperationBuffer.length > 0;
            }

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
                elapsedRange.stopElapsedAnimation
                    ?.();

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

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#queueAsyncOperation({
                    type: "spin",
                    rotations: normalizedRotations,
                    duration,
                    scaleSpeed,
                    spinScaleFactor
                });

                return this;
            }

            this.#runSpin(
                normalizedRotations,
                duration,
                scaleSpeed,
                spinScaleFactor
            );

            return this;
        }

        #queueAsyncOperation(operation) {
            if (operation.type === "spin") {
                this.#asyncOperationBuffer =
                    this.#asyncOperationBuffer.filter(
                        item =>
                            item.type !== "spin"
                    );
            }

            if (operation.type === "percent-goal") {
                this.#asyncOperationBuffer =
                    this.#asyncOperationBuffer.filter(
                        item =>
                            item.type !== "percent-goal"
                    );
            }

            if (operation.type === "grayscale") {
                this.#asyncOperationBuffer =
                    this.#asyncOperationBuffer.filter(
                        item =>
                            item.type !== "grayscale"
                    );
            }

            this.#asyncOperationBuffer.push(
                operation
            );
        }

        #recordPendingTickAlignment(milliseconds) {
            if (
                Number.isFinite(milliseconds)
            ) {
                this.#pendingTickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        milliseconds
                    );
            }
        }

        #recordStartTickAlignment(args = {}) {
            const value =
                args.scheduledStart ??
                args.creationTime;

            if (value === undefined) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );
                return;
            }

            try {
                const parsed =
                    this.#validateClockTime(
                        value,
                        "scheduledStart"
                    );

                this.#recordPendingTickAlignment(
                    parsed.total
                );
            }
            catch {
            }
        }

        #recordInsertTickAlignment(startTime) {
            if (startTime === undefined) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );
                return;
            }

            try {
                const parsed =
                    this.#parseInsertDateTime(
                        startTime,
                        "startTime"
                    );

                this.#recordPendingTickAlignment(
                    parsed.getMilliseconds()
                );
            }
            catch {
            }
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
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );

                this.#fontSizingFrame =
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

                this.#scheduleFontSizing();
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

        #flushAsyncOperations() {
            if (!this.#asyncResumePending) {
                return;
            }

            const operations =
                this.#asyncOperationBuffer.splice(0);

            this.#asyncResumePending =
                false;

            const resumeAlignment =
                this.#resumeTickAlignmentMilliseconds;

            this.#processingAsyncBatch =
                true;

            const RingContainerClass =
                customElements.get(
                    "ring-container"
                );

            if (RingContainerClass) {
                RingContainerClass.batchResizing =
                    true;
            }

            try {
                for (const operation of operations) {
                    switch (operation.type) {
                        case "start":
                            this.start(operation.args);
                            break;

                        case "stop":
                            this.stop();
                            break;

                        case "insert":
                            this.insert(operation.args);
                            break;

                        case "overwrite":
                            this.overwrite(operation.args);
                            break;

                        case "reset":
                            this.reset();
                            break;

                        case "replaceWithNext":
                            this.replaceWithNext();
                            break;

                        case "replaceToNext":
                            this.replaceToNext(operation.value);
                            break;

                        case "replaceWithPrevious":
                            this.replaceWithPrevious();
                            break;

                        case "replaceToPrevious":
                            this.replaceToPrevious(operation.value);
                            break;

                        case "closeOpenRange":
                            this.closeOpenRange();
                            break;

                        case "clear":
                            this.clear();
                            break;

                        case "percent-goal":
                            this.#handlePercentGoalChange();
                            break;

                        case "spin":
                            this.#runSpin(
                                operation.rotations,
                                operation.duration
                            );
                            break;

                        case "grayscale":
                            this.#runGrayscale();
                            break;
                    }

                    if (RingContainerClass) {
                        RingContainerClass.batchResizing =
                            true;
                    }
                }
            }
            finally {
                if (
                    Number.isFinite(
                        resumeAlignment
                    )
                ) {
                    this.#tickAlignmentMilliseconds =
                        resumeAlignment;
                }

                this.#resumeTickAlignmentMilliseconds =
                    undefined;

                this.#processingAsyncBatch =
                    false;

                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }
        }

        start({
            tripId,
            standardTime,
            creationTime,
            startTime,
            scheduledStart
        } = {}) {
            try {
                if (!Number.isInteger(tripId)) {
                    throw new TypeError(
                        "tripId must be a non-null integer."
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
                scheduledStart
            };

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                const args = {
                    tripId,
                    standardTime,
                    creationTime,
                    startTime,
                    scheduledStart
                };

                this.#recordStartTickAlignment(args);

                this.#queueAsyncOperation({
                    type: "start",
                    args
                });

                return new Date();
            }

            this.#preserveInsertedOnClear =
                true;

            try {
                this.clear();
            }
            finally {
                this.#preserveInsertedOnClear =
                    false;
            }

            this.#tripId =
                tripId;

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

            this.#percentGoal =
                this.#getPercentGoal();

            this.#started =
                true;

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

                this.#refreshRingLayout(
                    this.#getCurrentTimelineTime(),
                    {
                        refreshTickMarks: true
                    }
                );

                if (!this.#processingAsyncBatch) {
                    this.#tick();
                }

                this.#snapTimerRangeAngles();
            }
            finally {
                this.#starting =
                    false;
            }

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

            if (!this.#restoringStartState) {
                this.#originalStartArguments = {
                    ...suppliedStartArguments
                };

                this.#startResetState = {
                    args: {
                        tripId:
                            this.#tripId,
                        standardTime:
                            this.#standardTime,
                        creationTime:
                            this.#creationTime,
                        startTime:
                            this.#formatTimelineTime(
                                startTimeMilliseconds
                            ),
                        scheduledStart:
                            this.#scheduledStart
                    },
                    startedAtEpoch:
                        this.#startedAtEpoch,
                    tickAlignmentMilliseconds:
                        this.#tickAlignmentMilliseconds,
                    percentGoal:
                        this.getAttribute(
                            "percent-goal"
                        ),
                    insertedRanges:
                        this.#cloneInsertedRecords(
                            this.#insertedRanges
                        ),
                    openEndedRangeId:
                        this.#openEndedRange?.id,
                    openEndedLastTick:
                        this.#openEndedLastTick
                };
            }

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

        reset() {
            if (
                this.#json === undefined &&
                !this.#startResetState
            ) {
                return false;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#queueAsyncOperation({
                    type: "reset"
                });

                return new Date();
            }

            if (this.#json !== undefined) {
                const json =
                    this.#json;

                const result =
                    this.clear();

                if (result === false) {
                    return false;
                }

                return this.fromJSON(
                    json
                );
            }

            const baseline =
                this.#startResetState;

            this.#insertedRanges =
                this.#cloneInsertedRecords(
                    baseline.insertedRanges
                );

            this.#openEndedRange =
                baseline.openEndedRangeId
                    ? this.#insertedRanges.find(
                        record =>
                            record.id ===
                                baseline.openEndedRangeId
                    )
                    : undefined;

            this.#openEndedLastTick =
                baseline.openEndedLastTick;

            if (baseline.percentGoal === null) {
                this.removeAttribute(
                    "percent-goal"
                );
            }
            else {
                this.setAttribute(
                    "percent-goal",
                    baseline.percentGoal
                );
            }

            this.#restoringStartState =
                true;

            try {
                this.start({
                    ...baseline.args
                });

                this.#startedAtEpoch =
                    baseline.startedAtEpoch;

                this.#tickAlignmentMilliseconds =
                    baseline.tickAlignmentMilliseconds;

                this.#stopTickTimer();
                this.#tick();
                this.#scheduleNextTick();
            }
            finally {
                this.#restoringStartState =
                    false;
            }

            return new Date();
        }

        #typeExtendsCalculatedEndTime(type) {
            return !new Set([
                "trip",
                "earlystart",
                "latency",
                "overtime",
                "remaining"
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

        insert({
            type,
            startTime,
            endTime,
            rangeLength,
            otherAttributes
        } = {}) {
            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                const args = {
                    type,
                    startTime,
                    endTime,
                    rangeLength,
                    otherAttributes
                };

                this.#recordInsertTickAlignment(startTime);

                this.#queueAsyncOperation({
                    type: "insert",
                    args
                });

                return;
            }

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
                endDate.getTime() <=
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

        overwrite({
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
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                const args = {
                    type,
                    startTime,
                    endTime,
                    rangeLength
                };

                if (openEnded) {
                    this.#recordPendingTickAlignment(
                        new Date().getMilliseconds()
                    );
                }

                this.#queueAsyncOperation({
                    type: "overwrite",
                    args
                });

                return;
            }

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
                start,
                end:
                    Number.isFinite(end)
                        ? end
                        : undefined,
                openEnded
            };

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
                        typeof range.removeAnimated ===
                            "function"
                    ) {
                        this.#releaseTimeRangeTimingAnimation(
                            range
                        );

                        range.removeAnimated({
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

                range.timeRangeFullEntry =
                    true;

                ring.appendChild(
                    range
                );

                cursor =
                    segmentEnd;
            }
        }

        #syncOpenOverwriteRangeElements(
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
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
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
                }
            }
        }

        #updateOpenOverwriteRange(
            nowDate
        ) {
            const record =
                this.#openOverwriteRange;

            if (!record) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

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

            this.#syncOpenOverwriteRangeElements(
                record,
                now
            );
        }

        #getProtectedRangeTypes() {
            return new Set([
                "trip",
                "tolerance",
                "overtime",
                "earlystart",
                "latency",
                "elapsed",
                "remaining"
            ]);
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
                    end - start;

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

        delete(timeRange) {
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

        closeOpenRange() {
            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "closeOpenRange"
                });

                return new Date();
            }

            const insertRecord =
                this.#openEndedRange;

            const overwriteRecord =
                this.#openOverwriteRange;

            if (
                !insertRecord &&
                !overwriteRecord
            ) {
                return false;
            }

            const endDate =
                this.#normalizeTickDate(
                    new Date()
                );

            if (
                !insertRecord &&
                overwriteRecord
            ) {
                const endTimeline =
                    this.#getCurrentTimelineTime(
                        endDate
                    );

                this.#updateOpenOverwriteRange(
                    endDate
                );

                overwriteRecord.openEnded =
                    false;

                overwriteRecord.end =
                    Math.max(
                        overwriteRecord.start,
                        endTimeline
                    );

                this.#openOverwriteRange =
                    undefined;

                this.#openOverwriteLastTick =
                    undefined;

                this.#tickAlignmentMilliseconds =
                    endDate.getMilliseconds();

                if (this.#needsTick()) {
                    this.#startTickTimer();
                }
                else {
                    this.#stopTickTimer();
                }

                return new Date();
            }

            const record =
                insertRecord;

            const endTimeline =
                this.#dateToTimelineTime(
                    endDate
                );

            this.#updateOpenEndedRange(
                endDate
            );

            record.openEnded =
                false;

            record.endDate =
                new Date(
                    endDate.getTime()
                );

            record.rangeLength =
                Math.max(
                    0,
                    endTimeline -
                    this.#dateToTimelineTime(
                        record.startDate
                    )
                );

            this.#openEndedRange =
                undefined;

            this.#openEndedLastTick =
                undefined;

            this.#tickAlignmentMilliseconds =
                endDate.getMilliseconds();

            this.#renderAllInsertedRanges();

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }
            else {
                this.#stopTickTimer();
            }

            return new Date();
        }

        replaceWithNext() {
            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceWithNext"
                });

                return;
            }

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

            currentRange?.removeAttribute(
                "overwrite"
            );

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

        replaceToNext(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceToNext",
                    value: type
                });

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

            currentRange.removeAttribute(
                "overwrite"
            );

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

        replaceWithPrevious() {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceWithPrevious"
                });

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

        replaceToPrevious(
            type
        ) {
            if (!this.#hasStartProperties()) {
                return;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#recordPendingTickAlignment(
                    new Date().getMilliseconds()
                );

                this.#queueAsyncOperation({
                    type: "replaceToPrevious",
                    value: type
                });

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

        clear() {
            if (!this.#hasStartProperties()) {
                return false;
            }

            if (
                this.#updatesSuspended &&
                !this.#processingAsyncBatch
            ) {
                this.#queueAsyncOperation({
                    type: "clear"
                });

                return new Date();
            }

            this.#json =
                undefined;

            this.#cancelToleranceTransition();

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

            if (!this.#restoringStartState) {
                this.#originalStartArguments =
                    undefined;

                this.#startResetState =
                    undefined;
            }

            this.#startedAtEpoch =
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
                            typeof range.snapToLogicalTiming ===
                                "function"
                        ) {
                            range.snapToLogicalTiming();
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
                    "percent-goal"
                )
            ) {
                this.setAttribute(
                    "percent-goal",
                    "100%"
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
                                        "timer-mode-transitioning"
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
                !state.indicatorUsed ||
                !this.#indicatorSymbol
            ) {
                return;
            }

            const duration = 750;

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

        #startTimerTypeIndicatorOutward(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            const duration = 750;

            this.#startTimerTypeTransitionVisualFade(
                state
            );

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
                this.#scheduleTimerTypeTransitionRelease(
                    state,
                    duration
                );

                return;
            }

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

            this.#updateIndicatorSymbol();

            const newBaseInset =
                this.#getTimerTypeIndicatorTopInset();

            let distance;

            if (
                Number.isFinite(
                    state.indicatorInwardCenter
                )
            ) {
                const symbolHeight =
                    this.#getTimerTypeIndicatorSymbolHeight();

                distance =
                    Math.max(
                        0,
                        state.indicatorInwardCenter -
                        newBaseInset -
                        symbolHeight / 2
                    );
            }
            else {
                const inwardTip =
                    Number.isFinite(
                        state.indicatorInwardTip
                    )
                        ? state.indicatorInwardTip
                        : newBaseInset;

                distance =
                    Math.max(
                        0,
                        inwardTip -
                        newBaseInset
                    );
            }

            const startTransform =
                `translateX(-50%) translateY(${distance}px)`;

            const endTransform =
                "translateX(-50%) translateY(0px)";

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

                this.#scheduleTimerTypeTransitionRelease(
                    state,
                    duration
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

                    this.#releaseTimerTypeIndicator(
                        state
                    );
                },
                () => {}
            );
        }

        #releaseTimerTypeIndicator(
            state
        ) {
            if (
                state !==
                    this.#timerTypeTransitionState
            ) {
                return;
            }

            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (
                state.indicatorOutwardTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.indicatorOutwardTimeout
                );

                state.indicatorOutwardTimeout =
                    undefined;
            }

            this.#finishTimerTypeTransitionVisualFade(
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

            this.#timerTypeIndicatorFrozen =
                false;

            this.#setTimerTypeIndicatorTransitionLayer(
                false
            );

            this.#timerTypeTransitionState =
                undefined;

            this.#updateIndicatorSymbol();
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
                state.indicatorDelayTimeout =
                    setTimeout(
                        () => {
                            state.indicatorDelayTimeout =
                                undefined;

                            if (
                                state !==
                                    this.#timerTypeTransitionState
                            ) {
                                return;
                            }

                            this.#startTimerTypeIndicatorOutward(
                                state
                            );
                        },
                        1500
                    );

                return;
            }

            state.indicatorDelayTimeout =
                setTimeout(
                    () => {
                        state.indicatorDelayTimeout =
                            undefined;

                        if (
                            state !==
                                this.#timerTypeTransitionState ||
                            !this.#started
                        ) {
                            return;
                        }

                        const duration =
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
                            this.#startTimerTypeIndicatorOutward(
                                state
                            );

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

                            this.#startTimerTypeIndicatorOutward(
                                state
                            );

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

                                this.#startTimerTypeIndicatorOutward(
                                    state
                                );
                            },
                            () => {}
                        );
                    },
                    750
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

            for (
                const ring of
                    state.newRings
            ) {
                if (!ring.isConnected) {
                    continue;
                }

                ring.inset =
                    undefined;

                ring.snapGeometry?.();

                delete ring.clockTimerTargetWidth;
                delete ring.clockTimerTransitionNew;

                ring.style.removeProperty(
                    "z-index"
                );
            }

            for (
                const ring of
                    state.oldRings
            ) {
                ring.remove();
            }

            state.oldRings = [];
            state.ringsFinished =
                true;

            this.#timerTypeTransitioning =
                false;

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks:
                        true
                }
            );

            this.#updateIndicatorSymbol();

            this.#startTimerTypeIndicatorCatchup(
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

            if (
                state.startFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.startFrame
                );
            }

            if (
                state.geometryFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.geometryFrame
                );
            }

            if (
                state.collapseFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.collapseFrame
                );
            }

            if (
                state.cleanupTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.cleanupTimeout
                );
            }

            if (
                state.indicatorDelayTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.indicatorDelayTimeout
                );
            }

            state.indicatorInwardAnimation
                ?.cancel();

            state.indicatorOutwardAnimation
                ?.cancel();

            if (
                state.indicatorOutwardTimeout !==
                    undefined
            ) {
                clearTimeout(
                    state.indicatorOutwardTimeout
                );

                state.indicatorOutwardTimeout =
                    undefined;
            }

            this.#finishTimerTypeTransitionVisualFade(
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

            if (
                state.indicatorTrackAnimation
            ) {
                const angle =
                    this.#getIndicatorTrackAngle();

                state.indicatorTrackAnimation.cancel();

                this.#indicatorTrack.style.transform =
                    `rotate(${angle}deg)`;
            }

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
                        ring.inset =
                            `${geometry.collapseInset}px`;

                        ring.width =
                            "0px";

                        ring.snapGeometry?.();
                    }
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
                        ring.inset =
                            `${target.inset}px`;

                        ring.width =
                            target.widthValue;

                        ring.snapGeometry?.();

                        ring.inset =
                            undefined;

                        ring.snapGeometry?.();
                    }

                    delete ring.clockTimerTargetWidth;
                    delete ring.clockTimerTransitionNew;

                    ring.style.removeProperty(
                        "z-index"
                    );
                }

                for (
                    const ring of
                        state.oldRings
                ) {
                    ring.remove();
                }
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

                    ring.inset =
                        `${geometry.collapseInset}px`;

                    ring.width =
                        "0px";
                }

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

                    ring.inset =
                        `${target.inset}px`;

                    ring.width =
                        target.widthValue;
                }
            }
            finally {
                if (RingContainerClass) {
                    RingContainerClass.batchResizing =
                        false;
                }
            }

            const animatedRings =
                new Set([
                    ...state.oldRings,
                    ...state.newRings,
                    ...Array.from(
                        this.children
                    ).filter(
                        element =>
                            element.localName ===
                                "ring-container" &&
                            element.clockTimerLayoutDetached !==
                                true
                    )
                ]);

            const maximumDuration =
                Math.max(
                    0,
                    ...Array.from(
                        animatedRings
                    ).map(
                        ring =>
                            this.#getTimerTypeRingAnimationDuration(
                                ring
                            )
                    )
                );

            state.maximumDuration =
                maximumDuration;

            this.#startTimerTypeIndicatorInward(
                state
            );

            const refresh =
                () => {
                    if (
                        state !==
                            this.#timerTypeTransitionState ||
                        state.ringsFinished
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
                    this.#updateIndicatorSymbol();

                    state.geometryFrame =
                        requestAnimationFrame(
                            refresh
                        );
                };

            state.geometryFrame =
                requestAnimationFrame(
                    refresh
                );

            state.cleanupTimeout =
                setTimeout(
                    () => {
                        state.cleanupTimeout =
                            undefined;

                        const waitForCollapse =
                            () => {
                                if (
                                    state !==
                                        this.#timerTypeTransitionState
                                ) {
                                    return;
                                }

                                const collapsed =
                                    state.oldRings.every(
                                        ring =>
                                            !ring.isConnected ||
                                            this.#resolveTimerTypeTransitionLength(
                                                ring.renderedWidth ??
                                                "0px",
                                                ring
                                            ) <=
                                                0.05
                                    );

                                if (!collapsed) {
                                    state.collapseFrame =
                                        requestAnimationFrame(
                                            waitForCollapse
                                        );

                                    return;
                                }

                                state.collapseFrame =
                                    undefined;

                                this.#finishTimerTypeTransition(
                                    state
                                );
                            };

                        state.collapseFrame =
                            requestAnimationFrame(
                                waitForCollapse
                            );
                    },
                    maximumDuration
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

            const oldRings =
                this.#getTimerRings()
                    .filter(
                        ring =>
                            ring.isConnected
                    );

            if (oldRings.length === 0) {
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
                previousType,
                timerType,
                oldRings:
                    [...oldRings],
                newRings: [],
                oldGeometry:
                    new Map(),
                targetGeometry:
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
                    false
            };

            this.#timerTypeTransitionState =
                state;

            this.#stripTimerTypeTransitionOldVisualRanges(
                oldRings
            );

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

                    ring.style.zIndex =
                        "-1";

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

                    ring.inset =
                        `${initialInset}px`;

                    ring.width =
                        "0px";
                }
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

            this.#syncWaveRange();
            this.#updateIndicatorSymbol();

            state.startFrame =
                requestAnimationFrame(
                    () =>
                        this.#startTimerTypeRingAnimations(
                            state
                        )
                );
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

        #applyTimerModeState(mode) {
            if (mode !== "remaining") {
                this.#removeRemainingRanges();
                this.#syncWaveRange();
                return;
            }

            const start =
                this.#getTimerModeTransitionStart();

            if (Number.isFinite(start)) {
                this.#updateRemainingRanges(
                    start
                );
            }

            this.#syncWaveRange();
        }

        #transitionTimerMode(
            previousMode,
            mode
        ) {
            const previousOpacity =
                this.#cancelTimerModeTransition();

            const token =
                ++this.#timerModeTransitionToken;

            const elapsedRanges =
                Array.from(
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
                );

            for (const range of elapsedRanges) {
                range.setAttribute(
                    "timer-mode-transitioning",
                    ""
                );
            }

            if (mode === "remaining") {
                const start =
                    this.#getTimerModeTransitionStart();

                if (Number.isFinite(start)) {
                    this.#updateRemainingRanges(
                        start
                    );
                }
            }

            this.#syncWaveRange();

            const remainingRanges =
                Array.from(
                    this.querySelectorAll(
                        "time-range.remaining"
                    )
                );

            const animations = [];

            for (const range of elapsedRanges) {
                const target =
                    this.#getRangeOpacity(
                        range
                    );

                const from =
                    previousOpacity.get(
                        range
                    ) ??
                    (
                        previousMode === "elapsed"
                            ? target
                            : 0
                    );

                const to =
                    mode === "elapsed"
                        ? target
                        : 0;

                const animation =
                    this.#animateTimerModeRange(
                        range,
                        from,
                        to
                    );

                if (animation) {
                    animations.push(
                        animation
                    );
                }
            }

            for (const range of remainingRanges) {
                const target =
                    this.#getRangeOpacity(
                        range
                    );

                const from =
                    previousOpacity.get(
                        range
                    ) ??
                    (
                        previousMode === "remaining"
                            ? target
                            : 0
                    );

                const to =
                    mode === "remaining"
                        ? target
                        : 0;

                const animation =
                    this.#animateTimerModeRange(
                        range,
                        from,
                        to
                    );

                if (animation) {
                    animations.push(
                        animation
                    );
                }
            }

            const finish =
                () => {
                    if (
                        token !==
                            this.#timerModeTransitionToken
                    ) {
                        return;
                    }

                    for (const animation of animations) {
                        this.#timerModeTransitionAnimations.delete(
                            animation
                        );

                        animation.cancel();
                    }

                    for (const range of elapsedRanges) {
                        range.removeAttribute(
                            "timer-mode-transitioning"
                        );
                    }

                    if (mode !== "remaining") {
                        this.#removeRemainingRanges();
                    }

                    this.#syncWaveRange();
                };

            if (animations.length === 0) {
                finish();
                return;
            }

            Promise.allSettled(
                animations.map(
                    animation =>
                        animation.finished
                )
            ).then(
                finish
            );
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

            this.#applyTimerModeState(
                mode
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

        #syncWaveRange() {
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
                "var(--clock-timer-border-width, clamp(2px, 1.5cqi, 7px))"
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

        #syncHandGeometry() {
            this.#ensureHandRing();

            this.#handLayer.style.inset =
                this.#getRingInset(
                    this.#handRing
                );

            this.#handLayer.style.width =
                "";

            this.#handLayer.style.height =
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

                        this.#scheduleFontSizing();
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
                    typeof range.refreshVisualGeometry ===
                        "function"
                ) {
                    range.refreshVisualGeometry();
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
                            this.#scheduleFontSizing();
                            this.#scheduleIndicatorSymbolUpdate();

                            this.#refreshTimeRangeVisualGeometry();
                        }
                    );

                this.#sizeObserver.observe(
                    this
                );
            }

            this.#scheduleFontSizing();
        }

        #stopSizeObserver() {
            this.#sizeObserver
                ?.disconnect();

            this.#sizeObserver =
                undefined;

            if (
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );

                this.#fontSizingFrame =
                    undefined;
            }
        }

        #scheduleFontSizing() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            if (
                this.#fontSizingFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#fontSizingFrame
                );
            }

            this.#fontSizingFrame =
                requestAnimationFrame(
                    () => {
                        this.#fontSizingFrame =
                            undefined;

                        if (
                            !this.isConnected ||
                            this.#spinAnimation
                        ) {
                            return;
                        }

                        this.#updateResponsiveFontSizes();
                    }
                );
        }

        #updateResponsiveFontSizes() {
            if (
                this.#spinAnimation
            ) {
                return;
            }

            const rect =
                this.getBoundingClientRect();

            const diameter =
                Math.min(
                    rect.width,
                    rect.height
                );

            if (
                !Number.isFinite(diameter) ||
                diameter <= 0
            ) {
                return;
            }

            const hourSize =
                Math.max(
                    9,
                    Math.min(
                        22,
                        diameter * 0.06
                    )
                );

            this.#hourLayer.style.setProperty(
                "--clock-timer-auto-hour-font-size",
                `${hourSize}px`
            );

            const text =
                this.#timeElement.textContent ??
                "";

            if (!text) {
                return;
            }

            const computed =
                getComputedStyle(
                    this.#timeElement
                );

            const currentSize =
                Number.parseFloat(
                    computed.fontSize
                );

            if (
                !Number.isFinite(currentSize) ||
                currentSize <= 0
            ) {
                return;
            }

            const canvas =
                document.createElement(
                    "canvas"
                );

            const context =
                canvas.getContext(
                    "2d"
                );

            if (!context) {
                return;
            }

            context.font =
                computed.font;

            const measuredWidth =
                context.measureText(
                    text
                ).width;

            if (
                !Number.isFinite(measuredWidth) ||
                measuredWidth <= 0
            ) {
                return;
            }

            const targetWidth =
                diameter * 0.66;

            const minimumSize =
                Math.max(
                    10,
                    diameter * 0.08
                );

            const maximumSize =
                Math.max(
                    minimumSize,
                    diameter * 0.18
                );

            const fittedSize =
                Math.max(
                    minimumSize,
                    Math.min(
                        maximumSize,
                        currentSize *
                            targetWidth /
                            measuredWidth
                    )
                );

            this.#timeElement.style.setProperty(
                "--clock-timer-auto-time-font-size",
                `${fittedSize}px`
            );

            const dateVisible =
                this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.hidden =
                !dateVisible;

            if (!dateVisible) {
                return;
            }

            const dateSize =
                fittedSize * 0.38;

            const dateOffset =
                fittedSize * 0.72;

            this.#dateElement.style.setProperty(
                "--clock-timer-auto-date-font-size",
                `${dateSize}px`
            );

            this.#dateElement.style.setProperty(
                "--clock-timer-auto-date-offset",
                `${dateOffset}px`
            );
        }

        #captureRadialFittedPercentGoalAnimation(
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

        #prepareRadialFittedPercentGoalAnimation(
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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            if (
                !TimeRangeClass ||
                typeof TimeRangeClass.suspendLayout !==
                    "function"
            ) {
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

                TimeRangeClass.suspendLayout(
                    range
                );

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

        #handlePercentGoalChange() {
            const goal =
                this.#getPercentGoal();

            const previousGoal =
                this.#percentGoal;

            const percentGoalAnimation =
                this.#captureRadialFittedPercentGoalAnimation(
                    this.#started
                        ? this.#getCurrentTimelineTime()
                        : undefined
                );

            const counterclockwiseOvertimeRemoval =
                previousGoal < 1 &&
                goal >= 1;

            this.#percentGoal =
                goal;

            if (
                !this.#started
            ) {
                return;
            }

            this.#reconcilePlannedRanges({
                counterclockwiseOvertimeRemoval
            });

            this.#removeOvertimeRanges();

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

            this.#reapplyOverwriteRanges();

            this.#prepareRadialFittedPercentGoalAnimation(
                percentGoalAnimation,
                now
            );

            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks: true
                }
            );
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

            if (
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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const ranges =
                this.#getTimerRanges()
                    .filter(
                        range =>
                            range.isConnected &&
                            range.timeRangeExiting !== true
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
                        end <= start
                    ) {
                        continue;
                    }

                    const coordinatorManaged =
                        this.#timeRangeTimingAnimations.has(
                            range
                        );

                    if (coordinatorManaged) {
                        continue;
                    }

                    if (
                        suspendLayout &&
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {
                        TimeRangeClass.suspendLayout(
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
                if (
                    typeof TimeRangeClass?.resumeLayout ===
                        "function"
                ) {
                    for (const range of suspended) {
                        TimeRangeClass.resumeLayout(
                            range
                        );
                    }
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

        #calculateTimeRangeLayout(
            range,
            start,
            end,
            originMilliseconds,
            fittedBounds
        ) {
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            const parent =
                range?.parentElement;

            if (
                !TimeRangeClass ||
                typeof TimeRangeClass.calculateTimeAngle !==
                    "function" ||
                typeof TimeRangeClass.calculateClipPath !==
                    "function" ||
                !parent ||
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end < start
            ) {
                return;
            }

            const width =
                parent.clientWidth;

            const height =
                parent.clientHeight;

            if (
                width <= 0 ||
                height <= 0
            ) {
                return;
            }

            const rangeDuration =
                end - start;

            let origin;
            let startAngle;
            let endAngle;

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const bounds =
                    fittedBounds ??
                    this.#getRadialFittedBounds();

                if (!bounds) {
                    return;
                }

                origin =
                    bounds.start;

                const degreesPerMillisecond =
                    360 /
                    bounds.duration;

                startAngle =
                    (
                        start -
                        bounds.start
                    ) *
                    degreesPerMillisecond;

                endAngle =
                    (
                        end -
                        bounds.start
                    ) *
                    degreesPerMillisecond;

                startAngle =
                    Math.max(
                        0,
                        Math.min(
                            360,
                            startAngle
                        )
                    );

                endAngle =
                    Math.max(
                        0,
                        Math.min(
                            360,
                            endAngle
                        )
                    );
            }
            else {
                origin =
                    Number.isFinite(
                        originMilliseconds
                    )
                        ? originMilliseconds
                        : this.#getTimeRangeOriginMilliseconds(
                            range,
                            start
                        );

                const originDate =
                    this.#timeRangeTimelineDate(
                        origin
                    );

                startAngle =
                    TimeRangeClass.calculateTimeAngle(
                        this.#timeRangeTimelineDate(
                            start
                        ),
                        originDate
                    );

                endAngle =
                    TimeRangeClass.calculateTimeAngle(
                        this.#timeRangeTimelineDate(
                            end
                        ),
                        originDate
                    );

                if (
                    rangeDuration >=
                        ClockTimer.#HOUR
                ) {
                    endAngle =
                        startAngle + 360;
                }
            }

            if (
                !Number.isFinite(startAngle) ||
                !Number.isFinite(endAngle)
            ) {
                return;
            }

            const clipPath =
                TimeRangeClass.calculateClipPath({
                    startAngle,
                    endAngle,
                    width,
                    height,
                    parent,
                    mode: "radial"
                });

            if (
                typeof clipPath !==
                    "string"
            ) {
                return;
            }

            return {
                clipPath,
                startAngle,
                endAngle,
                duration:
                    rangeDuration,
                renderStartTime:
                    this.#formatTimelineTime(
                        start
                    ),
                renderEndTime:
                    this.#formatTimelineTime(
                        end
                    ),
                originMilliseconds:
                    origin
            };
        }

        #applyTimeRangeLayout(
            range,
            layout,
            commit = false
        ) {
            if (!range || !layout) {
                return false;
            }

            const method =
                commit
                    ? range.commitAnimatedLayout
                    : range.applyAnimatedLayout;

            if (
                typeof method !==
                    "function"
            ) {
                return false;
            }

            return (
                method.call(
                    range,
                    layout
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
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

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

                    TimeRangeClass?.resumeLayout?.(
                        range
                    );

                    range.refreshVisualGeometry?.();
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

            TimeRangeClass?.resumeLayout?.(
                range
            );
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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            if (!range.isConnected) {
                this.#timeRangeTimingAnimations.delete(
                    range
                );

                TimeRangeClass?.resumeLayout?.(
                    range
                );

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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            TimeRangeClass?.resumeLayout?.(
                range
            );

            return true;
        }

        #cancelTimeRangeTimingAnimations() {
            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

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

                TimeRangeClass?.resumeLayout?.(
                    range
                );
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

        #getCurrentToleranceRenderEnd() {
            let end =
                this.#calculatedEnd;

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
            end
        ) {
            const segments = [];

            if (
                !Number.isFinite(
                    this.#calculatedEnd
                ) ||
                !Number.isFinite(end) ||
                end <= this.#calculatedEnd
            ) {
                return segments;
            }

            let cursor =
                this.#calculatedEnd;

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

                if (
                    !Number.isFinite(segmentEnd) ||
                    segmentEnd <= cursor
                ) {
                    break;
                }

                segments.push({
                    ringIndex,
                    start: cursor,
                    end: segmentEnd
                });

                cursor =
                    segmentEnd;
            }

            return segments;
        }

        #ringHasNonToleranceContent(
            ring
        ) {
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
                    child.clockTimerPlanned !==
                        undefined &&
                    child.getAttribute(
                        "type"
                    ) === "tolerance"
                ) {
                    continue;
                }

                return true;
            }

            return false;
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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            TimeRangeClass?.suspendLayout?.(
                range
            );

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
            end
        ) {
            if (
                !state ||
                this.#toleranceTransitionState !==
                    state
            ) {
                return;
            }

            state.currentEnd =
                end;

            const desired =
                this.#getToleranceTransitionSegments(
                    end
                );

            const existing =
                new Map();

            for (
                const range of
                    this.#getToleranceRanges()
            ) {
                const ringIndex =
                    Number(
                        range.parentElement
                            ?.clockTimerRingIndex
                    );

                if (
                    !Number.isFinite(ringIndex) ||
                    existing.has(ringIndex)
                ) {
                    continue;
                }

                existing.set(
                    ringIndex,
                    range
                );
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

                let range =
                    existing.get(
                        target.ringIndex
                    );

                if (range) {
                    existing.delete(
                        target.ringIndex
                    );
                }
                else {
                    range =
                        this.#createTimeRange(
                            "tolerance",
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
                        range.snapToLogicalTiming?.();
                    }
                }
            }

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (const range of existing.values()) {
                state.suspendedRanges.delete(
                    range
                );

                TimeRangeClass?.resumeLayout?.(
                    range
                );

                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                range.remove();
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                this.#refreshRadialFittedLayouts(
                    end,
                    {
                        suspendLayout: false
                    }
                );
            }

            if (layoutChanged) {
                this.#refreshRingLayout(
                    end
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
                state.targetEnd
            );

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (
                const range of
                    state.suspendedRanges
            ) {
                TimeRangeClass?.resumeLayout?.(
                    range
                );
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
                            child.clockTimerPlanned !==
                                undefined &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    )
                ) {
                    const ringIndex =
                        Number(
                            fade.ring.clockTimerRingIndex
                        );

                    fade.ring.remove();

                    if (
                        Number.isFinite(ringIndex)
                    ) {
                        this.#rings.delete(
                            ringIndex
                        );
                    }
                }
            }

            state.ringFades.clear();

            this.#toleranceTransitionState =
                undefined;

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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            for (
                const range of
                    state.suspendedRanges
            ) {
                TimeRangeClass?.resumeLayout?.(
                    range
                );
            }

            for (const fade of state.ringFades.values()) {
                fade.animation?.cancel();

                delete fade.ring
                    .clockTimerToleranceTransitionHold;
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

            const currentEnd =
                state.fromEnd +
                (
                    state.targetEnd -
                    state.fromEnd
                ) *
                progress;

            this.#syncToleranceTransitionRanges(
                state,
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

            const fromEnd =
                Math.max(
                    this.#calculatedEnd,
                    Math.min(
                        this.#standardEnd,
                        this.#getCurrentToleranceRenderEnd() ??
                            this.#calculatedEnd
                    )
                );

            const targetEnd =
                this.#showTolerance
                    ? this.#standardEnd
                    : Math.max(
                        this.#calculatedEnd,
                        Math.min(
                            now,
                            this.#standardEnd
                        )
                    );

            if (fromEnd === targetEnd) {
                this.#reconcilePlannedRanges();

                this.#refreshRingLayout(
                    now,
                    { refreshTickMarks: true }
                );

                return;
            }

            const finalRingIndexes =
                new Set(
                    this.#getToleranceTransitionSegments(
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

            const fadeOutRings =
                this.#getToleranceFadeOutRings(
                    targetEnd
                );

            const state = {
                fromEnd,
                targetEnd,
                currentEnd: fromEnd,
                duration:
                    ringWillAppear ||
                    fadeOutRings.length > 0
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

            this.#toleranceTransitionState =
                state;

            for (const ring of fadeOutRings) {
                this.#startToleranceRingFade(
                    state,
                    ring,
                    "out"
                );
            }

            this.#syncToleranceTransitionRanges(
                state,
                fromEnd
            );

            if (state.duration <= 0) {
                state.endpointFinished =
                    true;

                this.#syncToleranceTransitionRanges(
                    state,
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
                this.#percentGoal <= 1 ||
                this.#loadingFromJSON ||
                this.#json !== undefined
            ) {
                return undefined;
            }

            const transitionEnd =
                this.#toleranceTransitionState
                    ?.currentEnd;

            if (
                Number.isFinite(
                    transitionEnd
                )
            ) {
                return transitionEnd >
                    this.#calculatedEnd
                    ? transitionEnd
                    : undefined;
            }

            if (
                !this.#started ||
                this.#showTolerance
            ) {
                return this.#standardEnd;
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
                (
                    this.#standardDuration /
                    this.#percentGoal
                );

            if (this.#percentGoal > 1) {
                this.#tripEnd =
                    this.#calculatedEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                spans.push({
                    type: "trip",
                    start: tripStart,
                    end: this.#calculatedEnd
                });

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        this.#calculatedEnd
                ) {
                    spans.push({
                        type: "tolerance",
                        start: this.#calculatedEnd,
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

                if (this.#percentGoal < 1) {
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

                    ring.appendChild(range);
                }
            }

            for (const range of unused) {
                if (
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
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
                    typeof range.snapToLogicalTiming ===
                        "function"
                ) {
                    range.snapToLogicalTiming();
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
                    "overwrite",
                    "start-time",
                    "end-time",
                    "range-length"
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

                const rightOverwrite =
                    right.getAttribute(
                        "overwrite"
                    );

                const preserveRangeLength =
                    left.hasAttribute(
                        "range-length"
                    ) ||
                    right.hasAttribute(
                        "range-length"
                    );

                left.removeAttribute(
                    "overwrite"
                );

                this.#setRangeTiming(
                    left,
                    start,
                    end,
                    preserveRangeLength
                );

                if (rightOverwrite !== null) {
                    left.setAttribute(
                        "overwrite",
                        rightOverwrite
                    );
                }

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

        #getPercentGoal() {
            const raw =
                this.getAttribute(
                    "percent-goal"
                );

            if (
                typeof raw !==
                    "string"
            ) {
                return 1;
            }

            let text =
                raw.trim();

            if (!text) {
                return 1;
            }

            const trailingPercent =
                text.endsWith(
                    "%"
                );

            if (
                trailingPercent
            ) {
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
                !Number.isFinite(
                    value
                ) ||
                value <=
                    0
            ) {
                return 1;
            }

            if (
                trailingPercent
            ) {
                value /=
                    100;
            }
            else if (
                value >
                    1.5
            ) {
                value /=
                    100;
            }

            if (
                !Number.isFinite(
                    value
                ) ||
                value <=
                    0
            ) {
                return 1;
            }

            return value;
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

            if (total <= 0) {
                throw new RangeError(
                    "rangeLength must be greater than zero."
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
                    name === "range-length"
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

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

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

                TimeRangeClass?.suspendLayout?.(
                    range
                );

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

                TimeRangeClass?.resumeLayout?.(
                    range
                );

                if (!targetLayout) {
                    range.refreshVisualGeometry?.();
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

            const canManageAnimation =
                range.isConnected &&
                TimeRangeClass &&
                typeof TimeRangeClass.suspendLayout ===
                    "function" &&
                typeof TimeRangeClass.resumeLayout ===
                    "function" &&
                typeof range.applyAnimatedLayout ===
                    "function" &&
                typeof range.commitAnimatedLayout ===
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

            TimeRangeClass.suspendLayout(
                range
            );

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
                TimeRangeClass.resumeLayout(
                    range
                );

                range.refreshVisualGeometry?.();
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

                TimeRangeClass.resumeLayout(
                    range
                );

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

                TimeRangeClass.resumeLayout(
                    range
                );

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

        #removeInsertedSegments() {
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
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }

        #renderInsertedRecord(
            record
        ) {
            const start =
                this.#dateToTimelineTime(
                    record.startDate
                );

            this.#ensureInsertionAnchor(
                start
            );

            const effectiveEnd =
                record.openEnded
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
                !Number.isFinite(
                    effectiveEnd
                ) ||
                effectiveEnd <= start
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

        #renderAllInsertedRanges() {
            this.#captureInsertedAttributes();

            this.#removeInsertedSegments();

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
                    typeof range.removeAnimated ===
                        'function'
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
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

        #updateOpenEndedRange(
            nowDate
        ) {
            const record =
                this.#openEndedRange;

            if (!record) {
                return;
            }

            const now =
                this.#dateToTimelineTime(
                    nowDate
                );

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

            if (!this.hasAttribute("indicator-symbol") || !this.#started || !this.#elapsedRange) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const ring = this.#elapsedRange.parentElement;

            if (!ring || ring.localName !== "ring-container" || !ring.hasAttribute("active")) {
                this.#setIndicatorSymbolVisible(false);
                return;
            }

            const end = Number(this.#elapsedRange.clockTimerEnd);
            const ringIndex = Number(ring.clockTimerRingIndex);

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
                (
                    this.#standardDuration /
                    this.#percentGoal
                );

            if (
                this.#percentGoal >
                    1
            ) {
                this.#tripEnd =
                    this.#calculatedEnd;

                this.#toleranceEnd =
                    this.#standardEnd;

                this.#createSpan(
                    "trip",
                    tripStart,
                    this.#calculatedEnd
                );

                const toleranceRenderEnd =
                    this.#getToleranceRenderEnd();

                if (
                    Number.isFinite(
                        toleranceRenderEnd
                    ) &&
                    toleranceRenderEnd >
                        this.#calculatedEnd
                ) {
                    this.#createSpan(
                        "tolerance",
                        this.#calculatedEnd,
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
                this.#percentGoal <
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
                !this.#started
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
            if (
                this.#getTimerMode() !==
                    "remaining" ||
                !Number.isFinite(start)
            ) {
                this.#removeRemainingRanges();
                return;
            }

            const latestEnd =
                Number.isFinite(
                    this.#calculatedEndTime
                )
                    ? this.#calculatedEndTime
                    : this.#getLatestTimerEnd();

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
                "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))";

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
                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"
                        :
                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";

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

                                this.#updateDisplay(
                                    new Date()
                                );

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
            if (this.#processingAsyncBatch) {
                return;
            }

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
            if (this.#processingAsyncBatch) {
                return;
            }

            if (
                !this.#needsTick() &&
                !this.#asyncResumePending
            ) {
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

                        if (
                            !this.#needsTick() &&
                            !this.#asyncResumePending
                        ) {
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
                            range.hasAttribute(
                                "overwrite"
                            )
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
                    range.getAttribute(
                        "overwrite"
                    )?.trim();

                range.removeAttribute(
                    "overwrite"
                );

                if (!overwriteType) {
                    continue;
                }

                this.overwrite({
                    type: overwriteType
                });
            }
        }

        #tick() {
            this.#flushAsyncOperations();

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
                return;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            if (
                !this.#showTolerance &&
                this.#percentGoal > 1 &&
                this.#json === undefined &&
                !this.#loadingFromJSON &&
                !this.#toleranceTransitionState
            ) {
                this.#reconcilePlannedRanges();
            }

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
        }

        #startHandAnimations() {
            this.#ensureHandRing();

            if (
                this.#handsStarted
            ) {
                return;
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

            const milliseconds =
                new Date()
                    .getMilliseconds();

            const delay =
                milliseconds ===
                    0
                    ?
                    0
                    :
                    1000 -
                        milliseconds;

            this.#handStartTimeout =
                setTimeout(
                    () => {
                        this.#handStartTimeout =
                            undefined;

                        if (
                            !this.isConnected
                        ) {
                            return;
                        }

                        this.#synchronizeHands();
                    },
                    delay
                );
        }

        #stopHandAnimations() {
            this.#hourHandAnimation
                ?.cancel();

            this.#minuteHandAnimation
                ?.cancel();

            this.#secondHandAnimation
                ?.cancel();

            this.#hourHandAnimation =
                undefined;

            this.#minuteHandAnimation =
                undefined;

            this.#secondHandAnimation =
                undefined;

            this.#handsStarted =
                false;
        }

        #synchronizeHands() {
            if (
                this.#handsStarted
            ) {
                return;
            }

            this.#ensureHandRing();

            const now =
                new Date();

            const hours =
                now.getHours() %
                    12;

            const minutes =
                now.getMinutes();

            const seconds =
                now.getSeconds();

            const milliseconds =
                now.getMilliseconds();

            const hourElapsed =
                (
                    (
                        hours *
                        60 *
                        60
                    ) +
                    (
                        minutes *
                        60
                    ) +
                    seconds
                ) *
                    1000 +
                milliseconds;

            const minuteElapsed =
                (
                    (
                        minutes *
                        60
                    ) +
                    seconds
                ) *
                    1000 +
                milliseconds;

            const secondElapsed =
                seconds *
                    1000 +
                milliseconds;

            const keyframes = [
                {
                    transform:
                        "translate(-50%, -100%) rotate(0deg)"
                },
                {
                    transform:
                        "translate(-50%, -100%) rotate(360deg)"
                }
            ];

            this.#hourHandAnimation =
                this.#hourHand.animate(
                    keyframes,
                    {
                        duration:
                            12 *
                            60 *
                            60 *
                            1000,

                        iterations:
                            Infinity,

                        easing:
                            "linear"
                    }
                );

            this.#minuteHandAnimation =
                this.#minuteHand.animate(
                    keyframes,
                    {
                        duration:
                            60 *
                            60 *
                            1000,

                        iterations:
                            Infinity,

                        easing:
                            "linear"
                    }
                );

            this.#secondHandAnimation =
                this.#secondHand.animate(
                    keyframes,
                    {
                        duration:
                            60 *
                            1000,

                        iterations:
                            Infinity,

                        easing:
                            "linear"
                    }
                );

            this.#hourHandAnimation.currentTime =
                hourElapsed;

            this.#minuteHandAnimation.currentTime =
                minuteElapsed;

            this.#secondHandAnimation.currentTime =
                secondElapsed;

            this.#handsStarted =
                true;
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
                clock = false
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
                hours >
                    0
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
                ? "h:mm:ss AM/PM"
                : "HHmmss";
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

            const translated =
                format.trim().replace(
                    /m{1,4}/g,
                    token =>
                        "M".repeat(
                            token.length
                        )
                );

            return TemporalFormat.isDateFormat(
                translated
            )
                ? translated
                : undefined;
        }

        #getDateFormat() {
            return (
                this.#normalizeDateFormat(
                    this.getAttribute(
                        "date-format"
                    )
                ) ??
                this.#normalizeDateFormat(
                    ClockTimer.#DEFAULT_DATE_FORMAT
                )
            );
        }

        #updateDisplay(
            now
        ) {
            const dateVisible =
                this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.hidden =
                !dateVisible;

            this.#dateElement.textContent =
                dateVisible
                    ? (
                        TemporalFormat.formatDate(
                            now,
                            this.#getDateFormat()
                        ) ??
                        ""
                    )
                    : "";

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
                    now,
                    format,
                    military
                );

            if (result === undefined) {
                return;
            }

            if (!military) {
                const pm =
                    now.getHours() >= 12;

                const suffixes = {
                    "a/p": pm ? "p" : "a",
                    "A/P": pm ? "P" : "A",
                    "AM/PM": pm ? "PM" : "AM",
                    "A.M./P.M.": pm ? "P.M." : "A.M.",
                    "am/pm": pm ? "pm" : "am",
                    "a.m./p.m.": pm ? "p.m." : "a.m."
                };

                result = result.replace(
                    /(A\.M\.\/P\.M\.|a\.m\.\/p\.m\.|AM\/PM|am\/pm|A\/P|a\/p)/,
                    token => suffixes[token]
                );
            }

            this.#timeElement.textContent =
                result;

            this.#scheduleFontSizing();
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
})();
