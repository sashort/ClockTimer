class EnglishDurationParser {
    static #small = Object.freeze({
        zero: 0,
        oh: 0,
        o: 0,
        naught: 0,
        nought: 0,
        a: 1,
        an: 1,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19
    });

    static #digitWords = Object.freeze({
        zero: "0",
        oh: "0",
        o: "0",
        naught: "0",
        nought: "0",
        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",
        six: "6",
        seven: "7",
        eight: "8",
        nine: "9"
    });

    static #tens = Object.freeze({
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50
    });

    static parse(value) {
        const text =
            String(value ?? "")
                .toLocaleLowerCase("en-US")
                .trim()
                .replace(/[-–—]/g, " ")
                .replace(/\s+/g, " ");

        if (!text) {
            return undefined;
        }

        const clock =
            text.match(
                /^(?:(\d+):)?([0-5]?\d):([0-5]?\d)$/
            );

        if (clock) {
            const hours =
                Number(clock[1] || 0);
            const minutes =
                Number(clock[2]);
            const seconds =
                Number(clock[3]);

            return (
                (
                    hours * 3600 +
                    minutes * 60 +
                    seconds
                ) *
                1000
            );
        }

        /*
         * A spoken list of individual digits is raw keypad-style duration
         * input.  The final two digits are seconds, the preceding two are
         * minutes, and any remaining digits are hours.
         *
         * "1 1 2 6" / "one one two six" -> 0:11:26
         * "1 2 3 4 5"                 -> 1:23:45
         */
        const spokenDigits =
            EnglishDurationParser
                .#digitSequence(
                    text
                );

        if (spokenDigits) {
            return EnglishDurationParser
                .#rawDigitDuration(
                    spokenDigits
                );
        }

        /*
         * Grouped numeric duration speech is positional.  Two numeric
         * groups are minutes + seconds, while individual spoken digits
         * above have already been handled as raw keypad input.
         *
         * "22 56" -> 0:22:56
         * "7 56"  -> 0:07:56
         */
        const groupedDuration =
            EnglishDurationParser
                .#groupedDuration(
                    text
                );

        if (groupedDuration !== undefined) {
            return groupedDuration;
        }

        /*
         * A contiguous run keeps the existing raw-duration semantics.
         */
        if (
            /^\d+$/.test(text) &&
            text.length >= 3
        ) {
            return EnglishDurationParser
                .#rawDigitDuration(
                    text
                );
        }

        const explicit =
            EnglishDurationParser
                .#explicitDuration(
                    text
                );

        if (explicit !== undefined) {
            return explicit;
        }

        const positional =
            EnglishDurationParser
                .#parsePositionalNumberGroups(
                    text
                );

        if (positional !== undefined) {
            return positional;
        }

        const cardinalText =
            text
                .replace(/\band\b/g, " ")
                .replace(/\s+/g, " ")
                .trim();

        const clockStyleHourMinute =
            EnglishDurationParser
                .#parseClockStyleHourMinute(
                    cardinalText
                );

        if (
            clockStyleHourMinute !==
                undefined
        ) {
            return clockStyleHourMinute;
        }

        const minutes =
            EnglishDurationParser
                .#number(
                    cardinalText
                );

        return (
            Number.isInteger(minutes) &&
            minutes > 0 &&
            minutes <= 59
        )
            ? minutes * 60000
            : undefined;
    }

    static format(milliseconds) {
        if (
            !Number.isFinite(milliseconds) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        const total =
            Math.round(
                milliseconds /
                1000
            );
        const hours =
            Math.floor(
                total /
                3600
            );
        const minutes =
            Math.floor(
                (
                    total %
                    3600
                ) /
                60
            );
        const seconds =
            total %
            60;

        return hours > 0
            ? (
                `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            )
            : (
                `${minutes}:${String(seconds).padStart(2, "0")}`
            );
    }

    static describe(milliseconds) {
        if (
            !Number.isFinite(
                milliseconds
            ) ||
            milliseconds <= 0
        ) {
            return undefined;
        }

        const totalSeconds =
            Math.round(
                milliseconds /
                1000
            );
        const hours =
            Math.floor(
                totalSeconds /
                3600
            );
        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                60
            );
        const seconds =
            totalSeconds %
            60;
        const parts = [];

        if (hours) {
            parts.push(
                String(hours) +
                (
                    hours === 1
                        ? " hour"
                        : " hours"
                )
            );
        }

        if (minutes) {
            parts.push(
                String(minutes) +
                (
                    minutes === 1
                        ? " minute"
                        : " minutes"
                )
            );
        }

        if (
            seconds ||
            !parts.length
        ) {
            parts.push(
                String(seconds) +
                (
                    seconds === 1
                        ? " second"
                        : " seconds"
                )
            );
        }

        return parts.join(
            " "
        );
    }

    static #parsePositionalNumberGroups(
        value
    ) {
        const chunks =
            EnglishDurationParser
                .#numberChunks(
                    value
                );

        if (
            !chunks ||
            chunks.length < 2 ||
            chunks.length > 3
        ) {
            return undefined;
        }

        const [
            hours,
            minutes,
            seconds
        ] =
            chunks.length === 3
                ? chunks
                : [
                    0,
                    chunks[0],
                    chunks[1]
                ];

        if (
            !Number.isInteger(hours) ||
            hours < 0 ||
            !Number.isInteger(minutes) ||
            minutes < 0 ||
            minutes > 59 ||
            !Number.isInteger(seconds) ||
            seconds < 0 ||
            seconds > 59
        ) {
            return undefined;
        }

        const total =
            (
                hours * 3600 +
                minutes * 60 +
                seconds
            ) *
            1000;

        return total > 0
            ? total
            : undefined;
    }

    static #parseClockStyleHourMinute(
        value
    ) {
        const pieces =
            String(
                value ||
                ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        for (
            let split = 1;
            split < pieces.length;
            split++
        ) {
            const hours =
                EnglishDurationParser
                    .#number(
                        pieces
                            .slice(0, split)
                            .join(" ")
                    );
            const minutes =
                EnglishDurationParser
                    .#number(
                        pieces
                            .slice(split)
                            .join(" ")
                    );

            if (
                Number.isInteger(hours) &&
                hours >= 0 &&
                Number.isInteger(minutes) &&
                minutes >= 0 &&
                minutes < 60
            ) {
                return (
                    (
                        hours * 3600 +
                        minutes * 60
                    ) *
                    1000
                );
            }
        }

        return undefined;
    }

    static #groupedDuration(
        value
    ) {
        const tokens =
            String(
                value ||
                ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (tokens.length < 2) {
            return undefined;
        }

        const rawGroups = [];

        for (
            let index = 0;
            index < tokens.length;
            index++
        ) {
            const token =
                tokens[index];
            const zeroToken =
                token === "oh" ||
                token === "o" ||
                token === "zero" ||
                token === "naught" ||
                token === "nought";

            if (
                zeroToken &&
                index + 1 < tokens.length &&
                /^\d$/.test(
                    tokens[index + 1]
                )
            ) {
                rawGroups.push(
                    Number(
                        "0" +
                        tokens[++index]
                    )
                );
                continue;
            }

            if (/^\d{1,2}$/.test(token)) {
                rawGroups.push(
                    Number(token)
                );
                continue;
            }

            return undefined;
        }

        if (
            rawGroups.length < 2 ||
            rawGroups.length > 3
        ) {
            return undefined;
        }

        const [
            hours,
            minutes,
            seconds
        ] =
            rawGroups.length === 3
                ? rawGroups
                : [
                    0,
                    rawGroups[0],
                    rawGroups[1]
                ];

        if (
            !Number.isInteger(hours) ||
            hours < 0 ||
            !Number.isInteger(minutes) ||
            minutes < 0 ||
            minutes > 59 ||
            !Number.isInteger(seconds) ||
            seconds < 0 ||
            seconds > 59
        ) {
            return undefined;
        }

        const total =
            (
                hours * 3600 +
                minutes * 60 +
                seconds
            ) *
            1000;

        return total > 0
            ? total
            : undefined;
    }

    static #rawDigitDuration(
        digits
    ) {
        const raw =
            String(
                digits ||
                ""
            );

        if (!/^\d+$/.test(raw)) {
            return undefined;
        }

        const seconds =
            Number(
                raw
                    .slice(-2)
            );
        const minuteDigits =
            raw.length > 2
                ? raw.slice(
                    Math.max(
                        0,
                        raw.length - 4
                    ),
                    -2
                )
                : "";
        const minutes =
            Number(
                minuteDigits ||
                0
            );
        const hourDigits =
            raw.length > 4
                ? raw.slice(
                    0,
                    -4
                )
                : "";
        const hours =
            Number(
                hourDigits ||
                0
            );

        if (
            seconds > 59 ||
            minutes > 59
        ) {
            return undefined;
        }

        const total =
            (
                hours * 3600 +
                minutes * 60 +
                seconds
            ) *
            1000;

        return total > 0
            ? total
            : undefined;
    }

    static #digitSequence(
        value
    ) {
        const tokens =
            String(
                value ||
                ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (tokens.length < 2) {
            return undefined;
        }

        let result = "";
        let repeated = false;

        for (
            let index = 0;
            index < tokens.length;
            index++
        ) {
            const token =
                tokens[index];

            let repeat = 1;

            if (
                token === "double" ||
                token === "triple"
            ) {
                repeat =
                    token === "double"
                        ? 2
                        : 3;
                repeated = true;
                index++;

                if (
                    index >=
                    tokens.length
                ) {
                    return undefined;
                }
            }

            const digitToken =
                tokens[index];
            const digit =
                /^\d$/.test(
                    digitToken
                )
                    ? digitToken
                    : EnglishDurationParser
                        .#digitWords[
                            digitToken
                        ];

            if (digit === undefined) {
                return undefined;
            }

            result +=
                digit.repeat(
                    repeat
                );
        }

        return (
            result.length >= 2 ||
            repeated
        )
            ? result
            : undefined;
    }

    static #explicitDuration(
        text
    ) {
        const unitPattern =
            /\b(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/g;

        const values = {
            hours: undefined,
            minutes: undefined,
            seconds: undefined
        };

        let cursor = 0;
        let previousRank = 4;
        let lastRank;
        let matched = false;
        let match;

        while (
            (
                match =
                    unitPattern.exec(
                        text
                    )
            ) !== null
        ) {
            const unit =
                EnglishDurationParser
                    .#unitName(
                        match[1]
                    );
            const rank =
                EnglishDurationParser
                    .#unitRank(
                        unit
                    );

            if (
                !unit ||
                rank >=
                    previousRank
            ) {
                return undefined;
            }

            const amountText =
                text
                    .slice(
                        cursor,
                        match.index
                    )
                    .trim()
                    .replace(
                        /^and\s+/,
                        ""
                    )
                    .replace(
                        /\band\b/g,
                        " "
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            const amount =
                EnglishDurationParser
                    .#number(
                        amountText
                    );

            if (
                !Number.isInteger(
                    amount
                ) ||
                amount < 0 ||
                (
                    unit !== "hours" &&
                    amount > 59
                )
            ) {
                return undefined;
            }

            values[unit] =
                amount;
            matched = true;
            lastRank =
                rank;
            previousRank =
                rank;
            cursor =
                match.index +
                match[0].length;
        }

        if (!matched) {
            return undefined;
        }

        const tail =
            text
                .slice(cursor)
                .trim()
                .replace(
                    /^and\s+/,
                    ""
                )
                .trim();

        if (tail) {
            const chunks =
                EnglishDurationParser
                    .#numberChunks(
                        tail
                    );

            if (!chunks) {
                return undefined;
            }

            const omittedUnits =
                lastRank === 3
                    ? [
                        "minutes",
                        "seconds"
                    ]
                    : lastRank === 2
                        ? [
                            "seconds"
                        ]
                        : [];

            if (
                chunks.length >
                omittedUnits.length
            ) {
                return undefined;
            }

            for (
                let index = 0;
                index < chunks.length;
                index++
            ) {
                const amount =
                    chunks[index];

                if (
                    !Number.isInteger(
                        amount
                    ) ||
                    amount < 0 ||
                    amount > 59
                ) {
                    return undefined;
                }

                values[
                    omittedUnits[
                        index
                    ]
                ] =
                    amount;
            }
        }

        const total =
            (
                (
                    values.hours ||
                    0
                ) *
                3600 +
                (
                    values.minutes ||
                    0
                ) *
                60 +
                (
                    values.seconds ||
                    0
                )
            ) *
            1000;

        return total > 0
            ? total
            : undefined;
    }

    static #numberChunks(
        value
    ) {
        const text =
            String(
                value ||
                ""
            )
                .trim();

        if (!text) {
            return [];
        }

        if (/\band\b/.test(text)) {
            const parts =
                text
                    .split(/\band\b/)
                    .map(
                        part =>
                            part.trim()
                    )
                    .filter(Boolean);

            if (!parts.length) {
                return undefined;
            }

            const values =
                parts.map(
                    part =>
                        EnglishDurationParser
                            .#number(
                                part
                            )
                );

            return values.every(
                Number.isInteger
            )
                ? values
                : undefined;
        }

        const tokens =
            text
                .split(/\s+/)
                .filter(Boolean);
        const values = [];

        for (
            let index = 0;
            index < tokens.length;
            index++
        ) {
            const token =
                tokens[index];

            if (
                (
                    token === "oh" ||
                    token === "o" ||
                    token === "zero" ||
                    token === "naught" ||
                    token === "nought"
                ) &&
                index + 1 <
                    tokens.length
            ) {
                const next =
                    tokens[
                        index + 1
                    ];
                const nextDigit =
                    EnglishDurationParser
                        .#small[
                            next
                        ];

                if (
                    Number.isInteger(
                        nextDigit
                    ) &&
                    nextDigit >= 0 &&
                    nextDigit < 10
                ) {
                    values.push(
                        nextDigit
                    );
                    index++;
                    continue;
                }
            }

            if (
                Object.hasOwn(
                    EnglishDurationParser
                        .#tens,
                    token
                )
            ) {
                let amount =
                    EnglishDurationParser
                        .#tens[
                            token
                        ];
                const next =
                    tokens[
                        index + 1
                    ];
                const nextValue =
                    EnglishDurationParser
                        .#small[
                            next
                        ];

                if (
                    Number.isInteger(
                        nextValue
                    ) &&
                    nextValue >= 0 &&
                    nextValue < 10
                ) {
                    amount +=
                        nextValue;
                    index++;
                }

                values.push(
                    amount
                );
                continue;
            }

            const amount =
                EnglishDurationParser
                    .#number(
                        token
                    );

            if (
                !Number.isInteger(
                    amount
                )
            ) {
                return undefined;
            }

            values.push(
                amount
            );
        }

        return values;
    }

    static #unitName(
        value
    ) {
        if (
            /^(?:hours?|hrs?)$/
                .test(value)
        ) {
            return "hours";
        }

        if (
            /^(?:minutes?|mins?)$/
                .test(value)
        ) {
            return "minutes";
        }

        if (
            /^(?:seconds?|secs?)$/
                .test(value)
        ) {
            return "seconds";
        }

        return undefined;
    }

    static #unitRank(
        unit
    ) {
        return (
            {
                hours: 3,
                minutes: 2,
                seconds: 1
            }[
                unit
            ] ||
            0
        );
    }

    static #number(
        value
    ) {
        const text =
            String(
                value ||
                ""
            )
                .trim();

        if (/^\d+$/.test(text)) {
            return Number(text);
        }

        const words =
            text
                .split(" ")
                .filter(Boolean);

        if (!words.length) {
            return undefined;
        }

        let current = 0;

        for (const word of words) {
            if (
                Object.hasOwn(
                    EnglishDurationParser
                        .#small,
                    word
                )
            ) {
                current +=
                    EnglishDurationParser
                        .#small[
                            word
                        ];
            }
            else if (
                Object.hasOwn(
                    EnglishDurationParser
                        .#tens,
                    word
                )
            ) {
                current +=
                    EnglishDurationParser
                        .#tens[
                            word
                        ];
            }
            else {
                return undefined;
            }

            if (current > 59) {
                return undefined;
            }
        }

        return current;
    }
}

globalThis.EnglishDurationParser =
    EnglishDurationParser;
