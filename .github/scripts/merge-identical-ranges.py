from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

anchor = '''        #getManagedTimeRanges() {
'''

helper = r'''        #getRangeMergeAttributes(range) {
            const ignored =
                new Set([
                    "type",
                    "overwrite",
                    "start-time",
                    "end-time",
                    "range-length"
                ]);

            return Array.from(
                range.attributes
            )
                .filter(
                    attribute =>
                        !ignored.has(
                            attribute.name.toLowerCase()
                        )
                )
                .map(
                    attribute => [
                        attribute.name,
                        attribute.value
                    ]
                )
                .sort(
                    (a, b) =>
                        a[0].localeCompare(b[0]) ||
                        a[1].localeCompare(b[1])
                );
        }

        #getRangeMergeClockTimerState(range) {
            return Object.keys(range)
                .filter(
                    key =>
                        key.startsWith(
                            "clockTimer"
                        ) &&
                        key !== "clockTimerStart" &&
                        key !== "clockTimerEnd"
                )
                .sort()
                .map(
                    key => [
                        key,
                        range[key]
                    ]
                );
        }

        #rangeMergeValuesMatch(
            left,
            right
        ) {
            if (left.length !== right.length) {
                return false;
            }

            return left.every(
                (entry, index) =>
                    entry[0] === right[index][0] &&
                    entry[1] === right[index][1]
            );
        }

        #rangesAreMergeIdentical(
            left,
            right
        ) {
            if (
                !left ||
                !right ||
                left === right ||
                left.localName !== "time-range" ||
                right.localName !== "time-range" ||
                left.parentElement !== right.parentElement ||
                left.parentElement?.localName !==
                    "ring-container" ||
                left.timeRangeExiting === true ||
                right.timeRangeExiting === true ||
                left.getAttribute("type") !==
                    right.getAttribute("type")
            ) {
                return false;
            }

            const leftEnd =
                Number(
                    left.clockTimerEnd
                );

            const rightStart =
                Number(
                    right.clockTimerStart
                );

            if (
                !Number.isFinite(leftEnd) ||
                !Number.isFinite(rightStart) ||
                leftEnd !== rightStart
            ) {
                return false;
            }

            if (
                !this.#rangeMergeValuesMatch(
                    this.#getRangeMergeAttributes(
                        left
                    ),
                    this.#getRangeMergeAttributes(
                        right
                    )
                )
            ) {
                return false;
            }

            return this.#rangeMergeValuesMatch(
                this.#getRangeMergeClockTimerState(
                    left
                ),
                this.#getRangeMergeClockTimerState(
                    right
                )
            );
        }

        #mergeAdjacentIdenticalRangesInRing(
            ring
        ) {
            if (
                !ring ||
                ring.localName !== "ring-container"
            ) {
                return false;
            }

            const ranges =
                Array.from(
                    ring.children
                )
                    .filter(
                        range =>
                            range.localName ===
                                "time-range" &&
                            range.timeRangeExiting !==
                                true
                    )
                    .sort(
                        (a, b) =>
                            Number(a.clockTimerStart) -
                                Number(b.clockTimerStart) ||
                            Number(a.clockTimerEnd) -
                                Number(b.clockTimerEnd)
                    );

            let changed =
                false;

            let index =
                0;

            while (
                index < ranges.length - 1
            ) {
                const left =
                    ranges[index];

                const right =
                    ranges[index + 1];

                if (
                    !this.#rangesAreMergeIdentical(
                        left,
                        right
                    )
                ) {
                    index++;
                    continue;
                }

                const start =
                    Number(
                        left.clockTimerStart
                    );

                const end =
                    Number(
                        right.clockTimerEnd
                    );

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    index++;
                    continue;
                }

                const rightOverwrite =
                    right.getAttribute(
                        "overwrite"
                    );

                const preserveRangeLength =
                    left.hasAttribute(
                        "range-length"
                    ) ||
                    right.hasAttribute(
                        "range-length"
                    );

                left.removeAttribute(
                    "overwrite"
                );

                this.#setRangeTiming(
                    left,
                    start,
                    end,
                    preserveRangeLength
                );

                if (rightOverwrite !== null) {
                    left.setAttribute(
                        "overwrite",
                        rightOverwrite
                    );
                }

                if (
                    right.timeRangeFullEntry ===
                        true
                ) {
                    left.timeRangeFullEntry =
                        true;
                }

                right.remove();

                ranges.splice(
                    index + 1,
                    1
                );

                changed =
                    true;
            }

            return changed;
        }

        #mergeAdjacentIdenticalRanges() {
            let changed =
                false;

            for (const ring of this.children) {
                if (
                    ring.localName !==
                        "ring-container"
                ) {
                    continue;
                }

                if (
                    this.#mergeAdjacentIdenticalRangesInRing(
                        ring
                    )
                ) {
                    changed =
                        true;
                }
            }

            return changed;
        }

'''

if '#mergeAdjacentIdenticalRanges() {' not in text:
    if anchor not in text:
        raise SystemExit('getManagedTimeRanges anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

method_anchor = '\n        #refreshRingLayout('
start = text.find(method_anchor)
if start < 0:
    raise SystemExit('refreshRingLayout declaration not found')
brace = text.find('{\n', start)
if brace < 0:
    raise SystemExit('refreshRingLayout opening brace not found')
insert_at = brace + 2
call = '''            this.#mergeAdjacentIdenticalRanges();\n\n'''
if text[insert_at:insert_at + len(call)] != call:
    text = text[:insert_at] + call + text[insert_at:]

path.write_text(text)
