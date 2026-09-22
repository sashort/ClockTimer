class TimeRange extends HTMLElement {
    static #instances = [];
    static #percentGoal = 1;
    static #reordering = false;
    static #activeTransaction;

    #startTime;
    #endTime;
    #rangeLength;
    #syncing = 0;
    #pendingRemoval = false;

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
            if (typeof value === "string") {
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
        }
        catch {
            value = 1;
        }

        if (value <= 0) {
            value = 1;
        }
        else if (
            value > 1.5 &&
            !preventConvert
        ) {
            value /= 100;
        }

        TimeRange.#percentGoal =
            value;
    }

    #assertClockTimerMutationAllowed(
        name = undefined
    ) {
        if (
            this.clockTimerInternalMutation ===
                true
        ) {
            return;
        }

        if (
            this.clockTimerDerivedReadOnly ===
                true
        ) {
            throw new Error(
                "Derived discrepancy ranges cannot be modified."
            );
        }

        const normalized =
            name === undefined
                ? undefined
                : String(name)
                    .toLowerCase();

        if (
            this.clockTimerApprovalReadOnly ===
                true &&
            (
                normalized ===
                    "approved" ||
                normalized ===
                    "unapproved"
            )
        ) {
            throw new Error(
                "Interval approval attributes must be changed through ClockTimer."
            );
        }
    }

    setAttribute(
        name,
        value
    ) {
        this.#assertClockTimerMutationAllowed(
            name
        );

        return super.setAttribute(
            name,
            value
        );
    }

    removeAttribute(
        name
    ) {
        this.#assertClockTimerMutationAllowed(
            name
        );

        return super.removeAttribute(
            name
        );
    }

    toggleAttribute(
        name,
        force
    ) {
        this.#assertClockTimerMutationAllowed(
            name
        );

        return super.toggleAttribute(
            name,
            force
        );
    }

    remove() {
        this.#assertClockTimerMutationAllowed();

        return super.remove();
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
        }
        finally {
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

        const inherited =
            TimeRange.#activeTransaction;

        const transaction =
            inherited ??
            this.#createTransaction(
                "connected",
                "created"
            );

        const ownsTransaction =
            inherited === undefined;

        TimeRange.#recordCreated(
            transaction,
            this
        );

        if (ownsTransaction) {
            TimeRange.#activeTransaction =
                transaction;
        }

        try {
            if (
                TimeRange.#instances.length >
                    1
            ) {
                this.#removeOverlaps(
                    transaction
                );
            }

            TimeRange.#reorderParent(
                this.parentElement,
                this
            );
        }
        finally {
            if (ownsTransaction) {
                TimeRange.#activeTransaction =
                    undefined;
            }
        }

        if (ownsTransaction) {
            this.#dispatchTransaction(
                transaction
            );
        }
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

        if (index !== -1) {
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
                this.parentElement,
                this
            );

            return;
        }

        if (newValue === null) {
            return;
        }

        const inherited =
            TimeRange.#activeTransaction;

        const transaction =
            inherited ??
            this.#createTransaction(
                "attribute-change",
                "changed"
            );

        const ownsTransaction =
            inherited === undefined;

        TimeRange.#recordBefore(
            transaction,
            this
        );

        if (ownsTransaction) {
            TimeRange.#activeTransaction =
                transaction;
        }

        try {
            switch (name) {
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

            this.#removeOverlaps(
                transaction
            );

            TimeRange.#reorderParent(
                this.parentElement,
                this
            );
        }
        finally {
            if (ownsTransaction) {
                TimeRange.#activeTransaction =
                    undefined;
            }
        }

        if (ownsTransaction) {
            this.#dispatchTransaction(
                transaction
            );
        }
    }

    get startTime() {
        return this.#cloneDate(
            this.#startTime
        );
    }

    get endTime() {
        return this.#cloneDate(
            this.#endTime
        );
    }

    get rangeLength() {
        return this.#rangeLength;
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
        }
        finally {
            this.#syncing--;
        }

        if (
            start instanceof Date &&
            Number.isInteger(
                range
            ) &&
            range >= 0
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
            range >= 0
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

        if (start instanceof Date) {
            this.#setStartTime(
                start
            );

            return;
        }

        if (end instanceof Date) {
            this.#setEndTime(
                end
            );

            return;
        }

        if (
            Number.isInteger(
                range
            ) &&
            range >= 0
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
            !(value instanceof Date)
        ) {
            return false;
        }

        this.#startTime =
            value;

        if (this.#syncing !== 0) {
            return true;
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
                this.#rangeLength >= 0
            ) {
                this.#endTime =
                    new Date(
                        this.#startTime.getTime() +
                        this.#rangeLength
                    );

                this.#writeEndTimeAttribute();
            }
            else if (
                hasEnd &&
                this.#endTime instanceof Date
            ) {
                this.#rangeLength =
                    this.#endTime.getTime() -
                    this.#startTime.getTime();

                this.#writeRangeLengthAttribute();
            }

            this.#writeStartTimeAttribute();
        }
        finally {
            this.#syncing--;
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
            !(value instanceof Date)
        ) {
            return false;
        }

        this.#endTime =
            value;

        if (this.#syncing !== 0) {
            return true;
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
                this.#rangeLength >= 0
            ) {
                this.#startTime =
                    new Date(
                        this.#endTime.getTime() -
                        this.#rangeLength
                    );

                this.#writeStartTimeAttribute();
            }
            else if (
                hasStart &&
                this.#startTime instanceof Date
            ) {
                this.#rangeLength =
                    this.#endTime.getTime() -
                    this.#startTime.getTime();

                this.#writeRangeLengthAttribute();
            }

            this.#writeEndTimeAttribute();
        }
        finally {
            this.#syncing--;
        }

        return true;
    }

    #setRangeLength(
        value
    ) {
        if (
            !Number.isInteger(
                value
            ) ||
            value < 0
        ) {
            return false;
        }

        this.#rangeLength =
            value;

        if (this.#syncing !== 0) {
            return true;
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
            }
            else if (
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
        }
        finally {
            this.#syncing--;
        }

        return true;
    }

    split(
        timeValue,
        insert = false
    ) {
        if (
            typeof insert !==
                "boolean" ||
            !(this.#startTime instanceof Date) ||
            !(this.#endTime instanceof Date)
        ) {
            return;
        }

        const splitTime =
            this.#uniformDate(
                timeValue,
                false
            );

        if (!(splitTime instanceof Date)) {
            return;
        }

        const startMilliseconds =
            this.#startTime.getTime();

        const endMilliseconds =
            this.#endTime.getTime();

        const splitMilliseconds =
            splitTime.getTime();

        if (
            splitMilliseconds <=
                startMilliseconds ||
            splitMilliseconds >
                endMilliseconds ||
            (
                splitMilliseconds ===
                    endMilliseconds &&
                !insert
            )
        ) {
            return;
        }

        const parent =
            this.parentElement;

        if (
            insert &&
            !parent
        ) {
            return;
        }

        const inherited =
            TimeRange.#activeTransaction;

        const transaction =
            inherited ??
            this.#createTransaction(
                "split",
                "split"
            );

        const ownsTransaction =
            inherited === undefined;

        TimeRange.#recordBefore(
            transaction,
            this
        );

        if (ownsTransaction) {
            TimeRange.#activeTransaction =
                transaction;
        }

        let right;

        try {
            right =
                this.#cloneRangeForSplit(
                    splitTime,
                    new Date(
                        endMilliseconds
                    )
                );

            this.#syncing++;

            try {
                this.#endTime =
                    splitTime;

                this.#rangeLength =
                    splitMilliseconds -
                    startMilliseconds;

                this.#writeEndTimeAttribute();
                this.#writeRangeLengthAttribute();
            }
            finally {
                this.#syncing--;
            }

            TimeRange.#setAction(
                transaction,
                this,
                "trimmed-end"
            );

            TimeRange.#recordCreated(
                transaction,
                right
            );

            if (insert) {
                parent.insertBefore(
                    right,
                    this.nextSibling
                );
            }

            TimeRange.#reorderParent(
                parent,
                this
            );
        }
        finally {
            if (ownsTransaction) {
                TimeRange.#activeTransaction =
                    undefined;
            }
        }

        if (ownsTransaction) {
            this.#dispatchTransaction(
                transaction
            );
        }

        return [
            this,
            right
        ];
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
            end.getTime() <
                start.getTime()
        ) {
            return false;
        }

        const inherited =
            TimeRange.#activeTransaction;

        const transaction =
            inherited ??
            this.#createTransaction(
                "programmatic-change",
                "changed"
            );

        const ownsTransaction =
            inherited === undefined;

        TimeRange.#recordBefore(
            transaction,
            this
        );

        if (ownsTransaction) {
            TimeRange.#activeTransaction =
                transaction;
        }

        try {
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
            }
            finally {
                this.#syncing--;
            }

            this.#removeOverlaps(
                transaction
            );

            TimeRange.#reorderParent(
                this.parentElement,
                this
            );
        }
        finally {
            if (ownsTransaction) {
                TimeRange.#activeTransaction =
                    undefined;
            }
        }

        if (ownsTransaction) {
            this.#dispatchTransaction(
                transaction
            );
        }

        return true;
    }

    #writeStartTimeAttribute() {
        if (
            !this.hasAttribute(
                "start-time"
            ) ||
            !(this.#startTime instanceof Date)
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
            !(this.#endTime instanceof Date)
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
            this.#rangeLength < 0
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

        const now =
            new Date();

        const parsed =
            TemporalFormat.parseDateTime(
                timeValue,
                now
            );

        if (parsed) {
            if (
                lookForward &&
                typeof timeValue === "string" &&
                !/^[-+]?\d+$/.test(
                    timeValue.trim()
                ) &&
                !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(
                    timeValue.trim()
                ) &&
                parsed.getTime() <
                    now.getTime()
            ) {
                parsed.setDate(
                    parsed.getDate() + 1
                );
            }

            return parsed;
        }

        if (typeof timeValue !== "string") {
            return undefined;
        }

        const value =
            timeValue.trim();

        const hourOnly =
            value.match(
                /^(\d{1,2})\s*(AM|PM)$/i
            );

        if (hourOnly) {
            let hour = Number(hourOnly[1]);
            const meridiem = hourOnly[2].toUpperCase();

            if (hour < 1 || hour > 12) {
                return undefined;
            }

            if (meridiem === "AM") {
                if (hour === 12) hour = 0;
            }
            else if (hour !== 12) {
                hour += 12;
            }

            const date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hour,
                0,
                0,
                0
            );

            if (
                lookForward &&
                date.getTime() < now.getTime()
            ) {
                date.setDate(date.getDate() + 1);
            }

            return date;
        }

        if (
            /^\d{4}-\d{2}-\d{2}[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:\s*(?:AM|PM))?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(
                value
            )
        ) {
            const date = new Date(value);
            return Number.isNaN(date.getTime())
                ? undefined
                : date;
        }

        return undefined;
    }

    #formatDateTime(
        date
    ) {
        return TemporalFormat.formatDateTime(
            date
        );
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
            value >= 0
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

        const temporalDuration =
            TemporalFormat.parseDuration(
                normalized
            );

        if (
            temporalDuration !== undefined &&
            temporalDuration >= 0 &&
            normalized.includes(
                ":"
            )
        ) {
            return temporalDuration;
        }

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
            milliseconds < 0
        ) {
            return undefined;
        }

        return milliseconds;
    }

    #formatRangeLength(
        milliseconds
    ) {
        if (
            Number.isInteger(milliseconds) &&
            milliseconds >= 60000
        ) {
            return TemporalFormat.formatDuration(
                milliseconds
            );
        }
        if (
            !Number.isInteger(
                milliseconds
            ) ||
            milliseconds < 0
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

    #cloneDate(
        value
    ) {
        return value instanceof Date
            ? new Date(
                value.getTime()
            )
            : undefined;
    }

    #cloneRangeForSplit(
        start,
        end
    ) {
        const clone =
            this.cloneNode(
                false
            );

        clone.removeAttribute(
            "start-time"
        );

        clone.removeAttribute(
            "end-time"
        );

        clone.removeAttribute(
            "range-length"
        );

        clone.removeAttribute(
            "ignore-overlaps"
        );

        clone.setAttribute(
            "start-time",
            this.#formatDateTime(
                start
            )
        );

        clone.setAttribute(
            "end-time",
            this.#formatDateTime(
                end
            )
        );

        if (
            this.hasAttribute(
                "range-length"
            )
        ) {
            clone.setAttribute(
                "range-length",
                this.#formatRangeLength(
                    end.getTime() -
                    start.getTime()
                )
            );
        }

        clone.setAttribute(
            "ignore-overlaps",
            ""
        );

        clone.timeRangeFullEntry =
            true;

        for (
            const key of
                Object.keys(
                    this
                )
        ) {
            if (
                (
                    key.startsWith(
                        "clockTimer"
                    ) ||
                    key.startsWith(
                        "timeRange"
                    )
                ) &&
                key !==
                    "timeRangeExiting"
            ) {
                clone[key] =
                    this[key];
            }
        }

        return clone;
    }

    static #snapshot(
        range
    ) {
        if (
            !(range instanceof TimeRange)
        ) {
            return null;
        }

        return {
            startTime:
                range.#cloneDate(
                    range.#startTime
                ),

            endTime:
                range.#cloneDate(
                    range.#endTime
                ),

            rangeLength:
                Number.isInteger(
                    range.#rangeLength
                )
                    ? range.#rangeLength
                    : undefined
        };
    }

    #createTransaction(
        reason,
        action
    ) {
        return {
            source:
                this,

            reason,

            action,

            before:
                new Map(),

            actions:
                new Map(),

            ranges:
                new Set(),

            removals:
                new Set()
        };
    }

    static #recordBefore(
        transaction,
        range
    ) {
        if (
            !transaction ||
            !(range instanceof TimeRange)
        ) {
            return;
        }

        transaction.ranges.add(
            range
        );

        if (
            !transaction.before.has(
                range
            )
        ) {
            transaction.before.set(
                range,
                TimeRange.#snapshot(
                    range
                )
            );
        }
    }

    static #recordCreated(
        transaction,
        range
    ) {
        if (
            !transaction ||
            !(range instanceof TimeRange)
        ) {
            return;
        }

        transaction.ranges.add(
            range
        );

        if (
            !transaction.before.has(
                range
            )
        ) {
            transaction.before.set(
                range,
                null
            );
        }

        if (
            !transaction.actions.has(
                range
            )
        ) {
            transaction.actions.set(
                range,
                "created"
            );
        }
    }

    static #setAction(
        transaction,
        range,
        action
    ) {
        if (
            !transaction ||
            !(range instanceof TimeRange)
        ) {
            return;
        }

        transaction.ranges.add(
            range
        );

        transaction.actions.set(
            range,
            action
        );
    }

    static #markCollision(
        transaction
    ) {
        if (!transaction) {
            return;
        }

        transaction.reason =
            "collision";

        transaction.action =
            "collision-resolved";
    }

    static #sameSnapshot(
        left,
        right
    ) {
        if (left === right) {
            return true;
        }

        if (!left || !right) {
            return false;
        }

        const milliseconds =
            value =>
                value instanceof Date
                    ? value.getTime()
                    : undefined;

        return (
            milliseconds(
                left.startTime
            ) ===
                milliseconds(
                    right.startTime
                ) &&
            milliseconds(
                left.endTime
            ) ===
                milliseconds(
                    right.endTime
                ) &&
            left.rangeLength ===
                right.rangeLength
        );
    }

    #dispatchTransaction(
        transaction
    ) {
        if (!transaction) {
            return;
        }

        const changes = [];

        for (
            const range of
                transaction.ranges
        ) {
            const before =
                transaction.before.has(
                    range
                )
                    ? transaction.before.get(
                        range
                    )
                    : TimeRange.#snapshot(
                        range
                    );

            const after =
                transaction.removals.has(
                    range
                )
                    ? null
                    : TimeRange.#snapshot(
                        range
                    );

            if (
                before !== null &&
                after !== null &&
                TimeRange.#sameSnapshot(
                    before,
                    after
                )
            ) {
                continue;
            }

            const action =
                transaction.actions.get(
                    range
                ) ??
                (
                    before === null
                        ? "created"
                        : after === null
                            ? "removed"
                            : "changed"
                );

            changes.push({
                range,
                action,
                before,
                after
            });
        }

        if (
            changes.length ===
                0
        ) {
            return;
        }

        const ranges =
            changes.map(
                change =>
                    change.range
            );

        this.dispatchEvent(
            new CustomEvent(
                "time-ranges-changed",
                {
                    bubbles: true,
                    composed: true,
                    cancelable: false,

                    detail: {
                        source:
                            transaction.source,

                        reason:
                            transaction.reason,

                        action:
                            transaction.action,

                        ranges,

                        changes
                    }
                }
            )
        );

        for (
            const range of
                transaction.removals
        ) {
            const parent =
                range.parentElement;

            if (
                parent?.localName ===
                    "ring-container" &&
                typeof parent
                    .removeRangeAnimated ===
                    "function"
            ) {
                continue;
            }

            if (range.parentElement) {
                range.parentElement
                    .removeChild(
                        range
                    );
            }
        }
    }

    #markForRemoval(
        transaction,
        range
    ) {
        TimeRange.#recordBefore(
            transaction,
            range
        );

        range.#pendingRemoval =
            true;

        range.timeRangeExiting =
            true;

        const index =
            TimeRange.#instances.indexOf(
                range
            );

        if (index !== -1) {
            TimeRange.#instances.splice(
                index,
                1
            );
        }

        transaction.removals.add(
            range
        );

        TimeRange.#setAction(
            transaction,
            range,
            "removed"
        );
    }

    static #reorderParent(
        parent,
        source
    ) {
        if (
            !parent ||
            TimeRange.#reordering
        ) {
            return;
        }

        const ranges =
            parent.localName ===
                "ring-container" &&
            typeof parent
                .getLayerRanges ===
                "function"
                ? parent.getLayerRanges(
                    source
                )
                : Array.from(
                    parent.children
                ).filter(
                    child =>
                        child instanceof
                            TimeRange
                );

        const activeRanges =
            ranges.filter(
                child =>
                    child instanceof
                        TimeRange &&
                    !child.#pendingRemoval
            );

        if (
            activeRanges.length <=
                1
        ) {
            return;
        }

        const ordered =
            [...activeRanges]
                .sort(
                    (
                        a,
                        b
                    ) => {
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
                            !(aStart instanceof Date) ||
                            !(bStart instanceof Date)
                        ) {
                            return 0;
                        }

                        return (
                            aStart.getTime() -
                            bStart.getTime()
                        );
                    }
                );

        if (
            ordered.every(
                (
                    range,
                    index
                ) =>
                    range ===
                        activeRanges[
                            index
                        ]
            )
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
        }
        finally {
            TimeRange.#reordering =
                false;
        }
    }

    #getCollisionRanges() {
        const parent =
            this.parentElement;

        if (
            parent?.localName ===
                "ring-container" &&
            typeof parent
                .getCollisionRanges ===
                "function"
        ) {
            return parent
                .getCollisionRanges(
                    this
                );
        }

        return TimeRange.#instances
            .filter(
                range =>
                    range instanceof
                        TimeRange &&
                    range !== this &&
                    range.parentElement ===
                        parent
            );
    }

    #removeOverlaps(
        transaction
    ) {
        if (
            this.hasAttribute(
                "ignore-overlaps"
            )
        ) {
            this.#syncing++;

            try {
                this.removeAttribute(
                    "ignore-overlaps"
                );
            }
            finally {
                this.#syncing--;
            }

            return;
        }

        if (
            this.hasAttribute(
                "overlapping"
            )
        ) {
            return;
        }

        const newStart =
            this.#getStartTime();

        const newEnd =
            this.#getEndTime();

        if (
            !(newStart instanceof Date) ||
            !(newEnd instanceof Date)
        ) {
            return;
        }

        const addedStart =
            newStart.getTime();

        const addedEnd =
            newEnd.getTime();

        if (
            addedEnd <=
                addedStart
        ) {
            return;
        }

        for (
            const existing of
                this.#getCollisionRanges()
        ) {
            if (
                !(existing instanceof TimeRange) ||
                existing === this ||
                !existing.isConnected ||
                existing.hasAttribute(
                    "overlapping"
                ) ||
                existing.#pendingRemoval ||
                existing.timeRangeExiting ===
                    true
            ) {
                continue;
            }

            const existingStartTime =
                existing.#getStartTime();

            const existingEndTime =
                existing.#getEndTime();

            if (
                !(existingStartTime instanceof Date) ||
                !(existingEndTime instanceof Date)
            ) {
                continue;
            }

            const existingStart =
                existingStartTime.getTime();

            const existingEnd =
                existingEndTime.getTime();

            if (
                existingEnd <=
                    existingStart
            ) {
                continue;
            }

            if (
                addedStart <=
                    existingStart &&
                addedEnd >=
                    existingEnd
            ) {
                TimeRange.#markCollision(
                    transaction
                );

                this.#markForRemoval(
                    transaction,
                    existing
                );

                continue;
            }

            if (
                addedStart >
                    existingStart &&
                addedEnd <
                    existingEnd
            ) {
                TimeRange.#markCollision(
                    transaction
                );

                TimeRange.#recordBefore(
                    transaction,
                    existing
                );

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

                TimeRange.#setAction(
                    transaction,
                    existing,
                    "trimmed-end"
                );

                const splitRange =
                    existing
                        .#cloneRangeForSplit(
                            new Date(
                                addedEnd
                            ),
                            originalEnd
                        );

                existing.parentElement
                    ?.appendChild(
                        splitRange
                    );

                TimeRange.#recordCreated(
                    transaction,
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
                TimeRange.#markCollision(
                    transaction
                );

                TimeRange.#recordBefore(
                    transaction,
                    existing
                );

                existing.#setStartTime(
                    new Date(
                        addedEnd
                    )
                );

                existing.#setRangeLength(
                    existingEnd -
                    addedEnd
                );

                TimeRange.#setAction(
                    transaction,
                    existing,
                    "trimmed-start"
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
                TimeRange.#markCollision(
                    transaction
                );

                TimeRange.#recordBefore(
                    transaction,
                    existing
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

                TimeRange.#setAction(
                    transaction,
                    existing,
                    "trimmed-end"
                );
            }
        }
    }

    get isExiting() {
        return (
            this.#pendingRemoval ||
            this.timeRangeExiting ===
                true
        );
    }
}

customElements.define(
    "time-range",
    TimeRange
);
