from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

if '        toJSON() {' in text:
    raise SystemExit('toJSON already exists')

anchor = '''        get status() {
'''
if anchor not in text:
    raise SystemExit('status getter anchor not found')

block = r'''        #getJSONCreationDate() {
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
                    "prestart",
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
                creationDate:
                    this.#formatJSONDate(
                        creationDate
                    ),
                standardTime:
                    this.#standardTime,
                scheduledStart:
                    this.#scheduledStart,
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

'''

text = text.replace(anchor, block + anchor, 1)
path.write_text(text)
