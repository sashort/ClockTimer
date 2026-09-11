from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
start=s.index('        fromJSON(json) {')
end=s.index('        get status() {', start)
method=r'''        fromJSON(json) {
            if (this.status !== "ready") {
                return false;
            }

            try {
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
                        "prestart",
                        "elapsed"
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
                    terminal;

                this.#percentGoal =
                    this.#getPercentGoal();

                this.#ringAnchor =
                    creationMilliseconds;

                this.#startedAtEpoch =
                    creationDate.getTime();

                this.#started =
                    false;

                this.#starting =
                    true;

                try {
                    this.#buildPlannedRanges(
                        startTimeMilliseconds
                    );

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
                                this.#getRingIndex(cursor);

                            const segmentEnd =
                                Math.min(
                                    next.milliseconds,
                                    this.#getRingStart(ringIndex) +
                                        ClockTimer.#HOUR
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

                    this.#refreshRingLayout(
                        terminal,
                        {
                            refreshTickMarks: true
                        }
                    );

                    this.#snapTimerRangeAngles();
                }
                finally {
                    this.#starting =
                        false;
                }

                this.#originalStartArguments =
                    undefined;

                this.#startResetState =
                    undefined;

                this.#stopTickTimer();

                return true;
            }
            catch {
                return false;
            }
        }

'''
s=s[:start]+method+s[end:]
p.write_text(s)
