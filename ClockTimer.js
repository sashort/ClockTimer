(() => {
    class ClockTimer extends HTMLElement {
        static observedAttributes = [
            "percent-goal",
            "military-time",
            "format",
            "visible-hours",
            "tick-marks",
            "indicator-symbol"
        ];

        static #HOUR =
            60 * 60 * 1000;

        static #DAY =
            24 * ClockTimer.#HOUR;

        #shadowRoot;

        #timeElement;

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

        #scheduledStart;

        #scheduledStartMilliseconds;

        #startTime;

        #startTimeMilliseconds;

        #standardTime;

        #standardDuration;

        #percentGoal =
            1;

        #startedAtEpoch;

        #ringAnchor;

        #rings =
            new Map();

        #borderRing;

        #overtimeRanges =
            new Map();

        #elapsedRange;

        #tripEnd;

        #standardEnd;

        #calculatedEnd;

        #toleranceEnd;

        #started =
            false;

        #tickAlignmentMilliseconds;

        #insertedRanges =
            [];

        #openEndedRange;

        #openEndedLastTick;

        #preserveInsertedOnClear =
            false;

        #starting =
            false;

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

                    inset: 0;

                    width: 100%;
                    height: 100%;

                    isolation:
                        isolate;

                    pointer-events:
                        none;
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
                    font-size:
                        var(
                            --clock-timer-indicator-symbol-size,
                            var(
                                --clock-timer-auto-indicator-symbol-size,
                                10px
                            )
                        );
                    color: var(--clock-timer-indicator-symbol-color, white);
                    text-shadow: var(--clock-timer-indicator-symbol-shadow, 0 0 2px rgb(0 0 0 / 50%));
                    transform: translate(-50%, -50%);
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

                    line-height: 1;

                    white-space:
                        nowrap;

                    pointer-events:
                        none;
                }
            `;

            const clockFace =
                document.createElement(
                    "div"
                );

            clockFace.id =
                "clock-face";

            const ringLayer =
                document.createElement(
                    "div"
                );

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

            timeLayer.appendChild(
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
                ringLayer,
                this.#tickMarkLayer,
                this.#indicatorRing,
                this.#handLayer,
                timeLayer
            );

            this.#shadowRoot.append(
                style,
                clockFace
            );
        }

        connectedCallback() {
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

            if (this.#indicatorFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorFrame);
                this.#indicatorFrame = undefined;
            }

            if (this.#indicatorStartFrame !== undefined) {
                cancelAnimationFrame(this.#indicatorStartFrame);
                this.#indicatorStartFrame = undefined;
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
                case "percent-goal":
                    this.#handlePercentGoalChange();
                    break;

                case "military-time":
                    this.#normalizeMilitaryTime();

                    this.#normalizeFormat();

                    this.#scheduleHourRender();

                    this.#updateDisplay(
                        new Date()
                    );

                    break;

                case "format":
                    this.#normalizeFormat();

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
            }
        }

        start({
            standardTime,
            creationTime,
            startTime,
            scheduledStart
        } = {}) {
            this.#preserveInsertedOnClear =
                true;

            try {
                this.clear();
            }
            finally {
                this.#preserveInsertedOnClear =
                    false;
            }

            const standard =
                this.#parseStandardTime(
                    standardTime,
                    {
                        duration: true,
                        name: "standardTime"
                    }
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
                this.#parseStandardTime(
                    creationTime,
                    {
                        duration: false,
                        name: "creationTime"
                    }
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
                this.#parseStandardTime(
                    scheduledStart,
                    {
                        duration: false,
                        name: "scheduledStart"
                    }
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

            if (
                startTime !==
                    undefined
            ) {
                const parsedStart =
                    this.#parseStandardTime(
                        startTime,
                        {
                            duration: false,
                            name: "startTime"
                        }
                    );

                this.#startTimeMilliseconds =
                    this.#resolveNear(
                        parsedStart.total,
                        this.#scheduledStartMilliseconds
                    );

                this.#startTime =
                    this.#formatTimelineTime(
                        this.#startTimeMilliseconds
                    );
            }
            else {
                this.#startTime =
                    undefined;

                this.#startTimeMilliseconds =
                    undefined;
            }

            this.#standardTime =
                this.#formatStandardTime(
                    standard.total
                );

            this.#standardDuration =
                standard.total;

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
                this.#buildPlannedRanges();

                this.#renderAllInsertedRanges();

                this.#refreshRingLayout(
                    this.#getCurrentTimelineTime(),
                    {
                        refreshTickMarks: true
                    }
                );

                this.#tick();

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

            return this;
        }

        insert({
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
                return false;
            }

            if (
                this.#openEndedRange
            ) {
                return false;
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
                return false;
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
                return false;
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
                    return false;
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
                    return false;
                }
            }

            if (
                endDate &&
                endDate.getTime() <=
                    startDate.getTime()
            ) {
                return false;
            }

            if (
                endDate &&
                duration !==
                    undefined &&
                endDate.getTime() -
                    startDate.getTime() !==
                    duration
            ) {
                return false;
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

            if (
                this.#needsTick()
            ) {
                this.#startTickTimer();
            }

            return true;
        }

        closeOpenRange() {
            const record =
                this.#openEndedRange;

            if (!record) {
                return false;
            }

            const endDate =
                this.#normalizeTickDate(
                    new Date()
                );

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

            return true;
        }

        replaceWithNext() {
            if (
                !this.#started
            ) {
                return false;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const ringIndex =
                this.#getRingIndex(
                    now
                );

            const ring =
                this.#rings.get(
                    ringIndex
                );

            if (!ring) {
                return false;
            }

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
                return false;
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

            return true;
        }

        replaceToNext(
            type
        ) {
            if (
                typeof type !==
                    "string" ||
                type.trim() ===
                    "" ||
                !this.#started
            ) {
                return false;
            }

            const nowDate =
                new Date();

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            const ringIndex =
                this.#getRingIndex(
                    now
                );

            const ring =
                this.#rings.get(
                    ringIndex
                );

            if (!ring) {
                return false;
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
                    Number.isFinite(
                        start
                    ) &&
                    Number.isFinite(
                        end
                    ) &&
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
                    Number.isFinite(
                        start
                    ) &&
                    start > now &&
                    start < nextStart
                ) {
                    nextRange =
                        range;

                    nextStart =
                        start;
                }
            }

            if (
                !currentRange ||
                !nextRange ||
                nextStart <= now
            ) {
                return false;
            }

            this.#setRangeEnd(
                currentRange,
                now
            );

            const replacement =
                this.#createTimeRange(
                    type.trim(),
                    now,
                    nextStart,
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
                nextRange
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
            this.#stopTickTimer();
            this.#setIndicatorSymbolVisible(false);

            this.#creationTime =
                undefined;

            this.#creationMilliseconds =
                undefined;

            this.#scheduledStart =
                undefined;

            this.#scheduledStartMilliseconds =
                undefined;

            this.#startTime =
                undefined;

            this.#startTimeMilliseconds =
                undefined;

            this.#standardTime =
                undefined;

            this.#standardDuration =
                undefined;

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

            this.#toleranceEnd =
                undefined;

            this.#elapsedRange =
                undefined;

            this.#overtimeRanges.clear();

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
        }

        #ensureAttributes() {
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
                    "format"
                )
            ) {
                this.setAttribute(
                    "format",
                    this.#getDefaultFormat()
                );
            }
            else {
                this.#normalizeFormat();
            }
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
                            "ring-container"
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
                            undefined
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
                            !this.isConnected
                        ) {
                            return;
                        }

                        this.#updateResponsiveFontSizes();
                    }
                );
        }

        #updateResponsiveFontSizes() {
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
        }

        #handlePercentGoalChange() {
            const goal =
                this.#getPercentGoal();

            const previousGoal =
                this.#percentGoal;

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

            const match =
                raw.match(
                    /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/i
                );

            if (!match) {
                return 333;
            }

            const amount =
                Number(
                    match[1]
                );

            if (
                !Number.isFinite(amount) ||
                amount < 0
            ) {
                return 333;
            }

            return (
                match[2].toLowerCase() ===
                    "s"
            )
                ? amount * 1000
                : amount;
        }

        #getPlannedSegments() {
            const spans = [];

            if (
                this.#startTimeMilliseconds !==
                    undefined &&
                this.#scheduledStartMilliseconds >
                    this.#startTimeMilliseconds
            ) {
                spans.push({
                    type: "early-start",
                    start: this.#startTimeMilliseconds,
                    end: this.#scheduledStartMilliseconds
                });
            }

            if (
                this.#startTimeMilliseconds !==
                    undefined &&
                this.#startTimeMilliseconds >
                    this.#scheduledStartMilliseconds
            ) {
                spans.push({
                    type: "late-start",
                    start: this.#scheduledStartMilliseconds,
                    end: this.#startTimeMilliseconds
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

                spans.push({
                    type: "tolerance",
                    start: this.#calculatedEnd,
                    end: this.#standardEnd
                });
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
                        this.#getRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getRingStart(
                            ringIndex
                        ) +
                        ClockTimer.#HOUR;

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
            counterclockwiseOvertimeRemoval = false
        } = {}) {
            const desired =
                this.#getPlannedSegments();

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


        #getManagedTimeRanges() {
            const ranges = [];

            for (const child of this.children) {
                if (
                    child.localName !==
                        "ring-container"
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
                        undefined
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
            if (
                typeof value !==
                    "string"
            ) {
                throw new TypeError(
                    `${name} must be a string.`
                );
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^(?:(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+)?(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:\s*(AM|PM))?$/i
                );

            if (!match) {
                throw new TypeError(
                    `${name} must match [yyyy/mm/dd h:m]m:ss[.ms][ AM/PM].`
                );
            }

            const now =
                new Date();

            const year =
                match[1] === undefined
                    ? now.getFullYear()
                    : Number(match[1]);

            const month =
                match[2] === undefined
                    ? now.getMonth() + 1
                    : Number(match[2]);

            const day =
                match[3] === undefined
                    ? now.getDate()
                    : Number(match[3]);

            let hour =
                Number(match[4]);

            const minute =
                Number(match[5]);

            const second =
                Number(match[6]);

            const millisecond =
                match[7] === undefined
                    ? 0
                    : Number(
                        match[7].padEnd(
                            3,
                            "0"
                        )
                    );

            const meridiem =
                match[8]?.toUpperCase();

            if (
                minute > 59 ||
                second > 59
            ) {
                throw new RangeError(
                    `${name} contains an invalid time.`
                );
            }

            if (meridiem) {
                if (
                    hour < 1 ||
                    hour > 12
                ) {
                    throw new RangeError(
                        `${name} contains an invalid hour.`
                    );
                }

                if (
                    meridiem === "AM"
                ) {
                    if (hour === 12) {
                        hour = 0;
                    }
                }
                else if (hour !== 12) {
                    hour += 12;
                }
            }
            else if (hour > 23) {
                throw new RangeError(
                    `${name} contains an invalid hour.`
                );
            }

            const date =
                new Date(
                    year,
                    month - 1,
                    day,
                    hour,
                    minute,
                    second,
                    millisecond
                );

            if (
                date.getFullYear() !== year ||
                date.getMonth() !== month - 1 ||
                date.getDate() !== day
            ) {
                throw new RangeError(
                    `${name} contains an invalid date.`
                );
            }

            return date;
        }

        #parseInsertRangeLength(
            value
        ) {
            if (
                typeof value !==
                    "string"
            ) {
                throw new TypeError(
                    "rangeLength must be a string."
                );
            }

            const match =
                value.trim().match(
                    /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/
                );

            if (!match) {
                throw new TypeError(
                    "rangeLength must match [h:m]m:ss[.ms]."
                );
            }

            const hours =
                match[1] === undefined
                    ? 0
                    : Number(match[1]);

            const minutes =
                Number(match[2]);

            const seconds =
                Number(match[3]);

            const milliseconds =
                match[4] === undefined
                    ? 0
                    : Number(
                        match[4].padEnd(
                            3,
                            "0"
                        )
                    );

            if (
                minutes > 59 ||
                seconds > 59
            ) {
                throw new RangeError(
                    "rangeLength contains an invalid duration."
                );
            }

            const total =
                hours * ClockTimer.#HOUR +
                minutes * 60 * 1000 +
                seconds * 1000 +
                milliseconds;

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

            if (
                preserveRangeLength
            ) {
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

        #replaceRangeWithSegments(
            range,
            spans
        ) {
            const preservedAttributes =
                this.#getPreservedAttributes(
                    range
                );

            const preserveRangeLength =
                range.hasAttribute(
                    "range-length"
                );

            let firstSegment =
                true;

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
                        this.#getRingIndex(
                            cursor
                        );

                    const ringEnd =
                        this.#getRingStart(
                            ringIndex
                        ) +
                        ClockTimer.#HOUR;

                    const segmentEnd =
                        Math.min(
                            spanEnd,
                            ringEnd
                        );

                    const segment =
                        firstSegment
                            ? range
                            : document.createElement(
                                "time-range"
                            );

                    if (
                        !firstSegment
                    ) {
                        this.#applyPreservedAttributes(
                            segment,
                            preservedAttributes
                        );
                    }

                    this.#setRangeTiming(
                        segment,
                        cursor,
                        segmentEnd,
                        preserveRangeLength
                    );

                    const ring =
                        this.#ensureRing(
                            ringIndex
                        );

                    if (
                        segment === range &&
                        range.parentElement !== ring
                    ) {
                        if (
                            typeof range.removeAnimated ===
                                "function"
                        ) {
                            range.removeAnimated({
                                collapseTo: "end"
                            });
                        }
                        else {
                            range.remove();
                        }

                        const movedSegment =
                            document.createElement(
                                "time-range"
                            );

                        this.#applyPreservedAttributes(
                            movedSegment,
                            preservedAttributes
                        );

                        this.#setRangeTiming(
                            movedSegment,
                            cursor,
                            segmentEnd,
                            preserveRangeLength
                        );

                        ring.appendChild(
                            movedSegment
                        );
                    }
                    else if (
                        segment.parentElement !== ring
                    ) {
                        ring.appendChild(
                            segment
                        );
                    }

                    firstSegment =
                        false;

                    cursor =
                        segmentEnd;
                }
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
                    this.#getRingIndex(
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
                        this.#getRingIndex(
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
                    this.#getRingIndex(
                        cursor
                    );

                const ringEnd =
                    this.#getRingStart(
                        ringIndex
                    ) +
                    ClockTimer.#HOUR;

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
                Number.isFinite(
                    this.#startTimeMilliseconds
                ) &&
                this.#startTimeMilliseconds >= cutoff
            ) {
                this.#startTimeMilliseconds += delta;

                this.#startTime =
                    this.#formatTimelineTime(
                        this.#startTimeMilliseconds
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

        #shiftRangesAfter(
            cutoff,
            delta,
            excludedRecord
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
            this.#renderAllInsertedRanges();

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

            this.#openEndedLastTick =
                now;

            this.#shiftRangesAfter(
                previous,
                delta,
                record
            );

            this.#renderAllInsertedRanges();
        }

        #refreshRingLayout(
            now,
            {
                refreshTickMarks = false
            } = {}
        ) {
            const duration =
                this.#getRangeAnimationDuration();

            for (
                const ring of
                    this.querySelectorAll(
                        ":scope > ring-container"
                    )
            ) {
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

        #updateIndicatorSymbol() {
            if (!this.#indicatorRing || !this.#indicatorTrack || !this.#indicatorSymbol) {
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

            const millisecondsIntoHour =
                (
                    end % ClockTimer.#HOUR +
                    ClockTimer.#HOUR
                ) % ClockTimer.#HOUR;

            const normalizedAngle =
                (
                    millisecondsIntoHour /
                    ClockTimer.#HOUR
                ) * 360;

            const inset =
                ring.renderedInset ??
                ring.inset ??
                "0px";

            const renderedWidth =
                Number.parseFloat(
                    ring.renderedWidth ??
                    ring.width ??
                    "0px"
                );

            if (
                Number.isFinite(renderedWidth) &&
                renderedWidth > 0
            ) {
                const symbolSize =
                    renderedWidth * 0.8;

                this.#indicatorSymbol.style.setProperty(
                    "--clock-timer-auto-indicator-symbol-size",
                    `${symbolSize}px`
                );
            }

            this.#indicatorRing.style.inset = inset;
            this.#indicatorTrack.style.transform = `rotate(${normalizedAngle}deg)`;
            this.#setIndicatorSymbolVisible(!this.#starting);
        }

        #needsTick() {
            return (
                this.#started ||
                Boolean(
                    this.#openEndedRange
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

        #buildPlannedRanges() {
            if (
                !this.#started
            ) {
                return;
            }

            if (
                this.#startTimeMilliseconds !==
                    undefined &&
                this.#scheduledStartMilliseconds >
                    this.#startTimeMilliseconds
            ) {
                this.#createSpan(
                    "early-start",
                    this.#startTimeMilliseconds,
                    this.#scheduledStartMilliseconds
                );
            }

            if (
                this.#startTimeMilliseconds !==
                    undefined &&
                this.#startTimeMilliseconds >
                    this.#scheduledStartMilliseconds
            ) {
                this.#createSpan(
                    "late-start",
                    this.#scheduledStartMilliseconds,
                    this.#startTimeMilliseconds
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

                this.#createSpan(
                    "tolerance",
                    this.#calculatedEnd,
                    this.#standardEnd
                );

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
                    this.#getRingIndex(
                        cursor
                    );

                const ringStart =
                    this.#getRingStart(
                        ringIndex
                    );

                const ringEnd =
                    ringStart +
                    ClockTimer.#HOUR;

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
                type ===
                    "elapsed"
            ) {
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
                this.#getRingIndex(
                    now
                );

            const ringStart =
                this.#getRingStart(
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

                return;
            }

            this.#setRangeEnd(
                this.#elapsedRange,
                now
            );

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
                this.#getRingIndex(
                    overtimeStart
                );

            const lastRing =
                this.#getRingIndex(
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
                    this.#getRingStart(
                        ringIndex
                    );

                const ringEnd =
                    ringStart +
                    ClockTimer.#HOUR;

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
            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "start-time"
                ) !==
                    formatted
            ) {
                range.setAttribute(
                    "start-time",
                    formatted
                );
            }

            range.clockTimerStart =
                String(
                    milliseconds
                );
        }

        #setRangeEnd(
            range,
            milliseconds
        ) {
            const formatted =
                this.#formatTimelineTime(
                    milliseconds
                );

            if (
                range.getAttribute(
                    "end-time"
                ) !==
                    formatted
            ) {
                range.setAttribute(
                    "end-time",
                    formatted
                );
            }

            range.clockTimerEnd =
                String(
                    milliseconds
                );
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

            const initialWidth =
                "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";

            if (this.#starting) {
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
                this.#getRingIndex(
                    now
                );

            const activeRing =
                this.#ensureRing(
                    activeIndex
                );

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

                if (this.#starting) {
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
                        0
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
            if (
                !this.#needsTick()
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
                            !this.#needsTick()
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

            if (
                !this.#started
            ) {
                return;
            }

            const now =
                this.#getCurrentTimelineTime(
                    nowDate
                );

            this.#ensureRing(
                this.#getRingIndex(
                    now
                )
            );

            this.#updateElapsedRange(
                now
            );

            this.#updateOvertimeRanges(
                now
            );

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
                : "hhmmss";
        }

        #normalizeFormat() {
            const value =
                this.getAttribute(
                    "format"
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
                        "format",
                        defaultFormat
                    );
                }
            }
        }

        #isValidFormat(
            value
        ) {
            if (
                typeof value !==
                    "string"
            ) {
                return false;
            }

            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            if (military) {
                return /^(?:hhmm|hhmmss)$/.test(
                    value
                );
            }

            return /^(?:hh:mm(?::ss)?|(?:h|0h):mm(?::ss)?(?: ?(?:a\/p|A\/P|AM\/PM|A\.M\.\/P\.M\.|am\/pm|a\.m\.\/p\.m\.))?)$/.test(
                value
            );
        }

        #updateDisplay(
            now
        ) {
            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            const format =
                this.getAttribute(
                    "format"
                ) ??
                this.#getDefaultFormat();

            const rawHours =
                now.getHours();

            const minutes =
                String(
                    now.getMinutes()
                ).padStart(
                    2,
                    "0"
                );

            const seconds =
                String(
                    now.getSeconds()
                ).padStart(
                    2,
                    "0"
                );

            if (military) {
                const hourText =
                    String(
                        rawHours
                    ).padStart(
                        2,
                        "0"
                    );

                this.#timeElement.textContent =
                    format === "hhmmss"
                        ? `${hourText}${minutes}${seconds}`
                        : `${hourText}${minutes}`;

                this.#scheduleFontSizing();

                return;
            }

            const militaryHour =
                format.startsWith(
                    "hh:"
                );

            const padHour =
                militaryHour ||
                format.startsWith(
                    "0h:"
                );

            const hourValue =
                militaryHour
                    ? rawHours
                    : rawHours % 12 || 12;

            const hourText =
                padHour
                    ? String(hourValue).padStart(2, "0")
                    : String(hourValue);

            const hasSeconds =
                /:ss(?: |$)/.test(
                    format
                );

            let result =
                `${hourText}:${minutes}`;

            if (hasSeconds) {
                result +=
                    `:${seconds}`;
            }

            if (!militaryHour) {
                const suffixMatch =
                    format.match(
                        /^(?:h|0h):mm(?::ss)?( ?)(a\/p|A\/P|AM\/PM|A\.M\.\/P\.M\.|am\/pm|a\.m\.\/p\.m\.)$/
                    );

                if (suffixMatch) {
                    const space =
                        suffixMatch[1];

                    const style =
                        suffixMatch[2];

                    const pm =
                        rawHours >= 12;

                    const suffixes = {
                        "a/p": pm ? "p" : "a",
                        "A/P": pm ? "P" : "A",
                        "AM/PM": pm ? "PM" : "AM",
                        "A.M./P.M.": pm ? "P.M." : "A.M.",
                        "am/pm": pm ? "pm" : "am",
                        "a.m./p.m.": pm ? "p.m." : "a.m."
                    };

                    result +=
                        space +
                        suffixes[style];
                }
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
