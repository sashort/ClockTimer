from pathlib import Path

path = Path("TimeRange.js")
text = path.read_text()


def replace_once(old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected exactly one match, found {count}: {old[:80]!r}"
        )
    text = text.replace(old, new, 1)


replace_once(
    "class TimeRange extends HTMLElement {\n    static #instances = [];\n",
    "class TimeRange extends HTMLElement {\n"
    "    static #instances = [];\n"
    "    static suspendedTimeRanges = [];\n",
)

replace_once(
    """    static set animationDuration(value) {
        const duration = Number(value);

        if (
            Number.isFinite(duration) &&
            duration >= 0
        ) {
            TimeRange.#animationDuration =
                duration;
        }
    }

    static set percentGoal(value) {""",
    """    static set animationDuration(value) {
        const duration = Number(value);

        if (
            Number.isFinite(duration) &&
            duration >= 0
        ) {
            TimeRange.#animationDuration =
                duration;
        }
    }

    static suspendLayout(
        timeRange
    ) {
        if (
            !(timeRange instanceof TimeRange)
        ) {
            return;
        }

        if (
            !TimeRange.suspendedTimeRanges.includes(
                timeRange
            )
        ) {
            TimeRange.suspendedTimeRanges.push(
                timeRange
            );
        }

        if (
            timeRange.#animationFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                timeRange.#animationFrame
            );

            timeRange.#animationFrame =
                undefined;
        }
    }

    static resumeLayout(
        timeRange
    ) {
        if (
            !(timeRange instanceof TimeRange)
        ) {
            return;
        }

        const index =
            TimeRange.suspendedTimeRanges.indexOf(
                timeRange
            );

        if (index !== -1) {
            TimeRange.suspendedTimeRanges.splice(
                index,
                1
            );
        }
    }

    static #isLayoutSuspended(
        timeRange
    ) {
        return (
            timeRange instanceof TimeRange &&
            TimeRange.suspendedTimeRanges.includes(
                timeRange
            )
        );
    }

    static set percentGoal(value) {""",
)

old_reorder = """        TimeRange.#reorderParent(
            this.parentElement
        );"""
new_reorder = """        TimeRange.#reorderParent(
            this.parentElement,
            this
        );"""
count = text.count(old_reorder)
if count < 1:
    raise SystemExit("Expected at least one reorder call site")
text = text.replace(old_reorder, new_reorder)

replace_once(
    """            TimeRange.#updateParentClipPaths(
                this.parentElement
            );""",
    """            TimeRange.#updateParentClipPaths(
                this.parentElement,
                this
            );""",
)

replace_once(
    """    #animateToLogicalTiming() {
        if (
            !this.isConnected ||""",
    """    #animateToLogicalTiming() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            ) ||
            !this.isConnected ||""",
)

replace_once(
    """    #startTimingAnimation(
        fromStart,
        fromEnd,
        targetStart,
        targetEnd,
        removeAfter = false
    ) {
        if (
            [""",
    """    #startTimingAnimation(
        fromStart,
        fromEnd,
        targetStart,
        targetEnd,
        removeAfter = false
    ) {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return;
        }

        if (
            [""",
)

replace_once(
    """    snapToLogicalTiming() {
        if (
            this.#animationFrame !==""",
    """    snapToLogicalTiming() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return this;
        }

        if (
            this.#animationFrame !==""",
)

replace_once(
    """    refreshVisualGeometry() {
        this.#updateClipPath();""",
    """    refreshVisualGeometry() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return this;
        }

        this.#updateClipPath();""",
)

replace_once(
    """    static #updateParentClipPaths(
        parent
    ) {
        if (!parent) {
            return;
        }""",
    """    static #updateParentClipPaths(
        parent,
        source
    ) {
        if (
            !parent ||
            TimeRange.#isLayoutSuspended(
                source
            )
        ) {
            return;
        }""",
)

replace_once(
    """    #updateClipPath() {
        const parent =""",
    """    #updateClipPath() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return;
        }

        const parent =""",
)

replace_once(
    """    static #reorderParent(
        parent
    ) {
        if (
            !parent ||
            TimeRange.#reordering
        ) {""",
    """    static #reorderParent(
        parent,
        source
    ) {
        if (
            !parent ||
            TimeRange.#reordering ||
            TimeRange.#isLayoutSuspended(
                source
            )
        ) {""",
)

replace_once(
    """    #removeOverlaps() {
        if (
            this.hasAttribute(""",
    """    #removeOverlaps() {
        if (
            TimeRange.#isLayoutSuspended(
                this
            )
        ) {
            return;
        }

        if (
            this.hasAttribute(""",
)

path.write_text(text)
