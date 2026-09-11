from pathlib import Path

path = Path('TemporalFormat.js')
text = path.read_text()

marker = '    static normalizeTimeFormat(\n'
assert marker in text

methods = r'''    static getFormatType(value) {
        if (typeof value !== "string") {
            return;
        }

        const text = value.trim();

        if (!text) {
            return;
        }

        const timeTokens =
            TemporalFormat.#collectTokens(
                text,
                TemporalFormat.#TIME_TOKENS
            );

        const dateTokens =
            TemporalFormat.#collectTokens(
                text,
                TemporalFormat.#DATE_TOKENS
            );

        const hasMilitaryHour =
            timeTokens.includes("H") ||
            timeTokens.includes("HH");

        const hasStandardHour =
            timeTokens.includes("h") ||
            timeTokens.includes("hh");

        const hasTime =
            timeTokens.includes("mm") &&
            hasMilitaryHour !== hasStandardHour;

        const hasYear =
            dateTokens.includes("yy") ||
            dateTokens.includes("yyyy");

        const hasMonth =
            dateTokens.includes("M") ||
            dateTokens.includes("MM") ||
            dateTokens.includes("MMM") ||
            dateTokens.includes("MMMM");

        const hasDay =
            dateTokens.includes("d") ||
            dateTokens.includes("dd");

        const hasDate =
            hasYear &&
            hasMonth &&
            hasDay;

        if (!hasDate && !hasTime) {
            return;
        }

        const result = {
            type:
                hasDate && hasTime
                    ? "datetime"
                    : hasDate
                        ? "date"
                        : "time"
        };

        if (hasTime) {
            result["time-type"] =
                TemporalFormat.#isISO8601Format(text)
                    ? "ISO 8601"
                    : hasMilitaryHour
                        ? "military"
                        : "12-hour";
        }

        return result;
    }

    static parseISO8601(
        value,
        referenceDate = new Date()
    ) {
        if (typeof value !== "string") {
            return;
        }

        const text = value.trim();

        if (!text) {
            return;
        }

        const dateMatch =
            text.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );

        if (dateMatch) {
            return TemporalFormat.#buildISODate(
                dateMatch
            );
        }

        const dateTimeMatch =
            text.match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/
            );

        if (dateTimeMatch) {
            const local =
                TemporalFormat.#buildDate(
                    Number(dateTimeMatch[1]),
                    Number(dateTimeMatch[2]),
                    Number(dateTimeMatch[3]),
                    dateTimeMatch[4],
                    dateTimeMatch[5],
                    dateTimeMatch[6],
                    TemporalFormat.#isoMilliseconds(
                        dateTimeMatch[7]
                    )
                );

            if (!local) {
                return;
            }

            if (!dateTimeMatch[8]) {
                return local;
            }

            const normalized =
                TemporalFormat.#normalizeISOOffset(
                    text
                );

            const date = new Date(normalized);

            return Number.isFinite(date.getTime())
                ? date
                : undefined;
        }

        const timeMatch =
            text.match(
                /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/
            );

        if (!timeMatch) {
            return;
        }

        const reference =
            referenceDate instanceof Date &&
            Number.isFinite(referenceDate.getTime())
                ? referenceDate
                : new Date();

        const local =
            TemporalFormat.#buildDate(
                reference.getFullYear(),
                reference.getMonth() + 1,
                reference.getDate(),
                timeMatch[1],
                timeMatch[2],
                timeMatch[3],
                TemporalFormat.#isoMilliseconds(
                    timeMatch[4]
                )
            );

        if (!local || !timeMatch[5]) {
            return local;
        }

        const dateText = [
            reference.getFullYear(),
            TemporalFormat.#pad(
                reference.getMonth() + 1,
                2
            ),
            TemporalFormat.#pad(
                reference.getDate(),
                2
            )
        ].join("-");

        const normalized =
            TemporalFormat.#normalizeISOOffset(
                `${dateText}T${text}`
            );

        const date = new Date(normalized);

        return Number.isFinite(date.getTime())
            ? date
            : undefined;
    }

    static isISO8601(value) {
        return (
            TemporalFormat.parseISO8601(
                value
            ) !== undefined
        );
    }

'''

text = text.replace(marker, methods + marker, 1)

private_marker = '    static #buildDate(\n'
assert private_marker in text

private_methods = r'''    static #isISO8601Format(format) {
        return /^(?:yyyy-MM-ddT)?HH:mm(?::ss)?$/.test(
            format
        );
    }

    static #isoMilliseconds(value) {
        if (value === undefined) {
            return undefined;
        }

        return String(value)
            .slice(0, 3)
            .padEnd(3, "0");
    }

    static #normalizeISOOffset(value) {
        return value.replace(
            /([+-]\d{2})(\d{2})$/,
            "$1:$2"
        );
    }

    static #buildISODate(match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);

        const date = new Date(
            year,
            month - 1,
            day
        );

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return;
        }

        return date;
    }

'''

text = text.replace(private_marker, private_methods + private_marker, 1)

path.write_text(text)

path = Path('ClockTimer.js')
text = path.read_text()

text = text.replace(
'''        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm:ss AM/PM"
                : "hhmmss";
        }
''',
'''        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm:ss AM/PM"
                : "HHmmss";
        }
''',
1
)

start = text.index('        #isValidFormat(\n')
end = text.index('        #updateDisplay(\n', start)
text = text[:start] + '''        #isValidFormat(
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

''' + text[end:]

start = text.index('        #updateDisplay(\n')
end = text.index('        #renderHours() {', start)
text = text[:start] + '''        #updateDisplay(
            now
        ) {
            this.#dateElement.textContent =
                new Intl.DateTimeFormat(
                    undefined,
                    {
                        weekday: "long",
                        month: "long",
                        day: "numeric"
                    }
                ).format(now);

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

''' + text[end:]

path.write_text(text)
