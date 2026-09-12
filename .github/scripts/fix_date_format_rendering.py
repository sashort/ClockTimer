from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

expected_day = '''        static #DAY =
            24 * ClockTimer.#HOUR;
'''
replacement_day = '''        static #DAY =
            24 * ClockTimer.#HOUR;

        static #DEFAULT_DATE_FORMAT =
            "yyyy-mm-dd";
'''

if expected_day not in text:
    raise SystemExit("Could not find #DAY declaration")

text = text.replace(
    expected_day,
    replacement_day,
    1
)

marker = '''        #updateDisplay(
            now
        ) {
'''

helpers = '''        #normalizeDateFormat(
            format
        ) {
            if (typeof format !== "string") {
                return undefined;
            }

            const translated =
                format.trim().replace(
                    /m{1,4}/g,
                    token =>
                        "M".repeat(
                            token.length
                        )
                );

            return TemporalFormat.isDateFormat(
                translated
            )
                ? translated
                : undefined;
        }

        #getDateFormat() {
            return (
                this.#normalizeDateFormat(
                    this.getAttribute(
                        "date-format"
                    )
                ) ??
                this.#normalizeDateFormat(
                    ClockTimer.#DEFAULT_DATE_FORMAT
                )
            );
        }

'''

if marker not in text:
    raise SystemExit("Could not find #updateDisplay")

text = text.replace(
    marker,
    helpers + marker,
    1
)

old_date = '''            this.#dateElement.textContent =
                new Intl.DateTimeFormat(
                    undefined,
                    {
                        weekday: "long",
                        month: "long",
                        day: "numeric"
                    }
                ).format(now);
'''

new_date = '''            const dateVisible =
                this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.hidden =
                !dateVisible;

            this.#dateElement.textContent =
                dateVisible
                    ? (
                        TemporalFormat.formatDate(
                            now,
                            this.#getDateFormat()
                        ) ??
                        ""
                    )
                    : "";
'''

if old_date not in text:
    raise SystemExit("Could not find hard-coded date formatter")

text = text.replace(
    old_date,
    new_date,
    1
)

path.write_text(text)
