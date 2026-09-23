class EnglishDurationParser {
    static parse(value) {
        let text =
            String(value ?? "")
                .toLocaleLowerCase("en-US")
                .trim();

        if (!text) return undefined;

        if (
            globalThis.EnglishSpokenNumberParser
        ) {
            text =
                EnglishSpokenNumberParser
                    .normalizeText(text);
        }

        text = text
            .replace(/[-–—]/g, " ")
            .replace(/\band\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (!text) return undefined;

        const colon =
            text.match(
                /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/
            );

        if (colon) {
            if (colon[3] !== undefined) {
                const hours = Number(colon[1]);
                const minutes = Number(colon[2]);
                const seconds = Number(colon[3]);

                return (
                    hours * 3600 +
                    minutes * 60 +
                    seconds
                ) * 1000;
            }

            const minutes = Number(colon[1]);
            const seconds = Number(colon[2]);

            return (
                minutes * 60 +
                seconds
            ) * 1000;
        }

        const unitPattern =
            /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)(?=\s|$)/g;

        let hours = 0;
        let minutes = 0;
        let seconds = 0;
        let sawHours = false;
        let sawMinutes = false;
        let sawSeconds = false;
        let matched = false;

        const remainder =
            text.replace(
                unitPattern,
                (whole, rawAmount, unit) => {
                    const amount =
                        Number(rawAmount);

                    matched = true;

                    if (/^(?:hours?|hrs?)$/.test(unit)) {
                        hours += amount;
                        sawHours = true;
                    }
                    else if (
                        /^(?:minutes?|mins?)$/.test(unit)
                    ) {
                        minutes += amount;
                        sawMinutes = true;
                    }
                    else {
                        seconds += amount;
                        sawSeconds = true;
                    }

                    return " ";
                }
            )
            .replace(/\s+/g, " ")
            .trim();

        if (matched) {
            if (remainder) {
                const implicit =
                    remainder
                        .split(" ")
                        .filter(Boolean)
                        .map(Number);

                if (
                    !implicit.length ||
                    implicit.some(
                        number =>
                            !Number.isFinite(number) ||
                            number < 0
                    )
                ) {
                    return undefined;
                }

                if (sawSeconds) {
                    return undefined;
                }

                if (sawMinutes) {
                    if (implicit.length > 1) {
                        return undefined;
                    }

                    seconds += implicit[0];
                }
                else if (sawHours) {
                    if (implicit.length > 2) {
                        return undefined;
                    }

                    minutes += implicit[0];

                    if (implicit.length === 2) {
                        seconds += implicit[1];
                    }
                }
                else {
                    return undefined;
                }
            }

            if (
                minutes >= 60 ||
                seconds >= 60
            ) {
                return undefined;
            }

            const totalSeconds =
                hours * 3600 +
                minutes * 60 +
                seconds;

            return totalSeconds > 0
                ? totalSeconds * 1000
                : undefined;
        }

        const pieces =
            text
                .split(" ")
                .filter(Boolean);

        if (
            pieces.some(
                piece => !/^\d+$/.test(piece)
            )
        ) {
            return undefined;
        }

        const values =
            pieces.map(Number);

        if (values.length === 1) {
            return values[0] > 0
                ? values[0] * 60000
                : undefined;
        }

        if (values.length === 2) {
            const [bareMinutes, bareSeconds] =
                values;

            if (
                bareMinutes < 0 ||
                bareSeconds < 0 ||
                bareSeconds >= 60
            ) {
                return undefined;
            }

            return (
                bareMinutes * 60 +
                bareSeconds
            ) * 1000;
        }

        if (values.length === 3) {
            const [
                bareHours,
                bareMinutes,
                bareSeconds
            ] = values;

            if (
                bareHours < 0 ||
                bareMinutes < 0 ||
                bareMinutes >= 60 ||
                bareSeconds < 0 ||
                bareSeconds >= 60
            ) {
                return undefined;
            }

            return (
                bareHours * 3600 +
                bareMinutes * 60 +
                bareSeconds
            ) * 1000;
        }

        return undefined;
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
                milliseconds / 1000
            );

        const hours =
            Math.floor(total / 3600);

        const minutes =
            Math.floor(
                total % 3600 / 60
            );

        const seconds =
            total % 60;

        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
}

globalThis.EnglishDurationParser = EnglishDurationParser;
