class EnglishSpokenNumberParser {
    static #small = Object.freeze({
        zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
        twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
        sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
    });

    static #tens = Object.freeze({
        twenty: 20, thirty: 30, forty: 40, fifty: 50,
        sixty: 60, seventy: 70, eighty: 80, ninety: 90
    });

    static #digitWords = Object.freeze({
        zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4,
        five: 5, six: 6, seven: 7, eight: 8, nine: 9
    });

    static #numericUnits = new Set([
        "hour", "hours", "hr", "hrs",
        "minute", "minutes", "min", "mins",
        "second", "seconds", "sec", "secs",
        "percent", "percentage"
    ]);

    static normalizeText(value) {
        const tokens = String(value ?? "")
            .toLocaleLowerCase("en-US")
            .replace(/[-–—]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .split(" ")
            .filter(Boolean);

        if (!tokens.length) return "";

        const output = [];

        for (let index = 0; index < tokens.length;) {
            const article = tokens[index];

            if (
                (article === "a" || article === "an") &&
                EnglishSpokenNumberParser.#numericUnits.has(
                    tokens[index + 1]
                )
            ) {
                output.push("1");
                index++;
                continue;
            }

            const parsed =
                EnglishSpokenNumberParser.#read(
                    tokens,
                    index
                );

            if (!parsed) {
                output.push(tokens[index]);
                index++;
                continue;
            }

            output.push(parsed.value);
            index += parsed.length;
        }

        return output.join(" ");
    }

    static parse(value) {
        const normalized =
            EnglishSpokenNumberParser.normalizeText(
                value
            );

        return /^-?\d+(?:\.\d+)?$/.test(normalized)
            ? Number(normalized)
            : undefined;
    }

    static #read(tokens, start) {
        let index = start;
        let sign = 1;

        if (
            tokens[index] === "negative" ||
            tokens[index] === "minus"
        ) {
            sign = -1;
            index++;
        }

        const first = tokens[index];
        if (!first) return undefined;

        if (/^\d+(?:\.\d+)?$/.test(first)) {
            return {
                value: String(sign * Number(first)),
                length: index - start + 1
            };
        }

        if (
            !(first in EnglishSpokenNumberParser.#small) &&
            !(first in EnglishSpokenNumberParser.#tens)
        ) {
            return undefined;
        }

        const scaleEnd =
            EnglishSpokenNumberParser.#findScaleEnd(
                tokens,
                index
            );

        let integer;
        let consumed;

        if (scaleEnd > index) {
            const result =
                EnglishSpokenNumberParser.#parseScaled(
                    tokens,
                    index,
                    scaleEnd
                );

            if (!result) return undefined;
            integer = result.value;
            consumed = result.length;
        }
        else if (
            first in EnglishSpokenNumberParser.#tens &&
            (
                tokens[index + 1] in
                EnglishSpokenNumberParser.#digitWords
            )
        ) {
            integer =
                EnglishSpokenNumberParser.#tens[first] +
                EnglishSpokenNumberParser.#digitWords[
                    tokens[index + 1]
                ];
            consumed = 2;
        }
        else {
            integer =
                EnglishSpokenNumberParser.#small[first] ??
                EnglishSpokenNumberParser.#tens[first];
            consumed = 1;
        }

        const decimalStart =
            index + consumed;

        if (tokens[decimalStart] === "point") {
            const digits = [];
            let cursor = decimalStart + 1;

            while (cursor < tokens.length) {
                const word = tokens[cursor];

                if (/^\d$/.test(word)) {
                    digits.push(word);
                }
                else if (
                    word in
                    EnglishSpokenNumberParser.#digitWords
                ) {
                    digits.push(
                        String(
                            EnglishSpokenNumberParser
                                .#digitWords[word]
                        )
                    );
                }
                else {
                    break;
                }

                cursor++;
            }

            if (digits.length) {
                return {
                    value:
                        `${sign < 0 ? "-" : ""}${integer}.${digits.join("")}`,
                    length:
                        cursor - start
                };
            }
        }

        return {
            value: String(sign * integer),
            length:
                index - start + consumed
        };
    }

    static #findScaleEnd(tokens, start) {
        let cursor = start;
        let sawScale = false;
        let end = start;

        while (cursor < tokens.length) {
            const word = tokens[cursor];

            if (
                word === "and" &&
                cursor > start
            ) {
                cursor++;
                continue;
            }

            if (
                word === "hundred" ||
                word === "thousand"
            ) {
                sawScale = true;
                end = cursor + 1;
                cursor++;
                continue;
            }

            if (
                word in EnglishSpokenNumberParser.#small ||
                word in EnglishSpokenNumberParser.#tens
            ) {
                end = cursor + 1;
                cursor++;
                continue;
            }

            break;
        }

        return sawScale
            ? end
            : start;
    }

    static #parseScaled(tokens, start, end) {
        let total = 0;
        let current = 0;
        let cursor = start;

        for (; cursor < end; cursor++) {
            const word = tokens[cursor];

            if (word === "and") continue;

            if (
                word in
                EnglishSpokenNumberParser.#small
            ) {
                current +=
                    EnglishSpokenNumberParser
                        .#small[word];
                continue;
            }

            if (
                word in
                EnglishSpokenNumberParser.#tens
            ) {
                current +=
                    EnglishSpokenNumberParser
                        .#tens[word];
                continue;
            }

            if (word === "hundred") {
                current =
                    (current || 1) * 100;
                continue;
            }

            if (word === "thousand") {
                total +=
                    (current || 1) * 1000;
                current = 0;
                continue;
            }

            return undefined;
        }

        return {
            value: total + current,
            length: cursor - start
        };
    }
}

globalThis.EnglishSpokenNumberParser = EnglishSpokenNumberParser;
