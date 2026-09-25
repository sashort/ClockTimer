class EnglishSpeechValuePreprocessor {
    static #normalizeTimeArticles(value) {
        return String(value ?? "")
            .trim()
            .replace(
                /\b(?:a|an)\b(?=\s+(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\b)/gi,
                "one"
            )
            .replace(
                /\b(?:a|an)\b(?=\s+(?:quarter|half)\b)/gi,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    static #normalizeKeypadDigits(value) {
        const tokens =
            String(value ?? "")
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean);

        if (!tokens.length) {
            return undefined;
        }

        const digitWords = {
            zero: "0",
            oh: "0",
            one: "1",
            two: "2",
            three: "3",
            four: "4",
            five: "5",
            six: "6",
            seven: "7",
            eight: "8",
            nine: "9"
        };

        let digits = "";

        for (const token of tokens) {
            if (/^\d+$/.test(token)) {
                digits += token;
                continue;
            }

            const digit =
                digitWords[token];

            if (digit === undefined) {
                return undefined;
            }

            digits += digit;
        }

        return digits || undefined;
    }

    static normalize(value, kind) {
        const raw = String(value ?? "").trim();
        const phrase =
            kind === "duration" ||
            kind === "clock" ||
            kind === "clock-parts"
                ? EnglishSpeechValuePreprocessor.#normalizeTimeArticles(raw)
                : raw;
        switch (kind) {
            case "keypad":
                return EnglishSpeechValuePreprocessor.#normalizeKeypadDigits(raw);
            case "duration": {
                const duration = EnglishDurationParser.parse(phrase);
                return EnglishDurationParser.format(duration);
            }
            case "clock":
            case "clock-parts": {
                const parts = EnglishSpokenTimeParser.parseParts(phrase);
                if (!parts) return undefined;
                return `${parts.hour}:${String(parts.minute).padStart(2, "0")}` +
                    (parts.meridiem ? ` ${parts.meridiem}` : "") +
                    (parts.day ? ` ${parts.day}` : "");
            }
            case "percent": {
                const percent = EnglishSpokenPercentParser.parse(phrase);
                return Number.isFinite(percent) ? String(percent) : undefined;
            }
            default:
                return undefined;
        }
    }

    static parse(value, kind, options = {}) {
        const raw = String(value ?? "").trim();
        if (!raw) return undefined;
        const phrase =
            kind === "duration" ||
            kind === "clock" ||
            kind === "clock-parts"
                ? EnglishSpeechValuePreprocessor.#normalizeTimeArticles(raw)
                : raw;
        switch (kind) {
            case "keypad":
                return EnglishSpeechValuePreprocessor.#normalizeKeypadDigits(raw);
            case "duration":
                return EnglishDurationParser.parse(phrase);
            case "clock":
                return EnglishSpokenTimeParser.parse(phrase, options);
            case "clock-parts":
                return EnglishSpokenTimeParser.parseParts(phrase);
            case "percent":
                return EnglishSpokenPercentParser.parse(phrase);
            default:
                return undefined;
        }
    }
}

globalThis.EnglishSpeechValuePreprocessor = EnglishSpeechValuePreprocessor;
