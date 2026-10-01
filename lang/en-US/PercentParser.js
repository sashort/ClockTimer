class EnglishSpokenPercentParser {
    static #ones = Object.freeze({
        zero: 0,
        oh: 0,
        o: 0,
        naught: 0,
        nought: 0,
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
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90
    });

    static parse(value) {
        const phrase =
            String(value ?? "")
                .toLocaleLowerCase(
                    "en-US"
                )
                .trim()
                .replace(
                    /\s*(?:percent|per cent|%)\s*$/,
                    ""
                )
                .trim();

        if (
            /^\d+(?:\.\d+)?$/
                .test(phrase)
        ) {
            return Number(
                phrase
            );
        }

        const digitSequence =
            EnglishSpokenPercentParser
                .#digitSequence(
                    phrase
                );

        if (digitSequence !== undefined) {
            return Number(
                digitSequence
            );
        }

        const words =
            phrase
                .replace(
                    /[-–—]/g,
                    " "
                )
                .replace(
                    /\band\b/g,
                    " "
                )
                .split(/\s+/)
                .filter(Boolean);

        if (!words.length) {
            return undefined;
        }

        let total = 0;
        let current = 0;

        for (const word of words) {
            if (
                Object.hasOwn(
                    EnglishSpokenPercentParser
                        .#ones,
                    word
                )
            ) {
                current +=
                    EnglishSpokenPercentParser
                        .#ones[
                            word
                        ];
            }
            else if (
                Object.hasOwn(
                    EnglishSpokenPercentParser
                        .#tens,
                    word
                )
            ) {
                current +=
                    EnglishSpokenPercentParser
                        .#tens[
                            word
                        ];
            }
            else if (
                word ===
                "hundred"
            ) {
                current =
                    (
                        current ||
                        1
                    ) *
                    100;
            }
            else if (
                word ===
                "thousand"
            ) {
                total +=
                    (
                        current ||
                        1
                    ) *
                    1000;
                current = 0;
            }
            else {
                return undefined;
            }
        }

        return total + current;
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

        let digits = "";

        for (
            let index = 0;
            index < tokens.length;
            index++
        ) {
            const token =
                tokens[index];

            let repeat = 1;

            if (
                token ===
                    "double" ||
                token ===
                    "triple"
            ) {
                repeat =
                    token ===
                        "double"
                        ? 2
                        : 3;
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
                    : EnglishSpokenPercentParser
                        .#digitWords[
                            digitToken
                        ];

            if (digit === undefined) {
                return undefined;
            }

            digits +=
                digit.repeat(
                    repeat
                );
        }

        return digits || undefined;
    }
}

globalThis.EnglishSpokenPercentParser =
    EnglishSpokenPercentParser;
