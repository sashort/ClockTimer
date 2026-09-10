class TimeRange extends HTMLElement {
    static #instances = [];
    static #percentGoal = 1;
    static #calculatedEndTime;
    static #reordering = false;
    static #animationDuration = 333;

    #startTime;
    #endTime;
    #rangeLength;
    #shadowRoot;
    #styleElement;
    #geometryStyleElement;
    #contourLayer;
    #elapsedBaseLayer;
    #elapsedEdgeLayer;
    #elapsedWaveLayer;
    #appearanceObserver;
    #appearanceRefreshFrame;
    #syncing = 0;
    #suspendAnimations = false;
    #renderStartTime;
    #renderEndTime;
    #animationFrame;
    #animationStartedAt;
    #animationFromStart;
    #animationFromEnd;
    #animationTargetStart;
    #animationTargetEnd;
    #pendingRemoval = false;
    #removeAfterAnimation = false;

    static get observedAttributes() {
        return [
            "start-time",
            "end-time",
            "range-length",
            "overlapping"
        ];
    }

    static get percentGoal() {
        return TimeRange.#percentGoal;
    }

    static get animationDuration() {
        return TimeRange.#animationDuration;
    }

    static set animationDuration(value) {
        const duration = Number(value);

        if (
            Number.isFinite(duration) &&
            duration >= 0
        ) {
            TimeRange.#animationDuration =
                duration;
        }
    }

    static set percentGoal(value) {
        let preventConvert = false;

        try {
            if (
                typeof value === "string"
            ) {
                value =
                    value.replace(
                        /\s/g,
                        ""
                    );

                if (
                    value.endsWith(
                        "%"
                    )
                ) {
                    value =
                        value.slice(
                            0,
                            -1
                        );

                    preventConvert =
                        true;
                }
            }

            value =
                Number(
                    value
                );

            if (
                Number.isNaN(
                    value
                )
            ) {
                value = 1;
            }
        } catch {
            value = 1;
        }

        if (
            value <= 0
        ) {
            value = 1;
        } else if (
            value > 1.5 &&
            !preventConvert
        ) {
            value /=
                100;
        }

        TimeRange.#percentGoal =
            value;
    }

    static #calculateTimeAngle(
        time,
        origin
    ) {
        const millisecondsInHour =
            60 *
            60 *
            1000;

        let milliseconds;

        if (
            origin instanceof Date
        ) {
            const difference =
                time.getTime() -
                origin.getTime();

            if (
                difference >= 0 &&
                difference <=
                    millisecondsInHour
            ) {
                milliseconds =
                    difference;
            }
            else {
                milliseconds =
                    (
                        difference %
                            millisecondsInHour +
                        millisecondsInHour
                    ) %
                    millisecondsInHour;
            }
        }
        else {
            milliseconds =
                time.getMinutes() *
                    60 *
                    1000 +
                time.getSeconds() *
                    1000 +
                time.getMilliseconds();
        }

        return (
            360 /
            millisecondsInHour
        ) *
        milliseconds;
    }

    constructor() {
        super();

        this.#shadowRoot =
            this.attachShadow({
                mode: "open"
            });

        const contourStyle =
            document.createElement(
                "style"
            );

        contourStyle.textContent = `
            :host {
                position: relative;
            }

            #contour {
                position: absolute;
                inset: 0;
                pointer-events: none;
                background-repeat: no-repeat;
            }

            :host([overlapping]) #contour {
                display: none;
            }

            #elapsed-base,
            #elapsed-edge,
            #elapsed-wave {
                position: absolute;
                inset: 0;
                display: none;
                pointer-events: none;
                background-repeat: no-repeat;
            }

            #elapsed-wave {
                transform-origin: 50% 50%;
                will-change: transform;
            }

            :host([type="elapsed"]) {
                animation: none !important;
                background: transparent !important;
                background-color: transparent !important;
                background-image: none !important;
            }

            :host([type="elapsed"]) #elapsed-base,
            :host([type="elapsed"]) #elapsed-edge,
            :host([type="elapsed"]) #elapsed-wave {
                display: block;
            }

            :host([type="elapsed"]) #elapsed-wave {
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

            @keyframes elapsed-wave-sweep {
                0% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-start-angle, 0deg)
                    );
                }

                3% {
                    opacity: 1;
                }

                30.333% {
                    opacity: 1;
                }

                33.333% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }

                100% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }
            }
        `;

        this.#contourLayer =
            document.createElement(
                "div"
            );

        this.#contourLayer.id =
            "contour";

        this.#elapsedBaseLayer =
            document.createElement(
                "div"
            );

        this.#elapsedBaseLayer.id =
            "elapsed-base";

        this.#elapsedEdgeLayer =
            document.createElement(
                "div"
            );

        this.#elapsedEdgeLayer.id =
            "elapsed-edge";

        this.#elapsedWaveLayer =
            document.createElement(
                "div"
            );

        this.#elapsedWaveLayer.id =
            "elapsed-wave";

        this.#styleElement =
            document.createElement(
                "style"
            );

        this.#geometryStyleElement =
            document.createElement(
                "style"
            );

        this.#shadowRoot.append(
            contourStyle,
            this.#geometryStyleElement,
            this.#styleElement,
            this.#contourLayer,
            this.#elapsedBaseLayer,
            this.#elapsedEdgeLayer,
            this.#elapsedWaveLayer
        );
    }

    connectedCallback() {
        if (
            TimeRange.#reordering
        ) {
            return;
        }

        this.#suspendAnimations =
            true;

        this.#initializeFromAttributes();

        this.#suspendAnimations =
            false;

        this.#syncing++;

        try {
            this.#normalizeAttributes();
        } finally {
            this.#syncing--;
        }

        if (
            !TimeRange.#instances.includes(
                this
            )
        ) {
            TimeRange.#instances.push(
                this
            );
        }

        if (
            TimeRange.#instances.length > 1
        ) {
            this.#removeOverlaps();
        }

        TimeRange.#reorderParent(
            this.parentElement
        );

        this.#startAppearanceObserver();
        this.#scheduleAppearanceRefresh();

        if (
            this.timeRangeFullEntry ===
                true
        ) {
            delete this.timeRangeFullEntry;

            this.#renderStartTime =
                this.#cloneDate(
                    this.#startTime
                );

            this.#renderEndTime =
                this.#cloneDate(
                    this.#endTime
                );

            this.#updateClipPath();
        }
        else {
            this.#renderStartTime =
                this.#cloneDate(
                    this.#startTime
                );

            this.#renderEndTime =
                this.#cloneDate(
                    this.#startTime
                );

            this.#animateToLogicalTiming();
        }
    }

    disconnectedCallback() {
        if (
            TimeRange.#reordering
        ) {
            return;
        }

        this.#stopAppearanceObserver();

        if (
            this.#animationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#animationFrame
            );

            this.#animationFrame =
                undefined;
        }

        const index =
            TimeRange.#instances.indexOf(
                this
            );

        if (
            index !== -1
        ) {
            TimeRange.#instances.splice(
                index,
                1
            );
        }
    }

    attributeChangedCallback(
        name,
        oldValue,
        newValue
    ) {
        if (
            this.#syncing !== 0 ||
            oldValue === newValue ||
            !this.isConnected
        ) {
            return;
        }

        this.#scheduleAppearanceRefresh();

        if (
            name ===
                "overlapping"
        ) {
            TimeRange.#reorderParent(
                this.parentElement
            );

            return;
        }

        if (
            newValue === null
        ) {
            TimeRange.#updateParentClipPaths(
                this.parentElement
            );

            return;
        }

        switch (
            name
        ) {
            case "start-time":
                this.#setStartTime(
                    this.#uniformDate(
                        newValue,
                        false
                    )
                );
                break;

            case "end-time":
                this.#setEndTime(
                    this.#uniformDate(
                        newValue,
                        false
                    )
                );
                break;

            case "range-length":
                this.#setRangeLength(
                    this.#parseRangeLength(
                        newValue
                    )
                );
                break;
        }
    }

    #initializeFromAttributes() {
        const hasStart =
            this.hasAttribute(
                "start-time"
            );

        const hasEnd =
            this.hasAttribute(
                "end-time"
            );

        const hasRange =
            this.hasAttribute(
                "range-length"
            );

        const start =
            hasStart
                ? this.#uniformDate(
                    this.getAttribute(
                        "start-time"
                    ),
                    false
                )
                : undefined;

        const end =
            hasEnd
                ? this.#uniformDate(
                    this.getAttribute(
                        "end-time"
                    ),
                    false
                )
                : undefined;

        const range =
            hasRange
                ? this.#parseRangeLength(
                    this.getAttribute(
                        "range-length"
                    )
                )
                : undefined;

        this.#syncing++;

        try {
            this.#startTime =
                start;

            this.#endTime =
                end;

            this.#rangeLength =
                range;
        } finally {
            this.#syncing--;
        }

        if (
            start instanceof Date &&
            Number.isInteger(
                range
            ) &&
            range > 0
        ) {
            this.#setStartTime(
                start
            );

            return;
        }

        if (
            end instanceof Date &&
            Number.isInteger(
                range
            ) &&
            range > 0
        ) {
            this.#setEndTime(
                end
            );

            return;
        }

        if (
            start instanceof Date &&
            end instanceof Date
        ) {
            this.#setStartTime(
                start
            );

            return;
        }

        if (
            start instanceof Date
        ) {
            this.#setStartTime(
                start
            );

            return;
        }

        if (
            end instanceof Date
        ) {
            this.#setEndTime(
                end
            );

            return;
        }

        if (
            Number.isInteger(
                range
            ) &&
            range > 0
        ) {
            this.#setRangeLength(
                range
            );
        }
    }

    #normalizeAttributes() {
        this.#writeStartTimeAttribute();
        this.#writeEndTimeAttribute();
        this.#writeRangeLengthAttribute();
    }

    #getStartTime() {
        return this.#startTime;
    }

    #setStartTime(
        value
    ) {
        if (
            !(
                value instanceof Date
            )
        ) {
            return;
        }

        this.#startTime =
            value;

        if (
            this.#syncing !== 0
        ) {
            return;
        }

        this.#syncing++;

        try {
            const hasEnd =
                this.hasAttribute(
                    "end-time"
                );

            const hasRange =
                this.hasAttribute(
                    "range-length"
                );

            if (
                hasRange &&
                Number.isInteger(
                    this.#rangeLength
                ) &&
                this.#rangeLength > 0
            ) {
                this.#endTime =
                    new Date(
                        this.#startTime.getTime() +
                        this.#rangeLength
                    );

                this.#writeEndTimeAttribute();
            } else if (
                hasEnd &&
                this.#endTime instanceof Date
            ) {
                this.#rangeLength =
                    this.#endTime.getTime() -
                    this.#startTime.getTime();

                this.#writeRangeLengthAttribute();
            }

            this.#writeStartTimeAttribute();
        } finally {
            this.#syncing--;
        }

        if (
            this.isConnected
        ) {
            if (
                this.#suspendAnimations
            ) {
                this.#renderStartTime =
                    this.#cloneDate(
                        this.#startTime
                    );

                this.#renderEndTime =
                    this.#cloneDate(
                        this.#endTime
                    );

                this.#updateClipPath();
            }
            else {
                this.#animateToLogicalTiming();
            }
        }
    }

    stopElapsedAnimation() {
        if (
            this.getAttribute(
                "type"
            ) !== "elapsed"
        ) {
            return this;
        }

        this.#elapsedWaveLayer.style.animationPlayState =
            "paused";

        return this;
    }

    transitionTo({
        startTime,
        endTime
    } = {}) {
        const start =
            this.#uniformDate(
                startTime,
                false
            );

        const end =
            this.#uniformDate(
                endTime,
                false
            );

        if (
            !(start instanceof Date) ||
            !(end instanceof Date) ||
            end.getTime() <=
                start.getTime()
        ) {
            return false;
        }

        this.#syncing++;

        try {
            this.#startTime =
                start;

            this.#endTime =
                end;

            this.#rangeLength =
                end.getTime() -
                start.getTime();

            this.#writeStartTimeAttribute();
            this.#writeEndTimeAttribute();
            this.#writeRangeLengthAttribute();
        } finally {
            this.#syncing--;
        }

        if (this.isConnected) {
            this.#animateToLogicalTiming();
        }

        return true;
    }

    #getEndTime() {
        return this.#endTime;
    }

    #setEndTime(
        value
    ) {
        if (
            !(
                value instanceof Date
            )
        ) {
            return;
        }

        this.#endTime =
            value;

        if (
            this.#syncing !== 0
        ) {
            return;
        }

        this.#syncing++;

        try {
            const hasStart =
                this.hasAttribute(
                    "start-time"
                );

            const hasRange =
                this.hasAttribute(
                    "range-length"
                );

            if (
                hasRange &&
                Number.isInteger(
                    this.#rangeLength
                ) &&
                this.#rangeLength > 0
            ) {
                this.#startTime =
                    new Date(
                        this.#endTime.getTime() -
                        this.#rangeLength
                    );

                this.#writeStartTimeAttribute();
            } else if (
                hasStart &&
                this.#startTime instanceof Date
            ) {
                this.#rangeLength =
                    this.#endTime.getTime() -
                    this.#startTime.getTime();

                this.#writeRangeLengthAttribute();
            }

            this.#writeEndTimeAttribute();
        } finally {
            this.#syncing--;
        }

        if (
            this.isConnected
        ) {
            if (
                this.#suspendAnimations
            ) {
                this.#renderStartTime =
                    this.#cloneDate(
                        this.#startTime
                    );

                this.#renderEndTime =
                    this.#cloneDate(
                        this.#endTime
                    );

                this.#updateClipPath();
            }
            else {
                this.#animateToLogicalTiming();
            }
        }
    }

    #getRangeLength() {
        return this.#rangeLength;
    }

    #setRangeLength(
        value
    ) {
        if (
            !Number.isInteger(
                value
            ) ||
            value <= 0
        ) {
            return;
        }

        this.#rangeLength =
            value;

        if (
            this.#syncing !== 0
        ) {
            return;
        }

        this.#syncing++;

        try {
            const hasStart =
                this.hasAttribute(
                    "start-time"
                );

            const hasEnd =
                this.hasAttribute(
                    "end-time"
                );

            if (
                hasStart &&
                this.#startTime instanceof Date
            ) {
                this.#endTime =
                    new Date(
                        this.#startTime.getTime() +
                        this.#rangeLength
                    );

                this.#writeEndTimeAttribute();
            } else if (
                hasEnd &&
                this.#endTime instanceof Date
            ) {
                this.#startTime =
                    new Date(
                        this.#endTime.getTime() -
                        this.#rangeLength
                    );

                this.#writeStartTimeAttribute();
            }

            this.#writeRangeLengthAttribute();
        } finally {
            this.#syncing--;
        }

        if (
            this.isConnected
        ) {
            if (
                this.#suspendAnimations
            ) {
                this.#renderStartTime =
                    this.#cloneDate(
                        this.#startTime
                    );

                this.#renderEndTime =
                    this.#cloneDate(
                        this.#endTime
                    );

                this.#updateClipPath();
            }
            else {
                this.#animateToLogicalTiming();
            }
        }
    }

    #writeStartTimeAttribute() {
        if (
            !this.hasAttribute(
                "start-time"
            ) ||
            !(
                this.#startTime instanceof Date
            )
        ) {
            return;
        }

        const value =
            this.#formatDateTime(
                this.#startTime
            );

        if (
            this.getAttribute(
                "start-time"
            ) !== value
        ) {
            this.setAttribute(
                "start-time",
                value
            );
        }
    }

    #writeEndTimeAttribute() {
        if (
            !this.hasAttribute(
                "end-time"
            ) ||
            !(
                this.#endTime instanceof Date
            )
        ) {
            return;
        }

        const value =
            this.#formatDateTime(
                this.#endTime
            );

        if (
            this.getAttribute(
                "end-time"
            ) !== value
        ) {
            this.setAttribute(
                "end-time",
                value
            );
        }
    }

    #writeRangeLengthAttribute() {
        if (
            !this.hasAttribute(
                "range-length"
            ) ||
            !Number.isInteger(
                this.#rangeLength
            ) ||
            this.#rangeLength <= 0
        ) {
            return;
        }

        const value =
            this.#formatRangeLength(
                this.#rangeLength
            );

        if (
            this.getAttribute(
                "range-length"
            ) !== value
        ) {
            this.setAttribute(
                "range-length",
                value
            );
        }
    }

    #uniformDate(
        timeValue,
        lookForward = true
    ) {
        if (
            timeValue === null ||
            timeValue === undefined
        ) {
            return undefined;
        }

        if (
            timeValue instanceof Date
        ) {
            return new Date(
                timeValue.getTime()
            );
        }

        if (
            typeof timeValue === "number" &&
            Number.isInteger(
                timeValue
            )
        ) {
            const date =
                new Date(
                    timeValue
                );

            return Number.isNaN(
                date.getTime()
            )
                ? undefined
                : date;
        }

        if (
            typeof timeValue !== "string"
        ) {
            return undefined;
        }

        const value =
            timeValue.trim();

        if (
            value === ""
        ) {
            return undefined;
        }

        if (
            /^-?\d+$/.test(
                value
            )
        ) {
            const date =
                new Date(
                    Number(
                        value
                    )
                );

            return Number.isNaN(
                date.getTime()
            )
                ? undefined
                : date;
        }

        const timeMatch =
            value.match(
                /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?\s*(AM|PM)?$/i
            );

        if (
            timeMatch
        ) {
            let hour =
                Number(
                    timeMatch[1]
                );

            const minute =
                timeMatch[2] === undefined
                    ? 0
                    : Number(
                        timeMatch[2]
                    );

            const second =
                timeMatch[3] === undefined
                    ? 0
                    : Number(
                        timeMatch[3]
                    );

            const millisecond =
                timeMatch[4] === undefined
                    ? 0
                    : Number(
                        timeMatch[4]
                            .padEnd(
                                3,
                                "0"
                            )
                    );

            const meridiem =
                timeMatch[5]
                    ?.toUpperCase();

            if (
                meridiem
            ) {
                if (
                    hour < 1 ||
                    hour > 12
                ) {
                    return undefined;
                }

                if (
                    meridiem === "AM"
                ) {
                    if (
                        hour === 12
                    ) {
                        hour = 0;
                    }
                } else if (
                    hour !== 12
                ) {
                    hour += 12;
                }
            } else if (
                hour < 0 ||
                hour > 23
            ) {
                return undefined;
            }

            if (
                minute > 59 ||
                second > 59
            ) {
                return undefined;
            }

            const now =
                new Date();

            const date =
                new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    hour,
                    minute,
                    second,
                    millisecond
                );

            if (
                lookForward &&
                date.getTime() <
                    now.getTime()
            ) {
                date.setDate(
                    date.getDate() + 1
                );
            }

            return date;
        }

        const dateTimeMatch =
            value.match(
                /^\d{4}-\d{2}-\d{2}[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:\s*(?:AM|PM))?(?:Z|[+-]\d{2}:?\d{2})?$/i
            );

        if (
            !dateTimeMatch
        ) {
            return undefined;
        }

        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return undefined;
        }

        return date;
    }

    #formatDateTime(
        date
    ) {
        if (
            !(
                date instanceof Date
            )
        ) {
            return undefined;
        }

        const year =
            String(
                date.getFullYear()
            ).padStart(
                4,
                "0"
            );

        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            );

        const hour =
            String(
                date.getHours()
            ).padStart(
                2,
                "0"
            );

        const minute =
            String(
                date.getMinutes()
            ).padStart(
                2,
                "0"
            );

        const second =
            date.getSeconds();

        const millisecond =
            date.getMilliseconds();

        let result =
            `${year}-${month}-${day} ` +
            `${hour}:${minute}`;

        if (
            second !== 0 ||
            millisecond !== 0
        ) {
            result +=
                `:${String(
                    second
                ).padStart(
                    2,
                    "0"
                )}`;
        }

        if (
            millisecond !== 0
        ) {
            result +=
                `.${String(
                    millisecond
                ).padStart(
                    3,
                    "0"
                )}`;
        }

        return result;
    }

    #parseRangeLength(
        value
    ) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return undefined;
        }

        if (
            typeof value === "number" &&
            Number.isInteger(
                value
            ) &&
            value > 0
        ) {
            return value;
        }

        if (
            typeof value !== "string"
        ) {
            return undefined;
        }

        const normalized =
            value
                .trim()
                .replace(
                    /\s/g,
                    ""
                );

        if (
            !/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(
                normalized
            )
        ) {
            return undefined;
        }

        const parts =
            normalized.split(
                ":"
            );

        let milliseconds =
            0;

        const secondsPart =
            parts.pop();

        let seconds;
        let fractionalMilliseconds =
            0;

        if (
            secondsPart.includes(
                "."
            )
        ) {
            const [
                whole,
                fraction
            ] =
                secondsPart.split(
                    "."
                );

            seconds =
                Number(
                    whole
                );

            fractionalMilliseconds =
                Number(
                    fraction
                        .padEnd(
                            3,
                            "0"
                        )
                        .slice(
                            0,
                            3
                        )
                );
        } else {
            seconds =
                Number(
                    secondsPart
                );
        }

        if (
            parts.length === 0
        ) {
            milliseconds +=
                seconds *
                1000;
        } else if (
            parts.length === 1
        ) {
            milliseconds +=
                Number(
                    parts[0]
                ) *
                60 *
                1000;

            milliseconds +=
                seconds *
                1000;
        } else if (
            parts.length === 2
        ) {
            milliseconds +=
                Number(
                    parts[0]
                ) *
                60 *
                60 *
                1000;

            milliseconds +=
                Number(
                    parts[1]
                ) *
                60 *
                1000;

            milliseconds +=
                seconds *
                1000;
        }

        milliseconds +=
            fractionalMilliseconds;

        if (
            !Number.isInteger(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        return milliseconds;
    }

    #formatRangeLength(
        milliseconds
    ) {
        if (
            !Number.isInteger(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        let remaining =
            milliseconds;

        const hours =
            Math.floor(
                remaining /
                (
                    60 *
                    60 *
                    1000
                )
            );

        remaining %=
            60 *
            60 *
            1000;

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

        let result;

        if (
            hours > 0
        ) {
            result =
                `${hours}:` +
                `${String(
                    minutes
                ).padStart(
                    2,
                    "0"
                )}:` +
                `${String(
                    seconds
                ).padStart(
                    2,
                    "0"
                )}`;
        } else if (
            minutes > 0
        ) {
            result =
                `${minutes}:` +
                `${String(
                    seconds
                ).padStart(
                    2,
                    "0"
                )}`;
        } else {
            result =
                String(
                    seconds
                );
        }

        if (
            millisecondsPart !== 0
        ) {
            result +=
                `.${String(
                    millisecondsPart
                ).padStart(
                    3,
                    "0"
                )}`;
        }

        return result;
    }

    #getEdgePoint(
        angle,
        width,
        height
    ) {
        const radians =
            angle *
            Math.PI /
            180;

        const centerX =
            width /
            2;

        const centerY =
            height /
            2;

        const dx =
            Math.sin(
                radians
            );

        const dy =
            -Math.cos(
                radians
            );

        const scaleX =
            dx === 0
                ? Infinity
                : Math.abs(
                    centerX /
                    dx
                );

        const scaleY =
            dy === 0
                ? Infinity
                : Math.abs(
                    centerY /
                    dy
                );

        const scale =
            Math.min(
                scaleX,
                scaleY
            );

        return {
            x:
                centerX +
                dx *
                scale,

            y:
                centerY +
                dy *
                scale
        };
    }

    #getCornersBetweenAngles(
        startAngle,
        endAngle,
        width,
        height
    ) {
        const normalize =
            angle =>
                (
                    (
                        angle %
                        360
                    ) +
                    360
                ) %
                360;

        const clockwiseDistance =
            (
                from,
                to
            ) =>
                (
                    normalize(
                        to
                    ) -
                    normalize(
                        from
                    ) +
                    360
                ) %
                360;

        const corners = [
            {
                x: 0,
                y: 0
            },
            {
                x: width,
                y: 0
            },
            {
                x: width,
                y: height
            },
            {
                x: 0,
                y: height
            }
        ];

        const totalDistance =
            clockwiseDistance(
                startAngle,
                endAngle
            );

        return corners
            .map(
                corner => {
                    const dx =
                        corner.x -
                        width /
                        2;

                    const dy =
                        corner.y -
                        height /
                        2;

                    const angle =
                        normalize(
                            Math.atan2(
                                dx,
                                -dy
                            ) *
                            180 /
                            Math.PI
                        );

                    return {
                        ...corner,
                        angle
                    };
                }
            )
            .filter(
                corner => {
                    const distance =
                        clockwiseDistance(
                            startAngle,
                            corner.angle
                        );

                    return (
                        distance > 0 &&
                        distance <
                            totalDistance
                    );
                }
            )
            .sort(
                (a, b) =>
                    clockwiseDistance(
                        startAngle,
                        a.angle
                    ) -
                    clockwiseDistance(
                        startAngle,
                        b.angle
                    )
            );
    }

    #cloneDate(value) {
        return value instanceof Date
            ? new Date(
                value.getTime()
            )
            : undefined;
    }

    #getVisualTiming() {
        return {
            start:
                this.#cloneDate(
                    this.#renderStartTime ??
                    this.#startTime
                ),
            end:
                this.#cloneDate(
                    this.#renderEndTime ??
                    this.#endTime
                )
        };
    }

    #getAnimationDuration() {
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
            return TimeRange.#animationDuration;
        }

        const amount =
            Number(
                match[1]
            );

        if (
            !Number.isFinite(amount) ||
            amount < 0
        ) {
            return TimeRange.#animationDuration;
        }

        return (
            match[2].toLowerCase() ===
                "s"
        )
            ? amount * 1000
            : amount;
    }

    #animateToLogicalTiming() {
        if (
            !this.isConnected ||
            !(this.#startTime instanceof Date) ||
            !(this.#endTime instanceof Date)
        ) {
            return;
        }

        const visual =
            this.#getVisualTiming();

        this.#startTimingAnimation(
            visual.start ?? this.#startTime,
            visual.end ?? this.#startTime,
            this.#startTime,
            this.#endTime,
            false
        );
    }

    #startTimingAnimation(
        fromStart,
        fromEnd,
        targetStart,
        targetEnd,
        removeAfter = false
    ) {
        if (
            !(fromStart instanceof Date) ||
            !(fromEnd instanceof Date) ||
            !(targetStart instanceof Date) ||
            !(targetEnd instanceof Date)
        ) {
            return;
        }

        if (
            this.#animationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#animationFrame
            );
        }

        this.#animationFromStart =
            this.#cloneDate(fromStart);

        this.#animationFromEnd =
            this.#cloneDate(fromEnd);

        this.#animationTargetStart =
            this.#cloneDate(targetStart);

        this.#animationTargetEnd =
            this.#cloneDate(targetEnd);

        this.#animationStartedAt =
            performance.now();

        this.#removeAfterAnimation =
            removeAfter;

        const duration =
            this.#getAnimationDuration();

        if (
            duration <= 0
        ) {
            this.#renderStartTime =
                this.#cloneDate(targetStart);

            this.#renderEndTime =
                this.#cloneDate(targetEnd);

            this.#updateClipPath();
            this.#finishTimingAnimation();
            return;
        }

        const step =
            timestamp => {
                const progress =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                this.#animationStartedAt
                            ) /
                            duration
                        )
                    );

                const fromStartMs =
                    this.#animationFromStart.getTime();

                const fromEndMs =
                    this.#animationFromEnd.getTime();

                const targetStartMs =
                    this.#animationTargetStart.getTime();

                const targetEndMs =
                    this.#animationTargetEnd.getTime();

                this.#renderStartTime =
                    new Date(
                        fromStartMs +
                        (
                            targetStartMs -
                            fromStartMs
                        ) *
                        progress
                    );

                this.#renderEndTime =
                    new Date(
                        fromEndMs +
                        (
                            targetEndMs -
                            fromEndMs
                        ) *
                        progress
                    );

                this.#updateClipPath();

                if (
                    progress >= 1
                ) {
                    this.#animationFrame =
                        undefined;

                    this.#finishTimingAnimation();
                    return;
                }

                this.#animationFrame =
                    requestAnimationFrame(
                        step
                    );
            };

        this.#animationFrame =
            requestAnimationFrame(
                step
            );
    }

    #finishTimingAnimation() {
        const removeAfter =
            this.#removeAfterAnimation;

        this.#removeAfterAnimation =
            false;

        if (removeAfter) {
            this.#pendingRemoval =
                false;

            HTMLElement.prototype.remove.call(
                this
            );
        }
    }

    #animateOpacityIn() {
        const duration =
            this.#getAnimationDuration();

        if (
            duration <= 0 ||
            typeof this.animate !==
                "function"
        ) {
            return;
        }

        this.animate(
            [
                { opacity: 0 },
                { opacity: 1 }
            ],
            {
                duration,
                easing: "linear"
            }
        );
    }

    snapToLogicalTiming() {
        if (
            this.#animationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#animationFrame
            );

            this.#animationFrame =
                undefined;
        }

        this.#removeAfterAnimation =
            false;

        this.#renderStartTime =
            this.#cloneDate(
                this.#startTime
            );

        this.#renderEndTime =
            this.#cloneDate(
                this.#endTime
            );

        this.#updateClipPath();

        return this;
    }

    refreshVisualGeometry() {
        this.#updateClipPath();
        this.#scheduleAppearanceRefresh();

        return this;
    }

    removeAnimated({
        collapseTo = "end",
        targetStart,
        targetEnd
    } = {}) {
        if (
            this.#pendingRemoval
        ) {
            return;
        }

        if (!this.isConnected) {
            HTMLElement.prototype.remove.call(
                this
            );
            return;
        }

        this.#pendingRemoval =
            true;

        this.timeRangeExiting =
            true;

        const instanceIndex =
            TimeRange.#instances.indexOf(
                this
            );

        if (
            instanceIndex !== -1
        ) {
            TimeRange.#instances.splice(
                instanceIndex,
                1
            );
        }

        const visual =
            this.#getVisualTiming();

        let finalStart =
            targetStart instanceof Date
                ? targetStart
                : undefined;

        let finalEnd =
            targetEnd instanceof Date
                ? targetEnd
                : undefined;

        if (
            !(finalStart instanceof Date) ||
            !(finalEnd instanceof Date)
        ) {
            const collapseDate =
                collapseTo === "start"
                    ? (
                        visual.start ??
                        this.#startTime
                    )
                    : (
                        visual.end ??
                        this.#endTime
                    );

            finalStart =
                this.#cloneDate(collapseDate);

            finalEnd =
                this.#cloneDate(collapseDate);
        }

        this.#startTimingAnimation(
            visual.start ?? finalStart,
            visual.end ?? finalEnd,
            finalStart,
            finalEnd,
            true
        );
    }

    get isExiting() {
        return this.#pendingRemoval;
    }

    #getRingOriginTime() {
        const parent =
            this.parentElement;

        if (
            !parent ||
            parent.localName !==
                "ring-container" ||
            parent.clockTimerRing ===
                undefined
        ) {
            return undefined;
        }

        let earliest;

        for (
            const child of
                parent.children
        ) {
            if (
                child.localName !==
                    "time-range"
            ) {
                continue;
            }

            const value =
                child.getAttribute(
                    "start-time"
                );

            if (
                value === null
            ) {
                continue;
            }

            const start =
                this.#uniformDate(
                    value,
                    false
                );

            if (
                !(start instanceof Date)
            ) {
                continue;
            }

            if (
                !(earliest instanceof Date) ||
                start.getTime() <
                    earliest.getTime()
            ) {
                earliest =
                    start;
            }
        }

        if (
            !(earliest instanceof Date)
        ) {
            return undefined;
        }

        const hourOrigin =
            new Date(
                earliest.getTime()
            );

        hourOrigin.setMinutes(
            0,
            0,
            0
        );

        return hourOrigin;
    }

    static #updateParentClipPaths(
        parent
    ) {
        if (!parent) {
            return;
        }

        for (
            const child of
                parent.children
        ) {
            if (
                child instanceof
                    TimeRange
            ) {
                child.#updateClipPath();
            }
        }
    }

    #getRingInnerMargin(
        ring
    ) {
        if (
            ring.hasAttribute(
                "inner-margin"
            )
        ) {
            return (
                ring.getAttribute(
                    "inner-margin"
                ) ??
                "0px"
            );
        }

        return (
            ring.getAttribute(
                "margin"
            ) ??
            "0px"
        );
    }

    #getRingOuterMargin(
        ring
    ) {
        if (
            ring.hasAttribute(
                "outer-margin"
            )
        ) {
            return (
                ring.getAttribute(
                    "outer-margin"
                ) ??
                "0px"
            );
        }

        return (
            ring.getAttribute(
                "margin"
            ) ??
            "0px"
        );
    }

    #collapseRingMargins(
        first,
        second
    ) {
        return `calc(max(0px, ${first}, ${second}) + min(0px, ${first}, ${second}))`;
    }

    #getPreviousRingContainer(
        ring
    ) {
        let sibling =
            ring.previousElementSibling;

        while (sibling) {
            if (
                sibling.localName ===
                    "ring-container"
            ) {
                return sibling;
            }

            sibling =
                sibling.previousElementSibling;
        }

        return null;
    }

    #getEffectiveRingInset(
        ring
    ) {
        const inset =
            ring.getAttribute(
                "inset"
            );

        if (
            inset !== null &&
            inset.trim().toLowerCase() !==
                "auto"
        ) {
            return inset;
        }

        const width =
            ring.getAttribute(
                "width"
            ) ??
            "0px";

        const previous =
            this.#getPreviousRingContainer(
                ring
            );

        if (!previous) {
            return `calc(${this.#getRingOuterMargin(ring)} + (${width} / 2))`;
        }

        const previousInset =
            this.#getEffectiveRingInset(
                previous
            );

        const previousWidth =
            previous.getAttribute(
                "width"
            ) ??
            "0px";

        const adjoiningMargin =
            this.#collapseRingMargins(
                this.#getRingInnerMargin(
                    previous
                ),
                this.#getRingOuterMargin(
                    ring
                )
            );

        return `calc((0px + ${previousInset}) + (${previousWidth} / 2) + ${adjoiningMargin} + (${width} / 2))`;
    }

    #resolveLength(
        value
    ) {
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

        measure.style.width =
            value;

        measure.style.height =
            "0";

        this.#shadowRoot.appendChild(
            measure
        );

        const pixels =
            measure.getBoundingClientRect()
                .width;

        measure.remove();

        return Number.isFinite(
            pixels
        )
            ? pixels
            : 0;
    }

    #startAppearanceObserver() {
        this.#stopAppearanceObserver();

        this.#appearanceObserver =
            new MutationObserver(
                mutations => {
                    if (
                        mutations.some(
                            mutation =>
                                mutation.type === "attributes" &&
                                (
                                    mutation.target === this ||
                                    mutation.target === this.parentElement
                                )
                        )
                    ) {
                        this.#scheduleAppearanceRefresh();
                    }
                }
            );

        this.#appearanceObserver.observe(
            this,
            {
                attributes: true
            }
        );

        const parent =
            this.parentElement;

        if (parent) {
            this.#appearanceObserver.observe(
                parent,
                {
                    attributes: true,
                    childList: true,
                    subtree: true
                }
            );
        }
    }

    #stopAppearanceObserver() {
        this.#appearanceObserver?.disconnect();
        this.#appearanceObserver =
            undefined;

        if (
            this.#appearanceRefreshFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#appearanceRefreshFrame
            );

            this.#appearanceRefreshFrame =
                undefined;
        }
    }

    #scheduleAppearanceRefresh() {
        if (
            !this.isConnected ||
            this.#appearanceRefreshFrame !==
                undefined
        ) {
            return;
        }

        this.#appearanceRefreshFrame =
            requestAnimationFrame(
                () => {
                    this.#appearanceRefreshFrame =
                        undefined;

                    this.#updateElapsedWaveAppearance();
                }
            );
    }

    #parseComputedColor(value) {
        const match =
            String(value ?? "").match(
                /^rgba?\(\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)(?:\s*(?:,|\/)\s*([\d.]+%?))?\s*\)$/i
            );

        if (!match) {
            return undefined;
        }

        const alphaText =
            match[4];

        const alpha =
            alphaText === undefined
                ? 1
                : alphaText.endsWith("%")
                    ? Number(alphaText.slice(0, -1)) / 100
                    : Number(alphaText);

        return {
            red: Number(match[1]),
            green: Number(match[2]),
            blue: Number(match[3]),
            alpha: Number.isFinite(alpha)
                ? Math.min(1, Math.max(0, alpha))
                : 1
        };
    }

    #updateElapsedWaveAppearance() {
        if (
            !this.#elapsedBaseLayer ||
            !this.#elapsedEdgeLayer ||
            !this.#elapsedWaveLayer
        ) {
            return;
        }

        if (
            this.getAttribute("type") !==
                "elapsed"
        ) {
            this.#elapsedBaseLayer.style.background =
                "transparent";

            this.#elapsedEdgeLayer.style.backgroundImage =
                "none";

            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        const parent =
            this.parentElement;

        const activeRing =
            parent?.hasAttribute(
                "active"
            ) === true;

        let darkestLuminance = 1;
        let lightestLuminance = 0;
        let hasUnderlay = false;
        let strongestOpacity = 0;

        const channel =
            value => {
                const normalized =
                    value / 255;

                return normalized <= 0.04045
                    ? normalized / 12.92
                    : Math.pow(
                        (normalized + 0.055) / 1.055,
                        2.4
                    );
            };

        if (parent) {
            for (
                const range of
                    parent.children
            ) {
                if (
                    range === this ||
                    range.localName !==
                        "time-range" ||
                    range.getAttribute("type") ===
                        "elapsed"
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(range);

                const color =
                    this.#parseComputedColor(
                        style.backgroundColor
                    );

                const opacityValue =
                    Number.parseFloat(
                        style.opacity
                    );

                const opacity =
                    Number.isFinite(opacityValue)
                        ? Math.min(
                            1,
                            Math.max(
                                0,
                                opacityValue
                            )
                        )
                        : 1;

                if (color) {
                    const luminance =
                        0.2126 * channel(color.red) +
                        0.7152 * channel(color.green) +
                        0.0722 * channel(color.blue);

                    darkestLuminance =
                        Math.min(
                            darkestLuminance,
                            luminance
                        );

                    lightestLuminance =
                        Math.max(
                            lightestLuminance,
                            luminance
                        );

                    strongestOpacity =
                        Math.max(
                            strongestOpacity,
                            opacity * color.alpha
                        );

                    hasUnderlay =
                        true;
                }
                else if (
                    style.backgroundImage !==
                        "none"
                ) {
                    hasUnderlay =
                        true;

                    strongestOpacity =
                        Math.max(
                            strongestOpacity,
                            opacity
                        );
                }
            }
        }

        const contrastRange =
            hasUnderlay
                ? lightestLuminance -
                    darkestLuminance
                : 0;

        let strength =
            hasUnderlay
                ? 0.48 +
                    (1 - strongestOpacity) *
                        0.18 +
                    contrastRange *
                        0.16
                : 0.58;

        strength =
            Math.min(
                0.82,
                Math.max(
                    0.46,
                    strength
                )
            );

        const baseStrength =
            activeRing
                ? Math.min(
                    0.34,
                    Math.max(
                        0.24,
                        0.26 +
                            contrastRange * 0.05 +
                            (1 - strongestOpacity) * 0.04
                    )
                )
                : Math.min(
                    0.18,
                    Math.max(
                        0.12,
                        0.13 +
                            contrastRange * 0.03 +
                            (1 - strongestOpacity) * 0.03
                    )
                );

        const edgeStrength =
            activeRing
                ? Math.min(
                    0.48,
                    Math.max(
                        0.34,
                        0.37 +
                            contrastRange * 0.06 +
                            (1 - strongestOpacity) * 0.05
                    )
                )
                : Math.min(
                    0.25,
                    Math.max(
                        0.15,
                        0.17 +
                            contrastRange * 0.04 +
                            (1 - strongestOpacity) * 0.04
                    )
                );

        this.#elapsedBaseLayer.style.mixBlendMode =
            "screen";

        this.#elapsedBaseLayer.style.background =
            `rgba(255, 255, 255, ${baseStrength.toFixed(3)})`;

        this.#elapsedEdgeLayer.style.mixBlendMode =
            "screen";

        this.#elapsedEdgeLayer.style.setProperty(
            "--elapsed-edge-strength",
            edgeStrength.toFixed(3)
        );

        if (!activeRing) {
            this.#elapsedWaveLayer.style.animation =
                "none";

            this.#elapsedWaveLayer.style.opacity =
                "0";

            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        this.#elapsedWaveLayer.style.removeProperty(
            "animation"
        );

        this.#elapsedWaveLayer.style.removeProperty(
            "opacity"
        );

        const shoulder =
            strength * 0.38;

        const rgba =
            alpha =>
                `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

        this.#elapsedWaveLayer.style.mixBlendMode =
            "screen";

        this.#elapsedWaveLayer.style.backgroundImage =
            `conic-gradient(from 0deg at 50% 50%, ` +
            `transparent 0deg, ` +
            `transparent calc(180deg - var(--elapsed-wave-width, 12deg)), ` +
            `${rgba(shoulder)} calc(180deg - var(--elapsed-wave-shoulder, 4deg)), ` +
            `${rgba(strength)} 180deg, ` +
            `${rgba(shoulder)} calc(180deg + var(--elapsed-wave-shoulder, 4deg)), ` +
            `transparent calc(180deg + var(--elapsed-wave-width, 12deg)), ` +
            `transparent 360deg)`;
    }

    #updateContour() {
        const parent =
            this.parentElement;

        if (
            !parent ||
            parent.localName !==
                "ring-container" ||
            !this.#contourLayer
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
            this.#contourLayer.style.backgroundImage =
                "none";

            return;
        }

        const ringWidth =
            this.#resolveLength(
                parent.renderedWidth ??
                parent.getAttribute(
                    "width"
                ) ??
                "0px"
            );

        const ringInset =
            this.#resolveLength(
                parent.renderedInset ??
                this.#getEffectiveRingInset(
                    parent
                )
            );

        const radius =
            Math.min(
                width,
                height
            ) / 2;

        const innerRadius =
            Math.max(
                0,
                radius -
                    ringInset -
                    ringWidth / 2
            );

        const centerRadius =
            Math.max(
                0,
                radius -
                    ringInset
            );

        const outerRadius =
            Math.max(
                0,
                radius -
                    ringInset +
                    ringWidth / 2
            );

        this.#contourLayer.style.backgroundImage =
            `radial-gradient(circle at center, ` +
            `rgba(0, 0, 0, 0.28) ${innerRadius}px, ` +
            `rgba(255, 255, 255, 0.34) ${centerRadius}px, ` +
            `rgba(0, 0, 0, 0.22) ${outerRadius}px)`;

        if (this.#elapsedEdgeLayer) {
            const edge =
                2;

            this.#elapsedEdgeLayer.style.backgroundImage =
                `radial-gradient(circle at center, ` +
                `transparent ${Math.max(0, innerRadius - edge)}px, ` +
                `rgb(255 255 255 / var(--elapsed-edge-strength, 0.18)) ${innerRadius}px, ` +
                `transparent ${innerRadius + edge}px, ` +
                `transparent ${Math.max(innerRadius + edge, outerRadius - edge)}px, ` +
                `rgb(255 255 255 / var(--elapsed-edge-strength, 0.18)) ${outerRadius}px, ` +
                `transparent ${outerRadius + edge}px)`;
        }
    }

    #updateClipPath() {
        const parent =
            this.parentElement;

        if (
            !parent
        ) {
            return;
        }

        this.#updateContour();

        const width =
            parent.clientWidth;

        const height =
            parent.clientHeight;

        const ringInset =
            parent.getAttribute(
                "inset"
            );

        const ringWidth =
            parent.getAttribute(
                "width"
            );

        const effectiveRingInset =
            ringInset &&
                ringInset !== "auto"
                ? ringInset
                : "0px";

        const effectiveRingWidth =
            ringWidth ||
                "0px";

        this.#geometryStyleElement.textContent = `
            :host {
                --time-range-ring-inset: ${effectiveRingInset};
                --time-range-ring-width: ${effectiveRingWidth};
            }
        `;

        if (
            width <= 0 ||
            height <= 0 ||
            !(
                this.#startTime instanceof Date
            ) ||
            !(
                this.#endTime instanceof Date
            )
        ) {
            this.#styleElement.textContent =
                "";

            return;
        }

        const renderStart =
            this.#renderStartTime instanceof Date
                ? this.#renderStartTime
                : this.#startTime;

        const renderEnd =
            this.#renderEndTime instanceof Date
                ? this.#renderEndTime
                : this.#endTime;

        const duration =
            renderEnd.getTime() -
            renderStart.getTime();

        if (
            duration >=
                60 * 60 * 1000
        ) {
            if (
                this.getAttribute("type") ===
                    "elapsed"
            ) {
                const waveWidth = 38;

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-width",
                    `${waveWidth}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-shoulder",
                    `${waveWidth * 0.35}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-start-angle",
                    `${-waveWidth - 180}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-end-angle",
                    `${360 + waveWidth - 180}deg`
                );
            }

            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                }
            `;

            return;
        }

        const ringOrigin =
            this.#getRingOriginTime();

        const startAngle =
            TimeRange.#calculateTimeAngle(
                renderStart,
                ringOrigin
            );

        const endAngle =
            TimeRange.#calculateTimeAngle(
                renderEnd,
                ringOrigin
            );

        if (
            this.getAttribute("type") ===
                "elapsed"
        ) {
            const sweepEndAngle =
                duration > 0 &&
                endAngle <= startAngle
                    ? endAngle + 360
                    : endAngle;

            const sweepAngle =
                Math.max(
                    0,
                    sweepEndAngle - startAngle
                );

            const waveWidth =
                Math.max(
                    1.5,
                    Math.min(
                        38,
                        sweepAngle * 0.4
                    )
                );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-width",
                `${waveWidth}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-shoulder",
                `${Math.max(0.5, waveWidth * 0.35)}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-start-angle",
                `${startAngle - waveWidth - 180}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-end-angle",
                `${sweepEndAngle + waveWidth - 180}deg`
            );
        }

        const startPoint =
            this.#getEdgePoint(
                startAngle,
                width,
                height
            );

        const endPoint =
            this.#getEdgePoint(
                endAngle,
                width,
                height
            );

        const corners =
            this.#getCornersBetweenAngles(
                startAngle,
                endAngle,
                width,
                height
            );

        const startX =
            startPoint.x /
            width *
            100;

        const startY =
            startPoint.y /
            height *
            100;

        const endX =
            endPoint.x /
            width *
            100;

        const endY =
            endPoint.y /
            height *
            100;

        const polygonPoints = [
            "50% 50%",
            `${startX}% ${startY}%`,
            ...corners.map(
                corner =>
                    `${
                        corner.x /
                        width *
                        100
                    }% ${
                        corner.y /
                        height *
                        100
                    }%`
            ),
            `${endX}% ${endY}%`
        ];

        this.#styleElement.textContent = `
            :host {
                clip-path: polygon(
                    ${polygonPoints.join(",\n                    ")}
                );
            }
        `;
    }

    static #reorderParent(
        parent
    ) {
        if (
            !parent ||
            TimeRange.#reordering
        ) {
            return;
        }

        const ranges =
            Array.from(
                parent.children
            ).filter(
                child =>
                    child instanceof
                        TimeRange &&
                    !child.#pendingRemoval
            );

        if (
            ranges.length <= 1
        ) {
            return;
        }

        const ordered =
            [...ranges].sort(
                (a, b) => {
                    const aOverlapping =
                        a.hasAttribute(
                            "overlapping"
                        );

                    const bOverlapping =
                        b.hasAttribute(
                            "overlapping"
                        );

                    if (
                        aOverlapping !==
                            bOverlapping
                    ) {
                        return aOverlapping
                            ? 1
                            : -1;
                    }

                    const aStart =
                        a.#getStartTime();

                    const bStart =
                        b.#getStartTime();

                    if (
                        !(
                            aStart instanceof Date
                        ) ||
                        !(
                            bStart instanceof Date
                        )
                    ) {
                        return 0;
                    }

                    return (
                        aStart.getTime() -
                        bStart.getTime()
                    );
                }
            );

        const changed =
            ordered.some(
                (range, index) =>
                    range !==
                        ranges[index]
            );

        if (
            !changed
        ) {
            return;
        }

        TimeRange.#reordering =
            true;

        try {
            for (
                const range of
                    ordered
            ) {
                parent.appendChild(
                    range
                );
            }
        } finally {
            TimeRange.#reordering =
                false;
        }
    }

    #removeOverlaps() {
        if (
            this.hasAttribute(
                "overlapping"
            )
        ) {
            return;
        }

        const instances =
            TimeRange.#instances;

        const newStart =
            this.#getStartTime();

        const newEnd =
            this.#getEndTime();

        if (
            !(
                newStart instanceof Date
            ) ||
            !(
                newEnd instanceof Date
            )
        ) {
            return;
        }

        const addedStart =
            newStart.getTime();

        const addedEnd =
            newEnd.getTime();

        for (
            let i =
                instances.length - 1;
            i >= 0;
            i--
        ) {
            const existing =
                instances[i];

            if (
                existing === this ||
                existing.parentElement !==
                    this.parentElement ||
                existing.hasAttribute(
                    "overlapping"
                ) ||
                existing.#pendingRemoval
            ) {
                continue;
            }

            const existingStartTime =
                existing.#getStartTime();

            const existingEndTime =
                existing.#getEndTime();

            if (
                !(
                    existingStartTime instanceof Date
                ) ||
                !(
                    existingEndTime instanceof Date
                )
            ) {
                continue;
            }

            const existingStart =
                existingStartTime.getTime();

            const existingEnd =
                existingEndTime.getTime();

            if (
                addedStart <=
                    existingStart &&
                addedEnd >=
                    existingEnd
            ) {
                existing.removeAnimated({
                    targetStart:
                        this.#cloneDate(
                            newStart
                        ),
                    targetEnd:
                        this.#cloneDate(
                            newEnd
                        )
                });

                continue;
            }

            if (
                addedStart >
                    existingStart &&
                addedEnd <
                    existingEnd
            ) {
                const originalEnd =
                    new Date(
                        existingEnd
                    );

                existing.#setEndTime(
                    new Date(
                        addedStart
                    )
                );

                existing.#setRangeLength(
                    addedStart -
                    existingStart
                );

                const splitRange =
                    document.createElement(
                        "time-range"
                    );

                splitRange.setAttribute(
                    "start-time",
                    this.#formatDateTime(
                        new Date(
                            addedEnd
                        )
                    )
                );

                splitRange.setAttribute(
                    "end-time",
                    this.#formatDateTime(
                        originalEnd
                    )
                );

                existing.parentElement
                    ?.appendChild(
                        splitRange
                    );

                continue;
            }

            if (
                addedStart <=
                    existingStart &&
                addedEnd >
                    existingStart &&
                addedEnd <
                    existingEnd
            ) {
                existing.#setStartTime(
                    new Date(
                        addedEnd
                    )
                );

                existing.#setRangeLength(
                    existingEnd -
                    addedEnd
                );

                continue;
            }

            if (
                addedStart >
                    existingStart &&
                addedStart <
                    existingEnd &&
                addedEnd >=
                    existingEnd
            ) {
                existing.#setEndTime(
                    new Date(
                        addedStart
                    )
                );

                existing.#setRangeLength(
                    addedStart -
                    existingStart
                );
            }
        }
    }
}

customElements.define(
    "time-range",
    TimeRange
);
