from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")

old = '''                case "military-time":
                    this.#normalizeMilitaryTime();

                    this.#scheduleHourRender();

                    this.#updateDisplay(
                        new Date()
                    );

                    break;'''
new = '''                case "military-time":
                    this.#normalizeMilitaryTime();

                    this.#normalizeFormat();

                    this.#scheduleHourRender();

                    this.#updateDisplay(
                        new Date()
                    );

                    break;'''
if old not in text:
    raise SystemExit("military-time callback block not found")
text = text.replace(old, new, 1)

old = '''            if (
                !this.hasAttribute(
                    "format"
                )
            ) {
                this.setAttribute(
                    "format",
                    "hh:mm:ss"
                );
            }
            else {
                this.#normalizeFormat();
            }'''
new = '''            if (
                !this.hasAttribute(
                    "format"
                )
            ) {
                this.setAttribute(
                    "format",
                    this.#getDefaultFormat()
                );
            }
            else {
                this.#normalizeFormat();
            }'''
if old not in text:
    raise SystemExit("ensureAttributes format block not found")
text = text.replace(old, new, 1)

start = text.index('        #normalizeFormat() {')
end = text.index('        #renderHours() {', start)
replacement = '''        #getDefaultFormat() {
            return this.getAttribute(
                "military-time"
            ) === "false"
                ? "h:mm:ss AM/PM"
                : "hhmmss";
        }

        #normalizeFormat() {
            const value =
                this.getAttribute(
                    "format"
                );

            if (
                !this.#isValidFormat(
                    value
                )
            ) {
                const defaultFormat =
                    this.#getDefaultFormat();

                if (
                    value !==
                        defaultFormat
                ) {
                    this.setAttribute(
                        "format",
                        defaultFormat
                    );
                }
            }
        }

        #isValidFormat(
            value
        ) {
            if (
                typeof value !==
                    "string"
            ) {
                return false;
            }

            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            if (military) {
                return /^(?:hhmm|hhmmss)$/.test(
                    value
                );
            }

            return /^h:mm(?::ss)?(?: ?(?:a\\/p|A\\/P|AM\\/PM|A\\.M\\.\\/P\\.M\\.|am\\/pm|a\\.m\\.\\/p\\.m\\.))?$/.test(
                value
            );
        }

        #updateDisplay(
            now
        ) {
            const military =
                this.getAttribute(
                    "military-time"
                ) !== "false";

            const format =
                this.getAttribute(
                    "format"
                ) ??
                this.#getDefaultFormat();

            const rawHours =
                now.getHours();

            const hours =
                military
                    ? rawHours
                    : rawHours % 12 || 12;

            const minutes =
                String(
                    now.getMinutes()
                ).padStart(
                    2,
                    "0"
                );

            const seconds =
                String(
                    now.getSeconds()
                ).padStart(
                    2,
                    "0"
                );

            if (military) {
                const hourText =
                    String(
                        hours
                    ).padStart(
                        2,
                        "0"
                    );

                this.#timeElement.textContent =
                    format === "hhmmss"
                        ? `${hourText}${minutes}${seconds}`
                        : `${hourText}${minutes}`;

                return;
            }

            const hasSeconds =
                format.startsWith(
                    "h:mm:ss"
                );

            let result =
                `${hours}:${minutes}`;

            if (hasSeconds) {
                result +=
                    `:${seconds}`;
            }

            const suffixMatch =
                format.match(
                    /^(?:h:mm|h:mm:ss)( ?)(a\\/p|A\\/P|AM\\/PM|A\\.M\\.\\/P\\.M\\.|am\\/pm|a\\.m\\.\\/p\\.m\\.)$/
                );

            if (suffixMatch) {
                const space =
                    suffixMatch[1];

                const style =
                    suffixMatch[2];

                const pm =
                    rawHours >= 12;

                const suffixes = {
                    "a/p": pm ? "p" : "a",
                    "A/P": pm ? "P" : "A",
                    "AM/PM": pm ? "PM" : "AM",
                    "A.M./P.M.": pm ? "P.M." : "A.M.",
                    "am/pm": pm ? "pm" : "am",
                    "a.m./p.m.": pm ? "p.m." : "a.m."
                };

                result +=
                    space +
                    suffixes[style];
            }

            this.#timeElement.textContent =
                result;
        }

'''
text = text[:start] + replacement + text[end:]

path.write_text(text, encoding="utf-8")
