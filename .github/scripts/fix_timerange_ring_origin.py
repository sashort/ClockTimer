from pathlib import Path
import re

path = Path('TimeRange.js')
text = path.read_text()

old_calc = re.compile(r'''    static #calculateTimeAngle\(\n        time\n    \) \{.*?\n    \}\n\n    constructor\(\) \{''', re.S)
new_calc = '''    static #calculateTimeAngle(
        time,
        origin
    ) {
        const millisecondsInHour =
            60 *
            60 *
            1000;

        let milliseconds;

        if (
            origin instanceof Date
        ) {
            const difference =
                time.getTime() -
                origin.getTime();

            if (
                difference >= 0 &&
                difference <=
                    millisecondsInHour
            ) {
                milliseconds =
                    difference;
            }
            else {
                milliseconds =
                    (
                        difference %
                            millisecondsInHour +
                        millisecondsInHour
                    ) %
                    millisecondsInHour;
            }
        }
        else {
            milliseconds =
                time.getMinutes() *
                    60 *
                    1000 +
                time.getSeconds() *
                    1000 +
                time.getMilliseconds();
        }

        return (
            360 /
            millisecondsInHour
        ) *
        milliseconds;
    }

    constructor() {'''
text, count = old_calc.subn(new_calc, text, count=1)
if count != 1:
    raise SystemExit('calculateTimeAngle block not found')

marker = '    #updateClipPath() {'
if marker not in text:
    raise SystemExit('updateClipPath marker not found')

helper = '''    #getRingOriginTime() {
        const parent =
            this.parentElement;

        if (
            !parent ||
            parent.localName !==
                "ring-container" ||
            !parent.hasAttribute(
                "data-clock-timer-ring"
            )
        ) {
            return undefined;
        }

        let earliest;

        for (
            const child of
                parent.children
        ) {
            if (
                child.localName !==
                    "time-range"
            ) {
                continue;
            }

            const value =
                child.getAttribute(
                    "start-time"
                );

            if (
                value === null
            ) {
                continue;
            }

            const start =
                this.#uniformDate(
                    value,
                    false
                );

            if (
                !(start instanceof Date)
            ) {
                continue;
            }

            if (
                !(earliest instanceof Date) ||
                start.getTime() <
                    earliest.getTime()
            ) {
                earliest =
                    start;
            }
        }

        return earliest;
    }

    static #updateParentClipPaths(
        parent
    ) {
        if (!parent) {
            return;
        }

        for (
            const child of
                parent.children
        ) {
            if (
                child instanceof
                    TimeRange
            ) {
                child.#updateClipPath();
            }
        }
    }

'''
text = text.replace(marker, helper + marker, 1)

start_re = re.compile(r'''        const startAngle =\n            TimeRange\.\#calculateTimeAngle\(\n                this\.\#startTime\n            \);''')
end_re = re.compile(r'''        const endAngle =\n            TimeRange\.\#calculateTimeAngle\(\n                this\.\#endTime\n            \);''')

replacement_start = '''        const ringOrigin =
            this.#getRingOriginTime();

        const startAngle =
            TimeRange.#calculateTimeAngle(
                this.#startTime,
                ringOrigin
            );'''
replacement_end = '''        const endAngle =
            TimeRange.#calculateTimeAngle(
                this.#endTime,
                ringOrigin
            );'''

text, count_start = start_re.subn(replacement_start, text, count=1)
text, count_end = end_re.subn(replacement_end, text, count=1)
if count_start != 1 or count_end != 1:
    raise SystemExit(f'angle call sites not found: start={count_start}, end={count_end}')

# Recalculate every TimeRange in the same RingContainer whenever one range
# changes, because the earliest start can become the ring origin.
text = text.replace(
    '            this.#updateClipPath();',
    '            TimeRange.#updateParentClipPaths(\n                this.parentElement\n            );'
)
text = text.replace(
    '        this.#updateClipPath();\n        TimeRange.#reorderParent(',
    '        TimeRange.#updateParentClipPaths(\n            this.parentElement\n        );\n        TimeRange.#reorderParent(',
    1
)

path.write_text(text)
