from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")


def method_bounds(source, marker):
    start = source.find(marker)
    if start == -1:
        raise RuntimeError(f"Could not find method marker: {marker}")

    next_method = re.search(r"\n        (?:static\s+)?#?[A-Za-z_$][\w$]*\s*(?:\(|=)", source[start + len(marker):])
    if next_method is None:
        raise RuntimeError(f"Could not find end of method: {marker}")

    end = start + len(marker) + next_method.start()
    return start, end


def replace_in_method(source, marker, old, new, count=1):
    start, end = method_bounds(source, marker)
    segment = source[start:end]
    if old not in segment:
        raise RuntimeError(f"Expected text not found in method: {marker}")
    segment = segment.replace(old, new, count)
    return source[:start] + segment + source[end:]


# start(): settle the new ring topology immediately and explicitly refresh ticks.
text = replace_in_method(
    text,
    "        start({",
    """            this.#buildPlannedRanges();

            this.#renderAllInsertedRanges();

            this.#scheduleHourRender();

            this.#startTickTimer();""",
    """            this.#buildPlannedRanges();

            this.#renderAllInsertedRanges();

            this.#refreshRingLayout(
                this.#getCurrentTimelineTime(),
                {
                    refreshTickMarks: true
                }
            );

            this.#startTickTimer();"""
)

# clear(): permanent-ring topology is also a ring-layout change.
text = replace_in_method(
    text,
    "        clear() {",
    """            this.#scheduleHourRender();""",
    """            this.#refreshRingLayout(
                undefined,
                {
                    refreshTickMarks: true
                }
            );"""
)

# percent-goal rebuild: route the final topology/layout update through the common path.
text = replace_in_method(
    text,
    "        #handlePercentGoalChange() {",
    """            this.#removeEmptyRings();

            this.#reorderRings(
                now
            );

            this.#scheduleHourRender();""",
    """            this.#refreshRingLayout(
                now,
                {
                    refreshTickMarks: true
                }
            );"""
)

# tick(): elapsed/overtime creation and hour-ring transitions use the same refresh path.
text = replace_in_method(
    text,
    "        #tick() {",
    """            this.#reorderRings(
                now
            );""",
    """            this.#refreshRingLayout(
                now
            );"""
)

# Any inserted-range rerender can add/remove timer rings. Refresh layout at method completion.
start, end = method_bounds(text, "        #renderAllInsertedRanges() {")
segment = text[start:end]
if "this.#refreshRingLayout(" not in segment:
    closing = segment.rfind("\n        }")
    if closing == -1:
        raise RuntimeError("Could not find #renderAllInsertedRanges() closing brace")
    insertion = """

            this.#refreshRingLayout(
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined
            );"""
    segment = segment[:closing] + insertion + segment[closing:]
    text = text[:start] + segment + text[end:]

# Add one ClockTimer-side lifecycle method for all ring-dependent visuals.
if "        #refreshRingLayout(" not in text:
    anchor = "        #needsTick() {"
    index = text.find(anchor)
    if index == -1:
        raise RuntimeError("Could not find #needsTick() insertion point")

    method = """        #refreshRingLayout(
            now,
            {
                refreshTickMarks = false
            } = {}
        ) {
            this.#removeEmptyRings();

            if (
                this.#started
            ) {
                const current =
                    Number.isFinite(
                        now
                    )
                        ? now
                        : this.#getCurrentTimelineTime();

                this.#reorderRings(
                    current
                );
            }
            else {
                this.#ensurePermanentRingOrder();
            }

            this.#scheduleHourRender();

            if (
                !this.hasAttribute(
                    "tick-marks"
                )
            ) {
                return;
            }

            if (
                refreshTickMarks
            ) {
                this.#updateTickMarks(
                    new Date()
                );

                return;
            }

            this.#syncTickMarkGeometry();
        }

"""
    text = text[:index] + method + text[index:]

# Guard against accidentally changing the active/inactive width selection in this patch.
expected_width_logic = """                const width =
                    active
                        ?
                        "var(--clock-timer-inactive-ring-width, clamp(4px, 2.5cqi, 12px))"
                        :
                        "var(--clock-timer-active-ring-width, clamp(2px, 1.25cqi, 6px))";"""
if expected_width_logic not in text:
    raise RuntimeError("Active/inactive width logic changed unexpectedly; refusing to write")

path.write_text(text, encoding="utf-8")
