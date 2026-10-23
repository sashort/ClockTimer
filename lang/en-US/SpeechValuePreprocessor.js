class EnglishSpeechValuePreprocessor {
    // This is a conservative prefix classifier, separate from normalization.
    // Known unfinished vocabulary may continue; impossible heads and unknown
    // words cannot. The authoritative parser still validates every value.
    static classify(value, kind, {final = false, boundary} = {}) {
        if (boundary?.remainder) {
            const normalized = this.normalize(boundary.value, kind);
            if (normalized !== undefined) return {status: "defer", value: normalized,
                acceptedTranscript: boundary.value, remainder: boundary.remainder, ...this.describe(boundary.value,kind)};
        }
        const text = String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
        const normalized = this.normalize(text, kind);
        if (normalized !== undefined) return {status: "valid", value: normalized, ...this.describe(text,kind)};
        if (final) return {status: "malformed", reason: "invalid-value"};
        if (!text) return {status: "incomplete"};
        if (/^(?:hundred|thousand|million)(?:\s|$)/.test(text))
            return {status: "malformed", reason: "missing-quantity"};
        const numbers = "zero oh o naught nought one two to too three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand and double triple tutu";
        const units = kind === "clock" || kind === "clock-parts"
            ? "a an at quarter half past after till until am pm today tomorrow noon midnight oclock clock"
            : kind === "percent" ? "percent percentage point dot" : "a an hour hours hr hrs minute minutes min mins second seconds sec secs";
        const vocabulary = new Set((numbers + " " + units).split(" "));
        const words = text.split(" ");
        const viable = words.every((word, index) => vocabulary.has(word) || /^\d+(?::\d*)*$/.test(word) ||
            (index === words.length - 1 && [...vocabulary].some(token => token.startsWith(word))));
        return {status: viable ? "incomplete" : "malformed", reason: viable ? "unfinished-value" : "unknown-value-word"};
    }

    static describe(value,kind) {
        const phrase=this.#normalizeTimeArticles(value);
        if (kind==='duration') return EnglishDurationParser.parseComponents(phrase);
        if (kind==='clock'||kind==='clock-parts') return EnglishSpokenTimeParser.parseComponents(phrase);
        return undefined;
    }

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

    static normalize(value, kind) {
        const raw = String(value ?? "").trim();
        const phrase =
            kind === "duration" ||
            kind === "clock" ||
            kind === "clock-parts"
                ? EnglishSpeechValuePreprocessor.#normalizeTimeArticles(raw)
                : raw;
        switch (kind) {
            case "duration": {
                const duration = EnglishDurationParser.parse(phrase);
                return EnglishDurationParser.formatCanonical(duration);
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
