from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


path = Path("ClockTimer.js")
clock = path.read_text()

old = '''        #formatElapsedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            return this.#formatSignedRenderedDuration(
                Math.trunc(milliseconds / 1000) * 1000
            );
        }

        #formatSignedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const rounded =
                Math.round(
                    milliseconds
                );

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        rounded
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            return rounded < 0
                ? `-${formatted}`
                : formatted;
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            // Elapsed time truncates to the completed whole second. Remaining
            // time uses the complementary ceiling so the two displays agree at
            // whole-second precision and never expose interval milliseconds.
            const rounded =
                Math.ceil(
                    milliseconds /
                    1000
                ) *
                1000;

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        rounded
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            if (rounded < 0) {
                return `-${formatted}`;
            }

            if (rounded > 0) {
                return `⁺${formatted}`;
            }

            return formatted;
        }
'''

new = '''        #formatElapsedRenderedDuration(
            milliseconds
        ) {
            return this.#formatSignedRenderedDuration(
                milliseconds
            );
        }

        #formatSignedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        milliseconds
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            return milliseconds < 0
                ? `-${formatted}`
                : formatted;
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        milliseconds
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            if (milliseconds < 0) {
                return `-${formatted}`;
            }

            if (milliseconds > 0) {
                return `⁺${formatted}`;
            }

            return formatted;
        }
'''

clock = replace_once(
    clock,
    old,
    new,
    "elapsed/remaining UI formatting"
)

path.write_text(clock)
