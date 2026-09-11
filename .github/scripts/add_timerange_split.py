from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()
anchor = '''    stopElapsedAnimation() {\n'''
if anchor not in text:
    raise SystemExit('anchor not found')
method = r'''    split(
        timeValue,
        insert = false
    ) {
        if (
            typeof insert !== "boolean" ||
            !(this.#startTime instanceof Date) ||
            !(this.#endTime instanceof Date)
        ) {
            return;
        }

        const splitTime =
            this.#uniformDate(
                timeValue,
                false
            );

        if (!(splitTime instanceof Date)) {
            return;
        }

        const startMilliseconds =
            this.#startTime.getTime();

        const endMilliseconds =
            this.#endTime.getTime();

        const splitMilliseconds =
            splitTime.getTime();

        if (
            splitMilliseconds <= startMilliseconds ||
            splitMilliseconds >= endMilliseconds
        ) {
            return;
        }

        const parent =
            this.parentElement;

        if (insert && !parent) {
            return;
        }

        const originalEnd =
            new Date(endMilliseconds);

        const hadRangeLength =
            this.hasAttribute(
                "range-length"
            );

        const right =
            document.createElement(
                this.localName
            );

        for (const attribute of this.attributes) {
            if (
                attribute.name === "start-time" ||
                attribute.name === "end-time" ||
                attribute.name === "range-length" ||
                attribute.name === "ignore-overlaps"
            ) {
                continue;
            }

            right.setAttribute(
                attribute.name,
                attribute.value
            );
        }

        right.setAttribute(
            "start-time",
            this.#formatDateTime(
                splitTime
            )
        );

        right.setAttribute(
            "end-time",
            this.#formatDateTime(
                originalEnd
            )
        );

        if (hadRangeLength) {
            right.setAttribute(
                "range-length",
                this.#formatRangeLength(
                    endMilliseconds -
                    splitMilliseconds
                )
            );
        }

        right.setAttribute(
            "ignore-overlaps",
            ""
        );

        right.timeRangeFullEntry =
            true;

        const transitioned =
            this.transitionTo({
                startTime:
                    new Date(
                        startMilliseconds
                    ),
                endTime:
                    splitTime
            });

        if (!transitioned) {
            return;
        }

        if (
            typeof this.snapToLogicalTiming ===
                "function"
        ) {
            this.snapToLogicalTiming();
        }

        if (insert) {
            parent.insertBefore(
                right,
                this.nextSibling
            );
        }

        return [
            this,
            right
        ];
    }

'''
text = text.replace(anchor, method + anchor, 1)
path.write_text(text)
