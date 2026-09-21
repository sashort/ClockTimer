class EnglishSpokenTimeParser {
    static #units = Object.freeze({
        zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
        twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
        sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
    });
    static #tens = Object.freeze({twenty: 20, thirty: 30, forty: 40, fifty: 50});

    /**
     * Parse an English time phrase into a Date.
     *
     * With no explicit date or AM/PM, the next occurrence is selected.
     * Returns undefined when the phrase is not a recognizable valid time.
     */
    static parse(value, {baseDate = new Date(), preferFuture = true} = {}) {
        const reference = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate);
        if (Number.isNaN(reference.getTime())) throw new TypeError("baseDate must be a valid date.");
        const parsed = EnglishSpokenTimeParser.parseParts(value);
        if (!parsed) return undefined;

        const candidates = EnglishSpokenTimeParser.#candidateHours(parsed);
        if (!candidates.length) return undefined;
        const dayOffset = parsed.day === "tomorrow" ? 1 : 0;
        const explicitDay = parsed.day !== undefined;
        const dates = candidates.map(hour => {
            const result = new Date(reference);
            result.setHours(hour, parsed.minute, 0, 0);
            result.setDate(result.getDate() + dayOffset);
            return result;
        });

        if (!preferFuture || parsed.day === "tomorrow") return dates.sort((a, b) => a - b)[0];
        if (explicitDay) {
            return dates.filter(date => date.getTime() > reference.getTime()).sort((a, b) => a - b)[0] ||
                dates.sort((a, b) => a - b)[0];
        }
        const future = dates.filter(date => date.getTime() > reference.getTime()).sort((a, b) => a - b)[0];
        if (future) return future;
        const next = new Date(dates.sort((a, b) => a - b)[0]);
        next.setDate(next.getDate() + 1);
        return next;
    }

    /** Return normalized clock components without choosing a calendar date. */
    static parseParts(value) {
        let text = String(value ?? "").toLocaleLowerCase("en-US").trim();
        if (!text) return undefined;
        text = text
            .replace(/[.]/g, "")
            .replace(/\ba\s*m\b/g, "am")
            .replace(/\bp\s*m\b/g, "pm")
            .replace(/[-–—]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        let day;
        if (/\btomorrow\b/.test(text)) day = "tomorrow";
        else if (/\btoday\b/.test(text)) day = "today";
        text = text.replace(/\b(?:today|tomorrow)\b/g, " ").replace(/\s+/g, " ").trim();

        let meridiem;
        const meridiemMatch = text.match(/\b(am|pm)\b/);
        if (meridiemMatch) meridiem = meridiemMatch[1];
        text = text.replace(/\b(?:am|pm)\b/g, " ").replace(/\s+/g, " ").trim();
        text = text.replace(/^(?:at\s+)?/, "").replace(/\s+o'?clock$/, "").trim();

        if (text === "noon") return {hour: 12, minute: 0, meridiem: "pm", day};
        if (text === "midnight") return {hour: 12, minute: 0, meridiem: "am", day};

        const relative = text.match(/^(quarter|half|\w+(?:\s+\w+)?)\s+(past|after|to|till|until)\s+(.+)$/);
        if (relative) {
            const minute = relative[1] === "quarter" ? 15 : relative[1] === "half" ? 30 : EnglishSpokenTimeParser.#wordsToNumber(relative[1]);
            const hour = EnglishSpokenTimeParser.#parseHour(relative[3]);
            if (!Number.isInteger(minute) || minute < 0 || minute > 59 || hour === undefined) return undefined;
            if (["to", "till", "until"].includes(relative[2])) {
                const adjustedHour = hour === 1 ? 12 : hour - 1;
                return {hour: adjustedHour, minute: 60 - minute, meridiem, day};
            }
            return {hour, minute, meridiem, day};
        }

        const numeric = text.match(/^(\d{1,2})(?::|\s)(\d{1,2})$/);
        if (numeric) return EnglishSpokenTimeParser.#validate(Number(numeric[1]), Number(numeric[2]), meridiem, day);
        if (/^\d{3,4}$/.test(text)) {
            const digits = text.padStart(4, "0");
            return EnglishSpokenTimeParser.#validate(Number(digits.slice(0, 2)), Number(digits.slice(2)), meridiem, day);
        }
        if (/^\d{1,2}$/.test(text)) return EnglishSpokenTimeParser.#validate(Number(text), 0, meridiem, day);

        const tokens = text.split(" ").filter(Boolean);
        for (let split = 1; split <= tokens.length; split++) {
            const hour = EnglishSpokenTimeParser.#wordsToNumber(tokens.slice(0, split).join(" "));
            const minuteText = tokens.slice(split).join(" ");
            const minute = minuteText ? EnglishSpokenTimeParser.#minuteWords(minuteText) : 0;
            const result = EnglishSpokenTimeParser.#validate(hour, minute, meridiem, day);
            if (result) return result;
        }
        return undefined;
    }

    static #minuteWords(text) {
        const tokens = text.split(" ").filter(Boolean);
        if (tokens[0] === "oh" && tokens.length > 1) return EnglishSpokenTimeParser.#wordsToNumber(tokens.slice(1).join(" "));
        return EnglishSpokenTimeParser.#wordsToNumber(text);
    }

    static #parseHour(text) {
        const numeric = /^\d{1,2}$/.test(text) ? Number(text) : EnglishSpokenTimeParser.#wordsToNumber(text);
        return Number.isInteger(numeric) ? numeric : undefined;
    }

    static #wordsToNumber(text) {
        const tokens = text.trim().split(" ").filter(Boolean);
        if (!tokens.length || tokens.length > 2) return undefined;
        if (tokens.length === 1) return EnglishSpokenTimeParser.#units[tokens[0]] ?? EnglishSpokenTimeParser.#tens[tokens[0]];
        const tens = EnglishSpokenTimeParser.#tens[tokens[0]];
        const unit = EnglishSpokenTimeParser.#units[tokens[1]];
        return tens !== undefined && unit !== undefined && unit < 10 ? tens + unit : undefined;
    }

    static #validate(hour, minute, meridiem, day) {
        if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;
        if (meridiem && (hour < 1 || hour > 12)) return undefined;
        if (!meridiem && (hour < 0 || hour > 23)) return undefined;
        return {hour, minute, meridiem, day};
    }

    static #candidateHours({hour, meridiem}) {
        if (meridiem === "am") return [hour % 12];
        if (meridiem === "pm") return [(hour % 12) + 12];
        if (hour === 0 || hour > 12) return [hour];
        if (hour === 12) return [0, 12];
        return [hour, hour + 12];
    }
}
