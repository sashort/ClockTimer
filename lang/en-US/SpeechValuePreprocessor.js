class EnglishSpeechValuePreprocessor {
    static normalize(value, kind) {
        const phrase = String(value ?? "").trim();
        switch (kind) {
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
        const phrase = String(value ?? "").trim();
        if (!phrase) return undefined;
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
