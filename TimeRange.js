class TimeRange extends HTMLElement {
    static #instances = [];
    static #percentGoal = 1;
    static #calculatedEndTime;
    static #reordering = false;

    #startTime;
    #endTime;
    #rangeLength;
    #shadowRoot;
    #styleElement;
    #syncing = 0;

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

        const bevelStyle =
            document.createElement(
                "style"
            );

        bevelStyle.textContent = `
            :host:not([overlapping]) {
                filter:
                    drop-shadow(
                        -0.75px -0.75px 0
                        rgba(255, 255, 255, 0.55)
                    )
                    drop-shadow(
                        0.75px 0.75px 0
                        rgba(0, 0, 0, 0.35)
                    );
            }

            :host([overlapping]) {
                filter: none;
            }
        `;

        this.#styleElement =
            document.createElement(
                "style"
            );

        this.#shadowRoot.append(
            bevelStyle,
            this.#styleElement
        );
    }

    connectedCallback() {
        if (
            TimeRange.#reordering
        ) {
            return;
        }

        this.#initializeFromAttributes();

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

        TimeRange.#updateParentClipPaths(
            this.parentElement
        );
        TimeRange.#reorderParent(
            this.parentElement
        );
    }

    disconnectedCallback() {
        if (
            TimeRange.#reordering
        ) {
            return;
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
            TimeRange.#updateParentClipPaths(
                this.parentElement
            );
        }
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
            TimeRange.#updateParentClipPaths(
                this.parentElement
            );
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
            TimeRange.#updateParentClipPaths(
                this.parentElement
            );
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

    #getRingOriginTime() {
        const parent =
            this.parentElement;

        if (
            !parent ||
            parent.localName !==
                "ring-container" ||
            !parent.hasAttribute(
                "data-clock-timer-ring"
            )
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

        return earliest;
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

    #updateClipPath() {
        const parent =
            this.parentElement;

        if (
            !parent
        ) {
            return;
        }

        const width =
            parent.clientWidth;

        const height =
            parent.clientHeight;

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

        const duration =
            this.#endTime.getTime() -
            this.#startTime.getTime();

        if (
            duration >=
                60 * 60 * 1000
        ) {
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
                this.#startTime,
                ringOrigin
            );

        const endAngle =
            TimeRange.#calculateTimeAngle(
                this.#endTime,
                ringOrigin
            );

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
                        TimeRange
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
                )
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
                existing.remove();

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
