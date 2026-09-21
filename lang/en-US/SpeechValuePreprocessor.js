class EnglishSpeechValuePreprocessor {
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
