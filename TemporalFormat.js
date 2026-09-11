class TemporalFormat {
    static #TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?$/i;

    static #DATE_TIME_PATTERN = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?$/i;

    static #DURATION_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/;

    static #CSS_TIME_PATTERN = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/i;

    static #DATE_TOKENS = [
        "yyyy",
        "MMMM",
        "MMM",
        "MM",
        "dd",
        "yy",
        "M",
        "d"
    ];

    static #TIME_TOKENS = [
        "hh",
        "mm",
        "ss",
        "h"
    ];

    static #MONTHS_SHORT = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];

    static #MONTHS_LONG = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];

    static parseDateTime(
        value,
        referenceDate = new Date()
    ) {
        if (value instanceof Date) {
            return Number.isFinite(value.getTime())
                ? new Date(value.getTime())
                : undefined;
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value) &&
            Number.isInteger(value)
        ) {
            const date = new Date(value);

            return Number.isFinite(date.getTime())
                ? date
                : undefined;
        }

        if (typeof value !== "string") {
            return undefined;
        }

        const text = value.trim();

        if (!text) {
            return undefined;
        }

        if (/^[+-]?\d+$/.test(text)) {
            const epoch = Number(text);

            if (
                Number.isSafeInteger(epoch)
            ) {
                const date = new Date(epoch);

                if (
                    Number.isFinite(
                        date.getTime()
                    )
                ) {
                    return date;
                }
            }
        }

        const dateTimeMatch =
            text.match(
                TemporalFormat.#DATE_TIME_PATTERN
            );

        if (dateTimeMatch) {
            return TemporalFormat.#buildDate(
                Number(dateTimeMatch[1]),
                Number(dateTimeMatch[2]),
                Number(dateTimeMatch[3]),
                dateTimeMatch[4],
                dateTimeMatch[5],
                dateTimeMatch[6],
                dateTimeMatch[7],
                dateTimeMatch[8]
            );
        }

        return TemporalFormat.parseTime(
            text,
            referenceDate
        );
    }

    static parseTime(
        value,
        referenceDate = new Date()
    ) {
        if (typeof value !== "string") {
            return undefined;
        }

        const match =
            value.trim().match(
                TemporalFormat.#TIME_PATTERN
            );

        if (!match) {
            return undefined;
        }

        const reference =
            referenceDate instanceof Date &&
            Number.isFinite(
                referenceDate.getTime()
            )
                ? referenceDate
                : new Date();

        return TemporalFormat.#buildDate(
            reference.getFullYear(),
            reference.getMonth() + 1,
            reference.getDate(),
            match[1],
            match[2],
            match[3],
            match[4],
            match[5]
        );
    }

    static normalizeDateTime(
        value,
        referenceDate = new Date()
    ) {
        const date =
            TemporalFormat.parseDateTime(
                value,
                referenceDate
            );

        if (!date) {
            return undefined;
        }

        return TemporalFormat.formatDateTime(
            date
        );
    }

    static formatDateTime(value) {
        const date =
            TemporalFormat.#coerceDate(
                value
            );

        if (!date) {
            return undefined;
        }

        const dateText = [
            date.getFullYear(),
            TemporalFormat.#pad(
                date.getMonth() + 1,
                2
            ),
            TemporalFormat.#pad(
                date.getDate(),
                2
            )
        ].join("-");

        const timeText = [
            TemporalFormat.#pad(
                date.getHours(),
                2
            ),
            TemporalFormat.#pad(
                date.getMinutes(),
                2
            )
        ].join(":");

        const seconds =
            date.getSeconds();

        const milliseconds =
            date.getMilliseconds();

        if (
            seconds === 0 &&
            milliseconds === 0
        ) {
            return `${dateText} ${timeText}`;
        }

        const secondText =
            TemporalFormat.#pad(
                seconds,
                2
            );

        if (milliseconds === 0) {
            return `${dateText} ${timeText}:${secondText}`;
        }

        return `${dateText} ${timeText}:${secondText}.${TemporalFormat.#pad(milliseconds, 3)}`;
    }

    static formatDate(
        value,
        format
    ) {
        const date =
            TemporalFormat.#coerceDate(
                value
            );

        if (
            !date ||
            !TemporalFormat.isDateFormat(
                format
            )
        ) {
            return undefined;
        }

        const values = {
            yyyy: String(
                date.getFullYear()
            ),
            yy: TemporalFormat.#pad(
                date.getFullYear() % 100,
                2
            ),
            MMMM: TemporalFormat.#MONTHS_LONG[
                date.getMonth()
            ],
            MMM: TemporalFormat.#MONTHS_SHORT[
                date.getMonth()
            ],
            MM: TemporalFormat.#pad(
                date.getMonth() + 1,
                2
            ),
            M: String(
                date.getMonth() + 1
            ),
            dd: TemporalFormat.#pad(
                date.getDate(),
                2
            ),
            d: String(
                date.getDate()
            )
        };

        return TemporalFormat.#replaceTokens(
            format,
            TemporalFormat.#DATE_TOKENS,
            values
        );
    }

    static formatTime(
        value,
        format,
        militaryTime = true
    ) {
        const date =
            TemporalFormat.#coerceDate(
                value
            );

        const normalizedFormat =
            TemporalFormat.normalizeTimeFormat(
                format,
                militaryTime
            );

        if (
            !date ||
            normalizedFormat === undefined
        ) {
            return undefined;
        }

        let hour =
            date.getHours();

        if (!militaryTime) {
            hour %= 12;

            if (hour === 0) {
                hour = 12;
            }
        }

        const values = {
            hh: TemporalFormat.#pad(
                hour,
                2
            ),
            h: String(hour),
            mm: TemporalFormat.#pad(
                date.getMinutes(),
                2
            ),
            ss: TemporalFormat.#pad(
                date.getSeconds(),
                2
            )
        };

        return TemporalFormat.#replaceTokens(
            normalizedFormat,
            TemporalFormat.#TIME_TOKENS,
            values
        );
    }

    static isDateTime(value) {
        return (
            TemporalFormat.parseDateTime(
                value
            ) !== undefined
        );
    }

    static isTime(value) {
        return (
            TemporalFormat.parseTime(
                value
            ) !== undefined
        );
    }

    static parseDuration(value) {
        if (
            typeof value === "number"
        ) {
            return (
                Number.isSafeInteger(value) &&
                value >= 0
            )
                ? value
                : undefined;
        }

        if (typeof value !== "string") {
            return undefined;
        }

        const text = value.trim();

        if (/^\d+$/.test(text)) {
            const milliseconds =
                Number(text);

            return (
                Number.isSafeInteger(
                    milliseconds
                )
            )
                ? milliseconds
                : undefined;
        }

        const match =
            text.match(
                TemporalFormat.#DURATION_PATTERN
            );

        if (!match) {
            return undefined;
        }

        const hasHours =
            match[1] !== undefined;

        const hours =
            hasHours
                ? Number(match[1])
                : 0;

        const minutes =
            Number(match[2]);

        const seconds =
            Number(match[3]);

        if (
            minutes > 59 ||
            seconds > 59
        ) {
            return undefined;
        }

        const milliseconds =
            match[4] === undefined
                ? 0
                : Number(
                    match[4].padEnd(
                        3,
                        "0"
                    )
                );

        const result =
            hours * 3600000 +
            minutes * 60000 +
            seconds * 1000 +
            milliseconds;

        return Number.isSafeInteger(result)
            ? result
            : undefined;
    }

    static normalizeDuration(value) {
        const milliseconds =
            TemporalFormat.parseDuration(
                value
            );

        if (milliseconds === undefined) {
            return undefined;
        }

        return TemporalFormat.formatDuration(
            milliseconds
        );
    }

    static formatDuration(milliseconds) {
        if (
            !Number.isSafeInteger(
                milliseconds
            ) ||
            milliseconds < 0
        ) {
            return undefined;
        }

        const hours =
            Math.floor(
                milliseconds /
                    3600000
            );

        let remainder =
            milliseconds %
            3600000;

        const minutes =
            Math.floor(
                remainder /
                    60000
            );

        remainder %=
            60000;

        const seconds =
            Math.floor(
                remainder /
                    1000
            );

        const ms =
            remainder % 1000;

        let result =
            hours > 0
                ? `${hours}:${TemporalFormat.#pad(minutes, 2)}:${TemporalFormat.#pad(seconds, 2)}`
                : `${minutes}:${TemporalFormat.#pad(seconds, 2)}`;

        if (ms > 0) {
            result +=
                `.${TemporalFormat.#pad(ms, 3)}`;
        }

        return result;
    }

    static durationToMilliseconds(value) {
        return TemporalFormat.parseDuration(
            value
        );
    }

    static millisecondsToDuration(
        milliseconds
    ) {
        return TemporalFormat.formatDuration(
            milliseconds
        );
    }

    static isDuration(value) {
        return (
            TemporalFormat.parseDuration(
                value
            ) !== undefined
        );
    }

    static parseCSSTime(value) {
        if (typeof value !== "string") {
            return undefined;
        }

        const match =
            value.trim().match(
                TemporalFormat.#CSS_TIME_PATTERN
            );

        if (!match) {
            return undefined;
        }

        const number =
            Number(match[1]);

        if (
            !Number.isFinite(number) ||
            number < 0
        ) {
            return undefined;
        }

        const milliseconds =
            match[2].toLowerCase() === "s"
                ? number * 1000
                : number;

        return Number.isFinite(milliseconds)
            ? milliseconds
            : undefined;
    }

    static normalizeCSSTime(value) {
        const milliseconds =
            TemporalFormat.parseCSSTime(
                value
            );

        if (milliseconds === undefined) {
            return undefined;
        }

        return TemporalFormat.millisecondsToCSSTime(
            milliseconds,
            "ms"
        );
    }

    static cssTimeToMilliseconds(value) {
        return TemporalFormat.parseCSSTime(
            value
        );
    }

    static millisecondsToCSSTime(
        milliseconds,
        unit = "ms"
    ) {
        if (
            typeof milliseconds !== "number" ||
            !Number.isFinite(milliseconds) ||
            milliseconds < 0
        ) {
            return undefined;
        }

        const normalizedUnit =
            String(unit).toLowerCase();

        if (
            normalizedUnit !== "ms" &&
            normalizedUnit !== "s"
        ) {
            return undefined;
        }

        const value =
            normalizedUnit === "s"
                ? milliseconds / 1000
                : milliseconds;

        return `${TemporalFormat.#trimNumber(value)}${normalizedUnit}`;
    }

    static isCSSTime(value) {
        return (
            TemporalFormat.parseCSSTime(
                value
            ) !== undefined
        );
    }

    static normalizeTimeFormat(
        format,
        militaryTime = true
    ) {
        if (typeof format !== "string") {
            return undefined;
        }

        const text = format.trim();

        if (!text) {
            return undefined;
        }

        const tokens =
            TemporalFormat.#collectTokens(
                text,
                TemporalFormat.#TIME_TOKENS
            );

        const hasHour =
            tokens.includes("h") ||
            tokens.includes("hh");

        if (
            !hasHour ||
            !tokens.includes("mm")
        ) {
            return undefined;
        }

        void militaryTime;

        return text;
    }

    static normalizeDateFormat(format) {
        if (typeof format !== "string") {
            return undefined;
        }

        const text = format.trim();

        if (!text) {
            return undefined;
        }

        const tokens =
            TemporalFormat.#collectTokens(
                text,
                TemporalFormat.#DATE_TOKENS
            );

        const hasYear =
            tokens.includes("yy") ||
            tokens.includes("yyyy");

        const hasMonth =
            tokens.includes("M") ||
            tokens.includes("MM") ||
            tokens.includes("MMM") ||
            tokens.includes("MMMM");

        const hasDay =
            tokens.includes("d") ||
            tokens.includes("dd");

        return (
            hasYear &&
            hasMonth &&
            hasDay
        )
            ? text
            : undefined;
    }

    static isTimeFormat(format) {
        return (
            TemporalFormat.normalizeTimeFormat(
                format
            ) !== undefined
        );
    }

    static isDateFormat(format) {
        return (
            TemporalFormat.normalizeDateFormat(
                format
            ) !== undefined
        );
    }

    static #buildDate(
        year,
        month,
        day,
        hourValue,
        minuteValue,
        secondValue,
        millisecondValue,
        meridiemValue
    ) {
        let hour =
            Number(hourValue);

        const minute =
            Number(minuteValue);

        const second =
            secondValue === undefined
                ? 0
                : Number(secondValue);

        const millisecond =
            millisecondValue === undefined
                ? 0
                : Number(
                    String(
                        millisecondValue
                    ).padEnd(
                        3,
                        "0"
                    )
                );

        const meridiem =
            meridiemValue?.toUpperCase();

        if (
            !Number.isInteger(year) ||
            !Number.isInteger(month) ||
            !Number.isInteger(day) ||
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            !Number.isInteger(second) ||
            !Number.isInteger(millisecond) ||
            minute < 0 ||
            minute > 59 ||
            second < 0 ||
            second > 59 ||
            millisecond < 0 ||
            millisecond > 999
        ) {
            return undefined;
        }

        if (meridiem) {
            if (
                hour < 1 ||
                hour > 12
            ) {
                return undefined;
            }

            if (meridiem === "AM") {
                if (hour === 12) {
                    hour = 0;
                }
            }
            else if (
                meridiem === "PM"
            ) {
                if (hour !== 12) {
                    hour += 12;
                }
            }
            else {
                return undefined;
            }
        }
        else if (
            hour < 0 ||
            hour > 23
        ) {
            return undefined;
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
            date.getDate() !== day ||
            date.getHours() !== hour ||
            date.getMinutes() !== minute ||
            date.getSeconds() !== second ||
            date.getMilliseconds() !== millisecond
        ) {
            return undefined;
        }

        return date;
    }

    static #coerceDate(value) {
        if (value instanceof Date) {
            return Number.isFinite(value.getTime())
                ? value
                : undefined;
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            const date = new Date(value);

            return Number.isFinite(date.getTime())
                ? date
                : undefined;
        }

        return TemporalFormat.parseDateTime(
            value
        );
    }

    static #replaceTokens(
        format,
        tokens,
        values
    ) {
        let result = "";
        let index = 0;

        while (index < format.length) {
            const token =
                tokens.find(
                    candidate =>
                        format.startsWith(
                            candidate,
                            index
                        )
                );

            if (token) {
                result += values[token];
                index += token.length;
            }
            else {
                result += format[index];
                index += 1;
            }
        }

        return result;
    }

    static #collectTokens(
        format,
        tokens
    ) {
        const found = [];
        let index = 0;

        while (index < format.length) {
            const token =
                tokens.find(
                    candidate =>
                        format.startsWith(
                            candidate,
                            index
                        )
                );

            if (token) {
                found.push(token);
                index += token.length;
            }
            else {
                index += 1;
            }
        }

        return found;
    }

    static #pad(
        value,
        length
    ) {
        return String(value).padStart(
            length,
            "0"
        );
    }

    static #trimNumber(value) {
        if (Number.isInteger(value)) {
            return String(value);
        }

        return value
            .toFixed(6)
            .replace(/0+$/, "")
            .replace(/\.$/, "");
    }
}

globalThis.TemporalFormat = TemporalFormat;
